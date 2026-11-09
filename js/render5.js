// v4.3 층(Renderer에 덧붙임) — 5 · 6단계 포탑 = 캐릭터마다 공격 자세 프레임 + 무기에 맞는 공격 연출
// 사용자 지적: '동상이 좌우로만 들썩이고 특성을 못 살림 — 마법사는 지팡이를 내려쳐 마법, 검사는 검을 휘둘러 검 끝에서 불길'
// · 프레임(tools/pose_build.py): 정자세 → 준비(_a1) → 타격(_a2). 그림 전체를 기울이거나 좌우로 미는 움직임은 쓰지 않는다
// · 준비 = 다음 발사까지 WIND초 이하 + 사거리 안에 적(규칙 상태로 미리 앎) · 타격 = 발사 순간부터 HOLD초
// · 연출의 시작점 = 타격 프레임의 무기 끝(매니페스트 tip). 탄 · 빔 · 채찍 · 숨결도 무기 끝에서 나와 원래 길로 합류
(function (root) {
  const R = root.Renderer.prototype, G = root.GEOM, D = root.DATA, TSZ = root.Renderer.TSZ, MAN = root.MANIFEST;
  const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), easeOut = t => 1 - Math.pow(1 - t, 3);
  const WIND = { 5: 0.14, 6: 0.18 }, HOLD = { 5: 0.24, 6: 0.3 };
  const C = {
    fire: ['#fff2a0', '#ffd23a', '#ff8a1c', '#e8452c'], ice: ['#ffffff', '#d8f4ff', '#7ecbff', '#4aa0ff'], poison: ['#f0ffe0', '#a6f06a', '#4aa83a', '#2f7a2a'],
    bolt: ['#ffffff', '#e6dcff', '#b58cff', '#7a4adf'], light: ['#ffffff', '#fff6c8', '#ffe48a', '#ffc23a'], tyrant: ['#ffd0d0', '#ff5a5a', '#c0303a', '#5a1424'],
    gatling: ['#ffffff', '#fff2b0', '#ffc23a', '#ff8a1c'], railgun: ['#ffffff', '#bfe6ff', '#4aa0ff', '#2a5aa0'], mining: ['#fff6c8', '#ffd23a', '#c27a00', '#8a6a3a'],
    summon: ['#ffffff', '#b8fff0', '#5fe0c8', '#2fc8a8'], combo: ['#ffffff', '#ffc8f0', '#ff8adf', '#ff5ac8'], beacon: ['#fff6c8', '#ffd23a', '#ff8a1c', '#e8452c'],
    growth: ['#ffffff', '#fff6c8', '#fff2a0', '#ffd24a'], corrode: ['#f0ffd0', '#c6f04a', '#7ab02a', '#3a5a10'], greed: ['#fff6c8', '#ffd23a', '#ffb000', '#b07a00'],
    prism: ['#ffffff', '#ffd0ff', '#9adfff', '#b07cff'],
  };
  // 캐릭터별 무기 연출(종류_단계)
  const KIND = {
    // [v4.4] 새 캐릭터: 빙결 6 = 얼음 여왕(지팡이) · 맹독 6 = 머리 셋 히드라(숨결) · 콤보 6 = 여섯 팔 검객 · 성광 6 = 세라핌(창) · 성장 6 = 나무 정령 · 탐욕 6 = 황금왕(홀) · 프리즘 6 = 무지개 유니콘(뿔)
    fire_5: 'flameSlash', fire_6: 'breath', ice_5: 'thrust', ice_6: 'iceCast', poison_5: 'scythe', poison_6: 'breath', prism_5: 'cast', prism_6: 'thrust',
    gatling_5: 'gun', gatling_6: 'gun', railgun_5: 'rail', railgun_6: 'rail', mining_5: 'smash', mining_6: 'drill',
    bolt_5: 'staff', bolt_6: 'staff', summon_5: 'cast', summon_6: 'cast', combo_5: 'xslash', combo_6: 'sixSlash',
    light_5: 'orb', light_6: 'thrust', beacon_5: 'torch', beacon_6: 'torch', growth_5: 'staffHoly', growth_6: 'leaves',
    tyrant_5: 'lash', tyrant_6: 'lash', corrode_5: 'throw', corrode_6: 'slam', greed_5: 'toss', greed_6: 'pour',
  };
  const CHARGE = new Set(['staff', 'staffHoly', 'orb', 'cast', 'torch', 'rail', 'pour', 'iceCast', 'leaves']);   // 준비 자세에서 무기 끝(위 점)에 빛이 모임
  const ORIGIN = new Set(['fire', 'flame', 'beam', 'whip', 'breath', 'spirits', 'rainbow', 'special']);
  const hasPose = tw => tw && tw.tier >= 5 && !!MAN[`t_${tw.type}_${tw.tier}_a2`];

  // 지난 '시험용' 기울이기 · 내밀기 동작(render4)은 끈다
  R.actPose = function () { return null; };
  R.startAct = function () {};

  // ------------------------------------------------------------ 자세 고르기
  R.poseOf = function (game, i, tw) {
    if (!hasPose(tw)) return '';
    const P = this.pz || (this.pz = {}), st = P[i] || (P[i] = {});
    if (st.type !== tw.type || st.tier !== tw.tier) { st.type = tw.type; st.tier = tw.tier; st.strikeT = -9; }
    const an = this.towerAnim[i] || (this.towerAnim[i] = {});
    if (st.aim != null) an.aim = st.aim;
    if (this.time - st.strikeT < (st.hold || HOLD[tw.tier])) return (st.cur = '_a2');
    if (game.disabled && game.disabled(i)) return (st.cur = '');
    const aps = game.apsOf ? game.apsOf(i) : 1;
    if (aps > 0 && tw.cd / aps <= WIND[tw.tier] && game.t >= (tw.spawnLock || 0)) {
      const m = game.front(game.inRange(i, game.rangeOf(i), tw.type));
      if (m) { st.aim = an.aim = m.x; return (st.cur = '_a1'); }
    }
    return (st.cur = '');
  };
  // 준비 자세(무기를 머리 위로 듦)에서는 단계 별이 무기를 가리지 않게 흐리게
  const baseStars = R.starsFor;
  R.starsFor = function (c, game, i, tw, at) {
    const st = this.pz && this.pz[i], dim = !at && st && st.cur === '_a1' && hasPose(tw);
    if (dim) { c.save(); c.globalAlpha = 0.3; }
    baseStars.call(this, c, game, i, tw, at);
    if (dim) c.restore();
  };
  // 무기 끝(which = 'tip' 타격 프레임 · 'up' 준비 프레임)의 화면 좌표 — 좌우 뒤집기 · 떠 있는 높이 반영
  R.poseTip = function (i, tw, which) {
    const PM = MAN[`t_${tw.type}_${tw.tier}${which === 'up' ? '_a1' : '_a2'}`]; if (!PM || !PM[which]) return null;
    const [x, y] = G.tiles[i].tower, s = G.tiles[i].scale * 0.46 * TSZ[tw.tier], an = this.towerAnim[i] || {};
    const f = an.aim != null && an.aim < x - 4 ? -1 : 1, hov = Math.sin(this.time * 2 + i) * 1.5;
    return [x + f * (PM[which][0] - PM.ax) * s, y + hov - (PM.foot - PM[which][1]) * s, f, s];
  };
  // 준비 자세에서 무기 끝에 모이는 빛
  const baseDrawTower = R.drawTower;
  R.drawTower = function (c, game, i, opt) {
    baseDrawTower.call(this, c, game, i, opt);
    const tw = game.tiles[i].tower; if (opt && opt.at) return;
    if (!hasPose(tw) || !this.pz || !this.pz[i]) return;
    const k = KIND[`${tw.type}_${tw.tier}`];
    if (!CHARGE.has(k)) return;
    if (this.time - this.pz[i].strikeT < (this.pz[i].hold || HOLD[tw.tier])) return;
    const aps = game.apsOf(i), left = tw.cd / Math.max(0.01, aps); if (left > WIND[tw.tier]) return;
    const p = this.poseTip(i, tw, 'up'); if (!p) return;
    const q = 1 - left / WIND[tw.tier], col = C[tw.type];
    this.glow(c, p[0], p[1], (10 + 16 * q) * (tw.tier >= 6 ? 1.3 : 1), col[2], 0.5 + 0.4 * q);
    this.star(c, p[0], p[1], 4, (5 + 9 * q), 1.6, this.time * 6, col[0]);
  };

  // ------------------------------------------------------------ 사건: 시작점을 무기 끝으로 · 타격 자세 · 무기 연출
  const prevConsume = R.consume;
  R.consume = function (game, events, audio) {
    const tagged = [];
    const keep = [];
    for (const e of events) {
      const tl = e.i != null ? game.tiles[e.i] : null, tw = tl && tl.tower;
      if (!hasPose(tw)) { keep.push(e); continue; }
      const P = this.pz || (this.pz = {}), st = P[e.i] || (P[e.i] = { type: tw.type, tier: tw.tier, strikeT: -9 });
      const an = this.towerAnim[e.i] || (this.towerAnim[e.i] = {});
      if (e.ev === 'fire' || e.ev === 'special' || e.ev === 'strike') {
        if (e.tx != null && (e.tx !== e.x || e.ty !== e.y)) st.aim = an.aim = e.tx;
        st.strikeT = this.time; st.hold = e.ev === 'strike' ? 0.45 : e.ev === 'special' ? 0.36 : HOLD[tw.tier];
      }
      const tip = this.poseTip(e.i, tw, 'tip');
      if (tip && ORIGIN.has(e.ev) && !e.sub) { e.x = tip[0]; e.y = tip[1]; }
      if (tip && e.ev === 'rail' && e.pts) e.pts = [[tip[0], tip[1]]].concat(e.pts.slice(1));
      if (e.ev === 'fire' || e.ev === 'special') tagged.push([e.i, tip]);
      if (e.ev === 'flame' && tw.type === 'fire' && tw.tier === 5) continue;          // 검사는 화염 방사 대신 불길 베기(드래곤보다 약하게)
      if (e.ev === 'fire' && tip) this.weaponFx(game, e, tw, tip);
      if (e.ev === 'special' && tip) this.weaponFx(game, e, tw, tip, true);
      keep.push(e);
    }
    prevConsume.call(this, game, keep, audio);
    // 방금 나간 탄: 무기 끝에서 출발해 원래 길로 합류
    for (const [i, tip] of tagged) { if (!tip) continue; for (const s of game.shots) if (s.i === i && !s._o && (s.age || 0) < 0.05) s._o = [tip[0] - s.sx, tip[1] - s.sy]; }
  };
  // 5 · 6단계의 기본 발사 번쩍(원래 꼭대기 가운데)은 끈다 — 무기 연출이 대신함
  R.hasPose10 = tw => !!(tw && hasPose(tw));   // [v4.8] render10이 쓴다
  const prevMuzzle = R.muzzle;
  R.muzzle = function (e) {
    const tw = this._game && this._game.tiles[e.i] && this._game.tiles[e.i].tower;
    if (hasPose(tw)) return;
    return prevMuzzle.call(this, e);
  };
  const prevShots = R.drawShots;
  R.drawShots = function (c, game) {
    const moved = [];
    for (const s of game.shots) {
      if (!s._o) continue;
      const d = Math.hypot(s.tx - s.x, s.ty - s.y); if (s._d0 == null) s._d0 = Math.max(1, d);
      const k = clamp(d / s._d0, 0, 1) ** 1.5; moved.push([s, s.x, s.y]); s.x += s._o[0] * k; s.y += s._o[1] * k;
    }
    prevShots.call(this, c, game);
    for (const [s, x, y] of moved) { s.x = x; s.y = y; }
  };

  // ------------------------------------------------------------ 무기 연출
  R.weaponFx = function (game, e, tw, tip, big) {
    const kind = KIND[`${tw.type}_${tw.tier}`], col = C[tw.type] || C.fire, T6 = tw.tier >= 6 || big ? 1.35 : 1;
    const [x, y, f, s] = tip, tx = e.tx, ty = e.ty - 12, dx = tx - x, dy = ty - y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ang = Math.atan2(dy, dx);
    const [px, py] = G.tiles[e.i].tower, pivot = [px + f * 6 * s, y - 34 * s];           // 어깨 근처(휘두름 원의 중심)
    const flash = (r, cc) => this.addFx(0.12, (c, p) => { this.glow(c, x, y, r * (1 - p * 0.4), cc || col[2], 0.8 * (1 - p)); this.star(c, x, y, 4, r * 0.7 * (1 - p), r * 0.12, p * 3, col[0]); });
    const sparks = (n, sp, cols, grav) => { for (let k = 0; k < n; k++) { const a = ang + rnd(-0.7, 0.7); this.part({ x, y, vx: Math.cos(a) * rnd(sp * 0.5, sp), vy: Math.sin(a) * rnd(sp * 0.5, sp) - 30, life: rnd(0.2, 0.38), size: rnd(2, 3.5), col: cols[k % cols.length], kind: 'spark', grav: grav || 260 }); } };
    // 휘두른 궤적(어깨를 중심으로 위 → 무기 끝까지 쓸린 초승달) — 타격 프레임과 같은 순간에
    const swing = (sweep, w, cols, dur) => {
      const r = Math.hypot(x - pivot[0], y - pivot[1]), a1 = Math.atan2(y - pivot[1], x - pivot[0]), a0 = a1 - f * sweep;
      this.addFx(dur || 0.16, (c, p) => {
        c.save(); c.globalAlpha = 1 - p; c.lineCap = 'round';
        cols.forEach((cc, n) => { c.strokeStyle = cc; c.lineWidth = (w - n * w * 0.3) * (1 - p * 0.5); c.beginPath(); c.arc(pivot[0], pivot[1], r - n * 2, Math.min(a0, a1), Math.max(a0, a1)); c.stroke(); });
        c.restore();
      });
    };
    switch (kind) {
      case 'flameSlash': {
        // 검을 내리친 궤적 + 검 끝에서 불길 초승달이 날아가 적에게 불이 붙음(드래곤 화염 방사보다 작게)
        swing(1.9, 12, [col[3], col[2], col[0]], 0.18);
        flash(18);
        const fc = p => col[(p * 4 | 0) % 4];
        this.addFx(0.22, (c, p) => {
          const q = easeOut(p), cx = x + dx * q, cy = y + dy * q, sz = (14 + 10 * q) * T6;
          c.save(); c.translate(cx, cy); c.rotate(ang); c.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
          for (const [cc, k] of [[col[3], 1], [col[2], 0.75], [col[0], 0.45]]) { c.fillStyle = cc; c.beginPath(); c.arc(0, 0, sz * k, -1.25, 1.25); c.arc(-sz * 0.45 * k, 0, sz * 0.8 * k, 1.1, -1.1, true); c.closePath(); c.fill(); }
          c.restore();
          if (Math.random() < 0.7) this.part({ x: cx - ux * 6, y: cy - uy * 6, vx: rnd(-20, 20), vy: rnd(-40, -10), life: 0.3, size: rnd(4, 7), col: fc(p), kind: 'fire', add: true });
        });
        this.later(0.2, () => { this.explosion(tx, ty, 14 * T6, 0.45); for (let n = 0; n < 5; n++) this.part({ x: tx + rnd(-10, 10), y: ty + rnd(-4, 6), vx: rnd(-30, 30), vy: rnd(-90, -40), life: 0.5, size: rnd(4, 6), col: col[n % 3], kind: 'fire', add: true }); });
        break;
      }
      case 'scythe': {
        swing(2.4, 14, [col[3], col[2], col[0]], 0.2);       // 낫을 크게 휘두른 녹색 궤적
        flash(16);
        for (let n = 0; n < 6; n++) this.part({ x: x + rnd(-6, 6), y: y + rnd(-4, 4), vx: ux * rnd(60, 140) + rnd(-20, 20), vy: uy * rnd(60, 140) + rnd(-40, 0), life: 0.45, size: rnd(3, 5), col: col[n % 3], kind: 'dot', grav: 300 });
        break;
      }
      case 'xslash': {
        // 쌍검 X 베기: 두 궤적이 엇갈림 + 무기 끝 번쩍
        swing(1.7, 9, [col[3], col[2], col[0]], 0.16);
        this.addFx(0.18, (c, p) => { c.save(); c.translate(x + ux * 14, y + uy * 14); c.globalAlpha = 1 - p; c.strokeStyle = col[2]; c.lineWidth = 5 * (1 - p) + 1; c.lineCap = 'round'; const r = 14 + p * 10; c.beginPath(); c.moveTo(-r, -r); c.lineTo(r, r); c.moveTo(-r, r); c.lineTo(r, -r); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke(); c.restore(); });
        break;
      }
      case 'thrust': {   // [v4.7 3차] 빛살을 짧고 가늘게 + 자두색 외곽(성광 6 흰 번짐이 몬스터를 가림)
        // 창 찌르기(빙결 5 창 · 성광 6 해 창 · 프리즘 6 유니콘 뿔): 끝에서 앞으로 곧게 뻗는 빛살 + 가루
        this.addFx(0.16, (c, p) => { const len = 30 * (0.4 + p) * T6; c.save(); c.globalAlpha = 1 - p; c.lineCap = 'round'; for (const [cc, w] of [['#2b1426', 6], [col[2], 3.5], ['#fff', 1.4]]) { c.strokeStyle = cc; c.lineWidth = w * (1 - p * 0.5); c.beginPath(); c.moveTo(x - ux * 10, y - uy * 10); c.lineTo(x + ux * len, y + uy * len); c.stroke(); } c.restore(); });
        flash(14);
        for (let n = 0; n < 6; n++) this.part({ x, y, vx: ux * rnd(40, 120) + rnd(-30, 30), vy: uy * rnd(40, 120) + rnd(-40, 10), life: 0.4, size: 3, col: col[n % 3], kind: 'star', vr: 6 });
        break;
      }
      case 'staff': case 'staffHoly': case 'orb': case 'cast': case 'pour': {
        // 지팡이 · 구슬 · 손: 끝에서 번쩍 + 고리가 퍼지고, 마법이 끝에서 발동(탄 · 빔은 이 점에서 출발)
        if (tw.type === 'summon' || tw.type === 'greed') { sparks(3, 110, col); break; }   // [v4.7 4차] 소환: 십자 · 고리가 포탑 위에 겹쳐 지저분함 → 작은 불꽃만
        flash(20 * T6);
        this.addFx(0.3, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.9; c.strokeStyle = col[2]; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, (8 + p * 26) * T6, (8 + p * 26) * T6, 0, 0, TAU); c.stroke(); c.strokeStyle = col[0]; c.lineWidth = 1.5; c.stroke(); c.restore(); });
        sparks(kind === 'staff' ? 7 : 5, 150, col);
        if (kind === 'staff') this.later(0.02, () => this.chain([[x, y], [x + dx * 0.5 + rnd(-10, 10), y + dy * 0.5 + rnd(-10, 10)], [tx, ty]], true));   // 지팡이 끝에서 대상까지 번개
        if (kind === 'pour') for (let n = 0; n < 8; n++) this.part({ x: x + rnd(-4, 4), y, vx: ux * rnd(30, 80), vy: rnd(20, 80), life: 0.5, size: 3, col: col[n % 3], kind: 'star', vr: 5, grav: 200 });
        break;
      }
      case 'iceCast': {
        // 얼음 여왕: 지팡이 끝 번쩍 + 서리 고리 + 대상 쪽으로 얼음 조각이 흩날림
        flash(22 * T6);
        this.addFx(0.32, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.9; c.strokeStyle = col[2]; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, (8 + p * 30) * T6, (8 + p * 30) * T6, 0, 0, TAU); c.stroke(); c.restore(); this.star(c, x, y, 6, 16 * (1 - p) * T6, 3, p * 2, `rgba(255,255,255,${1 - p})`); });
        for (let n = 0; n < 9; n++) this.part({ x, y, vx: ux * rnd(80, 200) + rnd(-40, 40), vy: uy * rnd(80, 200) + rnd(-50, 20), life: rnd(0.3, 0.5), size: rnd(3, 5), col: col[n % 3], kind: 'star', vr: 8 });
        break;
      }
      case 'sixSlash': {
        // 여섯 팔 검객: 세 겹 휘두름 궤적이 차례로 + 꽃잎
        swing(1.6, 10, [col[3], col[2], col[0]], 0.16);
        this.later(0.05, () => swing(2.2, 8, [col[2], col[0]], 0.16));
        this.later(0.1, () => swing(2.8, 6, [col[1], '#ffffff'], 0.16));
        flash(18 * T6);
        for (let n = 0; n < 8; n++) this.part({ x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: ux * rnd(40, 120) + rnd(-50, 50), vy: rnd(-80, 10), life: 0.6, size: rnd(3, 4.5), col: n % 2 ? '#ffc8e8' : '#ff8adf', kind: 'dot', grav: 60, drag: 1.5 });
        break;
      }
      case 'leaves': {
        // 나무 정령: 손끝에서 빛 고리 + 잎 · 꽃가루가 대상 쪽으로
        flash(20 * T6, '#9be06a');
        this.addFx(0.3, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.85; c.strokeStyle = '#9be06a'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, (8 + p * 28) * T6, (8 + p * 28) * T6, 0, 0, TAU); c.stroke(); c.restore(); });
        for (let n = 0; n < 9; n++) this.part({ x, y, vx: ux * rnd(60, 150) + rnd(-40, 40), vy: uy * rnd(60, 150) + rnd(-50, 10), life: rnd(0.4, 0.6), size: rnd(3, 4.5), col: n % 3 ? (n % 2 ? '#7ac84a' : '#4a9a3a') : '#ffe48a', kind: n % 3 ? 'dot' : 'star', vr: 6, drag: 1.2 });
        break;
      }
      case 'torch': {
        flash(18);
        for (let n = 0; n < 9; n++) this.part({ x, y, vx: ux * rnd(60, 160) + rnd(-30, 30), vy: uy * rnd(60, 160) + rnd(-60, 0), life: rnd(0.25, 0.4), size: rnd(5, 9), col: col[n % 4], kind: 'fire', drag: 2.5, add: true });
        break;
      }
      case 'gun': {
        // 총구 번쩍 · 탄피
        this.sprite(['fx_flash'], x, y, (22 + 6 * tw.tier) * (big ? 1.4 : 1), 16);
        this.part({ x: x - f * 18 * s, y: y - 6, vx: -f * rnd(60, 110), vy: rnd(-180, -120), life: 0.5, size: 2.5, col: '#ffd23a', kind: 'spark', grav: 700 });
        break;
      }
      case 'rail': {
        if (this.pxBurst9) this.pxBurst9(x, y, 16 * T6, ['#4aa0ff', '#ffffff', '#bfe6ff'], 0.2);   // [v4.7 4차] 매끈한 원형 섬광 → 픽셀 반짝
        this.part({ x, y, vx: -ux * rnd(40, 90) + rnd(-20, 20), vy: -uy * rnd(40, 90) - 30, life: 0.35, size: rnd(3, 5), col: 'rgba(160,170,190,0.6)', kind: 'puff', drag: 2 });   // [v4.7 3차] 연기 3 → 1 · 작게(꼬리가 구름처럼 부풂)
        break;
      }
      case 'smash': case 'drill': case 'slam': {
        // 곡괭이 · 드릴 · 주먹: 내리친 자리에서 흙먼지 · 금 · 돌 조각
        this.shake = Math.max(this.shake, kind === 'smash' ? 2.5 : 2);
        this.addFx(0.4, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#3a2030'; c.lineWidth = 2.5; for (let k = 0; k < 5; k++) { const a = -0.3 + k * 0.6 + (f < 0 ? Math.PI : 0); c.beginPath(); c.moveTo(x, y + 4); c.lineTo(x + Math.cos(a) * 18 * easeOut(Math.min(1, p * 4)), y + 4 + Math.sin(a) * 8 * easeOut(Math.min(1, p * 4))); c.stroke(); } c.strokeStyle = kind === 'slam' ? col[2] : '#fff1c4'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 4, 8 + p * 26, 3 + p * 10, 0, 0, TAU); c.stroke(); c.restore(); });
        for (let n = 0; n < 7; n++) this.part({ x: x + rnd(-6, 6), y: y + 2, vx: rnd(-90, 90), vy: rnd(-160, -60), life: 0.5, size: rnd(3, 5), col: kind === 'slam' ? col[n % 3] : n % 2 ? '#d9c299' : '#8a6a3a', kind: 'dot', grav: 600 });
        break;
      }
      case 'lash': {
        // 사슬 채찍: 손끝 번쩍(채찍 그림 자체는 원래 'whip' 이펙트가 손끝에서 나감)
        flash(12, col[1]);
        sparks(4, 120, col);
        break;
      }
      case 'throw': case 'toss': {
        // 던지기: 손에서 방울 · 동전이 흩어짐
        flash(12);
        for (let n = 0; n < 5; n++) this.part({ x, y, vx: ux * rnd(50, 120) + rnd(-30, 30), vy: uy * rnd(50, 120) - rnd(30, 80), life: 0.45, size: rnd(3, 4.5), col: col[n % 3], kind: kind === 'toss' ? 'star' : 'dot', grav: 500, vr: 6 });
        break;
      }
      case 'breath': {
        // 드래곤 숨결: 벌린 입에서 대상 쪽으로 뿜는 줄기(불 = 원래 화염 방사도 입에서). 얼음 · 독 · 무지개는 색만
        const cols = tw.type === 'prism' ? ['#ffffff', '#ffd0ff', '#9adfff', '#fff2a0', '#b0ffb0'] : col;
        this.addFx(0.3, (c, p) => {
          for (let n = 0; n < 2; n++) { const sp = rnd(-0.12, 0.12), v = L * rnd(2.4, 3.1); this.part({ x, y, vx: (ux * Math.cos(sp) - uy * Math.sin(sp)) * v, vy: (ux * Math.sin(sp) + uy * Math.cos(sp)) * v, life: rnd(0.25, 0.36), size: rnd(8, 13) * (big ? 1.3 : 1), col: cols[(Math.random() * cols.length) | 0], kind: tw.type === 'fire' ? 'fire' : 'dot', drag: 2.6, add: true, grav: 260 }); if (tw.type !== 'fire') this.parts[this.parts.length - 1].size *= 0.45; else this.parts[this.parts.length - 1].vy -= 70; }   // [v4.7 3차] 숨결 줄기가 휘어 떨어짐(일직선 → 곡선) · 독 · 무지개 숨결은 작은 또렷한 점(흐린 덩어리 지적)
        });
        flash(16);
        break;
      }
    }
  };
})(window);
