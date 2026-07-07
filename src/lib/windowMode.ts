import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function isBubbleWindow() {
  return new URLSearchParams(window.location.search).get("window") === "bubble";
}

export async function openMainFromBubble() {
  try {
    await invoke("show_main_window");
  } catch (error) {
    console.error("Could not open main window from bubble", error);
  }
}

export async function dragBubbleWindow() {
  try {
    await getCurrentWindow().startDragging();
  } catch (error) {
    console.error("Could not drag bubble window", error);
  }
}
