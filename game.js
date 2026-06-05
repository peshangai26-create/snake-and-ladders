/* ============================================================
   Peshang AI — Snake & Ladders
   Multi-player (2–4), animated tokens, synth sound effects.
   ============================================================ */

(() => {
  // ---------- Config ----------
  const BOARD_SIZE = 10;            // 10x10
  const TOTAL = BOARD_SIZE * BOARD_SIZE;

  // Snake and ladder definitions (start -> end)
  const LADDERS = {
    4: 14, 9: 21, 20: 42, 28: 76, 40: 89, 51: 67, 71: 92,
  };
  const SNAKES = {
    17: 7, 54: 34, 62: 19, 87: 36, 93: 73, 95: 75, 99: 78,
  };

  // Player palette (Peshang AI inspired)
  const PLAYER_COLORS = [
    { name: "Purple",     fill: "#8A3FFC", glow: "#B06CFF" },
    { name: "Blue",       fill: "#2F80ED", glow: "#56A3FF" },
    { name: "Magenta",    fill: "#E94BD0", glow: "#FF8FE0" },
    { name: "Cyan",       fill: "#00D4FF", glow: "#7FE9FF" },
  ];

  // ---------- DOM ----------
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const playerListEl = document.getElementById("playerList");
  const startBtn = document.getElementById("startBtn");
  const rollBtn = document.getElementById("rollBtn");
  const dieEl = document.getElementById("dice");
  const turnText = document.getElementById("turnText");
  const turnDot = document.getElementById("turnDot");
  const logEl = document.getElementById("log");
  const winOverlay = document.getElementById("winOverlay");
  const winText = document.getElementById("winText");
  const playAgainBtn = document.getElementById("playAgain");
  const soundToggle = document.getElementById("soundToggle");
  const segBtns = document.querySelectorAll(".seg-btn");
  const hint = document.getElementById("hint");

  // ---------- State ----------
  let players = [];                  // {name, color, pos (1..100), animPos}
  let currentPlayer = 0;
  let playerCount = 2;
  let gameStarted = false;
  let isAnimating = false;
  let lastRoll = null;

  // ---------- Canvas sizing (HiDPI) ----------
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const cssSize = Math.min(canvas.parentElement.clientWidth - 36, 720);
    canvas.style.width = cssSize + "px";
    canvas.style.height = cssSize + "px";
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // ---------- Coordinate helpers ----------
  // Convert cell number (1..100) to {row, col} on a 10x10 board (origin top-left)
  // Standard boustrophedon: 1 at bottom-left, snake/zig-zag going up.
  function cellToRC(n) {
    const rowFromBottom = Math.floor((n - 1) / BOARD_SIZE);
    const row = BOARD_SIZE - 1 - rowFromBottom;
    let col = (n - 1) % BOARD_SIZE;
    if (rowFromBottom % 2 === 1) col = BOARD_SIZE - 1 - col;
    return { row, col };
  }
  function cellCenter(n) {
    const cssSize = parseFloat(canvas.style.width) || canvas.width;
    const cell = cssSize / BOARD_SIZE;
    const { row, col } = cellToRC(n);
    return { x: col * cell + cell / 2, y: row * cell + cell / 2, cell };
  }

  // Interpolated position for smooth animations (animPos can be fractional)
  function fractionalCenter(p) {
    if (p <= 1) return cellCenter(1);
    if (p >= TOTAL) return cellCenter(TOTAL);
    const lo = Math.floor(p);
    const hi = Math.ceil(p);
    if (lo === hi) return cellCenter(lo);
    const t = p - lo;
    const a = cellCenter(lo);
    const b = cellCenter(hi);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, cell: a.cell };
  }

  // ---------- Drawing ----------
  function draw() {
    const cssSize = parseFloat(canvas.style.width) || canvas.width;
    const cell = cssSize / BOARD_SIZE;
    ctx.clearRect(0, 0, cssSize, cssSize);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, cssSize, cssSize);
    bgGrad.addColorStop(0, "#0F1B3D");
    bgGrad.addColorStop(1, "#0B1A3A");
    ctx.fillStyle = bgGrad;
    roundRect(ctx, 0, 0, cssSize, cssSize, 14);
    ctx.fill();

    // Cells
    for (let n = 1; n <= TOTAL; n++) {
      const { row, col } = cellToRC(n);
      const x = col * cell;
      const y = row * cell;
      const alt = (row + col) % 2 === 0;

      ctx.fillStyle = alt
        ? "rgba(255,255,255,0.025)"
        : "rgba(138,63,252,0.05)";
      ctx.fillRect(x, y, cell, cell);

      // Special tints
      if (LADDERS[n] !== undefined) {
        ctx.fillStyle = "rgba(86,163,255,0.12)";
        ctx.fillRect(x, y, cell, cell);
      } else if (SNAKES[n] !== undefined) {
        ctx.fillStyle = "rgba(255,94,126,0.10)";
        ctx.fillRect(x, y, cell, cell);
      }

      // Grid lines
      ctx.strokeStyle = "rgba(176,108,255,0.10)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);

      // Number
      ctx.fillStyle = "rgba(233,236,245,0.55)";
      ctx.font = `600 ${Math.round(cell * 0.18)}px Inter, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(String(n), x + 6, y + 5);

      // Start / finish accents
      if (n === 1) drawCellTag(x, y, cell, "START", "#56A3FF");
      if (n === TOTAL) drawCellTag(x, y, cell, "FINISH", "#B06CFF");
    }

    // Ladders
    Object.entries(LADDERS).forEach(([start, end]) => {
      drawLadder(parseInt(start, 10), end, cell);
    });

    // Snakes
    Object.entries(SNAKES).forEach(([head, tail]) => {
      drawSnake(parseInt(head, 10), tail, cell);
    });

    // Tokens
    drawTokens(cell);
  }

  function drawCellTag(x, y, cell, label, color) {
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.round(cell * 0.13)}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, x + cell / 2, y + cell - 6);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawLadder(from, to, cell) {
    const a = cellCenter(from);
    const b = cellCenter(to);

    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, "#56A3FF");
    grad.addColorStop(1, "#B06CFF");

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const w = cell * 0.18;

    // Rails (glow)
    ctx.save();
    ctx.shadowColor = "rgba(86,163,255,0.55)";
    ctx.shadowBlur = 16;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(a.x + nx * w, a.y + ny * w);
    ctx.lineTo(b.x + nx * w, b.y + ny * w);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(a.x - nx * w, a.y - ny * w);
    ctx.lineTo(b.x - nx * w, b.y - ny * w);
    ctx.stroke();
    ctx.restore();

    // Rungs
    ctx.strokeStyle = "rgba(189,216,255,0.9)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    const rungs = Math.max(3, Math.floor(len / (cell * 0.4)));
    for (let i = 1; i < rungs; i++) {
      const t = i / rungs;
      const cx = a.x + dx * t;
      const cy = a.y + dy * t;
      ctx.beginPath();
      ctx.moveTo(cx + nx * w, cy + ny * w);
      ctx.lineTo(cx - nx * w, cy - ny * w);
      ctx.stroke();
    }
  }

  function drawSnake(head, tail, cell) {
    const a = cellCenter(head);
    const b = cellCenter(tail);

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;

    // Curve via two control points (S-shape)
    const cp1x = a.x + dx * 0.33 + nx * cell * 0.9;
    const cp1y = a.y + dy * 0.33 + ny * cell * 0.9;
    const cp2x = a.x + dx * 0.66 - nx * cell * 0.9;
    const cp2y = a.y + dy * 0.66 - ny * cell * 0.9;

    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, "#FF5E7E");
    grad.addColorStop(0.5, "#C04CE5");
    grad.addColorStop(1, "#8A3FFC");

    ctx.save();
    ctx.shadowColor = "rgba(255,94,126,0.55)";
    ctx.shadowBlur = 18;
    ctx.strokeStyle = grad;
    ctx.lineWidth = cell * 0.22;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y);
    ctx.stroke();
    ctx.restore();

    // Body highlight
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = cell * 0.06;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y);
    ctx.stroke();

    // Head
    ctx.save();
    ctx.translate(a.x, a.y);
    const angle = Math.atan2(cp1y - a.y, cp1x - a.x);
    ctx.rotate(angle);
    const headR = cell * 0.20;
    const headGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, headR);
    headGrad.addColorStop(0, "#FFB3C2");
    headGrad.addColorStop(1, "#FF5E7E");
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, headR, headR * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#0B1A3A";
    ctx.beginPath();
    ctx.arc(headR * 0.35, -headR * 0.30, headR * 0.12, 0, Math.PI * 2);
    ctx.arc(headR * 0.35,  headR * 0.30, headR * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Tongue
    ctx.strokeStyle = "#FF5E7E";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(headR * 0.9, 0);
    ctx.lineTo(headR * 1.5, -headR * 0.15);
    ctx.moveTo(headR * 1.3, 0);
    ctx.lineTo(headR * 1.5,  headR * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function drawTokens(cell) {
    // Group tokens by current integer cell so multiple players share neatly
    const groups = new Map();
    players.forEach((p, i) => {
      const key = Math.round(p.animPos);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });

    players.forEach((p, i) => {
      const c = fractionalCenter(p.animPos);
      const isInt = Math.abs(p.animPos - Math.round(p.animPos)) < 0.01;
      let offX = 0, offY = 0;
      if (isInt) {
        const group = groups.get(Math.round(p.animPos));
        const idx = group.indexOf(i);
        const count = group.length;
        if (count > 1) {
          const angle = (idx / count) * Math.PI * 2;
          const r = cell * 0.18;
          offX = Math.cos(angle) * r;
          offY = Math.sin(angle) * r;
        }
      }

      const x = c.x + offX;
      const y = c.y + offY;
      const r = cell * 0.22;

      // Active player ring
      if (gameStarted && i === currentPlayer && !isAnimating) {
        ctx.save();
        ctx.strokeStyle = p.color.glow;
        ctx.shadowColor = p.color.glow;
        ctx.shadowBlur = 18;
        ctx.lineWidth = 2.5;
        const pulse = 1 + Math.sin(performance.now() / 250) * 0.08;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.4 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Token body
      const tokGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 2, x, y, r);
      tokGrad.addColorStop(0, p.color.glow);
      tokGrad.addColorStop(1, p.color.fill);

      ctx.save();
      ctx.shadowColor = p.color.glow;
      ctx.shadowBlur = 14;
      ctx.fillStyle = tokGrad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Number
      ctx.fillStyle = "white";
      ctx.font = `700 ${Math.round(r * 0.95)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x, y + 1);
    });
  }

  // ---------- Animation loop ----------
  let rafId = null;
  function loop() {
    draw();
    rafId = requestAnimationFrame(loop);
  }

  // ---------- Sound (Web Audio synth) ----------
  let audioCtx = null;
  function getAudio() {
    if (!soundToggle.checked) return null;
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { return null; }
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, dur, opts = {}) {
    const a = getAudio(); if (!a) return;
    const {
      type = "sine", gain = 0.18, delay = 0,
      slideTo = null, attack = 0.01, release = 0.08,
    } = opts;
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.linearRampToValueAtTime(0, t0 + dur + release);
    osc.connect(g).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.02);
  }

  function noise(dur, opts = {}) {
    const a = getAudio(); if (!a) return;
    const { gain = 0.08, delay = 0, filterFreq = 1200, filterQ = 4 } = opts;
    const t0 = a.currentTime + delay;
    const bufferSize = Math.floor(a.sampleRate * dur);
    const buffer = a.createBuffer(1, bufferSize, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buffer;
    const filter = a.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.Q.value = filterQ;
    const g = a.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(filter).connect(g).connect(a.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const SFX = {
    diceRoll() {
      for (let i = 0; i < 6; i++) {
        noise(0.05, { gain: 0.05, delay: i * 0.06, filterFreq: 1800 + Math.random() * 1200, filterQ: 6 });
      }
      tone(280, 0.08, { type: "square", gain: 0.08, delay: 0.45 });
      tone(380, 0.10, { type: "square", gain: 0.06, delay: 0.55 });
    },
    step() {
      tone(520, 0.06, { type: "triangle", gain: 0.10 });
    },
    ladder() {
      // Rising arpeggio + sparkle
      const notes = [392, 523, 659, 784, 988, 1175];
      notes.forEach((f, i) => tone(f, 0.10, { type: "triangle", gain: 0.12, delay: i * 0.07 }));
      tone(1320, 0.6, { type: "sine", gain: 0.06, delay: 0.4, slideTo: 1760 });
    },
    snake() {
      // Hiss + descending growl
      noise(0.6, { gain: 0.08, filterFreq: 3500, filterQ: 6 });
      tone(440, 0.6, { type: "sawtooth", gain: 0.10, slideTo: 90 });
      tone(220, 0.55, { type: "square", gain: 0.06, slideTo: 60, delay: 0.05 });
    },
    win() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => tone(f, 0.18, { type: "triangle", gain: 0.16, delay: i * 0.10 }));
      tone(1568, 0.6, { type: "sine", gain: 0.10, delay: 0.55 });
    },
    turn() {
      tone(700, 0.06, { type: "sine", gain: 0.08 });
      tone(880, 0.08, { type: "sine", gain: 0.08, delay: 0.06 });
    },
  };

  // ---------- Player setup ----------
  function renderPlayerList() {
    playerListEl.innerHTML = "";
    for (let i = 0; i < playerCount; i++) {
      const color = PLAYER_COLORS[i];
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `
        <span class="swatch" style="background:${color.fill};color:${color.glow}"></span>
        <input type="text" maxlength="14" value="Player ${i + 1}" />
        <span class="player-tag">P${i + 1}</span>
      `;
      playerListEl.appendChild(row);
    }
  }

  segBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      if (gameStarted) return;
      segBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      playerCount = parseInt(btn.dataset.count, 10);
      renderPlayerList();
    });
  });

  function startGame() {
    const inputs = playerListEl.querySelectorAll("input");
    players = [];
    inputs.forEach((inp, i) => {
      players.push({
        name: inp.value.trim() || `Player ${i + 1}`,
        color: PLAYER_COLORS[i],
        pos: 0,        // off-board until first roll
        animPos: 0,
      });
      inp.disabled = true;
    });
    currentPlayer = 0;
    gameStarted = true;
    startBtn.disabled = true;
    startBtn.textContent = "Game in progress…";
    segBtns.forEach(b => b.disabled = true);
    rollBtn.disabled = false;
    logEl.innerHTML = "";
    pushLog(`Game started with ${players.length} players.`);
    updateTurnUI();
    SFX.turn();
  }

  function updateTurnUI() {
    if (!gameStarted) {
      turnText.textContent = "Set up players to start";
      turnDot.style.background = "var(--purple-light)";
      turnDot.style.boxShadow = "0 0 12px var(--purple-light)";
      return;
    }
    const p = players[currentPlayer];
    turnText.textContent = `${p.name}'s turn`;
    turnDot.style.background = p.color.fill;
    turnDot.style.boxShadow = `0 0 14px ${p.color.glow}`;

    // Highlight in list
    [...playerListEl.children].forEach((row, i) => {
      row.classList.toggle("active", i === currentPlayer);
    });
  }

  function pushLog(text, cls = "") {
    const li = document.createElement("li");
    if (cls) li.className = cls;
    li.textContent = text;
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---------- Dice ----------
  // Rotations so a given face ends pointing toward the viewer
  const DIE_FACE_ROT = {
    1: { x: 0,    y: 0    },
    2: { x: 0,    y: 180  },
    3: { x: 0,    y: -90  },
    4: { x: 0,    y: 90   },
    5: { x: -90,  y: 0    },
    6: { x: 90,   y: 0    },
  };

  // Roll counter — each roll sets an absolute target rotation
  // (720*n + target.x, 1080*n + target.y), guaranteeing the displayed
  // face always matches `value`. Accumulating deltas does NOT work
  // because 3D rotations are non-commutative.
  let dieRollCount = 0;

  function animateDie(value) {
    return new Promise(resolve => {
      dieRollCount++;
      const target = DIE_FACE_ROT[value];
      const finalX = 720 * dieRollCount + target.x;
      const finalY = 1080 * dieRollCount + target.y;
      dieEl.style.transition = "transform 0.9s cubic-bezier(.4,.8,.25,1)";
      dieEl.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg)`;
      setTimeout(resolve, 900);
    });
  }

  // ---------- Turn logic ----------
  async function rollAndMove() {
    if (!gameStarted || isAnimating) return;
    isAnimating = true;
    rollBtn.disabled = true;

    const roll = 1 + Math.floor(Math.random() * 6);
    lastRoll = roll;
    SFX.diceRoll();
    await animateDie(roll);

    const p = players[currentPlayer];
    pushLog(`${p.name} rolled a ${roll}.`);

    let target = p.pos + roll;
    if (target > TOTAL) {
      pushLog(`${p.name} needs exactly ${TOTAL - p.pos} to finish. Stays at ${p.pos}.`);
      isAnimating = false;
      nextTurn();
      return;
    }

    // Step-by-step movement
    await stepMove(p, p.pos, target);
    p.pos = target;

    // Check ladder / snake
    if (LADDERS[p.pos] !== undefined) {
      const dest = LADDERS[p.pos];
      pushLog(`${p.name} climbed a ladder ${p.pos} → ${dest}!`, "ladder");
      SFX.ladder();
      await glideMove(p, p.pos, dest, 700);
      p.pos = dest;
    } else if (SNAKES[p.pos] !== undefined) {
      const dest = SNAKES[p.pos];
      pushLog(`${p.name} was bitten by a snake ${p.pos} → ${dest}!`, "snake");
      SFX.snake();
      await glideMove(p, p.pos, dest, 800, true);
      p.pos = dest;
    }

    // Win?
    if (p.pos === TOTAL) {
      gameStarted = false;
      pushLog(`🏆 ${p.name} reached ${TOTAL} and wins!`, "win");
      SFX.win();
      isAnimating = false;
      setTimeout(() => showWinner(p), 500);
      return;
    }

    isAnimating = false;
    nextTurn();
  }

  function nextTurn() {
    currentPlayer = (currentPlayer + 1) % players.length;
    updateTurnUI();
    SFX.turn();
    rollBtn.disabled = !gameStarted;
  }

  function stepMove(p, from, to) {
    return new Promise(resolve => {
      let cur = from;
      // First move: jump from "off-board" (0) onto cell 1, then walk the rest.
      // The 0 → 1 transition is visually instant (both render at cell 1),
      // so we collapse it into a single step + sound and continue.
      if (cur === 0 && to >= 1) {
        p.animPos = 1;
        cur = 1;
        SFX.step();
        if (cur === to) { resolve(); return; }
      }
      const dir = to > cur ? 1 : -1;
      const stepMs = 180;
      const tick = () => {
        if (cur === to) { resolve(); return; }
        const next = cur + dir;
        animateField(p, "animPos", cur, next, stepMs).then(() => {
          SFX.step();
          cur = next;
          tick();
        });
      };
      tick();
    });
  }

  function glideMove(p, from, to, dur, shake = false) {
    return new Promise(resolve => {
      animateField(p, "animPos", from, to, dur, shake).then(resolve);
    });
  }

  function animateField(obj, key, from, to, dur, shake = false) {
    return new Promise(resolve => {
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = shake ? easeInOut(t) : easeOut(t);
        obj[key] = from + (to - from) * eased;
        if (shake && t < 1) {
          // small jitter to suggest snake bite
          obj[key] += (Math.random() - 0.5) * 0.15 * (1 - t);
        }
        if (t < 1) requestAnimationFrame(tick);
        else { obj[key] = to; resolve(); }
      };
      requestAnimationFrame(tick);
    });
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // ---------- Winner overlay ----------
  function showWinner(p) {
    winText.textContent = `${p.name} wins!`;
    winOverlay.classList.remove("hidden");
  }
  playAgainBtn.addEventListener("click", () => {
    winOverlay.classList.add("hidden");
    resetGame();
  });

  function resetGame() {
    players = [];
    currentPlayer = 0;
    gameStarted = false;
    isAnimating = false;
    startBtn.disabled = false;
    startBtn.textContent = "Start Game";
    rollBtn.disabled = true;
    segBtns.forEach(b => b.disabled = false);
    logEl.innerHTML = "";
    renderPlayerList();
    updateTurnUI();
  }

  // ---------- Events ----------
  startBtn.addEventListener("click", startGame);
  rollBtn.addEventListener("click", rollAndMove);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (gameStarted && !isAnimating) rollAndMove();
    }
  });
  window.addEventListener("resize", resizeCanvas);

  // ---------- Init ----------
  renderPlayerList();
  resizeCanvas();
  updateTurnUI();
  loop();
})();
