import { useState } from "react";
import { askLocalMate } from "../../lib/llamaClient";
import { getAppSetting, setAppSetting } from "../../lib/tauriCommands";
import { TaskLayout } from "./TaskLayout";

type VoiceViewProps = {
  serverOnline: boolean;
};

export function VoiceView({ serverOnline }: VoiceViewProps) {
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [whisperPath, setWhisperPath] = useState("");
  const [whisperModelPath, setWhisperModelPath] = useState("");
  const [log, setLog] = useState(
    "Paste a transcript or use an external local Whisper tool, then clean/summarize with LocalMate."
  );

  async function loadWhisperSettings() {
    setWhisperPath((await getAppSetting("whisper_path")) || "");
    setWhisperModelPath((await getAppSetting("whisper_model_path")) || "");
    setLog("Whisper settings loaded.");
  }

  async function saveWhisperSettings() {
    await setAppSetting("whisper_path", whisperPath);
    await setAppSetting("whisper_model_path", whisperModelPath);
    setLog("Whisper settings saved. Local recording/transcription backend can be added next.");
  }

  async function runVoiceTask(task: "clean" | "summary" | "tasks") {
    const cleanTranscript = transcript.trim();

    if (!cleanTranscript) {
      setResult("Paste transcript text first.");
      return;
    }

    if (!serverOnline) {
      setResult("Model server is offline. Start Runtime first.");
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

          <div className="terminal-box">
            Browser speech recognition is not reliable inside Linux Tauri WebView.
            Use local Whisper outside the app for now, paste the transcript here,
            then let LocalMate clean, summarize, or extract tasks.
          </div>

          <textarea
            className="large-input"
            value={transcript}
            placeholder="Paste transcript here..."
            onChange={(event) => setTranscript(event.target.value)}
          />

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

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setTranscript("");
                setResult("");
              }}
            >
              Clear
            </button>
          </div>

          <div className="panel-header">
            <h2>Local Whisper settings</h2>
          </div>

          <label className="field-label">
            whisper.cpp executable path
            <input
              value={whisperPath}
              placeholder="/path/to/whisper-cli"
              onChange={(event) => setWhisperPath(event.target.value)}
            />
          </label>

          <label className="field-label">
            Whisper model path
            <input
              value={whisperModelPath}
              placeholder="/path/to/ggml-model.bin"
              onChange={(event) => setWhisperModelPath(event.target.value)}
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              className="secondary-button"
              onClick={loadWhisperSettings}
            >
              Load
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={saveWhisperSettings}
            >
              Save
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
