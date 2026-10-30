use crate::AppState;
use serde::Serialize;
use tauri::{Emitter, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindowBuilder};
#[derive(Default)]
pub struct Output {
    pub monitor_id: Option<String>,
    pub warning: Option<String>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Display {
    id: String,
    name: String,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
    scale: f64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectionStatus {
    open: bool,
    fullscreen: bool,
    monitor_id: Option<String>,
    warning: Option<String>,
}
fn monitors(app: &tauri::AppHandle) -> Result<Vec<Display>, String> {
    app.available_monitors()
        .map_err(|_| "Não foi possível consultar as telas.".into())
        .map(|items| {
            items
                .iter()
                .map(|m| Display {
                    id: format!(
                        "{}:{}:{}:{}:{}",
                        m.name().map(String::as_str).unwrap_or("Tela"),
                        m.position().x,
                        m.position().y,
                        m.size().width,
                        m.size().height
                    ),
                    name: m.name().cloned().unwrap_or("Tela sem identificação".into()),
                    width: m.size().width,
                    height: m.size().height,
                    x: m.position().x,
                    y: m.position().y,
                    scale: m.scale_factor(),
                })
                .collect()
        })
}
fn status(app: &tauri::AppHandle, state: &AppState) -> Result<ProjectionStatus, String> {
    let out = state
        .output
        .lock()
        .map_err(|_| "Estado da saída indisponível")?;
    let monitor_id = out.monitor_id.clone();
    let warning = out.warning.clone();
    drop(out);
    let window = app.get_webview_window("projection");
    Ok(ProjectionStatus {
        open: window
            .as_ref()
            .is_some_and(|w| w.is_visible().unwrap_or(false)),
        fullscreen: window.and_then(|w| w.is_fullscreen().ok()).unwrap_or(false),
        monitor_id,
        warning,
    })
}
fn notify(app: &tauri::AppHandle) {
    if let Ok(s) = status(app, &app.state::<AppState>()) {
        let _ = app.emit_to("operator", "projection:status", s);
    }
}
#[tauri::command]
pub fn list_monitors(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Vec<Display>, String> {
    super::operator(&window)?;
    monitors(&app)
}
#[tauri::command]
pub fn projection_status(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<AppState>,
) -> Result<ProjectionStatus, String> {
    super::operator(&window)?;
    status(&app, &state)
}
#[tauri::command]
pub async fn open_projection(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    monitor_id: Option<String>,
) -> Result<ProjectionStatus, String> {
    super::operator(&window)?;
    let _operation = state
        .display_gate
        .lock()
        .map_err(|_| "Gerenciamento da saída indisponível")?;
    crate::updates::ensure_not_installing(&app)?;
    let list = monitors(&app)?;
    let selected = match monitor_id.as_ref() {
        Some(id) => Some(
            list.iter()
                .find(|m| &m.id == id)
                .ok_or("A tela escolhida não está mais conectada. Atualize as telas.")?,
        ),
        None => None,
    };
    // Tauri enforces the unique window label; never hold a state lock across native window calls.
    let projection = if let Some(w) = app.get_webview_window("projection") {
        w
    } else {
        let w = WebviewWindowBuilder::new(
            &app,
            "projection",
            WebviewUrl::App("projection.html".into()),
        )
        .title("LouvaShow — Projeção")
        .inner_size(960., 540.)
        .visible(false)
        .focused(false)
        .background_color(tauri::window::Color(0, 0, 0, 255))
        .build()
        .map_err(|_| "Não foi possível abrir a projeção.".to_string())?;
        let handle = app.clone();
        w.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let state = handle.state::<AppState>();
                if let Ok(mut out) = state.output.lock() {
                    out.monitor_id = None;
                    out.warning =
                        Some("Janela de projeção fechada. A sessão foi preservada.".into());
                }
                let _ = handle.emit_to(
                    "operator",
                    "projection:status",
                    ProjectionStatus {
                        open: false,
                        fullscreen: false,
                        monitor_id: None,
                        warning: Some(
                            "Janela de projeção fechada. A sessão foi preservada.".into(),
                        ),
                    },
                );
            }
        });
        w
    };
    projection
        .set_fullscreen(false)
        .map_err(|_| "Não foi possível sair de tela cheia.")?;
    let wayland = std::env::var_os("WAYLAND_DISPLAY").is_some();
    let warning = if wayland {
        Some("Wayland: mova a janela manualmente para a saída desejada.".into())
    } else if list.len() < 2 || selected.is_none() {
        Some(
            "Prévia em janela. Mova-a para a tela desejada; tela cheia exige outra tela conectada."
                .into(),
        )
    } else {
        None
    };
    if let Some(m) = selected {
        if !wayland {
            projection
                .set_position(PhysicalPosition::new(m.x, m.y))
                .map_err(|_| "Mova a janela manualmente: o sistema não permitiu posicioná-la.")?;
        }
    }
    projection
        .show()
        .map_err(|_| "Não foi possível exibir a projeção.")?;
    {
        let mut out = state
            .output
            .lock()
            .map_err(|_| "Estado da saída indisponível")?;
        out.monitor_id = monitor_id;
        out.warning = warning;
    }
    let _ = window.set_focus();
    notify(&app);
    status(&app, &state)
}
#[tauri::command]
pub async fn projection_fullscreen(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<ProjectionStatus, String> {
    super::operator(&window)?;
    let _operation = state
        .display_gate
        .lock()
        .map_err(|_| "Gerenciamento da saída indisponível")?;
    let projection = app
        .get_webview_window("projection")
        .ok_or("Abra a projeção primeiro.")?;
    if enabled {
        let list = monitors(&app)?;
        if list.len() < 2 {
            return Err(
                "Com uma tela, use a prévia em janela para manter os controles acessíveis.".into(),
            );
        }
        let target = projection
            .current_monitor()
            .map_err(|_| "Não foi possível validar a tela da projeção")?
            .ok_or("Tela da projeção indisponível")?;
        let operator_monitor = window
            .current_monitor()
            .map_err(|_| "Não foi possível validar a tela do operador")?
            .ok_or("Tela do operador indisponível")?;
        if target.position() == operator_monitor.position() {
            return Err("Mova a projeção para outra tela antes de ativar tela cheia.".into());
        }
    }
    if enabled {
        if let Some(m) = projection
            .current_monitor()
            .map_err(|_| "Não foi possível validar a saída")?
        {
            let id = format!(
                "{}:{}:{}:{}:{}",
                m.name().map(String::as_str).unwrap_or("Tela"),
                m.position().x,
                m.position().y,
                m.size().width,
                m.size().height
            );
            state
                .output
                .lock()
                .map_err(|_| "Estado da saída indisponível")?
                .monitor_id = Some(id);
        }
    }
    projection
        .set_fullscreen(enabled)
        .map_err(|_| "O sistema não permitiu alterar a tela cheia.")?;
    notify(&app);
    status(&app, &state)
}
pub fn watch_monitors(app: tauri::AppHandle) {
    // Only native topology is checked. Presentation synchronization is event-driven.
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(2));
        let Ok(list) = monitors(&app) else { continue };
        let state = app.state::<AppState>();
        let Ok(_operation) = state.display_gate.lock() else {
            continue;
        };
        if let Some(w) = app.get_webview_window("projection") {
            if let Ok(Some(m)) = w.current_monitor() {
                if let Ok(mut out) = state.output.lock() {
                    if out.monitor_id.is_none()
                        && out
                            .warning
                            .as_ref()
                            .is_none_or(|v| !v.starts_with("Tela desconectada"))
                    {
                        out.monitor_id = Some(format!(
                            "{}:{}:{}:{}:{}",
                            m.name().map(String::as_str).unwrap_or("Tela"),
                            m.position().x,
                            m.position().y,
                            m.size().width,
                            m.size().height
                        ));
                    }
                }
            }
        }
        let lost = {
            let Ok(out) = state.output.lock() else {
                continue;
            };
            out.monitor_id
                .as_ref()
                .is_some_and(|id| !list.iter().any(|m| &m.id == id))
        };
        if lost {
            if let Some(w) = app.get_webview_window("projection") {
                let _ = w.hide();
                let _ = w.set_fullscreen(false);
            }
            if let Ok(mut out) = state.output.lock() {
                out.monitor_id = None;
                out.warning = Some(
                    "Tela desconectada. Projeção ocultada; escolha outra saída e reabra.".into(),
                );
            }
            notify(&app);
        }
    });
}
