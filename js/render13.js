// v5.7 층(Renderer에 덧붙임) — 작전 카드가 판을 바꿀 때 '어느 칸이 · 어떻게' 바뀌는지 차례로 보이게
// 사용자(2026-11-10): '블록판 3개가 좋아진다를 골라도 어떤 블록판이 어떻게 좋아지고, 어떤 이펙트 · 포커싱이 가는지 모르겠다.
//   지금은 모든 흐름에 딜레이가 없는데, 인지를 위해 어느 정도 딜레이가 있어도 된다'
// 흐름(지침 3-6 예고 → 이동 → 변신 → 강조):
//   ① 예고 0.6초: 판이 어두워지고 대상 칸만 밝게 뚫림(포커스) · 판 가운데에 고른 카드(등급 색 틀 + 아이콘 + 이름 + 한 줄)가 뜸 · 대상 칸 테두리가 깜박
//   ② 이동: 카드에서 대상 칸으로 등급 색 빛이 한 칸씩 차례로 날아감(칸마다 0.55초, 많으면 짧게)
//   ③ 변신: 빛이 닿는 순간에만 칸이 바뀜(그 전까지는 예전 모습 — 단계 · 종류 · 땅 · 빈칸을 그릴 때만 되돌려 그림)
//   ④ 강조: 닿은 칸에 고리 · 알갱이 · '무엇이 → 무엇' 글씨가 끝날 때까지 남음
//   그동안 판(몬스터 · 시간)은 멈춘다(main.js가 cardBusy()를 보고 step을 쉼 — 혼자 할 때만. 온라인은 멈추지 않고 그림만)
// 판에 효과가 없는 카드(날카로운 탄 · 질풍 …)는 위 알림 띠로 '무엇을 골랐는지'만 짧게
// 그리기 원칙: 오프스크린 캔버스 캐시 없음 · 'lighter' 없음
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eo = t => 1 - Math.pow(1 - t, 3), eb = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const PLUM = '#2b1426';
  const GR = { c: { col: '#e8e4f0', lt: '#ffffff', dk: '#7a7090', name: '일반' }, r: { col: '#5ab4ff', lt: '#cfe8ff', dk: '#1d4a8a', name: '희귀' }, e: { col: '#c070ff', lt: '#ecd2ff', dk: '#5a1a9a', name: '영웅' }, l: { col: '#ffc21c', lt: '#fff2a0', dk: '#8a4a0a', name: '전설' } };
  const INTRO = 0.7, TAIL = 1.0;
  const tname = t => (D.TOWERS[t] || {}).name || t;
  // 밝게 뚫을 자리 = 포탑 자리와 칸 가운데의 사이(포탑 몸 + 칸 바닥 문양이 다 들어가게)
  const holeOf = i => { const [tx, ty] = G.tiles[i].tower, [cx, cy] = G.tiles[i].center; return [(tx + cx) / 2, (ty + cy) / 2 - 34, 74, 92]; };

  // 아래 설명 띠 자리 = 가장 아래 칸 포탑보다 60px 아래
  const LINE_Y = Math.max(...G.tiles.map(t => t.tower[1])) + 62;
  // 고른 카드가 '실제로' 무엇을 몇 개 바꿨는지 한 줄
  const summary = X => {
    const n = X.steps.length, T = X.types ? X.types.map(tname) : [];
    switch (X.id) {
      case 'reclaim': return `평지 ${n}칸 → 좋은 땅`;
      case 'lift': return `가장 낮은 포탑 ${n}개 +1단계`;
      case 'vote': return `가장 많은 ${T[0] || '포탑'} ${n}개 전부 +1단계`;
      case 'jokerhat': return `낮은 포탑 ${n}개 → 한 단계 위 프리즘(아무 포탑과 합체)`;
      case 'lucky7': return `무작위 포탑 ${n}개 +1단계`;
      case 'seed': return `빈 땅 ${n}칸에 새 포탑`;
      case 'miracle': return `몬스터 싹쓸이 + 포탑 ${n}개 +1단계`;
      case 'focus': return `${T[0]} 피해 +40%`;
      case 'awaken': return `${T.join(' · ')} 피해 +30% · 3단계부터 각성`;
      default: return X.C.desc;
    }
  };
  R.cr13 = function () { return this._cr13 || (this._cr13 = { q: [], cur: null }); };
  // 화면이 판을 멈춰야 하는 동안 true
  R.cardBusy = function () { const S = this.cr13(); return !!(S.cur || S.q.length); };

  // ------------------------------------------------------------ 사건
  const base13 = R.consume;
  R.consume = function (game, events, audio) {
    const S = this.cr13(), keep = [];
    this._A13 = audio || this._A13;
    for (const e of events) {
      // 카드가 바꾼 칸의 단계업 · 짓기 · 개간 표시는 옛 층이 바로 그리지 않음(아래 차례 연출이 맡음)
      if (e.card && (e.ev === 'tierup' || e.ev === 'build' || e.ev === 'reclaim2')) continue;
      if (e.ev === 'cardFx') {
        const C = D.CARDS[e.id] || { name: '기적의 돌', g: 'l', desc: '' }, gr = C.g;
        const steps = (e.steps || []).map(s => { const tw = game.tiles[s.i].tower; return Object.assign({ tid: tw ? tw.id : null, done: false }, s); });
        if (!steps.length && !e.types) {
          // 판에 효과가 없는 카드 = 위 알림 띠로만
          this.ribbon(C.name, C.desc, true, null, { col: GR[gr].col, dur: 2.2 });
          continue;
        }
        const n = steps.length, gap = n ? Math.min(0.55, 2.6 / n) : 0;
        const types = e.types || null;
        const typeTiles = types ? game.tiles.filter(t => t.tower && types.includes(t.tower.type)).map(t => t.i) : [];
        const dur = INTRO + n * gap + (types && !n ? 1.6 : 0) + TAIL;
        S.q.push({ id: e.id, C, gr, steps, gap, types, typeTiles, dur, trig: !!e.trig, net: !!(this._app13 && this._app13.net) });
        continue;
      }
      keep.push(e);
    }
    base13.call(this, game, keep, audio);
  };

  // ------------------------------------------------------------ 진행(매 장면)
  R.cr13Tick = function (game) {
    const S = this.cr13(), A = this._A13, t = this.time;
    if (!S.cur && S.q.length) {
      S.cur = S.q.shift(); S.cur.t0 = t;
      const X = S.cur;
      if (A) { try { A.card && A.card(); if (X.gr === 'l' && A.jackpot) A.jackpot(); else if (X.gr !== 'c' && A.upgrade) A.upgrade(); } catch (er) { /* 소리 없음 */ } }
      if (X.trig) { this.shake = Math.max(this.shake || 0, 10); this.flash = Math.max(this.flash || 0, 0.5); }
    }
    const X = S.cur; if (!X) return;
    const a = t - X.t0;
    X.steps.forEach((s, k) => {
      const hit = INTRO + k * X.gap + 0.35;
      if (!s.done && a >= hit) { s.done = true; s.at = t; this.cr13Hit(game, X, s); }
    });
    if (X.types && !X.steps.length && !X.typeHit && a >= INTRO) { X.typeHit = true; for (const i of X.typeTiles) { const [x, y] = G.tiles[i].tower; this.ring(x, y + 4, 46, GR[X.gr].col, 0.7, 5); } if (A && A.good) A.good(); }
    if (a >= X.dur) S.cur = null;
  };
  R.cr13Hit = function (game, X, s) {
    const A = this._A13, col = GR[X.gr].col, lt = GR[X.gr].lt, [x, y] = G.tiles[s.i].tower;
    this.ring(x, y + 4, 40, col, 0.6, 6); this.ring(x, y + 4, 26, '#ffffff', 0.4, 3);
    for (let q = 0; q < 14; q++) { const an = q / 14 * TAU + rnd(-0.2, 0.2), sp = rnd(120, 230); this.part({ x, y: y - 24, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.7 - 60, grav: 260, drag: 1.5, life: rnd(0.5, 0.8), size: rnd(3, 6), col: q % 3 ? col : lt, kind: 'star', vr: rnd(-6, 6) }); }
    if (s.kind === 'trait') { const b = G.tiles[s.i].badge; this.ring(b[0], b[1], 30, '#ffd23a', 0.7, 5); }
    if (A) { try { if (s.kind === 'build' && A.build) A.build(); else if (A.tierup) A.tierup(); } catch (er) { /* 소리 없음 */ } }
  };
  // 무엇이 → 무엇(칸 위에 남는 글씨)
  const stepText = s => s.kind === 'tier' ? [`${s.from} → ${s.to}단계`, tname(s.type)]
    : s.kind === 'build' ? ['새 포탑!', tname(s.type)]
    : s.kind === 'prism' ? ['프리즘 ' + s.tier + '단계!', tname(s.from) + ' → 아무와 합체']
    : s.kind === 'trait' ? [(D.TRAITS[s.to] || {}).name + '!', '평지 → ' + ((D.TRAITS[s.to] || {}).desc || '')] : ['', ''];

  // ------------------------------------------------------------ 닿기 전엔 예전 모습으로 그림(그릴 때만 바꾸고 바로 되돌림)
  const frame13 = R.frame;
  R.frame = function (game, dt, ui) {
    if (game && game.tiles) this.cr13Tick(game);
    const X = this.cr13().cur, undo = [];
    if (X && game && game.tiles) {
      for (const s of X.steps) {
        if (s.done) continue;
        const tl = game.tiles[s.i], tw = tl.tower;
        if (s.kind === 'trait') { const v = tl.trait; tl.trait = null; undo.push(() => { tl.trait = v; }); }
        else if (!tw || tw.id !== s.tid) continue;
        else if (s.kind === 'build') { tl.tower = null; undo.push(() => { tl.tower = tw; }); }
        else if (s.kind === 'tier') { const v = tw.tier; tw.tier = s.from; undo.push(() => { tw.tier = v; }); }
        else if (s.kind === 'prism') { const v = tw.type, vt = tw.tier; tw.type = s.from; if (s.fromTier) tw.tier = s.fromTier; undo.push(() => { tw.type = v; tw.tier = vt; }); }
      }
    }
    try { return frame13.call(this, game, dt, ui); } finally { for (let k = undo.length - 1; k >= 0; k--) undo[k](); }
  };

  // ------------------------------------------------------------ 그리기: 어둡게 + 대상 칸 뚫기 · 카드 표식 · 날아가는 빛 · 글씨
  R.cardReveal = function (c, game) {
    const X = this.cr13().cur; if (!X) return;
    const t = this.time, a = t - X.t0, Gc = GR[X.gr];
    const fin = clamp((X.dur - a) / 0.35, 0, 1), inn = clamp(a / 0.3, 0, 1), vis = Math.min(inn, fin);
    const targets = X.steps.length ? X.steps.map(s => s.i) : X.typeTiles;
    // ① 어둡게 + 대상 칸만 밝게(구멍)
    //   구멍마다 '판 − 구멍 하나'로 잘라 겹쳐 자름 = 판 − 모든 구멍의 합(이웃 칸 구멍이 겹쳐도 겹친 곳이 다시 어두워지지 않게)
    c.save();
    for (const i of targets) { const hc = holeOf(i); c.beginPath(); c.rect(-20, -20, 760, 940); c.moveTo(hc[0] + hc[2], hc[1]); c.ellipse(hc[0], hc[1], hc[2], hc[3], 0, 0, TAU); c.clip('evenodd'); }
    c.globalAlpha = 0.5 * vis; c.fillStyle = '#120a1c'; c.fillRect(-20, -20, 760, 940); c.restore();
    // 대상 칸 테두리: 닿기 전 = 점선이 돎(예고) · 닿은 뒤 = 실선 빛
    for (const i of targets) {
      const s = X.steps.find(q => q.i === i), done = !s || s.done, [x, y] = G.tiles[i].tower, pu = 0.5 + 0.5 * Math.sin(t * 9 + i);
      c.save(); c.globalAlpha = vis * (done ? 0.95 : 0.6 + 0.4 * pu); c.lineWidth = done ? 5 : 3.5; c.strokeStyle = done ? Gc.col : '#ffffff';
      if (!done) { c.setLineDash([10, 7]); c.lineDashOffset = -t * 30; }
      c.beginPath(); c.ellipse(x, y + 4, 46, 18, 0, 0, TAU); c.stroke(); c.restore();
    }
    // ② 카드 표식(판 가운데): 등급 색 틀 + 아이콘 + 이름 + 한 줄
    const [cx0, cy0] = G.plaza, sc = eb(clamp(a / 0.45, 0, 1)) * (0.92 + 0.08 * fin), cx = cx0, cy = cy0 - 6;
    if (vis > 0) {
      c.save(); c.globalAlpha = vis; c.translate(cx, cy); c.scale(sc, sc);
      this.glow(c, 0, 0, 120, Gc.col, 0.45);
      if (X.gr === 'l' || X.gr === 'e') { c.save(); c.rotate(t * 0.6); c.globalAlpha *= 0.35; c.fillStyle = Gc.lt; for (let k = 0; k < 12; k++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(-9, -120); c.lineTo(9, -120); c.closePath(); c.fill(); } c.restore(); }
      const w = 96, h = 124;
      c.fillStyle = PLUM; this.rr(c, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 14); c.fill();
      c.fillStyle = Gc.col; this.rr(c, -w / 2, -h / 2, w, h, 11); c.fill();
      c.fillStyle = '#2b2552'; this.rr(c, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 8); c.fill();
      const im = this.I('k_' + X.id);
      if (im) { const M = root.MANIFEST['k_' + X.id] || { w: 96, h: 96 }, s2 = 70 / Math.max(M.w, M.h); c.drawImage(im, -M.w * s2 / 2, -h / 2 + 14, M.w * s2, M.h * s2); }
      else if (X.types) { const ty = X.types[0], ti = this.I(`t_${ty}_3`), M = root.MANIFEST[`t_${ty}_3`]; if (ti && M) { const s2 = 74 / Math.max(M.w, M.h); c.drawImage(ti, -M.w * s2 / 2, -h / 2 + 12, M.w * s2, M.h * s2); } }
      c.font = '700 13px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      this.outlined(c, Gc.name, 0, -h / 2 + 2, Gc.lt, PLUM, 4);
      c.font = '700 17px Jua, sans-serif'; this.outlined(c, X.C.name, 0, h / 2 - 22, '#ffffff', PLUM, 5);
      c.restore();
      // 한 줄 설명(카드 아래) — 종류 카드는 고른 종류 이름까지
      const line = summary(X);
      c.save(); c.globalAlpha = vis * clamp((a - 0.25) / 0.3, 0, 1); c.font = '700 20px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = Math.min(640, c.measureText(line).width + 32), ly = LINE_Y;   // 판 아래 빈 곳(칸 · 글씨와 안 겹치게)
      c.fillStyle = 'rgba(31,26,58,0.92)'; this.rr(c, cx - tw / 2, ly - 19, tw, 38, 13); c.fill(); c.strokeStyle = Gc.col; c.lineWidth = 3; c.stroke();
      this.outlined(c, line.length > 40 ? line.slice(0, 39) + '…' : line, cx, ly + 1, '#fff4e0', PLUM, 4);
      c.restore();
      if (X.types && !X.steps.length && !X.typeTiles.length) {   // 판에 아직 그 종류가 없을 때(판 시작 카드)
        c.save(); c.globalAlpha = vis * clamp((a - 0.5) / 0.3, 0, 1); c.font = '700 15px Jua, sans-serif'; c.textAlign = 'center'; this.outlined(c, '이 종류를 지으면 바로 적용', cx, LINE_Y + 34, Gc.lt, PLUM, 4); c.restore();
      }
    }
    // ③ 날아가는 빛(카드 → 칸)
    X.steps.forEach((s, k) => {
      const st = INTRO + k * X.gap, p = (a - st) / 0.35; if (p < 0 || p > 1) return;
      const [x2, y2] = G.tiles[s.i].tower, ty = y2 - 30, mx = (cx + x2) / 2, my = Math.min(cy, ty) - 90, q = eo(p);
      const P = u => [(1 - u) * (1 - u) * cx + 2 * (1 - u) * u * mx + u * u * x2, (1 - u) * (1 - u) * cy + 2 * (1 - u) * u * my + u * u * ty];
      c.save(); c.lineCap = 'round';
      for (const [col, w] of [[PLUM, 9], [Gc.col, 5], ['#ffffff', 2]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (let u = Math.max(0, q - 0.35); u <= q + 1e-6; u += 0.04) { const pp = P(Math.min(u, q)); u === Math.max(0, q - 0.35) ? c.moveTo(pp[0], pp[1]) : c.lineTo(pp[0], pp[1]); } c.stroke(); }
      const hd = P(q); this.glow(c, hd[0], hd[1], 26, Gc.col, 0.8); this.star(c, hd[0], hd[1], 5, 10, 4, t * 8, '#ffffff');
      c.restore();
      if (Math.random() < 0.6) this.part({ x: hd[0], y: hd[1], vx: rnd(-30, 30), vy: rnd(-30, 30), life: 0.35, size: rnd(2, 4), col: Gc.lt, kind: 'star', vr: 4 });
    });
    // ④ 닿은 칸 위 글씨(끝날 때까지)
    for (const s of X.steps) {
      if (!s.done) continue;
      const [x, y] = G.tiles[s.i].tower, Rr = this.towerRect(game, s.i), top = Rr ? Rr.y : y - 60, age = t - s.at, pop = eb(clamp(age / 0.3, 0, 1));
      const [t1, t2] = stepText(s), many = X.steps.length > 4;   // 칸이 많으면(기적의 돌 · 행운의 7) 이웃 글씨가 겹치니 한 줄 · 작게
      c.save(); c.globalAlpha = fin; c.translate(x, top - (many ? 10 : 18)); c.scale(pop, pop); c.textAlign = 'center'; c.textBaseline = 'middle';
      if (many) { c.font = '700 17px Jua, sans-serif'; this.outlined(c, s.kind === 'tier' ? '▲' + s.to + '단계' : t1, 0, 0, Gc.lt, PLUM, 5); }
      else {
        c.font = '700 21px Jua, sans-serif'; this.outlined(c, t1, 0, 0, s.kind === 'trait' ? '#ffe28a' : Gc.lt, PLUM, 6);
        c.font = '700 14px Jua, sans-serif'; this.outlined(c, t2.length > 18 ? t2.slice(0, 17) + '…' : t2, 0, 20, '#fff4e0', PLUM, 4);
      }
      c.restore();
    }
    if (X.types && !X.steps.length) for (const i of X.typeTiles) {
      const [x, y] = G.tiles[i].tower, Rr = this.towerRect(game, i), top = Rr ? Rr.y : y - 60;
      c.save(); c.globalAlpha = fin * clamp((a - INTRO) / 0.25, 0, 1); c.font = '700 19px Jua, sans-serif'; c.textAlign = 'center'; this.outlined(c, X.id === 'focus' ? '피해 +40%' : '각성 미리 · +30%', x, top - 16, Gc.lt, PLUM, 5); c.restore();
    }
  };

  // 맨 위(포탑 · 몬스터 위, 'over' 효과 다음)에 그림
  const fx13 = R.drawFx;
  R.drawFx = function (c, layer) {
    fx13.call(this, c, layer);
    if (layer === 'over' && this._game) this.cardReveal(c, this._game);
  };
})(window);
