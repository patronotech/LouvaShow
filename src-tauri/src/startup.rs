//! Startup coordination is independent from application data so failures can be
//! displayed and retried before the database-backed commands become available.
use crate::{domain::presentation::Snapshot, infrastructure::database::Database, AppState};
use serde::Serialize;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager, State};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Loading,
    Ready,
    Error,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupSnapshot {
    revision: u64,
    attempt: u64,
    status: Status,
    error: Option<String>,
    frontend_ready: bool,
    completed: bool,
}

struct Session {
    snapshot: StartupSnapshot,
    backend_ready: bool,
    initializing: bool,
    completing: bool,
}

impl Default for Session {
    fn default() -> Self {
        Self {
            snapshot: StartupSnapshot {
                revision: 0,
                attempt: 0,
                status: Status::Loading,
                error: None,
                frontend_ready: false,
                completed: false,
            },
            backend_ready: false,
            initializing: true,
            completing: false,
        }
    }
}

impl Session {
    fn changed(&mut self) -> StartupSnapshot {
        self.snapshot.revision += 1;
        self.snapshot.clone()
    }

    fn finish_backend(&mut self, result: Result<(), String>) -> StartupSnapshot {
        self.initializing = false;
        match result {
            Ok(()) => {
                self.backend_ready = true;
                self.snapshot.status = Status::Ready;
                self.snapshot.error = None;
            }
            Err(error) => {
                self.snapshot.status = Status::Error;
                self.snapshot.error = Some(error);
            }
        }
        self.changed()
    }

    fn retry(&mut self) -> Result<(StartupSnapshot, bool), String> {
        if self.snapshot.completed || self.completing {
            return Err("A inicialização já foi concluída.".into());
        }
        if self.initializing {
            return Err("Aguarde a inicialização em andamento.".into());
        }
        self.snapshot.attempt += 1;
        self.snapshot.frontend_ready = false;
        self.snapshot.error = None;
        self.snapshot.status = if self.backend_ready {
            Status::Ready
        } else {
            Status::Loading
        };
        self.initializing = !self.backend_ready;
        Ok((self.changed(), self.initializing))
    }

    fn operator_ready(&mut self, attempt: u64) -> Result<StartupSnapshot, String> {
        if attempt != self.snapshot.attempt {
            return Ok(self.snapshot.clone());
        }
        if !self.backend_ready || self.snapshot.status != Status::Ready {
            return Err("O aplicativo ainda não terminou de carregar.".into());
        }
        if !self.snapshot.frontend_ready {
            self.snapshot.frontend_ready = true;
            return Ok(self.changed());
        }
        Ok(self.snapshot.clone())
    }

    fn operator_failed(&mut self, attempt: u64, message: String) -> StartupSnapshot {
        if attempt == self.snapshot.attempt
            && self.backend_ready
            && !self.snapshot.completed
            && !self.snapshot.frontend_ready
        {
            self.snapshot.status = Status::Error;
            self.snapshot.error = Some(format!(
                "Não foi possível preparar o operador. {}",
                message.trim().chars().take(2000).collect::<String>()
            ));
            return self.changed();
        }
        self.snapshot.clone()
    }

    fn can_complete(&self) -> bool {
        self.snapshot.status == Status::Ready && self.backend_ready && self.snapshot.frontend_ready
    }
}

#[derive(Default)]
pub struct StartupState(Mutex<Session>);

fn startup_window(window: &tauri::WebviewWindow) -> Result<(), String> {
    if matches!(window.label(), "operator" | "splash") {
        Ok(())
    } else {
        Err("Operação indisponível nesta janela.".into())
    }
}

fn publish(app: &tauri::AppHandle, snapshot: &StartupSnapshot) {
    if app.emit("startup:state", snapshot).is_err() {
        eprintln!("LouvaShow: falha ao comunicar estado de inicialização.");
    }
}

