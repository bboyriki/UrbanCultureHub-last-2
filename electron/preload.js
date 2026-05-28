'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uch', {
  getSettings:     ()        => ipcRenderer.invoke('settings:get'),
  saveSettings:    (p)       => ipcRenderer.invoke('settings:set', p),
  browseDir:       ()        => ipcRenderer.invoke('settings:browse'),
  getFileTree:     ()        => ipcRenderer.invoke('files:tree'),
  readFile:        (p)       => ipcRenderer.invoke('files:read', p),
  writeFile:       (p, c)    => ipcRenderer.invoke('files:write', p, c),
  startServer:     ()        => ipcRenderer.invoke('server:start'),
  stopServer:      ()        => ipcRenderer.invoke('server:stop'),
  getServerStatus: ()        => ipcRenderer.invoke('server:status'),
  getLogs:         ()        => ipcRenderer.invoke('server:logs'),
  gitStatus:       ()        => ipcRenderer.invoke('git:status'),
  gitPush:         (msg)     => ipcRenderer.invoke('git:push', msg),
  claudeChat:      (payload) => ipcRenderer.invoke('claude:chat', payload),
  npmInstall:      ()        => ipcRenderer.invoke('npm:install'),
  openExternal:    (url)     => ipcRenderer.invoke('shell:open', url),
  openPath:        (p)       => ipcRenderer.invoke('shell:open-path', p),
  getVersion:      ()        => ipcRenderer.invoke('app:version'),
  onLog:           (cb)      => ipcRenderer.on('log:line',       (_, e) => cb(e)),
  onServerStopped: (cb)      => ipcRenderer.on('server:stopped', ()    => cb()),
  offAllEvents:    ()        => {
    ipcRenderer.removeAllListeners('log:line');
    ipcRenderer.removeAllListeners('server:stopped');
  },
});
