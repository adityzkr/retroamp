const { app, BrowserWindow, Menu, dialog, ipcMain, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL, fileURLToPath } = require("url");

const isMac = process.platform === "darwin";
const userDataDir = app.getPath("userData");
const stateFile = path.join(userDataDir, "state.json");
const skinsDir = path.join(userDataDir, "skins");

let mainWindow;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error("Failed to save state:", err);
  }
}

function stateForRenderer() {
  const state = loadState();
  const tracks = (state.tracks || [])
    .filter((t) => {
      if (typeof t.url === "string" && /^https?:\/\//i.test(t.url)) return true;
      return t.path && fs.existsSync(t.path);
    })
    .map((t) =>
      t.path
        ? { url: pathToFileURL(t.path).href, defaultName: t.defaultName }
        : { url: t.url, defaultName: t.defaultName }
    );
  const skinUrl =
    state.skinPath && fs.existsSync(state.skinPath) ? pathToFileURL(state.skinPath).href : undefined;
  return { tracks, skinUrl };
}

function sendCommand(type) {
  if (mainWindow) mainWindow.webContents.send("command", { type });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 420,
    minHeight: 320,
    backgroundColor: "#15151c",
    frame: true,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("init-state", stateForRenderer());
  });
}

function tracksFromPaths(filePaths) {
  return filePaths.map((p) => ({
    url: pathToFileURL(p).href,
    defaultName: path.basename(p, path.extname(p)),
  }));
}