fn prepare_application(app: &tauri::AppHandle) -> Result<AppState, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Não foi possível localizar a pasta de dados do LouvaShow.")?;
    std::fs::create_dir_all(&dir).map_err(|_| {
        "Não foi possível abrir a pasta de dados. Verifique as permissões e o espaço em disco."
    })?;
    #[allow(unused_mut)]
    let mut db = Database::open(dir.join("louvashow.sqlite3"))?;
    #[cfg(feature = "bundled-hymns")]
    if db.get_setting("seed-pack.hc-640-v1")?.is_none() {
        let pack = crate::application::song_exchange::preview(vec![
            crate::domain::importing::ImportFile {
                name: "hc_xml.zip".into(),
                bytes: include_bytes!("../resources/hc_xml.zip").to_vec(),
            },
        ])?;
        db.install_seed_pack("hc-640-v1", pack.songs, "hinos")?;
    }
    let mut snapshot = Snapshot::default();
    if let Some(raw) = db.get_setting("theme.v1")? {
        let theme: crate::domain::presentation::Theme = serde_json::from_str(&raw)
            .map_err(|_| "Não foi possível ler o tema salvo. Seus dados foram preservados; restaure uma configuração válida antes de tentar novamente.")?;
        theme.validate()?;
        snapshot.theme = theme;
    }
    Ok(AppState {
        db: Arc::new(Mutex::new(db)),
        presentation: Mutex::new(snapshot),
        song_cache: Arc::new(Mutex::new(Default::default())),
        display_gate: Mutex::new(()),
        output: Mutex::new(Default::default()),
    })
}

pub fn begin(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let worker_app = app.clone();
        let result = tauri::async_runtime::spawn_blocking(move || prepare_application(&worker_app))
            .await
            .map_err(|_| {
                "Falha ao carregar o LouvaShow. Seus dados não foram apagados.".to_string()
            })
            .and_then(|result| result)
            .and_then(|application| {
                if app.manage(application) {
                    crate::commands::displays::watch_monitors(app.clone());
                    Ok(())
                } else {
                    Err(
                        "O aplicativo já está inicializado. Feche e abra o LouvaShow novamente."
                            .into(),
                    )
                }
            });
        if let Ok(mut session) = app.state::<StartupState>().0.lock() {
            let snapshot = session.finish_backend(result);
            drop(session);
            publish(&app, &snapshot);
        }
    });
}

#[tauri::command]
pub fn get_startup_state(
    window: tauri::WebviewWindow,
    state: State<StartupState>,
) -> Result<StartupSnapshot, String> {
    startup_window(&window)?;
    Ok(state
        .0
        .lock()
        .map_err(|_| "Estado de inicialização indisponível.")?
        .snapshot
        .clone())
}

