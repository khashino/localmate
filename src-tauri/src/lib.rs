use regex::Regex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    net::TcpStream,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager, WindowEvent};
use walkdir::WalkDir;
use zip::ZipArchive;

struct LlamaServerState {
    child: Mutex<Option<Child>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ServerProfile {
    server_path: String,
    model_path: String,
    host: String,
    port: u16,
    context_size: u32,
    gpu_layers: u32,
}

#[derive(Debug, Serialize)]
struct IndexedChunk {
    id: i64,
    file_name: String,
    file_path: String,
    chunk_index: i64,
    content: String,
}

#[derive(Debug, Serialize)]
struct IndexResult {
    files_indexed: usize,
    chunks_indexed: usize,
    message: String,
}


#[derive(Debug, Serialize)]
struct EmbeddingChunk {
    chunk_id: i64,
    file_name: String,
    file_path: String,
    chunk_index: i64,
    content: String,
}


#[derive(Debug, Serialize)]
struct SearchResult {
    file_name: String,
    file_path: String,
    chunk_index: i64,
    content: String,
    score: i64,
}

#[derive(Debug, Serialize)]
struct ChatSession {
    id: i64,
    title: String,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Serialize)]
struct ChatRecord {
    id: i64,
    session_id: i64,
    role: String,
    content: String,
    created_at: i64,
}

#[derive(Debug, Serialize)]
struct SavedPrompt {
    id: i64,
    title: String,
    category: String,
    content: String,
    created_at: i64,
}

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not get app data dir: {}", error))?;

    fs::create_dir_all(&dir).map_err(|error| format!("Could not create app data dir: {}", error))?;

    Ok(dir.join("localmate.sqlite"))
}

fn db(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    let conn = Connection::open(path).map_err(|error| format!("Could not open SQLite DB: {}", error))?;
    init_db(&conn)?;
    Ok(conn)
}

fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = OFF;

        CREATE TABLE IF NOT EXISTS chat_history_migration_check (
            id INTEGER
        );

        
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS server_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            server_path TEXT NOT NULL,
            model_path TEXT NOT NULL,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            context_size INTEGER NOT NULL,
            gpu_layers INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chat_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS saved_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT 'General',
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recent_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL UNIQUE,
            file_name TEXT NOT NULL,
            opened_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS indexed_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_path TEXT NOT NULL UNIQUE,
            indexed_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS file_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_path TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_file_chunks_folder ON file_chunks(folder_path);
        CREATE INDEX IF NOT EXISTS idx_file_chunks_file ON file_chunks(file_path);
        CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id);
        ",
    )
    .map_err(|error| format!("Could not initialize SQLite DB: {}", error))?;

    let _ = conn.execute(
        "ALTER TABLE saved_prompts ADD COLUMN category TEXT NOT NULL DEFAULT 'General'",
        [],
    );

    Ok(())
}

fn default_profile() -> ServerProfile {
    ServerProfile {
        server_path: "/app/softwares/llama.cpp/build/bin/llama-server".to_string(),
        model_path: "/app/softwares/llama.cpp/custommodels/Bonsai-8B-Q1_0.gguf".to_string(),
        host: "127.0.0.1".to_string(),
        port: 8080,
        context_size: 2048,
        gpu_layers: 0,
    }
}

fn is_server_reachable(host: &str, port: u16) -> bool {
    let address = format!("{}:{}", host, port);

    match address.parse() {
        Ok(socket_address) => TcpStream::connect_timeout(&socket_address, Duration::from_millis(450)).is_ok(),
        Err(_) => false,
    }
}

fn get_profile_from_db(app: &AppHandle) -> Result<ServerProfile, String> {
    let conn = db(app)?;

    let result = conn.query_row(
        "SELECT server_path, model_path, host, port, context_size, gpu_layers FROM server_profile WHERE id = 1",
        [],
        |row| {
            Ok(ServerProfile {
                server_path: row.get(0)?,
                model_path: row.get(1)?,
                host: row.get(2)?,
                port: row.get::<_, i64>(3)? as u16,
                context_size: row.get::<_, i64>(4)? as u32,
                gpu_layers: row.get::<_, i64>(5)? as u32,
            })
        },
    );

    match result {
        Ok(profile) => Ok(profile),
        Err(_) => {
            let profile = default_profile();
            save_profile_to_db(app, profile.clone())?;
            Ok(profile)
        }
    }
}

