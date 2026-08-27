function computeOffset() {
  return new Promise((resolve) => {
    chrome.windows.getLastFocused({}, (win) => {
      if (chrome.runtime.lastError) {
        resolve({ dx: 0, dy: 0 });
        return;
      }
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || tab.width == null || tab.height == null) {
          resolve({ dx: 0, dy: 0 });
          return;
        }
        resolve({
          dx: win.width - tab.width,
          dy: win.height - tab.height,
        });
      });
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function resizeWindow(target, compensate) {
  const t = { ...target };
  if (compensate) {
    const offset = await computeOffset();
    t.width += offset.dx;
    t.height += offset.dy;
  }
  const win = await chrome.windows.getLastFocused({});
  await chrome.windows.update(win.id, {
    width: t.width,
    height: t.height,
  });
}

let previewTabId = null;

function clearPendingScreenshot() {
  chrome.storage.session.remove("pendingScreenshot", () => {
    if (chrome.runtime.lastError) return;
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === previewTabId) {
    previewTabId = null;
    clearPendingScreenshot();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "resize") {
    (async () => {
      try {
        await resizeWindow(msg.target, msg.compensate);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg && msg.type === "capture") {
    (async () => {
      try {
        await sleep(500);
        const win = await chrome.windows.getLastFocused({});
        const dataUrl = await chrome.tabs.captureVisibleTab(win.id, {
          format: "png",
        });

        await chrome.storage.session.set({
          pendingScreenshot: { dataUrl, name: msg.name },
        });

        const tab = await chrome.tabs.create({
          url: chrome.runtime.getURL("preview.html"),
        });
        previewTabId = tab.id;

        sendResponse({ ok: true, preview: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }
});
