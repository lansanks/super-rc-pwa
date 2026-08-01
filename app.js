const home = document.getElementById("home");
const main = document.getElementById("main");
const enterHint = document.querySelector(".enter-hint");
const backBtn = document.getElementById("backBtn");
const uploadBtn = document.getElementById("uploadBtn");
const chapterList = document.getElementById("chapterList");
const reader = document.getElementById("reader");
const readerBackBtn = document.getElementById("readerBackBtn");
const readerTitle = document.getElementById("readerTitle");
const readerBody = document.getElementById("readerBody");

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
  reader.classList.remove("active");
  main.classList.add("active");
});

// 上传按钮：可点击，逻辑后面再写
uploadBtn.addEventListener("click", () => {
  console.log("点击上传");
});

// 加载章节列表
async function loadChapters() {
  try {
    const res = await fetch("./chapters.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const chapters = await res.json();
    renderChapters(chapters);
  } catch (err) {
    console.warn("加载章节列表失败:", err);
    renderChapters([]);
  }
}

function renderChapters(chapters) {
  chapterList.innerHTML = "";

  if (!chapters.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "暂无章节";
    chapterList.appendChild(li);
    return;
  }

  for (const [index, chapter] of chapters.entries()) {
    const li = document.createElement("li");
    li.className = "chapter-item";
    li.textContent = chapter.title;
    li.dataset.file = chapter.file;

    if (index < 4) {
      li.classList.add("clickable");
      li.addEventListener("click", () => openChapter(chapter));
    } else {
      li.classList.add("locked");
      const hint = document.createElement("span");
      hint.className = "lock-hint";
      hint.textContent = "未解锁";
      li.appendChild(hint);
    }

    chapterList.appendChild(li);
  }
}

// 进入阅读页并加载章节正文
async function openChapter(chapter) {
  main.classList.remove("active");
  reader.classList.add("active");
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
