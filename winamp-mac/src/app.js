import Webamp from "../node_modules/webamp/built/webamp.butterchurn-bundle.min.mjs";

const container = document.getElementById("webamp");
let webamp = null;

function persistPlaylist() {
  if (!webamp) return;
  const tracks = webamp.getPlaylistTracks().map((t) => ({
    url: t.url,
    defaultName: t.defaultName || t.title || undefined,
  }));
  window.winampHost.persistState({ tracks });
}

function persistSkin(url) {
  window.winampHost.persistState({ skinUrl: url });
}

function playlistForSaving() {
  return webamp.getPlaylistTracks().map((t) => ({
    url: t.url,
    title: t.title || t.defaultName || null,
    artist: t.artist || null,
    duration: t.duration,
  }));
}

// Minimal in-app prompt, styled to match the player, since Electron has no
// native equivalent of window.prompt().
function promptForUrl() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "url-prompt-overlay";
    overlay.innerHTML = `
      <div id="url-prompt-box">
        <div id="url-prompt-title">Open URL</div>
        <input id="url-prompt-input" type="text" spellcheck="false"
               placeholder="https://example.com/stream" />
        <div id="url-prompt-buttons">
          <button id="url-prompt-cancel">Cancel</button>
          <button id="url-prompt-ok">Open</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector("#url-prompt-input");
    input.focus();

    function close(value) {
      overlay.remove();
      resolve(value);
    }
    overlay.querySelector("#url-prompt-cancel").onclick = () => close(null);
    overlay.querySelector("#url-prompt-ok").onclick = () => close(input.value.trim() || null);
    input.onkeydown = (e) => {
      if (e.key === "Enter") close(input.value.trim() || null);
      if (e.key === "Escape") close(null);
    };
    overlay.onmousedown = (e) => {
      if (e.target === overlay) close(null);
    };
  });
}

async function addUrlTracks() {
  const url = await promptForUrl();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return [{ url, defaultName: url }];
}

async function boot(initialState) {
  if (!Webamp.browserIsSupported()) {
    container.textContent = "This browser environment does not support Webamp.";
    return;
  }

  webamp = new Webamp({
    initialTracks: initialState.tracks || [],
    initialSkin: initialState.skinUrl ? { url: initialState.skinUrl } : undefined,
    enableHotkeys: true,
    enableMediaSession: true,
    windowLayout: {
      main: { position: { top: 0, left: 0 } },
      equalizer: { position: { top: 116, left: 0 } },
      playlist: {
        position: { top: 0, left: 275 },
        size: { extraHeight: 4, extraWidth: 0 },
      },
      milkdrop: {
        position: { top: 232, left: 0 },
        size: { extraHeight: 3, extraWidth: 10 },
      },
    },
    handleAddUrlEvent: addUrlTracks,
    handleSaveListEvent: async () => {
      await window.winampHost.savePlaylistDialog(playlistForSaving());
      return null;
    },
    handleLoadListEvent: async () => {
      const tracks = await window.winampHost.loadPlaylistDialog();
      return tracks && tracks.length ? tracks : null;
    },
  });

  webamp.onWillClose((cancel) => {
    // Keep the app running; "closing" Winamp just hides its windows.
    cancel();
  });

  webamp.onTrackDidChange(() => persistPlaylist());
  webamp.onMinimize(() => window.winampHost.minimize());

  await webamp.renderInto(container);
  window.__webamp = webamp; // debugging/testing hook
}

window.winampHost.onInit((state) => boot(state || {}));

window.winampHost.onAddTracks((tracks) => {
  if (!webamp) return;
  webamp.appendTracks(tracks);
  persistPlaylist();
});

window.winampHost.onSetSkin((skin) => {
  if (!webamp) return;
  webamp.setSkinFromUrl(skin.url);
  persistSkin(skin.url);
});

window.winampHost.onCommand(async (command) => {
  if (!webamp) return;
  switch (command.type) {
    case "play-pause":
      if (webamp.getMediaStatus() === "PLAYING") webamp.pause();
      else webamp.play();
      break;
    case "play":
      webamp.play();
      break;
    case "pause":
      webamp.pause();
      break;
    case "stop":
      webamp.stop();
      break;
    case "next":
      webamp.nextTrack();
      break;
    case "previous":
      webamp.previousTrack();
      break;
    case "seek-forward":
      webamp.seekForward(5);
      break;
    case "seek-backward":
      webamp.seekBackward(5);
      break;
    case "toggle-shuffle":
      webamp.toggleShuffle();
      break;
    case "toggle-repeat":
      webamp.toggleRepeat();
      break;
    case "add-url": {
      const tracks = await addUrlTracks();
      if (tracks) {
        webamp.appendTracks(tracks);
        persistPlaylist();
      }
      break;
    }
    case "save-playlist":
      await window.winampHost.savePlaylistDialog(playlistForSaving());
      break;
    case "load-playlist": {
      const tracks = await window.winampHost.loadPlaylistDialog();
      if (tracks && tracks.length) {
        webamp.setTracksToPlay(tracks);
        persistPlaylist();
      }
      break;
    }
  }
});
