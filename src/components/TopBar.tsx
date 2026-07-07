import { RefreshCw } from "lucide-react";
import { StatusPill } from "./StatusPill";

type TopBarProps = {
  title: string;
  subtitle: string;
  serverOnline: boolean;
  onRefresh: () => void;
};

export function TopBar({
  title,
  subtitle,
  serverOnline,
  onRefresh,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="topbar-actions">
        <StatusPill online={serverOnline} />

        <button className="icon-button" onClick={onRefresh}>
          <RefreshCw size={17} />
        </button>
      </div>
    </header>
  );
}
