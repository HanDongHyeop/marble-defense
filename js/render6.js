// v4.4 층(Renderer에 덧붙임) — 사용자 피드백(판 칸 · 칸 그림 · 말 크기 · 도착 표시 · 몬스터 굴 · 포탑 주변 연출)
// · 판 칸 = 코드로 판 그림 위에 다시 그린다: 칸 사이 홈 → 살짝 솟은 칸(앞 두 면 + 윗면). 판 그림에서 가운데 잔디가 칸을 덮어 잘려 보이던 문제를 구조적으로 없앰
// · 칸 그림 = 칸 바탕색 자체가 바뀌고(좋은 땅 = 밝은 색 + 금 테, 나쁜 땅 = 어두운 색 + 금 간 자국) 상징은 칸에 인쇄된 것처럼(황금열쇠 · 우주여행 칸과 같은 방식)
// · 도착 예고 · 지나는 칸 = 그 칸 윗면 모양 그대로
// · 몬스터가 나오는 길 아래 꼭짓점 = 어두운 굴
// · 4단계부터 포탑 주변 연출(종류마다 다름): 4 = 바닥에 깔리는 기운, 5 = 빛나는 조각 조금, 6 = 무지갯빛 조각 더 많이
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA, TSZ = root.Renderer.TSZ;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PAWN_COL = { car: '#e8453c', dog: '#3f7fe0', hat: '#f2c62a', boat: '#f08a24', boot: '#4fb84a', cat: '#a05ae0' };
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgb = (a, k) => `rgb(${a.map(v => Math.round(clamp(v * k, 0, 255))).join(',')})`;
  const tint = (a, k) => `rgb(${a.map(v => Math.round(v + (255 - v) * k)).join(',')})`;

  // ------------------------------------------------------------ 판 칸
  // 장마다 평칸 색(판 그림의 칸 색에서 뽑음) · 칸 사이 홈 색
  const PLAIN = { board: '#e2c6a8', board_ch2: '#bcd8e6', board_ch3: '#d6b69c', board_ch4: '#e2c2a6', board_ch5: '#d6c2a6', board_ch6: '#d0aac8' };
  const GROUT = { board: '#4a2a2e', board_ch2: '#3a4a66', board_ch3: '#2e1e24', board_ch4: '#3a2a30', board_ch5: '#3a3020', board_ch6: '#3a2042' };
  // 특별 칸 · 땅 속성 칸 바탕색(칸 그림 시트 tiles44에서 뽑음) · 상징 그림(i44_*)
  const SPECIAL = {
    start: ['#5aa660', 'flag'], island: ['#4a98d8', 'island'], key: ['#fcc832', 'key'], space: ['#b48ccc', 'rocket'],
    arms: ['#c8364f', 'arms'], drill: ['#ee8035', 'drill'], watch: ['#48a6a6', 'watch'], holy: ['#fbf1cc', 'holy'], gold: ['#c99040', 'gold'],
    luck: ['#6dbd43', 'luck'], choke: ['#6cb8ea', 'choke'], fog: ['#5e5874', 'fog'], web: ['#553a72', 'web'], target: ['#64304e', 'target'],
  };
  const INS = 0.05;                 // 칸 사이 홈(판 단위, 한쪽)
  const LIFT = 4;                   // 칸이 솟은 높이(px, 가까운 쪽 기준)

  // 칸 i 윗면 네 점(위 · 오른 · 아래 · 왼 순서 = (u0,v0) (u1,v0) (u1,v1) (u0,v1)) — lift = 위로 들린 px
  R.tileTop = function (i, lift, ins) {
    const [u0, u1, v0, v1] = G.tileRect(i), e = ins == null ? INS : ins, s = G.tiles[i].tscale, h = (lift == null ? LIFT : lift) * s;
    return [[u0 + e, v0 + e], [u1 - e, v0 + e], [u1 - e, v1 - e], [u0 + e, v1 - e]].map(([U, V]) => { const p = G.P(U, V); return [p[0], p[1] - h]; });
  };
  R.roundPoly = function (c, q, r) {
    c.beginPath();
    const n = q.length;
    for (let k = 0; k < n; k++) {
      const a = q[(k + n - 1) % n], b = q[k], d = q[(k + 1) % n];
      const la = Math.hypot(a[0] - b[0], a[1] - b[1]), ld = Math.hypot(d[0] - b[0], d[1] - b[1]), rr = Math.min(r, la * 0.4, ld * 0.4);
      const p1 = [b[0] + (a[0] - b[0]) / la * rr, b[1] + (a[1] - b[1]) / la * rr], p2 = [b[0] + (d[0] - b[0]) / ld * rr, b[1] + (d[1] - b[1]) / ld * rr];
      if (k) c.lineTo(p1[0], p1[1]); else c.moveTo(p1[0], p1[1]);
      c.quadraticCurveTo(b[0], b[1], p2[0], p2[1]);
    }
    c.closePath();
  };
  // 칸 윗면 안의 (s, t) ∈ [0,1]² 점(쌍선형)
  const at = (q, s, t) => {
    const x = (q[0][0] * (1 - s) + q[1][0] * s) * (1 - t) + (q[3][0] * (1 - s) + q[2][0] * s) * t;
    const y = (q[0][1] * (1 - s) + q[1][1] * s) * (1 - t) + (q[3][1] * (1 - s) + q[2][1] * s) * t;
    return [x, y];
  };
  const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };

  R.tileKind = function (game, i) {
    const cn = D.CORNER[i]; if (cn) return cn;
    const tr = game && game.tiles[i] && game.tiles[i].trait; return tr || null;
  };
  R.drawBoardTiles = function (c, game) {
    const bk = this.boardKey || 'board';
    // 1) 칸 고리 전체를 홈 색으로(판 그림의 칸 · 잔디 겹침을 덮음)
    const O = G.O, b = G.CFG.b, out = G.ringPoly(O), inn = G.ringPoly(O + b);
    c.save(); c.fillStyle = GROUT[bk] || GROUT.board; c.beginPath();
    out.forEach((p, n) => n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
    inn.slice().reverse().forEach((p, n) => n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
    c.fill('evenodd');
    // 고리 안쪽 가장자리 = 광장 잔디가 칸 홈 아래로 들어가는 얇은 그늘(칸이 잔디 위에 놓인 느낌)
    c.strokeStyle = 'rgba(20,10,16,0.35)'; c.lineWidth = 3; c.beginPath(); inn.forEach((p, n) => n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
    c.restore();
    // 2) 칸(뒤 → 앞 순서: 화면 y)
    const order = [...Array(24).keys()].sort((a, b2) => G.tiles[a].center[1] - G.tiles[b2].center[1]);
    for (const i of order) this.drawOneTile(c, game, i, bk);
  };
  R.drawOneTile = function (c, game, i, bk) {
    const kind = this.tileKind(game, i), sp = kind && SPECIAL[kind], T = kind && D.TRAITS[kind];
    const col = hex(sp ? sp[0] : (PLAIN[bk] || PLAIN.board)), bad = T && !T.good, good = T && T.good;
    const B = this.tileTop(i, 0), Tq = this.tileTop(i), s = G.tiles[i].tscale;
    c.save(); c.lineJoin = 'round';
    // 앞 두 면(오른쪽 아래 면 = 더 어둡게)
    const face = (a, b2, k) => { c.fillStyle = rgb(col, k); c.beginPath(); c.moveTo(Tq[a][0], Tq[a][1]); c.lineTo(Tq[b2][0], Tq[b2][1]); c.lineTo(B[b2][0], B[b2][1]); c.lineTo(B[a][0], B[a][1]); c.closePath(); c.fill(); };
    face(2, 3, 0.62); face(1, 2, 0.5);
    // 바깥 윤곽(윗면 + 앞면 실루엣)
    c.strokeStyle = '#2b1426'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(Tq[0][0], Tq[0][1]); c.lineTo(Tq[1][0], Tq[1][1]); c.lineTo(B[1][0], B[1][1]); c.lineTo(B[2][0], B[2][1]); c.lineTo(B[3][0], B[3][1]); c.lineTo(Tq[3][0], Tq[3][1]); c.closePath(); c.stroke();
    // 윗면
    this.roundPoly(c, Tq, 3 * s); c.fillStyle = rgb(col, 1); c.fill();
    c.save(); this.roundPoly(c, Tq, 3 * s); c.clip();
    // 밝은 테(위 · 왼 모서리) · 어두운 테(아래 · 오른 모서리)
    c.lineWidth = 2.2 * s;
    c.strokeStyle = tint(col, 0.32); c.beginPath(); c.moveTo(...at(Tq, 0.02, 0.98)); c.lineTo(...at(Tq, 0.02, 0.02)); c.lineTo(...at(Tq, 0.98, 0.02)); c.stroke();
    c.strokeStyle = rgb(col, 0.8); c.beginPath(); c.moveTo(...at(Tq, 0.98, 0.04)); c.lineTo(...at(Tq, 0.98, 0.98)); c.lineTo(...at(Tq, 0.04, 0.98)); c.stroke();
    if (!sp) {   // 평칸: 돌 반점
      c.fillStyle = rgb(col, 0.86);
      for (let k = 0; k < 6; k++) { const p = at(Tq, 0.15 + hash(i, k) * 0.7, 0.15 + hash(i, k + 9) * 0.7); c.fillRect(Math.round(p[0]), Math.round(p[1]), 2, 2); }
    }
    if (good) {   // 좋은 땅: 안쪽 금 테
      c.strokeStyle = '#ffe08a'; c.lineWidth = 1.6 * s; c.globalAlpha = 0.95;
      const g = [at(Tq, 0.1, 0.1), at(Tq, 0.9, 0.1), at(Tq, 0.9, 0.9), at(Tq, 0.1, 0.9)]; this.roundPoly(c, g, 2 * s); c.stroke(); c.globalAlpha = 1;
    }
    if (bad) {    // 나쁜 땅: 가장자리 어둡게 + 금 간 자국
      c.strokeStyle = 'rgba(16,6,20,0.55)'; c.lineWidth = 5 * s; this.roundPoly(c, Tq, 3 * s); c.stroke();
      c.strokeStyle = 'rgba(16,6,20,0.8)'; c.lineWidth = 1.3 * s;
      for (const [s0, t0, s1, t1, s2, t2] of [[0, 0.3, 0.16, 0.36, 0.22, 0.28], [1, 0.62, 0.84, 0.7, 0.8, 0.82], [0.4, 1, 0.46, 0.84, 0.36, 0.78]]) {
        c.beginPath(); c.moveTo(...at(Tq, s0, t0)); c.lineTo(...at(Tq, s1, t1)); c.lineTo(...at(Tq, s2, t2)); c.stroke();
      }
    }
    c.restore();
    // 상징(칸에 인쇄 — 세운 그림을 윗면 안에, 살짝 눕혀서)
    if (sp) {
      const im = this.I('i44_' + sp[1]);
      if (im) {
        const cx = (Tq[0][0] + Tq[1][0] + Tq[2][0] + Tq[3][0]) / 4, cy = (Tq[0][1] + Tq[1][1] + Tq[2][1] + Tq[3][1]) / 4;
        const W = Math.max(...Tq.map(p => p[0])) - Math.min(...Tq.map(p => p[0])), H = Math.max(...Tq.map(p => p[1])) - Math.min(...Tq.map(p => p[1]));
        const corner = !!D.CORNER[i], k = Math.min(W * (corner ? 0.5 : 0.46) / im.width, H * (corner ? 0.9 : 0.84) / (im.height * 0.86));
        const w = im.width * k, h = im.height * k * 0.86;
        c.globalAlpha = bad ? 0.92 : 1;
        c.drawImage(im, cx - w / 2, cy - h * 0.55, w, h);
      }
    }
    c.restore();
  };
  // 칸 칠하기 · 테 = 윗면 모양 그대로(도착 예고 · 지나는 칸 · 칸 고르기)
  R.tileFill = function (c, i, col) { this.roundPoly(c, this.tileTop(i), 3 * G.tiles[i].tscale); c.fillStyle = col; c.fill(); };
  R.tileStroke = function (c, i, col, w) { this.roundPoly(c, this.tileTop(i), 3 * G.tiles[i].tscale); c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(); };

  // ------------------------------------------------------------ 몬스터 굴(길 아래 꼭짓점 = 몬스터가 나오는 곳)
  R.drawDen = function (c) {
    const p = G.lanePoint(0, 0), x = p[0], y = p[1] + 4, s = p[2], t = this.time, rx = 46 * s, ry = 19 * s;
    c.save();
    // 둘레 그늘(흙이 꺼진 자리)
    const g = c.createRadialGradient(x, y, ry * 0.3, x, y, rx * 1.5); g.addColorStop(0, 'rgba(26,8,30,0.55)'); g.addColorStop(1, 'rgba(26,8,30,0)');
    c.fillStyle = g; c.save(); c.translate(x, y); c.scale(1, ry / rx); c.beginPath(); c.arc(0, 0, rx * 1.5, 0, TAU); c.fill(); c.restore();
    // 돌 테두리
    for (let k = 0; k < 11; k++) {
      const a = k / 11 * TAU + 0.2, bx = x + Math.cos(a) * rx * 1.02, by = y + Math.sin(a) * ry * 1.02, r = (4 + hash(k, 3) * 3) * s;
      c.fillStyle = '#2b1426'; c.beginPath(); c.ellipse(bx, by + 1, r + 1.5, (r + 1.5) * 0.7, 0, 0, TAU); c.fill();
      c.fillStyle = k % 3 ? '#6a5560' : '#7d6670'; c.beginPath(); c.ellipse(bx, by, r, r * 0.68, 0, 0, TAU); c.fill();
    }
    // 구멍(깊이 = 안쪽으로 갈수록 어둡게) + 천천히 도는 보라 소용돌이
    c.fillStyle = '#1a0a1e'; c.beginPath(); c.ellipse(x, y, rx * 0.9, ry * 0.9, 0, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.ellipse(x, y, rx * 0.88, ry * 0.88, 0, 0, TAU); c.clip();
    c.translate(x, y); c.scale(1, ry / rx);
    for (let k = 0; k < 3; k++) {
      c.rotate(t * (0.6 + k * 0.25) + k * 2.1);
      c.strokeStyle = `rgba(${150 - k * 30},${70 - k * 15},${190 - k * 30},${0.5 - k * 0.12})`; c.lineWidth = (5 - k) * s;
      c.beginPath(); c.arc(0, 0, rx * (0.72 - k * 0.2), 0, Math.PI * 1.1); c.stroke();
    }
    c.restore();
    const gl = c.createRadialGradient(x, y, 1, x, y, rx * 0.6); gl.addColorStop(0, `rgba(170,80,220,${0.35 + 0.15 * Math.sin(t * 2.4)})`); gl.addColorStop(1, 'rgba(170,80,220,0)');
    c.fillStyle = gl; c.save(); c.translate(x, y); c.scale(1, ry / rx); c.beginPath(); c.arc(0, 0, rx * 0.6, 0, TAU); c.fill(); c.restore();
    // 굴 밖으로 피어오르는 검은 김(천천히)
    for (let k = 0; k < 5; k++) {
      const ph = (t * 0.35 + k / 5) % 1, px = x + Math.sin(k * 2.3 + t * 0.7) * rx * 0.5, py = y - ph * 34 * s, r = (6 + ph * 9) * s;
      c.globalAlpha = 0.32 * Math.sin(ph * Math.PI); c.fillStyle = '#2a1030'; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
    }
    c.restore();
  };

  // ------------------------------------------------------------ drawTiles 대체(render4 것에서 땅 문양 스프라이트를 빼고 판 칸 · 굴을 먼저)
  R.drawTiles = function (c, game) {
    const t = this.time;
    this.drawBoardTiles(c, game);
    this.drawDen(c);
    for (const tl of game.tiles) {
      if (tl.corner) continue;
      const i = tl.i;
      if (!tl.tower) { this.pointer(c, i, '#fff4d6', 0.45); continue; }
      if (game.zoneFull(tl.zone)) this.footRing(c, i, '#ffe28a', 0.5 + 0.2 * Math.sin(t * 4), 3);
      if (tl.warn) this.footRing(c, i, '#ff3030', 0.5 + 0.3 * Math.sin(t * 10), 4);
      if (tl.occ) this.footRing(c, i, '#c050ff', 0.6, 4);
      const tw = tl.tower;
      if (tw.tier >= 5) {   // 5 · 6단계 발밑 마법진(천천히 돎) — 사용자 '5 · 6성 아래 별 문양 모션은 유지'
        const [x, y] = G.tiles[i].tower, s = G.tiles[i].scale * TSZ[tw.tier], col = D.TIER.ring[tw.tier];
        c.save(); c.translate(x, y); c.scale(1, 0.42); c.rotate(t * (tw.tier >= 6 ? 0.9 : 0.5) + i);
        c.globalAlpha = 0.55; c.strokeStyle = col; c.lineWidth = 2.5;
        c.beginPath(); c.arc(0, 0, 40 * s, 0, TAU); c.stroke();
        if (tw.tier >= 6) { c.beginPath(); c.arc(0, 0, 31 * s, 0, TAU); c.stroke(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6; c.beginPath(); c.moveTo(Math.cos(a) * 31 * s, Math.sin(a) * 31 * s); c.lineTo(Math.cos(a + 2.1) * 31 * s, Math.sin(a + 2.1) * 31 * s); c.stroke(); } }
        else for (let k = 0; k < 4; k++) { const a = k * TAU / 4; c.fillStyle = col; c.fillRect(Math.cos(a) * 40 * s - 3, Math.sin(a) * 40 * s - 3, 6, 6); }
        c.restore();
      }
    }
    if (game.pick) for (const i of game.pick.tiles) {
      const k = 0.28 + 0.14 * Math.sin(t * 6 + i);
      if (game.pick.kind === 'swap') { if (G.tiles[i].corner) continue; this.pointer(c, i, '#ffd23a', 0.6 + k, 16); }
      else { c.save(); c.globalAlpha = k; this.tileFill(c, i, '#fff6c8'); c.restore(); this.tileStroke(c, i, '#ffd23a', 3); }
    }
    // 도착할 칸 예고(그 칸 윗면 모양 그대로) + 그 칸의 포탑 자리 표지
    const P = game.pawn;
    if (P.moving && P.path.length && !P.fast) {
      const j = P.path[P.path.length - 1], k = 0.5 + 0.5 * Math.sin(t * (8 + 14 / P.path.length));
      c.save(); c.globalAlpha = 0.3 + 0.3 * k; this.tileFill(c, j, '#fff1a0'); c.restore();
      this.tileStroke(c, j, '#2b1426', 5); this.tileStroke(c, j, '#ffd23a', 2.5);
      if (!G.tiles[j].corner && !game.tiles[j].tower) this.pointer(c, j, '#ffd23a', 0.5 + 0.4 * k, 11 + 3 * k);
    }
    for (const tl of game.tiles) {
      const tw = tl.tower; if (!tw) continue;
      const col = game.t < (tw.barrageUntil || 0) ? '#ffc23a' : game.t < (tw.blessUntil || 0) ? '#fff2a0' : game.t < game.cheerUntil ? '#ff8adf' : game.t < (tw.carUntil || 0) ? (PAWN_COL[game.pawnId] || '#ffd23a') : null;
      if (!col) continue;
      const [x, y] = G.tiles[tl.i].tower, s = G.tiles[tl.i].scale * TSZ[tw.tier];
      c.save(); c.translate(x, y); c.scale(1, 0.42); c.rotate(t * 2.4 + tl.i);
      c.strokeStyle = col; c.lineWidth = 5; c.setLineDash([14, 10]); c.globalAlpha = 0.85; c.beginPath(); c.arc(0, 0, 40 * s, 0, TAU); c.stroke(); c.restore();
    }
    this.drawTrayDice(c, game);
  };

  // ------------------------------------------------------------ 말: 칸 크기에 맞게(칸이 커진 만큼이 아니라 칸 안에 들어오게) · 서 있는 칸 고리 = 칸 윗면
  const PAWN_K = 0.8;
  const baseDrawHero = R.drawHero;
  R.drawHero = function (c, p, key, scale, ring, mini) {
    const M = root.MANIFEST[key], q = this.pawnPose(p, scale), im = this.I(key); if (!im || !M) return null;
    q.y -= LIFT * scale;   // 칸이 솟은 만큼 위에 선다
    const s = 0.5 * scale * PAWN_K * (mini ? 0.86 : 1), w = M.w * s, h = M.h * s, foot = M.foot * s;
    c.save(); c.globalAlpha = 0.32 - Math.min(0.18, q.jump * 0.006); c.fillStyle = '#1a0e14'; c.beginPath(); c.ellipse(q.x, q.y + 1, Math.max(4, w * 0.34 - q.jump * 0.2), w * 0.12, 0, 0, TAU); c.fill(); c.restore();
    if (!p.moving && ring) { const k = 0.5 + 0.5 * Math.sin(this.time * 5); c.save(); c.globalAlpha = 0.45 + 0.35 * k; this.tileStroke(c, p.tile, '#2b1426', 4.5); this.tileStroke(c, p.tile, ring, 2.2); c.restore(); }
    c.save(); c.translate(q.x, q.y - q.jump); c.rotate(q.lean); c.scale(q.sx, q.sy);
    c.drawImage(im, -w / 2, -foot, w, h);
    c.restore();
    return [q.x, q.y - q.jump - foot - 6];
  };
  void baseDrawHero;

  // ------------------------------------------------------------ 포탑 주변 연출(4단계부터, 종류마다 다름)
  // 4 = 발밑에 깔리는 기운(작게) · 5 = 그 위에 빛나는 조각 조금 · 6 = 무지갯빛으로 반짝이는 조각 더 많이 + 발밑 기운 더 넓게
  // 상태 없는 계산(시간 · 번호로 위치를 정함) — 입자 목록을 늘리지 않고, 화면 밖 캔버스도 쓰지 않는다(아이폰 방어)
  const AMB = {
    fire:    { g: 'glow', gc: '#ff7a2a', p: 'ember', m: 'rise', c: ['#ffe48a', '#ffb43a', '#ff6a2a'] },
    ice:     { g: 'mist', gc: '#cfefff', p: 'crystal', m: 'drift', c: ['#ffffff', '#cfefff', '#8fd4ff'] },
    poison:  { g: 'mist', gc: '#7be06a', p: 'bubble', m: 'rise', c: ['#c6ff9a', '#7be06a', '#b07cff'] },
    gatling: { g: 'smoke', gc: '#8a8a7a', p: 'spark', m: 'rise', c: ['#fff2b0', '#ffd23a', '#ffa03a'] },
    railgun: { g: 'ring', gc: '#5fd8ff', p: 'mote', m: 'orbit', c: ['#ffffff', '#9ae8ff', '#4ac0ff'] },
    mining:  { g: 'smoke', gc: '#a08a6a', p: 'glint', m: 'rise', c: ['#fff6c8', '#ffd23a', '#e0a020'] },
    bolt:    { g: 'ring', gc: '#b58cff', p: 'zap', m: 'orbit', c: ['#ffffff', '#fff2a0', '#c8a8ff'] },
    summon:  { g: 'ring', gc: '#5fe0c8', p: 'wisp', m: 'orbit', c: ['#e0fff8', '#8ff0dc', '#3fc8b0'] },
    combo:   { g: 'glow', gc: '#ff8adf', p: 'petal', m: 'drift', c: ['#ffe0f0', '#ffaadf', '#ff6ac8'] },
    light:   { g: 'glow', gc: '#ffe48a', p: 'mote', m: 'rise', c: ['#ffffff', '#fff6c8', '#ffe07a'] },
    beacon:  { g: 'glow', gc: '#ff9a3a', p: 'ember', m: 'rise', c: ['#fff2a0', '#ffc23a', '#ff7a2a'] },
    growth:  { g: 'glow', gc: '#9be06a', p: 'leaf', m: 'drift', c: ['#ffe48a', '#9be06a', '#5aa83a'] },
    tyrant:  { g: 'smoke', gc: '#5a1424', p: 'ember', m: 'rise', c: ['#ff9a9a', '#ff4a4a', '#a01a2a'] },
    corrode: { g: 'puddle', gc: '#a6e04a', p: 'bubble', m: 'rise', c: ['#e6ff9a', '#a6e04a', '#6a9a2a'] },
    greed:   { g: 'glow', gc: '#ffd23a', p: 'coin', m: 'fall', c: ['#fff6c8', '#ffd23a', '#c8901a'] },
    prism:   { g: 'glow', gc: '#e0d0ff', p: 'crystal', m: 'orbit', c: ['#ffffff', '#ffd0ff', '#9adfff'] },
  };
  const hue = (t, k) => `hsl(${(t * 80 + k * 47) % 360},95%,72%)`;
  R.AMB = AMB;
  // 발밑 기운(포탑보다 먼저 = 판 위)
  R.ambientGround = function (c, i, tw) {
    const A = AMB[tw.type]; if (!A || tw.tier < 4) return;
    const [x, y] = G.tiles[i].tower, s = G.tiles[i].scale * TSZ[tw.tier], t = this.time + i * 1.7, k6 = tw.tier >= 6 ? 1.35 : tw.tier >= 5 ? 1.15 : 1;
    const rx = 36 * s * k6, ry = rx * 0.42;
    c.save();
    if (A.g === 'glow' || A.g === 'puddle') {
      const g = c.createRadialGradient(0, 0, 2, 0, 0, rx), a = (A.g === 'puddle' ? 0.5 : 0.38) * (0.85 + 0.15 * Math.sin(t * 2.2));
      g.addColorStop(0, A.gc); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.translate(x, y); c.scale(1, ry / rx); c.globalAlpha = a; c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
      if (A.g === 'puddle') for (let k = 0; k < 3; k++) { const ph = (t * 0.8 + k / 3) % 1, a2 = k * 2.1; c.strokeStyle = A.c[0]; c.lineWidth = 2; c.globalAlpha = 0.7 * (1 - ph); c.beginPath(); c.arc(Math.cos(a2) * rx * 0.5, Math.sin(a2) * rx * 0.5, 3 + ph * 7, 0, TAU); c.stroke(); }
    } else if (A.g === 'mist' || A.g === 'smoke') {
      // 낮게 깔린 안개 덩이가 받침 둘레를 천천히 돎
      const n = tw.tier >= 6 ? 7 : 5;
      for (let k = 0; k < n; k++) {
        const a = t * 0.35 + k * TAU / n, px = x + Math.cos(a) * rx * 0.85, py = y + Math.sin(a) * ry * 0.85 + 2, r = (10 + 4 * Math.sin(t * 1.3 + k)) * s * k6;
        c.globalAlpha = (A.g === 'mist' ? 0.3 : 0.22) * (0.7 + 0.3 * Math.sin(t + k));
        c.fillStyle = A.gc; c.beginPath(); c.ellipse(px, py, r * 1.5, r * 0.6, 0, 0, TAU); c.fill();
      }
    } else if (A.g === 'ring') {
      // 빛 고리(점선)가 천천히 돎
      c.translate(x, y); c.scale(1, 0.42); c.rotate(t * 0.6);
      c.globalAlpha = 0.5 + 0.15 * Math.sin(t * 3); c.strokeStyle = A.gc; c.lineWidth = 2.4; c.setLineDash([6, 7]);
      c.beginPath(); c.arc(0, 0, rx * 0.95, 0, TAU); c.stroke();
      c.setLineDash([]); c.globalAlpha = 0.16; c.fillStyle = A.gc; c.beginPath(); c.arc(0, 0, rx * 0.95, 0, TAU); c.fill();
    }
    c.restore();
  };
  // 떠다니는 조각(5단계부터) — front = 받침보다 앞쪽 반(뒤쪽 반은 포탑보다 먼저 그림)
  R.ambientBits = function (c, i, tw, front) {
    const A = AMB[tw.type]; if (!A || tw.tier < 5) return;
    const M = root.MANIFEST[`t_${tw.type}_${tw.tier}`]; if (!M) return;
    const [x, y] = G.tiles[i].tower, sc = G.tiles[i].scale, s = sc * TSZ[tw.tier], T = this.time, H = M.foot * 0.46 * s, n = tw.tier >= 6 ? 9 : 4;
    c.save();
    for (let k = 0; k < n; k++) {
      const ph = (T * (A.m === 'orbit' ? 0.22 : 0.3) + k / n + i * 0.13) % 1, h1 = hash(i, k);
      let px, py, depth, life = Math.sin(ph * Math.PI);
      if (A.m === 'orbit') { const a = ph * TAU; px = x + Math.cos(a) * 34 * s; py = y - H * (0.35 + 0.35 * h1) + Math.sin(a) * 12 * s; depth = Math.sin(a); life = 1; }
      else if (A.m === 'fall') { const a = h1 * TAU; px = x + Math.cos(a) * 30 * s; py = y - H * (1.05 - ph * 0.95); depth = Math.sin(a); }
      else if (A.m === 'drift') { const a = h1 * TAU + T * 0.4; px = x + Math.cos(a) * (24 + 12 * Math.sin(T + k)) * s; py = y - H * (0.15 + 0.7 * h1) - ph * 14 * s; depth = Math.sin(a); }
      else { const a = h1 * TAU; px = x + Math.cos(a) * 28 * s + Math.sin(T * 2 + k) * 4; py = y - 4 - ph * H * 1.05; depth = Math.sin(a); }
      if ((depth >= 0) !== front) continue;
      const tw6 = tw.tier >= 6, col = tw6 && k % 2 ? hue(T, k) : A.c[k % 3], r = (tw6 ? 3.6 : 3.2) * sc * (0.8 + 0.4 * h1);
      c.globalAlpha = life * 0.95;
      this.ambientShape(c, A.p, px, py, r, col, T * 3 + k, tw6);
    }
    c.restore();
  };
  R.ambientShape = function (c, kind, x, y, r, col, ph, rich) {
    const gl = (rr, a) => this.glow(c, x, y, rr, col, a);
    switch (kind) {
      case 'ember': gl(r * 3, 0.5); c.fillStyle = col; c.fillRect(Math.round(x - r * 0.6), Math.round(y - r * 0.6), r * 1.2, r * 1.2); break;
      case 'crystal': {   // 마름모 결정 + 반짝
        gl(r * 3.4, rich ? 0.6 : 0.45);
        c.fillStyle = '#2b1426'; c.beginPath(); c.moveTo(x, y - r * 2); c.lineTo(x + r * 1.1, y); c.lineTo(x, y + r * 2); c.lineTo(x - r * 1.1, y); c.closePath(); c.fill();
        c.fillStyle = col; c.beginPath(); c.moveTo(x, y - r * 1.6); c.lineTo(x + r * 0.75, y); c.lineTo(x, y + r * 1.6); c.lineTo(x - r * 0.75, y); c.closePath(); c.fill();
        c.fillStyle = '#ffffff'; c.fillRect(Math.round(x - r * 0.3), Math.round(y - r * 0.9), Math.max(1, r * 0.5), Math.max(1, r * 0.7));
        const tw = Math.max(0, Math.sin(ph)); if (tw > 0.6) this.star(c, x + r, y - r * 1.4, 4, r * 1.6 * tw, r * 0.25, 0, '#ffffff');
        break;
      }
      case 'bubble': c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r * 1.2, 0, TAU); c.stroke(); c.save(); c.globalAlpha *= 0.35; c.fillStyle = col; c.fill(); c.restore(); c.fillStyle = '#fff'; c.fillRect(Math.round(x - r * 0.5), Math.round(y - r * 0.6), 1.5, 1.5); break;
      case 'spark': c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + r, y - r * 1.6); c.stroke(); gl(r * 2, 0.35); break;
      case 'glint': gl(r * 2.6, 0.5); this.star(c, x, y, 4, r * 1.7, r * 0.35, ph * 0.3, col); break;
      case 'mote': gl(r * 3.2, 0.6); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, r * 0.6, 0, TAU); c.fill(); break;
      case 'zap': gl(r * 2.6, 0.5); c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - r, y - r * 1.4); c.lineTo(x + r * 0.2, y - r * 0.2); c.lineTo(x - r * 0.3, y + r * 0.2); c.lineTo(x + r, y + r * 1.4); c.stroke(); break;
      case 'wisp': gl(r * 3, 0.55); c.fillStyle = col; c.beginPath(); c.arc(x, y, r * 1.1, 0, TAU); c.fill(); c.save(); c.globalAlpha *= 0.5; c.beginPath(); c.arc(x - r * 1.4, y + r * 0.6, r * 0.7, 0, TAU); c.fill(); c.beginPath(); c.arc(x - r * 2.4, y + r * 1.1, r * 0.4, 0, TAU); c.fill(); c.restore(); break;
      case 'petal': c.save(); c.translate(x, y); c.rotate(ph * 0.7); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, r * 1.3, r * 0.6, 0, 0, TAU); c.fill(); c.restore(); break;
      case 'leaf': c.save(); c.translate(x, y); c.rotate(Math.sin(ph * 0.5) * 0.8); c.fillStyle = '#2b1426'; c.beginPath(); c.ellipse(0, 0, r * 1.6, r * 0.8, 0, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, r * 1.25, r * 0.5, 0, 0, TAU); c.fill(); c.restore(); break;
      case 'coin': { const w = Math.abs(Math.cos(ph * 0.8)); c.fillStyle = '#2b1426'; c.beginPath(); c.ellipse(x, y, r * 1.3 * w + 0.8, r * 1.3 + 0.8, 0, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(x, y, r * 1.05 * w + 0.3, r * 1.05, 0, 0, TAU); c.fill(); gl(r * 2.2, 0.3); break; }
    }
  };
  const prevDrawTower6 = R.drawTower;
  R.drawTower = function (c, game, i, opt) {
    const tw = (opt && opt.tw) || (game.tiles[i] && game.tiles[i].tower), still = !opt || (!opt.at && opt.alpha == null);
    if (tw && still) this.ambientBits(c, i, tw, false);
    prevDrawTower6.call(this, c, game, i, opt);
    if (tw && still) this.ambientBits(c, i, tw, true);
  };
  const prevDrawTiles6 = R.drawTiles;
  R.drawTiles = function (c, game) {
    prevDrawTiles6.call(this, c, game);
    for (const tl of game.tiles) if (tl.tower && tl.tower.tier >= 4 && !(this.drag && this.drag.active && this.drag.from === tl.i)) this.ambientGround(c, tl.i, tl.tower);
  };

  // ------------------------------------------------------------ 키 큰 포탑(첨탑 · 등대 · 망루 · 수정 · 나무)의 1~4단계 발사 위치 = 그림 꼭대기(구슬 · 불 · 결정)
  // 규칙 쪽 발사 높이는 단계별 고정값이라 키 큰 새 그림에서는 몸통 가운데서 번쩍였다 — 화면에서만 시작점을 옮기고, 탄은 꼭대기에서 출발해 원래 길로 합류
  const TALL = new Set(['bolt', 'light', 'beacon', 'prism', 'growth', 'ice']);
  R.topMuzzle = function (i, tw) {
    const M = root.MANIFEST[`t_${tw.type}_${tw.tier}`]; if (!M) return null;
    const [x, y] = G.tiles[i].tower, s = G.tiles[i].scale * 0.46 * TSZ[tw.tier];
    return [x, y - M.foot * s * 0.86];
  };
  const prevConsume6 = R.consume;
  R.consume = function (game, events, audio) {
    const moved = [], tops = {};
    for (const t of game.tiles) { const tw = t.tower; if (tw && tw.tier <= 4 && TALL.has(tw.type)) { const m0 = game.muzzle(t.i), mt = this.topMuzzle(t.i, tw); if (mt && m0[1] - mt[1] > 6) tops[t.i] = [m0, mt]; } }
    const near = (p, q) => Math.abs(p[0] - q[0]) < 1.5 && Math.abs(p[1] - q[1]) < 1.5;
    for (const e of events) {
      if (e.i != null && tops[e.i] && e.x != null && near([e.x, e.y], tops[e.i][0])) { e.x = tops[e.i][1][0]; e.y = tops[e.i][1][1]; if (e.ev === 'fire') moved.push(e.i); }
      if (e.pts && e.pts.length) for (const k in tops) if (near(e.pts[0], tops[k][0])) { e.pts = [tops[k][1]].concat(e.pts.slice(1)); break; }
    }
    prevConsume6.call(this, game, events, audio);
    for (const i of moved) for (const s of game.shots) if (s.i === i && !s._o && (s.age || 0) < 0.05) s._o = [tops[i][1][0] - s.sx, tops[i][1][1] - s.sy];
  };
})(window);
