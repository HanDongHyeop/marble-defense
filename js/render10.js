// v4.8 층(Renderer에 덧붙임) — 탄 그리기 전면 교체(16종 × 6단계)
// 사용자: '탄이 그림 하나가 몬스터한테 이동하는 느낌(코인처럼)' · '1~6성이 단순히 크기만 커진다 — 탄이 커지면 안 된다, 최대 3~4성 크기' ·
//         '탄 자체에 파티클 · 아우라 이펙트가 있어야 하고, 단계가 오르면 이펙트가 화려해져야 한다' · '모든 탑을 공통으로 하지 말고 탑별로'
// · 크기: 탄 몸통은 SZ(1단계 1.1 → 3단계부터 1.25 고정 = 예전 3단계 크기). 큰 한 방(주기 공격)도 1.4까지만. 단계 차이는 몸통 밖 효과로만 낸다
// · 그림 금지: 외곽선 스티커 대신 매 프레임 모양이 바뀌는 몸통(일렁이는 불꽃 · 튀는 전기 · 출렁이는 액체 · 빛나는 결정)
// · 공통 재료: aura(캐시한 방사 그라데이션) · wake(휜 길을 따라 가늘어지는 꼬리) · sparks(지나온 길에 흩어지는 상태 없는 파티클) · shed(뒤에 남아 퍼지는 고리) · helix(길을 감는 줄기)
// · 재료를 쓰는 방법은 탑마다 다르다(TOWER 표). 단계마다 새 효과가 하나씩 더해지고, 6단계는 그 탑만의 대표 효과
// · 밸런스 무관: 판정 · 피해 · 시간은 behave.js 그대로. 그리는 자리는 render9의 휜 길(ptAt)
// · 그리기 원칙: 상태 없음(위치 · 시간 · id만), 오프스크린 캔버스 없음, 'lighter' 없음(아이폰 · 밝은 배경), 그라데이션 객체만 캐시
(function (root) {
  if (/[?&]nov48=1/.test(location.search)) return;   // 비교 캡처용: 이 층 끄기
  const R = root.Renderer.prototype, P9 = R._path9;
  if (!P9) return;
  const { frameOf, ptAt, tangentAt } = P9;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SZ = [0, 1.1, 1.18, 1.25, 1.25, 1.25, 1.25];   // 탄 몸통 크기: 3단계에서 멈춘다
  const hash = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
  const RAIN = ['#ff6a6a', '#ffb347', '#ffe36a', '#7be06a', '#6ab0ff', '#b07cff'];

  // ------------------------------------------------------------ 색 · 아우라
  const RGB = new Map();
  const rgb = h => { let v = RGB.get(h); if (!v) { const n = parseInt(h.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; RGB.set(h, v); } return v; };
  const rgba = (h, a) => { const v = rgb(h); return `rgba(${v[0]},${v[1]},${v[2]},${a})`; };
  const GRAD = new Map();
  // 원점 · 반지름 1의 방사 그라데이션을 색마다 하나만 만들어 옮겨 쓴다(캔버스 캐시 아님)
  function aura(c, x, y, r, col, a, sy) {
    let g = GRAD.get(col);
    if (!g) { g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, rgba(col, 0.85)); g.addColorStop(0.42, rgba(col, 0.42)); g.addColorStop(1, rgba(col, 0)); GRAD.set(col, g); }
    c.save(); c.globalAlpha *= a; c.translate(x, y); c.scale(r, r * (sy || 1)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
  }
  // 지나온 길을 따라 가늘어지는 꼬리(wob = 옆으로 일렁임)
  function wake(c, E, px, w, col, a, wob) {
    const { s, F, T } = E, lenq = Math.min(F.q, px / F.d0); if (lenq < 0.005) return;
    const N = 7, L = [], Rr = [], q1 = F.q;
    for (let j = 0; j <= N; j++) {
      const u = j / N, q2 = q1 - lenq * (1 - u), p = ptAt(s, F, q2, true), tg = tangentAt(s, F, q2), nx = -tg[1], ny = tg[0];
      const hw = w * 0.5 * Math.pow(u, 0.8), wb = wob ? Math.sin(T * 24 + u * 7 + E.id) * wob * (1 - u) : 0;
      L.push([p[0] + nx * (hw + wb), p[1] + ny * (hw + wb)]); Rr.push([p[0] - nx * (hw - wb), p[1] - ny * (hw - wb)]);
    }
    c.globalAlpha = a; c.fillStyle = col; c.beginPath(); L.forEach((p, j) => (j ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); for (let j = N; j >= 0; j--) c.lineTo(Rr[j][0], Rr[j][1]); c.closePath(); c.fill(); c.globalAlpha = 1;
  }
  // 지나온 길에 흩어지는 파티클(상태 없음: 시간 · id로 자리를 계산). grav = 아래로, spread = 옆으로, up = 위로
  function sparks(c, E, n, px, spread, cols, size, o) {
    const { s, F, T, id } = E; o = o || {}; const rate = o.rate || 2.4, grav = o.grav || 0, up = o.up || 0;
    for (let j = 0; j < n; j++) {
      const h = hash(id, j), ph = (T * rate * (0.75 + h * 0.5) + h * 7) % 1, q2 = F.q - ph * Math.min(F.q, px / F.d0);
      if (q2 < 0) continue;
      const p = ptAt(s, F, q2, true), tg = tangentAt(s, F, q2), sd = (hash(j, id) - 0.5) * 2;
      const X = p[0] - tg[1] * sd * spread * ph, Y = p[1] + tg[0] * sd * spread * ph + grav * ph * ph - up * ph, S = Math.max(1.5, size * (1 - ph * 0.7));
      c.globalAlpha = (1 - ph) * (o.a || 1); c.fillStyle = cols[j % cols.length];
      if (o.round) { c.beginPath(); c.arc(X, Y, S * 0.55, 0, TAU); c.fill(); }
      else if (o.dia) { c.beginPath(); c.moveTo(X, Y - S); c.lineTo(X + S * 0.7, Y); c.lineTo(X, Y + S); c.lineTo(X - S * 0.7, Y); c.closePath(); c.fill(); }
      else c.fillRect(Math.round(X) - S / 2, Math.round(Y) - S / 2, S, S);
    }
    c.globalAlpha = 1;
  }
  // 지나온 자리에 남아 퍼지는 고리
  function shed(c, E, n, px, r0, r1, col, w, a) {
    const { s, F, T, id } = E;
    c.lineWidth = w; c.strokeStyle = col;
    for (let j = 0; j < n; j++) {
      const ph = (T * 2.6 + j / n + id * 0.37) % 1, q2 = F.q - ph * Math.min(F.q, px / F.d0); if (q2 < 0) continue;
      const p = ptAt(s, F, q2, true), r = r0 + (r1 - r0) * ph;
      c.globalAlpha = (1 - ph) * a; c.beginPath(); c.ellipse(p[0], p[1], r, r * 0.62, 0, 0, TAU); c.stroke();
    }
    c.globalAlpha = 1;
  }
  // 길을 감으며 도는 줄기(turns = 감는 횟수)
  function helix(c, E, px, amp, turns, ph0, col, w, a) {
    const { s, F, T } = E, lenq = Math.min(F.q, px / F.d0); if (lenq < 0.01) return;
    const N = 12; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = col; c.lineWidth = w; c.globalAlpha = a; c.beginPath();
    for (let j = 0; j <= N; j++) {
      const u = j / N, q2 = F.q - lenq * (1 - u), p = ptAt(s, F, q2, true), tg = tangentAt(s, F, q2), o = Math.sin(u * turns * TAU - T * 16 + ph0) * amp * (0.25 + u * 0.75);
      const X = p[0] - tg[1] * o, Y = p[1] + tg[0] * o; j ? c.lineTo(X, Y) : c.moveTo(X, Y);
    }
    c.stroke(); c.globalAlpha = 1;
  }
  // 몸통 둘레를 도는 것
  function orbit(E, n, r, spd, draw, flat) { for (let j = 0; j < n; j++) { const a = E.T * spd + E.id + j * TAU / n; draw(E.x + Math.cos(a) * r, E.y + Math.sin(a) * r * (flat || 0.62), a, j); } }
  // 뾰족한 반짝
  function glint(c, x, y, r, rot, col, a) {
    c.save(); c.globalAlpha = a == null ? 1 : a; c.translate(x, y); c.rotate(rot || 0); c.fillStyle = col; c.beginPath();
    for (let k = 0; k < 8; k++) { const d = k % 2 ? r * 0.16 : r, an = k * Math.PI / 4; c.lineTo(Math.cos(an) * d, Math.sin(an) * d); }
    c.closePath(); c.fill(); c.restore();
  }
  // 튀는 전기: 중심에서 뻗는 꺾인 선(매 프레임 새 모양)
  function arcs(c, x, y, n, r, col, w) {
    c.lineJoin = 'miter'; c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = w;
    for (let j = 0; j < n; j++) {
      let a = Math.random() * TAU, X = x, Y = y; const m = 3, step = r / m;
      c.beginPath(); c.moveTo(X, Y);
      for (let k = 0; k < m; k++) { a += (Math.random() - 0.5) * 1.5; X += Math.cos(a) * step; Y += Math.sin(a) * step * 0.8; c.lineTo(X, Y); }
      c.stroke();
    }
  }
  // 일렁이는 불꽃 한 덩어리(국소 좌표: 머리 +x, 꼬리 −x). 층마다 모양이 다르게 흔들려 그림처럼 보이지 않는다
  function flame(c, L, W, T, seed, cols) {
    cols.forEach((col, k) => {
      const f = 1 - k * (0.68 / cols.length), N = 7, sp = 24 + k * 6, ll = L * f, ww = W * f;
      c.fillStyle = col; c.beginPath(); c.moveTo(ww * 0.95, 0);
      for (let j = 1; j <= N; j++) { const u = j / N, env = Math.sin(Math.min(1, u * 1.35 + 0.18) * Math.PI) * (1 - u * 0.25); c.lineTo(ww * 0.95 - u * (ll + ww * 0.95), -ww * env * (1 + 0.22 * Math.sin(T * sp + u * 8 + seed + k)) + Math.sin(T * sp * 0.8 + u * 6 + seed) * u * ww * 0.5); }
      for (let j = N - 1; j >= 1; j--) { const u = j / N, env = Math.sin(Math.min(1, u * 1.35 + 0.18) * Math.PI) * (1 - u * 0.25); c.lineTo(ww * 0.95 - u * (ll + ww * 0.95), ww * env * (1 + 0.22 * Math.sin(T * sp + u * 8 + seed + k + 2)) + Math.sin(T * sp * 0.8 + u * 6 + seed) * u * ww * 0.5); }
      c.closePath(); c.fill();
    });
  }
  // 국소 좌표에서 그리기(진행 방향 = +x). 출발 때 찌그러졌다가 날면서 늘어난다
  function local(c, E, draw, stretch) {
    const q = E.q, st = stretch == null ? 0.12 : stretch; let a = 1 + st, b = 1 / (1 + st * 0.6);
    if (q < 0.1) { const e = q / 0.1; a = 0.72 + (1 + st - 0.72) * e; b = 1.2 + (1 / (1 + st * 0.6) - 1.2) * e; }
    c.save(); c.translate(E.x, E.y); c.rotate(E.ang); c.scale(a * E.S, b * E.S); draw(); c.restore();
  }

  // ------------------------------------------------------------ 탑별 탄
  const FIRE = ['#d8341c', '#ff8a1c', '#ffd23a', '#fff6c8'], BLUE = ['#2a6fd8', '#58b8ff', '#c8f0ff', '#ffffff'];
  const TOWER = {
    // 화염: 불꽃 → 꼬리 → 떨어지는 불티 → 감기는 불줄기 → 뒤에 남는 열기 고리 · 불길 날개 → 푸른 심지 + 불폭풍
    fire(c, E) {
      const { t, T, id, lo } = E, cols = t >= 6 ? ['#d8341c', '#ff8a1c', '#ffe36a', '#c8f0ff', '#ffffff'] : FIRE;
      aura(c, E.x, E.y, (t >= 4 ? 24 : 16 + t * 2) * E.S, t >= 6 ? '#ff7a2c' : '#ff9a1c', 0.5 + (t >= 4 ? 0.12 : 0));
      if (!lo) {
        wake(c, E, 26 + t * 6, 11, '#ff7a1c', 0.55, 2.5);
        sparks(c, E, 4 + t * 2, 40 + t * 8, 10, ['#ffd23a', '#ff8a1c', '#fff6c8'], 4.5, { grav: 22 });
        if (t >= 4) { helix(c, E, 46, 8, 1.6, 0, '#ffb31c', 2.6, 0.85); if (t >= 6) helix(c, E, 46, 8, 1.6, Math.PI, '#ffe36a', 2.2, 0.85); }
        if (t >= 5) shed(c, E, 2, 44, 5, 18, '#ffb347', 2.4, 0.7);
      }
      local(c, E, () => {
        flame(c, 22 + Math.min(t, 3) * 3, 8, T, id, cols);
        if (t === 5) { c.save(); for (const sd of [-1, 1]) { c.save(); c.translate(-3, sd * 7); c.rotate(sd * (0.55 + 0.2 * Math.sin(T * 22 + id))); flame(c, 13, 3.6, T, id + sd * 3, ['#ff8a1c', '#ffe36a']); c.restore(); } c.restore(); }
      });
      if (t >= 6 && !lo) { sparks(c, E, 8, 24, 20, ['#fff6c8', '#ffe36a'], 3.5, { up: 26, rate: 3.4 }); glint(c, E.x, E.y, 15 + 3 * Math.sin(T * 26 + id), T * 3, '#ffffff', 0.9); }
    },
    // 개틀링: 한 번에 많이 나가므로 가볍게. 놋쇠 탄 → 긴 예광 → 뜨거운 빛 머리 → 불티 → 두 색 교차 → 푸른 플라스마 + 이온 줄기
    gatling(c, E) {
      const { t, T, id, lo, s } = E, k = s.fk || 0, plasma = t >= 6, alt = t === 5 && k % 2;
      const head = plasma ? '#c8f0ff' : alt ? '#ff8a4a' : t >= 3 ? '#fff0a8' : '#ffe0a0', tail = plasma ? '#58b8ff' : alt ? '#e8452c' : t >= 3 ? '#ff9a1c' : '#c89a3c';
      if (t >= 3) aura(c, E.x, E.y, (t >= 5 ? 13 : 10) * E.S, tail, 0.55);
      wake(c, E, lo ? 14 : 12 + Math.min(t, 4) * 4, 4.5 * E.S, tail, 0.9);
      if (!lo) {
        wake(c, E, 8 + Math.min(t, 4) * 2, 2.2 * E.S, head, 1);
        if (t >= 4) sparks(c, E, t >= 6 ? 5 : 3, 26, 7, plasma ? ['#c8f0ff', '#58b8ff'] : ['#ffd23a', '#ff8a1c'], 3, { rate: 3.2 });
        if (plasma) helix(c, E, 28, 4, 1.8, k, '#9fe0ff', 1.5, 0.9);
      }
      c.fillStyle = head; c.beginPath(); c.arc(E.x, E.y, (t >= 3 ? 3.2 : 2.6) * E.S, 0, TAU); c.fill();
      if (plasma && !lo && k % 3 === 0) glint(c, E.x, E.y, 9 + 2 * Math.sin(T * 30 + id), T * 5, '#ffffff', 0.9);
    },
    // 번개: 전기 구슬 → 튀는 전기가 늘어남 → 꺾인 잔번개 꼬리 → 둘레를 도는 전기 점 → 번개 기둥이 사방으로
    bolt(c, E) {
      const { t, T, x, y, lo, S } = E;
      aura(c, x, y, (15 + Math.min(t, 4) * 2) * S, '#8a5aff', 0.6);
      if (!lo) {
        sparks(c, E, 2 + t, 30, 12, ['#d8c8ff', '#ffffff'], 3, { rate: 3.4 });
        wake(c, E, 22 + t * 4, 6, '#a77bff', 0.5, 3);
        if (t >= 4) {   // 지나온 길의 꺾인 번개
          const { s, F } = E, q0 = Math.max(0, F.q - Math.min(F.q, (24 + t * 7) / F.d0)), N = 5;
          for (const [col, w] of [['#7a4aff', 3.2], ['#ffffff', 1.3]]) { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'miter'; c.beginPath(); for (let j = 0; j <= N; j++) { const p = ptAt(s, F, q0 + (F.q - q0) * j / N, true), jt = j && j < N ? 6 : 0; j ? c.lineTo(p[0] + (Math.random() - 0.5) * jt * 2, p[1] + (Math.random() - 0.5) * jt * 2) : c.moveTo(p[0], p[1]); } c.stroke(); }
        }
      }
      arcs(c, x, y, lo ? 2 : 1 + Math.min(t, 5), (10 + Math.min(t, 4)) * S, '#c8b0ff', 2);
      if (t >= 3 && !lo) arcs(c, x, y, t - 1, 9 * S, '#ffffff', 1);
      c.fillStyle = '#7a4aff'; c.beginPath(); c.arc(x, y, 6.5 * S, 0, TAU); c.fill();
      c.fillStyle = '#e8dcff'; c.beginPath(); c.arc(x, y, (4.4 + 0.8 * Math.sin(T * 40)) * S, 0, TAU); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 2.4 * S, 0, TAU); c.fill();
      if (t >= 5 && !lo) orbit(E, t >= 6 ? 4 : 3, 13, 11, (px, py) => { c.strokeStyle = '#e8dcff'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo((x + px) / 2 + (Math.random() - 0.5) * 7, (y + py) / 2 + (Math.random() - 0.5) * 7); c.lineTo(px, py); c.stroke(); glint(c, px, py, 4, 0, '#ffffff'); });
      if (t >= 6 && !lo) { arcs(c, x, y, 3, 26, '#a77bff', 2.2); shed(c, E, 2, 34, 6, 20, '#c8b0ff', 2, 0.8); }
    },
    // 빙결: 빛나는 얼음 조각 → 서리 꼬리 → 떨어지는 결정 → 함께 도는 얼음 조각 → 눈꽃 고리 → 눈보라 + 육각 서리
    ice(c, E) {
      const { t, T, x, y, id, lo, S } = E;
      aura(c, x, y, (15 + Math.min(t, 4) * 2) * S, '#7fd0ff', 0.55);
      if (!lo) {
        wake(c, E, 22 + t * 5, 8, '#bfe6ff', 0.55);
        sparks(c, E, 3 + t * 2, 34 + t * 6, 11, ['#ffffff', '#c8f0ff', '#7fd0ff'], 4.5, { grav: 14, dia: 1, rate: 1.9 });
        if (t >= 5) shed(c, E, 2, 36, 5, 16, '#e6f8ff', 1.8, 0.8);
      }
      const glow = (T * 1.8 + id * 0.4) % 1;   // 얼음 몸통을 따라 지나가는 빛
      local(c, E, () => {
        c.fillStyle = '#2f86d8'; c.beginPath(); c.moveTo(11, 0); c.lineTo(1, -4.8); c.lineTo(-11, -1.6); c.lineTo(-13, 0); c.lineTo(-11, 1.6); c.lineTo(1, 4.8); c.closePath(); c.fill();
        c.fillStyle = '#9fe0ff'; c.beginPath(); c.moveTo(10, 0); c.lineTo(1, -3.6); c.lineTo(-10, -0.8); c.lineTo(-10, 0.4); c.lineTo(1, 0.6); c.closePath(); c.fill();
        c.fillStyle = '#ffffff'; const gx = 10 - glow * 20; c.beginPath(); c.moveTo(gx + 3, 0); c.lineTo(gx, -2.6); c.lineTo(gx - 3, 0); c.lineTo(gx, 1.4); c.closePath(); c.fill();
      }, 0.1);
      if (!lo) {
        if (t >= 4) orbit(E, t >= 6 ? 3 : 2, 12, 9, (px, py, a) => { c.save(); c.translate(px, py); c.rotate(a); c.fillStyle = '#e6f8ff'; c.beginPath(); c.moveTo(4.5, 0); c.lineTo(0, -1.8); c.lineTo(-4.5, 0); c.lineTo(0, 1.8); c.closePath(); c.fill(); c.restore(); });
        if (t >= 5) { c.save(); c.translate(x, y); c.rotate(-T * 3.5 + id); c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.globalAlpha = 0.9; const r = t >= 6 ? 16 : 13; for (let j = 0; j < 6; j++) { c.rotate(TAU / 6); c.beginPath(); c.moveTo(r * 0.45, 0); c.lineTo(r, 0); c.moveTo(r * 0.72, 0); c.lineTo(r * 0.92, -3); c.moveTo(r * 0.72, 0); c.lineTo(r * 0.92, 3); c.stroke(); } c.restore(); }
        if (t >= 6) sparks(c, E, 10, 42, 22, ['#ffffff', '#e6f8ff'], 3, { rate: 3, up: 8, dia: 1 });
      }
    },
    // 맹독: 출렁이는 독방울 → 떨어지는 방울 → 뽀글 거품 → 독 연기 → 보라 소용돌이 → 검은 심지 + 독 안개
    poison(c, E) {
      const { t, T, x, y, id, lo, S } = E;
      aura(c, x, y, (17 + Math.min(t, 4) * 2) * S, t >= 5 ? '#8a4ad8' : '#34c02a', 0.68);
      if (!lo) {
        if (t >= 4) for (let j = 0; j < 4; j++) { const ph = (T * 1.5 + j / 4 + id * 0.3) % 1, q2 = E.F.q - ph * Math.min(E.F.q, 46 / E.F.d0); if (q2 < 0) continue; const p = ptAt(E.s, E.F, q2, true); aura(c, p[0] + Math.sin(j * 2 + T * 3) * 5, p[1] - ph * 8, 7 + ph * 11, j % 2 && t >= 5 ? '#8a4ad8' : '#5ad03a', (1 - ph) * 0.6); }
        wake(c, E, 22 + t * 4, t >= 5 ? 11 : 8, t >= 5 ? '#6a3ab8' : '#1f6a18', 0.72, 2.4); if (t >= 5) wake(c, E, 22 + t * 2, 5, '#c8a0ff', 0.85, 1.6);
        sparks(c, E, 2 + t, 30, 8, ['#b07cff', '#5ad03a'], 4, { up: 12, round: 1, rate: 1.8 });
        if (t >= 3) sparks(c, E, 2 + t, 16, 15, ['#c8ff8a', '#7be06a'], 4.4, { up: 18, round: 1, rate: 2.6 });
        if (t >= 5) { helix(c, E, 34, 7, 1.5, 0, '#b07cff', 2.2, 0.9); if (t >= 6) helix(c, E, 34, 7, 1.5, Math.PI, '#7be06a', 2.2, 0.9); }
      }
      local(c, E, () => {   // 출렁이는 방울
        const w1 = 1 + 0.24 * Math.sin(T * 22 + id), w2 = 1 - 0.2 * Math.sin(T * 22 + id);
        c.fillStyle = t >= 6 ? '#2c1a44' : '#14601a'; c.beginPath(); c.moveTo(8 * w1, 0); c.quadraticCurveTo(5, -7.6 * w2, -3, -6.8 * w2); c.quadraticCurveTo(-9, -3, -14 * w1, 0); c.quadraticCurveTo(-9, 3, -3, 6.8 * w2); c.quadraticCurveTo(5, 7.6 * w2, 8 * w1, 0); c.fill();
        c.fillStyle = t >= 6 ? '#a86aff' : '#66e04a'; c.beginPath(); c.ellipse(0.5, 0, 5.6 * w1, 5 * w2, 0, 0, TAU); c.fill();
        c.fillStyle = '#e8ffc8'; c.beginPath(); c.arc(2.5, -1.8, 1.8, 0, TAU); c.fill();
      }, 0.05);
      if (!lo) orbit(E, t >= 6 ? 4 : t >= 3 ? 3 : 2, 12 * S, 8, (px, py, a, j) => { const r = 2.2 + 0.9 * Math.sin(T * 12 + j * 2); c.fillStyle = '#3a1a6a'; c.beginPath(); c.arc(px, py, r + 1.2, 0, TAU); c.fill(); c.fillStyle = j % 2 && t >= 6 ? '#c8ff8a' : '#c090ff'; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill(); });
    },
    // 부식: 형광 연두 산성 덩어리(탑의 초록 점액과 같은 색). 모양이 매 프레임 끓어 바뀌고, 아래로 굵게 늘어지는 방울과 치익 김이 1단계부터 나온다
    // 끓는 덩어리 → 긴 방울 → 검은 연기 → 튀는 산 → 끓는 고리 → 사방으로 끓어오르는 산
    corrode(c, E) {
      const { t, T, x, y, id, lo, S } = E, DARK = '#3a5208', MID = '#8ac81a', HI = '#d8ff4a', TOP = '#fbffd0';
      aura(c, x, y, (16 + Math.min(t, 4) * 2) * S, '#a8e01a', 0.62);
      if (!lo) {
        wake(c, E, 22 + t * 5, 11, DARK, 0.7, 2.6);
        wake(c, E, 18 + t * 4, 6.5, MID, 0.9, 2);
        wake(c, E, 10 + t * 3, 2.6, HI, 1);
        sparks(c, E, 4 + t, 34, 6, [HI, MID, DARK], 6, { grav: 46, round: 1, rate: 1.5 });   // 굵게 늘어지는 방울
        sparks(c, E, 3 + t, 16, 13, [TOP, HI], 3.2, { up: 22, rate: 3.4 });   // 치익 튀는 산
        for (let j = 0; j < (t >= 3 ? 3 : 2); j++) { const ph = (T * 2 + j / 3 + id * 0.3) % 1, q2 = E.F.q - ph * Math.min(E.F.q, 30 / E.F.d0); if (q2 < 0) continue; const p = ptAt(E.s, E.F, q2, true); aura(c, p[0] + Math.sin(j * 3 + T * 4) * 4, p[1] - 5 - ph * 17, 5 + ph * 9, t >= 3 ? '#2c3020' : '#5a6a2a', (1 - ph) * 0.7); }
        if (t >= 5) shed(c, E, 2, 28, 5, 15, HI, 2.2, 0.8);
      }
      if (!lo) { c.lineWidth = 2; for (let j = 0; j < 2; j++) { const ph = (T * 3.2 + j / 2 + id * 0.4) % 1; c.globalAlpha = (1 - ph) * 0.9; c.strokeStyle = j ? HI : TOP; c.beginPath(); c.ellipse(x, y, (6 + ph * 11) * S, (4 + ph * 7) * S, 0, 0, TAU); c.stroke(); } c.globalAlpha = 1; }
      // 끓는 몸통: 둘레가 파도치는 덩어리(프레임마다 모양이 다름)
      const blob = (R0, col, ph) => { c.fillStyle = col; c.beginPath(); for (let j = 0; j <= 14; j++) { const a0 = j / 14 * TAU, r = R0 * (1 + 0.28 * Math.sin(a0 * 3 + T * 22 + id + ph) + 0.16 * Math.sin(a0 * 5 - T * 31 + ph)), X = x + Math.cos(a0) * r * S, Y = y + Math.sin(a0) * r * S + Math.max(0, Math.sin(a0)) * 2.4 * S; j ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.closePath(); c.fill(); };
      blob(7.6, DARK, 0); blob(6, MID, 1.4); blob(3.9, HI, 2.6);
      for (let j = 0; j < 2; j++) { const ph = (T * 3.4 + j * 0.5 + id) % 1, a0 = j * 2.4 + id; c.fillStyle = TOP; c.globalAlpha = 1 - ph * 0.5; c.beginPath(); c.arc(x + Math.cos(a0) * 3 * S, y + Math.sin(a0) * 2 * S - ph * 2, (0.8 + ph * 1.4) * S, 0, TAU); c.fill(); c.globalAlpha = 1; }
      if (t >= 6 && !lo) for (let j = 0; j < 6; j++) { const ph = (T * 3 + j / 6 + id) % 1, a0 = j * TAU / 6 + id; c.globalAlpha = 1 - ph; c.fillStyle = j % 2 ? HI : TOP; c.beginPath(); c.arc(x + Math.cos(a0) * (8 + ph * 8), y + Math.sin(a0) * 4 - 3 - ph * 15, 2.8 * (1 - ph * 0.5), 0, TAU); c.fill(); c.globalAlpha = 1; }
    },
    // 성광: 빛 구슬 → 도는 십자 빛 → 빛 부스러기 → 빛의 창(4단계 몸통이 바늘로) → 후광 고리 → 태양 코로나
    light(c, E) {
      const { t, T, x, y, id, lo, S } = E;
      aura(c, x, y, (17 + Math.min(t, 4) * 2) * S, '#ffd86a', 0.62);
      if (!lo) {
        wake(c, E, t >= 4 ? 40 : 18 + t * 4, t >= 4 ? 6 : 8, '#ffe48a', 0.7);
        sparks(c, E, 3 + t * 2, 36, 12, ['#ffffff', '#fff2a0'], 3.6, { rate: 2.2, dia: 1, up: 6 });
      }
      if (t >= 4) {   // 빛의 창: 커지지 않고 가늘고 길게
        local(c, E, () => { c.fillStyle = '#ffc23a'; c.beginPath(); c.moveTo(16, 0); c.lineTo(0, -3.8); c.lineTo(-13, 0); c.lineTo(0, 3.8); c.closePath(); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(14, 0); c.lineTo(0, -1.8); c.lineTo(-10, 0); c.lineTo(0, 1.8); c.closePath(); c.fill(); }, 0.08);
      } else { c.fillStyle = '#ffc23a'; c.beginPath(); c.arc(x, y, 6.4 * S, 0, TAU); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, (4 + 0.6 * Math.sin(T * 24 + id)) * S, 0, TAU); c.fill(); }
      if (t >= 2) glint(c, x, y, (12 + 2.5 * Math.sin(T * 18 + id)) * S, T * 2.6 + id, '#ffffff', 0.92);
      if (t >= 5 && !lo) { c.save(); c.globalAlpha = 0.85; c.strokeStyle = '#ffe48a'; c.lineWidth = 2; c.setLineDash([4, 5]); c.lineDashOffset = -T * 40; c.beginPath(); c.ellipse(x, y, 15, 9, 0, 0, TAU); c.stroke(); c.restore(); }
      if (t >= 6 && !lo) { c.save(); c.translate(x, y); c.rotate(T * 1.6 + id); c.fillStyle = '#ffe48a'; for (let j = 0; j < 8; j++) { c.rotate(TAU / 8); const r = 15 + 4 * Math.sin(T * 20 + j * 2); c.beginPath(); c.moveTo(7, -1.8); c.lineTo(r, 0); c.lineTo(7, 1.8); c.closePath(); c.fill(); } c.restore(); orbit(E, 3, 17, 5, (px, py) => glint(c, px, py, 5, T * 6, '#ffffff')); }
    },
    // 성장: 씨앗 빛 → 반짝이 → 도는 작은 잎 → 감기는 덩굴 → 흩날리는 꽃잎 → 피어나는 꽃 + 금빛 꽃가루
    growth(c, E) {
      const { t, T, x, y, id, lo, S } = E;
      aura(c, x, y, (15 + Math.min(t, 4) * 2) * S, '#e8e04a', 0.55);
      const leaf = (px, py, a, sz, col) => { c.save(); c.translate(px, py); c.rotate(a); c.fillStyle = col; c.beginPath(); c.moveTo(sz, 0); c.quadraticCurveTo(0, -sz * 0.62, -sz, 0); c.quadraticCurveTo(0, sz * 0.62, sz, 0); c.fill(); c.restore(); };
      if (!lo) {
        wake(c, E, 20 + t * 5, 8.5, '#c8e04a', 0.72, 2.4); wake(c, E, 12 + t * 3, 3.4, '#fff6a8', 0.95); sparks(c, E, 2 + t, 28, 10, ['#fff6a8', '#e8e04a'], 3.4, { rate: 2, dia: 1 });
        if (t >= 4) { helix(c, E, 44, 8, 1.3, 0, '#5ab82a', 2.6, 0.95); helix(c, E, 44, 8, 1.3, Math.PI, '#a8e04a', 1.8, 0.9); }
        if (t >= 5) for (let j = 0; j < 5; j++) { const ph = (T * 1.5 + j / 5 + id * 0.2) % 1, q2 = E.F.q - ph * Math.min(E.F.q, 50 / E.F.d0); if (q2 < 0) continue; const p = ptAt(E.s, E.F, q2, true); c.globalAlpha = 1 - ph; leaf(p[0] + Math.sin(j * 2.4 + T * 4) * (5 + ph * 12), p[1] + ph * 14, T * 4 + j, 4, j % 2 ? '#ffb0d0' : '#ffe0ec'); c.globalAlpha = 1; }
        if (t >= 3) orbit(E, t >= 5 ? 3 : 2, 13, 7, (px, py, a) => leaf(px, py, a + 1.5, 5.4, '#6ac82a'));
      }
      if (t >= 6 && !lo) { c.save(); c.translate(x, y); c.rotate(T * 2 + id); for (let j = 0; j < 6; j++) { c.rotate(TAU / 6); c.globalAlpha = 0.85; c.fillStyle = j % 2 ? '#ffc0d8' : '#ffe6f0'; c.beginPath(); c.ellipse(7, 0, 3.8 + Math.sin(T * 10) * 0.6, 2.2, 0, 0, TAU); c.fill(); } c.restore(); sparks(c, E, 8, 36, 20, ['#ffe36a', '#fff6a8'], 3, { up: 12, rate: 2.2 }); }
      for (const sd of [0, Math.PI]) leaf(x + Math.cos(T * 7 + id + sd) * 4.4 * S, y + Math.sin(T * 7 + id + sd) * 3 * S, T * 7 + id + sd, 6 * S, '#8ad03a');
      c.fillStyle = '#ffe36a'; c.beginPath(); c.arc(x, y, (3.4 + 0.6 * Math.sin(T * 16 + id)) * S, 0, TAU); c.fill();
      c.fillStyle = '#fffbe0'; c.beginPath(); c.arc(x - 0.8, y - 0.8, 1.4 * S, 0, TAU); c.fill();
    },
    // 폭군: 핏빛 바늘 + 검은 기운 → 핏방울 → 양옆 가시 → 어둠 소용돌이 → 핏빛 고리 → 초승달 낫 + 피비
    tyrant(c, E) {
      const { t, T, x, y, id, lo, S } = E;
      aura(c, x, y, (16 + Math.min(t, 4) * 2) * S, '#7a0a1a', 0.62);
      if (!lo) {
        wake(c, E, 24 + t * 5, 8, '#3a0610', 0.72, 2);
        wake(c, E, 16 + t * 4, 4.4, '#ff4a5a', 0.95);
        if (t >= 3) sparks(c, E, 2 + t, 30, 7, ['#d8283a', '#7a0a1a'], 4, { grav: 40, round: 1, rate: 1.7 });
        if (t >= 4) { helix(c, E, 40, 9, 1.5, 0, '#1a0a12', 3, 0.85); }
        if (t >= 5) { shed(c, E, 2, 34, 5, 17, '#e8283a', 2.2, 0.75); helix(c, E, 40, 9, 1.5, Math.PI, '#b8202e', 2.2, 0.9); }
      }
      local(c, E, () => {
        const pulse = 1 + 0.12 * Math.sin(T * 26 + id);
        c.fillStyle = '#2a0610'; c.beginPath(); c.moveTo(15, 0); c.lineTo(-2, -4.6 * pulse); c.lineTo(-13, 0); c.lineTo(-2, 4.6 * pulse); c.closePath(); c.fill();
        c.fillStyle = '#e8283a'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-1, -2.8 * pulse); c.lineTo(-9, 0); c.lineTo(-1, 2.8 * pulse); c.closePath(); c.fill();
        c.fillStyle = '#ffb0b8'; c.beginPath(); c.moveTo(11, 0); c.lineTo(1, -0.9); c.lineTo(-3, 0); c.lineTo(1, 0.9); c.closePath(); c.fill();
        if (t >= 4) for (const sd of [-1, 1]) { c.fillStyle = '#b8202e'; c.beginPath(); c.moveTo(-1, sd * 3); c.lineTo(-11, sd * (8 + 1.5 * Math.sin(T * 20 + id))); c.lineTo(-5, sd * 2); c.closePath(); c.fill(); }
      }, 0.1);
      if (t >= 6 && !lo) {
        for (let j = 0; j < 3; j++) {   // 뒤로 끌리는 초승달 기운 세 겹(뒤로 갈수록 옅고 흔들림)
          const lag = j * Math.min(0.09, 11 / E.F.d0), p = ptAt(E.s, E.F, Math.max(0, E.F.q - lag), true), sw = Math.sin(T * 18 + id + j * 1.4) * 0.22, r = 12 - j * 0.6;
          c.save(); c.translate(p[0], p[1]); c.rotate(E.ang + sw); c.globalAlpha = 0.88 - j * 0.3; c.fillStyle = j ? '#7a0a1a' : '#e8283a';
          c.beginPath(); c.moveTo(-2, -r); c.quadraticCurveTo(r * 1.1, 0, -2, r); c.quadraticCurveTo(r * 0.42, 0, -2, -r); c.fill();
          if (!j) { c.fillStyle = '#ffb0b8'; c.beginPath(); c.moveTo(0, -r * 0.7); c.quadraticCurveTo(r * 0.85, 0, 0, r * 0.7); c.quadraticCurveTo(r * 0.52, 0, 0, -r * 0.7); c.fill(); }
          c.restore();
        }
        sparks(c, E, 7, 30, 20, ['#ff3b4a', '#b8202e'], 3.4, { grav: 34, rate: 2.6 });
      }
    },
    // 소환: 그림 대신 일렁이는 혼불 → 물결 꼬리 → 혼불 조각 → 함께 도는 작은 혼 → 영혼 고리 → 두 혼이 얽힌 큰 혼불
    summon(c, E) {
      const { t, T, x, y, id, lo, S } = E, COL = ['#14806e', '#2fc8a8', '#b8fff0', '#ffffff'];
      aura(c, x, y, (15 + Math.min(t, 4) * 2) * S, '#2fc8a8', 0.55);
      if (!lo) {
        wake(c, E, 22 + t * 4, 7, '#2fc8a8', 0.5, 3.4);
        sparks(c, E, 2 + t * 2, 34, 10, ['#b8fff0', '#2fc8a8'], 3.8, { up: 14, rate: 1.9, round: 1 });
        if (t >= 6) { helix(c, E, 40, 7, 1.4, 0, '#b8fff0', 2.2, 0.9); helix(c, E, 40, 7, 1.4, Math.PI, '#2fc8a8', 2.2, 0.9); }
        if (t >= 5) { c.save(); c.globalAlpha = 0.8; c.strokeStyle = '#b8fff0'; c.lineWidth = 1.8; c.setLineDash([3, 6]); c.lineDashOffset = T * 30; c.beginPath(); c.ellipse(x, y, 15, 9, 0, 0, TAU); c.stroke(); c.restore(); }
      }
      local(c, E, () => { flame(c, 18, 7, T * 0.7, id, COL); c.fillStyle = '#0c3a34'; c.fillRect(1.5, -2.8, 2, 2); c.fillRect(1.5, 0.8, 2, 2); }, 0.06);
      if (t >= 4 && !lo) orbit(E, t >= 6 ? 3 : t >= 5 ? 2 : 1, 13, 6.5, (px, py) => { aura(c, px, py, 6.5, '#2fc8a8', 0.8); c.fillStyle = '#d8fff6'; c.beginPath(); c.arc(px, py, 2.4, 0, TAU); c.fill(); });
    },
    // 콤보: 박자의 탑. 구슬 → 도는 고리 → 맞물린 두 고리 → 퍼지는 박자 → 도는 별 → 무지개 박자
    combo(c, E) {
      const { t, T, x, y, id, lo, S } = E;
      aura(c, x, y, (15 + Math.min(t, 4) * 2) * S, '#ff5ac8', 0.52);
      if (!lo) {
        wake(c, E, 18 + t * 4, 6, '#ff8adf', 0.55);
        sparks(c, E, 2 + t, 28, 11, ['#ffe0f6', '#ff8adf'], 3.4, { rate: 2.8, dia: 1 });
        if (t >= 4) shed(c, E, t >= 6 ? 3 : 2, 34, 3, 11, t >= 6 ? RAIN[Math.floor(T * 7 + id) % 6] : '#ff8adf', 2, 0.85);
      }
      const ring = (rot, col, rx, ry) => { c.strokeStyle = col; c.lineWidth = 2.1; c.beginPath(); c.ellipse(x, y, rx * S, ry * S, rot, 0, TAU); c.stroke(); };
      c.fillStyle = '#c82a9a'; c.beginPath(); c.arc(x, y, 5.6 * S, 0, TAU); c.fill();
      c.fillStyle = '#ffe0f6'; c.beginPath(); c.arc(x, y, (3.4 + Math.abs(Math.sin(T * 12 + id)) * 1.2) * S, 0, TAU); c.fill();
      if (t >= 2) ring(T * 8 + id, '#ff8adf', 8.6, 4);
      if (t >= 3) ring(-T * 8 + id + 1.2, '#ffe0f6', 8.6, 4);
      if (t >= 5 && !lo) orbit(E, t >= 6 ? 3 : 2, 12, 8, (px, py, a, j) => glint(c, px, py, 4.6, a, t >= 6 ? RAIN[(j * 2 + Math.floor(T * 6)) % 6] : '#ffe0f6'));
    },
    // 봉화: 빛으로 된 불화살. 불씨 촉 → 불꼬리 → 불티 → 감기는 불줄기 + 열기 고리 → 일렁이는 불꽃 깃 → 불새 날개 기운 + 불폭풍. 길이는 3단계에서 멈춘다
    beacon(c, E) {
      const { t, T, x, y, id, lo, S } = E, hot = t >= 6;
      const pul = 1 + 0.16 * Math.sin(T * 24 + id); aura(c, x, y, 25 * S, '#2b1426', 0.34); aura(c, x, y, (21 + Math.min(t, 4) * 2) * S * pul, '#ff8a1c', 0.95); aura(c, x, y, 12 * S * pul, '#ffe36a', 0.9);
      if (!lo) {
        wake(c, E, 19 + Math.min(t, 3) * 4, 13 * S, '#c8280c', 0.72, 4.5); wake(c, E, 14 + Math.min(t, 3) * 3, 8 * S, '#ff8a1c', 0.92, 3.4);
        wake(c, E, 9 + Math.min(t, 3) * 2, 3.4 * S, '#ffe9a8', 1, 1.8);
        sparks(c, E, t + 3, 30 + t * 4, 9, ['#fff2a0', '#ffd23a', '#ff8a1c'], 3.6, { rate: 2.8, up: 8 });
        if (t <= 4) orbit(E, 2 + (t >= 3 ? 1 : 0), 10 * S, 11, (px, py, a, j) => { const r = 1.8 + 0.8 * Math.sin(T * 16 + j * 2); c.fillStyle = '#7a1a10'; c.beginPath(); c.arc(px, py, r + 1, 0, TAU); c.fill(); c.fillStyle = '#fff2a0'; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill(); });
        if (t >= 3) sparks(c, E, 4, 42, 10, ['#ffb347', '#e8452c'], 3.8, { grav: 26, rate: 1.7 });
        if (t >= 3) sparks(c, E, 3, 18, 15, ['#ffe36a', '#ff8a1c'], 3.4, { up: 18, rate: 3.6 });
        if (t >= 4) { helix(c, E, 32, 7, 1.5, 0, '#ff8a1c', 2.3, 0.9); shed(c, E, 2, 30, 4, 14, '#ffc06a', 2, 0.7); }
      }
      local(c, E, () => {
        // 몸통: 꼬리 쪽은 잔상으로 사라지는 빛살 + 앞은 달아오른 촉
        if (t >= 5 && !lo) for (const sd of [-1, 1]) {   // 일렁이는 불꽃 깃(6단계 = 날개처럼 퍼덕임)
          const fl = Math.sin(T * (hot ? 20 : 24) + id), n = hot ? 3 : 2;
          for (let j = 0; j < n; j++) { c.save(); c.translate(-4 - j * 4, sd * (2 + j)); c.rotate(sd * ((hot ? 2.45 : 2.6) - j * 0.34 + fl * (hot ? 0.34 : 0.16))); c.scale(1, 1); flame(c, hot ? 11 - j * 1.6 : 10, hot ? 3 : 2.8, T, id + j * 2 + sd, hot ? ['#e8452c', '#ff9a1c', '#ffe36a'] : ['#ff8a1c', '#ffe36a']); c.restore(); }
        }
                flame(c, 17 + 4 * Math.sin(T * 30 + id), 8 + 1.6 * Math.sin(T * 41 + id), T, id, ['#c8280c', '#ff6a1c', '#ffb31c', '#ffe36a', '#fffbe0']);
        if (t >= 3) for (const sd of [-1, 1]) { c.save(); c.translate(-2, sd * 6); c.rotate(sd * (2.75 + 0.22 * Math.sin(T * 26 + id + sd))); flame(c, 8, 2.8, T, id + sd * 2, ['#ff6a1c', '#ffd23a']); c.restore(); }
        c.fillStyle = hot ? '#ffffff' : '#fff2c0'; c.beginPath(); c.moveTo(12, 0); c.lineTo(3, -3); c.lineTo(5, 0); c.lineTo(3, 3); c.closePath(); c.fill();
      }, 0.12);
      if (hot && !lo) { sparks(c, E, 9, 30, 14, ['#fff6c8', '#ffb347', '#ff6a1c'], 3.2, { up: 12, rate: 3 }); glint(c, x + Math.cos(E.ang) * 9, y + Math.sin(E.ang) * 9, 8 + 2 * Math.sin(T * 28 + id), T * 4, '#ffffff', 0.92); }
    },
    // 채굴: 돌 조각 → 먼지 → 금이 빛나는 돌 → 달아오른 금광석 → 도는 보석 조각 → 다이아몬드 + 빛살 + 금가루
    mining(c, E) {
      const { t, T, x, y, id, lo, S } = E, spin = T * 13 + id;
      const glowCol = t >= 6 ? '#ffe9a0' : t >= 4 ? '#ffc23a' : '#c8a06a';
      aura(c, x, y, (14 + Math.min(t, 4) * 2) * S, glowCol === '#c8a06a' ? '#e8c890' : glowCol, t >= 4 ? 0.6 : 0.6);
      if (!lo) {
        sparks(c, E, 1 + t, 30, 8, ['#8a6a3a', '#c8a878'], 3.6, { grav: 34, rate: 1.8 });
        wake(c, E, 14 + t * 4, 6, t >= 4 ? '#ffb347' : '#a8845a', 0.5);
        if (t >= 4) sparks(c, E, 4 + t, 34, 12, ['#ffe36a', '#ffd23a'], 3.2, { rate: 2.6, dia: 1 });
        if (t >= 5) orbit(E, t >= 6 ? 3 : 2, 13, 10, (px, py, a, j) => { c.save(); c.translate(px, py); c.rotate(a * 2); c.fillStyle = j % 2 ? '#ff7a9a' : t >= 6 ? '#fff6c8' : '#6ab0ff'; c.beginPath(); c.moveTo(0, -4); c.lineTo(3, 0); c.lineTo(0, 4); c.lineTo(-3, 0); c.closePath(); c.fill(); c.restore(); });
      }
      if (t >= 6) {   // 다이아몬드: 커지지 않고 빛으로
        c.save(); c.translate(x, y); c.rotate(T * 1.6 + id); c.fillStyle = 'rgba(255,236,160,0.9)'; if (!lo) for (let j = 0; j < 6; j++) { c.rotate(TAU / 6); const r = 13 + 4 * Math.sin(T * 22 + j * 2); c.beginPath(); c.moveTo(5, -1.6); c.lineTo(r, 0); c.lineTo(5, 1.6); c.closePath(); c.fill(); } c.restore();
        c.fillStyle = '#e8a21a'; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 6.5, y - 1); c.lineTo(x, y + 8); c.lineTo(x - 6.5, y - 1); c.closePath(); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 3, y - 1); c.lineTo(x, y + 2); c.lineTo(x - 3, y - 1); c.closePath(); c.fill();
        if (!lo) glint(c, x + 4, y - 5, 7 + 2 * Math.sin(T * 20 + id), T * 5, '#ffffff');
        return;
      }
      c.save(); c.translate(x, y); c.rotate(spin); c.scale(S, S);
      const rock = t >= 4 ? (t >= 5 ? '#e8a21a' : '#c8841a') : '#a87c4a', top = t >= 4 ? '#ffe36a' : '#e8cca0';
      c.fillStyle = rock; c.beginPath(); c.moveTo(-7.5, -2); c.lineTo(-2.5, -7); c.lineTo(5, -5.5); c.lineTo(7.5, 1); c.lineTo(2.5, 6.5); c.lineTo(-5, 5.5); c.closePath(); c.fill();
      c.fillStyle = top; c.beginPath(); c.moveTo(-5, -2); c.lineTo(-1.5, -5); c.lineTo(3.5, -3.5); c.lineTo(1, 0.5); c.closePath(); c.fill();
      if (t >= 3) { c.strokeStyle = t >= 4 ? '#ffffff' : '#ffd23a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-4, 3); c.lineTo(-0.5, 0.5); c.lineTo(1, 3.5); c.lineTo(5, 1); c.stroke(); }
      c.restore();
    },
    // 탐욕: 커지지 않는 동전 한 닢 + 효과. 구리 → 금화 + 반짝 → 금가루 → 뒤따르는 동전 잔상 → 금빛 고리 → 보석 금화 + 빛의 날개 + 금비
    greed(c, E) {
      const { t, T, x, y, id, lo, S, s, F } = E, spin = T * 15 + id, R0 = 8.5 * S, im = this.I('i_coin');
      aura(c, x, y, 18 * S, '#2b1426', 0.34); aura(c, x, y, (13 + Math.min(t, 4) * 2.4) * S, t === 1 ? '#f0a860' : '#ffe36a', t === 1 ? 0.65 : 0.7);
      if (!lo) {
        wake(c, E, 20 + t * 5, 7, t === 1 ? '#c87a3c' : '#ffd23a', 0.55);
        sparks(c, E, t + 1, 28, 9, ['#fff6c8', '#ffd23a'], 3.4, { rate: 2.8, dia: 1 });
        if (t >= 3) sparks(c, E, 3 + t, 40, 8, ['#ffd23a', '#e8a21a'], 3.6, { grav: 34, rate: 1.7 });
        if (t >= 4) for (let j = 2; j >= 1; j--) { const p = ptAt(s, F, Math.max(0, F.q - j * Math.min(0.1, 13 / F.d0)), true); c.save(); c.translate(p[0], p[1]); c.globalAlpha = 0.5 / j; c.scale(Math.abs(Math.cos(spin - j * 0.7)) * 0.84 + 0.16, 1); if (im) c.drawImage(im, -6, -6, 12, 12); c.restore(); }
        if (t >= 5) shed(c, E, 2, 34, 5, 16, '#ffe36a', 2.2, 0.8);
      }
      if (t >= 6 && !lo) {   // 빛의 날개: 그림이 아니라 퍼덕이는 빛 조각
        const fl = Math.sin(T * 20 + id) * 0.3;
        for (const sd of [-1, 1]) for (let j = 0; j < 3; j++) { c.save(); c.translate(x + sd * 6, y); c.rotate(sd * (-0.75 + j * 0.5 + fl)); c.fillStyle = j === 1 ? '#fffbe0' : '#ffe36a'; const L = 15 - j * 2.6; c.beginPath(); c.moveTo(0, -1.6); c.quadraticCurveTo(sd * L * 0.6, -4.2, sd * L, 0); c.quadraticCurveTo(sd * L * 0.6, 2.6, 0, 1.6); c.fill(); c.restore(); }
        sparks(c, E, 8, 36, 18, ['#fff6c8', '#ffe36a'], 3, { grav: 24, rate: 2.4 });
      }
      // 동전 몸통: 뒤집히며 돈다(옆면이 보임)
      const f = Math.cos(spin), w = Math.max(0.14, Math.pow(Math.abs(f), 1.4)), tilt = Math.sin(T * 7 + id) * 0.35;
      c.save(); c.translate(x, y); c.rotate(tilt);
      c.fillStyle = t === 1 ? '#7a4424' : '#a8640e'; c.beginPath(); c.ellipse((f >= 0 ? 1 : -1) * R0 * 0.2 * (1 - w), 0, R0 * w, R0, 0, 0, TAU); c.fill();
      if (t === 1) { c.fillStyle = '#c87a3c'; c.beginPath(); c.ellipse(0, 0, R0 * w, R0, 0, 0, TAU); c.fill(); c.fillStyle = '#f0b078'; c.beginPath(); c.ellipse(0, 0, R0 * w * 0.6, R0 * 0.6, 0, 0, TAU); c.fill(); }
      else if (im) c.drawImage(im, -R0 * w, -R0, R0 * 2 * w, R0 * 2);
      if (t >= 6) { const g = R0 * 0.4; c.scale(w, 1); c.fillStyle = '#e8304a'; c.beginPath(); c.moveTo(0, -g); c.lineTo(g, 0); c.lineTo(0, g); c.lineTo(-g, 0); c.closePath(); c.fill(); c.fillStyle = '#ffb0b8'; c.fillRect(-g * 0.3, -g * 0.5, g * 0.5, g * 0.4); }
      c.restore();
      if (t >= 2) glint(c, x + 5, y - 6, (6 + 3 * Math.abs(Math.sin(T * 9 + id))) * S, T * 6, '#ffffff');
    },
    // 프리즘: 색이 도는 수정 → 무지개 꼬리 → 무지개 조각 → 도는 삼각 프리즘 → 꺾이는 빛 → 스펙트럼 광선 + 무지개 고리
    prism(c, E) {
      const { t, T, x, y, id, lo, S } = E, col = k => RAIN[Math.floor(T * 7 + id + k + 60) % 6];
      aura(c, x, y, (15 + Math.min(t, 4) * 2) * S, col(0), 0.5);
      if (!lo) {
        wake(c, E, 24 + t * 4, 9, col(1), 0.7);
        wake(c, E, 18 + t * 3, 5, col(3), 0.9);
        sparks(c, E, 3 + t * 2, 36, 12, RAIN, 4.4, { rate: 2.4, dia: 1 });
        if (t >= 5) helix(c, E, 38, 8, 1.3, 0, col(4), 2.2, 0.9);
        if (t >= 6) { shed(c, E, 3, 40, 4, 17, col(2), 2.4, 0.85); helix(c, E, 38, 8, 1.3, Math.PI, col(5), 2.2, 0.9); }
      }
      if (t >= 6 && !lo) { c.save(); c.translate(x, y); c.rotate(T * 1.8 + id); for (let j = 0; j < 6; j++) { c.rotate(TAU / 6); c.fillStyle = RAIN[j]; c.globalAlpha = 0.9; const r = 15 + 4 * Math.sin(T * 18 + j * 2); c.beginPath(); c.moveTo(5, -1.7); c.lineTo(r, 0); c.lineTo(5, 1.7); c.closePath(); c.fill(); } c.restore(); }
      c.save(); c.translate(x, y); c.scale(S, S);
      if (t >= 4) {   // 삼각 프리즘
        c.rotate(T * 5 + id);
        for (let j = 0; j < 3; j++) { const a = j * TAU / 3, b = a + TAU / 3; c.fillStyle = col(j * 2); c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 9, Math.sin(a) * 9); c.lineTo(Math.cos(b) * 9, Math.sin(b) * 9); c.closePath(); c.fill(); }
      } else {
        c.rotate(T * 3 + id);
        for (const [j, sx, sy] of [[0, 1, 1], [1, -1, 1], [2, 1, -1], [3, -1, -1]]) { c.fillStyle = col(j); c.beginPath(); c.moveTo(0, 0); c.lineTo(sx * 5.4, 0); c.lineTo(0, sy * 8); c.closePath(); c.fill(); }
      }
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, 2.6, 0, TAU); c.fill();
      c.restore();
      if (t >= 2) glint(c, x, y, (10 + 2 * Math.sin(T * 16 + id)) * S, T * 2.5, '#ffffff', 0.85);
    },
  };

  // ------------------------------------------------------------ 그리기
  R.drawShots = function (c, game) {
    const N = game.shots.length, T = this.time, lo = N > 90;   // 탄이 아주 많으면(6단계 판 가득) 몸통 · 짧은 꼬리만
    c.save();
    for (const s of game.shots) {
      if (s.delay > 0) continue;
      if (s.type === 'greed' && this.tipFor9) this.tipFor9(s);
      if (s._o && s._d0 == null) s._d0 = Math.max(1, Math.hypot(s.tx - s.x, s.ty - s.y));
      const F = frameOf(s), t = clamp(s.tier || 1, 1, 6), [x, y] = ptAt(s, F, F.q, true), tg = tangentAt(s, F, F.q);
      const E = { s, F, T, t, x, y, q: F.q, id: s.id || 0, ang: Math.atan2(tg[1], tg[0]), S: SZ[t] * (s.big ? 1.12 : 1), lo };
      if (!lo) aura(c, x, y, 21 * E.S, '#2b1426', 0.3);   // 밝은 배경에서 외곽선 없이 떠 보이게 하는 어두운 받침
      const draw = TOWER[s.type] || TOWER.light;
      draw.call(this, c, E);
      if (s.big && !lo) { aura(c, x, y, 28, (root.DATA.TOWERS[s.type] || {}).color || '#ffffff', 0.35); shed(c, E, 3, 40, 6, 22, (root.DATA.TOWERS[s.type] || {}).color || '#ffffff', 2.4, 0.8); }
    }
    c.restore();
  };
  // ------------------------------------------------------------ 맞는 순간(탑별) — 외곽선 십자 · 고리 대신 빛 · 파편 · 그 탑의 재료
  // 상태 없는 묶음: 파편 n개의 각도 · 속도를 미리 정해 두고 진행률로만 위치 계산(입자 객체를 만들지 않아 가볍다)
  function burst(R0, x, y, o) {
    const n = o.n, list = []; for (let j = 0; j < n; j++) { const a = (o.a0 == null ? Math.random() * TAU : o.a0 + (j / n) * (o.arc || TAU)) + (Math.random() - 0.5) * 0.4; list.push([a, (o.r || 30) * (0.55 + Math.random() * 0.6), (o.size || 4) * (0.7 + Math.random() * 0.6), Math.random() * 6]); }
    R0.addFx(o.dur || 0.35, (c, p) => {
      const e = 1 - (1 - p) * (1 - p), cols = o.cols;
      list.forEach(([a, r, sz, ph], j) => {
        const X = x + Math.cos(a) * r * e, Y = y + Math.sin(a) * r * e * 0.7 + (o.grav || 0) * p * p - (o.up || 0) * e, S = Math.max(1.2, sz * (1 - p * (o.keep ? 0.3 : 0.75)));
        c.globalAlpha = p > 0.55 ? (1 - p) / 0.45 : 1; c.fillStyle = cols[j % cols.length];
        if (o.shape === 'dia') { c.beginPath(); c.moveTo(X, Y - S); c.lineTo(X + S * 0.65, Y); c.lineTo(X, Y + S); c.lineTo(X - S * 0.65, Y); c.closePath(); c.fill(); }
        else if (o.shape === 'round') { c.beginPath(); c.arc(X, Y, S * 0.6, 0, TAU); c.fill(); }
        else if (o.shape === 'leaf') { c.save(); c.translate(X, Y); c.rotate(ph + p * 7); c.beginPath(); c.moveTo(S, 0); c.quadraticCurveTo(0, -S * 0.62, -S, 0); c.quadraticCurveTo(0, S * 0.62, S, 0); c.fill(); c.restore(); }
        else if (o.shape === 'streak') { c.save(); c.translate(X, Y); c.rotate(a); c.beginPath(); c.moveTo(S * 2.4, 0); c.lineTo(0, -S * 0.42); c.lineTo(-S * 1.2, 0); c.lineTo(0, S * 0.42); c.closePath(); c.fill(); c.restore(); }
        else c.fillRect(Math.round(X) - S / 2, Math.round(Y) - S / 2, S, S);
      });
      c.globalAlpha = 1;
    });
  }
  function flash(R0, x, y, r, col, dur) { R0.addFx(dur || 0.16, (c, p) => { aura(c, x, y, r * (0.6 + p * 0.5), col, (1 - p) * 0.95, 0.8); }); }
  function rays(R0, x, y, n, r, col, dur, w) {
    const a0 = Math.random() * TAU;
    R0.addFx(dur || 0.22, (c, p) => { const e = 1 - (1 - p) * (1 - p); c.save(); c.translate(x, y); c.scale(1, 0.75); c.rotate(a0); c.fillStyle = col; c.globalAlpha = 1 - p * p; for (let j = 0; j < n; j++) { c.rotate(TAU / n); const L = r * (0.4 + e * 0.6) * (j % 2 ? 0.66 : 1), W = (w || 3) * (1 - p * 0.6); c.beginPath(); c.moveTo(r * 0.16 * e, -W); c.lineTo(L, 0); c.lineTo(r * 0.16 * e, W); c.closePath(); c.fill(); } c.restore(); });
  }
  function ring(R0, x, y, r, col, dur, w, dash) {
    R0.addFx(dur || 0.3, (c, p) => { const e = 1 - (1 - p) * (1 - p); c.save(); c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = (w || 3) * (1 - p * 0.7); if (dash) { c.setLineDash(dash); c.lineDashOffset = -p * 30; } c.beginPath(); c.ellipse(x, y + 4, r * (0.25 + e * 0.75), r * 0.5 * (0.25 + e * 0.75), 0, 0, TAU); c.stroke(); c.restore(); });
  }
  function jolts(R0, x, y, n, r, col, dur) { R0.addFx(dur || 0.16, (c, p) => { c.globalAlpha = 1 - p; arcs(c, x, y, n, r * (0.6 + p * 0.5), col, 2.2); arcs(c, x, y, Math.max(1, n - 1), r * 0.7, '#ffffff', 1); c.globalAlpha = 1; }); }
  function pillar(R0, x, y, h, w, col, core, dur) { R0.addFx(dur || 0.32, (c, p) => { const e = p < 0.25 ? p / 0.25 : 1, f = p < 0.25 ? 1 : 1 - (p - 0.25) / 0.75, W = w * f; c.save(); c.globalAlpha = 0.5 + f * 0.5; c.fillStyle = col; c.beginPath(); c.moveTo(x - W, y + 4); c.lineTo(x - W * 0.4, y - h * e); c.lineTo(x + W * 0.4, y - h * e); c.lineTo(x + W, y + 4); c.closePath(); c.fill(); c.fillStyle = core; c.beginPath(); c.moveTo(x - W * 0.45, y + 2); c.lineTo(x - W * 0.14, y - h * e); c.lineTo(x + W * 0.14, y - h * e); c.lineTo(x + W * 0.45, y + 2); c.closePath(); c.fill(); c.restore(); }); }

  const HIT = {
    fire(x, y, t, fin) { flash(this, x, y, 18 + t * 2, '#ff9a1c'); burst(this, x, y, { n: 4 + t * 2, r: 22 + t * 3, cols: ['#ffd23a', '#ff8a1c', '#fff6c8'], size: 4.5, up: 10, grav: 14 }); if (t >= 3) ring(this, x, y, 26 + t * 2, '#ffb347', 0.28, 3); if (t >= 5) burst(this, x, y, { n: 6, r: 26, cols: ['#ff7a1c', '#ffd23a'], size: 6, shape: 'streak', dur: 0.26 }); if (fin) { pillar(this, x, y, 58, 16, '#ff7a1c', '#fff2a0'); burst(this, x, y, { n: 16, r: 40, cols: ['#fff6c8', '#ffd23a'], size: 4, up: 26, dur: 0.55 }); } },
    gatling(x, y, t, fin, E) { const pl = t >= 6; burst(this, x, y, { n: 2 + Math.min(t, 3), r: 13 + t, cols: pl ? ['#c8f0ff', '#58b8ff'] : ['#ffd23a', '#ff9a1c'], size: 3, dur: 0.18, shape: 'streak' }); if (t >= 3 && E.fk % 3 === 0) flash(this, x, y, 10 + t, pl ? '#58b8ff' : '#ffb31c', 0.1); if (fin) { rays(this, x, y, 8, 30, pl ? '#c8f0ff' : '#ffe36a', 0.2, 3); ring(this, x, y, 32, pl ? '#9fe0ff' : '#ffc23a', 0.26, 3); } },
    bolt(x, y, t, fin) { flash(this, x, y, 16 + t * 2, '#a77bff', 0.14); jolts(this, x, y, 1 + Math.min(t, 5), 16 + t * 3, '#c8b0ff'); if (t >= 3) burst(this, x, y, { n: 3 + t, r: 22 + t * 2, cols: ['#ffffff', '#d8c8ff'], size: 3, dur: 0.24 }); if (t >= 5) ring(this, x, y, 30, '#c8b0ff', 0.22, 2.4, [5, 5]); if (fin) { jolts(this, x, y, 7, 46, '#a77bff', 0.26); pillar(this, x, y, 74, 7, '#8a5aff', '#ffffff', 0.22); } },
    ice(x, y, t, fin) { flash(this, x, y, 15 + t * 2, '#9fe0ff', 0.14); burst(this, x, y, { n: 3 + t * 2, r: 20 + t * 3, cols: ['#ffffff', '#c8f0ff', '#7fd0ff'], size: 5, shape: 'dia', grav: 22, dur: 0.38 }); if (t >= 3) ring(this, x, y, 26 + t * 2, '#e6f8ff', 0.36, 2.4, [3, 5]); if (t >= 5 || fin) burst(this, x, y, { n: fin ? 10 : 6, a0: 0, r: fin ? 40 : 26, cols: ['#e6f8ff', '#9fe0ff'], size: fin ? 8 : 6, shape: 'streak', dur: 0.32, keep: 1 }); if (fin) rays(this, x, y, 6, 46, '#ffffff', 0.28, 3); },
    poison(x, y, t, fin) { burst(this, x, y, { n: 4 + t, r: 18 + t * 3, cols: ['#7be06a', '#3a9a2a', '#c8ff8a'], size: 5, shape: 'round', grav: 26, dur: 0.36 }); flash(this, x, y, 14 + t * 2, '#5ad03a', 0.18); if (t >= 3) burst(this, x, y, { n: 3 + t, r: 14, cols: ['#c8ff8a', '#e8ffc8'], size: 4, shape: 'round', up: 30, dur: 0.55, keep: 1 }); if (t >= 4) this.addFx(0.7, (c, p) => { for (let j = 0; j < 4; j++) aura(c, x + Math.cos(j * 1.57 + p) * (8 + p * 12), y + Math.sin(j * 1.57 + p) * (4 + p * 6) - p * 8, 12 + p * 13, j % 2 && t >= 5 ? '#8a4ad8' : '#5ad03a', (1 - p) * 0.55); }); if (fin) { ring(this, x, y, 44, '#b07cff', 0.4, 3); burst(this, x, y, { n: 12, r: 44, cols: ['#7be06a', '#b07cff'], size: 5, shape: 'round', dur: 0.5 }); } },
    corrode(x, y, t, fin) { burst(this, x, y, { n: 3 + t, r: 16 + t * 2, cols: ['#d8ff4a', '#8ac81a', '#fbffd0'], size: 5.5, shape: 'round', grav: 46, dur: 0.42 }); flash(this, x, y, 14 + t * 2, '#a8e01a', 0.16); if (t >= 3) this.addFx(0.55, (c, p) => { for (let j = 0; j < 3; j++) aura(c, x + (j - 1) * (5 + p * 5), y - 4 - p * 22, 7 + p * 9, '#5a5a3a', (1 - p) * 0.55); }); if (t >= 4) burst(this, x, y, { n: 5, r: 12, cols: ['#fbffd0'], size: 3, up: 26, dur: 0.3 }); if (t >= 5 || fin) ring(this, x, y, fin ? 44 : 30, '#d8ff4a', 0.34, 3); },
    light(x, y, t, fin) { flash(this, x, y, 20 + t * 2, '#ffe48a', 0.18); rays(this, x, y, t >= 4 ? 8 : 4 + t, 20 + t * 3, '#fff6c8', 0.2, 2.6); if (t >= 3) burst(this, x, y, { n: 3 + t, r: 24, cols: ['#ffffff', '#ffe48a'], size: 4, shape: 'dia', up: 16, dur: 0.4 }); if (t >= 5) pillar(this, x, y, 46, 7, '#ffe48a', '#ffffff', 0.24); if (fin) { pillar(this, x, y, 58, 10, '#ffd86a', '#ffffff', 0.3); ring(this, x, y, 44, '#ffe48a', 0.36, 3); } },
    growth(x, y, t, fin) { flash(this, x, y, 13 + t * 2, '#c8f06a', 0.16); burst(this, x, y, { n: 3 + t * 2, r: 20 + t * 3, cols: ['#7bd03a', '#c8f06a', '#a8e04a'], size: 5.5, shape: 'leaf', grav: 14, dur: 0.5, keep: 1 }); if (t >= 4) burst(this, x, y, { n: 5, r: 22, cols: ['#ffb0d0', '#ffe0ec'], size: 4.5, shape: 'leaf', up: 18, dur: 0.6, keep: 1 }); if (t >= 3) burst(this, x, y, { n: 4, r: 12, cols: ['#fff6a8'], size: 3, shape: 'dia', up: 22, dur: 0.45 }); if (fin) { ring(this, x, y, 44, '#c8f06a', 0.4, 3); burst(this, x, y, { n: 14, a0: 0, r: 42, cols: ['#ffc0d8', '#ffe6f0', '#ffe36a'], size: 6, shape: 'leaf', dur: 0.6, keep: 1 }); } },
    tyrant(x, y, t, fin) { flash(this, x, y, 15 + t * 2, '#b8202e', 0.14); burst(this, x, y, { n: 3 + t, r: 18 + t * 3, cols: ['#e8283a', '#7a0a1a', '#ff5a6a'], size: 5, shape: 'streak', grav: 28, dur: 0.3 }); if (t >= 3) burst(this, x, y, { n: 3 + t, r: 14, cols: ['#b8202e', '#7a0a1a'], size: 4.4, shape: 'round', grav: 40, dur: 0.42 }); if (t >= 4) this.addFx(0.2, (c, p) => { const a = -0.7; c.save(); c.translate(x, y); c.rotate(a); c.globalAlpha = 1 - p; c.fillStyle = '#ff5a6a'; const L = 26 + p * 8, W = 3.4 * (1 - p); c.beginPath(); c.moveTo(-L, 0); c.quadraticCurveTo(0, -W * 2, L, 0); c.quadraticCurveTo(0, W * 2, -L, 0); c.fill(); c.restore(); }); if (fin) { ring(this, x, y, 46, '#e8283a', 0.36, 3.4); burst(this, x, y, { n: 14, r: 44, cols: ['#e8283a', '#1a0a12'], size: 5, shape: 'streak', dur: 0.36 }); this.shake = Math.max(this.shake, 4); } },
    summon(x, y, t, fin) { flash(this, x, y, 14 + t * 2, '#2fc8a8', 0.18); burst(this, x, y, { n: 3 + t, r: 14 + t * 2, cols: ['#b8fff0', '#2fc8a8'], size: 4.4, shape: 'round', up: 28, dur: 0.55, keep: 1 }); if (t >= 3) ring(this, x, y, 24 + t * 2, '#b8fff0', 0.36, 2.2, [3, 6]); if (fin) { pillar(this, x, y, 62, 11, '#2fc8a8', '#d8fff6', 0.4); burst(this, x, y, { n: 12, r: 38, cols: ['#b8fff0', '#ffffff'], size: 4, shape: 'round', up: 20, dur: 0.6 }); } },
    combo(x, y, t, fin) { flash(this, x, y, 13 + t * 2, '#ff5ac8', 0.14); ring(this, x, y, 18 + t * 2, '#ff8adf', 0.24, 3); if (t >= 3) ring(this, x, y, 30 + t * 2, '#ffe0f6', 0.32, 2); if (t >= 2) burst(this, x, y, { n: 2 + t, r: 22, cols: t >= 6 ? RAIN : ['#ffe0f6', '#ff8adf'], size: 4.6, shape: 'dia', dur: 0.32 }); if (fin) { for (let j = 0; j < 3; j++) this.later8 ? this.later8(j * 0.07, () => ring(this, x, y, 44, RAIN[j * 2], 0.3, 3)) : ring(this, x, y, 44, RAIN[j * 2], 0.3, 3); } },
    beacon(x, y, t, fin) { flash(this, x, y, 15 + t * 2, '#ff9a3c', 0.14); burst(this, x, y, { n: 3 + t * 2, r: 18 + t * 3, cols: ['#ffd23a', '#ff8a1c', '#e8452c'], size: 4, up: 14, grav: 20, dur: 0.36 }); if (t >= 3) rays(this, x, y, 6, 20 + t * 2, '#ffe9a8', 0.16, 2.2); if (t >= 4) ring(this, x, y, 30 + t * 2, '#ffb347', 0.3, 2.6); if (t >= 5) burst(this, x, y, { n: 6, r: 26, cols: ['#ff7a1c', '#ffd23a'], size: 6, shape: 'streak', up: 14, dur: 0.3 }); if (fin) { pillar(this, x, y, 66, 13, '#ff7a1c', '#fff2a0', 0.34); burst(this, x, y, { n: 16, r: 42, cols: ['#fff6c8', '#ffb347'], size: 3.6, up: 28, dur: 0.6 }); } },
    mining(x, y, t, fin) { burst(this, x, y, { n: 3 + t, r: 18 + t * 2, cols: ['#8a6a3a', '#c8a878', '#6a4a2a'], size: 5, grav: 44, dur: 0.42 }); flash(this, x, y, 11 + t * 2, t >= 4 ? '#ffc23a' : '#c8a06a', 0.12); if (t >= 3) burst(this, x, y, { n: t + 1, r: 22, cols: ['#ffe36a', '#ffd23a'], size: 3.6, shape: 'dia', up: 14, dur: 0.4 }); if (t >= 5) burst(this, x, y, { n: 5, r: 26, cols: ['#ff7a9a', '#ffe36a', '#fff6c8'], size: 4.4, shape: 'dia', grav: 22, dur: 0.46 }); if (t >= 6) rays(this, x, y, 6, 30, '#fff0b0', 0.2, 2.6); if (fin) ring(this, x, y, 44, '#ffe36a', 0.34, 3); },
    greed(x, y, t, fin, E) { flash(this, x, y, 12 + t * 2, '#ffc81c', 0.13); burst(this, x, y, { n: 3 + t, r: 18 + t * 2, cols: ['#fff6c8', '#ffd23a'], size: 3.8, shape: 'dia', up: 10, dur: 0.32 }); if (this.coinPop9) this.coinPop9(x, y, fin ? 10 : Math.min(5, 1 + Math.floor(t * 0.7)), 110 + t * 8, 230 + t * 16, 0.6); if (t >= 4) ring(this, x, y, 28, '#ffe36a', 0.28, 2.4); if (fin) { rays(this, x, y, 8, 40, '#fff6c8', 0.26, 3); } },
    prism(x, y, t, fin) { flash(this, x, y, 15 + t * 2, '#ffffff', 0.12); burst(this, x, y, { n: 4 + t * 2, r: 22 + t * 3, cols: RAIN, size: 4.4, shape: 'dia', dur: 0.36 }); if (t >= 3) rays(this, x, y, 6, 22 + t * 3, RAIN[Math.floor(Math.random() * 6)], 0.18, 2.4); if (t >= 5) ring(this, x, y, 30, RAIN[Math.floor(Math.random() * 6)], 0.3, 3); if (fin) for (const k of [0, 2, 4]) ring(this, x, y, 34 + k * 5, RAIN[k], 0.36, 2.6); },
  };
  const lastHit = {};
  R.impact = function (e) {
    const t = clamp(e.tier || 1, 1, 6), type = e.type, fin = (e.fn || 0) >= 2 && e.fk === e.fn - 1 && t >= 6, big = !!e.big, f = HIT[type];
    if (!f) return;
    if (!fin && !big && this.time - (lastHit[type] || -9) < (type === 'gatling' ? 0.03 : 0.05)) return;   // 연달아 맞는 탄은 묶는다
    lastHit[type] = this.time;
    if (this.fx.length > 110 && !fin && !big) return;   // 판이 가득할 때
    f.call(this, e.x, e.y, t, fin || big, { fk: e.fk || 0 });
  };

  // ------------------------------------------------------------ 레일건: 빔 굵기는 render9에서 30% 줄임. 대신 빔을 따라 흐르는 효과를 더한다
  const rail0 = R.railBeam;
  R.railBeam = function (pts, tier) {
    rail0.call(this, pts, tier);
    const at = this._railAt, t = clamp(tier || 1, 1, 6); if (!at || !pts || pts.length < 2) return;
    const [ax, ay] = pts[0], [bx, by] = pts[1], L = Math.hypot(bx - ax, by - ay) || 1, dur = 0.16 + t * 0.04, gold = t >= 6, seeds = [];
    const cA = gold ? '#ffe36a' : '#9fe0ff', cB = gold ? '#fff6c8' : '#ffffff';
    for (let j = 0; j < 6 + t * 4; j++) seeds.push([Math.random(), Math.random() * 2 - 1, Math.random()]);
    this.addFx(dur + 0.12, (c, p) => {
      const reach = Math.min(1, p / 0.2 * (dur + 0.12) / dur);
      aura(c, ax, ay, 11 + t * 1.5, cA, (1 - p) * 0.75);
      if (t < 3) { const N = 8; for (const [col, w, al] of [['#58b8ff', 8, 0.35], ['#ffffff', 1.4, 1]]) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.globalAlpha = al * (1 - p * p); c.beginPath(); for (let j = 0; j <= N; j++) { const q = at(j / N * reach, p); j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.stroke(); } c.globalAlpha = 1; }
      // 빔을 따라 흩어지는 파티클
      for (const [u0, sd, h] of seeds) { const u = u0 * reach, q = at(u, p), o = sd * (2 + p * (5 + t * 0.6)); c.globalAlpha = (1 - p) * (0.5 + h * 0.5); c.fillStyle = h > 0.5 ? cB : cA; const S = 2.4 + h * 2.2; c.fillRect(Math.round(q[0] + (by - ay) / L * o) - S / 2, Math.round(q[1] - (bx - ax) / L * o - p * 10 * h) - S / 2, S, S); }
      c.globalAlpha = 1;
      // 3단계: 빔을 감는 전기 · 4단계: 달리는 코일 고리 · 5단계: 양쪽 나선 · 6단계: 금빛 나선 + 끝 폭발
      if (t >= 3) { const N = Math.max(5, Math.ceil(L / 30)); for (const [col, w] of [[cA, 2], [cB, 0.9]]) { c.strokeStyle = col; c.lineWidth = w; c.globalAlpha = 1 - p; c.beginPath(); for (let j = 0; j <= N; j++) { const u = j / N * reach, q = at(u, p), jt = j && j < N ? 5 + t * 0.5 : 0; const X = q[0] + (Math.random() - 0.5) * jt, Y = q[1] + (Math.random() - 0.5) * jt; j ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); } c.globalAlpha = 1; }
      if (t >= 4) { const n = t >= 6 ? 4 : 3; c.strokeStyle = cB; c.lineWidth = 2; for (let j = 0; j < n; j++) { const u = (p * 2.4 + j / n) % 1 * reach, q = at(u, p), r = 4.5 + t * 0.4; c.globalAlpha = (1 - p) * 0.95; c.beginPath(); c.ellipse(q[0], q[1], r * 0.55, r, Math.atan2(by - ay, bx - ax), 0, TAU); c.stroke(); } c.globalAlpha = 1; }
      if (t >= 5) for (const sd of [-1, 1]) { c.strokeStyle = gold ? '#ffd23a' : '#58b8ff'; c.lineWidth = 1.5; c.globalAlpha = 1 - p; c.beginPath(); const N = Math.max(10, Math.ceil(L / 14)); for (let j = 0; j <= N; j++) { const u = j / N * reach, q = at(u, p), o = sd * Math.sin(u * L / 16 - p * 26) * (3 + t * 0.3); const X = q[0] + (by - ay) / L * o, Y = q[1] - (bx - ax) / L * o; j ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); c.globalAlpha = 1; }
    });
    // 맞는 자리: 빛 · 파편(뚫고 지나간 자리마다 작게)
    flash(this, bx, by, 13 + t * 1.5, cA, 0.16); rays(this, bx, by, 6, 16 + t * 2, cB, 0.18, 2); burst(this, bx, by, { n: 4 + t * 2, r: 15 + t * 2, cols: [cB, cA], size: 3, shape: 'streak', dur: 0.26 });
    if (t >= 3) ring(this, bx, by, 16 + t * 2, cA, 0.26, 2);
    for (const q of pts.slice(2, 5)) { flash(this, q[0], q[1], 9, cA, 0.12); burst(this, q[0], q[1], { n: 3, r: 11, cols: [cB, cA], size: 2.6, shape: 'streak', dur: 0.2 }); }
    if (t >= 6) { jolts(this, bx, by, 4, 22, '#ffe36a', 0.2); this.shake = Math.max(this.shake, 3); }
  };
  // ------------------------------------------------------------ 쏘는 순간: 옛 번쩍(네모 블록 · 큰 원 · 십자)은 끄고 탑 색의 작은 빛 + 파편만. 자세 · 반동 상태는 옛 코드 그대로
  const MZ = { fire: ['#ff9a1c', '#ffd23a'], gatling: ['#ffb31c', '#fff0a8'], bolt: ['#8a5aff', '#e8dcff'], ice: ['#7fd0ff', '#ffffff'], poison: ['#4ac02a', '#c8ff8a'], corrode: ['#a8e01a', '#fbffd0'], light: ['#ffd86a', '#ffffff'], growth: ['#a8e04a', '#fff6a8'], tyrant: ['#b8202e', '#ff8a9a'], summon: ['#2fc8a8', '#d8fff6'], combo: ['#ff5ac8', '#ffe0f6'], beacon: ['#ff8a1c', '#ffe9a8'], railgun: ['#58b8ff', '#ffffff'], mining: ['#c8a06a', '#ffe36a'], greed: ['#ffc81c', '#fff6c8'], prism: ['#b07cff', '#ffffff'] };
  R.tipFlash10 = function (type, tier, x, y, tx, ty) {
    const col = MZ[type] || MZ.light, t = clamp(tier || 1, 1, 6), a = Math.atan2((ty == null ? y : ty) - y, (tx == null ? x + 1 : tx) - x);
    flash(this, x, y, 13 + Math.min(t, 4) * 2, col[0], 0.12);
    if (this.fx.length > 90) return;
    burst(this, x, y, { n: 2 + Math.min(t, 4), a0: a - 0.6, arc: 1.2, r: 14 + t * 2, cols: [col[1], col[0]], size: 3, shape: 'streak', dur: 0.16 });
    if (t >= 5) ring(this, x, y, 18, col[1], 0.18, 2);
    if (type === 'gatling' && t >= 3) burst(this, x, y + 4, { n: Math.min(3, t - 1), a0: a + Math.PI - 0.5, arc: 1, r: 16, cols: ['#e8c060', '#a8843a'], size: 3, grav: 30, dur: 0.4, keep: 1 });   // 탄피
  };
  const muzzle0 = R.muzzle;
  R.muzzle = function (e) {
    const af = this.addFx, pt = this.part, sp = this.sprite, gl = this.glow;
    this.addFx = () => {}; this.part = () => {}; this.sprite = () => {}; this.glow = () => {};
    try { muzzle0.call(this, e); } finally { this.addFx = af; this.part = pt; this.sprite = sp; this.glow = gl; }
    const tw = this._game && this._game.tiles[e.i] && this._game.tiles[e.i].tower;
    if (this.hasPose10 && this.hasPose10(tw)) return;   // 자세 포탑은 무기 끝(weaponFx)에서
    const q = this._mz9 || [e.x, e.y];
    this.tipFlash10(e.type, e.tier, q[0], q[1], e.tx, e.ty);
  };
  // 5 · 6단계 무기 끝 연출 → 같은 작은 빛(주기 공격은 조금 크게)
  R.weaponFx = function (game, e, tw, tip, big) {
    if (!tw) return;
    this.tipFlash10(tw.type, tw.tier, tip[0], tip[1], e.tx, e.ty);
    if (big) { const col = MZ[tw.type] || MZ.light; rays(this, tip[0], tip[1], 8, 30, col[1], 0.24, 3); ring(this, tip[0], tip[1], 34, col[0], 0.3, 3); }
  };
  // 성광 빛줄기: 굵은 외곽선 곡선 → 가는 빛 + 끝 반짝
  R.beam = function (e) {
    const sub = !!e.sub, t = clamp(e.tier || 4, 1, 6), x0 = e.x, y0 = e.y, x1 = e.tx, y1 = e.ty;
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L, bend = (Math.random() * 2 - 1) * Math.min(26, L * 0.14), K = sub ? 0.6 : 1;
    const pt = (u, p) => { const w = bend * (1 + 0.3 * Math.sin(p * 26)) * Math.sin(u * Math.PI); return [x0 + (x1 - x0) * u + nx * w, y0 + (y1 - y0) * u + ny * w]; };
    if (!sub) flash(this, x0, y0, 16, '#ffe48a', 0.12);
    this.addFx(0.24, (c, p) => {
      const reach = Math.min(1, p / 0.3), N = 14;
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.globalAlpha = p > 0.5 ? (1 - p) / 0.5 : 1;
      for (const [col, w] of [['rgba(255,200,70,0.55)', 7], ['#ffe48a', 3.4], ['#ffffff', 1.5]]) { c.strokeStyle = col; c.lineWidth = w * K * (1 - p * 0.4); c.beginPath(); for (let j = 0; j <= N; j++) { const q = pt(j / N * reach, p); j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.stroke(); }
      c.restore();
      if (reach < 1) { const h = pt(reach, p); glint(c, h[0], h[1], 11 * K, p * 8, '#ffffff'); }
    });
    if (this.later8) this.later8(0.08, () => { flash(this, x1, y1, 20 * K, '#ffe48a', 0.14); rays(this, x1, y1, 6, 26 * K, '#fff6c8', 0.2, 2.2); burst(this, x1, y1, { n: 5, r: 20, cols: ['#ffffff', '#ffe48a'], size: 3.4, shape: 'dia', up: 14, dur: 0.35 }); });
  };
  // ------------------------------------------------------------ 사거리 표시: 사용자 'PPT에서 대충 만든 듯한 퀄리티' → 흰 테두리 띠 · 점선 대신
  // 탑에서 양쪽으로 펼쳐지는 빛의 길(가장자리가 부드럽고 끝으로 갈수록 옅어짐) + 바깥으로 흐르는 화살 무늬 + 끝 표지 + 사거리 안 몬스터 표시 + 탑 발밑 도는 고리
  R.drawRange = function (c, game) {
    const sel = this.sel; if (sel == null) return;
    const tl = game.tiles[sel]; if (!tl || !tl.tower) { this.sel = null; return; }
    const G = root.GEOM, T = this.time, age = clamp((T - (this.selT || 0)) / 0.28, 0, 1), a = 1 - (1 - age) * (1 - age) * (1 - age);
    const r = Math.min(12, game.rangeOf(sel)), R0 = r + 0.5, reach = R0 * a, col = (root.DATA.TOWERS[tl.tower.type] || {}).color || '#ffffff';
    const step = 1 / 5, n = Math.max(2, Math.ceil(reach / step));
    const win = u => { const e = 1 - Math.abs(u); return clamp(e / 0.16, 0, 1) * (0.55 + 0.45 * e); };   // 끝에서 사라지고 탑 가까이 진함
    const quad = (u0, u1, w, al) => {
      const f0 = sel + u0 * reach, f1 = sel + u1 * reach, A = G.lanePoint(f0, -w), B = G.lanePoint(f1, -w), C = G.lanePoint(f1, w), D0 = G.lanePoint(f0, w);
      c.globalAlpha = al; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(C[0], C[1]); c.lineTo(D0[0], D0[1]); c.closePath(); c.fill();
    };
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    // 빛의 길: 폭이 다른 세 겹을 겹쳐 가장자리를 부드럽게
    c.fillStyle = '#fff6e0';   // 어두운 길 위에서도 탑 색이 보이게 먼저 밝게 들어 올림
    for (let j = -n; j < n; j++) { const u0 = j / n, u1 = (j + 1) / n; quad(u0 - 0.002, u1 + 0.002, 1.28, 0.3 * win((u0 + u1) / 2)); }
    c.fillStyle = col;
    for (const [w, al] of [[1.34, 0.2], [1.1, 0.22], [0.74, 0.16]]) for (let j = -n; j < n; j++) { const u0 = j / n, u1 = (j + 1) / n; quad(u0 - 0.002, u1 + 0.002, w, al * win((u0 + u1) / 2)); }
    // 양쪽 가장자리 빛줄(끊기지 않고 끝으로 갈수록 옅어짐)
    for (const [lc, lw, la] of [[col, 4.4, 0.75], ['#ffffff', 1.8, 0.9]]) { c.strokeStyle = lc; c.lineWidth = lw; for (const sd of [-1, 1]) for (let j = -n; j < n; j++) { const u = (j + 0.5) / n, f0 = sel + j / n * reach, f1 = sel + (j + 1) / n * reach, A = G.lanePoint(f0, sd * 1.24), B = G.lanePoint(f1, sd * 1.24); c.globalAlpha = la * win(u); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke(); } }
    // 바깥으로 흐르는 화살 무늬
    const gap = 0.62, flow = (T * 0.75) % gap;
    for (const dir of [-1, 1]) for (let d = flow; d < reach - 0.1; d += gap) {
      const f = sel + dir * d, u = d / R0, al = clamp((reach - d) / 0.5, 0, 1) * clamp(d / 0.4, 0, 1);
      const tip = G.lanePoint(f + dir * 0.16, 0), L = G.lanePoint(f - dir * 0.05, -0.52), Rr = G.lanePoint(f - dir * 0.05, 0.52);
      c.globalAlpha = 0.85 * al * (1 - u * 0.45);
      c.strokeStyle = col; c.lineWidth = 5; c.beginPath(); c.moveTo(L[0], L[1]); c.lineTo(tip[0], tip[1]); c.lineTo(Rr[0], Rr[1]); c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.moveTo(L[0], L[1]); c.lineTo(tip[0], tip[1]); c.lineTo(Rr[0], Rr[1]); c.stroke();
    }
    // 끝 표지: 길을 가로지르는 빛 + 양쪽 기둥
    for (const dir of [-1, 1]) {
      const f = sel + dir * reach, pulse = 0.75 + 0.25 * Math.sin(T * 5);
      c.globalAlpha = 0.95 * a; c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); for (let k = 0; k <= 6; k++) { const q = G.lanePoint(f, -1.25 + k * 2.5 / 6); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.2; c.stroke();
      for (const sd of [-1, 1]) {
        const q = G.lanePoint(f, sd * 1.25), g = q[2] || 1, h = 15 * g, bob = Math.sin(T * 4 + sd) * 1.5;
        aura(c, q[0], q[1] - h * 0.5, 13 * g * pulse, col, 0.75 * a);
        c.globalAlpha = a; c.fillStyle = '#2b1426'; c.beginPath(); c.moveTo(q[0], q[1] - h - 5 + bob); c.lineTo(q[0] + 5.2, q[1] - h * 0.5 + bob); c.lineTo(q[0], q[1] + 1 + bob); c.lineTo(q[0] - 5.2, q[1] - h * 0.5 + bob); c.closePath(); c.fill();
        c.fillStyle = col; c.beginPath(); c.moveTo(q[0], q[1] - h - 2.5 + bob); c.lineTo(q[0] + 3.4, q[1] - h * 0.5 + bob); c.lineTo(q[0], q[1] - 1.5 + bob); c.lineTo(q[0] - 3.4, q[1] - h * 0.5 + bob); c.closePath(); c.fill();
        c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(q[0], q[1] - h - 1 + bob); c.lineTo(q[0] + 1.6, q[1] - h * 0.6 + bob); c.lineTo(q[0] - 1.6, q[1] - h * 0.6 + bob); c.closePath(); c.fill();
      }
    }
    // 사거리 안 몬스터: 발밑 고리
    c.lineWidth = 2.4; c.strokeStyle = '#ffffff';
    for (const m of game.monsters) { if (!m.alive) continue; const d = ((m.f - sel + 12) % 24 + 24) % 24 - 12; if (Math.abs(d) > reach) continue; const g = m.g || 1; c.globalAlpha = 0.75 * a; c.strokeStyle = col; c.lineWidth = 3.4; c.beginPath(); c.ellipse(m.x, m.y + 2, 17 * g, 7.5 * g, 0, 0, TAU); c.stroke(); c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.stroke(); }
    c.restore();
    // 탑 발밑: 부드러운 빛 + 서로 반대로 도는 고리
    const [x, y] = G.tiles[sel].tower, sc = G.tiles[sel].scale, RX = 34 * sc * (0.7 + a * 0.3), RY = 14 * sc * (0.7 + a * 0.3);
    aura(c, x, y + 2, RX * 1.5, col, 0.55 * a, 0.42);
    c.save(); c.globalAlpha = a;
    c.strokeStyle = '#2b1426'; c.globalAlpha = 0.35 * a; c.lineWidth = 7; c.beginPath(); c.ellipse(x, y + 2, RX, RY, 0, 0, TAU); c.stroke(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = 4.6; c.setLineDash([RX * 0.62, RX * 0.3]); c.lineDashOffset = -T * 26; c.beginPath(); c.ellipse(x, y + 2, RX, RY, 0, 0, TAU); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.8; c.setLineDash([RX * 0.3, RX * 0.42]); c.lineDashOffset = T * 40; c.beginPath(); c.ellipse(x, y + 2, RX * 1.14, RY * 1.14, 0, 0, TAU); c.stroke();
    c.restore();
  };
})(window);
