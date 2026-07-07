import { useState } from "react";
import { askLocalMate } from "../../lib/llamaClient";
import {
  openSourceFile,
  startNativeAudioRecording,
  stopNativeAudioRecording,
} from "../../lib/tauriCommands";
import { TaskLayout } from "./TaskLayout";

type VoiceViewProps = {
  serverOnline: boolean;
};

export function VoiceView({ serverOnline }: VoiceViewProps) {
  const [recording, setRecording] = useState(false);
  const [audioPath, setAudioPath] = useState("");
  const [recordingStartedAt, setRecordingStartedAt] = useState("");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState(
    "Native Linux recorder uses arecord. Record audio, open the WAV file, then type/paste transcript notes."
  );

  async function startRecording() {
    if (recording) return;

    try {
      const path = await startNativeAudioRecording();
      setAudioPath(path);
      setRecording(true);
      setRecordingStartedAt(new Date().toLocaleString());
      setLog(`Recording started: ${path}`);
    } catch (error) {
      setRecording(false);
      setLog(error instanceof Error ? error.message : "Could not start recording.");
    }
  }

  async function stopRecording() {
    if (!recording) return;

    try {
      const path = await stopNativeAudioRecording();
      setAudioPath(path);
      setRecording(false);
      setLog(`Recording saved: ${path}`);
    } catch (error) {
      setRecording(false);
      setLog(error instanceof Error ? error.message : "Could not stop recording.");
    }
  }

  async function openRecording() {
    if (!audioPath) {
      setLog("No recording path yet.");
      return;
    }

    try {
      await openSourceFile(audioPath);
      setLog("Opened recording with system audio player.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not open recording.");
    }
  }

  async function runVoiceTask(task: "clean" | "summary" | "tasks") {
    const cleanTranscript = transcript.trim();

    if (!cleanTranscript) {
      setResult("Type or paste transcript/notes first.");
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
        ? "Clean this rough transcript or voice note into clear readable notes. Fix punctuation and structure. Preserve the original meaning."
        : task === "summary"
          ? "Summarize this transcript or voice note into concise bullets."
          : "Extract action items from this transcript or voice note. Include owner and due date only if mentioned. Otherwise use Unassigned and No due date.";

    try {
      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "You are LocalMate Voice Notes. Convert rough voice notes into clean useful notes. Do not invent facts.",
        },
        {
          role: "user",
          content: `${instruction}

Voice note text:
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
            <h2>Native recorder</h2>
          </div>

          <div className="terminal-box">
            This recorder uses Linux ALSA arecord, not browser microphone APIs.
            Install it with: sudo apt install alsa-utils -y
          </div>

          <div className={recording ? "recording-card active" : "recording-card"}>
            <div className="recording-dot" />
            <div>
              <strong>{recording ? "Recording..." : "Recorder ready"}</strong>
              <span>
                {recordingStartedAt
                  ? `Started: ${recordingStartedAt}`
                  : "No active recording."}
              </span>
            </div>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="primary-button"
              disabled={recording}
              onClick={startRecording}
            >
              Start recording
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={!recording}
              onClick={stopRecording}
            >
              Stop
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={!audioPath}
              onClick={openRecording}
            >
              Open audio
            </button>
          </div>

          <div className="path-box">
            {audioPath || "Recording path will appear here."}
          </div>

          <div className="panel-header">
            <h2>Transcript / notes</h2>
          </div>

          <textarea
            className="large-input"
            value={transcript}
            placeholder="Type or paste what was said in the recording..."
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
              Clear text
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
