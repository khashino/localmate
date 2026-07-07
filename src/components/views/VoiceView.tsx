import { useMemo, useRef, useState } from "react";
import { askLocalMate } from "../../lib/llamaClient";
import { TaskLayout } from "./TaskLayout";

type VoiceViewProps = {
  serverOnline: boolean;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const languageOptions = [
  { label: "English", value: "en-US" },
  { label: "Persian", value: "fa-IR" },
  { label: "Arabic", value: "ar-SA" },
  { label: "Turkish", value: "tr-TR" },
  { label: "German", value: "de-DE" },
  { label: "French", value: "fr-FR" },
  { label: "Spanish", value: "es-ES" },
];

export function VoiceView({ serverOnline }: VoiceViewProps) {
  const [language, setLanguage] = useState("en-US");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [result, setResult] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("Use speech recognition if your WebView supports it, or paste notes manually.");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const recognitionSupported = useMemo(() => {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  function startListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      setLog("Speech recognition is not supported in this WebView. Paste your transcript manually.");
      return;
    }

    const recognition = new Recognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const item = event.results[index];
        const text = item[0]?.transcript ?? "";

        if (item.isFinal) {
          finalText += text + " ";
        } else {
          interim += text;
        }
      }

      if (finalText.trim()) {
        setTranscript((prev) => `${prev} ${finalText}`.trim());
      }

      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      setLog(`Speech recognition error: ${event.error || "unknown error"}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setLog("Listening...");
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterimText("");
    setLog("Stopped listening.");
  }

  async function runVoiceTask(task: "clean" | "summary" | "tasks") {
    const cleanTranscript = transcript.trim();

    if (!cleanTranscript) {
      setResult("Add or dictate transcript text first.");
      return;
    }

    if (!serverOnline) {
      setResult("Model server is offline. Start llama-server first.");
      return;
    }

    setBusy(true);
    setResult("");

    const instruction =
      task === "clean"
        ? "Clean this transcript into clear readable notes. Fix punctuation and obvious speech recognition mistakes. Preserve the original meaning."
        : task === "summary"
          ? "Summarize this transcript into concise meeting or voice-note bullets."
          : "Extract action items from this transcript. Include owner and due date only if mentioned. Otherwise use Unassigned and No due date.";

    try {
      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "You are LocalMate Voice Notes. Convert rough transcripts into clean useful notes. Do not invent facts.",
        },
        {
          role: "user",
          content: `${instruction}

Transcript:
${cleanTranscript}`,
        },
      ]);

      setResult(reply || "No result returned.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unknown voice note error.");
    } finally {
      setBusy(false);
    }
  }

  async function copyResult() {
    if (!result.trim()) return;
    await navigator.clipboard.writeText(result);
    setLog("Result copied.");
  }

  return (
    <TaskLayout>
      <div className="split-workspace">
        <div className="panel">
          <div className="panel-header">
            <h2>Voice notes</h2>
          </div>

          <label className="field-label">
            Speech language
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              onClick={startListening}
              disabled={listening || !recognitionSupported}
            >
              Start listening
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={stopListening}
              disabled={!listening}
            >
              Stop
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setTranscript("");
                setInterimText("");
                setResult("");
              }}
            >
              Clear
            </button>
          </div>

          {!recognitionSupported && (
            <div className="terminal-box">
              Speech recognition is not available in this WebView. You can still paste a transcript manually.
            </div>
          )}

          <textarea
            className="large-input"
            value={transcript}
            placeholder="Dictated or pasted transcript..."
            onChange={(event) => setTranscript(event.target.value)}
          />

          {interimText && <div className="terminal-box">Live: {interimText}</div>}

          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              disabled={busy || !transcript.trim()}
              onClick={() => runVoiceTask("clean")}
            >
              Clean notes
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={busy || !transcript.trim()}
              onClick={() => runVoiceTask("summary")}
            >
              Summarize
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={busy || !transcript.trim()}
              onClick={() => runVoiceTask("tasks")}
            >
              Action items
            </button>
          </div>

          <div className="terminal-box">{log}</div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Result</h2>
          </div>

          <div className="output-box">
            {busy ? "Working..." : result || "Clean notes, summary, or tasks will appear here."}
          </div>

          <button
            type="button"
            className="secondary-button"
            disabled={!result.trim()}
            onClick={copyResult}
          >
            Copy result
          </button>
        </div>
      </div>
    </TaskLayout>
  );
}
