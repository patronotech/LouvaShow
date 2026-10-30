//! Explicit, signed desktop updates. No updater command is exposed to projection or LAN.
use crate::{commands::operator, AppState};
use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const MAX_DOWNLOAD: u64 = 350 * 1024 * 1024;
const BUSY: &str = "Já existe uma operação de atualização em andamento. Aguarde.";

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Idle,
    Checking,
    Available,
    Downloading,
    Ready,
    Installing,
    UpToDate,
    Error,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSnapshot {
    revision: u64,
    status: Status,
    current_version: String,
    available_version: Option<String>,
    notes: Option<String>,
    published_at: Option<String>,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    error: Option<String>,
}

impl Default for UpdateSnapshot {
    fn default() -> Self {
        Self {
            revision: 0,
            status: Status::Idle,
            current_version: env!("CARGO_PKG_VERSION").into(),
            available_version: None,
            notes: None,
            published_at: None,
            downloaded_bytes: 0,
            total_bytes: None,
            error: None,
        }
    }
}

#[derive(Default)]
pub struct UpdateState {
    snapshot: Mutex<UpdateSnapshot>,
    operation: tokio::sync::Mutex<()>,
    pending: Mutex<Option<Update>>,
    downloaded: Mutex<Option<Arc<Vec<u8>>>>,
    installing: AtomicBool,
}

impl UpdateState {
    fn snapshot(&self) -> Result<UpdateSnapshot, String> {
        self.snapshot
            .lock()
            .map(|s| s.clone())
            .map_err(|_| "Estado da atualização indisponível.".into())
    }
    fn change(
        &self,
        app: &tauri::AppHandle,
        edit: impl FnOnce(&mut UpdateSnapshot),
    ) -> Result<UpdateSnapshot, String> {
        let snapshot = {
            let mut s = self
                .snapshot
                .lock()
                .map_err(|_| "Estado da atualização indisponível.")?;
            edit(&mut s);
            s.revision += 1;
            s.clone()
        };
        let _ = app.emit_to("operator", "updates:state", &snapshot);
        Ok(snapshot)
    }
    fn fail(&self, app: &tauri::AppHandle, message: &str) -> String {
        let _ = self.change(app, |s| {
            s.status = Status::Error;
            s.error = Some(message.into());
        });
        message.into()
    }
}

/// Called while holding AppState.display_gate, also used by install_update.
pub fn ensure_not_installing(app: &tauri::AppHandle) -> Result<(), String> {
    if app.state::<UpdateState>().installing.load(Ordering::SeqCst) {
        return Err(
            "A atualização está sendo instalada. Aguarde o reinício para abrir a projeção.".into(),
        );
    }
    Ok(())
}

fn github_url(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port_or_known_default() == Some(443)
        && matches!(
            url.host_str(),
            Some(
                "github.com"
                    | "release-assets.githubusercontent.com"
                    | "objects.githubusercontent.com"
            )
        )
}

fn artifact_url(url: &reqwest::Url) -> bool {
    github_url(url)
        && url.host_str() == Some("github.com")
        && url
            .path()
            .starts_with("/dantetesta/LouvaShow/releases/download/")
        && url.query().is_none()
        && url.fragment().is_none()
}

fn redirect_policy() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= 5 || !github_url(attempt.url()) {
            attempt.error("Redirecionamento de atualização não permitido")
        } else {
            attempt.follow()
        }
    })
}

