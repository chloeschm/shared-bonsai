
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBoTMRMSnuxU6v-f6bETJNJGYLribwToc0",
  authDomain: "shared-bonsai.firebaseapp.com",
  databaseURL: "https://shared-bonsai-default-rtdb.firebaseio.com",
  projectId: "shared-bonsai",
  storageBucket: "shared-bonsai.firebasestorage.app",
  messagingSenderId: "48935253199",
  appId: "1:48935253199:web:bbc77939a30708cf3973ba"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Bonsai Skeleton Definition ---
// All values are proportional (0-1) and will be scaled to actual canvas size at render time.
// Origin (0.5, 0.85) is the base of trunk (center, near bottom).
// Positive X = right, Negative Y = up.
// These define the FIXED structure of the bonsai â€” it never changes.
function getBonsaiSkeleton() {
  // The skeleton is a list of branch segments:
  // { x1, y1, x2, y2, width, cpx, cpy } â€” all proportional (0-1)
  // cpx/cpy = quadratic bezier control point for natural curves
  // "tips" are the endpoints of branches that have no children â€” foliage grows there
  return {
    segments: [
      // Main trunk (S-curve from base, slight lean right then up)
      { id: 's1', x1: 0.50, y1: 0.85, x2: 0.51, y2: 0.72, cpx: 0.48, cpy: 0.78, width: 14 },
      { id: 's2', x1: 0.51, y1: 0.72, x2: 0.52, y2: 0.62, cpx: 0.54, cpy: 0.67, width: 11 },
      { id: 's3', x1: 0.52, y1: 0.62, x2: 0.50, y2: 0.52, cpx: 0.50, cpy: 0.57, width: 9 },
      { id: 's4', x1: 0.50, y1: 0.52, x2: 0.48, y2: 0.43, cpx: 0.46, cpy: 0.47, width: 7 },

      // Left primary branch (low, horizontal, then slightly down â€” typical bonsai)
      { id: 'l1', x1: 0.51, y1: 0.72, x2: 0.32, y2: 0.70, cpx: 0.42, cpy: 0.68, width: 7 },
      { id: 'l2', x1: 0.32, y1: 0.70, x2: 0.22, y2: 0.73, cpx: 0.27, cpy: 0.69, width: 5 },
      { id: 'l3', x1: 0.22, y1: 0.73, x2: 0.15, y2: 0.70, cpx: 0.18, cpy: 0.72, width: 3 },

      // Right primary branch (slightly above left)
      { id: 'r1', x1: 0.52, y1: 0.62, x2: 0.68, y2: 0.60, cpx: 0.60, cpy: 0.59, width: 6 },
      { id: 'r2', x1: 0.68, y1: 0.60, x2: 0.78, y2: 0.63, cpx: 0.73, cpy: 0.59, width: 4 },
      { id: 'r3', x1: 0.78, y1: 0.63, x2: 0.84, y2: 0.61, cpx: 0.81, cpy: 0.61, width: 2.5 },

      // Left upper branch
      { id: 'lu1', x1: 0.50, y1: 0.52, x2: 0.36, y2: 0.48, cpx: 0.43, cpy: 0.48, width: 5 },
      { id: 'lu2', x1: 0.36, y1: 0.48, x2: 0.27, y2: 0.46, cpx: 0.31, cpy: 0.46, width: 3 },

      // Right upper branch
      { id: 'ru1', x1: 0.48, y1: 0.43, x2: 0.60, y2: 0.38, cpx: 0.54, cpy: 0.39, width: 4 },
      { id: 'ru2', x1: 0.60, y1: 0.38, x2: 0.68, y2: 0.35, cpx: 0.64, cpy: 0.36, width: 2.5 },

      // Apex â€” top center (slightly left-leaning, typical bonsai apex)
      { id: 'ap', x1: 0.50, y1: 0.43, x2: 0.49, y2: 0.33, cpx: 0.47, cpy: 0.38, width: 3 },
    ],
    // Foliage tip positions (proportional).
    // dx/dy bias is now mostly horizontal (bonsai foliage spreads wide).
    // vertBias: small random vertical offset per tip baked into rendering seed
    tips: [
      { x: 0.15, y: 0.70, dx: -1, dy: 0, vertBias: 0.1, id: 'l3' },  // Far left
      { x: 0.27, y: 0.46, dx: -0.8, dy: 0, vertBias: -0.1, id: 'lu2' },  // Upper left
      { x: 0.84, y: 0.61, dx: 1, dy: 0, vertBias: 0.15, id: 'r3' },  // Far right
      { x: 0.68, y: 0.35, dx: 0.7, dy: 0, vertBias: -0.15, id: 'ru2' },  // Upper right
      { x: 0.49, y: 0.33, dx: 0, dy: -0.4, vertBias: -0.2, id: 'ap' },  // Apex (slightly up)
    ]
  };
}

