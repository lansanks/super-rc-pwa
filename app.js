const home = document.getElementById("home");
const main = document.getElementById("main");
const enterHint = document.querySelector(".enter-hint");
const backBtn = document.getElementById("backBtn");
const uploadBtn = document.getElementById("uploadBtn");
const chapterList = document.getElementById("chapterList");

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

// 上传按钮：可点击，逻辑后面再写
uploadBtn.addEventListener("click", () => {
  console.log("点击上传");
});

// 加载章节列表（先显示前 4 章）
async function loadChapters() {
  try {
    const res = await fetch("./chapters.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const chapters = await res.json();
    renderChapters(chapters.slice(0, 4));
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

  for (const chapter of chapters) {
    const li = document.createElement("li");
    li.className = "chapter-item";
    li.textContent = chapter.title;
    li.dataset.file = chapter.file;
    chapterList.appendChild(li);
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
