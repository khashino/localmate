import { invoke } from "@tauri-apps/api/core";

export type ServerProfile = {
  server_path: string;
  model_path: string;
  host: string;
  port: number;
  context_size: number;
  gpu_layers: number;
  embedding_enabled: boolean;
};

export type ModelPreset = {
  name: string;
  context_size: number;
  gpu_layers: number;
  max_tokens: number;
  temperature: number;
};

export type SearchResult = {
  chunk_id: number;
  file_name: string;
  file_path: string;
  chunk_index: number;
  content: string;
  score: number;
};

export type ChatSession = {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
};

export type ChatRecord = {
  id: number;
  session_id: number;
  role: string;
  content: string;
  created_at: number;
};

export type SavedPrompt = {
  id: number;
  title: string;
  content: string;
  created_at: number;
};

export type RecentFile = {
  id: number;
  file_path: string;
  file_name: string;
  opened_at: number;
};

export type IndexedFolder = {
  id: number;
  folder_path: string;
  indexed_at: number;
};

export type IndexResult = {
  files_indexed: number;
  chunks_indexed: number;
  message: string;
};

export async function startLocalServer(): Promise<string> {
  return invoke<string>("start_llama_server");
}

export async function stopLocalServer(): Promise<string> {
  return invoke<string>("stop_llama_server");
}

export async function restartLocalServer(): Promise<string> {
  return invoke<string>("restart_llama_server");
}

export async function getLocalServerStatus(): Promise<boolean> {
  return invoke<boolean>("llama_server_status");
}

export async function getServerProfile(): Promise<ServerProfile> {
  return invoke<ServerProfile>("get_server_profile");
}

export async function saveServerProfile(profile: ServerProfile): Promise<string> {
  return invoke<string>("save_server_profile", { profile });
}

export async function getModelPresets(): Promise<ModelPreset[]> {
  return invoke<ModelPreset[]>("get_model_presets");
}

export async function setAppSetting(key: string, value: string): Promise<string> {
  return invoke<string>("set_app_setting", { key, value });
}

export async function getAppSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_app_setting", { key });
}

export async function createChatSession(title: string): Promise<number> {
  return invoke<number>("create_chat_session", { title });
}

export async function getChatSessions(): Promise<ChatSession[]> {
  return invoke<ChatSession[]>("get_chat_sessions");
}

export async function saveChatMessage(
  sessionId: number,
  role: string,
  content: string
): Promise<string> {
  return invoke<string>("save_chat_message", { sessionId, role, content });
}

export async function getChatHistory(
  sessionId: number,
  limit = 80
): Promise<ChatRecord[]> {
  return invoke<ChatRecord[]>("get_chat_history", { sessionId, limit });
}

export async function clearChatSession(sessionId: number): Promise<string> {
  return invoke<string>("clear_chat_session", { sessionId });
}

export async function savePrompt(title: string, content: string): Promise<string> {
  return invoke<string>("save_prompt", { title, content });
}

export async function deletePrompt(id: number): Promise<string> {
  return invoke<string>("delete_prompt", { id });
}

export async function getSavedPrompts(): Promise<SavedPrompt[]> {
  return invoke<SavedPrompt[]>("get_saved_prompts");
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  return invoke<RecentFile[]>("get_recent_files");
}

export async function getIndexedFolders(): Promise<IndexedFolder[]> {
  return invoke<IndexedFolder[]>("get_indexed_folders");
}

export async function parseDocument(filePath: string): Promise<string> {
  return invoke<string>("parse_document", { filePath });
}

export async function indexFolder(folderPath: string): Promise<IndexResult> {
  return invoke<IndexResult>("index_folder", { folderPath });
}

export async function saveChunkEmbedding(
  chunkId: number,
  embeddingJson: string
): Promise<string> {
  return invoke<string>("save_chunk_embedding", {
    payload: {
      chunk_id: chunkId,
      embedding_json: embeddingJson,
    },
  });
}

export async function searchIndex(
  query: string,
  folderPath: string | null,
  queryEmbeddingJson: string | null,
  limit = 5
): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_index", {
    query,
    folderPath,
    queryEmbeddingJson,
    limit,
  });
}
