// ---------- 页面元素 ----------
const home = document.getElementById("home");
const auth = document.getElementById("auth");
const authBackBtn = document.getElementById("authBackBtn");
const identityChoices = document.getElementById("identityChoices");
const adminAuthBtn = document.getElementById("adminAuthBtn");
const guestAuthBtn = document.getElementById("guestAuthBtn");
const keyForm = document.getElementById("keyForm");
const adminKeyInput = document.getElementById("adminKeyInput");
const keyError = document.getElementById("keyError");
const keyCancelBtn = document.getElementById("keyCancelBtn");
const keySubmitBtn = document.getElementById("keySubmitBtn");

const main = document.getElementById("main");
const enterHint = document.querySelector(".enter-hint");
const backBtn = document.getElementById("backBtn");
const adminBadge = document.getElementById("adminBadge");
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

const provideIdeaBtn = document.getElementById("provideIdeaBtn");
const previewIdeaBtn = document.getElementById("previewIdeaBtn");
const ideaModal = document.getElementById("ideaModal");
const ideaNameInput = document.getElementById("ideaNameInput");
const ideaTextInput = document.getElementById("ideaTextInput");
const ideaCharCount = document.getElementById("ideaCharCount");
const ideaCancelBtn = document.getElementById("ideaCancelBtn");
const ideaSubmitBtn = document.getElementById("ideaSubmitBtn");
const ideaPreviewModal = document.getElementById("ideaPreviewModal");
const ideaPreviewList = document.getElementById("ideaPreviewList");
const ideaPreviewCloseBtn = document.getElementById("ideaPreviewCloseBtn");

// ---------- 数据 ----------
const UPLOADS_KEY = "super-rc-uploads-v1";
const APPROVED_KEY = "super-rc-approved-v1";
const IDEAS_CACHE_KEY = "super-rc-ideas-cache-v1";
const ADMIN_SESSION_KEY = "super-rc-admin";
const ADMIN_KEY_SESSION_KEY = "super-rc-admin-key";
const SUPABASE_URL = "https://dmsogohfssgoewfitzqi.supabase.co";
const SUPABASE_KEY = "sb_publishable_txHcRQMDxsCGfGG8qhkigg_1RRWABhi";

let allChapters = [];
let uploads = loadList(UPLOADS_KEY);
let approvedUploads = loadList(APPROVED_KEY);
let ideas = loadList(IDEAS_CACHE_KEY);
let isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";

// ---------- 导航 ----------
enterHint.addEventListener("click", () => {
  if (isAdmin) {
    enterMain();
  } else {
    home.classList.remove("active");
    auth.classList.add("active");
  }
});

authBackBtn.addEventListener("click", () => {
  auth.classList.remove("active");
  home.classList.add("active");
});

guestAuthBtn.addEventListener("click", () => {
  enterMain();
});

backBtn.addEventListener("click", () => {
  main.classList.remove("active");
  home.classList.add("active");
});

readerBackBtn.addEventListener("click", () => {
  readerScreen.classList.remove("active");
  main.classList.add("active");
});

function enterMain() {
  home.classList.remove("active");
  auth.classList.remove("active");
  main.classList.add("active");
  renderAll();
}

// ---------- 管理员认证 ----------
adminAuthBtn.addEventListener("click", () => {
  identityChoices.hidden = true;
  keyError.hidden = true;
  keyForm.hidden = false;
  adminKeyInput.value = "";
  adminKeyInput.focus();
});

keyCancelBtn.addEventListener("click", () => {
  keyForm.hidden = true;
  identityChoices.hidden = false;
});

keyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = adminKeyInput.value.trim();
  if (!key) {
    showKeyError("请输入密钥");
    return;
  }

  keySubmitBtn.disabled = true;
  keySubmitBtn.textContent = "验证中…";

  try {
    const ok = await verifyAdminKey(key);
    if (ok) {
      isAdmin = true;
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      sessionStorage.setItem(ADMIN_KEY_SESSION_KEY, key);
      keyForm.hidden = true;
      identityChoices.hidden = false;
      enterMain();
    } else {
      showKeyError("密钥不正确");
    }
  } catch (err) {
    console.warn("密钥验证失败:", err);
    showKeyError("验证失败，请检查网络后重试");
  } finally {
    keySubmitBtn.disabled = false;
    keySubmitBtn.textContent = "确认";
  }
});

