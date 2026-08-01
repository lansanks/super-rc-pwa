(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  let graph = null;

  window.initCharacterGraph2D = async function initCharacterGraph2D() {
    if (graph) {
      graph.fit();
      return graph;
    }
    const res = await fetchWithTimeout("./人物设定.md", {}, 10000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = parseCharacters(await res.text());
    graph = new Graph2D(data);
    return graph;
  };

  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      el.setAttribute(key, value);
    }
    return el;
  }

  class Graph2D {
    constructor(data) {
      this.svg = document.getElementById("char2dSvg");
      this.detail = document.getElementById("char2dDetail");
      this.nodes = [];
      this.nodeById = new Map();
      this.edges = [];
      this.lines = [];
      this.selected = null;
      this.view = { x: 0, y: 0, w: 800, h: 600 };

      this.buildGraphData(data);
      this.layout();
      this.render();
      this.fit();
      this.bind();
    }

    buildGraphData(data) {
      const nodeMap = new Map();

      const addNode = (name, opts = {}) => {
        if (!nodeMap.has(name)) {
          nodeMap.set(name, {
            id: name,
            name,
            subtitle: opts.subtitle || "",
            fields: opts.fields || [],
            paragraphs: opts.paragraphs || [],
            relations: [],
          });
        }
        return nodeMap.get(name);
      };

      for (const section of data.sections) {
        for (const ch of section.characters) {
          const m = ch.title.match(/^(.*?)（(.*)）$/);
          addNode(m ? m[1] : ch.title, {
            subtitle: m ? m[2] : "",
            fields: ch.fields,
            paragraphs: ch.paragraphs,
          });
        }
      }

      // 关系文本里的端点归一化：
      // - 去掉「（备注）」后缀，连接到真实人物节点
      // - 把 “A + B” 拆成两条边
      // - 把 “A/B” 别名归一到已有节点
      const splitEndpoints = (raw) => {
        const parts = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < raw.length; i++) {
          const ch = raw[i];
          if (ch === "（" || ch === "(") depth += 1;
          else if (ch === "）" || ch === ")") depth = Math.max(0, depth - 1);
          else if (ch === "+" && depth === 0) {
            parts.push(raw.slice(start, i));
            start = i + 1;
          }
        }
        parts.push(raw.slice(start));
        return parts;
      };

      const resolveEndpoint = (raw) => {
        const trimmed = raw.trim();
        const base = trimmed.replace(/[（(].*?[）)]/g, "").trim();
        const candidates = base
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean);
        for (const candidate of candidates) {
          if (nodeMap.has(candidate)) return nodeMap.get(candidate);
        }
        const title = candidates[0] || base || trimmed;
        const sub = trimmed.match(/[（(](.*?)[）)]/);
        return addNode(title, { subtitle: sub ? sub[1] : "" });
      };

      const addRelation = (aRaw, bRaw, label) => {
        const a = resolveEndpoint(aRaw);
        if (!a) return;
        for (const part of splitEndpoints(bRaw)) {
          const b = resolveEndpoint(part);
          if (!b || a.id === b.id) continue;
          this.edges.push({ a: a.id, b: b.id, label });
          a.relations.push({ other: b.id, label });
          b.relations.push({ other: a.id, label });
        }
      };

      for (const section of data.sections) {
        for (const line of section.relations) {
          const parts = line
            .split("──")
            .map((s) => s.trim())
            .filter(Boolean);
          for (let i = 0; i + 2 < parts.length; i += 2) {
            addRelation(parts[i], parts[i + 2], parts[i + 1]);
          }
        }
      }

      this.nodes = Array.from(nodeMap.values());
      for (const n of this.nodes) this.nodeById.set(n.id, n);
    }

    layout() {
      let seed = 20260802;
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };

      for (const n of this.nodes) {
        const angle = rand() * Math.PI * 2;
        const r = 120 + rand() * 120;
        n.x = Math.cos(angle) * r;
        n.y = Math.sin(angle) * r;
      }

      for (let iter = 0; iter < 260; iter++) {
        const fx = {};
        const fy = {};
        for (const n of this.nodes) {
          fx[n.id] = 0;
          fy[n.id] = 0;
        }

        for (let i = 0; i < this.nodes.length; i++) {
          for (let j = i + 1; j < this.nodes.length; j++) {
            const a = this.nodes[i];
            const b = this.nodes[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            const d = Math.max(Math.hypot(dx, dy), 1);
            dx /= d;
            dy /= d;
            const f = 4200 / (d * d + 48);
            fx[a.id] += dx * f;
            fy[a.id] += dy * f;
            fx[b.id] -= dx * f;
            fy[b.id] -= dy * f;
          }
        }

        for (const e of this.edges) {
          const a = this.nodeById.get(e.a);
          const b = this.nodeById.get(e.b);
          if (!a || !b) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const d = Math.max(Math.hypot(dx, dy), 1);
          dx /= d;
          dy /= d;
          const f = (d - 160) * 0.06;
          fx[a.id] += dx * f;
          fy[a.id] += dy * f;
          fx[b.id] -= dx * f;
          fy[b.id] -= dy * f;
        }

        for (const n of this.nodes) {
          n.x += fx[n.id] - n.x * 0.01;
          n.y += fy[n.id] - n.y * 0.01;
        }
      }

      // 标签防重叠：把名字框互相压住的节点沿连线方向推开
      const labelWidth = (n) => n.name.length * 12 + 6;
      for (let iter = 0; iter < 120; iter++) {
        let moved = false;
        for (let i = 0; i < this.nodes.length; i++) {
          for (let j = i + 1; j < this.nodes.length; j++) {
            const a = this.nodes[i];
            const b = this.nodes[j];
            const ax = a.x;
            const ay = a.y - 20;
            const aw = labelWidth(a);
            const bx = b.x;
            const by = b.y - 20;
            const bw = labelWidth(b);
            const ox = Math.min(ax + aw, bx + bw) - Math.max(ax, bx);
            const oy = Math.min(ay + 18, by + 18) - Math.max(ay, by);
            if (ox > 0 && oy > 0) {
              let dx = b.x - a.x;
              let dy = b.y - a.y;
              const d = Math.max(Math.hypot(dx, dy), 1);
              dx /= d;
              dy /= d;
              if (d < 1) {
                dx = 1;
                dy = 0;
              }
              const push = Math.min(Math.max(ox, oy), 6) * 0.5;
              a.x -= dx * push;
              a.y -= dy * push;
              b.x += dx * push;
              b.y += dy * push;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
    }

    render() {
      this.svg.innerHTML = "";

      this.lines = [];
      for (const e of this.edges) {
        const a = this.nodeById.get(e.a);
        const b = this.nodeById.get(e.b);
        if (!a || !b) continue;
        const line = svgEl("line", {
          class: "char2d-line",
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
        });
        this.svg.appendChild(line);
        this.lines.push({ el: line, a: e.a, b: e.b });
      }

      for (const e of this.edges) {
        const a = this.nodeById.get(e.a);
        const b = this.nodeById.get(e.b);
        if (!a || !b) continue;
        const label = svgEl("text", {
          class: "char2d-edge-label",
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2 - 5,
          "text-anchor": "middle",
        });
        label.textContent = e.label;
        this.svg.appendChild(label);
      }

      for (const n of this.nodes) {
        const g = svgEl("g", {
          class: "char2d-node",
          "data-id": n.id,
          transform: `translate(${n.x}, ${n.y})`,
        });
        g.appendChild(svgEl("circle", { r: 6 }));
        const text = svgEl("text", { x: 0, y: -14, "text-anchor": "middle" });
        text.textContent = n.name;
        g.appendChild(text);
        this.svg.appendChild(g);
        n.el = g;
      }
    }

    fit() {
      if (!this.nodes.length) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of this.nodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x);
        maxY = Math.max(maxY, n.y);
      }
      const pad = 110;
      const w = Math.max(maxX - minX + pad * 2, 320);
      const h = Math.max(maxY - minY + pad * 2, 260);
      this.view = {
        x: minX - pad,
        y: minY - pad,
        w,
        h,
      };
      this.applyView();
    }

    applyView() {
      const v = this.view;
      this.svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    }

    bind() {
      const svg = this.svg;
      let down = null;
      let moved = false;
      this.pointers = new Map();

      svg.addEventListener("pointerdown", (e) => {
        down = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
        moved = false;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        svg.setPointerCapture(e.pointerId);
      });

      svg.addEventListener("pointermove", (e) => {
        if (!down) return;
        const prev = this.pointers.get(e.pointerId);
        if (!prev) return;
        const cur = { x: e.clientX, y: e.clientY };

        if (this.pointers.size === 2) {
          const other = Array.from(this.pointers.entries()).find(
            ([id]) => id !== e.pointerId
          )[1];
          const oldDist = Math.hypot(prev.x - other.x, prev.y - other.y);
          const newDist = Math.hypot(cur.x - other.x, cur.y - other.y);
          if (oldDist > 0 && newDist > 0) {
            const rect = svg.getBoundingClientRect();
            const mx = (cur.x + other.x) / 2;
            const my = (cur.y + other.y) / 2;
            const px = (mx - rect.left) / rect.width;
            const py = (my - rect.top) / rect.height;
            const k = oldDist / newDist;
            const nw = Math.min(Math.max(this.view.w * k, 120), 6000);
            const nh = this.view.h * (nw / this.view.w);
            const wx = this.view.x + px * this.view.w;
            const wy = this.view.y + py * this.view.h;
            this.view = { x: wx - px * nw, y: wy - py * nh, w: nw, h: nh };
            this.applyView();
          }
          moved = true;
        }

        this.pointers.set(e.pointerId, cur);
        if (moved || this.pointers.size > 1) return;

        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) > 4) moved = true;
        if (!moved) return;
        const rect = svg.getBoundingClientRect();
        this.view.x = down.vx - (dx * this.view.w) / rect.width;
        this.view.y = down.vy - (dy * this.view.h) / rect.height;
        this.applyView();
      });

      const endPointer = (e) => {
        this.pointers.delete(e.pointerId);
        if (down && !moved) {
          const target = document.elementFromPoint(e.clientX, e.clientY);
          const nodeEl = target && target.closest ? target.closest(".char2d-node") : null;
          if (nodeEl) {
            this.select(nodeEl.getAttribute("data-id"));
          } else {
            this.hideDetail();
          }
        }
        if (this.pointers.size === 0) down = null;
      };
      svg.addEventListener("pointerup", endPointer);
      svg.addEventListener("pointercancel", endPointer);

      svg.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const rect = svg.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width;
          const py = (e.clientY - rect.top) / rect.height;
          const k = e.deltaY > 0 ? 1.12 : 0.9;
          const nw = Math.min(Math.max(this.view.w * k, 120), 6000);
          const nh = this.view.h * (nw / this.view.w);
          const wx = this.view.x + px * this.view.w;
          const wy = this.view.y + py * this.view.h;
          this.view = { x: wx - px * nw, y: wy - py * nh, w: nw, h: nh };
          this.applyView();
        },
        { passive: false }
      );

      this.detail.addEventListener("click", (e) => {
        if (e.target.closest(".char2d-detail-close")) this.hideDetail();
      });
    }

    select(id) {
      const node = this.nodeById.get(id);
      if (!node) return;
      this.selected = node;

      for (const n of this.nodes) {
        n.el.classList.toggle("selected", n.id === id);
      }
      for (const line of this.lines) {
        const on = line.a === id || line.b === id;
        line.el.style.opacity = on ? 1 : 0.12;
        line.el.style.stroke = on ? "#1a1a1a" : "rgba(26, 26, 26, 0.2)";
      }
      this.renderDetail(node);
    }

    hideDetail() {
      this.selected = null;
      this.detail.hidden = true;
      for (const n of this.nodes) {
        n.el.classList.remove("selected");
      }
      for (const line of this.lines) {
        line.el.style.opacity = "";
        line.el.style.stroke = "";
      }
    }

    renderDetail(node) {
      this.detail.innerHTML = "";

      const head = document.createElement("div");
      head.className = "char2d-detail-head";
      const name = document.createElement("span");
      name.className = "char2d-detail-name";
      name.textContent = node.name;
      const sub = document.createElement("span");
      sub.className = "char2d-detail-sub";
      sub.textContent = node.subtitle;
      head.appendChild(name);
      if (node.subtitle) head.appendChild(sub);
      this.detail.appendChild(head);

      const fields = document.createElement("div");
      fields.className = "char2d-detail-fields";
      for (const f of node.fields) {
        const row = document.createElement("div");
        row.className = "char2d-detail-field";
        const key = document.createElement("span");
        key.className = "char2d-detail-key";
        key.textContent = f.key;
        const value = document.createElement("span");
        value.className = "char2d-detail-value";
        value.textContent = f.value;
        row.appendChild(key);
        row.appendChild(value);
        fields.appendChild(row);
      }
      this.detail.appendChild(fields);

      for (const p of node.paragraphs) {
        const para = document.createElement("p");
        para.className = "char2d-detail-para";
        para.textContent = p;
        this.detail.appendChild(para);
      }

      if (node.relations.length) {
        const rel = document.createElement("div");
        rel.className = "char2d-detail-rel";
        const title = document.createElement("div");
        title.className = "char2d-detail-rel-title";
        title.textContent = "关系";
        rel.appendChild(title);
        for (const r of node.relations) {
          const row = document.createElement("div");
          row.className = "char2d-detail-rel-row";
          row.textContent = `${node.name} —— ${r.label} —— ${r.other}`;
          rel.appendChild(row);
        }
        this.detail.appendChild(rel);
      }

      const close = document.createElement("button");
      close.className = "char2d-detail-close";
      close.textContent = "关闭";
      this.detail.appendChild(close);

      this.detail.hidden = false;
      this.detail.scrollTop = 0;
    }
  }
})();
