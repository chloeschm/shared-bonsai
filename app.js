
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
// These define the FIXED structure of the bonsai — it never changes.
function getBonsaiSkeleton() {
  return {
    segments: [
      // Trunk: Centered more vertically: base at 0.75, top at 0.50
      // Shorter segments overall for a compact, powerful look
      { id: 's1', x1: 0.50, y1: 0.75, x2: 0.51, y2: 0.68, cpx: 0.46, cpy: 0.72, width: 38 },
      { id: 's2', x1: 0.51, y1: 0.68, x2: 0.53, y2: 0.62, cpx: 0.56, cpy: 0.65, width: 28 },
      { id: 's3', x1: 0.53, y1: 0.62, x2: 0.49, y2: 0.56, cpx: 0.52, cpy: 0.59, width: 18 },
      { id: 's4', x1: 0.49, y1: 0.56, x2: 0.48, y2: 0.51, cpx: 0.46, cpy: 0.53, width: 10 },

      // Branches (Tightened horizontal spread, more compact)
      { id: 'l1a', x1: 0.51, y1: 0.68, x2: 0.42, y2: 0.67, cpx: 0.46, cpy: 0.66, width: 10 },
      { id: 'l1b', x1: 0.42, y1: 0.67, x2: 0.30, y2: 0.70, cpx: 0.35, cpy: 0.67, width: 6 },
      { id: 'l1c', x1: 0.30, y1: 0.70, x2: 0.22, y2: 0.69, cpx: 0.26, cpy: 0.70, width: 4 },

      { id: 'r1a', x1: 0.53, y1: 0.62, x2: 0.65, y2: 0.61, cpx: 0.59, cpy: 0.60, width: 9 },
      { id: 'r1b', x1: 0.65, y1: 0.61, x2: 0.75, y2: 0.64, cpx: 0.70, cpy: 0.61, width: 5 },
      { id: 'r1c', x1: 0.75, y1: 0.64, x2: 0.82, y2: 0.62, cpx: 0.78, cpy: 0.63, width: 3.5 },

      { id: 'l2a', x1: 0.49, y1: 0.56, x2: 0.40, y2: 0.54, cpx: 0.44, cpy: 0.54, width: 7 },
      { id: 'l2b', x1: 0.40, y1: 0.54, x2: 0.32, y2: 0.55, cpx: 0.36, cpy: 0.54, width: 4 },

      { id: 'r2a', x1: 0.49, y1: 0.56, x2: 0.60, y2: 0.53, cpx: 0.54, cpy: 0.55, width: 7 },
      { id: 'r2b', x1: 0.60, y1: 0.53, x2: 0.70, y2: 0.51, cpx: 0.65, cpy: 0.52, width: 4 },

      { id: 'u1', x1: 0.48, y1: 0.51, x2: 0.55, y2: 0.48, cpx: 0.52, cpy: 0.49, width: 5 },
      { id: 'u2', x1: 0.48, y1: 0.51, x2: 0.41, y2: 0.47, cpx: 0.44, cpy: 0.49, width: 5 },
      { id: 'u3', x1: 0.48, y1: 0.51, x2: 0.49, y2: 0.45, cpx: 0.48, cpy: 0.48, width: 4.5 },
    ],
    tips: [
      { x: 0.22, y: 0.69, dx: -1, dy: 0.1, id: 'l1c' }, // Lower left
      { x: 0.82, y: 0.62, dx: 1, dy: 0.1, id: 'r1c' }, // Lower right
      { x: 0.32, y: 0.55, dx: -0.8, dy: 0, id: 'l2b' }, // Mid left
      { x: 0.70, y: 0.51, dx: 0.8, dy: 0, id: 'r2b' }, // Mid right
      { x: 0.55, y: 0.48, dx: 0.6, dy: -0.3, id: 'u1' }, // Upper left
      { x: 0.41, y: 0.47, dx: -0.6, dy: -0.3, id: 'u2' }, // Upper right
      { x: 0.49, y: 0.45, dx: 0.1, dy: -1, id: 'u3' }, // Apex
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
    const container = this.canvas.parentElement;
    // Use container dimensions only if they have been computed (> 0).
    // At constructor time the flex layout hasn't painted yet, so clientHeight
    // is 0 → canvas height would be 0 → nothing renders. Fall back to window.
    const w = (container && container.clientWidth > 0)
      ? container.clientWidth : window.innerWidth;
    const h = (container && container.clientHeight > 50)
      ? container.clientHeight : window.innerHeight * 0.62;
    this.canvas.width = w;
    this.canvas.height = h;
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
          this.showToast('Your bonsai was just watered!');
        }
        this._justWatered = false;
        this.lastKnownAge = data.age;

        this.currentTree = data;
        this.updateUI(data);
        this.renderTree(data);
        // Re-measure after first paint: flex container may have had 0 height
        // at constructor time. rAF fires after layout, giving correct dimensions.
        if (!this._initialResizeDone) {
          this._initialResizeDone = true;
          requestAnimationFrame(() => {
            this.resizeCanvas();
            this.renderTree(data);
          });
        }
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






    // 2. Draw trunk and branches — two passes for texture:
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

    // 2.5 Draw Pot, Moss & Roots ON TOP of trunk base (as requested)
    this.drawPot(W / 2, H * 0.82);
    this.drawMoss(px(0.50), py(0.75), W * 0.12); // base y=0.75
    this.drawRoots(px(0.50), py(0.75), W * 0.13);
    

    // 3. Draw foliage per tip with its own density
    this.skeleton.tips.forEach((tip, i) => {
      const density = tipDensities[i] || 1;
      this.drawFoliageCluster(px(tip.x), py(tip.y), tip.dx, tip.dy, density, W, H);
    });
  }

  drawFoliageCluster(cx, cy, spreadDx, spreadDy, density, canvasW, canvasH) {
    const ctx = this.ctx;
    ctx.save();

    // Height-dependent scaling: lower pads (higher screen Y) can grow larger.
    // Normalized y offset: 0.0 at top most tip (0.45) to 1.0 at lowest tip (0.75)
    const normY = (cy / canvasH - 0.45) / 0.30;
    const yMultiplier = 1.0 + Math.max(0, normY * 0.9); // Up to 90% larger for low pads

    // Cloud-pad style: denser, more compact layered clusters of leaflets.
    const maxPadR = Math.min(canvasW * 0.14, canvasH * 0.16) * yMultiplier;
    const padR = Math.min(18 + density * 2.1, maxPadR);
    const numLeaflets = Math.min(15 + Math.floor(density * 1.8), 45) * (0.8 + normY * 0.5);

    // Darkened Palette from reference:
    const colorBottom = '#132812'; // deeper shadow
    const colorMid = '#224D17'; // mid green
    const colorTop = '#3A6B35'; // olive/fern
    const colorHigh = '#6B8E23'; // olivine highlight (darker than before)

    const rx = padR;
    const ry = padR * 0.40;

    // First Pass: Shady base
    for (let i = 0; i < numLeaflets; i++) {
      const angle = i * 2.39996;
      const dist = Math.sqrt(i / numLeaflets);
      const lx = cx + spreadDx * padR * 0.15 + Math.cos(angle) * dist * rx;
      const ly = cy + spreadDy * padR * 0.15 + Math.sin(angle) * dist * ry;

      ctx.fillStyle = i < numLeaflets * 0.5 ? colorBottom : colorMid;
      ctx.beginPath();
      ctx.ellipse(lx, ly, rx * 0.25, ry * 0.35, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    // Second Pass: Layered highlight (Top)
    const numHighlights = Math.floor(numLeaflets * 0.65);
    for (let i = 0; i < numHighlights; i++) {
      const angle = i * 2.39996 + 0.8;
      const dist = Math.sqrt(i / numHighlights) * 0.7;
      const lx = cx + spreadDx * padR * 0.15 + Math.cos(angle) * dist * rx;
      const ly = cy + spreadDy * padR * 0.15 + Math.sin(angle) * dist * ry - (ry * 0.2);

      ctx.fillStyle = i < numHighlights * 0.5 ? colorTop : colorHigh;
      ctx.beginPath();
      ctx.ellipse(lx, ly, rx * 0.2, ry * 0.3, angle, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawRoots(cx, cy, width) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#2B1A0E'; // Darker root color
    ctx.lineCap = 'round';

    // Seeded randomness for stable roots
    const numRoots = 6;
    for (let i = 0; i < numRoots; i++) {
      const angleSeed = Math.sin(i * 12.3 + cx * 0.1) * 0.5 + 0.5;
      const angle = Math.PI - (i * (Math.PI / (numRoots - 1))) + (angleSeed - 0.5) * 0.3;
      const lengthSeed = Math.cos(i * 45.7 + cy * 0.2) * 0.5 + 0.5;
      const length = width * (0.6 + lengthSeed * 0.5);

      ctx.beginPath();
      ctx.lineWidth = 8 * (1 - (i / numRoots) * 0.5);
      ctx.moveTo(cx, cy);
      const ex = cx + Math.cos(angle) * length;
      const ey = cy + Math.sin(angle) * length * 0.3;
      ctx.quadraticCurveTo(cx + Math.cos(angle) * length * 0.5, cy + 12, ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMoss(cx, cy, width) {
    const ctx = this.ctx;
    ctx.save();

    // Seeded randomness for stable moss
    const numBumps = 30;
    const mossColors = ['#1B3C1A', '#2D5A27', '#224D17'];

    for (let i = 0; i < numBumps; i++) {
      const seedX = Math.sin(i * 7.8 + cx * 0.05) * 0.5 + 0.5;
      const seedY = Math.cos(i * 3.2 + cy * 0.1) * 0.5 + 0.5;

      const rx = width * (0.4 + seedX * 0.8);
      const ry = width * 0.18;
      const ox = (seedX - 0.5) * width * 1.5;
      const oy = (seedY - 0.5) * width * 0.3;

      ctx.fillStyle = mossColors[i % 3];
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy + oy, rx * 0.22, rx * 0.12, 0, 0, Math.PI * 2);
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

    // Pot body trapezoidal (wider at top, narrower at bottom)
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