function showKeyError(message) {
  keyError.textContent = message;
  keyError.hidden = false;
}

async function verifyAdminKey(key) {
  const res = await fetch("./admin-keys.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const entries = await res.json();
  const hash = await sha256Hex(key);
  return entries.some((entry) => entry.hash === hash);
}

async function sha256Hex(text) {
  if (!crypto || !crypto.subtle) {
    throw new Error("当前环境不支持密钥验证，需要 HTTPS");
  }
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- 管理员标识 ----------
adminBadge.addEventListener("click", () => {
  if (!confirm("退出管理员模式？")) return;
  isAdmin = false;
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_KEY_SESSION_KEY);
  renderAll();
});

function updateAdminBadge() {
  adminBadge.hidden = !isAdmin;
}

// ---------- 栏目切换 ----------
tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

function setActiveTab(name) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  Object.entries(tabPanels).forEach(([key, panel]) => {
    panel.classList.toggle("active", key === name);
  });
}

// ---------- 上传弹窗 ----------
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
  fileReader.onload = async () => {
    const upload = {
      id: `u-${Date.now()}`,
      number,
      name,
      fileName: file.name,
      content: String(fileReader.result || ""),
      status: "pending",
      uploadedAt: new Date().toISOString(),
    };
    uploads.unshift(upload);
    saveList(UPLOADS_KEY, uploads);
    renderUploads();
    resetUploadForm();
    uploadModal.hidden = true;
    setActiveTab("review");

    try {
      await supabaseFetch("uploaded_chapters", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([toChapterRow(upload)]),
      });
    } catch (err) {
      console.warn("章节同步失败:", err);
      alert("章节已保存在本机，云端同步失败，下次打开会自动重试");
    }
  };
  fileReader.onerror = () => alert("文件读取失败，请重试");
  fileReader.readAsText(file, "utf-8");
});

// ---------- idea ----------
provideIdeaBtn.addEventListener("click", () => {
  resetIdeaForm();
  ideaModal.hidden = false;
});

ideaCancelBtn.addEventListener("click", () => {
  ideaModal.hidden = true;
});

ideaModal.addEventListener("click", (event) => {
  if (event.target === ideaModal) ideaModal.hidden = true;
});

ideaTextInput.addEventListener("input", () => {
  ideaCharCount.textContent = `${ideaTextInput.value.length}/50`;
});

ideaSubmitBtn.addEventListener("click", async () => {
  const name = ideaNameInput.value.trim();
  const text = ideaTextInput.value.trim();

  if (!name) {
    alert("请填写姓名");
    return;
  }
  if (!text) {
    alert("请填写 idea 内容");
    return;
  }
  if (text.length > 50) {
    alert("idea 内容不能超过 50 字");
    return;
  }

  const idea = {
    id: `i-${Date.now()}`,
    name,
    text,
    approved: false,
    createdAt: new Date().toISOString(),
  };
  ideas.unshift(idea);
  saveList(IDEAS_CACHE_KEY, ideas);
  renderIdeas();

  ideaSubmitBtn.disabled = true;
  ideaSubmitBtn.textContent = "同步中…";
  try {
    await supabaseFetch("ideas", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([toIdeaRow(idea)]),
    });
    resetIdeaForm();
    ideaModal.hidden = true;
  } catch (err) {
    console.warn("idea 同步失败:", err);
    const reason = err.name === "AbortError" ? "连接超时" : err.message;
    alert(`同步失败，idea 已保存在本机，下次打开会自动重试：${reason}`);
  } finally {
    ideaSubmitBtn.disabled = false;
    ideaSubmitBtn.textContent = "提交";
  }
});

