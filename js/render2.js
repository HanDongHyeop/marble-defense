// 포탑 11종 추가분 그리기 — 탄 · 명중 · 범위 이펙트 · 몬스터 상태 표시(Renderer에 덧붙임)
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MUZ = {
    ice: ['#ffffff', '#d8f4ff', '#7ecbff'], poison: ['#f0ffe0', '#a6f06a', '#4aa83a'], railgun: ['#ffffff', '#bfe6ff', '#4aa0ff'],
    mining: ['#fff6c8', '#ffd23a', '#c27a00'], summon: ['#ffffff', '#b8fff0', '#2fc8a8'], combo: ['#ffffff', '#ffc8f0', '#ff5ac8'],
    beacon: ['#fff6c8', '#ffb347', '#ff6a1c'], growth: ['#ffffff', '#fff2b0', '#ffd24a'], corrode: ['#f0ffd0', '#c6f04a', '#6a9a1a'],
    greed: ['#fff6c8', '#ffd23a', '#b07a00'], prism: ['#ffffff', '#ffd0ff', '#9a7aff'],
  };
  const REACT_COL = { thermal: '#ff9a4a', superc: '#c9a8ff', toxic: '#9aff5a', shatter: '#e6f0ff' };

  const baseMuzzle = R.muzzle, baseImpact = R.impact, baseConsume = R.consume, baseDrawShots = R.drawShots, baseDrawMonster = R.drawMonster;

  R.muzzleCol = function (type) { return MUZ[type]; };
  R.muzzle = function (e) {
    if (!MUZ[e.type]) return baseMuzzle.call(this, e);
    const col = MUZ[e.type], x = e.x, y = e.y, rot = Math.random() * 3, big = e.tier >= 4 ? 1.35 : 1;
    if (e.type !== 'railgun') this.addFx(0.12, (c, p) => { const s = (1 - p * 0.6) * big; this.glow(c, x, y, 24 * s, col[2], 0.55 * (1 - p)); this.star(c, x, y, 5, 13 * s, 4.5 * s, rot, col[2]); this.star(c, x, y, 5, 9 * s, 3 * s, rot + .3, col[1]); this.circle(c, x, y, 4 * s, col[0]); });
    const ta = this.towerAnim[e.i] || (this.towerAnim[e.i] = {}); ta.recoil = this.time; ta.aim = e.tx; ta.aimY = e.ty;
  };
  R.impact = function (e) {
    const x = e.x, y = e.y, k = e.kind;
    const burst = (n, cols, sp, life, size, grav) => { for (let q = 0; q < n; q++) { const a = rnd(0, TAU), v = rnd(sp * .5, sp); this.part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: rnd(life * .7, life), size: rnd(size * .7, size), col: cols[q % cols.length], kind: 'spark', grav: grav || 300 }); } };
    if (k === 'icicle') { this.sprite(['fx_zap'], x, y, 26, 8); this.addFx(0.25, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#e6f6ff'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 6, 10 + p * 22, 5 + p * 10, 0, 0, TAU); c.stroke(); c.restore(); }); burst(6, ['#ffffff', '#bfe6ff', '#7ecbff'], 170, .35, 3.5); return; }
    if (k === 'dart') { this.sprite(['fx_acid'], x, y, 30, 8); burst(5, ['#a6f06a', '#4aa83a', '#d8ff9a'], 120, .4, 3.5, 380); this.addFx(.2, (c, p) => this.glow(c, x, y, 22, '#7be06a', .7 * (1 - p))); return; }
    if (k === 'ore') { this.sprite(['fx_spark'], x, y, 24, 10); burst(6, ['#ffd23a', '#fff6c8', '#8a6a3a'], 160, .4, 3.5, 420); this.addFx(.12, (c, p) => this.circle(c, x, y, 9 * (1 - p), '#fff6c8')); return; }
    if (k === 'ingot') { this.explosion(x, y, 24, .8); burst(10, ['#ffd23a', '#fff6c8'], 220, .55, 4, 500); return; }
    if (k === 'spirit') { if (this.pxBurst9) this.pxBurst9(x, y, 14, ['#2fc8a8', '#ffffff', '#b8fff0'], 0.25); else this.sprite(['fx_magic'], x, y, 34, 7);   // [v4.7 3차] 흐린 마법 그림 → 픽셀 폭발
      for (let q = 0; q < 6; q++) this.part({ x, y, vx: rnd(-60, 60), vy: rnd(-90, -30), life: .5, size: 4, col: '#b8fff0', kind: 'star', vr: 6 }); return; }
    if (k === 'orb2') { if (this.pxBurst9) this.pxBurst9(x, y, 13, ['#ff5ac8', '#ffffff', '#ffc8f0'], 0.22); else this.sprite(['fx_magic'], x, y, 30, 8);   // [v4.7 3차] 분홍 구름 → 픽셀 폭발
      this.addFx(.18, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#ffc8f0'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 6 + p * 20, 0, TAU); c.stroke(); c.restore(); }); return; }
    if (k === 'arrow') { const t = e.tier || 1; if (t === 1) { burst(3, ['#a8703a', '#e8e0d0'], 110, .25, 3, 420); return; } if (this.pxBurst9) this.pxBurst9(x, y, t === 2 ? 8 : 13, ['#ff8a1c', '#ffffff', '#ffd23a'], 0.24); burst(t === 2 ? 4 : 6, ['#ffd23a', '#ff8a1c', '#fff6c8'], 150, .35, 3, 300); return; }
    if (k === 'bless') { this.addFx(.3, (c, p) => { this.glow(c, x, y, 30, '#ffe48a', .8 * (1 - p)); this.star(c, x, y - p * 10, 4, 14 * (1 - p * .5), 3, p * 3, `rgba(255,255,255,${1 - p})`); }); return; }
    if (k === 'acid') { this.sprite(['fx_acid'], x, y, 34, 8); burst(7, ['#c6f04a', '#6a9a1a', '#e8ff9a'], 140, .45, 4, 420); this.addFx(.8, (c, p) => { c.save(); c.globalAlpha = .55 * (1 - p); c.fillStyle = '#7ab02a'; c.beginPath(); c.ellipse(x, y + 14, 14 + p * 6, 5 + p * 2, 0, 0, TAU); c.fill(); c.restore(); }, 'under'); return; }
    if (k === 'coin') { this.sprite(['fx_spark'], x, y, 24, 10); burst(6, ['#ffd23a', '#fff6c8', '#c27a00'], 180, .4, 3, 500); return; }
    return baseImpact.call(this, e);
  };
  R.consume = function (game, events, A) {
    baseConsume.call(this, game, events, A);
    for (const e of events) {
      switch (e.ev) {
        case 'react': this.reactFx(e); A && A.react && A.react(e.kind); break;
        case 'frozen': A && A.freeze && A.freeze(); break;
        case 'frost': this.frostFx(e.x, e.y, e.big); break;
        case 'fog': this.cloud(e.x, e.y - 8, e.big ? 1.6 : 1, ['#7be06a', '#4aa83a', '#a6f06a'], 1.4); break;
        case 'acidpool': this.pool(e.x, e.y, e.big ? 1.5 : 1); break;
        case 'fogzone': this.zoneCloud(e.zone, e.acid); break;
        case 'coinrain': this.coinRain(e.x, e.y, e.big); A && A.coin(2); break;
        case 'rail': this.railBeam(e.pts, e.tier); A && A.rail && A.rail(); break;
        case 'spirits': this.spiritRush(e); break;
        case 'bell': this.bellFx(e.i); A && A.bell && A.bell(); break;
        case 'slash': this.slashFx(e.x, e.y, e.big); break;
        case 'blizzard': this.blizzard(); A && A.freeze && A.freeze(); break;
        case 'orbital': this.orbital(e.x, e.y); A && A.boom(); break;
        case 'beaconAll': this.banner('봉화! 판 전체 피해 +30%', '#ffb347', 1.3); break;
        case 'rainbow': this.rainbow(e); break;
        case 'comboUp': this.say('콤보 ' + e.n, '#ff8adf', 620, 280, 0.9, 22); break;
        case 'comboLost': this.say('콤보 끊김', '#c9c9c9', 620, 280, 0.9, 20); break;
        case 'hexed': { const [x, y] = G.tiles[e.i].tower; this.smoke(x, y - 20, 1.2); this.ring(x, y, 40, '#b07cff', .6, 5); this.say(e.prism ? '프리즘으로!' : '종류가 바뀜!', '#d8b8ff', x, y - 90, 1); A && A.bad(); break; }
        case 'quake': { for (const i of [e.a, e.b]) { const [x, y] = G.tiles[i].tower; this.smoke(x, y, 1); } this.shake = Math.max(this.shake, 14); this.banner('지진! 포탑 자리가 뒤섞임', '#e0b080', 1.3); A && A.thud(); break; }
        case 'swap': { for (const i of [e.a, e.b]) { const [x, y] = G.tiles[i].tower; this.ring(x, y, 36, '#9fe0ff', .6, 5); for (let q = 0; q < 8; q++) this.part({ x: x + rnd(-20, 20), y: y - rnd(0, 50), vy: -60, life: .6, size: 4, col: '#d8f4ff', kind: 'star', vr: 6 }); } A && A.commander(); break; }
        case 'absorb': { const [x, y] = G.tiles[e.i].tower; this.say('흡수! 공격력 +', '#ff6a6a', x, y - 100, 1.1); this.dread(game, { i: e.i }); break; }
        case 'summoned': { const [x, y] = G.tiles[e.i].tower; this.addFx(.7, (c, p) => { c.save(); c.translate(x, y); c.scale(1, .45); c.rotate(p * 5); c.globalAlpha = 1 - p; c.strokeStyle = '#2fc8a8'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.stroke(); c.restore(); }, 'under'); break; }
        case 'grow': this.tierupFx(e.i, e.tier); this.say('성장 성공!', '#fff2a0', G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 120, 1); A && A.tierup(); break;
        case 'growFail': { const [x, y] = G.tiles[e.i].tower; this.smoke(x, y - 20, 1); this.say(e.gone ? '성장 실패 — 사라짐' : '성장 실패 −1단계', '#c9c9c9', x, y - 90, 1); A && A.bad(); break; }
        case 'goldParade': this.say('황금 행렬!', '#ffd23a', G.tiles[0].pawn[0], G.tiles[0].pawn[1] - 80, 1); break;
        case 'nostrike': break;
        case 'coopBuild': this.buildFx(e.i, 1); A && A.build(); break;
        case 'coopMerge': this.mergeFx(e.i, game.tiles[e.i].tower ? game.tiles[e.i].tower.tier : 2); A && A.merge(2); break;
        case 'hop2': if (e.last) this.landDust(e.i); break;
      }
    }
  };
  R.reactFx = function (e) {
    const col = REACT_COL[e.kind] || '#fff';
    this.texts.push({ s: e.name, col, x: e.x, y: e.y - 10, t0: this.time, dur: 0.9, size: 30, kind: 'say' });
    this.addFx(.4, (c, p) => { this.glow(c, e.x, e.y + 10, 70, col, .8 * (1 - p)); c.save(); c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = 6 * (1 - p) + 1; c.beginPath(); c.arc(e.x, e.y + 10, 12 + p * 50, 0, TAU); c.stroke(); c.restore(); });
    this.shake = Math.max(this.shake, 5);
  };
  R.frostFx = function (x, y, big) {
    const s = big ? 1.6 : 1;
    this.addFx(.7, (c, p) => { c.save(); c.globalAlpha = .5 * (1 - p); c.fillStyle = '#bfe6ff'; c.beginPath(); c.ellipse(x, y + 4, 60 * s, 24 * s, 0, 0, TAU); c.fill(); c.globalAlpha = 1 - p; c.strokeStyle = '#ffffff'; c.lineWidth = 2; for (let k = 0; k < 6; k++) { const a = k * TAU / 6; c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x + Math.cos(a) * 50 * s, y + 4 + Math.sin(a) * 20 * s); c.stroke(); } c.restore(); }, 'under');
    for (let k = 0; k < 8 * s; k++) { const sx = x + rnd(-50, 50) * s, sy = y + rnd(-14, 14) * s; this.part({ x: sx, y: sy - 90, vy: 520, life: .18, size: 4, col: '#e6f6ff', kind: 'spark', delay: rnd(0, .2) }); this.part({ x: sx, y: sy, vx: rnd(-40, 40), vy: rnd(-80, -30), life: .4, size: 3, col: '#ffffff', kind: 'star', vr: 6, delay: .18 }); }
  };
  R.cloud = function (x, y, s, cols, dur) {
    for (let k = 0; k < Math.round(6 * s); k++) this.part({ x: x + rnd(-30, 30) * s, y: y + rnd(-10, 10) * s, vx: rnd(-15, 15), vy: rnd(-12, 2), life: rnd(dur * .7, dur), size: rnd(12, 20) * s, col: cols[k % cols.length], kind: 'puff', drag: 1 });
  };
  R.pool = function (x, y, s) {
    this.addFx(2.2, (c, p) => { const a = p < .1 ? p * 10 : p > .7 ? (1 - p) / .3 : 1; c.save(); c.globalAlpha = .6 * a; c.fillStyle = '#6a9a1a'; c.beginPath(); c.ellipse(x, y + 4, 46 * s, 17 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#a6d83a'; c.beginPath(); c.ellipse(x - 6, y + 2, 30 * s, 10 * s, 0, 0, TAU); c.fill(); c.restore(); if (Math.random() < .3) this.part({ x: x + rnd(-36, 36) * s, y: y + rnd(-8, 8) * s, vy: -30, life: .5, size: 3, col: '#e8ff9a', kind: 'dot' }); }, 'under');
  };
  R.zoneCloud = function (z, acid) {
    for (let k = 1; k <= 5; k++) { const p = G.lanePoint(z * 6 + k, 0); this.later(k * .05, () => acid ? this.pool(p[0], p[1], 1.1) : this.cloud(p[0], p[1] - 6, 1.4, ['#7be06a', '#4aa83a', '#a6f06a'], 1.6)); }
  };
  R.coinRain = function (x, y, big) {
    const n = big ? 14 : 8, im = this.I('i_coin');
    for (let k = 0; k < n; k++) {
      const sx = x + rnd(-40, 40), sy = y + rnd(-10, 10), d = rnd(0, .25);
      this.addFx(.5 + d, (c, p) => { const q = clamp((p * (.5 + d) - d) / .3, 0, 1); if (q <= 0) return; const yy = sy - 160 * (1 - q); if (im) { const w = Math.abs(Math.cos((this.time + k) * 10)) * 14 + 4; c.drawImage(im, sx - w / 2, yy - 9, w, 18); } if (q >= 1) this.circle(c, sx, sy, 6, '#fff6c8'); });
    }
  };
  R.railBeam = function (pts, tier) {
    const w = tier >= 4 ? 1.6 : 1;
    this.addFx(.3, (c, p) => {
      c.save(); c.globalAlpha = 1 - p; c.lineCap = 'round';
      for (const [col, lw] of [['rgba(74,160,255,0.45)', 18 * w], ['#bfe6ff', 7 * w], ['#ffffff', 2.5 * w]]) { c.strokeStyle = col; c.lineWidth = lw * (1 - p * .6); c.beginPath(); pts.forEach((q, n) => n ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); }
      c.restore();
      for (const q of pts.slice(1)) this.glow(c, q[0], q[1], 30, '#4aa0ff', .7 * (1 - p));
    });
    for (const q of pts.slice(1)) for (let k = 0; k < 4; k++) { const a = rnd(0, TAU); this.part({ x: q[0], y: q[1], vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: .25, size: 2.5, col: '#bfe6ff', kind: 'spark' }); }
    this.shake = Math.max(this.shake, tier >= 4 ? 4 : 2);
  };
  R.spiritRush = function (e) {
    for (let k = 0; k < 7; k++) this.part({ x: e.x + rnd(-20, 20), y: e.y + rnd(-10, 10), tx: e.tx + rnd(-50, 50), ty: e.ty - 14 + rnd(-14, 14), life: rnd(.3, .5), size: rnd(6, 9), col: k % 2 ? '#b8fff0' : '#2fc8a8', kind: 'suck', add: true });
  };
  R.bellFx = function (i) {
    const [x, y] = G.tiles[i].tower;
    for (let k = 0; k < 3; k++) this.later(k * .12, () => this.addFx(.6, (c, p) => { c.save(); c.globalAlpha = (1 - p) * .9; c.strokeStyle = '#ffe48a'; c.lineWidth = 5 * (1 - p) + 1; c.beginPath(); c.ellipse(x, y - 30, 30 + p * 120, 18 + p * 60, 0, 0, TAU); c.stroke(); c.restore(); }));
  };
  R.slashFx = function (x, y, big) {
    const s = big ? 1.6 : 1, rot = rnd(-0.6, 0.6);
    this.addFx(.22, (c, p) => { c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = 1 - p; c.strokeStyle = '#ffffff'; c.lineWidth = 6 * (1 - p) + 1; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 26 * s, -1.1 + p, 0.6 + p); c.stroke(); c.strokeStyle = '#ff8adf'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 20 * s, -1 + p, 0.5 + p); c.stroke(); c.restore(); });
  };
  R.blizzard = function () {
    this.flash = Math.max(this.flash, .2);
    for (let k = 0; k < 70; k++) this.part({ x: rnd(0, 760), y: rnd(-40, 300), vx: -120, vy: rnd(160, 260), life: rnd(1, 1.6), size: rnd(2, 4), col: '#ffffff', kind: 'dot', delay: rnd(0, .4) });
    this.banner('눈보라!', '#bfe6ff', 1.1);
  };
  R.orbital = function (x, y) {
    this.addFx(.45, (c, p) => { const a = p < .3 ? 1 : (1 - p) / .7; c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(74,160,255,0.5)'; c.fillRect(x - 22, -20, 44, y + 10); c.fillStyle = '#ffffff'; c.fillRect(x - 7, -20, 14, y + 10); c.restore(); this.glow(c, x, y, 90, '#4aa0ff', a); });
    this.later(.08, () => this.explosion(x, y - 10, 40, 1.3));
  };
  R.rainbow = function (e) {
    const cols = ['#ff6a6a', '#ffb347', '#ffe36a', '#7be06a', '#6ab0ff', '#b07cff'];
    this.addFx(.22, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.lineCap = 'round'; const dx = e.tx - e.x, dy = e.ty - e.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; cols.forEach((col, k) => { const o = (k - 2.5) * 2; c.strokeStyle = col; c.lineWidth = 2.5; c.beginPath(); c.moveTo(e.x + nx * o, e.y + ny * o); c.lineTo(e.tx + nx * o, e.ty + ny * o); c.stroke(); }); c.restore(); this.glow(c, e.tx, e.ty, 26, '#ffffff', .7 * (1 - p)); });
  };

  // ---------------------------------------------------------------- 새 탄 모양
  R.drawShots = function (c, game) {
    const base = [], mine = [];
    for (const s of game.shots) (MUZ[s.type] && s.kind !== 'bullet' ? mine : base).push(s);
    if (base.length) baseDrawShots.call(this, c, { shots: base });
    for (const s of mine) {
      if (s.delay > 0) continue;
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, ang = Math.atan2(uy, ux);
      if (s.d0 == null) s.d0 = Math.max(d, 1);
      const prog = clamp(1 - d / s.d0, 0, 1);
      let x = s.x, y = s.y;
      if (s.kind === 'ore' || s.kind === 'ingot' || s.kind === 'coin') y -= Math.sin(prog * Math.PI) * 34;
      switch (s.kind) {
        case 'icicle':
          this.glow(c, x, y, 18, '#7ecbff', .7);
          c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = '#2b4a6a'; c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -5); c.lineTo(-12, 0); c.lineTo(-8, 5); c.closePath(); c.fill();
          c.fillStyle = '#bfe6ff'; c.beginPath(); c.moveTo(11, 0); c.lineTo(-6, -3.4); c.lineTo(-9, 0); c.lineTo(-6, 3.4); c.closePath(); c.fill(); c.fillStyle = '#ffffff'; c.fillRect(-4, -1.2, 10, 2); c.restore();
          if (Math.random() < .4) this.part({ x, y, life: .3, size: 2, col: '#e6f6ff', kind: 'star', vr: 6 });
          break;
        case 'dart':
          c.save(); c.translate(x, y); c.rotate(ang); c.strokeStyle = '#2b3a1a'; c.lineWidth = 4; c.beginPath(); c.moveTo(-12, 0); c.lineTo(10, 0); c.stroke(); c.strokeStyle = '#a6f06a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-10, 0); c.lineTo(10, 0); c.stroke(); c.fillStyle = '#7be06a'; c.beginPath(); c.moveTo(-12, 0); c.lineTo(-17, -4); c.lineTo(-17, 4); c.fill(); c.restore();
          if (Math.random() < .5) this.part({ x: x - ux * 10, y: y - uy * 10, vy: 30, life: .35, size: 2.5, col: '#7be06a', kind: 'dot' });
          break;
        case 'ore': case 'ingot': {
          const big = s.kind === 'ingot' ? 1.5 : 1;
          c.save(); c.translate(x, y); c.rotate(this.time * 12); c.fillStyle = '#5a3a10'; c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6, r = (k % 2 ? 6 : 8) * big; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
          c.fillStyle = '#ffd23a'; c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6, r = (k % 2 ? 4.5 : 6.5) * big; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.fillStyle = '#fff6c8'; c.fillRect(-2 * big, -3 * big, 3 * big, 2 * big); c.restore();
          break;
        }
        case 'spirit':
          this.glow(c, x, y, 26, '#2fc8a8', .85);
          { const im = this.I('x_spirit'); if (im) { c.save(); c.translate(x, y); c.scale(ux < 0 ? -1 : 1, 1); c.drawImage(im, -15, -15 + Math.sin(this.time * 14) * 2, 30, 30); c.restore(); } else this.circle(c, x, y, 7, '#b8fff0'); }
          if (Math.random() < .6) this.part({ x, y, life: .35, size: 4, col: '#b8fff0', kind: 'dot', add: true });
          break;
        case 'orb2':
          this.glow(c, x, y, 22, '#ff5ac8', .8); this.circle(c, x, y, 6.5, '#ff8adf'); this.circle(c, x, y, 3.5, '#ffffff');
          c.save(); c.strokeStyle = '#ffc8f0'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y, 11, 5, this.time * 8, 0, TAU); c.stroke(); c.restore();
          break;
        case 'arrow':
          c.save(); c.translate(x, y); c.rotate(ang); c.strokeStyle = '#5a3a20'; c.lineWidth = 3; c.beginPath(); c.moveTo(-14, 0); c.lineTo(10, 0); c.stroke(); c.fillStyle = '#e8e0d0'; c.beginPath(); c.moveTo(14, 0); c.lineTo(8, -4); c.lineTo(8, 4); c.fill(); c.restore();
          this.glow(c, x, y, 18, '#ff8a1c', .7);
          if (Math.random() < .7) this.part({ x: x - ux * 12, y: y - uy * 12, vx: rnd(-10, 10), vy: rnd(-30, -5), life: .3, size: rnd(3, 5), col: Math.random() < .5 ? '#ffd23a' : '#ff6a1c', kind: 'fire', add: true });
          break;
        case 'bless':
          this.glow(c, x, y, 22, '#ffe48a', .8); this.circle(c, x, y, 6, '#ffe48a'); this.circle(c, x, y, 3.5, '#ffffff');
          c.save(); c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 9, 2, 18); c.fillRect(x - 6, y - 4, 12, 2); c.restore();
          break;
        case 'acid':
          this.glow(c, x, y, 16, '#c6f04a', .6); this.circle(c, x, y, 7, '#4a6a10'); this.circle(c, x, y, 5.5, '#a6d83a'); this.circle(c, x - 2, y - 2, 2, '#f0ffd0');
          if (Math.random() < .5) this.part({ x, y, vy: 60, life: .3, size: 2.5, col: '#a6d83a', kind: 'dot' });
          break;
        case 'coin': { const im = this.I('i_coin'); const w = Math.abs(Math.cos(this.time * 14)) * 16 + 4; if (im) c.drawImage(im, x - w / 2, y - 10, w, 20); this.glow(c, x, y, 16, '#ffd23a', .5); break; }
        default: this.circle(c, x, y, 5, '#fff');
      }
    }
  };

  // ---------------------------------------------------------------- 몬스터 상태
  R.drawMonster = function (c, game, m) {
    const hidden = m.stealth && game.t >= m.revealUntil;
    if (hidden) { c.save(); c.globalAlpha = 0.35 + 0.1 * Math.sin(this.time * 4 + m.id); baseDrawMonster.call(this, c, game, m); c.restore(); }
    else baseDrawMonster.call(this, c, game, m);
    const g = m.g, top = m.y - 46 * g;
    if (game.t < m.frozenUntil) {
      const key = m.boss ? 'b_' + m.boss : 'm_' + m.kind, M = root.MANIFEST[key], wim = this.I(key + '_w');
      if (M && wim) {
        const s = (m.boss ? 0.5 : 0.5) * g, w = M.w * s, h = M.h * s, foot = M.foot * s;
        c.save(); c.translate(m.x, m.y); c.scale(m.face || 1, 1); c.globalAlpha = 0.5; c.drawImage(wim, -w / 2, -foot, w, h); c.restore();
      }
      // 발밑 얼음 결정(픽셀 삼각) — 실루엣을 따라 아래에서 솟음
      c.save(); c.fillStyle = '#2b4a6a';
      for (const [dx, hh] of [[-16, 14], [-6, 22], [5, 17], [15, 12]]) { c.beginPath(); c.moveTo(m.x + (dx - 5) * g, m.y + 2); c.lineTo(m.x + dx * g, m.y - hh * g); c.lineTo(m.x + (dx + 5) * g, m.y + 2); c.closePath(); c.fill(); }
      c.fillStyle = '#bfe6ff';
      for (const [dx, hh] of [[-16, 14], [-6, 22], [5, 17], [15, 12]]) { c.beginPath(); c.moveTo(m.x + (dx - 3.5) * g, m.y + 1); c.lineTo(m.x + dx * g, m.y - (hh - 3) * g); c.lineTo(m.x + (dx + 3.5) * g, m.y + 1); c.closePath(); c.fill(); }
      c.restore();
    } else if (m.frz > 0) {
      for (let k = 0; k < m.frz; k++) this.star(c, m.x - (m.frz - 1) * 5 + k * 10, top - 6, 6, 4, 1.6, this.time, '#bfe6ff');
    }
    if (m.psn > 0 && Math.random() < 0.15) this.part({ x: m.x + rnd(-10, 10) * g, y: m.y - rnd(10, 30) * g, vy: -40, life: .5, size: rnd(3, 5), col: Math.random() < .5 ? '#a6f06a' : '#4aa83a', kind: 'dot' });
    if (m.cor > 0 && Math.random() < 0.12) this.part({ x: m.x + rnd(-12, 12) * g, y: m.y - rnd(5, 25) * g, vy: 70, life: .4, size: 3, col: '#c6f04a', kind: 'dot' });
    if (m.stealth && !hidden && Math.random() < .1) this.part({ x: m.x, y: m.y - 20 * g, vy: -30, life: .4, size: 4, col: '#ffb347', kind: 'star', vr: 4 });
  };
  // 트럭 그림
  const baseTruck = R.drawTruck;
  R.drawTruck = function (c, m, hop) {
    const im = this.I('x_truck'); if (!im) return baseTruck.call(this, c, m, hop);
    const M = root.MANIFEST.x_truck, s = .5 * m.g, w = M.w * s, h = M.h * s;
    c.save(); c.translate(m.x, m.y - hop * .3); c.scale(m.face || 1, 1); c.drawImage(im, -w / 2, -h * .9, w, h); c.restore();
  };
})(window);
