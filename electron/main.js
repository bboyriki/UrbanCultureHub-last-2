'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path   = require('path');
const fs     = require('fs');
const https  = require('https');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const os     = require('os');

const execAsync  = promisify(exec);
const DEFAULT_DIR = 'C:\\Users\\rikim\\Documents\\GitHub\\UrbanCultureHub-last-2';

// ── Settings ──────────────────────────────────────────────────────────────────
const settingsPath = () => path.join(os.homedir(), '.uch-control-panel.json');
const readSettings = () => { try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')); } catch { return {}; } };
const writeSettings = p  => { const s = { ...readSettings(), ...p }; fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2)); return s; };
const getSetting = (k, fb = '') => readSettings()[k] ?? fb;

// ── State ─────────────────────────────────────────────────────────────────────
let mainWindow = null;
let serverProc = null;
const LOG_MAX  = 800;
const logBuf   = [];

const pushLog = (line, type = 'info') => {
  const e = { ts: new Date().toISOString(), line: String(line), type };
  logBuf.push(e); if (logBuf.length > LOG_MAX) logBuf.shift();
  mainWindow?.webContents.send('log:line', e);
};

// ── File tree ─────────────────────────────────────────────────────────────────
const IGNORE = new Set(['node_modules','.git','dist','out','.next','__pycache__',
  'attached_assets','.DS_Store','coverage','.turbo']);

function buildTree(dir, depth) {
  depth = depth || 0;
  if (depth > 5) return [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter(e => !IGNORE.has(e.name) && !e.name.startsWith('.'))
    .map(e => {
      const full = path.join(dir, e.name);
      return e.isDirectory()
        ? { name: e.name, type: 'dir',  path: full, children: buildTree(full, depth + 1) }
        : { name: e.name, type: 'file', path: full };
    })
    .sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1);
}