previewIdeaBtn.addEventListener("click", async () => {
  renderIdeas();
  ideaPreviewModal.hidden = false;
  const status = document.getElementById("ideaPreviewStatus");
  status.textContent = "同步中…";
  try {
    await fetchIdeasFromCloud();
    renderIdeas();
    status.textContent = "";
  } catch (err) {
    console.warn("idea 同步失败:", err);
    status.textContent = "同步失败，当前显示本机缓存";
  }
});

ideaPreviewCloseBtn.addEventListener("click", () => {
  ideaPreviewModal.hidden = true;
});

ideaPreviewModal.addEventListener("click", (event) => {
  if (event.target === ideaPreviewModal) ideaPreviewModal.hidden = true;
});

function renderIdeas() {
  ideaPreviewList.innerHTML = "";

  if (!ideas.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "暂无 idea";
    ideaPreviewList.appendChild(p);
    return;
  }

  for (const idea of ideas) {
    const item = document.createElement("div");
    item.className = idea.approved ? "idea-item approved" : "idea-item pending";

    const text = document.createElement("p");
    text.className = "idea-text";
    text.textContent = idea.text;

    const meta = document.createElement("div");
    meta.className = "idea-meta";

    const name = document.createElement("span");
    name.className = "idea-name";
    name.textContent = idea.name;

    const actions = document.createElement("span");
    actions.className = "idea-actions";

    const status = document.createElement("span");
    status.className = "status";
    status.textContent = idea.approved ? "已通过" : "待审批";

    actions.appendChild(status);

    if (isAdmin && !idea.approved) {
      const approveBtn = document.createElement("button");
      approveBtn.className = "idea-approve";
      approveBtn.textContent = "审批";
      approveBtn.addEventListener("click", () => approveIdea(idea.id));
      actions.appendChild(approveBtn);
    }

    meta.appendChild(name);
    meta.appendChild(actions);
    item.appendChild(text);
    item.appendChild(meta);
    ideaPreviewList.appendChild(item);
  }
}

