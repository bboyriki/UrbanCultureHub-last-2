/**
 * Preload script — secure IPC bridge between renderer and main process.
 *
 * Only exposes the minimal API the renderer actually needs.
 * contextIsolation: true means this runs in a separate context from the
 * renderer page, so the Railway app code cannot access Node.js APIs at all.
 */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("uchDesktop", {
  /** Returns { railwayUrl, minimizeToTray, launchAtStartup } */
  getSettings: () => ipcRenderer.invoke("cc:get-settings"),

  /** Saves settings and (re)loads the main window with the new URL */
  saveSettings: (settings) => ipcRenderer.invoke("cc:save-settings", settings),

  /** Opens a URL in the default browser */
  openExternal: (url) => ipcRenderer.invoke("cc:open-external", url),

  /** Returns the current app version string */
  getVersion: () => ipcRenderer.invoke("cc:get-version"),

  /** Reloads the Control Center page */
  reload: () => ipcRenderer.invoke("cc:reload"),

  /** Brings the main window to the front */
  showMain: () => ipcRenderer.invoke("cc:show-main"),

  /** True when running inside the Electron wrapper */
  isDesktopApp: true,
});
