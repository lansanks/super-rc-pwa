const home = document.getElementById("home");
const main = document.getElementById("main");
const enterHint = document.querySelector(".enter-hint");
const backBtn = document.getElementById("backBtn");
const uploadBtn = document.getElementById("uploadBtn");

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

// PWA Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.warn("Service Worker 注册失败:", err));
  });
}
