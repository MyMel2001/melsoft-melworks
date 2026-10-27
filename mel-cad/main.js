// MelCAD Pro Electron Main Process
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'MelCAD Pro - Computer-Aided Design Studio (AutoCAD Clone)',
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
        { label: 'New Drawing', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.executeJavaScript('newDrawing()') },
        { label: 'Open DXF/DWG...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.executeJavaScript('triggerOpen()') },
        { label: 'Save DXF', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.executeJavaScript('exportDxf()') },
        { label: 'Export SVG...', accelerator: 'CmdOrCtrl+Shift+E', click: () => mainWindow.webContents.executeJavaScript('exportSvgFile()') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Erase Selected', accelerator: 'Delete', click: () => mainWindow.webContents.executeJavaScript('deleteSelected()') },
        { label: 'Cancel Current Tool', accelerator: 'Escape', click: () => mainWindow.webContents.executeJavaScript('cancelCurrentTool()') }
      ]
    },
    {
      label: 'Draw',
      submenu: [
        { label: 'Line (L)', click: () => mainWindow.webContents.executeJavaScript('setTool("line")') },
        { label: 'Circle (C)', click: () => mainWindow.webContents.executeJavaScript('setTool("circle")') },
        { label: 'Arc (A)', click: () => mainWindow.webContents.executeJavaScript('setTool("arc")') },
        { label: 'Rectangle (REC)', click: () => mainWindow.webContents.executeJavaScript('setTool("rect")') },
        { label: 'Polyline (PL)', click: () => mainWindow.webContents.executeJavaScript('setTool("polyline")') },
        { label: 'Dimension (DIM)', click: () => mainWindow.webContents.executeJavaScript('setTool("dimension")') },
        { label: 'Text (T)', click: () => mainWindow.webContents.executeJavaScript('setTool("text")') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom Extents', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.executeJavaScript('zoomExtents()') },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => mainWindow.webContents.executeJavaScript('zoomIn()') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => mainWindow.webContents.executeJavaScript('zoomOut()') },
        { label: 'Reset Origin', click: () => mainWindow.webContents.executeJavaScript('resetView()') },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', role: 'toggleDevTools' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