fn save_profile_to_db(app: &AppHandle, profile: ServerProfile) -> Result<(), String> {
    let conn = db(app)?;

    conn.execute(
        "
        INSERT INTO server_profile
        (id, server_path, model_path, host, port, context_size, gpu_layers)
        VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(id) DO UPDATE SET
            server_path = excluded.server_path,
            model_path = excluded.model_path,
            host = excluded.host,
            port = excluded.port,
            context_size = excluded.context_size,
            gpu_layers = excluded.gpu_layers
        ",
        params![
            profile.server_path,
            profile.model_path,
            profile.host,
            profile.port as i64,
            profile.context_size as i64,
            profile.gpu_layers as i64
        ],
    )
    .map_err(|error| format!("Could not save server profile: {}", error))?;

    Ok(())
}

fn clean_xml_text(raw: &str) -> String {
    let with_breaks = raw
        .replace("</w:p>", "\n")
        .replace("</w:tr>", "\n")
        .replace("</w:tc>", " ");

    let re = Regex::new(r"<[^>]+>").unwrap();
    let no_tags = re.replace_all(&with_breaks, " ");

    no_tags
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn extract_docx_text(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|error| format!("Could not open DOCX: {}", error))?;
    let mut archive = ZipArchive::new(file).map_err(|error| format!("Could not read DOCX archive: {}", error))?;

    let mut document = archive
        .by_name("word/document.xml")
        .map_err(|error| format!("Could not find DOCX document.xml: {}", error))?;

    let mut xml = String::new();
    use std::io::Read;
    document
        .read_to_string(&mut xml)
        .map_err(|error| format!("Could not read DOCX XML: {}", error))?;

    Ok(clean_xml_text(&xml))
}

fn extract_text_from_path(path: &Path) -> Result<String, String> {
    let ext = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "pdf" => pdf_extract::extract_text(path)
            .map_err(|error| format!("Could not extract PDF text: {}", error)),
        "docx" => extract_docx_text(path),
        "txt" | "md" | "csv" | "json" | "log" | "ts" | "tsx" | "js" | "jsx" | "py" | "rs" | "html"
        | "css" | "toml" | "yaml" | "yml" | "xml" => {
            fs::read_to_string(path).map_err(|error| format!("Could not read text file: {}", error))
        }
        _ => Err("Unsupported file type.".to_string()),
    }
}

fn supported_document(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();

    matches!(
        ext.as_str(),
        "pdf"
            | "docx"
            | "txt"
            | "md"
            | "csv"
            | "json"
            | "log"
            | "ts"
            | "tsx"
            | "js"
            | "jsx"
            | "py"
            | "rs"
            | "html"
            | "css"
            | "toml"
            | "yaml"
            | "yml"
            | "xml"
    )
}

fn chunk_text(text: &str, max_chars: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();

    for paragraph in text.split('\n') {
        let paragraph = paragraph.trim();
        if paragraph.is_empty() {
            continue;
        }

        if current.len() + paragraph.len() + 2 > max_chars && !current.is_empty() {
            chunks.push(current.trim().to_string());
            current.clear();
        }

        current.push_str(paragraph);
        current.push_str("\n\n");
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_string());
    }

    chunks
}

#[tauri::command]
fn llama_server_status(app: AppHandle) -> Result<bool, String> {
    let profile = get_profile_from_db(&app)?;
    Ok(is_server_reachable(&profile.host, profile.port))
}

#[tauri::command]
fn get_server_profile(app: AppHandle) -> Result<ServerProfile, String> {
    get_profile_from_db(&app)
}

#[tauri::command]
fn save_server_profile(app: AppHandle, profile: ServerProfile) -> Result<String, String> {
    save_profile_to_db(&app, profile)?;
    Ok("Server profile saved.".to_string())
}