class SharedBonsai {
  constructor() {
    this.treeCode = localStorage.getItem('bonsaiCode');
    this.canvas = document.getElementById("treeCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.currentTree = null;
    this.skeleton = getBonsaiSkeleton();
    this.lastKnownAge = null; // for detecting remote waterings

    this.resizeCanvas();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      if (this.currentTree) this.renderTree(this.currentTree);
    });

    this.ui = {
      welcomeValues: document.getElementById('join-screen'),
      mainApp: document.getElementById('tree-screen'),
      codeInput: document.getElementById('codeInput'),
      joinBtn: document.getElementById('joinBtn'),
      createBtn: document.getElementById('createBtn'),
      growBtn: document.getElementById('growBtn'),
      trimBtn: document.getElementById('trimBtn'),
      leaveBtn: document.getElementById('leaveBtn'),
      treeCodeDisplay: document.getElementById('codeValue'),
      healthValue: document.getElementById('healthValue')
    };

    this.bindEvents();
    if (this.treeCode) {
      this.joinTree(this.treeCode);
    } else {
      this.showWelcome();
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight * 0.65;
  }

  bindEvents() {
    if (this.ui.createBtn) this.ui.createBtn.addEventListener('click', () => this.createTree());
    if (this.ui.joinBtn) this.ui.joinBtn.addEventListener('click', () => {
      const code = this.ui.codeInput.value.toUpperCase();
      if (code.length === 5) this.joinTree(code);
      else alert("Please enter a valid 5-character code.");
    });
    if (this.ui.growBtn) this.ui.growBtn.addEventListener('click', () => this.grow());
    if (this.ui.trimBtn) this.ui.trimBtn.addEventListener('click', () => this.trim());
    if (this.ui.leaveBtn) this.ui.leaveBtn.addEventListener('click', () => {
      if (confirm("Leave this tree? You can rejoin with your code.")) this.leaveTree();
    });
  }

  leaveTree() {
    localStorage.removeItem('bonsaiCode');
    window.location.reload();
  }

  generateCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  createTree() {
    const code = this.generateCode();
    // tipDensities: one value per tip in skeleton.tips order.
    // Each starts at 1 and grows independently.
    const numTips = getBonsaiSkeleton().tips.length;
    const tipDensities = Array(numTips).fill(1);
    set(ref(db, `trees/${code}`), {
      tipDensities,
      health: 100,
      age: 0,
      lastWateredBy: null,
      lastInteraction: Date.now()
    }).then(() => this.joinTree(code));
  }