async function approveIdea(id) {
  const idea = ideas.find((item) => item.id === id);
  if (!idea || idea.approved) return;
  if (!confirm(`通过「${idea.name}」的 idea？`)) return;
  idea.approved = true;
  idea.approvedAt = new Date().toISOString();
  saveList(IDEAS_CACHE_KEY, ideas);
  renderIdeas();
  try {
    await supabaseFetch(`ideas?id=eq.${encodeURIComponent(idea.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        approved: true,
        approved_at: idea.approvedAt || new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn("审批同步失败:", err);
    const reason =
      err.name === "AbortError"
        ? "连接超时"
        : String(err.message).includes("403")
        ? "没有管理员权限，审批失败"
        : err.message;
    alert(`审批同步失败，稍后会自动重试：${reason}`);
  }
}

function resetIdeaForm() {
  ideaNameInput.value = "";
  ideaTextInput.value = "";
  ideaCharCount.textContent = "0/50";
}

// ---------- Supabase 同步 ----------
async function supabaseFetch(path, options = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const adminKey = sessionStorage.getItem(ADMIN_KEY_SESSION_KEY);
  if (adminKey) headers["x-admin-key"] = adminKey;

  const res = await fetchWithTimeout(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,
      headers,
    },
    10000
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 120)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function toIdeaRow(idea) {
  return {
    id: idea.id,
    name: idea.name,
    text: idea.text,
    approved: Boolean(idea.approved),
    created_at: idea.createdAt || idea.created_at || null,
    approved_at: idea.approvedAt || idea.approved_at || null,
  };
}

function toChapterRow(upload) {
  return {
    id: upload.id,
    number: upload.number,
    name: upload.name,
    file_name: upload.file_name || upload.fileName || null,
    content: upload.content,
    status: upload.status || "pending",
    created_at: upload.created_at || upload.uploadedAt || null,
    approved_at: upload.approved_at || upload.approvedAt || null,
  };
}

async function upsertRows(table, rows) {
  if (!rows.length) return;
  await supabaseFetch(table, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

async function fetchIdeasFromCloud() {
  const rows = await supabaseFetch("ideas?select=*&order=created_at.desc");
  const cloud = Array.isArray(rows) ? rows : [];
  const changed = ideas.filter((local) => {
    const remote = cloud.find((item) => item.id === local.id);
    return (
      !remote ||
      remote.approved !== Boolean(local.approved) ||
      (remote.approved_at || null) !== (local.approvedAt || null)
    );
  });
  if (changed.length) await upsertRows("ideas", changed.map(toIdeaRow));
  ideas = mergeById(cloud, ideas);
  saveList(IDEAS_CACHE_KEY, ideas);
  return ideas;
}

async function fetchChaptersFromCloud() {
  const rows = await supabaseFetch("uploaded_chapters?select=*&order=created_at.desc");
  const cloud = Array.isArray(rows) ? rows : [];
  const localAll = [...uploads, ...approvedUploads];
  const changed = localAll.filter((local) => {
    const remote = cloud.find((item) => item.id === local.id);
    return (
      !remote ||
      remote.status !== (local.status || "pending") ||
      (remote.approved_at || null) !== (local.approvedAt || null)
    );
  });
  if (changed.length) await upsertRows("uploaded_chapters", changed.map(toChapterRow));

  const merged = mergeById(cloud, localAll);
  uploads = merged.filter((item) => (item.status || "pending") === "pending");
  approvedUploads = merged.filter((item) => item.status === "approved");
  saveList(UPLOADS_KEY, uploads);
  saveList(APPROVED_KEY, approvedUploads);
}

function mergeById(baseRows, preferredRows) {
  const map = new Map();
  for (const row of baseRows) {
    if (row && row.id) map.set(row.id, row);
  }
  for (const row of preferredRows) {
    if (row && row.id) map.set(row.id, row);
  }
  return Array.from(map.values());
}

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

function migrateLegacyLocal() {
  try {
    const oldIdeas = JSON.parse(localStorage.getItem("super-rc-ideas-v1") || "[]");
    localStorage.removeItem("super-rc-ideas-v1");
    if (Array.isArray(oldIdeas) && oldIdeas.length) {
      ideas = mergeById(ideas, oldIdeas);
      saveList(IDEAS_CACHE_KEY, ideas);
    }
  } catch (err) {
    console.warn("迁移旧 idea 失败:", err);
  }
}

async function migrateGitHubIdeas() {
  try {
    const res = await fetchWithTimeout(
      "https://raw.githubusercontent.com/lansanks/super-rc-pwa/main/data/ideas.json",
      {},
      8000
    );
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      ideas = mergeById(ideas, data);
      saveList(IDEAS_CACHE_KEY, ideas);
    }
  } catch (err) {
    console.warn("读取旧 GitHub idea 失败（可忽略）:", err);
  }
}

async function initCloudSync() {
  migrateLegacyLocal();
  await migrateGitHubIdeas();
  try {
    await Promise.all([fetchIdeasFromCloud(), fetchChaptersFromCloud()]);
  } catch (err) {
    console.warn("云端同步失败，继续使用本机数据:", err);
  }
  renderAll();
}

// ---------- 列表渲染 ----------
async function loadChapters() {
  try {
    const res = await fetch("./chapters.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allChapters = await res.json();
  } catch (err) {
    console.warn("加载章节列表失败:", err);
    allChapters = [];
  }
  renderAll();
}

function renderAll() {
  renderAvailable(allChapters);
  renderPending(allChapters);
  renderUploads();
  updateAdminBadge();
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
  const repoLocked = chapters.slice(4);

  if (!repoLocked.length && !approvedUploads.length) {
    appendEmpty(list, "暂无未更新章节");
    return;
  }

  for (const chapter of repoLocked) {
    const li = makeChapterItem(chapter, { locked: true, hint: "未更新" });
    if (isAdmin) {
      li.classList.add("clickable");
      li.addEventListener("click", () => openChapter(chapter));
    }
    list.appendChild(li);
  }

  for (const upload of approvedUploads) {
    const li = document.createElement("li");
    li.className = isAdmin ? "chapter-item locked clickable" : "chapter-item locked";

    const text = document.createElement("span");
    text.textContent = `第${upload.number}章 ${upload.name}`;

    const hint = document.createElement("span");
    hint.className = "lock-hint";
    hint.textContent = "未更新";

    li.appendChild(text);
    li.appendChild(hint);
    if (isAdmin) li.addEventListener("click", () => openLocalChapter(upload));
    list.appendChild(li);
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
    li.className = "chapter-item locked";

    const text = document.createElement("span");
    text.textContent = `第${upload.number}章 ${upload.name}`;

    const hint = document.createElement("span");
    hint.className = "lock-hint";
    hint.textContent = "待审批";

    li.appendChild(text);
    li.appendChild(hint);

    if (isAdmin) {
      li.classList.add("clickable");
      li.addEventListener("click", () => openLocalChapter(upload));

      const approveBtn = document.createElement("button");
      approveBtn.className = "approve-btn";
      approveBtn.textContent = "审批";
      approveBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        approveUpload(upload.id);
      });
      li.appendChild(approveBtn);
    }

    list.appendChild(li);
  }
}

async function approveUpload(id) {
  const index = uploads.findIndex((upload) => upload.id === id);
  if (index === -1) return;
  const upload = uploads[index];
  if (!confirm(`审批通过「第${upload.number}章 ${upload.name}」，将进入“未更新”，确认？`)) {
    return;
  }

  uploads.splice(index, 1);
  upload.status = "approved";
  upload.approvedAt = new Date().toISOString();
  approvedUploads.unshift(upload);
  saveList(UPLOADS_KEY, uploads);
  saveList(APPROVED_KEY, approvedUploads);
  renderUploads();
  renderPending(allChapters);

  try {
    await supabaseFetch(`uploaded_chapters?id=eq.${encodeURIComponent(upload.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: "approved",
        approved_at: upload.approvedAt,
      }),
    });
  } catch (err) {
    console.warn("审批同步失败:", err);
    const reason = String(err.message).includes("403")
      ? "没有管理员权限，审批失败"
      : "云端同步失败，下次打开会自动重试";
    alert(`审批已保存在本机，${reason}`);
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

// ---------- 本地存储 ----------
function loadList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (err) {
    console.warn(`读取本地数据失败: ${key}`, err);
    return [];
  }
}