fn supported_installation() -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Err("Atualizações estão desativadas nesta compilação de desenvolvimento. Use o instalador oficial.".into());
    }
    #[cfg(target_os = "linux")]
    if std::env::var_os("APPIMAGE").is_none() {
        return Err("Nesta instalação Linux, atualize pelo gerenciador de pacotes ou instale uma versão AppImage oficial.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn get_update_state(
    window: tauri::WebviewWindow,
    state: State<'_, UpdateState>,
) -> Result<UpdateSnapshot, String> {
    operator(&window)?;
    state.snapshot()
}

#[tauri::command]
pub async fn check_for_updates(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, UpdateState>,
) -> Result<UpdateSnapshot, String> {
    operator(&window)?;
    let _operation = state.operation.try_lock().map_err(|_| BUSY)?;
    if state.installing.load(Ordering::SeqCst) {
        return Err(BUSY.into());
    }
    supported_installation().map_err(|e| state.fail(&app, &e))?;
    state.change(&app, |s| {
        s.status = Status::Checking;
        s.error = None;
    })?;
    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(30))
        .configure_client(|client| {
            client
                .https_only(true)
                .connect_timeout(Duration::from_secs(10))
                .redirect(redirect_policy())
        })
        .build()
        .map_err(|_| {
            state.fail(
                &app,
                "Não foi possível configurar a atualização. Reinstale pelo site oficial.",
            )
        })?;
    let update = updater.check().await.map_err(|_| state.fail(&app, "Não foi possível consultar atualizações. Confira a conexão e tente novamente; a versão instalada foi preservada."))?;
    if update
        .as_ref()
        .is_some_and(|u| !artifact_url(&u.download_url))
    {
        return Err(state.fail(
            &app,
            "A atualização informou um endereço não permitido. Nenhum arquivo foi instalado.",
        ));
    }
    *state.downloaded.lock().map_err(|_| BUSY)? = None;
    *state.pending.lock().map_err(|_| BUSY)? = update.clone();
    state.change(&app, |s| {
        s.status = if update.is_some() {
            Status::Available
        } else {
            Status::UpToDate
        };
        s.available_version = update.as_ref().map(|u| u.version.clone());
        s.notes = update
            .as_ref()
            .and_then(|u| u.body.as_ref())
            .map(|text| text.chars().take(12_000).collect());
        s.published_at = update
            .as_ref()
            .and_then(|u| u.raw_json.get("pub_date"))
            .and_then(|v| v.as_str())
            .map(|v| v.chars().take(80).collect());
        s.downloaded_bytes = 0;
        s.total_bytes = None;
        s.error = None;
    })
}

fn checked_size(current: u64, chunk: usize, total: Option<u64>) -> Result<u64, String> {
    let next = current
        .checked_add(chunk as u64)
        .ok_or("Tamanho de atualização inválido.")?;
    if next > MAX_DOWNLOAD || total.is_some_and(|n| n > MAX_DOWNLOAD) {
        return Err(
            "O pacote excede o limite de 350 MiB. Baixe o instalador pelo site oficial.".into(),
        );
    }
    Ok(next)
}

async fn fetch_package(
    app: &tauri::AppHandle,
    state: &UpdateState,
    update: &Update,
) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .https_only(true)
        .redirect(redirect_policy())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(600))
        .user_agent("LouvaShow-Updater")
        .build()
        .map_err(|_| "Não foi possível iniciar o download.")?;
    let mut response = client
        .get(update.download_url.clone())
        .send()
        .await
        .map_err(|_| "Falha ao baixar atualização. Confira sua conexão e tente novamente.")?;
    if !response.status().is_success() {
        return Err("O servidor não disponibilizou o pacote. Tente novamente mais tarde.".into());
    }
    let total = response.content_length();
    checked_size(0, 0, total)?;
    let mut bytes = Vec::new();
    let mut last_emit = Instant::now();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Download interrompido. Tente baixar novamente.")?
    {
        let received = checked_size(bytes.len() as u64, chunk.len(), total)?;
        bytes.extend_from_slice(&chunk);
        if last_emit.elapsed() >= Duration::from_millis(100) {
            state.change(app, |s| {
                s.downloaded_bytes = received;
                s.total_bytes = total;
            })?;
            last_emit = Instant::now();
        }
    }
    if bytes.is_empty() || total.is_some_and(|n| n != bytes.len() as u64) {
        return Err("O pacote recebido está incompleto. Baixe novamente.".into());
    }
    // Same signature and signed-version validation as the official plugin downloader,
    // with a bounded streaming buffer instead of its unlimited Vec allocation.
    update.verify(&bytes).map_err(|_| "A assinatura ou versão do pacote não é válida. Nada foi instalado. Baixe somente pelo site oficial.")?;
    Ok(bytes)
}

#[tauri::command]
pub async fn download_update(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, UpdateState>,
) -> Result<UpdateSnapshot, String> {
    operator(&window)?;
    let _operation = state.operation.try_lock().map_err(|_| BUSY)?;
    if state.installing.load(Ordering::SeqCst) {
        return Err(BUSY.into());
    }
    supported_installation().map_err(|e| state.fail(&app, &e))?;
    let update = state
        .pending
        .lock()
        .map_err(|_| BUSY)?
        .clone()
        .ok_or("Verifique as atualizações antes de baixar.")?;
    let cached_size = state
        .downloaded
        .lock()
        .map_err(|_| BUSY)?
        .as_ref()
        .map(|bytes| bytes.len() as u64);
    if let Some(size) = cached_size {
        return state.change(&app, |s| {
            s.status = Status::Ready;
            s.downloaded_bytes = size;
            s.total_bytes = Some(size);
            s.error = None;
        });
    }
    state.change(&app, |s| {
        s.status = Status::Downloading;
        s.downloaded_bytes = 0;
        s.total_bytes = None;
        s.error = None;
    })?;
    let bytes = fetch_package(&app, &state, &update)
        .await
        .map_err(|e| state.fail(&app, &e))?;
    let size = bytes.len() as u64;
    *state.downloaded.lock().map_err(|_| BUSY)? = Some(Arc::new(bytes));
    state.change(&app, |s| {
        s.status = Status::Ready;
        s.downloaded_bytes = size;
        s.total_bytes = Some(size);
    })
}