  joinTree(code) {
    this.treeCode = code;
    localStorage.setItem('bonsaiCode', code);
    const treeRef = ref(db, `trees/${code}`);

    // Passive auto-growth: every 4 hours, nudge one random tip
    this.startPassiveGrowth();

    onValue(treeRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Migration: old format (branches/foliageDensity/nodes) â€” reset
        if (data.nodes || data.branches !== undefined || data.foliageDensity !== undefined) {
          this.resetTreeData(code);
          return;
        }
        // Detect remote watering: if age went up and we didn't cause it
        if (this.lastKnownAge !== null && data.age > this.lastKnownAge && !this._justWatered) {
          this.showToast('🌿 Your bonsai was just watered!');
        }
        this._justWatered = false;
        this.lastKnownAge = data.age;

        this.currentTree = data;
        this.updateUI(data);
        this.renderTree(data);
      } else {
        alert("Tree not found!");
        this.leaveTree();
      }
    });
  }

  startPassiveGrowth() {
    // Guard: don't start multiple intervals on reconnect
    if (this._growthInterval) return;
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    this._growthInterval = setInterval(() => {
      if (!this.treeCode) return;
      const treeRef = ref(db, `trees/${this.treeCode}`);
      runTransaction(treeRef, (tree) => {
        if (!tree || !tree.tipDensities) return tree;
        const i = Math.floor(Math.random() * tree.tipDensities.length);
        tree.tipDensities[i] = Math.min((tree.tipDensities[i] || 1) + 1, 40);
        tree.lastInteraction = Date.now();
        return tree;
      });
    }, FOUR_HOURS);
  }

  showToast(msg) {
    let toast = document.getElementById('bonsai-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bonsai-toast';
      toast.style.cssText = [
        'position:fixed', 'bottom:100px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(50,80,20,0.92)', 'color:#e8f5c8', 'padding:10px 20px',
        'border-radius:20px', 'font-size:0.95rem', 'z-index:999',
        'box-shadow:0 4px 12px rgba(0,0,0,0.25)', 'transition:opacity 0.5s'
      ].join(';');
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
  }

  resetTreeData(code) {
    const numTips = getBonsaiSkeleton().tips.length;
    set(ref(db, `trees/${code}`), {
      tipDensities: Array(numTips).fill(1),
      health: 100,
      age: 0,
      lastWateredBy: null,
      lastInteraction: Date.now()
    });
  }

  updateUI(tree) {
    this.ui.welcomeValues.classList.add('hidden');
    this.ui.mainApp.classList.remove('hidden');
    this.ui.welcomeValues.style.display = 'none';
    this.ui.mainApp.style.display = 'flex';
    this.ui.treeCodeDisplay.innerText = this.treeCode;
    if (this.ui.healthValue) this.ui.healthValue.innerText = Math.round(tree.health);
  }

  showWelcome() {
    this.ui.welcomeValues.classList.remove('hidden');
    this.ui.mainApp.classList.add('hidden');
    this.ui.welcomeValues.style.display = 'flex';
    this.ui.mainApp.style.display = 'none';
  }

  grow() {
    if (!this.treeCode) return;
    this._justWatered = true;
    const treeRef = ref(db, `trees/${this.treeCode}`);
    runTransaction(treeRef, (tree) => {
      if (!tree || !tree.tipDensities) return tree;
      const tips = tree.tipDensities;
      const numTips = tips.length;
      // Pick 1 to 3 tips randomly
      const numToGrow = 1 + Math.floor(Math.random() * 3);
      const shuffled = [...Array(numTips).keys()].sort(() => Math.random() - 0.5);
      for (let n = 0; n < numToGrow; n++) {
        const i = shuffled[n];
        // Random growth amount 1-3 so tips grow at different rates
        const amount = 1 + Math.floor(Math.random() * 3);
        tips[i] = Math.min((tips[i] || 1) + amount, 40);
      }
      tree.tipDensities = tips;
      tree.age = (tree.age || 0) + 1;
      tree.lastInteraction = Date.now();
      return tree;
    });
  }

  trim() {
    if (!this.treeCode) return;
    const treeRef = ref(db, `trees/${this.treeCode}`);
    runTransaction(treeRef, (tree) => {
      if (!tree || !tree.tipDensities) return tree;
      // Reduce all tips a bit, more from the biggest ones (realistic pruning)
      tree.tipDensities = tree.tipDensities.map(d => Math.max(d - Math.floor(Math.random() * 4 + 1), 1));
      tree.health = Math.min((tree.health || 100) + 15, 100);
      tree.lastInteraction = Date.now();
      return tree;
    });
  }

  renderTree(tree) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Ambient sky gradient — soft warm linen to pale sage
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#EAE8E0');   // warm off-white top
    sky.addColorStop(1, '#DDE8D8');   // pale sage at ground
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const tipDensities = tree.tipDensities || Array(this.skeleton.tips.length).fill(1);

    // Scale helper
    const px = (xp) => xp * W;
    const py = (yp) => yp * H;

    // 1. Draw pot
    this.drawPot(W / 2, H * 0.88);

    // 2. Draw trunk and branches — two passes for texture:
    //    Pass 1: dark base stroke (bark shadow)
    //    Pass 2: thinner lighter stroke offset slightly (bark highlight)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const seg of this.skeleton.segments) {
      // Shadow pass
      const barkDark = seg.width > 8 ? '#3B2416' : seg.width > 5 ? '#4A3020' : '#5C3D28';
      ctx.beginPath();
      ctx.moveTo(px(seg.x1), py(seg.y1));
      ctx.quadraticCurveTo(px(seg.cpx), py(seg.cpy), px(seg.x2), py(seg.y2));
      ctx.strokeStyle = barkDark;
      ctx.lineWidth = seg.width;
      ctx.stroke();

      // Highlight pass — lighter, thinner, offset left
      const barkLight = seg.width > 8 ? '#7A5538' : seg.width > 5 ? '#8B6645' : '#9E7A55';
      ctx.beginPath();
      ctx.moveTo(px(seg.x1) - 1, py(seg.y1));
      ctx.quadraticCurveTo(px(seg.cpx) - 1, py(seg.cpy), px(seg.x2) - 1, py(seg.y2));
      ctx.strokeStyle = barkLight;
      ctx.lineWidth = Math.max(1, seg.width * 0.35);
      ctx.stroke();
    }

    // 3. Draw foliage per tip with its own density
    this.skeleton.tips.forEach((tip, i) => {
      const density = tipDensities[i] || 1;
      this.drawFoliageCluster(px(tip.x), py(tip.y), tip.dx, tip.dy, tip.vertBias, density, W, H);
    });
  }

  drawFoliageCluster(cx, cy, spreadDx, spreadDy, vertBias, density, canvasW, canvasH) {
    const ctx = this.ctx;
    ctx.save();

    // Foliage grows as horizontal ellipses — wide, flat, like real bonsai pads.
    // Max horizontal radius capped as fraction of canvas
    const maxRx = canvasW * 0.20;
    const baseRx = Math.min(15 + density * 2.5, maxRx); // horizontal radius
    const baseRy = baseRx * 0.45; // much flatter — ellipse shape

    // Number of pads grows with density
    const numPads = Math.min(2 + Math.floor(density / 3), 9);

    // Color palette — researched bonsai tones: rich moss, sage, ivy, teak
    const colors = [
      'rgba(70, 103, 77, 0.92)',   // Bush Green #46674D
      'rgba(90, 130, 60, 0.87)',   // mid moss
      'rgba(58, 88, 48, 0.82)',    // dark ivy
      'rgba(122, 155, 98, 0.78)',  // Ivy light #7A9B62
    ];

    for (let i = numPads - 1; i >= 0; i--) {
      // t=0 is center/first pad, t=1 is outermost
      const t = numPads > 1 ? i / (numPads - 1) : 0;

      // Primary spread: in branch direction (mostly horizontal)
      const spreadMag = baseRx * 0.65 * t;
      const ox = spreadDx * spreadMag;

      // Vertical randomness: each pad drifts a bit up or down based on vertBias + per-pad seed
      // Using a deterministic seed (based on i + cx) so cloud positions are stable across re-renders
      const seed = Math.sin(i * 73.1 + cx * 0.01);
      const oy = spreadDy * spreadMag + vertBias * baseRy * 2 * t + seed * baseRy * 0.5;

      // Pads get slightly smaller toward tips
      const rx = baseRx * (0.8 + 0.2 * (1 - t));
      const ry = baseRy * (0.8 + 0.2 * (1 - t));

      // Clamp to stay inside canvas
      const padCx = Math.max(rx, Math.min(canvasW - rx, cx + ox));
      const padCy = Math.max(ry, Math.min(canvasH * 0.82 - ry, cy + oy));

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.ellipse(padCx, padCy, rx, ry, 0, 0, Math.PI * 2);

      // Small lobes at edges for cloud-like shape
      ctx.ellipse(padCx + rx * 0.5, padCy - ry * 0.4, rx * 0.45, ry * 0.7, 0, 0, Math.PI * 2);
      ctx.ellipse(padCx - rx * 0.5, padCy - ry * 0.3, rx * 0.4, ry * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawPot(cx, baseY) {
    const ctx = this.ctx;
    // Scale pot to canvas width slightly
    const W = this.canvas.width;
    const potW = Math.min(90, W * 0.2);
    const potH = potW * 0.55;
    const rimH = potH * 0.2;
    const footH = potH * 0.1;

    ctx.save();
    ctx.lineCap = 'round';

    // Pot shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 4, potW * 0.55, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pot body â€” trapezoidal (wider at top, narrower at bottom)
    const top = baseY - potH - rimH;
    const bot = baseY - footH;
    ctx.fillStyle = '#8B4513';
    ctx.strokeStyle = '#5A2D0C';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - potW * 0.4, bot);          // bottom left
    ctx.lineTo(cx + potW * 0.4, bot);          // bottom right
    ctx.lineTo(cx + potW * 0.5, top + rimH);   // top right
    ctx.lineTo(cx - potW * 0.5, top + rimH);   // top left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Highlight on pot
    ctx.fillStyle = 'rgba(255,200,150,0.12)';
    ctx.beginPath();
    ctx.moveTo(cx - potW * 0.25, bot);
    ctx.lineTo(cx - potW * 0.05, bot);
    ctx.lineTo(cx - potW * 0.15, top + rimH);
    ctx.lineTo(cx - potW * 0.35, top + rimH);
    ctx.closePath();
    ctx.fill();

    // Rim
    ctx.fillStyle = '#A0522D';
    ctx.strokeStyle = '#5A2D0C';
    ctx.beginPath();
    ctx.roundRect(cx - potW * 0.55, top, potW * 1.1, rimH, 3);
    ctx.fill();
    ctx.stroke();

    // Foot / base lip
    ctx.fillStyle = '#6B3410';
    ctx.beginPath();
    ctx.roundRect(cx - potW * 0.35, bot, potW * 0.7, footH, 2);
    ctx.fill();

    // Soil top (visible in rim)
    ctx.fillStyle = '#2C1A0E';
    ctx.beginPath();
    ctx.ellipse(cx, top + rimH, potW * 0.45, rimH * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SharedBonsai();
});
