import { useEffect, useState } from "react";
import { getSavedPrompts } from "../../lib/tauriCommands";
import { getModelProfiles } from "../../lib/modelProfiles";
import { TaskLayout } from "./TaskLayout";

type SettingsViewProps = {
  theme?: "hacker" | "black" | "white" | "midnight" | "purple";
  setTheme?: (theme: "hacker" | "black" | "white" | "midnight" | "purple") => void;
  serverOnline?: boolean;
  refreshServerStatus?: () => void;
  [key: string]: unknown;
};

const themes = [
  { key: "hacker", label: "Hacker" },
  { key: "black", label: "Black" },
  { key: "white", label: "White" },
  { key: "midnight", label: "Midnight" },
  { key: "purple", label: "Purple" },
];

export function SettingsView({
  theme = "hacker",
  setTheme,
  serverOnline,
}: SettingsViewProps) {
  const [backupText, setBackupText] = useState("");
  const [log, setLog] = useState(
    "Settings is now for app behavior only. Use Runtime for model/server controls."
  );

  useEffect(() => {
    setLog(
      serverOnline
        ? "Local model is online. Use Runtime to change or restart models."
        : "Local model is offline. Use Runtime to start or restart models."
    );
  }, [serverOnline]);

  async function exportBackup() {
    try {
      const prompts = await getSavedPrompts();
      const modelProfiles = await getModelProfiles();

      const backup = {
        app: "LocalMate",
        version: "v1.0",
        exported_at: new Date().toISOString(),
        prompts,
        model_profiles: modelProfiles,
      };

      const json = JSON.stringify(backup, null, 2);
      setBackupText(json);
      await navigator.clipboard.writeText(json);
      setLog("Backup copied to clipboard and shown below.");
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not export backup.");
    }
  }

  return (
    <TaskLayout>
      <div className="split-workspace">
        <div className="panel">
          <div className="panel-header">
            <h2>App settings</h2>
          </div>

          <label className="field-label">
            Theme
            <select
              value={theme}
              onChange={(event) => setTheme?.(event.target.value as "hacker" | "black" | "white" | "midnight" | "purple")}
            >
              {themes.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="terminal-box">
            Runtime controls were moved to the Runtime page:
            llama-server path, GGUF model path, context, GPU layers,
            embeddings, start, stop, restart, and model switching.
          </div>

          <div className="settings-card">
            <strong>Current runtime status</strong>
            <span>{serverOnline ? "Online" : "Offline"}</span>
          </div>

          <div className="settings-card">
            <strong>Privacy</strong>
            <span>
              LocalMate keeps prompts, chat history, indexed chunks, runtime
              profiles, and settings on this computer.
            </span>
          </div>
        </div>

        <div className="panel wide-panel">
          <div className="panel-header">
            <h2>Backup</h2>
          </div>

          <p className="muted-text">
            Export prompts and runtime profiles as JSON. Full SQLite backup can
            be added next if needed.
          </p>

          <button className="primary-button" onClick={exportBackup}>
            Export app backup
          </button>

          <textarea
            className="large-input"
            value={backupText}
            placeholder="Backup JSON will appear here..."
            onChange={(event) => setBackupText(event.target.value)}
          />

          <div className="terminal-box">{log}</div>
        </div>
      </div>
    </TaskLayout>
  );
}
