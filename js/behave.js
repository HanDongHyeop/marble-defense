// 포탑 16종 행동 · 상태이상 · 속성 반응 · 각성 — sim.js의 Game에 덧붙인다(브라우저 BEHAVE(Game) / Node require).
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./data.js') : root.DATA;
  const G = isNode ? require('./geom.js') : root.GEOM;
  const { TOWERS, TIER, MONSTERS, BOSSES, TRAITS, ECON } = D;
  const META = isNode ? require('./meta.js') : root.META;
  const wrapD = (f, i) => { let d = ((f - i) % 24 + 24) % 24; if (d > 12) d -= 24; return d; };
  const ZONE_TILES = [[1, 2, 3, 4, 5], [7, 8, 9, 10, 11], [13, 14, 15, 16, 17], [19, 20, 21, 22, 23]];
  const SPECIAL_T = { fire: 4, gatling: 3, bolt: 5, light: 6, tyrant: 7, ice: 5, poison: 4, railgun: 6, mining: 5, summon: 30, combo: 4, beacon: 5, growth: 6, corrode: 5, greed: 8, prism: 4 };
  SPECIAL_T.summon = 45;
  const fmod = f => ((f % 24) + 24) % 24;
  // [v4.5] 단계별 탄 속도 배수 · 한 번에 쏘는 탄 사이 간격(초) — 6단계는 0.05초 간격 6발('다다다'). 레일건은 저격이라 탄 수를 덜 늘림
  const SPD = [0, 1, 1.12, 1.25, 1.45, 1.65, 1.9], GAP = [0, 0, 0.09, 0.08, 0.07, 0.06, 0.05], RAILN = [0, 1, 1, 2, 2, 3, 4];
  const FIRE_K = new Set(['fireball', 'flame', 'flameslash', 'breath', 'meteor']);

  function install(Game) {
    const P = Game.prototype;
    const baseSpawn = P.spawnMonster;

    Object.assign(P, {
      // ---------------------------------------------------------- 몬스터 상태
      spawnMonster(kind, f, w, extra) {
        const m = baseSpawn.call(this, kind, f, w, extra);
        Object.assign(m, { frz: 0, frzT: 0, frozenUntil: 0, psn: 0, psnT: 0, psnDps: 0, psnAcc: 0, cor: 0, corT: 0, shockUntil: 0, revealUntil: 0, stealth: !!MONSTERS[kind].stealth, reactT: -9 });
        if (kind === 'goldmon') { const gm = this.towersList().some(t => t.tower.type === 'greed' && t.tower.tier >= 5); if (gm) { m.hp *= 0.5; m.maxHp *= 0.5; } if (this.sp('greed', 'gmHp')) { m.hp *= 0.7; m.maxHp *= 0.7; } if (this.awakened('greed')) m.weight = 0; }
        return m;
      },
      sp(type, key) { const a = this.meta.sp && this.meta.sp[type]; return !!(a && a.includes(key)); },
      fk(key) { return !!(this.meta.fork && this.meta.fork[key]); },
      awakened(type) {
        let has4 = false;
        const pre = this.has('awaken') && (this.awakenTypes || [this.awakenType]).includes(type), need = pre ? 3 : 4;   // [v5.6] 각성 맛보기: 두 종류 · 3단계부터(전: 한 종류 · 4단계)
        for (const t of this.tiles) if (t.tower && t.tower.type === type) { if (t.tower.tier >= 6) return true; if (t.tower.tier >= need) has4 = true; }
        return has4 && pre;
      },
      addFreeze(m, n) {
        if (!m.alive) return;
        m.frz = Math.min(5, m.frz + n); m.frzT = this.t + 3;
        if (m.frz >= 5) {
          m.frz = 0;
          if (m.boss && !this.awakened('ice')) { m.slowUntil = this.t + 1; m.slowMul = 0.5; }
          else { m.frozenUntil = this.t + 1 + (this.sp('ice', 'frzLong') ? 0.5 : 0); this.emit('frozen', { x: m.x, y: m.y, g: m.g, id: m.id }); }
        }
      },
      addPoison(m, n, dps, max, dur) {
        if (!m.alive) return;
        m.psn = Math.min(max || 3, m.psn + n); m.psnT = this.t + (dur || 3); m.psnDps = Math.max(m.psnDps, dps);
      },
      addCorrode(m, n, max) {
        if (!m.alive) return;
        const cap = this.awakened('corrode') ? 99 : (max || 2) + (this.sp('corrode', 'corMax') ? 2 : 0);
        m.cor = Math.min(cap, m.cor + n); m.corT = this.t + 4;
      },
      tickMon(m, dt) {
        const t = this.t;
        if (m.burn && t < m.burn.until) { m.burnAcc = (m.burnAcc || 0) + dt; if (m.burnAcc >= 0.5) { m.burnAcc -= 0.5; this.damage(m, m.burn.dps * 0.5 * (this.sp('fire', 'burn2') ? 2 : 1), 'elem', { type: 'fire', dot: 1 }, { quiet: true, noReact: true }); } }
        if (m.psn > 0) {
          if (t > m.psnT) { m.psn = 0; m.psnDps = 0; }
          else { m.psnAcc += dt; if (m.psnAcc >= 0.5) { m.psnAcc -= 0.5; this.damage(m, m.psn * m.psnDps * 0.5, 'elem', { type: 'poison', dot: 1 }, { quiet: true, noReact: true }); } }
        }
        if (m.frz > 0 && t > m.frzT) m.frz = 0;
        if (m.cor > 0 && t > m.corT) m.cor = 0;
      },
      monSpeedX(m, s) {
        if (this.t < m.frozenUntil) return 0;
        if (m.frz > 0) s *= 1 - 0.13 * m.frz;
        return s;
      },
      // 받는 피해: 속성 반응 → 저항 → 부식 → 치명
      damage(m, amt, dtype, src, opts) {
        if (!m.alive) return 0;
        opts = opts || {};
        const st = src && src.type;
        let react = null;
        const rk = this.has('elemental') ? 3 : 1;
        if (!opts.noReact && st) {
          if (m.frz > 0 && st === 'fire') { amt *= 3 * rk * (this.fk('thermal') ? 1.5 : 1); m.frz = 0; react = 'thermal'; }
          else if (m.psn > 0 && st === 'fire') {
            react = 'toxic';
            const boom = m.psn * this.hpR() * 0.025 * rk; m.psn = 0;
            for (const o of this.monsters) if (o.alive && o !== m && Math.abs(wrapD(o.f, m.f)) <= 0.9) this.damage(o, boom, 'elem', { type: 'poison' }, { quiet: true, noReact: true });
            amt += boom;
          }
        }
        let shatter = false;
        if (m.cor > 0 && dtype === 'mech' && !opts.noReact) { shatter = true; amt *= 1.4 * rk; if (!react) react = 'shatter'; }   // [v4.5 파쇄 1.6 → 1.4: 개틀링 연사와 곱해져 심연 덱이 가장 강했음]
        if (m.resist && m.resist[dtype] && !shatter) amt *= m.resist[dtype];
        if (m.cor > 0) amt *= 1 + 0.07 * m.cor;   // [v4.5 0.08 → 0.07: 심연 덱이 가장 강했음]
        if (st === 'fire' && m.burn && this.t < m.burn.until && !(src && src.dot)) amt *= 1.2;
        if (src && src.eliteX && m.weight >= 3) amt *= 3;
        if (this.fxOn('armDown')) amt *= 1 + D.LANDFX.armDown.v;   // [v4.7 땅 기운: 몬스터 방어력]
        if (this.fxOn('armUp')) amt *= 1 - D.LANDFX.armUp.v;
        let crit = false;
        if (src && src.critChance && this.r() < src.critChance) { amt *= src.critMul; crit = true; }
        m.hp -= amt; m.hitT = this.t;
        if (st) this.stats.dmg[st] = (this.stats.dmg[st] || 0) + amt;
        if (react && this.t - m.reactT > 0.6) { m.reactT = this.t; this.stats.reacts = (this.stats.reacts || 0) + 1; this.emit('react', { x: m.x, y: m.y - 30 * m.g, kind: react, name: D.REACT[react] }); }
        if (!opts.quiet) this.emit('dmg', { x: m.x, y: m.y - 20 * m.g, amt, crit, big: opts.big || !!react, maxHp: m.maxHp });
        if (m.hp <= 0) this.kill(m, src);
        return amt;
      },
      kill(m, src) {
        if (!m.alive) return;
        m.alive = false;
        const r = this.round || 1;
        let g = 0;
        if (m.kind === 'truck') { g = r * 8; this.emit('truckKill', { x: m.x, y: m.y }); this.stats.eliteKills = (this.stats.eliteKills || 0) + 1; }
        else if (m.kind === 'goldmon') g = Math.round(r * 2 * (this.sp('greed', 'gmGold') ? 1.5 : 1));
        else if (m.boss) g = r * 5;
        else {
          g = Math.round(ECON.kill(r) * (MONSTERS[m.kind].gold || 1));
          if (src && src.tile != null && this.tiles[src.tile].trait === 'gold') g += 1;
          if (src && src.mineGold) g += src.mineGold;
          if (src && src.type === 'greed' && src.tier >= 3) g += 1;
          if (src && src.type === 'mining' && this.sp('mining', 'kill2')) g += 2;
          if (src && META.FAM_OF[src.type] === 'holy' && this.fk('holyGold')) g += 2;
          if (this.towersList().some(t => t.tower.type === 'mining' && t.tower.tier >= 6)) g = Math.round(g * 1.2);
        }
        if (m.kind === 'elite') this.stats.eliteKills = (this.stats.eliteKills || 0) + 1;
        if (src && src.thud) this.stats.thudKills++;
        this.gold += g; this.stats.kills++;
        this.emit('kill', { x: m.x, y: m.y, g: m.g, gold: g, kind: m.kind, boss: m.boss || null, big: m.weight >= 3 || !!m.boss });
        if (m.kind === 'splitter') for (let k = 0; k < 2; k++) this.spawnMonster('mini', m.f - k * 0.15, m.w + (k ? 0.4 : -0.4));
        // 각성: 화상 · 중독 전염
        if (m.burn && this.t < m.burn.until && this.awakened('fire')) for (const o of this.near(m, 0.9)) this.burn(o, m.burn.dps);
        if (m.psn > 0 && (this.awakened('poison') || this.sp('poison', 'psnSpread'))) for (const o of this.near(m, 0.9)) this.addPoison(o, m.psn, m.psnDps, 30);
        // 성장탑 처치 → 성장 시간 줄임 · 레일건 각성 연쇄 저격
        if (src && src.type === 'growth' && src.tile != null && this.tiles[src.tile].tower) this.tiles[src.tile].tower.growT -= (src.tier >= 4 ? 3 : src.tier >= 3 ? 2 : 1);
        if (src && src.type === 'railgun' && src.tile != null && this.tiles[src.tile].tower && (src.tier >= 3) && (src.chain || 0) < (this.awakened('railgun') ? 6 : 1)) {
          const nx = this.front(this.inRange(src.tile, this.rangeOf(src.tile), 'railgun'));
          if (nx) { const s2 = Object.assign({}, src, { chain: (src.chain || 0) + 1 }); this.emit('rail', { i: src.tile, pts: [this.muzzle(src.tile), [nx.x, nx.y - 14 * nx.g]], tier: src.tier }); this.damage(nx, this.dmgMul(src.tile) * TIER.vol[src.tier] / RAILN[src.tier], 'mech', s2); }
        }
        for (const t of this.tiles) if (t.occ && t.occ.mon === m.id) { t.occ = null; this.emit('free', { i: t.i }); }
        if (m.boss) this.bossDown(m);
      },
      inRange(i, range, type) {
        const out = [];
        const see = type === 'beacon';
        for (const m of this.monsters) if (m.alive && (!m.stealth || see || this.t < m.revealUntil) && Math.abs(wrapD(m.f, i)) <= range + 0.5) out.push(m);
        return out;
      },
      near(m, rad, excl) { return this.monsters.filter(o => o.alive && o !== m && !(excl && excl.has(o)) && (!o.stealth || this.t < o.revealUntil) && Math.abs(wrapD(o.f, m.f)) <= rad); },
      rangeOf(i) {
        const t = this.tiles[i], tw = t.tower, T = TOWERS[tw.type];
        let r = (T.range || 2) + D.RANGE_T[tw.tier] + (t.trait === 'watch' ? 1 : 0) - (t.trait === 'fog' ? 1 : 0);   // [v4.5] 단계가 오르면 사거리도
        if (this.sp(tw.type, 'range')) r += 1;
        if (this.fk('rangeMech') && (tw.type === 'gatling' || tw.type === 'railgun')) r += 1;
        if (tw.type === 'railgun' && tw.tier >= 4) r = 12;
        if (tw.type === 'railgun' && tw.tier >= 6) r = 12;
        return Math.max(0.5, r);
      },
      beaconBonus(i) {
        const z = this.tiles[i].zone; if (z < 0) return 0;
        let b = 0;
        const zones = [z];
        for (const zz of [0, 1, 2, 3]) if (zz !== z && ZONE_TILES[zz].some(j => this.tiles[j].tower && this.tiles[j].tower.type === 'beacon' && this.tiles[j].tower.tier >= 6 && (zz + 2) % 4 === z)) zones.push(zz);
        for (const zz of zones) for (const j of ZONE_TILES[zz]) {
          const o = this.tiles[j].tower; if (!o || o.type !== 'beacon' || this.disabled(j)) continue;
          b += o.tier * 0.02 * (this.zoneFull(zz) || this.awakened('beacon') ? 2 : 1);
        }
        return Math.min(0.12 + (this.sp('beacon', 'beaconCap') ? 0.1 : 0), b) * (this.fk('buffUp') ? 1.2 : 1);   // 봉화 겹침 상한 +30%
      },
      dmgMul(i) {
        const t = this.tiles[i], tw = t.tower, T = TOWERS[tw.type];
        let m = (T.atk + (tw.bonusAtk || 0)) * (1 + ECON.upgStep * (this.upg[tw.type] || 0));
        if (t.trait === 'arms') m *= 1.3;
        const fort = t.zone >= 0 && (this.zoneFull(t.zone) || (this.awakened('beacon') && ZONE_TILES[t.zone].some(j => this.tiles[j].tower && this.tiles[j].tower.type === 'beacon')));
        if (fort) m *= 1 + (this.has('fortx2') ? 1.25 : 0.5) * (D.DIFF[this.diff].fortHalf ? 0.5 : 1);
        if (this.has('sharp') && tw.tier <= 3) m *= 1.25;
        if (this.focusType === tw.type) m *= 1.4;
        if (this.has('lonely') && this.towersList().length <= 12) m *= 1.6;
        if (this.has('deal')) m *= 1.5; if (this.has('awaken') && (this.awakenTypes || []).includes(tw.type)) m *= 1.3;   // [v5.6] 각성 맛보기 두 종류 피해 +30%
        if (tw.type === 'tyrant' && this.countType('tyrant') === 1) m *= 1.8;   // [v4.5 2 → 1.8: 심연 덱이 가장 강했음]
        if (tw.type === 'combo') m *= 1 + 0.04 * Math.min(this.sp('combo', 'comboCap') ? 40 : 30, this.comboStack);   // [조정: 5% → 3%, 30까지]
        if (tw.type === 'greed') m *= 1 + Math.min(0.4, Math.floor(this.gold / 15) * 0.05);   // [v4.6 금화 단위 1/8: 100 → 15]   // [v4.0 조정: 최대 +50 → +40%]
        if (tw.type === 'growth' && tw.tier >= 6) m *= 3;   // [조정: 기획 10배 → 4배 → v4.5 3배(성역 덱 88%)]
        m *= 1 + this.beaconBonus(i);
        m *= 1 + (this.meta.dmg[META.FAM_OF[tw.type]] || 0);
        m *= 1 + ((this.meta.trait && this.meta.trait[tw.type]) || 0);
        if (this.fk('chainAll') && META.FAM_OF[tw.type] === 'arc') m *= 1.15;
        if (this.fk('abyssDmg') && META.FAM_OF[tw.type] === 'abyss') m *= 1.15;
        if (tw.type === 'prism' && this.sp('prism', 'prismAtk')) m *= 1.5;
        if (this.t < (this.beaconUntil || 0)) m *= 1.3;
        if (this.fxOn('atk')) m *= 1 + D.LANDFX.atk.v;   // [v4.7 땅 기운]
        return m;
      },
      srcOf(i) {
        const t = this.tiles[i], tw = t.tower;
        const cc = 0.05 + (this.meta.crit[META.FAM_OF[tw.type]] || 0) + (t.trait === 'watch' ? 0.1 : 0) + (this.has('critEye') ? 0.1 : 0) + this.lightBuff(i)[1] + (this.fxOn('crit') ? D.LANDFX.crit.v : 0);
        return { type: tw.type, tier: tw.tier, tile: i, critChance: cc, critMul: 1.5 + (this.has('critEye') ? 0.3 : 0), eliteX: tw.type === 'beacon' && tw.tier >= 5 };
      },
      lightBuff(i) {
        const z = this.tiles[i].zone; let b = 0, crit = 0;
        if (z < 0) return [0, 0];
        const cand = ZONE_TILES[z].slice(); const opp = (i + 12) % 24; if (this.tiles[opp].tower) cand.push(opp);
        for (const j of cand) {
          if (j === i) continue;
          const o = this.tiles[j].tower; if (!o || o.type !== 'light' || this.disabled(j)) continue;
          const near = Math.abs(j - i) === 1 || (this.sp('light', 'lightRange') && Math.abs(j - i) === 2) || o.tier >= 5 || (j === opp && o.tier >= 6 && this.awakened('light'));
          if (near) { b += o.tier * (0.03 + (this.sp('light', 'lightAps') ? 0.01 : 0)) * (o.tier >= 4 ? 1.5 : 1) * (this.fk('buffUp') ? 1.2 : 1); if (o.tier >= 6) crit = 0.1; }
        }
        return [b, crit];
      },

      // ---------------------------------------------------------- 공격(16종)
      // [v4.5] 모든 단계가 실제로 날아가는 탄을 쏜다(사용자: '4단계부터 탄이 사라지고 몬스터 자체 이펙트만 — 강력해 보이지 않는다').
      //   한 번에 단계 수만큼(1단계 1발 → 6단계 6발 '다다다', 랜덤다이스 눈금처럼) · 단계가 오를수록 탄이 빠르고(SPD) 간격이 촘촘하고(GAP) 크다(화면).
      //   한 번 공격의 총 피해 = 공격력 × TIER.vol[단계](예전 단계별 값 그대로)를 탄 수로 나눔. 4단계부터 범위 공격은 탄이 맞는 자리에서 터진다(aoe).
      attack(i, m, list) {
        const tw = this.tiles[i].tower, t = tw.tier, type = tw.type, src = this.srcOf(i);
        const vol = this.dmgMul(i) * TIER.vol[t], n = type === 'railgun' ? RAILN[t] : TIER.shots[t], per = vol / n, H = t >= 4;
        const [mx, my] = this.muzzle(i);
        tw.fireT = this.t; tw.aimX = m.x;
        this.emit('fire', { i, type, tier: t, x: mx, y: my, tx: m.x, ty: m.y, n });
        const sp = SPD[t], gap = GAP[t];
        const near = (o, r) => list.filter(q => q !== o && Math.abs(wrapD(q.f, o.f)) <= r);
        const pickT = k => list.length ? list[k % list.length] : m;   // 여러 대상에 나눠 쏘기(앞쪽부터)
        const fan = (kind, speed, extra, tgt, dmg) => { for (let k = 0; k < n; k++) this.shot(kind, i, tgt ? tgt(k) : m, dmg == null ? per : dmg, speed * sp, k * gap, Object.assign(typeof extra === 'function' ? extra(k) : Object.assign({}, extra), { fk: k, fn: n })); };   // [v4.7] fk · fn = 한 번 공격 안의 탄 순번 · 수(그리기 전용: 부채꼴 궤적 · 마지막 탄 필살 연출)
        switch (type) {
          case 'fire':   // 1~3 불덩이 · 4 화염 창 · 5 불길 참격(검에서 날아감) · 6 용의 숨결(입에서 작게 → 대상 쪽으로 커짐)
            fan(t <= 3 ? 'fireball' : t === 4 ? 'flame' : t === 5 ? 'flameslash' : 'breath', t <= 3 ? 330 : 560, { splash: H ? 0.8 : t >= 2 ? 0.5 : 0.25, splashMul: H ? 0.7 : t >= 2 ? 0.5 : 0.25, burn: (H ? vol : per) * 0.12 });
            break;
          case 'gatling': {
            const b = 3 * t;   // 총열 단계 수 × 3점사(4단계 12발 · 6단계 18발)
            for (let k = 0; k < b; k++) this.shot('bullet', i, m, per, 950 * sp, k * (H ? 0.03 : 0.055), { spread: (k % Math.min(t, 3)) - (Math.min(t, 3) - 1) / 2, fk: k, fn: b });
            break;
          }
          case 'bolt':   // 전기 구슬 → 맞으면 연쇄(4단계부터 연쇄가 길고 덜 약해짐 — 예전 낙뢰 몫)
            fan('zap', 760, { chain: H ? t + 2 : t, decay: H ? 0.8 : 0.7 });
            break;
          case 'light':  // 빛 구슬 → 4단계부터 태양 창(맞으면 옆 적에게 튐)
            fan(H ? 'sunbolt' : 'orb', H ? 720 : 420, H ? { bounce: 0.5 } : { pierce: t >= 3 });
            break;
          case 'tyrant': // 피 가시 → 4단계부터 맞은 자리 둘레까지 찢고 잠깐 기절
            fan('spike', 620, H ? k => ({ aoe: 0.8, aoeMul: 0.6, stun: k ? 0 : 0.2, aoeStun: k ? 0 : 0.2 }) : { stun: t >= 3 ? 0.3 : 0 });   // 기절은 한 번 공격에 한 번(첫 발)
            break;
          case 'ice':    // 고드름 → 4단계부터 얼음 창(맞은 자리 둘레도 얼림)
            fan('icicle', H ? 640 : 520, H ? { frz: (2 + (this.sp('ice', 'frz2') ? 1 : 0)) / n, shards: 0, aoe: 1.0, aoeMul: 0.6, aoeFrz: 1 / n } : { frz: (t >= 3 ? 2 : 1) + (this.sp('ice', 'frz2') ? 1 : 0), shards: t - 1 });
            break;
          case 'poison': {
            const max = (t * 3 + (this.sp('poison', 'psnMax') ? 3 : 0)) * (this.awakened('poison') ? 10 : 1), dps = (H ? vol : per) * 0.15, dur = t >= 2 ? 4 : 3;
            if (!H) fan('dart', 560, { psn: [1, dps, max, dur], drop: t >= 3 });
            else fan('toxic', 600, { psn: [2 / n, dps, max, dur], aoe: 1.0, aoeMul: 1, aoePsn: [2 / n, dps, max, dur] }, null, per * 0.5);   // 중독 중첩은 한 번 공격에 2(예전 독안개와 같게)   // 독 폭탄: 터지면 둘레 중독
            break;
          }
          case 'railgun': {
            const dist = Math.abs(wrapD(m.f, i)), kk = (H ? 1 : 1.8) * (1 + (0.06 + (this.sp('railgun', 'dist') ? 0.04 : 0)) * dist);   // [v4.5] 1~3단계 저격 ×1.8(기계 덱이 가장 약했음)
            const pierce = H ? 6 : t + (this.sp('railgun', 'pierce') ? 1 : 0);
            const one = () => {
              if (!this.tiles[i].tower) return;
              const tg = m.alive ? m : this.front(this.inRange(i, this.rangeOf(i), 'railgun')); if (!tg) return;
              const [ax, ay] = this.muzzle(i);
              const sorted = this.monsters.filter(o => o.alive && o !== tg && (!o.stealth || this.t < o.revealUntil) && Math.abs(wrapD(o.f, tg.f)) <= (H ? 12 : 1.6)).sort((a, b) => Math.abs(wrapD(a.f, tg.f)) - Math.abs(wrapD(b.f, tg.f))).slice(0, pierce);
              const pts = [[ax, ay], [tg.x, tg.y - 14 * tg.g]];
              this.damage(tg, per * kk, 'mech', src, { big: true });
              for (const o of sorted) { this.damage(o, per * kk * 0.4, 'mech', src); pts.push([o.x, o.y - 14 * o.g]); }
              this.emit('rail', { i, pts, tier: t });
            };
            one(); for (let k = 1; k < n; k++) this.later(k * (0.12 - t * 0.008), one);   // 첫 발은 바로, 나머지는 짧은 간격으로
            break;
          }
          case 'mining':
            if (!H) fan('ore', 430, { mineGold: t, stun: t >= 3 ? 0.3 : 0 });
            else fan('ingot', 480, k => ({ mineGold: 5, aoe: 0.7, aoeMul: 0.6, stun: k ? 0 : 0.4, aoeStun: k ? 0 : 0.4 }));
            break;
          case 'summon':
            fan('spirit', H ? 460 : 300, H ? { latch: true, aoe: 0.6, aoeMul: 0.45 } : { latch: t >= 3 }, H ? pickT : null);
            break;
          case 'combo':
            if (!H) fan('orb2', 480, { second: t >= 3 ? 'jump' : 'same' });
            else { const hits = n + Math.floor(this.comboStack / 10); for (let k = 0; k < hits; k++) this.shot('orb2', i, pickT(k), per * 0.9, 640 * sp, k * gap, { second: 'jump', fk: k, fn: hits }); }
            break;
          case 'beacon':  // 불화살 → 4단계부터 여러 적에게 흩어 쏘는 불화살 비(맞으면 둘레를 밝히고 터짐)
            fan('arrow', 640, H ? { reveal: 2, aoe: 0.7, aoeMul: 0.6, fireArrow: 1 } : { reveal: t >= 3 ? 2 : 1 }, H ? pickT : null, H ? per * 1.6 : per);
            break;
          case 'growth':  // 축복 구슬 → 4단계부터 빛나는 잎(맞은 자리 둘레 축복 피해 · 성장 시간 단축)
            fan(H ? 'leaf' : 'bless', H ? 520 : 420, H ? { aoe: 1.5, aoeMul: 0.6, grow: 0.5 / n } : {});
            break;
          case 'corrode': {   // 산성 방울 → 4단계부터 큰 산성 덩어리(터지면 둘레 부식)
            const max = t * 2;
            if (!H) fan('acid', 450, { cor: [1, max], splash: t >= 3 });
            else fan('acidglob', 560, { cor: [2 / n, max], aoe: 0.9, aoeMul: 0.5, aoeCor: [2 / n, max] });
            break;
          }
          case 'greed':
            fan('coin', H ? 600 : 500, H ? { aoe: 0.9, aoeMul: 0.6 } : {});
            break;
          case 'prism': {   // 무지개 조각: 4단계부터 최대 3마리에게 나눠 쏨
            const tg = [m].concat(near(m, 1.5)).slice(0, H ? 3 : 1);
            const nb = this.awakened('prism') ? 1 + [i - 1, i + 1].filter(j => this.tiles[j] && this.tiles[j].tower).length : 1;
            fan('prism', 700, {}, k => tg[k % tg.length], per * nb * tg.length);
            break;
          }
        }
      },
      impact(s) {
        const m = s.m, dtype = TOWERS[s.type].dmgType;
        this.emit('impact', { kind: s.kind, x: s.tx, y: s.ty, tier: s.tier, type: s.type, big: s.big || s.all ? 1 : 0, fk: s.fk, fn: s.fn });
        const src = s.mineGold ? Object.assign({}, s.src, { mineGold: s.mineGold }) : s.src;
        // 범위(맞은 자리 둘레): 피해 + 기절 · 드러내기 · 빙결 · 중독 · 부식
        const hitFx = (o, pre) => {
          if (s[pre + 'Stun']) o.stunUntil = Math.max(o.stunUntil, this.t + s[pre + 'Stun']);
          if (s.reveal) o.revealUntil = this.t + s.reveal;
          if (s[pre + 'Frz']) this.addFreeze(o, s[pre + 'Frz']);
          if (s[pre + 'Psn']) this.addPoison(o, ...s[pre + 'Psn']);
          if (s[pre + 'Cor']) this.addCorrode(o, ...s[pre + 'Cor']);
        };
        const aoeHit = (rad, mul, fn) => { for (const o of this.monsters) if (o.alive && o !== m && Math.abs(wrapD(o.f, m.f)) <= rad) { this.damage(o, s.dmg * mul, dtype, src, { quiet: true }); if (fn) fn(o); } };
        // 큰 한 방(5 · 6단계 주기 공격): 정해 둔 대상 전부
        if (s.all) { for (const o of s.all) if (o.alive && o !== m) { this.damage(o, s.allDmg, dtype, src, { quiet: true }); hitFx(o, 'all'); if (s.allBurn) this.burn(o, s.allBurn); } }
        if (s.fx) this.emit(s.fx, { x: s.tx, y: s.ty + 14 * (m.g || 1), tier: s.tier, big: 1 });
        if (FIRE_K.has(s.kind)) {
          if (m.alive) { this.damage(m, s.dmg, dtype, src); this.burn(m, s.burn); }
          aoeHit(s.splash, s.splashMul, o => this.burn(o, s.burn * 0.5));
          return;
        }
        if (s.aoe) aoeHit(s.aoe, s.aoeMul == null ? 0.6 : s.aoeMul, o => hitFx(o, 'aoe'));
        if (!m.alive) return;
        if (s.reveal) { s.reveal += this.sp('beacon', 'reveal') ? 2 : 0; m.revealUntil = this.t + s.reveal; for (const o of this.monsters) if (o.alive && Math.abs(wrapD(o.f, m.f)) <= 0.5) o.revealUntil = this.t + s.reveal; }
        this.damage(m, s.dmg, dtype, src, s.all ? { big: true } : undefined);
        if (s.hardFreeze && m.alive) { m.frozenUntil = this.t + s.hardFreeze; this.emit('frozen', { x: m.x, y: m.y, g: m.g, id: m.id }); }
        if (s.grow && s.src && s.src.tile != null && this.tiles[s.src.tile].tower) this.tiles[s.src.tile].tower.growT -= s.grow;
        if (s.kind === 'zap' && s.chain) {
          const hit = new Set([m]); let cur = m, d = s.dmg; const pts = [[m.x, m.y - 14 * m.g]];
          let chains = s.chain + (this.t < m.shockUntil ? 1 : 0) + (this.sp('bolt', 'chain') ? 1 : 0);
          if (m.frz > 0) { chains += 3; m.frz = 0; this.emit('react', { x: m.x, y: m.y - 30 * m.g, kind: 'superc', name: D.REACT.superc }); }
          m.shockUntil = this.t + 3;
          for (let k = 0; k < chains; k++) {
            const nx = this.near(cur, 1.5, hit).sort((a, b) => Math.abs(wrapD(a.f, cur.f)) - Math.abs(wrapD(b.f, cur.f)))[0];
            if (!nx) break; hit.add(nx); d *= s.decay || 0.7; pts.push([nx.x, nx.y - 14 * nx.g]); this.damage(nx, d, dtype, src); nx.shockUntil = this.t + 3;
            if ((this.sp('bolt', 'stun') && this.r() < 0.1) || (this.awakened('bolt') && s.tier >= 4 && this.r() < 0.5)) nx.stunUntil = this.t + 0.5;
            cur = nx;
          }
          if (pts.length > 1) this.emit('chain', { pts, small: s.tier >= 4 ? 0 : 1, tier: s.tier });
        }
        if (s.kind === 'orb' && s.pierce) { const o = this.near(m, 0.7)[0]; if (o) this.damage(o, s.dmg * 0.6, dtype, src); }
        if (s.bounce) { const o = this.near(m, 0.9)[0]; if (o) { this.damage(o, s.dmg * s.bounce, dtype, src); this.emit('beam', { i: s.i, x: m.x, y: m.y - 14 * m.g, tx: o.x, ty: o.y - 14 * o.g, tier: s.tier, sub: 1 }); } }
        if (s.stun && m.alive) m.stunUntil = Math.max(m.stunUntil, this.t + s.stun);
        if (s.kind === 'icicle') { this.addFreeze(m, s.frz); for (const o of this.near(m, 0.8).slice(0, s.shards)) this.addFreeze(o, 1); }
        if (s.psn) { this.addPoison(m, ...s.psn); if (s.drop) for (const o of this.near(m, 0.6)) this.addPoison(o, 1, s.psn[1], s.psn[2], s.psn[3]); }
        if (s.cor) { this.addCorrode(m, ...s.cor); if (s.splash) for (const o of this.near(m, 0.6)) this.addCorrode(o, 1, s.cor[1]); }
        if (s.kind === 'spirit' && s.latch && m.alive) this.later(1, () => { if (m.alive) this.damage(m, s.dmg * 0.6, dtype, src); });
        if (s.kind === 'orb2' && s.second) {
          const tgt = s.second === 'jump' ? (this.near(m, 1.0)[0] || m) : m;
          this.later(0.3, () => { if (tgt.alive) { this.damage(tgt, s.dmg, dtype, src); this.emit('impact', { kind: 'orb2', x: tgt.x, y: tgt.y - 14 * tgt.g, tier: s.tier, type: s.type }); } });
        }
      },
      // [v4.5] 날아가는 중에 대상이 죽으면 가까운 다른 적에게 꺾어 날아간다(탄 수가 늘어 헛방이 많아지는 것 방지 · 보기에도 자연스럽게)
      updateShots(dt) {
        for (const s of this.shots) {
          if (s.delay > 0) { s.delay -= dt; if (s.delay <= 0 && !s.m.alive) this.retarget(s); continue; }
          s.age += dt;
          if (!s.m.alive && !s.lost) this.retarget(s);
          if (s.m.alive) { s.tx = s.m.x; s.ty = s.m.y - 14 * s.m.g; }
          const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), v = s.speed * dt;
          if (d <= v || s.age > 2) { s.done = true; this.impact(s); continue; }
          s.x += dx / d * v; s.y += dy / d * v;
        }
        this.shots = this.shots.filter(s => !s.done);
      },
      retarget(s) {
        const t = this.tiles[s.i], r = t && t.tower ? this.rangeOf(s.i) + 0.5 : 2.5;
        let best = null, bd = 1e9;
        for (const o of this.monsters) {
          if (!o.alive || (o.stealth && this.t >= o.revealUntil) || Math.abs(wrapD(o.f, s.i)) > r + 0.5) continue;
          const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < bd) { bd = d; best = o; }
        }
        if (best) s.m = best; else s.lost = true;
      },
      later(d, fn) { (this.timers || (this.timers = [])).push({ at: this.t + d, fn }); },
      runTimers() { if (!this.timers || !this.timers.length) return; const now = this.t; const due = this.timers.filter(x => x.at <= now); this.timers = this.timers.filter(x => x.at > now); for (const x of due) x.fn(); },

      // ---------------------------------------------------------- 수호상 · 전설 주기 공격
      // [v4.5] 몬스터 자리에 바로 터지던 것(불 폭발 · 서리 · 독안개 · 산성 웅덩이 · 금화 비)을 '큰 탄이 날아가 맞는 순간 터짐'으로 — 무기 끝에서 출발(render5)
      specialPeriod(type) { return SPECIAL_T[type] || 5; },
      special(i) {
        const tw = this.tiles[i].tower, type = tw.type, list = this.inRange(i, this.rangeOf(i) + 1, type), m = this.front(list);
        const per = this.dmgMul(i) * TIER.vol[tw.tier], src = this.srcOf(i), [mx, my] = this.muzzle(i), L = tw.tier >= 6, t = tw.tier;
        if (type === 'summon') { this.summonTower(L ? 2 : 1, i); this.emit('special', { i, type, tier: tw.tier, x: mx, y: my, tx: mx, ty: my }); return true; }
        if (type === 'greed' && L && this.round > 0) { for (let k = 0; k < 2; k++) this.spawnMonster('goldmon', 0, null); this.emit('special', { i, type, tier: tw.tier, x: mx, y: my, tx: mx, ty: my }); }
        if (!m) return false;
        this.emit('special', { i, type, tier: tw.tier, x: mx, y: my, tx: m.x, ty: m.y });
        const near1 = r => this.near(m, r);
        const big = (kind, speed, dmg, extra) => this.shot(kind, i, m, dmg, speed, 0, Object.assign({ big: 1 }, extra));
        switch (type) {
          case 'fire':
            if (L) {   // 용의 숨결: 입에서 대상 쪽으로 넓어지는 불길 — 사거리 안 전부
              this.emit('breath', { i, x: mx, y: my, tx: m.x, ty: m.y });
              const tg = list.slice();
              this.later(0.22, () => { for (const o of tg) if (o.alive) { this.damage(o, per * 1.5, 'elem', src, { quiet: o !== m }); this.burn(o, per * 0.2); } });
            } else big('meteor', 520, per * 2.5, { splash: 1.0, splashMul: 1, burn: per * 0.12, fx: 'boom' });   // 불길 참격 대폭발
            break;
          case 'gatling': { const tg = list.slice(0, L ? 20 : 6); tg.forEach((o, n) => { for (let k = 0; k < 3; k++) this.shot('bullet', i, o, per * 0.6, 1100, n * 0.03 + k * 0.05, { spread: 0 }); }); break; }
          case 'bolt': { const tg = L ? list : list.slice().sort(() => this.r() - 0.5).slice(0, 4); for (const o of tg) this.thunder(i, o, per * 1.2, L ? 2 : 0, src); break; }
          case 'light': this.emit('halo', { i, tier: tw.tier }); for (const o of list.slice(0, 4)) { this.damage(o, per * 1.5, 'holy', src); this.emit('beam', { i, x: mx, y: my, tx: o.x, ty: o.y - 14 * o.g, tier: tw.tier }); } break;
          case 'tyrant': this.dread(i, 2.5); break;
          case 'ice':
            if (L) big('comet', 600, per * 1.5, { all: list.slice(), allDmg: per * 1.5, allFrz: 3, frz: 3, shards: 0, fx: 'frost' });   // 얼음 혜성 → 맞으면 사거리 안 전부 빙결
            else for (const [n, o] of list.slice(0, 3).entries()) this.shot('icicle', i, o, per * 0.4, 760, n * 0.06, { frz: 0, shards: 0, hardFreeze: 1.5, big: 1 });   // 얼음 창 세 개 → 맞은 적 1.5초 얼음
            break;
          case 'poison': big('toxic', 560, per, { all: L ? list.slice() : near1(1), allDmg: per, psn: [4, per * 0.3, 99, 4], allPsn: [4, per * 0.3, 99, 4], fx: 'fog' }); break;
          case 'railgun': {
            const tg = L ? this.monsters.filter(o => o.alive && (!o.stealth || this.t < o.revealUntil)).sort((a, b) => b.hp - a.hp).slice(0, 3) : [m, m, m];
            tg.forEach((o, n) => this.later(n * 0.1, () => { if (!o.alive) return; this.damage(o, per * (L ? 3 : 1.2), 'mech', src, { big: true }); this.emit('rail', { i, pts: [this.muzzle(i), [o.x, o.y - 14 * o.g]], tier: 6 }); }));
            break;
          }
          case 'mining': this.shot('ingot', i, m, per * 2, 420, 0, { mineGold: 5, aoe: 1.0, aoeMul: 0.6, stun: 0.6, aoeStun: 0.6, big: 1 }); break;
          case 'combo': { const hits = 1 + Math.floor(this.comboStack / 5); for (let k = 0; k < hits; k++) this.later(k * 0.08, () => { if (m.alive) { this.damage(m, per, 'arc', src); this.emit('slash', { x: m.x, y: m.y - 14 * m.g }); } }); break; }
          case 'beacon': for (const o of list.slice(0, L ? 8 : 4)) this.shot('arrow', i, o, per, 760, this.r() * 0.2, { reveal: 3, aoe: 0.5, aoeMul: 0.6, fireArrow: 1, big: 1 }); break;
          case 'growth': this.emit('bell', { i, tier: tw.tier }); for (const o of list) this.damage(o, per, 'holy', src, { quiet: o !== m }); tw.growT -= 3; break;
          case 'corrode': {
            const cap = t * 2 * (m.boss && (t >= 5 || this.sp('corrode', 'corBoss')) ? 2 : 1);
            big('acid', 520, per, { all: L ? list.slice() : near1(1), allDmg: per, cor: [3, cap], allCor: [3, t * 2], fx: 'acidpool' });   // 큰 산성 폭탄 → 웅덩이
            break;
          }
          case 'greed': big('coin', 560, per * 1.5, { all: near1(1.2), allDmg: per * 1.5, fx: 'coinrain' }); break;   // 황금 대포알 → 금화 비
          case 'prism': for (const [n, o] of list.slice(0, L ? 5 : 3).entries()) this.shot('prism', i, o, per * 1.2, 820, n * 0.05, { big: 1 }); break;
        }
        return true;
      },

      // ---------------------------------------------------------- 출동(착지)
      strike(i, mul, echo) {
        const tw = this.tiles[i].tower; if (!tw) return;
        if (this.CH && this.CH.echo && !echo) { const o = (i + 12) % 24; if (this.tiles[o].tower && this.tiles[o].tower.type !== 'prism') { this.emit('echo', { a: i, b: o }); this.strike(o, mul * 0.5, true); } }
        if (tw.type === 'prism') { this.emit('nostrike', { i }); return; }
        let k = ECON.strikeMul * mul * (1 + 0.1 * this.combo);
        if (this.tiles[i].trait === 'holy') k *= 2;
        if (this.pawnId === 'dog') k *= 1.35;   // [v4.0 조정: 1.3 → 1.35]
        if (this.has('strikex2')) { k *= 3; tw.rushUntil = this.t + 6; }   // [v5.6] 출동 대장: 3배 + 출동한 포탑 6초 공속 +50%
        if (this.sp(tw.type, 'strike')) k *= 1.5;
        const per = this.dmgMul(i) * TIER.dmg[tw.tier] * Math.max(1, TIER.shots[tw.tier]) * k, src = this.srcOf(i);
        this.stats.strikes++;
        const z = this.tiles[i].zone;
        const zoneMons = () => { const lo = z * 6 + 0.5, hi = z * 6 + 5.5; return this.monsters.filter(m => m.alive && fmod(m.f) >= lo - 0.5 && fmod(m.f) <= hi + 0.5); };
        this.emit('strike', { i, type: tw.type, tier: tw.tier, combo: this.combo });
        switch (tw.type) {
          case 'fire': this.emit('firewall', { zone: z }); for (const m of zoneMons()) { this.damage(m, per, 'elem', src, { big: true }); this.burn(m, per * 0.1); } break;
          case 'gatling': { tw.barrageUntil = this.t + 5; const m = this.front(this.inRange(i, this.rangeOf(i))); if (m) for (let q = 0; q < 10; q++) this.shot('bullet', i, m, per / 10, 1000, q * 0.04, { spread: (q % 3) - 1 }); break; }
          case 'bolt': { const tg = this.monsters.filter(m => m.alive).sort((a, b) => fmod(b.f) - fmod(a.f)).slice(0, tw.tier * 3); for (const m of tg) { this.emit('thunder', { x: m.x, y: m.y, tier: 4 }); this.damage(m, per, 'arc', src, { big: true }); } break; }
          case 'light': { const zs = z >= 0 ? ZONE_TILES[z] : [i]; for (const j of zs) if (this.tiles[j].tower) this.tiles[j].tower.blessUntil = this.t + 10; this.emit('bless', { zone: z }); const m = this.front(this.inRange(i, this.rangeOf(i))); if (m) { this.damage(m, per, 'holy', src, { big: true }); this.emit('beam', { i, x: this.muzzle(i)[0], y: this.muzzle(i)[1], tx: m.x, ty: m.y - 14 * m.g, tier: 6 }); } break; }
          case 'tyrant': this.emit('dread', { i, big: 1 }); for (const m of this.monsters) if (m.alive) this.damage(m, per * 0.5 * (this.sp('tyrant', 'dread') ? 1.5 : 1), 'abyss', src, { big: true }); break;
          case 'ice': this.emit('blizzard', {}); for (const m of this.monsters) if (m.alive) { this.addFreeze(m, 2); this.damage(m, per * 0.2, 'elem', src, { quiet: true }); } break;
          case 'poison': this.emit('fogzone', { zone: z }); for (const m of zoneMons()) { this.addPoison(m, 5, per * 0.1, 99, 5); this.damage(m, per * 0.3, 'elem', src, { quiet: true }); } break;
          case 'railgun': { const m = this.monsters.filter(o => o.alive).sort((a, b) => b.hp - a.hp)[0]; if (m) { this.emit('orbital', { x: m.x, y: m.y }); this.damage(m, per * 4, 'mech', src, { big: true }); } break; }
          case 'mining': { const g = tw.tier * 4; this.gold += g; this.emit('gold', { amt: g, why: '노다지', i }); break; }
          case 'summon': this.summonTower(this.awakened('summon') ? 2 : 1, i); break;
          case 'combo': { this.comboStack++; this.emit('comboUp', { n: this.comboStack }); const m = this.front(this.inRange(i, this.rangeOf(i))); if (m) { this.damage(m, per * (1 + this.comboStack * tw.tier * 0.2), 'arc', src, { big: true }); this.emit('slash', { x: m.x, y: m.y - 14 * m.g, big: 1 }); } break; }
          case 'beacon': this.beaconUntil = this.t + 10; this.emit('beaconAll', {}); break;
          case 'growth': tw.growSure = true; tw.growT = 0; break;
          case 'corrode': this.emit('fogzone', { zone: z, acid: 1 }); for (const m of zoneMons()) { m.cor = Math.max(m.cor, this.awakened('corrode') ? 20 : tw.tier * 2); m.corT = this.t + 10; this.damage(m, per * 0.3, 'abyss', src, { quiet: true }); } break;
          case 'greed': for (let q = 0; q < 5; q++) this.spawnMonster('goldmon', -q * 0.25, null); this.emit('goldParade', {}); break;
        }
      },
      summonTower(tier, from) {
        const empty = this.tiles.filter(t => !t.corner && !t.tower);
        if (!empty.length) return false;
        const t = this.pickOne(empty);
        if (tier === 1 && this.sp('summon', 'sum2') && this.r() < 0.15) tier = 2;
        this.build(t.i, this.pickOne(this.deck.filter(d => d !== 'prism').length ? this.deck.filter(d => d !== 'prism') : this.deck), tier);
        this.emit('summoned', { i: t.i, from });
        return true;
      },

      // ---------------------------------------------------------- 합치기(조커 · 소환 · 탐욕 · 콤보)
      canMerge(a, b) {
        if (a === b) return false;
        const A = this.tiles[a] && this.tiles[a].tower, B = this.tiles[b] && this.tiles[b].tower;
        if (!A || !B || A.tier !== B.tier || A.tier >= 6 || this.tiles[a].occ || this.tiles[b].occ) return false;
        return A.type === B.type || A.type === 'prism' || B.type === 'prism';
      },
      merge(a, b) {
        if (!this.canMerge(a, b) || this.over) return false;
        const A = this.tiles[a].tower, B = this.tiles[b].tower;
        const type = A.type === 'prism' ? B.type : B.type === 'prism' ? A.type : B.type;
        let tier = B.tier + 1;
        let lucky = this.tiles[b].trait === 'luck' && tier < 6 && this.r() < 0.2;
        if (!lucky && tier < 6 && this.meta.rules.includes('elem') && META.FAM_OF[type] === 'elem' && this.r() < 0.05) lucky = true;
        if (lucky) tier++;
        this.tiles[a].tower = null;
        this.tiles[a].warn = null; this.tiles[b].warn = null;
        this.stats.merges++;
        this.emit('mergeFrom', { a, b, type: B.type, tier: B.tier, typeA: A.type });
        B.type = type; B.bonusAtk = Math.max(A.bonusAtk || 0, B.bonusAtk || 0);
        this.setTier(b, tier, 'merge', lucky);
        if (this.offer && (this.offer.i === a || this.offer.i === b)) this.offer = null;
        if (type === 'summon' && A.type === 'summon' && B.type === 'summon' && (this.awakened('summon') || this.r() < 0.15 + (this.sp('summon', 'sumMerge') ? 0.15 : 0) + (this.fk('comboStart') ? 0.05 : 0))) this.summonTower(this.awakened('summon') ? 2 : 1, b);
        if (this.meta.rules.includes('arc') && META.FAM_OF[type] === 'arc' && this.r() < 0.04) this.summonTower(1, b);
        if (type === 'greed' && this.round > 0) for (let q = 0; q < tier; q++) this.spawnMonster('goldmon', -q * 0.3, null);
        if ((type === 'combo') || this.awakened('combo')) { this.comboStack++; this.emit('comboUp', { n: this.comboStack }); }
        return true;
      },

      // ---------------------------------------------------------- 판 위 지속 효과
      updatePassives(dt) {
        if (!this.comboStack) this.comboStack = 0;
        if (this.comboStack > 0 && !this.towersList().some(t => t.tower.type === 'combo') && !this.awakened('combo')) { this.comboStack = 0; this.emit('comboLost', {}); }
        if (this.awakened('mining')) { this.interestAcc = (this.interestAcc || 0) + dt; if (this.interestAcc >= 1) { this.interestAcc -= 1; const g = Math.min(6, Math.floor(this.gold * 0.01)); this.gold += g; } }
        let tyrantLegend = null;
        for (const t of this.tiles) {
          const tw = t.tower; if (!tw || this.disabled(t.i)) continue;
          if (tw.type === 'mining') { tw.mineT = (tw.mineT == null ? 10 : tw.mineT) - dt; if (tw.mineT <= 0) { tw.mineT = 10; const g = Math.round(tw.tier * 1 * (tw.tier >= 5 ? 2 : 1) * (this.sp('mining', 'mine2') ? 1.5 : 1)); this.gold += g; this.emit('gold', { amt: g, why: '채굴', i: t.i }); } }
          if (tw.type === 'growth' && tw.tier < 6) {
            const gT = this.sp('growth', 'growFast') ? 15 : 20;
            tw.growT = (tw.growT == null ? gT : tw.growT) - dt;
            if (tw.growT <= 0) {
              tw.growT = gT;
              const chance = tw.growSure || this.awakened('growth') ? 1 : tw.tier >= 5 ? 0.5 : 0.33;   // [v4.5 40 → 33% · 5단계 60 → 50%: 성역 덱이 가장 강했음]
              tw.growSure = false;
              if (this.r() < chance) {
                const nt = this.pickOne(this.deck.filter(d => d !== 'prism'));
                tw.type = nt; this.setTier(t.i, tw.tier + 1, 'grow');
              } else if (this.sp('growth', 'growSafe') && this.r() < 0.5) { this.emit('growFail', { i: t.i, safe: 1 }); }
              else if (tw.tier <= 1) { t.tower = null; this.emit('growFail', { i: t.i, gone: 1 }); }
              else { tw.tier--; this.emit('growFail', { i: t.i }); }
            }
          }
          if (tw.type === 'tyrant' && tw.tier >= 6) tyrantLegend = t;
        }
        if (tyrantLegend) {
          this.absorbT = (this.absorbT || 15) - dt;
          if (this.absorbT <= 0) {
            this.absorbT = 15;
            const prey = this.towersList().filter(t => t !== tyrantLegend && t.tower.type === 'tyrant');
            if (prey.length) { const p = prey[0]; p.tower = null; tyrantLegend.tower.bonusAtk = (tyrantLegend.tower.bonusAtk || 0) + (this.awakened('tyrant') ? 30 : 15) * (this.sp('tyrant', 'absorb') ? 2 : 1); this.emit('absorb', { i: tyrantLegend.i, from: p.i }); }
          }
        }
        this.runTimers();
      },

      // ---------------------------------------------------------- 보스 교란(6종)
      bossDisrupt(k, cand) {
        const pick = n => cand.slice(0, n);
        if (k === 'destroyer') { if (this.shield > 0 && cand.length) { this.shield--; this.emit('shield', { by: k }); return 15; } for (const t of pick(2)) { t.warn = { until: this.t + 15 }; this.emit('warn', { i: t.i, by: k }); } return 15; }
        if (k === 'ghost') { const tg = cand.filter(t => t.trait === 'target').concat(this.towersList().filter(t => t.tower.tier < 6).sort(() => this.r() - 0.5)).filter((t, n, a) => a.indexOf(t) === n).slice(0, 3); for (const t of tg) { t.stopUntil = this.t + 6; this.emit('stop', { i: t.i, by: k }); } return 12; }
        // [v5.6 A안] 마술사 = 보상형(랜다2 조커처럼): 가장 낮은 단계 포탑 1개를 같은 단계 프리즘으로 — 합치기 열쇠. 방패가 막지 않음
        if (k === 'magician') { const t = cand.filter(c => c.tower.type !== 'prism').sort((a, c) => a.tower.tier - c.tower.tier)[0]; if (t) { const from = t.tower.type; t.tower.type = 'prism'; this.emit('hexed', { i: t.i, prism: 1, from, by: k }); } return 15; }
        if (this.shield > 0 && cand.length) { this.shield--; this.emit('shield', { by: k }); return 15; }
        if (k === 'witch') { const t = cand[0]; if (t) { const others = this.deck.filter(d => d !== t.tower.type && d !== 'prism'); if (others.length) { const from = t.tower.type; t.tower.type = this.pickOne(others); this.emit('hexed', { i: t.i, from, by: k }); } } return 15; }
        if (k === 'quake') { const ts = this.towersList().filter(t => t.tower.tier < 6).sort(() => this.r() - 0.5).slice(0, 2); if (ts.length === 2) { const tmp = ts[0].tower; ts[0].tower = ts[1].tower; ts[1].tower = tmp; this.emit('quake', { a: ts[0].i, b: ts[1].i, by: k }); } return 15; }
        if (k === 'swindler') { const t = cand.find(c => !c.occ); if (t && this.boss) { t.occ = { mon: this.boss.id, ransom: 0 }; this.emit('occupy', { i: t.i, by: k }); } return 15; }
        return 15;
      },
    });
  }
  if (isNode) module.exports = install; else root.BEHAVE = install;
})(typeof window !== 'undefined' ? window : globalThis);
