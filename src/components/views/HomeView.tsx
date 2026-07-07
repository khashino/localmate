import { ViewKey } from "../Sidebar";
import { Bot, Code2, FileText, FolderCog, Mic2, PenLine } from "lucide-react";

type HomeViewProps = {
  setActiveView: (view: ViewKey) => void;
};

const cards: {
  title: string;
  description: string;
  view: ViewKey;
  icon: typeof Bot;
}[] = [
  {
    title: "Chat",
    description: "Ask your local model anything.",
    view: "chat",
    icon: Bot,
  },
  {
    title: "Write",
    description: "Rewrite, polish, shorten, or draft text.",
    view: "write",
    icon: PenLine,
  },
  {
    title: "Code",
    description: "Explain errors and improve code snippets.",
    view: "code",
    icon: Code2,
  },
  {
    title: "Files",
    description: "Summarize and ask questions about local text files.",
    view: "files",
    icon: FileText,
  },
  {
    title: "Meetings",
    description: "Create summaries, decisions, and action items.",
    view: "meetings",
    icon: Mic2,
  },
  {
    title: "Automations",
    description: "Preview safe laptop tasks before applying them.",
    view: "automations",
    icon: FolderCog,
  },
];

export function HomeView({ setActiveView }: HomeViewProps) {
  return (
    <section className="task-view">
      <div className="hero-card">
        <div>
          <p className="eyebrow">Local-first desktop assistant</p>
          <h2>Welcome to LocalMate</h2>
          <p>
            LocalMate runs on your laptop and connects to your local llama.cpp
            model. Use it for writing, code, files, notes, and safe laptop
            workflows.
          </p>
        </div>
      </div>

      <div className="card-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              className="feature-card"
              key={card.view}
              onClick={() => setActiveView(card.view)}
            >
              <Icon size={22} />
              <strong>{card.title}</strong>
              <span>{card.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
