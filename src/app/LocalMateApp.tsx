import { useEffect, useState } from "react";
import { Sidebar, ViewKey } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { ChatView } from "../components/views/ChatView";
import { WriteView } from "../components/views/WriteView";
import { CodeView } from "../components/views/CodeView";
import { FilesView } from "../components/views/FilesView";
import { MeetingsView } from "../components/views/MeetingsView";
import { AutomationsView } from "../components/views/AutomationsView";
import { SettingsView } from "../components/views/SettingsView";
import { HomeView } from "../components/views/HomeView";
import { TranslatorView } from "../components/views/TranslatorView";
import { PromptsView } from "../components/views/PromptsView";
import { ModelProfilesView } from "../components/views/ModelProfilesView";
import { VoiceView } from "../components/views/VoiceView";
import { checkLlamaServer } from "../lib/llamaClient";
import { getAppSetting, setAppSetting } from "../lib/tauriCommands";
import { registerLocalMateShortcut } from "../lib/globalShortcut";

export type ThemeKey = "hacker" | "black" | "white" | "midnight" | "purple";

const viewTitles: Record<ViewKey, { title: string; subtitle: string }> = {
  home: {
    title: "Home",
    subtitle: "Your private local AI assistant for laptop work.",
  },
  chat: {
    title: "Chat",
    subtitle: "Talk to your local llama.cpp model.",
  },
  files: {
    title: "Files",
    subtitle: "Index PDFs, DOCX, text files, and folders.",
  },
  write: {
    title: "Write",
    subtitle: "Draft, rewrite, shorten, expand, and polish text locally.",
  },
  code: {
    title: "Code",
    subtitle: "Explain code, debug errors, and generate snippets.",
  },
  meetings: {
    title: "Meetings",
    subtitle: "Turn notes into summaries and action items.",
  },
  automations: {
    title: "Automations",
    subtitle: "Preview safe laptop tasks before applying them.",
  },
  translator: {
    title: "Translator",
    subtitle: "Translate text locally while preserving meaning and tone.",
  },
  prompts: {
    title: "Prompts",
    subtitle: "Create, edit, search, import, and export reusable prompts.",
  },
  models: {
    title: "Model Profiles",
    subtitle: "Create, activate, and restart different local GGUF model profiles.",
  },
  voice: {
    title: "Voice Notes",
    subtitle: "Dictate, clean, summarize, and extract action items from notes.",
  },
  settings: {
    title: "Settings",
    subtitle: "Themes, model runtime, server profile, and local storage.",
  },
};

export function LocalMateApp() {
  const [activeView, setActiveView] = useState<ViewKey>("chat");
  const [serverOnline, setServerOnline] = useState(false);
  const [theme, setThemeState] = useState<ThemeKey>("hacker");

  async function refreshServerStatus() {
    const online = await checkLlamaServer();
    setServerOnline(online);
  }

  async function setTheme(nextTheme: ThemeKey) {
    setThemeState(nextTheme);
    await setAppSetting("theme", nextTheme);
  }

  useEffect(() => {
    refreshServerStatus();
    registerLocalMateShortcut();

    getAppSetting("theme").then((savedTheme) => {
      if (
        savedTheme === "hacker" ||
        savedTheme === "black" ||
        savedTheme === "white" ||
        savedTheme === "midnight" ||
        savedTheme === "purple"
      ) {
        setThemeState(savedTheme);
      }
    });

    const interval = window.setInterval(() => {
      refreshServerStatus();
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  function renderView() {
    switch (activeView) {
      case "home":
        return <HomeView setActiveView={setActiveView} />;
      case "chat":
        return <ChatView serverOnline={serverOnline} />;
      case "files":
        return <FilesView serverOnline={serverOnline} />;
      case "write":
        return <WriteView serverOnline={serverOnline} />;
      case "code":
        return <CodeView serverOnline={serverOnline} />;
      case "meetings":
        return <MeetingsView serverOnline={serverOnline} />;
      case "automations":
        return <AutomationsView serverOnline={serverOnline} />;
      case "translator":
        return <TranslatorView serverOnline={serverOnline} />;
      case "prompts":
        return <PromptsView />;
      case "models":
        return <ModelProfilesView />;
      case "voice":
        return <VoiceView serverOnline={serverOnline} />;
      case "settings":
        return (
          <SettingsView
            serverOnline={serverOnline}
            onRefresh={refreshServerStatus}
            theme={theme}
            setTheme={setTheme}
          />
        );
      default:
        return <ChatView serverOnline={serverOnline} />;
    }
  }

  return (
    <div className={`localmate-root theme-${theme}`}>
      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      <main className="localmate-main">
        <TopBar
          title={viewTitles[activeView].title}
          subtitle={viewTitles[activeView].subtitle}
          serverOnline={serverOnline}
          onRefresh={refreshServerStatus}
        />
        {renderView()}
      </main>
    </div>
  );
}
