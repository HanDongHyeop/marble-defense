// 협동(AI 동료) — 같은 판에 동료의 말이 하나 더 돈다. 동료는 자기 금화로 굴리고, 자기 포탑(파란 깃발)을 짓고 합친다.
// 몬스터는 함께 막는다(체력 ×1.3). 판이 끝나면 기여도(피해 비율)를 보여 준다. 온라인 협동(사람 둘)은 서버가 필요한 다음 단계.
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./data.js') : root.DATA;
  const { TOWERS, TIER, ECON } = D;

  function install(Game) {
    const P = Game.prototype;
    const baseStep = P.step, baseDamage = P.damage, baseHp = P.hpR, baseKill = P.kill, baseBuild = P.build;
    Object.assign(P, {
      coopInit(human) {
        if (this.partner) { this.partner.human = !!human; return; }
        this.partner = { tile: 12, path: [], moving: false, hopT: 0, hopDur: ECON.hop, diceUntil: 0, gold: ECON.startGold, rollCost: ECON.rollBase, wait: 3, pawn: this.pawnId === 'dog' ? 'cat' : 'dog', rolls: 0, built: 0, merges: 0, human: !!human, q: 0 };
        this.stats.dmgBy = { 1: 0, 2: 0 };
      },
      hpR(r) { return baseHp.call(this, r) * (this.partner ? 1.75 : 1); },   // [v4.0 조정: 1.55 → 1.75 — AI 동료 판 88%]
      build(i, type, tier, owner) {
        baseBuild.call(this, i, type, tier);
        if (this.tiles[i].tower) this.tiles[i].tower.owner = owner || (this.buildOwner || 1);
      },
      damage(m, amt, dtype, src, opts) {
        if (this.partner && src && src.tile != null && this.tiles[src.tile] && this.tiles[src.tile].tower) {
          const o = this.tiles[src.tile].tower.owner || 1; const before = m.hp; const r = baseDamage.call(this, m, amt, dtype, src, opts);
          this.stats.dmgBy[o] += Math.max(0, Math.min(before, r || 0)); return r;
        }
        return baseDamage.call(this, m, amt, dtype, src, opts);
      },
      kill(m, src) {
        const g0 = this.gold; baseKill.call(this, m, src);
        if (this.partner) this.partner.gold += Math.round((this.gold - g0) * 0.6);   // 동료도 처치 금화를 받는다(자기 몫)
      },
      partnerStep(dt) {
        const p = this.partner;
        if (p.moving) {
          if (this.t < p.diceUntil) return;   // 주사위 연출 동안 기다림
          p.hopT += dt;
          if (p.hopT >= p.hopDur) {
            p.hopT -= p.hopDur; p.tile = p.path.shift();
            this.emit('hop2', { i: p.tile, last: !p.path.length });
            if (p.tile === 0) { const s = ECON.salary(this.round || 1); p.gold += s; }
            if (!p.path.length) { p.moving = false; this.partnerLand(p.tile); }
          }
          return;
        }
        p.wait -= dt;
        if (p.human) { if (p.q > 0 && p.gold >= p.rollCost && this.round >= 1) { p.q--; this.partnerRoll(); } return; }   // 사람 2P: 버튼을 눌렀을 때만
        if (p.wait > 0 || this.round < 1) return;
        // 1) 자기 포탑 합치기
        const mine = this.tiles.filter(t => t.tower && t.tower.owner === 2 && !t.occ);
        for (const a of mine) for (const b of mine) if (a !== b && this.canMerge(a.i, b.i)) { this.merge(a.i, b.i); this.tiles[b.i].tower.owner = 2; p.merges++; p.wait = 1.2; this.emit('coopMerge', { i: b.i }); return; }
        // 2) 굴리기
        if (p.gold >= p.rollCost) { this.partnerRoll(); p.wait = 2.2 + this.r() * 1.2; } else p.wait = 1;
      },
      partnerRoll() {
        const p = this.partner; if (!p || p.moving || p.gold < p.rollCost) return false;
        p.gold -= p.rollCost; p.rollCost += ECON.rollStep; p.rolls++;
        const d1 = 1 + this.rand(6), d2 = 1 + this.rand(6);
        p.path = []; for (let k = 1; k <= d1 + d2; k++) p.path.push((p.tile + k) % 24);
        p.moving = true; p.hopT = 0; p.diceUntil = this.t + ECON.diceT;
        this.emit('dice2', { d1, d2, dbl: d1 === d2 });
        return true;
      },
      partnerPress() { const p = this.partner; if (!p) return false; if (p.gold < p.rollCost) { this.emit('nogold'); return false; } p.q = Math.min(2, p.q + 1); return true; },
      partnerLand(i) {
        const t = this.tiles[i], p = this.partner;
        if (t.warn) { t.warn = null; this.emit('rescue', { i }); }
        if (t.occ) { t.occ = null; this.emit('reclaim', { i, gold: 0 }); }
        this.thud(i, 1);
        if (t.corner) { if (t.cornerKind === 'start') p.gold += ECON.salary(this.round || 1); return; }
        if (!t.tower) { this.build(i, this.buildPick(), 1, 2); p.built++; this.emit('coopBuild', { i }); return; }
        this.strike(i, 1);
        const tw = t.tower;
        if (tw.owner === 2 && tw.tier < 5) { const c = Math.round(p.rollCost * ECON.tierUp[tw.tier]); if (p.gold >= c) { p.gold -= c; this.setTier(i, tw.tier + 1, 'tierup'); } }
      },
      step(dt) {
        if (this.partner && !this.over && !this.paused) this.partnerStep(dt);
        return baseStep.call(this, dt);
      },
    });
  }
  if (isNode) module.exports = install; else root.COOP = install;
})(typeof window !== 'undefined' ? window : globalThis);
