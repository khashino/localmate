import {
  Bot,
  Boxes,
  Code2,
  FileText,
  Home,
  Languages,
  Library,
  Menu,
  Mic,
  PenLine,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useState } from "react";

export type ViewKey =
  | "home"
  | "chat"
  | "files"
  | "write"
  | "code"
  | "meetings"
  | "automations"
  | "translator"
  | "prompts"
  | "runtime"
  | "voice"
  | "settings";

type SidebarProps = {
  activeView: ViewKey;
  setActiveView: (view: ViewKey) => void;
};

const mainItems: {
  key: ViewKey;
  label: string;
  icon: typeof Home;
}[] = [
  { key: "chat", label: "Chat", icon: Bot },
  { key: "files", label: "Files", icon: FileText },
  { key: "runtime", label: "Run", icon: Boxes },
  { key: "voice", label: "Voice", icon: Mic },
];

const moreItems: {
  key: ViewKey;
  label: string;
  icon: typeof Home;
}[] = [
  { key: "write", label: "Write", icon: PenLine },
  { key: "code", label: "Code", icon: Code2 },
  { key: "translator", label: "Translate", icon: Languages },
  { key: "prompts", label: "Prompts", icon: Library },
  { key: "meetings", label: "Meetings", icon: Mic },
  { key: "automations", label: "Automations", icon: Workflow },
  { key: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeView, setActiveView }: SidebarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const activeMoreItem = moreItems.find((item) => item.key === activeView);

  function goTo(view: ViewKey) {
    setActiveView(view);
    setMoreOpen(false);
  }

  return (
    <aside className="sidebar simple-topbar">
      <div className="brand simple-brand">
        <div className="brand-mark">
          <Sparkles size={15} />
        </div>

        <div>
          <div className="brand-name">LocalMate</div>
        </div>
      </div>

      <nav className="nav simple-nav">
        {mainItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              className={
                activeView === item.key ? "nav-item active" : "nav-item"
              }
              onClick={() => goTo(item.key)}
            >
              <Icon size={14} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="more-nav-wrap">
          <button
            type="button"
            className={activeMoreItem ? "nav-item active" : "nav-item"}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <Menu size={14} />
            <span>{activeMoreItem ? activeMoreItem.label : "More"}</span>
          </button>

          {moreOpen && (
            <div className="more-menu">
              {moreItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    type="button"
                    key={item.key}
                    className={
                      activeView === item.key
                        ? "more-menu-item active"
                        : "more-menu-item"
                    }
                    onClick={() => goTo(item.key)}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
