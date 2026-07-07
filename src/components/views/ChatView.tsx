import { useEffect, useState } from "react";
import {
  askLocalMate,
  LOCALMATE_SYSTEM_PROMPT,
  LocalMateMessage,
} from "../../lib/llamaClient";
import {
  ChatSession,
  clearChatSession,
  createChatSession,
  getChatHistory,
  getChatSessions,
  getSavedPrompts,
  saveChatMessage,
  savePrompt,
  SavedPrompt,
} from "../../lib/tauriCommands";
import { MessageBubble } from "../MessageBubble";
import { Send } from "lucide-react";

type ChatViewProps = {
  serverOnline: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};


function errorToText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I’m LocalMate. I run locally on your laptop. Ask me to write, explain, summarize, or help with code.",
};

export function ChatView({ serverOnline }: ChatViewProps) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);

  function addAssistantMessage(content: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
      },
    ]);
  }

  async function loadPrompts() {
    try {
      setPrompts(await getSavedPrompts());
    } catch (error) {
      console.error("Could not load prompts", error);
    }
  }

  async function loadSessions() {
    try {
      const loadedSessions = await getChatSessions();
      setSessions(loadedSessions);

      if (loadedSessions.length > 0) {
        setSessionId(loadedSessions[0].id);
        await loadHistory(loadedSessions[0].id);
        return;
      }

      const newSessionId = await createChatSession("New chat");
      setSessionId(newSessionId);
      setSessions(await getChatSessions());
      setMessages([welcomeMessage]);
    } catch (error) {
      const message = errorToText(error);

      addAssistantMessage(
        `LocalMate chat storage error:\n${message}\n\nChat can still work temporarily, but history may not save.`
      );
    }
  }

  async function loadHistory(id: number) {
    try {
      const history = await getChatHistory(id, 80);

      if (history.length > 0) {
        setMessages(
          history
            .filter((item) => item.role === "user" || item.role === "assistant")
            .map((item) => ({
              id: String(item.id),
              role: item.role as "user" | "assistant",
              content: item.content,
            }))
        );
      } else {
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      const message = errorToText(error);

      setMessages([
        welcomeMessage,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Could not load chat history:\n${message}`,
        },
      ]);
    }
  }

  async function getOrCreateSessionId() {
    if (sessionId) return sessionId;

    try {
      const id = await createChatSession("New chat");
      setSessionId(id);
      setSessions(await getChatSessions());
      return id;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    loadSessions();
    loadPrompts();
  }, []);

  async function newChat() {
    try {
      const id = await createChatSession("New chat");
      setSessionId(id);
      setSessions(await getChatSessions());
      setMessages([welcomeMessage]);
    } catch (error) {
      const message = errorToText(error);
      addAssistantMessage(`Could not create new chat:\n${message}`);
    }
  }

  async function switchSession(id: number) {
    setSessionId(id);
    await loadHistory(id);
  }

  async function sendMessage() {
    const trimmed = input.trim();

    if (!trimmed || busy) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const previousMessages = messages;

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setBusy(true);

    const activeSessionId = await getOrCreateSessionId();

    if (activeSessionId) {
      try {
        await saveChatMessage(activeSessionId, "user", trimmed);
      } catch (error) {
        console.error("Could not save user message", error);
      }
    }

    if (!serverOnline) {
      addAssistantMessage(
        "The local model server is offline. Open Settings, click Start, then Test connection."
      );
      setBusy(false);
      return;
    }

    try {
      const recentMessages: LocalMateMessage[] = previousMessages
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.content,
        }));

      const reply = await askLocalMate([
        {
          role: "system",
          content: LOCALMATE_SYSTEM_PROMPT,
        },
        ...recentMessages,
        {
          role: "user",
          content: trimmed,
        },
      ]);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: reply || "I could not generate a response.",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (activeSessionId) {
        try {
          await saveChatMessage(
            activeSessionId,
            "assistant",
            assistantMessage.content
          );
          setSessions(await getChatSessions());
        } catch (error) {
          console.error("Could not save assistant message", error);
        }
      }
    } catch (error) {
      const message = errorToText(error);

      addAssistantMessage(`LocalMate model error:\n${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function clearCurrentSession() {
    if (!sessionId) {
      setMessages([welcomeMessage]);
      return;
    }

    try {
      await clearChatSession(sessionId);
      await loadHistory(sessionId);
    } catch (error) {
      const message = errorToText(error);
      addAssistantMessage(`Could not clear chat:\n${message}`);
    }
  }

  async function saveCurrentAsPrompt() {
    const trimmed = input.trim();
    if (!trimmed) return;

    try {
      const title = trimmed.slice(0, 48);
      await savePrompt(title, trimmed);
      await loadPrompts();
      addAssistantMessage("Prompt saved.");
    } catch (error) {
      const message = errorToText(error);
      addAssistantMessage(`Could not save prompt:\n${message}`);
    }
  }

  return (
    <section className="chat-panel">
      <div className="chat-tools">
        <select
          value={sessionId ?? ""}
          onChange={(event) => switchSession(Number(event.target.value))}
        >
          <option value="">Session</option>
          {sessions.map((session) => (
            <option value={session.id} key={session.id}>
              {session.title} #{session.id}
            </option>
          ))}
        </select>

        <button type="button" className="mini-button" onClick={newChat}>
          New
        </button>

        <select
          value=""
          onChange={(event) => {
            const selected = prompts.find(
              (prompt) => String(prompt.id) === event.target.value
            );
            if (selected) setInput(selected.content);
          }}
        >
          <option value="">Prompts</option>
          {prompts.map((prompt) => (
            <option value={prompt.id} key={prompt.id}>
              {prompt.title}
            </option>
          ))}
        </select>

        <button type="button" className="mini-button" onClick={saveCurrentAsPrompt}>
          Save
        </button>

        <button type="button" className="mini-button" onClick={clearCurrentSession}>
          Clear
        </button>
      </div>

      <div className="messages">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={message.content}
          />
        ))}

        {busy && (
          <MessageBubble role="assistant" content="LocalMate is thinking..." />
        )}
      </div>

      <div className="composer">
        <textarea
          value={input}
          placeholder="Ask LocalMate anything..."
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }}
        />

        <button
          type="button"
          aria-label="Send message"
          title="Send"
          onClick={sendMessage}
          disabled={busy || !input.trim()}
        >
          <Send size={18} />
        </button>
      </div>
    </section>
  );
}
