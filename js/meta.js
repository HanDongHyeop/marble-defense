// 판 밖 성장(기획 14장) + 장 1~6(기획 12장). 저장은 localStorage(브라우저), Node에서는 메모리.
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./data.js') : root.DATA;

  const FAMS = [
    { id: 'elem', name: '원소', color: '#ff6a3d', towers: ['fire', 'ice', 'poison'] },
    { id: 'mech', name: '기계', color: '#ffb02e', towers: ['gatling', 'railgun', 'mining'] },
    { id: 'arc', name: '비전', color: '#a77bff', towers: ['bolt', 'summon', 'combo'] },
    { id: 'holy', name: '성역', color: '#e8c050', towers: ['light', 'beacon', 'growth'] },
    { id: 'abyss', name: '심연', color: '#e0303a', towers: ['tyrant', 'corrode', 'greed'] },
  ];
  const FAM_OF = {}; FAMS.forEach(f => f.towers.forEach(t => (FAM_OF[t] = f.id)));
  // 처음부터 가진 포탑(계열마다 둘) · 코어로 여는 포탑
  const BASE = ['fire', 'ice', 'gatling', 'railgun', 'bolt', 'summon', 'light', 'beacon', 'tyrant', 'corrode'];
  const UNLOCK = { poison: { lv: 10, core: 25 }, mining: { lv: 10, core: 25 }, combo: { lv: 10, core: 25 }, growth: { lv: 10, core: 25 }, greed: { lv: 10, core: 25 }, prism: { lv: 0, core: 40, common: true } };
  const RULES = {
    elem: { name: '이중 합성', desc: '원소 포탑을 합칠 때 5%로 +2단계' },
    mech: { name: '정비 할인', desc: '기계 포탑 판 안 강화 비용 −12%' },
    arc: { name: '마력 공명', desc: '비전 포탑을 합칠 때 4%로 빈 땅에 무작위 1단계' },
    holy: { name: '축복 전파', desc: '성역 포탑 강화 때 5%로 다른 종류도 +1' },
    abyss: { name: '심연의 씨앗', desc: '심연 포탑을 지을 때 5%로 2단계' },
  };
  // 계열 나무 노드: 수치 3 · 1회 2 · 규칙 1 (열림 = 나무 레벨)
  const FAM_NODES = [
    { id: 'dmg', name: '피해', max: 20, per: 2.5, unit: '%', need: 0 },
    { id: 'aps', name: '공속', max: 15, per: 1.5, unit: '%', need: 5 },
    { id: 'crit', name: '치명 확률', max: 10, per: 0.5, unit: '%', need: 15 },
    { id: 'gold0', name: '시작 금화 +30', once: true, core: 8, need: 12 },
    { id: 'life', name: '허용 몬스터 +3', once: true, core: 10, need: 20 },
    { id: 'rule', name: '규칙', once: true, core: 20, need: 30, rule: true },
  ];
  const COMMON_NODES = [
    { id: 'vault', name: '금고', desc: '라운드마다 보유 금화 2% 이자(최대 라운드×3)', once: true, core: 15, need: 0 },
    { id: 'cdcut', name: '지휘관 훈련', desc: '지휘관 쿨다운 −15초', once: true, core: 20, need: 0 },
    { id: 'salary', name: '월급 인상', max: 10, per: 5, unit: '%', desc: '월급 +5%/Lv', need: 0 },
    { id: 'roll', name: '행운의 손', once: true, core: 25, desc: '첫 굴리기 3번 무료', need: 0 },
  ];
  // 특성 3칸(포탑마다): 일반 Lv1~30 = 그 포탑 피해 +1.5%/Lv · 특수①(일반 Lv10) · 특수②(일반 Lv20)
  const TRAIT_SP = {
    fire:    [['range', '사거리 +1칸'], ['burn2', '화상 피해 2배']],
    ice:     [['frz2', '빙결이 2중첩씩'], ['frzLong', '얼음 시간 +0.5초']],
    poison:  [['psnMax', '중독 최대 +3'], ['psnSpread', '중독된 적이 죽으면 옆 적 중독']],
    gatling: [['accel', '가속 최대 +0.5배'], ['strike', '출동 피해 +50%']],
    railgun: [['pierce', '관통 +1'], ['dist', '거리 보너스 칸당 +4%']],
    mining:  [['mine2', '생산 금화 +50%'], ['kill2', '처치 금화 +2']],
    bolt:    [['chain', '연쇄 +1'], ['stun', '연쇄가 10%로 기절']],
    summon:  [['sumMerge', '합칠 때 소환 확률 +15%'], ['sum2', '소환이 15%로 2단계']],
    combo:   [['combo0', '판 시작 콤보 +3'], ['comboCap', '콤보 상한 +10']],
    light:   [['lightAps', '버프 +1%p/단계'], ['lightRange', '버프가 2칸 옆까지']],
    beacon:  [['reveal', '드러냄 시간 +2초'], ['beaconCap', '봉화 상한 +10%']],
    growth:  [['growFast', '성장 시간 −5초'], ['growSafe', '실패해도 단계 유지 50%']],
    tyrant:  [['dread', '판 전체 피해 +50%'], ['absorb', '흡수 공격력 2배']],
    corrode: [['corMax', '부식 최대 +2'], ['corBoss', '보스 부식 2배']],
    greed:   [['gmHp', '금화 몬스터 체력 −30%'], ['gmGold', '금화 몬스터 금화 +50%']],
    prism:   [['prismAtk', '공격력 +50%'], ['prismWeight', '조금 더 자주 지어짐']],
  };
  const traitCost = (lv) => Math.round(80 * Math.pow(lv + 1, 1.45) / 10) * 10;
  // 갈림길: 계열마다 A · B 중 하나(언제든 무료로 바꿈, 처음 열 때 코어 10 · 나무 Lv20)
  const FORKS = {
    elem: [['burnLong', '화상 지속 +1초'], ['thermal', '열충격 피해 +50%']],
    mech: [['rangeMech', '기계 포탑 사거리 +1칸(채굴 제외)'], ['upgCheap', '기계 강화 비용 −10% 더']],
    arc: [['chainAll', '비전 포탑 피해 +15%'], ['comboStart', '콤보 시작 +2 · 소환 +5%']],
    holy: [['buffUp', '성역 버프 효과 +20%'], ['holyGold', '성역 포탑 처치 금화 +2']],
    abyss: [['abyssDmg', '심연 피해 +15%'], ['abyssLife', '허용 몬스터 +4']],
  };
  const goldCost = (lv) => Math.round(150 * Math.pow(lv + 1, 1.6) / 10) * 10;

  const CHAPTERS = [
    { n: 1, hp: 1, name: '초원', board: 'board', rule: '없음', desc: '좋은 땅 9 · 나쁜 땅 3 · 기본형', map: { 1: 'choke', 3: 'arms', 5: 'fog', 7: 'watch', 9: 'luck', 10: 'web', 14: 'holy', 16: 'gold', 17: 'target', 19: 'drill', 21: 'arms', 23: 'gold' }, bias: {} },
    { n: 2, hp: 1.06, name: '설원', board: 'board_ch2', rule: '무인도 4초 · 날쌘이가 많다', desc: '길목이 많다', map: { 1: 'choke', 2: 'arms', 4: 'choke', 7: 'watch', 9: 'choke', 10: 'web', 13: 'holy', 15: 'choke', 17: 'fog', 19: 'drill', 21: 'gold', 23: 'luck' }, bias: { fast: 1.8 }, island: 4 },
    { n: 3, hp: 1.27, name: '화산', board: 'board_ch3', rule: '몬스터 월급 +15%(바퀴마다 +25%) · 방울이가 많다', desc: '무기고 · 거미줄이 많다', map: { 1: 'arms', 3: 'web', 5: 'arms', 7: 'web', 8: 'arms', 10: 'watch', 13: 'luck', 15: 'arms', 17: 'web', 19: 'gold', 21: 'holy', 23: 'drill' }, bias: { barrier: 2 }, monSalary: 0.25 },
    { n: 4, hp: 1.15, name: '공장', board: 'board_ch4', rule: '황금열쇠 나쁜 카드 40% · 철갑이가 많다', desc: '금맥이 많다', map: { 1: 'gold', 3: 'drill', 5: 'gold', 7: 'fog', 9: 'gold', 11: 'arms', 13: 'gold', 15: 'target', 17: 'luck', 19: 'gold', 21: 'web', 23: 'watch' }, bias: { armor: 2 }, badKey: 0.4 },
    { n: 5, hp: 1.32, name: '신전', board: 'board_ch5', rule: '출동하면 맞은편 칸 포탑도 절반 위력으로 출동 · 쌍둥이가 많다', desc: '성지 · 안개가 많다', map: { 1: 'holy', 3: 'fog', 5: 'holy', 7: 'fog', 9: 'luck', 11: 'holy', 13: 'fog', 15: 'holy', 17: 'drill', 19: 'arms', 21: 'fog', 23: 'holy' }, bias: { splitter: 2.2 }, echo: true },
    { n: 6, hp: 1.5, name: '심연', board: 'board_ch6', rule: '엘리트 2배 · 표적지가 많다', desc: '표적지가 많다', map: { 1: 'target', 3: 'arms', 5: 'target', 7: 'luck', 9: 'target', 11: 'holy', 13: 'target', 15: 'gold', 17: 'target', 19: 'drill', 21: 'watch', 23: 'web' }, bias: {}, elite2: true },
  ];

  // ---------------------------------------------------------------- 저장
  const mem = {};
  const store = {
    get(k, d) { try { if (isNode) return k in mem ? JSON.parse(mem[k]) : d; const v = localStorage.getItem('marble_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { if (isNode) mem[k] = JSON.stringify(v); else localStorage.setItem('marble_' + k, JSON.stringify(v)); } catch (e) { /* 저장 안 됨 */ } },
  };
  function load() {
    const m = Object.assign({ gold: 0, core: 0, nodes: {}, unlocked: [], cleared: {} }, store.get('meta', {}));
    if (!isNode && /[?&]unlock=all/.test(location.search)) { m.unlocked = Object.keys(UNLOCK); m.allOpen = true; }
    return m;
  }
  function save(m) { const c = Object.assign({}, m); delete c.allOpen; store.set('meta', c); }
  const lv = (m, k) => m.nodes[k] || 0;
  function treeLv(m, fam) { let s = 0; for (const k in m.nodes) if (k.startsWith(fam + '.')) s += m.nodes[k]; for (const t of (FAMS.find(f => f.id === fam) || { towers: [] }).towers) s += m.nodes['trait.' + t + '.g'] || 0; return s; }
  function owned(m, t) { return BASE.includes(t) || m.unlocked.includes(t); }

  function nodeInfo(m, fam, node) {
    const key = fam + '.' + node.id, cur = lv(m, key), tl = treeLv(m, fam);
    const locked = tl < (node.need || 0);
    const maxed = node.once ? cur >= 1 : cur >= node.max;
    const cost = node.once ? { core: node.core } : { gold: goldCost(cur) };
    return { key, cur, locked, maxed, cost, can: !locked && !maxed && (cost.core ? m.core >= cost.core : m.gold >= cost.gold) };
  }
  function buy(m, fam, nodeId) {
    const list = fam === 'common' ? COMMON_NODES : FAM_NODES;
    const node = list.find(n => n.id === nodeId); if (!node) return false;
    const info = nodeInfo(m, fam, node); if (!info.can) return false;
    if (info.cost.core) m.core -= info.cost.core; else m.gold -= info.cost.gold;
    m.nodes[info.key] = info.cur + 1; save(m); return true;
  }
  function unlock(m, t) {
    const u = UNLOCK[t]; if (!u || owned(m, t)) return false;
    const fam = FAM_OF[t];
    if (!u.common && treeLv(m, fam) < u.lv) return false;
    if (m.core < u.core) return false;
    m.core -= u.core; m.unlocked.push(t); save(m); return true;
  }
  // [v4.6] 해금 조건(나무 Lv + 코어) — 덱 화면에서 '코어'만 보여 '코어를 올려도 안 열린다'는 혼란이 있었다
  function unlockNeed(m, t) {
    const u = UNLOCK[t]; if (!u) return null;
    const fam = FAM_OF[t], lvNow = u.common ? 0 : treeLv(m, fam);
    return { fam, lv: u.common ? 0 : u.lv, lvNow, core: u.core, lvOk: u.common || lvNow >= u.lv, coreOk: m.core >= u.core };
  }
  function traitInfo(m, t) {
    const g = m.nodes['trait.' + t + '.g'] || 0, s1 = !!m.nodes['trait.' + t + '.s1'], s2 = !!m.nodes['trait.' + t + '.s2'];
    return { g, s1, s2, gCost: traitCost(g), s1Cost: { gold: 20000, core: 10 }, s2Cost: { gold: 50000, core: 20 } };
  }
  function buyTrait(m, t, slot) {
    if (!owned(m, t)) return false;
    const ti = traitInfo(m, t);
    if (slot === 'g') { if (ti.g >= 30 || m.gold < ti.gCost) return false; m.gold -= ti.gCost; m.nodes['trait.' + t + '.g'] = ti.g + 1; }
    else {
      const need = slot === 's1' ? 10 : 20, c = slot === 's1' ? ti.s1Cost : ti.s2Cost;
      if (ti[slot] || ti.g < need || m.gold < c.gold || m.core < c.core) return false;
      m.gold -= c.gold; m.core -= c.core; m.nodes['trait.' + t + '.' + slot] = 1;
    }
    save(m); return true;
  }
  function setFork(m, fam, pick) {
    const key = 'fork.' + fam;
    if (!m.nodes[key]) { if (treeLv(m, fam) < 20 || m.core < 10) return false; m.core -= 10; }
    m.nodes[key] = pick; save(m); return true;
  }
  // 판에 넘길 보너스
  function bonus(m) {
    const b = { dmg: {}, aps: {}, crit: {}, startGold: 0, life: 0, rules: [], vault: false, cdCut: 0, salary: 0, freeRolls: 0, trait: {}, sp: {}, fork: {} };
    for (const f of FAMS) {
      b.dmg[f.id] = lv(m, f.id + '.dmg') * 0.025; b.aps[f.id] = lv(m, f.id + '.aps') * 0.015; b.crit[f.id] = lv(m, f.id + '.crit') * 0.005;
      if (lv(m, f.id + '.gold0')) b.startGold += 30;
      if (lv(m, f.id + '.life')) b.life += 3;
      if (lv(m, f.id + '.rule')) b.rules.push(f.id);
    }
    b.trait = {}; b.sp = {};
    for (const t of D.ALL) { const g = m.nodes['trait.' + t + '.g'] || 0; b.trait[t] = g * 0.015; const sp = []; if (m.nodes['trait.' + t + '.s1']) sp.push(TRAIT_SP[t][0][0]); if (m.nodes['trait.' + t + '.s2']) sp.push(TRAIT_SP[t][1][0]); b.sp[t] = sp; }
    b.fork = {}; for (const f of FAMS) { const p = m.nodes['fork.' + f.id]; if (p) b.fork[FORKS[f.id][p - 1][0]] = true; }
    if (b.fork.abyssLife) b.life += 4;
    b.vault = !!lv(m, 'common.vault'); b.cdCut = lv(m, 'common.cdcut') ? 15 : 0; b.salary = lv(m, 'common.salary') * 0.05; b.freeRolls = lv(m, 'common.roll') ? 3 : 0;
    return b;
  }
  // 판 보상(기획 11장)
  function reward(m, g) {
    const ch = g.chapter || 1, dm = { normal: 1, hard: 1.5, hell: 2 }[g.diff] || 1;
    const win = g.over === 'win';
    let gold = Math.round((300 + ch * 150 + g.stats.kills) * dm), core = 3 + ch;
    const key = ch + '_' + (g.diff || 'normal');
    const first = win && !m.cleared[key];
    if (first) core *= 3;
    if (!win) { const k = Math.min(1, g.round / 20) * 0.5; gold = Math.round(gold * k); core = Math.floor(core * k); }
    if (g.mode === 'endless') { gold = Math.round((200 + g.stats.kills * 1.2) * dm); core = 2 + Math.floor(g.round / 5); }
    if (win) m.cleared[key] = Math.max(m.cleared[key] || 0, g.stars());
    m.gold += gold; m.core += core; save(m);
    return { gold, core, first };
  }

  const META = { TRAIT_SP, FORKS, traitInfo, buyTrait, setFork, traitCost, FAMS, FAM_OF, BASE, UNLOCK, RULES, FAM_NODES, COMMON_NODES, CHAPTERS, goldCost, load, save, lv, treeLv, owned, nodeInfo, buy, unlock, unlockNeed, bonus, reward };
  if (isNode) module.exports = META; else root.META = META;
})(typeof window !== 'undefined' ? window : globalThis);