#[tauri::command]
fn start_llama_server(app: AppHandle, state: tauri::State<LlamaServerState>) -> Result<String, String> {
    let profile = get_profile_from_db(&app)?;

    if is_server_reachable(&profile.host, profile.port) {
        return Ok("llama-server is already running.".to_string());
    }

    if !Path::new(&profile.server_path).exists() {
        return Err(format!("llama-server path does not exist: {}", profile.server_path));
    }

    if !Path::new(&profile.model_path).exists() {
        return Err(format!("Model path does not exist: {}", profile.model_path));
    }

    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| "Could not lock llama-server state.".to_string())?;

    if let Some(child) = child_guard.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                *child_guard = None;
            }
            Ok(None) => {
                return Ok("llama-server is already starting.".to_string());
            }
            Err(error) => {
                return Err(format!("Could not inspect llama-server process: {}", error));
            }
        }
    }

    let child = Command::new(&profile.server_path)
        .arg("-m")
        .arg(&profile.model_path)
        .arg("-c")
        .arg(profile.context_size.to_string())
        .arg("-ngl")
        .arg(profile.gpu_layers.to_string())
        .arg("--host")
        .arg(&profile.host)
        .arg("--port")
        .arg(profile.port.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Failed to start llama-server: {}", error))?;

    *child_guard = Some(child);

    Ok("llama-server started. Wait a few seconds, then test connection.".to_string())
}

#[tauri::command]
fn stop_llama_server(app: AppHandle, state: tauri::State<LlamaServerState>) -> Result<String, String> {
    let profile = get_profile_from_db(&app)?;

    let mut child_guard = state
        .child
        .lock()
        .map_err(|_| "Could not lock llama-server state.".to_string())?;

    if let Some(mut child) = child_guard.take() {
        child
            .kill()
            .map_err(|error| format!("Failed to stop llama-server: {}", error))?;

        let _ = child.wait();

        return Ok("llama-server stopped.".to_string());
    }

    if is_server_reachable(&profile.host, profile.port) {
        return Ok(
            "llama-server is running, but it was not started by LocalMate. Stop it from the terminal that launched it."
                .to_string(),
        );
    }

    Ok("llama-server is not running.".to_string())
}

#[tauri::command]
fn restart_llama_server(app: AppHandle, state: tauri::State<LlamaServerState>) -> Result<String, String> {
    let _ = stop_llama_server(app.clone(), state.clone());
    std::thread::sleep(Duration::from_millis(700));
    start_llama_server(app, state)
}

#[tauri::command]
fn set_app_setting(app: AppHandle, key: String, value: String) -> Result<String, String> {
    let conn = db(&app)?;

    conn.execute(
        "
        INSERT INTO app_settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
        params![key, value],
    )
    .map_err(|error| format!("Could not save setting: {}", error))?;

    Ok("Setting saved.".to_string())
}

