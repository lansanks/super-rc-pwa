(function () {
  "use strict";

  let graph = null;

  window.initCharacterGraph = async function initCharacterGraph() {
    if (!window.THREE) throw new Error("3D 引擎不可用");
    if (graph) {
      graph.resize();
      return graph;
    }
    graph = await CharacterGraph.create();
    return graph;
  };

  class CharacterGraph {
    static async create() {
      const res = await fetchWithTimeout("./人物设定.md", {}, 10000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = parseCharacters(await res.text());
      return new CharacterGraph(data);
    }

    constructor(data) {
      this.container = document.getElementById("char3d");
      this.detailEl = document.getElementById("charDetail");
      this.selected = null;
      this.spheres = [];

      const { nodes, edges } = this.buildGraphData(data);
      this.nodes = nodes;
      this.edges = edges;

      this.initThree();
      this.layoutNodes();
      this.buildScene();
      this.bindEvents();
      this.resize();
      this.animate();
    }

    buildGraphData(data) {
      const nodeMap = new Map();
      const edges = [];
      const groupColors = {
        "主角": 0xffffff,
        "江城理工战队": 0x67e8f9,
        "对手阵营": 0xc084fc,
        "赞助与学校线": 0xfbbf24,
      };

      const addNode = (name, opts = {}) => {
        if (!nodeMap.has(name)) {
          nodeMap.set(name, {
            id: name,
            name,
            subtitle: opts.subtitle || "",
            fields: opts.fields || [],
            paragraphs: opts.paragraphs || [],
            relations: [],
            color: opts.color || 0x94a3b8,
            extra: Boolean(opts.extra),
          });
        }
        return nodeMap.get(name);
      };

      for (const section of data.sections) {
        const color = groupColors[section.title] || 0x94a3b8;
        for (const ch of section.characters) {
          const m = ch.title.match(/^(.*?)（(.*)）$/);
          addNode(m ? m[1] : ch.title, {
            subtitle: m ? m[2] : "",
            fields: ch.fields,
            paragraphs: ch.paragraphs,
            color,
          });
        }
      }

      for (const section of data.sections) {
        for (const line of section.relations) {
          const parts = line
            .split("──")
            .map((s) => s.trim())
            .filter(Boolean);
          for (let i = 0; i + 2 < parts.length; i += 2) {
            const a = addNode(parts[i], { extra: true });
            const b = addNode(parts[i + 2], { extra: true });
            const label = parts[i + 1];
            edges.push({ a: a.id, b: b.id, label });
            a.relations.push({ other: b.id, label });
            b.relations.push({ other: a.id, label });
          }
        }
      }

      return { nodes: Array.from(nodeMap.values()), edges };
    }

    initThree() {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x070b12);
      this.scene.fog = new THREE.FogExp2(0x070b12, 0.016);

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;
      this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
      this.camera.position.set(0, 4, 16);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height);
      this.container.appendChild(this.renderer.domElement);

      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.8;
      this.controls.minDistance = 5;
      this.controls.maxDistance = 40;

      this.scene.add(new THREE.AmbientLight(0x8899bb, 0.7));
      const cyan = new THREE.PointLight(0x67e8f9, 1.1, 50);
      cyan.position.set(9, 8, 9);
      const violet = new THREE.PointLight(0xc084fc, 0.8, 50);
      violet.position.set(-9, -5, 7);
      this.scene.add(cyan, violet);

      const starCount = 320;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i++) {
        starPos[i] = (Math.random() - 0.5) * 90;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      this.scene.add(
        new THREE.Points(
          starGeo,
          new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.08,
            transparent: true,
            opacity: 0.5,
          })
        )
      );
    }

    layoutNodes() {
      const nodes = this.nodes;
      const pos = new Map();
      let seed = 20260801;
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };

      for (const n of nodes) {
        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        const r = 7 + rand() * 3;
        n.pos = new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi) * 0.75,
          r * Math.sin(phi) * Math.sin(theta)
        );
        pos.set(n.id, n.pos);
      }

      const tmp = new THREE.Vector3();
      for (let iter = 0; iter < 160; iter++) {
        const forces = new Map();
        for (const n of nodes) forces.set(n.id, new THREE.Vector3());

        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            tmp.copy(a.pos).sub(b.pos);
            const d = Math.max(tmp.length(), 0.01);
            const f = tmp.normalize().multiplyScalar(0.55 / (d * d + 0.02));
            forces.get(a.id).add(f);
            forces.get(b.id).sub(f);
          }
        }

        for (const e of this.edges) {
          const a = pos.get(e.a);
          const b = pos.get(e.b);
          if (!a || !b) continue;
          tmp.copy(b).sub(a);
          const d = Math.max(tmp.length(), 0.01);
          const f = tmp.normalize().multiplyScalar((d - 5.4) * 0.045);
          forces.get(e.a).add(f);
          forces.get(e.b).sub(f);
        }

        for (const n of nodes) {
          const f = forces.get(n.id);
          f.add(n.pos.clone().multiplyScalar(-0.012));
          n.pos.add(f).clampLength(0, 13);
        }
      }
    }

    buildScene() {
      this.glowTex = this.makeGlowTexture();
      this.nodeObjects = new Map();

      for (const n of this.nodes) {
        const group = new THREE.Group();
        group.position.copy(n.pos);

        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTex,
            color: n.color,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        glow.scale.set(2.8, 2.8, 1);
        group.add(glow);

        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 24, 24),
          new THREE.MeshBasicMaterial({ color: n.color })
        );
        group.add(sphere);
        sphere.userData.nodeId = n.id;
        this.spheres.push(sphere);

        const label = this.makeLabel(n.name);
        label.position.set(0, 0.95, 0);
        group.add(label);

        n.group = group;
        n.glow = glow;
        n.sphere = sphere;
        this.nodeObjects.set(n.id, n);
        this.scene.add(group);
      }

      this.lineGroup = new THREE.Group();
      for (const e of this.edges) {
        const a = this.nodeObjects.get(e.a);
        const b = this.nodeObjects.get(e.b);
        if (!a || !b) continue;
        const geo = new THREE.BufferGeometry().setFromPoints([a.pos, b.pos]);
        const mat = new THREE.LineBasicMaterial({
          color: 0x8ab6ff,
          transparent: true,
          opacity: 0.4,
        });
        const line = new THREE.Line(geo, mat);
        line.userData = { a: e.a, b: e.b };
        this.lineGroup.add(line);
      }
      this.scene.add(this.lineGroup);
    }

    makeGlowTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d");
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.6)");
      g.addColorStop(0.6, "rgba(255,255,255,0.15)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(canvas);
    }

    makeLabel(name) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 512, 128);
      ctx.font = "600 52px -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#eef2ff";
      ctx.fillText(name, 256, 66);

      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
      );
      const w = 0.9 + name.length * 0.34;
      sprite.scale.set(w, 0.8, 1);
      return sprite;
    }

    bindEvents() {
      const dom = this.renderer.domElement;
      let downX = 0;
      let downY = 0;
      let downT = 0;

      dom.addEventListener("pointerdown", (e) => {
        downX = e.clientX;
        downY = e.clientY;
        downT = Date.now();
      });

      dom.addEventListener("pointerup", (e) => {
        const dx = e.clientX - downX;
        const dy = e.clientY - downY;
        if (Math.hypot(dx, dy) > 8 || Date.now() - downT > 500) return;
        this.pick(e);
      });

      window.addEventListener("resize", () => this.resize());
      document
        .getElementById("charactersBackBtn")
        .addEventListener("click", () => this.hideDetail());
      this.detailEl.addEventListener("click", (e) => {
        if (e.target.closest(".char-detail-close")) this.hideDetail();
      });
    }

    pick(event) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, this.camera);
      const hits = raycaster.intersectObjects(this.spheres, false);
      if (hits.length) {
        const id = hits[0].object.userData.nodeId;
        this.selectNode(this.nodeObjects.get(id));
      } else {
        this.hideDetail();
      }
    }

    selectNode(node) {
      this.selected = node;
      for (const n of this.nodes) {
        const active = n === node;
        n.group.scale.setScalar(active ? 1.4 : 1);
        n.glow.material.opacity = active ? 1 : 0.75;
        n.sphere.material.color.setHex(active ? 0xffffff : n.color);
      }
      for (const line of this.lineGroup.children) {
        const connected = line.userData.a === node.id || line.userData.b === node.id;
        line.material.opacity = connected ? 0.95 : 0.12;
        line.material.color.setHex(connected ? 0xffffff : 0x8ab6ff);
      }
      this.controls.autoRotate = false;
      this.renderDetail(node);
    }

    hideDetail() {
      this.selected = null;
      this.detailEl.hidden = true;
      for (const n of this.nodes) {
        n.group.scale.setScalar(1);
        n.glow.material.opacity = 0.75;
        n.sphere.material.color.setHex(n.color);
      }
      for (const line of this.lineGroup.children) {
        line.material.opacity = 0.4;
        line.material.color.setHex(0x8ab6ff);
      }
      this.controls.autoRotate = true;
    }

    renderDetail(node) {
      this.detailEl.innerHTML = "";

      const head = document.createElement("div");
      head.className = "char-detail-head";
      const name = document.createElement("span");
      name.className = "char-detail-name";
      name.textContent = node.name;
      const sub = document.createElement("span");
      sub.className = "char-detail-sub";
      sub.textContent = node.subtitle;
      head.appendChild(name);
      if (node.subtitle) head.appendChild(sub);
      this.detailEl.appendChild(head);

      const fields = document.createElement("div");
      fields.className = "char-detail-fields";
      for (const f of node.fields) {
        const row = document.createElement("div");
        row.className = "char-detail-field";
        const key = document.createElement("span");
        key.className = "char-detail-key";
        key.textContent = f.key;
        const value = document.createElement("span");
        value.className = "char-detail-value";
        value.textContent = f.value;
        row.appendChild(key);
        row.appendChild(value);
        fields.appendChild(row);
      }
      this.detailEl.appendChild(fields);

      for (const p of node.paragraphs) {
        const para = document.createElement("p");
        para.className = "char-detail-para";
        para.textContent = p;
        this.detailEl.appendChild(para);
      }

      if (node.relations.length) {
        const rel = document.createElement("div");
        rel.className = "char-detail-rel";
        const title = document.createElement("div");
        title.className = "char-detail-rel-title";
        title.textContent = "关系";
        rel.appendChild(title);
        for (const r of node.relations) {
          const row = document.createElement("div");
          row.className = "char-detail-rel-row";
          row.textContent = `${node.name} —— ${r.label} —— ${r.other}`;
          rel.appendChild(row);
        }
        this.detailEl.appendChild(rel);
      }

      const close = document.createElement("button");
      close.className = "char-detail-close";
      close.textContent = "关闭";
      this.detailEl.appendChild(close);

      this.detailEl.hidden = false;
      this.detailEl.scrollTop = 0;
    }

    resize() {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }

    animate() {
      this.renderer.setAnimationLoop(() => {
        if (this.container.offsetParent === null) return;
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
      });
    }
  }
})();
