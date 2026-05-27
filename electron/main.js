/**
 * UCH Control Center — Electron main process
 *
 * Architecture:
 *   • BrowserWindow loads the Railway-deployed Control Center URL
 *   • System tray with error badge + quick-link menu
 *   • First-run setup wizard (setup.html) if no URL is configured
 *   • Auto-launch at Windows startup (user toggle)
 *   • Polls /api/admin/control-center/status every 60 s for error count
 *   • Native Windows notifications when new errors are detected
 *
 * Security:
 *   • contextIsolation: true, nodeIntegration: false, sandbox: true
 *   • Only the Railway URL (user's own server) is ever loaded
 *   • IPC via preload.js contextBridge (no direct Node access in renderer)
 */

"use strict";

const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  shell, ipcMain, Notification, session, dialog,
} = require("electron");
const path = require("path");

// electron-store v8 is ESM — use dynamic import with compatibility shim
let store;
async function getStore() {
  if (store) return store;
  // electron-store ≥ 9 is ESM; v8 works with require if we load it carefully
  try {
    const Store = require("electron-store");
    store = new Store({
      name: "uch-config",
      defaults: {
        railwayUrl: "",
        minimizeToTray: true,
        launchAtStartup: false,
        windowBounds: { width: 1440, height: 900 },
      },
    });
  } catch {
    // Fallback: simple in-memory store
    const data = {};
    store = {
      get: (k, d) => (k in data ? data[k] : d),
      set: (k, v) => { data[k] = v; },
    };
  }
  return store;
}

// ── Globals ───────────────────────────────────────────────────────────────────
let mainWindow = null;
let settingsWindow = null;
let tray = null;
let pollTimer = null;
let lastErrorCount = 0;
let isQuitting = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildTrayMenu(url, errorCount = 0) {
  const errLabel = errorCount > 0
    ? `⚠️  ${errorCount} server error${errorCount > 1 ? "s" : ""}`
    : "✅  No errors";

  return Menu.buildFromTemplate([
    { label: "⚡  UCH Control Center", enabled: false },
    { type: "separator" },
    {
      label: "Open Control Center",
      accelerator: "CmdOrCtrl+Shift+C",
      click: showMain,
    },
    {
      label: "Security Center",
      click: () => shell.openExternal(url + "/admin/security-center"),
    },
    {
      label: "Admin Dashboard",
      click: () => shell.openExternal(url + "/admin/overview"),
    },
    {
      label: "Open in Browser",
      click: () => shell.openExternal(url + "/admin/control-center"),
    },
    { type: "separator" },
    { label: errLabel, enabled: false },
    { type: "separator" },
    { label: "Settings…", click: openSettings },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function showMain() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

// ── Main window ───────────────────────────────────────────────────────────────
async function createMainWindow(url) {
  const cfg = await getStore();
  const bounds = cfg.get("windowBounds", { width: 1440, height: 900 });

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0a0f",
    // Windows 11 native title bar with custom colours
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#111118",
      symbolColor: "#9ca3af",
      height: 32,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Allow the Railway URL to load (it's the user's own server)
      webSecurity: true,
    },
    icon: path.join(__dirname, "assets", "icon.ico"),
    show: false,
  });

  // Save window size on resize
  mainWindow.on("resize", async () => {
    if (!mainWindow.isMaximized()) {
      const [width, height] = mainWindow.getSize();
      const s = await getStore();
      s.set("windowBounds", { width, height });
    }
  });

  // Minimize to tray instead of closing (if configured)
  mainWindow.on("close", async (e) => {
    if (isQuitting) return;
    const s = await getStore();
    if (s.get("minimizeToTray", true)) {
      e.preventDefault();
      mainWindow.hide();
      if (tray) {
        tray.displayBalloon?.({
          title: "UCH Control Center",
          content: "Still running in the system tray. Right-click the icon to quit.",
          noSound: true,
          respectQuietTime: true,
        });
      }
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });

  // Show when ready (avoids white flash)
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Open external links in the default browser, not a new Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url: href }) => {
    shell.openExternal(href);
    return { action: "deny" };
  });

  // Dev tools shortcut (F12)
  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.key === "F12") mainWindow.webContents.toggleDevTools();
  });

  await mainWindow.loadURL(url + "/admin/control-center");
}

