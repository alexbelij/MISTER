/**
 * MISTER — Electron Main Process
 * 
 * Wraps the UI and connects it to the QVAC backend scripts.
 * Run: npx electron main.js
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'MISTER — Club Brain'
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

// --- IPC Handlers ---

// Load files dialog
ipcMain.handle('load-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Club Materials', extensions: ['json', 'txt', 'csv', 'pdf'] }
    ]
  });
  return result.filePaths || [];
});

// Start training (runs finetune.js)
ipcMain.handle('start-training', async (event, { epochs }) => {
  const proc = spawn('node', [
    'src/finetune/finetune.js',
    `--epochs=${epochs || 3}`
  ], { cwd: __dirname });

  proc.stdout.on('data', (data) => {
    event.sender.send('training-progress', data.toString());
  });

  proc.stderr.on('data', (data) => {
    event.sender.send('training-progress', data.toString());
  });

  return new Promise((resolve) => {
    proc.on('close', (code) => {
      resolve({ success: code === 0, code });
    });
  });
});

// Run eval (runs eval_harness.js)
ipcMain.handle('run-eval', async (event, { adapter }) => {
  const args = ['src/eval/eval_harness.js'];
  if (adapter) args.push(`--adapter=${adapter}`);
  
  const proc = spawn('node', args, { cwd: __dirname });

  proc.stdout.on('data', (data) => {
    event.sender.send('eval-progress', data.toString());
  });

  return new Promise((resolve) => {
    proc.on('close', (code) => {
      resolve({ success: code === 0, code });
    });
  });
});

// Chat (runs inference/chat.js in interactive mode)
let chatProc = null;
ipcMain.handle('chat-send', async (event, { message, adapter }) => {
  // For now, spawn a one-shot completion
  // In production, keep a persistent process or use QVAC SDK directly
  const args = ['src/inference/chat.js'];
  if (adapter) args.push(`--adapter=${adapter}`);
  
  // Simplified: run the script with the message piped to stdin
  const proc = spawn('node', args, { cwd: __dirname });
  proc.stdin.write(message + '\n');
  proc.stdin.end();

  let output = '';
  proc.stdout.on('data', (data) => { output += data.toString(); });
  proc.stderr.on('data', (data) => { /* logs */ });

  return new Promise((resolve) => {
    proc.on('close', () => resolve({ response: output }));
  });
});

// Prepare data (runs prepare_data.js)
ipcMain.handle('prepare-data', async (event) => {
  const proc = spawn('node', ['src/pipeline/prepare_data.js'], { cwd: __dirname });
  
  proc.stdout.on('data', (data) => {
    event.sender.send('prepare-progress', data.toString());
  });

  return new Promise((resolve) => {
    proc.on('close', (code) => resolve({ success: code === 0 }));
  });
});

// Distribute adapter (runs distribute.js)
ipcMain.handle('distribute', async (event, { adapter }) => {
  const proc = spawn('node', ['src/pears/distribute.js', `--adapter=${adapter}`], { cwd: __dirname });
  
  let output = '';
  proc.stdout.on('data', (data) => { output += data.toString(); });

  return new Promise((resolve) => {
    proc.on('close', () => resolve({ output }));
  });
});

// --- App lifecycle ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
