// MelLite Electron Main Process
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'MelLite - Professional Photo Development Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open Image...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.executeJavaScript('triggerOpen()') },
        { label: 'Export PNG...', accelerator: 'CmdOrCtrl+Shift+E', click: () => mainWindow.webContents.executeJavaScript('exportPng()') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Develop',
      submenu: [
        { label: 'Exposure', click: () => mainWindow.webContents.executeJavaScript('applyAdjustments()') },
        { label: 'Contrast', click: () => mainWindow.webContents.executeJavaScript('applyAdjustments()') },
        { label: 'Saturation', click: () => mainWindow.webContents.executeJavaScript('applyAdjustments()') },
        { type: 'separator' },
        { label: 'Reset Adjustments', click: () => mainWindow.webContents.executeJavaScript('resetAdjustments()') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Developer Tools', role: 'toggleDevTools' },
        { label: 'Toggle Full Screen', role: 'togglefullscreen' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
