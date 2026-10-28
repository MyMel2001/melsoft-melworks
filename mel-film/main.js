// MelFilm Electron Main Process
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'MelFilm - Professional Video Editing Studio',
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
        { label: 'Open Video...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.executeJavaScript('triggerOpen()') },
        { label: 'Export Render...', accelerator: 'CmdOrCtrl+Shift+E', click: () => mainWindow.webContents.executeJavaScript('exportVideo()') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Render',
      submenu: [
        { label: 'Capture Poster Frame', click: () => mainWindow.webContents.executeJavaScript('capturePoster()') },
        { label: 'Export to MP4 (H.264)', click: () => mainWindow.webContents.executeJavaScript('exportVideo()') }
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
