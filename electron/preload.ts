const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  openProject: () => ipcRenderer.invoke('project:open'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  onNewProject: (callback) => {
    const listener = (_event, ...args) => callback(...args)
    ipcRenderer.on('menu:new-project', listener)
    return () => ipcRenderer.removeListener('menu:new-project', listener)
  },
  onLoadProject: (callback) => {
    const listener = (_e, data) => callback(data)
    ipcRenderer.on('menu:load-project', listener)
    return () => ipcRenderer.removeListener('menu:load-project', listener)
  },
  onRequestSave: (callback) => {
    const listener = (_event, ...args) => callback(...args)
    ipcRenderer.on('menu:request-save', listener)
    return () => ipcRenderer.removeListener('menu:request-save', listener)
  },
  onRunAnalysis: (callback) => {
    const listener = (_event, ...args) => callback(...args)
    ipcRenderer.on('menu:run-analysis', listener)
    return () => ipcRenderer.removeListener('menu:run-analysis', listener)
  },
  onPlayChase: (callback) => {
    const listener = (_event, ...args) => callback(...args)
    ipcRenderer.on('menu:play-chase', listener)
    return () => ipcRenderer.removeListener('menu:play-chase', listener)
  },
  onSaveCurveVersion: (callback) => {
    const listener = (_event, ...args) => callback(...args)
    ipcRenderer.on('menu:save-curve-version', listener)
    return () => ipcRenderer.removeListener('menu:save-curve-version', listener)
  },
})
