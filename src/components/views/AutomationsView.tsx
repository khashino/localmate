import { useState } from "react";
import { askLocalMate } from "../../lib/llamaClient";
import { TaskLayout } from "./TaskLayout";

type AutomationsViewProps = {
  serverOnline: boolean;
};

export function AutomationsView({ serverOnline }: AutomationsViewProps) {
  const [request, setRequest] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  async function createPlan() {
    const trimmed = request.trim();

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
            "You are LocalMate's safe automation planner. Do not execute anything. Return a preview plan, risks, and confirmation needed.",
        },
        {
          role: "user",
          content: `Create a safe preview plan for this laptop task. Do not execute anything.\n\nTask:\n${trimmed}`,
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
            <h2>Automation request</h2>
          </div>

          <textarea
            className="large-input"
            value={request}
            placeholder="Example: Organize my Downloads folder by file type."
            onChange={(event) => setRequest(event.target.value)}
          />

          <button
            className="primary-button"
            onClick={createPlan}
            disabled={busy || !request.trim()}
          >
            {busy ? "Planning..." : "Preview plan"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Safe preview</h2>
          </div>

          <div className="output-box">
            {output ||
              "LocalMate will only create a preview here. Execution will be added later with approval controls."}
          </div>
        </div>
      </div>
    </TaskLayout>
  );
}
