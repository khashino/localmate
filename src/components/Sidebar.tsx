import {
  Bot,
  Code2,
  FileText,
  Home,
  Languages,
  Library,
  Mic,
  PenLine,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";

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
  | "settings";

type SidebarProps = {
  activeView: ViewKey;
  setActiveView: (view: ViewKey) => void;
};

const navItems: {
  key: ViewKey;
  label: string;
  icon: typeof Home;
}[] = [
  {
    key: "home",
    label: "Home",
    icon: Home,
  },
  {
    key: "chat",
    label: "Chat",
    icon: Bot,
  },
  {
    key: "files",
    label: "Files",
    icon: FileText,
  },
  {
    key: "write",
    label: "Write",
    icon: PenLine,
  },
  {
    key: "code",
    label: "Code",
    icon: Code2,
  },
  {
    key: "meetings",
    label: "Meetings",
    icon: Mic,
  },
  {
    key: "automations",
    label: "Auto",
    icon: Workflow,
  },
  {
    key: "translator",
    label: "Translate",
    icon: Languages,
  },
  {
    key: "prompts",
    label: "Prompts",
    icon: Library,
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
  },
];

export function Sidebar({ activeView, setActiveView }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Sparkles size={18} />
        </div>

        <div>
          <div className="brand-name">LocalMate</div>
          <div className="brand-subtitle">private local AI</div>
        </div>
      </div>

      <nav className="nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              className={
                activeView === item.key ? "nav-item active" : "nav-item"
              }
              onClick={() => setActiveView(item.key)}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
