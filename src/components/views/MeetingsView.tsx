import { useState } from "react";
import { askLocalMate } from "../../lib/llamaClient";
import { TaskLayout } from "./TaskLayout";

type MeetingsViewProps = {
  serverOnline: boolean;
};

export function MeetingsView({ serverOnline }: MeetingsViewProps) {
  const [notes, setNotes] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  async function summarizeMeeting() {
    const trimmed = notes.trim();

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
            "You are LocalMate's meeting notes assistant. Create structured, practical meeting notes.",
        },
        {
          role: "user",
          content: `Turn these notes into:\n1. Summary\n2. Decisions\n3. Action items\n4. Owners if mentioned\n5. Deadlines if mentioned\n6. Open questions\n\nNotes:\n${trimmed}`,
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
            <h2>Meeting notes</h2>
          </div>

          <textarea
            className="large-input"
            value={notes}
            placeholder="Paste meeting notes or transcript..."
            onChange={(event) => setNotes(event.target.value)}
          />

          <button
            className="primary-button"
            onClick={summarizeMeeting}
            disabled={busy || !notes.trim()}
          >
            {busy ? "Summarizing..." : "Create meeting summary"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Summary</h2>
          </div>

          <div className="output-box">
            {output || "Meeting summary will appear here."}
          </div>
        </div>
      </div>
    </TaskLayout>
  );
}
