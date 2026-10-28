// MelSound Electron Main Process
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'MelSound - Professional Music Production Studio',
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
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.executeJavaScript('newProject()') },
        { label: 'Open Project...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.executeJavaScript('triggerOpen()') },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.executeJavaScript('saveProject()') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Project',
      submenu: [
        { label: 'Add Track', click: () => mainWindow.webContents.executeJavaScript('addTrack()') },
        { label: 'Remove Track', click: () => mainWindow.webContents.executeJavaScript('removeTrack()') },
        { label: 'Set BPM...', click: () => mainWindow.webContents.executeJavaScript('setBpm()') }
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