#[tauri::command]
fn get_app_setting(app: AppHandle, key: String) -> Result<Option<String>, String> {
    let conn = db(&app)?;

    let result = conn.query_row(
        "SELECT value FROM app_settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(value) => Ok(Some(value)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn create_chat_session(app: AppHandle, title: String) -> Result<i64, String> {
    let conn = db(&app)?;
    let ts = now_ts();

    conn.execute(
        "INSERT INTO chat_sessions (title, created_at, updated_at) VALUES (?1, ?2, ?3)",
        params![title, ts, ts],
    )
    .map_err(|error| format!("Could not create chat session: {}", error))?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn get_chat_sessions(app: AppHandle) -> Result<Vec<ChatSession>, String> {
    let conn = db(&app)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC LIMIT 50",
        )
        .map_err(|error| format!("Could not prepare sessions query: {}", error))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ChatSession {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|error| format!("Could not query sessions: {}", error))?;

    let mut sessions = Vec::new();

    for row in rows {
        sessions.push(row.map_err(|error| format!("Could not read session row: {}", error))?);
    }

    Ok(sessions)
}

#[tauri::command]
fn save_chat_message(
    app: AppHandle,
    session_id: i64,
    role: String,
    content: String,
) -> Result<String, String> {
    let conn = db(&app)?;
    let ts = now_ts();

    conn.execute(
        "INSERT INTO chat_history (session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![session_id, role, content, ts],
    )
    .map_err(|error| format!("Could not save chat message: {}", error))?;

    conn.execute(
        "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
        params![ts, session_id],
    )
    .map_err(|error| format!("Could not update chat session: {}", error))?;

    Ok("Chat message saved.".to_string())
}

#[tauri::command]
fn get_chat_history(
    app: AppHandle,
    session_id: i64,
    limit: i64,
) -> Result<Vec<ChatRecord>, String> {
    let conn = db(&app)?;

    let mut stmt = conn
        .prepare(
            "
            SELECT id, session_id, role, content, created_at
            FROM chat_history
            WHERE session_id = ?1
            ORDER BY id DESC
            LIMIT ?2
            ",
        )
        .map_err(|error| format!("Could not prepare chat query: {}", error))?;

    let rows = stmt
        .query_map(params![session_id, limit], |row| {
            Ok(ChatRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|error| format!("Could not query chat history: {}", error))?;

    let mut records = Vec::new();

    for row in rows {
        records.push(row.map_err(|error| format!("Could not read chat row: {}", error))?);
    }

    records.reverse();

    Ok(records)
}

#[tauri::command]
fn clear_chat_session(app: AppHandle, session_id: i64) -> Result<String, String> {
    let conn = db(&app)?;

    conn.execute(
        "DELETE FROM chat_history WHERE session_id = ?1",
        params![session_id],
    )
    .map_err(|error| format!("Could not clear chat session: {}", error))?;

    Ok("Chat session cleared.".to_string())
}




#[tauri::command]
fn save_prompt(
    app: AppHandle,
    title: String,
    category: String,
    content: String,
) -> Result<String, String> {
    let conn = db(&app)?;

    let clean_category = if category.trim().is_empty() {
        "General".to_string()
    } else {
        category.trim().to_string()
    };

    conn.execute(
        "INSERT INTO saved_prompts (title, category, content, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![title, clean_category, content, now_ts()],
    )
    .map_err(|error| format!("Could not save prompt: {}", error))?;

    Ok("Prompt saved.".to_string())
}

#[tauri::command]
fn update_prompt(
    app: AppHandle,
    id: i64,
    title: String,
    category: String,
    content: String,
) -> Result<String, String> {
    let conn = db(&app)?;

    conn.execute(
        "UPDATE saved_prompts SET title = ?1, category = ?2, content = ?3 WHERE id = ?4",
        params![title, category, content, id],
    )
    .map_err(|error| format!("Could not update prompt: {}", error))?;

    Ok("Prompt updated.".to_string())
}

#[tauri::command]
fn delete_prompt(app: AppHandle, id: i64) -> Result<String, String> {
    let conn = db(&app)?;

    conn.execute("DELETE FROM saved_prompts WHERE id = ?1", params![id])
        .map_err(|error| format!("Could not delete prompt: {}", error))?;

    Ok("Prompt deleted.".to_string())
}

#[tauri::command]
fn get_saved_prompts(app: AppHandle) -> Result<Vec<SavedPrompt>, String> {
    let conn = db(&app)?;

    let mut stmt = conn
        .prepare("SELECT id, title, category, content, created_at FROM saved_prompts ORDER BY category ASC, title ASC")
        .map_err(|error| format!("Could not prepare prompts query: {}", error))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SavedPrompt {
                id: row.get(0)?,
                title: row.get(1)?,
                category: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|error| format!("Could not query prompts: {}", error))?;

    let mut prompts = Vec::new();

    for row in rows {
        prompts.push(row.map_err(|error| format!("Could not read prompt row: {}", error))?);
    }

    Ok(prompts)
}

#[derive(Debug, Deserialize)]
struct ImportPrompt {
    title: String,
    category: Option<String>,
    content: String,
}

#[tauri::command]
fn import_prompts_json(app: AppHandle, json_text: String) -> Result<String, String> {
    let prompts: Vec<ImportPrompt> = serde_json::from_str(&json_text)
        .map_err(|error| format!("Invalid prompts JSON: {}", error))?;

    let conn = db(&app)?;
    let mut imported = 0usize;

    for prompt in prompts {
        let category = prompt.category.unwrap_or_else(|| "General".to_string());

        if prompt.title.trim().is_empty() || prompt.content.trim().is_empty() {
            continue;
        }

        conn.execute(
            "INSERT INTO saved_prompts (title, category, content, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![
                prompt.title.trim(),
                category.trim(),
                prompt.content.trim(),
                now_ts()
            ],
        )
        .map_err(|error| format!("Could not import prompt: {}", error))?;

        imported += 1;
    }

    Ok(format!("Imported {} prompts.", imported))
}

#[tauri::command]
fn export_prompts_json(app: AppHandle) -> Result<String, String> {
    let prompts = get_saved_prompts(app)?;
    serde_json::to_string_pretty(&prompts)
        .map_err(|error| format!("Could not export prompts: {}", error))
}


#[tauri::command]
fn parse_document(app: AppHandle, file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    let text = extract_text_from_path(&path)?;

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("unknown")
        .to_string();

    let conn = db(&app)?;
    conn.execute(
        "
        INSERT INTO recent_files (file_path, file_name, opened_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(file_path) DO UPDATE SET opened_at = excluded.opened_at
        ",
        params![file_path, file_name, now_ts()],
    )
    .map_err(|error| format!("Could not save recent file: {}", error))?;

    Ok(text)
}

#[tauri::command]
fn index_folder(app: AppHandle, folder_path: String) -> Result<IndexResult, String> {
    let conn = db(&app)?;
    let folder = PathBuf::from(&folder_path);

    if !folder.exists() || !folder.is_dir() {
        return Err("Folder path does not exist or is not a directory.".to_string());
    }

    conn.execute(
        "DELETE FROM file_chunks WHERE folder_path = ?1",
        params![folder_path.clone()],
    )
    .map_err(|error| format!("Could not clear previous index: {}", error))?;

    let mut files_indexed = 0usize;
    let mut chunks_indexed = 0usize;

    for entry in WalkDir::new(&folder).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();

        if !path.is_file() || !supported_document(path) {
            continue;
        }

        let text = match extract_text_from_path(path) {
            Ok(value) => value,
            Err(_) => continue,
        };

        if text.trim().is_empty() {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("unknown")
            .to_string();

        let file_path = path.to_string_lossy().to_string();
        let chunks = chunk_text(&text, 1800);

        for (index, chunk) in chunks.iter().enumerate() {
            conn.execute(
                "
                INSERT INTO file_chunks
                (folder_path, file_path, file_name, chunk_index, content, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ",
                params![
                    folder_path,
                    file_path,
                    file_name,
                    index as i64,
                    chunk,
                    now_ts()
                ],
            )
            .map_err(|error| format!("Could not insert file chunk: {}", error))?;

            chunks_indexed += 1;
        }

        files_indexed += 1;
    }

    conn.execute(
        "
        INSERT INTO indexed_folders (folder_path, indexed_at)
        VALUES (?1, ?2)
        ON CONFLICT(folder_path) DO UPDATE SET indexed_at = excluded.indexed_at
        ",
        params![folder_path, now_ts()],
    )
    .map_err(|error| format!("Could not save indexed folder: {}", error))?;

    Ok(IndexResult {
        files_indexed,
        chunks_indexed,
        message: format!("Indexed {} files into {} chunks.", files_indexed, chunks_indexed),
    })
}

#[tauri::command]
fn search_index(app: AppHandle, query: String, folder_path: Option<String>, limit: i64) -> Result<Vec<SearchResult>, String> {
    let conn = db(&app)?;
    let query_lower = query.to_lowercase();
    let terms: Vec<String> = query_lower
        .split_whitespace()
        .filter(|term| term.len() > 2)
        .map(|term| term.to_string())
        .collect();

    let mut chunks: Vec<IndexedChunk> = Vec::new();

    if let Some(folder) = folder_path {
        let mut stmt = conn
            .prepare(
                "
                SELECT id, file_name, file_path, chunk_index, content
                FROM file_chunks
                WHERE folder_path = ?1
                ORDER BY id DESC
                LIMIT 3000
                ",
            )
            .map_err(|error| format!("Could not prepare search query: {}", error))?;

        let rows = stmt
            .query_map(params![folder], |row| {
                Ok(IndexedChunk {
                    id: row.get(0)?,
                    file_name: row.get(1)?,
                    file_path: row.get(2)?,
                    chunk_index: row.get(3)?,
                    content: row.get(4)?,
                })
            })
            .map_err(|error| format!("Could not query chunks: {}", error))?;

        for row in rows {
            chunks.push(row.map_err(|error| format!("Could not read chunk: {}", error))?);
        }
    } else {
        let mut stmt = conn
            .prepare(
                "
                SELECT id, file_name, file_path, chunk_index, content
                FROM file_chunks
                ORDER BY id DESC
                LIMIT 3000
                ",
            )
            .map_err(|error| format!("Could not prepare search query: {}", error))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(IndexedChunk {
                    id: row.get(0)?,
                    file_name: row.get(1)?,
                    file_path: row.get(2)?,
                    chunk_index: row.get(3)?,
                    content: row.get(4)?,
                })
            })
            .map_err(|error| format!("Could not query chunks: {}", error))?;

        for row in rows {
            chunks.push(row.map_err(|error| format!("Could not read chunk: {}", error))?);
        }
    }

    let mut scored = Vec::new();

    for chunk in chunks {
        let content_lower = chunk.content.to_lowercase();
        let mut score = 0i64;

        for term in &terms {
            score += content_lower.matches(term).count() as i64;
            if chunk.file_name.to_lowercase().contains(term) {
                score += 3;
            }
        }

        if score > 0 {
            scored.push(SearchResult {
                file_name: chunk.file_name,
                file_path: chunk.file_path,
                chunk_index: chunk.chunk_index,
                content: chunk.content,
                score,
            });
        }
    }

    scored.sort_by(|a, b| b.score.cmp(&a.score));
    scored.truncate(limit as usize);

    Ok(scored)
}



fn save_bubble_position(app: &AppHandle) -> Result<(), String> {
    let Some(bubble) = app.get_webview_window("bubble") else {
        return Ok(());
    };

    let position = bubble
        .outer_position()
        .map_err(|error| format!("Could not read bubble position: {}", error))?;

    let conn = db(app)?;

    conn.execute(
        "
        INSERT INTO app_settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
        params!["bubble_x", position.x.to_string()],
    )
    .map_err(|error| format!("Could not save bubble x: {}", error))?;

    conn.execute(
        "
        INSERT INTO app_settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
        params!["bubble_y", position.y.to_string()],
    )
    .map_err(|error| format!("Could not save bubble y: {}", error))?;

    Ok(())
}

fn restore_bubble_position(app: &AppHandle) -> Result<(), String> {
    let Some(bubble) = app.get_webview_window("bubble") else {
        return Ok(());
    };

    let conn = db(app)?;

    let x_result: Result<String, _> = conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'bubble_x'",
        [],
        |row| row.get(0),
    );

    let y_result: Result<String, _> = conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'bubble_y'",
        [],
        |row| row.get(0),
    );

    let Ok(x_text) = x_result else {
        return Ok(());
    };

    let Ok(y_text) = y_result else {
        return Ok(());
    };

    let Ok(x) = x_text.parse::<i32>() else {
        return Ok(());
    };

    let Ok(y) = y_text.parse::<i32>() else {
        return Ok(());
    };

    bubble
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
        .map_err(|error| format!("Could not restore bubble position: {}", error))?;

    Ok(())
}


