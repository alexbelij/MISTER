/**
 * MISTER — Electron Preload Script
 * Exposes safe IPC bridge to the renderer (UI)
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mister', {
  loadFiles: () => ipcRenderer.invoke('load-files'),
  prepareData: (callback) => {
    ipcRenderer.on('prepare-progress', (_, data) => callback(data));
    return ipcRenderer.invoke('prepare-data');
  },
  startTraining: (opts, onProgress) => {
    ipcRenderer.on('training-progress', (_, data) => onProgress(data));
    return ipcRenderer.invoke('start-training', opts);
  },
  runEval: (opts, onProgress) => {
    ipcRenderer.on('eval-progress', (_, data) => onProgress(data));
    return ipcRenderer.invoke('run-eval', opts);
  },
  chatSend: (opts) => ipcRenderer.invoke('chat-send', opts),
  distribute: (opts) => ipcRenderer.invoke('distribute', opts),
});