// ── Claude API ────────────────────────────────────────────────────────────────
function callClaude(apiKey, system, messages) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system,
      messages,
    }));
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Content-Length':    payload.length,
        'anthropic-version': '2023-06-01',
        'x-api-key':         apiKey,
      },
    }, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end',  () => {
        try {
          const j = JSON.parse(raw);
          if (j.error) reject(new Error(j.error.message));
          else resolve(j.content[0].text);
        } catch(e) { reject(new Error('Parse error: ' + raw.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500, height: 920, minWidth: 1024, minHeight: 640,
    backgroundColor: '#1e1e2e',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#181825', symbolColor: '#cdd6f4', height: 32 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      webviewTag: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'app.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
  Menu.setApplicationMenu(null);

  // Auto-open DevTools for debugging — remove once working
  mainWindow.webContents.openDevTools({ mode: 'bottom' });

  // Dev tools: Ctrl+Shift+I or F12
  mainWindow.webContents.on('before-input-event', (_, input) => {
    if ((input.control && input.shift && input.key === 'I') || input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

// ── IPC: Settings ─────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => {
  try {
    const s = {
      projectDir:   getSetting('projectDir',   DEFAULT_DIR),
      railwayUrl:   getSetting('railwayUrl',   'https://railway.app'),
      githubRepo:   getSetting('githubRepo',   'https://github.com/bboyriki/UrbanCultureHub-last-2'),
      anthropicKey: getSetting('anthropicKey', ''),
    };
    console.log('[settings:get] OK — projectDir:', s.projectDir);
    return s;
  } catch(e) {
    console.error('[settings:get] ERROR:', e);
    return { projectDir: DEFAULT_DIR, railwayUrl: '', githubRepo: '', anthropicKey: '' };
  }
});

ipcMain.handle('settings:set', (_, p) => { try { writeSettings(p); return { ok: true }; } catch(e) { return { ok: false, error: e.message }; } });

ipcMain.handle('settings:browse', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: getSetting('projectDir', DEFAULT_DIR),
    title: 'Select project folder',
  });
  if (!r.canceled && r.filePaths.length) { writeSettings({ projectDir: r.filePaths[0] }); return r.filePaths[0]; }
  return null;
});

// ── IPC: Files ────────────────────────────────────────────────────────────────
ipcMain.handle('files:tree', () => {
  try {
    const dir = getSetting('projectDir', DEFAULT_DIR);
    console.log('[files:tree] dir:', dir, '| exists:', fs.existsSync(dir));
    const result = buildTree(dir);
    console.log('[files:tree] items:', result.length);
    return result;
  } catch(e) {
    console.error('[files:tree] ERROR:', e);
    return [];
  }
});

ipcMain.handle('files:read',  (_, p)    => { try { return { ok: true, content: fs.readFileSync(p, 'utf-8') }; } catch(e) { return { ok: false, error: e.message }; } });
ipcMain.handle('files:write', (_, p, c) => { try { fs.writeFileSync(p, c, 'utf-8'); return { ok: true }; } catch(e) { return { ok: false, error: e.message }; } });

// ── IPC: Server ───────────────────────────────────────────────────────────────
ipcMain.handle('server:start', () => {
  if (serverProc) return { ok: false, error: 'Already running' };
  const dir = getSetting('projectDir', DEFAULT_DIR);
  pushLog('▶ Starting dev server in: ' + dir, 'info');
  if (!dir || !fs.existsSync(dir)) {
    pushLog('ERROR: project dir not found: ' + dir, 'stderr');
    return { ok: false, error: 'Project dir not found: ' + dir };
  }
  // Run tsx directly — bypasses the predev script which uses pkill/sleep (Unix-only)
  // tsx.cmd is used on Windows; tsx on Linux/Mac
  const tsxBin = path.join(dir, 'node_modules', '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const hasTsx = fs.existsSync(tsxBin);
  pushLog((hasTsx ? '▶ tsx ' : '▶ npm run dev ') + 'in: ' + dir, 'info');

  if (hasTsx) {
    serverProc = spawn(tsxBin, ['server/index.ts'], {
      cwd: dir,
      env: { ...process.env, NODE_ENV: 'development' },
      windowsHide: true,
    });
  } else {
    // Fallback: npm run dev (may fail on Windows if predev uses Unix commands)
    serverProc = spawn('npm', ['run', 'dev'], {
      cwd: dir,
      env: { ...process.env, NODE_ENV: 'development' },
      windowsHide: true,
      shell: true,
    });
  }
  serverProc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => pushLog(l, 'stdout')));
  serverProc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => pushLog(l, 'stderr')));
  serverProc.on('exit',  c   => { pushLog('Server exited (' + c + ')', 'info'); serverProc = null; mainWindow?.webContents.send('server:stopped'); });
  serverProc.on('error', err => { pushLog('Error: ' + err.message, 'stderr'); serverProc = null; mainWindow?.webContents.send('server:stopped'); });
  return { ok: true };
});

ipcMain.handle('server:stop', () => {
  if (!serverProc) return { ok: false, error: 'Not running' };
  exec('taskkill /pid ' + serverProc.pid + ' /f /t', () => {});
  serverProc = null;
  pushLog('⏹ Server stopped', 'info');
  return { ok: true };
});

ipcMain.handle('server:status', () => ({ running: serverProc !== null }));
ipcMain.handle('server:logs',   () => logBuf.slice());

