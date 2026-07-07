type StatusPillProps = {
  online: boolean;
};

export function StatusPill({ online }: StatusPillProps) {
  return (
    <div className={online ? "status-pill online" : "status-pill offline"}>
      <span className="status-dot" />
      {online ? "Local model connected" : "Model offline"}
    </div>
  );
}
