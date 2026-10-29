// MelVU Electron Main Process
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    title: 'MelVU - Visual Web Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.executeJavaScript('melvuNewFile()') },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.executeJavaScript('triggerMelvuOpen()') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.executeJavaScript('melvuSaveFile()') },
        { label: 'Save As...', click: () => mainWindow.webContents.executeJavaScript('triggerMelvuSaveAs()') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.executeJavaScript('melvuEditorAction("undo")') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.executeJavaScript('melvuEditorAction("redo")') },
        { label: 'Find...', accelerator: 'CmdOrCtrl+F', click: () => mainWindow.webContents.executeJavaScript('melvuEditorAction("find")') },
        { label: 'Replace...', accelerator: 'CmdOrCtrl+H', click: () => mainWindow.webContents.executeJavaScript('melvuEditorAction("replace")') },
        { label: 'Go To Line...', accelerator: 'CmdOrCtrl+G', click: () => mainWindow.webContents.executeJavaScript('melvuEditorAction("gotoLine")') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Panels', click: () => mainWindow.webContents.executeJavaScript('melvuTogglePanels()') },
        { label: 'Toggle Developer Tools', role: 'toggleDevTools' },
        { label: 'Toggle Full Screen', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Code',
      submenu: [
        { label: 'Format Document', accelerator: 'Shift+Alt+F', click: () => mainWindow.webContents.executeJavaScript('melvuEditorAction("format")') },
        { label: 'Toggle Comment', click: () => mainWindow.webContents.executeJavaScript('melvuEditorAction("toggleComment")') }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About', click: () => mainWindow.webContents.executeJavaScript('melvuAbout()') }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  ipcMain.handle('melvu:saveAs', async (event, defaultName) => {
    const filters = [
      { name: 'MelVU Document', extensions: ['html','htm','css','js','mjs','json','md','markdown','py','go','txt'] },
      { name: 'All Files', extensions: ['*'] }
    ];
    const { filePaths } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || 'untitled.html',
      filters
    });
    return filePaths && filePaths[0] ? filePaths[0] : null;
  });

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
