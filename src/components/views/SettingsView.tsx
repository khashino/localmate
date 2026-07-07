import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { ThemeKey } from "../../app/LocalMateApp";
import {
  getServerProfile,
  restartLocalServer,
  saveServerProfile,
  ServerProfile,
  startLocalServer,
  stopLocalServer,
} from "../../lib/tauriCommands";
import { TaskLayout } from "./TaskLayout";

type SettingsViewProps = {
  serverOnline: boolean;
  onRefresh: () => void;
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
};

const themes: { key: ThemeKey; label: string }[] = [
  { key: "hacker", label: "Hacker green" },
  { key: "black", label: "Black glass" },
  { key: "white", label: "White clean" },
  { key: "midnight", label: "Midnight blue" },
  { key: "purple", label: "Purple neon" },
];

export function SettingsView({
  serverOnline,
  onRefresh,
  theme,
  setTheme,
}: SettingsViewProps) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("Configure LocalMate runtime.");
  const [profile, setProfile] = useState<ServerProfile>({
    server_path: "",
    model_path: "",
    host: "127.0.0.1",
    port: 8080,
    context_size: 2048,
    gpu_layers: 0,
    embedding_enabled: false,
  });

  async function loadProfile() {
    const loaded = await getServerProfile();
    setProfile(loaded);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function chooseServerPath() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "llama-server", extensions: [""] }],
    });

    if (typeof selected === "string") {
      setProfile((prev) => ({ ...prev, server_path: selected }));
    }
  }

  async function chooseModelPath() {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "GGUF models", extensions: ["gguf"] }],
    });

    if (typeof selected === "string") {
      setProfile((prev) => ({ ...prev, model_path: selected }));
    }
  }

  async function saveProfile() {
    setBusy(true);

    try {
      const message = await saveServerProfile(profile);
      setLog(message);
      await loadProfile();
      onRefresh();
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "start" | "stop" | "restart") {
    setBusy(true);

    try {
      await saveServerProfile(profile);

      let message = "";

      if (action === "start") {
        message = await startLocalServer();
      }

      if (action === "stop") {
        message = await stopLocalServer();
      }

      if (action === "restart") {
        message = await restartLocalServer();
      }

      setLog(message);
      window.setTimeout(onRefresh, 1200);
    } catch (error) {
      setLog(error instanceof Error ? error.message : "Unknown LocalMate server error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TaskLayout>
      <div className="settings-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Theme</h2>
          </div>

          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value as ThemeKey)}
          >
            {themes.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="theme-swatches">
            {themes.map((item) => (
              <button
                key={item.key}
                className={`theme-swatch theme-swatch-${item.key} ${
                  theme === item.key ? "active" : ""
                }`}
                onClick={() => setTheme(item.key)}
                title={item.label}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Runtime</h2>
          </div>

          <div className="server-card">
            <div className={serverOnline ? "server-orb online" : "server-orb offline"} />
            <div>
              <strong>{serverOnline ? "Model online" : "Model offline"}</strong>
              <span>
                {profile.host}:{profile.port}
              </span>
            </div>
          </div>

          <label className="field-label">
            llama-server path
            <div className="field-row">
              <input
                value={profile.server_path}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    server_path: event.target.value,
                  }))
                }
              />
              <button className="mini-button" onClick={chooseServerPath}>
                Pick
              </button>
            </div>
          </label>

          <label className="field-label">
            GGUF model path
            <div className="field-row">
              <input
                value={profile.model_path}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    model_path: event.target.value,
                  }))
                }
              />
              <button className="mini-button" onClick={chooseModelPath}>
                Pick
              </button>
            </div>
          </label>

          <div className="settings-two-cols">
            <label className="field-label">
              Host
              <input
                value={profile.host}
                onChange={(event) =>
                  setProfile((prev) => ({ ...prev, host: event.target.value }))
                }
              />
            </label>

            <label className="field-label">
              Port
              <input
                type="number"
                value={profile.port}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    port: Number(event.target.value),
                  }))
                }
              />
            </label>

            <label className="field-label">
              Context
              <input
                type="number"
                value={profile.context_size}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    context_size: Number(event.target.value),
                  }))
                }
              />
            </label>

            <label className="field-label">
              GPU layers
              <input
                type="number"
                value={profile.gpu_layers}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    gpu_layers: Number(event.target.value),
                  }))
                }
              />
            </label>

            <label className="field-label">
              Enable embeddings
              <input
                type="checkbox"
                checked={profile.embedding_enabled}
                onChange={(event) =>
                  setProfile((prev) => ({
                    ...prev,
                    embedding_enabled: event.target.checked,
                  }))
                }
              />
            </label>
          </div>

          <button className="secondary-button" disabled={busy} onClick={saveProfile}>
            Save profile
          </button>

          <div className="server-actions">
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => runAction("start")}
            >
              Start
            </button>

            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => runAction("restart")}
            >
              Restart
            </button>

            <button
              className="danger-button"
              disabled={busy}
              onClick={() => runAction("stop")}
            >
              Stop
            </button>
          </div>

          <button className="secondary-button" onClick={onRefresh}>
            Test connection
          </button>

          <div className="terminal-box">{busy ? "Working..." : log}</div>
        </div>
      </div>
    </TaskLayout>
  );
}