// ── IPC: Git ──────────────────────────────────────────────────────────────────
ipcMain.handle('git:status', async () => {
  const dir = getSetting('projectDir', DEFAULT_DIR);
  try {
    const [a, b, c] = await Promise.all([
      execAsync('git status --short',        { cwd: dir }),
      execAsync('git branch --show-current', { cwd: dir }),
      execAsync('git log --oneline -6',      { cwd: dir }),
    ]);
    return { ok: true, branch: b.stdout.trim(), changes: a.stdout.trim(), recentCommits: c.stdout.trim().split('\n').filter(Boolean) };
  } catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('git:push', async (_, msg) => {
  const dir = getSetting('projectDir', DEFAULT_DIR);
  try {
    pushLog('git add -A ...', 'git');
    await execAsync('git add -A', { cwd: dir });
    pushLog('git commit -m "' + msg + '"', 'git');
    const co = await execAsync('git commit -m "' + msg.replace(/"/g, '\\"') + '"', { cwd: dir });
    pushLog(co.stdout.trim() || '(nothing to commit)', 'git');
    pushLog('git push origin main ...', 'git');
    const po = await execAsync('git push origin main', { cwd: dir });
    pushLog(po.stdout.trim() || 'Pushed successfully.', 'git');
    return { ok: true };
  } catch(e) {
    pushLog('Git error: ' + e.message, 'stderr');
    return { ok: false, error: e.message };
  }
});

// ── IPC: Claude ───────────────────────────────────────────────────────────────
ipcMain.handle('claude:chat', async (_, payload) => {
  const messages = payload.messages;
  const fileCtx  = payload.fileCtx;
  const logCtx   = payload.logCtx;
  const key = getSetting('anthropicKey', '');
  if (!key) return { ok: false, error: 'No Anthropic API key. Click Settings to add it.' };

  const parts = [
    'You are Claude, an expert AI coding assistant embedded in UCH Control Panel.',
    'Project: UrbanCultureHub — a TypeScript/React/Express platform for urban cultural events (Netherlands).',
    'Stack: React + Vite, Express + TypeScript, PostgreSQL (Neon), Firebase Auth, deployed on Railway via Docker.',
    'Be concise and practical. Always use fenced code blocks for code suggestions.',
  ];
  if (fileCtx && fileCtx.name) {
    const preview = (fileCtx.content || '').slice(0, 5000);
    parts.push('\nCurrently open file: **' + fileCtx.name + '**\n```\n' + preview + '\n```');
  }
  if (logCtx && logCtx.length) {
    parts.push('\nRecent server output:\n```\n' + logCtx.slice(-15).map(l => l.line).join('\n') + '\n```');
  }

  try {
    const text = await callClaude(key, parts.join('\n\n'), messages);
    return { ok: true, text };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

// ── IPC: npm install ─────────────────────────────────────────────────────────
ipcMain.handle('npm:install', () => {
  const dir = getSetting('projectDir', DEFAULT_DIR);
  if (!fs.existsSync(dir)) return { ok: false, error: 'Project dir not found' };
  pushLog('📦 Running npm install in: ' + dir, 'info');
  return new Promise(resolve => {
    const proc = spawn('npm', ['install', '--legacy-peer-deps'], {
      cwd: dir,
      env: { ...process.env },
      windowsHide: true,
      shell: true,
    });
    proc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => pushLog(l, 'stdout')));
    proc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => pushLog(l, 'stderr')));
    proc.on('exit', code => {
      if (code === 0) { pushLog('✓ npm install complete', 'info'); resolve({ ok: true }); }
      else { pushLog('npm install failed (exit ' + code + ')', 'stderr'); resolve({ ok: false, error: 'Exit code ' + code }); }
    });
    proc.on('error', err => { pushLog('npm install error: ' + err.message, 'stderr'); resolve({ ok: false, error: err.message }); });
  });
});

// ── IPC: Shell ────────────────────────────────────────────────────────────────
ipcMain.handle('shell:open',      (_, url) => { shell.openExternal(url); return { ok: true }; });
ipcMain.handle('shell:open-path', (_, p)   => { shell.openPath(p);       return { ok: true }; });
ipcMain.handle('app:version',     ()       => app.getVersion());

// ── Lifecycle ─────────────────────────────────────────────────────────────────
const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(() => {
    if (!getSetting('projectDir')) writeSettings({ projectDir: DEFAULT_DIR });
    createWindow();
  });
  app.on('window-all-closed', () => {
    if (serverProc) exec('taskkill /pid ' + serverProc.pid + ' /f /t', () => {});
    app.quit();
  });
  app.on('activate', () => { if (!mainWindow) createWindow(); });
}
