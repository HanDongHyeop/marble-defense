// v4.2 층(Renderer에 덧붙임) — 사용자 피드백 9가지 중 화면 쪽
// · 포탑 자리: 둥근 그림자 대신 작고 흐린 표지(포탑이 서는 바로 그 점) — 그림자와 실제 포탑 위치가 어긋나 보이던 문제
// · 단계 표시: 발밑 주사위 배지 → 포탑 위 별(1 노랑 · 2 노랑 둘 · 3 빨강 셋(두 줄) · 4 빨강 넷(두 줄) · 5 화려한 별 · 6 화려한 별 둘)
// · 깊이: 말도 포탑 · 몬스터와 같은 깊이 순서로 — 앞(아래) 변에서는 포탑 뒤, 뒤(위) 변에서는 포탑 앞
// · 합치기: 포탑을 들면 판 전체가 어두워지고, 합칠 수 있는 포탑만 밝게 + 위에서 빛줄기가 내려옴
// · 단계 연출: 탄 크기 · 꼬리 · 빛, 명중 고리, 5단계 = 내딛으며 치기, 6단계 = 떠올라 계열별 대기술(원소 = 좌 → 우로 쓸며 뿜기, 비전 = 하늘 번개, 성역 = 빛기둥, 기계 = 대포 반동, 심연 = 어둠 파동)
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA, TIER = D.TIER, TSZ = root.Renderer.TSZ;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3), smooth = t => t * t * (3 - 2 * t);
  const PAWN_COL = { car: '#e8453c', dog: '#3f7fe0', hat: '#f2c62a', boat: '#f08a24', boot: '#4fb84a', cat: '#a05ae0' };
  const FAM = { 원소: 'elem', 기계: 'mech', 비전: 'arc', 성역: 'holy', 심연: 'abyss', 조커: 'joker' };
  const famOf = type => FAM[(D.TOWERS[type] || {}).fam] || 'elem';
  const BREATH = { fire: ['#fff2a0', '#ffd23a', '#ff8a1c', '#e8452c'], ice: ['#ffffff', '#d8f4ff', '#7ecbff', '#4aa0ff'], poison: ['#f0ffe0', '#a6f06a', '#4aa83a', '#2f7a2a'] };
  const SHOT_K = [1, 1, 1.12, 1.26, 1.42, 1.62, 1.85];
  const baseMuzzle = R.muzzle, baseImpact = R.impact, baseDrawShots = R.drawShots;

  // ------------------------------------------------------------ 포탑 자리 표지 · 땅 문양 · 도착 예고 · 버프 고리 · 받침 주사위
  R.pointer = function (c, i, col, a, r) {
    const [x, y] = G.tiles[i].tower, s = G.tiles[i].scale, rr = (r || 9) * s;
    c.save(); c.globalAlpha = a;
    c.strokeStyle = '#1a1024'; c.lineWidth = 3.5; c.beginPath(); c.ellipse(x, y + 1, rr, rr * 0.45, 0, 0, TAU); c.stroke();
    c.strokeStyle = col; c.lineWidth = 1.8; c.beginPath(); c.ellipse(x, y, rr, rr * 0.45, 0, 0, TAU); c.stroke();
    c.fillStyle = col; c.fillRect(Math.round(x) - 1.5, Math.round(y) - 1.5, 3, 3);
    c.restore();
  };
  R.footRing = function (c, i, col, a, w) {
    const tw = this._game && this._game.tiles[i].tower, [x, y] = G.tiles[i].tower, s = G.tiles[i].scale * (tw ? TSZ[tw.tier] : 0.8);
    c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w || 3; c.beginPath(); c.ellipse(x, y, 34 * s, 14 * s, 0, 0, TAU); c.stroke(); c.restore();
  };
  R.drawTiles = function (c, game) {
    const t = this.time;
    for (const tl of game.tiles) {
      if (tl.corner) continue;
      const i = tl.i;
      if (!tl.tower) { this.pointer(c, i, '#fff4d6', 0.45); continue; }
      // 요새 구역(변 5칸이 다 참) = 포탑 발밑 금빛 고리 · 파괴 예고 = 빨강 · 점령 = 보라
      if (game.zoneFull(tl.zone)) this.footRing(c, i, '#ffe28a', 0.5 + 0.2 * Math.sin(t * 4), 3);
      if (tl.warn) this.footRing(c, i, '#ff3030', 0.5 + 0.3 * Math.sin(t * 10), 4);
      if (tl.occ) this.footRing(c, i, '#c050ff', 0.6, 4);
      // 5 · 6단계: 발밑 마법진(천천히 돎)
      const tw = tl.tower;
      if (tw.tier >= 5) {
        const [x, y] = G.tiles[i].tower, s = G.tiles[i].scale * TSZ[tw.tier], col = TIER.ring[tw.tier];
        c.save(); c.translate(x, y); c.scale(1, 0.42); c.rotate(t * (tw.tier >= 6 ? 0.9 : 0.5) + i);
        c.globalAlpha = 0.55; c.strokeStyle = col; c.lineWidth = 2.5;
        c.beginPath(); c.arc(0, 0, 40 * s, 0, TAU); c.stroke();
        if (tw.tier >= 6) { c.beginPath(); c.arc(0, 0, 31 * s, 0, TAU); c.stroke(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6; c.beginPath(); c.moveTo(Math.cos(a) * 31 * s, Math.sin(a) * 31 * s); c.lineTo(Math.cos(a + 2.1) * 31 * s, Math.sin(a + 2.1) * 31 * s); c.stroke(); } }
        else for (let k = 0; k < 4; k++) { const a = k * TAU / 4; c.fillStyle = col; c.fillRect(Math.cos(a) * 40 * s - 3, Math.sin(a) * 40 * s - 3, 6, 6); }
        c.restore();
      }
    }
    // 칸 고르기(황금 주사위 · 우주여행 = 판 칸, 순간이동술사 = 포탑 자리)
    if (game.pick) for (const i of game.pick.tiles) {
      const k = 0.28 + 0.14 * Math.sin(t * 6 + i);
      if (game.pick.kind === 'swap') { if (G.tiles[i].corner) continue; this.pointer(c, i, '#ffd23a', 0.6 + k, 16); }
      else { c.save(); c.globalAlpha = k; this.tileFill(c, i, '#fff6c8'); c.restore(); this.tileStroke(c, i, '#ffd23a', 3); }
    }
    // 땅 문양 = 칸 바닥에 칠한 상징(테 없음, 바닥처럼 납작하게 · 살짝 비침). 좋은 땅 = 금빛 물감, 나쁜 땅 = 보라 물감
    for (const tl of game.tiles) {
      if (!tl.trait) continue;
      const im = this.I('trp_' + tl.trait); if (!im) continue;
      const g = G.tiles[tl.i], [x, y] = g.center, pulse = game.t < 3 ? 1 + 0.1 * Math.sin(t * 10) : 1;
      const S0 = 0.6 * G.CFG.a * G.u * g.tscale * pulse / Math.max(im.width, im.height), w = im.width * S0, h = im.height * S0 * G.CFG.k * 1.15;
      c.save(); c.globalAlpha = 0.88; c.drawImage(im, x - w / 2, y - h / 2, w, h); c.restore();
    }
    // 도착할 칸 예고 + 그 칸의 포탑 자리 표지
    const P = game.pawn;
    if (P.moving && P.path.length && !P.fast) {
      const j = P.path[P.path.length - 1], k = 0.5 + 0.5 * Math.sin(t * (8 + 14 / P.path.length));
      c.save(); c.globalAlpha = 0.4 + 0.35 * k; this.tileFill(c, j, '#fff1a0'); c.restore(); this.tileStroke(c, j, '#2b1426', 6); this.tileStroke(c, j, '#ffd23a', 3);
      if (!G.tiles[j].corner && !game.tiles[j].tower) this.pointer(c, j, '#ffd23a', 0.5 + 0.4 * k, 11 + 3 * k);
    }
    // 버프 고리(축성 · 탄막 · 응원 · 빨간 말)
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

  // ------------------------------------------------------------ 단계 별
  R.starPath = function (c, x, y, r) { c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.47 : r, a = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); };
  R.plainStar = function (c, x, y, r, body, hi) {
    c.lineJoin = 'round'; c.strokeStyle = '#2b1426'; c.lineWidth = Math.max(2.2, r * 0.5); this.starPath(c, x, y, r); c.stroke();
    c.fillStyle = body; c.fill(); c.fillStyle = hi; this.starPath(c, x - r * 0.1, y - r * 0.14, r * 0.45); c.fill();
  };
  // 5 · 6단계 별: 둥근 메달(빛나는 테 + 빛살) 위의 큰 별 — 작게 보여도 1 · 2단계 노란 별과 바로 구별되게
  R.fancyStar = function (c, x, y, r, legend, ph) {
    const t = this.time + ph, pulse = 1 + 0.07 * Math.sin(t * 5), rimCol = legend ? `hsl(${(t * 90) % 360},95%,66%)` : '#ff9a3a';
    // 빛살(돌아감)
    c.save(); c.translate(x, y); c.rotate(t * 0.8); c.globalAlpha = 0.55;
    for (let k = 0; k < 8; k++) { c.rotate(TAU / 8); c.fillStyle = k % 2 ? (legend ? '#fff6c8' : '#ffd23a') : rimCol; c.beginPath(); c.moveTo(-r * 0.22, -r * 1.05); c.lineTo(0, -r * 1.75 * pulse); c.lineTo(r * 0.22, -r * 1.05); c.closePath(); c.fill(); }
    c.restore();
    // 메달: 어두운 테 → 빛나는 테 → 안쪽 판
    c.fillStyle = '#2b1426'; c.beginPath(); c.arc(x, y, r * 1.18, 0, TAU); c.fill();
    c.fillStyle = rimCol; c.beginPath(); c.arc(x, y, r * 1.02, 0, TAU); c.fill();
    c.fillStyle = legend ? '#5a2a8a' : '#7a2a1a'; c.beginPath(); c.arc(x, y, r * 0.82, 0, TAU); c.fill();
    // 별
    const g = c.createLinearGradient(x, y - r, x, y + r);
    if (legend) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#ffe14a'); g.addColorStop(1, '#ff9ad8'); }
    else { g.addColorStop(0, '#fff1a0'); g.addColorStop(0.55, '#ffc23a'); g.addColorStop(1, '#ff7a2a'); }
    c.fillStyle = g; this.starPath(c, x, y + r * 0.04, r * 0.78); c.fill();
    c.fillStyle = '#ffffff'; this.starPath(c, x - r * 0.1, y - r * 0.14, r * 0.28); c.fill();
    // 반짝이 십자
    const tw = Math.max(0, Math.sin(t * 3.1));
    if (tw > 0.2) { c.save(); c.globalAlpha = tw; this.star(c, x + r * 0.85, y - r * 0.85, 4, r * 0.8 * tw, r * 0.13, t, '#ffffff'); c.restore(); }
  };
  R.tierStars = function (c, x, y, tier, sc, ph) {
    const Y = '#ffd23a', Yh = '#fff6b0', Rd = '#ff4a4a', Rh = '#ffc0b0';
    if (tier <= 2) { const r = 6.3 * sc, d = 13.5 * sc; for (let k = 0; k < tier; k++) this.plainStar(c, x + (k - (tier - 1) / 2) * d, y, r, Y, Yh); }
    else if (tier <= 4) {
      const r = 4.9 * sc, d = 10.5 * sc, up = 9 * sc;                                     // 작게 · 두 줄(옆 포탑을 침범하지 않게)
      const top = tier === 3 ? [0] : [-0.5, 0.5], bot = [-0.5, 0.5];
      for (const k of bot) this.plainStar(c, x + k * d, y, r, Rd, Rh);
      for (const k of top) this.plainStar(c, x + k * d, y - up, r, Rd, Rh);
    } else if (tier === 5) this.fancyStar(c, x, y - 4 * sc, 10.5 * sc, false, ph);
    else { const d = 23 * sc; this.fancyStar(c, x - d / 2, y - 4 * sc, 9.5 * sc, true, ph); this.fancyStar(c, x + d / 2, y - 4 * sc, 9.5 * sc, true, ph + 0.7); }
  };
  R.starsFor = function (c, game, i, tw, at) {
    const M = root.MANIFEST[`t_${tw.type}_${tw.tier}`]; if (!M) return;
    const an = this.towerAnim[i];
    if (!at && an && an.kind === 'drop' && this.time - an.t < 0.3) return;   // 떨어지는 중엔 숨김
    const [x, y] = at || G.tiles[i].tower, sc = G.tiles[i].scale, s = sc * 0.46 * TSZ[tw.tier];
    const top = y - M.foot * s * 0.93 - (tw.tier >= 5 ? 4 : 0) * sc;
    this.tierStars(c, x, top - 7 * sc, tw.tier, sc, i * 0.37);
  };
  R.drawStarsPass = function (c, game, only) {
    for (const tl of game.tiles) {
      if (!tl.tower || (this.drag && this.drag.active && this.drag.from === tl.i)) continue;
      if (only && !only.has(tl.i)) continue;
      this.starsFor(c, game, tl.i, tl.tower);
    }
  };

  // ------------------------------------------------------------ 말(깊이 순서 안에서 몸만 · 숫자는 나중에)
  R.drawPawnBody = function (c, game) {
    const p = game.pawn, head = this.drawHero(c, p, 'p_' + game.pawnId, G.tiles[p.tile].scale, PAWN_COL[game.pawnId] || '#ffd23a');
    if (head) this.pawnHead = head;
  };
  R.drawPawnBadge = function (c, game) {
    const p = game.pawn, head = this.pawnHead; if (!head) return;
    if (p.moving && p.path.length && !p.fast && !(this.diceShow && this.time - this.diceShow.t < 0.8 + 0.14)) {
      const n = p.path.length, hp = clamp(p.hopT / p.hopDur, 0, 1), pop = hp < 0.18 ? 1.35 - hp / 0.18 * 0.35 : 1;
      c.save(); c.translate(head[0], head[1] - 16); c.scale(pop, pop);
      c.fillStyle = '#2b1426'; this.rr(c, -24, -21, 48, 42, 12); c.fill(); c.fillStyle = n === 1 ? '#ffd23a' : '#fff4e0'; this.rr(c, -20, -17, 40, 34, 9); c.fill();
      c.font = '700 28px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#2b1426'; c.fillText(String(n), 0, 1);
      c.restore();
    }
  };
  R.drawPartnerBody = function (c, game) { const p = game.partner; this.partnerHead = this.drawHero(c, p, 'p_' + p.pawn, G.tiles[p.tile].scale, '#4a9bff', true); };
  R.drawPartnerTag = function (c) {
    const h = this.partnerHead; if (!h) return;
    c.fillStyle = '#4a9bff'; c.strokeStyle = '#2b1426'; c.lineWidth = 3; c.beginPath(); c.arc(h[0], h[1] - 6, 11, 0, TAU); c.fill(); c.stroke();
    c.font = '700 12px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('2P', h[0], h[1] - 5);
  };

  // ------------------------------------------------------------ 합치기 빛줄기
  R.mergeBeam = function (c, i, hot) {
    const [x, y] = G.tiles[i].tower, s = G.tiles[i].scale, t = this.time, k = 0.75 + 0.25 * Math.sin(t * 5 + i), H = 190 * s;
    const wb = (hot ? 46 : 34) * s, wt = (hot ? 16 : 10) * s;
    c.save();
    const g = c.createLinearGradient(0, y - H, 0, y);
    g.addColorStop(0, 'rgba(255,246,200,0)'); g.addColorStop(0.55, `rgba(255,240,180,${(hot ? 0.38 : 0.24) * k})`); g.addColorStop(1, `rgba(255,236,160,${(hot ? 0.62 : 0.42) * k})`);
    c.fillStyle = g; c.beginPath(); c.moveTo(x - wt, y - H); c.lineTo(x + wt, y - H); c.lineTo(x + wb, y + 4); c.lineTo(x - wb, y + 4); c.closePath(); c.fill();
    const g2 = c.createLinearGradient(0, y - H, 0, y); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(1, `rgba(255,255,255,${0.5 * k})`);
    c.fillStyle = g2; c.beginPath(); c.moveTo(x - wt * 0.35, y - H); c.lineTo(x + wt * 0.35, y - H); c.lineTo(x + wb * 0.3, y); c.lineTo(x - wb * 0.3, y); c.closePath(); c.fill();
    // 바닥 빛 웅덩이 · 위로 오르는 알갱이(시간으로 계산 — 입자 없음)
    c.globalAlpha = (hot ? 0.75 : 0.5) * k; c.fillStyle = '#fff1b0'; c.beginPath(); c.ellipse(x, y, wb * 1.05, wb * 0.42, 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
    for (let n = 0; n < 5; n++) { const q = ((t * 0.7 + n / 5 + i * 0.13) % 1), px = x + Math.sin(n * 2.3 + t * 2) * wb * 0.6 * (1 - q), py = y - q * H * 0.8; c.globalAlpha = (1 - q) * 0.9; c.fillStyle = '#ffffff'; c.fillRect(Math.round(px) - 1.5, Math.round(py) - 1.5, 3, 3); }
    c.restore();
  };

  // ------------------------------------------------------------ 5 · 6단계 공격 동작
  R.actPose = function (i, tw, now) {
    const an = this.towerAnim[i], a = an && an.act; if (!a || tw.tier < 5) return null;
    const p = now - a.t, dir = a.dir;
    if (a.tier === 5) {
      if (p > 0.45) return null;
      if (p < 0.1) { const k = p / 0.1; return { dx: -dir * 3 * k, dy: 0, sx: 1 + 0.06 * k, sy: 1 - 0.08 * k, rot: -dir * 0.1 * k }; }      // 움츠림
      if (p < 0.22) { const k = easeOut((p - 0.1) / 0.12); return { dx: dir * (-3 + 11 * k), dy: -5 * k, sx: 1 - 0.05 * k, sy: 1 + 0.1 * k, rot: dir * (-0.1 + 0.26 * k) }; }   // 내딛어 침
      const k = 1 - smooth((p - 0.22) / 0.23); return { dx: dir * 8 * k, dy: -5 * k, sx: 1, sy: 1, rot: dir * 0.16 * k };
    }
    if (p > 1.0) return null;
    const rise = p < 0.18 ? smooth(p / 0.18) : p < 0.78 ? 1 : 1 - smooth((p - 0.78) / 0.22);
    let rot = 0, dx = 0, sx = 1 + 0.04 * rise, sy = 1 + 0.06 * rise;
    if (a.sig === 'elem') { const q = clamp((p - 0.18) / 0.5, 0, 1); rot = (-0.22 + 0.44 * smooth(q)) * rise; }                         // 왼쪽에서 오른쪽으로 고개를 돌리며 뿜기
    else if (a.sig === 'arc' || a.sig === 'holy') { sy = 1 + 0.14 * rise; sx = 1 - 0.04 * rise; }                                       // 팔을 들어 올리듯 늘어남
    else if (a.sig === 'mech') { const q = p - 0.2; if (q > 0 && q < 0.3) { const k = 1 - q / 0.3; dx = -dir * 12 * k; rot = -dir * 0.12 * k; sx = 1 + 0.1 * k; sy = 1 - 0.1 * k; } }
    else { rot = dir * 0.12 * rise; dx = dir * 5 * rise; }
    return { dx, dy: -14 * rise, sx, sy, rot };
  };
  R.startAct = function (e) {
    const tw = this._game && this._game.tiles[e.i] && this._game.tiles[e.i].tower; if (!tw || tw.tier < 5) return;
    const an = this.towerAnim[e.i] || (this.towerAnim[e.i] = {});
    const gap = tw.tier >= 6 ? 1.6 : 0.6;
    if (an.act && this.time - an.act.t < gap) return;
    const [x0] = G.tiles[e.i].tower, sig = famOf(tw.type);
    an.act = { t: this.time, tier: tw.tier, dir: e.tx < x0 ? -1 : 1, sig };
    this.signature(e, tw.tier, sig, tw.type);
  };
  // 계열별 대기술 연출(6단계 = 크게, 5단계 = 작게). 피해는 규칙(sim)이 정한 그대로 — 화면만
  R.signature = function (e, tier, sig, type) {
    const big = tier >= 6, col = (D.TOWERS[type] || {}).color || '#fff', ring = TIER.ring[tier];
    const [fx0, fy0] = G.tiles[e.i].tower, s = G.tiles[e.i].scale;
    // 공통: 발밑 충격 고리
    this.addFx(0.4, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.9; c.strokeStyle = ring; c.lineWidth = 5 * (1 - p) + 1; c.beginPath(); c.ellipse(fx0, fy0, (26 + p * 50) * s, (11 + p * 21) * s, 0, 0, TAU); c.stroke(); c.restore(); }, 'under');
    if (!big) {
      if (sig === 'arc') this.later(0.12, () => this.chain([[e.tx + rnd(-20, 20), e.ty - 140], [e.tx, e.ty - 12]], true));
      else if (sig === 'holy') this.later(0.12, () => this.addFx(0.3, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.fillStyle = 'rgba(255,233,160,0.5)'; c.fillRect(e.tx - 9, e.ty - 150, 18, 150); c.fillStyle = '#fff'; c.fillRect(e.tx - 3, e.ty - 150, 6, 150); c.restore(); }));
      else this.later(0.14, () => this.addFx(0.3, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.ellipse(e.tx, e.ty, 14 + p * 34, 6 + p * 14, 0, 0, TAU); c.stroke(); c.restore(); }));
      return;
    }
    this.shake = Math.max(this.shake, 2.5);
    if (sig === 'elem') {
      // 왼쪽 → 오른쪽으로 쓸며 뿜기(0.18 ~ 0.68초): 입에서 길을 따라 부채꼴로
      const cols = BREATH[type] || BREATH.fire, mx = e.x, my = e.y, base = Math.atan2(e.ty - 10 - my, e.tx - mx), L = Math.hypot(e.tx - mx, e.ty - my) + 30;
      this.addFx(0.7, (c, p) => {
        const q = (p * 0.7 - 0.18) / 0.5; if (q < 0 || q > 1) return;
        const ang = base - 0.55 + 1.1 * q;
        for (let n = 0; n < 3; n++) { const v = L * rnd(2.2, 3), sp = rnd(-0.08, 0.08); this.part({ x: mx, y: my - 14 * s, vx: Math.cos(ang + sp) * v, vy: Math.sin(ang + sp) * v, life: rnd(0.28, 0.4), size: rnd(9, 15), col: cols[n % 4], kind: 'fire', drag: 2.6, add: true }); }
        if (Math.random() < 0.25) this.explosion(mx + Math.cos(ang) * L, my + Math.sin(ang) * L, 18, 0.4);
      });
    } else if (sig === 'arc') {
      // 팔을 들면 하늘에서 번개 두 줄기
      this.later(0.22, () => { this.thunder(e.tx, e.ty, 6); this.flash = Math.max(this.flash, 0.12); });
      this.later(0.36, () => this.thunder(e.tx + rnd(-40, 40), e.ty + rnd(-10, 10), 6));
    } else if (sig === 'holy') {
      this.later(0.2, () => {
        this.addFx(0.55, (c, p) => { const a = p < 0.25 ? 1 : (1 - p) / 0.75; c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(255,226,140,0.45)'; c.fillRect(e.tx - 26, -20, 52, e.ty + 16); c.fillStyle = '#fffbe8'; c.fillRect(e.tx - 8, -20, 16, e.ty + 16); c.restore(); this.glow(c, e.tx, e.ty, 90, '#ffe48a', a); });
        for (let k = 0; k < 10; k++) this.part({ x: e.tx + rnd(-30, 30), y: e.ty - rnd(0, 30), vy: -rnd(60, 120), life: 0.7, size: 4, col: '#fff6c8', kind: 'star', vr: 5 });
      });
    } else if (sig === 'mech') {
      this.later(0.2, () => { this.sprite(['fx_flash', 'fx_hit'], e.x, e.y, 70, 16); this.explosion(e.tx, e.ty - 8, 30, 1); for (let k = 0; k < 4; k++) this.part({ x: e.x, y: e.y, vx: rnd(-90, 90), vy: rnd(-200, -120), life: 0.6, size: 3, col: '#ffd23a', kind: 'spark', grav: 700 }); });
    } else if (sig === 'abyss') {
      this.later(0.18, () => this.addFx(0.6, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.8; c.lineWidth = 9 * (1 - p) + 2; c.strokeStyle = '#2a0a1a'; c.beginPath(); c.ellipse(fx0, fy0, (30 + p * 150) * s, (13 + p * 64) * s, 0, 0, TAU); c.stroke(); c.lineWidth = 3; c.strokeStyle = col; c.stroke(); c.restore(); }, 'under'));
      this.later(0.22, () => this.whip({ x: e.x, y: e.y, tx: e.tx, ty: e.ty }));
    } else {
      this.later(0.18, () => this.rainbow({ x: e.x, y: e.y, tx: e.tx, ty: e.ty }));
    }
  };

  // ------------------------------------------------------------ 발사 · 탄 · 명중을 단계만큼 세게
  R.muzzle = function (e) {
    baseMuzzle.call(this, e);
    const t = e.tier || 1;
    if (t >= 3) { const col = (D.TOWERS[e.type] || {}).color || '#fff'; this.addFx(0.14, (c, p) => this.glow(c, e.x, e.y, (10 + t * 6) * (1 - p * 0.5), col, 0.7 * (1 - p))); }
    if (t >= 5) this.startAct(e);
  };
  R.drawShots = function (c, game) {
    for (const s of game.shots) {
      if (s.delay > 0) continue;
      const arc = s.kind === 'ore' || s.kind === 'ingot' || s.kind === 'coin';
      const t = s.tier || 1, k = Math.min(arc ? 1.15 : 9, SHOT_K[t] || 1), col = (D.TOWERS[s.type] || {}).color || '#fff';   // 던지는 광석 · 금괴 · 동전은 원래도 커서 조금만
      if (!arc && t >= 3) {
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        c.save();
        // [v4.7 3차] 반투명 동그라미 꼬리 삭제 — 흐린 덩어리로 보임(검수). 꼬리는 render9의 잔상 점 · 휜 빛 띠가 대신함
        c.restore();
        // [v4.7 3차] 4단계부터 붙던 큰 빛 번짐 삭제(같은 이유)
        if (t >= 5 && s.kind !== 'bullet') { c.save(); c.translate(s.x, s.y); c.rotate(this.time * 9);   // [v4.7 2차] 개틀링 총알마다 고리가 붙으면 굴렁쇠처럼 보임
        c.strokeStyle = t >= 6 ? '#fff6c8' : col; c.lineWidth = 2; c.globalAlpha = 0.8; c.beginPath(); c.ellipse(0, 0, 10 * k, 4.5 * k, 0, 0, TAU); c.stroke(); c.restore(); if (Math.random() < 0.4) this.part({ x: s.x, y: s.y, life: 0.3, size: 3, col: t >= 6 ? '#fff6c8' : col, kind: 'star', vr: 6 }); }
      }
      c.save(); c.translate(s.x, s.y); c.scale(k, k); c.translate(-s.x, -s.y);
      baseDrawShots.call(this, c, { shots: [s] });
      c.restore();
    }
  };
  R.impact = function (e) {
    baseImpact.call(this, e);
    const t = e.tier || 1; if (t < 3) return;
    const col = (D.TOWERS[e.type] || {}).color || '#fff', r = 8 + t * 6;
    this.addFx(0.24, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.9; c.strokeStyle = col; c.lineWidth = 3 + t * 0.6; c.beginPath(); c.ellipse(e.x, e.y + 4, r * (0.4 + p), r * 0.45 * (0.4 + p), 0, 0, TAU); c.stroke(); c.restore(); });
    if (t >= 5) { this.sprite(['fx_flash', 'fx_hit'], e.x, e.y, 26 + t * 7, 16); for (let k = 0; k < t; k++) { const a = rnd(0, TAU); this.part({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 120 - 60, life: 0.35, size: 3, col: k % 2 ? '#ffffff' : col, kind: 'spark', grav: 300 }); } }
  };

  // ------------------------------------------------------------ 보스 교란(마녀 · 마술사): 보스에게서 마법 줄기가 날아가 포탑이 바뀐다 — 무작위 출현이 아니라 보스 스킬임을 보이게
  const baseConsume = R.consume;
  R.consume = function (game, events, audio) {
    baseConsume.call(this, game, events, audio);
    for (const e of events) {
      if (e.ev !== 'hexed') continue;
      const b = game.boss, [x, y] = G.tiles[e.i].tower;
      if (b) {
        const x0 = b.x, y0 = b.y - 40 * (b.g || 1), col = e.prism ? '#e0d0ff' : '#b07cff';
        this.addFx(0.45, (c, p) => {
          const q = Math.min(1, p / 0.6), mx = (x0 + x) / 2, my = Math.min(y0, y) - 90, tx = (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * mx + q * q * x, ty = (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * my + q * q * (y - 30);
          c.save(); c.globalAlpha = 1 - Math.max(0, p - 0.6) / 0.4; c.strokeStyle = col; c.lineWidth = 4; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, tx, ty); c.stroke(); c.restore();
          this.glow(c, tx, ty, 26, col, 0.9 * (1 - p)); this.star(c, tx, ty, 4, 10, 3, p * 8, '#ffffff');
        }, 'over');
      }
      this.say((e.prism ? '마술사' : '마녀') + ' 스킬', '#ffb0e0', x, y - 122, 1.2, 17);
    }
  };

  // ------------------------------------------------------------ 한 장면(render.js frame 대체)
  const clamp01 = v => Math.max(0, Math.min(1, v));
  R.frame = function (game, dt, ui) {
    this._game = game;
    this.time += dt;
    const c = this.ctx;
    for (const f of this.fx) if (f.end && this.time - f.t0 >= f.dur && !f.ended) { f.ended = true; f.end(); }
    this.fx = this.fx.filter(f => this.time - f.t0 < f.dur || (f.end && !f.ended));
    c.save();
    this.shakeX = this.shakeY = 0;
    if (this.shake > 0.3) { this.shakeX = rnd(-1, 1) * this.shake; this.shakeY = rnd(-1, 1) * this.shake * 0.6; c.translate(this.shakeX, this.shakeY); this.shake *= Math.pow(0.0015, dt); } else this.shake = 0;
    c.drawImage(this.I(this.boardKey || 'board') || this.I('board'), 0, 0, 720, 900);
    this.drawTiles(c, game);
    this.drawFx(c, 'under');
    if (game.offer && game.t <= game.offer.until) { const k = 0.5 + 0.5 * Math.sin(this.time * 8); this.footRing(c, game.offer.i, '#5fe06a', 0.6 + 0.4 * k, 4); }
    // 깊이 순서: 포탑 · 몬스터 · 말(발 위치 y). 앞 변 말은 포탑 뒤, 뒤 변 말은 포탑 앞
    const dragging = this.drag && this.drag.active;
    const items = [];
    for (const t of game.tiles) if (t.tower && !(dragging && this.drag.from === t.i)) items.push([G.tiles[t.i].tower[1], 0, t.i]);
    for (const m of game.monsters) if (m.alive) items.push([m.y, 1, m]);
    items.push([this.pawnPose(game.pawn, 1).y + 0.5, 2]);
    if (game.partner) items.push([this.pawnPose(game.partner, 1).y + 0.6, 3]);
    items.sort((a, b) => a[0] - b[0]);
    for (const it of items) {
      if (it[1] === 0) this.drawTower(c, game, it[2]);
      else if (it[1] === 1) this.drawMonster(c, game, it[2]);
      else if (it[1] === 2) this.drawPawnBody(c, game);
      else this.drawPartnerBody(c, game);
    }
    const mf = this.mergeFrom;
    if (mf && this.time - mf.t < 0.18) {
      const p = (this.time - mf.t) / 0.18, a = G.tiles[mf.a].tower, b = G.tiles[mf.b].tower, e2 = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      this.drawTower(c, game, mf.b, { at: [a[0] + (b[0] - a[0]) * e2, a[1] + (b[1] - a[1]) * e2 - Math.sin(p * Math.PI) * 30], scale: 1 - p * 0.5, tw: mf.tw, alpha: 1 - p * 0.3 });
    }
    this.drawStarsPass(c, game);
    if (game.offer && game.t <= game.offer.until && game.tiles[game.offer.i].tower) {
      const R2 = this.towerRect(game, game.offer.i), ax = R2.cx, ay = R2.y - 22 + Math.sin(this.time * 8) * 4;
      c.fillStyle = '#2b1426'; c.beginPath(); c.moveTo(ax - 13, ay - 18); c.lineTo(ax + 13, ay - 18); c.lineTo(ax, ay + 1); c.closePath(); c.fill();
      c.fillStyle = '#5fe06a'; c.beginPath(); c.moveTo(ax - 9, ay - 15.5); c.lineTo(ax + 9, ay - 15.5); c.lineTo(ax, ay - 3); c.closePath(); c.fill();
    }
    if (!dragging && this.mergeHints) this.mergeHints(c, game);   // [v5.5] 합칠 짝이 있으면 포탑 위 계열 색 두 겹 화살표
    this.drawShots(c, game);
    this.drawParts(c, dt, 'world');
    this.drawFx(c, 'over');
    this.drawPawnBadge(c, game);
    if (game.partner) this.drawPartnerTag(c);
    // 합치기: 판 전체를 어둡게 → 합칠 수 있는 포탑만 다시 밝게 + 위에서 빛줄기 → 든 포탑(맨 위)
    if (dragging) {
      const d = this.drag;
      c.save(); c.fillStyle = 'rgba(14,8,26,0.6)'; c.fillRect(-30, -30, 780, 960); c.restore();
      const ok = game.tiles.filter(t => t.tower && t.i !== d.from && game.canMerge(d.from, t.i)).sort((a, b) => G.tiles[a.i].tower[1] - G.tiles[b.i].tower[1]);
      for (const t of ok) this.mergeBeam(c, t.i, d.target === t.i);
      // [v5.5] 다가갈수록 짝 포탑이 커짐(150px 안에서 점점 · 고른 대상은 1.24배) · 든 포탑은 놓인 크기보다 15% 크게
      const near = i => { if (d.fx == null) return 0; const [tx, ty] = G.tiles[i].tower; return clamp01(1 - Math.hypot(tx - d.fx, ty - d.fy) / 150); };
      for (const t of ok) { const q = near(t.i), sc = d.target === t.i ? 1.24 + Math.sin(this.time * 14) * 0.015 : 1 + 0.14 * q * q; this.drawTower(c, game, t.i, { scale: sc }); }
      this.drawStarsPass(c, game, new Set(ok.map(t => t.i)));
      if (!ok.length) { c.save(); c.font = '700 20px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; this.outlined(c, '합칠 짝이 없어요', 360, 150, '#d9cfff', '#2b1426', 6); c.restore(); }
      if (d.fx != null) { const tw = game.tiles[d.from].tower; this.drawTower(c, game, d.from, { at: [d.fx, d.fy - 14], scale: 1.15, shadow: [d.fx, d.fy + 2], tw }); this.starsFor(c, game, d.from, tw, [d.fx, d.fy - 14 - 6]); }
    }
    if (this.dice) this.drawDice(c);
    if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(0.5, this.flash)})`; c.fillRect(-20, -20, 760, 940); this.flash -= dt; }
    c.restore();
    this.drawTop(dt);
    void ui;
  };
})(window);
