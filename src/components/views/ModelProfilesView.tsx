import { useEffect, useMemo, useState } from "react";
import {
  activateModelProfile,
  createModelProfile,
  deleteModelProfile,
  getActiveModelProfileId,
  getModelProfiles,
  makeProfileFromCurrentSettings,
  ModelProfile,
  updateModelProfile,
} from "../../lib/modelProfiles";
import { TaskLayout } from "./TaskLayout";

const purposes: ModelProfile["purpose"][] = [
  "General",
  "Chat",
  "Code",
  "Write",
  "Files",
  "Translator",
  "Embedding",
];

const emptyProfile: ModelProfile = {
  id: "",
  name: "New model profile",
  purpose: "General",
  server_path: "",
  model_path: "",
  host: "127.0.0.1",
  port: 8080,
  context_size: 2048,
  gpu_layers: 0,
  embedding_enabled: false,
  temperature: 0.4,
  max_tokens: 512,
};

export function ModelProfilesView() {
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<ModelProfile>(emptyProfile);
  const [log, setLog] = useState("Create profiles for different local GGUF models.");

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId),
    [profiles, selectedId]
  );

  async function load() {
    const loadedProfiles = await getModelProfiles();
    const loadedActiveId = await getActiveModelProfileId();

    setProfiles(loadedProfiles);
    setActiveId(loadedActiveId || loadedProfiles[0]?.id || "");

    if (!selectedId && loadedProfiles[0]) {
      setSelectedId(loadedProfiles[0].id);
      setDraft(loadedProfiles[0]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function selectProfile(profile: ModelProfile) {
    setSelectedId(profile.id);
    setDraft(profile);
  }

  async function newFromCurrent() {
    const current = await makeProfileFromCurrentSettings();

    setSelectedId("");
    setDraft({
      ...current,
      id: "",
      name: "New model profile",
    });

    setLog("New profile loaded from current server settings.");
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      setLog("Profile name is required.");
      return;
    }

    if (!draft.server_path.trim() || !draft.model_path.trim()) {
      setLog("Server path and model path are required.");
      return;
    }

    if (draft.id) {
      await updateModelProfile(draft);
      setLog("Profile updated.");
    } else {
      const { id: _id, ...profileWithoutId } = draft;
      const created = await createModelProfile(profileWithoutId);
      setSelectedId(created.id);
      setDraft(created);
      setLog("Profile created.");
    }

    await load();
  }

  async function activateSelected(restartServer: boolean) {
    if (!draft.id) {
      setLog("Save the profile first.");
      return;
    }

    await activateModelProfile(draft.id, restartServer);
    setActiveId(draft.id);
    setLog(restartServer ? "Profile activated and server restarted." : "Profile activated.");
    await load();
  }

  async function removeSelected() {
    if (!draft.id) return;

    await deleteModelProfile(draft.id);
    setSelectedId("");
    setDraft(emptyProfile);
    setLog("Profile deleted.");
    await load();
  }

  return (
    <TaskLayout>
      <div className="split-workspace">
        <div className="panel">
          <div className="panel-header">
            <h2>Model profiles</h2>
          </div>

          <button className="primary-button" onClick={newFromCurrent}>
            New from current settings
          </button>

          <div className="prompt-list">
            {profiles.map((profile) => (
              <button
                type="button"
                key={profile.id}
                className={
                  profile.id === selectedId
                    ? "prompt-list-item active"
                    : "prompt-list-item"
                }
                onClick={() => selectProfile(profile)}
              >
                <strong>
                  {profile.name}
                  {profile.id === activeId ? "  ● active" : ""}
                </strong>
                <span>
                  {profile.purpose} · {profile.host}:{profile.port}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel wide-panel">
          <div className="panel-header">
            <h2>{selectedProfile ? "Edit profile" : "New profile"}</h2>
          </div>

          <div className="settings-two-cols">
            <label className="field-label">
              Name
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </label>

            <label className="field-label">
              Purpose
              <select
                value={draft.purpose}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    purpose: event.target.value as ModelProfile["purpose"],
                  }))
                }
              >
                {purposes.map((purpose) => (
                  <option key={purpose}>{purpose}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field-label">
            llama-server path
            <input
              value={draft.server_path}
              placeholder="/path/to/llama-server"
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, server_path: event.target.value }))
              }
            />
          </label>

          <label className="field-label">
            GGUF model path
            <input
              value={draft.model_path}
              placeholder="/path/to/model.gguf"
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, model_path: event.target.value }))
              }
            />
          </label>

          <div className="settings-two-cols">
            <label className="field-label">
              Host
              <input
                value={draft.host}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, host: event.target.value }))
                }
              />
            </label>

            <label className="field-label">
              Port
              <input
                type="number"
                value={draft.port}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, port: Number(event.target.value) }))
                }
              />
            </label>
          </div>

          <div className="settings-two-cols">
            <label className="field-label">
              Context size
              <input
                type="number"
                value={draft.context_size}
                onChange={(event) =>
                  setDraft((prev) => ({
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
                value={draft.gpu_layers}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    gpu_layers: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>

          <div className="settings-two-cols">
            <label className="field-label">
              Temperature
              <input
                type="number"
                step="0.1"
                value={draft.temperature}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    temperature: Number(event.target.value),
                  }))
                }
              />
            </label>

            <label className="field-label">
              Max tokens
              <input
                type="number"
                value={draft.max_tokens}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    max_tokens: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>

          <label className="field-label checkbox-label">
            <span>Enable embeddings</span>
            <input
              type="checkbox"
              checked={draft.embedding_enabled}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  embedding_enabled: event.target.checked,
                }))
              }
            />
          </label>

          <div className="button-row">
            <button className="primary-button" onClick={saveDraft}>
              Save profile
            </button>

            <button className="secondary-button" onClick={() => activateSelected(false)}>
              Activate
            </button>

            <button className="secondary-button" onClick={() => activateSelected(true)}>
              Activate + restart
            </button>

            <button className="danger-button" onClick={removeSelected} disabled={!draft.id}>
              Delete
            </button>
          </div>

          <div className="terminal-box">{log}</div>
        </div>
      </div>
    </TaskLayout>
  );
}
