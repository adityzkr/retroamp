import Webamp from "./lib/webamp.butterchurn-bundle.min.mjs";

const container = document.getElementById("webamp");
let webamp = null;

async function boot() {
  if (!Webamp.browserIsSupported()) {
    container.textContent = "This WebView does not support Webamp.";
    return;
  }

  webamp = new Webamp({
    // Vertical stack sized for a phone screen; renderInto centers it.
    windowLayout: {
      main: { position: { top: 0, left: 0 } },
      equalizer: { position: { top: 116, left: 0 } },
      playlist: {
        position: { top: 232, left: 0 },
        size: { extraHeight: 2, extraWidth: 0 },
      },
      milkdrop: {
        position: { top: 406, left: 0 },
        size: { extraHeight: 2, extraWidth: 0 },
        closed: true,
      },
    },
    enableMediaSession: true,
  });

  webamp.onWillClose((cancel) => cancel());

  await webamp.renderInto(container);
  window.__webamp = webamp; // debugging/testing hook
}

document.getElementById("btn-add-songs").onclick = () =>
  document.getElementById("file-songs").click();
document.getElementById("btn-load-skin").onclick = () =>
  document.getElementById("file-skin").click();
document.getElementById("btn-milkdrop").onclick = () => {
  if (!webamp) return;
  webamp.store.dispatch({ type: "TOGGLE_WINDOW", windowId: "milkdrop" });
};

document.getElementById("file-songs").onchange = (e) => {
  if (!webamp) return;
  const tracks = Array.from(e.target.files).map((file) => ({
    blob: file,
    defaultName: file.name.replace(/\.[^.]+$/, ""),
  }));
  if (tracks.length) webamp.appendTracks(tracks);
  e.target.value = "";
};

document.getElementById("file-skin").onchange = (e) => {
  if (!webamp) return;
  const file = e.target.files[0];
  if (file) webamp.setSkinFromUrl(URL.createObjectURL(file));
  e.target.value = "";
};

boot();
