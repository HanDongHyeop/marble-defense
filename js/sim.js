// 게임 규칙(화면과 분리) — 브라우저와 Node 둘 다에서 돈다. 고정 시간 간격 step(1/60).
// 화면 쪽은 game.events 를 꺼내 이펙트 · 소리를 낸다.
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./data.js') : root.DATA;
  const G = isNode ? require('./geom.js') : root.GEOM;
  const META = isNode ? require('./meta.js') : root.META;
  const { LANDFX, FX_OF, TOWERS, DECK, TIER, MONSTERS, BOSSES, TRAITS, MAP1, CORNER, UPGRADE_COST, COMMANDERS, CARDS, CARD_ODDS, CARD_PITY, KEYS, MISSIONS, ECON } = D;

  function rng(seed) {
    let a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const wrapD = (f, i) => { let d = ((f - i) % 24 + 24) % 24; if (d > 12) d -= 24; return d; };
  const ZONE_TILES = [[1, 2, 3, 4, 5], [7, 8, 9, 10, 11], [13, 14, 15, 16, 17], [19, 20, 21, 22, 23]];
  const MUZZLE_Y = [0, 28, 37, 45, 52, 56, 62];   // [v4.2] 포탑 그림 크기가 단계별로 달라짐(1단계 70% → 4단계 100%)

  class Game {
    constructor(opt = {}) {
      this.opt = opt;
      this.r = rng(opt.seed || 1);
      this.mode = opt.mode || 'conquest';
      this.deck = (opt.deck || DECK).slice();
      this.cmdId = opt.commander || 'gambler';
      this.pawnId = opt.pawn || 'car';
      this.t = 0;
      this.events = [];
      this.over = null;                // 'win' | 'lose'
      this.paused = false;
      this.ids = 1;
      this.chapter = Math.max(1, Math.min(6, opt.chapter || 1)); this.CH = META.CHAPTERS[this.chapter - 1];
      this.meta = opt.meta || META.bonus({ nodes: {} });
      this.tiles = G.tiles.map(g => ({ i: g.i, corner: !!CORNER[g.i], cornerKind: CORNER[g.i] || null, zone: g.zone, trait: this.CH.map[g.i] || null, tower: null, warn: null, occ: null, stopUntil: 0 }));
      this.monsters = []; this.shots = []; this.footprints = []; this.mines = [];
      this.gold = ECON.startGold + this.meta.startGold; this.rollCost = ECON.rollBase; this.rolls = 0; this.freeRolls = this.meta.freeRolls;
      this.round = 0; this.roundT = 0; this.spawnQ = []; this.spawnEvery = 1; this.spawnT = 0;
      this.boss = null; this.bossT = 0; this.finalT = null;
      this.pawn = { tile: 0, path: [], hopT: 0, hopDur: ECON.hop, moving: false, landMul: 1, diceUntil: 0, next: null };
      this.autoTier = !!opt.autoTier;
      this.rollQ = []; this.lockUntil = 0; this.doubles = 0;
      this.offer = null; this.pick = null; this.combo = 0; this.comboMax = 0;
      this.goldenDice = 0; this.shield = 0; this.cards = []; this.cardPick = null; this.cardPicks = 0;
      this.pity = Object.assign({ e: 0, l: 0 }, opt.pity || {});   // [v5.4] 높은 등급 보정(판을 넘어 이어짐 — 화면 쪽이 저장)
      this.upg = {}; this.deck.forEach(k => (this.upg[k] = 0));
      this.cmd = { id: this.cmdId, readyAt: 10, until: 0 };
      this.truck = { calls: 0, readyAt: 0 };
      this.mission = null; this.missionsDone = 0;
      this.lfx = {}; this.minesUntil = 0; this.cheerUntil = 0;
      this.focusType = null; this.comboStack = (this.meta.sp && this.meta.sp.combo && this.meta.sp.combo.includes('combo0') ? 3 : 0) + (this.meta.fork && this.meta.fork.comboStart ? 2 : 0); this.beaconUntil = 0; this.awakenType = null; this.timers = [];
      this.stats = { kills: 0, rolls: 0, merges: 0, tierUps: 0, strikes: 0, legends: 0, thudKills: 0, maxWeight: 0, dmg: {}, built: 0, salary: 0 };
      this.deck.forEach(k => (this.stats.dmg[k] = 0));
      this.lastRollT = 0;
      this.weight = 0;
      this.diff = D.DIFF[opt.diff] ? opt.diff : 'normal';
      const DF = D.DIFF[this.diff];
      this.limit = (DF.limit || ECON.limit) + this.meta.life;
      if (DF.badLand) { const flat = this.tiles.filter(t => !t.corner && !t.trait); for (let n = 0; n < DF.badLand && flat.length; n++) flat.splice(this.rand(flat.length), 1)[0].trait = this.pickOne(['fog', 'web', 'target']); }
      if (opt.coop) this.coopInit(opt.coop === 'human');
      this.startCardPick();
    }
    emit(ev, o) { this.events.push(Object.assign({}, o || {}, { ev, t: this.t }, this._cardFx && ev !== 'cardFx' ? { card: this._cardFx.id } : null)); }
    rand(n) { return Math.floor(this.r() * n); }
    pickOne(a) { return a[this.rand(a.length)]; }
    hpR(r) { return ECON.hp(Math.max(1, r || this.round)) * (D.DIFF[this.diff] ? D.DIFF[this.diff].hp : 1) * (this.CH ? this.CH.hp : 1); }
    has(card) { return this.cards.includes(card); }

    // ------------------------------------------------------------ 판 상태
    towersList() { return this.tiles.filter(t => t.tower); }
    zoneFull(z) {
      const need = this.has('fort4') ? 4 : 5;
      return ZONE_TILES[z].filter(i => this.tiles[i].tower).length >= need;
    }
    countType(type) { return this.tiles.filter(t => t.tower && t.tower.type === type).length; }
    towerPos(i) { const p = G.tiles[i].tower; return [p[0], p[1]]; }
    muzzle(i) { const tw = this.tiles[i].tower; const p = G.tiles[i].tower, s = G.tiles[i].scale; return [p[0], p[1] - MUZZLE_Y[tw ? tw.tier : 1] * s]; }

    // ------------------------------------------------------------ 라운드 · 몬스터
    startRound() {
      this.round++;
      this.roundT = 0;
      const r = this.round, n = ECON.count(r);
      const q = [];
      for (let k = 0; k < n; k++) {
        const x = this.r();
        let kind = 'normal';
        if (r >= 9 && x < 0.10) kind = 'splitter';
        else if (r >= 8 && x < 0.22) kind = 'barrier';
        else if (r >= 6 && x < 0.34) kind = 'armor';
        else if (r >= 3 && x < 0.54) kind = 'fast';
        if (r >= 12 && this.deck.includes('beacon') && this.r() < 0.1) kind = 'stealth';
        const bias = this.CH.bias; for (const bk in bias) if (kind === 'normal' && r >= 3 && this.r() < 0.12 * (bias[bk] - 1)) kind = bk;
        q.push(kind);
      }
      if (r >= 7 && r % 3 === 1) { q.splice(this.rand(q.length), 0, 'giant'); if (r >= 16) q.splice(this.rand(q.length), 0, 'giant'); }
      if (r >= 11) q.splice(this.rand(q.length), 0, 'elite');
      if (r >= 11 && this.CH.elite2) q.splice(this.rand(q.length), 0, 'elite');
      // 금고: 라운드마다 이자
      if (this.meta.vault && r > 1) { const it = Math.min(Math.floor(this.gold * 0.02), r * 3); if (it > 0) { this.gold += it; this.emit('gold', { amt: it, why: '금고' }); } }
      // [v5.7] 비축금(랜다2 전술): 가진 금화의 6% · 최대 라운드×3 (10% · ×4는 승률 88% — 희귀에서 가장 셈)
      if (this.has('interest') && r > 1) { const it = Math.min(Math.floor(this.gold * 0.06), r * 3); if (it > 0) { this.gold += it; this.emit('gold', { amt: it, why: '비축금' }); } }
      // [v5.6] 보스 라운드는 보스 혼자(랜다2처럼) — 일반 몬스터 · 거인 · 엘리트를 부르지 않는다. 사용자(2026-11-10): '일반 몹이 있는 상태에서 보스가 나와 눈에 안 띈다'
      if (r % 5 === 0) q.length = 0;
      this.spawnQ = q; this.spawnEvery = ECON.spawnTime / Math.max(1, q.length); this.spawnT = 0;
      if (r % 5 === 0) this.spawnBoss();
      this.emit('round', { round: r, boss: r % 5 === 0 });
      if ([3, 7, 12, 17].includes(r) && !this.mission) this.startMission();
    }
    spawnMonster(kind, f, w, extra) {
      const M = MONSTERS[kind];
      const hp = this.hpR() * M.hp * (extra && extra.hpMul || 1);
      const m = Object.assign({ id: this.ids++, kind, hp, maxHp: hp, baseHp: hp, f: f || 0, dist: 0, w: w == null ? (this.r() * 1.5 - 0.75) : w, spd: M.spd, weight: M.w,
        alive: true, stunUntil: 0, slowUntil: 0, slowMul: 1, burn: null, hitT: -9, laps: 0, x: 0, y: 0, g: 1, born: this.t, resist: M.resist || null }, extra || {});
      this.monsters.push(m);
      this.posOf(m);
      return m;
    }
    spawnBoss() {
      const r = this.round;
      let kind;
      const dis = ['destroyer', 'ghost', 'witch', 'quake', 'swindler', 'magician'];
      if (r >= 20 && this.mode === 'conquest') kind = this.pickOne(['destroyer', 'ghost', 'quake']);
      else kind = this.r() < 0.18 ? this.pickOne(['piggy', 'goblin']) : this.pickOne(dis);
      const hpMul = ECON.bossHp * (r >= 20 ? 1.1 : 1) * (this.has('weakspot') ? 0.75 : 1);   // [v5.7] 약점 파악
      const m = this.spawnMonster('normal', 0, 0, { boss: kind, hpMul, weight: kind === 'goblin' ? 0 : ECON.bossW, spd: (kind === 'goblin' ? 1.5 : 0.6) * ECON.bossSpd, abT: 6, born: this.t, cardOnKill: !(r >= 20 && this.mode === 'conquest'), w: 0 });
      m.kind = 'boss';
      this.boss = m; this.bossT = 0;
      if (r >= 20 && this.mode === 'conquest') this.finalT = 0;
      this.emit('boss', { boss: kind, name: BOSSES[kind].name });
    }
    posOf(m) { const p = G.lanePoint(m.f, m.w * 0.8); m.px = m.x; m.x = p[0]; m.y = p[1]; m.g = p[2]; }
    monSpeed(m) {
      if (this.t < m.stunUntil) return 0;
      let s = ECON.monSpeed * m.spd;
      if (this.t < m.slowUntil) s *= m.slowMul;
      const near = Math.round(((m.f % 24) + 24) % 24) % 24;
      const tile = this.tiles[near];
      if (tile.trait === 'choke' && Math.abs(wrapD(m.f, near)) < 0.6) s *= 0.8;
      if (tile.zone >= 0 && this.zoneFull(tile.zone)) s *= 0.8;
      for (const fp of this.footprints) if (Math.abs(wrapD(m.f, fp.i)) < 0.6) { s *= 0.7; break; }
      if (this.fxOn('rush')) s *= 1 + LANDFX.rush.v;
      if (this.fxOn('slow')) s *= 1 - LANDFX.slow.v;
      if (m.boss && this.bossT > ECON.enrage && BOSSES[m.boss].kind === 'disrupt') s *= 2;
      return this.monSpeedX(m, s);
    }
    damage(m, amt, dtype, src, opts) {
      if (!m.alive) return 0;
      if (m.resist && m.resist[dtype]) amt *= m.resist[dtype];
      let crit = false;
      if (src && src.critChance && this.r() < src.critChance) { amt *= src.critMul; crit = true; }
      m.hp -= amt; m.hitT = this.t;
      if (src && src.type) this.stats.dmg[src.type] = (this.stats.dmg[src.type] || 0) + amt;
      if (!(opts && opts.quiet)) this.emit('dmg', { x: m.x, y: m.y - 20 * m.g, amt, crit, big: opts && opts.big });
      if (m.hp <= 0) this.kill(m, src);
      return amt;
    }
    kill(m, src) {
      m.alive = false;
      const r = this.round;
      let g = 0;
      if (m.kind === 'truck') { g = r * 8; this.emit('truckKill', { x: m.x, y: m.y }); }
      else if (m.boss) { g = Math.round(ECON.count(r) * ECON.kill(r) * ECON.bossGold); }   // [v5.6] 보스 라운드엔 일반 몬스터가 없으니 그 라운드 처치 금화를 보스가 대신 준다(전: 라운드×5)
      else g = Math.round(ECON.kill(r) * (MONSTERS[m.kind].gold || 1)) + (src && src.tile != null && this.tiles[src.tile].trait === 'gold' ? 1 : 0);
      if (src && src.thud) this.stats.thudKills++;
      this.gold += g; this.stats.kills++;
      this.emit('kill', { x: m.x, y: m.y, g: m.g, gold: g, kind: m.kind, boss: m.boss || null, big: m.weight >= 3 || !!m.boss });
      if (m.kind === 'splitter') for (let k = 0; k < 2; k++) this.spawnMonster('mini', m.f - k * 0.15, m.w + (k ? 0.4 : -0.4), { hpMul: 1 });
      // 점령 풀림
      for (const t of this.tiles) if (t.occ && t.occ.mon === m.id) { t.occ = null; this.emit('free', { i: t.i }); }
      if (m.boss) this.bossDown(m);
    }
    bossDown(m) {
      const k = m.boss;
      this.boss = null;
      if (this.roundT > ECON.roundTime - 2) this.roundT = ECON.roundTime - 2;   // [v5.6] 보스를 잡으면 2초 숨 돌린 뒤 다음 라운드
      this.emit('bossDown', { boss: k });
      if (this.round >= 20 && this.mode === 'conquest' && k !== 'goblin' && k !== 'piggy') { this.win(); return; }
      const picks = k === 'goblin' ? 2 : 1;
      if (m.cardOnKill) this.startCardPick(picks);
    }
    win() {
      if (this.over) return;
      for (const m of this.monsters) if (m.alive) { m.alive = false; this.emit('poof', { x: m.x, y: m.y }); }
      this.over = 'win'; this.emit('over', { result: 'win' });
    }
    lose(reason) { if (this.over) return; this.over = 'lose'; this.loseReason = reason; this.emit('over', { result: 'lose', reason }); }

    // ------------------------------------------------------------ 포탑 수치
    dmgMul(i) {
      const t = this.tiles[i], tw = t.tower, T = TOWERS[tw.type];
      let m = T.atk * (1 + D.ECON.upgStep * (this.upg[tw.type] || 0));
      if (t.trait === 'arms') m *= 1.3;
      if (t.zone >= 0 && this.zoneFull(t.zone)) m *= this.has('fortx2') ? 2.25 : 1.5;
      if (this.has('sharp') && tw.tier <= 3) m *= 1.25;
      if (this.focusType === tw.type) m *= 1.4;
      if (this.has('lonely') && this.towersList().length <= 12) m *= 1.6;
      if (this.has('deal')) m *= 1.5; if (this.has('awaken') && (this.awakenTypes || []).includes(tw.type)) m *= 1.5;   // [v5.6] 각성 맛보기 두 종류 피해 +30% → [v5.7] +50%(보통 48판 58% — 영웅 평균 63%보다 낮았음)
      if (tw.type === 'tyrant' && this.countType('tyrant') === 1) m *= 2;
      return m;
    }
    lightBuff(i) {
      // 이웃(같은 변, ±1칸) 성광탑의 공속 버프. 5단계 이상 성광은 같은 구역 전체
      const z = this.tiles[i].zone; let b = 0, crit = 0;
      if (z < 0) return [0, 0];
      for (const j of ZONE_TILES[z]) {
        if (j === i) continue;
        const o = this.tiles[j].tower;
        if (!o || o.type !== 'light' || this.disabled(j)) continue;
        if (Math.abs(j - i) === 1 || o.tier >= 5) { b += o.tier * 0.03 * (o.tier >= 4 ? 1.5 : 1); if (o.tier >= 6) crit = 0.1; }
      }
      return [b, crit];
    }
    apsOf(i) {
      const t = this.tiles[i], tw = t.tower, T = TOWERS[tw.type];
      let add = this.meta.aps[META.FAM_OF[tw.type]] || 0;
      if (t.trait === 'drill') add += 0.25;
      add += this.lightBuff(i)[0];
      if (this.t < this.cheerUntil) add += 0.3;
      if (this.cmd.id === 'cheer' && t.zone >= 0 && this.zoneFull(t.zone)) add += 0.1;
      if (this.t < (tw.carUntil || 0)) add += 0.4;   // [v4.0 조정: 빨간 말 +20 → +40% — 3번 측정 모두 말 6종 중 가장 낮음]
      let a = T.aps * TIER.aps[tw.tier] * (1 + add);
      if (t.trait === 'web') a *= 0.8;
      if (this.fxOn('aps')) a *= 1 + LANDFX.aps.v;
      if (this.has('haste')) a *= 1.3;   // [v5.4] 질풍(v5.6: 1.2 → 1.3)
      if (tw.rushUntil && this.t < tw.rushUntil) a *= 1.5;   // [v5.6] 출동 대장
      if (this.fxOn('apsDown')) a *= 1 - LANDFX.apsDown.v;
      if (this.t < (tw.blessUntil || 0)) a *= 2;
      if (this.t < (tw.barrageUntil || 0)) a *= 3;
      if (tw.type === 'gatling') a *= tw.accel || 1;
      return Math.min(10, a);
    }
    rangeOf(i) { const tr = this.tiles[i].trait; return 2 + (tr === 'watch' ? 1 : 0) - (tr === 'fog' ? 1 : 0) + (this.tiles[i].tower.type === 'bolt' && this.tiles[i].tower.tier >= 6 ? 1 : 0); }
    srcOf(i) {
      const t = this.tiles[i], tw = t.tower;
      let cc = 0.05 + (t.trait === 'watch' ? 0.1 : 0) + (this.has('critEye') ? 0.1 : 0) + this.lightBuff(i)[1];
      return { type: tw.type, tile: i, critChance: cc, critMul: 1.5 + (this.has('critEye') ? 0.3 : 0) };
    }
    disabled(i) { const t = this.tiles[i]; return !t.tower || this.t < t.stopUntil || !!t.occ; }
    inRange(i, range) {
      const out = [];
      for (const m of this.monsters) if (m.alive && m.kind !== 'ghostly' && Math.abs(wrapD(m.f, i)) <= range + 0.5) out.push(m);
      return out;
    }
    front(list) { let best = null, bf = -1; for (const m of list) { const f = ((m.f % 24) + 24) % 24; if (f > bf) { bf = f; best = m; } } return best; }
    near(m, rad, excl) { return this.monsters.filter(o => o.alive && o !== m && !(excl && excl.has(o)) && Math.abs(wrapD(o.f, m.f)) <= rad); }

    // ------------------------------------------------------------ 포탑 공격
    updateTowers(dt) {
      const tyrantSolo = this.countType('tyrant') === 1;
      for (const t of this.tiles) {
        const tw = t.tower; if (!tw) continue;
        if (this.disabled(t.i)) continue;
        if (this.t < (tw.spawnLock || 0)) continue;
        // 수호상 · 전설의 주기 공격
        if (tw.tier >= 5) { tw.special = (tw.special || 0) - dt; if (tw.special <= 0) { if (this.special(t.i)) tw.special = this.specialPeriod(tw.type); else tw.special = 0.5; } }
        if (tw.type === 'tyrant' && tyrantSolo) {
          tw.dread = (tw.dread || 10) - dt;
          if (tw.dread <= 0) { tw.dread = 10; this.dread(t.i, 1); }
        }
        tw.cd -= dt * this.apsOf(t.i);
        if (tw.cd > 0) continue;
        const list = this.inRange(t.i, this.rangeOf(t.i), tw.type);
        const m = this.front(list);
        if (!m) { tw.cd = 0; tw.accel = 1; tw.lastTarget = null; continue; }
        tw.cd += 1;
        if (tw.type === 'gatling') {
          const max = [0, 1.5, 2, 2.5, 3, 3, 3][tw.tier] + (this.sp('gatling', 'accel') ? 0.5 : 0);
          tw.accel = tw.lastTarget === m.id || this.awakened('gatling') ? Math.min(max, (tw.accel || 1) + 0.12) : 1;
          tw.lastTarget = m.id;
        }
        this.attack(t.i, m, list);
      }
    }
    attack(i, m, list) {
      const tw = this.tiles[i].tower, tier = tw.tier, mul = this.dmgMul(i), src = this.srcOf(i);
      const [mx, my] = this.muzzle(i);
      tw.fireT = this.t; tw.aimX = m.x;
      const per = mul * TIER.dmg[tier];
      const n = TIER.shots[tier];
      this.emit('fire', { i, type: tw.type, tier, x: mx, y: my, tx: m.x, ty: m.y });
      switch (tw.type) {
        case 'fire':
          if (tier <= 3) for (let k = 0; k < n; k++) this.shot('fireball', i, m, per, 330, k * 0.08, { splash: tier >= 2 ? 0.5 : 0.25, splashMul: tier >= 2 ? 0.5 : 0.25, burn: per * 0.12 });
          else {
            const hit = list.filter(o => Math.abs(wrapD(o.f, m.f)) <= 0.8);
            this.emit('flame', { i, x: mx, y: my, tx: m.x, ty: m.y, tier });
            for (const o of hit) { this.damage(o, per * (o === m ? 1 : 0.7), 'elem', src); this.burn(o, per * 0.12); }
          }
          break;
        case 'gatling': {
          // 1~3단계: 총열(단계 수) × 3점사, 4단계부터: 8발 연속(3점사 몫 × 단계 배수)
          const bullets = tier <= 3 ? 3 * n : 8;
          for (let k = 0; k < bullets; k++) this.shot('bullet', i, m, tier <= 3 ? per : per * 3 / 8, 950, k * (tier <= 3 ? 0.055 : 0.035), { spread: tier <= 3 ? (k % n) - (n - 1) / 2 : 0 });
          break;
        }
        case 'bolt':
          if (tier <= 3) for (let k = 0; k < n; k++) this.shot('zap', i, m, per, 760, k * 0.07, { chain: tier });
          else this.thunder(i, m, per, tier + 2, src);
          break;
        case 'light':
          if (tier <= 3) for (let k = 0; k < n; k++) this.shot('orb', i, m, per, 420, k * 0.09, { pierce: tier >= 3 });
          else {
            this.emit('beam', { i, x: mx, y: my, tx: m.x, ty: m.y - 14 * m.g, tier });
            this.damage(m, per, 'holy', src);
            const o = this.near(m, 0.9)[0]; if (o) { this.damage(o, per * 0.5, 'holy', src); this.emit('beam', { i, x: m.x, y: m.y - 14 * m.g, tx: o.x, ty: o.y - 14 * o.g, tier, sub: 1 }); }
          }
          break;
        case 'tyrant':
          if (tier <= 3) for (let k = 0; k < n; k++) this.shot('spike', i, m, per, 620, k * 0.08, { stun: tier >= 3 ? 0.3 : 0 });
          else {
            const hit = this.near(m, 0.8).concat([m]);
            this.emit('whip', { i, x: mx, y: my, tx: m.x, ty: m.y, tier });
            for (const o of hit) { this.damage(o, per * (o === m ? 1 : 0.6), 'abyss', src); o.stunUntil = Math.max(o.stunUntil, this.t + 0.2); }
          }
          break;
      }
    }
    shot(kind, i, m, dmg, speed, delay, extra) {
      const [x, y] = this.muzzle(i);
      this.shots.push(Object.assign({ id: this.ids++, kind, i, type: this.tiles[i].tower.type, tier: this.tiles[i].tower.tier, x, y, sx: x, sy: y, m, tx: m.x, ty: m.y, dmg, speed, delay, src: this.srcOf(i), age: 0 }, extra || {}));
    }
    burn(m, dps) { if (!m.alive) return; m.burn = { dps: Math.max(dps, m.burn && this.t < m.burn.until ? m.burn.dps : 0), until: this.t + 3 + (this.meta.fork && this.meta.fork.burnLong ? 1 : 0), src: null }; }
    thunder(i, m, per, chains, src) {
      const hit = new Set([m]); const pts = [[m.x, m.y - 16 * m.g]];
      this.emit('thunder', { x: m.x, y: m.y, tier: this.tiles[i].tower.tier });
      if (m.frz > 0) { chains += 3; m.frz = 0; this.emit('react', { x: m.x, y: m.y - 30 * m.g, kind: 'superc', name: D.REACT.superc }); }
      this.damage(m, per, 'arc', src);
      let cur = m, d = per;
      for (let k = 0; k < chains; k++) {
        const nx = this.near(cur, 1.8, hit).sort((a, b) => Math.abs(wrapD(a.f, cur.f)) - Math.abs(wrapD(b.f, cur.f)))[0];
        if (!nx) break;
        hit.add(nx); d *= 0.8; pts.push([nx.x, nx.y - 16 * nx.g]);
        this.damage(nx, d, 'arc', src);
        if (this.awakened('bolt') && this.r() < 0.5) nx.stunUntil = this.t + 0.6;
        cur = nx;
      }
      if (pts.length > 1) this.emit('chain', { pts });
    }
    updateShots(dt) {
      for (const s of this.shots) {
        if (s.delay > 0) { s.delay -= dt; continue; }
        s.age += dt;
        if (s.m.alive) { s.tx = s.m.x; s.ty = s.m.y - 14 * s.m.g; }
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), v = s.speed * dt;
        if (d <= v || s.age > 2) { s.done = true; this.impact(s); continue; }
        s.x += dx / d * v; s.y += dy / d * v;
      }
      this.shots = this.shots.filter(s => !s.done);
    }
    impact(s) {
      const m = s.m, dtype = TOWERS[s.type].dmgType;
      this.emit('impact', { kind: s.kind, x: s.tx, y: s.ty, tier: s.tier, type: s.type });
      if (s.kind === 'fireball') {
        if (m.alive) { this.damage(m, s.dmg, dtype, s.src); this.burn(m, s.burn); }
        for (const o of this.monsters) if (o.alive && o !== m && Math.abs(wrapD(o.f, m.f)) <= s.splash) { this.damage(o, s.dmg * s.splashMul, dtype, s.src, { quiet: true }); this.burn(o, s.burn * 0.5); }
        return;
      }
      if (!m.alive) return;
      this.damage(m, s.dmg, dtype, s.src);
      if (s.kind === 'zap' && s.chain) {
        const hit = new Set([m]); let cur = m, d = s.dmg; const pts = [[m.x, m.y - 14 * m.g]];
        for (let k = 0; k < s.chain; k++) {
          const nx = this.near(cur, 1.5, hit).sort((a, b) => Math.abs(wrapD(a.f, cur.f)) - Math.abs(wrapD(b.f, cur.f)))[0];
          if (!nx) break; hit.add(nx); d *= 0.7; pts.push([nx.x, nx.y - 14 * nx.g]); this.damage(nx, d, dtype, s.src); cur = nx;
        }
        if (pts.length > 1) this.emit('chain', { pts, small: 1 });
      }
      if (s.kind === 'orb' && s.pierce) { const o = this.near(m, 0.7)[0]; if (o) this.damage(o, s.dmg * 0.6, dtype, s.src); }
      if (s.kind === 'spike' && s.stun) m.stunUntil = Math.max(m.stunUntil, this.t + s.stun);
    }
    special(i) {
      // 5단계 수호상 강공격 · 6단계 전설 공격
      const tw = this.tiles[i].tower, list = this.inRange(i, this.rangeOf(i) + 1), m = this.front(list);
      if (!m) return false;
      const per = this.dmgMul(i) * TIER.vol[tw.tier], src = this.srcOf(i), [mx, my] = this.muzzle(i);
      this.emit('special', { i, type: tw.type, tier: tw.tier, x: mx, y: my, tx: m.x, ty: m.y });
      switch (tw.type) {
        case 'fire':
          if (tw.tier >= 6) { for (const o of list) { this.damage(o, per * 1.5, 'elem', src); this.burn(o, per * 0.2); } this.emit('breath', { i, x: mx, y: my, tx: m.x, ty: m.y }); }
          else { this.emit('boom', { x: m.x, y: m.y, r: 1.4 }); for (const o of this.near(m, 1.0).concat([m])) this.damage(o, per * 2.5, 'elem', src); }
          break;
        case 'gatling': {
          const tg = list.slice(0, tw.tier >= 6 ? 20 : 6);
          for (const o of tg) for (let k = 0; k < 3; k++) this.shot('bullet', i, o, per * 0.6, 1000, k * 0.05, { spread: 0 });
          break;
        }
        case 'bolt': {
          const tg = (tw.tier >= 6 ? list : list.slice().sort(() => this.r() - 0.5).slice(0, 4));
          for (const o of tg) this.thunder(i, o, per * 1.2, tw.tier >= 6 ? 2 : 0, src);
          break;
        }
        case 'light':
          this.emit('halo', { i, tier: tw.tier });
          for (const o of list.slice(0, 4)) { this.damage(o, per * 1.5, 'holy', src); this.emit('beam', { i, x: mx, y: my, tx: o.x, ty: o.y - 14 * o.g, tier: tw.tier }); }
          break;
        case 'tyrant':
          this.dread(i, 2.5);
          break;
      }
      return true;
    }
    dread(i, mul) {
      const tw = this.tiles[i].tower; if (!tw) return;
      const per = this.dmgMul(i) * TIER.vol[tw.tier] * mul * 0.5, src = this.srcOf(i);
      this.emit('dread', { i });
      for (const m of this.monsters) if (m.alive) this.damage(m, per, 'abyss', src, { quiet: true });
    }

    // ------------------------------------------------------------ 출동(착지)
    strike(i, mul) {
      const tw = this.tiles[i].tower; if (!tw) return;
      let k = ECON.strikeMul * mul * (1 + 0.1 * this.combo);
      if (this.tiles[i].trait === 'holy') k *= 2;
      if (this.pawnId === 'dog') k *= 1.35;
      if (this.has('strikex2')) k *= 3;
      const per = this.dmgMul(i) * TIER.dmg[tw.tier] * Math.max(1, TIER.shots[tw.tier]) * k, src = this.srcOf(i);
      this.stats.strikes++;
      const z = this.tiles[i].zone;
      this.emit('strike', { i, type: tw.type, tier: tw.tier, combo: this.combo });
      switch (tw.type) {
        case 'fire': {
          // 구역 앞 길 전체: 그 구역 칸 번호 범위의 몬스터
          const lo = z * 6 + 0.5, hi = z * 6 + 5.5;
          const hit = this.monsters.filter(m => m.alive && (((m.f % 24) + 24) % 24) >= lo - 0.5 && (((m.f % 24) + 24) % 24) <= hi + 0.5);
          this.emit('firewall', { zone: z });
          for (const m of hit) { this.damage(m, per, 'elem', src, { big: true }); this.burn(m, per * 0.1); }
          break;
        }
        case 'gatling': tw.barrageUntil = this.t + 5; { const m = this.front(this.inRange(i, this.rangeOf(i))); if (m) for (let q = 0; q < 10; q++) this.shot('bullet', i, m, per / 10, 1000, q * 0.04, { spread: (q % 3) - 1 }); } break;
        case 'bolt': {
          const tg = this.monsters.filter(m => m.alive).sort((a, b) => (((b.f % 24) + 24) % 24) - (((a.f % 24) + 24) % 24)).slice(0, tw.tier * 3);
          for (const m of tg) { this.emit('thunder', { x: m.x, y: m.y, tier: 4 }); this.damage(m, per, 'arc', src, { big: true }); }
          break;
        }
        case 'light': {
          const zs = z >= 0 ? ZONE_TILES[z] : [i];
          for (const j of zs) if (this.tiles[j].tower) this.tiles[j].tower.blessUntil = this.t + 10;
          this.emit('bless', { zone: z });
          const m = this.front(this.inRange(i, this.rangeOf(i))); if (m) { this.damage(m, per, 'holy', src, { big: true }); this.emit('beam', { i, x: this.muzzle(i)[0], y: this.muzzle(i)[1], tx: m.x, ty: m.y - 14 * m.g, tier: 6 }); }
          break;
        }
        case 'tyrant':
          this.emit('dread', { i, big: 1 });
          for (const m of this.monsters) if (m.alive) this.damage(m, per * 0.5, 'abyss', src, { big: true });
          break;
      }
    }

    // ------------------------------------------------------------ 굴리기 · 말
    rollAffordable() { return this.gold >= this.rollCost || this.freeRolls > 0 || !this.tiles.some(t => t.tower && t.tower.owner !== 2); }
    canRoll() { return !this.over && !this.paused && this.t >= this.lockUntil && !this.pick; }
    roll(aim) {
      if (this.over || this.cardPick) return false;
      // [v4.1] 구조 굴림: 금화가 굴리기 값보다 적고 판에 내 포탑이 하나도 없으면 수입이 생길 길이 없다(처치 · 월급 모두 막힘) → 무료로 굴린다
      const rescue = this.gold < this.rollCost && !(this.freeRolls > 0) && !this.tiles.some(t => t.tower && t.tower.owner !== 2);
      if (this.gold < this.rollCost && !(this.freeRolls > 0) && !rescue) { this.emit('nogold'); return false; }
      // [v4.0] 미리 굴려 둘 수 있는 건 1번까지(줄이 길면 착지 결정 · 단계업 기회가 밀려 사라짐)
      if (this.rollQ.length >= ECON.rollQMax) return false;
      if (rescue) this.emit('rescueRoll', {}); else if (this.freeRolls > 0) this.freeRolls--; else { this.gold -= this.rollCost; this.emit('spend', { amt: this.rollCost, why: 'roll' }); }
      const mid = this.has('midas') && (this.midasN = (this.midasN || 0) + 1) % 2 !== 0;   // [v5.6] 미다스의 손 = 세 번에 한 번만 오름(전: 안 오름) → [v5.7] 두 번에 한 번(보통 ×1.45에서도 48판 100% — 판이 끝남)
      if (!mid) this.rollCost += this.has('quickhand') ? Math.max(1, ECON.rollStep - 1) : ECON.rollStep;
      this.rolls++; this.stats.rolls++; this.lastRollT = this.t;
      this.rollQ.push(this.throwDice(aim));
      this.emit('rollBtn', { aim: aim || 0 });
      return true;
    }
    throwDice(aim) {
      // 주사위 조절(모두의 마블 게이지): 노린 합(2~12)이 있으면 ctrl 확률로 합 = 노린 수 ±1 안에서 나온다. 실패하면 보통 굴림
      let d1 = 1 + this.rand(6), d2 = 1 + this.rand(6), ctrl = false;
      if (aim >= 2 && aim <= 12 && this.r() < ECON.ctrl + (this.meta.ctrl || 0)) {
        const ok = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (Math.abs(a + b - aim) <= 1) ok.push([a, b]);
        [d1, d2] = ok[this.rand(ok.length)]; ctrl = true;
      }
      return { d1, d2, aim: aim || 0, ctrl };
    }
    startMove(steps, mul, kind) {
      const p = this.pawn; p.path = []; for (let k = 1; k <= steps; k++) p.path.push((p.tile + k) % 24);
      p.moving = true; p.hopT = 0; p.landMul = mul || 1; p.moveKind = kind || 'roll';
      p.fast = steps > 14; p.hopDur = this.hopDurOf(p);
      this.emit('move', { steps, kind: p.moveKind });
    }
    hopDurOf(p) { return p.fast ? 0.07 : p.path.length === 1 ? ECON.hopLast : p.path.length === 2 ? 0.16 : ECON.hop; }
    updatePawn(dt) {
      const p = this.pawn;
      if (!p.moving) {
        // 주사위가 구르는 동안(연출 0.75초) 기다렸다가 출발
        if (p.next) { if (this.t >= p.diceUntil) { const n = p.next; p.next = null; this.startMove(n.steps, n.mul); } return; }
        // 단계업을 고르는 동안은 다음 굴림이 기다린다(모두의 마블: 내 땅 = 건설 결정). 못 사는 제안은 막지 않는다
        if (this.offer && this.offer.block && this.t <= this.offer.until) return;
        if (this.rollQ.length && this.t >= this.lockUntil && !this.pick && !this.paused) {
          const rr = this.rollQ.shift();
          const dbl = rr.d1 === rr.d2;
          if (dbl) this.doubles++; else this.doubles = 0;
          this.emit('dice', { d1: rr.d1, d2: rr.d2, dbl, free: !!rr.free, ctrl: !!rr.ctrl, aim: rr.aim || 0, triple: dbl && this.doubles >= 3 });
          if (dbl && this.doubles >= 3) { this.doubles = 0; this.lockUntil = this.t + ECON.diceT; this.later(ECON.diceT, () => this.goIsland()); return; }
          if (dbl) {
            this.rollQ.unshift(Object.assign(this.throwDice(0), { free: true }));
            if (this.cmd.id === 'gambler') { this.gold += this.round * 2; this.emit('gold', { amt: this.round * 2, why: '도박사' }); }
          }
          p.next = { steps: rr.d1 + rr.d2, mul: dbl ? 2 : 1 }; p.diceUntil = this.t + ECON.diceT;
        }
        return;
      }
      p.hopT += dt;
      if (p.hopT >= p.hopDur) {
        p.hopT -= p.hopDur;
        p.tile = p.path.shift();
        if (p.path.length) p.hopDur = this.hopDurOf(p);
        const last = p.path.length === 0;
        this.emit('hop', { i: p.tile, last });
        if (!last) this.pass(p.tile);
        else { p.moving = false; this.lockUntil = Math.max(this.lockUntil, this.t + ECON.landBeat); this.land(p.tile, p.landMul, p.moveKind); }
      }
    }
    salaryAmt() { let s = ECON.salary(this.round || 1); if (this.pawnId === 'hat') s *= 1.1; if (this.has('salary')) s *= 2; s *= 1 + this.meta.salary; return Math.round(s); }
    pass(i) {
      const t = this.tiles[i];
      if (i === 0) { const s = this.salaryAmt(); this.gold += s; this.stats.salary += s; this.emit('salary', { amt: s }); }
      if (this.pawnId === 'car' && t.tower) t.tower.carUntil = this.t + 3;   // [v4.0 조정: 2초 → 3초]
      if (this.pawnId === 'boot') this.footprints.push({ i, until: this.t + 2 });
      if (this.t < this.minesUntil) this.mines.push({ f: i, until: this.t + 20 });
      if (this.pawn.moveKind === 'world') this.thud(i, 1);
    }
    goIsland() {
      if (this.shield > 0) { this.shield--; this.emit('shield'); return; }
      this.pawn.tile = 6; this.pawn.moving = false; this.pawn.path = []; this.rollQ = [];
      this.lockUntil = this.t + (this.CH.island || 3);
      this.emit('island', {});
      for (const m of this.monsters) if (m.alive && Math.abs(wrapD(m.f, 6)) < 1.2) m.stunUntil = this.t + 2;
    }
    thud(i, mul) {
      let rad = 0.6, k = ECON.thud * mul;
      if (this.pawnId === 'boat') { rad = 1.6; k *= 1.5; }
      if (this.cmd.id === 'demolish') k *= 1.3;
      const hit = this.monsters.filter(m => m.alive && Math.abs(wrapD(m.f, i)) <= rad);
      if (!hit.length) return 0;
      const d = this.hpR() * k;
      const p = G.lanePoint(i, 0);
      this.emit('thud', { i, x: p[0], y: p[1] });
      for (const m of hit) { this.damage(m, d, 'none', { thud: 1 }, { big: true }); m.stunUntil = Math.max(m.stunUntil, this.t + 1); }
      return hit.length;
    }
    land(i, mul, kind) {
      const t = this.tiles[i];
      if (kind === 'space' && this.spaceSecond && !t.corner) { this.spaceSecond = false; this.later(0.4, () => { if (!this.pick && !this.over) { this.pick = { kind: 'space', tiles: [...Array(24).keys()].filter(j => j !== i), until: this.t + 12 }; this.emit('pick', { kind: 'space', second: 1 }); } }); }
      this.emit('land', { i });
      // 구조 · 탈환
      if (t.warn) { t.warn = null; this.emit('rescue', { i }); }
      if (t.occ) { const g = Math.round(t.occ.ransom); this.gold += g; this.emit('reclaim', { i, gold: g }); t.occ = null; }
      if (kind !== 'world') this.thud(i, mul);
      if (t.corner) { this.corner(i, mul); return; }
      if (t.trait) this.landTrait(i);
      if (t.trait === 'gold') { const g = this.round; this.gold += g; this.emit('gold', { amt: g, why: '금맥', i }); }
      if (!t.tower) {
        let tier = mul >= 2 ? 2 : 1;
        if (tier === 1 && this.pawnId === 'cat' && this.r() < 0.15) tier = 2;
        if (tier === 1 && this.cmd.id === 'mechanic' && this.r() < 0.1) tier = 2;
        this.build(i, this.buildPick(), tier);
        if (this.combo > 0) this.emit('comboBreak', { n: this.combo });
        this.combo = 0;
        return;
      }
      // 내 포탑: 출동 + 단계업
      this.combo = Math.min(10, this.combo + 1); this.comboMax = Math.max(this.comboMax, this.combo);
      this.emit('combo', { n: this.combo });
      const tw = t.tower;
      for (let k = 0; k < mul; k++) this.strike(i, tw.tier >= 5 ? 2 : 1);
      if (tw.tier >= 5) {
        this.jackpotGold(i);   // [조정: ×8 → ×1.5 — 판이 큰 포탑으로 차면 굴릴 때마다 8배가 되돌아와 금화가 무한히 불어남]
      } else {
        const cost = this.tierCost(tw.tier);
        this.offer = { i, cost, until: this.t + ECON.offerT, tier: tw.tier, block: this.gold >= cost, t0: this.t };
        this.stats.offers = (this.stats.offers || 0) + 1;
        this.emit('offer', { i, cost, can: this.offer.block });
        if (this.autoTier && this.offer.block) this.acceptOffer();
      }
    }
    // [v4.7] 땅 기운: 좋은 · 나쁜 땅에 멈추면 판 전체 n초 효과(data LANDFX). 나쁜 기운은 방패 부적이 막는다
    fxOn(k) { return this.t < (this.lfx[k] || 0); }
    fxLeft(k) { return Math.max(0, (this.lfx[k] || 0) - this.t); }
    landTrait(i) {
      const tr = this.tiles[i].trait;
      if (tr === 'luck') { const good = Object.keys(LANDFX).filter(k => LANDFX[k].good); this.addLandFx(this.pickOne(good), 0, i, 'luck'); return; }
      if (FX_OF[tr]) this.addLandFx(FX_OF[tr], 0, i, 'land');
    }
    addLandFx(k, dur, i, from) {
      const F = LANDFX[k]; dur = dur || F.dur;
      if (!F.good && this.shield > 0) { this.shield--; this.emit('shield', { i }); return false; }
      const refresh = this.fxOn(k);
      this.lfx[k] = Math.max(this.lfx[k] || 0, this.t + dur);
      this.stats.landFx = (this.stats.landFx || 0) + 1;
      this.emit('landFx', { k, i, dur, good: F.good, refresh, from: from || 'land' });
      return true;
    }
    jackpotGold(i) { const g = Math.round(this.rollCost * 1.5); this.gold += g; this.emit('jackpot', { i, gold: g }); }   // [조정: ×8 → ×1.5]
    skipOffer() { if (!this.offer) return false; this.offer = null; this.emit('offerGone', { skip: 1 }); return true; }
    setAutoTier(on) { this.autoTier = !!on; return true; }
    tierCost(tier) {
      // [v4.0 조정] 굴리기 값 × 2 × 2^(단계−1) → 굴리기 값 × TIERUP[단계]. 예전 값은 착지 순간 94%가 '돈 부족'이라 단계업이 사실상 없었다(밸런스 측정)
      let c = this.rollCost * ECON.tierUp[tier];
      if (this.cmd.id === 'architect') c *= 0.9;   // [v4.0 조정: −15 → −10%, 건축가 84%]
      if (this.has('tierdisc')) c *= 0.75;
      return Math.round(c);
    }
    acceptOffer() {
      const o = this.offer; if (!o || this.t > o.until) return false;
      const tw = this.tiles[o.i].tower; if (!tw || tw.tier !== o.tier || tw.tier >= 5) { this.offer = null; return false; }
      if (this.gold < o.cost) { this.emit('nogold'); return false; }
      this.gold -= o.cost; this.offer = null; this.emit('spend', { amt: o.cost, why: 'tierup', i: o.i });
      let up = 1;
      if (this.tiles[o.i].trait === 'luck' && this.r() < 0.2 && tw.tier + 2 <= 5) up = 2;
      this.setTier(o.i, tw.tier + up, 'tierup', up > 1);
      this.stats.tierUps++;
      return true;
    }
    buildPick() {
      // 조커(프리즘)는 반 확률로만 나온다 [조정: 합치기 만능이라 너무 셈]
      const w = this.deck.map(d => d === 'prism' ? (this.sp('prism', 'prismWeight') ? 0.55 : 0.35) : 1), sum = w.reduce((a, b) => a + b, 0);
      let x = this.r() * sum;
      for (let k = 0; k < this.deck.length; k++) { x -= w[k]; if (x <= 0) return this.deck[k]; }
      return this.deck[this.deck.length - 1];
    }
    build(i, type, tier) {
      if (tier === 1 && this.meta.rules.includes('abyss') && META.FAM_OF[type] === 'abyss' && this.r() < 0.05) tier = 2;
      this.tiles[i].tower = { id: this.ids++, type, tier, cd: 0.5, accel: 1, spawnLock: this.t + 0.45, born: this.t };
      this.stats.built++;
      this.emit('build', { i, type, tier });
      if (tier >= 6) this.stats.legends++;
    }
    setTier(i, tier, why, lucky) {
      const tw = this.tiles[i].tower;
      tw.tier = tier; tw.special = 1.5; tw.spawnLock = this.t + 0.4; tw.upT = this.t;
      if (tier >= 6) this.stats.legends++;
      this.emit(why, { i, tier, type: tw.type, lucky: !!lucky });
    }
    // [v4.2 디버그 — 나중에 없앰] 포탑 단계를 바로 바꾼다(정보 팝업의 1성~6성 단추)
    debugTier(i, tier) {
      const t = this.tiles[i]; if (!t || !t.tower || !(tier >= 1 && tier <= 6) || t.tower.tier === tier) return false;
      this.setTier(i, tier, 'tierup'); return true;
    }
    canMerge(a, b) {
      if (a === b) return false;
      const A = this.tiles[a].tower, B = this.tiles[b].tower;
      return !!(A && B && A.type === B.type && A.tier === B.tier && A.tier < 6 && !this.tiles[a].occ && !this.tiles[b].occ);
    }
    merge(a, b) {
      if (!this.canMerge(a, b) || this.over) return false;
      const B = this.tiles[b].tower;
      let tier = B.tier + 1;
      const lucky = this.tiles[b].trait === 'luck' && tier < 6 && this.r() < 0.2;
      if (lucky) tier++;
      this.tiles[a].tower = null;
      if (this.tiles[a].warn) this.tiles[a].warn = null;
      if (this.tiles[b].warn) this.tiles[b].warn = null;
      this.stats.merges++;
      this.emit('mergeFrom', { a, b, type: B.type, tier: B.tier });
      this.setTier(b, tier, 'merge', lucky);
      if (this.offer && (this.offer.i === a || this.offer.i === b)) this.offer = null;
      return true;
    }
    corner(i, mul) {
      const k = this.tiles[i].cornerKind;
      if (k === 'start') { const s = this.salaryAmt() * 2; this.gold += s; this.stats.salary += s; this.emit('salary', { amt: s, land: 1 }); }
      else if (k === 'island') this.goIsland();
      else if (k === 'key') this.drawKey();
      else if (k === 'space') { this.pick = { kind: 'space', tiles: [...Array(24).keys()].filter(j => j !== i), until: this.t + 12 }; this.emit('pick', { kind: 'space' }); this.spaceSecond = this.cmd.id === 'teleporter'; }
    }
    choose(j) {
      // 우주여행 · 황금 주사위로 칸 고르기
      const p = this.pick; if (!p || !p.tiles.includes(j)) return false;
      this.pick = null;
      if (p.kind === 'swap') {
        const A = this.tiles[p.from], B = this.tiles[j];
        const tmp = A.tower; A.tower = B.tower; B.tower = tmp;
        this.cmd.readyAt = this.t + COMMANDERS.teleporter.cd;
        this.emit('swap', { a: p.from, b: j }); this.emit('commander', { id: 'teleporter', i: j });
        return true;
      }
      const steps = ((j - this.pawn.tile) % 24 + 24) % 24 || 24;
      this.emit('chosen', { i: j, kind: p.kind });
      this.startMove(steps, 1, p.kind === 'space' ? 'space' : 'gold');
      return true;
    }
    useGoldenDice() {
      if (this.goldenDice <= 0 || this.pawn.moving || this.pick || this.over) return false;
      this.goldenDice--;
      const tiles = []; for (let k = 2; k <= 12; k++) tiles.push((this.pawn.tile + k) % 24);
      this.pick = { kind: 'gold', tiles, until: Infinity };
      this.emit('pick', { kind: 'gold' });
      return true;
    }
    cancelPick() { if (this.pick && this.pick.kind === 'gold') { this.goldenDice++; this.pick = null; } }

    // ------------------------------------------------------------ 황금열쇠
    drawKey() {
      const ids = Object.keys(KEYS);
      const good = ids.filter(k => KEYS[k].good), bad = ids.filter(k => !KEYS[k].good);
      let id = this.r() < 1 - (this.CH.badKey || 0.3) ? this.pickOne(good) : this.pickOne(bad);
      this.emit('key', { id, name: KEYS[id].name, good: KEYS[id].good, desc: KEYS[id].desc });
      if (!KEYS[id].good && this.shield > 0) { this.shield--; this.emit('shield'); return; }
      const r = this.round || 1;
      switch (id) {
        case 'space': this.pick = { kind: 'space', tiles: [...Array(24).keys()].filter(j => j !== 12), until: this.t + 12 }; this.emit('pick', { kind: 'space' }); break;
        case 'world': this.startMove(24, 1, 'world'); break;
        case 'order': {
          const best = this.towersList().sort((a, b) => b.tower.tier - a.tower.tier)[0];
          if (best) { const steps = ((best.i - this.pawn.tile) % 24 + 24) % 24 || 24; this.startMove(steps, 1, 'order'); }
          break;
        }
        case 'back': { const j = (this.pawn.tile + 22) % 24; this.pawn.tile = j; this.emit('hop', { i: j, last: true }); this.land(j, 2, 'back'); break; }
        case 'medal': { const k = this.pickOne(this.deck.filter(d => this.upg[d] < 10)); if (k) { this.upg[k]++; this.emit('upgrade', { type: k, lv: this.upg[k], free: 1 }); } break; }
        case 'supply': { const g = Math.max(20, r * 2); this.gold += g; this.emit('gold', { amt: g, why: '보급 상자' }); break; }
        case 'shield': this.shield++; break;
        case 'gdice': this.goldenDice = Math.min(3, this.goldenDice + 1); break;
        case 'mines': this.minesUntil = this.t + 20; break;
        case 'island': this.goIsland(); break;
        case 'demol': { const b = this.towersList().filter(t => t.tower.tier < 6).sort((a, c) => c.tower.tier - a.tower.tier)[0]; if (b) { b.warn = { until: this.t + 15 }; this.emit('warn', { i: b.i }); } break; }
        case 'broken': {
          const cnt = {}; for (const t of this.towersList()) cnt[t.tower.type] = (cnt[t.tower.type] || 0) + 1;
          const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
          for (const t of this.towersList()) if (t.tower.type === top) { t.stopUntil = this.t + 4; this.emit('stop', { i: t.i }); }
          break;
        }
        case 'rampage': this.addLandFx('rush', 10, null, 'key'); break;
      }
    }

    // ------------------------------------------------------------ 작전 카드
    startCardPick(picks) {
      if (this.cardPicks >= 5) return;
      const r = this.round;
      // [v4.2] 판 시작(라운드 0) = 시작 카드 풀(st 1 · 2), 중간 = 시작 전용(st 2) 빼고 전부
      const start = r === 0;
      let w = CARD_ODDS[0][1]; for (const [r0, o] of CARD_ODDS) if ((start ? 0 : Math.max(1, r)) >= r0) w = o;
      w = Object.assign({}, w);
      const PE = CARD_PITY.e, PL = CARD_PITY.l, pity = this.pity;
      w.e += Math.max(0, pity.e - PE.from + 1) * PE.step; w.l += Math.max(0, pity.l - PL.from + 1) * PL.step;
      const pool = Object.keys(CARDS).filter(k => !this.cards.includes(k) && (start ? CARDS[k].st : CARDS[k].st !== 2));
      const opts = [], rank = { c: 0, r: 1, e: 2, l: 3 };
      const sureL = pity.l + 1 >= PL.sure, sureE = pity.e + 1 >= PE.sure;
      for (let n = 0; n < 3 && pool.length; n++) {
        let g;
        if (n === 0 && sureL) g = 'l';
        else if (n === 0 && sureE) g = 'e';
        else { const tot = w.c + w.r + w.e + w.l, x = this.r() * tot; g = x < w.l ? 'l' : x < w.l + w.e ? 'e' : x < w.l + w.e + w.r ? 'r' : 'c'; }
        let cand = pool.filter(k => CARDS[k].g === g && !opts.includes(k));
        // 그 등급이 다 떨어졌으면 한 단계씩 낮춰서
        for (let gg = rank[g] - 1; !cand.length && gg >= 0; gg--) cand = pool.filter(k => rank[CARDS[k].g] === gg && !opts.includes(k));
        if (!cand.length) cand = pool.filter(k => !opts.includes(k));
        if (!cand.length) break;
        opts.push(this.pickOne(cand));
      }
      const best = Math.max(...opts.map(k => rank[CARDS[k].g]));
      pity.e = best >= 2 ? 0 : pity.e + 1; pity.l = best >= 3 ? 0 : pity.l + 1;
      this.emit('pity', { e: pity.e, l: pity.l });
      this.cardPick = { opts, left: picks || 1, rerolls: 0 };
      this.paused = true;
      this.emit('cardPick', {});
    }
    rerollCards() {
      const cp = this.cardPick; if (!cp) return false;
      const cost = cp.rerolls === 0 ? 0 : 15 * cp.rerolls;   // [v4.6 금화 단위 1/8: 100 → 15]
      // [v4.1] 다시 뽑기로 굴리기 값까지 써 버리면 판이 멈춘다(시작 금화 100 − 두 번째 뽑기 100 = 0) → 굴리기 값은 남겨 둔다
      if (cost > 0 && this.gold - cost < this.rollCost) { this.emit('nogold'); return false; }
      this.gold -= cost; if (cost > 0) this.emit('spend', { amt: cost, why: 'reroll' }); const n = cp.rerolls + 1, left = cp.left;
      this.startCardPick(left); this.cardPick.rerolls = n;
      return true;
    }
    pickCard(k) {
      const cp = this.cardPick; if (!cp || k < 0 || k >= cp.opts.length) return false;
      const id = cp.opts[k];
      this.cards.push(id); this.cardPicks++;
      this.emit('card', { id, name: CARDS[id].name });
      this.applyCard(id);
      cp.left--;
      if (cp.left > 0) { this.startCardPick(cp.left); return true; }
      this.cardPick = null; this.paused = false;
      if (this.round === 0) this.startRound();
      return true;
    }
    // [v5.7] 카드 효과 — 판을 바꾸는 카드는 무엇이 어떻게 바뀌었는지 steps로 모아 'cardFx' 한 번에 알림(화면이 칸마다 차례로 보여 줌 · render13)
    //   사용자(2026-11-10): '블록판 3개가 좋아진다를 골라도 어떤 블록이 어떻게 좋아지는지, 어디에 이펙트 · 포커싱이 가는지 모르겠다 — 딜레이가 있어도 된다'
    //   그 사이 나온 tierup · build · reclaim2 사건엔 card: id가 붙어 옛 층이 따로 그리지 않는다
    applyCard(id) {
      const fx = this._cardFx = { id, steps: [], types: null };
      const r = Math.max(1, this.round);
      const tierUp = ts => { for (const t of ts) { const from = t.tower.tier; this.setTier(t.i, from + 1, 'tierup'); fx.steps.push({ i: t.i, kind: 'tier', from, to: from + 1, type: t.tower.type }); } };
      if (id === 'bighand') { const g = Math.max(20, r * 3); this.gold += g; this.emit('gold', { amt: g, why: '큰손' }); }
      if (id === 'wall') this.limit += 8;
      if (id === 'deal') this.limit -= 10;
      if (id === 'focus') { this.focusType = this.pickOne(this.deck); fx.types = [this.focusType]; }
      if (id === 'awaken') { const pool = this.deck.filter(d => d !== 'prism'), a = this.pickOne(pool), b = this.pickOne(pool.filter(d => d !== a)) || a; this.awakenType = a; this.awakenTypes = [a, b]; fx.types = [a, b]; }
      if (id === 'lift') tierUp(this.towersList().filter(t => t.tower.tier < 5).sort((a, b) => a.tower.tier - b.tower.tier).slice(0, 3));
      if (id === 'lucky7') { const ts = this.towersList().filter(t => t.tower.tier < 5); for (let n = ts.length - 1; n > 0; n--) { const j = this.rand(n + 1); [ts[n], ts[j]] = [ts[j], ts[n]]; } tierUp(ts.slice(0, 7)); }
      if (id === 'vote') {
        const cnt = {}; for (const t of this.towersList()) if (t.tower.type !== 'prism') cnt[t.tower.type] = (cnt[t.tower.type] || 0) + 1;
        const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
        if (top) { fx.types = [top]; tierUp(this.towersList().filter(t => t.tower.type === top && t.tower.tier < 5)); }
      }
      if (id === 'jokerhat') for (const t of this.towersList().filter(t => t.tower.type !== 'prism' && t.tower.tier < 6).sort((a, b) => a.tower.tier - b.tower.tier).slice(0, 3)) { const from = t.tower.type, ft = t.tower.tier; t.tower.type = 'prism'; if (ft < 5) this.setTier(t.i, ft + 1, 'tierup'); fx.steps.push({ i: t.i, kind: 'prism', from, to: 'prism', tier: t.tower.tier, fromTier: ft }); }   // 같은 단계 프리즘만으론 승률 38%(카드 없음 62%보다 낮음) → +1단계
      if (id === 'seed') { const empty = this.tiles.filter(t => !t.corner && !t.tower); for (let n = 0; n < 2 && empty.length; n++) { const i = empty.splice(this.rand(empty.length), 1)[0].i, ty = this.buildPick(); this.build(i, ty, 1); fx.steps.push({ i, kind: 'build', type: ty, to: 1 }); } }
      if (id === 'freeroll') this.freeRolls = (this.freeRolls || 0) + 5;
      if (id === 'gdice2') { this.goldenDice = Math.min(3, this.goldenDice + 2); this.gold += 30; this.emit('gold', { amt: 30, why: '황금 주사위 둘' }); }   // [v5.7] + 금화 30(희귀인데 44% — 일반 평균 53%보다 낮았음)
      if (id === 'reclaim') { const flat = this.tiles.filter(t => !t.corner && !t.trait); for (let n = 0; n < 3 && flat.length; n++) { const t = flat.splice(this.rand(flat.length), 1)[0]; t.trait = this.pickOne(['arms', 'drill', 'watch', 'holy', 'luck']); this.emit('reclaim2', { i: t.i }); fx.steps.push({ i: t.i, kind: 'trait', to: t.trait }); } }
      this._cardFx = null;
      this.emit('cardFx', fx);
      return fx;
    }
    // [v5.7] 기적의 돌: 몬스터가 한도의 80%에 닿으면(판에 두 번까지) — 보스 말고 모두 사라짐(금화 없음) + 모든 포탑 +1단계(5단계까지)
    miracle() {
      this.miracleUsed = (this.miracleUsed || 0) + 1; this.miracleT = this.t + 20;   // [v5.7] 두 번까지(한 번은 48판 65% — 영웅 평균 63%와 같았음) · 다음은 20초 뒤부터
      const fx = this._cardFx = { id: 'miracle', steps: [], types: null, trig: 1 };
      for (const m of this.monsters) if (m.alive && !m.boss && m.kind !== 'truck') { m.alive = false; this.emit('poof', { x: m.x, y: m.y }); }
      for (const t of this.towersList().filter(t => t.tower.tier < 5)) { const from = t.tower.tier; this.setTier(t.i, from + 1, 'tierup'); fx.steps.push({ i: t.i, kind: 'tier', from, to: from + 1, type: t.tower.type }); }
      this._cardFx = null;
      this.emit('cardFx', fx);
    }
    // [v5.7] 기다림 건너뛰기 — 사용자(2026-11-10): '몬스터를 빨리 잡으면 너무 기다린다. 이번 웨이브 몬스터(보스 포함)를 다 잡으면 켜지는 건너뛰기'
    //   켜지는 때 = 라운드 진행 중 · 나올 몬스터가 다 나왔고 · 살아 있는 몬스터(보스 포함, 수송차 빼고)가 없음
    canSkip() {
      if (this.round < 1 || this.over || this.paused || this.cardPick) return false;
      if (this.mode === 'conquest' && this.round >= ECON.rounds) return false;
      if (this.spawnQ.length) return false;
      return !this.monsters.some(m => m.alive && m.kind !== 'truck');
    }
    skipWait() {
      if (!this.canSkip()) return false;
      const left = Math.max(0, ECON.roundTime - this.roundT);
      this.emit('skip', { left });
      this.startRound();
      return true;
    }

    // ------------------------------------------------------------ 강화 · 지휘관 · 수송차
    upgradeCost(type) { const lv = this.upg[type]; if (lv >= 10) return Infinity; let c = UPGRADE_COST[lv]; if (this.meta.rules.includes('mech') && META.FAM_OF[type] === 'mech') c = Math.round(c * 0.88); if (this.meta.fork && this.meta.fork.upgCheap && META.FAM_OF[type] === 'mech') c = Math.round(c * 0.9); return c; }
    upgrade(type) {
      const c = this.upgradeCost(type);
      if (this.gold < c) { this.emit('nogold'); return false; }
      this.gold -= c; this.upg[type]++; this.emit('spend', { amt: c, why: 'upg', type });
      if (this.meta.rules.includes('holy') && META.FAM_OF[type] === 'holy' && this.r() < 0.05) { const o = this.pickOne(this.deck.filter(d => d !== type && this.upg[d] < 10)); if (o) { this.upg[o]++; this.emit('upgrade', { type: o, lv: this.upg[o], free: 1 }); } }
      this.emit('upgrade', { type, lv: this.upg[type] });
      return true;
    }
    cmdReady() { return this.t >= this.cmd.readyAt && !this.over; }
    useCommander(i) {
      if (!this.cmdReady()) return false;
      const C = COMMANDERS[this.cmd.id];
      if (C.mode === 'tap') {
        if (this.cmd.id === 'gambler') { if (this.goldenDice >= 3) return false; this.goldenDice++; }
        if (this.cmd.id === 'cheer') this.cheerUntil = this.t + 10;
      } else {
        const t = this.tiles[i]; if (i == null || !t || !t.tower) return false;
        if (this.cmd.id === 'architect') { if (t.tower.tier >= 4) return false; this.setTier(i, t.tower.tier + 1, 'tierup'); }
        if (this.cmd.id === 'demolish') {
          const g = t.tower.tier * 8; this.gold += g; t.tower = null;
          this.emit('demolish', { i, gold: g });
          const z = t.zone, lo = z * 6 + 0.5, hi = z * 6 + 5.5;
          for (const m of this.monsters) if (m.alive) { const f = ((m.f % 24) + 24) % 24; if (f >= lo - 0.5 && f <= hi + 0.5) this.damage(m, this.hpR() * 1.2, 'none', null, { big: true }); }
        }
        if (this.cmd.id === 'teleporter') {
          this.pick = { kind: 'swap', from: i, tiles: this.tiles.filter(x => !x.corner && x.i !== i && !x.occ).map(x => x.i), until: this.t + 10 };
          this.emit('pick', { kind: 'swap' });
          return true;
        }
        if (this.cmd.id === 'mechanic') {
          // [v4.0] 같은 단계 · 판에 가장 많은(같은 단계 짝이 생기는) 종류로 바꿈. 짝이 없으면 판에서 가장 많은 종류
          const tier = t.tower.tier, me = t.tower.type; if (tier >= 6) return false;
          const cnt = {}; for (const o of this.towersList()) if (o.i !== i && o.tower.type !== me && o.tower.type !== 'prism') cnt[o.tower.type] = (cnt[o.tower.type] || 0) + (o.tower.tier === tier ? 100 : 1);
          const to = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; if (!to) return false;
          t.tower = null; this.build(i, to, tier);
        }
      }
      this.cmd.readyAt = this.t + Math.max(10, C.cd - this.meta.cdCut);
      this.emit('commander', { id: this.cmd.id, i });
      return true;
    }
    truckReady() { return this.t >= this.truck.readyAt && this.round > 0 && !this.over && !this.boss && !this.monsters.some(m => m.alive && m.kind === 'truck'); }   // [v5.6] 보스전엔 수송차 안 부름(보스만 보이게)
    callTruck() {
      if (!this.truckReady()) return false;
      const hpMul = 8 * Math.pow(1.5, this.truck.calls);
      this.truck.calls++; this.truck.readyAt = this.t + 30;
      this.spawnMonster('truck', 0, 0, { hpMul: hpMul / MONSTERS.truck.hp, weight: 0 });
      this.emit('truck', {});
      return true;
    }

    // ------------------------------------------------------------ 미션
    startMission() {
      const ids = Object.keys(MISSIONS).filter(k => !this.missionDone(k, true));
      const id = this.pickOne(ids.length ? ids : Object.keys(MISSIONS));
      this.mission = { id, until: this.t + 60, start: this.t, thud0: this.stats.thudKills, elite0: this.stats.eliteKills || 0, combo: 0, roll0: this.lastRollT, done: false };
      this.emit('mission', { id, name: MISSIONS[id].name });
    }
    missionDone(id, probe) {
      const T = this.towersList();
      switch (id) {
        case 'noT1': return T.length >= 3 && !T.some(t => t.tower.tier === 1);
        case 'fort': return [0, 1, 2, 3].some(z => this.zoneFull(z));
        case 'combo5': return probe ? this.combo >= 5 : (this.mission.combo >= 5);
        case 't4x2': return T.filter(t => t.tower.tier >= 4).length >= 2;
        case 'good4': return this.tiles.filter(t => t.tower && t.trait && TRAITS[t.trait].good).length >= 4;
        case 'thud10': return probe ? false : this.stats.thudKills - this.mission.thud0 >= 10;
        case 'gold3000': return this.gold >= 400;   // [v4.6 금화 단위 1/8] 이름(키)은 저장 호환 때문에 그대로
        case 'noroll': return probe ? false : this.t - Math.max(this.lastRollT, this.mission.start) >= 30;
        case 'nbr3': return [0, 1, 2, 3].some(z => { const ts = ZONE_TILES[z].map(i => this.tiles[i].tower); for (let k = 0; k + 2 < 5; k++) if (ts[k] && ts[k + 1] && ts[k + 2] && ts[k].type === ts[k + 1].type && ts[k].type === ts[k + 2].type) return true; return false; });
        case 'elite': return probe ? false : (this.stats.eliteKills || 0) - this.mission.elite0 >= 1;
      }
      return false;
    }
    missionProgress() {
      const ms = this.mission; if (!ms) return null;
      const T = this.towersList();
      switch (ms.id) {
        case 'noT1': return [T.filter(t => t.tower.tier > 1).length, T.length];
        case 'fort': return [Math.max(...[0, 1, 2, 3].map(z => ZONE_TILES[z].filter(i => this.tiles[i].tower).length)), this.has('fort4') ? 4 : 5];
        case 'combo5': return [Math.min(5, ms.combo), 5];
        case 't4x2': return [Math.min(2, T.filter(t => t.tower.tier >= 4).length), 2];
        case 'good4': return [Math.min(4, this.tiles.filter(t => t.tower && t.trait && TRAITS[t.trait].good).length), 4];
        case 'thud10': return [Math.min(10, this.stats.thudKills - ms.thud0), 10];
        case 'gold3000': return [Math.min(3000, Math.floor(this.gold)), 3000];
        case 'noroll': return [Math.min(30, Math.floor(this.t - Math.max(this.lastRollT, ms.start))), 30];
        case 'nbr3': return [this.missionDone('nbr3') ? 1 : 0, 1];
        case 'elite': return [Math.min(1, (this.stats.eliteKills || 0) - ms.elite0), 1];
      }
    }
    updateMission() {
      const ms = this.mission; if (!ms) return;
      ms.combo = Math.max(ms.combo, this.combo);
      if (this.missionDone(ms.id)) {
        this.goldenDice = Math.min(3, this.goldenDice + 1);
        const g = this.round * 4; this.gold += g; this.missionsDone++;
        this.emit('missionOk', { id: ms.id, gold: g });
        this.mission = null;
      } else if (this.t > ms.until) { this.emit('missionFail', { id: ms.id }); this.mission = null; }
    }

    // ------------------------------------------------------------ 보스
    updateBoss(dt) {
      const b = this.boss; if (!b || !b.alive) return;
      this.bossT += dt;
      if (this.finalT != null) { this.finalT += dt; if (this.finalT > ECON.finalLimit) { this.lose('time'); return; } }
      const k = b.boss, enr = this.bossT > ECON.enrage;
      if (k === 'piggy' && !b.paid && this.bossT >= 60) { b.paid = true; const g = Math.min(Math.floor(this.gold * 0.5), this.round * 40); this.gold += g; this.emit('piggy', { gold: g }); }
      if (k === 'goblin' && b.dist >= 24) { b.alive = false; this.boss = null; this.emit('escape', { x: b.x, y: b.y }); return; }
      if (BOSSES[k].kind !== 'disrupt') return;
      b.abT -= dt * (enr ? 2 : 1) * (D.DIFF[this.diff].fastBoss ? 1.5 : 1);
      // [v5.6] 예고: 스킬 1.2초 전에 보스가 기를 모은다(화면이 보스 쪽을 먼저 보여 주게 — 지침 3-6 예고 → 이동 → 변신 → 강조)
      if (!b.charged && b.abT <= 1.2) { b.charged = true; this.emit('bossCharge', { boss: k }); }
      if (b.abT > 0) return;
      b.charged = false;
      // [v5.6 A안] 대상은 무작위(전: 가장 높은 단계부터) — 표적지(나쁜 땅) 칸만 먼저
      const cand = this.towersList().filter(t => t.tower.tier < 6 && !t.warn).map(t => [t, this.r()]).sort((a, c) => a[1] - c[1]).map(x => x[0]);
      cand.sort((a, c) => (c.trait === 'target') - (a.trait === 'target'));
      b.abT = this.bossDisrupt(k, cand);
      this.emit('bossSkill', { boss: k });
    }
    updateWarnOcc(dt) {
      for (const t of this.tiles) {
        if (t.warn && this.t >= t.warn.until) {
          t.warn = null;
          if (t.tower) {
            if (t.tower.tier <= 1) { t.stopUntil = this.t + 6; this.emit('warnStop', { i: t.i }); }   // [v5.6 A안] 철거 없음 — 1단계는 6초 멈춤(랜다2엔 철거가 없다)
            else { t.tower.tier--; this.emit('downgrade', { i: t.i, tier: t.tower.tier }); }
          }
        }
        if (t.occ) {
          t.occ.ransom += this.round * 0.4 * dt;
          const mm = this.monsters.find(m => m.id === t.occ.mon);
          if (!mm || !mm.alive) t.occ = null;
        }
      }
    }

    // ------------------------------------------------------------ 메인 갱신
    step(dt) {
      if (this.over || this.paused) return;
      this.t += dt;
      // 라운드 진행
      if (this.round > 0) {
        this.roundT += dt;
        if (this.spawnQ.length) {
          this.spawnT -= dt;
          if (this.spawnT <= 0) { this.spawnT += this.spawnEvery; this.spawnMonster(this.spawnQ.shift(), 0); }
        }
        const last = this.mode === 'conquest' && this.round >= ECON.rounds;
        // [v5.6] 보스가 살아 있는 동안은 다음 라운드를 미룬다(보스 단독 · 최대 ECON.bossHold초 — 그 뒤엔 예전처럼 다음 라운드와 함께)
        const hold = this.boss && this.boss.alive && this.bossT < ECON.bossHold;
        if (!last && !hold && this.roundT >= ECON.roundTime) this.startRound();
      }
      // 몬스터 이동
      let weight = 0;
      for (const m of this.monsters) {
        if (!m.alive) continue;
        const v = this.monSpeed(m) * dt;
        const before = m.f;
        m.f += v; m.dist += v;
        if (m.f >= 24) {
          m.f -= 24; m.laps++;
          if (m.kind === 'truck') { m.alive = false; this.emit('truckGone', {}); continue; }
          if (!m.boss && m.hp > 0) { const cap = m.baseHp * 2; const nh = Math.min(cap, m.maxHp * (1 + (this.CH.monSalary || 0.1))); m.hp += nh - m.maxHp; m.maxHp = nh; this.emit('monSalary', { x: m.x, y: m.y }); }
        }
        // 지뢰
        if (this.mines.length) for (const mi of this.mines) if (!mi.used && wrapD(m.f, mi.f) >= 0 && wrapD(before, mi.f) < 0) { mi.used = true; this.emit('boom', { x: m.x, y: m.y, r: 0.9 }); this.damage(m, this.hpR() * 0.6, 'none', null, { big: true }); }
        // 점령(엘리트): 지나는 칸의 포탑 1개
        if (m.kind === 'elite' && !m.occTile && m.alive) {
          const i = Math.round(((m.f % 24) + 24) % 24) % 24, t = this.tiles[i];
          if (t.tower && t.tower.tier < 6 && !t.occ && Math.abs(wrapD(m.f, i)) < 0.2) {
            if (this.shield > 0) { this.shield--; this.emit('shield'); m.occTile = -1; }
            else { t.occ = { mon: m.id, ransom: 0 }; m.occTile = i; this.emit('occupy', { i }); }
          }
        }
        // 화상 · 중독 · 빙결 · 부식
        this.tickMon(m, dt);
        if (!m.alive) continue;
        this.posOf(m);
        if (m.kind !== 'truck' && !(m.boss === 'goblin')) weight += m.weight;
      }
      this.monsters = this.monsters.filter(m => m.alive);
      // 뭉침 풀기: 앞뒤 0.35칸 안에서 옆 간격이 좁으면 길 폭 안에서 벌린다
      if (this.monsters.length > 1 && !(typeof process !== 'undefined' && process.env && process.env.NOSEP)) {
        const ms = this.monsters.slice().sort((a, b) => a.f - b.f);
        for (let k = 1; k < ms.length; k++) {
          const a = ms[k - 1], b = ms[k];
          if (b.f - a.f < 0.45 && Math.abs(b.w - a.w) < 0.75 && !a.boss && !b.boss) {
            const push = 2.0 * dt * (b.w >= a.w ? 1 : -1);
            if (Math.abs(b.f - a.f) < 0.3 && Math.abs(b.w - a.w) < 0.45) a.f -= 0.35 * dt;   // 옆으로 못 비키면 뒤쪽이 잠깐 늦춘다
            b.w = Math.max(-0.95, Math.min(0.95, b.w + push)); a.w = Math.max(-0.95, Math.min(0.95, a.w - push));
          }
        }
      }
      this.mines = this.mines.filter(mi => !mi.used && this.t < mi.until);
      this.footprints = this.footprints.filter(fp => this.t < fp.until);
      this.weight = weight; this.stats.maxWeight = Math.max(this.stats.maxWeight, weight);
      if (this.has('miracle') && (this.miracleUsed || 0) < 2 && weight >= this.limit * 0.8 && !(this.t < (this.miracleT || 0))) { this.miracle(); weight = this.monsters.reduce((a, m) => a + (m.alive ? m.weight : 0), 0); this.weight = weight; }
      if (weight > this.limit) { this.lose('limit'); return; }
      this.updateBoss(dt);
      this.updatePassives(dt);
      this.updateTowers(dt);
      this.updateShots(dt);
      this.updatePawn(dt);
      this.updateWarnOcc(dt);
      this.updateMission();
      if (this.offer && this.t > this.offer.until) { this.offer = null; this.emit('offerGone'); }
      if (this.pick && this.t > this.pick.until) {
        // 우주여행을 고르지 않으면 제자리
        this.pick = null;
      }
      // 판 위 몬스터가 없고 마지막 라운드인데 보스가 이미 죽었으면 승리(무한 토벌 제외)
    }
    score() { return this.stats.kills + Math.floor(this.gold / 10) + this.stats.legends * 500; }
    stars() { if (this.over !== 'win') return 0; return 1 + (this.stats.maxWeight <= 30 ? 1 : 0) + (this.stats.legends >= 1 ? 1 : 0); }
  }

  (isNode ? require('./behave.js') : root.BEHAVE)(Game);
  (isNode ? require('./coop.js') : root.COOP)(Game);
  const SIM = { Game, wrapD, ZONE_TILES, rng };
  if (isNode) module.exports = SIM; else root.SIM = SIM;
})(typeof window !== 'undefined' ? window : globalThis);
