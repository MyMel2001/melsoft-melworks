// MelFlash Professional Electron Main Process
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    title: 'MelFlash Professional - Adobe Flash Studio Clone',
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
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.executeJavaScript('newProject()') },
        { label: 'Open FLA...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.executeJavaScript('triggerOpenFla()') },
        { label: 'Save FLA', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.executeJavaScript('saveFla()') },
        { label: 'Export SWF...', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.executeJavaScript('exportSwf()') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Insert',
      submenu: [
        { label: 'Keyframe', accelerator: 'F6', click: () => mainWindow.webContents.executeJavaScript('insertKeyframe()') },
        { label: 'New Layer', click: () => mainWindow.webContents.executeJavaScript('addNewLayer()') },
        { label: 'Convert to Symbol', accelerator: 'F8', click: () => mainWindow.webContents.executeJavaScript('convertSelectionToSymbol()') }
      ]
    },
    {
      label: 'Control',
      submenu: [
        { label: 'Play / Pause', accelerator: 'Return', click: () => mainWindow.webContents.executeJavaScript('togglePlay()') },
        { label: 'Rewind', click: () => mainWindow.webContents.executeJavaScript('rewindTimeline()') },
        { label: 'Test Movie', accelerator: 'CmdOrCtrl+Return', click: () => mainWindow.webContents.executeJavaScript('exportSwf()') }
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
