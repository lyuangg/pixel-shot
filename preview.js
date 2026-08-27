const canvas = document.getElementById("editor");
const ctx = canvas.getContext("2d");
const sizeInfo = document.getElementById("size-info");
const fileInfo = document.getElementById("file-info");
const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");

let fileName = "screenshot.png";

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function loadImage(dataUrl) {
  const img = new Image();
  img.onload = () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    sizeInfo.textContent = `${canvas.width} × ${canvas.height} px`;
    canvas.toBlob((blob) => {
      fileInfo.textContent = formatBytes(blob.size);
    }, "image/png");
  };
  img.src = dataUrl;
}

async function copyToClipboard() {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  copyBtn.textContent = "已复制";
  copyBtn.classList.add("feedback");
  setTimeout(() => {
    copyBtn.textContent = "复制";
    copyBtn.classList.remove("feedback");
  }, 1500);
}

function download() {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
}

copyBtn.addEventListener("click", copyToClipboard);
downloadBtn.addEventListener("click", download);

chrome.storage.session.get("pendingScreenshot", (result) => {
  const data = result.pendingScreenshot;
  if (data && data.dataUrl) {
    fileName = `screenshot-${data.name}-${Date.now()}.png`;
    loadImage(data.dataUrl);
    chrome.storage.session.remove("pendingScreenshot");
  } else {
    sizeInfo.textContent = "无截图数据";
  }
});