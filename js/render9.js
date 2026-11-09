// v4.7 층(Renderer에 덧붙임) — 탄 궤적 · 모양 · 단계별 '질'
// 사용자: '날아가는 동전이 그냥 동전 모양 그대로라 어색' · '6성도 날아가는 이펙트가 직선 그대로 고정' ·
//         '3성 3발 · 4성 4발 … 개수만 늘어 외형은 화려해져도 탄이 강해 보이지 않는다' → 16종 × 6단계 전수 조사(_기획/마블디펜스/마블디펜스_v4.7_탄_전수조사.md)
// · 궤적: 시뮬레이션 위치(직선)는 그대로 두고 그릴 때만 휘게 한다 — 출발점 ~ 목표 줄에 옆 · 위 띄움(sin, 양 끝 0)을 더해 맞는 순간은 정확히 같은 자리.
//   한 번 공격의 탄(fk/fn)은 부채꼴로 퍼졌다 모이고, 6단계는 나선이 더해진다. 탄의 거리(d)는 바꾸지 않아 다른 층의 진행률 계산이 그대로다.
// · 모양: 출발 때 찌그러짐(squash) → 날면서 진행 방향으로 늘어남(stretch) → 맞기 직전 원래대로. 3단계부터 휘는 길을 따르는 빛 띠,
//   5단계부터 종류별 위성 탄, 6단계는 종류별 '필살' 덧그림. 맞을 때는 종류별 2차 효과, 6단계 한 번 공격의 마지막 탄은 큰 마무리.
// · 동전(탐욕탑): 동전 그림을 그대로 날리던 것 → 포물선 + 회전 · 늘어남 + 금빛 띠, 단계별 동전 1개 → 동전 줄기 → 동전 다발 → 금괴 → 동전 폭포, 맞으면 동전이 '짤랑' 튄다.
// · 밸런스 무관: 피해 · 판정 · 시간은 behave.js 그대로(fk · fn은 그리기 전용 표시).
// · 그리기 원칙: 상태 없는 그리기(탄의 위치 · 시간만), 오프스크린 캔버스 안 씀, 'lighter' 섞기 안 씀(아이폰 · 밝은 배경)
(function (root) {
  if (/[?&]nov47=1/.test(location.search)) return;   // 비교 캡처용: 이 층 끄기
  const R = root.Renderer.prototype, D = root.DATA;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const RAIN = ['#ff6a6a', '#ffb347', '#ffe36a', '#7be06a', '#6ab0ff', '#b07cff'];
  const hue = (t, k) => RAIN[Math.floor((t * 8 + k) % 6 + 6) % 6];
  const colOf = type => (D.TOWERS[type] || {}).color || '#ffffff';
  const GOLD = ['#fff6c8', '#ffe36a', '#ffd23a', '#e8a21a', '#8a5a10'];

  // ------------------------------------------------------------ 궤적
  // fan = 부채꼴로 퍼졌다 모임 · wave = 물결(정령 · 잎) · zap = 번개 지그재그(4단계부터) · lob = 던져 올림 · arrow = 화살 비(4단계부터 높이)
  // coin = 동전 포물선 · sky = 하늘에서 떨어지는 큰 한 방 · hose = 개틀링 물 뿌리듯 흔들림(4단계부터)
  const PATH = {
    fireball: 'fan', icicle: 'fan', spike: 'fan', dart: 'fan', acid: 'fan', orb: 'fan', orb2: 'fan', bless: 'fan', prism: 'fan',
    flame: 'fan', flameslash: 'fan', sunbolt: 'fan', ore: 'fan', ingot: 'fan',
    breath: 'breath', leaf: 'wave', spirit: 'wave', zap: 'zap', toxic: 'lob', acidglob: 'lob', arrow: 'arrow', coin: 'coin', meteor: 'sky', comet: 'sky', bullet: 'hose',
  };
  const AMP = [0, 14, 16, 20, 24, 30, 38];         // 단계별 부채꼴 폭(px) — [2차] 1단계도 살짝 휨(검수: 1단계 전후 차이 거의 없음)
  const STR = [0, 0.14, 0.16, 0.18, 0.2, 0.22, 0.25]; // 단계별 늘어남(2차: 정지 장면에서도 보이게 키움)
  const NOSTRETCH = new Set(['breath', 'bullet', 'coin', 'meteor', 'comet', 'sunbolt']);   // 태양 창은 꼬리가 길어 늘이면 화면을 가로지름(2차 검수)
  function offs(s, q) {
    const t = s.tier || 1, st = PATH[s.kind]; if (!st || s.lost) return [0, 0];
    const n = s.fn || 1, k = s.fk || 0, b = Math.sin(q * Math.PI), ph = (s.id || 0) * 1.7;
    const side = n > 1 ? (k - (n - 1) / 2) / ((n - 1) / 2) : ((s.id || 0) % 2 ? 0.45 : -0.45);
    const big = s.big ? 1.3 : 1;
    switch (st) {
      case 'fan': { if (s.kind === 'fireball' && t === 3) return [6 * Math.sin(q * 2 * Math.PI) * b, 0];   // [4차] 화염 3: 부채꼴 대신 한 줄(혜성)
        let a = AMP[t] * side * b; if (t >= 6) a += 10 * Math.sin(q * 4 * Math.PI + ph) * b; return [a * big, 0]; }
      case 'wave': return [((10 + t * 3) * Math.sin(q * 2.6 * Math.PI + ph) + AMP[t] * side * 0.6) * b, 0];
      case 'zap': {
        if (t < 4) return [(6 + t * 2) * b * Math.sin(q * 3 * Math.PI + ph), 0];
        const z = q * (5 + t) + ph, tri = 1 - 4 * Math.abs(z - Math.floor(z) - 0.5);   // 꺾이는 지그재그(번개)
        return [((12 + t * 3) * tri + AMP[t] * side * 0.5) * b, 0];
      }
      case 'lob': return [AMP[t] * side * b * 0.7, (26 + t * 4) * b * big];
      case 'arrow': return [AMP[t] * side * b * (t >= 6 ? 0.8 : t >= 4 ? 1.4 : t === 3 ? 1.9 : 0.8), (t >= 6 ? 30 : t >= 4 ? 28 + t * 2 : t === 3 ? 20 + k * 9 : 14 + t * 4) * b * big];   // [5차] 3단계는 넓은 부채꼴 · 발마다 높이가 다름
      case 'coin': return [AMP[t] * side * b, (30 + t * 5) * b * big];
      case 'sky': return [0, (s.kind === 'meteor' ? 110 : 80) * b];
      case 'breath': return [AMP[t] * side * b * 0.4, 26 * b];   // [3차] 용 숨결 덩이가 위로 휘었다 내리꽂힘(일직선 지적)
      case 'hose':   // [5차] 흔들림을 줄여 표적 쪽으로. 5 · 6단계는 두 줄이 양쪽에서 나가 가운데서 엇갈림
        if (t >= 5) return [(k % 2 ? 1 : -1) * (t >= 6 ? 14 : 12) * (1 - q) * Math.cos(q * Math.PI) + (t >= 6 ? 4 * Math.sin(q * 5 * Math.PI + k) * b : 0), 0];
        return t >= 3 ? [(3 + t) * Math.sin(k * 0.9 + ph * 0.3) * b, 0] : [0, 0];
    }
    return [0, 0];
  }
  // 탄의 지금 상태: 목표 방향(u) · 남은 거리(d) · 처음 거리(d0) · 진행률(q)
  function frameOf(s) {
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy) || 1;
    if (s._q0 == null || s._q0 < d) s._q0 = Math.max(d, 1);
    return { ux: dx / d, uy: dy / d, d, d0: s._q0, q: clamp(1 - d / s._q0, 0, 1) };
  }
  // 휜 길 위의 q2 지점(그릴 좌표). withO = 무기 끝 출발 보정(render5 · render7의 _o)까지 넣기
  function ptAt(s, F, q2, withO) {
    const [a, h] = offs(s, q2), back = F.d0 * (1 - q2);
    let x = s.tx - F.ux * back - F.uy * a, y = s.ty - F.uy * back + F.ux * a - h;
    if (withO && s._o && s._d0) { const k = clamp(back / s._d0, 0, 1) ** 1.5; x += s._o[0] * k; y += s._o[1] * k; }
    return [x, y];
  }
  function tangentAt(s, F, q2) {
    const a = ptAt(s, F, Math.max(0, q2 - 0.02)), b = ptAt(s, F, Math.min(1, q2 + 0.02));
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    return L > 0.01 ? [dx / L, dy / L] : [F.ux, F.uy];
  }
  R._path9 = { offs, frameOf, ptAt, tangentAt };   // [v4.8] render10이 같은 휜 길을 쓴다
  // 휜 길을 따르는 빛 띠(굵기 · 길이 · 투명도가 다른 선 두세 겹 — 그라데이션 없이 가늘어지는 꼬리)
  function ribbon(c, s, F, len, w, cols, alpha) {
    const N = 6, q1 = F.q, q0 = Math.max(0, q1 - len);
    if (q1 - q0 < 0.01) return;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    cols.forEach((col, layer) => {
      const f = 1 - layer * 0.38, qs = q1 - (q1 - q0) * f;
      c.globalAlpha = alpha * (0.4 + layer * 0.25); c.strokeStyle = col; c.lineWidth = Math.max(1.5, w * (1 - layer * 0.42));
      c.beginPath();
      for (let j = 0; j <= N; j++) { const p = ptAt(s, F, qs + (q1 - qs) * j / N, true); j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
      c.stroke();
    });
    c.restore();
  }
  const RIB = {   // 종류별 띠 색(바깥 → 안)
    fireball: ['#e8452c', '#ffd23a'], icicle: ['#4aa0ff', '#e6f8ff'], spike: ['#5a0e1a', '#ff3b4a'], dart: ['#3a9a2a', '#c8ff8a'], acid: ['#6a9a1a', '#e8ff8a'],
    orb: ['#ffc23a', '#fffbe0'], bless: ['#ffc23a', '#fffbe0'], orb2: ['#ff5ac8', '#ffe0f6'], zap: ['#7a4aff', '#ffffff'], spirit: ['#2fc8a8', '#e0fff8'],
    arrow: ['#e8452c', '#ffd23a'], ore: ['#8a5a10', '#ffd23a'], ingot: ['#8a5a10', '#ffe36a'], bullet: ['#ff9a1c', '#fff6c8'], prism: ['#b07cff', '#ffffff'],
  };

  // ------------------------------------------------------------ 탄 그리기
  const prevShots = R.drawShots;
  R.drawShots = function (c, game) {
    const many = game.shots.length > 100, T = this.time;   // 탄이 많으면(6단계 판 가득) 띠 · 덧그림 일부를 건너뜀
    if (many) {   // 가득 찬 판: 휜 자리로만 옮겨 한 번에 그림(늘어남 · 띠 · 잔상 생략 — 탄 수백 발에서 한 발씩 부르는 비용)
      const rest = [], saved = [];
      for (const s of game.shots) {
        if (s.delay > 0) continue;
        const F = frameOf(s), t = s.tier || 1;
        if (s.kind === 'coin') { this.drawCoin9(c, s, F, true); continue; }
        if (this.own9(c, s, F, t, true)) continue;
        const [a, h] = offs(s, F.q); saved.push([s, s.x, s.y, s.tx, s.ty]);
        const px = s.x - F.uy * a, py = s.y + F.ux * a - h; s.tx += px - s.x; s.ty += py - s.y; s.x = px; s.y = py; rest.push(s);
      }
      const g0 = this.glow; this.glow = (cc, gx, gy, r, col, ga) => g0.call(this, cc, gx, gy, r * 0.5, col, (ga == null ? 1 : ga) * 0.75);
      try { if (rest.length) prevShots.call(this, c, { shots: rest }); } finally { this.glow = g0; for (const [s, x, y, tx, ty] of saved) { s.x = x; s.y = y; s.tx = tx; s.ty = ty; } }
      return;
    }
    for (const s of game.shots) {
      if (s.delay > 0) continue;
      const F = frameOf(s), t = s.tier || 1;
      if (s.kind === 'coin') { this.drawCoin9(c, s, F, many); continue; }
      if (this.own9(c, s, F, t, many)) continue;   // [2차] 종류 · 단계별 직접 그리기(콤보 · 곡괭이 · 독 · 산성 · 가시)
      const [a, h] = offs(s, F.q), tg = tangentAt(s, F, F.q);
      const x0 = s.x, y0 = s.y, tx0 = s.tx, ty0 = s.ty;
      const px = x0 - F.uy * a, py = y0 + F.ux * a - h;
      const [cx, cy] = ptAt(s, F, F.q, true), ang = Math.atan2(tg[1], tg[0]);
      // 3단계부터 휜 길을 따르는 빛 띠
      const rc = RIB[s.kind];
      if (rc && t >= 3 && !many) ribbon(c, s, F, s.kind === 'bullet' ? 0.12 : 0.1 + t * 0.03, (s.kind === 'bullet' ? 3 : 4) + t * 1.2, t >= 6 && s.kind !== 'bullet' ? [hue(T, s.id % 6), rc[1]] : rc, 0.85);
      if (s.kind === 'zap' && t >= 4) this.zapTrail9(c, s, F, t);
      if (!many) dots9(c, s, F, t);   // [2차] 모든 단계: 지나온 길에 잔상 점
      if (s.kind === 'fireball' && t >= 2) this.tongue9(c, cx, cy, ang, t === 2 ? 1 : 1.35, PALF);
      // 늘어남 · 찌그러짐: 출발(0~12%) 찌그러짐 → 날 때 진행 방향으로 늘어남 → 맞기 직전(92% 뒤) 원래대로
      let al = 1, ac = 1;
      if (!NOSTRETCH.has(s.kind)) {
        const q = F.q, st = STR[t] * (s.big ? 1.3 : 1);
        if (q < 0.12) { const e = q / 0.12; al = 0.72 + (1 + st - 0.72) * e; ac = 1.25 + (1 / (1 + st) - 1.25) * e; }
        else if (q > 0.92) { const e = (q - 0.92) / 0.08; al = 1 + st * (1 - e); ac = 1 / (1 + st * (1 - e)); }
        else { al = 1 + st; ac = 1 / (1 + st); }
        if (t >= 6) ac *= 1 + 0.08 * Math.sin(T * 30 + s.id);   // 6단계는 맥박치듯
      }
      if (s.kind === 'spirit' && t >= 4) { const k6 = t >= 6 ? 0.6 : 0.72; al *= k6; ac *= k6; }   // [2차] 4단계부터 정령 그림이 너무 커서 덩어리로 보임
      c.save();
      if (al !== 1 || ac !== 1) { c.translate(cx, cy); c.rotate(ang); c.scale(al, ac); c.rotate(-ang); c.translate(-cx, -cy); }
      s.x = px; s.y = py; s.tx = px + tg[0] * F.d; s.ty = py + tg[1] * F.d;
      const g0 = this.glow; this.glow = (cc, gx, gy, r, col, ga) => g0.call(this, cc, gx, gy, r * 0.5, col, (ga == null ? 1 : ga) * 0.75);   // [2차] 흐린 빛 번짐 줄임(검수: '흐린 덩어리')
      try { prevShots.call(this, c, { shots: [s] }); } finally { s.x = x0; s.y = y0; s.tx = tx0; s.ty = ty0; this.glow = g0; }
      c.restore();
      // 단계 덧그림(위성 탄 · 6단계 필살 모양)
      this.shotExtra9(c, s, F, t, cx, cy, ang, many);
    }
  };

  // 번개 구슬(4단계부터): 지나온 길에 남는 꺾인 번개 줄기
  R.zapTrail9 = function (c, s, F, t) {
    if (t >= 5 && (s.fk || 0) % 2) return;   // [4차] 6발 줄기가 뭉쳐 털뭉치처럼 보임 → 한 발 건너 하나 · 짧게
    const q1 = F.q, q0 = Math.max(0, q1 - (0.1 + t * 0.015)), N = 5;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'miter';
    for (const [col, w, a] of [[PLUM, 4.5, 1], ['#a77bff', 2.6, 1], ['#ffffff', 1, 1]]) {   // [2차] 넓은 반투명 띠(보라 안개) 대신 자두색 외곽선
      c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      for (let j = 0; j <= N; j++) { const p = ptAt(s, F, q0 + (q1 - q0) * j / N, true), jt = j && j < N ? 5 : 0; j ? c.lineTo(p[0] + rnd(-jt, jt), p[1] + rnd(-jt, jt)) : c.moveTo(p[0], p[1]); }
      c.stroke();
    }
    c.restore();
  };

  // 위성 탄(5단계부터) · 6단계 필살 덧그림
  R.shotExtra9 = function (c, s, F, t, x, y, ang, many) {
    const T = this.time, k = s.kind, col = colOf(s.type), id = s.id || 0;
    const orbit = (n, r, draw) => { for (let j = 0; j < n; j++) { const a = T * 9 + id + j * TAU / n; draw(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, a, j); } };
    switch (k) {
      case 'spike': {   // 폭군: 4단계 양옆 작은 가시 → 5단계 도는 가시 → 6단계 피의 창(검붉은 기운 + 초승달)
        if (t >= 4) for (const sd of [-1, 1]) { c.save(); c.translate(x - Math.sin(ang) * 9 * sd - Math.cos(ang) * 6, y + Math.cos(ang) * 9 * sd - Math.sin(ang) * 6); c.rotate(ang); c.scale(1.4, 1.4); c.fillStyle = '#1a0e14'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-6, -3); c.lineTo(-6, 3); c.closePath(); c.fill(); c.fillStyle = '#d8283a'; c.beginPath(); c.moveTo(6, 0); c.lineTo(-4, -1.6); c.lineTo(-4, 1.6); c.closePath(); c.fill(); c.restore(); }
        if (t >= 5) orbit(t >= 6 ? 3 : 2, 15, (px, py, a) => { c.save(); c.translate(px, py); c.rotate(a + Math.PI / 2); c.fillStyle = '#ff3b4a'; c.beginPath(); c.moveTo(5, 0); c.lineTo(-4, -2.5); c.lineTo(-4, 2.5); c.closePath(); c.fill(); c.restore(); });
        if (t >= 6) {
          c.save(); c.translate(x, y); c.rotate(ang); c.lineCap = 'round';
          for (const [cc, w, r] of [['#3a0610', 7, 20], ['#d8283a', 4, 18], ['#ffb0b8', 1.5, 16]]) { c.strokeStyle = cc; c.lineWidth = w; c.beginPath(); c.arc(-14, 0, r, -1.1, 1.1); c.stroke(); }
          c.restore();
          if (!many && !this.busy() && Math.random() < 0.6) this.part({ x: x + rnd(-6, 6), y: y + rnd(-6, 6), vx: rnd(-20, 20), vy: rnd(10, 60), life: 0.4, size: rnd(2.5, 3.5), col: '#b8202e', kind: 'dot', grav: 280 });
        }
        break;
      }
      case 'icicle': {  // 빙결: 4단계 서리 결정 꼬리 → 5단계 도는 눈송이 → 6단계 큰 눈꽃 고리(얼음 창)
        if (t >= 4 && !many && !this.busy() && Math.random() < 0.55) this.part({ x: x + rnd(-5, 5), y: y + rnd(-5, 5), vx: rnd(-25, 25), vy: rnd(-25, 25), life: 0.45, size: rnd(2.5, 3.5), col: Math.random() < 0.5 ? '#e6f8ff' : '#9fe0ff', kind: 'star', vr: 5 });
        if (t >= 5) orbit(t >= 6 ? 3 : 2, 15, (px, py) => this.star(c, px, py, 6, 4.5, 1.5, T * 4, '#e6f8ff'));
        if (t >= 6) { c.save(); c.translate(x, y); c.rotate(-T * 5 + id); c.globalAlpha = 0.85; c.strokeStyle = '#e6f8ff'; c.lineWidth = 2; for (let j = 0; j < 6; j++) { c.rotate(TAU / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(17, 0); c.moveTo(10, 0); c.lineTo(14, -4); c.moveTo(10, 0); c.lineTo(14, 4); c.stroke(); } c.restore(); }
        break;
      }
      case 'zap': {     // 번개: 4단계 지나온 번개 줄기(zapTrail9) → 5단계 구슬 둘레 전기 → 6단계 큰 번개 구슬
        if (t >= 5) orbit(t >= 6 ? 4 : 3, 14 + t, (px, py) => { c.save(); c.strokeStyle = '#e8dcff'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo((x + px) / 2 + rnd(-4, 4), (y + py) / 2 + rnd(-4, 4)); c.lineTo(px, py); c.stroke(); c.restore(); this.circle(c, px, py, 2.5, '#ffffff'); });
        if (t >= 6) pxOrb(this, c, x, y, 8, ['#7a4aff', '#d8c8ff', '#ffffff']);
        break;
      }
      case 'spirit': {  // 소환: 4단계 꼬불꼬불 혼불 꼬리 → 5 · 6단계 함께 도는 작은 정령
        if (t >= 4) for (let j = 1; j <= 4; j++) { const p = ptAt(s, F, Math.max(0, F.q - j * 0.035), true); c.save(); c.globalAlpha = 0.5 - j * 0.1; this.circle(c, p[0], p[1] + Math.sin(T * 12 + j) * 3, 5 - j, j % 2 ? '#b8fff0' : '#2fc8a8'); c.restore(); }
        if (t >= 5) { const im = this.I('x_spirit'); orbit(1, 18, (px, py) => { if (im) c.drawImage(im, px - 8, py - 9, 16, 18); else this.circle(c, px, py, 4, '#b8fff0'); }); }
        break;
      }
      case 'orb2': {    // 콤보: 4단계 박자 고리(퍼지는 고리 둘) → 5단계 도는 별 → 6단계 무지개 고리
        if (t >= 4) { c.save(); for (let j = 0; j < 2; j++) { const f = (T * 3 + id * 0.37 + j * 0.5) % 1; c.globalAlpha = (1 - f) * 0.8; c.strokeStyle = t >= 6 ? hue(T, j * 3) : '#ff8adf'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(x, y, 6 + f * 16, 3 + f * 8, 0, 0, TAU); c.stroke(); } c.restore(); }
        if (t >= 5) orbit(t >= 6 ? 3 : 2, 15, (px, py, a, j) => this.star(c, px, py, 4, 5, 1.6, a, t >= 6 ? hue(T, j * 2) : '#ffe0f6'));
        break;
      }
      case 'prism': {   // 프리즘: 4단계 무지개 띠(휜 길) → 5단계 도는 작은 수정 → 6단계 무지개 별
        if (t >= 5) orbit(t >= 6 ? 3 : 2, 14, (px, py, a, j) => { c.save(); c.translate(px, py); c.rotate(a); c.fillStyle = hue(T, j * 2); c.beginPath(); c.moveTo(0, -5); c.lineTo(3.5, 0); c.lineTo(0, 5); c.lineTo(-3.5, 0); c.closePath(); c.fill(); c.restore(); });
        break;
      }
      case 'bullet': {  // 개틀링: 4단계 달아오른 예광탄 → 6단계 백열 탄(한 번 공격의 세 발마다 굵은 빛)
        if (t >= 6 && (s.fk || 0) % 3 === 0) this.glow(c, x, y, 14, '#ffe36a', 0.6);
        break;
      }
      case 'fireball': case 'orb': case 'bless': case 'dart': case 'acid': {   // 1~3단계 탄: 3단계는 위성 반짝 하나
        if (t >= 3) orbit(1, 11, (px, py) => this.circle(c, px, py, 2.5, k === 'fireball' ? '#ffe36a' : k === 'dart' || k === 'acid' ? '#e8ff8a' : '#ffffff'));
        break;
      }
    }
    // 큰 한 방(5 · 6단계 주기 공격): 종류 색 빛 테두리
    if (s.big && k !== 'meteor' && k !== 'comet') { c.save(); c.globalAlpha = 0.7; c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 16 + Math.sin(T * 20) * 2, 9, T * 4, 0, TAU); c.stroke(); c.restore(); }
  };

  // ------------------------------------------------------------ 동전 탄(탐욕탑)
  // 동전 한 개: HUD와 같은 동전 그림(i_coin)을 뒤집히듯(가로 폭) 돌리며, 거의 옆면일 때는 금빛 테두리 막대로
  R.coin9 = function (c, x, y, r, flip, tilt, alpha) {
    const im = this.I('i_coin'), f = Math.abs(flip), w = Math.max(0.16, f);
    c.save(); c.translate(x, y); if (tilt) c.rotate(tilt); if (alpha != null) c.globalAlpha *= alpha;
    if (im) c.drawImage(im, -r * w, -r, r * 2 * w, r * 2); else { c.fillStyle = '#ffd23a'; c.beginPath(); c.ellipse(0, 0, r * w, r, 0, 0, TAU); c.fill(); }
    if (f < 0.32) { c.fillStyle = '#c8841a'; c.fillRect(-1.5, -r * 0.92, 3, r * 1.84); c.fillStyle = '#fff6c8'; c.fillRect(-0.5, -r * 0.8, 1, r * 0.6); }
    c.restore();
  };
  R.drawCoin9 = function (c, s, F, many) {
    const T = this.time, t = s.tier || 1, id = s.id || 0, big = !!s.big;
    this.tipFor9(s);   // [4차] 3 · 4단계 대포 포구에서 출발
    if (s._o && s._d0 == null) s._d0 = Math.max(1, F.d);   // 무기 끝 출발 보정(다른 층을 거치지 않으므로 여기서)
    const [x, y] = ptAt(s, F, F.q, true), tg = tangentAt(s, F, F.q), ang = Math.atan2(tg[1], tg[0]);
    const spin = T * (16 + t * 2) + id, tilt = Math.sin(T * 7 + id) * 0.45 + ang * 0.3;   // [2차] 기울기 크게(정지 장면에서도 도는 게 보이게)
    if (!many) dots9(c, s, F, t);
    // 금빛 띠(휜 길) — 단계가 오를수록 길고 굵게, 6단계는 무지갯빛 테. 1단계는 구리색
    if (!many) ribbon(c, s, F, 0.12 + t * 0.035 + (big ? 0.1 : 0), 4 + t * 1.6 + (big ? 6 : 0), t >= 6 || big ? [hue(T, id % 6), '#ffe36a', '#fff6c8'] : t === 1 ? ['#c87a3c', '#f0b078'] : ['#e8a21a', '#fff6c8'], 0.8);
    // [6차] 단계마다 돈의 형태가 달라진다: 1 구리 동전 → 2 금화 → 3 동전 더미 → 4 돈주머니 → 5 금괴 → 6 보석 날개 금화
    //   독립 검수: 1~3단계 같은 동전이 개수만 늘어남 · 4단계 안경 · 5단계 컵 · 6단계가 1단계처럼 되돌아감
    const trail = (n, gap, r0, jig) => { if (many) return; for (let j = 1; j <= n; j++) { const p = ptAt(s, F, Math.max(0, F.q - j * gap), true), w = Math.sin(j * 1.3 + T * 12) * jig; this.coin9(c, p[0] - tg[1] * w, p[1] + tg[0] * w, Math.max(4, r0 - j * 0.5), Math.cos(spin + j * 0.9), 0, 1 - j * 0.12); } };
    if (big) {   // 주기 공격(5 · 6단계 금화 비): 그 단계의 돈 + 도는 동전 넷 + 큰 반짝
      for (let j = 0; j < 4; j++) { const a = T * 8 + j * TAU / 4; this.coin9(c, x + Math.cos(a) * 26, y + Math.sin(a) * 13, 6, Math.cos(spin + j), 0); }
      if (t >= 6) this.royal9(c, x, y, 20, spin, T, id); else this.ingot9(c, x, y, 17, Math.sin(T * 6 + id) * 0.5 + ang * 0.25);
      this.star(c, x, y, 4, 30, 3, T * 5, 'rgba(255,255,255,0.85)');
    } else if (t >= 6) {   // 보석 날개 금화 + 나선으로 감기는 동전 줄기
      trail(4, 0.05, 6, 9);
      this.royal9(c, x, y, 15, spin, T, id);
      for (let j = 0; j < 2; j++) { const a = T * 5 + j * Math.PI + id, X = x + Math.cos(a) * 30, Y = y + Math.sin(a) * 22; this.star(c, X, Y, 4, 7 + 2 * Math.sin(T * 14 + j), 1.8, 0, PLUM); this.star(c, X, Y, 4, 5 + 2 * Math.sin(T * 14 + j), 1.2, 0, '#fffbe0'); }
    } else if (t >= 5) {   // 금괴: 뒤에 작은 동전 둘이 따라옴
      trail(2, 0.07, 6, 4);
      this.ingot9(c, x, y, 15, Math.sin(T * 6 + id) * 0.5 + ang * 0.25);
    } else if (t >= 4) {   // 돈주머니: 흔들리며 날고 동전을 흘린다
      if (!many) for (let j = 1; j <= 2; j++) { const q2 = Math.max(0, F.q - j * 0.07), p = ptAt(s, F, q2, true); this.coin9(c, p[0], p[1] + j * j * 5, 6, Math.cos(spin + j * 1.7), 0, 1 - j * 0.15); }
      this.moneyBag9(c, x, y, 15, Math.sin(T * 9 + id) * 0.4, id);
    } else if (t >= 3) {   // 동전 더미: 네 닢이 어긋나며 흔들림
      this.coinStack9(c, x, y, 12, Math.sin(T * 8 + id) * 0.45 + ang * 0.3, T, id);
      this.star(c, x + 11, y - 12, 4, 6 + 3 * Math.abs(Math.sin(T * 9 + id)), 1.5, T * 8, '#ffffff');
    } else {   // 1 구리 동전 · 2 큰 금화: 진행 방향으로 늘어나며 돈다
      for (let j = 2; j >= 1; j--) { const X = x - tg[0] * j * 7, Y = y - tg[1] * j * 7; if (t === 1) this.copper9(c, X, Y, 7, Math.cos(spin - j * 0.6), tilt, 0.28 / j); else this.coin9(c, X, Y, 9, Math.cos(spin - j * 0.6), tilt, 0.28 / j); }
      c.save(); c.translate(x, y); c.rotate(ang); c.scale(1.22 + 0.06 * t, 1 / (1.12 + 0.04 * t)); c.rotate(-ang); c.translate(-x, -y);
      const fl = 0.35 + 0.65 * Math.abs(Math.cos(spin));
      if (t === 1) this.copper9(c, x, y, 9, fl, tilt); else this.coin9(c, x, y, 13, fl, tilt);
      c.restore();
      if (t === 2) this.star(c, x + 8, y - 9, 4, 6 + 3 * Math.abs(Math.sin(T * 9 + id)), 1.5, T * 8, '#ffffff');
    }
  };
  // 구리 동전(1단계): 금화보다 작고 수수하게 — 같은 그림을 쓰지 않아 단계 차이가 바로 보인다
  R.copper9 = function (c, x, y, r, flip, tilt, alpha) {
    const f = Math.abs(flip), w = Math.max(0.16, Math.pow(f, 1.5) * 0.9), sd = flip >= 0 ? 1 : -1;
    c.save(); c.translate(x, y); if (tilt) c.rotate(tilt); if (alpha != null) c.globalAlpha *= alpha;
    if (alpha == null) { c.fillStyle = PLUM; c.beginPath(); c.ellipse(sd * r * 0.1, 0, r * w + r * 0.14 + 2.5, r + 2.5, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#7a4424'; c.beginPath(); c.ellipse(sd * r * 0.2 * (1 - f * 0.5), 0, r * w, r, 0, 0, TAU); c.fill();
    c.fillStyle = '#c87a3c'; c.beginPath(); c.ellipse(0, 0, r * w, r, 0, 0, TAU); c.fill();
    c.fillStyle = '#f0b078'; c.beginPath(); c.ellipse(0, 0, r * w * 0.62, r * 0.62, 0, 0, TAU); c.fill();
    c.fillStyle = '#a8602c'; c.fillRect(-1.5 * w, -r * 0.34, 3 * w, r * 0.68);
    c.restore();
  };
  // 동전 더미(3단계): 옆에서 본 네 닢. 닢마다 조금씩 어긋나 흔들린다
  R.coinStack9 = function (c, x, y, r, tilt, T, id) {
    const n = 4, h = r * 0.46, ry = r * 0.42, dx = [], yy = [];
    for (let j = 0; j < n; j++) { dx.push(Math.sin(T * 10 + j * 1.7 + id) * r * 0.2); yy.push((n / 2 - 0.5 - j) * h); }
    c.save(); c.translate(x, y); c.rotate(tilt);
    c.fillStyle = PLUM; for (let j = 0; j < n; j++) { c.beginPath(); c.ellipse(dx[j], yy[j] + 1.5, r + 2.5, ry + 4, 0, 0, TAU); c.fill(); }
    for (let j = 0; j < n; j++) {
      c.fillStyle = '#a8640e'; c.beginPath(); c.ellipse(dx[j], yy[j] + 2.5, r, ry, 0, 0, TAU); c.fill();
      c.fillStyle = j === n - 1 ? '#ffd23a' : '#e8a21a'; c.beginPath(); c.ellipse(dx[j], yy[j], r, ry, 0, 0, TAU); c.fill();
    }
    c.fillStyle = '#fff6c8'; c.beginPath(); c.ellipse(dx[n - 1] - r * 0.15, yy[n - 1] - ry * 0.1, r * 0.5, ry * 0.42, 0, 0, TAU); c.fill();
    c.restore();
  };
  // 돈주머니(4단계): 삼베 주머니 + 금빛 끈 + 동전 표시
  R.moneyBag9 = function (c, x, y, sz, tilt) {
    const im = this.I('i_coin');
    const body = () => { c.beginPath(); c.moveTo(-sz * 0.26, -sz * 0.62); c.bezierCurveTo(-sz * 0.5, -sz * 0.3, -sz * 1.05, -sz * 0.1, -sz * 0.92, sz * 0.45); c.bezierCurveTo(-sz * 0.85, sz * 0.95, sz * 0.85, sz * 0.95, sz * 0.92, sz * 0.45); c.bezierCurveTo(sz * 1.05, -sz * 0.1, sz * 0.5, -sz * 0.3, sz * 0.26, -sz * 0.62); c.closePath(); };
    const tuft = () => { c.beginPath(); c.moveTo(-sz * 0.24, -sz * 0.66); c.lineTo(-sz * 0.48, -sz * 1.08); c.lineTo(-sz * 0.12, -sz * 0.94); c.lineTo(0, -sz * 1.14); c.lineTo(sz * 0.12, -sz * 0.94); c.lineTo(sz * 0.48, -sz * 1.08); c.lineTo(sz * 0.24, -sz * 0.66); c.closePath(); };
    c.save(); c.translate(x, y); c.rotate(tilt); c.lineJoin = 'round';
    c.strokeStyle = PLUM; c.lineWidth = 5; body(); c.stroke(); tuft(); c.stroke();
    c.fillStyle = '#c8893a'; body(); c.fill(); tuft(); c.fill();
    c.save(); body(); c.clip(); c.fillStyle = '#a06a28'; c.fillRect(sz * 0.32, -sz, sz, sz * 2); c.fillStyle = '#e8b878'; c.fillRect(-sz * 0.78, -sz * 0.1, sz * 0.26, sz * 0.5); c.restore();
    c.fillStyle = PLUM; c.fillRect(-sz * 0.36, -sz * 0.76, sz * 0.72, sz * 0.26); c.fillStyle = '#ffd23a'; c.fillRect(-sz * 0.3, -sz * 0.71, sz * 0.6, sz * 0.15);
    const r = sz * 0.46; if (im) c.drawImage(im, -r, sz * 0.26 - r, r * 2, r * 2);
    c.restore();
  };
  // 금괴(5단계): 비스듬히 본 벽돌. 윗면 · 앞면 · 옆면이 보여 컵으로 읽히지 않는다(뒤집히지 않고 까딱인다)
  R.ingot9 = function (c, x, y, sz, rot) {
    const P = (pts, col) => { c.beginPath(); pts.forEach(([a, b], j) => (j ? c.lineTo(a * sz, b * sz) : c.moveTo(a * sz, b * sz))); c.closePath(); if (col) { c.fillStyle = col; c.fill(); } };
    const TOP = [[-0.85, -0.1], [0.55, -0.1], [0.98, -0.55], [-0.4, -0.55]], FRONT = [[-1.05, 0.55], [0.75, 0.55], [0.55, -0.1], [-0.85, -0.1]], SIDE = [[0.55, -0.1], [0.98, -0.55], [1.18, 0.02], [0.75, 0.55]];
    c.save(); c.translate(x, y); c.rotate(rot); c.lineJoin = 'round';
    c.strokeStyle = PLUM; c.lineWidth = 5; for (const f of [TOP, FRONT, SIDE]) { P(f); c.stroke(); }
    P(FRONT, '#f0b020'); P(SIDE, '#b87810'); P(TOP, '#fff0a0');
    c.fillStyle = '#c88a14'; c.fillRect(-sz * 0.42, sz * 0.12, sz * 0.72, sz * 0.2);
    c.fillStyle = '#ffffff'; c.fillRect(-sz * 0.3, -sz * 0.42, sz * 0.62, sz * 0.09);
    c.restore();
  };
  // 보석 날개 금화(6단계): 큰 금화 + 붉은 보석 + 퍼덕이는 금빛 날개
  R.royal9 = function (c, x, y, r, spin, T, id) {
    const flap = Math.sin(T * 22 + id) * 0.32;
    const feathers = (fill, grow) => { for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) { const L = r * (1.3 - j * 0.24); c.save(); c.translate(x + sd * r * 0.82, y - r * 0.08); c.rotate(sd * (-0.62 + j * 0.5 + flap)); c.fillStyle = fill[j % fill.length]; c.beginPath(); c.ellipse(sd * L * 0.5, 0, L * 0.5 + grow, r * 0.2 + grow, 0, 0, TAU); c.fill(); c.restore(); } };
    feathers([PLUM], 2.5); feathers(['#fff6c8', '#ffe36a', '#ffb81c'], 0);
    const fl = 0.66 + 0.34 * Math.abs(Math.cos(spin * 0.5));
    this.coin9(c, x, y, r, fl, 0);
    const w = Math.pow(fl, 1.5) * 0.88, g = r * 0.42;
    c.save(); c.translate(x, y); c.scale(w, 1);
    c.fillStyle = PLUM; c.beginPath(); c.moveTo(0, -g - 3); c.lineTo(g + 3, 0); c.lineTo(0, g + 3); c.lineTo(-g - 3, 0); c.closePath(); c.fill();
    c.fillStyle = '#e8304a'; c.beginPath(); c.moveTo(0, -g); c.lineTo(g, 0); c.lineTo(0, g); c.lineTo(-g, 0); c.closePath(); c.fill();
    c.fillStyle = '#ff9aa8'; c.beginPath(); c.moveTo(0, -g); c.lineTo(g * 0.5, -g * 0.5); c.lineTo(0, 0); c.lineTo(-g * 0.5, -g * 0.5); c.closePath(); c.fill();
    c.restore();
  };

  // ------------------------------------------------------------ 맞는 순간: 종류별 2차 효과 · 6단계 마무리
  // 파편: 각도 · 속도를 미리 정해 두고 진행률(p)로만 위치를 계산(상태 없는 그리기)
  function shards(n, sp, up) { const a = []; for (let j = 0; j < n; j++) { const ang = rnd(0, TAU), v = rnd(sp * 0.55, sp); a.push({ vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * 0.7 - (up || 0) * rnd(0.6, 1), ph: rnd(0, TAU), r: rnd(0.75, 1.15) }); } return a; }
  R.coinPop9 = function (x, y, n, sp, up, dur) {
    const cs = shards(n, sp, up), gy = y + 18;
    this.addFx(dur, (c, p) => {
      const tt = p * dur;
      for (const o of cs) {
        let px = x + o.vx * tt, py = y + o.vy * tt + 0.5 * 1100 * tt * tt;
        if (py > gy) py = gy - (py - gy) * 0.25;   // 바닥에 '짤랑' 튐
        this.coin9(c, px, py, 6 * o.r, Math.cos(tt * 22 + o.ph), 0, p > 0.7 ? (1 - p) / 0.3 : 1);
      }
    }, 'over');
  };
  R.spikes9 = function (x, y, n, len, cols, dur, w) {   // 뻗는 가시 · 얼음 조각 · 번개 갈래(뾰족한 삼각형이 밖으로)
    const as = []; for (let j = 0; j < n; j++) as.push(j * TAU / n + rnd(-0.25, 0.25));
    this.addFx(dur, (c, p) => {
      const e = 1 - (1 - p) ** 3, L = len * (0.3 + e * 0.7);
      c.save(); c.globalAlpha = p > 0.6 ? (1 - p) / 0.4 : 1;
      as.forEach((a, j) => { const ca = Math.cos(a), sa = Math.sin(a) * 0.6, ww = (w || 4) * (1 - p * 0.5); c.fillStyle = cols[j % cols.length]; c.beginPath(); c.moveTo(x + ca * L, y + sa * L); c.lineTo(x - sa * ww, y + ca * ww); c.lineTo(x + sa * ww, y - ca * ww); c.closePath(); c.fill(); });
      c.restore();
    });
  };
  R.bolts9 = function (x, y, n, len, dur) {   // 짧은 번개 갈래
    const seg = []; for (let j = 0; j < n; j++) { const a = rnd(0, TAU), pts = [[x, y]]; let px = x, py = y; for (let q = 0; q < 3; q++) { px += Math.cos(a) * len / 3 + rnd(-6, 6); py += Math.sin(a) * len / 3 * 0.6 + rnd(-6, 6); pts.push([px, py]); } seg.push(pts); }
    this.addFx(dur, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.lineCap = 'round'; for (const [col, w] of [['#a77bff', 5], ['#ffffff', 2]]) { c.strokeStyle = col; c.lineWidth = w; for (const pts of seg) { c.beginPath(); pts.forEach((q, k) => k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); } } c.restore(); });
  };
  R.pillar9 = function (x, y, cols, dur, jag) {   // 하늘에서 내리꽂는 기둥(번개 · 불기둥 · 빛)
    const pts = []; let px = x; for (let q = 0; q <= 8; q++) { pts.push([px, y - 320 + q * 40]); px = x + (jag ? rnd(-14, 14) : 0); }
    pts[pts.length - 1] = [x, y];
    this.addFx(dur, (c, p) => { c.save(); c.globalAlpha = p < 0.15 ? p / 0.15 : (1 - p) / 0.85; c.lineCap = 'round'; c.lineJoin = 'round'; cols.forEach(([col, w]) => { c.strokeStyle = col; c.lineWidth = w * (1 - p * 0.5); c.beginPath(); pts.forEach((q, k) => k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); }); c.restore(); });
    this.pxBurst9(x, y, 22, [cols[1][0], '#ffffff', cols[2][0]], 0.3);
  };
  R.shock9 = function (x, y, col, r, dur, w) {
    this.addFx(dur, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = (w || 5) * (1 - p) + 1; c.beginPath(); c.ellipse(x, y + 8, 10 + p * r, 4 + p * r * 0.4, 0, 0, TAU); c.stroke(); c.restore(); });
  };

  const prevImpact = R.impact, last9 = {};
  R.impact = function (e) {
    prevImpact.call(this, e);
    const t = e.tier || 1, x = e.x, y = e.y, type = e.type, big = !!e.big;
    const fin = (e.fn || 0) >= 2 && e.fk === e.fn - 1 && t >= 6;   // 6단계 한 번 공격의 마지막 탄 = 마무리
    const key = type + (e.kind || ''), lh = last9[key];
    if (!fin && !big && lh != null && this.time - lh < 0.06) return;   // 연달아 맞는 탄은 0.06초에 한 번만(겹침 · 무게)
    last9[key] = this.time;
    const many = this.busy();
    if (many && !fin && !big && type !== 'greed') return;   // 입자가 많을 때(판 가득)는 마무리 · 큰 한 방 · 동전만
    switch (type) {
      case 'greed': {   // 동전이 '짤랑' 튄다: 1단계 3개 → 4단계 6개 + 금빛 고리 → 마무리 · 금화 비는 동전 분수
        if (fin || big) { this.coinPop9(x, y, many ? 8 : 14, 170, 420, 0.9); this.shock9(x, y, '#ffd23a', 70, 0.45, 6); this.addFx(0.3, (c, p) => this.star(c, x, y - 6, 8, 34 * (0.5 + p), 4, p * 2, `rgba(255,246,200,${1 - p})`)); }
        else { this.coinPop9(x, y, many ? 2 : [0, 3, 3, 4, 6, 6, 7][t], 120 + t * 10, 260 + t * 20, 0.7); if (t >= 4) this.shock9(x, y, '#ffd23a', 40, 0.3, 4); }
        break;
      }
      case 'ice':
        if (t >= 3) this.spikes9(x, y, fin ? 10 : 4 + t, fin ? 46 : 14 + t * 3, ['#e6f8ff', '#9fe0ff', '#4aa0ff'], fin ? 0.5 : 0.28, fin ? 6 : 4);
        if (fin) { this.shock9(x, y, '#bfe6ff', 80, 0.5, 6); this.addFx(0.5, (c, p) => { c.save(); c.translate(x, y); c.rotate(p); c.globalAlpha = 1 - p; c.strokeStyle = '#ffffff'; c.lineWidth = 3; for (let j = 0; j < 6; j++) { c.rotate(TAU / 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(30 + p * 10, 0); c.stroke(); } c.restore(); }); }
        break;
      case 'tyrant':
        if (t >= 3) this.spikes9(x, y + 6, fin ? 9 : 3 + t, fin ? 44 : 12 + t * 3, ['#1a0e14', '#b8202e', '#ff3b4a'], fin ? 0.5 : 0.26, fin ? 7 : 4);
        if (fin) { this.shock9(x, y, '#d8283a', 80, 0.5, 7); this.shake = Math.max(this.shake, 5); }
        break;
      case 'bolt':
        if (t >= 3 && (t < 5 || fin)) this.bolts9(x, y, fin ? 4 : 3, fin ? 36 : 18 + t * 3, fin ? 0.26 : 0.18);
        if (fin) { this.pillar9(x, y, [[PLUM, 9], ['#a77bff', 5], ['#ffffff', 2]], 0.34, true); this.flash = Math.max(this.flash || 0, 0.12); }
        break;
      case 'beacon':
        if (t >= 3 && !many) for (let j = 0; j < 2 + t; j++) this.part({ x, y, vx: rnd(-90, 90), vy: rnd(-220, -80), life: rnd(0.35, 0.55), size: rnd(3, 5), col: j % 2 ? '#ffd23a' : '#ff6a1c', kind: 'fire', grav: 380 });
        if (fin) { this.pillar9(x, y, [[PLUM, 15], ['#e8452c', 10], ['#ffd23a', 4]], 0.4, false); this.shock9(x, y, '#ff9a1c', 70, 0.4, 6); }
        break;
      case 'summon':
        if (t >= 3 && !many) for (let j = 0; j < 2 + Math.floor(t / 2); j++) this.part({ x: x + rnd(-10, 10), y, vx: rnd(-20, 20), vy: rnd(-90, -50), life: 0.6, size: rnd(4, 6), col: j % 2 ? '#b8fff0' : '#2fc8a8', kind: 'dot', drag: 1 });
        if (fin) { const im = this.I('x_spirit'); this.addFx(0.55, (c, p) => { for (let j = 0; j < 8; j++) { const a = j * TAU / 8 + p * 2, r = 12 + p * 50; c.save(); c.globalAlpha = 1 - p; if (im) c.drawImage(im, x + Math.cos(a) * r - 7, y + Math.sin(a) * r * 0.5 - 8, 14, 16); else this.circle(c, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, 4, '#b8fff0'); c.restore(); } }); }
        break;
      case 'combo':
        if (t >= 3) this.addFx(0.22, (c, p) => this.star(c, x, y, 5, (10 + t * 3) * (0.5 + p), 3, p * 3, `rgba(255,138,223,${1 - p})`));
        if (fin) { this.addFx(0.45, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.lineWidth = 3; RAIN.forEach((col, j) => { c.strokeStyle = col; c.beginPath(); c.ellipse(x, y, 8 + j * 4 + p * 46, (8 + j * 4 + p * 46) * 0.5, 0, 0, TAU); c.stroke(); }); c.restore(); this.star(c, x, y, 8, 40 * (0.6 + p), 5, p * 2, `rgba(255,255,255,${1 - p})`); }); }
        break;
      case 'prism': if (t >= 2) this.refract9(x, y, t >= 6 ? (fin ? 7 : 5) : t >= 4 ? 3 : 2, t >= 6 ? 54 : 20 + t * 5, t >= 5); break;   // [3차] 맞으면 굴절 빔으로 갈라짐
      case 'gatling':
        if (t >= 3 && !many) for (let j = 0; j < 2; j++) { const a = rnd(-Math.PI, 0); this.part({ x, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 160, life: 0.22, size: 2.5, col: '#fff6c8', kind: 'spark', grav: 500 }); }
        if (fin) this.shock9(x, y, '#ffe36a', 60, 0.35, 5);
        break;
      case 'mining':
        if (t >= 3) this.spikes9(x, y + 6, 3 + t, 10 + t * 3, ['#8a5a10', '#ffd23a', '#5a3a10'], 0.3, 4);
        if (fin) this.coinPop9(x, y, 6, 140, 300, 0.7);
        break;
      default:
        if (fin) { const col = colOf(type); this.shock9(x, y, col, 80, 0.45, 6); this.addFx(0.3, (c, p) => this.star(c, x, y, 6, 36 * (0.5 + p), 4, p * 2, col)); }
    }
  };

  // ============================================================ [2차 · 독립 검수 지적 반영]
  // ① 1단계도 차이가 보이게(잔상 점 · 큰 늘어남) ② 3 · 4단계가 '개수만'이 아닌 모양으로(콤보 맞물린 고리 · 화염 불꼬리 · 개틀링 휘는 예광탄 + 탄피 · 채굴 도는 곡괭이 · 폭군 가시 고리)
  // ③ 6단계 직선 빔 → 모으기 · 휘며 뻗기(출렁임) · 끝 갈라짐 ④ 흐린 빛 덩어리 → 몇 단계로 끊긴 픽셀 + 자두색 외곽선 ⑤ 연속 프레임 띠 장면(strip9)
  const PLUM = '#2b1426', PALF = ['#e8452c', '#ff9a1c', '#ffe36a'];
  const DOTC = { coin: '#ffd23a', fireball: '#ff9a1c', icicle: '#bfe6ff', spike: '#d8283a', dart: '#7be06a', acid: '#a6d83a', orb: '#ffe48a', bless: '#ffe48a', orb2: '#ff8adf', zap: '#d8c8ff', arrow: '#ffb347', ore: '#d9a040', ingot: '#ffd23a', prism: '#ffffff', leaf: '#c8f06a', toxic: '#7be06a', acidglob: '#c6f04a', flame: '#ffb347', sunbolt: '#fff2a0', flameslash: '#ff9a1c' };
  // 지나온 길의 잔상 점 3개(자두색 테두리 픽셀 점, 뒤로 갈수록 작게)
  function dots9(c, s, F, t) {
    const col = DOTC[s.kind]; if (!col) return;
    for (let j = 1; j <= 3; j++) { const p = ptAt(s, F, Math.max(0, F.q - j * (0.035 + t * 0.004)), true), r = Math.max(1.5, 4.5 - j + t * 0.3); R.circle(c, p[0], p[1], r + 1.5, PLUM); R.circle(c, p[0], p[1], r, col); }
  }
  // 픽셀 구슬: 자두색 외곽 → 바깥색 → 안쪽색 → 하이라이트(빛 번짐 없이 또렷하게)
  function pxOrb(self, c, x, y, r, cols) { self.circle(c, x, y, r + 3, PLUM); self.circle(c, x, y, r, cols[0]); self.circle(c, x, y, r * 0.66, cols[1]); self.circle(c, x - r * 0.25, y - r * 0.25, r * 0.3, cols[2]); }
  // 불꼬리(화염 2 · 3단계 불덩이 뒤): 진행 반대쪽으로 늘어진 물방울 모양, 일렁임
  R.tongue9 = function (c, x, y, ang, k, P) {
    const fl = 1 + Math.sin(this.time * 38 + x) * 0.15, T = this.time;
    c.save(); c.translate(x, y); c.rotate(ang);
    [[PLUM, 1.18], [P[0], 1], [P[1], 0.72], [P[2], 0.45]].forEach(([col, f]) => { const L = 30 * k * f * fl, W = 9 * k * f; c.fillStyle = col; c.beginPath(); c.moveTo(6 * k * f, 0); c.quadraticCurveTo(0, -W, -L, Math.sin(T * 20) * 3); c.quadraticCurveTo(0, W, 6 * k * f, 0); c.fill(); });
    c.restore();
  };
  // 곡괭이(채굴 3 · 4단계): 돌며 날아가는 곡괭이 날
  R.pickaxe9 = function (c, x, y, rot, k, gold) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(k, k); c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = PLUM; c.lineWidth = 6.5; c.beginPath(); c.moveTo(0, 17); c.lineTo(0, -7); c.stroke();
    c.strokeStyle = '#a8703a'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(0, 17); c.lineTo(0, -7); c.stroke();
    const head = () => { c.beginPath(); c.moveTo(-17, 3); c.quadraticCurveTo(0, -15, 17, 3); c.quadraticCurveTo(0, -6, -17, 3); c.closePath(); };
    c.strokeStyle = PLUM; c.lineWidth = 3; head(); c.stroke();
    c.fillStyle = gold ? '#ffd23a' : '#c8cad8'; head(); c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(-6, -7, 8, 1.6);
    c.restore();
  };
  // 가시(폭군 3단계부터 직접): 자두색 외곽 · 검붉은 몸 · 밝은 날, 3단계는 도는 가시 고리, 4단계부터 자루 달린 긴 창
  R.thorn9 = function (c, x, y, ang, t) {
    const L = t >= 4 ? 1.75 : 1.4, T = this.time;
    c.save(); c.translate(x, y); c.rotate(ang);
    c.fillStyle = PLUM; c.beginPath(); c.moveTo(17 * L, 0); c.lineTo(-13 * L, -7); c.lineTo(-8 * L, 0); c.lineTo(-13 * L, 7); c.closePath(); c.fill();
    c.fillStyle = '#8a0e1e'; c.beginPath(); c.moveTo(14 * L, 0); c.lineTo(-10 * L, -4.5); c.lineTo(-6 * L, 0); c.lineTo(-10 * L, 4.5); c.closePath(); c.fill();
    c.fillStyle = '#ff3b4a'; c.beginPath(); c.moveTo(14 * L, 0); c.lineTo(0, -2); c.lineTo(-4 * L, 0); c.closePath(); c.fill();
    if (t >= 4) { c.strokeStyle = PLUM; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8 * L, 0); c.lineTo(-24 * L, 0); c.stroke(); c.strokeStyle = '#5a0e1a'; c.lineWidth = 2.5; c.stroke(); }
    c.restore();
    if (t === 3) for (let j = 0; j < 3; j++) { const a = T * 14 + j * TAU / 3; c.save(); c.translate(x + Math.cos(a) * 11, y + Math.sin(a) * 6); c.rotate(a + Math.PI / 2); c.fillStyle = PLUM; c.beginPath(); c.moveTo(6, 0); c.lineTo(-4, -3.5); c.lineTo(-4, 3.5); c.closePath(); c.fill(); c.fillStyle = '#ff3b4a'; c.beginPath(); c.moveTo(4, 0); c.lineTo(-2, -1.6); c.lineTo(-2, 1.6); c.closePath(); c.fill(); c.restore(); }
  };
  // 직접 그리는 탄(이전 층을 거치지 않음). 그렸으면 true
  R.own9 = function (c, s, F, t, many) {
    const k = s.kind, T = this.time, id = s.id || 0;
    const mine = k === 'bullet' || k === 'prism' || k === 'orb2' || (k === 'spike' && t >= 3);
    if (!mine) return false;
    if (s._o && s._d0 == null) s._d0 = Math.max(1, F.d);
    const tg = tangentAt(s, F, F.q), ang = Math.atan2(tg[1], tg[0]);
    let [x, y] = ptAt(s, F, F.q, true);
    if (!many && k !== 'ore' && k !== 'ingot' && k !== 'bullet' && k !== 'prism') dots9(c, s, F, t);
    switch (k) {
      case 'orb2': {   // 콤보: 1 · 2단계 고리 하나 → 3 · 4단계 맞물려 도는 고리 둘 + 감기는 나선 점 → 5 별 → 6 무지개
        if (t >= 3 && !many) for (let j = 1; j <= 6; j++) { const p = ptAt(s, F, Math.max(0, F.q - j * 0.025), true), w = Math.sin(j * 1.3 - T * 16) * 8; this.circle(c, p[0] - tg[1] * w, p[1] + tg[0] * w, 3, j % 2 ? '#ff5ac8' : '#ffe0f6'); }
        const ring = (rot, col, a0, a1) => { c.save(); c.translate(x, y); c.rotate(rot); c.lineWidth = 5; c.strokeStyle = PLUM; c.beginPath(); c.ellipse(0, 0, 14, 5.5, 0, a0, a1); c.stroke(); c.lineWidth = 2.5; c.strokeStyle = col; c.stroke(); c.restore(); };
        const r1 = T * 7 + id, c1 = t >= 6 ? hue(T, 0) : '#ffc8f0', c2 = t >= 6 ? hue(T, 3) : '#ff8adf';
        if (t >= 3) ring(r1 + Math.PI / 2, c2, Math.PI, TAU);   // 둘째 고리 뒤 반쪽
        ring(r1, c1, 0, TAU);
        pxOrb(this, c, x, y, 6.5, ['#ff5ac8', '#ff8adf', '#ffffff']);
        if (t >= 3) ring(r1 + Math.PI / 2, c2, 0, Math.PI);      // 둘째 고리 앞 반쪽(구슬을 감싸 맞물림)
        this.shotExtra9(c, s, F, t, x, y, ang, many);
        return true;
      }
      case 'bullet': {   // [3차] 개틀링: 1 · 2 놋쇠 짧은 탄 → 3 주황 예광탄 → 4 · 5 불붙은 예광탄(불꼬리 · 불티) → 6 푸른 플라스마 탄(두 줄기 교차 사격)
        const LEN = [0, 9, 11, 16, 20, 22, 26][t], col = t <= 2 ? '#e8c060' : t === 3 ? '#ffb347' : t <= 5 ? '#ff7a1c' : '#7fd8ff', core = t >= 6 ? '#ffffff' : '#fff6c8';
        c.save(); c.lineCap = 'round';
        for (const [cc, w, f] of [[PLUM, t >= 4 ? 6 : 4.5, 1], [col, t >= 4 ? 3.5 : 2.5, 1], [core, 1.2, 0.6]]) { c.strokeStyle = cc; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(x - tg[0] * LEN * f, y - tg[1] * LEN * f); c.stroke(); }
        c.restore();
        if (t >= 4 && t <= 5) { this.tongue9(c, x - tg[0] * 4, y - tg[1] * 4, ang, 0.45, PALF); if (!many && !this.busy() && Math.random() < 0.3) this.part({ x, y, vx: -tg[0] * 60 + rnd(-20, 20), vy: -tg[1] * 60 - rnd(10, 40), life: 0.25, size: 3, col: PALF[(Math.random() * 3) | 0], kind: 'fire' }); }
        if (t >= 6) pxOrb(this, c, x, y, 3, ['#4aa0ff', '#bfefff', '#ffffff']);
        return true;
      }
      case 'prism': {   // [3차] 프리즘: 갈래 수 · 굴절이 단계마다 늘어남 — 1 한 줄 · 2 두 갈래 · 3 세 갈래 부채 · 4 여섯 빛 굴절 부채 · 5 꺾이는 굴절 · 6 큰 삼각 프리즘 + 무지개 휘는 빔
        const NS = [0, 1, 2, 3, 6, 6, 6][t], spread = [0, 0, 3, 4.5, 3.5, 4, 5][t], q1 = F.q, q0 = Math.max(0, q1 - (0.1 + t * 0.025));
        if (!many) for (let j = 0; j < NS; j++) {
          const o = NS > 1 ? (j - (NS - 1) / 2) : 0, col = NS >= 6 ? RAIN[j] : RAIN[(j * 2 + 1) % 6];
          c.save(); c.lineCap = 'round'; c.lineJoin = 'miter';
          for (const [cc, w] of [[PLUM, 3.6], [col, 2]]) {
            c.strokeStyle = cc; c.lineWidth = w; c.beginPath();
            for (let n = 0; n <= 6; n++) {
              const u = n / 6, qq = q1 - (q1 - q0) * u, p = ptAt(s, F, qq, true), kink = t >= 5 && u > 0.5 ? 1.8 : 1;   // 5단계부터 중간에서 꺾임(굴절)
              const off = o * spread * u * 1.6 * kink; n ? c.lineTo(p[0] - tg[1] * off, p[1] + tg[0] * off) : c.moveTo(p[0], p[1]);
            }
            c.stroke();
          }
          c.restore();
        }
        const R0 = [0, 6, 7, 8, 12, 13, 16][t];   // [5차] 4단계부터 3단계보다 커 보이게
        c.save(); c.translate(x, y); c.rotate(t >= 4 ? T * 6 + id : ang);
        if (t >= 4) {   // 삼각 프리즘
          const tri = r => { c.beginPath(); for (let n = 0; n < 3; n++) { const a = -Math.PI / 2 + n * TAU / 3; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); };
          c.fillStyle = PLUM; tri(R0 + 3); c.fill(); c.fillStyle = hue(T, id % 6); tri(R0); c.fill(); c.fillStyle = '#ffffff'; tri(R0 * 0.55); c.fill();
        } else {          // 마름모 수정
          c.fillStyle = PLUM; c.beginPath(); c.moveTo(R0 + 3, 0); c.lineTo(0, -R0 * 0.7 - 3); c.lineTo(-R0 - 3, 0); c.lineTo(0, R0 * 0.7 + 3); c.closePath(); c.fill();
          c.fillStyle = '#e0f4ff'; c.beginPath(); c.moveTo(R0, 0); c.lineTo(0, -R0 * 0.7); c.lineTo(-R0, 0); c.lineTo(0, R0 * 0.7); c.closePath(); c.fill();
          c.fillStyle = hue(T, id % 6); c.beginPath(); c.moveTo(R0 * 0.5, 0); c.lineTo(0, -R0 * 0.35); c.lineTo(-R0 * 0.5, 0); c.lineTo(0, R0 * 0.35); c.closePath(); c.fill();
        }
        c.restore();
        this.shotExtra9(c, s, F, t, x, y, ang, many);
        return true;
      }
      case 'spike':
        this.thorn9(c, x, y, ang, t);
        this.shotExtra9(c, s, F, t, x, y, ang, many);
        return true;
    }
    return false;
  };

  // 개틀링 3단계부터: 쏠 때 탄피(놋쇠 막대)가 튀어 빙글 돌며 떨어짐
  const prevMuzzle = R.muzzle;
  R.muzzle = function (e) {
    const r = prevMuzzle.call(this, e);
    if (e && e.type === 'gatling' && (e.tier || 1) >= 3) {
      const n = Math.min(3, (e.tier || 3) - 1), sd = e.tx < e.x ? 1 : -1, cs = [];
      for (let j = 0; j < n; j++) cs.push({ vx: sd * rnd(50, 110), vy: -rnd(160, 240), w: rnd(14, 22), d: j * 0.05 });
      const x0 = e.x, y0 = e.y + 4, gy = e.y + 34;
      this.addFx(0.75, (c, p) => { const tt0 = p * 0.75; for (const o of cs) { const tt = tt0 - o.d; if (tt < 0) continue; const x = x0 + o.vx * tt; let y = y0 + o.vy * tt + 0.5 * 1200 * tt * tt; if (y > gy) y = gy - (y - gy) * 0.2; c.save(); c.translate(x, y); c.rotate(tt * o.w); c.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1; c.fillStyle = PLUM; c.fillRect(-2.5, -4.5, 5, 9); c.fillStyle = '#e8b040'; c.fillRect(-1.5, -3.5, 3, 7); c.fillStyle = '#fff2a0'; c.fillRect(-1.5, -3.5, 1, 5); c.restore(); } });
    }
    return r;
  };

  // 픽셀 반짝(맞는 곳 공용): 3px 격자로 끝이 가늘어지는 네 팔 + 사선 점. [4차] 굵은 십자 블록 · 파이프처럼 보인다는 지적으로 교체
  const PB9 = new Map();   // 팔 모양 경로 재사용(맞는 곳이 많으면 네모 수천 개를 매번 칠하게 됨)
  const pbPath = (nn, add) => { const key = nn + ':' + add; let q = PB9.get(key); if (q) return q; q = new Path2D(); const P = 3; for (let j = 0; j <= nn; j++) { const w = Math.max(1, Math.round((1 - j / nn) * 2.4)) * P + add, L = j * P, h = P + add; q.rect(L - h / 2, -w / 2, h, w); q.rect(-L - h / 2, -w / 2, h, w); q.rect(-w / 2, L - h / 2, w, h); q.rect(-w / 2, -L - h / 2, w, h); } PB9.set(key, q); return q; };
  R.pxBurst9 = function (x, y, size, cols, dur) {
    if (this.fx.length > 90 && size < 20) return;   // 판이 가득할 때 작은 반짝은 건너뜀
    const P = 3, X = Math.round(x / P) * P, Y = Math.round(y / P) * P;
    this.addFx(dur || 0.3, (c, p) => {
      const e = 1 - (1 - p) ** 2, n = Math.max(2, Math.round(size * (0.4 + e * 0.6) / P));
      c.save(); c.globalAlpha = p > 0.6 ? (1 - p) / 0.4 : 1; c.translate(X, Y);
      c.fillStyle = PLUM; c.fill(pbPath(n, 3)); c.fillStyle = cols[0]; c.fill(pbPath(n, 0)); c.fillStyle = cols[1] || '#ffffff'; c.fill(pbPath(Math.max(1, Math.round(n * 0.5)), -1));
      const d = n * P * 0.55; c.fillStyle = cols[2] || cols[0]; for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) c.fillRect(dx * d - P / 2, dy * d - P / 2, P, P);
      c.restore();
    });
  };

  // ------------------------------------------------------------ 성광 빔(주기 공격 · 태양 창 튕김): 모으기 → 휘며 뻗는 빛(출렁) → 끝에서 세 갈래 + 십자 폭발
  R.beam = function (e) {
    const sub = !!e.sub, t = e.tier || 4, big = t >= 6 ? 1.25 : 1, x0 = e.x, y0 = e.y, x1 = e.tx, y1 = e.ty;
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L, bend = rnd(-1, 1) * Math.min(40, L * 0.18);
    const pt = (s, p) => { const w = bend * (1 + 0.3 * Math.sin(p * 26)) * Math.sin(s * Math.PI); return [x0 + (x1 - x0) * s + nx * w, y0 + (y1 - y0) * s + ny * w]; };
    if (!sub) this.addFx(0.08, (c, p) => { for (let j = 0; j < 5; j++) { const a = j * TAU / 5 + p * 4, r = 22 * (1 - p); this.circle(c, x0 + Math.cos(a) * r, y0 + Math.sin(a) * r, 2.5, '#fff6c8'); } this.circle(c, x0, y0, 4 + p * 4, '#ffffff'); });
    this.later(sub ? 0 : 0.07, () => {
      this.addFx(0.26, (c, p) => {
        const reach = Math.min(1, p / 0.35);
        c.save(); c.globalAlpha = p > 0.5 ? (1 - p) / 0.5 : 1; c.lineCap = 'round'; c.lineJoin = 'round';
        for (const [col, w] of [[PLUM, 6.5], ['#ffc23a', 4], ['#ffffff', 1.4]]) { c.strokeStyle = col; c.lineWidth = w * big * (sub ? 0.6 : 1) * (1 - p * 0.4); c.beginPath(); for (let j = 0; j <= 14; j++) { const q = pt(j / 14 * reach, p); j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.stroke(); }
        c.restore();
      });
      this.later(0.08, () => {
        const pe = pt(0.9, 0), a0 = Math.atan2(y1 - pe[1], x1 - pe[0]);
        this.addFx(0.22, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.lineCap = 'round'; for (const da of [-0.7, 0, 0.7]) { const a = a0 + da, LL = (14 + p * 24) * big * (sub ? 0.6 : 1); for (const [col, w] of [[PLUM, 5], ['#ffe48a', 3], ['#ffffff', 1.2]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + Math.cos(a) * LL, y1 + Math.sin(a) * LL); c.stroke(); } } c.restore(); });
        this.pxBurst9(x1, y1, (sub ? 12 : 20) * big, ['#ffc23a', '#ffffff', '#fff2a0'], 0.3);
      });
    });
    for (let k = 0; k < 3; k++) this.part({ x: x1 + rnd(-6, 6), y: y1 + rnd(-6, 6), vy: -rnd(40, 80), life: 0.5, size: 3, col: '#fff6c8', kind: 'star', vr: 5, delay: 0.1 });
  };

  // ------------------------------------------------------------ 서리(얼음 혜성 · 빙결 큰 한 방): 흰 타원 판 → 바닥에서 솟는 픽셀 얼음 결정 + 얇은 서리 고리
  R.frostFx = function (x, y, big) {
    const s = big ? 1.5 : 1, cr = [];
    for (let j = 0; j < 9; j++) { const a = j * TAU / 9 + rnd(-0.2, 0.2), d = rnd(14, 46) * s; cr.push({ x: x + Math.cos(a) * d, y: y + 4 + Math.sin(a) * d * 0.38, h: rnd(12, 22) * s, w: rnd(4, 7), lean: rnd(-0.3, 0.3) }); }
    cr.sort((A, B) => A.y - B.y);
    this.addFx(0.75, (c, p) => {
      const g = Math.min(1, p / 0.18), a = p > 0.7 ? (1 - p) / 0.3 : 1;
      c.save(); c.globalAlpha = a;
      c.strokeStyle = '#e6f8ff'; c.lineWidth = 2; c.setLineDash([6, 5]); c.beginPath(); c.ellipse(x, y + 4, 52 * s * (0.6 + g * 0.4), 20 * s * (0.6 + g * 0.4), 0, 0, TAU); c.stroke(); c.setLineDash([]);
      for (const o of cr) { const h = o.h * g; c.save(); c.translate(o.x, o.y); c.rotate(o.lean); c.fillStyle = PLUM; c.beginPath(); c.moveTo(-o.w - 2, 2); c.lineTo(0, -h - 3); c.lineTo(o.w + 2, 2); c.closePath(); c.fill(); c.fillStyle = '#9fe0ff'; c.beginPath(); c.moveTo(-o.w, 0); c.lineTo(0, -h); c.lineTo(o.w, 0); c.closePath(); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-o.w * 0.3, -1); c.lineTo(0, -h * 0.85); c.lineTo(0, -1); c.closePath(); c.fill(); c.restore(); }
      c.restore();
    });
    for (let k = 0; k < 6 * s; k++) this.part({ x: x + rnd(-44, 44) * s, y: y + rnd(-12, 12) * s, vx: rnd(-30, 30), vy: rnd(-90, -30), life: 0.45, size: 3, col: '#ffffff', kind: 'star', vr: 6, delay: rnd(0, 0.15) });
  };

  // ------------------------------------------------------------ 맞는 순간(2차): 단계마다 2차 효과 하나씩 더 · 채굴은 노란 네모 대신 픽셀 별 폭발 + 돌 조각
  const impact9 = R.impact;
  R.impact = function (e) {
    const t = e.tier || 1, x = e.x, y = e.y, k = e.kind;
    if (k === 'ingot' || (k === 'ore' && t >= 3)) {
      this.pxBurst9(x, y, 12 + t * 2, ['#ffd23a', '#ffffff', '#fff2a0'], 0.3);
      const rk = shards(Math.min(5, 3 + t), 150 + t * 15, 200), gy = y + 18;
      this.addFx(0.6, (c, p) => { const tt = p * 0.6; for (const o of rk) { const px = x + o.vx * tt; let py = y + o.vy * tt + 600 * tt * tt; if (py > gy) py = gy; const S = Math.round(2 + o.r * 2), X = Math.round(px / 3) * 3, Y = Math.round(py / 3) * 3; c.fillStyle = PLUM; c.fillRect(X - S / 2 - 1.5, Y - S / 2 - 1.5, S + 3, S + 3); c.fillStyle = o.r > 0.95 ? '#d9c299' : '#8a6a3a'; c.fillRect(X - S / 2, Y - S / 2, S, S); } });
      if (k === 'ingot' && (e.big || t >= 5)) this.shock9(x, y, '#ffd23a', 60, 0.4, 5);
      if (t >= 6 && (e.fn || 0) >= 2 && e.fk === e.fn - 1) this.coinPop9(x, y, 6, 140, 300, 0.7);
      return;
    }
    impact9.call(this, e);
    const fin = (e.fn || 0) >= 2 && e.fk === e.fn - 1;
    if (!fin && this.busy()) return;
    switch (e.type) {
      case 'fire': if (k === 'fireball' && t >= 2) { for (let j = 0; j < 3 + t; j++) this.part({ x, y, vx: rnd(-110, 110), vy: rnd(-200, -60), life: 0.4, size: rnd(3, 5), col: PALF[j % 3], kind: 'fire', grav: 420 }); if (t >= 3) this.shock9(x, y, '#ff9a1c', 34, 0.28, 4); } break;
      case 'gatling':
        if (t >= 2 && t < 4) this.addFx(0.3, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.8; this.circle(c, x + p * 8, y + 6 - p * 10, 4 + p * 4, '#d9c8b0'); c.restore(); });
        if (t >= 4) for (let j = 0; j < 4; j++) { const a = rnd(-Math.PI, 0); this.part({ x, y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 160, life: 0.28, size: 3, col: t >= 6 ? (j % 2 ? '#7fd8ff' : '#ffffff') : PALF[j % 3], kind: 'spark', grav: 520 }); }   // 튀는 불꽃
        if (t >= 6 && fin) this.pxBurst9(x, y, 16, ['#4aa0ff', '#ffffff', '#bfefff'], 0.25);
        break;
      case 'combo': if (t >= 3) { const rs = [0, 1, 2].map(j => j * TAU / 3 + rnd(-0.3, 0.3)); this.addFx(0.3, (c, p) => { c.save(); c.globalAlpha = 1 - p; rs.forEach((a, j) => { const d = 6 + p * 28, cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.6; c.strokeStyle = PLUM; c.lineWidth = 4; c.beginPath(); c.ellipse(cx, cy, 6 * (1 - p * 0.5) + 1, 2.5, a, 0, TAU); c.stroke(); c.strokeStyle = j % 2 ? '#ff8adf' : '#ffe0f6'; c.lineWidth = 2; c.stroke(); }); c.restore(); }); } break;
      case 'tyrant': if (t === 2) this.spikes9(x, y + 6, 3, 12, ['#b8202e'], 0.2, 3); if (t >= 4 && !fin) this.shock9(x, y, '#d8283a', 36, 0.28, 4); break;
      case 'greed': case 'mining': break;
      default: if (t === 2) for (let j = 0; j < 3; j++) this.part({ x, y, vx: rnd(-90, 90), vy: rnd(-140, -40), life: 0.3, size: 3, col: colOf(e.type), kind: 'star', vr: 6, grav: 300 });
    }
  };

  // ------------------------------------------------------------ 연속 프레임 띠 확인 장면(검사 전용): ?scene=volley&strip9=greed:1,combo:3,…&ft=0.03,0.08,…
  //   QA_VOLLEY 자리를 가로채(test/qa_browser.js는 그대로) 줄마다 (종류, 단계) 한 번 공격의 장면들을 가로로 붙인다. 주기 큰 한 방은 끈다
  const Q9 = new URLSearchParams(location.search);
  if (Q9.get('strip9') || Q9.get('v9')) {
    const specs = (Q9.get('strip9') || '').split(',').map(x => { const [a, b] = x.split(':'); return [a, +b || 1]; });
    const times = (Q9.get('ft') || '0.03,0.08,0.13,0.18,0.24,0.32').split(',').map(Number);
    const run = function () {
      const App = window.App, g = App.game, Rn = App.renderer, G = window.GEOM, W = 320, CW = 160;
      while (g.cardPick) g.pickCard(0);
      const cv = document.getElementById('world'), kk = cv.width / 720;
      const out = document.createElement('canvas'); out.width = CW * times.length * 2; out.height = CW * specs.length * 2;
      const sc = out.getContext('2d'); sc.scale(2, 2); sc.fillStyle = '#000'; sc.fillRect(0, 0, CW * times.length, CW * specs.length);
      const [fx, fy] = G.tiles[15].tower;
      specs.forEach(([type, tier], row) => {
        for (const tl of g.tiles) tl.tower = null; g.monsters = []; g.shots = []; Rn.parts = []; Rn.fx = []; g.gold = 99999;
        g.build(15, type, tier); const tw = g.tiles[15].tower;
        for (let q = 0; q < 6; q++) { const m = g.spawnMonster('normal', 14 + q * 0.45, (q % 3 - 1) * 0.7); m.hp = m.maxHp = 1e7; }
        for (let q = 0; q < 50; q++) { tw.cd = 5; tw.special = 99; g.step(1 / 60); Rn.consume(g, g.events.splice(0), null); Rn.frame(g, 1 / 60); }
        tw.cd = 0; Rn.fx = []; Rn.parts = [];
        let t = 0;
        times.forEach((tt, col) => {
          while (t < tt) { tw.special = 99; g.step(1 / 60); Rn.consume(g, g.events.splice(0), null); Rn.frame(g, 1 / 60); t += 1 / 60; }
          sc.drawImage(cv, Math.min(720 - W, fx - W * 0.22) * kk, (fy - W * 0.58) * kk, W * kk, W * kk, col * CW, row * CW, CW, CW);
          sc.fillStyle = '#ff0'; sc.font = '9px monospace'; sc.fillText(type + ' ' + tier + ' t=' + tt, col * CW + 3, row * CW + 10);
        });
      });
      App.paused = true;
      out.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;width:' + CW * times.length + 'px';
      document.body.appendChild(out);
    };
    // 전후 시트(?scene=volley&v9=1&tier=N&at=T): 16종 4×4 · 같은 틀(기존 볼리와 같은 구성, 넓게)
    const sheet = function () {
      const App = window.App, g = App.game, Rn = App.renderer, G = window.GEOM, D9 = window.DATA, W = 320, CW = 400, tier = +(Q9.get('tier') || 4), at = +(Q9.get('at') || 0.2);
      while (g.cardPick) g.pickCard(0);
      const cv = document.getElementById('world'), kk = cv.width / 720, out = document.createElement('canvas'); out.width = out.height = CW * 4;
      const sc = out.getContext('2d'), [fx, fy] = G.tiles[15].tower;
      D9.ALL.forEach((type, n) => {
        for (const tl of g.tiles) tl.tower = null; g.monsters = []; g.shots = []; Rn.parts = []; Rn.fx = []; g.gold = 99999;
        g.build(15, type, tier);
        for (let q = 0; q < 6; q++) { const m = g.spawnMonster('normal', 14 + q * 0.45, (q % 3 - 1) * 0.7); m.hp = m.maxHp = 1e7; }
        for (let q = 0; q < 50; q++) { g.tiles[15].tower.cd = 5; g.step(1 / 60); Rn.consume(g, g.events.splice(0), null); Rn.frame(g, 1 / 60); }
        g.tiles[15].tower.cd = 0;
        let t = 0; while (t < at) { g.step(1 / 60); Rn.consume(g, g.events.splice(0), null); Rn.frame(g, 1 / 60); t += 1 / 60; }
        const X = (n % 4) * CW, Y = Math.floor(n / 4) * CW;
        sc.drawImage(cv, Math.min(720 - W, fx - W * 0.22) * kk, (fy - W * 0.58) * kk, W * kk, W * kk, X, Y, CW, CW);
        sc.fillStyle = '#ff0'; sc.font = '18px monospace'; sc.fillText(type + ' ' + tier, X + 6, Y + 20);
      });
      App.paused = true;
      out.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;width:720px';
      document.body.appendChild(out);
    };
    Object.defineProperty(window, 'QA_VOLLEY', { configurable: true, get: () => (Q9.get('v9') ? sheet : run), set: () => {} });
  }

  // 연쇄 번개(번개탑 맞은 뒤 · 지팡이): 넓은 반투명 보라 띠(안개처럼 보임) → 자두색 외곽선 + 보라 + 흰 심(또렷하게)
  R.chain = function (pts, small) {
    const segs = [];
    for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], sg = [[x0, y0]]; for (let j = 1; j < 4; j++) { const t = j / 4; sg.push([x0 + (x1 - x0) * t + rnd(-7, 7), y0 + (y1 - y0) * t + rnd(-7, 7)]); } sg.push([x1, y1]); segs.push(sg); }
    this.addFx(0.22, (c, p) => {
      c.save(); c.globalAlpha = 1 - p * p; c.lineJoin = 'miter'; c.lineCap = 'round';
      for (const [col, w] of [[PLUM, small ? 4 : 5], ['#a77bff', small ? 2.4 : 3], ['#ffffff', 1.1]]) { c.strokeStyle = col; c.lineWidth = w; for (const sg of segs) { c.beginPath(); sg.forEach((q, n) => n ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); } }
      c.restore();
    });
  };

  // 굴절 빔(프리즘 맞음): 맞은 자리에서 무지개 빔 여러 갈래가 뻗고, 5단계부터 중간에서 한 번 꺾임
  R.refract9 = function (x, y, n, len, kink) {
    const rays = []; for (let j = 0; j < n; j++) rays.push({ a: -Math.PI / 2 + (j - (n - 1) / 2) * (n > 1 ? 2.4 / (n - 1) : 0) + rnd(-0.15, 0.15), d: rnd(-0.6, 0.6), col: RAIN[j % 6], l: len * rnd(0.75, 1) });
    this.addFx(0.3, (c, p) => {
      const e = Math.min(1, p / 0.4);
      c.save(); c.globalAlpha = p > 0.6 ? (1 - p) / 0.4 : 1; c.lineCap = 'round'; c.lineJoin = 'miter';
      for (const o of rays) {
        const L1 = o.l * 0.5 * e, mx = x + Math.cos(o.a) * L1, my = y + Math.sin(o.a) * L1 * 0.7, a2 = o.a + (kink ? o.d : 0), L2 = o.l * 0.5 * Math.max(0, e * 2 - 1);
        for (const [cc, w] of [[PLUM, 4.5], [o.col, 2.5], ['#ffffff', 1]]) { c.strokeStyle = cc; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(mx, my); if (L2 > 0) c.lineTo(mx + Math.cos(a2) * L2, my + Math.sin(a2) * L2 * 0.7); c.stroke(); }
      }
      c.restore();
    });
    if (this.pxBurst9) this.pxBurst9(x, y, 8 + n * 2, ['#b07cff', '#ffffff', '#9adfff'], 0.22);
  };

  // ============================================================ [4차 · 3차 검수 지적 반영]
  // 레일건 1 < 3 < 4 < 6 굵기 · 모양 · 봉화 또렷한 불화살 → 불새 · 개틀링 3 · 6 굵게 · 화염 3 혜성 · 동전 납작하게 도는 3D + 포구 출발 · 채굴 곡괭이 진화 · 맹독/부식 구분
  const TSZ9 = [0, 0.7, 0.8, 0.9, 1, 1, 1.03];
  // [5차] 레일건: 네모 마디('구슬 목걸이') 삭제 → 끊기지 않는 한 줄 띠 빔(3px 계단 · 자두색 외곽 · 흰 심, 앞이 굵고 끝으로 가늘게)
  //   1 · 2 가는 빔 → 3 파란 단일 빔 → 4 두꺼운 심 + 옆에 흐르는 에너지 줄 → 5 활처럼 휨 → 6 금빛 심 + 출렁임 · 굵기 맥동 + 끝 갈라짐
  R.railBeam = function (pts, tier) {
    if (!pts || pts.length < 2) return;
    const P = 3, t = Math.max(1, Math.min(6, tier || 1)), W0 = [0, 3, 3, 6, 9, 9, 9][t], W1 = [0, 3, 3, 3, 3, 3, 3][t], dur = [0, 0.16, 0.18, 0.22, 0.26, 0.3, 0.38][t];
    const [ax, ay] = pts[0], [bx, by] = pts[1], L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
    const bow = t === 5 ? (Math.random() < 0.5 ? -1 : 1) * Math.min(46, L * 0.2) : t === 6 ? rnd(-1, 1) * 10 : rnd(-1, 1) * (t >= 3 ? 4 : 2);
    const at = (u, p) => { const b = Math.sin(u * Math.PI), w = bow * (1 + 0.12 * Math.sin(p * 20)) * b + (t >= 6 ? Math.sin(u * 9 - p * 34) * 7 * b : 0); return [ax + (bx - ax) * u + nx * w, ay + (by - ay) * u + ny * w]; };
    const snapW = v => Math.max(P, Math.round(v / P) * P), grid = v => Math.round(v / P) * P;
    this._railAt = at;   // [v4.8] render10이 빔을 따라 효과를 그린다
    const tail = t >= 4 ? pts.slice(1, 4) : [];
    const cols = t >= 6 ? ['#2a6fd8', '#9fe0ff', '#ffd23a', '#fff6c8'] : t >= 3 ? ['#2a6fd8', '#6ac0ff', '#ffffff'] : ['#2a6fd8', '#9fe0ff'];
    this.addFx(dur, (c, p) => {
      const reach = Math.min(1, p / 0.2), N = Math.max(2, Math.ceil(L * reach / P)), fade = p > 0.7 ? 1 - (p - 0.7) / 0.3 * 0.5 : 1;
      const wAt = u => (W0 + (W1 - W0) * u) * fade * (t >= 6 ? 1 + 0.22 * Math.sin(u * 10 - p * 38) : 1);
      const band = (col, drop, extra) => { c.fillStyle = col; c.beginPath(); for (let j = 0; j <= N; j++) { const u = j / N * reach, q = at(u, p), v = wAt(u) - drop; if (v < P && drop) continue; const w = snapW(v) + (extra || 0); c.rect(grid(q[0] - w / 2), grid(q[1] - w / 2), w, w); } c.fill(); };
      c.save(); c.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
      c.save(); c.globalAlpha *= 0.4; band(PLUM, 0, 3); c.restore(); band(cols[0], 0);
      for (let n = 1; n < cols.length; n++) band(cols[n], n * P);
      c.lineCap = 'butt';
      if (reach < 1) { const h = at(reach, p); this.star(c, h[0], h[1], 4, 9 + t, 2, p * 6, '#ffffff'); }   // [v4.8] 빔 머리 = 뾰족한 빛
      if (reach >= 1 && tail.length > 1) { c.lineCap = 'round'; for (const [col, lw] of [['#bfe6ff', 1.6]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); tail.forEach((q, n) => { if (!n) { c.moveTo(q[0], q[1]); return; } const pv = tail[n - 1]; c.lineTo((pv[0] + q[0]) / 2 + 4 * (n % 2 ? 1 : -1), (pv[1] + q[1]) / 2 - 4 * (n % 2 ? 1 : -1)); c.lineTo(q[0], q[1]); }); c.stroke(); } }
      c.restore();
    });
    this.shake = Math.max(this.shake, t >= 6 ? 3 : t >= 4 ? 2 : 0);
  };

  // 동전: 앞면이 잘 안 보일 만큼 납작해지는 시간을 늘리고(|cos|^1.5, 최대 88%) 옆면 두께를 뒤에 그림 — 도는 3D 동전
  R.coin9 = function (c, x, y, r, flip, tilt, alpha) {
    const im = this.I('i_coin'), f = Math.abs(flip), w = Math.max(0.14, Math.pow(f, 1.5) * 0.88), sd = flip >= 0 ? 1 : -1;
    c.save(); c.translate(x, y); if (tilt) c.rotate(tilt); if (alpha != null) c.globalAlpha *= alpha;
    if (r >= 5 && alpha == null) { c.fillStyle = PLUM; c.beginPath(); c.ellipse(sd * r * 0.1, 0, r * w + r * 0.14 + 2.5, r + 2.5, 0, 0, TAU); c.fill(); }   // [5차] 자두색 외곽(노란 나무 위에서 묻힘)
    if (r >= 5) { c.fillStyle = '#8a5a10'; c.beginPath(); c.ellipse(sd * r * 0.2 * (1 - f * 0.5), 0, r * w, r, 0, 0, TAU); c.fill(); }
    if (im) c.drawImage(im, -r * w, -r, r * 2 * w, r * 2); else { c.fillStyle = '#ffd23a'; c.beginPath(); c.ellipse(0, 0, r * w, r, 0, 0, TAU); c.fill(); }
    if (f < 0.3) { c.fillStyle = '#c8841a'; c.fillRect(-1.5, -r * 0.92, 3, r * 1.84); c.fillStyle = '#fff6c8'; c.fillRect(-0.5, -r * 0.8, 1, r * 0.6); }
    c.restore();
  };
  // 탐욕 3 · 4단계 포구(이미지 픽셀, 기준점에서). 4단계 그림은 왼쪽을 봐서 그릴 때 뒤집어 대상 쪽을 보게 함
  const TIP9 = { greed_3: [62, -145], greed_4: [73, -130] };
  function tipOf(type, tier, i, tx, ty) {
    const T = TIP9[type + '_' + tier], g = root.GEOM.tiles[i]; if (!T || !g) return null;
    const s = g.scale * 0.46 * TSZ9[tier], f = tx < g.tower[0] - 4 ? -1 : 1, up = ty != null && ty < g.tower[1] - 18;
    return [g.tower[0] + f * T[0] * (up ? 0.5 : 1) * s, g.tower[1] + T[1] * s];
  }
  R.tipFor9 = s => { if (s._tip9) return; s._tip9 = 1; if (s._o) return; const q = tipOf(s.type, s.tier, s.i, s.tx, s.ty); if (q) s._o = [q[0] - s.sx, q[1] - s.sy]; };
  const muzzle3 = R.muzzle;
  R.muzzle = function (e) {
    const q = e && tipOf(e.type, e.tier, e.i, e.tx, e.ty);
    this._mz9 = q || null;   // [v4.8] render10의 쏘는 빛 자리
    return muzzle3.call(this, q ? Object.assign({}, e, { x: q[0], y: q[1] }) : e);
  };
  const tower3 = R.drawTower;
  R.drawTower = function (c, game, i, opt) {
    const tw = game && game.tiles && game.tiles[i] && game.tiles[i].tower, an = this.towerAnim[i];
    if (tw && tw.type === 'greed' && tw.tier === 4 && an && an.aim != null) { const a0 = an.aim; an.aim = 2 * root.GEOM.tiles[i].tower[0] - a0; try { return tower3.call(this, c, game, i, opt); } finally { an.aim = a0; } }
    return tower3.call(this, c, game, i, opt);
  };

  // 곡괭이 진화: 3 곡괭이 → 4 금 날 → 5 보석 → 6 큰 금 곡괭이 + 도는 작은 곡괭이
  R.mining9 = function (c, s, F, t, many) {
    const T = this.time, id = s.id || 0, big = s.big ? 1.2 : 1, lift = q => Math.sin(q * Math.PI) * 30;
    if (s._o && s._d0 == null) s._d0 = Math.max(1, F.d);
    let [x, y] = ptAt(s, F, F.q, true); y -= lift(F.q);
    if (!many) for (let j = 1; j <= (t >= 5 ? 4 : 3); j++) { const q2 = Math.max(0, F.q - j * 0.06), p = ptAt(s, F, q2, true), py = p[1] - lift(q2) + j * j * 3, X = Math.round(p[0] / 3) * 3, Y = Math.round(py / 3) * 3, S = t >= 5 ? 7 : 5; c.fillStyle = PLUM; c.fillRect(X - S / 2 - 1.5, Y - S / 2 - 1.5, S + 3, S + 3); c.fillStyle = t >= 6 && j % 2 ? '#ffd23a' : j % 2 ? '#8a6a3a' : '#d9c299'; c.fillRect(X - S / 2, Y - S / 2, S, S); }
    const rot = T * 18 + id, k = [0, 1, 1, 1.4, 1.6, 1.8, 1.85][t] * big;
    if (t >= 6) this.pickaxe9(c, x, y, rot + Math.PI / 2, k, true);   // [6차] 5 → 6단계가 보석 색만 달랐음: 십자로 겹친 쌍곡괭이(한 덩어리로 도는 수리검)
    this.pickaxe9(c, x, y, rot, k, t >= 4);
    if (t >= 5) { const G = t >= 6 ? 9 : 6, g = G - 2; c.fillStyle = PLUM; c.fillRect(x - G, y - G, G * 2, G * 2); c.fillStyle = t >= 6 ? '#ff5a7a' : '#6ab0ff'; c.fillRect(x - g, y - g, g * 2, g * 2); c.fillStyle = '#ffffff'; c.fillRect(x - g + 1, y - g + 1, g * 0.7, g * 0.7); }
    if (t >= 6) this.star(c, x + 10, y - 12, 4, 9, 2, T * 6, '#fffbe0');   // [5차] 도는 작은 곡괭이 삭제(겹침)
  };
  // 봉화: 자두색 외곽 화살. [5차] 1 나무 화살 → 2 불씨 붙은 화살 → 3 깃이 큰 불꼬리 화살 → 4 불화살 → 5 불꽃 깃 → 6 불새(날개는 무늬 없는 불꽃 깃 — 나비로 읽힌다는 지적)
  R.arrow9 = function (c, x, y, ang, t, big, id) {
    const T = this.time, K = [0, 1, 1.05, 1.25, 1.45, 1.55, 1.4][t] * (big ? 1.25 : 1), ux = Math.cos(ang), uy = Math.sin(ang);
    if (t >= 3) this.tongue9(c, x - ux * 12 * K, y - uy * 12 * K, ang, [0, 0, 0, 0.8, 0.7, 0.8, 1.1][t], PALF);
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(K, K); c.lineCap = 'round'; c.lineJoin = 'round';
    if (t >= 5) {
      const fl = Math.sin(T * 26 + id), NF = t >= 6 ? 3 : 2, sz = t >= 6 ? 1.15 : 1;
      const feather = (sd, j, f) => { c.beginPath(); c.moveTo(4 * f, 0); c.quadraticCurveTo(-3 * f, sd * (6 + j * 4) * f * sz, (-14 - j * 6) * f * sz, sd * (7 + j * 5 + fl * (1.5 + j)) * f * sz); c.quadraticCurveTo((-8 - j * 2) * f, sd * (2 + j) * f, 4 * f, 0); c.closePath(); };
      c.strokeStyle = PLUM; c.lineWidth = 3; for (const sd of [-1, 1]) for (let j = 0; j < NF; j++) { feather(sd, j, 1); c.stroke(); }   // 외곽을 먼저 다 그린 뒤 위를 칠해 날개 안쪽에 검은 무늬가 생기지 않게
      for (const [cc, f] of [['#e8452c', 1], ['#ff9a1c', 0.72], ['#ffe36a', 0.45]]) { c.fillStyle = cc; for (const sd of [-1, 1]) for (let j = 0; j < NF; j++) { feather(sd, j, f); c.fill(); } }
    }
    c.strokeStyle = PLUM; c.lineWidth = 5; c.beginPath(); c.moveTo(-15, 0); c.lineTo(9, 0); c.stroke();
    c.strokeStyle = t >= 4 ? '#ff9a1c' : '#a8703a'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-15, 0); c.lineTo(9, 0); c.stroke();
    c.fillStyle = PLUM; c.beginPath(); c.moveTo(17, 0); c.lineTo(6, -7); c.lineTo(6, 7); c.closePath(); c.fill();
    c.fillStyle = t >= 4 ? '#ffe36a' : t >= 2 ? '#ffb347' : '#e8e0d0'; c.beginPath(); c.moveTo(14, 0); c.lineTo(8, -4.5); c.lineTo(8, 4.5); c.closePath(); c.fill();
    if (t >= 6) { c.fillStyle = PLUM; c.beginPath(); c.arc(4, 0, 6.5, 0, TAU); c.fill(); c.fillStyle = '#ff6a1c'; c.beginPath(); c.arc(4, 0, 4.5, 0, TAU); c.fill(); c.fillStyle = '#fff2a0'; c.fillRect(4, -2, 3, 3); }
    if (t === 3) { c.fillStyle = PLUM; c.beginPath(); c.moveTo(-9, 0); c.lineTo(-22, -10); c.lineTo(-19, 0); c.lineTo(-22, 10); c.closePath(); c.fill(); c.fillStyle = '#ff6a1c'; c.beginPath(); c.moveTo(-11, 0); c.lineTo(-20, -7); c.lineTo(-17.5, 0); c.lineTo(-20, 7); c.closePath(); c.fill(); }   // 큰 깃
    else if (t <= 4) { c.fillStyle = PLUM; c.fillRect(-18, -5, 7, 10); c.fillStyle = t >= 4 ? '#ffd23a' : '#ffffff'; c.fillRect(-17, -3.5, 5, 7); }
    c.restore();
    if (t === 2) { const X = x - ux * 6 * K, Y = y - uy * 6 * K, r = 3.5 + Math.sin(T * 24 + id); this.circle(c, X, Y, r + 2.5, PLUM); this.circle(c, X, Y, r, '#ff9a1c'); this.circle(c, X, Y, 1.5, '#fff2a0'); if (!this.busy() && Math.random() < 0.35) this.part({ x: X, y: Y, vx: -ux * 40 + rnd(-15, 15), vy: -uy * 40 - rnd(10, 40), life: 0.25, size: 3, col: PALF[(Math.random() * 3) | 0], kind: 'fire' }); }   // 불씨
  };
  const own3 = R.own9;
  R.own9 = function (c, s, F, t, many) {
    const k = s.kind, T = this.time, id = s.id || 0;
    if ((k === 'ore' || k === 'ingot') && t >= 3) { this.mining9(c, s, F, t, many); return true; }
    if (k === 'arrow') {
      if (s._o && s._d0 == null) s._d0 = Math.max(1, F.d);
      const tg = tangentAt(s, F, F.q), [x, y] = ptAt(s, F, F.q, true); if (!many) dots9(c, s, F, t);
      this.arrow9(c, x, y, Math.atan2(tg[1], tg[0]), t, !!s.big, id);
      return true;
    }
    if (k === 'bullet' && t >= 3) {   // [5차] 개틀링: 3 뾰족한 예광탄 → 4 작은 탄두 + 긴 불꼬리 → 5 붉은 탄 + 짧은 불꼬리(두 줄 교차) → 6 금빛 탄 + 감기는 나선(두 줄 교차)
      if (s._o && s._d0 == null) s._d0 = Math.max(1, F.d);
      const tg0 = tangentAt(s, F, F.q), dx = tg0[0] * 0.35 + F.ux * 0.65, dy = tg0[1] * 0.35 + F.uy * 0.65, dl = Math.hypot(dx, dy) || 1, tg = [dx / dl, dy / dl], [x, y] = ptAt(s, F, F.q, true), ang = Math.atan2(tg[1], tg[0]);   // 머리 방향은 표적 쪽 위주(오발처럼 보이지 않게)
      const needle = (L, W, cols) => { c.save(); c.translate(x, y); c.rotate(ang); cols.forEach(([col, m, f], n) => { c.fillStyle = col; c.beginPath(); c.moveTo(W * f + (n ? 0 : 3), 0); c.lineTo(0, -W * m / 2 - (n ? 0 : 2)); c.lineTo(-L * f - (n ? 0 : 4), 0); c.lineTo(0, W * m / 2 + (n ? 0 : 2)); c.closePath(); c.fill(); }); c.restore(); };
      const grow = Math.min(1, Math.max(0.15, F.d0 * F.q / 45));   // 포탑 뒤로 꼬리가 삐져나오지 않게: 날아간 만큼만 꼬리가 자람
      if (t === 3) needle(34 * grow, 8, [[PLUM, 1, 1], ['#ffc23a', 1, 1], ['#fffbe0', 0.45, 0.7]]);
      else if (t === 4) { this.tongue9(c, x - tg[0] * 3, y - tg[1] * 3, ang, 1.35 * grow, PALF); pxOrb(this, c, x, y, 4, ['#c8841a', '#ffe36a', '#ffffff']); if (!many && !this.busy() && Math.random() < 0.3) this.part({ x: x - tg[0] * 30, y: y - tg[1] * 30, vx: -tg[0] * 50 + rnd(-20, 20), vy: -tg[1] * 50 - rnd(10, 40), life: 0.25, size: 3, col: PALF[(Math.random() * 3) | 0], kind: 'fire' }); }
      else if (t === 5) { this.tongue9(c, x - tg[0] * 8 * grow, y - tg[1] * 8 * grow, ang, 0.6 * grow, PALF); needle(24 * grow, 10, [[PLUM, 1, 1], ['#e8452c', 1, 1], ['#ffe36a', 0.5, 0.65]]); }
      else {
        if (!many) for (const [sd, cc] of [[1, '#7fd8ff'], [-1, '#ffe36a']]) { for (const [co, lw] of [[PLUM, 4.5], [cc, 2.4]]) { c.save(); c.strokeStyle = co; c.lineWidth = lw; c.lineCap = 'round'; c.beginPath(); for (let j = 0; j <= 9; j++) { const u = j * 5.5 * grow, o = sd * Math.sin(j * 0.95 - T * 34 + id) * (2 + j * 0.8); const X = x - tg[0] * u - tg[1] * o, Y = y - tg[1] * u + tg[0] * o; j ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); c.restore(); } }
        needle(26 * grow, 11, [[PLUM, 1, 1], ['#ffd23a', 1, 1], ['#ffffff', 0.45, 0.65]]);
      }
      return true;
    }
    if (k === 'fireball' && t === 3) {   // 화염 3: 한 줄로 이어진 혜성 — 첫 발 = 큰 머리, 뒤 두 발 = 머리를 쫓는 불덩이 꼬리
      if (s._o && s._d0 == null) s._d0 = Math.max(1, F.d);
      const tg = tangentAt(s, F, F.q), [x, y] = ptAt(s, F, F.q, true), ang = Math.atan2(tg[1], tg[0]), lead = !s.fk;
      this.tongue9(c, x, y, ang, lead ? 2 : 1, PALF);
      pxOrb(this, c, x, y, lead ? 14 : 7, ['#e8452c', '#ffb347', '#fff2a0']);
      if (lead) for (let j = 0; j < 3; j++) { const a = T * 12 + id + j * TAU / 3; this.circle(c, x + Math.cos(a) * 20, y + Math.sin(a) * 10, 3, '#ffe36a'); }
      return true;
    }
    if ((k === 'toxic' || k === 'acidglob') && t >= 4) {
      if (s._o && s._d0 == null) s._d0 = Math.max(1, F.d);
      const [x, y] = ptAt(s, F, F.q, true), r = 7 + t * 1.1 + (s.big ? 3 : 0);
      if (k === 'toxic') {   // 맹독: 동그란 독 폭탄 — 짙은 초록 몸 + 보라 띠 + 위로 오르는 보라 · 초록 거품
        if (!many) for (let j = 1; j <= 3; j++) { const p = ptAt(s, F, Math.max(0, F.q - j * 0.05), true); pxOrb(this, c, p[0], p[1] - j * 3, 4.5 - j, j % 2 ? ['#8a4ad0', '#c8a0ff', '#ffffff'] : ['#3a9a2a', '#7be06a', '#ffffff']); }
        pxOrb(this, c, x, y, r, ['#1f7a2a', '#4ec24a', '#d8ffd0']);
        c.fillStyle = PLUM; c.fillRect(x - r - 1, y - 2.5, r * 2 + 2, 5); c.fillStyle = '#8a4ad0'; c.fillRect(x - r, y - 1.5, r * 2, 3);
        c.fillStyle = PLUM; c.fillRect(x - 3, y - r - 7, 6, 7); c.fillStyle = '#c8a0ff'; c.fillRect(x - 1.5, y - r - 6, 3, 5);   // 마개
      } else {               // 부식: 노란 산성 찌꺼기 — 일그러진 세 덩이 + 아래로 늘어지는 방울
        const wob = j => Math.sin(T * 18 + id + j * 2) * 2.5, cols = ['#8a9a10', '#d8e830', '#fbffc0'], parts = [[-r * 0.45, 1, 0.72], [r * 0.5, -1.5, 0.62], [0, 2, 0.85]];
        for (const [dx, dy, f] of parts) this.circle(c, x + dx + wob(dx), y + dy, r * f + 3, PLUM);
        for (const [dx, dy, f] of parts) this.circle(c, x + dx + wob(dx), y + dy, r * f, cols[0]);
        for (const [dx, dy, f] of parts) this.circle(c, x + dx + wob(dx) - 1, y + dy - 1.5, r * f * 0.66, cols[1]);
        this.circle(c, x - r * 0.3, y - r * 0.35, 2.5, cols[2]);
        for (let j = 0; j < 3; j++) { const dx = (j - 1) * r * 0.55, ln = 6 + 5 * Math.abs(Math.sin(T * 9 + j + id)); c.fillStyle = PLUM; c.fillRect(x + dx - 3, y + r * 0.5, 6, ln + 3); c.fillStyle = '#d8e830'; c.fillRect(x + dx - 1.5, y + r * 0.5, 3, ln); }
        if (!many && !this.busy() && Math.random() < 0.5) this.part({ x, y: y + r, vy: 90, life: 0.35, size: 3, col: '#d8e830', kind: 'dot', grav: 340 });
      }
      return true;
    }
    return own3.call(this, c, s, F, t, many);
  };
  // 맞는 순간(4차): 화염 3 파편 · 봉화 · 맹독/부식 구분
  const impact4 = R.impact;
  R.impact = function (e) {
    const t = e.tier || 1, x = e.x, y = e.y, k = e.kind, last = (e.fn || 0) >= 2 && e.fk === e.fn - 1;
    impact4.call(this, e);
    if (k === 'fireball' && t === 3 && last) {
      const fr = shards(8, 190, 170), gy = y + 20;
      this.addFx(0.5, (c, p) => { const tt = p * 0.5; for (const o of fr) { const px = x + o.vx * tt, py = Math.min(gy, y + o.vy * tt + 500 * tt * tt), r = 5 * o.r * (1 - p * 0.5); this.circle(c, px, py, r + 2.5, PLUM); this.circle(c, px, py, r, p < 0.5 ? '#ffb347' : '#e8452c'); } });
    }
    if (k === 'arrow' && t === 3) this.shock9(x, y, '#ff9a1c', 30, 0.26, 4);
    if (k === 'toxic' && !this.busy()) for (let j = 0; j < 4; j++) this.part({ x, y, vx: rnd(-50, 50), vy: rnd(-120, -60), life: 0.5, size: 4, col: j % 2 ? '#c8a0ff' : '#7be06a', kind: 'dot', drag: 1 });
    if (k === 'acidglob' && !this.busy()) for (let j = 0; j < 5; j++) this.part({ x: x + rnd(-16, 16), y, vx: rnd(-20, 20), vy: rnd(30, 90), life: 0.45, size: 3, col: '#d8e830', kind: 'dot', grav: 420 });
  };
})(window);
