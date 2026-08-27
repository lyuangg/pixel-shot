const MIN_SIZE = 50;
const MAX_SIZE = 8000;

const PRESETS = [
  { name: "Desktop", width: 1280, height: 800 },
  { name: "Compact", width: 640, height: 400 },
  { name: "Small", width: 440, height: 280 },
  { name: "Wide", width: 1400, height: 560 },
];

const statusEl = document.getElementById("status");
const selectEl = document.getElementById("size-select");
const customArea = document.getElementById("custom-area");
const nameInput = document.getElementById("name-input");
const widthInput = document.getElementById("width-input");
const heightInput = document.getElementById("height-input");
const saveBtn = document.getElementById("save-btn");
const deleteBtn = document.getElementById("delete-btn");
const resizeBtn = document.getElementById("resize");
const captureBtn = document.getElementById("capture");
const compensateEl = document.getElementById("compensate");

let savedSizes = [];
let selectedSize = { ...PRESETS[0] };
let selectedKind = "preset";
let selectedIndex = 0;
let editingSavedIndex = -1;

function setStatus(text, cls = "") {
  statusEl.textContent = text;
  statusEl.className = "status" + (cls ? " " + cls : "");
}

function validateSize(w, h) {
  if (!Number.isInteger(w) || !Number.isInteger(h)) {
    return "请输入整数尺寸";
  }
  if (w < MIN_SIZE || h < MIN_SIZE) {
    return `尺寸不能小于 ${MIN_SIZE}px`;
  }
  if (w > MAX_SIZE || h > MAX_SIZE) {
    return `尺寸不能大于 ${MAX_SIZE}px`;
  }
  return null;
}

function renderSelect() {
  selectEl.innerHTML = "";
  PRESETS.forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = `preset-${i}`;
    opt.textContent = `${p.name}（${p.width}×${p.height}）`;
    selectEl.appendChild(opt);
  });
  if (savedSizes.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "已保存";
    savedSizes.forEach((s, i) => {
      const opt = document.createElement("option");
      opt.value = `saved-${i}`;
      opt.textContent = `${s.name}（${s.width}×${s.height}）`;
      group.appendChild(opt);
    });
    selectEl.appendChild(group);
  }
  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "自定义…";
  selectEl.appendChild(custom);

  if (selectedKind === "preset") selectEl.value = `preset-${selectedIndex}`;
  else if (selectedKind === "saved") selectEl.value = `saved-${selectedIndex}`;
  else selectEl.value = "custom";
}

function showCustomArea(show) {
  customArea.style.display = show ? "block" : "none";
}

function onSelectChange() {
  const value = selectEl.value;
  if (value === "custom") {
    selectedKind = "custom";
    editingSavedIndex = -1;
    nameInput.value = "";
    widthInput.value = "";
    heightInput.value = "";
    deleteBtn.style.display = "none";
    showCustomArea(true);
    return;
  }
  if (value.startsWith("preset-")) {
    const i = parseInt(value.slice(7), 10);
    selectedKind = "preset";
    selectedIndex = i;
    selectedSize = { ...PRESETS[i] };
  } else if (value.startsWith("saved-")) {
    const i = parseInt(value.slice(6), 10);
    selectedKind = "saved";
    selectedIndex = i;
    selectedSize = { ...savedSizes[i] };
    editingSavedIndex = i;
    nameInput.value = savedSizes[i].name;
    widthInput.value = savedSizes[i].width;
    heightInput.value = savedSizes[i].height;
    deleteBtn.style.display = "block";
  }
  showCustomArea(false);
}

function saveCustom() {
  const w = parseInt(widthInput.value, 10);
  const h = parseInt(heightInput.value, 10);
  const err = validateSize(w, h);
  if (err) {
    setStatus(err, "error");
    return;
  }
  const name = nameInput.value.trim() || `${w}x${h}`;
  savedSizes.push({ name, width: w, height: h });
  chrome.storage.local.set({ savedSizes }, () => {
    selectedKind = "saved";
    selectedIndex = savedSizes.length - 1;
    selectedSize = { ...savedSizes[selectedIndex] };
    renderSelect();
    showCustomArea(false);
    setStatus("已保存 " + name, "ok");
    setTimeout(() => setStatus("就绪"), 1500);
  });
}

function deleteSaved() {
  if (editingSavedIndex < 0) return;
  savedSizes.splice(editingSavedIndex, 1);
  chrome.storage.local.set({ savedSizes }, () => {
    selectedKind = "preset";
    selectedIndex = 0;
    selectedSize = { ...PRESETS[0] };
    editingSavedIndex = -1;
    renderSelect();
    showCustomArea(false);
    setStatus("已删除", "ok");
    setTimeout(() => setStatus("就绪"), 1500);
  });
}

function getActiveSize() {
  if (selectedKind === "custom") {
    const w = parseInt(widthInput.value, 10);
    const h = parseInt(heightInput.value, 10);
    const err = validateSize(w, h);
    if (err) {
      setStatus(err, "error");
      return null;
    }
    return { width: w, height: h, name: `${w}x${h}` };
  }
  return { ...selectedSize };
}

function sendCapture(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(resp || { ok: false, error: "无响应" });
    });
  });
}

function setBtnState(disabled) {
  resizeBtn.disabled = disabled;
  captureBtn.disabled = disabled;
}

async function resize() {
  const target = getActiveSize();
  if (!target) return;
  setBtnState(true);
  setStatus("调整窗口…", "busy");
  const resp = await sendCapture({
    type: "resize",
    target,
    compensate: compensateEl.checked,
  });
  if (resp.ok) {
    setStatus("已调整 " + target.name, "ok");
  } else {
    setStatus("失败: " + (resp.error || "未知"), "error");
  }
  setBtnState(false);
}

async function capture() {
  const target = getActiveSize();
  if (!target) return;
  setBtnState(true);
  setStatus("截图…", "busy");
  const resp = await sendCapture({
    type: "capture",
    name: target.name,
  });
  if (resp.ok) {
    setStatus("已打开预览", "ok");
  } else {
    setStatus("失败: " + (resp.error || "未知"), "error");
  }
  setBtnState(false);
}

selectEl.addEventListener("change", onSelectChange);
saveBtn.addEventListener("click", saveCustom);
deleteBtn.addEventListener("click", deleteSaved);
resizeBtn.addEventListener("click", resize);
captureBtn.addEventListener("click", capture);

chrome.storage.local.get({ savedSizes: [] }, (result) => {
  savedSizes = result.savedSizes;
  renderSelect();
  setStatus("就绪");
});