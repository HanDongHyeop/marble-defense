// v4.7 층(Renderer에 덧붙임) — 알림 · 돈 흐름 · 땅 기운 연출
// 사용자: '돈을 벌 때 코인이 들어가는 모션이 없고, 좋은 능력 · 나쁜 능력이 발동돼도 알려 주는 게 거의 없어 인지가 안 된다.
//          플레이를 방해하는 팝업은 말고 화면에서 빵 알려 줘야 한다. 월급이 들어오면 코인이 다다다 판에 나와서 아래로 들어가는 모션 같은 것' · 세기 = '화려하게'
// · 크기 3단계: 작게 = 그 자리 숫자 · 중간 = 아이콘 + 터짐 + 화면 테두리 반짝 · 크게 = 위쪽 리본(조작은 막지 않음, 캔버스 #top은 터치 통과)
// · 좋음 = 금색 · 위로 / 나쁨 = 보라 · 아래로 + 붉은 테두리
// · 돈: 생긴 자리에서 동전이 튀어나와 아래 금화 칸으로 줄지어 들어가고, 들어갈 때마다 숫자가 오른다(goldPending) · 쓴 돈은 금화 칸에서 빨간 −숫자 + 쓴 곳으로 동전
// · 동전은 날아갈 때 속도 방향으로 늘어나고(stretch) 튀어나올 때 찌그러지며(squash) 돌고, 짧은 금빛 꼬리를 남긴다
// · 땅 기운(sim landFx): 예고(칸에서 상징이 솟음) → 이동(위쪽 효과 줄로 날아감) → 변신(판 전체 포탑/몬스터에 물결) → 강조(리본 · 테두리 · 효과 줄 남은 시간)
// · 그리기 원칙: 오프스크린 캔버스 캐시 없음(아이폰), 'lighter' 섞기 없음, 끝 값은 딱 고정
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eob = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };   // 살짝 넘쳤다 돌아옴
  const PLUM = '#2b1426', GOLD = '#ffd23a', GOOD = ['#ffe28a', '#ffb81c', '#a8640e'], BAD = ['#d9b8ff', '#9a5ae0', '#4a2272'];
  const ICON = { atk: 'arms', aps: 'drill', crit: 'watch', armDown: 'holy', slow: 'choke', armUp: 'fog', apsDown: 'web', rush: 'target' };
  const FXCOL = { atk: '#ff7a4a', aps: '#ffd23a', crit: '#7fe8ff', armDown: '#fff4b0', slow: '#7fc8ff', armUp: '#b8b0d0', apsDown: '#c890ff', rush: '#ff5a6a' };
  const STRIP = { x: 34, y: 158, gap: 60 };   // 위쪽 효과 줄(보스 막대 아래 · 왼쪽)

  const baseConsume = R.consume, baseDrawTop = R.drawTop, baseLandFx = R.landFx;

  // ------------------------------------------------------------ 상태
  R.v47 = function () {
    if (this._v47) return this._v47;
    return (this._v47 = { cs: [], deltas: [], ribbons: [], edge: null, fly: [], slotPop: {}, cards: [], fort: [false, false, false, false], waves: [], ambT: 0, sparks: [] });
  };
  Object.defineProperty(R, 'goldPending', { get() { const S = this._v47; if (!S) return 0; let s = 0; for (const k of S.cs) if (!k.done) s += k.val; return s; } });

  // 화면(DOM) 요소의 #top 좌표
  R.domPos = function (sel) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel, top = document.getElementById('top');
    if (!el || !top) return null;
    const a = el.getBoundingClientRect(), b = top.getBoundingClientRect(); if (!b.width) return null;
    const k = 720 / b.width; return [(a.left + a.width / 2 - b.left) * k, (a.top + a.height / 2 - b.top) * k];
  };

  // ------------------------------------------------------------ 동전 흐름
  // 생긴 자리(x, y)에서 amt 금화를 n개 동전으로 나눠 '다다다' 튀어나오게 → 금화 칸으로. 도착할 때마다 숫자가 오른다
  R.coinBurst = function (x, y, amt, o) {
    o = o || {}; amt = Math.round(amt); if (!(amt > 0)) return;
    const S = this.v47(), n = clamp(o.n || Math.ceil(amt / (o.unit || 6)), o.min || 3, o.max || 12);
    const base = Math.floor(amt / n); let rest = amt - base * n;
    for (let k = 0; k < n; k++) {
      const v = base + (rest-- > 0 ? 1 : 0), a = -Math.PI / 2 + rnd(-1, 1) * (o.spread || 0.9);
      const sp = rnd(220, 340) * (o.power || 1);
      S.cs.push({ x, y, x0: x, y0: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, gy: y + rnd(14, 30), t0: this.time + k * (o.gap || 0.045), val: v, phase: Math.random() * 6, trail: [], idx: k, n, big: !!o.big });
    }
  };
  // 쓴 돈: 금화 칸 → 쓴 곳으로 동전 몇 개(값 없음, 짧게)
  R.coinSpend = function (to, n) {
    const S = this.v47(), [x, y] = this.goldPos;
    for (let k = 0; k < n; k++) S.cs.push({ x, y, x0: x, y0: y, t0: this.time + k * 0.06, val: 0, spend: to, phase: k, trail: [], idx: k, n });
  };
  R.goldDelta = function (amt, good) {
    const S = this.v47(), last = S.deltas[S.deltas.length - 1];
    if (last && last.good === good && this.time - last.t0 < 0.45) { last.amt += amt; last.t0 = this.time; last.pop = this.time; return; }
    S.deltas.push({ amt, good, t0: this.time, pop: this.time });
    if (S.deltas.length > 4) S.deltas.shift();
  };

  // ------------------------------------------------------------ 리본 · 테두리
  R.ribbon = function (title, sub, good, icon, o) {
    const S = this.v47(); o = o || {};
    const r = { title, sub: sub || '', good, icon, t0: this.time, dur: o.dur || 1.7, col: o.col, pri: o.pri };
    // 한 번에 하나 — 앞 리본이 있으면 앞 리본을 짧게 줄이고 줄 세움(최대 3). [v5.6] 보스 스킬 알림(pri)은 2초는 다 보여 줌
    if (S.ribbons.length) { const a = S.ribbons[0]; a.dur = Math.min(a.dur, Math.max(a.pri ? 2 : 0.75, this.time - a.t0 + 0.25)); }
    S.ribbons.push(r); if (S.ribbons.length > 3) S.ribbons.splice(1, 1);
    this.edgeGlow(good);
  };
  R.edgeGlow = function (good, k) { this.v47().edge = { good, t0: this.time, k: k || 1 }; };

  // ------------------------------------------------------------ 사건
  R.consume = function (game, events, audio) {
    const S = this.v47(); this._g = game; this._A = audio || this._A;
    const A = audio, keep = [];
    for (const e of events) {
      switch (e.ev) {
        case 'salary': {
          const [x, y] = G.tiles[0].pawn;
          this.coinBurst(x, y - 20, e.amt, { unit: 5, min: 6, max: e.land ? 18 : 12, gap: e.land ? 0.03 : 0.045, power: e.land ? 1.2 : 1, big: true });
          this.say((e.land ? '월급 2배 ' : '월급 ') + '+' + e.amt, '#ffe28a', x, y - 86, 1.1, e.land ? 28 : 24);
          this.ring(x, y, 46, GOLD, 0.5, 6);
          if (e.land) this.ribbon('월급 2배!', '출발 칸에 딱 멈췄다 · 금화 +' + e.amt, true, 'flag');
          else this.edgeGlow(true, 0.5);
          A && A.coin(3);
          break;
        }
        case 'gold': {
          const p = e.i != null ? G.tiles[e.i].pawn : e.why === '보급 상자' ? G.tiles[12].pawn : [360, 420];
          this.coinBurst(p[0], p[1] - 24, e.amt, { unit: 3, min: 2, max: 8 });
          if (e.why) this.say(e.why + ' +' + e.amt, '#ffe28a', p[0], p[1] - 80, 0.9, 20);
          A && A.coin(1);
          break;
        }
        case 'reclaim': { const p = G.tiles[e.i].pawn; if (e.gold > 0) { this.coinBurst(p[0], p[1] - 24, e.gold, { unit: 4, min: 3, max: 10 }); this.say('탈환 +' + e.gold, '#ffe28a', p[0], p[1] - 80, 1, 22); } A && A.good(); break; }
        case 'piggy': { this.coinBurst(360, 300, e.gold, { unit: 10, min: 10, max: 20, power: 1.3 }); this.ribbon('저금통 깨짐!', '금화 +' + e.gold, true, 'gold'); A && A.jackpot(); break; }
        case 'spend': {
          this.goldDelta(e.amt, false);
          const to = e.why === 'roll' ? this.domPos('#rollBtn') : e.why === 'tierup' && e.i != null ? G.tiles[e.i].tower : e.why === 'upg' ? this.domPos('#deckRow') : null;
          if (to) this.coinSpend(to, e.why === 'tierup' ? 5 : 3);
          break;
        }
        case 'landFx': this.landFxShow(game, e, A); break;
        case 'key': this.keyCard(e, A); break;
        case 'stop': { const from = G.tiles[12].pawn, to = G.tiles[e.i].tower; this.bolt(from, to, '#b07cff', 0.55); keep.push(e); break; }
        case 'warn': { const from = G.tiles[12].pawn, to = G.tiles[e.i].tower; this.bolt(from, to, '#ff6a6a', 0.55); keep.push(e); break; }
        case 'island': {
          const [x, y] = G.tiles[6].pawn;
          for (let k = 0; k < 14; k++) { const a = rnd(0, TAU); this.part({ x, y, vx: Math.cos(a) * rnd(60, 160), vy: -rnd(120, 260), grav: 600, life: 0.7, size: rnd(4, 7), col: k % 2 ? '#9fe0ff' : '#e6f8ff', kind: 'dot' }); }
          this.ring(x, y, 50, '#9fe0ff', 0.6, 6);
          this.ribbon('무인도!', (game.CH.island || 3) + '초 동안 굴리기 쉬기', false, 'island');
          A && A.bad(); break;
        }
        case 'shield': { this.ribbon('방패 부적!', '나쁜 일을 막았다', true, 'holy', { dur: 1.3 }); A && A.good(); break; }
        case 'round': { S.waves.push({ t0: this.time }); keep.push(e); break; }
        default: keep.push(e);
      }
    }
    baseConsume.call(this, game, keep, audio);
  };

  // 땅에 멈춘 순간의 원래 연출(고리 · 흔들림)은 두고, 땅 이름 글자는 땅 기운 리본이 대신한다
  R.landFx = function (game, i) {
    const t = game.tiles[i], tr = t.trait;
    if (!tr) return baseLandFx.call(this, game, i);
    t.trait = null; baseLandFx.call(this, game, i); t.trait = tr;
    // 칸이 눌렸다 튀어 오름(칸 문양 빛)
    const [x, y] = G.tiles[i].pawn, good = D.TRAITS[tr].good;
    this.addFx(0.5, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.55; c.fillStyle = good ? '#fff1a8' : '#c8a0ff'; c.beginPath(); c.ellipse(x, y, 40 * (0.8 + p * 0.4), 20 * (0.8 + p * 0.4), 0, 0, TAU); c.fill(); c.restore(); }, 'under');
  };

  // ------------------------------------------------------------ 땅 기운: 예고 → 이동 → 변신 → 강조
  R.landFxShow = function (game, e, A) {
    const S = this.v47(), F = D.LANDFX[e.k], good = F.good;
    const src = e.i != null ? G.tiles[e.i].pawn : G.tiles[12].pawn;
    const slot = this.fxSlot(game, e.k);
    const lucky = e.from === 'luck';
    // 예고: 칸에서 상징이 솟음(행운 = 좋은 상징들이 돌다가 멈춤)
    S.fly.push({ k: e.k, x0: src[0], y0: src[1] - 30, t0: this.time, slot, good, lucky, refresh: e.refresh });
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; this.part({ x: src[0], y: src[1] - 10, vx: Math.cos(a) * 150, vy: Math.sin(a) * 70 - 60, life: 0.5, size: 4, col: good ? '#ffe28a' : '#c890ff', kind: good ? 'star' : 'puff', vr: 6, drag: 2 }); }
    this.ring(src[0], src[1], 52, good ? GOLD : '#b07cff', 0.55, 6);
    // 강조: 리본 + 테두리
    // [v5.5] 제목 = 무슨 일이 일어나는지 그대로(몬스터 이동 속도 감소) · 아래 = 숫자 · 시간 · 땅 이름
    const title = (lucky ? '행운! ' : '') + (F.plain || F.name) + (e.refresh ? ' 연장' : '');
    this.ribbon(title, (F.amt ? F.amt + ' · ' : '') + (e.dur || F.dur) + '초 · ' + F.name, good, ICON[e.k]);
    if (A) { if (good) { A.good(); A.tone && A.tone({ f: 988, d: 0.18, v: 0.06, delay: 0.16, wave: 'triangle' }); } else { A.bad(); A.tone && A.tone({ f: 160, f2: 90, d: 0.4, v: 0.12, delay: 0.1, wave: 'sawtooth' }); } }
  };
  // 효과 줄에서 이 기운이 들어갈 자리
  R.fxSlot = function (game, k) {
    const act = this.fxList(game); let j = act.indexOf(k); if (j < 0) j = act.length;
    return [STRIP.x + j * STRIP.gap, STRIP.y];
  };
  R.fxList = function (game) {
    if (!game || !game.lfx) return [];
    return Object.keys(D.LANDFX).filter(k => game.fxOn(k)).sort((a, b) => (D.LANDFX[b].good - D.LANDFX[a].good) || (game.lfx[a] - game.lfx[b]));
  };
  // 변신: 판 전체로 번지는 물결(포탑 기운 = 포탑마다, 몬스터 기운 = 몬스터마다) — 출발 칸에서 가까운 순서
  R.fxWave = function (game, k) {
    const col = FXCOL[k], tw = ['atk', 'aps', 'crit', 'apsDown'].includes(k), src = this._fxSrc || [360, 420];
    if (tw) {
      for (const t of game.tiles) if (t.tower) { const [x, y] = G.tiles[t.i].tower, d = Math.hypot(x - src[0], y - src[1]); this.later8(d / 900, () => { this.ring(x, y + 6, 30, col, 0.5, 5); for (let q = 0; q < 4; q++) this.part({ x: x + rnd(-14, 14), y: y - rnd(0, 30), vx: rnd(-20, 20), vy: -rnd(60, 120), life: 0.5, size: rnd(3, 5), col, kind: 'star', vr: 5 }); }); }
    } else {
      for (const m of game.monsters) if (m.alive) { const d = Math.hypot(m.x - src[0], m.y - src[1]); this.later8(d / 900, () => { if (!m.alive) return; this.ring(m.x, m.y, 22 * (m.g || 1), col, 0.45, 4); }); }
    }
  };
  R.later8 = function (d, fn) { (this.v47().later || (this.v47().later = [])).push({ at: this.time + d, fn }); };

  // 번개 줄기(황금열쇠 나쁜 카드 → 대상 포탑)
  R.bolt = function (a, b, col, delay) {
    this.later8(delay || 0, () => {
      const pts = []; const n = 7; for (let k = 0; k <= n; k++) { const q = k / n; pts.push([a[0] + (b[0] - a[0]) * q + (k && k < n ? rnd(-14, 14) : 0), a[1] - 30 + (b[1] - 20 - a[1] + 30) * q + (k && k < n ? rnd(-10, 10) : 0)]); }
      this.addFx(0.4, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.lineJoin = 'round'; for (const [w, cc] of [[9, PLUM], [5, col], [2, '#ffffff']]) { c.strokeStyle = cc; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); } c.restore(); }, 'over');
      this.ring(b[0], b[1], 34, col, 0.5, 5);
    });
  };

  // ------------------------------------------------------------ 황금열쇠 카드: 열쇠 칸에서 솟아 뒤집힘 → 좋은 카드 금빛 / 나쁜 카드 보라 연기 · 금
  R.keyCard = function (e, A) {
    const S = this.v47(), [x, y] = G.tiles[12].pawn;
    S.cards.push({ x, y: y - 40, t0: this.time, good: e.good, name: e.name, desc: e.desc, id: e.id });
    this.later8(0.55, () => {
      if (e.good) { for (let k = 0; k < 16; k++) { const a = rnd(0, TAU); this.part({ x, y: y - 120, vx: Math.cos(a) * rnd(100, 240), vy: Math.sin(a) * rnd(100, 240), life: 0.6, size: rnd(3, 6), col: k % 2 ? '#ffe28a' : '#fff8d8', kind: 'star', vr: 8, drag: 2 }); } }
      else { for (let k = 0; k < 10; k++) this.part({ x: x + rnd(-30, 30), y: y - 120 + rnd(-30, 30), vx: rnd(-40, 40), vy: rnd(-60, -10), life: 0.8, size: rnd(8, 14), col: k % 2 ? '#7a4aa8' : '#4a2272', kind: 'puff', drag: 2 }); this.shake = Math.max(this.shake, 5); }
      // 효과 이름은 리본으로 — 땅 기운으로 이어지는 카드(폭주)는 땅 기운 리본이 대신
      if (e.id !== 'rampage') this.ribbon('황금열쇠 · ' + e.name, e.desc, e.good, 'key');
      if (A) e.good ? A.jackpot() : A.bad();
    });
    A && A.card && A.card();
  };

  // ------------------------------------------------------------ 그리기
  R.drawTop = function (dt) {
    const S = this.v47(), c = this.top, g = this._g;
    // 처치 금화(옛 동전)도 같은 모양 · 같은 흐름으로 그린다
    for (const k of this.coins) if (!k.done) S.cs.push({ x: k.x, y: k.y, x0: k.x, y0: k.y, vx: k.vx, vy: k.vy, gy: k.gy, t0: k.t0, val: 0, phase: k.phase || 0, trail: [], idx: 0, n: 1 });
    this.coins.length = 0;
    // 미뤄 둔 연출
    if (S.later && S.later.length) { const due = S.later.filter(x => x.at <= this.time); S.later = S.later.filter(x => x.at > this.time); for (const x of due) x.fn(); }
    baseDrawTop.call(this, dt);
    if (g) { this.watchFort(g); this.ambient8(g, dt); }
    this.drawWaves(c);
    this.drawEdge(c);
    this.drawCoins8(c, dt);
    this.drawDeltas(c);
    this.drawCards(c);
    if (g) { this.drawFly(c, g); this.drawStrip(c, g); }
    this.drawRibbon(c);
  };

  // 동전: 튀어나옴(찌그러짐) → 떨어져 한 번 튐 → 금화 칸으로 빨려 감(속도 방향으로 늘어남 · 금빛 꼬리)
  R.drawCoins8 = function (c, dt) {
    const S = this.v47(), im = this.I('i_coin');
    for (const k of S.cs) {
      const a = this.time - k.t0; if (a < 0 || k.done) continue;
      const px = k.x, py = k.y;
      let sq = 1;
      if (k.spend) {   // 금화 칸 → 쓴 곳
        const q = Math.min(1, a / 0.38), e = q * q * (3 - 2 * q);
        k.x = k.x0 + (k.spend[0] - k.x0) * e; k.y = k.y0 + (k.spend[1] - k.y0) * e - Math.sin(q * Math.PI) * 50;
        if (q >= 1) { k.done = true; continue; }
      } else if (a < 0.5) {
        k.vy += 900 * dt; k.x += k.vx * dt; k.y += k.vy * dt;
        if (k.y > k.gy && k.vy > 0) { k.y = k.gy; k.vy *= -0.4; k.vx *= 0.55; k.land = this.time; }
        if (a < 0.08) sq = 0.55 + a / 0.08 * 0.45;   // 튀어나오는 순간 납작
      } else {
        if (!k.fly) k.fly = [k.x, k.y, this.time];
        const q = Math.min(1, (this.time - k.fly[2]) / 0.42), e = q * q * q;
        const [gx, gy] = this.goldPos;
        k.x = k.fly[0] + (gx - k.fly[0]) * e; k.y = k.fly[1] + (gy - k.fly[1]) * e - Math.sin(q * Math.PI) * 70;
        if (q >= 1) {
          k.done = true; this.goldBump = this.time;
          if (k.val > 0) { this.goldDelta(k.val, true); if (root.HAPTIC) root.HAPTIC.play('coin'); }
          S.sparks.push({ t0: this.time, a: rnd(0, TAU) });
          const A = this._A; if (A && A.tone && k.val > 0 && A.gate('c8', 0.07)) A.tone({ f: 660 * Math.pow(2, Math.min(12, k.idx) / 24), d: 0.07, v: 0.04, wave: 'triangle' });
          continue;
        }
      }
      // 꼬리
      k.trail.push([k.x, k.y]); if (k.trail.length > 5) k.trail.shift();
      const vx = (k.x - px) / Math.max(dt, 1e-3), vy = (k.y - py) / Math.max(dt, 1e-3), spd = Math.hypot(vx, vy);
      c.save();
      for (let j = 0; j < k.trail.length - 1; j++) { const [tx, ty] = k.trail[j], f = (j + 1) / k.trail.length; c.globalAlpha = f * 0.45 * clamp(spd / 500, 0, 1); c.fillStyle = j % 2 ? '#ffe28a' : '#ffb81c'; const s = 3 + f * 5; c.fillRect(Math.round(tx / 3) * 3 - s / 2, Math.round(ty / 3) * 3 - s / 2, s, s); }
      c.restore();
      if (!im) continue;
      const st = clamp(1 + spd / 1400, 1, 1.7), ang = Math.atan2(vy, vx), sz = k.big ? 24 : 22, spin = Math.abs(Math.cos(this.time * 12 + k.phase)) * 0.75 + 0.25;
      c.save(); c.translate(k.x, k.y);
      if (spd > 120) { c.rotate(ang); c.scale(st, 1 / Math.sqrt(st)); c.rotate(-ang); }
      c.scale(spin, sq);
      c.drawImage(im, -sz / 2, -sz / 2, sz, sz);
      c.restore();
    }
    S.cs = S.cs.filter(k => !k.done);
  };

  // 금화 칸 옆 +/− 숫자 · 동전이 들어갈 때 금화 칸 반짝
  R.drawDeltas = function (c) {
    const S = this.v47(), [gx, gy] = this.goldPos;
    S.sparks = S.sparks.filter(k => this.time - k.t0 < 0.3);
    for (const k of S.sparks) { const p = (this.time - k.t0) / 0.3; c.save(); c.globalAlpha = 1 - p; c.fillStyle = '#fff2b0'; for (let j = 0; j < 4; j++) { const an = k.a + j * TAU / 4, d = 10 + p * 26, s = 6 - p * 3; c.fillRect(Math.round((gx + Math.cos(an) * d) / 3) * 3 - s / 2, Math.round((gy + Math.sin(an) * d * 0.7) / 3) * 3 - s / 2, s, s); } c.restore(); }
    S.deltas = S.deltas.filter(d => this.time - d.t0 < 1.1);
    let row = 0;
    for (let j = S.deltas.length - 1; j >= 0; j--) {
      const d = S.deltas[j], p = (this.time - d.t0) / 1.1, pop = clamp((this.time - d.pop) / 0.15, 0, 1);
      const x = gx + 170, y = gy + (d.good ? -10 - p * 34 : 4 + p * 30) - row * 30, s = 1 + (1 - pop) * 0.35;
      c.save(); c.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1; c.translate(x, y); c.scale(s, s);
      c.font = '700 30px Jua, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
      this.outlined(c, (d.good ? '+' : '−') + Math.round(d.amt), 0, 0, d.good ? '#ffe28a' : '#ff6a6a', PLUM, 7);
      c.restore(); row++;
    }
  };

  // 황금열쇠 카드
  R.drawCards = function (c) {
    const S = this.v47();
    S.cards = S.cards.filter(k => this.time - k.t0 < 1.5);
    for (const k of S.cards) {
      const a = this.time - k.t0, rise = eob(clamp(a / 0.3, 0, 1)), flip = clamp((a - 0.25) / 0.3, 0, 1), out = clamp((a - 1.15) / 0.35, 0, 1);
      const sx = Math.abs(Math.cos(flip * Math.PI)) || 0.02, face = flip >= 0.5;
      c.save(); c.globalAlpha = 1 - out; c.translate(k.x, k.y - rise * 80 - out * 30); c.scale(sx * (1 + out * 0.2), 1 + out * 0.2);
      const w = 64, h = 86;
      c.fillStyle = PLUM; c.fillRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
      c.fillStyle = !face ? '#ffcf3a' : k.good ? '#fff4c8' : '#5a2a88'; c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = !face ? '#a8640e' : k.good ? '#ffb81c' : '#c890ff'; c.lineWidth = 3; c.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
      const im = this.I('i44_key'); if (im) { const s = face ? 30 : 40; c.drawImage(im, -s / 2, face ? -h / 2 + 10 : -s / 2, s, s); }
      if (face) {
        c.font = '700 13px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const nm = k.name.length > 5 ? [k.name.slice(0, Math.ceil(k.name.length / 2)), k.name.slice(Math.ceil(k.name.length / 2))] : [k.name];
        nm.forEach((s, j) => this.outlined(c, s, 0, 14 + j * 15 - (nm.length - 1) * 7, k.good ? '#ffffff' : '#f0e0ff', PLUM, 4));
        if (!k.good && a > 0.55) { c.strokeStyle = PLUM; c.lineWidth = 3; c.beginPath(); c.moveTo(-6, -h / 2); c.lineTo(4, -14); c.lineTo(-4, 0); c.lineTo(8, 18); c.lineTo(0, h / 2); c.stroke(); }
      }
      c.restore();
    }
  };

  // 날아가는 땅 상징(칸 → 효과 줄)
  R.drawFly = function (c, g) {
    const S = this.v47();
    for (const f of S.fly) {
      const a = this.time - f.t0, pre = f.lucky ? 0.75 : 0.35;
      let x, y, s;
      if (a < pre) { const q = clamp(a / 0.25, 0, 1); x = f.x0; y = f.y0 - eob(q) * 60; s = 0.3 + eob(q) * 1.1; }
      else {
        const q = clamp((a - pre) / 0.45, 0, 1), e = q * q * (3 - 2 * q);
        const sx = f.x0, sy = f.y0 - 60, [tx, ty] = f.slot, mx = (sx + tx) / 2, my = Math.min(sy, ty) - 120;
        x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * mx + e * e * tx; y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * my + e * e * ty; s = 1.4 - e * 0.6;
        if (q < 1 && Math.random() < 0.7) this.part({ x, y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.35, size: rnd(3, 5), col: f.good ? '#ffe28a' : '#c890ff', kind: 'star', vr: 6 });
        if (q >= 1 && !f.arrived) { f.arrived = true; S.slotPop[f.k] = this.time; this._fxSrc = [f.x0, f.y0]; this.fxWave(g, f.k); }
      }
      // 행운: 좋은 상징이 돌다가 멈춤
      const k = f.lucky && a < pre - 0.1 ? Object.keys(D.LANDFX).filter(q => D.LANDFX[q].good)[Math.floor(a * 14) % 5] : f.k;
      this.fxIcon(c, k, x, y, 46 * s, D.LANDFX[k].good, 1);
    }
    S.fly = S.fly.filter(f => !f.arrived);
  };
  R.fxIcon = function (c, k, x, y, size, good, alpha) {
    const im = this.I('i44_' + ICON[k]), r = size / 2;
    c.save(); c.globalAlpha = alpha;
    c.fillStyle = PLUM; c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.fill();
    c.fillStyle = good ? '#fff4c8' : '#3a2050'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.strokeStyle = good ? '#ffb81c' : '#b07cff'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r - 2, 0, TAU); c.stroke();
    if (im) c.drawImage(im, x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44);
    c.restore();
  };

  // 위쪽 효과 줄: 걸려 있는 기운 · 남은 시간 고리 · 짧은 이름. 끝나기 2초 전부터 깜박
  R.drawStrip = function (c, g) {
    const S = this.v47(), act = this.fxList(g), flying = new Set(S.fly.map(f => f.k));
    act.forEach((k, j) => {
      if (flying.has(k)) return;
      const F = D.LANDFX[k], left = g.fxLeft(k), x = STRIP.x + j * STRIP.gap, y = STRIP.y;
      const pop = S.slotPop[k] != null ? clamp((this.time - S.slotPop[k]) / 0.3, 0, 1) : 1, s = pop < 1 ? eob(pop) : 1;
      const blink = left < 2 && Math.floor(this.time * 6) % 2 ? 0.45 : 1;
      c.save(); c.translate(x, y); c.scale(s, s);
      this.fxIcon(c, k, 0, 0, 44, F.good, blink);
      // 남은 시간 고리
      c.globalAlpha = blink; c.strokeStyle = F.good ? '#ffe28a' : '#ff7a9a'; c.lineWidth = 4; c.lineCap = 'butt';
      c.beginPath(); c.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(left / (k === 'rush' && left > F.dur ? 10 : F.dur), 0, 1)); c.stroke();
      c.font = '700 14px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      this.outlined(c, F.short + ' ' + Math.ceil(left), 0, 38, F.good ? '#ffe28a' : '#e0c0ff', PLUM, 4);
      c.restore();
    });
  };

  // 요새(구역 독점) 완성 순간: 5칸이 차례로 불 켜짐 → 리본
  R.watchFort = function (g) {
    const S = this.v47();
    for (let z = 0; z < 4; z++) {
      const full = g.zoneFull(z);
      if (full && !S.fort[z] && g.t > 1) {
        const tiles = g.tiles.filter(t => t.zone === z).map(t => t.i).sort((a, b) => a - b);
        tiles.forEach((i, k) => this.later8(k * 0.09, () => { const [x, y] = G.tiles[i].tower; this.ring(x, y + 6, 40, D.ZONE_COLOR[z], 0.6, 6); for (let q = 0; q < 6; q++) this.part({ x: x + rnd(-16, 16), y: y - rnd(0, 40), vx: rnd(-30, 30), vy: -rnd(80, 160), life: 0.6, size: rnd(3, 6), col: q % 2 ? '#ffe28a' : D.ZONE_COLOR[z], kind: 'star', vr: 6 }); }));
        this.later8(0.5, () => this.ribbon(D.ZONE_NAME[z] + ' 요새 완성!', '이 변 포탑 공격력 ↑ · 앞 길 몬스터 느려짐', true, 'arms', { col: D.ZONE_COLOR[z] }));
        if (this._A) this.later8(0.5, () => this._A.tierup());
      }
      S.fort[z] = full;
    }
  };

  // 기운이 걸려 있는 동안 판 위 작은 표시(포탑 = 빛 조각, 몬스터 = 색 조각) — 가볍게(초당 몇 개)
  R.ambient8 = function (g, dt) {
    const S = this.v47(); S.ambT += dt; if (S.ambT < 0.09) return; S.ambT = 0;
    const act = this.fxList(g); if (!act.length) return;
    const k = act[Math.floor(Math.random() * act.length)], col = FXCOL[k];
    if (['atk', 'aps', 'crit', 'apsDown'].includes(k)) {
      const tw = g.tiles.filter(t => t.tower); if (!tw.length) return;
      const [x, y] = G.tiles[tw[Math.floor(Math.random() * tw.length)].i].tower;
      this.part({ x: x + rnd(-16, 16), y: y - rnd(4, 36), vx: rnd(-10, 10), vy: k === 'apsDown' ? rnd(10, 30) : -rnd(40, 80), life: 0.55, size: rnd(3, 5), col, kind: k === 'apsDown' ? 'dot' : 'star', vr: 4 });
    } else {
      const ms = g.monsters.filter(m => m.alive); if (!ms.length) return;
      const m = ms[Math.floor(Math.random() * ms.length)];
      if (k === 'rush' || k === 'slow') this.part({ x: m.x + rnd(-8, 8), y: m.y - rnd(4, 20), vx: k === 'rush' ? rnd(-60, 60) : 0, vy: k === 'slow' ? rnd(20, 40) : rnd(-10, 10), life: 0.4, size: rnd(3, 5), col, kind: 'dot' });
      else this.part({ x: m.x + rnd(-10, 10), y: m.y - rnd(10, 30), vx: rnd(-20, 20), vy: -rnd(20, 50), life: 0.45, size: rnd(3, 5), col, kind: k === 'armDown' ? 'star' : 'dot', vr: 4 });
    }
  };

  // 라운드 시작: 판 24칸이 출발부터 차례로 반짝(파도)
  R.drawWaves = function (c) {
    const S = this.v47();
    S.waves = S.waves.filter(w => this.time - w.t0 < 1.3);
    for (const w of S.waves) {
      const a = this.time - w.t0;
      for (let i = 0; i < 24; i++) {
        const q = (a - i * 0.035) / 0.35; if (q <= 0 || q >= 1) continue;
        const [x, y] = G.tiles[i].pawn;
        c.save(); c.globalAlpha = Math.sin(q * Math.PI) * 0.6; c.fillStyle = '#fff6c8';
        c.beginPath(); c.ellipse(x, y, 30 + q * 8, 15 + q * 4, 0, 0, TAU); c.fill(); c.restore();
      }
    }
  };

  // 화면 테두리 반짝(좋음 = 금색, 나쁨 = 붉은 보라) — 픽셀 띠 세 겹
  R.drawEdge = function (c) {
    const S = this.v47(), e = S.edge; if (!e) return;
    const p = (this.time - e.t0) / 0.55; if (p >= 1) { S.edge = null; return; }
    const a = Math.sin(Math.min(1, p * 1.6) * Math.PI) * 0.5 * e.k, col = e.good ? '#ffd23a' : '#d0306a';
    c.save(); c.fillStyle = col;
    [[0, 18, 0.35], [18, 12, 0.22], [30, 10, 0.12]].forEach(([o, w, k]) => { c.globalAlpha = a * k * 2; c.fillRect(o, o, 720 - o * 2, w); c.fillRect(o, 1280 - o - w, 720 - o * 2, w); c.fillRect(o, o + w, w, 1280 - (o + w) * 2); c.fillRect(720 - o - w, o + w, w, 1280 - (o + w) * 2); });
    c.restore();
  };

  // 리본: 펼쳐지며 들어옴(가로로 늘어났다 돌아옴) → 머묾 → 위로 빠짐. 좋은 = 금색 리본, 나쁜 = 보라 리본
  R.drawRibbon = function (c) {
    const S = this.v47(), r = S.ribbons[0]; if (!r) return;
    const a = this.time - r.t0; if (a >= r.dur) { S.ribbons.shift(); if (S.ribbons[0]) S.ribbons[0].t0 = this.time; return; }
    const ip = clamp(a / 0.22, 0, 1), op = clamp((a - (r.dur - 0.25)) / 0.25, 0, 1);
    const sx = ip < 1 ? 0.2 + eob(ip) * 0.8 : 1, y = 250 - op * 40;
    const pal = r.good ? GOOD : BAD, fill = r.col || pal[1];
    c.save(); c.globalAlpha = 1 - op; c.translate(360, y); c.scale(sx, 1);
    const W = 300, H = 36;
    // 꼬리(접힌 끝)
    for (const sgn of [-1, 1]) { c.fillStyle = PLUM; c.beginPath(); c.moveTo(sgn * (W - 10), -H + 18); c.lineTo(sgn * (W + 46), -H + 18); c.lineTo(sgn * (W + 28), 8); c.lineTo(sgn * (W + 46), H + 4); c.lineTo(sgn * (W - 10), H + 4); c.closePath(); c.fill(); c.fillStyle = pal[2]; c.beginPath(); c.moveTo(sgn * (W - 10), -H + 22); c.lineTo(sgn * (W + 38), -H + 22); c.lineTo(sgn * (W + 22), 8); c.lineTo(sgn * (W + 38), H); c.lineTo(sgn * (W - 10), H); c.closePath(); c.fill(); }
    // 몸통
    c.fillStyle = PLUM; c.fillRect(-W - 4, -H - 4, W * 2 + 8, H * 2 + 8);
    c.fillStyle = fill; c.fillRect(-W, -H, W * 2, H * 2);
    c.fillStyle = pal[0]; c.globalAlpha *= 0.55; c.fillRect(-W, -H, W * 2, 8); c.globalAlpha = 1 - op;
    c.fillStyle = pal[2]; c.globalAlpha *= 0.45; c.fillRect(-W, H - 8, W * 2, 8); c.globalAlpha = 1 - op;
    // 반짝 지나가는 빛(들어온 직후 한 번)
    const sh = (a - 0.15) / 0.5; if (sh > 0 && sh < 1) { c.save(); c.beginPath(); c.rect(-W, -H, W * 2, H * 2); c.clip(); c.globalAlpha = 0.35 * (1 - op); c.fillStyle = '#ffffff'; const xx = -W + sh * W * 2.4; c.beginPath(); c.moveTo(xx, -H); c.lineTo(xx + 40, -H); c.lineTo(xx + 10, H); c.lineTo(xx - 30, H); c.fill(); c.restore(); }
    c.scale(1 / sx, 1);
    // 상징
    if (r.icon) { const im = this.I('i44_' + r.icon), bob = Math.sin(this.time * 6) * 2; c.fillStyle = PLUM; c.beginPath(); c.arc(-W * sx + 6, bob, 40, 0, TAU); c.fill(); c.fillStyle = r.good ? '#fff4c8' : '#3a2050'; c.beginPath(); c.arc(-W * sx + 6, bob, 35, 0, TAU); c.fill(); if (im) c.drawImage(im, -W * sx + 6 - 26, bob - 26, 52, 52); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 32px Jua, sans-serif'; this.outlined(c, r.title, 24, r.sub ? -9 : 1, '#ffffff', PLUM, 8);
    if (r.sub) { c.font = '700 17px Jua, sans-serif'; this.outlined(c, r.sub.length > 30 ? r.sub.slice(0, 29) + '…' : r.sub, 24, 22, r.good ? '#fff6d8' : '#f0e0ff', PLUM, 5); }
    c.restore();
    // 들어올 때 양 끝 반짝이 / 연기
    if (a < 0.05 && !r.burst) { r.burst = true; for (const sgn of [-1, 1]) for (let k = 0; k < 6; k++) this.part({ x: 360 + sgn * 330, y: 250, vx: sgn * rnd(60, 200), vy: rnd(-160, 60), life: 0.5, size: rnd(3, 6), col: r.good ? '#ffe28a' : '#c890ff', kind: r.good ? 'star' : 'puff', vr: 8, drag: 2 }); }
  };
})(window);
