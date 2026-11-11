// 판 그리기 + 이펙트. 논리 좌표 720×900(판), 그림은 2배 해상도 에셋을 반으로 그린다.
(function (root) {
  const { TOWERS, TIER, TRAITS, ZONE_COLOR } = root.DATA;
  const G = root.GEOM;
  const TAU = Math.PI * 2;
  const ease = { out: t => 1 - Math.pow(1 - t, 3), outBack: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }, inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  // [v4.2] 단계별 포탑 크기: 1단계 = 예전의 70% → 4단계 = 예전 크기, 5 · 6단계는 4단계와 비슷(대신 외형 · 모션 · 이펙트가 다름)
  const TSZ = [0, 0.7, 0.8, 0.9, 1.0, 1.0, 1.03];

  class Renderer {
    constructor(ctx, topCtx, img) {
      this.ctx = ctx; this.top = topCtx; this.img = img;
      this.fx = []; this.parts = []; this.texts = []; this.coins = [];
      this.shake = 0; this.flash = 0; this.time = 0;
      this.showDmg = true;
      this.drag = null; this.hoverTarget = null;
      this.towerAnim = {};   // 칸별 등장 · 변신 연출
      this.goldPos = [330, 936];
      this.bigText = null;
    }
    I(k) { return this.img[k]; }

    // ------------------------------------------------------------ 사건 → 이펙트
    consume(game, events, audio) {
      for (const e of events) {
        const A = audio;
        switch (e.ev) {
          case 'fire': this.muzzle(e); A && A.fire(e.type, e.tier); break;
          case 'impact': this.impact(e); break;
          case 'dmg': if (this.showDmg && (e.big || e.crit || !e.maxHp || e.amt >= e.maxHp * 0.03)) this.dmgText(e); break;
          case 'kill': this.killFx(e); A && A.kill(e); break;
          case 'build': this.buildFx(e.i, e.tier); A && A.build(); break;
          case 'merge': this.mergeFx(e.i, e.tier, e.lucky); A && A.merge(e.tier); break;
          case 'mergeFrom': this.mergeFrom = { a: e.a, b: e.b, t: this.time, tw: { type: e.type, tier: e.tier } }; break;
          case 'tierup': this.tierupFx(e.i, e.tier, e.lucky); A && A.tierup(); break;
          case 'strike': this.strikeFx(game, e); A && A.strike(e.type); break;
          case 'firewall': this.firewall(e.zone); break;
          case 'bless': this.bless(game, e.zone); break;
          case 'thunder': this.thunder(e.x, e.y, e.tier); A && A.thunder(); break;
          case 'chain': this.chain(e.pts, e.small); break;
          case 'beam': this.beam(e); break;
          case 'flame': this.flame(e); break;
          case 'breath': this.flame(Object.assign({ big: 1 }, e)); break;
          case 'whip': this.whip(e); break;
          case 'dread': this.dread(game, e); A && A.dread(); break;
          case 'boom': this.explosion(e.x, e.y - 10, 26 * (e.r || 1), 1); A && A.boom(); break;
          case 'special': this.specialFx(e); break;
          case 'halo': this.haloFx(e.i); break;
          case 'thud': this.thudFx(e); A && A.thud(); break;
          case 'hop': if (A) { if (A.hopStep) A.hopStep((this._hops = (e.last ? 0 : (this._hops || 0) + 1)), e.last); else A.hop(e.last); } if (e.last) this.landDust(e.i); break;
          case 'dice': if (A) { A.dice(false); A.diceShow && A.diceShow(e.dbl, e.ctrl); } break;   // 주사위 쇼는 render3
          case 'salary': this.goldFloat(G.tiles[0].pawn[0], G.tiles[0].pawn[1] - 40, '+' + e.amt, true); this.say(e.land ? '월급 2배!' : '월급', '#ffe28a', G.tiles[0].pawn[0], G.tiles[0].pawn[1] - 70, 0.8); A && A.coin(3); break;
          case 'gold': if (e.i != null) this.goldFloat(G.tiles[e.i].pawn[0], G.tiles[e.i].pawn[1] - 40, '+' + e.amt, true); A && A.coin(1); break;
          case 'jackpot': this.jackpotFx(e); A && A.jackpot(); break;
          case 'combo': if (e.n >= 2) this.comboFx(e.n); break;
          case 'comboBreak': break;
          case 'offer': break;
          case 'island': this.say('무인도! 3초 쉬기', '#9fe0ff', G.tiles[6].pawn[0] + 30, G.tiles[6].pawn[1] - 60, 1); A && A.bad(); break;
          case 'warn': this.ring(G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 20, 40, '#ff4a4a', 0.5, 5); break;
          case 'rescue': this.say('구조!', '#8fffa0', G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 80, 0.9); A && A.good(); break;
          case 'reclaim': this.say('탈환! +' + e.gold, '#8fffa0', G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 80, 0.9); A && A.good(); break;
          case 'occupy': this.say('점령당함!', '#ff8a8a', G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 80, 0.8); A && A.bad(); break;
          case 'destroyed': this.explosion(G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 20, 40, 1); this.say('파괴됨', '#ff6a6a', G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 80, 0.8); A && A.boom(); break;
          case 'downgrade': this.explosion(G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 20, 30, 1); this.say('−1단계', '#ff6a6a', G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 80, 0.8); A && A.bad(); break;
          case 'stop': this.ring(G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 20, 34, '#c9b8ff', 0.4, 4); break;
          case 'boss': this.banner('보스 등장 — ' + e.name, '#ff6a6a'); this.shake = Math.max(this.shake, 8); A && A.boss(); break;
          case 'bossDown': this.banner('보스 처치!', '#ffd23a'); this.shake = 12; break;
          case 'bossSkill': this.flash = 0.25; A && A.bossSkill(); break;
          case 'round': if (!e.boss) this.banner(e.round + ' 라운드', '#fff4e0', 0.9); A && A.round(); break;
          case 'missionOk': this.banner('미션 성공! 황금 주사위 +1', '#ffd23a'); A && A.jackpot(); break;
          case 'missionFail': this.say('미션 실패', '#ff8a8a', 360, 200, 0.9); break;
          case 'nogold': A && A.error(); break;
          case 'upgrade': A && A.upgrade(); break;
          case 'piggy': this.banner('저금통 보너스 +' + e.gold, '#ffd23a'); A && A.jackpot(); break;
          case 'escape': this.say('도망갔다…', '#c9c9c9', e.x, e.y - 40, 1); break;
          case 'truck': this.say('현금 수송차 출발!', '#ffe28a', G.tiles[0].pawn[0], G.tiles[0].pawn[1] + 46, 1); A && A.truck(); break;
          case 'truckKill': this.goldFloat(e.x, e.y - 40, '대박!', true); A && A.jackpot(); break;
          case 'demolish': this.explosion(G.tiles[e.i].tower[0], G.tiles[e.i].tower[1] - 20, 50, 1.2); this.shake = 10; A && A.boom(); break;
          case 'commander': this.flash = 0.18; A && A.commander(); break;
          case 'shield': this.say('방패 부적이 막았다!', '#9fe0ff', 360, 300, 1); A && A.good(); break;
          case 'monSalary': this.say('+10%', '#ff8a8a', e.x, e.y - 40, 0.5, 14); break;
          case 'poof': this.smoke(e.x, e.y - 10, 1); break;
          case 'reclaim2': this.ring(G.tiles[e.i].badge[0], G.tiles[e.i].badge[1], 26, '#ffd23a', 0.6, 4); break;
          case 'free': break;
        }
      }
    }

    // ------------------------------------------------------------ 기본 도형
    circle(c, x, y, r, col) {
      // 픽셀 원: 3px 격자에 맞춰 가로줄로 채움(도트풍, 매끈한 가장자리 없음)
      const P = 3; c.fillStyle = col;
      const cx = Math.round(x / P) * P, cy = Math.round(y / P) * P, n = Math.ceil(r / P);
      // 작은 원(섬광 · 파티클)은 네모 덩어리 대신 픽셀 마름모(반짝이)로
      if (r <= 7.5) { const m = Math.max(1, Math.round(r / P)); for (let j = -m; j <= m; j++) { const w = (m - Math.abs(j)) * P; c.fillRect(cx - w - P / 2, cy + j * P - P / 2, w * 2 + P, P); } return; }
      for (let j = -n; j <= n; j++) { const yy = j * P, w = Math.floor(Math.sqrt(Math.max(0, r * r - yy * yy)) / P) * P; if (w <= 0 && j) continue; c.fillRect(cx - w - P / 2, cy + yy - P / 2, w * 2 + P, P); }
    }
    glow(c, x, y, r, col, a) {
      // 계단식 빛: 픽셀 원 세 겹(바깥 옅게 → 안 진하게), 그라데이션 없음
      a = a == null ? 1 : a;
      c.save();   // 보통 섞기(더하기 섞기는 밝은 색 위에서 흰 덩어리가 됨)
      c.globalAlpha = a * 0.18; this.circle(c, x, y, r * 0.95, col);
      c.globalAlpha = a * 0.22; this.circle(c, x, y, r * 0.62, col);
      c.globalAlpha = a * 0.28; this.circle(c, x, y, r * 0.32, col);
      c.restore();
    }
    star(c, x, y, n, r1, r2, rot, col) {
      c.fillStyle = col; c.beginPath();
      for (let k = 0; k < n * 2; k++) { const r = k % 2 ? r2 : r1, a = rot + k * Math.PI / n; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      c.closePath(); c.fill();
    }
    addFx(dur, draw, layer) { this.fx.push({ t0: this.time, dur, draw, layer: layer || 'over' }); }
    part(o) { this.parts.push(Object.assign({ age: 0, life: 0.6, vx: 0, vy: 0, grav: 0, drag: 0, size: 3, col: '#fff', add: false, shrink: true, kind: 'dot', rot: 0, vr: 0 }, o)); }
    ring(x, y, r, col, dur, w) {
      this.addFx(dur, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = col; c.lineWidth = (w || 4) * (1 - p) + 1; c.beginPath(); c.ellipse(x, y, r * (0.4 + p * 0.9), r * 0.55 * (0.4 + p * 0.9), 0, 0, TAU); c.stroke(); c.restore(); });
    }
    say(s, col, x, y, dur, size) { this.texts.push({ s, col, x: clamp(x, 40 + String(s).length * (size || 22) * 0.31, 680 - String(s).length * (size || 22) * 0.31), y, t0: this.time, dur: dur || 1, size: size || 22, kind: 'say' }); }
    goldFloat(x, y, s, big) { this.texts.push({ s, col: '#ffd23a', x, y, x0: x, y0: y, t0: this.time, dur: 1.1, size: big ? 30 : 22, kind: 'gold' }); }
    banner(s, col, dur) { this.bigText = { s, col, t0: this.time, dur: dur || 1.6 }; }

    // ------------------------------------------------------------ 발사 · 명중
    muzzle(e) {
      const col = { fire: ['#fff6c8', '#ffb347', '#ff6a1c'], gatling: ['#ffffff', '#ffe27a', '#ffa31a'], bolt: ['#ffffff', '#e6dcff', '#a77bff'], light: ['#ffffff', '#fff2b0', '#ffd24a'], tyrant: ['#ffd0d0', '#ff5a5a', '#8a1426'] }[e.type] || ['#fff', '#ffd', '#fa0'];
      const x = e.x, y = e.y, rot = Math.random() * 3;
      const big = e.tier >= 4 ? 1.4 : 1;
      this.sprite(['fx_spark', 'fx_flash'], x, y, 30 * big, 16); void rot; void col;
      if (e.type === 'gatling' || e.type === 'fire') for (let k = 0; k < 2; k++) this.part({ x, y, vx: rnd(-20, 20), vy: rnd(-40, -10), life: 0.45, size: rnd(3, 5), col: 'rgba(90,80,90,0.55)', grav: -20, kind: 'puff' });
      const ta = this.towerAnim[e.i] || (this.towerAnim[e.i] = {});
      ta.recoil = this.time; ta.aim = e.tx; ta.aimY = e.ty;
    }
    impact(e) {
      const x = e.x, y = e.y;
      if (e.kind === 'fireball') { this.explosion(x, y, 16 + e.tier * 3, 0.7); return; }
      if (e.kind === 'bullet') {
        this.sprite(['fx_spark'], x, y, 20, 11);
        for (let k = 0; k < 3; k++) { const a = rnd(0, TAU); this.part({ x, y, vx: Math.cos(a) * rnd(80, 160), vy: Math.sin(a) * rnd(80, 160) - 30, life: 0.18, size: 2, col: '#ffe27a', kind: 'spark', drag: 4 }); }
        return;
      }
      if (e.kind === 'zap') {
        this.sprite(['fx_zap'], x, y, 34, 7);
        for (let k = 0; k < 5; k++) { const a = rnd(0, TAU); this.part({ x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, life: 0.16, size: 2, col: '#e6dcff', kind: 'spark' }); }
        return;
      }
      if (e.kind === 'orb') {
        this.addFx(0.25, (c, p) => {
          this.glow(c, x, y, 30, '#ffe48a', 0.8 * (1 - p));
          c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#fff6c8'; c.lineWidth = 3;
          for (let k = 0; k < 8; k++) { const a = k * TAU / 8, r1 = 6 + p * 10, r2 = 12 + p * 22; c.beginPath(); c.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); c.stroke(); }
          c.restore();
        });
        return;
      }
      if (e.kind === 'spike') {
        this.addFx(0.22, (c, p) => { this.glow(c, x, y, 26, '#ff3b4a', 0.7 * (1 - p)); this.star(c, x, y, 4, 16 * (1 - p * .5), 5, 0.6, `rgba(42,15,26,${1 - p})`); });
        for (let k = 0; k < 4; k++) { const a = rnd(0, TAU); this.part({ x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 40, life: 0.3, size: 3, col: '#8a1426', grav: 300 }); }
      }
    }
    // 그림 프레임 재생(생성 이펙트 시트): 12fps로 뚝뚝, 크기 = w px
    sprite(names, x, y, w, fps, layer) {
      const dur = names.length / (fps || 12);
      this.addFx(dur, (c, p) => {
        const k = Math.min(names.length - 1, Math.floor(p * names.length)), im = this.I(names[k]), M = root.MANIFEST[names[k]];
        if (!im || !M) return;
        const h = w * M.h / M.w; c.drawImage(im, Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), Math.round(h));
      }, layer);
    }
    explosion(x, y, R, power) {
      // 시안 그림체의 픽셀 폭발 프레임 6장(번쩍 → 불덩이 → 큰 불 → 깨짐 · 연기 → 연기 → 흩어짐)
      this.sprite(['fx_boom1', 'fx_boom2', 'fx_boom3', 'fx_boom4', 'fx_boom5', 'fx_boom6'], x, y - R * 0.3, R * 2.6, 13);
      this.addFx(0.3, (c, p) => { c.save(); c.globalAlpha = (1 - p) * 0.7; c.strokeStyle = '#fff1c4'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); c.ellipse(x, y + R * 0.3, R * (0.6 + p * 1.4), R * 0.45 * (0.6 + p * 1.4), 0, 0, TAU); c.stroke(); c.restore(); }, 'under');
      const n = Math.round(4 * power);
      for (let k = 0; k < n; k++) { const a = rnd(0, TAU), v = rnd(80, 200) * power; this.part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: rnd(0.3, 0.5), size: 3, col: Math.random() < .5 ? '#ffd23a' : '#ff6a1c', grav: 420, kind: 'spark' }); }
      if (power >= 1) this.shake = Math.max(this.shake, 4 + R * 0.08);
    }
    smoke(x, y, power) {
      for (let k = 0; k < Math.round(5 * power) + 1; k++) this.part({ x: x + rnd(-14, 14), y: y + rnd(-8, 8), vx: rnd(-35, 35), vy: rnd(-60, -25), life: rnd(0.4, 0.65), size: rnd(4, 8) * power, col: k % 2 ? '#8a7a82' : '#a8989e', kind: 'puff', grav: -10, drag: 1.5, delay: 0.12 });
    }
    dmgText(e) {
      // 같은 자리에 0.18초 안에 또 맞으면 숫자를 합친다(겹쳐 쌓이지 않게)
      const near = this.texts.find(t => t.kind === 'dmg' && /^\d+$/.test(t.s) && this.time - t.t0 < 0.35 && Math.abs(t.x - e.x) < 40 && Math.abs(t.y - e.y) < 40);
      if (near) { near.sum = (near.sum || +near.s) + e.amt; near.s = String(Math.round(near.sum)); near.t0 = this.time; if (e.crit) near.col = '#ffd23a'; near.size = Math.min(26, near.size + 0.6); return; }
      this.texts = this.texts.filter(t => !(t.kind === 'dmg' && this.time - t.t0 >= 0.35 && Math.abs(t.x - e.x) < 46 && Math.abs(t.y - e.y) < 60));
      const big = e.big || e.crit;
      { const vx = e.x - 360, vy = (e.y - 421) * 1.3, vl = Math.hypot(vx, vy) || 1; e = Object.assign({}, e, { x: e.x + vx / vl * 18, y: e.y + vy / vl * 14 }); }   // 판 바깥쪽으로 조금 비켜
      this.texts.push({ s: String(Math.round(e.amt)), col: e.crit ? '#ffd23a' : big ? '#ffb347' : '#ff7a9a', x: e.x + rnd(-10, 10), y: e.y, t0: this.time, dur: 0.6, size: e.crit ? 24 : big ? 22 : 17, kind: 'dmg' });
      if (this.texts.length > 60) this.texts.splice(0, this.texts.length - 60);
    }
    killFx(e) {
      this.texts = this.texts.filter(t => !(t.kind === 'dmg' && Math.abs(t.x - e.x) < 70 && Math.abs(t.y - e.y) < 90));
      const x = e.x, y = e.y - 14 * (e.g || 1), big = e.big;

      for (let k = 0; k < (big ? 10 : 5); k++) this.part({ x: x + rnd(-8, 8), y: y + rnd(-6, 6), vx: rnd(-50, 50), vy: rnd(-70, -20), life: rnd(0.45, 0.75), size: rnd(5, 9) * (big ? 1.5 : 1), col: k % 2 ? '#7a6a72' : '#9a8a90', kind: 'puff', grav: -15, drag: 1.2 });
      for (let k = 0; k < 5; k++) { const a = rnd(0, TAU); this.part({ x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 40, life: 0.35, size: 3, col: '#fff2b0', kind: 'star', vr: 8 }); }
      this.explosion(x, y + 4, big ? 22 : 12, big ? 0.8 : 0.35);
      if (e.gold > 0 && e.kind !== 'mini') {
        const n = big ? 4 : e.gold > 60 ? 2 : 1;
        for (let k = 0; k < n; k++) this.coins.push({ x, y, vx: rnd(-80, 80), vy: rnd(-260, -180), gy: y + 22, b: 0, t0: this.time, phase: Math.random() * 6, val: 0 });
        // 한 순간에 여러 마리가 죽으면 금화 글자를 합쳐 하나만(글자 겹침 방지)
        const last = this.texts.find(t => t.kind === 'gold' && /^\+\d+$/.test(t.s) && this.time - t.t0 < 0.6 && Math.abs((t.x0 ?? t.x) - x) < 130 && Math.abs((t.y0 ?? t.y) - (y - 62)) < 100);
        if (last) { last.sum = (last.sum || +last.s.slice(1)) + e.gold; last.s = '+' + last.sum; last.size = Math.min(34, last.size + 2); last.t0 = Math.max(last.t0, this.time - 0.2); }
        else { const vx0 = x - 360, vy0 = (y - 421) * 1.3, vl = Math.hypot(vx0, vy0) || 1, ox = x + vx0 / vl * 40, oy = y < 421 ? y - 64 : y + 34; this.goldFloat(ox, oy, '+' + e.gold, big); this.texts[this.texts.length - 1].t0 = this.time + 0.15; }   // 0.15초 늦게 보이되 곧바로 합산 대상이 되게
      }
      if (big) this.shake = Math.max(this.shake, 8);
    }
    landDust(i) {
      const [x, y] = G.tiles[i].pawn;
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6; this.part({ x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 5, vx: Math.cos(a) * 60, vy: Math.sin(a) * 25 - 10, life: 0.35, size: rnd(4, 6), col: '#f1e2bf', kind: 'puff', drag: 3 }); }
    }

    // ------------------------------------------------------------ 건설 · 합치기 · 단계업
    buildFx(i, tier) {
      const [x, y] = G.tiles[i].tower;
      this.towerAnim[i] = { kind: 'drop', t: this.time };
      // 착지 순간(0.28초) 먼지 고리 + 반짝이
      this.addFx(0.28, () => {}, 'under');
      setTimeout(() => {}, 0);
      const t0 = this.time;
      this.addFx(0.9, (c, p) => {
        const age = p * 0.9;
        if (age < 0.26) { // 떨어지는 동안 칸이 밝아짐
          c.save(); c.globalAlpha = 0.35 * (age / 0.26); c.fillStyle = '#fff6d8'; c.beginPath(); c.ellipse(x, y, 26, 11, 0, 0, TAU); c.fill(); c.restore(); return;
        }
        const q = (age - 0.26) / 0.64;
        c.save(); c.globalAlpha = (1 - q) * 0.9; c.strokeStyle = '#fff1c4'; c.lineWidth = 5 * (1 - q) + 1;
        c.beginPath(); c.ellipse(x, y, 30 + q * 46, 14 + q * 20, 0, 0, TAU); c.stroke(); c.restore();
      }, 'under');
      this.later(0.26, () => {
        for (let k = 0; k < 10; k++) { const a = k * TAU / 10; this.part({ x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 8, vx: Math.cos(a) * rnd(80, 130), vy: Math.sin(a) * rnd(30, 50) - 15, life: 0.5, size: rnd(6, 9), col: k % 2 ? '#efdcb4' : '#d9c299', kind: 'puff', drag: 3 }); }
        for (let k = 0; k < 6; k++) this.part({ x: x + rnd(-24, 24), y: y - rnd(10, 50), vy: -rnd(20, 60), life: 0.6, size: 4, col: '#fff6c8', kind: 'star', vr: 6 });
        // 소환 연기(참고 영상): 어두운 연기 덩이가 퍼지고 불티가 내려앉음
        for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2; this.part({ x: x + Math.cos(a) * 12, y: y - 26 + Math.sin(a) * 10, vx: Math.cos(a) * rnd(50, 90), vy: Math.sin(a) * rnd(30, 60) - 20, life: rnd(0.45, 0.7), size: rnd(8, 12), col: k % 2 ? '#3a2a40' : '#4e3a52', kind: 'puff', drag: 2.5, grav: -20 }); }
        for (let k = 0; k < 7; k++) this.part({ x: x + rnd(-30, 30), y: y - rnd(50, 90), vx: rnd(-15, 15), vy: rnd(20, 60), life: rnd(0.6, 0.9), size: 3, col: k % 2 ? '#ffb347' : '#ffd23a', kind: 'spark', grav: 40, delay: rnd(0, 0.15) });
        this.shake = Math.max(this.shake, 3);
      });
      void t0; void tier;
    }
    later(d, fn) { this.fx.push({ t0: this.time, dur: d, draw: () => {}, end: fn, layer: 'none' }); }
    mergeFx(i, tier, lucky) {
      // 합치기: (빨려 듦 0.18초) → 바닥 단계색 고리 + 빛기둥 → 결과 포탑이 크게 통 튀며 커짐 → 고리 반짝 + "N단계!"
      const [x, y] = G.tiles[i].tower, col = TIER.ring[tier];
      this.towerAnim[i] = { kind: 'pop', t: this.time + 0.18, white: true, big: 1 };
      this.later(0.18, () => {
        this.sprite(['fx_flash', 'fx_hit'], x, y - 34, 70, 12);
        // 빛기둥(픽셀 띠): 위로 뻗었다가 가늘어짐
        this.addFx(0.5, (c, p) => {
          const w = Math.round((22 * (1 - p) + 4) / 3) * 3, h = Math.round(150 * Math.min(1, p * 4) / 3) * 3;
          c.save(); c.globalAlpha = 1 - p;
          c.globalAlpha = (1 - p) * 0.35; c.fillStyle = col; c.fillRect(Math.round(x - w / 2) - 6, Math.round(y - h) + 6, w + 12, h - 6); c.globalAlpha = (1 - p) * 0.8;
          c.fillStyle = col; c.fillRect(Math.round(x - w / 2), Math.round(y - h), w, h);
          c.fillStyle = '#fffbe8'; c.fillRect(Math.round(x - w / 6), Math.round(y - h), Math.max(3, Math.round(w / 3)), h);
          c.restore();
        });
        // 바닥 고리: 단계 색, 굵은 픽셀 테두리가 퍼짐
        this.addFx(0.55, (c, p) => {
          c.save(); c.globalAlpha = 1 - p; c.lineWidth = 6; c.strokeStyle = '#2b1426';
          c.beginPath(); c.ellipse(x, y, 26 + p * 46, 11 + p * 20, 0, 0, TAU); c.stroke();
          c.lineWidth = 3; c.strokeStyle = col; c.beginPath(); c.ellipse(x, y, 26 + p * 46, 11 + p * 20, 0, 0, TAU); c.stroke(); c.restore();
        }, 'under');
        for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.3; this.later(0.04 * k, () => this.sprite(['fx_spark'], x + Math.cos(a) * 46, y - 30 + Math.sin(a) * 30, 22, 9)); }
        this.shake = Math.max(this.shake, tier >= 6 ? 14 : 5);
      });
      this.say(tier + '단계!' + (lucky ? ' 행운 +1' : ''), col, x, y - 96, 1.1, tier >= 5 ? 30 : 26);
      if (tier >= 6) { this.banner('전설 탄생!', '#ffd23a', 2); this.flash = 0.4; }
    }
    tierupFx(i, tier, lucky) {
      const [x, y] = G.tiles[i].tower, col = TIER.ring[tier];
      this.towerAnim[i] = { kind: 'pop', t: this.time + 0.42, white: true };
      // 예고: 바닥 마법진이 돌며 반짝이가 모임 → 빛기둥 → 변신 → 링 반짝
      this.addFx(1.1, (c, p) => {
        c.save(); c.translate(x, y); c.scale(1, 0.45); c.rotate(p * 4); c.globalAlpha = p < 0.8 ? 1 : (1 - p) * 5;
        c.strokeStyle = col; c.lineWidth = 3;
        c.beginPath(); c.arc(0, 0, 44, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.stroke();
        for (let k = 0; k < 6; k++) { const a = k * TAU / 6; c.beginPath(); c.moveTo(Math.cos(a) * 34, Math.sin(a) * 34); c.lineTo(Math.cos(a + 2.1) * 34, Math.sin(a + 2.1) * 34); c.stroke(); }
        c.restore();
      }, 'under');
      for (let k = 0; k < 10; k++) { const a = rnd(0, TAU); this.part({ x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 20, tx: x, ty: y - 30, life: 0.4, size: 4, col: k % 2 ? '#fff' : col, kind: 'suck' }); }
      this.addFx(0.55, (c, p) => {
        if (p < 0.6) return;
        const q = (p - 0.6) / 0.4, w = 30 * (1 - q) + 6;
        c.save(); c.globalAlpha = 1 - q;
        const g = c.createLinearGradient(0, y - 160, 0, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, col);
        c.fillStyle = g; c.fillRect(x - w, y - 160, w * 2, 160);
        c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(x - w * 0.35, y - 160, w * 0.7, 160); c.restore();
      });
      this.later(0.42, () => {
        for (let k = 0; k < 12; k++) { const a = rnd(0, TAU); this.part({ x, y: y - 30, vx: Math.cos(a) * rnd(90, 180), vy: Math.sin(a) * rnd(90, 180) - 80, life: 0.6, size: 4, col: k % 2 ? '#fff' : col, kind: 'star', grav: 260, vr: 8 }); }
        this.shake = Math.max(this.shake, 4);
      });
      this.say(tier + '단계!' + (lucky ? ' 행운 +1' : ''), col, x, y - 96, 1.1, 26);
    }
    jackpotFx(e) {
      const [x, y] = G.tiles[e.i].tower;
      this.say('최고 단계! +' + e.gold, '#ffd23a', x, y - 110, 1.4, 26);
      for (let k = 0; k < 6; k++) this.coins.push({ x, y: y - 30, vx: rnd(-110, 110), vy: rnd(-300, -200), gy: y + 10, b: 0, t0: this.time, phase: k });
    }
    comboFx(n) {
      const big = n === 5 || n === 10;
      if (big) { this.banner('연속 출동 ×' + n + '!', '#ff9a3a', 1.2); this.shake = Math.max(this.shake, 6); }
    }

    // ------------------------------------------------------------ 출동 · 특수 공격
    strikeFx(game, e) {
      const [x, y] = G.tiles[e.i].tower;
      this.towerAnim[e.i] = { kind: 'strike', t: this.time };
      this.addFx(0.5, (c, p) => { this.glow(c, x, y - 30, 80, TOWERS[e.type].color, 0.7 * (1 - p)); });
      this.say('출동!' + (e.combo >= 2 ? ' ×' + e.combo : ''), '#ffb347', x, y - 100, 0.9, 24);
    }
    firewall(z) {
      const tiles = [1, 2, 3, 4, 5].map(k => z * 6 + k);
      tiles.forEach((i, n) => this.later(n * 0.06, () => {
        const p = G.lanePoint(i, 0);
        for (let k = 0; k < 3; k++) this.later(k * 0.05, () => this.pillar(p[0] + rnd(-16, 16), p[1] + rnd(-8, 8), 70));
      }));
      this.shake = Math.max(this.shake, 8);
    }
    pillar(x, y, h) {
      this.addFx(0.6, (c, p) => {
        const q = ease.out(Math.min(1, p * 2.2)), a = 1 - clamp((p - 0.5) * 2, 0, 1);
        c.save(); c.globalAlpha = a;
        const w = 18 * (1 - p * 0.5);
        for (const [col, k] of [['#e8452c', 1], ['#ff8a1c', 0.7], ['#ffd23a', 0.4]]) {
          c.fillStyle = col; c.beginPath(); c.moveTo(x - w * k, y); c.quadraticCurveTo(x - w * k * 0.4, y - h * q * 0.6, x, y - h * q); c.quadraticCurveTo(x + w * k * 0.4, y - h * q * 0.6, x + w * k, y); c.fill();
        }
        c.restore(); this.glow(c, x, y - h * 0.4, 40, '#ff6a1c', 0.4 * a);
      });
      for (let k = 0; k < 3; k++) this.part({ x: x + rnd(-8, 8), y, vx: rnd(-20, 20), vy: -rnd(80, 160), life: 0.6, size: 3, col: '#ffd23a', kind: 'spark', grav: -60 });
    }
    bless(game, z) {
      const tiles = z >= 0 ? [1, 2, 3, 4, 5].map(k => z * 6 + k) : [];
      for (const i of tiles) {
        if (!game.tiles[i].tower) continue;
        const [x, y] = G.tiles[i].tower;
        this.addFx(1.0, (c, p) => {
          c.save(); c.globalAlpha = (1 - p) * 0.8; c.fillStyle = 'rgba(255,233,160,0.35)';
          c.beginPath(); c.ellipse(x, y - 10, 46, 70 * ease.out(Math.min(1, p * 3)), 0, Math.PI, TAU); c.fill(); c.restore();
          this.glow(c, x, y - 40, 60, '#ffe48a', 0.5 * (1 - p));
        });
        for (let k = 0; k < 6; k++) this.part({ x: x + rnd(-30, 30), y: y - rnd(0, 30), vy: -rnd(40, 90), life: 0.9, size: 4, col: '#fff6c8', kind: 'star', vr: 4 });
      }
    }
    thunder(x, y, tier) {
      const top = -40, pts = [];
      let cx = x + rnd(-40, 40);
      for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([cx + (x - cx) * t + (k && k < 10 ? rnd(-14, 14) : 0), top + (y - 18 - top) * t]); }
      this.addFx(0.28, (c, p) => {
        const a = p < 0.5 ? 1 : (1 - p) * 2, flick = Math.random() < 0.25 && p > 0.2 ? 0.3 : 1;
        c.save(); c.globalAlpha = a * flick; c.lineJoin = 'round';
        for (const [col, w] of [['rgba(167,123,255,0.5)', 14], ['#e6dcff', 6], ['#ffffff', 2.5]]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach((q, n) => n ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); }
        c.restore();
        this.glow(c, x, y - 18, 60, '#a77bff', 0.8 * a);
      });
      this.addFx(0.3, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#e6dcff'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, 16 + p * 40, 7 + p * 18, 0, 0, TAU); c.stroke(); c.restore(); }, 'under');
      for (let k = 0; k < 6; k++) { const a = rnd(0, TAU); this.part({ x, y: y - 10, vx: Math.cos(a) * 170, vy: Math.sin(a) * 120 - 50, life: 0.3, size: 2.5, col: '#fff27a', kind: 'spark', grav: 200 }); }
      if (tier >= 4) this.shake = Math.max(this.shake, 3);
    }
    chain(pts, small) {
      const segs = [];
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], s = [[x0, y0]];
        for (let j = 1; j < 6; j++) { const t = j / 6; s.push([x0 + (x1 - x0) * t + rnd(-9, 9), y0 + (y1 - y0) * t + rnd(-9, 9)]); }
        s.push([x1, y1]); segs.push(s);
      }
      this.addFx(0.22, (c, p) => {
        c.save(); c.globalAlpha = 1 - p; c.lineJoin = 'round';
        for (const [col, w] of [['rgba(167,123,255,0.45)', small ? 8 : 12], ['#e6dcff', small ? 3 : 4], ['#ffffff', 1.5]]) {
          c.strokeStyle = col; c.lineWidth = w;
          for (const s of segs) { c.beginPath(); s.forEach((q, n) => n ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.stroke(); }
        }
        c.restore();
      });
    }
    beam(e) {
      const col = e.tier >= 6 ? '#fff2a0' : '#ffe48a';
      this.addFx(0.25, (c, p) => {
        c.save(); c.globalAlpha = 1 - p; c.lineCap = 'round';
        for (const [cc, w] of [['rgba(255,214,90,0.4)', 16 * (e.sub ? 0.6 : 1)], [col, 7 * (e.sub ? 0.6 : 1)], ['#ffffff', 2.5]]) { c.strokeStyle = cc; c.lineWidth = w * (1 - p * 0.5); c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(e.tx, e.ty); c.stroke(); }
        c.restore(); this.glow(c, e.tx, e.ty, 34, '#ffe48a', 0.8 * (1 - p));
      });
      for (let k = 0; k < 3; k++) this.part({ x: e.tx + rnd(-6, 6), y: e.ty + rnd(-6, 6), vy: -rnd(40, 80), life: 0.5, size: 3, col: '#fff6c8', kind: 'star', vr: 5 });
    }
    flame(e) {
      const n = e.big ? 26 : 12, dx = e.tx - e.x, dy = e.ty - 10 - e.y;
      for (let k = 0; k < n; k++) {
        const t = rnd(0.1, 1), sp = rnd(-0.18, 0.18);
        this.part({ x: e.x, y: e.y, vx: (dx * Math.cos(sp) - dy * Math.sin(sp)) * 2.6 * t, vy: (dx * Math.sin(sp) + dy * Math.cos(sp)) * 2.6 * t, life: rnd(0.25, 0.45), size: rnd(8, 14) * (e.big ? 1.4 : 1), col: ['#fff2a0', '#ffd23a', '#ff8a1c', '#e8452c'][k % 4], kind: 'fire', drag: 2.5, add: true });
      }
      this.later(0.12, () => this.explosion(e.tx, e.ty - 10, e.big ? 34 : 20, e.big ? 1.2 : 0.6));
    }
    whip(e) {
      const pts = []; const mx = (e.x + e.tx) / 2, my = Math.min(e.y, e.ty) - 70;
      for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([(1 - t) * (1 - t) * e.x + 2 * (1 - t) * t * mx + t * t * e.tx, (1 - t) * (1 - t) * e.y + 2 * (1 - t) * t * my + t * t * (e.ty - 10)]); }
      this.addFx(0.3, (c, p) => {
        const m = Math.ceil(pts.length * Math.min(1, p * 3));
        c.save(); c.globalAlpha = 1 - clamp((p - 0.6) / 0.4, 0, 1);
        for (let k = 0; k < m; k++) { c.fillStyle = k % 2 ? '#4a3a44' : '#7a6a74'; c.beginPath(); c.ellipse(pts[k][0], pts[k][1], 5, 3.5, k, 0, TAU); c.fill(); c.strokeStyle = '#1a0e14'; c.lineWidth = 1.5; c.stroke(); }
        c.restore();
      });
      this.later(0.12, () => { this.addFx(0.35, (c, p) => { this.glow(c, e.tx, e.ty - 10, 70, '#ff3b4a', 0.8 * (1 - p)); c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#ff3b4a'; c.lineWidth = 5; c.beginPath(); c.ellipse(e.tx, e.ty, 20 + p * 60, 9 + p * 26, 0, 0, TAU); c.stroke(); c.restore(); }); this.shake = Math.max(this.shake, 3); });
    }
    dread(game, e) {
      const [x, y] = G.tiles[e.i].tower;
      this.addFx(0.9, (c, p) => {
        c.save(); c.globalAlpha = (1 - p) * 0.55; c.strokeStyle = '#ff3b4a'; c.lineWidth = 3; c.setLineDash([10, 8]);
        c.beginPath(); c.ellipse(x, y, 30 + p * 170, 13 + p * 76, 0, 0, TAU); c.stroke(); c.restore();
      }, 'under');
      if (e.big) { this.flash = 0.3; this.shake = Math.max(this.shake, 10); }
      for (const m of game.monsters) if (m.alive && Math.random() < 0.5) this.part({ x: m.x, y: m.y - 16, vy: -60, life: 0.5, size: 6, col: '#8a1426', kind: 'puff' });
    }
    specialFx(e) {
      const [x, y] = G.tiles[e.i].tower;
      this.towerAnim[e.i] = { kind: 'strike', t: this.time };
      this.addFx(0.4, (c, p) => this.glow(c, x, y - 40, 70, TIER.ring[e.tier], 0.6 * (1 - p)));
    }
    haloFx(i) {
      const [x, y] = G.tiles[i].tower;
      this.addFx(0.8, (c, p) => { c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#ffe48a'; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y - 70, 22 + p * 30, 8 + p * 10, 0, 0, TAU); c.stroke(); c.restore(); });
    }
    thudFx(e) {
      const x = e.x, y = e.y;
      this.addFx(0.55, (c, p) => {
        c.save(); c.globalAlpha = 1 - p; c.strokeStyle = '#3a2030'; c.lineWidth = 3;
        for (let k = 0; k < 7; k++) { const a = k * TAU / 7 + 0.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 30 * ease.out(Math.min(1, p * 4)), y + Math.sin(a) * 14 * ease.out(Math.min(1, p * 4))); c.stroke(); }
        c.strokeStyle = '#fff1c4'; c.lineWidth = 5 * (1 - p) + 1; c.beginPath(); c.ellipse(x, y, 20 + p * 70, 9 + p * 30, 0, 0, TAU); c.stroke(); c.restore();
      }, 'under');
      for (let k = 0; k < 8; k++) { const a = rnd(0, TAU); this.part({ x, y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 50 - 60, life: 0.5, size: rnd(5, 8), col: '#d9c299', kind: 'puff', drag: 2.5, grav: 120 }); }
      this.say('쿵!', '#fff1c4', x, y - 50, 0.8, 28);
      this.shake = Math.max(this.shake, 9);
    }

    // ------------------------------------------------------------ 칸 · 판 위
    tileFill(c, i, col) { const q = G.tiles[i].quad; c.fillStyle = col; c.beginPath(); q.forEach((p, n) => n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); }
    // [v4.1] 포탑 자리(판 바깥 둥근 자리)
    padPath(c, i) { const q = G.tiles[i].pad; c.beginPath(); q.forEach((p, n) => n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); }
    padFill(c, i, col) { c.fillStyle = col; this.padPath(c, i); c.fill(); }
    padStroke(c, i, col, w) { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; this.padPath(c, i); c.stroke(); }
    tileStroke(c, i, col, w) { const q = G.tiles[i].quad; c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.beginPath(); q.forEach((p, n) => n ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke(); }
    drawTiles(c, game) {
      const t = this.time;
      // 요새 구역
      for (let z = 0; z < 4; z++) if (game.zoneFull(z)) {
        for (let k = 1; k <= 5; k++) { const i = z * 6 + k; c.save(); c.globalAlpha = 0.18 + 0.1 * Math.sin(t * 4); this.tileFill(c, i, ZONE_COLOR[z]); c.restore(); this.tileStroke(c, i, 'rgba(255,230,140,0.9)', 3); }
      }
      // 칸 고르기
      if (game.pick) {
        for (const i of game.pick.tiles) { c.save(); c.globalAlpha = 0.28 + 0.14 * Math.sin(t * 6 + i); this.tileFill(c, i, '#fff6c8'); c.restore(); this.tileStroke(c, i, '#ffd23a', 3); }
      }
      // 파괴 예고 · 점령 · 정지
      for (const tl of game.tiles) {
        if (tl.warn) { c.save(); c.globalAlpha = 0.3 + 0.25 * Math.sin(t * 10); this.tileFill(c, tl.i, '#ff3030'); c.restore(); }
        if (tl.occ) { c.save(); c.globalAlpha = 0.35; this.tileFill(c, tl.i, '#5a1a4a'); c.restore(); }
      }
      // 땅 속성 배지
      for (const tl of game.tiles) {
        if (!tl.trait) continue;
        if (tl.tower) { this.tileStroke(c, tl.i, root.DATA.TRAITS[tl.trait].good ? 'rgba(255,210,58,0.75)' : 'rgba(176,124,255,0.75)', 3); continue; }
        const im = this.I('i_' + tl.trait); if (!im) continue;
        const [bx0, by0] = G.tiles[tl.i].badge;
        if (game.tiles.some(o => o.tower && o.i !== tl.i && (() => { const Rr = this.towerRect(game, o.i); return bx0 > Rr.x + Rr.w * 0.1 && bx0 < Rr.x + Rr.w * 0.9 && by0 > Rr.y && by0 < Rr.y + Rr.h; })())) continue;
        const [x, y] = G.tiles[tl.i].badge, s = G.tiles[tl.i].scale * 0.34;
        const pulse = game.t < 3 ? 1 + 0.15 * Math.sin(t * 10) : 1;
        c.drawImage(im, x - im.width * s * pulse / 2, y - im.height * s * pulse / 2, im.width * s * pulse, im.height * s * pulse);
      }
    }
    towerRect(game, i) {
      const tw = game.tiles[i].tower; if (!tw) return null;
      const im = this.I(`t_${tw.type}_${tw.tier}`), M = root.MANIFEST[`t_${tw.type}_${tw.tier}`];
      const [x, y] = G.tiles[i].tower, s = G.tiles[i].scale * 0.46 * TSZ[tw.tier];
      const w = M.w * s, h = M.h * s, foot = M.foot * s;
      return { x: x - w / 2, y: y - foot, w, h, cx: x, cy: y, s, im };
    }
    drawTower(c, game, i, opt) {
      opt = opt || {};
      const tile = game.tiles[i], tw = opt.tw || tile.tower; if (!tw) return;
      const key = `t_${tw.type}_${tw.tier}`, M = root.MANIFEST[key];
      let [x, y] = opt.at || G.tiles[i].tower;
      let s = G.tiles[i].scale * 0.46 * TSZ[tw.tier] * (opt.scale || 1), sx = 1, sy = 1, dy = 0, whiteA = 0;
      const an = this.towerAnim[i] || {}, now = this.time;
      if (!opt.at) {
        if (an.kind === 'drop') {
          const p = (now - an.t) / 0.26;
          if (p < 1) { dy = -(1 - ease.inOut(p)) * 130; sx = 0.85; sy = 1.15; }
          else { const q = (now - an.t - 0.26) / 0.3; if (q < 1) { const k = Math.sin(q * Math.PI) * (1 - q); sx = 1 + 0.22 * k; sy = 1 - 0.22 * k; } }
        } else if (an.kind === 'pop') {
          const p = (now - an.t) / 0.5;
          if (p < 0) { whiteA = 0; sx = sy = 1; }
          else if (p < 1) { const amp = an.big ? 0.4 : 0.28, k = 1 + Math.sin(p * Math.PI * 2.5) * (1 - p) * amp; sx = k; sy = 2 - k; whiteA = p < 0.12 ? 0.35 * (1 - p / 0.12) : 0; }
        } else if (an.kind === 'strike') {
          const p = (now - an.t) / 0.4; if (p < 1) { const k = Math.sin(p * Math.PI); sx = 1 + 0.12 * k; sy = 1 + 0.18 * k; whiteA = 0.5 * k; }
        }
        // 쏠 때: 짧게 눌렸다가(0~35%) 튕겨 늘어남 + 대상 반대쪽으로 밀림(render3 의 _kick), 평소엔 숨쉬기(_breath)
        if (this._kick > 0) { const p = 1 - this._kick; if (p < 0.35) { const k = p / 0.35; sx *= 1 + 0.11 * k; sy *= 1 - 0.12 * k; } else { const k = Math.sin((p - 0.35) / 0.65 * Math.PI); sx *= 1 + 0.11 * (1 - (p - 0.35) / 0.65) - 0.05 * k; sy *= 1 - 0.12 * (1 - (p - 0.35) / 0.65) + 0.07 * k; } x += (an.aim < x ? 1 : -1) * 4 * this._kick * (1 + 0.3 * (tw.tier - 1)); }   // [v4.2] 단계가 높을수록 반동 크게
        if (this._breath) { sy *= 1 + 0.018 * this._breath; sx *= 1 - 0.01 * this._breath; }
        if (tw.tier >= 5) dy += Math.sin(now * 2 + i) * 1.5;
      }
      // [v4.2] 5 · 6단계 공격 동작(render4 actPose): 기울기 · 내딛기 · 떠오름
      const act = !opt.at && this.actPose ? this.actPose(i, tw, now) : null;
      if (act) { x += act.dx; dy += act.dy; sx *= act.sx; sy *= act.sy; }
      const flip = an.aim != null && an.aim < (G.tiles[i].tower[0]) - 4;
      const grey = !opt.at && (game.t < tile.stopUntil || tile.occ);
      // 뒷모습: 대상이 화면 위쪽(뒤)에 있으면
      // [v4.3] 5 · 6단계는 공격 자세 프레임(render5 poseOf: '' 정자세 · '_a1' 준비 · '_a2' 타격)을 쓰고 뒷모습은 쓰지 않는다
      const pose = !opt.at && !grey && tw.tier >= 5 && this.poseOf ? this.poseOf(game, i, tw) : '';
      const back = !grey && !opt.at && tw.tier < 5 && M.back && an.aimY != null && an.aimY < G.tiles[i].tower[1] - 18;
      const pk = key + pose, PM = root.MANIFEST[pk] || M;
      const im = this.I(pk + (back ? '_b' : ''));
      if (!im) return;
      // [v4.4] 뒷모습은 폭 · 기준점(받침 가운데)을 따로 가짐(포신이 뒤로 뻗어 앞모습과 폭이 다름)
      const BM = back ? M.back : PM, w = (BM.w || PM.w) * s, h = BM.h * s, foot = BM.foot * s, ax = BM.ax != null ? BM.ax * s : w / 2;
      // 단계 오라(4단계 이상)
      if (tw.tier >= 4 && !opt.at) this.glow(c, x, y - 4, 46 * G.tiles[i].scale, TIER.ring[tw.tier], 0.32 + 0.12 * Math.sin(now * 3 + i));
      if (opt.shadow) { c.save(); c.globalAlpha = 0.35; c.fillStyle = '#1a0e14'; c.beginPath(); c.ellipse(opt.shadow[0], opt.shadow[1], w * 0.42, w * 0.16, 0, 0, TAU); c.fill(); c.restore(); }
      c.save();
      if (opt.alpha != null) c.globalAlpha = opt.alpha;
      c.translate(x, y + dy); if (act && act.rot) c.rotate(act.rot); c.scale(flip ? -sx : sx, sy);
      c.drawImage(im, -ax, -foot, w, h);
      if (whiteA > 0) { c.globalAlpha = Math.min(1, whiteA) * (opt.alpha == null ? 1 : opt.alpha); c.drawImage(this.I(pk + (back ? '_bw' : '_w')), -ax, -foot, w, h); }
      c.restore();
      if (!opt.at) this.towerBadges(c, game, i, tw, x, y, w, h, foot);
    }
    towerBadges(c, game, i, tw, x, y, w, h, foot) {
      const tile = game.tiles[i], now = this.time;
      // 동료 포탑: 파란 깃발
      if (tw.owner === 2) { const fx = x - w * 0.34, fy = y - 2; c.fillStyle = '#2b1426'; c.fillRect(fx - 1, fy - 24, 4, 25); c.fillStyle = '#4a9bff'; c.beginPath(); c.moveTo(fx + 3, fy - 24); c.lineTo(fx + 17, fy - 19); c.lineTo(fx + 3, fy - 13); c.closePath(); c.fill(); c.strokeStyle = '#2b1426'; c.lineWidth = 1.5; c.stroke(); }
      // [v4.2] 단계 표시 = 포탑 위 별(render4 drawStarsPass — 다른 포탑에 가리지 않게 따로 그림). 발밑 주사위 배지는 없앰
      if (tile.warn) {
        const left = Math.max(0, tile.warn.until - game.t) / 15;
        const near = tile.zone === 0 || tile.zone === 3, cx = near ? x + w * 0.3 : x, cy = near ? y + 14 : y - foot - 18;
        c.fillStyle = 'rgba(30,10,20,0.85)'; c.beginPath(); c.arc(cx, cy, 15, 0, TAU); c.fill();
        c.fillStyle = '#ff4a4a'; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 12, -Math.PI / 2, -Math.PI / 2 + TAU * left); c.fill();
        c.fillStyle = '#fff'; c.font = '700 14px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', cx, cy + 1);
      }
      if (tile.occ || game.t < tile.stopUntil) {
        c.save(); c.globalAlpha = 0.55 + 0.25 * Math.sin(now * 6); c.strokeStyle = tile.occ ? '#d070ff' : '#9fd8ff'; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, w * 0.46, w * 0.2, 0, 0, Math.PI * 2); c.stroke(); c.restore();
        const lx = x, ly = y - foot - 2; c.fillStyle = '#2b1426'; this.rr(c, lx - 11, ly - 10, 22, 18, 4); c.fill(); c.fillStyle = tile.occ ? '#d070ff' : '#9fd8ff'; this.rr(c, lx - 9, ly - 8, 18, 14, 3); c.fill(); c.strokeStyle = '#2b1426'; c.lineWidth = 3; c.beginPath(); c.arc(lx, ly - 10, 6, Math.PI, 0); c.stroke();
      }
      if (tile.occ) {
        c.font = '700 13px Jua, sans-serif'; c.textAlign = 'center'; this.outlined(c, '점령 ' + Math.round(tile.occ.ransom), x, y - foot - 24, '#ffb0e0', '#2b1426', 3);
      }
      if (game.t < tile.stopUntil) {
        for (let k = 0; k < 2; k++) { const a = now * 6 + k * 3; c.strokeStyle = '#e6dcff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + Math.cos(a) * 18, y - 40 + Math.sin(a) * 10); c.lineTo(x + Math.cos(a + 0.6) * 24, y - 50 + Math.sin(a + 0.5) * 8); c.stroke(); }
      }
    }
    rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
    outlined(c, s, x, y, fill, stroke, w) { c.lineJoin = 'round'; c.strokeStyle = stroke; c.lineWidth = w; c.strokeText(s, x, y); c.fillStyle = fill; c.fillText(s, x, y); }
    drawMonster(c, game, m) {
      const key = m.boss ? 'b_' + m.boss : m.kind === 'truck' ? null : 'm_' + m.kind;
      const now = this.time, g = m.g;
      if (!m.ph) m.ph = Math.random() * 6;
      if (m.rx == null) { m.rx = m.x; }
      const dx = m.x - (m.lastX == null ? m.x : m.lastX); if (Math.abs(dx) > 0.05) m.face = dx < 0 ? -1 : 1; m.lastX = m.x;
      const dy = m.y - (m.lastY == null ? m.y : m.lastY); if (Math.abs(dy) > 0.05) m.up = dy < 0; m.lastY = m.y;
      const stunned = game.t < m.stunUntil;
      const hopSpd = m.boss ? 5 : m.kind === 'fast' ? 13 : 9;
      let ph = stunned ? 0 : Math.abs(Math.sin(now * hopSpd + m.ph));
      let hop = ph * (m.boss ? 4.25 : 6.8) * g, contact = 1 - ph;   // [v5.8] 걷는 통통 모션 −15%(사용자: '아주 살짝 번잡스럽다') — 전 5 · 8 / 0.08
      let sx = 1 + 0.068 * contact, sy = 1 - 0.068 * contact;
      // [v5.9] 대기 모션: 입구에 앉은 다음 보스(render15 m.seat) · 막 나와 소개를 기다리는 보스 = 숨쉬기 + 4.5초마다 들썩 / 떨어져 착지 / 잡몹 내보낼 때 움찔
      if (m.seat || (m.boss && game.t - (m.born || 0) < 0.02)) {
        const a = m.seat ? m.seatT : 9, drop = a < 0.45 ? 1 - Math.pow(a / 0.45, 2) : 0, land = a >= 0.45 && a < 0.75 ? Math.sin((a - 0.45) / 0.3 * Math.PI) : 0;
        const br = Math.sin(now * 2.2 + m.ph), ib = (now + m.ph) % 4.5, bob = ib < 0.36 ? Math.sin(ib / 0.36 * Math.PI) : 0;
        const pq = m.pulse != null && m.pulse < 0.34 ? m.pulse / 0.34 : 1, pu = pq < 0.45 ? Math.sin(pq / 0.45 * Math.PI) : pq < 1 ? -0.5 * Math.sin((pq - 0.45) / 0.55 * Math.PI) : 0;   // 움찔(납작) → 튕겨 늘어남
        ph = drop * 0.9 + bob * 0.3; hop = (drop * 150 + bob * 7) * g;
        sx = 1 - 0.018 * br + 0.16 * land + 0.12 * pu - 0.05 * bob; sy = 1 + 0.03 * br - 0.18 * land - 0.14 * pu + 0.07 * bob;
      }
      // 그림자
      c.save(); c.globalAlpha = 0.28 * (1 - ph * 0.4); c.fillStyle = '#1a0e14';
      const sw = (m.boss ? 56 : m.kind === 'giant' ? 46 : 22) * g;
      c.beginPath(); c.ellipse(m.x, m.y + 2, sw, sw * 0.32, 0, 0, TAU); c.fill(); c.restore();
      if (m.kind === 'truck') { this.drawTruck(c, m, hop); this.hpBar(c, m, 44); return; }
      const M = root.MANIFEST[key]; if (!M) return;
      const back = false;   // 몬스터는 늘 앞모습(눈 · 분홍 배가 보이게) — 검수 의견 반영
      const im = this.I(key + (back ? '_b' : '')); if (!im) return;
      const s = (m.boss ? 0.5 : 0.5) * g;
      const hk = clamp(1 - (game.t - m.hitT) / 0.1, 0, 1);   // 맞는 순간 납작 + 밀림(참고 영상의 타격감)
      const w = M.w * s, h = (back ? M.back.h : M.h) * s, foot = (back ? M.back.foot : M.foot) * s;
      c.save(); c.translate(m.x + (m.face || 1) * -3 * hk, m.y - hop); c.scale((m.face || 1) * sx * (1 + 0.14 * hk), sy * (1 - 0.12 * hk));
      if (game.t < m.slowUntil) c.filter = 'none';
      c.drawImage(im, -w / 2, -foot, w, h);
      const ha = 1 - (game.t - m.hitT) / 0.07;
      if (ha > 0) { c.globalAlpha = Math.min(1, ha) * (m.boss ? 0.2 : 0.3); c.drawImage(this.I(key + (back ? '_bw' : '_w')), -w / 2, -foot, w, h); }
      c.restore();
      if (m.burn && game.t < m.burn.until && Math.random() < 0.2) this.part({ x: m.x + rnd(-10, 10), y: m.y - hop - rnd(5, 25) * g, vy: -60, life: 0.4, size: rnd(4, 7), col: Math.random() < .5 ? '#ffd23a' : '#ff6a1c', kind: 'fire', add: true });
      if (stunned) { for (let k = 0; k < 3; k++) { const a = now * 5 + k * 2.1; this.star(c, m.x + Math.cos(a) * 14 * g, m.y - h + 6 + Math.sin(a) * 4, 4, 4, 1.6, a, '#fff27a'); } }
      if (m.hp < m.maxHp && (m.weight >= 3 || game.t - m.hitT < 1.5)) this.hpBar(c, m, h * 0.92 + hop);
    }
    hpBar(c, m, up) {
      const w = m.boss ? 70 : m.weight >= 3 ? 46 : 28, x = m.x - w / 2, y = m.y - up - 8;
      c.fillStyle = '#2b1426'; c.fillRect(x - 1.5, y - 1.5, w + 3, 7);
      c.fillStyle = '#5a2a3a'; c.fillRect(x, y, w, 4);
      c.fillStyle = m.boss ? '#ff4a5a' : '#7be06a'; c.fillRect(x, y, w * Math.max(0, m.hp / m.maxHp), 4);
    }
    drawTruck(c, m, hop) {
      const x = m.x, y = m.y - hop * 0.3, f = m.face || 1;
      c.save(); c.translate(x, y); c.scale(f, 1);
      c.fillStyle = '#2b1426'; this.rr(c, -26, -34, 52, 30, 6); c.fill();
      c.fillStyle = '#4a9bff'; this.rr(c, -24, -32, 34, 26, 4); c.fill();
      c.fillStyle = '#7ec0ff'; this.rr(c, 10, -26, 14, 20, 3); c.fill();
      c.fillStyle = '#ffd23a'; c.beginPath(); c.arc(-7, -19, 7, 0, TAU); c.fill(); c.fillStyle = '#c27a00'; c.beginPath(); c.arc(-7, -19, 3.5, 0, TAU); c.fill();
      c.fillStyle = '#2b1426'; c.beginPath(); c.arc(-14, -4, 6, 0, TAU); c.arc(14, -4, 6, 0, TAU); c.fill();
      c.restore();
    }
    drawPawn(c, game) {
      const p = game.pawn, key = 'p_' + game.pawnId, im = this.I(key), M = root.MANIFEST[key];
      let x, y, jump = 0, sq = 0;
      const cur = G.tiles[p.tile].pawn;
      if (p.moving && p.path.length) {
        const nx = G.tiles[p.path[0]].pawn, f = Math.min(1, p.hopT / p.hopDur);
        x = cur[0] + (nx[0] - cur[0]) * f; y = cur[1] + (nx[1] - cur[1]) * f; jump = Math.sin(f * Math.PI) * 22;
      } else { x = cur[0]; y = cur[1]; const ld = this.time - (this.lastLand || -9); if (ld < 0.25) sq = Math.sin(ld / 0.25 * Math.PI) * (1 - ld / 0.25); }
      c.save(); c.globalAlpha = 0.3; c.fillStyle = '#1a0e14'; c.beginPath(); c.ellipse(x, y + 2, 16, 6, 0, 0, TAU); c.fill(); c.restore();
      if (!im) return;
      const s = 0.5 * G.tiles[p.tile].scale, w = M.w * s, h = M.h * s, foot = M.foot * s;
      c.save(); c.translate(x, y - jump); c.scale(1 + 0.2 * sq, 1 - 0.2 * sq); c.drawImage(im, -w / 2, -foot, w, h); c.restore();
      return [x, y - jump - h];
    }
    drawPartner(c, game) {
      const p = game.partner, key = 'p_' + p.pawn, im = this.I(key), M = root.MANIFEST[key]; if (!im) return;
      const cur = G.tiles[p.tile].pawn; let x = cur[0] + 10, y = cur[1] + 4, jump = 0;
      if (p.moving && p.path.length) { const nx = G.tiles[p.path[0]].pawn, f = Math.min(1, p.hopT / p.hopDur); x = cur[0] + (nx[0] - cur[0]) * f + 10; y = cur[1] + (nx[1] - cur[1]) * f + 4; jump = Math.sin(f * Math.PI) * 20; }
      c.save(); c.globalAlpha = 0.3; c.fillStyle = '#1a0e14'; c.beginPath(); c.ellipse(x, y + 2, 15, 5.5, 0, 0, Math.PI * 2); c.fill(); c.restore();
      const s = 0.46 * G.tiles[p.tile].scale, w = M.w * s, h = M.h * s, foot = M.foot * s;
      c.drawImage(im, x - w / 2, y - jump - foot, w, h);
      c.fillStyle = '#4a9bff'; c.strokeStyle = '#2b1426'; c.lineWidth = 3; c.beginPath(); c.arc(x + w * 0.38, y - jump - h + foot + 6, 9, 0, Math.PI * 2); c.fill(); c.stroke();
      c.font = '700 12px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText('2P', x + w * 0.38, y - jump - h + foot + 7);
    }
    drawShots(c, game) {
      for (const s of game.shots) {
        if (s.delay > 0) continue;
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        if (s.kind === 'fireball') {
          const big = 1 + (s.tier - 1) * 0.12;
          { const im = this.I('fx_boom2'), w = 26 * big; if (im) c.drawImage(im, Math.round(s.x - w / 2), Math.round(s.y - w / 2), w, w); }
          if (Math.random() < 0.6) this.part({ x: s.x, y: s.y, vx: rnd(-20, 20), vy: rnd(-20, 20), life: 0.25, size: rnd(3, 5), col: Math.random() < .5 ? '#ffd23a' : '#ff6a1c', kind: 'fire', add: true });
        } else if (s.kind === 'bullet') {
          c.save(); c.lineCap = 'round';
          c.strokeStyle = 'rgba(255,200,80,0.5)'; c.lineWidth = 6; c.beginPath(); c.moveTo(s.x - ux * 16, s.y - uy * 16); c.lineTo(s.x, s.y); c.stroke();
          c.strokeStyle = '#fff6c8'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(s.x - ux * 12, s.y - uy * 12); c.lineTo(s.x, s.y); c.stroke(); c.restore();
        } else if (s.kind === 'zap') {
          this.glow(c, s.x, s.y, 20, '#a77bff', 0.9);
          c.save(); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath();
          for (let k = 0; k < 4; k++) { const t = k / 3; c.lineTo(s.x - ux * 16 * t + rnd(-4, 4), s.y - uy * 16 * t + rnd(-4, 4)); } c.stroke(); c.restore();
          this.circle(c, s.x, s.y, 4.5, '#ffffff');
        } else if (s.kind === 'orb') {
          this.glow(c, s.x, s.y, 24, '#ffe48a', 0.8);
          this.circle(c, s.x, s.y, 7, '#ffe48a'); this.circle(c, s.x, s.y, 4.5, '#fffbe0');
          this.star(c, s.x, s.y, 4, 12, 2, this.time * 6, 'rgba(255,255,255,0.85)');
          if (Math.random() < 0.5) this.part({ x: s.x, y: s.y, life: 0.35, size: 3, col: '#fff6c8', kind: 'star', vr: 6 });
        } else if (s.kind === 'spike') {
          c.save(); c.translate(s.x, s.y); c.rotate(Math.atan2(uy, ux));
          c.fillStyle = '#1a0e14'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-10, -5.5); c.lineTo(-6, 0); c.lineTo(-10, 5.5); c.closePath(); c.fill();
          c.fillStyle = '#b8202e'; c.beginPath(); c.moveTo(10, 0); c.lineTo(-7, -3.2); c.lineTo(-4, 0); c.lineTo(-7, 3.2); c.closePath(); c.fill();
          c.restore(); this.glow(c, s.x, s.y, 14, '#ff3b4a', 0.5);
        }
      }
    }
    drawParts(c, dt, layer) {
      for (const p of this.parts) {
        if (p.delay > 0) { if (layer === 'world') p.delay -= dt; continue; }
        if (layer === 'world') {
          p.age += dt;
          if (p.kind === 'suck') { const q = Math.min(1, p.age / p.life); p.cx = p.x + (p.tx - p.x) * ease.inOut(q); p.cy = p.y + (p.ty - p.y) * ease.inOut(q); }
          else { p.vy += p.grav * dt; const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vy *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
        }
        const q = p.age / p.life; if (q >= 1) continue;
        const sz = p.shrink ? p.size * (p.kind === 'puff' ? (0.6 + q * 0.6) : (1 - q * 0.7)) : p.size;
        const x = p.kind === 'suck' ? p.cx : p.x, y = p.kind === 'suck' ? p.cy : p.y;
        c.save();
        c.globalAlpha = p.kind === 'puff' ? (1 - q) * 0.85 : 1 - q * q;
        
        if (p.kind === 'star') this.star(c, x, y, 4, sz * 1.6, sz * 0.5, p.rot, p.col);
        else if (p.kind === 'spark') { c.strokeStyle = p.col; c.lineWidth = sz * 0.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - p.vx * 0.03, y - p.vy * 0.03); c.stroke(); }
        else if (p.kind === 'fire' && sz < 8) { c.fillStyle = p.col; c.fillRect(Math.round(x / 3) * 3 - 3, Math.round(y / 3) * 3 - 3, 6, 6); }
        else this.circle(c, x, y, sz, p.col);
        c.restore();
      }
      if (layer === 'world') this.parts = this.parts.filter(p => p.age < p.life || p.delay > 0);
      if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    }
    drawFx(c, layer) {
      for (const f of this.fx) {
        if (f.layer !== layer) continue;
        const p = (this.time - f.t0) / f.dur;
        if (p >= 0 && p < 1) f.draw(c, p);
      }
    }
    drawTexts(c) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      // 새로 생긴 글자가 기존 글자와 겹치면 위로 비켜 둔다(한 번만)
      const vis = this.texts.filter(t => this.time >= t.t0 && this.time - t.t0 < t.dur).sort((a, b) => a.t0 - b.t0);
      const boxes = [];
      for (const t of vis) {
        const w = String(t.s).length * t.size * 0.62 + 8, h = t.size + 6;
        t.lift = t.lift || 0;
        let want = 0;
        for (let k = 0; k < 6; k++) {
          const yy = t.y - t.lift - want, hit = boxes.find(b => Math.abs(b.x - t.x) < (b.w + w) / 2 && Math.abs(b.y - yy) < (b.h + h) / 2);
          if (!hit) break; want += ((hit.h + h) / 2 - Math.abs(hit.y - yy) + 2) * (t.y > 421 ? -1 : 1);
        }
        t.lift += want;
        boxes.push({ x: t.x, y: t.y - t.lift, w, h });
      }
      for (const t of this.texts) {
        const p = (this.time - t.t0) / t.dur; if (p >= 1 || p < 0) continue;
        let y = t.y - (t.lift || 0), sc = 1;
        if (t.kind === 'dmg') { y -= ease.out(p) * 26; sc = p < 0.12 ? 1.4 - p * 3.3 : 1; }
        else if (t.kind === 'gold') { const b = p < 0.18 ? Math.sin(p / 0.18 * Math.PI) * 16 : 0; y -= b + Math.max(0, p - 0.3) * 40; sc = p < 0.1 ? 0.6 + p * 4 : 1; }
        else { y -= ease.out(p) * 30; sc = p < 0.1 ? 0.5 + p * 5 : 1; }
        c.save(); c.globalAlpha = p > 0.82 ? (1 - p) / 0.18 : 1;
        c.font = `700 ${Math.round(t.size * sc)}px Jua, sans-serif`;
        this.outlined(c, t.s, t.x, y, t.col, '#2b1426', Math.max(4, t.size * 0.28));
        c.restore();
      }
      this.texts = this.texts.filter(t => this.time - t.t0 < t.dur);
    }

    // ------------------------------------------------------------ 한 장면
    frame(game, dt, ui) {
      this.time += dt;
      const c = this.ctx;
      // 끝난 연출의 마무리 호출
      for (const f of this.fx) if (f.end && this.time - f.t0 >= f.dur && !f.ended) { f.ended = true; f.end(); }
      this.fx = this.fx.filter(f => this.time - f.t0 < f.dur || (f.end && !f.ended));
      c.save();
      this.shakeX = this.shakeY = 0;
      if (this.shake > 0.3) { this.shakeX = rnd(-1, 1) * this.shake; this.shakeY = rnd(-1, 1) * this.shake * 0.6; c.translate(this.shakeX, this.shakeY); this.shake *= Math.pow(0.0015, dt); } else this.shake = 0;
      c.drawImage(this.I(this.boardKey || 'board') || this.I('board'), 0, 0, 720, 900);
      this.drawTiles(c, game);
      this.drawFx(c, 'under');
      // 단계업 대상: 금빛 고리(버튼은 판 아래에 따로)
      if (game.offer && game.t <= game.offer.until) {
        const [ox, oy] = G.tiles[game.offer.i].tower, k = 0.5 + 0.5 * Math.sin(this.time * 8);
        c.save(); c.strokeStyle = '#5fe06a'; c.lineWidth = 4; c.globalAlpha = 0.6 + 0.4 * k;
        c.beginPath(); c.ellipse(ox, oy, 34 + k * 4, 15 + k * 2, 0, 0, Math.PI * 2); c.stroke(); c.restore();
      }
      // 깊이 순서로 포탑 · 몬스터 · 말
      const items = [];
      for (const t of game.tiles) if (t.tower && !(this.drag && this.drag.from === t.i)) items.push([G.tiles[t.i].tower[1], 0, t.i]);
      for (const m of game.monsters) if (m.alive) items.push([m.y, 1, m]);
      const pp = game.pawn.moving && game.pawn.path.length ? G.tiles[game.pawn.path[0]].pawn : G.tiles[game.pawn.tile].pawn;
      void pp;   // [v4.0] 말은 이펙트 위에 따로 그린다(출동 불기둥 · 연기에 묻히지 않게 — 검수)
      items.sort((a, b) => a[0] - b[0]);
      const dim = this.drag && this.drag.active;
      for (const it of items) {
        if (it[1] === 0) {
          const i = it[2];
          const ok = dim && game.canMerge(this.drag.from, i);
          if (dim) {
            if (this.drag.target === i) this.glow(c, G.tiles[i].tower[0], G.tiles[i].tower[1] - 30, 70, '#fff6c8', 0.9);
            this.drawTower(c, game, i, { alpha: ok ? 1 : 0.4, scale: this.drag.target === i ? 1.1 : 1 });
          } else this.drawTower(c, game, i);
        } else if (it[1] === 1) this.drawMonster(c, game, it[2]);
        else if (it[1] === 2) this.pawnTop = this.drawPawn(c, game);
        else if (it[1] === 4) this.drawBadge(c, game, it[2]);
        else this.drawPartner(c, game);
      }
      const mf = this.mergeFrom;
      if (mf && this.time - mf.t < 0.18) {
        const p = (this.time - mf.t) / 0.18, a = G.tiles[mf.a].tower, b = G.tiles[mf.b].tower;
        const at = [a[0] + (b[0] - a[0]) * ease.inOut(p), a[1] + (b[1] - a[1]) * ease.inOut(p) - Math.sin(p * Math.PI) * 30];
        this.drawTower(c, game, mf.b, { at, scale: 1 - p * 0.5, tw: mf.tw, alpha: 1 - p * 0.3 });
      }
      if (game.offer && game.t <= game.offer.until && game.tiles[game.offer.i].tower) {
        const R2 = this.towerRect(game, game.offer.i), ax = R2.cx, ay = R2.y - 8 + Math.sin(this.time * 8) * 4;
        c.fillStyle = '#2b1426'; c.beginPath(); c.moveTo(ax - 13, ay - 18); c.lineTo(ax + 13, ay - 18); c.lineTo(ax, ay + 1); c.closePath(); c.fill();
        c.fillStyle = '#5fe06a'; c.beginPath(); c.moveTo(ax - 9, ay - 15.5); c.lineTo(ax + 9, ay - 15.5); c.lineTo(ax, ay - 3); c.closePath(); c.fill();
      }
      this.drawShots(c, game);
      this.drawParts(c, dt, 'world');
      this.drawFx(c, 'over');
      if (game.partner) this.drawPartner(c, game);
      this.pawnTop = this.drawPawn(c, game);
      // 끄는 포탑(맨 위)
      if (this.drag && this.drag.active) {
        const d = this.drag;
        if (d.fx != null) this.drawTower(c, game, d.from, { at: [d.fx, d.fy - 14], scale: 1.1, shadow: [d.fx, d.fy + 2], tw: game.tiles[d.from].tower });
      }
      // 주사위 결과(가운데 광장)
      if (this.dice) this.drawDice(c);
      if (this.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(0.5, this.flash)})`; c.fillRect(-20, -20, 760, 940); this.flash -= dt; }
      c.restore();
      this.drawTop(dt);
      void ui;
    }
    drawDice(c) {
      const d = this.dice, a = this.time - d.t; if (a > 1.4) { this.dice = null; return; }
      const cx = 360, cy = 392;
      const roll = a < 0.35;
      for (let k = 0; k < 2; k++) {
        const x = cx + (k ? 30 : -30), j = roll ? Math.abs(Math.sin(a * 22 + k)) * 18 : 0;
        const v = roll ? 1 + Math.floor((a * 30 + k * 3) % 6) : (k ? d.d2 : d.d1);
        const rot = roll ? a * 18 + k : 0, s = roll ? 1 : (a < 0.45 ? 1 + (0.45 - a) * 3 : 1);
        c.save(); c.translate(x, cy - j); c.rotate(rot); c.scale(s, s); c.globalAlpha = a > 1.1 ? (1.4 - a) / 0.3 : 1;
        c.fillStyle = '#2b1426'; this.rr(c, -19, -19, 38, 38, 8); c.fill();
        c.fillStyle = d.dbl && !roll ? '#ffe48a' : '#fffaf0'; this.rr(c, -16, -16, 32, 32, 6); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(-16, 9, 32, 7);
        c.fillStyle = v === 1 ? '#d23a3a' : '#2b1426';
        const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
        for (const [i, j2] of P) { c.beginPath(); c.arc(i * 8.5, j2 * 8.5, v === 1 ? 5 : 3.6, 0, TAU); c.fill(); }
        c.restore();
      }
      if (!roll) { c.save(); c.globalAlpha = a > 1.1 ? (1.4 - a) / 0.3 : 1; c.font = '700 34px Jua, sans-serif'; c.textAlign = 'center'; this.outlined(c, String(d.d1 + d.d2), cx, cy - 46, '#ffffff', '#2b1426', 7); c.restore(); }
    }
    drawTop(dt) {
      const c = this.top;
      c.clearRect(0, 0, 720, 1280);
      // 날아가는 코인 → 금화 칸
      const im = this.I('i_coin');
      for (const k of this.coins) {
        const a = this.time - k.t0;
        if (a < 0.55) { k.vy += 900 * dt; k.x += k.vx * dt; k.y += k.vy * dt; if (k.y > k.gy && k.vy > 0) { k.y = k.gy; k.vy *= -0.45; k.vx *= 0.6; k.b++; } }
        else { if (!k.fly) k.fly = [k.x, k.y, this.time]; const q = Math.min(1, (this.time - k.fly[2]) / 0.45), e = q * q; k.x = k.fly[0] + (this.goldPos[0] - k.fly[0]) * e; k.y = k.fly[1] + (this.goldPos[1] - k.fly[1]) * e - Math.sin(q * Math.PI) * 60; if (q >= 1) { k.done = true; this.goldBump = this.time; } }
        if (im) { const sw = Math.abs(Math.cos(this.time * 10 + k.phase)) * 0.8 + 0.2, sz = 22; c.drawImage(im, k.x - sz * sw / 2, k.y - sz / 2, sz * sw, sz); }
      }
      this.coins = this.coins.filter(k => !k.done);
      // 떠오르는 글자는 코인보다 위에(판 흔들림과 함께)
      c.save(); if (this.shakeX) c.translate(this.shakeX, this.shakeY); this.drawTexts(c); c.restore();
      // 큰 글씨
      if (!this._bannerLater) this.drawBanner(c);
    }
    drawBanner(c) {
      const b = this.bigText;
      if (b) {
        const p = (this.time - b.t0) / b.dur;
        if (p >= 1) this.bigText = null;
        else {
          const s = p < 0.12 ? 0.6 + p / 0.12 * 0.5 - (p > 0.08 ? (p - 0.08) * 2.5 : 0) : 1;
          c.save(); c.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1; c.translate(360, 330); c.scale(s, s);
          c.fillStyle = 'rgba(20,12,30,0.55)'; c.fillRect(-380, -34, 760, 68);
          c.font = '700 40px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          this.outlined(c, b.s, 0, 2, b.col, '#2b1426', 9);
          c.restore();
        }
      }
    }
  }
  Renderer.TSZ = TSZ;
  root.Renderer = Renderer;
})(window);