function saveList(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`保存本地数据失败: ${key}`, err);
  }
}

function resetUploadForm() {
  chapterNameInput.value = "";
  chapterNumberInput.value = "";
  chapterFileInput.value = "";
  fileNameText.textContent = "选择 .md 文件";
  filePicker.classList.remove("filled");
}

// ---------- 阅读 ----------
async function openChapter(chapter) {
  openReader(chapter.title, `./${chapter.file}`);
}

async function openLocalChapter(upload) {
  openReader(`第${upload.number}章 ${upload.name}`, null, upload.content);
}

async function openReader(fallbackTitle, fileUrl, inlineContent) {
  main.classList.remove("active");
  readerScreen.classList.add("active");
  readerTitle.textContent = "加载中…";
  readerBody.textContent = "";

  try {
    let text = inlineContent;
    if (text == null) {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    }

    const heading = text.match(/^#\s+(.+)$/m);
    readerTitle.textContent = heading ? heading[1] : fallbackTitle;
    readerBody.textContent = text.replace(/^#\s+.+\n?/, "").trimStart();
  } catch (err) {
    console.warn("加载章节失败:", err);
    readerTitle.textContent = fallbackTitle;
    readerBody.textContent = "章节加载失败，请稍后重试。";
  }
}

loadChapters();
initCloudSync();

// ---------- PWA ----------
if ("serviceWorker" in navigator) {
  let autoRefreshed = false;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      })
      .catch((err) => console.warn("Service Worker 注册失败:", err));
  });

  // 新版本就绪后自动刷新一次，避免手动刷新两遍
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (autoRefreshed) return;
    autoRefreshed = true;
    window.location.reload();
  });
}
