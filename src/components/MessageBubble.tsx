type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
};

export function MessageBubble({ role, content }: MessageBubbleProps) {
  return (
    <div className={role === "user" ? "message user" : "message assistant"}>
      <div className="message-role">{role === "user" ? "You" : "LocalMate"}</div>
      <div className="message-content">{content}</div>
    </div>
  );
}
