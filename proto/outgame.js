// [v5.4 시안] 아웃게임 디자인 다시(테두리 실선 걷기 · 탭마다 분위기 · 상점 · 설정 · 소리 · 개발 도구 · 성장 탭 포탑 보기 · 시작 주사위 손맛 · 폰 세로 채우기) — v5.3 위에
// [v5.3 시안] 아웃게임(시작 = 실제 판 · 진입 로딩 + 덱 펼침 · 첫 로딩 · 주사위 안착 · 덱 틀고정 — v5.2 위에)
// v5.2 → v5.3: 시작을 누르면 본편 판(../index.html?embed=1)을 이 창 안에서 열고, 판이 끝나면 실제 결과(승패 · 별 · 처치 · 시간)로 결과 화면.
//              ?noboot=1 = 첫 로딩 건너뛰기(검수용) · OG.game() = 판 iframe — 모든 단추가 실제로 동작하는 시안. 본편 데이터(DATA · META · GEOM)를 그대로 읽는다.
// 화면 바로 열기: outgame.html?s=home|map|deck|tower|grow|collect|shop|pass|quest|attend|result|profile  · ?reset=1 = 처음 상태
// v5.0 → v5.1: 판 배경을 본편 렌더러 그림(proto/img/hb_*.jpg)으로 · 홈 판 위 주사위/말/칸 정보 동작 · 출석판 굴리기 동작 ·
//              모든 단추 연결(구매 · 받기 · 장착 · 덱 바꾸기 · 나무 · 설정 …) · 손가락을 빼면 취소되는 누름 처리 · 목록 스크롤.
// 저장은 이 시안 전용 localStorage 'mdog51'(본편 저장 'marble_meta'는 건드리지 않는다).
(function () {
  const D = window.DATA, M = window.META, G = window.GEOM;
  const IMG = '../assets/img/', PIMG = 'img/';
  const fmt = n => Math.floor(n).toLocaleString('ko-KR');
  const og = (k, cls) => `<img class="${cls == null ? 'ico' : cls}" src="${PIMG}og_${k}.png" alt="">`;
  const coin = cls => `<img class="${cls == null ? 'ico' : cls}" src="${IMG}i_coin.png" alt="">`;
  const tw = (k, t) => `${IMG}t_${k}_${t || 1}.png`;
  const FAMC = D.FAMC;   // [v5.5] 계열 색은 본편 data.js 한 곳에서
  const fc = k => FAMC[D.TOWERS[k].fam] || '#aaa';
  const tname = k => D.TOWERS[k].name;
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  const flatDie = (v, cls) => `<span class="die ${cls || ''}">${PIPS[v].map(p => `<i style="grid-area:${Math.ceil(p / 3)}/${(p - 1) % 3 + 1}"></i>`).join('')}</span>`;
  const B = (act, arg, cls, inner) => `<button class="${cls || ''}" data-act="${act}"${arg != null ? ` data-arg="${arg}"` : ''}>${inner}</button>`;
  const DIFFS = ['normal', 'hard', 'hell'], DIFFN = ['보통', '어려움', '지옥'];

  // ------------------------------------------------------------ 쿼터뷰 주사위(본편 isoDie와 같은 모양 · SVG라 크기를 바꿔도 매끈)
  // 스킨별 색: [윗면, 왼면, 오른면, 눈, 1의 눈]
  const SKIN = { basic: ['#fffaf0', '#eadfc8', '#d2c1a2', '#2b1426', '#d8283a'], gold: ['#ffe27a', '#e8b030', '#c88a18', '#6a3000', '#c0201a'], ice: ['#e4f8ff', '#a8dcf4', '#7cbce0', '#1a5a8a', '#1a5a8a'],
    lava: ['#5a2a22', '#3a1a16', '#2a100c', '#ffb02e', '#ff6a1a'], star: ['#4a3aa8', '#2e2478', '#1e1650', '#fff6c0', '#ffe27a'], wood: ['#d8a468', '#b07a44', '#8a5a2a', '#4a2a10', '#7a1a10'],
    jelly: ['#ffb0da', '#f080b8', '#d0609a', '#ffffff', '#ffffff'], marble: ['#f4f6ff', '#d4daec', '#b4bcd4', '#3a4a8a', '#3a4a8a'], candy: ['#fff0f6', '#ffc0d4', '#f090b0', '#c0204a', '#c0204a'] };
  function isoDie(top, skin) {
    const C = SKIN[skin === true ? 'gold' : skin || 'basic'] || SKIN.basic;
    const faces = [['M32 4 L60 18 L32 32 L4 18Z', [32, 4], [28, 14], [-28, 14], C[0], top],
      ['M4 18 L32 32 L32 64 L4 50Z', [4, 18], [28, 14], [0, 32], C[1], (top % 6) + 1],
      ['M32 32 L60 18 L60 50 L32 64Z', [32, 32], [28, -14], [0, 32], C[2], ((top + 2) % 6) + 1]];
    let s = '<svg viewBox="0 0 64 68">';
    faces.forEach(([d, o, u, v, col, val], fi) => {
      s += `<path d="${d}" fill="${col}" stroke="#2b1426" stroke-width="2.6" stroke-linejoin="round"/>`;
      if (fi === 0) s += `<path d="M32 7 L55 18.5 L32 15 L9 18.5Z" fill="#fff" opacity=".28"/>`;
      s += `<g transform="matrix(${u[0]},${u[1]},${v[0]},${v[1]},${o[0]},${o[1]})">`;
      for (const p of PIPS[val]) { const cu = 0.2 + ((p - 1) % 3) * 0.3, cv = 0.2 + Math.floor((p - 1) / 3) * 0.3; s += `<circle cx="${cu}" cy="${cv}" r="${val === 1 && fi === 0 ? 0.13 : 0.085}" fill="${val === 1 ? C[4] : C[3]}"/>`; }
      s += '</g>';
    });
    return s + '</svg>';
  }

  // ------------------------------------------------------------ 시작 주사위(v5.2): 더블이면 시작 혜택 · 눈이 클수록 좋음 · 연속 꽝 보정
  // 기본 더블 20%(진짜 주사위 16.7%) · 꽝 1번마다 +4%p(최대 60%) · 7번 연속 꽝이면 8번째는 꼭 더블 → 실제 약 28%(3~4판에 1번), 6·6 약 56판에 1번
  const DBL = [[1, 6, '금화 +20', { gold: 20 }], [2, 5, '금화 +40', { gold: 40 }], [3, 4.5, '무료 굴리기 3번', { free: 3 }], [4, 4, '황금 주사위 1 + 금화 +40', { gdice: 1, gold: 40 }],
    [5, 3, '무료 굴리기 5번 + 황금 주사위 1', { free: 5, gdice: 1 }], [6, 1.5, '황금 주사위 2 + 무료 굴리기 5번 + 금화 +100', { gdice: 2, free: 5, gold: 100 }]];
  const DBL_W = DBL.reduce((a, d) => a + d[1], 0), DBL_BASE = 20, DBL_STEP = 4, DBL_SURE = 7;
  const dblChance = miss => miss >= DBL_SURE ? 100 : Math.min(60, DBL_BASE + DBL_STEP * miss);
  function rollStart(miss, rnd) {
    rnd = rnd || Math.random;
    if (rnd() * 100 < dblChance(miss)) { let r = rnd() * DBL_W; for (const d of DBL) if ((r -= d[1]) < 0) return [d[0], d[0]]; return [6, 6]; }
    const a = 1 + Math.floor(rnd() * 6); let b; do b = 1 + Math.floor(rnd() * 6); while (b === a); return [a, b];
  }

  // ------------------------------------------------------------ 상태(가상의 '열흘째 사용자')
  const BASE_STATE = () => ({
    name: '또소리', lv: 12, xp: 430, gold: 18420, core: 37, gem: 260,
    pawn: 'car', cmd: 'gambler', chapter: 2, diff: 'normal',
    decks: [D.DECK.slice(), D.PRESETS[1].deck.slice(), D.DECK.slice()], deckIdx: 0, slot3: false,
    stars: { 1: [3, 2, 0], 2: [0, 0, 0], 3: [0, 0, 0], 4: [0, 0, 0], 5: [0, 0, 0], 6: [0, 0, 0] },
    unlocked: [], nodes: { 'trait.fire.g': 8, 'trait.gatling.g': 5, 'trait.bolt.g': 12, 'trait.light.g': 3, 'trait.tyrant.g': 6, 'trait.ice.g': 2, 'trait.railgun.g': 1,
      'arc.dmg': 7, 'arc.aps': 4, 'arc.crit': 1, 'arc.gold0': 1, 'elem.dmg': 3, 'mech.dmg': 2, 'holy.dmg': 2, 'abyss.dmg': 4 },
    att: { day: 10, rolled: false, pos: 9, got: [1, 2, 3, 4, 5, 7, 8], claimed: { 7: true } },
    starChest: {},
    daily: [{ id: 'play', n: '판 2번 하기', cur: 1, max: 2, rw: { gold: 300 }, ic: 'gdice' }, { id: 'tier4', n: '4단계 포탑 3개 만들기', cur: 3, max: 3, rw: { core: 3 }, ic: 'tier4' }, { id: 'key', n: '황금열쇠 칸에 2번 멈추기', cur: 0, max: 2, rw: { gold: 300 }, ic: 'key', sub: '말을 굴려 열쇠 칸에 멈춰요' }],
    dailyGot: {}, dailyChest: false,
    weekly: [{ id: 'w1', n: '판 10번 하기', cur: 10, max: 10, rw: { gem: 30 } }, { id: 'w2', n: '보스 20마리 잡기', cur: 12, max: 20, rw: { core: 10 } }, { id: 'w3', n: '포탑 300번 합치기', cur: 140, max: 300, rw: { gold: 3000 } }, { id: 'w4', n: '출동 100번', cur: 66, max: 100, rw: { gem: 20 } }],
    weeklyGot: {},
    ach: [{ id: 'a1', n: '6단계 포탑 10개 만들기', cur: 9, max: 10, rw: { gem: 50, title: '전설 제작자' } }, { id: 'a2', n: '보스 8종 모두 잡기', cur: 6, max: 8, rw: { core: 20 }, sub: '남은 보스: 마술사 · 사기꾼' }, { id: 'a3', n: '판 30번 이기기', cur: 30, max: 30, rw: { gem: 30 } }, { id: 'a4', n: '출석 28일', cur: 10, max: 28, rw: { dice: 'wood' } }],
    achGot: {},
    pass: { lv: 7, star: 82, premium: false, gotF: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }, gotP: {} },
    shop: { free: false, goldBuy: 0, coreBuy: false, vip: false },
    own: { dice: ['basic'], pawn: ['car', 'dog', 'hat'], title: ['초보 정복자', '번개 마스터'] },
    eq: { dice: 'basic', board: 0, title: '번개 마스터' },
    mail: [{ id: 'm1', t: '업데이트 선물', d: '7일 남음', rw: { gem: 100 } }, { id: 'm2', t: '출석 7일 상자', d: '받지 않은 보상', rw: { gold: 3000 } }, { id: 'm3', t: '친구 초대 보상', d: '친구 1명 · 30일 남음', rw: { core: 5 } }],
    set: { sfx: 1, bgm: 1, haptic: 1, dmg: 1, shake: 0 },
    rec: { games: 38, wins: 25, best: 1284, six: 9 }, miss: 1,
  });
  let S;
  try { S = /[?&]reset=1/.test(location.search) ? null : JSON.parse(localStorage.getItem('mdog51') || 'null'); } catch (e) { S = null; }
  if (!S || !S.att) S = BASE_STATE();
  if (S.miss == null) S.miss = 0;
  // [v5.4] 로비 소리: 배경음(본편 bgm_lobby) · 단추 톡 · 주사위 · 혜택. 폰은 첫 터치 때 켜진다(자동 재생 막힘). 판에 들어가면 멈추고 나오면 다시
  const SFXD = '../assets/sfx/';
  // [v5.7] 아이폰에서 로비가 무음이던 원인: 첫 터치를 pointerdown에서 받았는데, 터치의 pointerdown은 '소리 허용 동작'이 아니다(HTML 규칙 — pointerup · touchend · click만).
  //   그래서 play()가 조용히 거절되고 unlocked = true라 다시 시도도 안 했음 → pointerup · touchend · click에서 켜고, 실제로 재생될 때까지 터치마다 다시 시도.
  //   효과음도 같은 이유로 새 Audio()가 막히므로 Web Audio 버퍼로 냄(한 번 열린 AudioContext는 계속 쓸 수 있음)
  const SND = {
    unlocked: false, ctx: null, bgm: null, playing: false, buf: {},
    unlock() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } }
      const c = this.ctx;
      if (c) { if (c.state !== 'running') { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) { /* 무시 */ } }
      this.unlocked = true;
      this.music(true);
      if (c && !this.loaded) { this.loaded = 1; ['card', 'dice', 'coin', 'build', 'jackpot', 'tierup', 'merge'].forEach(n => fetch(SFXD + n + '.mp3').then(r => r.arrayBuffer()).then(ab => new Promise((ok, no) => c.decodeAudioData(ab, ok, no))).then(b => { this.buf[n] = b; }).catch(() => {})); }
    },
    music(gesture) {
      if (!this.unlocked) return;
      const want = S.set.bgm && !ui.inGame && !document.hidden;
      if (!this.bgm) { this.bgm = new Audio(SFXD + 'bgm_lobby.mp3'); this.bgm.loop = true; this.bgm.volume = 1; this.bgm.preload = 'auto'; this.bgm.addEventListener('playing', () => { this.playing = true; }); this.bgm.addEventListener('pause', () => { this.playing = false; }); }   // [v5.6] 크기는 파일에 구움(아이폰은 volume이 안 먹음)
      if (want) { if (!this.playing || gesture) { const pr = this.bgm.play(); if (pr && pr.catch) pr.catch(() => {}); } } else this.bgm.pause();
    },
    play(n, vol) {
      if (!this.unlocked || !S.set.sfx) return;
      const c = this.ctx, b = this.buf[n];
      if (c && b && c.state === 'running') { try { const s = c.createBufferSource(), g = c.createGain(); g.gain.value = vol == null ? 0.6 : vol; s.buffer = b; s.connect(g); g.connect(c.destination); s.start(0); return; } catch (e) { /* 아래로 */ } }
      try { const a = new Audio(SFXD + n + '.mp3'); a.volume = vol == null ? 0.6 : vol; const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* 소리 없음 */ }
    },
    tone(f, f2, d, v, wave) { const c = this.ctx; if (!c || !S.set.sfx) return; if (c.state === 'suspended') c.resume(); const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = wave || 'triangle'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v || 0.08, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.05); },
    click() { this.tone(520, 700, 0.07, 0.07); },
  };
  document.addEventListener('visibilitychange', () => SND.music());
  const save = () => { try { localStorage.setItem('mdog51', JSON.stringify(S)); } catch (e) { /* 저장 안 됨 — 시안은 그대로 동작 */ } };
  const ui = { screen: 'home', modal: null, scroll: {}, hpawn: 0, hrolled: false, tier: {}, famTab: 'arc', colTab: 'dice', qTab: 'daily', chipFam: 'all', swap: null, bubble: null, flash: null, lastRes: null, busy: false, bump: {} };

  // ------------------------------------------------------------ 규칙(본편 META 함수 중 저장 안 하는 것만 사용)
  const deck = () => S.decks[S.deckIdx];
  const owned = t => M.BASE.includes(t) || S.unlocked.includes(t);
  const tgl = t => S.nodes['trait.' + t + '.g'] || 0;
  const m = () => ({ gold: S.gold, core: S.core, nodes: S.nodes, unlocked: S.unlocked });
  const treeLv = fam => M.treeLv(m(), fam);
  const chOpen = n => n === 1 || S.stars[n - 1][0] > 0;
  const diffOpen = (n, d) => d === 0 ? chOpen(n) : d === 1 ? S.stars[n][0] > 0 : S.stars[3][0] > 0;
  const diffNeed = (n, d) => d === 1 ? `${n}장 보통 클리어` : '3장 보통 클리어';
  const starSum = () => Object.values(S.stars).reduce((a, s) => a + s[0] + s[1] + s[2], 0);
  const xpNeed = () => 60 * S.lv;
  const PASS_STEP = 150;
  function passRw(i, prem) {
    if (!prem) { if (i === 30) return { core: 30 }; return [{ chest: 1 }, { gold: 1500 }, { core: 3 }, { gold: 2000 }, { gem: 20 }][i % 5]; }
    const sp = { 6: { title: '단풍놀이' }, 9: { pawn: 'cat' }, 15: { dice: 'ice' }, 22: { pawn: 'boot' }, 30: { dice: 'star', title: '가을의 주인' } }[i];
    return sp || [{ gem: 50 }, { core: 8 }, { gold: 4000 }, { gem: 80 }, { bigchest: 1 }][i % 5];
  }
  const DICE = [['basic', '기본', '', '처음부터'], ['gold', '황금', 'gold', '1장 지옥 클리어'], ['ice', '얼음', 'ice', '패스 15단계(프리미엄)'], ['lava', '용암', 'lava', '3장 별 9개'], ['star', '별빛', 'star', '패스 30단계(프리미엄)'], ['wood', '나무', 'wood', '업적 · 출석 28일'], ['jelly', '젤리', 'jelly', '상점 · 보석 300', 300], ['marble', '대리석', 'marble', '업적 · 6단계 100번'], ['candy', '사탕', 'candy', '이벤트 · 겨울 축제']];
  const PAWN_HOW = { cat: '패스 9단계(프리미엄) · 상점 보석 200', boat: '4장 보통 클리어', boot: '패스 22단계(프리미엄)' };
  const TITLES = [['초보 정복자', '1장 보통 클리어'], ['번개 마스터', '번개탑 특성 Lv10'], ['전설 제작자', '업적 · 6단계 10개'], ['단풍놀이', '패스 6단계(프리미엄)'], ['가을의 주인', '패스 30단계(프리미엄)'], ['설원의 정복자', '2장 별 9개']];
  const PAIR = { bolt: ['ice', 'combo', 'light'], fire: ['ice', 'corrode', 'light'], ice: ['fire', 'bolt', 'railgun'], gatling: ['beacon', 'light', 'summon'], light: ['gatling', 'bolt', 'fire'], tyrant: ['light', 'beacon', 'growth'] };
  const PAIRWHY = { ice: '얼린 적에게 오래 맞힘', combo: '공격마다 콤보 +1', light: '공속 버프', corrode: '방어를 깎아 화상이 더 아픔', fire: '얼음+불 반응 피해', bolt: '연쇄가 얼린 적에게 머묾', railgun: '멈춘 적을 관통', beacon: '드러낸 적에게 출동', summon: '같이 출동', growth: '혼자 있어도 커짐' };

  function grant(rw) {
    const out = [];
    if (rw.gold) { S.gold += rw.gold; out.push([coin(''), fmt(rw.gold)]); ui.bump.gold = 1; }
    if (rw.core) { S.core += rw.core; out.push([og('core', ''), rw.core]); ui.bump.core = 1; }
    if (rw.gem) { S.gem += rw.gem; out.push([og('gem', ''), rw.gem]); ui.bump.gem = 1; }
    if (rw.chest) { S.gold += 3000; S.core += 5; out.push([og('chest', ''), '상자']); out.push([coin(''), '3,000']); out.push([og('core', ''), 5]); ui.bump.gold = ui.bump.core = 1; }
    if (rw.bigchest) { S.gem += 30; S.core += 10; out.push([og('chestopen', ''), '큰 상자']); out.push([og('gem', ''), 30]); out.push([og('core', ''), 10]); ui.bump.gem = ui.bump.core = 1; }
    if (rw.passStar) { addPass(rw.passStar); out.push([og('pass', ''), '패스 별 ' + rw.passStar]); }
    if (rw.dice && !S.own.dice.includes(rw.dice)) { S.own.dice.push(rw.dice); const d = DICE.find(x => x[0] === rw.dice); out.push([`<span class="dice2" style="transform:scale(.6)">${flatDie(5, d[2])}</span>`, d[1] + ' 주사위']); }
    if (rw.pawn && !S.own.pawn.includes(rw.pawn)) { S.own.pawn.push(rw.pawn); out.push([`<img src="${IMG}p_${rw.pawn}.png" style="width:44px;height:70px;object-fit:contain" alt="">`, D.PAWNS[rw.pawn].name]); }
    if (rw.title && !S.own.title.includes(rw.title)) { S.own.title.push(rw.title); out.push([og('trophy', ''), '칭호']); }
    return out;
  }
  function rwLabel(rw) {
    if (rw.gold) return [coin(), fmt(rw.gold)]; if (rw.core) return [og('core'), rw.core]; if (rw.gem) return [og('gem'), rw.gem];
    if (rw.chest) return [og('chest'), '상자']; if (rw.bigchest) return [og('chestopen'), '큰 상자'];
    if (rw.dice) { const d = DICE.find(x => x[0] === rw.dice); return [`<span class="dice2" style="transform:scale(.5);margin:-18px -22px">${flatDie(4, d[2])}</span>`, d[1] + ' 주사위']; }
    if (rw.pawn) return [`<img src="${IMG}p_${rw.pawn}.png" style="width:34px;height:56px;object-fit:contain" alt="">`, D.PAWNS[rw.pawn].name.replace(' 말', '')];
    if (rw.title) return [og('trophy'), '칭호'];
    if (rw.passStar) return [og('pass'), '별 ' + rw.passStar];
    return ['', ''];
  }
  function addPass(n) { S.pass.star += n; while (S.pass.star >= PASS_STEP && S.pass.lv < 30) { S.pass.star -= PASS_STEP; S.pass.lv++; } }
  function addXp(n) { S.xp += n; let up = 0; while (S.xp >= xpNeed()) { S.xp -= xpNeed(); S.lv++; S.gem += 20; up++; } return up; }

  // 빨간 점(받을 것이 있을 때만)
  const passCan = () => { let n = 0; for (let i = 1; i <= S.pass.lv; i++) { if (!S.pass.gotF[i]) n++; if (S.pass.premium && !S.pass.gotP[i]) n++; } return n; };
  const dailyDone = () => S.daily.filter(q => q.cur >= q.max).length;
  const questCan = () => S.daily.filter(q => q.cur >= q.max && !S.dailyGot[q.id]).length + (dailyDone() === 3 && !S.dailyChest ? 1 : 0) + S.weekly.filter(q => q.cur >= q.max && !S.weeklyGot[q.id]).length + S.ach.filter(q => q.cur >= q.max && !S.achGot[q.id]).length;
  const canOpenTower = () => Object.keys(M.UNLOCK).filter(t => !owned(t) && (M.UNLOCK[t].common || treeLv(M.FAM_OF[t]) >= M.UNLOCK[t].lv) && S.core >= M.UNLOCK[t].core);
  const dot = n => n ? `<span class="dot">${n === true ? '!' : n}</span>` : '';

  // ------------------------------------------------------------ 공용 조각
  const topbar = () => `<div class="topbar">
    ${B('go', 'profile', 'prof panel', `<div class="face"><img src="${IMG}p_${S.pawn}.png" alt=""></div><div><div class="nm">${S.name}</div><div class="lv">Lv ${S.lv} <span class="bar blue"><i style="width:${S.xp / xpNeed() * 100}%"></i></span></div></div>`)}
    ${B('curInfo', 'gold', 'cur' + (ui.bump.gold ? ' bump' : ''), `${coin()}<b>${fmt(S.gold)}</b>`)}
    ${B('curInfo', 'core', 'cur' + (ui.bump.core ? ' bump' : ''), `${og('core')}<b>${S.core}</b>`)}
    ${B('curInfo', 'gem', 'cur' + (ui.bump.gem ? ' bump' : ''), `${og('gem')}<b>${fmt(S.gem)}</b><span class="plus">+</span>`)}
    ${B('settings', null, 'gear', '<svg viewBox="0 0 32 32"><path fill="#e8e2ff" d="M18.6 2l.7 3.6c.9.3 1.8.7 2.6 1.2l3.1-2 3.7 3.7-2 3.1c.5.8.9 1.7 1.2 2.6l3.6.7v5.2l-3.6.7c-.3.9-.7 1.8-1.2 2.6l2 3.1-3.7 3.7-3.1-2c-.8.5-1.7.9-2.6 1.2L18.6 30h-5.2l-.7-3.6c-.9-.3-1.8-.7-2.6-1.2l-3.1 2-3.7-3.7 2-3.1c-.5-.8-.9-1.7-1.2-2.6L.5 18.6v-5.2l3.6-.7c.3-.9.7-1.8 1.2-2.6l-2-3.1 3.7-3.7 3.1 2c.8-.5 1.7-.9 2.6-1.2l.7-3.6h5.2z"/><circle cx="16" cy="16" r="5.2" fill="#3a3172"/></svg>')}
  </div>`;
  const TABS = [['shop', '상점'], ['deck', '덱'], ['home', '전투'], ['grow', '성장'], ['collect', '수집']];
  const tabs = cur => `<nav class="tabs">${TABS.map(([k, n]) => {
    const icon = k === 'deck' ? `<img class="ico" src="${tw('fire', 3)}" alt="">` : k === 'home' ? `<img class="ico" src="${IMG}i_gdice.png" alt="">` : k === 'grow' ? `<img class="ico" src="${IMG}k_seed.png" alt="">` : og(k === 'shop' ? 'shop' : 'palette');
    const d = k === 'shop' ? dot(!S.shop.free) : k === 'grow' ? dot(canOpenTower().length) : '';
    return B('go', k, `tab ${cur === k ? 'on' : ''}`, d + icon + n);
  }).join('')}</nav>`;
  const subhead = (title, back, cls) => `<div class="subhead">${B('go', back || 'home', 'back', '‹')}<div class="ribbon ${cls || ''}">${title}</div></div>`;

  // ------------------------------------------------------------ 홈 판 좌표(본편 판 좌표 → 화면)
  const HB = { k: 1.12, oy: 330 - G.plaza[1] * 1.12 };
  const hp = (x, y) => [360 + (x - 360) * HB.k, HB.oy + y * HB.k];
  function tileInfo(n, i) {
    const C = M.CHAPTERS[n - 1], cn = D.CORNER[i];
    if (cn) return { name: { start: '출발', island: '무인도', key: '황금열쇠', space: '우주여행' }[cn], desc: { start: '지나가면 월급을 받아요', island: `${C.island || 3}초 동안 쉬어요`, key: '카드 1장을 뽑아요', space: '다음에 원하는 칸으로 날아가요' }[cn], good: cn !== 'island' };
    const k = C.map[i];
    if (!k) return { name: '빈 땅', desc: '특별한 효과 없음 · 포탑을 지을 수 있어요', good: true };
    return { name: D.TRAITS[k].name, desc: D.TRAITS[k].desc, good: D.TRAITS[k].good };
  }

  // ------------------------------------------------------------ 1. 홈(v5.2 — 판 · 덱 줄을 빼고 가운데 큰 주사위 하나 · 시작 단추 하나)
  const CHTHEME = { 1: ['#ffb14a', '#7ab84a', '#3a2a16'], 2: ['#bfe6ff', '#6aa8d8', '#1c2a46'], 3: ['#ff6a3a', '#a02a1a', '#2a1214'], 4: ['#b8c4d8', '#6a7890', '#1e2230'], 5: ['#8fe08a', '#3a8a4a', '#16301e'], 6: ['#c08aff', '#7a3ad0', '#1e1036'] };
  function home() {
    const n = S.chapter, C = M.CHAPTERS[n - 1], open = chOpen(n), di = DIFFS.indexOf(S.diff), st = S.stars[n];
    const dOpen = diffOpen(n, di), ok = open && dOpen, pc = dblChance(S.miss || 0), last = ui.lastRoll;
    const face = last ? last.d : [5, 2];
    const startSub = !open ? `🔒 ${n - 1}장 보통을 깨면 열려요` : !dOpen ? `🔒 ${DIFFN[di]} = ${diffNeed(n, di)}` : '🎲 굴려서 더블이면 시작 혜택!';
    return `<div class="hbig">${C.name}</div>
    ${topbar()}
    <div class="sidecol l">
      ${B('go', 'attend', 'sbtn flat' + (S.att.rolled ? '' : ' glow'), `${og('attend')}${dot(!S.att.rolled)}출석판`)}
      ${B('go', 'quest', 'sbtn flat', `${og('quest')}${dot(questCan())}임무`)}
      ${B('mail', null, 'sbtn flat', `${og('mail')}${dot(S.mail.length)}우편`)}
    </div>
    <div class="sidecol r">
      ${B('go', 'pass', 'sbtn flat', `${og('pass')}${dot(passCan())}패스 ${S.pass.lv}`)}
      ${B('weekly', null, 'sbtn flat', `${og('trophy')}주간 도전`)}
      ${B('freeGift', null, 'sbtn flat', `${og('chestopen')}${dot(!S.shop.free)}오늘 무료`)}
    </div>
    <div class="dstage">
      <div class="pedestal"></div><i class="shadowd"></i><i class="ring"></i><i class="puff a"></i><i class="puff b"></i>
      ${B('dblInfo', null, 'bigdice', `<span id="bd1">${isoDie(face[0], S.eq.dice)}</span><span id="bd2">${isoDie(face[1], S.eq.dice)}</span>`)}
      <div class="lastroll">${last ? (last.d[0] === last.d[1] ? `지난 굴림 <b>${last.d[0]}·${last.d[1]} 더블</b>` : `지난 굴림 ${last.d[0]}·${last.d[1]}`) : '주사위를 누르면 혜택표'}</div>
    </div>
    ${B('dblInfo', null, 'luck', `<span class="k">더블 확률</span><span class="bar"><i style="width:${Math.min(100, pc)}%"></i></span><b>${pc}%</b>${S.miss ? `<span class="up">꽝 ${S.miss}번 · +${pc - DBL_BASE}%p</span>` : ''}`)}
    <div class="stagerow">
      ${B('chap', -1, 'arrow' + (n === 1 ? ' dim' : ''), '◀')}
      ${B('stagePick', null, 'stagecard panel soft' + (open ? '' : ' locked'), `<div class="n">${n}장 ${C.name}${open ? '' : ' 🔒'} <span class="dchip d${di}">${DIFFN[di]}</span></div><div class="st">${'★'.repeat(st[di])}<i>${'★'.repeat(3 - st[di])}</i> <span class="rule">${open ? C.rule : (n - 1) + '장 보통을 깨면 열려요'}</span></div>`)}
      ${B('chap', 1, 'arrow' + (n === 6 ? ' dim' : ''), '▶')}
    </div>
    <div class="startrow">
      ${B('coop', null, 'rbtn', '<span class="big">2P</span>협동')}
      ${B('start', null, 'btn startbtn ' + (ok ? 'green breath' : 'off'), `${ok ? '시작!' : '잠김'}<small>${startSub}</small>`)}
      ${B('endless', null, 'rbtn' + (chOpen(4) ? '' : ' lockd'), `<span class="big v">∞</span>${chOpen(4) ? '무한' : '🔒 무한'}`)}
    </div>
    ${B('dev', null, 'devbtn', 'DEV')}
    ${tabs('home')}`;
  }

  // ------------------------------------------------------------ 2. 모험 지도
  const thumbBg = (n, w, h) => { const sc = w / 900, cx = 720 * sc, cy = 790 * sc; return `background-image:url(${PIMG}hb_ch${n}.jpg);background-size:${1440 * sc}px auto;background-position:${(w / 2 - cx).toFixed(1)}px ${(h / 2 - cy).toFixed(1)}px`; };
  function map() {
    const pos = M.CHAPTERS.map((C, k) => [k % 2 ? 420 : 40, 932 - k * 134]);
    const total = starSum();
    const pts = pos.map(([x, y]) => [x + 130, y + 75]);
    let line = '';
    for (let k = 0; k < 5; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], done = chOpen(k + 2); line += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${done ? '#ffd23a' : '#6e68a8'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="2 22"/>`; }
    const nodes = M.CHAPTERS.map((C, k) => {
      const [x, y] = pos[k], st = S.stars[C.n], lock = !chOpen(C.n), cur = C.n === S.chapter;
      return B('mapNode', C.n, `stagenode ${lock ? 'lock' : ''} ${cur ? 'now' : ''}" style="left:${x}px;top:${y}px`,
        `${cur ? `<img class="here" src="${IMG}p_${S.pawn}.png" alt="">` : ''}
        <div class="thumb" style="${thumbBg(C.n, 236, 150)}">${lock ? '<span class="lockico">🔒</span>' : ''}</div>
        <div class="nm">${C.n}장 ${C.name}</div>
        ${lock ? `<div class="need">${C.n - 1}장 보통 클리어</div>` : `<div class="st3">★ ${st[0] + st[1] + st[2]}<i> / 9</i></div>`}`);
    }).join('');
    const ms = [9, 18, 27, 36, 45, 54];
    return `<div class="bgnavy"></div><svg class="mapline" viewBox="0 0 720 1280">${line}</svg>${nodes}
      ${subhead('모험 지도')}
      <div class="starbar panel soft"><div class="t"><span>${og('star')} 모은 별 · 별 상자</span><span><b>${total}</b> / 54</span></div>
        <div class="track"><div class="bar"><i style="width:${total / 54 * 100}%"></i></div>
        ${ms.map(v => B('starChest', v, `ms ${S.starChest[v] ? 'got' : total >= v ? 'can' : ''}" style="left:${v / 54 * 100}%`, `${og(v === 54 ? 'chestopen' : 'chest', '')}<em>${v}</em>${total >= v && !S.starChest[v] ? dot(true) : ''}`)).join('')}</div></div>
      <div class="endlesscard panel"><div class="inf">∞</div><div class="tx"><b>무한 토벌</b>끝없이 — 5라운드마다 보스 · 최고 ${fmt(S.rec.best)}마리<br>${chOpen(4) ? '지금 들어갈 수 있어요' : '3장 보통을 깨면 열려요'}</div>${B('endless', null, 'btn small ' + (chOpen(4) ? 'green' : 'off'), '입장')}</div>`;
  }

  // ------------------------------------------------------------ 3. 덱
  function deckScr() {
    const fams = ['all', '원소', '기계', '비전', '성역', '심연', '조커'];
    const list = D.ALL.filter(k => ui.chipFam === 'all' || D.TOWERS[k].fam === ui.chipFam);
    const sw = ui.swap;
    // [v5.3] 틀고정: 위(덱 5칸 · 지휘관 · 말 · 계열 칩)는 고정, 아래 포탑 목록만 스크롤(엑셀 '행 고정'처럼)
    return `<div class="bgnavy"></div>${topbar()}
    <div class="deckcol"><div class="deckfix">
      <div class="presetrow">${[0, 1, 2].map(i => B('deckTab', i, `ptab ${S.deckIdx === i ? 'on' : ''} ${i === 2 && !S.slot3 ? 'lock' : ''}`, `덱 ${i + 1}${i === 2 && !S.slot3 ? '<span class="gemc">🔒 보석 100</span>' : ''}`)).join('')}${B('preset', null, 'ptab', '추천 덱 ▾')}</div>
      ${sw ? `<div class="swapbar"><img src="${tw(sw, 3)}" alt=""><div class="tx"><b>${tname(sw)}</b> — 바꿀 칸을 누르세요</div>${B('swapCancel', null, 'btn small sec', '취소')}</div>` : ''}
      <div class="equip panel ${sw ? 'swap' : ''}">${deck().map((k, i) => B(sw ? 'swapTo' : 'tower', sw ? i : k, 'ecard" style="--fc:' + fc(k), `<span class="slotn">${i + 1}</span><img src="${tw(k, 3)}" alt=""><b>${tname(k).replace('탑', '')}</b><span class="tl">특성 Lv ${tgl(k)}</span>`)).join('')}</div>
      <div class="pair">
        <div class="pcard panel"><img src="${IMG}c_${S.cmd}.png" alt=""><div class="tx"><span class="k">지휘관</span><b>${D.COMMANDERS[S.cmd].name}</b>${D.COMMANDERS[S.cmd].act}</div>${B('pick', 'cmd', 'btn small sec', '바꾸기')}</div>
        <div class="pcard panel"><img src="${IMG}p_${S.pawn}.png" alt=""><div class="tx"><span class="k">말</span><b>${D.PAWNS[S.pawn].name}</b>${D.PAWNS[S.pawn].desc}</div>${B('pick', 'pawn', 'btn small sec', '바꾸기')}</div>
      </div></div>
      <div class="tray"><div class="trayhead"><div class="chips">${fams.map(f => B('chipFam', f, `chip ${ui.chipFam === f ? 'on' : ''}" style="--fc:${FAMC[f] || '#ffd23a'}`, f === 'all' ? `전체 ${D.ALL.length}` : f)).join('')}</div><span class="own">${D.ALL.filter(owned).length} / ${D.ALL.length} 보유</span></div>
      <div class="body tbody"><div class="towergrid">${list.map(k => {
        const own = owned(k), on = deck().includes(k), u = M.UNLOCK[k], can = !own && canOpenTower().includes(k);
        return B('tower', k, `tcard ${on ? 'on' : ''} ${own ? '' : 'lock'} ${can ? 'can' : ''}" style="--fc:${fc(k)}`, `${on ? '<span class="chk">✔</span>' : ''}${own ? '' : '<span class="lk">🔒</span>'}
          <img src="${tw(k, 3)}" alt=""><span class="nm">${tname(k).replace('탑', '')}</span>
          <span class="tl">${own ? `특성 Lv ${tgl(k)}` : can ? '열 수 있음!' : (u.common ? '' : `나무 Lv${u.lv} · `) + '코어 ' + u.core}</span>`);
      }).join('')}</div>
      <div class="note">포탑을 누르면 자세히 보고 <b>덱에 넣거나 강화</b>할 수 있어요. 덱은 언제나 5종이에요.</div>
    </div></div></div>
    ${tabs('deck')}`;
  }

  // 포탑 상세(아래 판)
  function towerSheet(md) {
    const k = md.k, T = D.TOWERS[k], own = owned(k), lv = tgl(k), t = ui.tier[k] || (own ? Math.min(6, 3 + Math.floor(lv / 10)) : 3), sp = M.TRAIT_SP[k];
    const s1 = !!S.nodes['trait.' + k + '.s1'], s2 = !!S.nodes['trait.' + k + '.s2'], inDeck = deck().includes(k);
    const pairs = (PAIR[k] || D.ALL.filter(q => q !== k && D.TOWERS[q].fam === T.fam).slice(0, 3)).slice(0, 3);
    const u = M.UNLOCK[k], need = !own && u ? M.unlockNeed(m(), k) : null;
    const foot = own
      ? `${inDeck ? B('toast', '이미 덱에 있어요. 다른 포탑을 넣으려면 그 포탑에서 \'덱에 넣기\'를 누르세요', 'btn sec', '✔ 덱에 있음') : B('swapStart', k, 'btn sec', '덱에 넣기')}
         ${lv >= 30 ? B('toast', '특성이 최대예요', 'btn off', '최대 Lv 30') : B('trait', k, 'btn green', `${coin()} 강화 ${fmt(M.traitCost(lv))}`)}`
      : B('unlock', k, 'btn ' + (need.lvOk && need.coreOk ? 'gold' : 'off'), `${og('core')} 코어 ${need.core}로 열기`);
    return `<div class="dim${md.anim ? ' in' : ''}" data-act="close"></div><div class="sheet${md.anim ? ' in' : ''}" style="--fc:${fc(k)}"><span class="grab"></span>${B('close', null, 'xbtn', '✕')}
      <div class="sbody">
      <div class="dhead"><div class="dpic ${own ? '' : 'lock'}"><span class="tg">${t}단계 ${D.TIER.name[t]}</span><img src="${tw(k, t)}" alt=""></div>
        <div class="dname"><span class="fam">${T.fam} 계열</span><h3>${T.name}</h3><p>${T.desc}</p></div></div>
      <div class="tiers">${[1, 2, 3, 4, 5, 6].map(n => B('tierView', k + ':' + n, `tier ${n === t ? 'on' : ''}`, `<i>${n}단계</i><img src="${tw(k, n)}" alt="">`)).join('')}</div>
      <div class="kv"><div><span>공격(1단계)</span>${T.atk}</div><div><span>공속</span>${T.aps}회/초</div><div><span>사거리</span>앞뒤 ${T.range || 2.5}칸</div></div>
      <div class="line"><b>출동</b>${D.STRIKE[k]}</div>
      <div class="line aw"><b>각성</b>${D.AWAKEN[k]}</div>
      ${own ? `<div class="sec-t">특성 3칸 <span class="r">강화는 이 포탑에만 · 모든 판에 적용</span></div>
      <div class="traits3">
        <div class="trs"><span class="k">일반 · 피해 +1.5%/Lv</span><br>Lv ${lv} / 30<div class="bar"><i style="width:${lv / 30 * 100}%"></i></div><i>지금 피해 +${(lv * 1.5).toFixed(1)}%</i></div>
        ${B('traitSp', k + ':s1', `trs ${s1 ? 'done' : lv >= 10 ? 'can' : 'lock'}`, `<span class="k">특수 ① · Lv10</span><br>${sp[0][1]}<div class="bar ${s1 ? 'green' : ''}"><i style="width:${s1 ? 100 : Math.min(100, lv * 10)}%"></i></div><i>${s1 ? '켜짐 ✔' : lv >= 10 ? '골드 2만 · 코어 10' : '일반 Lv10에 열림'}</i>`)}
        ${B('traitSp', k + ':s2', `trs ${s2 ? 'done' : lv >= 20 ? 'can' : 'lock'}`, `<span class="k">특수 ② · Lv20</span><br>${sp[1][1]}<div class="bar ${s2 ? 'green' : ''}"><i style="width:${s2 ? 100 : Math.min(100, lv * 5)}%"></i></div><i>${s2 ? '켜짐 ✔' : lv >= 20 ? '골드 5만 · 코어 20' : '일반 Lv20에 열림'}</i>`)}
      </div>` : `<div class="unlockbox">이 포탑 여는 법<br>${u.common ? '' : `<span class="${need.lvOk ? 'ok' : 'no'}">${need.lvOk ? '✔' : '✕'} ${M.FAMS.find(f => f.id === need.fam).name} 나무 Lv ${need.lv} (지금 ${need.lvNow})</span><br>`}<span class="${need.coreOk ? 'ok' : 'no'}">${need.coreOk ? '✔' : '✕'} 코어 ${need.core} (지금 ${S.core})</span></div>`}
      <div class="sec-t">잘 맞는 짝 <span class="r">같이 쓰면 좋아요</span></div>
      <div class="fav">${pairs.map(q => `<div><img src="${tw(q, 3)}" alt=""><span>${tname(q)}<small>${PAIRWHY[q] || '같은 계열'}</small></span></div>`).join('')}</div>
      </div>
      <div class="sfoot">${foot}</div>
    </div>`;
  }

  // ------------------------------------------------------------ 4. 성장
  const NODE_ICO = { dmg: '⚔', aps: '⚡', crit: '✦', gold0: '◎', life: '♥', rule: '❖', vault: '🏦', cdcut: '⏱', salary: '💰', roll: '🎲' };
  function grow() {
    const fam = ui.famTab;
    const tabsH = `<div class="famtabs">${M.FAMS.map(f => B('famTab', f.id, `famtab ${f.id === fam ? 'on' : ''}" style="--fc:${f.color}`, `${f.name}<small>Lv ${treeLv(f.id)}</small>${dot(canOpenTower().some(t => M.FAM_OF[t] === f.id))}`)).join('')}${B('famTab', 'common', `famtab ${fam === 'common' ? 'on' : ''}" style="--fc:#6ab0ff`, '공용<small>4칸</small>')}</div>`;
    if (fam === 'common') {
      return `<div class="bgnavy"></div>${topbar()}<div class="body top96">${tabsH}
        <div class="note">공용 칸은 <b>모든 계열</b>에 적용돼요. 나무 레벨 조건이 없어요.</div>
        <div class="nodes" style="--fc:#6ab0ff">${M.COMMON_NODES.map(nd => nodeRow('common', nd)).join('')}</div></div>${tabs('grow')}`;
    }
    const F = M.FAMS.find(f => f.id === fam), tl = treeLv(fam), col = F.color;
    const lockT = F.towers.find(t => !owned(t));
    let goal;
    if (lockT) { const nd = M.unlockNeed(m(), lockT), can = nd.lvOk && nd.coreOk; goal = `<div class="goal"><span class="tag">다음 목표</span><img src="${tw(lockT, 3)}" alt=""><div class="tx"><b>${tname(lockT)} 열기</b>나무 Lv${nd.lv} ${nd.lvOk ? '✔' : `(지금 ${tl})`} · 코어 ${nd.core} ${nd.coreOk ? '✔' : `(지금 ${S.core})`}${can ? ' — 지금 열 수 있어요' : ''}</div>${B('unlock', lockT, 'btn small ' + (can ? 'gold' : 'off'), `${og('core')} ${nd.core}`)}</div>`; }
    else { const nx = M.FAM_NODES.find(nd => !M.nodeInfo(m(), fam, nd).maxed && !M.nodeInfo(m(), fam, nd).locked); goal = `<div class="goal"><span class="tag">다음 목표</span>${og('star', '')}<div class="tx"><b>${nx ? nx.name + ' 올리기' : '나무 완성!'}</b>${F.name} 포탑 3종을 모두 열었어요</div></div>`; }
    const famT = F.towers.map(k => { const own = owned(k), lv = tgl(k), t = own ? Math.min(6, 3 + Math.floor(lv / 10)) : 0;
      return B('tower', k, `famtower ${own ? '' : 'lock'}" style="--fc:${fc(k)}`, `<span class="tierline">${[1, 2, 3, 4, 5, 6].map(n => `<i class="${n <= t ? 'on' : ''}"></i>`).join('')}</span><span class="see">${own ? '단계 · 특성 ›' : '여는 법 ›'}</span><img src="${tw(k, own ? Math.max(3, t) : 3)}" alt=""><b>${tname(k)}</b><small>${own ? `특성 Lv ${lv}` : '🔒 잠김'}</small>`); }).join('');
    return `<div class="bgnavy"></div>${topbar()}
    <div class="body top96">${tabsH}
      <div class="sec-t">${F.name} 포탑 ${F.towers.length}종 <span class="r">눌러서 1~6단계 · 특성 트리 보기</span></div>
      <div class="famtowers">${famT}</div>
      <div class="treehead panel" style="--fc:${col}"><div class="lvbig"><b>${tl}</b>나무 Lv</div>
        <div class="tx"><b>${F.name} 나무</b> = 아래 칸 레벨 + ${F.name} 포탑 특성 레벨의 합
          <div class="ladder">${[[5, '공속'], [10, '포탑'], [12, '금화'], [15, '치명'], [20, '갈림'], [30, '규칙']].map(([q, s]) => `<span class="${tl >= q ? 'ok' : ''}">${q} ${s}</span>`).join('')}</div></div></div>
      ${goal}
      <div class="sec-t">칸 ${B('treeReset', fam, 'btn small sec" style="margin-left:auto;order:3', '초기화(무료)')}</div>
      <div class="nodes" style="--fc:${col}">${M.FAM_NODES.map(nd => nodeRow(fam, nd)).join('')}</div>
      <div class="sec-t">갈림길 <span class="r">나무 Lv20 · 둘 중 하나 · 언제든 무료로 바꿈</span></div>
      <div class="forkrow" style="--fc:${col}">${M.FORKS[fam].map((f, k) => B('fork', fam + ':' + (k + 1), `fork ${S.nodes['fork.' + fam] === k + 1 ? 'on' : ''} ${tl < 20 ? 'lock' : ''}`, `<b>${'AB'[k]} · ${f[1]}</b>${tl < 20 ? '나무 Lv20에 열려요' : S.nodes['fork.' + fam] === k + 1 ? '고름 ✔' : S.nodes['fork.' + fam] ? '눌러서 바꾸기(무료)' : '처음 고를 때 코어 10'}`)).join('')}</div>
    </div>${tabs('grow')}`;
  }
  function nodeRow(fam, nd) {
    const info = M.nodeInfo(m(), fam, nd), nm = nd.rule ? '규칙 · ' + M.RULES[fam].name : nd.name;
    const desc = nd.rule ? M.RULES[fam].desc : nd.desc || (nd.once ? '1번만' : `${nd.per}${nd.unit} / Lv · 최대 ${nd.max}`);
    const btn = info.maxed ? B('toast', '이미 다 올렸어요', 'btn small sec', '완료 ✔') : info.locked ? B('toast', `나무 Lv${nd.need}에 열려요 (지금 ${treeLv(fam)})`, 'btn small off', `🔒 Lv${nd.need}`)
      : B('node', fam + ':' + nd.id, 'btn small ' + (info.can ? 'green' : 'off'), info.cost.core ? `${og('core')} ${info.cost.core}` : `${coin()} ${fmt(info.cost.gold)}`);
    return `<div class="node ${info.maxed ? 'max' : ''} ${info.locked ? 'lock' : ''}"><div class="nico">${NODE_ICO[nd.id] || '◆'}</div>
      <div class="tx"><b>${nm}</b>${desc}${nd.max > 1 ? `<div class="pips">${Array.from({ length: nd.max }, (_, j) => `<i class="${j < info.cur ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>${btn}</div>`;
  }

  // ------------------------------------------------------------ 5. 수집
  function collect() {
    const t = ui.colTab;
    const chips = `<div class="chips">${[['dice', '주사위'], ['pawn', '말'], ['board', '판 테마'], ['title', '칭호'], ['dex', '도감']].map(([k, n]) => B('colTab', k, `chip ${t === k ? 'on' : ''}`, n)).join('')}</div>`;
    let body = '';
    if (t === 'dice') body = `<div class="sec-t">주사위 <span class="r">${S.own.dice.length} / ${DICE.length} 보유 · 누르면 장착</span></div><div class="skins">${DICE.map(([id, n, c, how], k) => { const own = S.own.dice.includes(id), on = S.eq.dice === id; return B('equipDice', id, `skin ${on ? 'on' : ''} ${own ? '' : 'lock'}`, `${k === 4 ? '<span class="rar" style="color:#ffd23a">전설</span>' : k >= 5 ? '<span class="rar" style="color:#c9a8ff">희귀</span>' : ''}${on ? '<span class="badge">사용 중</span>' : own ? '' : '<span class="lk">🔒</span>'}<div class="vis"><div class="dice2">${flatDie(3, c)}${flatDie(5, c)}</div></div>${n}<span class="how">${own ? (on ? '장착됨' : '눌러서 장착') : how}</span>`); }).join('')}</div>`;
    else if (t === 'pawn') body = `<div class="sec-t">말 <span class="r">모습과 능력이 함께 바뀌어요</span></div><div class="skins">${Object.keys(D.PAWNS).map(id => { const own = S.own.pawn.includes(id), on = S.pawn === id; return B('equipPawn', id, `skin ${on ? 'on' : ''} ${own ? '' : 'lock'}`, `${on ? '<span class="badge">사용 중</span>' : own ? '' : '<span class="lk">🔒</span>'}<div class="vis"><img src="${IMG}p_${id}.png" alt=""></div>${D.PAWNS[id].name}<span class="how">${own ? D.PAWNS[id].desc.slice(0, 18) + '…' : PAWN_HOW[id] || '이벤트'}</span>`); }).join('')}</div>`;
    else if (t === 'board') body = `<div class="sec-t">판 테마 <span class="r">깬 장의 판을 다른 장에서도</span></div><div class="skins">${B('equipBoard', 0, `skin board ${S.eq.board === 0 ? 'on' : ''}`, `${S.eq.board === 0 ? '<span class="badge">사용 중</span>' : ''}<div class="vis" style="display:flex;align-items:center;justify-content:center;font-size:40px">🗺</div>장마다 자동<span class="how">기본</span>`)}${M.CHAPTERS.map(C => { const own = S.stars[C.n][0] > 0, on = S.eq.board === C.n; return B('equipBoard', C.n, `skin board ${on ? 'on' : ''} ${own ? '' : 'lock'}`, `${on ? '<span class="badge">사용 중</span>' : own ? '' : '<span class="lk">🔒</span>'}<div class="vis" style="${thumbBg(C.n, 190, 120)}"></div>${C.name}<span class="how">${own ? '눌러서 장착' : C.n + '장 보통 클리어'}</span>`); }).join('')}</div>`;
    else if (t === 'title') body = `<div class="titles">${TITLES.map(([n, how]) => { const own = S.own.title.includes(n), on = S.eq.title === n; return B('equipTitle', n, `trow ${on ? 'on' : ''} ${own ? '' : 'lock'}`, `<span class="tt">${n}</span><span class="how">${own ? (on ? '사용 중 ✔' : '눌러서 달기') : '🔒 ' + how}</span>`); }).join('')}</div>`;
    else body = `<div class="sec-t">포탑 도감 <span class="r">${D.ALL.filter(owned).length} / ${D.ALL.length}</span></div><div class="towergrid">${D.ALL.map(k => B('tower', k, `tcard ${owned(k) ? '' : 'lock'}" style="--fc:${fc(k)}`, `${owned(k) ? '' : '<span class="lk">🔒</span>'}<img src="${tw(k, 6)}" alt="">${tname(k).replace('탑', '')}<span class="tl">${D.TOWERS[k].fam}</span>`)).join('')}</div>`;
    return `<div class="bgnavy"></div>${topbar()}<div class="body top96">${chips}${body}
      <div class="note">꾸미기는 <b>모습만</b> 바꿔요(말은 능력도 바뀜). 대부분 <b>플레이로</b> 얻고, 상점에서 파는 것은 일부뿐이에요.</div></div>${tabs('collect')}`;
  }

  // ------------------------------------------------------------ 6. 상점
  function shop() {
    const SI = n => `img/shop/${n}.png`;
    const won = n => `<span class="pr">₩${fmt(n)}</span>`, gemP = n => `<span class="pr gem">${og('gem')}${fmt(n)}</span>`;
    const card = (act, arg, cls, pic, am, pr, tg, bonus) => B(act, arg, `sitem ${cls || ''}`, `${tg ? `<span class="tg ${tg[1] || ''}">${tg[0]}</span>` : ''}${bonus ? `<span class="bonus">${bonus}</span>` : ''}<img class="pic" src="${pic}" alt=""><div class="am">${am}</div>${pr}`);
    const jelly = S.own.dice.includes('jelly'), cat = S.own.pawn.includes('cat'), st = S.shop.starter;
    const fl = ui.flash === 'gems' ? ' flash' : '';
    return `<div class="bgnavy"></div>${topbar()}
    <div class="body top96">
      ${B('buy', 'starter', 'shophero' + (st ? ' sold' : ''), `<img class="hpic" src="${SI('starter')}" alt="">
        <div class="htx"><span class="hk">한 번만 · 첫 구매 특가</span><h3>시작 꾸러미</h3>
          <div class="hl">보석 <b>500</b> · 골드 <b>3만</b> · 코어 <b>30</b><br>+ 황금 주사위 스킨</div>
          <div class="hbuy">${st ? '<span class="btn small off">구매 완료 ✔</span>' : `<span class="btn gold">₩4,900</span><span class="was">₩16,500</span>`}</div></div>
        ${st ? '' : '<span class="off">-70%<small>할인</small></span>'}<span class="timer">⏱ 2일 13시간 남음</span>`)}
      <div class="sec-t s-deal">오늘의 특가 <span class="r">매일 오전 9시 새로 고침</span></div>
      <div class="deals">
        ${card('freeGift', null, 'deal' + (S.shop.free ? ' sold' : ' hot') + (ui.flash === 'free' ? ' flash' : ''), SI('gift'), '골드 1,000<small>매일 무료</small>', S.shop.free ? '<span class="pr">받음 ✔</span>' : `<span class="pr ad">${og('ad')} 받기</span>`, S.shop.free ? null : ['무료', 'blue'])}
        ${card('buy', 'gold3k', 'gold' + (S.shop.goldBuy >= 3 ? ' sold' : ''), SI('gold2'), '골드 3,000', S.shop.goldBuy >= 3 ? '<span class="pr">오늘 끝</span>' : gemP(30), [`${3 - S.shop.goldBuy}/3`, ''])}
        ${card('buy', 'core5', 'deal' + (S.shop.coreBuy ? ' sold' : ''), PIMG + 'og_core.png', '코어 5', S.shop.coreBuy ? '<span class="pr">오늘 끝</span>' : gemP(40), ['하루 1번', 'gold'])}
      </div>
      <div class="sec-t s-gem" id="gems">보석 <span class="r">첫 구매는 2배</span></div>
      <div class="gemgrid">
        ${card('buy', 'gem80', 'gem t1' + fl, SI('gem1'), '보석 80', won(1200))}
        ${card('buy', 'gem500', 'gem t2' + fl, SI('gem2'), '보석 500<small>+50 보너스</small>', won(6500), ['첫 구매 ×2', ''])}
        ${card('buy', 'gem1200', 'gem t3 hot' + fl, SI('gem3'), '보석 1,200<small>+200 보너스</small>', won(15000), ['인기', ''])}
        ${card('buy', 'gem2500', 'gem t4' + fl, SI('gem4'), '보석 2,500<small>+500 보너스</small>', won(29000))}
        ${card('buy', 'gem6500', 'gem t5' + fl, SI('gem5'), '보석 6,500<small>+1,500 보너스</small>', won(69000), ['최고 가치', 'gold'])}
        ${card('buy', 'gem14000', 'gem t6' + fl, SI('gem6'), '보석 14,000<small>+4,000 보너스</small>', won(129000), null, '+40%')}
      </div>
      <div class="sec-t s-gold">골드</div>
      <div class="gemgrid">
        ${card('buy', 'gold12k', 'gold t1', SI('gold1'), '골드 12,000', gemP(100))}
        ${card('buy', 'gold40k', 'gold t3', SI('gold2'), '골드 40,000<small>+10%</small>', gemP(300), ['인기', ''])}
        ${card('buy', 'gold150k', 'gold t5', SI('gold3'), '골드 150,000<small>+25%</small>', gemP(1000), null, '+25%')}
      </div>
      <div class="sec-t">후원 회원</div>
      ${B('buy', 'vip', 'vipcard', `<img src="${SI('vip')}" alt=""><div class="tx"><b>후원 회원 · 30일</b>판 보상 +50% · 매일 보석 20<br>패스 별 +20% · 광고 없이 '오늘의 무료'</div><span class="btn ${S.shop.vip ? 'off' : 'gold'} small">${S.shop.vip ? '이용 중' : '₩5,900'}</span>`)}
      <div class="sec-t s-deco">꾸미기 · 편의 <span class="r">이번 주</span></div>
      <div class="gemgrid">
        ${B('buy', 'jelly', 'sitem deco t2' + (jelly ? ' sold' : ''), `<div class="pic" style="display:flex;align-items:center;justify-content:center;gap:6px">${isoDie(6, 'jelly')}${isoDie(2, 'jelly')}</div><div class="am">젤리 주사위</div>${jelly ? '<span class="pr">보유 ✔</span>' : gemP(300)}`)}
        ${B('buy', 'cat', 'sitem deco t2' + (cat ? ' sold' : ''), `<img class="pic" src="${IMG}p_cat.png" alt="" style="height:110px"><div class="am">보라 말</div>${cat ? '<span class="pr">보유 ✔</span>' : gemP(200)}`)}
        ${B('buy', 'slot3', 'sitem deco t2' + (S.slot3 ? ' sold' : ''), `<div class="pic" style="display:flex;align-items:flex-end;justify-content:center">${['fire', 'bolt', 'light'].map(q => `<img src="${tw(q, 3)}" style="width:52px;height:80px;object-fit:contain" alt="">`).join('')}</div><div class="am">덱 칸 3 열기</div>${S.slot3 ? '<span class="pr">열림 ✔</span>' : gemP(100)}`)}
      </div>
      <div class="shopfoot">시안에서는 실제 결제가 없어요 · 확률로 뽑는 상품은 팔지 않아요</div>
    </div>${tabs('shop')}`;
  }

  // ------------------------------------------------------------ 7. 패스
  function pass() {
    const P = S.pass;
    const cell = (i, prem) => {
      const rw = passRw(i, prem), [ic, tx] = rwLabel(rw), reach = i <= P.lv, got = prem ? P.gotP[i] : P.gotF[i];
      const st = got ? 'got' : reach && (!prem || P.premium) ? 'can' : '';
      return B('passClaim', (prem ? 'p' : 'f') + i, `prew ${prem ? 'p' : ''} ${st}`, `${ic}<span>${tx}</span><span class="st">${got ? '✔' : reach && prem && !P.premium ? '🔒' : st === 'can' ? '받기' : ''}</span>`);
    };
    const rows = []; for (let i = 1; i <= 30; i++) rows.push(`<div class="prow" ${i === Math.max(1, P.lv - 1) ? 'id="pcur"' : ''}>${cell(i, 0)}<div class="plv ${i <= P.lv ? 'ok' : ''}">${i}</div>${cell(i, 1)}</div>`);
    return `<div class="bgnavy"></div>${subhead('마블 패스', 'home', 'purple')}
    <div class="body" style="bottom:150px">
      <div class="passhead panel">${og('pass', '')}<div class="tx"><span class="k">1시즌 · 21일 남음</span><b>가을 단풍 축제</b><span class="k">30단계 · 단계마다 별 ${PASS_STEP}개</span></div><div class="lvb"><b>${P.lv}</b>단계</div></div>
      <div class="passxp">${og('star')}<div class="bar"><i style="width:${P.star / PASS_STEP * 100}%"></i></div><b style="color:var(--gold);font-weight:400">${P.star}</b>/${PASS_STEP}</div>
      <div class="passhow">별 얻는 곳 · 판 끝 20~60 · 일일 임무 30씩 · 주간 임무 100씩 · 결제해야 하는 임무 없음</div>
      ${passCan() ? `<div style="margin-top:10px">${B('passAll', null, 'btn small green', `받을 보상 ${passCan()}개 모두 받기`)}</div>` : ''}
      <div class="passcols"><div class="ch">무료</div><div></div><div class="ch p">프리미엄</div></div>
      <div class="passlist">${rows.join('')}</div>
    </div>
    <div class="passbuy panel">${P.premium ? '<div class="tx"><b>프리미엄 이용 중 ✔</b>30단계까지 프리미엄 줄도 받을 수 있어요</div>' : `<div class="tx"><b>프리미엄 열기</b>지난 단계 보상도 바로 받아요 · 보석 1,500어치 + 별빛 주사위 · 말 2</div>${B('buy', 'premium', 'btn gold', '₩9,900')}`}</div>`;
  }

  // ------------------------------------------------------------ 8. 임무
  const QIC = { gdice: `<img src="${IMG}i_gdice.png" alt="">`, tier4: `<img src="${tw('fire', 4)}" alt="">`, key: `<img src="${IMG}i44_key.png" alt="">` };
  function quest() {
    const t = ui.qTab;
    const row = (q, kind, gotMap) => {
      const done = q.cur >= q.max, got = gotMap[q.id], [ric, rtx] = rwLabel(q.rw);
      const btn = got ? '<span class="gotm">받음 ✔</span>' : done ? B('qClaim', kind + ':' + q.id, 'btn small green', '받기') : B('qGo', kind, 'btn small sec', '하러 가기');
      return `<div class="quest ${got ? 'got' : done ? 'done' : ''}"><div class="qi">${QIC[q.ic] || (kind === 'ach' ? og('trophy', '') : og('quest', ''))}</div><div class="tx">${q.n}<div class="bar ${done ? 'green' : ''}"><i style="width:${Math.min(1, q.cur / q.max) * 100}%"></i></div><small>${fmt(q.cur)} / ${fmt(q.max)}${q.sub ? ' · ' + q.sub : ''}</small></div>
        <div class="rw"><span class="r">${ric}${rtx}</span>${kind === 'daily' ? `<span class="r">${og('star')}30</span>` : ''}${btn}</div></div>`;
    };
    const chips = `<div class="chips">${[['daily', '일일', S.daily.filter(q => q.cur >= q.max && !S.dailyGot[q.id]).length + (dailyDone() === 3 && !S.dailyChest ? 1 : 0)], ['weekly', '주간', S.weekly.filter(q => q.cur >= q.max && !S.weeklyGot[q.id]).length], ['ach', '업적', S.ach.filter(q => q.cur >= q.max && !S.achGot[q.id]).length]].map(([k, n, c]) => B('qTab', k, `chip ${t === k ? 'on' : ''}`, n + dot(c))).join('')}</div>`;
    let body;
    if (t === 'daily') {
      const dd = dailyDone();
      body = `<div class="qhead panel"><div class="tx"><b>오늘 3개 모두 끝내기</b>매일 오전 9시 초기화<div class="pts">${[0, 1, 2].map(i => `<span class="${i < dd ? 'on' : ''}">${i < dd ? '✔' : i + 1}</span>`).join('')}</div></div>
        ${B('qChest', null, `chestb ${S.dailyChest ? 'got' : dd === 3 ? 'can' : ''}`, `${og('chestopen', '')}${S.dailyChest ? '받음 ✔' : '보석 10 + 별 50'}${dd === 3 && !S.dailyChest ? dot(true) : ''}`)}</div>
        ${S.daily.map(q => row(q, 'daily', S.dailyGot)).join('')}`;
    } else if (t === 'weekly') body = `<div class="note">주간 임무는 <b>월요일</b>에 바뀌어요. 하나마다 패스 별 100개도 줘요.</div>${S.weekly.map(q => row(q, 'weekly', S.weeklyGot)).join('')}`;
    else body = `<div class="note">업적은 한 번만 받아요. 칭호 · 꾸미기가 나와요.</div>${S.ach.map(q => row(q, 'ach', S.achGot)).join('')}`;
    return `<div class="bgnavy"></div>${subhead('임무')}<div class="body full">${chips}${body}
      <div class="note">임무는 <b>판 안에서 하던 일</b>만 내요. 대전이나 결제를 해야 하는 임무는 없어요.</div></div>`;
  }

  // ------------------------------------------------------------ 9. 출석 주사위판(본편 판 그림 · 칸 문양 없는 판 위에 보상)
  const AK = 1.45, ap = (x, y) => [340 + (x - 360) * AK, 300 + (y - G.plaza[1]) * AK];
  const AREW = (() => { const pool = [{ gold: 500 }, { core: 3 }, { gold: 800 }, { gem: 10 }, { gold: 500 }, { passStar: 50 }, { gold: 1000 }, { core: 5 }, { gem: 15 }, { gold: 600 }];
    return G.tiles.map((t, i) => D.CORNER[i] === 'start' ? { gem: 30 } : D.CORNER[i] === 'island' ? null : D.CORNER[i] === 'key' ? { chest: 1 } : D.CORNER[i] === 'space' ? { bigchest: 1 } : pool[(i * 3) % pool.length]); })();
  const MILES = [[7, 'chest', { gold: 3000 }, '골드 3천'], [14, 'chest', { core: 15 }, '코어 15'], [21, 'chestopen', { gem: 100 }, '보석 100'], [28, 'chestopen', { dice: 'wood' }, '나무 주사위']];
  function attend() {
    const A = S.att, [px, py] = ap(...G.tiles[A.pos].pawn), [cx, cy] = ap(...G.plaza);
    const rew = G.tiles.map((t, i) => { const r = AREW[i], [x, y] = ap(...t.center); if (i === A.pos && i !== 0) return ''; if (!r) return `<div class="arew" style="left:${x}px;top:${y - 30}px"><img src="${IMG}i44_island.png" alt=""><em>쉬어 가요</em></div>`; const [ic, tx] = rwLabel(r);
      return `<div class="arew ${D.CORNER[i] ? 'big' : ''} ${A.got.includes(i) && !D.CORNER[i] ? 'got' : ''} ${ui.attHl === i ? 'hl' : ''}" style="left:${x}px;top:${y - (D.CORNER[i] ? 40 : 32)}px">${ic.replace('class="ico"', '')}<em>${D.CORNER[i] === 'start' ? '지나면 30' : tx}</em></div>`; }).join('');
    return `<div class="bgnavy"></div>${subhead('출석 주사위판')}
    <div class="body full" style="top:120px">
      <div class="aboardwrap"><img class="bb" src="${PIMG}hb_bare.jpg" style="left:${340 - 360 * AK}px;top:${300 - G.plaza[1] * AK}px;width:${720 * AK}px" alt="">
        ${rew}
        <div class="apawn idle" id="apawn" style="left:${px}px;top:${py - 66}px"><img src="${IMG}p_${S.pawn}.png" alt=""></div>
        <div class="aplaza" style="left:${cx}px;top:${cy - 64}px"><span class="k">${A.rolled ? '오늘은 굴렸어요 · 내일 또!' : '오늘의 굴림 1번'}</span>
          <div class="adice" id="adice" data-act="attRoll">${isoDie(ui.attFace || 4, true)}</div></div>
      </div>
      <div style="display:flex;justify-content:center;margin-top:18px">${A.rolled ? B('toast', '내일 오전 9시에 다시 굴릴 수 있어요', 'btn off', '내일 다시 굴려요') : B('attRoll', null, 'btn green', '🎲 굴리기!')}</div>
      <div class="amiles panel"><div class="t"><span>이번 달 출석</span><span><b>${A.day}</b>일 / 28일</span></div>
        <div class="track"><div class="bar"><i style="width:${A.day / 28 * 100}%"></i></div>
        ${MILES.map(([d, ic, , t]) => B('attMile', d, `ms ${A.claimed[d] ? 'got' : A.day >= d ? 'can' : ''}" style="left:${d / 28 * 100}%`, `${og(ic, '')}<em><b>${d}일</b><br>${t}</em>${A.day >= d && !A.claimed[d] ? dot(true) : ''}`)).join('')}</div></div>
      <div class="note">본편 판과 같은 <b>24칸</b>이에요. 칸 보상은 운이지만, 7 · 14 · 21 · 28일 상자는 <b>꼭</b> 받아요. 출발을 지나면 보석 30.</div>
      <div class="debugrow">${B('attNextDay', null, 'btn small sec', '시안 확인용 · 다음 날로 ▶')}</div>
    </div>`;
  }

  // ------------------------------------------------------------ 10. 결과
  function result() {
    const R = ui.lastRes || fakeRes(), C = M.CHAPTERS[R.ch - 1];
    const next = R.win && R.ch < 6 && chOpen(R.ch + 1);
    const head = R.endless ? '토벌 끝' : R.win ? '승리!' : '패배';
    const third = R.endless ? B('retry', 'endless', 'btn green', '다시 토벌') : R.mode === 'weekly' ? B('retry', 'weekly', 'btn green', '다시 도전') : next ? B('nextCh', R.ch + 1, 'btn green', '다음 장 ▶') : R.win ? B('go', 'map', 'btn green', '지도 ▶') : B('retry', R.mode === 'coop' ? 'coop' : 'solo', 'btn green', '다시 도전');
    return `<div class="resbg" style="background-image:url(${PIMG}hb_ch${R.endless ? 1 : R.ch}.jpg)"></div>
    <div class="resbox panel ${R.win || R.endless ? '' : 'lose'}"><div class="ribbon ${R.win ? '' : 'purple'}">${head}</div>
      <div class="chn">${R.endless ? '무한 토벌' : `${R.mode === 'weekly' ? '주간 도전 · ' : ''}${R.ch}장 ${C.name} · ${DIFFN[R.d]}`}${R.mode === 'coop' ? ' · AI 협동' : ''}</div>
      ${R.endless ? `<div class="bigkill">${fmt(R.kills)}<span>마리 처치 · 최고 ${fmt(S.rec.best)}</span></div>`
        : `<div class="bigstars">${[0, 1, 2].map(k => og('star', k < R.stars ? '' : 'off')).join('')}</div>
      ${R.win ? `<div class="stargoal">${['승리', '판 위 몬스터 30 이하 유지', '6단계 포탑 만들기'].map((t, k) => `<span class="${k < R.stars ? 'ok' : ''}">${k < R.stars ? '★' : '☆'} ${t}</span>`).join('')}</div>` : `<div class="losewhy">${R.why}<br><small>${R.round}라운드까지 버텼어요 · 보상은 버틴 만큼</small></div>`}`}
      <div class="rstat"><div>${R.round}<span>라운드</span></div><div>${fmt(R.kills)}<span>처치</span></div><div>${R.maxTier || '-'}<span>최고 단계</span></div><div>${R.time}<span>걸린 시간</span></div></div>
      <div class="rewards">
        <div class="rew">${coin('')}<span>${fmt(R.gold * (R.doubled ? 2 : 1))}</span>${R.doubled ? '<span class="x3">×2</span>' : ''}</div>
        <div class="rew">${R.first ? '<span class="x3">첫 클리어 ×3</span>' : ''}${og('core', '')}<span>${R.core * (R.doubled ? 2 : 1)}</span></div>
        <div class="rew">${og('pass', '')}<span>+${R.pst || 40}</span></div>
      </div>
      <div class="qprog">${R.notes.map(t => `<div>${t}</div>`).join('')}</div>
      <div class="resbtns">${B('go', 'home', 'btn sec', '홈')}${R.doubled ? B('toast', '이미 2배로 받았어요', 'btn off', '2배 받음 ✔') : B('double', null, 'btn blue', `${og('ad')} 보상 2배`)}${third}</div>
    </div>`;
  }
  function fakeRes() { return { ch: S.chapter, d: 0, win: true, stars: 2, kills: 612, round: 20, maxTier: 5, time: '14:32', gold: 1212, core: 15, first: true, doubled: false, notes: [`${og('quest')}<span>임무 · 판 2번 하기 <b>2/2</b></span>`] }; }

  // ------------------------------------------------------------ 11. 내 정보
  function profile() {
    return `<div class="bgnavy"></div>${subhead('내 정보')}
    <div class="body full">
      <div class="pcardbig panel"><div class="face"><img src="${IMG}p_${S.pawn}.png" alt=""></div><div class="tx">${B('go', 'collect', 'title', '칭호 · ' + S.eq.title)}<div class="nmrow"><h3>${S.name}</h3>${B('rename', null, 'btn small sec', '✎ 이름')}</div><div class="lvrow">Lv ${S.lv}<div class="bar blue"><i style="width:${S.xp / xpNeed() * 100}%"></i></div>${S.xp}/${xpNeed()}</div></div></div>
      <div class="sec-t">기록</div>
      <div class="rec"><div>${S.rec.games}<span>판</span></div><div>${Math.round(S.rec.wins / S.rec.games * 100)}%<span>승률</span></div><div>${starSum()}/54<span>별</span></div><div>${fmt(S.rec.best)}<span>무한 토벌 최고</span></div><div>${S.rec.six}<span>6단계 만든 수</span></div><div>${D.ALL.filter(owned).length}/16<span>포탑</span></div></div>
      <div class="sec-t">우편 <span class="r">${S.mail.length}통</span></div>
      <div class="setlist">${S.mail.length ? S.mail.map(ml => { const [ic, tx] = rwLabel(ml.rw); return `<div class="setrow">${og('mail')}<span class="k">${ml.t}<small>${tx} · ${ml.d}</small></span>${B('mailGet', ml.id, 'btn small green', '받기')}</div>`; }).join('') + `<div style="text-align:right">${B('mailAll', null, 'btn small gold', '모두 받기')}</div>` : '<div class="empty">우편이 없어요</div>'}</div>
      <div class="sec-t">설정</div>
      <div class="setlist">${[['sfx', '효과음'], ['bgm', '배경음'], ['haptic', '진동', '안드로이드 · 아이폰은 단추만'], ['dmg', '피해 숫자'], ['shake', '화면 흔들림']].map(([k, n, s]) => B('tog', k, 'setrow', `<span class="k">${n}${s ? `<small>${s}</small>` : ''}</span><span class="tog ${S.set[k] ? '' : 'off'}"></span>`)).join('')}
        <div class="setrow"><span class="k">데이터<small>이 기기에 저장 · 옮기기 코드</small></span>${B('export', null, 'btn small sec', '내보내기')}</div>
        <div class="setrow"><span class="k">시안 처음 상태로<small>확인용 · 받은 보상 · 구매가 모두 처음으로</small></span>${B('resetAsk', null, 'btn small red', '되돌리기')}</div></div>
    </div>`;
  }

  // ------------------------------------------------------------ 창(모달)
  const MODALS = {
    tower: towerSheet,
    pop(md) {
      return `<div class="dim${md.anim ? ' in' : ''}" data-act="${md.noDimClose ? 'noop' : 'close'}"></div><div class="pop panel${md.anim ? ' in' : ''}"><div class="ribbon ${md.purple ? 'purple' : ''}">${md.title}</div>
        ${md.items ? `<div class="rlist ${md.anim ? 'in' : ''}">${md.items.map(([ic, tx], j) => `<div class="rw" style="animation-delay:${j * 0.08}s">${ic}<span>${tx}</span></div>`).join('')}</div>` : ''}
        ${md.html || ''}${md.msg ? `<div class="msg">${md.msg}</div>` : ''}
        <div class="btns">${md.cancel !== false ? B('close', null, 'btn sec', md.cancel || '닫기') : ''}${md.ok ? B('confirmOk', null, 'btn ' + (md.okCls || 'green'), md.ok) : ''}</div></div>`;
    },
    sheet(md) {
      return `<div class="dim${md.anim ? ' in' : ''}" data-act="close"></div><div class="sheet${md.anim ? ' in' : ''}"><span class="grab"></span>${B('close', null, 'xbtn', '✕')}<div class="stitle">${md.title}</div><div class="sbody">${md.body()}</div></div>`;
    },
  };

  // ------------------------------------------------------------ 그리기
  const SCREENS = { home, map, deck: deckScr, grow, collect, shop, pass, quest, attend, result, profile };
  const $ = id => document.getElementById(id);
  let bgKey = '';
  function renderBg() {
    const want = ui.screen === 'home' ? 'home' + S.chapter : 'navy';
    if (want === bgKey) return; bgKey = want;
    const bg = $('bg');
    if (ui.screen !== 'home') { bg.innerHTML = ''; return; }
    const [c1, c2, c3] = CHTHEME[S.chapter];
    const layer = document.createElement('div'); layer.className = 'chbg';
    layer.style.background = `radial-gradient(ellipse 60% 30% at 50% 42%, ${c1}55, transparent 70%), radial-gradient(ellipse 120% 55% at 50% 0%, ${c2}77, transparent 70%), linear-gradient(${c3}, #16122b 80%)`;
    layer.innerHTML = Array.from({ length: 14 }, (_, k) => `<i style="left:${(k * 53 + 17) % 100}%;top:${(k * 37 + 11) % 56 + 8}%;width:${10 + (k % 4) * 6}px;height:${10 + (k % 4) * 6}px;animation-delay:-${k * 0.7}s;background:${k % 2 ? c1 : c2}"></i>`).join('');
    const old = bg.querySelector('.chbg'); bg.appendChild(layer);
    if (old) { layer.style.opacity = 0; requestAnimationFrame(() => requestAnimationFrame(() => { layer.style.opacity = 1; })); setTimeout(() => old.remove(), 400); }
  }
  function render() {
    const sc = $('scr'), body = sc.querySelector('.body');
    if (body) ui.scroll[sc.dataset.s] = body.scrollTop;
    sc.dataset.s = ui.screen;
    sc.innerHTML = SCREENS[ui.screen]();
    const nb = sc.querySelector('.body'); if (nb) { nb.scrollTop = ui.scroll[ui.screen] || 0; if (nb.classList.contains('tbody')) nb.parentNode.classList.toggle('scrolled', nb.scrollTop > 4); }
    if (ui.screen === 'pass' && ui.scroll.pass == null) { const pc = sc.querySelector('#pcur'); if (pc && nb) nb.scrollTop = pc.offsetTop - 220; }
    renderBg();
    ui.bump = {}; ui.flash = null;
    save();
  }
  function renderModal(anim) {
    const mo = $('modal'), sb = mo.querySelector('.sbody'), keep = sb ? sb.scrollTop : 0;
    if (!ui.modal) { mo.innerHTML = ''; return; }
    ui.modal.anim = !!anim;
    mo.innerHTML = MODALS[ui.modal.type](ui.modal);
    const nb = mo.querySelector('.sbody'); if (nb && !anim) nb.scrollTop = keep;
  }
  const refresh = () => { render(); renderModal(false); };
  function go(s) { if (!SCREENS[s]) s = 'home'; if (ui.screen !== s) { ui.bubble = null; ui.swap = s === 'deck' ? ui.swap : null; } ui.screen = s; ui.modal = null; render(); renderModal(); history.replaceState(null, '', '?s=' + s); }
  function open(md) { ui.modal = md; renderModal(true); }
  function close() { ui.modal = null; ui.pending = null; renderModal(); }
  function toast(msg) {
    const t = $('toast'); t.innerHTML = ''; const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = msg; t.appendChild(d);
    clearTimeout(toast.h); toast.h = setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 300); }, 1900);
  }
  function rewardPop(items, title, after) { if (!items.length) return; ui.pending = after || null; open({ type: 'pop', title: title || '받았어요!', items, ok: '좋아요', cancel: false }); }
  function confirm(title, msg, ok, fn, okCls) { ui.pending = fn; open({ type: 'pop', title, msg, ok, okCls, cancel: '취소' }); }
  function overlay(text, sub, ms, fn) {
    const f = $('fx'); f.innerHTML = `<div class="battle">${text}<div class="bar"><i style="animation-duration:${ms / 1000}s"></i></div><small>${sub}</small></div>`;
    setTimeout(() => { f.innerHTML = ''; fn(); }, ms);
  }

  // ------------------------------------------------------------ 말 걷기(칸마다 한 번 폴짝)
  function walk(el, from, steps, toXY, onStep, done) {
    let i = 0, cur = from; el.classList.remove('idle'); ui.busy = true;
    const hop = () => {
      if (!el.isConnected) { ui.busy = false; return; }
      if (i >= steps) { el.classList.add('idle'); ui.busy = false; done(cur); return; }
      const nx = (cur + 1) % 24, [x0, y0] = toXY(cur), [x1, y1] = toXY(nx), t0 = performance.now(), dur = 190;
      const f = now => {
        if (!el.isConnected) { ui.busy = false; return; }
        const p = Math.min(1, (now - t0) / dur);
        el.style.left = (x0 + (x1 - x0) * p) + 'px'; el.style.top = (y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 22) + 'px';
        if (p < 1) requestAnimationFrame(f); else { cur = nx; i++; onStep && onStep(cur, i === steps); setTimeout(hop, 40); }
      };
      requestAnimationFrame(f);
    };
    hop();
  }

  // ------------------------------------------------------------ 동작
  const A = {
    noop() {},
    go: s => go(s),
    close,
    toast: msg => toast(msg),
    confirmOk() { const fn = ui.pending; ui.pending = null; ui.modal = null; renderModal(); if (fn) fn(); else render(); },
    curInfo(k) {
      if (k === 'gem') { ui.flash = 'gems'; go('shop'); const g = document.getElementById('gems'); if (g) g.scrollIntoView({ block: 'start' }); return; }
      toast(k === 'gold' ? '골드 — 특성 · 나무 강화에 써요<br>판 · 임무 · 출석으로 얻어요' : '코어 — 포탑 열기 · 특수 특성에 써요<br>판을 깨면 얻어요(첫 클리어 ×3)');
    },
    // 홈
    chap(d) { const n = S.chapter + +d; if (n < 1 || n > 6) { toast(n < 1 ? '첫 장이에요' : '마지막 장이에요'); return; } S.chapter = n; ui.bubble = null; if (!diffOpen(n, DIFFS.indexOf(S.diff))) S.diff = 'normal'; render(); },
    diff(k) { k = +k; if (!diffOpen(S.chapter, k)) { toast(`🔒 ${DIFFN[k]}은 ${diffNeed(S.chapter, k)} 뒤에 열려요`); return; } S.diff = DIFFS[k]; render(); renderModal(false); },
    tile(i) { i = +i; ui.bubble = ui.bubble && ui.bubble.i === i ? null : { i }; render(); },
    hroll() {
      if (ui.busy) return;
      const el = $('hpawn'), dc = $('hdice'); if (!el || !dc) return;
      const d1 = 1 + Math.floor(Math.random() * 6), d2 = 1 + Math.floor(Math.random() * 6);
      ui.hrolled = true; ui.bubble = null; ui.busy = true;
      const hl = document.querySelector('.boardhit .hl'); if (hl) hl.classList.remove('hl');
      const ob = document.querySelector('.tbubble'); if (ob) ob.remove();
      dc.classList.remove('roll'); void dc.offsetWidth; dc.classList.add('roll');
      let k = 0; const spin = setInterval(() => { dc.innerHTML = isoDie(1 + (k++ % 6)) + isoDie(1 + ((k + 3) % 6)); }, 70);
      setTimeout(() => {
        clearInterval(spin); dc.innerHTML = isoDie(d1) + isoDie(d2) + `<span class="sum">${d1 + d2}</span>`;
        walk(el, ui.hpawn, d1 + d2, i => { const [x, y] = hp(...G.tiles[i].pawn); return [x, y - 74]; }, null, end => {
          ui.hpawn = end; ui.bubble = { i: end };
          if (S.daily[2].cur < S.daily[2].max && D.CORNER[end] === 'key') { S.daily[2].cur++; toast('🔑 황금열쇠 칸! 임무 +1'); }
          render();
        });
      }, 600);
    },
    start(mode) {
      if (ui.rolling || ui.inGame || performance.now() < (ui.introUntil || 0) || $('boot')) return;
      const n = S.chapter, di = DIFFS.indexOf(S.diff);
      if (mode === 'endless') { if (!chOpen(4)) { toast('🔒 무한 토벌은 3장 보통을 깨면 열려요'); return; } }
      else if (mode === 'weekly') { if (!chOpen(3)) { toast('🔒 주간 도전은 2장 보통을 깨면 열려요'); return; } }
      else if (!chOpen(n)) { toast(`🔒 ${n}장은 ${n - 1}장 보통을 깨면 열려요`); return; }
      else if (!diffOpen(n, di)) { toast(`🔒 ${DIFFN[di]} = ${diffNeed(n, di)}`); return; }
      if (ui.screen !== 'home') go('home');
      const d = window.OG_FORCE || rollStart(S.miss || 0); window.OG_FORCE = null;
      const dbl = d[0] === d[1], b1 = $('bd1'), b2 = $('bd2'), dice = document.querySelector('.bigdice');
      const sbNow = dbl ? { d, txt: DBL[d[0] - 1][2], fx: DBL[d[0] - 1][3] } : null;   // [v5.4] 판 미리 불러오기는 주사위가 착지한 뒤에(던지는 동안 불러오면 아이폰에서 던지기가 멈칫)
      ui.rolling = true; dice.classList.remove('landed', 'win'); void dice.offsetWidth; dice.classList.add('rolling');
      SND.play('dice', 0.7);
      let k = 0; const spin = setInterval(() => { b1.innerHTML = isoDie(1 + (k % 6), S.eq.dice); b2.innerHTML = isoDie(1 + ((k * 5 + 3) % 6), S.eq.dice); k++; if (k % 2) SND.tone(900 + (k % 5) * 90, 0, 0.03, 0.025, 'square'); }, 60);
      setTimeout(() => { const sc = $('scr'); sc.classList.remove('thump'); void sc.offsetWidth; sc.classList.add('thump'); SND.play('thud', 0.8); SND.tone(140, 60, 0.18, 0.12, 'sine'); }, 720);
      setTimeout(() => {
        clearInterval(spin); b1.innerHTML = isoDie(d[0], S.eq.dice); b2.innerHTML = isoDie(d[1], S.eq.dice); dice.classList.remove('rolling'); dice.classList.add('landed');
        if (dbl) { dice.classList.add('win'); const ds = document.querySelector('.dstage'); for (let q = 0; q < (d[0] === 6 ? 22 : 14); q++) { const sp = document.createElement('i'); sp.className = 'spark'; const an = Math.random() * Math.PI * 2, r = 120 + Math.random() * 160; sp.style.setProperty('--dx', Math.cos(an) * r + 'px'); sp.style.setProperty('--dy', Math.sin(an) * r * 0.7 - 60 + 'px'); sp.style.animationDelay = (Math.random() * 0.15) + 's'; ds.appendChild(sp); setTimeout(() => sp.remove(), 1100); } SND.play(d[0] === 6 ? 'jackpot' : 'tierup', 0.75); }
        else SND.play('coin', 0.5);
        S.miss = dbl ? 0 : (S.miss || 0) + 1; ui.lastRoll = { d, dbl };
        setTimeout(() => prepGame(mode || 'solo', sbNow), 120);
        const bonus = dbl ? DBL[d[0] - 1] : null; ui.startBonus = bonus ? { d, txt: bonus[2], fx: bonus[3] } : null; save();
        const f = $('fx');
        f.innerHTML = dbl
          ? `<div class="rollban dbl ${d[0] === 6 ? 'jack' : ''}"><div class="t">${d[0] === 6 ? '대박! ' : ''}${d[0]}·${d[1]} 더블!</div><div class="s">시작 혜택 · ${bonus[2]}</div></div>`
          : `<div class="rollban"><div class="t">${d[0]}·${d[1]}</div><div class="s">더블이 아니에요 · 혜택 없이 시작<br>다음 판 더블 확률 ${dblChance(S.miss)}%</div></div>`;
        setTimeout(() => { f.innerHTML = ''; ui.rolling = false; enterGame(); }, dbl ? 1700 : 1200);
      }, 1050);
    },
    dblInfo() {
      if (ui.rolling) return;
      const pc = dblChance(S.miss || 0);
      open({ type: 'sheet', title: '시작 주사위 · 더블 혜택', body: () => `<div class="dbltab">${DBL.slice().reverse().map(([f, w, t]) => `<div class="drow ${f === 6 ? 'jack' : ''}"><span class="dd">${isoDie(f, S.eq.dice)}${isoDie(f, S.eq.dice)}</span><span class="tx"><b>${f}·${f}${f === 6 ? ' 대박' : ''}</b>${t}</span><span class="pr">${(pc * w / DBL_W).toFixed(1)}%</span></div>`).join('')}
        <div class="drow none"><span class="dd">${isoDie(2, S.eq.dice)}${isoDie(5, S.eq.dice)}</span><span class="tx"><b>더블 아님</b>혜택 없이 시작</span><span class="pr">${(100 - pc).toFixed(1)}%</span></div></div>
        <div class="note">시작을 누르면 주사위 2개를 한 번 굴려요. <b>같은 숫자(더블)</b>면 시작 혜택이고, 숫자가 클수록 좋아요.<br>지금 더블 확률 <b>${pc}%</b> — 더블이 안 나올 때마다 <b>+${DBL_STEP}%p</b>, ${DBL_SURE}번 연속 꽝이면 다음 판은 <b>꼭 더블</b>.<br>실제로는 3~4판에 1번, 6·6은 약 56판에 1번 나와요.</div>` });
    },
    stagePick() {
      open({ type: 'sheet', title: '판 고르기', body: () => `<div class="sec-t">난이도</div><div class="diffrow2">${DIFFN.map((nm, k) => B('diff', k, `diff ${DIFFS.indexOf(S.diff) === k ? 'on' : ''} ${diffOpen(S.chapter, k) ? '' : 'lock'}`, diffOpen(S.chapter, k) ? nm : `${nm}<small>🔒 ${k === 1 ? S.chapter + '장 보통' : '3장 보통'}</small>`)).join('')}</div>
        <div class="note" style="margin-top:12px">${DIFFS.map((k, i) => `<b>${DIFFN[i]}</b> ${D.DIFF[k].desc}`).join('<br>')}</div>
        <div class="sec-t">장 <span class="r">${B('go', 'map', 'btn small sec', '모험 지도 ▶')}</span></div>
        <div class="plist">${M.CHAPTERS.map(C => { const o = chOpen(C.n), st = S.stars[C.n]; return B('pickCh', C.n, `prow2 chrow ${S.chapter === C.n ? 'on' : ''}`, `<span class="cth" style="${thumbBg(C.n, 120, 76)}${o ? '' : ';filter:grayscale(.85) brightness(.5)'}"></span><span class="nm">${C.n}장 ${C.name}${o ? '' : ' 🔒'}<br><small style="font-size:15px;color:${o ? '#ffd23a' : '#ffb0b0'}">${o ? '★ ' + (st[0] + st[1] + st[2]) + ' / 9' : (C.n - 1) + '장 보통 클리어'}</small></span><span class="crule">${C.rule}</span>`); }).join('')}</div>` });
    },
    pickCh(nn) { const n = +nn; if (!chOpen(n)) { toast(`🔒 ${n}장은 ${n - 1}장 보통을 깨면 열려요`); return; } if (S.chapter === n) { close(); return; } S.chapter = n; if (!diffOpen(n, DIFFS.indexOf(S.diff))) S.diff = 'normal'; render(); renderModal(false); toast(`${n}장 ${M.CHAPTERS[n - 1].name}`); },
    coop() { open({ type: 'pop', title: '협동', msg: '둘이 한 판을 함께 지켜요.<small>AI 동료는 바로 · 친구는 초대 링크로</small>', html: `<div class="btns" style="margin-top:16px">${B('coopAi', null, 'btn green', 'AI와 함께')}${B('coopFriend', null, 'btn blue', '친구 초대')}</div>` }); },
    coopAi() { close(); setTimeout(() => A.start('coop'), 200); },
    coopFriend() { close(); toast('초대 링크를 만들었어요 (시안 — 실제 연결 없음)'); },
    endless() { if (!chOpen(4)) { toast('🔒 무한 토벌은 3장 보통을 깨면 열려요'); return; } A.start('endless'); },
    retry(mode) { go('home'); setTimeout(() => A.start(mode || 'solo'), 250); },
    weekly() { open({ type: 'pop', title: '주간 도전', purple: true, msg: '이번 주: <b style="color:#ffd23a">3장 화산 · 어려움</b><small>내 덱 그대로 · 3일 남음 · 이기면 보석 50 (별 기록과는 따로)</small>', ok: chOpen(3) ? '도전!' : '🔒 2장 보통 클리어', okCls: chOpen(3) ? 'green' : 'off' }); ui.pending = () => { if (!chOpen(3)) { toast('🔒 주간 도전은 2장 보통을 깨면 열려요'); return; } setTimeout(() => A.start('weekly'), 200); }; },
    freeGift() {
      if (S.shop.free) { toast('오늘 무료는 이미 받았어요 · 내일 또!'); return; }
      const fin = () => { S.shop.free = true; const items = grant({ gold: 1000 }); render(); rewardPop(items, '오늘의 무료'); };
      if (S.shop.vip) fin(); else overlay('광고 보는 중…', '시안이라 1초 뒤 끝나요 · 후원 회원은 광고 없이 받아요', 1000, fin);
    },
    mail() {
      if (!S.mail.length) { toast('우편이 없어요'); return; }
      open({ type: 'sheet', title: `우편 ${S.mail.length}통`, body: () => S.mail.length ? `<div class="setlist">${S.mail.map(ml => { const [ic, tx] = rwLabel(ml.rw); return `<div class="setrow">${og('mail')}<span class="k">${ml.t}<small>${tx} · ${ml.d}</small></span>${B('mailGet', ml.id, 'btn small green', '받기')}</div>`; }).join('')}</div><div style="margin-top:16px;text-align:center">${B('mailAll', null, 'btn gold', '모두 받기')}</div>` : '<div class="empty">다 받았어요</div>' });
    },
    mailGet(id) { const ml = S.mail.find(x => x.id === id); if (!ml) return; S.mail = S.mail.filter(x => x !== ml); const items = grant(ml.rw); const wasSheet = ui.modal && ui.modal.type === 'sheet'; render(); if (wasSheet && S.mail.length) renderModal(false); else close(); rewardPop(items, '우편 받기'); },
    mailAll() { if (!S.mail.length) return; const rw = {}; for (const ml of S.mail) for (const k in ml.rw) rw[k] = (rw[k] || 0) + ml.rw[k]; S.mail = []; const items = grant(rw); close(); render(); rewardPop(items, '모두 받았어요'); },
    // 지도
    mapNode(n) { n = +n; if (!chOpen(n)) { toast(`🔒 ${n}장은 ${n - 1}장 보통을 깨면 열려요`); return; } S.chapter = n; if (!diffOpen(n, DIFFS.indexOf(S.diff))) S.diff = 'normal'; ui.hpawn = 0; go('home'); toast(`${n}장 ${M.CHAPTERS[n - 1].name}을 골랐어요`); },
    starChest(v) { v = +v; if (S.starChest[v]) { toast('이미 받은 상자예요'); return; } if (starSum() < v) { toast(`별 ${v}개를 모으면 열려요 (지금 ${starSum()}개)`); return; } S.starChest[v] = 1; const items = grant(v % 18 === 0 ? { gem: 30, core: 5 } : { gold: 2000, core: 5 }); render(); rewardPop(items, `별 ${v}개 상자`); },
    // 덱
    deckTab(i) { i = +i; if (i === 2 && !S.slot3) { A.buy('slot3'); return; } S.deckIdx = i; ui.swap = null; render(); },
    preset() { open({ type: 'sheet', title: '추천 덱', body: () => `<div class="plist">${D.PRESETS.map((p, i) => { const lock = p.deck.filter(t => !owned(t)); return B('presetUse', i, 'prow2', `<span class="nm">${p.name}${lock.length ? `<br><small style="font-size:15px;color:#ffb0b0">🔒 ${lock.map(tname).join(' · ')}</small>` : ''}</span><span class="tws">${p.deck.map(t => `<img src="${tw(t, 3)}" style="${owned(t) ? '' : 'filter:grayscale(1) brightness(.4)'}" alt="">`).join('')}</span>`); }).join('')}</div><div class="note">누르면 <b>덱 ${S.deckIdx + 1}</b>에 그대로 넣어요.</div>` }); },
    presetUse(i) { const p = D.PRESETS[+i], lock = p.deck.filter(t => !owned(t)); if (lock.length) { toast(`잠긴 포탑이 있어요: ${lock.map(tname).join(' · ')}`); return; } S.decks[S.deckIdx] = p.deck.slice(); close(); render(); toast(`덱 ${S.deckIdx + 1} = ${p.name}`); },
    chipFam(f) { ui.chipFam = f; render(); },
    tower(k) { if (ui.swap) { toast('먼저 위쪽 덱 칸을 골라 주세요(취소도 가능)'); return; } open({ type: 'tower', k }); },
    tierView(a) { const [k, n] = a.split(':'); ui.tier[k] = +n; renderModal(false); },
    swapStart(k) { ui.swap = k; close(); if (ui.screen !== 'deck') go('deck'); else render(); toast('바꿀 덱 칸을 누르세요'); },
    swapTo(i) { const k = ui.swap, d = deck(); if (!k) return; const old = d[+i]; d[+i] = k; ui.swap = null; render(); toast(`${tname(old)} → ${tname(k)}`); },
    swapCancel() { ui.swap = null; render(); },
    pick(kind) {
      const isC = kind === 'cmd', L = isC ? D.COMMANDERS : D.PAWNS;
      open({ type: 'sheet', title: isC ? '지휘관 고르기' : '말 고르기', body: () => `<div class="pickgrid">${Object.keys(L).map(id => { const own = isC || S.own.pawn.includes(id), on = (isC ? S.cmd : S.pawn) === id; return B('pickUse', kind + ':' + id, `pick ${on ? 'on' : ''}`, `<img src="${IMG}${isC ? 'c_' : 'p_'}${id}.png" style="${own ? '' : 'filter:grayscale(1) brightness(.45)'}" alt="">${L[id].name}${on ? ' ✔' : own ? '' : ' 🔒'}<small>${isC ? L[id].act : own ? L[id].desc : PAWN_HOW[id] || '이벤트'}</small>`); }).join('')}</div>` });
    },
    pickUse(a) { const [kind, id] = a.split(':'); if (kind === 'pawn' && !S.own.pawn.includes(id)) { toast('🔒 ' + (PAWN_HOW[id] || '이벤트로 얻어요')); return; } if (kind === 'cmd') S.cmd = id; else S.pawn = id; close(); render(); toast(`${(kind === 'cmd' ? D.COMMANDERS : D.PAWNS)[id].name}(으)로 바꿨어요`); },
    trait(k) { const lv = tgl(k), c = M.traitCost(lv); if (S.gold < c) { toast(`골드가 ${fmt(c - S.gold)} 모자라요`); return; } S.gold -= c; S.nodes['trait.' + k + '.g'] = lv + 1; ui.bump.gold = 1; refresh(); toast(`${tname(k)} 특성 Lv ${lv + 1} · 피해 +${((lv + 1) * 1.5).toFixed(1)}%`); },
    traitSp(a) {
      const [k, slot] = a.split(':'), lv = tgl(k), need = slot === 's1' ? 10 : 20, c = slot === 's1' ? { gold: 20000, core: 10 } : { gold: 50000, core: 20 };
      if (S.nodes['trait.' + k + '.' + slot]) { toast('이미 켜져 있어요'); return; }
      if (lv < need) { toast(`일반 특성 Lv${need}에 열려요 (지금 ${lv})`); return; }
      if (S.gold < c.gold || S.core < c.core) { toast(`골드 ${fmt(c.gold)} · 코어 ${c.core}가 필요해요`); return; }
      confirm('특수 특성', `${M.TRAIT_SP[k][slot === 's1' ? 0 : 1][1]}<small>골드 ${fmt(c.gold)} · 코어 ${c.core}</small>`, '켜기', () => { S.gold -= c.gold; S.core -= c.core; S.nodes['trait.' + k + '.' + slot] = 1; ui.bump.gold = ui.bump.core = 1; render(); open({ type: 'tower', k }); toast('특수 특성이 켜졌어요!'); });
    },
    unlock(k) {
      const nd = M.unlockNeed(m(), k);
      if (!nd.lvOk) { toast(`${M.FAMS.find(f => f.id === nd.fam).name} 나무 Lv${nd.lv}가 필요해요 (지금 ${nd.lvNow})`); return; }
      if (!nd.coreOk) { toast(`코어가 ${nd.core - S.core} 모자라요 · 판을 깨면 얻어요`); return; }
      confirm('포탑 열기', `${tname(k)}을 열까요?<small>코어 ${nd.core}</small>`, '열기', () => { S.core -= nd.core; S.unlocked.push(k); ui.bump.core = 1; render(); rewardPop([[`<img src="${tw(k, 3)}" alt="">`, tname(k)]], '새 포탑!'); }, 'gold');
    },
    // 성장
    famTab(f) { ui.famTab = f; render(); },
    node(a) { const [fam, id] = a.split(':'), nd = (fam === 'common' ? M.COMMON_NODES : M.FAM_NODES).find(x => x.id === id), info = M.nodeInfo(m(), fam, nd);
      if (!info.can) { toast(info.cost.core ? `코어 ${info.cost.core}가 필요해요 (지금 ${S.core})` : `골드가 ${fmt(info.cost.gold - S.gold)} 모자라요`); return; }
      if (info.cost.core) S.core -= info.cost.core; else S.gold -= info.cost.gold; S.nodes[info.key] = info.cur + 1; ui.bump.gold = ui.bump.core = 1; render(); toast(`${nd.rule ? M.RULES[fam].name : nd.name} ${nd.once ? '열림!' : 'Lv ' + (info.cur + 1)}`); },
    treeReset(fam) {
      let gold = 0, core = 0, any = 0;
      for (const nd of M.FAM_NODES) { const c = S.nodes[fam + '.' + nd.id] || 0; if (!c) continue; any = 1; if (nd.once) core += nd.core; else for (let l = 0; l < c; l++) gold += M.goldCost(l); }
      if (!any) { toast('되돌릴 칸이 없어요'); return; }
      confirm('나무 초기화', `${M.FAMS.find(f => f.id === fam).name} 나무 칸을 모두 되돌릴까요?<small>쓴 골드 ${fmt(gold)} · 코어 ${core}를 그대로 돌려받아요(무료)</small>`, '되돌리기', () => { for (const nd of M.FAM_NODES) delete S.nodes[fam + '.' + nd.id]; delete S.nodes['fork.' + fam]; S.gold += gold; S.core += core; ui.bump.gold = ui.bump.core = 1; render(); toast('되돌렸어요 · 다시 찍어 보세요'); }, 'red');
    },
    fork(a) { const [fam, p] = a.split(':'), key = 'fork.' + fam; if (treeLv(fam) < 20) { toast(`나무 Lv20에 열려요 (지금 ${treeLv(fam)})`); return; } if (S.nodes[key] === +p) { toast('이미 고른 길이에요'); return; } if (!S.nodes[key]) { if (S.core < 10) { toast('처음 고를 때 코어 10이 필요해요'); return; } S.core -= 10; } S.nodes[key] = +p; render(); toast('갈림길을 골랐어요'); },
    // 수집
    colTab(k) { ui.colTab = k; render(); },
    equipDice(id) { const d = DICE.find(x => x[0] === id); if (!S.own.dice.includes(id)) { if (d[4]) { A.buy('jelly'); return; } toast('🔒 ' + d[3]); return; } S.eq.dice = id; render(); toast(`${d[1]} 주사위를 장착했어요`); },
    equipPawn(id) { if (!S.own.pawn.includes(id)) { toast('🔒 ' + (PAWN_HOW[id] || '이벤트로 얻어요')); return; } S.pawn = id; render(); toast(`${D.PAWNS[id].name}로 바꿨어요`); },
    equipBoard(n) { n = +n; if (n && !(S.stars[n][0] > 0)) { toast(`🔒 ${n}장 보통을 깨면 열려요`); return; } S.eq.board = n; render(); toast(n ? `다음 판부터 ${M.CHAPTERS[n - 1].name} 판으로 싸워요` : '장마다 원래 판으로 싸워요'); },
    equipTitle(n) { if (!S.own.title.includes(n)) { toast('🔒 ' + TITLES.find(t => t[0] === n)[1]); return; } S.eq.title = n; render(); toast(`칭호 「${n}」`); },
    // 상점
    buy(id) {
      const gemBuy = (cost, label, fn) => { if (S.gem < cost) { confirm('보석이 모자라요', `${label}에 보석 ${cost}개가 필요해요 (지금 ${S.gem})`, '보석 사러 가기', () => { ui.flash = 'gems'; go('shop'); const g = $('gems'); if (g) g.scrollIntoView({ block: 'start' }); }); return; } confirm('살까요?', `${label}<small>보석 ${cost}개</small>`, '사기', () => { S.gem -= cost; ui.bump.gem = 1; fn(); }); };
      const cash = (won, label, fn) => confirm('결제(시안)', `${label} · ₩${fmt(won)}<small>시안이라 실제 결제 없이 바로 받아요</small>`, '결제', fn, 'gold');
      if (id === 'gold3k') { if (S.shop.goldBuy >= 3) { toast('오늘은 다 샀어요 · 내일 또!'); return; } return gemBuy(30, '골드 3,000', () => { S.shop.goldBuy++; render(); rewardPop(grant({ gold: 3000 })); }); }
      if (id === 'core5') { if (S.shop.coreBuy) { toast('하루 1번만 살 수 있어요'); return; } return gemBuy(40, '코어 5', () => { S.shop.coreBuy = true; render(); rewardPop(grant({ core: 5 })); }); }
      if (id === 'jelly') { if (S.own.dice.includes('jelly')) { toast('이미 가지고 있어요 · 수집에서 장착'); return; } return gemBuy(300, '젤리 주사위', () => { render(); rewardPop(grant({ dice: 'jelly' }), '새 주사위!'); }); }
      if (id === 'cat') { if (S.own.pawn.includes('cat')) { toast('이미 가지고 있어요 · 수집에서 장착'); return; } return gemBuy(200, '보라 말', () => { render(); rewardPop(grant({ pawn: 'cat' }), '새 말!'); }); }
      if (id === 'slot3') { if (S.slot3) { toast('덱 3은 이미 열렸어요'); return; } return gemBuy(100, '덱 칸 3', () => { S.slot3 = true; S.deckIdx = 2; render(); toast('덱 3이 열렸어요!'); }); }
      if (id === 'vip') { if (S.shop.vip) { toast('후원 회원 이용 중이에요 · 28일 남음'); return; } return cash(5900, '후원 회원 30일', () => { S.shop.vip = true; render(); rewardPop(grant({ gem: 20 }), '후원 회원 시작!'); }); }
      if (id === 'premium') return cash(9900, '프리미엄 패스', () => { S.pass.premium = true; render(); toast('프리미엄이 열렸어요 · 받을 보상이 늘었어요'); });
      if (id === 'starter') { if (S.shop.starter) { toast('이미 산 꾸러미예요'); return; } return cash(4900, '시작 꾸러미(보석 500 · 골드 3만 · 코어 30 · 황금 주사위)', () => { S.shop.starter = true; render(); rewardPop(grant({ gem: 500, gold: 30000, core: 30, dice: 'gold' }), '시작 꾸러미!'); }); }
      const gp = { gold12k: [100, 12000], gold40k: [300, 44000], gold150k: [1000, 187500] }[id];
      if (gp) return gemBuy(gp[0], `골드 ${fmt(gp[1])}`, () => { render(); rewardPop(grant({ gold: gp[1] })); });
      const g = { gem80: [1200, 80], gem500: [6500, 550], gem1200: [15000, 1400], gem2500: [29000, 3000], gem6500: [69000, 8000], gem14000: [129000, 18000] }[id];
      if (g) return cash(g[0], `보석 ${fmt(g[1])}`, () => { render(); rewardPop(grant({ gem: g[1] })); });
    },
    // 패스
    passClaim(a) { const prem = a[0] === 'p', i = +a.slice(1), P = S.pass;
      if (i > P.lv) { toast(`${i}단계에 받아요 · 별을 ${PASS_STEP * (i - P.lv) - P.star}개 더 모으세요`); return; }
      if (prem && !P.premium) { A.buy('premium'); return; }
      const gm = prem ? P.gotP : P.gotF; if (gm[i]) { toast('이미 받았어요'); return; }
      gm[i] = 1; const items = grant(passRw(i, prem)); render(); rewardPop(items, `패스 ${i}단계`); },
    passAll() { const P = S.pass, rw = []; for (let i = 1; i <= P.lv; i++) { if (!P.gotF[i]) { P.gotF[i] = 1; rw.push(passRw(i, 0)); } if (P.premium && !P.gotP[i]) { P.gotP[i] = 1; rw.push(passRw(i, 1)); } } const items = []; for (const r of rw) items.push(...grant(r)); render(); rewardPop(items.slice(0, 8), `${rw.length}개 받았어요`); },
    // 임무
    qTab(k) { ui.qTab = k; render(); },
    qClaim(a) { const [kind, id] = a.split(':'), list = S[kind], gm = S[kind + 'Got'], q = list.find(x => x.id === id); if (!q || gm[id]) return; gm[id] = 1;
      const rw = Object.assign({}, q.rw, { passStar: kind === 'daily' ? 30 : kind === 'weekly' ? 100 : 0 }); const items = grant(rw); render(); rewardPop(items, '임무 완료'); },
    qGo(kind) { go('home'); toast(kind === 'ach' ? '판을 하면서 채워져요' : '판을 하거나 판 위 주사위를 굴려 보세요'); },
    qChest() { if (S.dailyChest) { toast('오늘 상자는 받았어요'); return; } if (dailyDone() < 3) { toast(`일일 임무 3개를 끝내면 열려요 (${dailyDone()}/3)`); return; } S.dailyChest = true; const items = grant({ gem: 10, passStar: 50 }); render(); rewardPop(items, '오늘의 상자'); },
    // 출석
    attRoll() {
      if (ui.busy) return;
      if (S.att.rolled) { toast('오늘은 굴렸어요 · 내일 다시!'); return; }
      const el = $('apawn'), dc = $('adice'); if (!el || !dc) return;
      const v = 1 + Math.floor(Math.random() * 6); ui.busy = true;
      dc.classList.remove('roll'); void dc.offsetWidth; dc.classList.add('roll');
      let k = 0; const spin = setInterval(() => { dc.innerHTML = isoDie(1 + (k++ % 6), true); }, 70);
      setTimeout(() => {
        clearInterval(spin); dc.innerHTML = isoDie(v, true); ui.attFace = v;
        let lap = 0;
        walk(el, S.att.pos, v, i => { const [x, y] = ap(...G.tiles[i].pawn); return [x, y - 66]; }, (i, last) => { if (i === 0 && !last) lap = 1; }, end => {
          S.att.pos = end; S.att.rolled = true; S.att.day = Math.min(28, S.att.day + 1);
          const r = AREW[end], items = [];
          if (lap || end === 0) items.push(...grant({ gem: 30 }));
          if (r && end !== 0) { items.push(...grant(r)); if (!S.att.got.includes(end)) S.att.got.push(end); }
          ui.attHl = end; render();
          if (items.length) rewardPop(items, r ? `${v}칸! 보상` : '무인도 — 쉬어 가요'); else toast(`${v}칸 · 무인도에서 쉬어 가요`);
        });
      }, 650);
    },
    attMile(d) { d = +d; const A2 = S.att, mm = MILES.find(x => x[0] === d); if (A2.claimed[d]) { toast('이미 받았어요'); return; } if (A2.day < d) { toast(`출석 ${d}일에 받아요 (지금 ${A2.day}일)`); return; } A2.claimed[d] = 1; const items = grant(mm[2]); render(); rewardPop(items, `출석 ${d}일 상자`); },
    attNextDay() { S.att.rolled = false; S.shop.free = false; S.shop.goldBuy = 0; S.shop.coreBuy = false; ui.attHl = null; render(); toast('시안 확인용: 다음 날이 됐어요(출석 · 오늘의 상점 초기화)'); },
    // 결과
    double() { const R = ui.lastRes; if (!R || R.doubled) { toast('이미 받았어요'); return; } overlay('광고 보는 중…', '시안이라 1초 뒤 끝나요', 1000, () => { R.doubled = true; const items = grant({ gold: R.gold, core: R.core }); render(); rewardPop(items, '보상 2배!'); }); },
    nextCh(n) { S.chapter = +n; S.diff = 'normal'; ui.hpawn = 0; go('home'); toast(`${n}장 ${M.CHAPTERS[n - 1].name}이 기다려요`); },
    // 내 정보
    rename() { ui.lastName = S.name; open({ type: 'pop', title: '이름 바꾸기', html: `<input class="inp" id="nmInp" maxlength="8" value="${S.name}">`, msg: '<small>8자까지 · 시안이라 무료</small>', ok: '바꾸기', cancel: '취소' });
      ui.pending = () => { const v = (ui.lastName || '').trim(); if (!v) { toast('이름을 써 주세요'); return; } S.name = v.slice(0, 8); render(); toast(`「${S.name}」(으)로 바꿨어요`); }; },
    settings() {
      open({ type: 'sheet', title: '설정', body: () => `<div class="setlist setgrid">${[['sfx', '효과음'], ['bgm', '배경음'], ['haptic', '진동', '안드로이드 · 아이폰은 단추만'], ['dmg', '피해 숫자'], ['shake', '화면 흔들림']].map(([k, n, sub]) => B('tog', k, 'setrow', `<span class="k">${n}${sub ? `<small>${sub}</small>` : ''}</span><span class="tog ${S.set[k] ? '' : 'off'}"></span>`)).join('')}</div>
        <div class="sec-t">계정</div><div class="devgrid">${B('go', 'profile', 'btn sec', '내 정보')}${B('export', null, 'btn sec', '옮기기 코드')}${B('resetAsk', null, 'btn red', '처음 상태로')}${B('dev', null, 'btn sec', '🛠 개발 도구')}</div>
        <div class="note" style="margin-top:14px">시안 v5.8 · 마블 디펜스</div>` });
    },
    // [v5.4] 개발 도구(나중에 뺄 것): 포탑 열고 닫기 · 재화 · 장 · 패스 · 출석 · 다음 시작 6·6
    dev() {
      open({ type: 'sheet', title: '🛠 개발 도구', body: () => `<div class="devnote">시험용이에요 · 출시 전 뺄 기능 · 저장에 바로 반영돼요</div>
        <div class="sec-t">포탑</div><div class="devgrid">${B('devDo', 'openAll', 'btn green', '포탑 모두 열기')}${B('devDo', 'closeAll', 'btn sec', '포탑 처음처럼 닫기')}</div>
        <div class="sec-t">재화</div><div class="devgrid">${B('devDo', 'gold', 'btn gold', '골드 +100,000')}${B('devDo', 'core', 'btn sec', '코어 +500')}${B('devDo', 'gem', 'btn sec', '보석 +5,000')}${B('devDo', 'zero', 'btn sec', '재화 0으로')}</div>
        <div class="sec-t">진행</div><div class="devgrid">${B('devDo', 'chapters', 'btn sec', '장 · 난이도 모두 열기')}${B('devDo', 'pass', 'btn sec', '패스 +5단계')}${B('devDo', 'day', 'btn sec', '출석 다음 날')}${B('devDo', 'six', 'btn sec', '다음 시작 6·6')}${B('devDo', 'tree', 'btn sec', '나무 칸 모두 +5')}${B('devDo', 'shop', 'btn sec', '상점 하루 초기화')}</div>
        <div class="note" style="margin-top:14px">지금 · 골드 ${fmt(S.gold)} · 코어 ${S.core} · 보석 ${fmt(S.gem)} · 열린 포탑 ${D.ALL.filter(owned).length}/${D.ALL.length}</div>` });
    },
    devDo(a) {
      if (a === 'openAll') S.unlocked = Object.keys(M.UNLOCK);
      if (a === 'closeAll') S.unlocked = [];
      if (a === 'gold') S.gold += 100000;
      if (a === 'core') S.core += 500;
      if (a === 'gem') S.gem += 5000;
      if (a === 'zero') { S.gold = 0; S.core = 0; S.gem = 0; }
      if (a === 'chapters') for (let n = 1; n <= 6; n++) S.stars[n] = [Math.max(1, S.stars[n][0]), Math.max(1, S.stars[n][1]), Math.max(1, S.stars[n][2])];
      if (a === 'pass') S.pass.lv = Math.min(30, S.pass.lv + 5);
      if (a === 'day') { S.att.rolled = false; S.att.day = Math.min(28, S.att.day + 1); }
      if (a === 'six') window.OG_FORCE = [6, 6];
      if (a === 'tree') for (const f of M.FAMS) for (const nd of M.FAM_NODES) { const key = f.id + '.' + nd.id; S.nodes[key] = Math.min(nd.max || 1, (S.nodes[key] || 0) + 5); }
      if (a === 'shop') Object.assign(S.shop, { free: false, goldBuy: 0, coreBuy: false });
      ui.bump.gold = ui.bump.core = ui.bump.gem = 1; render(); renderModal(false);
      toast({ openAll: '포탑을 모두 열었어요', closeAll: '포탑을 처음처럼 닫았어요', gold: '골드 +100,000', core: '코어 +500', gem: '보석 +5,000', zero: '재화를 0으로', chapters: '장 · 난이도를 모두 열었어요', pass: '패스 +5단계', day: '출석 다음 날', six: '다음 시작은 6·6', tree: '나무 칸 +5', shop: '상점을 하루 초기화' }[a]);
    },
    tog(k) { S.set[k] = S.set[k] ? 0 : 1; if (k === 'bgm') SND.music(); const el = document.querySelector(`[data-act="tog"][data-arg="${k}"] .tog`); if (el) el.classList.toggle('off', !S.set[k]); save(); toast(`${{ sfx: '효과음', bgm: '배경음', haptic: '진동', dmg: '피해 숫자', shake: '화면 흔들림' }[k]} ${S.set[k] ? '켬' : '끔'}`); },
    export() { let code = ''; try { code = btoa(unescape(encodeURIComponent(JSON.stringify({ n: S.name, lv: S.lv, g: S.gold, c: S.core, j: S.gem, st: S.stars })))); } catch (e) { code = '(만들기 실패)'; }
      open({ type: 'pop', title: '옮기기 코드', html: `<div class="codebox">${code}</div>`, msg: '<small>새 기기에서 이 코드를 넣으면 옮겨져요(시안)</small>', ok: '복사' }); ui.pending = () => { try { navigator.clipboard.writeText(code).then(() => toast('복사했어요'), () => toast('복사가 막혔어요 · 길게 눌러 복사하세요')); } catch (e) { toast('복사가 막혔어요 · 길게 눌러 복사하세요'); } }; },
    resetAsk() { confirm('처음 상태로', '시안 상태를 처음으로 되돌릴까요?<small>받은 보상 · 구매 · 장착이 모두 처음으로</small>', '되돌리기', () => { S = BASE_STATE(); Object.assign(ui, { hpawn: 0, hrolled: false, bubble: null, swap: null, lastRes: null, attHl: null, lastRoll: null, startBonus: null }); go('home'); toast('처음 상태가 됐어요'); }, 'red'); },
  };

  // R = 본편 판이 보낸 결과(win · stars · kills · round · t · maxTier · mode …). 없으면 검수용 가짜 승리
  function finishGame(n, di, R) {
    if (!R) R = { win: true, mode: 'conquest', stars: S.stars[n][di] >= 2 ? 3 : 2, kills: 560 + Math.floor(Math.random() * 90), round: 20, t: 720 + Math.floor(Math.random() * 300), maxTier: 6, fake: true };
    const endless = R.mode === 'endless', win = !!R.win && !endless, weekly = R.modeKey === 'weekly';
    const st = S.stars[n], prev = st[di], stars = win ? Math.max(1, Math.min(3, R.stars || 1)) : 0;
    const dm = endless ? 1 : [1, 1.5, 2][di], first = win && prev === 0 && !weekly;
    let gold = Math.round((300 + n * 150 + R.kills) * dm), core = (3 + n) * (first ? 3 : 1);
    if (!win && !endless) { const k = Math.min(1, (R.round || 0) / 20) * 0.5; gold = Math.round(gold * k); core = Math.floor((3 + n) * k); }
    if (endless) { gold = Math.round(200 + R.kills * 1.2); core = 2 + Math.floor((R.round || 0) / 5); }
    if (S.shop.vip) gold = Math.round(gold * 1.5);
    const wasOpen = chOpen(n + 1), best = endless && R.kills > S.rec.best;
    if (win && !weekly) st[di] = Math.max(prev, stars);   // 주간 도전은 별 기록과 따로
    if (win && weekly) S.gem += 50;
    if (best) S.rec.best = R.kills;
    const pst = win ? 40 : 20;
    S.gold += gold; S.core += core; addPass(pst); const lvUp = addXp(win ? 30 : 15);
    S.rec.games++; if (win) S.rec.wins++;
    const notes = [];
    const sb = ui.startBonus; ui.startBonus = null;
    notes.push(sb ? `${og('star')}<span>시작 주사위 <b>${sb.d[0]}·${sb.d[1]} 더블</b> — ${sb.txt}</span>` : `${og('star')}<span>시작 주사위 ${ui.lastRoll ? ui.lastRoll.d.join('·') : ''} — 더블 아님(혜택 없음)</span>`);
    if (best) notes.push(`${og('trophy')}<span>무한 토벌 <b>최고 기록!</b> ${fmt(R.kills)}마리</span>`);
    if (weekly) notes.push(`${og('trophy')}<span>주간 도전 ${win ? '<b>성공! 보석 +50</b>' : '실패 — 이번 주 안에 다시 도전할 수 있어요'}</span>`);
    const q = S.daily[0]; if (q.cur < q.max) { q.cur++; notes.push(`${og('quest')}<span>임무 · ${q.n} <b>${q.cur}/${q.max}</b>${q.cur >= q.max ? ' — 임무에서 받기' : ''}</span>`); }
    S.weekly[0].cur = Math.min(S.weekly[0].max, S.weekly[0].cur + 1);
    notes.push(`${og('pass')}<span>패스 별 +${pst} → ${S.pass.lv}단계 ${S.pass.star}/${PASS_STEP}</span>`);
    if (lvUp) notes.push(`${og('star')}<span>계정 Lv ${S.lv}! <b>보석 +20</b></span>`);
    if (!wasOpen && chOpen(n + 1) && n < 6) notes.push(`${og('map')}<span><b>${n + 1}장 ${M.CHAPTERS[n].name}</b>이 열렸어요</span>`);
    if (di === 0 && first && n === 3) notes.push(`${og('trophy')}<span><b>지옥 난이도 · 무한 토벌</b>이 열렸어요</span>`);
    const sec = Math.max(0, Math.round(R.t || 0));
    ui.lastRes = { ch: n, d: di, win, endless, mode: R.modeKey || (endless ? 'endless' : 'solo'), stars, kills: R.kills, round: R.round || 0, maxTier: R.maxTier || 0, why: R.loseReason === 'time' ? '마지막 보스를 90초 안에 못 잡았어요' : '판 위 몬스터가 한도를 넘었어요',
      time: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, gold, core, first, doubled: false, notes, pst };
    ui.bump.gold = ui.bump.core = 1;
    go('result');
  }

  // ------------------------------------------------------------ 누름 처리(손가락을 빼거나 끌면 취소)
  let P = null;
  const stage = () => $('stage');
  const tgt = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest('[data-act]'); };
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest && e.target.closest('[data-act]'); if (!el || !stage().contains(el)) return;
    P = { el, x: e.clientX, y: e.clientY, moved: false }; el.classList.add('press'); SND.unlock();
  });
  document.addEventListener('pointermove', e => {
    if (!P) return;
    if (Math.hypot(e.clientX - P.x, e.clientY - P.y) > 18) P.moved = true;
    P.el.classList.toggle('press', !P.moved && tgt(e.clientX, e.clientY) === P.el);
  });
  document.addEventListener('pointerup', e => {
    if (!P) return; const p = P; P = null; p.el.classList.remove('press');
    // 손가락이 18px 넘게 움직였으면(밖으로 뺌 · 스크롤) 취소. 손가락은 그대로인데 창이 올라오며 단추가 움직인 경우는 눌림으로 인정
    if (p.moved || !p.el.isConnected) return;
    if (!['start', 'coop', 'endless', 'retry'].includes(p.el.dataset.act)) SND.click();
    const fn = A[p.el.dataset.act]; if (fn) { try { fn(p.el.dataset.arg); } catch (err) { console.error(err); toast('오류: ' + err.message); } }
  });
  // [v5.7] 소리 켜기 = 손을 뗄 때(pointerup · touchend · click) — 배경음이 실제로 돌 때까지 매번 다시 시도
  for (const ev of ['pointerup', 'touchend', 'click']) document.addEventListener(ev, () => { if (!SND.playing || !SND.ctx || SND.ctx.state !== 'running') SND.unlock(); }, true);
  document.addEventListener('pointercancel', () => { if (P) { P.el.classList.remove('press'); P = null; } });
  document.addEventListener('input', e => { if (e.target.id === 'nmInp') ui.lastName = e.target.value; });
  document.addEventListener('contextmenu', e => e.preventDefault());


  // ------------------------------------------------------------ [v5.3] 진입/전환 막 · 실제 판 · 첫 로딩 · 로비 주사위 안착
  const TIPS = ['같은 포탑 · 같은 단계 두 개를 끌어 겹치면 한 단계 위로!', '황금 주사위를 쓰면 2~12칸 중 원하는 칸으로 말을 보내요', '출발 칸을 지나면 월급, 출발 칸에 딱 멈추면 월급 2배!',
    '내 포탑 칸에 멈추면 단계업 카드가 떠요', '더블이 3번 연속이면 무인도로 가요 — 조심!', '판 위 몬스터가 한도를 넘으면 져요. 굴리기를 아끼지 마세요',
    '성장 탭에서 나무를 키우면 그 계열 포탑이 세져요', '시작 주사위가 더블이면 시작 혜택! 6·6이 가장 좋아요', '보스를 잡으면 작전 카드를 한 장 더 골라요'];
  const STREAK_C = ['#7ec0ff', '#b48aff', '#ffd23a', '#ff9ae0', '#9fe8ff'];
  function xferShow(word) {
    let x = $('xfer');
    if (!x) {
      x = document.createElement('div'); x.id = 'xfer';
      const streaks = Array.from({ length: 22 }, (_, k) => { const r = (k * 9301 + 49297) % 233280 / 233280; return `<i style="left:${(k * 4.7 + r * 3) % 100}%;width:${2 + (k % 3)}px;height:${140 + (k * 37) % 320}px;animation-duration:${1.1 + r * 1.4}s;animation-delay:-${(k * 0.37) % 2}s;background:linear-gradient(transparent, ${STREAK_C[k % 5]})"></i>`; }).join('');
      const pips = Array.from({ length: 6 }, (_, k) => `<span class="xdie" style="left:${8 + k * 16}%;animation-delay:-${k * 1.3}s;animation-duration:${7 + (k % 3) * 2}s">${isoDie(1 + (k * 2) % 6, S.eq.dice)}</span>`).join('');
      x.innerHTML = `<div class="xbg"></div><div class="xstreak">${streaks}</div><div class="xdice">${pips}</div><div class="xstage" data-fit><div class="xmid"></div><div class="xword"></div><div class="xtip"><b>Tip.</b> ${TIPS[Math.floor(Math.random() * TIPS.length)]}</div></div>`;
      document.body.appendChild(x); fit();
      requestAnimationFrame(() => requestAnimationFrame(() => x.classList.add('in')));
    }
    x.classList.remove('out');
    const w = x.querySelector('.xword'); w.textContent = word || ''; w.classList.toggle('on', !!word);
    return x;
  }
  function xferHide(after) {
    const x = $('xfer'); if (!x) { if (after) after(); return; }
    x.classList.add('out'); x.classList.remove('in');
    clearTimeout(xferHide.h); xferHide.h = setTimeout(() => { x.remove(); if (after) after(); }, 520);
  }
  // 덱 펼침(영상 참고: 이름 띠 → 덱 막대가 미끄러져 들어옴 → 포탑이 하나씩 내려앉음 → 지휘관 · 말 → 혜택)
  function deckReveal(mode, n, di, sb) {
    const C = M.CHAPTERS[n - 1];
    const title = mode === 'endless' ? '무한 토벌' : `${mode === 'weekly' ? '주간 도전 · ' : ''}${n}장 ${C.name} · ${DIFFN[di]}${mode === 'coop' ? ' · AI 협동' : ''}`;
    return `<div class="xd">
      <div class="xtitle">${title}</div>
      <div class="xban"><span class="pf"><img src="${IMG}p_${S.pawn}.png" alt=""></span><b>${S.name}</b><span class="lv">Lv ${S.lv}</span><span class="tt">${S.eq.title || ''}</span></div>
      <div class="xbar"><span class="xlab">내 덱</span>${deck().map((k, i) => `<span class="xslot" style="--fc:${fc(k)};--i:${i}"><img src="${tw(k, 3)}" alt=""><b>${tname(k).replace('탑', '')}</b></span>`).join('')}</div>
      <div class="xsub"><span class="xchip" style="--i:0"><img src="${IMG}c_${S.cmd}.png" alt=""><span><em>지휘관</em>${D.COMMANDERS[S.cmd].name}</span></span><span class="xchip" style="--i:1"><img src="${IMG}p_${S.pawn}.png" alt=""><span><em>말</em>${D.PAWNS[S.pawn].name}</span></span></div>
      <div class="xwait">판 준비 중<i>.</i><i>.</i><i>.</i> <b></b></div>
      ${sb ? `<div class="xbonus ${sb.d[0] === 6 ? 'jack' : ''}"><span class="dd">${isoDie(sb.d[0], S.eq.dice)}${isoDie(sb.d[1], S.eq.dice)}</span><span><em>시작 혜택 · ${sb.d[0]}·${sb.d[1]} 더블</em>${sb.txt}</span></div>` : ''}
    </div>`;
  }
  const removeGame = () => { const f = $('game'); if (f) { f.src = 'about:blank'; f.remove(); } };
  function backToOutgame(fn) { removeGame(); $('wrap').style.visibility = ''; ui.inGame = null; ui.gameMsg = null; fn(); setTimeout(() => xferHide(), 260); SND.music(); }
  function prepGame(mode, sb) {
    const wk = mode === 'weekly', n = wk ? 3 : S.chapter, di = wk ? 1 : DIFFS.indexOf(S.diff);   // 주간 도전 = 3장 · 어려움
    const G0 = ui.inGame = { mode, n: mode === 'endless' ? 1 : n, di, sb, ready: false, shown: false, go: false };
    SND.music();
    const og = { choice: { commander: S.cmd, pawn: S.pawn, mode: mode === 'endless' ? 'endless' : 'conquest', coop: mode === 'coop', deck: deck().slice(), diff: mode === 'endless' ? 'normal' : DIFFS[di], chapter: n },
      bonus: sb ? sb.fx : null, bonusTxt: sb ? { d: sb.d.join('·'), txt: sb.txt } : null, meta: { nodes: S.nodes, unlocked: S.unlocked } };
    const fr = G0.fr = document.createElement('iframe'); fr.id = 'game'; fr.className = 'pre'; fr.title = '마블 디펜스 판'; fr.setAttribute('allow', 'autoplay; fullscreen');
    fr.src = '../game.html?embed=1&og=' + encodeURIComponent(JSON.stringify(og));
    G0.attach = () => { if (!fr.isConnected && ui.inGame === G0) document.body.appendChild(fr); };
    // 크롬(안드로이드 · PC)은 판을 불러와도 이 화면이 거의 안 멈춤 → 착지 직후 바로. 아이폰(WebKit)은 같은 줄에서 돌아 로비가 멈칫 → 진입 막 아래에서(enterGame)
    const UA = navigator.userAgent, WK = /iPhone|iPad|iPod/.test(UA) || (/AppleWebKit/.test(UA) && !/Chrome|Chromium|Android|Edg/.test(UA)) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA));
    if (!WK) G0.attach();   // [v5.4] 판은 주사위가 다 구른 뒤 진입 막 아래에서 붙인다(던지는 동안 불러오면 아이폰에서 던지기 · 띠가 멈칫)
    const failNow = () => { if (ui.inGame === G0 && !G0.ready) { const x = $('xfer'); if (!x) xferShow(); backToOutgame(() => { go('home'); toast('판을 불러오지 못했어요 · 인터넷을 확인하고 다시 눌러 주세요'); }); } };
    G0.fail = setTimeout(failNow, 30000);   // 진행 소식이 30초 동안 없으면 실패(느린 데이터망에서도 진행 중이면 기다림)
    ui.gameMsg = m => {
      if (m.type === 'progress') { clearTimeout(G0.fail); G0.fail = setTimeout(failNow, 30000); const w = document.querySelector('#xfer .xwait b'); if (w) w.textContent = m.p + '%'; }
      if (m.type === 'ready') { G0.ready = true; G0.tryGo && G0.tryGo(); }
      if (m.type === 'over') {
        xferShow(m.win ? '승리!' : m.mode === 'endless' ? '토벌 끝' : '패배');
        setTimeout(() => backToOutgame(() => finishGame(G0.n, G0.di, Object.assign({}, m, { modeKey: mode }))), 900);
      }
      if (m.type === 'quit') { xferShow('로비로'); setTimeout(() => backToOutgame(() => { ui.startBonus = null; S.rec.games++; save(); go('home'); lobbyIntro(); }), 700); }
    };
  }
  function enterGame() {
    const G0 = ui.inGame; if (!G0) return;
    const x = xferShow(); x.querySelector('.xmid').innerHTML = deckReveal(G0.mode, G0.n, G0.di, G0.sb);
    setTimeout(() => { if (ui.inGame === G0) G0.fr.classList.remove('pre'); }, 380);   // 막이 다 덮은 뒤 판을 보이는 층으로
    setTimeout(() => G0.attach(), 420);   // 막이 덮은 직후부터 불러옴 — 덱 펼침은 CSS 애니메이션(GPU)이라 화면이 바빠도 끊기지 않음
    G0.tryGo = () => {
      if (!G0.ready || !G0.shown || G0.go || ui.inGame !== G0) return; G0.go = true; clearTimeout(G0.fail);
      const xd = x.querySelector('.xd'); if (xd) xd.classList.add('gone');            // 덱이 먼저 사라지고(막은 그대로)
      setTimeout(() => {
        if (ui.inGame !== G0) return;
        $('wrap').style.visibility = 'hidden';
        try { G0.fr.contentWindow.postMessage({ src: 'og', type: 'go' }, '*'); } catch (e) { /* 판 없음 */ }
        xferHide();                                                                     // 막이 걷히며 판이 보인다
      }, 700);
    };
    setTimeout(() => { G0.shown = true; G0.tryGo(); if (!G0.go) { const xd = x.querySelector('.xd'); if (xd) xd.classList.add('wait'); } }, G0.sb ? 3000 : 2600);   // 덱을 보여 주는 최소 시간 · 판이 늦으면 '판 준비 중…'
  }
  addEventListener('message', e => { const m = e.data; if (m && m.src === 'mdg' && ui.gameMsg && e.source === ($('game') || {}).contentWindow) ui.gameMsg(m); });

  // 로비 등장: 주사위 2개가 위에서 떨어져 받침에 안착(영상의 '주사위 인간 안착' 자리) + 위아래 UI가 들어옴
  function lobbyIntro() {
    if (ui.screen !== 'home') return;
    const sc = $('scr'); sc.classList.remove('intro'); void sc.offsetWidth; sc.classList.add('intro');
    ui.introUntil = performance.now() + 1150;
    clearTimeout(lobbyIntro.h); lobbyIntro.h = setTimeout(() => sc.classList.remove('intro'), 1900);
  }

  // 첫 로딩(3~5초 무작위 · 진짜 그림 미리 불러오기 · 멈칫/휙 하는 게이지) → 전환 막 → 로비 주사위 안착
  function boot(q) {
    const b = $('boot'); if (!b) return;
    if (q.get('noboot')) { b.remove(); setTimeout(prefetchGame, 1500); return; }
    b.querySelectorAll('.bdie').forEach(e => { e.innerHTML = isoDie(6, S.eq.dice); });   // 로고 옆 6·6(대박 더블)
    const T = 3000 + Math.random() * 2000; ui.bootT = T;
    const pre = [PIMG + 'load_key.jpg', ...M.CHAPTERS.map(C => PIMG + 'hb_ch' + C.n + '.jpg'), ...D.ALL.map(k => tw(k, 3)), IMG + 'c_' + S.cmd + '.png', IMG + 'p_' + S.pawn + '.png', IMG + 'i_coin.png'];
    let loaded = 0; pre.forEach(u => { const im = new Image(); im.onload = im.onerror = () => loaded++; im.src = u; });
    const W = [0, 0, 0, 0, 0].map(() => 0.6 + Math.random()), Wsum = W.reduce((a, c) => a + c, 0);
    const tgt = [0.16 + Math.random() * 0.12, 0.4 + Math.random() * 0.14, 0.62 + Math.random() * 0.14, 0.84 + Math.random() * 0.1, 1];
    const keys = [[0, 0]]; let acc = 0; W.forEach((w, i) => { acc += w / Wsum * T; keys.push([acc, tgt[i]]); });
    const STG = [[0, '데이터 불러오는 중…'], [0.2, '판 그림 펼치는 중…'], [0.45, '포탑 정비 중…'], [0.7, '주사위 굴리는 중…'], [0.92, '거의 다 됐어요…'], [1, '완료!']];
    const bar = b.querySelector('.bbar i'), pct = b.querySelector('.bpct'), stt = b.querySelector('.bstat');
    let t0 = 0, last = -1;
    const tick = now => {
      const t = now - t0; let pr = 1;
      for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) { const [ta, pa] = keys[i - 1], [tb, pb] = keys[i], u = (t - ta) / (tb - ta); pr = pa + (pb - pa) * (i === keys.length - 1 ? 1 - Math.pow(1 - u, 2) : u < 0.72 ? 1 - Math.pow(1 - u / 0.72, 3) : 1); break; }   // 마디마다 휙 → 멈칫, 마지막 마디는 목표 시간에 딱 100%
      if (pr >= 1 && loaded < pre.length && t < T + 3000) pr = 0.99;                 // 그림이 덜 왔으면 99%에서 잠깐 기다림(최대 3초)
      const v = Math.floor(pr * 100);
      if (v !== last) { last = v; bar.style.width = (pr * 100).toFixed(1) + '%'; pct.textContent = v + '%'; let label = STG[0][1]; for (const sg of STG) if (pr >= sg[0]) label = sg[1]; if (stt.textContent !== label) stt.textContent = label; }
      if (pr >= 1) { b.classList.add('full'); setTimeout(bootDone, 380); return; }
      requestAnimationFrame(tick);
    };
    const begin = () => { if (t0) return; t0 = performance.now(); b.classList.add('go'); requestAnimationFrame(tick); };
    try { document.fonts.load('400 120px Jua').then(begin, begin); } catch (e) { begin(); }
    setTimeout(begin, 900);
    function bootDone() {
      xferShow(); const x = $('xfer'); x.classList.add('bridge');
      b.classList.add('done');
      setTimeout(() => { b.remove(); go('home'); }, 520);
      setTimeout(() => { lobbyIntro(); xferHide(); }, 760);
      setTimeout(prefetchGame, 2500);
    }
  }
  // 로비에 있는 동안 본편 그림(약 24MB)을 뒤에서 천천히 미리 받아 둠 → 폰에서 첫 판 진입이 빨라짐(브라우저 캐시)
  function prefetchGame() {
    if (prefetchGame.on || location.protocol === 'file:') return; prefetchGame.on = true;
    const sc = document.createElement('script'); sc.src = '../js/manifest.js';
    sc.onload = () => {
      const MF = window.MANIFEST; if (!MF) return;
      const keys = ['board']; for (const k in MF) { if (k === 'board') continue; keys.push(k); if (MF[k].white) keys.push(k + '_w'); if (MF[k].grey) keys.push(k + '_g'); if (MF[k].back) { keys.push(k + '_b'); if (MF[k].white) keys.push(k + '_bw'); } }
      const urls = keys.map(k => IMG + (k === 'board' || (MF[k] && MF[k].jpg) ? k + '.jpg' : k + '.png'));
      let i = 0; const next = () => { if (ui.inGame || i >= urls.length) { if (i < urls.length) setTimeout(next, 3000); return; } const im = new Image(); im.onload = im.onerror = () => setTimeout(next, 0); im.src = urls[i++]; };
      for (let k = 0; k < 4; k++) next();
    };
    document.head.appendChild(sc);
  }
  // 덱 쟁반: 스크롤하면 고정선에 그늘 · 위(고정 칸)에서 휠을 굴려도 아래 목록이 움직임(엑셀 틀고정처럼)
  document.addEventListener('scroll', e => { const t = e.target; if (t && t.classList && t.classList.contains('tbody')) t.parentNode.classList.toggle('scrolled', t.scrollTop > 4); }, true);
  document.addEventListener('wheel', e => { if (ui.screen !== 'deck' || !e.target.closest || !e.target.closest('.deckfix')) return; const tb = document.querySelector('.tray .tbody'); if (tb) { tb.scrollTop += e.deltaY; e.preventDefault(); } }, { passive: false });
  function fit() {
    // [v5.4] 폰처럼 세로가 긴 화면은 무대 높이를 늘려 위아래 검은 띠를 없앤다(최대 1700) — 화면 요소는 위 · 아래에 붙어 있고, 로비 가운데 묶음은 늘어난 만큼의 절반 내려감
    const W = innerWidth, H = innerHeight; let k = Math.min(W / 720, H / 1280), sh = 1280;
    if (W / H < 720 / 1280) { sh = Math.min(1700, Math.round(H / (W / 720))); k = Math.min(W / 720, H / sh); }
    const st = stage(); st.style.setProperty('--sh', sh + 'px'); st.style.setProperty('--ex', (sh - 1280) + 'px'); st.style.setProperty('--exn', ((sh - 1280) / 420).toFixed(3));
    st.style.transform = `scale(${k})`; document.querySelectorAll('[data-fit]').forEach(e => { e.style.transform = `translate(-50%, -50%) scale(${k})`; }); }
  addEventListener('resize', fit);
  // 판 그림 미리 불러오기(장 바꿀 때 깜박임 없게)

  window.OG = { S: () => S, ui, A, go, render, rollStart, dblChance, game: () => $('game'), lobbyIntro, finishGame, snd: SND };   // 검수용
  const q = new URLSearchParams(location.search), s0 = q.get('s') || 'home';
  fit();
  ui.lastName = S.name;
  if (s0 === 'tower') { go('deck'); open({ type: 'tower', k: 'bolt' }); history.replaceState(null, '', '?s=tower'); }
  else if (s0 === 'result') { ui.lastRes = fakeRes(); go('result'); }
  else go(s0);
  boot(q);
})();
