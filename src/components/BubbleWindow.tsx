import { dragBubbleWindow, openMainFromBubble } from "../lib/windowMode";

export function BubbleWindow() {
  return (
    <main className="bubble-window">
      <div
        className="bubble-drag-handle"
        title="Drag LocalMate"
        onMouseDown={(event) => {
          if (event.button === 0) {
            event.preventDefault();
            dragBubbleWindow();
          }
        }}
      >
        <div className="bubble-hanger-ring" />

        <div className="bubble-hanger-bar" aria-label="Drag LocalMate">
          <span className="bubble-grip-dot" />
          <span className="bubble-grip-dot" />
          <span className="bubble-grip-dot" />
        </div>
      </div>

      <button
        type="button"
        className="robot-bubble"
        title="Open LocalMate"
        onClick={openMainFromBubble}
      >
        <div className="robot-face">
          <div className="robot-eye left" />
          <div className="robot-eye right" />
          <div className="robot-mouth" />
        </div>
      </button>
    </main>
  );
}