#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<String, String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found.".to_string())?;

    let _ = save_bubble_position(&app);

    if let Some(bubble) = app.get_webview_window("bubble") {
        let _ = bubble.hide();
    }

    main.show()
        .map_err(|error| format!("Could not show main window: {}", error))?;

    main.unminimize()
        .map_err(|error| format!("Could not unminimize main window: {}", error))?;

    main.set_focus()
        .map_err(|error| format!("Could not focus main window: {}", error))?;

    Ok("Main window shown.".to_string())
}



#[tauri::command]
fn get_unembedded_chunks(
    app: AppHandle,
    folder_path: Option<String>,
    limit: i64,
) -> Result<Vec<EmbeddingChunk>, String> {
    let conn = db(&app)?;

    let mut chunks = Vec::new();

    if let Some(folder) = folder_path {
        let mut stmt = conn
            .prepare(
                "
                SELECT file_chunks.id, file_chunks.file_name, file_chunks.file_path, file_chunks.chunk_index, file_chunks.content
                FROM file_chunks
                LEFT JOIN chunk_embeddings ON chunk_embeddings.chunk_id = file_chunks.id
                WHERE file_chunks.folder_path = ?1
                  AND chunk_embeddings.chunk_id IS NULL
                ORDER BY file_chunks.id ASC
                LIMIT ?2
                ",
            )
            .map_err(|error| format!("Could not prepare unembedded chunk query: {}", error))?;

        let rows = stmt
            .query_map(params![folder, limit], |row| {
                Ok(EmbeddingChunk {
                    chunk_id: row.get(0)?,
                    file_name: row.get(1)?,
                    file_path: row.get(2)?,
                    chunk_index: row.get(3)?,
                    content: row.get(4)?,
                })
            })
            .map_err(|error| format!("Could not query unembedded chunks: {}", error))?;

        for row in rows {
            chunks.push(row.map_err(|error| format!("Could not read unembedded chunk: {}", error))?);
        }
    } else {
        let mut stmt = conn
            .prepare(
                "
                SELECT file_chunks.id, file_chunks.file_name, file_chunks.file_path, file_chunks.chunk_index, file_chunks.content
                FROM file_chunks
                LEFT JOIN chunk_embeddings ON chunk_embeddings.chunk_id = file_chunks.id
                WHERE chunk_embeddings.chunk_id IS NULL
                ORDER BY file_chunks.id ASC
                LIMIT ?1
                ",
            )
            .map_err(|error| format!("Could not prepare unembedded chunk query: {}", error))?;

        let rows = stmt
            .query_map(params![limit], |row| {
                Ok(EmbeddingChunk {
                    chunk_id: row.get(0)?,
                    file_name: row.get(1)?,
                    file_path: row.get(2)?,
                    chunk_index: row.get(3)?,
                    content: row.get(4)?,
                })
            })
            .map_err(|error| format!("Could not query unembedded chunks: {}", error))?;

        for row in rows {
            chunks.push(row.map_err(|error| format!("Could not read unembedded chunk: {}", error))?);
        }
    }

    Ok(chunks)
}

