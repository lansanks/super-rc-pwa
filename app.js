const home = document.getElementById("home");
const main = document.getElementById("main");
const enterHint = document.querySelector(".enter-hint");
const backBtn = document.getElementById("backBtn");
const uploadBtn = document.getElementById("uploadBtn");
const readerScreen = document.getElementById("reader");
const readerBackBtn = document.getElementById("readerBackBtn");
const readerTitle = document.getElementById("readerTitle");
const readerBody = document.getElementById("readerBody");

const tabs = document.querySelectorAll(".tab");
const tabPanels = {
  available: document.getElementById("availableList"),
  pending: document.getElementById("pendingList"),
  review: document.getElementById("reviewList"),
};

const uploadModal = document.getElementById("uploadModal");
const chapterNameInput = document.getElementById("chapterName");
const chapterNumberInput = document.getElementById("chapterNumber");
const chapterFileInput = document.getElementById("chapterFile");
const filePicker = document.getElementById("filePicker");
const fileNameText = document.getElementById("fileNameText");
const cancelUploadBtn = document.getElementById("cancelUpload");
const confirmUploadBtn = document.getElementById("confirmUpload");

const UPLOADS_KEY = "super-rc-uploads-v1";
let uploads = loadUploads();

// 首页 -> 主界面
enterHint.addEventListener("click", () => {
  home.classList.remove("active");
  main.classList.add("active");
});

// 返回首页
backBtn.addEventListener("click", () => {
  main.classList.remove("active");
  home.classList.add("active");
});

// 阅读页返回列表
readerBackBtn.addEventListener("click", () => {
  readerScreen.classList.remove("active");
  main.classList.add("active");
});

// 栏目切换
tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

function setActiveTab(name) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  Object.entries(tabPanels).forEach(([key, panel]) => {
    panel.classList.toggle("active", key === name);
  });
}

// 上传弹窗
uploadBtn.addEventListener("click", () => {
  resetUploadForm();
  uploadModal.hidden = false;
});

cancelUploadBtn.addEventListener("click", () => {
  uploadModal.hidden = true;
});

uploadModal.addEventListener("click", (event) => {
  if (event.target === uploadModal) uploadModal.hidden = true;
});

chapterFileInput.addEventListener("change", () => {
  const file = chapterFileInput.files[0];
  fileNameText.textContent = file ? file.name : "选择 .md 文件";
  filePicker.classList.toggle("filled", Boolean(file));
});

confirmUploadBtn.addEventListener("click", () => {
  const name = chapterNameInput.value.trim();
  const number = parseInt(chapterNumberInput.value, 10);
  const file = chapterFileInput.files[0];

  if (!name) {
    alert("请填写章节名称");
    return;
  }
  if (!Number.isInteger(number) || number < 1) {
    alert("请填写有效的章节号");
    return;
  }
  if (!file) {
    alert("请选择一个 .md 文件");
    return;
  }
  if (!file.name.toLowerCase().endsWith(".md") && file.type !== "text/markdown") {
    alert("请选择 .md 格式的文件");
    return;
  }

  const fileReader = new FileReader();
  fileReader.onload = () => {
    const upload = {
      id: `u-${Date.now()}`,
      number,
      name,
      fileName: file.name,
      content: String(fileReader.result || ""),
      uploadedAt: new Date().toISOString(),
    };
    uploads.unshift(upload);
    saveUploads();
    renderUploads();
    resetUploadForm();
    uploadModal.hidden = true;
    setActiveTab("review");
  };
  fileReader.onerror = () => alert("文件读取失败，请重试");
  fileReader.readAsText(file, "utf-8");
});

// 加载章节列表
async function loadChapters() {
  try {
    const res = await fetch("./chapters.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const chapters = await res.json();
    renderChapters(chapters);
    renderUploads();
  } catch (err) {
    console.warn("加载章节列表失败:", err);
    renderChapters([]);
    renderUploads();
  }
}

function renderChapters(chapters) {
  renderAvailable(chapters);
  renderPending(chapters);
}

function renderAvailable(chapters) {
  const list = tabPanels.available;
  list.innerHTML = "";
  const unlocked = chapters.slice(0, 4);

  if (!unlocked.length) {
    appendEmpty(list, "暂无章节");
    return;
  }

  for (const chapter of unlocked) {
    const li = makeChapterItem(chapter, { clickable: true });
    li.addEventListener("click", () => openChapter(chapter));
    list.appendChild(li);
  }
}

function renderPending(chapters) {
  const list = tabPanels.pending;
  list.innerHTML = "";
  const locked = chapters.slice(4);

  if (!locked.length) {
    appendEmpty(list, "暂无未更新章节");
    return;
  }

  for (const chapter of locked) {
    list.appendChild(makeChapterItem(chapter, { locked: true, hint: "未更新" }));
  }
}

function renderUploads() {
  const list = tabPanels.review;
  list.innerHTML = "";

  if (!uploads.length) {
    appendEmpty(list, "暂无待审批章节");
    return;
  }

  for (const upload of uploads) {
    const li = document.createElement("li");
    li.className = "chapter-item";

    const text = document.createElement("span");
    text.textContent = `第${upload.number}章 ${upload.name}`;

    const hint = document.createElement("span");
    hint.className = "lock-hint";
    hint.textContent = "待审批";

    li.appendChild(text);
    li.appendChild(hint);
    list.appendChild(li);
  }
}

function makeChapterItem(chapter, { clickable = false, locked = false, hint = "" } = {}) {
  const li = document.createElement("li");
  li.className = "chapter-item";
  if (clickable) li.classList.add("clickable");
  if (locked) li.classList.add("locked");

  const text = document.createElement("span");
  text.textContent = chapter.title;
  li.appendChild(text);

  if (hint) {
    const hintEl = document.createElement("span");
    hintEl.className = "lock-hint";
    hintEl.textContent = hint;
    li.appendChild(hintEl);
  }

  return li;
}

function appendEmpty(list, text) {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = text;
  list.appendChild(li);
}

function resetUploadForm() {
  chapterNameInput.value = "";
  chapterNumberInput.value = "";
  chapterFileInput.value = "";
  fileNameText.textContent = "选择 .md 文件";
  fileNameText.classList.remove("filled");
}

function loadUploads() {
  try {
    return JSON.parse(localStorage.getItem(UPLOADS_KEY)) || [];
  } catch (err) {
    console.warn("读取本地上传记录失败:", err);
    return [];
  }
}

function saveUploads() {
  try {
    localStorage.setItem(UPLOADS_KEY, JSON.stringify(uploads));
  } catch (err) {
    console.warn("保存上传章节失败:", err);
  }
}

// 进入阅读页并加载章节正文
async function openChapter(chapter) {
  main.classList.remove("active");
  readerScreen.classList.add("active");
  readerTitle.textContent = "加载中…";
  readerBody.textContent = "";

  try {
    const res = await fetch(`./${chapter.file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const heading = text.match(/^#\s+(.+)$/m);
    readerTitle.textContent = heading ? heading[1] : chapter.title;
    readerBody.textContent = text.replace(/^#\s+.+\n?/, "").trimStart();
  } catch (err) {
    console.warn("加载章节失败:", err);
    readerTitle.textContent = chapter.title;
    readerBody.textContent = "章节加载失败，请稍后重试。";
  }
}

loadChapters();

// PWA Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.warn("Service Worker 注册失败:", err));
  });
}