#[tauri::command]
pub fn mark_operator_ready(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<StartupState>,
    attempt: u64,
) -> Result<StartupSnapshot, String> {
    crate::commands::operator(&window)?;
    let snapshot = state
        .0
        .lock()
        .map_err(|_| "Estado de inicialização indisponível.")?
        .operator_ready(attempt)?;
    publish(&app, &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn mark_operator_failed(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<StartupState>,
    attempt: u64,
    message: String,
) -> Result<StartupSnapshot, String> {
    crate::commands::operator(&window)?;
    let snapshot = state
        .0
        .lock()
        .map_err(|_| "Estado de inicialização indisponível.")?
        .operator_failed(attempt, message);
    publish(&app, &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub fn retry_startup(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<StartupState>,
) -> Result<StartupSnapshot, String> {
    startup_window(&window)?;
    let (snapshot, restart_backend) = state
        .0
        .lock()
        .map_err(|_| "Estado de inicialização indisponível.")?
        .retry()?;
    publish(&app, &snapshot);
    if restart_backend {
        begin(app);
    }
    Ok(snapshot)
}

#[tauri::command]
pub async fn complete_startup(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, StartupState>,
) -> Result<StartupSnapshot, String> {
    if window.label() != "splash" {
        return Err("Somente a abertura pode liberar o operador.".into());
    }
    {
        let mut session = state
            .0
            .lock()
            .map_err(|_| "Estado de inicialização indisponível.")?;
        if !session.can_complete() {
            return Err("Aguarde o carregamento do aplicativo.".into());
        }
        if session.completing {
            return Err("A abertura do operador já está em andamento.".into());
        }
        session.completing = true;
    }
    let opened = app
        .get_webview_window("operator")
        .ok_or_else(|| "A janela do operador não está disponível.".to_string())
        .and_then(|operator| {
            operator
                .show()
                .map_err(|_| "Não foi possível abrir a janela do operador.".to_string())?;
            let _ = operator.set_focus();
            Ok(())
        });
    let mut session = state
        .0
        .lock()
        .map_err(|_| "Estado de inicialização indisponível.")?;
    session.completing = false;
    opened?;
    session.snapshot.completed = true;
    let snapshot = session.changed();
    drop(session);
    publish(&app, &snapshot);
    window
        .close()
        .map_err(|_| "O operador abriu, mas não foi possível fechar a abertura.".to_string())?;
    Ok(snapshot)
}

#[tauri::command]
pub fn close_startup(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<StartupState>,
) -> Result<(), String> {
    startup_window(&window)?;
    if state
        .0
        .lock()
        .map_err(|_| "Estado de inicialização indisponível.")?
        .snapshot
        .completed
    {
        if window.label() == "splash" {
            return window
                .destroy()
                .map_err(|_| "Não foi possível fechar a abertura.".into());
        }
        return Err(
            "A inicialização já foi concluída. Feche o aplicativo pela janela do operador.".into(),
        );
    }
    app.exit(0);
    Ok(())
}

pub fn window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if matches!(window.label(), "splash" | "operator")
        && matches!(event, tauri::WindowEvent::CloseRequested { .. })
    {
        let completed = window
            .try_state::<StartupState>()
            .and_then(|state| {
                state
                    .0
                    .lock()
                    .ok()
                    .map(|session| session.snapshot.completed)
            })
            .unwrap_or(false);
        if !completed {
            window.app_handle().exit(0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn operator_requires_both_native_and_frontend_readiness() {
        let mut session = Session::default();
        assert!(!session.can_complete());
        assert!(session.operator_ready(0).is_err());
        session.finish_backend(Ok(()));
        assert!(!session.can_complete());
        session.operator_ready(0).unwrap();
        assert!(session.can_complete());
    }

    #[test]
    fn backend_failure_blocks_operator_and_can_be_retried_without_reset() {
        let mut session = Session::default();
        session.finish_backend(Err("Banco indisponível".into()));
        assert!(!session.can_complete());
        let (snapshot, restart) = session.retry().unwrap();
        assert!(restart);
        assert_eq!(snapshot.status, Status::Loading);
        assert_eq!(snapshot.attempt, 1);
        assert!(snapshot.error.is_none());
        assert!(!session.can_complete());
    }

    #[test]
    fn frontend_retry_preserves_initialized_backend_and_revisions_increase() {
        let mut session = Session::default();
        let first = session.finish_backend(Ok(()));
        session.snapshot.status = Status::Error;
        let (retry, restart) = session.retry().unwrap();
        assert!(!restart);
        assert_eq!(retry.status, Status::Ready);
        assert!(!retry.frontend_ready);
        assert!(retry.revision > first.revision);
        assert_eq!(retry.attempt, 1);
        assert!(session.operator_ready(1).unwrap().revision > retry.revision);
    }

    #[test]
    fn concurrent_or_completed_retry_is_rejected() {
        let mut session = Session::default();
        assert!(session.retry().is_err());
        session.finish_backend(Ok(()));
        session.snapshot.completed = true;
        assert!(session.retry().is_err());
    }

    #[test]
    fn stale_frontend_callbacks_cannot_complete_or_fail_a_new_attempt() {
        let mut session = Session::default();
        session.finish_backend(Ok(()));
        session.operator_failed(0, "Falha temporária".into());
        session.retry().unwrap();
        session.operator_ready(0).unwrap();
        session.operator_failed(0, "Resposta antiga".into());
        assert!(!session.snapshot.frontend_ready);
        assert_eq!(session.snapshot.status, Status::Ready);
        session.operator_ready(1).unwrap();
        assert!(session.can_complete());
    }
}
