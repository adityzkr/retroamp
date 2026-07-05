const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("winampHost", {
  onInit: (cb) => ipcRenderer.on("init-state", (_e, state) => cb(state)),
  onAddTracks: (cb) => ipcRenderer.on("add-tracks", (_e, tracks) => cb(tracks)),
  onSetSkin: (cb) => ipcRenderer.on("set-skin", (_e, skin) => cb(skin)),
  onCommand: (cb) => ipcRenderer.on("command", (_e, command) => cb(command)),
  openTrackDialog: () => ipcRenderer.invoke("open-track-dialog"),
  openSkinDialog: () => ipcRenderer.invoke("open-skin-dialog"),
  savePlaylistDialog: (tracks) => ipcRenderer.invoke("save-playlist-dialog", tracks),
  loadPlaylistDialog: () => ipcRenderer.invoke("load-playlist-dialog"),
  persistState: (partial) => ipcRenderer.invoke("persist-state", partial),
  minimize: () => ipcRenderer.invoke("minimize-window"),
});
