import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";

let registered = false;

export async function registerLocalMateShortcut() {
  if (registered) return;

  try {
    await unregisterAll();

    await register("CommandOrControl+Shift+Space", async () => {
      const window = getCurrentWindow();
      const visible = await window.isVisible();

      if (visible) {
        await window.hide();
      } else {
        await window.show();
        await window.setFocus();
      }
    });

    registered = true;
  } catch (error) {
    console.warn("Could not register LocalMate shortcut", error);
  }
}