fn may_install(confirmed: bool, projection_open: bool, package_ready: bool) -> Result<(), String> {
    if !confirmed {
        return Err("Confirme a instalação e o reinício do LouvaShow.".into());
    }
    if projection_open {
        return Err(
            "Feche a janela de projeção antes de instalar. Apagar a saída não fecha a janela."
                .into(),
        );
    }
    if !package_ready {
        return Err("Baixe e verifique a atualização antes de instalar.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn install_update(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, UpdateState>,
    core: State<'_, AppState>,
    confirmed: bool,
) -> Result<UpdateSnapshot, String> {
    operator(&window)?;
    let _operation = state.operation.try_lock().map_err(|_| BUSY)?;
    supported_installation().map_err(|e| state.fail(&app, &e))?;
    let update = state.pending.lock().map_err(|_| BUSY)?.clone();
    let bytes = state.downloaded.lock().map_err(|_| BUSY)?.clone();
    {
        // Serializes the existence check and flag with open_projection. Never hold
        // this mutex while installing, restarting, or calling native window APIs.
        let _display = core
            .display_gate
            .lock()
            .map_err(|_| "Gerenciamento da saída indisponível.")?;
        may_install(
            confirmed,
            app.get_webview_window("projection").is_some(),
            update.is_some() && bytes.is_some(),
        )?;
        if state.installing.swap(true, Ordering::SeqCst) {
            return Err(BUSY.into());
        }
    }
    if let Err(e) = state.change(&app, |s| {
        s.status = Status::Installing;
        s.error = None;
    }) {
        state.installing.store(false, Ordering::SeqCst);
        return Err(e);
    }
    let update = update.ok_or(BUSY)?.restart_after_install(true);
    let bytes = bytes.ok_or(BUSY)?;
    let result =
        tauri::async_runtime::spawn_blocking(move || update.install(bytes.as_slice())).await;
    if !matches!(result, Ok(Ok(()))) {
        state.installing.store(false, Ordering::SeqCst);
        return Err(state.fail(&app, "Não foi possível instalar a atualização. Confira permissões e espaço livre; seus dados não foram apagados. Você pode tentar novamente ou usar o instalador oficial."));
    }
    // Windows exits inside the plugin after successfully launching NSIS/MSI.
    // macOS/Linux finish replacement here, then relaunch through Tauri.
    app.restart();
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn package_urls_are_repo_scoped_and_https() {
        for url in [
            "https://evil.example/file",
            "http://github.com/dantetesta/LouvaShow/releases/download/v1/a",
            "https://github.com/other/app/releases/download/v1/a",
            "https://user@github.com/dantetesta/LouvaShow/releases/download/v1/a",
        ] {
            assert!(!artifact_url(&url.parse().unwrap()));
        }
        assert!(artifact_url(
            &"https://github.com/dantetesta/LouvaShow/releases/download/v1/LouvaShow.tar.gz"
                .parse()
                .unwrap()
        ));
    }
    #[test]
    fn install_requires_confirmation_closed_projection_and_verified_package() {
        assert!(may_install(true, false, true).is_ok());
        assert!(may_install(false, false, true).is_err());
        assert!(may_install(true, true, true).is_err());
        assert!(may_install(true, false, false).is_err());
    }
    #[test]
    fn transfer_rejects_oversized_known_and_chunked_responses() {
        assert_eq!(checked_size(20, 30, None).unwrap(), 50);
        assert!(checked_size(0, 0, Some(MAX_DOWNLOAD + 1)).is_err());
        assert!(checked_size(MAX_DOWNLOAD, 1, None).is_err());
        assert!(checked_size(u64::MAX, 1, None).is_err());
    }
    #[test]
    fn concurrent_operations_are_rejected_and_release_after_failure() {
        let state = UpdateState::default();
        let operation = state.operation.try_lock().unwrap();
        assert!(state.operation.try_lock().is_err());
        drop(operation);
        assert!(state.operation.try_lock().is_ok());
        assert_eq!(state.snapshot().unwrap().status, Status::Idle);
        assert!(!state.installing.load(Ordering::SeqCst));
        assert_eq!(serde_json::to_value(Status::UpToDate).unwrap(), "upToDate");
    }
}
