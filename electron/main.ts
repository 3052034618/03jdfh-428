const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'
const isPackaged = app.isPackaged

/** @type {import('electron').BrowserWindow | null} */
let mainWindow = null

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    title: '追逐段落导演编辑器',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev && !isPackaged) {
    mainWindow.loadURL('http://localhost:5174')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const createMenu = () => {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建项目',
          accelerator: 'Ctrl+N',
          click: () => {
            mainWindow?.webContents.send('menu:new-project')
          },
        },
        {
          label: '打开项目',
          accelerator: 'Ctrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              filters: [{ name: '追逐段落项目', extensions: ['chase.json'] }],
              properties: ['openFile'],
            })
            if (!result.canceled && result.filePaths[0]) {
              const filePath = result.filePaths[0]
              const content = fs.readFileSync(filePath, 'utf-8')
              mainWindow?.webContents.send('menu:load-project', JSON.parse(content), filePath)
            }
          },
        },
        {
          label: '保存项目',
          accelerator: 'Ctrl+S',
          click: async () => {
            mainWindow?.webContents.send('menu:request-save')
          },
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '运行',
      submenu: [
        {
          label: '运行分析',
          accelerator: 'F5',
          click: () => {
            mainWindow?.webContents.send('menu:run-analysis')
          },
        },
        {
          label: '播放追逐',
          accelerator: 'Space',
          click: () => {
            mainWindow?.webContents.send('menu:play-chase')
          },
        },
        {
          label: '保存当前曲线版本',
          accelerator: 'Ctrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('menu:save-curve-version')
          },
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '使用说明',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: '使用说明',
              message: '追逐段落导演编辑器',
              detail:
                '1. 时间轴编排：从左侧拖拽场景节点到时间轴\n' +
                '2. 路线预览：双击小地图添加路点，从右侧面板管理路线\n' +
                '3. 紧张曲线：点击运行分析查看节奏反馈\n' +
                '4. 保存版本：在紧张曲线页面可保存多个版本对比',
            })
          },
        },
        { role: 'about', label: '关于' },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createWindow()
  createMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('project:save', async (_event, data) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: '追逐段落项目', extensions: ['chase.json'] }],
    defaultPath: `${data.name || 'untitled'}.chase.json`,
  })
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2))
    return { success: true, path: result.filePath }
  }
  return { success: false }
})

ipcMain.handle('project:open', async (_event) => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: '追逐段落项目', extensions: ['chase.json'] }],
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths[0]) {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8')
    mainWindow?.webContents.send('menu:load-project', JSON.parse(content), result.filePaths[0])
    return { success: true, path: result.filePaths[0] }
  }
  return { success: false }
})

ipcMain.handle('app:get-version', () => {
  return app.getVersion()
})
