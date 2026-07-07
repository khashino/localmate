import { getServerProfile } from "./tauriCommands";

export type LocalMateMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const LOCALMATE_SYSTEM_PROMPT =
  "You are LocalMate, a private local desktop AI assistant. Help with writing, files, code, notes, and safe laptop tasks. Be concise, practical, and clear.";

export async function checkLlamaServer(): Promise<boolean> {
  try {
    const profile = await getServerProfile();
    const response = await fetch(`http://${profile.host}:${profile.port}/v1/models`, {
      method: "GET",
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function askLocalMate(
  messages: LocalMateMessage[],
  maxTokens = 512
): Promise<string> {
  const profile = await getServerProfile();

  const response = await fetch(
    `http://${profile.host}:${profile.port}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "local-gguf",
        messages,
        temperature: 0.4,
        max_tokens: maxTokens,
        stream: false,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LocalMate model error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function embedText(text: string): Promise<number[] | null> {
  try {
    const profile = await getServerProfile();

    if (!profile.embedding_enabled) {
      return null;
    }

    const response = await fetch(`http://${profile.host}:${profile.port}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "local-gguf",
        input: text.slice(0, 1800),
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;

    if (!Array.isArray(embedding)) {
      return null;
    }

    return embedding.map(Number);
  } catch {
    return null;
  }
}
