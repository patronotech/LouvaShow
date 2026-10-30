//! Optional trusted-LAN service. Authentication is approved on the desktop;
//! no email, owner id or role supplied by a browser becomes an authorization claim.
use crate::{
    domain::charts::{ChartActor, ChartDocument, SaveChartInput},
    AppState,
};
use axum::{
    body::Body,
    extract::{ConnectInfo, DefaultBodyLimit, Path, Query, State},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::Manager;
use uuid::Uuid;

const WARNING: &str = "HTTP sem criptografia. Use somente uma rede local confiável; não exponha esta porta à internet.";
// Approved devices remain valid until revoked. Browsers may clear cookies earlier.
const COOKIE_SECONDS: i64 = 400 * 24 * 60 * 60;
type Store = Arc<Mutex<TeamDb>>;
type HttpResult = Result<Response, (StatusCode, Json<Value>)>;
fn failure(code: StatusCode, message: impl Into<String>) -> (StatusCode, Json<Value>) {
    (code, Json(json!({"error": message.into()})))
}
fn db_error(_: rusqlite::Error) -> String {
    "Não foi possível acessar os dados da equipe. Nenhum dado foi apagado.".into()
}
fn hash(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamUser {
    pub id: String,
    pub name: String,
    pub email: String,
    pub roles: Vec<String>,
    pub gravatar_enabled: bool,
    pub can_publish: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveUser {
    pub id: Option<String>,
    pub name: String,
    pub email: String,
    pub roles: Vec<String>,
    pub gravatar_enabled: bool,
    #[serde(default)]
    pub can_publish: bool,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    id: String,
    pair_code: String,
    user_id: String,
    user_name: String,
    device_name: String,
    approved: bool,
    created_at: String,
    last_seen_at: String,
}
#[derive(Clone, Serialize)]
pub struct TeamStatus {
    running: bool,
    url: Option<String>,
    warning: Option<String>,
}
#[derive(Serialize)]
pub struct Interface {
    name: String,
    ip: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonalItem {
    id: String,
    chart_id: String,
    revision: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonalSetlist {
    id: String,
    name: String,
    revision: u64,
    items: Vec<PersonalItem>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePersonalSetlist {
    id: Option<String>,
    name: String,
    expected_revision: Option<u64>,
    items: Vec<PersonalItem>,
}

struct TeamDb {
    connection: Connection,
    avatar_requests: HashMap<String, Instant>,
}
impl TeamDb {
    fn open(path: &std::path::Path) -> Result<Self, String> {
        let mut connection = Connection::open(path).map_err(db_error)?;
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(db_error)?;
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .map_err(db_error)?;
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(db_error)?;
        if version > 2 {
            return Err("Banco da equipe criado por versão mais recente.".into());
        }
        if version == 0 {
            let tx = connection.transaction().map_err(db_error)?;
            tx.execute_batch("CREATE TABLE members(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,roles TEXT NOT NULL,gravatar INTEGER NOT NULL DEFAULT 0,avatar BLOB,avatar_mime TEXT);
                CREATE TABLE devices(id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,token_hash TEXT UNIQUE NOT NULL,name TEXT NOT NULL,approved INTEGER NOT NULL DEFAULT 0,expires INTEGER NOT NULL,created TEXT NOT NULL,seen TEXT NOT NULL);
                CREATE TABLE personal_setlists(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,revision INTEGER NOT NULL,data TEXT NOT NULL);
                PRAGMA user_version=1;").map_err(db_error)?;
            tx.commit().map_err(db_error)?;
        }
        if version < 2 {
            connection.execute_batch("BEGIN IMMEDIATE; ALTER TABLE members ADD COLUMN can_publish INTEGER NOT NULL DEFAULT 0; PRAGMA user_version=2; COMMIT;").map_err(db_error)?;
        }
        Ok(Self {
            connection,
            avatar_requests: HashMap::new(),
        })
    }
    fn users(&self) -> Result<Vec<TeamUser>, String> {
        let mut statement = self
            .connection
            .prepare("SELECT id,name,email,roles,gravatar,can_publish FROM members ORDER BY name")
            .map_err(db_error)?;
        let rows = statement
            .query_map([], |r| {
                Ok(TeamUser {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    email: r.get(2)?,
                    roles: serde_json::from_str(&r.get::<_, String>(3)?).unwrap_or_default(),
                    gravatar_enabled: r.get(4)?,
                    can_publish: r.get(5)?,
                })
            })
            .map_err(db_error)?;
        rows.collect::<Result<Vec<_>, _>>().map_err(db_error)
    }
    fn save_user(&mut self, input: SaveUser) -> Result<TeamUser, String> {
        let email = input.email.trim().to_lowercase();
        let name = input.name.trim();
        if name.is_empty()
            || name.chars().count() > 100
            || email.len() > 254
            || email.matches('@').count() != 1
            || email
                .bytes()
                .any(|b| b.is_ascii_whitespace() || b.is_ascii_control())
            || email.starts_with('@')
            || email.ends_with('@')
        {
            return Err("Informe nome e e-mail válidos.".into());
        }
        if input.roles.is_empty()
            || input.roles.len() > 8
            || input.roles.iter().any(|v| {
                v.trim().is_empty() || v.chars().count() > 60 || v.chars().any(char::is_control)
            })
        {
            return Err("Escolha funções válidas para o membro.".into());
        }
        let id = input
            .id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let tx = self.connection.transaction().map_err(db_error)?;
        if input.id.is_some() {
            let old: Option<String> = tx
                .query_row("SELECT email FROM members WHERE id=?1", [&id], |r| r.get(0))
                .optional()
                .map_err(db_error)?;
            let Some(old) = old else {
                return Err("Membro não encontrado.".into());
            };
            if old != email {
                tx.execute("DELETE FROM devices WHERE member_id=?1", [&id])
                    .map_err(db_error)?;
            }
            tx.execute("UPDATE members SET name=?2,email=?3,roles=?4,gravatar=?5,can_publish=?6,avatar=CASE WHEN email<>?3 OR ?5=0 THEN NULL ELSE avatar END,avatar_mime=CASE WHEN email<>?3 OR ?5=0 THEN NULL ELSE avatar_mime END WHERE id=?1",params![id,name,email,serde_json::to_string(&input.roles).map_err(|_|"Funções inválidas")?,input.gravatar_enabled,input.can_publish]).map_err(db_error)?;
        } else {
            tx.execute("INSERT INTO members(id,name,email,roles,gravatar,can_publish) VALUES(?1,?2,?3,?4,?5,?6)",params![id,name,email,serde_json::to_string(&input.roles).map_err(|_|"Funções inválidas")?,input.gravatar_enabled,input.can_publish]).map_err(db_error)?;
        }
        tx.commit().map_err(db_error)?;
        Ok(TeamUser {
            id,
            name: name.into(),
            email,
            roles: input.roles,
            gravatar_enabled: input.gravatar_enabled,
            can_publish: input.can_publish,
        })
    }
    fn login(&mut self, email: &str, name: &str) -> Result<(String, String), String> {
        if email.len() > 254 || name.chars().count() > 100 {
            return Err("Informe o e-mail e o nome deste dispositivo.".into());
        }
        self.connection
            .execute(
                "DELETE FROM devices WHERE approved=0 AND expires<=?1",
                [Utc::now().timestamp()],
            )
            .map_err(db_error)?;
        let user: Option<String> = self
            .connection
            .query_row(
                "SELECT id FROM members WHERE email=?1",
                [email.trim().to_lowercase()],
                |r| r.get(0),
            )
            .optional()
            .map_err(db_error)?;
        let user = user.ok_or("Acesso não disponível. Confira o cadastro com o operador.")?;
        let count: i64 = self
            .connection
            .query_row(
                "SELECT count(*) FROM devices WHERE member_id=?1",
                [&user],
                |r| r.get(0),
            )
            .map_err(db_error)?;
        if count >= 20 {
            return Err(
                "Limite de dispositivos atingido. Peça ao operador para revogar os antigos.".into(),
            );
        }
        let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
        let now = Utc::now();
        let device_id = Uuid::new_v4().to_string();
        self.connection.execute("INSERT INTO devices(id,member_id,token_hash,name,expires,created,seen) VALUES(?1,?2,?3,?4,?5,?6,?6)",params![device_id,user,hash(&token),if name.trim().is_empty(){"Dispositivo"}else{name.trim()},now.timestamp()+600,now.to_rfc3339()]).map_err(db_error)?;
        Ok((token, device_id[..8].to_uppercase()))
    }
    fn authenticate(&self, token: &str) -> Result<TeamUser, String> {
        if token.len() != 64 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err("Sessão inválida. Solicite acesso novamente.".into());
        }
        let id: Option<String> = self
            .connection
            .query_row(
                "SELECT member_id FROM devices WHERE token_hash=?1 AND approved=1",
                params![hash(token)],
                |r| r.get(0),
            )
            .optional()
            .map_err(db_error)?;
        let id = id.ok_or("Aguardando aprovação ou sessão revogada. Consulte o operador.")?;
        self.connection
            .execute(
                "UPDATE devices SET seen=?2 WHERE token_hash=?1",
                params![hash(token), Utc::now().to_rfc3339()],
            )
            .map_err(db_error)?;
        self.users()?
            .into_iter()
            .find(|u| u.id == id)
            .ok_or("Membro indisponível.".into())
    }
    fn devices(&self) -> Result<Vec<Device>, String> {
        let mut statement=self.connection.prepare("SELECT d.id,d.member_id,m.name,d.name,d.approved,d.created,d.seen FROM devices d JOIN members m ON m.id=d.member_id WHERE d.approved=1 OR d.expires>?1 ORDER BY d.created DESC").map_err(db_error)?;
        let result = statement
            .query_map([Utc::now().timestamp()], |r| {
                Ok(Device {
                    id: r.get(0)?,
                    pair_code: r.get::<_, String>(0)?[..8].to_uppercase(),
                    user_id: r.get(1)?,
                    user_name: r.get(2)?,
                    device_name: r.get(3)?,
                    approved: r.get(4)?,
                    created_at: r.get(5)?,
                    last_seen_at: r.get(6)?,
                })
            })
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error);
        result
    }
    fn approve(&self, id: &str) -> Result<(), String> {
        if self
            .connection
            .execute(
                "UPDATE devices SET approved=1 WHERE id=?1 AND (approved=1 OR expires>?2)",
                params![id, Utc::now().timestamp()],
            )
            .map_err(db_error)?
            != 1
        {
            return Err("Solicitação expirada ou indisponível.".into());
        }
        Ok(())
    }
    fn revoke(&self, id: &str) -> Result<(), String> {
        self.connection
            .execute("DELETE FROM devices WHERE id=?1", [id])
            .map_err(db_error)?;
        Ok(())
    }
    fn setlists(&self, user: &str) -> Result<Vec<PersonalSetlist>, String> {
        let mut statement = self
            .connection
            .prepare("SELECT data FROM personal_setlists WHERE owner=?1 ORDER BY id")
            .map_err(db_error)?;
        let data = statement
            .query_map([user], |r| r.get::<_, String>(0))
            .map_err(db_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error)?;
        data.into_iter()
            .map(|v| {
                serde_json::from_str(&v).map_err(|_| {
                    "Não foi possível ler um repertório pessoal; dados preservados.".into()
                })
            })
            .collect()
    }
    fn save_setlist(
        &mut self,
        user: &str,
        input: SavePersonalSetlist,
    ) -> Result<PersonalSetlist, String> {
        if input.name.trim().is_empty()
            || input.name.chars().count() > 120
            || input.items.len() > 500
        {
            return Err("Nome ou quantidade de itens inválidos.".into());
        }
        let mut ids = std::collections::HashSet::new();
        if input
            .items
            .iter()
            .any(|i| i.id.is_empty() || i.id.len() > 80 || i.revision == 0 || !ids.insert(&i.id))
        {
            return Err("Itens precisam de identificadores únicos e revisão válida.".into());
        }
        let tx = self.connection.transaction().map_err(db_error)?;
        let revision = if let Some(id) = &input.id {
            let current: Option<i64> = tx
                .query_row(
                    "SELECT revision FROM personal_setlists WHERE id=?1 AND owner=?2",
                    params![id, user],
                    |r| r.get(0),
                )
                .optional()
                .map_err(db_error)?;
            let current = u64::try_from(current.ok_or("Repertório indisponível.")?)
                .map_err(|_| "Revisão inválida")?;
            if input.expected_revision != Some(current) {
                return Err("CONFLICT: O repertório mudou. Recarregue antes de salvar.".into());
            }
            current + 1
        } else {
            if input.expected_revision.is_some() {
                return Err("Revisão inválida para novo repertório.".into());
            }
            1
        };
        let list = PersonalSetlist {
            id: input.id.unwrap_or_else(|| Uuid::new_v4().to_string()),
            name: input.name.trim().into(),
            revision,
            items: input.items,
        };
        tx.execute("INSERT INTO personal_setlists(id,owner,revision,data) VALUES(?1,?2,?3,?4) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data",params![list.id,user,i64::try_from(list.revision).map_err(|_|"Revisão inválida")?,serde_json::to_string(&list).map_err(|_|"Repertório inválido")?]).map_err(db_error)?;
        tx.commit().map_err(db_error)?;
        Ok(list)
    }
}

struct Server {
    url: String,
    stop: tokio::sync::oneshot::Sender<()>,
    alive: Arc<std::sync::atomic::AtomicBool>,
    task: tokio::task::JoinHandle<()>,
}
#[derive(Default)]
pub struct TeamState {
    store: Mutex<Option<Store>>,
    server: tokio::sync::Mutex<Option<Server>>,
}
fn store(app: &tauri::AppHandle) -> Result<Store, String> {
    let state = app.state::<TeamState>();
    let mut guard = state.store.lock().map_err(|_| "Equipe indisponível")?;
    if let Some(store) = &*guard {
        return Ok(store.clone());
    }
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Pasta de dados indisponível")?;
    std::fs::create_dir_all(&dir).map_err(|_| "Não foi possível abrir a pasta da equipe")?;
    let value = Arc::new(Mutex::new(TeamDb::open(&dir.join("team.sqlite3"))?));
    *guard = Some(value.clone());
    Ok(value)
}
async fn work<T: Send + 'static>(
    app: tauri::AppHandle,
    task: impl FnOnce(&mut TeamDb) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let store = store(&app)?;
        let mut db = store.lock().map_err(|_| "Equipe indisponível")?;
        task(&mut db)
    })
    .await
    .map_err(|_| "Falha ao processar equipe".to_string())?
}
fn actor(user: &TeamUser) -> ChartActor {
    ChartActor {
        id: user.id.clone(),
        can_publish: user.can_publish,
        operator: false,
    }
}
fn interfaces() -> Result<Vec<Interface>, String> {
    Ok(if_addrs::get_if_addrs()
        .map_err(|_| "Não foi possível listar interfaces")?
        .into_iter()
        .filter_map(|i| match i.ip() {
            IpAddr::V4(ip) if !ip.is_unspecified() && !ip.is_multicast() => Some(Interface {
                name: i.name,
                ip: ip.to_string(),
            }),
            _ => None,
        })
        .collect())
}
#[tauri::command]
pub async fn team_interfaces(window: tauri::WebviewWindow) -> Result<Vec<Interface>, String> {
    crate::commands::operator(&window)?;
    tauri::async_runtime::spawn_blocking(interfaces)
        .await
        .map_err(|_| "Falha ao listar interfaces")?
}
#[tauri::command]
pub async fn team_status(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, TeamState>,
) -> Result<TeamStatus, String> {
    crate::commands::operator(&window)?;
    let server = state.server.lock().await;
    Ok(
        match server
            .as_ref()
            .filter(|s| s.alive.load(std::sync::atomic::Ordering::SeqCst))
        {
            Some(s) => TeamStatus {
                running: true,
                url: Some(s.url.clone()),
                warning: Some(WARNING.into()),
            },
            None => TeamStatus {
                running: false,
                url: None,
                warning: None,
            },
        },
    )
}
#[tauri::command]
pub async fn team_users(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Vec<TeamUser>, String> {
    crate::commands::operator(&window)?;
    work(app, |db| db.users()).await
}
#[tauri::command]
pub async fn team_save_user(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    input: SaveUser,
) -> Result<TeamUser, String> {
    crate::commands::operator(&window)?;
    work(app, move |db| db.save_user(input)).await
}
#[tauri::command]
pub async fn team_devices(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<Vec<Device>, String> {
    crate::commands::operator(&window)?;
    work(app, |db| db.devices()).await
}
#[tauri::command]
pub async fn team_approve_device(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    device_id: String,
) -> Result<(), String> {
    crate::commands::operator(&window)?;
    work(app, move |db| db.approve(&device_id)).await
}
#[tauri::command]
pub async fn team_revoke_device(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    device_id: String,
) -> Result<(), String> {
    crate::commands::operator(&window)?;
    work(app, move |db| db.revoke(&device_id)).await
}

#[derive(Clone)]
struct WebState {
    app: Option<tauri::AppHandle>,
    store: Store,
    db: Arc<Mutex<crate::infrastructure::database::Database>>,
    origin: String,
    host: String,
    rate: Arc<Mutex<HashMap<IpAddr, (Instant, u32)>>>,
    alive: Arc<std::sync::atomic::AtomicBool>,
}
async fn secure(
    State(state): State<WebState>,
    request: axum::extract::Request,
    next: Next,
) -> Response {
    if !state.alive.load(std::sync::atomic::Ordering::SeqCst) {
        return failure(
            StatusCode::SERVICE_UNAVAILABLE,
            "Acesso da equipe desativado.",
        )
        .into_response();
    }
    if request.headers().get("host").and_then(|v| v.to_str().ok()) != Some(state.host.as_str()) {
        return failure(StatusCode::FORBIDDEN, "Host não autorizado.").into_response();
    }
    if request
        .headers()
        .get("origin")
        .is_some_and(|v| v.to_str().ok() != Some(state.origin.as_str()))
    {
        return failure(StatusCode::FORBIDDEN, "Origem não autorizada.").into_response();
    }
    if !matches!(
        *request.method(),
        axum::http::Method::GET | axum::http::Method::HEAD
    ) && request
        .headers()
        .get("x-louvashow-request")
        .and_then(|v| v.to_str().ok())
        != Some("1")
    {
        return failure(StatusCode::FORBIDDEN, "Requisição não autorizada.").into_response();
    }
    let mut response = match tokio::time::timeout(Duration::from_secs(100), next.run(request)).await
    {
        Ok(response) => response,
        Err(_) => {
            return failure(
                StatusCode::REQUEST_TIMEOUT,
                "A solicitação excedeu o tempo permitido.",
            )
            .into_response()
        }
    };
    for(name,value)in[("cache-control","no-store"),("x-content-type-options","nosniff"),("referrer-policy","no-referrer"),("content-security-policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")]{response.headers_mut().insert(axum::http::HeaderName::from_static(name),axum::http::HeaderValue::from_static(value));}
    response
}
fn token(headers: &HeaderMap) -> Option<String> {
    headers
        .get("cookie")?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|part| {
            part.trim()
                .strip_prefix("louvashow_session=")
                .map(str::to_string)
        })
}
async fn web_work<T: Send + 'static>(
    state: &WebState,
    task: impl FnOnce(&mut TeamDb) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let store = state.store.clone();
    let alive = state.alive.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut db = store.lock().map_err(|_| "Equipe indisponível")?;
        if !alive.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("Acesso da equipe desativado.".into());
        }
        task(&mut db)
    })
    .await
    .map_err(|_| "Falha ao acessar equipe".to_string())?
}
async fn authenticated(
    state: &WebState,
    headers: &HeaderMap,
) -> Result<TeamUser, (StatusCode, Json<Value>)> {
    let token = token(headers).ok_or_else(|| {
        failure(
            StatusCode::UNAUTHORIZED,
            "Solicite acesso neste dispositivo.",
        )
    })?;
    web_work(state, move |db| db.authenticate(&token))
        .await
        .map_err(|e| failure(StatusCode::FORBIDDEN, e))
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Login {
    email: String,
    device_name: String,
}
async fn login(
    State(state): State<WebState>,
    ConnectInfo(address): ConnectInfo<SocketAddr>,
    Json(input): Json<Login>,
) -> HttpResult {
    {
        let mut rate = state
            .rate
            .lock()
            .map_err(|_| failure(StatusCode::SERVICE_UNAVAILABLE, "Acesso indisponível"))?;
        rate.retain(|_, (at, _)| at.elapsed() < Duration::from_secs(60));
        if rate.len() > 1024 {
            return Err(failure(
                StatusCode::TOO_MANY_REQUESTS,
                "Aguarde para tentar novamente.",
            ));
        }
        let entry = rate.entry(address.ip()).or_insert((Instant::now(), 0));
        entry.1 += 1;
        if entry.1 > 5 {
            return Err(failure(
                StatusCode::TOO_MANY_REQUESTS,
                "Aguarde um minuto antes de solicitar novamente.",
            ));
        }
    }
    let (token, pair_code) = web_work(&state, move |db| db.login(&input.email, &input.device_name))
        .await
        .map_err(|e| failure(StatusCode::FORBIDDEN, e))?;
    Ok((
        [("set-cookie", session_cookie(&token))],
        Json(json!({"pending":true,"pairCode":pair_code})),
    )
        .into_response())
}
fn session_cookie(token: &str) -> String {
    format!(
        "louvashow_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={COOKIE_SECONDS}"
    )
}
async fn me(State(state): State<WebState>, headers: HeaderMap) -> HttpResult {
    let user = authenticated(&state, &headers).await?;
    let token =
        token(&headers).ok_or_else(|| failure(StatusCode::UNAUTHORIZED, "Sessão indisponível."))?;
    Ok(([("set-cookie", session_cookie(&token))], Json(user)).into_response())
}
async fn logout(State(state): State<WebState>, headers: HeaderMap) -> HttpResult {
    if let Some(token) = token(&headers) {
        web_work(&state, move |db| {
            db.connection
                .execute("DELETE FROM devices WHERE token_hash=?1", [hash(&token)])
                .map_err(db_error)?;
            Ok(())
        })
        .await
        .map_err(|e| failure(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    }
    Ok((
        [(
            "set-cookie",
            "louvashow_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        )],
        Json(json!({"ok":true})),
    )
        .into_response())
}
async fn core<T: Serialize + Send + 'static>(
    state: WebState,
    task: impl FnOnce(&mut crate::infrastructure::database::Database) -> Result<T, String>
        + Send
        + 'static,
) -> HttpResult {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut db = state.db.lock().map_err(|_| "Banco indisponível")?;
        if !state.alive.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("Acesso da equipe desativado.".into());
        }
        task(&mut db)
    })
    .await
    .map_err(|_| {
        failure(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Falha ao processar dados",
        )
    })?
    .map_err(|e| {
        failure(
            if e.starts_with("CONFLICT:") {
                StatusCode::CONFLICT
            } else {
                StatusCode::BAD_REQUEST
            },
            e,
        )
    })?;
    Ok(Json(result).into_response())
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChartQuery {
    song_id: Option<String>,
    revision: Option<u64>,
}
async fn songs(State(state): State<WebState>, headers: HeaderMap) -> HttpResult {
    authenticated(&state, &headers).await?;
    core(state, |db| db.list_songs()).await
}
async fn charts(
    State(state): State<WebState>,
    headers: HeaderMap,
    Query(query): Query<ChartQuery>,
) -> HttpResult {
    let actor = actor(&authenticated(&state, &headers).await?);
    core(state, move |db| {
        db.list_charts(&actor, query.song_id.as_deref())
    })
    .await
}
async fn chart(
    State(state): State<WebState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(query): Query<ChartQuery>,
) -> HttpResult {
    let actor = actor(&authenticated(&state, &headers).await?);
    core(state, move |db| db.get_chart(&actor, &id, query.revision)).await
}
async fn save_chart(
    State(state): State<WebState>,
    headers: HeaderMap,
    Json(input): Json<SaveChartInput>,
) -> HttpResult {
    let actor = actor(&authenticated(&state, &headers).await?);
    core(state, move |db| db.save_chart(&actor, input)).await
}
async fn revisions(
    State(state): State<WebState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> HttpResult {
    let actor = actor(&authenticated(&state, &headers).await?);
    core(state, move |db| db.list_chart_revisions(&actor, &id)).await
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RevisionInput {
    expected_revision: u64,
    name: Option<String>,
}
async fn publish_chart(
    State(state): State<WebState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(input): Json<RevisionInput>,
) -> HttpResult {
    let actor = actor(&authenticated(&state, &headers).await?);
    core(state, move |db| {
        db.publish_chart(
            &actor,
            &id,
            input.expected_revision,
            &input.name.unwrap_or_default(),
        )
    })
    .await
}
async fn delete_chart(
    State(state): State<WebState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(input): Json<RevisionInput>,
) -> HttpResult {
    let actor = actor(&authenticated(&state, &headers).await?);
    core(state, move |db| {
        db.delete_chart(&actor, &id, input.expected_revision)
    })
    .await
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SongInput {
    song_id: String,
}
async fn document(
    State(state): State<WebState>,
    headers: HeaderMap,
    Json(input): Json<SongInput>,
) -> HttpResult {
    authenticated(&state, &headers).await?;
    core(state, move |db| {
        Ok(crate::application::charts::document_from_song(
            &db.get_song(&input.song_id)?,
        ))
    })
    .await
}
#[derive(Deserialize)]
struct ImportInput {
    text: String,
    format: String,
}
async fn import_chart(
    State(state): State<WebState>,
    headers: HeaderMap,
    Json(input): Json<ImportInput>,
) -> HttpResult {
    authenticated(&state, &headers).await?;
    core(state, move |_| match input.format.as_str() {
        "chordpro" => crate::application::charts::import_chordpro(&input.text),
        "text" => crate::application::charts::import_text(&input.text),
        _ => Err("Formato de cifra inválido.".into()),
    })
    .await
}
#[derive(Deserialize)]
struct DocumentInput {
    document: ChartDocument,
}
#[derive(Deserialize)]
struct TransposeInput {
    document: ChartDocument,
    semitones: i8,
    capo: u8,
    spelling: crate::domain::charts::ChartSpelling,
}
async fn transpose_chart(
    State(state): State<WebState>,
    headers: HeaderMap,
    Json(input): Json<TransposeInput>,
) -> HttpResult {
    authenticated(&state, &headers).await?;
    core(state, move |_| {
        crate::application::charts::transpose(
            input.document,
            input.semitones,
            input.capo,
            input.spelling,
        )
    })
    .await
}
async fn export_chart(
    State(state): State<WebState>,
    headers: HeaderMap,
    Json(input): Json<DocumentInput>,
) -> HttpResult {
    authenticated(&state, &headers).await?;
    core(state, move |_| {
        crate::application::charts::export_chordpro(&input.document)
    })
    .await
}
async fn capo_charts(
    State(state): State<WebState>,
    headers: HeaderMap,
    Json(input): Json<DocumentInput>,
) -> HttpResult {
    authenticated(&state, &headers).await?;
    core(state, move |_| {
        crate::application::charts::suggest_capos(input.document)
    })
    .await
}
async fn key_charts(
    State(state): State<WebState>,
    headers: HeaderMap,
    Json(input): Json<DocumentInput>,
) -> HttpResult {
    authenticated(&state, &headers).await?;
    core(state, move |_| {
        crate::application::charts::suggest_keys(&input.document)
    })
    .await
}
async fn setlists(State(state): State<WebState>, headers: HeaderMap) -> HttpResult {
    let user = authenticated(&state, &headers).await?;
    let value = web_work(&state, move |db| db.setlists(&user.id))
        .await
        .map_err(|e| failure(StatusCode::BAD_REQUEST, e))?;
    Ok(Json(value).into_response())
}
#[derive(Serialize)]
pub struct Avatar {
    mime: String,
    bytes: Vec<u8>,
}
async fn refresh_avatar(store: Store, user_id: String) -> Result<Avatar, String> {
    let lookup_store = store.clone();
    let lookup_id = user_id.clone();
    let (email, cached) = tauri::async_runtime::spawn_blocking(move || {
        let mut db = lookup_store.lock().map_err(|_| "Equipe indisponível")?;
        let user = db
            .users()?
            .into_iter()
            .find(|u| u.id == lookup_id)
            .ok_or("Membro não encontrado")?;
        if !user.gravatar_enabled {
            return Err("O membro não autorizou o uso do Gravatar.".into());
        }
        let cached = db
            .connection
            .query_row(
                "SELECT avatar_mime,avatar FROM members WHERE id=?1",
                [&lookup_id],
                |r| {
                    Ok((
                        r.get::<_, Option<String>>(0)?,
                        r.get::<_, Option<Vec<u8>>>(1)?,
                    ))
                },
            )
            .map_err(db_error)?;
        if cached.1.is_none() {
            db.avatar_requests
                .retain(|_, at| at.elapsed() < Duration::from_secs(60));
            if db.avatar_requests.contains_key(&lookup_id) {
                return Err("Aguarde um minuto antes de consultar Gravatar novamente.".into());
            }
            db.avatar_requests.insert(lookup_id, Instant::now());
        }
        Ok::<_, String>((user.email, cached))
    })
    .await
    .map_err(|_| "Falha ao consultar avatar")??;
    if let (Some(mime), Some(bytes)) = cached {
        return Ok(Avatar { mime, bytes });
    }
    let response = crate::assistant::client()?
        .get(format!(
            "https://www.gravatar.com/avatar/{}?s=128&d=404",
            hash(&email)
        ))
        .send()
        .await
        .map_err(|_| "Não foi possível consultar Gravatar. O nome continua disponível.")?;
    let mime = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .split(';')
        .next()
        .unwrap_or_default()
        .to_owned();
    if !matches!(mime.as_str(), "image/png" | "image/jpeg" | "image/webp") {
        return Err("Gravatar não retornou uma imagem compatível.".into());
    }
    let bytes = crate::assistant::bounded(response, 512 * 1024).await?;
    let valid = match mime.as_str() {
        "image/png" => bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        "image/webp" => bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP"),
        _ => false,
    };
    if !valid {
        return Err("Imagem de avatar inválida.".into());
    }
    tauri::async_runtime::spawn_blocking(move||{let db=store.lock().map_err(|_|"Equipe indisponível")?;if db.connection.execute("UPDATE members SET avatar=?2,avatar_mime=?3 WHERE id=?1 AND gravatar=1 AND email=?4",params![user_id,bytes,mime,email]).map_err(db_error)?!=1{return Err("Permissão ou e-mail alterados durante a consulta.".into());}Ok(Avatar{mime,bytes})}).await.map_err(|_|"Falha ao guardar avatar")?
}
#[tauri::command]
pub async fn team_refresh_avatar(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    user_id: String,
) -> Result<Avatar, String> {
    crate::commands::operator(&window)?;
    let store = tauri::async_runtime::spawn_blocking(move || store(&app))
        .await
        .map_err(|_| "Equipe indisponível")??;
    refresh_avatar(store, user_id).await
}
async fn avatar(State(state): State<WebState>, headers: HeaderMap) -> HttpResult {
    let user = authenticated(&state, &headers).await?;
    let value = web_work(&state, move |db| {
        db.connection
            .query_row(
                "SELECT avatar_mime,avatar FROM members WHERE id=?1 AND gravatar=1",
                [user.id],
                |r| {
                    Ok((
                        r.get::<_, Option<String>>(0)?,
                        r.get::<_, Option<Vec<u8>>>(1)?,
                    ))
                },
            )
            .optional()
            .map_err(db_error)
    })
    .await
    .map_err(|e| failure(StatusCode::BAD_REQUEST, e))?;
    match value {
        Some((Some(mime), Some(bytes))) => {
            Ok(([("content-type", mime)], Body::from(bytes)).into_response())
        }
        _ => Ok(StatusCode::NOT_FOUND.into_response()),
    }
}
async fn update_avatar(State(state): State<WebState>, headers: HeaderMap) -> HttpResult {
    let user = authenticated(&state, &headers).await?;
    let avatar = refresh_avatar(state.store, user.id)
        .await
        .map_err(|e| failure(StatusCode::BAD_REQUEST, e))?;
    Ok(([("content-type", avatar.mime)], Body::from(avatar.bytes)).into_response())
}
async fn save_setlist(
    State(state): State<WebState>,
    headers: HeaderMap,
    Json(input): Json<SavePersonalSetlist>,
) -> HttpResult {
    let user = authenticated(&state, &headers).await?;
    let actor = actor(&user);
    let items = input.items.clone();
    let core_db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let db = core_db.lock().map_err(|_| "Banco indisponível")?;
        for item in items {
            db.get_chart(&actor, &item.chart_id, Some(item.revision))?;
        }
        Ok::<_, String>(())
    })
    .await
    .map_err(|_| {
        failure(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Falha ao conferir cifras",
        )
    })?
    .map_err(|e| failure(StatusCode::FORBIDDEN, e))?;
    let value = web_work(&state, move |db| db.save_setlist(&user.id, input))
        .await
        .map_err(|e| {
            failure(
                if e.starts_with("CONFLICT:") {
                    StatusCode::CONFLICT
                } else {
                    StatusCode::BAD_REQUEST
                },
                e,
            )
        })?;
    Ok(Json(value).into_response())
}
async fn delete_setlist(
    State(state): State<WebState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(input): Json<RevisionInput>,
) -> HttpResult {
    let user = authenticated(&state, &headers).await?;
    web_work(&state, move |db| {
        let expected = i64::try_from(input.expected_revision).map_err(|_| "Revisão inválida")?;
        if db
            .connection
            .execute(
                "DELETE FROM personal_setlists WHERE id=?1 AND owner=?2 AND revision=?3",
                params![id, user.id, expected],
            )
            .map_err(db_error)?
            != 1
        {
            return Err("CONFLICT: Repertório indisponível ou alterado.".into());
        }
        Ok(())
    })
    .await
    .map_err(|e| failure(StatusCode::CONFLICT, e))?;
    Ok(Json(json!({"ok":true})).into_response())
}
async fn asset(State(state): State<WebState>, request: axum::extract::Request) -> Response {
    let path = request.uri().path();
    let path = if path == "/" || path == "/musician.html" {
        "musician.html"
    } else {
        path.trim_start_matches('/')
    };
    if path != "musician.html"
        && (!path.starts_with("assets/") || path.contains("..") || path.contains('\\'))
    {
        return StatusCode::NOT_FOUND.into_response();
    }
    match state
        .app
        .and_then(|app| app.asset_resolver().get(path.to_string()))
    {
        Some(asset) => {
            ([("content-type", asset.mime_type)], Body::from(asset.bytes)).into_response()
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
fn router(state: WebState) -> Router {
    Router::new()
        .route(
            "/api/status",
            get(|| async { Json(json!({"app":"LouvaShow"})) }),
        )
        .route("/api/login", post(login))
        .route("/api/logout", post(logout))
        .route("/api/me", get(me))
        .route("/api/songs", get(songs))
        .route("/api/charts", get(charts).post(save_chart))
        .route("/api/charts/document", post(document))
        .route("/api/charts/import", post(import_chart))
        .route("/api/charts/transpose", post(transpose_chart))
        .route("/api/charts/export", post(export_chart))
        .route("/api/charts/capos", post(capo_charts))
        .route("/api/charts/keys", post(key_charts))
        .route("/api/charts/{id}", get(chart).delete(delete_chart))
        .route("/api/charts/{id}/revisions", get(revisions))
        .route("/api/charts/{id}/publish", post(publish_chart))
        .route("/api/setlists", get(setlists).post(save_setlist))
        .fallback(asset)
        .route("/api/setlists/{id}", axum::routing::delete(delete_setlist))
        .route("/api/avatar", get(avatar))
        .route("/api/avatar/refresh", post(update_avatar))
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024))
        .layer(middleware::from_fn_with_state(state.clone(), secure))
        .with_state(state)
}
#[tauri::command]
pub async fn team_start(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, TeamState>,
    interface_ip: String,
    port: u16,
    acknowledge_insecure_lan: bool,
) -> Result<TeamStatus, String> {
    crate::commands::operator(&window)?;
    if !acknowledge_insecure_lan {
        return Err(WARNING.into());
    }
    if port < 1024 {
        return Err("Escolha uma porta entre 1024 e 65535.".into());
    }
    let ip: IpAddr = interface_ip.parse().map_err(|_| "Endereço inválido")?;
    if !interfaces()?.iter().any(|i| i.ip == interface_ip) {
        return Err("A interface escolhida não está disponível. Atualize a lista.".into());
    }
    work(app.clone(), |_| Ok(())).await?;
    let mut server = state.server.lock().await;
    if server
        .as_ref()
        .is_some_and(|s| s.alive.load(std::sync::atomic::Ordering::SeqCst))
    {
        return Err("Pare o acesso atual antes de iniciar outro.".into());
    }
    let listener=tokio::net::TcpListener::bind(SocketAddr::new(ip,port)).await.map_err(|_|"Não foi possível abrir a porta. Confira a interface, o firewall e se a porta está livre.")?;
    let host = format!("{ip}:{port}");
    let url = format!("http://{host}");
    let alive = Arc::new(std::sync::atomic::AtomicBool::new(true));
    let shared = WebState {
        store: store(&app)?,
        db: app.state::<AppState>().db.clone(),
        app: Some(app),
        origin: url.clone(),
        host,
        rate: Arc::new(Mutex::new(HashMap::new())),
        alive: alive.clone(),
    };
    let (stop, receiver) = tokio::sync::oneshot::channel();
    let live = alive.clone();
    let task = tokio::spawn(async move {
        let result = axum::serve(
            listener,
            router(shared).into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async {
            let _ = receiver.await;
        })
        .await;
        live.store(false, std::sync::atomic::Ordering::SeqCst);
        if result.is_err() {
            eprintln!("LouvaShow: servidor da equipe interrompido.");
        }
    });
    *server = Some(Server {
        url: url.clone(),
        stop,
        alive,
        task,
    });
    Ok(TeamStatus {
        running: true,
        url: Some(url),
        warning: Some(WARNING.into()),
    })
}
#[tauri::command]
pub async fn team_stop(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, TeamState>,
) -> Result<(), String> {
    crate::commands::operator(&window)?;
    let mut guard = state.server.lock().await;
    if let Some(mut server) = guard.take() {
        server
            .alive
            .store(false, std::sync::atomic::Ordering::SeqCst);
        let _ = server.stop.send(());
        if tokio::time::timeout(Duration::from_secs(2), &mut server.task)
            .await
            .is_err()
        {
            server.task.abort();
            let _ = server.task.await;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tower::ServiceExt;
    fn member(db: &mut TeamDb, name: &str) -> TeamUser {
        db.save_user(SaveUser {
            id: None,
            name: name.into(),
            email: format!("{name}@example.test"),
            roles: vec!["Pastor".into(), "Guitarrista".into(), "leader".into()],
            gravatar_enabled: false,
            can_publish: false,
        })
        .unwrap()
    }
    fn approved(db: &mut TeamDb, user: &TeamUser) -> String {
        let (token, code) = db.login(&user.email, "Tablet").unwrap();
        let device = db
            .devices()
            .unwrap()
            .into_iter()
            .find(|d| d.pair_code == code)
            .unwrap();
        db.approve(&device.id).unwrap();
        token
    }
    fn fixture() -> (tempfile::TempDir, WebState) {
        let dir = tempfile::tempdir().unwrap();
        let store = Arc::new(Mutex::new(
            TeamDb::open(&dir.path().join("team.sqlite3")).unwrap(),
        ));
        let db = Arc::new(Mutex::new(
            crate::infrastructure::database::Database::open(dir.path().join("app.sqlite3"))
                .unwrap(),
        ));
        (
            dir,
            WebState {
                app: None,
                store,
                db,
                origin: "http://127.0.0.1:9876".into(),
                host: "127.0.0.1:9876".into(),
                rate: Arc::new(Mutex::new(HashMap::new())),
                alive: Arc::new(std::sync::atomic::AtomicBool::new(true)),
            },
        )
    }
    async fn request(
        router: Router,
        method: &str,
        path: &str,
        token: &str,
        body: Value,
    ) -> (StatusCode, Value) {
        let req = axum::http::Request::builder()
            .method(method)
            .uri(path)
            .header("host", "127.0.0.1:9876")
            .header("x-louvashow-request", "1")
            .header("content-type", "application/json")
            .header("cookie", format!("louvashow_session={token}"))
            .body(Body::from(body.to_string()))
            .unwrap();
        let response = router.oneshot(req).await.unwrap();
        let status = response.status();
        let bytes = axum::body::to_bytes(response.into_body(), 3 * 1024 * 1024)
            .await
            .unwrap();
        (
            status,
            serde_json::from_slice(&bytes).unwrap_or(Value::Null),
        )
    }
    #[tokio::test]
    async fn lan_approval_revocation_and_personal_scope_are_enforced() {
        let (_dir, state) = fixture();
        let (mut token_a, mut token_b) = (String::new(), String::new());
        let (user_a, user_b);
        {
            let mut db = state.store.lock().unwrap();
            user_a = member(&mut db, "alice");
            user_b = member(&mut db, "bob");
            assert!(!actor(&user_a).can_publish);
            let (pending, _) = db.login(&user_a.email, "Pending").unwrap();
            assert!(db.authenticate(&pending).is_err());
            token_a.push_str(&approved(&mut db, &user_a));
            token_b.push_str(&approved(&mut db, &user_b));
        }
        let app = router(state.clone());
        assert_eq!(
            request(app.clone(), "GET", "/api/me", &token_a, Value::Null)
                .await
                .0,
            StatusCode::OK
        );
        let(status,created)=request(app.clone(),"POST","/api/setlists",&token_a,json!({"id":null,"name":"Meu culto","owner":user_b.id,"expectedRevision":null,"items":[]})).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            request(app.clone(), "GET", "/api/setlists", &token_b, Value::Null)
                .await
                .1,
            json!([])
        );
        assert_ne!(
            request(
                app.clone(),
                "POST",
                "/api/setlists",
                &token_b,
                json!({"id":created["id"],"name":"Invadido","expectedRevision":1,"items":[]})
            )
            .await
            .0,
            StatusCode::OK
        );
        assert_eq!(
            request(
                app.clone(),
                "POST",
                "/api/setlists",
                &token_a,
                json!({"id":created["id"],"name":"Alterado","expectedRevision":1,"items":[]})
            )
            .await
            .0,
            StatusCode::OK
        );
        assert_eq!(
            request(
                app.clone(),
                "POST",
                "/api/setlists",
                &token_a,
                json!({"id":created["id"],"name":"Antigo","expectedRevision":1,"items":[]})
            )
            .await
            .0,
            StatusCode::CONFLICT
        );
        {
            let db = state.store.lock().unwrap();
            let device = db
                .devices()
                .unwrap()
                .into_iter()
                .find(|d| d.user_id == user_a.id && d.approved)
                .unwrap();
            db.revoke(&device.id).unwrap();
        }
        assert_eq!(
            request(app, "GET", "/api/me", &token_a, Value::Null)
                .await
                .0,
            StatusCode::FORBIDDEN
        );
    }
    #[tokio::test]
    async fn lan_rejects_rebinding_cross_origin_and_missing_csrf_header() {
        let (_dir, state) = fixture();
        let app = router(state);
        for (host, origin, marker) in [
            ("evil.example:9876", "", true),
            ("127.0.0.1:9876", "https://evil.example", true),
            ("127.0.0.1:9876", "", false),
        ] {
            let mut req = axum::http::Request::builder()
                .method("POST")
                .uri("/api/logout")
                .header("host", host);
            if !origin.is_empty() {
                req = req.header("origin", origin);
            }
            if marker {
                req = req.header("x-louvashow-request", "1");
            }
            assert_eq!(
                app.clone()
                    .oneshot(req.body(Body::empty()).unwrap())
                    .await
                    .unwrap()
                    .status(),
                StatusCode::FORBIDDEN
            );
        }
    }
    #[test]
    fn team_migration_persistence_and_function_labels_do_not_grant_privilege() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("team.sqlite3");
        let id = {
            let mut db = TeamDb::open(&path).unwrap();
            let user = member(&mut db, "person");
            assert!(!actor(&user).can_publish);
            user.id
        };
        let db = TeamDb::open(&path).unwrap();
        assert_eq!(db.users().unwrap()[0].id, id);
        assert_eq!(
            db.connection
                .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
                .unwrap(),
            2
        );
    }
    #[tokio::test]
    async fn stopped_server_rejects_queued_work_and_http_requests() {
        let (_dir, state) = fixture();
        state
            .alive
            .store(false, std::sync::atomic::Ordering::SeqCst);
        assert!(
            web_work::<()>(&state, |_| panic!("Stopped work must not execute"))
                .await
                .is_err()
        );
        assert!(
            core::<()>(state.clone(), |_| panic!("Stopped core must not execute"))
                .await
                .is_err()
        );
        assert_eq!(
            request(router(state), "GET", "/api/status", "", Value::Null)
                .await
                .0,
            StatusCode::SERVICE_UNAVAILABLE
        );
    }
    #[test]
    fn approved_devices_remain_until_revoked_but_pending_requests_expire() {
        let (_dir, state) = fixture();
        let mut db = state.store.lock().unwrap();
        let user = member(&mut db, "remembered");
        let token = approved(&mut db, &user);
        let (pending, _) = db.login(&user.email, "Expirado").unwrap();
        db.connection
            .execute("UPDATE devices SET expires=1", [])
            .unwrap();
        assert!(db.authenticate(&token).is_ok());
        assert!(db.authenticate(&pending).is_err());
        assert_eq!(db.devices().unwrap().len(), 1);
        db.login(&user.email, "Outro").unwrap();
        assert!(db.authenticate(&token).is_ok());
        let device = db
            .devices()
            .unwrap()
            .into_iter()
            .find(|d| d.approved)
            .unwrap();
        db.revoke(&device.id).unwrap();
        assert!(db.authenticate(&token).is_err());
        assert!(session_cookie(&token).contains("Max-Age=34560000"));
    }
    #[tokio::test]
    async fn http_pairing_returns_code_and_protected_cookie_until_approval() {
        let (_dir, state) = fixture();
        let user = member(&mut state.store.lock().unwrap(), "alice");
        let req = axum::http::Request::builder()
            .method("POST")
            .uri("/api/login")
            .header("host", "127.0.0.1:9876")
            .header("x-louvashow-request", "1")
            .header("content-type", "application/json")
            .extension(ConnectInfo(
                "127.0.0.1:50000".parse::<SocketAddr>().unwrap(),
            ))
            .body(Body::from(
                json!({"email":user.email,"deviceName":"Telefone"}).to_string(),
            ))
            .unwrap();
        let response = router(state.clone()).oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let cookie = response
            .headers()
            .get("set-cookie")
            .unwrap()
            .to_str()
            .unwrap()
            .to_string();
        assert!(cookie.contains("HttpOnly") && cookie.contains("SameSite=Strict"));
        let bytes = axum::body::to_bytes(response.into_body(), 4096)
            .await
            .unwrap();
        let body: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(body["pairCode"].as_str().unwrap().len(), 8);
        let token = cookie
            .split(';')
            .next()
            .unwrap()
            .strip_prefix("louvashow_session=")
            .unwrap();
        assert!(state.store.lock().unwrap().authenticate(token).is_err());
        let device = state.store.lock().unwrap().devices().unwrap().remove(0);
        state.store.lock().unwrap().approve(&device.id).unwrap();
        assert!(state.store.lock().unwrap().authenticate(token).is_ok());
    }
}
