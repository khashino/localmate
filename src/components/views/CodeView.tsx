import { useState } from "react";
import { askLocalMate } from "../../lib/llamaClient";
import { TaskLayout } from "./TaskLayout";

type CodeViewProps = {
  serverOnline: boolean;
};

const modes = [
  "Explain this code",
  "Find possible bugs",
  "Explain this error",
  "Add comments",
  "Suggest a cleaner version",
  "Write unit test ideas",
];

export function CodeView({ serverOnline }: CodeViewProps) {
  const [mode, setMode] = useState(modes[0]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  async function runCodeTask() {
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
            "You are LocalMate's code assistant. Be concise, practical, and point out assumptions. Do not invent APIs.",
        },
        {
          role: "user",
          content: `Task: ${mode}\n\nCode or error:\n${trimmed}`,
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
            <h2>Code / Error</h2>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              {modes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <textarea
            className="large-input code-input"
            value={input}
            placeholder="Paste code, traceback, or error message..."
            onChange={(event) => setInput(event.target.value)}
          />

          <button
            className="primary-button"
            onClick={runCodeTask}
            disabled={busy || !input.trim()}
          >
            {busy ? "Analyzing..." : "Run"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Result</h2>
          </div>

          <div className="output-box code-output">
            {output || "LocalMate's code analysis will appear here."}
          </div>
        </div>
      </div>
    </TaskLayout>
  );
}
