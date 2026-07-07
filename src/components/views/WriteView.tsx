import { useState } from "react";
import { askLocalMate } from "../../lib/llamaClient";
import { TaskLayout } from "./TaskLayout";

type WriteViewProps = {
  serverOnline: boolean;
};

const modes = [
  "Rewrite professionally",
  "Make shorter",
  "Make friendlier",
  "Fix grammar",
  "Expand into a full draft",
  "Translate to English",
  "Translate to Persian",
];

export function WriteView({ serverOnline }: WriteViewProps) {
  const [mode, setMode] = useState(modes[0]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  async function runWritingTask() {
    const trimmed = input.trim();

    if (!trimmed || busy) return;

    if (!serverOnline) {
      setOutput("Model server is offline. Start llama-server first.");
      return;
    }

    setBusy(true);
    setOutput("");

    try {
      const reply = await askLocalMate([
        {
          role: "system",
          content:
            "You are LocalMate's writing assistant. Return only the improved text unless explanation is necessary.",
        },
        {
          role: "user",
          content: `Task: ${mode}\n\nText:\n${trimmed}`,
        },
      ]);

      setOutput(reply);
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Unknown error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TaskLayout>
      <div className="split-workspace">
        <div className="panel">
          <div className="panel-header">
            <h2>Input</h2>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              {modes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <textarea
            className="large-input"
            value={input}
            placeholder="Paste text you want LocalMate to improve..."
            onChange={(event) => setInput(event.target.value)}
          />

          <button
            className="primary-button"
            onClick={runWritingTask}
            disabled={busy || !input.trim()}
          >
            {busy ? "Working..." : "Generate"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Output</h2>
          </div>

          <div className="output-box">
            {output || "Your generated writing will appear here."}
          </div>
        </div>
      </div>
    </TaskLayout>
  );
}