async function openTrackFiles() {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Audio Files",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Audio Files", extensions: ["mp3", "wav", "ogg", "m4a", "flac", "aac"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return;
  mainWindow.webContents.send("add-tracks", tracksFromPaths(result.filePaths));
}

async function openSkinFile() {
  if (!mainWindow) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Load Classic Skin",
    properties: ["openFile"],
    filters: [{ name: "Classic Skins (.wsz)", extensions: ["wsz", "zip"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return;
  const src = result.filePaths[0];
  try {
    fs.mkdirSync(skinsDir, { recursive: true });
    const dest = path.join(skinsDir, path.basename(src));
    fs.copyFileSync(src, dest);
    mainWindow.webContents.send("set-skin", { url: pathToFileURL(dest).href });
  } catch (err) {
    dialog.showErrorBox("Skin Load Error", String(err));
  }
}

// --- M3U playlist save/load ---

function trackToLocation(track) {
  if (track.url.startsWith("file://")) {
    try {
      return fileURLToPath(track.url);
    } catch {
      return null;
    }
  }
  if (/^https?:\/\//i.test(track.url)) return track.url;
  return null;
}

async function savePlaylist(tracks) {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save Playlist",
    defaultPath: "playlist.m3u8",
    filters: [{ name: "M3U Playlist", extensions: ["m3u8", "m3u"] }],
  });
  if (result.canceled || !result.filePath) return null;

  const lines = ["#EXTM3U"];
  for (const track of tracks || []) {
    const location = trackToLocation(track);
    if (!location) continue;
    const seconds = Number.isFinite(track.duration) ? Math.round(track.duration) : -1;
    const label = [track.artist, track.title].filter(Boolean).join(" - ") || track.title || "";
    lines.push(`#EXTINF:${seconds},${label}`);
    lines.push(location);
  }
  try {
    fs.writeFileSync(result.filePath, lines.join("\n") + "\n", "utf8");
  } catch (err) {
    dialog.showErrorBox("Save Playlist Error", String(err));
  }
  return null;
}

function parseM3u(content, baseDir) {
  const tracks = [];
  let pendingName = null;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const extinf = line.match(/^#EXTINF:[^,]*,(.*)$/);
      if (extinf) pendingName = extinf[1].trim() || null;
      continue;
    }
    let url = null;
    if (/^https?:\/\//i.test(line)) {
      url = line;
    } else if (line.startsWith("file://")) {
      url = line;
    } else {
      const abs = path.isAbsolute(line) ? line : path.join(baseDir, line);
      if (fs.existsSync(abs)) url = pathToFileURL(abs).href;
    }
    if (url) {
      tracks.push({ url, defaultName: pendingName || undefined });
    }
    pendingName = null;
  }
  return tracks;
}

function parsePls(content, baseDir) {
  const files = {};
  const titles = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    let m = line.match(/^File(\d+)=(.*)$/i);
    if (m) files[m[1]] = m[2].trim();
    m = line.match(/^Title(\d+)=(.*)$/i);
    if (m) titles[m[1]] = m[2].trim();
  }
  const tracks = [];
  for (const key of Object.keys(files).sort((a, b) => Number(a) - Number(b))) {
    const entry = files[key];
    let url = null;
    if (/^https?:\/\//i.test(entry) || entry.startsWith("file://")) {
      url = entry;
    } else {
      const abs = path.isAbsolute(entry) ? entry : path.join(baseDir, entry);
      if (fs.existsSync(abs)) url = pathToFileURL(abs).href;
    }
    if (url) tracks.push({ url, defaultName: titles[key] || undefined });
  }
  return tracks;
}

async function loadPlaylist() {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Load Playlist",
    properties: ["openFile"],
    filters: [{ name: "Playlists", extensions: ["m3u", "m3u8", "pls"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const file = result.filePaths[0];
  try {
    const content = fs.readFileSync(file, "utf8");
    const baseDir = path.dirname(file);
    return path.extname(file).toLowerCase() === ".pls"
      ? parsePls(content, baseDir)
      : parseM3u(content, baseDir);
  } catch (err) {
    dialog.showErrorBox("Load Playlist Error", String(err));
    return null;
  }
}

// --- IPC ---

ipcMain.handle("open-track-dialog", () => openTrackFiles());
ipcMain.handle("open-skin-dialog", () => openSkinFile());
ipcMain.handle("save-playlist-dialog", (_e, tracks) => savePlaylist(tracks));
ipcMain.handle("load-playlist-dialog", () => loadPlaylist());

ipcMain.handle("persist-state", (_event, partial) => {
  const current = loadState();
  const next = { ...current };

  if (Array.isArray(partial.tracks)) {
    next.tracks = partial.tracks
      .map((t) => {
        if (typeof t.url !== "string") return null;
        if (/^https?:\/\//i.test(t.url)) {
          return { url: t.url, defaultName: t.defaultName };
        }
        if (t.url.startsWith("file://")) {
          try {
            return { path: fileURLToPath(t.url), defaultName: t.defaultName };
          } catch {
            return null;
          }
        }
        return null;
      })
      .filter(Boolean);
  }

  if (typeof partial.skinUrl === "string" && partial.skinUrl.startsWith("file://")) {
    try {
      next.skinPath = fileURLToPath(partial.skinUrl);
    } catch {
      /* ignore malformed URL */
    }
  }

  saveState(next);
});

ipcMain.handle("minimize-window", () => {
  if (mainWindow) mainWindow.minimize();
});

// --- Menus, dock, global hotkeys ---

function buildMenu() {
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "File",
      submenu: [
        { label: "Open Audio Files…", accelerator: "CmdOrCtrl+O", click: () => openTrackFiles() },
        { label: "Open URL…", accelerator: "CmdOrCtrl+L", click: () => sendCommand("add-url") },
        { type: "separator" },
        {
          label: "Load Playlist…",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => sendCommand("load-playlist"),
        },
        {
          label: "Save Playlist…",
          accelerator: "CmdOrCtrl+S",
          click: () => sendCommand("save-playlist"),
        },
        { type: "separator" },
        { label: "Load Skin…", accelerator: "CmdOrCtrl+Shift+S", click: () => openSkinFile() },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "Playback",
      submenu: [
        { label: "Play/Pause", click: () => sendCommand("play-pause") },
        { label: "Stop", click: () => sendCommand("stop") },
        { type: "separator" },
        { label: "Previous Track", accelerator: "CmdOrCtrl+Left", click: () => sendCommand("previous") },
        { label: "Next Track", accelerator: "CmdOrCtrl+Right", click: () => sendCommand("next") },
        { type: "separator" },
        { label: "Seek Backward 5s", accelerator: "CmdOrCtrl+Alt+Shift+Left", click: () => sendCommand("seek-backward") },
        { label: "Seek Forward 5s", accelerator: "CmdOrCtrl+Alt+Shift+Right", click: () => sendCommand("seek-forward") },
        { type: "separator" },
        { label: "Toggle Shuffle", accelerator: "CmdOrCtrl+U", click: () => sendCommand("toggle-shuffle") },
        { label: "Toggle Repeat", accelerator: "CmdOrCtrl+R", click: () => sendCommand("toggle-repeat") },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function buildDockMenu() {
  if (!isMac || !app.dock) return;
  app.dock.setMenu(
    Menu.buildFromTemplate([
      { label: "Play/Pause", click: () => sendCommand("play-pause") },
      { label: "Stop", click: () => sendCommand("stop") },
      { label: "Previous Track", click: () => sendCommand("previous") },
      { label: "Next Track", click: () => sendCommand("next") },
    ])
  );
}

function registerGlobalHotkeys() {
  // Classic-style global hotkeys that work while the app is in the background.
  // Hardware media keys are intentionally left to the OS media session
  // (Webamp's enableMediaSession) to avoid double-handling.
  const bindings = {
    "CmdOrCtrl+Alt+Space": "play-pause",
    "CmdOrCtrl+Alt+Right": "next",
    "CmdOrCtrl+Alt+Left": "previous",
    "CmdOrCtrl+Alt+Down": "stop",
  };
  for (const [accelerator, command] of Object.entries(bindings)) {
    try {
      globalShortcut.register(accelerator, () => sendCommand(command));
    } catch {
      /* another app may own this shortcut; not fatal */
    }
  }
}

app.whenReady().then(() => {
  buildMenu();
  buildDockMenu();
  registerGlobalHotkeys();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (!isMac) app.quit();
});
