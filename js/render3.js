// v4.0 손맛 층(Renderer에 덧붙임) — 참고 영상(실시간 디펜스) 분석 반영 · v4.1 네 겹 판(가운데 주사위 → 판 → 포탑 자리 → 길)
// · 주사위: 판 가운데 받침에 늘 두 개가 놓여 있다. 굴리면 받침에서 위로 떠올라 구르고(어둡게 하지 않음) → 받침에 떨어져 멈춘 순간 판이 어두워지며 합이 크게 → 합이 말 머리로 날아가며 풀림
// · 말 = 단순한 보드게임 말(6색): 칸마다 통통(도약 찌그러짐 → 공중 늘어남 → 착지 찌그러짐), 진행 방향으로 기울기. 머리 위 남은 칸 수
// · 처치: 흰 번쩍 → 몸이 터지며 자두색 방울이 튀고 바닥에 얼룩 → 작은 넋이 떠오름(영상의 해골 · 뼈 대신 올챙이 몬스터에 맞춘 것)
// · 피해 숫자: 흰 굵은 글씨 + 두꺼운 테두리, 크게 튀어나왔다 줄어듦(영상과 같은 방식). 치명은 노랑 + 더 크게
// · 땅 속성: 판 칸에 그려진 문양(좋은 땅 = 둥근 금 메달 · 나쁜 땅 = 뾰족한 보라 딱지). 포탑은 판 바깥 둥근 자리에 서므로 칸을 가리지 않는다
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3), easeIn = t => t * t * t;
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const PAWN_COL = { car: '#e8453c', dog: '#3f7fe0', hat: '#f2c62a', boat: '#f08a24', boot: '#4fb84a', cat: '#a05ae0' };
  const PZ = G.plaza;   // 가운데 받침(주사위 자리)
  const GOO = { normal: ['#4a2448', '#7a3e72', '#e9a9c9'], fast: ['#1f5a4a', '#3fa88a', '#bff0d8'], armor: ['#3a3a4a', '#7a7a8a', '#e9a9c9'], giant: ['#3a1a4a', '#6a3a8a', '#d9a0e0'], barrier: ['#1f4a7a', '#4aa0e0', '#cfefff'], splitter: ['#7a3a2a', '#e07a5a', '#ffd0b0'], mini: ['#7a3a2a', '#e07a5a', '#ffd0b0'], elite: ['#5a1424', '#c0303a', '#ffd23a'], stealth: ['#2a2a3a', '#5a5a7a', '#c0c0e0'], goldmon: ['#7a5a10', '#ffd23a', '#fff6c8'] };

  const baseConsume = R.consume, baseFrame = R.frame, baseDrawTop = R.drawTop, baseDrawTower = R.drawTower;

  // ------------------------------------------------------------ 사건 연결
  R.consume = function (game, events, audio) {
    baseConsume.call(this, game, events, audio);
    for (const e of events) {
      switch (e.ev) {
        case 'dice': this.diceShow = { d1: e.d1, d2: e.d2, dbl: e.dbl, ctrl: e.ctrl, aim: e.aim, triple: e.triple, t: this.time }; this.dice = null; break;
        case 'dice2': this.diceShow2 = { d1: e.d1, d2: e.d2, dbl: e.dbl, t: this.time }; break;
        case 'move': this.moveStart = this.time; break;
        case 'hop': this.hopFx(game, e); break;
        case 'land': this.landFx(game, e.i); break;
        case 'offer': this.offerAt = this.time; break;
        case 'build': this.linkFx(e.i); break;
      }
    }
  };

  // ------------------------------------------------------------ 주사위(가운데 받침)
  // 시간표(초): 0~0.42 받침에서 떠올라 구름(어둡게 하지 않음) · 0.42~0.5 작게 한 번 튀고 멈춤 · 0.5 판이 어두워지며 합이 크게 · 0.8~0.95 합이 말 머리로(그 순간 말 출발 = ECON.diceT) · 어둠도 함께 풀림
  const DT = { LAND: 0.42, STOP: 0.5, REL: 0.8 };
  R.diceBusy = function () { const d = this.diceShow; return !!d && this.time - d.t < (D.ECON.diceT || 0.95) + 0.05; };
  R.dieAt = function (k, a, d) {
    const bx = PZ[0] + (k ? 27 : -27), by = PZ[1] + (k ? 5 : -5), seed = k * 1.7 + d.d1 * 0.31 + d.d2 * 0.17;
    let h = 0, x = bx, rot = 0, face = k ? d.d2 : d.d1, sq = 0, s = 22;
    if (a < DT.LAND) {
      const p = a / DT.LAND; h = 4 * p * (1 - p) * 120; x = bx + (k ? 1 : -1) * Math.sin(p * Math.PI) * 16;
      rot = (1 - p) * 7 * (k ? 1 : -1) + seed * 0.3 * (1 - p); face = 1 + Math.floor((a * 26 + k * 3) % 6); s = 22 + Math.sin(p * Math.PI) * 9;
      if (p < 0.12) sq = (1 - p / 0.12) * 0.7;
    } else if (a < DT.STOP) {
      const p = (a - DT.LAND) / (DT.STOP - DT.LAND); h = Math.sin(p * Math.PI) * 12; rot = (1 - p) * 0.4 * (k ? 1 : -1);
      face = p < 0.4 ? 1 + Math.floor((a * 16 + k * 3) % 6) : face; if (p < 0.25) sq = (1 - p / 0.25) * 0.8;
    } else { const p = (a - DT.STOP) / 0.1; if (p < 1) sq = Math.sin(p * Math.PI) * 0.6; }
    return { x, y: by - s * 0.9 - h, by, rot, face, sq, s, h };
  };
  // 받침 위에 놓인 주사위(평소, 판 캔버스) — 굴리는 동안은 위 캔버스에서 그린다
  R.drawTrayDice = function (c, game) {
    if (this.diceShow && !this.diceShow.done) { if (!this.diceBusy()) { this.diceShow.done = true; this.lastFaces = [this.diceShow.d1, this.diceShow.d2]; } else return; }
    const f = this.lastFaces || [5, 2];
    for (let k = 0; k < 2; k++) { const q = this.dieAt(k, 9, { d1: f[0], d2: f[1] }); c.save(); c.globalAlpha = 0.28; c.fillStyle = '#1a0e14'; c.beginPath(); c.ellipse(q.x, q.by + 2, 21, 7, 0, 0, TAU); c.fill(); c.restore(); this.isoDie(c, q.x, q.y, q.s, 0, f[k], false, 0, 1); }
    void game;
  };
  R.drawDiceShow = function (c, game) {
    const d = this.diceShow; if (!d || d.done || !this.diceBusy()) return;
    const a = this.time - d.t, POP = DT.STOP + 0.02, cx = PZ[0], cy = PZ[1];
    // 결과가 나오는 순간부터 판을 어둡게(굴리는 동안은 어둡게 하지 않음)
    const dim = a < DT.STOP ? 0 : a < DT.STOP + 0.07 ? (a - DT.STOP) / 0.07 : a < DT.REL ? 1 : Math.max(0, 1 - (a - DT.REL) / 0.15);
    if (dim > 0) { c.save(); c.globalAlpha = 0.46 * dim; c.fillStyle = '#140c1e'; c.fillRect(0, 0, 720, 900); c.restore(); }
    if (!d.hit && a >= DT.LAND) { d.hit = 1; this.shake = Math.max(this.shake, 3); for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4; this.part({ x: cx + Math.cos(an) * 40, y: cy + 8 + Math.sin(an) * 12, vx: Math.cos(an) * 70, vy: Math.sin(an) * 24 - 8, life: 0.35, size: rnd(4, 6), col: '#f1e2bf', kind: 'puff', drag: 3 }); } }
    // 결과 받침 빛(어둠 속에서 주사위가 보이게)
    if (dim > 0) { c.save(); c.globalAlpha = 0.55 * dim; const gr = c.createRadialGradient(cx, cy - 10, 10, cx, cy - 10, 110); gr.addColorStop(0, d.dbl ? 'rgba(255,214,90,0.9)' : 'rgba(255,244,214,0.8)'); gr.addColorStop(1, 'rgba(255,244,214,0)'); c.fillStyle = gr; c.fillRect(cx - 120, cy - 130, 240, 240); c.restore(); }
    for (let k = 0; k < 2; k++) {
      const q = this.dieAt(k, a, d), up = 1 + 0.18 * dim;
      c.save(); c.globalAlpha = 0.3; c.fillStyle = '#1a0e14'; c.beginPath(); c.ellipse(q.x, q.by + 2, 21 - Math.min(10, q.h * 0.06), 7, 0, 0, TAU); c.fill(); c.restore();
      this.isoDie(c, q.x, q.by - (q.by - q.y) * up, q.s * up, q.rot, q.face, d.dbl && a >= DT.STOP, q.sq, 1);
    }
    if (a >= POP) {
      const p = a - POP, n = d.d1 + d.d2;
      const fly = clamp((a - DT.REL) / 0.15, 0, 1);
      const head = this.pawnHead || [360, 300], ny = cy - 104;
      const sc = p < 0.1 ? 1.8 - p / 0.1 * 0.8 : 1;
      const sm = fly * fly * (3 - 2 * fly), x = cx + (head[0] - cx) * sm, y = ny + (head[1] - ny) * sm - Math.sin(fly * Math.PI) * 40;
      if (p < 0.35 && !d.triple) {
        c.save(); c.globalAlpha = (1 - p / 0.35) * 0.8; c.translate(cx, ny); c.rotate(p * 2);
        for (let r = 0; r < 12; r++) { c.rotate(TAU / 12); c.fillStyle = r % 2 ? (d.dbl ? '#ffd23a' : '#fff1c4') : (d.dbl ? '#ff9a3a' : '#ffd28a'); c.beginPath(); c.moveTo(0, -16); c.lineTo(8, -70 - p * 60); c.lineTo(-8, -70 - p * 60); c.closePath(); c.fill(); }
        c.restore();
      }
      if (fly < 1) {
        c.save(); c.globalAlpha = fly > 0.85 ? (1 - fly) / 0.15 : 1; c.translate(x, y); c.scale(sc * (1 - sm * 0.6), sc * (1 - sm * 0.6));
        c.font = '700 64px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        this.outlined(c, String(n), 0, 0, d.triple ? '#ff8a8a' : d.dbl ? '#ffd23a' : '#ffffff', '#2b1426', 11);
        c.restore();
      }
      const tag = d.triple ? '3연속 더블 — 무인도행!' : d.dbl ? '더블! 한 번 더 · 효과 2배' : d.ctrl ? '조절 성공!' : '';
      if (tag && a < DT.REL + 0.1) {
        const q = p < 0.1 ? p / 0.1 : 1;
        c.save(); c.globalAlpha = a > DT.REL ? 1 - (a - DT.REL) / 0.1 : 1; c.translate(cx, ny - 50); c.scale(0.6 + q * 0.4, 0.6 + q * 0.4);
        c.font = '700 24px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        this.outlined(c, tag, 0, 0, d.triple ? '#ff8a8a' : d.ctrl && !d.dbl ? '#8fffa0' : '#ffd23a', '#2b1426', 7);
        c.restore();
      }
    }
    // 노린 수(조절 게이지로 굴렸을 때): 구르는 동안 받침 아래 작은 표지
    if (d.aim && a < DT.STOP) { c.save(); c.font = '700 17px Jua, sans-serif'; c.textAlign = 'center'; this.outlined(c, '노림 ' + d.aim, cx, cy + 40, '#bfe6ff', '#2b1426', 5); c.restore(); }
    void game;
  };
  // 쿼터뷰 주사위(윗면 + 두 옆면, 굵은 테두리). face = 윗면 눈
  R.isoDie = function (c, x, y, s, rot, face, gold, sq, alpha) {
    const side = [0, 3, 1, 2, 5, 6, 4][face], side2 = [0, 2, 4, 1, 6, 3, 5][face];
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.translate(Math.round(x), Math.round(y)); c.rotate(rot); c.scale(1 + 0.18 * sq, 1 - 0.18 * sq);
    const h = s * 0.5, top = [[0, -s * 0.95], [s, -s * 0.45], [0, s * 0.05], [-s, -s * 0.45]];
    const L = [[-s, -s * 0.45], [0, s * 0.05], [0, s * 0.05 + s * 0.95], [-s, -s * 0.45 + s * 0.95]];
    const Rr = [[s, -s * 0.45], [0, s * 0.05], [0, s * 0.05 + s * 0.95], [s, -s * 0.45 + s * 0.95]];
    const poly = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach((q, n) => n ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.fill(); };
    // 외곽(두꺼운 자두색)
    c.lineJoin = 'round'; c.strokeStyle = '#2b1426'; c.lineWidth = 7;
    c.beginPath(); [[0, -s * 0.95], [s, -s * 0.45], [s, s * 0.5], [0, s], [-s, s * 0.5], [-s, -s * 0.45]].forEach((q, n) => n ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.stroke();
    poly(top, gold ? '#ffe48a' : '#fffaf0'); poly(L, gold ? '#f0b83a' : '#eadcc4'); poly(Rr, gold ? '#d8962a' : '#cdbb9c');
    c.strokeStyle = 'rgba(43,20,38,0.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, s * 0.05); c.lineTo(0, s); c.moveTo(-s, -s * 0.45); c.lineTo(0, s * 0.05); c.lineTo(s, -s * 0.45); c.stroke();
    // 눈: 면마다 기울인 좌표계(윗면 = 마름모, 옆면 = 평행사변형)
    const pips = (v, ox, oy, ux, uy, vx, vy, r) => { c.fillStyle = v === 1 ? '#d23a3a' : '#2b1426'; for (const [i, j] of PIPS[v]) { const px = ox + ux * i * 0.5 + vx * j * 0.5, py = oy + uy * i * 0.5 + vy * j * 0.5; c.beginPath(); c.ellipse(px, py, r * (v === 1 ? 1.5 : 1), r * (v === 1 ? 1.5 : 1) * 0.62, 0, 0, TAU); c.fill(); } };
    pips(face, 0, -s * 0.45, s * 0.5, s * 0.25, -s * 0.5, s * 0.25, s * 0.13);
    c.save(); c.globalAlpha *= 0.9; pips(side, -s * 0.5, s * 0.27, s * 0.5, s * 0.25, 0, s * 0.48, s * 0.1); pips(side2, s * 0.5, s * 0.27, -s * 0.5, s * 0.25, 0, s * 0.48, s * 0.1); c.restore();
    void h; c.restore();
  };

  // ------------------------------------------------------------ 말(동물 영웅)
  R.pawnPose = function (p, scale) {
    const cur = G.tiles[p.tile].pawn;
    let x = cur[0], y = cur[1], jump = 0, sx = 1, sy = 1, lean = 0, back = false, face = p._face || 1;
    if (p.moving && p.path.length) {
      const nx = G.tiles[p.path[0]].pawn, f = Math.min(1, p.hopT / p.hopDur);
      const H = (p.fast ? 12 : p.path.length === 1 ? 34 : 24) * scale;
      x = cur[0] + (nx[0] - cur[0]) * f; y = cur[1] + (nx[1] - cur[1]) * f; jump = Math.sin(f * Math.PI) * H;
      if (f < 0.16) { const k = 1 - f / 0.16; sx = 1 + 0.16 * k; sy = 1 - 0.18 * k; }          // 도약 찌그러짐
      else if (f < 0.85) { sx = 0.93; sy = 1.09; }                                                 // 공중 늘어남
      lean = clamp((nx[0] - cur[0]) / 40, -1, 1) * 0.14;   // [v4.1] 둥근 보드게임 말 → 뒷모습 · 좌우 뒤집기 없음
    } else {
      const ld = this.time - (this.lastLand || -9);
      if (ld < 0.28) { const k = Math.sin(ld / 0.28 * Math.PI) * (1 - ld / 0.28); sx = 1 + 0.24 * k; sy = 1 - 0.22 * k; }   // 착지 찌그러짐
      else { const b = Math.sin(this.time * 3.2) * 0.025; sy = 1 + b; sx = 1 - b * 0.6; }      // 숨쉬기
      back = false;
    }
    return { x, y, jump, sx, sy, lean, back, face };
  };
  R.drawHero = function (c, p, key, scale, ring, mini) {
    const M = root.MANIFEST[key], q = this.pawnPose(p, scale);
    const im = this.I(key); if (!im || !M) return null;
    const s = 0.5 * scale * (mini ? 0.86 : 1), w = M.w * s, h = M.h * s, foot = M.foot * s;
    // 그림자(높이 뜨면 작아짐) · 서 있는 칸 고리
    c.save(); c.globalAlpha = 0.32 - Math.min(0.18, q.jump * 0.006); c.fillStyle = '#1a0e14'; c.beginPath(); c.ellipse(q.x, q.y + 2, w * 0.36 - q.jump * 0.25, w * 0.13, 0, 0, TAU); c.fill(); c.restore();
    if (!p.moving && ring) { const k = 0.5 + 0.5 * Math.sin(this.time * 5); c.save(); c.globalAlpha = 0.55 + 0.35 * k; c.strokeStyle = '#2b1426'; c.lineWidth = 6; c.beginPath(); c.ellipse(q.x, q.y + 1, w * 0.5 + k * 3, w * 0.19 + k, 0, 0, TAU); c.stroke(); c.strokeStyle = ring; c.lineWidth = 3; c.stroke(); c.restore(); }
    c.save(); c.translate(q.x, q.y - q.jump); c.rotate(q.lean); c.scale(q.sx, q.sy);
    c.drawImage(im, -w / 2, -foot, w, h);
    c.restore();
    return [q.x, q.y - q.jump - foot - 6];
  };
  R.drawPawn = function (c, game) {
    const p = game.pawn;
    const head = this.drawHero(c, p, 'p_' + game.pawnId, G.tiles[p.tile].scale, PAWN_COL[game.pawnId] || '#ffd23a');
    if (!head) return null;
    this.pawnHead = head;
    // 남은 칸 수(주사위 합이 날아와 붙은 숫자) — 한 칸 뛸 때마다 톡
    if (p.moving && p.path.length && !p.fast && !(this.diceShow && this.time - this.diceShow.t < DT.REL + 0.14)) {
      const n = p.path.length, hp = clamp(p.hopT / p.hopDur, 0, 1), pop = hp < 0.18 ? 1.35 - hp / 0.18 * 0.35 : 1;
      c.save(); c.translate(head[0], head[1] - 16); c.scale(pop, pop);
      c.fillStyle = '#2b1426'; this.rr(c, -24, -21, 48, 42, 12); c.fill(); c.fillStyle = n === 1 ? '#ffd23a' : '#fff4e0'; this.rr(c, -20, -17, 40, 34, 9); c.fill();
      c.font = '700 28px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#2b1426'; c.fillText(String(n), 0, 1);
      c.restore();
    }
    return head;
  };
  R.drawPartner = function (c, game) {
    const p = game.partner;
    const head = this.drawHero(c, p, 'p_' + p.pawn, G.tiles[p.tile].scale, '#4a9bff', true);
    if (!head) return;
    c.fillStyle = '#4a9bff'; c.strokeStyle = '#2b1426'; c.lineWidth = 3; c.beginPath(); c.arc(head[0], head[1] - 6, 11, 0, TAU); c.fill(); c.stroke();
    c.font = '700 12px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('2P', head[0], head[1] - 5);
  };
  R.hopFx = function (game, e) {
    // 지나는 칸이 톡 밝아짐(말이 어디를 밟는지 보이게)
    const i = e.i;
    this.addFx(0.28, (c, p) => { c.save(); c.globalAlpha = 0.45 * (1 - p); this.tileFill(c, i, e.last ? '#fff1c4' : '#fff8e4'); c.restore(); }, 'under');
    if (e.last) this.lastLand = this.time;
    else { const [x, y] = G.tiles[i].pawn; for (let k = 0; k < 3; k++) this.part({ x: x + rnd(-10, 10), y: y + rnd(-2, 3), vx: rnd(-30, 30), vy: rnd(-25, -8), life: 0.3, size: rnd(3, 5), col: '#f1e2bf', kind: 'puff', drag: 3 }); }
  };
  R.landFx = function (game, i) {
    const t = game.tiles[i], [x, y] = G.tiles[i].pawn;
    this.addFx(0.45, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#2b1426'; c.lineWidth = 5; c.beginPath(); c.ellipse(x, y, 22 + p * 40, 9 + p * 16, 0, 0, TAU); c.stroke(); c.strokeStyle = '#fff1c4'; c.lineWidth = 2.5; c.stroke(); c.restore(); }, 'under');
    this.shake = Math.max(this.shake, 2.5);
    // 땅 속성 알림(멈춘 칸이 좋은 땅 · 나쁜 땅이면 이름과 효과)
    if (t.trait) {
      const T = D.TRAITS[t.trait], b = this.bigText, busy = b && this.time - b.t0 < b.dur;
      let ty = y - 128; if (busy && Math.abs(ty - 330) < 80) ty = y + 44;
      this.say(T.name, T.good ? '#ffe28a' : '#d9b8ff', x, ty, 1.4, 24); this.say(T.desc, '#fff4e0', x, ty + 24, 1.4, 15);
    }
  };

  // ------------------------------------------------------------ 포탑 자리 · 땅 문양 · 도착 예고 · 버프 고리 · 받침 주사위
  R.drawTiles = function (c, game) {
    const t = this.time;
    // 포탑 자리: 판 바깥 살짝 어두운 둥근 자리(사용자 지시 '반투명 딤드'). 요새 구역 = 구역 색, 파괴 예고 = 빨강, 점령 = 보라
    for (const tl of game.tiles) {
      if (tl.corner) continue;
      const i = tl.i;
      c.save(); c.globalAlpha = 0.22; this.padFill(c, i, '#1a1024'); c.globalAlpha = 0.32; this.padStroke(c, i, '#1a1024', 2.5); c.globalAlpha = 0.22; c.save(); c.translate(0, 1.5); this.padStroke(c, i, '#fff4d6', 1.5); c.restore(); c.restore();   // 어두운 판(화산 · 심연)에서도 보이게 아래쪽 밝은 테
      if (game.zoneFull(tl.zone)) { c.save(); c.globalAlpha = 0.3 + 0.1 * Math.sin(t * 4); this.padFill(c, i, D.ZONE_COLOR[tl.zone]); c.restore(); this.padStroke(c, i, 'rgba(255,230,140,0.9)', 2.5); }
      if (tl.warn) { c.save(); c.globalAlpha = 0.35 + 0.25 * Math.sin(t * 10); this.padFill(c, i, '#ff3030'); c.restore(); }
      if (tl.occ) { c.save(); c.globalAlpha = 0.4; this.padFill(c, i, '#5a1a4a'); c.restore(); }
    }
    // 칸 고르기(황금 주사위 · 우주여행 = 판 칸, 순간이동술사 = 포탑 자리)
    if (game.pick) for (const i of game.pick.tiles) {
      const k = 0.28 + 0.14 * Math.sin(t * 6 + i);
      if (game.pick.kind === 'swap') { if (G.tiles[i].corner) continue; c.save(); c.globalAlpha = k; this.padFill(c, i, '#fff6c8'); c.restore(); this.padStroke(c, i, '#ffd23a', 3); }
      else { c.save(); c.globalAlpha = k; this.tileFill(c, i, '#fff6c8'); c.restore(); this.tileStroke(c, i, '#ffd23a', 3); }
    }
    // 땅 문양: 칸 바닥에 그려진 그림처럼 납작하게(위에서 본 원 = 화면에서 납작한 타원)
    for (const tl of game.tiles) {
      if (!tl.trait) continue;
      const im = this.I('tr_' + tl.trait); if (!im) continue;
      const g = G.tiles[tl.i], [x, y] = g.center, pulse = game.t < 3 ? 1 + 0.12 * Math.sin(t * 10) : 1;
      const w = 0.42 * 2 * G.u * g.tscale * pulse, h = w * im.height / im.width * G.CFG.k;
      // 나쁜 땅: 밝은 받침을 깔아 어두운 판(심연 · 화산)에서도 뾰족한 모양이 보이게(검수)
      if (!D.TRAITS[tl.trait].good) { c.save(); c.globalAlpha = 0.5; c.fillStyle = '#ffe9d6'; c.beginPath(); c.ellipse(x, y, w * 0.53, h * 0.53, 0, 0, TAU); c.fill(); c.restore(); }
      c.drawImage(im, x - w / 2, y - h / 2, w, h);
    }
    // 도착할 칸 예고(이동 중): 금빛으로 깜빡임 — 남은 칸이 줄수록 빨라짐. 그 칸의 포탑 자리도 함께
    const P = game.pawn;
    if (P.moving && P.path.length && !P.fast) {
      const j = P.path[P.path.length - 1], k = 0.5 + 0.5 * Math.sin(t * (8 + 14 / P.path.length));
      c.save(); c.globalAlpha = 0.4 + 0.35 * k; this.tileFill(c, j, '#fff1a0'); c.restore(); this.tileStroke(c, j, '#2b1426', 6); this.tileStroke(c, j, '#ffd23a', 3);
      if (!G.tiles[j].corner) { c.save(); c.globalAlpha = 0.25 + 0.25 * k; this.padStroke(c, j, '#ffd23a', 3); c.restore(); }
    }
    // 버프 고리(축성 · 탄막 · 응원 · 빨간 말이 지나간 칸): 포탑 발밑에서 도는 점선
    for (const tl of game.tiles) {
      const tw = tl.tower; if (!tw) continue;
      const col = game.t < (tw.barrageUntil || 0) ? '#ffc23a' : game.t < (tw.blessUntil || 0) ? '#fff2a0' : game.t < game.cheerUntil ? '#ff8adf' : game.t < (tw.carUntil || 0) ? (PAWN_COL[game.pawnId] || '#ffd23a') : null;
      if (!col) continue;
      const [x, y] = G.tiles[tl.i].tower, s = G.tiles[tl.i].scale;
      c.save(); c.translate(x, y); c.scale(1, 0.42); c.rotate(t * 2.4 + tl.i);
      c.strokeStyle = col; c.lineWidth = 5; c.setLineDash([14, 10]); c.globalAlpha = 0.85; c.beginPath(); c.arc(0, 0, 40 * s, 0, TAU); c.stroke(); c.restore();
    }
    this.drawTrayDice(c, game);
  };
  // 짓기: 말이 선 칸 → 바깥 포탑 자리로 빛 알갱이가 건너가고(0.26초) 그 자리에 포탑이 떨어진다
  R.linkFx = function (i) {
    const g = G.tiles[i]; if (g.corner) return;
    const [x0, y0] = g.center, [x1, y1] = g.tower;
    this.addFx(0.3, (c, p) => {
      const e = easeOut(Math.min(1, p / 0.85)), x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e - Math.sin(e * Math.PI) * 26;
      c.save(); c.globalAlpha = 1 - Math.max(0, p - 0.85) / 0.15;
      c.strokeStyle = 'rgba(255,241,196,0.7)'; c.lineWidth = 3; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 26, x, y); c.stroke(); c.setLineDash([]);
      this.star(c, x, y, 4, 9, 3, p * 6, '#fff1c4'); c.restore();
    }, 'over');
  };

  // ------------------------------------------------------------ 포탑: 숨쉬기 · 쏠 때 반동 크게
  R.drawTower = function (c, game, i, opt) {
    const an = this.towerAnim[i];
    if (!(opt && opt.at) && game.tiles[i].tower && an && an.recoil && this.time - an.recoil < 0.16) { this._kick = 1 - (this.time - an.recoil) / 0.16; }
    else this._kick = 0;
    this._breath = opt && opt.at ? 0 : Math.sin(this.time * 2.3 + i * 1.3);
    return baseDrawTower.call(this, c, game, i, opt);
  };

  // ------------------------------------------------------------ 처치 · 피해 숫자
  R.killFx = function (e) {
    // 막타 숫자(방금 뜬 것)는 남겨 1.35배로 키우고, 오래된 숫자만 지운다
    this.texts = this.texts.filter(t => !(t.kind === 'dmg' && this.time - t.t0 > 0.08 && Math.abs(t.x - e.x) < 70 && Math.abs(t.y - e.y) < 90));
    for (const t of this.texts) if (t.kind === 'dmg' && this.time - t.t0 <= 0.08 && Math.abs(t.x - e.x) < 70 && Math.abs(t.y - e.y) < 90) { t.size = Math.min(34, t.size * 1.35); t.dur = 0.8; }
    const x = e.x, y = e.y - 14 * (e.g || 1), big = e.big, g = e.g || 1;
    const col = GOO[e.boss ? 'giant' : e.kind] || GOO.normal;
    // 흰 번쩍 고리 + 별
    this.addFx(0.16, (c, p) => { const r = (big ? 48 : 30) * (0.6 + p * 0.9) * g; c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#ffffff'; c.lineWidth = 5 * (1 - p) + 1; c.beginPath(); c.ellipse(x, y, r, r * 0.8, 0, 0, TAU); c.stroke(); c.restore(); this.star(c, x, y, 4, r * 0.8 * (1 - p), r * 0.22, 0.4, '#fffbe8'); });
    // 방울: 위로 튀었다가 떨어져 바닥 얼룩
    const n = big ? 16 : 10, gy = e.y + 4;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + rnd(-1.35, 1.35), v = rnd(150, 300) * (big ? 1.25 : 1);
      const d = { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: col[k % 3 === 2 ? 2 : k % 2], r: rnd(3, 5.5) * (big ? 1.4 : 1), t0: this.time, landed: false };
      this.addFx(1.1, (c, p) => {
        const age = p * 1.1;
        if (!d.landed) { const tt = age; d.cx = d.x + d.vx * tt; d.cy = d.y + d.vy * tt + 620 * tt * tt; if (d.cy >= gy + (k % 3) * 4 && tt > 0.1) { d.landed = true; d.lx = d.cx; d.ly = gy + (k % 3) * 4; d.lt = age; } }
        if (!d.landed) { c.fillStyle = '#2b1426'; c.fillRect(Math.round(d.cx - d.r - 1.5), Math.round(d.cy - d.r - 1.5), Math.round(d.r * 2 + 3), Math.round(d.r * 2 + 3)); c.fillStyle = d.c; c.fillRect(Math.round(d.cx - d.r), Math.round(d.cy - d.r), Math.round(d.r * 2), Math.round(d.r * 2)); }
        else { const q = clamp((age - d.lt) / (1.1 - d.lt), 0, 1); c.save(); c.globalAlpha = (1 - q) * 0.8; c.fillStyle = d.c; c.beginPath(); c.ellipse(d.lx, d.ly, d.r * 1.8, d.r * 0.7, 0, 0, TAU); c.fill(); c.restore(); }
      });
    }
    // 넋: 작은 유령이 흔들리며 떠오름
    this.later(0.08, () => this.addFx(0.8, (c, p) => {
      const yy = y - 6 - easeOut(p) * 46, xx = x + Math.sin(p * 9) * 5, a = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85, s = (big ? 2.2 : 1.7) * g;
      c.save(); c.globalAlpha = a * 0.92; c.translate(xx, yy); c.scale(s, s);
      c.fillStyle = '#2b1426'; c.beginPath(); c.arc(0, -4, 9, Math.PI, 0); c.lineTo(9, 8); c.lineTo(5, 5); c.lineTo(0, 9); c.lineTo(-5, 5); c.lineTo(-9, 8); c.closePath(); c.fill();
      c.fillStyle = '#f4eeff'; c.beginPath(); c.arc(0, -4, 6.5, Math.PI, 0); c.lineTo(6.5, 5); c.lineTo(3.5, 3); c.lineTo(0, 6); c.lineTo(-3.5, 3); c.lineTo(-6.5, 5); c.closePath(); c.fill();
      c.fillStyle = '#2b1426'; c.fillRect(-3.5, -5, 2, 3); c.fillRect(1.5, -5, 2, 3);
      c.restore();
    }));
    if (big) this.explosion(x, y + 4, 26, 0.9);
    else this.sprite(['fx_flash', 'fx_hit'], x, y, 40 * g, 16);
    // 금화(기존 방식 그대로)
    if (e.gold > 0 && e.kind !== 'mini') {
      const nc = big ? 4 : e.gold > 60 ? 2 : 1;
      for (let k = 0; k < nc; k++) this.coins.push({ x, y, vx: rnd(-80, 80), vy: rnd(-260, -180), gy: y + 22, b: 0, t0: this.time, phase: Math.random() * 6, val: 0 });
      const last = this.texts.find(t => t.kind === 'gold' && /^\+\d+$/.test(t.s) && this.time - t.t0 < 0.6 && Math.abs((t.x0 ?? t.x) - x) < 130 && Math.abs((t.y0 ?? t.y) - (y - 62)) < 100);
      if (last) { last.sum = (last.sum || +last.s.slice(1)) + e.gold; last.s = '+' + last.sum; last.size = Math.min(34, last.size + 2); last.t0 = Math.max(last.t0, this.time - 0.2); }
      else { const vx0 = x - PZ[0], vy0 = (y - PZ[1]) * 1.3, vl = Math.hypot(vx0, vy0) || 1, ox = x + vx0 / vl * 40, oy = y < PZ[1] ? y - 64 : y + 34; this.goldFloat(ox, oy, '+' + e.gold, big); this.texts[this.texts.length - 1].t0 = this.time + 0.15; }
    }
    if (big) this.shake = Math.max(this.shake, 8);
  };
  R.dmgText = function (e) {
    const near = this.texts.find(t => t.kind === 'dmg' && /^\d+$/.test(t.s) && this.time - t.t0 < 0.3 && Math.abs(t.x - e.x) < 40 && Math.abs(t.y - e.y) < 40);
    if (near) { near.sum = (near.sum || +near.s) + e.amt; near.s = String(Math.round(near.sum)); near.t0 = this.time; if (e.crit) near.col = '#ffd23a'; near.size = Math.min(30, near.size + 0.8); return; }
    this.texts = this.texts.filter(t => !(t.kind === 'dmg' && this.time - t.t0 >= 0.35 && Math.abs(t.x - e.x) < 46 && Math.abs(t.y - e.y) < 60));
    const big = e.big || e.crit;
    const vx = e.x - PZ[0], vy = (e.y - PZ[1]) * 1.3, vl = Math.hypot(vx, vy) || 1;
    this.texts.push({ s: String(Math.round(e.amt)), col: e.crit ? '#ffd23a' : big ? '#ffe9a0' : '#ffffff', x: e.x + vx / vl * 18 + rnd(-8, 8), y: e.y + vy / vl * 14, t0: this.time, dur: 0.62, size: e.crit ? 28 : big ? 24 : 19, kind: 'dmg', pop: 1 });
    if (this.texts.length > 60) this.texts.splice(0, this.texts.length - 60);
  };

  // ------------------------------------------------------------ 한 장면: 위 캔버스에 주사위 쇼
  R.drawTop = function (dt) {
    this._bannerLater = true; baseDrawTop.call(this, dt);
    if (this.diceShow && this._game) { const c = this.top; c.save(); if (this.shakeX) c.translate(this.shakeX * 0.5, this.shakeY * 0.5); this.drawDiceShow(c, this._game); c.restore(); }
    if (this.diceShow2 && this._game) { const d = this.diceShow2, a = this.time - d.t; if (a > 1.1) this.diceShow2 = null; else { const c = this.top; for (let k = 0; k < 2; k++) this.isoDie(c, 600 + k * 40, 560 - (a < 0.4 ? Math.sin(a / 0.4 * Math.PI) * 30 : 0), 16, a < 0.4 ? a * 10 : 0, a < 0.4 ? 1 + Math.floor(a * 24 % 6) : (k ? d.d2 : d.d1), d.dbl, 0, a > 0.8 ? (1.1 - a) / 0.3 : 1); } }
  };
  // 라운드 배너는 떠오른 주사위보다 위에(검수: 주사위가 '1 라운드' 글자를 덮음)
  const drawTop2 = R.drawTop; R.drawTop = function (dt) { drawTop2.call(this, dt); this.drawBanner(this.top); };
  R.frame = function (game, dt, ui) { this._game = game; return baseFrame.call(this, game, dt, ui); };
})(window);
