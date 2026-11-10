// v5.8 층(Renderer에 덧붙임) — 보스전 판 규칙: 입구 수정 · 한 바퀴 · 절반 목표선 · 수정 깨짐
// 사용자(2026-11-10): '보스가 시작 입구에서 나오고 그 입구가 수정으로 바뀌어. 보스가 한 바퀴를 돌아 수정에 부딪히면 보스도 수정도 사라지고,
//   그 수정은 판에 몬스터가 있을 수 있는 수(50)를 지키던 것 — 깨지면 10씩 내려감. 줄어들 때 확실히 보여야 함(수정에서 위 게이지로 데미지 이펙트 → 50이 40으로)'
//   + '절반쯤 갈 때까지 잡으면 높은 등급 카드 확률 UP(보스전 전용 목표)'
// 흐름: 경고(화면 = ui.js #warnFx) → 입구 굴 자리에 수정이 솟음(0.25 ~ 0.9초, 고리 · 빛) → 보스가 한 바퀴 → 절반 목표선(금 깃발)
//   → 절반 전에 잡으면 목표선이 금빛으로 터짐 / 지나치면 목표선이 회색 ✕ → 수정에 닿으면 금 간 수정 + 조각 · 흔들림 → 사라짐
//   (위 게이지로 날아가는 조각 · 숫자 변화는 DOM 쪽 ui.js가 그림 — 화면 맨 위 HUD까지 가야 하므로)
// 그리기 원칙: 오프스크린 캔버스 캐시 없음 · 'lighter' 없음
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eb = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const PLUM = '#2b1426', VIO = '#d070ff';
  const ENT = () => G.lanePoint(0, 0), HALF = () => G.lanePoint(D.ECON.crystal.half, 0);

  R.cs14 = function () { return this._cs14 || (this._cs14 = { cr: null, half: null }); };

  const base14 = R.consume;
  R.consume = function (game, events, audio) {
    const S = this.cs14(), A = audio || this._A14; this._A14 = A; const keep = [];
    for (const e of events) {
      if (e.ev === 'boss') { this.shake = Math.max(this.shake || 0, 10); if (A && A.boss) A.boss(); continue; }   // 옛 가운데 띠 대신 화면 경고(ui.js)
      if (e.ev === 'crystal') { S.cr = { t0: this.time, state: 'on' }; S.half = { t0: this.time, state: 'on' }; continue; }
      if (e.ev === 'bossHalf') { if (S.half) { S.half.state = 'miss'; S.half.t1 = this.time; } if (A && A.error) A.error(); continue; }
      if (e.ev === 'bossGoal') {
        if (S.half) { S.half.state = 'goal'; S.half.t1 = this.time; }
        const [x, y] = HALF(); this.ring(x, y, 60, '#ffd23a', 0.8, 7); this.ring(x, y, 36, '#ffffff', 0.5, 4);
        for (let q = 0; q < 22; q++) { const a = q / 22 * TAU, sp = rnd(140, 260); this.part({ x, y: y - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 50, grav: 240, drag: 1.4, life: rnd(0.6, 0.9), size: rnd(4, 7), col: q % 3 ? '#ffd23a' : '#ffffff', kind: 'star', vr: 6 }); }
        if (this.v47) this.v47().ribbons.length = 0;   // 앞에 줄 선 보스 스킬 알림을 비우고 바로
        this.ribbon('보스 목표 달성!', '절반 전에 처치 — 이번 카드 등급 UP', true, 'key', { col: '#ffd23a', pri: 1, dur: 2.4 });
        if (A && A.jackpot) A.jackpot();
        if (S.cr) { S.cr.state = 'fade'; S.cr.t1 = this.time; }
        continue;
      }
      if (e.ev === 'bossGoalMiss') { if (S.cr && S.cr.state === 'on') { S.cr.state = 'fade'; S.cr.t1 = this.time; } if (S.half && S.half.state === 'on') S.half = null; keep.push(e); continue; }
      if (e.ev === 'bossDown') { if (S.cr && S.cr.state === 'on') { S.cr.state = 'fade'; S.cr.t1 = this.time; } keep.push(e); continue; }   // 목표선은 바로 뒤 bossGoal / bossGoalMiss가 정리
      if (e.ev === 'crystalBreak') {
        const [x, y] = ENT();
        if (S.cr) { S.cr.state = 'break'; S.cr.t1 = this.time; } else S.cr = { t0: this.time - 1, state: 'break', t1: this.time };
        this.shake = Math.max(this.shake || 0, 16); this.flash = Math.max(this.flash || 0, 0.35);
        this.ring(x, y - 30, 70, VIO, 0.7, 8); this.ring(x, y - 30, 40, '#ffffff', 0.45, 4);
        for (let q = 0; q < 26; q++) { const a = rnd(-Math.PI, 0), sp = rnd(160, 340); this.part({ x: x + rnd(-14, 14), y: y - rnd(20, 60), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 520, drag: 0.6, life: rnd(0.6, 1.0), size: rnd(4, 8), col: q % 3 ? VIO : '#f6d0ff', kind: 'star', vr: rnd(-9, 9) }); }
        if (this.v47) this.v47().ribbons.length = 0;
        this.ribbon('수정이 깨졌다!', `몬스터 수용치 ${e.from} → ${e.to}`, false, null, { col: '#ff5a8a', pri: 1, dur: 2.6 });
        if (A) { try { A.boom && A.boom(); A.noise && A.noise({ f: 2400, f2: 600, d: 0.5, v: 0.22 }); } catch (er) { /* 소리 없음 */ } }
        if (S.half) S.half = null;
        continue;
      }
      if (e.ev === 'bossLeave') { if (S.cr && S.cr.state === 'on') { S.cr.state = 'fade'; S.cr.t1 = this.time; } if (S.half && S.half.state === 'on') S.half = null; keep.push(e); continue; }
      keep.push(e);
    }
    base14.call(this, game, keep, audio);
  };

  // ------------------------------------------------------------ 입구 수정(발밑 층 위 · 몬스터와 같은 높이 = over 직전)
  R.crystal14 = function (c, game) {
    const S = this.cs14(), C = S.cr; if (!C) return;
    const t = this.time, a = t - C.t0, [x, y] = ENT();
    let sc = eb(clamp((a - 0.25) / 0.6, 0, 1)), op = 1, crack = false;
    if (C.state === 'fade') { const q = (t - C.t1) / 0.8; op = 1 - q; sc *= 1 + q * 0.15; if (q >= 1) { S.cr = null; return; } }
    if (C.state === 'break') { const q = (t - C.t1) / 1.4; crack = true; op = q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4; if (q >= 1) { S.cr = null; return; } }
    if (sc <= 0.01) return;
    const im = this.I(crack ? 'x_crystal_b' : 'x_crystal'), M = root.MANIFEST[crack ? 'x_crystal_b' : 'x_crystal'];
    c.save(); c.globalAlpha = op;
    // 바닥 빛 고리
    const pu = 0.5 + 0.5 * Math.sin(t * 4);
    c.globalAlpha = op * (0.35 + 0.2 * pu); c.fillStyle = VIO; c.beginPath(); c.ellipse(x, y + 4, 52 * sc, 18 * sc, 0, 0, TAU); c.fill();
    c.globalAlpha = op;
    const shk = crack && t - C.t1 < 0.35 ? rnd(-4, 4) : 0;
    if (im && M) { const h = 112 * sc, w = M.w / M.h * h; c.drawImage(im, x - w / 2 + shk, y + 10 - h, w, h); }
    else { c.fillStyle = VIO; c.beginPath(); c.moveTo(x, y - 90 * sc); c.lineTo(x + 26 * sc, y); c.lineTo(x - 26 * sc, y); c.closePath(); c.fill(); }
    if (!crack && C.state === 'on') { for (let k = 0; k < 3; k++) { const ang = t * 1.6 + k * 2.1; this.star(c, x + Math.cos(ang) * 46, y - 50 + Math.sin(ang * 1.3) * 26, 4, 6, 2.4, t * 3 + k, '#f6d0ff'); } }
    c.restore();
    // 수정 이름(처음 2초)
    if (C.state === 'on' && a < 3) { c.save(); c.globalAlpha = clamp((a - 0.5) / 0.3, 0, 1) * clamp((3 - a) / 0.4, 0, 1); c.font = '700 18px Jua, sans-serif'; c.textAlign = 'center'; this.outlined(c, '수용치 수정', x, y - 128, '#f6d0ff', PLUM, 5); c.restore(); }
  };

  // ------------------------------------------------------------ 절반 목표선(금 깃발) — 보스 진행을 판 위에서 바로 읽게
  R.half14 = function (c, game) {
    const S = this.cs14(), H = S.half; if (!H) return;
    const t = this.time, a = t - H.t0, [x, y] = HALF(), b = game.boss;
    let op = clamp((a - 0.6) / 0.4, 0, 1), miss = H.state === 'miss', goal = H.state === 'goal';
    if (miss || goal) { const q = (t - H.t1) / (goal ? 1.2 : 2.2); op *= q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3; if (q >= 1) { S.half = null; return; } }
    if (op <= 0) return;
    const col = miss ? '#9a90b0' : '#ffd23a', pu = 0.5 + 0.5 * Math.sin(t * 6);
    c.save(); c.globalAlpha = op;
    // 길을 가로지르는 점선
    c.lineCap = 'round'; c.setLineDash([10, 8]); c.lineDashOffset = -t * 30;
    for (const [cc, w] of [[PLUM, 9], [col, 5]]) { c.strokeStyle = cc; c.lineWidth = w; c.beginPath(); c.moveTo(x - 60, y + 22); c.lineTo(x, y + 2); c.lineTo(x + 60, y + 22); c.stroke(); }
    c.setLineDash([]);
    // (깃발 · 글씨는 위 보스 체력 바에 가려져서 뺌 — 바로 위 보스 진행 줄의 ◆가 같은 자리를 가리킴) 길 위 ◆
    const dy = miss ? 0 : Math.sin(t * 5) * 2;
    c.fillStyle = PLUM; c.beginPath(); c.moveTo(x, y - 14 + dy); c.lineTo(x + 13, y + 2 + dy); c.lineTo(x, y + 18 + dy); c.lineTo(x - 13, y + 2 + dy); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(x, y - 9 + dy); c.lineTo(x + 8, y + 2 + dy); c.lineTo(x, y + 13 + dy); c.lineTo(x - 8, y + 2 + dy); c.closePath(); c.fill();
    if (!miss && !goal) this.glow(c, x, y + 2, 40 + pu * 8, '#ffd23a', 0.3 + 0.15 * pu);
    if (miss) { c.strokeStyle = '#ff5a5a'; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 9, y - 7); c.lineTo(x + 9, y + 11); c.moveTo(x + 9, y - 7); c.lineTo(x - 9, y + 11); c.stroke(); }
    c.restore();
  };

  // 목표 달성 연출이 카드 창에 바로 가리지 않게 1.3초 기다림(ui.js가 cardBusy()를 보고 카드 창을 늦게 엶)
  const busy14 = R.cardBusy;
  R.cardBusy = function () { const H = this.cs14().half; return (H && H.state === 'goal' && this.time - H.t1 < 1.3) || (busy14 ? busy14.call(this) : false); };

  const fx14 = R.drawFx;
  R.drawFx = function (c, layer) {
    const g = this._game;
    if (layer === 'under' && g) { fx14.call(this, c, layer); this.half14(c, g); return; }
    if (layer === 'over' && g) this.crystal14(c, g);
    fx14.call(this, c, layer);
  };
})(window);