// ── Settings window ───────────────────────────────────────────────────────────
function openSettings() {
  if (settingsWindow) { settingsWindow.focus(); return; }

  settingsWindow = new BrowserWindow({
    width: 520,
    height: 480,
    resizable: false,
    backgroundColor: "#111118",
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#111118", symbolColor: "#9ca3af", height: 32 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, "assets", "icon.ico"),
    parent: mainWindow || undefined,
    modal: false,
  });

  settingsWindow.loadFile(path.join(__dirname, "setup.html"));
  settingsWindow.on("closed", () => { settingsWindow = null; });
}

// ── System tray ───────────────────────────────────────────────────────────────
async function createTray(url) {
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error("icon empty");
  } catch {
    // Fallback: 16×16 purple square
    icon = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAADNJREFUOI1j" +
      "YBgFgx8wMjD8Z2BgYGBiIFMzIyMjAxMDmcbIyMjAxECmZmRkZGBiIFMDAFAqAAEo3YSNAAAAAElFTkSuQmCC"
    );
  }

  tray = new Tray(icon);
  tray.setToolTip("UCH Control Center");
  tray.setContextMenu(buildTrayMenu(url, 0));

  tray.on("double-click", showMain);

  // Poll for error count
  pollTimer = setInterval(() => pollStatus(url), 60_000);
}

async function pollStatus(url) {
  try {
    // We use the main window's session which already has the admin login cookie
    const cookies = await session.defaultSession.cookies.get({ url });
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const resp = await fetch(`${url}/api/admin/control-center/status`, {
      headers: { Cookie: cookieStr },
    });
    if (!resp.ok) return;

    const data = await resp.json();
    const errorCount = data.errorCount || 0;

    // Update tray menu
    const cfg = await getStore();
    const savedUrl = cfg.get("railwayUrl", url);
    tray.setContextMenu(buildTrayMenu(savedUrl, errorCount));

    // Notify on new errors
    if (errorCount > lastErrorCount && Notification.isSupported()) {
      new Notification({
        title: "UCH Control Center",
        body: `${errorCount} server error${errorCount > 1 ? "s" : ""} — click to review`,
        silent: true,
      }).show();
    }
    lastErrorCount = errorCount;
  } catch {
    // Server offline or not logged in — skip silently
  }
}

// ── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle("cc:get-settings", async () => {
  const cfg = await getStore();
  return {
    railwayUrl:      cfg.get("railwayUrl", ""),
    minimizeToTray:  cfg.get("minimizeToTray", true),
    launchAtStartup: cfg.get("launchAtStartup", false),
  };
});

ipcMain.handle("cc:save-settings", async (_e, settings) => {
  try {
    const cfg = await getStore();
    const url = (settings.railwayUrl || "").trim().replace(/\/$/, "");

    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      return { success: false, error: "URL must start with https://" };
    }

    cfg.set("railwayUrl", url);
    cfg.set("minimizeToTray", !!settings.minimizeToTray);
    cfg.set("launchAtStartup", !!settings.launchAtStartup);

    // Windows auto-launch
    app.setLoginItemSettings({
      openAtLogin: !!settings.launchAtStartup,
      path: process.execPath,
      args: ["--hidden"],
    });

    // Close settings, (re)open main with new URL
    if (settingsWindow) settingsWindow.close();

    if (mainWindow) {
      await mainWindow.loadURL(url + "/admin/control-center");
      mainWindow.show();
    } else {
      await createMainWindow(url);
    }

    // Recreate tray with new URL
    if (tray) {
      clearInterval(pollTimer);
      tray.destroy();
      tray = null;
    }
    await createTray(url);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("cc:open-external", (_e, url) => shell.openExternal(url));

ipcMain.handle("cc:get-version", () => app.getVersion());

ipcMain.handle("cc:reload", () => mainWindow?.reload());

ipcMain.handle("cc:show-main", showMain);

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Single instance lock
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on("second-instance", showMain);

  const cfg = await getStore();
  const url = cfg.get("railwayUrl", "");

  if (!url) {
    // First run — show setup wizard
    openSettings();
  } else {
    await createMainWindow(url);
    await createTray(url);

    // If launched with --hidden (from auto-start), stay in tray
    if (!process.argv.includes("--hidden")) {
      showMain();
    }
  }
});

app.on("window-all-closed", () => {
  // On Windows/Linux: keep running in tray if tray exists
  if (!tray) app.quit();
});

app.on("activate", showMain); // macOS dock click

app.on("before-quit", () => { isQuitting = true; });

// ── Startup args ─────────────────────────────────────────────────────────────
// Pass --hidden to start minimized to tray (used by auto-start)
if (process.argv.includes("--hidden") && app.isReady()) {
  mainWindow?.hide();
}
