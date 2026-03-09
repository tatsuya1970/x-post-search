const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveCSV: (data) => ipcRenderer.invoke('save-csv', data),
    xApiRequest: (data) => ipcRenderer.invoke('x-api-request', data),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
