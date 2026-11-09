// v4.5 층(Renderer에 덧붙임) — 모든 단계가 실제로 날아가는 탄(behave v4.5)에 맞춘 탄 모양 · 단계별 화려함 · 숨결 방향 · 사거리 표시
// 사용자: '4단계부터 날아가는 탄이 사라지고 몬스터 자체 이펙트만 — 강력해 보이지 않는다. 1단계는 느리고 단순, 6단계는 다다다 빠르고 화려하게'
//         '화염 검사는 칼만 휘두르고 칼에서 불이 안 나감' · '드래곤 화염이 입에서 크고 몬스터 쪽에서 작다(반대)'
// · 새 탄: 화염 창(화염 4) · 불길 참격(화염 5, 검 끝에서 날아가는 초승달) · 용의 숨결(화염 6, 입에서 작게 → 대상 쪽으로 커짐) · 대폭발(화염 5 주기)
//         태양 창(성광 4~6) · 독 폭탄(맹독 4~6) · 빛나는 잎(성장 4~6) · 무지개 조각(프리즘) · 얼음 혜성(빙결 6 주기)
// · 모든 탄: 4단계부터 빛 꼬리, 5단계부터 반짝이, 6단계는 무지갯빛 반짝이 — 단계가 오를수록 크기 · 속도(규칙) · 탄 수(규칙)가 함께 오른다
// · 그리기 원칙: 상태 없는 그리기(탄 객체의 위치 · 시간만), 오프스크린 캔버스 안 씀(아이폰)
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const NEW = new Set(['flame', 'flameslash', 'breath', 'meteor', 'sunbolt', 'toxic', 'acidglob', 'leaf', 'prism', 'comet']);
  const TK = [1, 1, 1.1, 1.22, 1.38, 1.55, 1.75];   // 단계별 탄 크기
  const PAL = {
    fire: ['#fffbe0', '#ffe46a', '#ff9a1c', '#e8452c', '#7a1a10'], light: ['#ffffff', '#fffbe0', '#ffe48a', '#ffc23a', '#a8701a'],
    poison: ['#f0ffe0', '#c8ff8a', '#7be06a', '#3a9a2a', '#1a4a14'], growth: ['#ffffff', '#fffbe0', '#fff2a0', '#ffd24a', '#8a6a10'],
    ice: ['#ffffff', '#e6f8ff', '#9fe0ff', '#4aa0ff', '#1a3a6a'], corrode: ['#f8ffd8', '#e8ff8a', '#b8e83a', '#6a9a1a', '#2a3a0a'],
  };
  const RAIN = ['#ff6a6a', '#ffb347', '#ffe36a', '#7be06a', '#6ab0ff', '#b07cff'];
  const hue = (t, k) => RAIN[Math.floor((t * 8 + k) % 6 + 6) % 6];

  // 무기 끝 · 꼭대기에서 나온 탄의 화면 위치(render5 · render6의 _o와 같은 식)
  const pos = s => {
    if (!s._o) return [s.x, s.y];
    const d = Math.hypot(s.tx - s.x, s.ty - s.y); if (s._d0 == null) s._d0 = Math.max(1, d);
    const k = clamp(d / s._d0, 0, 1) ** 1.5; return [s.x + s._o[0] * k, s.y + s._o[1] * k];
  };
  const progOf = s => { const d = Math.hypot(s.tx - s.x, s.ty - s.y); if (s._p0 == null) s._p0 = Math.max(1, d); return clamp(1 - d / s._p0, 0, 1); };

  // ------------------------------------------------------------ 성능: 픽셀 원(빛 번짐 · 탄 · 입자)을 반지름별 경로(Path2D)로 한 번 만들어 재사용
  // 원래는 원 하나를 3px 가로줄 수십 개(fillRect)로 매번 칠함 → 6단계 탄이 수백 개면 한 프레임에 수만 번. 모양은 같다(반지름 1px 단위로 묶음).
  // 그림을 미리 그려 두는 오프스크린 캔버스가 아니라 도형 경로만 기억하므로 아이폰 지침(캐시 캔버스 금지)과 맞음
  const CIRC = new Map();
  const circPath = r => {
    const P = 3, key = r <= 7.5 ? 'd' + Math.max(1, Math.round(r / P)) : Math.round(r);
    let p = CIRC.get(key); if (p) return p;
    p = new Path2D();
    if (r <= 7.5) { const m = Math.max(1, Math.round(r / P)); for (let j = -m; j <= m; j++) { const w = (m - Math.abs(j)) * P; p.rect(-w - P / 2, j * P - P / 2, w * 2 + P, P); } }
    else { const rr = Math.round(r), n = Math.ceil(rr / P); for (let j = -n; j <= n; j++) { const yy = j * P, w = Math.floor(Math.sqrt(Math.max(0, rr * rr - yy * yy)) / P) * P; if (w <= 0 && j) continue; p.rect(-w - P / 2, yy - P / 2, w * 2 + P, P); } }
    CIRC.set(key, p); return p;
  };
  if (typeof Path2D !== 'undefined' && !/[?&]nopath=1/.test(location.search)) R.circle = function (c, x, y, r, col) {
    if (!(r > 0)) return;
    const P = 3; c.fillStyle = col; c.translate(Math.round(x / P) * P, Math.round(y / P) * P); c.fill(circPath(r)); c.translate(-Math.round(x / P) * P, -Math.round(y / P) * P);
  };

  // 작은 빛 번짐(반지름 12 미만 — 주변 연출 반짝이 · 작은 탄)은 한 겹으로(3겹과 눈으로 거의 같고 칠하는 양은 1/3)
  const baseGlow = R.glow;
  R.glow = function (c, x, y, r, col, a) {
    if (r >= 12) return baseGlow.call(this, c, x, y, r, col, a);
    c.save(); c.globalAlpha *= (a == null ? 1 : a) * 0.42; this.circle(c, x, y, r * 0.7, col); c.restore();
  };
  // 입자 예산: 6단계 판이 가득하면 입자가 900개까지 쌓여 그리기가 무거움 → 600개 상한, 450개를 넘으면 탄 장식 입자는 건너뜀
  const PART_MAX = 600, PART_BUSY = 450;
  const basePart = R.part;
  R.part = function (o) { if (this.parts.length >= PART_MAX) this.parts.shift(); return basePart.call(this, o); };
  R.busy = function () { return this.parts.length > PART_BUSY; };

  // ------------------------------------------------------------ 사라지는 점 그리기 보조: 커지는 불티(숨결 · 화염)
  const baseDrawParts = R.drawParts;
  R.drawParts = function (c, dt, layer) {
    // grow 표시가 붙은 입자는 수명 동안 커진다(입에서 작게 → 멀수록 크게)
    for (const p of this.parts) if (p.grow && !p._g0) { p._g0 = p.size; p.shrink = false; }
    for (const p of this.parts) if (p.grow) { const q = clamp(p.age / p.life, 0, 1); p.size = p._g0 * (0.3 + q * 1.5); }
    return baseDrawParts.call(this, c, dt, layer);
  };
  // 화염 방사 · 숨결 이벤트(주기 공격의 용 숨결): 입 쪽 작게 → 대상 쪽 크게
  R.flame = function (e) {
    const n = e.big ? 30 : 14, dx = e.tx - e.x, dy = e.ty - 10 - e.y;
    for (let k = 0; k < n; k++) {
      const sp = rnd(-0.16, 0.16), v = rnd(2.3, 2.9);
      this.part({ x: e.x, y: e.y, vx: (dx * Math.cos(sp) - dy * Math.sin(sp)) * v, vy: (dx * Math.sin(sp) + dy * Math.cos(sp)) * v, life: rnd(0.32, 0.44), size: rnd(7, 11) * (e.big ? 1.45 : 1), grav: 300, col: ['#fff2a0', '#ffd23a', '#ff8a1c', '#e8452c'][k % 4], kind: 'fire', drag: 1.6, add: true, grow: 1, delay: k * 0.008 });
    }
    this.later(0.2, () => this.explosion(e.tx, e.ty - 10, e.big ? 40 : 22, e.big ? 1.3 : 0.7));
  };
  // 용 · 숨결 캐릭터의 무기 연출 입자도 커지게(render5 weaponFx 'breath')
  const baseWeaponFx = R.weaponFx;
  R.weaponFx = function (game, e, tw, tip, big) {
    const n0 = this.parts.length;
    baseWeaponFx.call(this, game, e, tw, tip, big);
    if (tw && tw.type === 'fire' && tw.tier >= 6) for (let k = n0; k < this.parts.length; k++) if (this.parts[k].kind === 'fire') { this.parts[k].grow = 1; this.parts[k].size *= 0.8; }
  };

  // ------------------------------------------------------------ 탄 그리기
  const prevShots = R.drawShots;
  R.drawShots = function (c, game) {
    const mine = [], rest = [];
    for (const s of game.shots) (NEW.has(s.kind) ? mine : rest).push(s);
    // 기존 모양 탄: 6단계 무지갯빛 반짝이 · 큰 한 방(big) 빛을 덧붙인 뒤 원래 그리기
    for (const s of rest) {
      if (s.delay > 0) continue;
      const t = s.tier || 1; if (t < 6 && !s.big) continue;
      const [x, y] = pos(s);
      if (!this.busy() && Math.random() < 0.5) this.part({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-20, 20), vy: rnd(-30, 0), life: 0.32, size: rnd(2.5, 3.5), col: hue(this.time, Math.random() * 6), kind: 'star', vr: 8 });
      if (s.big) this.glow(c, x, y, 34, (D.TOWERS[s.type] || {}).color || '#fff', 0.6);
    }
    if (rest.length) prevShots.call(this, c, { shots: rest });
    for (const s of mine) { if (s.delay > 0) continue; this.drawShot7(c, s); }
  };
  R.drawShot7 = function (c, s) {
    const t = s.tier || 1, k = TK[t] * (s.big ? 1.5 : 1), [x, y] = pos(s);
    const dx = s.tx - x, dy = s.ty - y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, ang = Math.atan2(uy, ux);
    const T = this.time, P = PAL[s.type] || PAL.fire;
    // 공통 빛 꼬리(지나온 길): 단계가 높을수록 길고 진함
    // 꼬리: 그라데이션 대신 길이 · 굵기 · 투명도가 다른 선 두 겹(가볍고 아이폰에서도 같게)
    const tail = (len, w, col, a) => { c.save(); c.lineCap = 'round'; c.strokeStyle = col; c.globalAlpha = a * 0.45; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x - ux * len, y - uy * len); c.stroke(); c.globalAlpha = a * 0.7; c.lineWidth = w * 0.55; c.beginPath(); c.moveTo(x, y); c.lineTo(x - ux * len * 0.55, y - uy * len * 0.55); c.stroke(); c.restore(); };
    switch (s.kind) {
      case 'flame': {   // 화염 창: 앞이 뾰족한 불꽃 덩어리 + 뒤로 흩어지는 불티
        tail(46 * k, 12 * k, 'rgba(255,140,40,0.75)', 0.8);
        this.glow(c, x, y, 26 * k, '#ff7a1c', 0.7);
        c.save(); c.translate(x, y); c.rotate(ang);
        const fl = 1 + Math.sin(T * 40 + s.id) * 0.12;
        [[P[4], 1.0], [P[3], 0.82], [P[2], 0.62], [P[1], 0.42], [P[0], 0.24]].forEach(([col, r]) => { c.fillStyle = col; c.beginPath(); c.moveTo(16 * k * r * fl + 4, 0); c.quadraticCurveTo(0, -9 * k * r, -22 * k * r, 0); c.quadraticCurveTo(0, 9 * k * r, 16 * k * r * fl + 4, 0); c.fill(); });
        c.restore();
        if (Math.random() < 0.8) this.part({ x: x - ux * 8, y: y - uy * 8, vx: -ux * 60 + rnd(-30, 30), vy: -uy * 60 - rnd(10, 50), life: 0.3, size: rnd(3, 5), col: P[1 + (Math.random() * 3 | 0)], kind: 'fire', add: true });
        break;
      }
      case 'flameslash': {   // 불길 참격: 진행 방향에 수직인 초승달(검을 휘두른 불길이 날아감)
        tail(34 * k, 18 * k, 'rgba(255,120,30,0.55)', 0.7);
        this.glow(c, x, y, 30 * k, '#ff6a1c', 0.65);
        c.save(); c.translate(x, y); c.rotate(ang); c.lineCap = 'round';
        const R0 = 17 * k;
        [[P[4], 9 * k], [P[3], 7 * k], [P[2], 5 * k], [P[1], 3 * k], [P[0], 1.6 * k]].forEach(([col, w], n) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(-R0 * 0.7 - n * 0.6, 0, R0, -1.05, 1.05); c.stroke(); });
        c.restore();
        for (let n = 0; n < 2; n++) if (Math.random() < 0.7) { const a = ang + Math.PI / 2 * (n ? 1 : -1); this.part({ x: x + Math.cos(a) * 14 * k, y: y + Math.sin(a) * 14 * k, vx: -ux * 40, vy: -uy * 40 - 30, life: 0.3, size: rnd(3, 4.5), col: P[1 + n], kind: 'fire', add: true }); }
        break;
      }
      case 'breath': {   // 용의 숨결 한 덩이: 입을 떠날 때 작고 멀어질수록 커짐 — 6발이 이어져 넓어지는 불길 원뿔
        const q = progOf(s), r = (5 + 20 * q) * k * 0.7;
        this.glow(c, x, y, r * 2.2, '#ff7a1c', 0.55 + q * 0.2);
        [[P[3], 1], [P[2], 0.75], [P[1], 0.5], [P[0], 0.25]].forEach(([col, f]) => { c.save(); c.globalAlpha = 0.9; c.fillStyle = col; c.beginPath(); c.ellipse(x - ux * r * 0.2, y - uy * r * 0.2, r * f * 1.25, r * f, ang, 0, TAU); c.fill(); c.restore(); });
        for (let n = 0; n < 2; n++) this.part({ x: x - ux * r * n * 0.6 + rnd(-r, r) * 0.4, y: y - uy * r * n * 0.6 + rnd(-r, r) * 0.4, vx: ux * 60 + rnd(-25, 25), vy: uy * 60 - rnd(10, 50), life: 0.3, size: 3 + r * 0.3, col: P[(Math.random() * 4) | 0], kind: 'fire', add: true, grow: 1 });   // 이어지는 불길(원뿔)
        break;
      }
      case 'meteor': {   // 불길 대폭발(화염 5 주기): 큰 불덩이 + 긴 불꼬리
        tail(80, 26, 'rgba(255,110,30,0.8)', 0.85);
        this.glow(c, x, y, 54, '#ff6a1c', 0.8);
        [[P[4], 20], [P[3], 16], [P[2], 12], [P[1], 8], [P[0], 4]].forEach(([col, r]) => this.circle(c, x, y, r * (1 + Math.sin(T * 30) * 0.05), col));
        for (let n = 0; n < 2; n++) this.part({ x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: -ux * 80 + rnd(-40, 40), vy: -uy * 80 - rnd(20, 80), life: 0.4, size: rnd(5, 8), col: P[(Math.random() * 4) | 0], kind: 'fire', add: true });
        break;
      }
      case 'sunbolt': {  // 태양 창: 길고 가는 빛 창 + 마름모 촉 + 빛줄 꼬리
        tail(30 * k, 4 * k, 'rgba(255,240,170,0.95)', 0.9);   // [v4.7 2차] 58 → 30: 긴 꼬리가 화면을 가로지르는 직선 빔으로 보였음(휜 빛 띠는 render9)
        tail(18 * k, 3 * k, '#ffffff', 1);
        this.glow(c, x, y, 24 * k, '#ffe48a', 0.85);
        c.save(); c.translate(x, y); c.rotate(ang);
        c.fillStyle = P[4]; c.beginPath(); c.moveTo(12 * k, 0); c.lineTo(0, -5.5 * k); c.lineTo(-6 * k, 0); c.lineTo(0, 5.5 * k); c.closePath(); c.fill();
        c.fillStyle = P[1]; c.beginPath(); c.moveTo(9 * k, 0); c.lineTo(0, -3.5 * k); c.lineTo(-4 * k, 0); c.lineTo(0, 3.5 * k); c.closePath(); c.fill();
        c.restore();
        this.star(c, x, y, 4, 13 * k, 2.2 * k, T * 6, 'rgba(255,255,255,0.9)');
        if (t >= 6) this.star(c, x, y, 4, 10 * k, 2 * k, -T * 4 + 0.8, '#fff6c8');   // [v4.7 2차] 무지갯빛 큰 십자 → 작은 흰 반짝
        break;
      }
      case 'toxic': case 'acidglob': {    // 독 폭탄 · 산성 덩어리: 보글거리는 구슬 + 떨어지는 방울 + 김 꼬리(색만 다름)
        for (let n = 1; n <= 4; n++) { c.save(); c.globalAlpha = 0.35 - n * 0.06; this.circle(c, x - ux * n * 9 * k, y - uy * n * 9 * k + Math.sin(T * 12 + n) * 2, (8 - n) * k, P[3]); c.restore(); }
        this.glow(c, x, y, 26 * k, '#7be06a', 0.7);
        const wob = 1 + Math.sin(T * 22 + s.id) * 0.08;
        this.circle(c, x, y, 9 * k * wob, P[4]); this.circle(c, x, y, 7.5 * k * wob, P[3]); this.circle(c, x - 1 * k, y - 1 * k, 5.5 * k, P[2]);
        this.circle(c, x - 3 * k, y - 3 * k, 2.2 * k, P[0]);
        for (let n = 0; n < 3; n++) { const a = T * 9 + n * 2.1; this.circle(c, x + Math.cos(a) * 5 * k, y + Math.sin(a) * 4 * k, 1.6 * k, P[1]); }
        if (Math.random() < 0.6) this.part({ x, y: y + 6 * k, vy: 70, life: 0.35, size: rnd(2.5, 3.5) * k, col: P[2], kind: 'dot', grav: 300 });
        break;
      }
      case 'leaf': {     // 빛나는 잎: 돌며 날아가는 금빛 잎 + 꽃가루
        tail(30 * k, 6 * k, 'rgba(255,240,160,0.8)', 0.7);
        this.glow(c, x, y, 22 * k, '#ffe48a', 0.75);
        c.save(); c.translate(x, y); c.rotate(T * 10 + s.id); c.fillStyle = '#6a8a1a'; c.beginPath(); c.ellipse(0, 0, 10 * k, 5 * k, 0, 0, TAU); c.fill();
        c.fillStyle = '#c8f06a'; c.beginPath(); c.ellipse(0, 0, 8 * k, 3.6 * k, 0, 0, TAU); c.fill(); c.strokeStyle = '#fffbe0'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-8 * k, 0); c.lineTo(8 * k, 0); c.stroke(); c.restore();
        if (Math.random() < 0.6) this.part({ x, y, vx: rnd(-20, 20), vy: rnd(-40, -10), life: 0.4, size: 3, col: '#fff2a0', kind: 'star', vr: 6 });
        break;
      }
      case 'prism': {    // 무지개 조각: 도는 수정 + 여섯 빛줄 꼬리
        const L = 34 * k, nx = -uy, ny = ux;
        c.save(); c.lineCap = 'round';
        RAIN.forEach((col, n) => { const o = (n - 2.5) * 1.6 * k; c.globalAlpha = 0.75; c.strokeStyle = col; c.lineWidth = 1.8 * k; c.beginPath(); c.moveTo(x + nx * o, y + ny * o); c.lineTo(x - ux * L + nx * o * 1.6, y - uy * L + ny * o * 1.6); c.stroke(); });
        c.restore();
        this.glow(c, x, y, 22 * k, '#ffffff', 0.7);
        c.save(); c.translate(x, y); c.rotate(T * 8); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(0, -8 * k); c.lineTo(6 * k, 0); c.lineTo(0, 8 * k); c.lineTo(-6 * k, 0); c.closePath(); c.fill();
        c.fillStyle = hue(T, 2); c.beginPath(); c.moveTo(0, -5 * k); c.lineTo(3.5 * k, 0); c.lineTo(0, 5 * k); c.lineTo(-3.5 * k, 0); c.closePath(); c.fill(); c.restore();
        break;
      }
      case 'comet': {    // 얼음 혜성(빙결 6 주기): 큰 얼음 결정 + 서리 꼬리
        tail(90, 24, 'rgba(180,230,255,0.85)', 0.85);
        this.glow(c, x, y, 50, '#9fe0ff', 0.85);
        c.save(); c.translate(x, y); c.rotate(T * 3);
        for (let n = 0; n < 6; n++) { c.rotate(TAU / 6); c.fillStyle = n % 2 ? P[3] : P[2]; c.beginPath(); c.moveTo(0, 0); c.lineTo(5, -4); c.lineTo(22, 0); c.lineTo(5, 4); c.closePath(); c.fill(); }
        c.fillStyle = P[0]; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill(); c.restore();
        if (Math.random() < 0.8) this.part({ x: x + rnd(-12, 12), y: y + rnd(-12, 12), vx: -ux * 60, vy: -uy * 60, life: 0.4, size: 3, col: '#e6f8ff', kind: 'star', vr: 5 });
        break;
      }
    }
    // 단계 반짝이: 5단계부터 반짝, 6단계는 무지갯빛
    if (t >= 5 && !this.busy() && Math.random() < 0.45) this.part({ x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: -ux * 30 + rnd(-15, 15), vy: -uy * 30 + rnd(-25, 5), life: 0.3, size: rnd(2.5, 3.5), col: t >= 6 ? hue(T, Math.random() * 6) : P[1], kind: 'star', vr: 7 });
  };

  // ------------------------------------------------------------ 맞는 순간
  const prevImpact = R.impact, lastHit = {};
  R.impact = function (e) {
    // [v4.7 3차] 연달아 맞는 탄 · 5 · 6단계 맞음의 흐린 빛 번짐 → 또렷한 픽셀 점 · 고리
    // 한 번 공격의 탄이 0.045초 안에 연달아 맞으면(6발 '다다다') 두 번째부터는 종류 색 작은 빛만 — 효과가 여섯 번 겹쳐 그리기가 무거워지는 것 방지
    const key = e.type + (e.kind || ''), lh = lastHit[key];
    if (!e.big && lh != null && this.time - lh < 0.045 && (e.tier || 1) >= 4) { const col = (D.TOWERS[e.type] || {}).color || '#fff'; this.addFx(0.14, (c, p) => { this.circle(c, e.x, e.y, (5 + (e.tier || 1)) * (1 - p * 0.5) + 2, '#2b1426'); this.circle(c, e.x, e.y, (5 + (e.tier || 1)) * (1 - p * 0.5), col); }); if (!this.busy()) this.part({ x: e.x, y: e.y, vx: rnd(-120, 120), vy: rnd(-140, -40), life: 0.3, size: 3, col, kind: 'spark', grav: 300 }); return; }
    lastHit[key] = this.time;
    const x = e.x, y = e.y, k = e.kind, t = e.tier || 1, big = e.big ? 1.5 : 1, s = TK[t] * big;
    const burst = (n, cols, sp, life, size, grav, kind) => { for (let q = 0; q < n; q++) { const a = rnd(0, TAU), v = rnd(sp * .5, sp); this.part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: rnd(life * .7, life), size: rnd(size * .7, size), col: cols[q % cols.length], kind: kind || 'spark', grav: grav == null ? 300 : grav }); } };
    if (k === 'flame' || k === 'flameslash' || k === 'breath' || k === 'meteor') {
      this.explosion(x, y, k === 'meteor' ? 40 : 10 + t * 2.2, k === 'meteor' ? 1.2 : 0.45 + t * 0.05);
      burst(k === 'meteor' ? 14 : 5, PAL.fire.slice(0, 4), 170 * s, 0.4, 4, 260, 'fire');
      if (k === 'meteor') this.shake = Math.max(this.shake, 4);
      return;
    }
    if (k === 'sunbolt' && this.pxBurst9) { this.pxBurst9(x, y, 16 * s, ['#ffc23a', '#ffffff', '#fff2a0'], 0.26); burst(5, PAL.light, 170, 0.3, 3); return; }   // [v4.7 3차] 흰 번짐이 몬스터를 가림 → 픽셀 십자 폭발
    if (k === 'sunbolt') { this.sprite(['fx_flash', 'fx_hit'], x, y, 30 * s, 16); this.addFx(0.25, (c, p) => { this.glow(c, x, y, 34 * s, '#ffe48a', 0.85 * (1 - p)); this.star(c, x, y, 8, 26 * s * (0.6 + p), 3, p * 2, `rgba(255,255,255,${1 - p})`); }); burst(6, PAL.light, 180, 0.35, 3.5); return; }
    if (k === 'acidglob') { if (this.pxBurst9) this.pxBurst9(x, y, 13 * s, ['#b8c820', '#fbffc0', '#d8e830'], 0.26); else this.sprite(['fx_acid'], x, y, 40 * s, 8); burst(8, PAL.corrode.slice(1), 150, 0.45, 4, 420, 'dot'); this.addFx(0.9, (c, p) => { c.save(); c.globalAlpha = 0.55 * (1 - p); c.fillStyle = '#7ab02a'; c.beginPath(); c.ellipse(x, y + 14, (14 + p * 8) * s, (5 + p * 3) * s, 0, 0, TAU); c.fill(); c.restore(); }, 'under'); return; }
    // [v4.7 2차] 독 폭탄 맞음: 흐린 연기 → 또렷한 독 튐(render9 spikes9)
    if (k === 'toxic') { if (this.pxBurst9) this.pxBurst9(x, y, 14 * s, ['#3a9a2a', '#e0ffd0', '#7be06a'], 0.26); else this.sprite(['fx_acid'], x, y, 40 * s, 8); if (this.spikes9) this.spikes9(x, y, 7, 22 * s, ['#1f7a2a', '#8a4ad0', '#7be06a'], 0.35, 5); else this.cloud(x, y - 4, 0.55 * s, ['#7be06a', '#4aa83a', '#a6f06a'], 0.9); burst(8, PAL.poison.slice(1), 150, 0.45, 4, 380, 'dot'); return; }
    if (k === 'leaf') { this.addFx(0.3, (c, p) => { this.glow(c, x, y, 34 * s, '#ffe48a', 0.8 * (1 - p)); c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#fff2a0'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 6, 10 + p * 30 * s, 4 + p * 12 * s, 0, 0, TAU); c.stroke(); c.restore(); }); burst(7, ['#fff2a0', '#c8f06a', '#ffffff'], 140, 0.5, 3, 120, 'star'); return; }
    if (k === 'prism') { this.addFx(0.28, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.lineWidth = 3; RAIN.forEach((col, n) => { c.strokeStyle = col; c.beginPath(); c.arc(x, y, 6 + n * 3 + p * 24 * s, 0, TAU); c.stroke(); }); c.restore(); }); burst(8, RAIN, 170, 0.4, 3, 200, 'star'); return; }
    if (k === 'comet') { this.frostFx(x, y + 10, 1); this.shake = Math.max(this.shake, 4); burst(16, PAL.ice, 240, 0.5, 4, 260, 'star'); return; }
    // 기존 모양 탄: 5 · 6단계의 큰 주황 섬광(render4)은 탄이 한 발이던 때 것 — 탄이 6발이 되어 여섯 번 터지고 색도 안 맞음 → 4단계 연출 + 종류 색 반짝임
    prevImpact.call(this, t >= 5 ? Object.assign({}, e, { tier: 4 }) : e);
    if (t >= 5) { const col = (D.TOWERS[e.type] || {}).color || '#ffffff'; this.addFx(0.18, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, (8 + t * 2) * (0.5 + p), (8 + t * 2) * (0.5 + p) * 0.6, 0, 0, TAU); c.stroke(); c.restore(); }); for (let q = 0; q < 3; q++) { const a2 = rnd(0, TAU); this.part({ x, y, vx: Math.cos(a2) * 150, vy: Math.sin(a2) * 100 - 50, life: 0.3, size: 3, col: t >= 6 ? hue(this.time, q * 2) : col, kind: 'star', vr: 8, grav: 200 }); } }
    // 큰 한 방(5 · 6단계 주기 공격)은 종류 색 충격파
    if (e.big) { const col = (D.TOWERS[e.type] || {}).color || '#ffffff'; this.addFx(0.35, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = 5 * (1 - p) + 1; c.beginPath(); c.ellipse(x, y + 8, 14 + p * 46, 6 + p * 18, 0, 0, TAU); c.stroke(); c.restore(); }); }
  };

  // ------------------------------------------------------------ 사거리 표시(포탑을 누르면): 그 포탑이 쏘는 길 구간을 반투명하게
  // 이 게임의 사거리는 '길을 따라 앞뒤 몇 칸'이라 원보다 길 띠가 정확하다(참고 영상의 반투명 원 대신). 레이어: 판 칸 위 · 몬스터 아래
  R.drawRange = function (c, game) {
    const sel = this.sel; if (sel == null) return;
    const tl = game.tiles[sel]; if (!tl || !tl.tower) { this.sel = null; return; }
    const r = Math.min(12, game.rangeOf(sel)), a = clamp((this.time - (this.selT || 0)) / 0.18, 0, 1);
    const f0 = sel - r - 0.5, f1 = sel + r + 0.5, steps = Math.max(8, Math.ceil((f1 - f0) * 6));
    const inner = [], outer = [];
    for (let n = 0; n <= steps; n++) { const f = f0 + (f1 - f0) * n / steps; const p = G.lanePoint(f, -1.25), q = G.lanePoint(f, 1.25); inner.push(p); outer.push(q); }
    const col = (D.TOWERS[tl.tower.type] || {}).color || '#ffffff';
    c.save();
    c.beginPath(); inner.forEach((p, n) => n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); for (let n = outer.length - 1; n >= 0; n--) c.lineTo(outer[n][0], outer[n][1]); c.closePath();
    c.globalAlpha = 0.26 * a; c.fillStyle = '#ffffff'; c.fill();
    c.globalAlpha = 0.18 * a; c.fillStyle = col; c.fill();
    c.globalAlpha = 0.85 * a; c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.lineJoin = 'round'; c.stroke();
    // 흐르는 점선(사거리 방향감)
    c.globalAlpha = 0.6 * a; c.setLineDash([8, 10]); c.lineDashOffset = -this.time * 30; c.lineWidth = 2; c.strokeStyle = col;
    c.beginPath(); for (let n = 0; n <= steps; n++) { const f = f0 + (f1 - f0) * n / steps, p = G.lanePoint(f, 0); n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke();
    c.restore();
    // 고른 포탑 발밑 빛 고리
    const [x, y] = G.tiles[sel].tower, sc = G.tiles[sel].scale;
    c.save(); c.globalAlpha = 0.9 * a; c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 2, 34 * sc * (1 + 0.04 * Math.sin(this.time * 6)), 14 * sc, 0, 0, TAU); c.stroke();
    c.globalAlpha = 0.5 * a; c.strokeStyle = col; c.lineWidth = 6; c.stroke(); c.restore();
  };
  const prevTiles = R.drawTiles;
  R.drawTiles = function (c, game) {
    // 5 · 6단계 포탑 수(주변 연출 반짝이의 빛 번짐 생략 기준)
    let hi = 0; for (const t of game.tiles) if (t.tower && t.tower.tier >= 5) hi++; this._hiN = hi;
    prevTiles.call(this, c, game); this.drawRange(c, game);
  };
  // 5 · 6단계가 7개 이상이면 주변 연출 반짝이 뒤 빛 번짐을 생략(반짝이 모양 · 수는 그대로) — 판이 고단계로 가득할 때 그리기 부담
  const baseAmbShape = R.ambientShape;
  R.ambientShape = function (c, kind, x, y, r, col, ph, rich) {
    if ((this._hiN || 0) < 7) return baseAmbShape.call(this, c, kind, x, y, r, col, ph, rich);
    const g0 = this.glow; this.glow = () => {}; try { baseAmbShape.call(this, c, kind, x, y, r, col, ph, rich); } finally { this.glow = g0; }
  };
})(window);