#[tauri::command]
fn clear_folder_index(app: AppHandle, folder_path: String) -> Result<String, String> {
    let conn = db(&app)?;

    let chunk_ids: Vec<i64> = {
        let mut stmt = conn
            .prepare("SELECT id FROM file_chunks WHERE folder_path = ?1")
            .map_err(|error| format!("Could not prepare chunk id query: {}", error))?;

        let rows = stmt
            .query_map(params![folder_path.clone()], |row| row.get::<_, i64>(0))
            .map_err(|error| format!("Could not query chunk ids: {}", error))?;

        let mut ids = Vec::new();

        for row in rows {
            ids.push(row.map_err(|error| format!("Could not read chunk id: {}", error))?);
        }

        ids
    };

    for id in chunk_ids {
        conn.execute(
            "DELETE FROM chunk_embeddings WHERE chunk_id = ?1",
            params![id],
        )
        .map_err(|error| format!("Could not delete chunk embedding: {}", error))?;
    }

    conn.execute(
        "DELETE FROM file_chunks WHERE folder_path = ?1",
        params![folder_path.clone()],
    )
    .map_err(|error| format!("Could not clear folder chunks: {}", error))?;

    conn.execute(
        "DELETE FROM indexed_folders WHERE folder_path = ?1",
        params![folder_path],
    )
    .map_err(|error| format!("Could not remove indexed folder: {}", error))?;

    Ok("Folder index cleared.".to_string())
}

#[tauri::command]
fn open_source_file(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);

    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|error| format!("Could not open file with xdg-open: {}", error))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|error| format!("Could not open file: {}", error))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &file_path])
            .spawn()
            .map_err(|error| format!("Could not open file: {}", error))?;
    }

    Ok("File opened.".to_string())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(LlamaServerState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            llama_server_status,
            get_server_profile,
            save_server_profile,
            start_llama_server,
            stop_llama_server,
            restart_llama_server,
            set_app_setting,
            get_app_setting,
            create_chat_session,
            get_chat_sessions,
            save_chat_message,
            get_chat_history,
            clear_chat_session,
            save_prompt,
            update_prompt,
            delete_prompt,
            get_saved_prompts,
            import_prompts_json,
            export_prompts_json,
            parse_document,
            index_folder,
            get_unembedded_chunks,
            clear_folder_index,
            open_source_file,
            search_index
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let app = window.app_handle();

                    let _ = restore_bubble_position(app);

                    if let Some(bubble) = app.get_webview_window("bubble") {
                        let _ = bubble.show();
                        let _ = bubble.set_focus();
                    }

                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running LocalMate");
}
