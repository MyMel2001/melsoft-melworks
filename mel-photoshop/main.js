// MelDraw Studio Electron Main Process
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'MelDraw Studio Professional - Adobe Photoshop Clone',
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
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.executeJavaScript('newDocument()') },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.executeJavaScript('triggerOpen()') },
        { label: 'Save PSD', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.executeJavaScript('savePsd()') },
        { label: 'Export PNG...', accelerator: 'CmdOrCtrl+Shift+E', click: () => mainWindow.webContents.executeJavaScript('exportPng()') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.executeJavaScript('undo()') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.executeJavaScript('redo()') }
      ]
    },
    {
      label: 'Layer',
      submenu: [
        { label: 'New Layer', accelerator: 'CmdOrCtrl+Shift+N', click: () => mainWindow.webContents.executeJavaScript('addNewLayer()') },
        { label: 'Duplicate Layer', accelerator: 'CmdOrCtrl+J', click: () => mainWindow.webContents.executeJavaScript('duplicateActiveLayer()') },
        { label: 'Delete Layer', click: () => mainWindow.webContents.executeJavaScript('deleteActiveLayer()') },
        { label: 'Merge Down', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.executeJavaScript('mergeDownLayer()') }
      ]
    },
    {
      label: 'Filter',
      submenu: [
        { label: 'Sharpen', click: () => mainWindow.webContents.executeJavaScript('applyFilter("sharpen")') },
        { label: 'Find Edges', click: () => mainWindow.webContents.executeJavaScript('applyFilter("findEdges")') },
        { label: 'Emboss', click: () => mainWindow.webContents.executeJavaScript('applyFilter("emboss")') },
        { label: 'Box Blur', click: () => mainWindow.webContents.executeJavaScript('applyFilter("blur")') },
        { type: 'separator' },
        { label: 'Invert', accelerator: 'CmdOrCtrl+I', click: () => mainWindow.webContents.executeJavaScript('applyFilter("invert")') },
        { label: 'Desaturate', click: () => mainWindow.webContents.executeJavaScript('applyFilter("grayscale")') }
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
