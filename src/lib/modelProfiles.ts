import {
  getAppSetting,
  getServerProfile,
  restartLocalServer,
  saveServerProfile,
  ServerProfile,
  setAppSetting,
} from "./tauriCommands";

export type ModelProfile = ServerProfile & {
  id: string;
  name: string;
  purpose: "Chat" | "Code" | "Write" | "Files" | "Translator" | "Embedding" | "General";
  temperature: number;
  max_tokens: number;
};

const MODEL_PROFILES_KEY = "model_profiles_json";
const ACTIVE_MODEL_PROFILE_KEY = "active_model_profile_id";

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getModelProfiles(): Promise<ModelProfile[]> {
  const json = await getAppSetting(MODEL_PROFILES_KEY);

  if (!json) {
    const current = await getServerProfile();

    const defaultProfile: ModelProfile = {
      id: makeId(),
      name: "Default local model",
      purpose: "General",
      temperature: 0.4,
      max_tokens: 512,
      ...current,
    };

    await saveModelProfiles([defaultProfile]);
    await setActiveModelProfileId(defaultProfile.id);

    return [defaultProfile];
  }

  try {
    const parsed = JSON.parse(json) as ModelProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveModelProfiles(profiles: ModelProfile[]) {
  await setAppSetting(MODEL_PROFILES_KEY, JSON.stringify(profiles, null, 2));
}

export async function getActiveModelProfileId() {
  return await getAppSetting(ACTIVE_MODEL_PROFILE_KEY);
}

export async function setActiveModelProfileId(id: string) {
  await setAppSetting(ACTIVE_MODEL_PROFILE_KEY, id);
}

export async function createModelProfile(
  profile: Omit<ModelProfile, "id">
): Promise<ModelProfile> {
  const profiles = await getModelProfiles();

  const newProfile: ModelProfile = {
    ...profile,
    id: makeId(),
  };

  await saveModelProfiles([...profiles, newProfile]);

  return newProfile;
}

export async function updateModelProfile(profile: ModelProfile) {
  const profiles = await getModelProfiles();

  await saveModelProfiles(
    profiles.map((item) => (item.id === profile.id ? profile : item))
  );
}

export async function deleteModelProfile(id: string) {
  const profiles = await getModelProfiles();
  const nextProfiles = profiles.filter((item) => item.id !== id);

  await saveModelProfiles(nextProfiles);

  const activeId = await getActiveModelProfileId();

  if (activeId === id) {
    await setActiveModelProfileId(nextProfiles[0]?.id ?? "");
  }
}

export async function activateModelProfile(id: string, restartServer = false) {
  const profiles = await getModelProfiles();
  const profile = profiles.find((item) => item.id === id);

  if (!profile) {
    throw new Error("Model profile not found.");
  }

  await saveServerProfile({
    server_path: profile.server_path,
    model_path: profile.model_path,
    host: profile.host,
    port: profile.port,
    context_size: profile.context_size,
    gpu_layers: profile.gpu_layers,
    embedding_enabled: profile.embedding_enabled,
  });

  await setActiveModelProfileId(profile.id);

  if (restartServer) {
    await restartLocalServer();
  }

  return profile;
}

export async function makeProfileFromCurrentSettings(): Promise<Omit<ModelProfile, "id">> {
  const current = await getServerProfile();

  return {
    ...current,
    name: "New model profile",
    purpose: "General",
    temperature: 0.4,
    max_tokens: 512,
  };
}
