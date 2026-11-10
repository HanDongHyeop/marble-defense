// 게임 데이터 — 수치는 기획서 v3.0 기준, [조정]은 QA 시뮬레이션으로 바꾼 값.
(function (root) {
  const TOWERS = {
    fire:    { name: '화염탑',   fam: '원소', dmgType: 'elem',  atk: 24, aps: 1.0,  color: '#ff7a2a', desc: '불덩이가 터지며 화상. 4단계 화염 창 · 5단계 검의 불길 참격 · 6단계 용의 숨결', range: 1.5 },
    gatling: { name: '개틀링탑', fam: '기계', dmgType: 'mech',  atk: 7,  aps: 1.67, color: '#ffc23a', desc: '3점사. 같은 적을 계속 쏘면 빨라진다', burst: 3, range: 2 },
    bolt:    { name: '번개탑',   fam: '비전', dmgType: 'arc',   atk: 22, aps: 1.0,  color: '#b58cff', desc: '전기 구슬이 다른 적에게 튄다. 4단계부터 연쇄가 길고 강해진다', range: 2 },
    light:   { name: '성광탑',   fam: '성역', dmgType: 'holy',  atk: 12, aps: 1.25, color: '#ffe9a0', desc: '양옆 포탑 공속 +(단계×3)%(4단계부터 ×1.5). 4단계부터 태양 창이 옆 적에게 튄다', range: 2.5 },
    tyrant:  { name: '폭군탑',   fam: '심연', dmgType: 'abyss', atk: 27, aps: 0.83, color: '#e0303a', desc: '판에 하나뿐이면 피해 1.8배 + 10초마다 판 전체 피해', range: 1.5 },
    ice:     { name: '빙결탑',   fam: '원소', dmgType: 'elem',  atk: 44, aps: 0.67, color: '#9fe0ff', desc: '고드름이 빙결을 쌓는다. 5중첩이면 1초 얼음', range: 2 },
    poison:  { name: '맹독탑',   fam: '원소', dmgType: 'elem',  atk: 10, aps: 0.67, color: '#7be06a', desc: '중독을 쌓는다(최대 단계×3). 4단계부터 터지며 둘레를 중독시키는 독 폭탄', range: 2.5 },
    railgun: { name: '레일건탑', fam: '기계', dmgType: 'mech',  atk: 30, aps: 0.25, color: '#7ec0ff', desc: '관통 저격. 멀수록 강함(칸당 +6%). 4단계부터 맞은편까지 빔', range: 4 },
    mining:  { name: '채굴탑',   fam: '기계', dmgType: 'mech',  atk: 18, aps: 0.83, color: '#ffd23a', desc: '10초마다 금화(단계 수 · 5단계부터 2배). 이 탄으로 처치하면 금화 +단계', range: 2 },
    summon:  { name: '소환탑',   fam: '비전', dmgType: 'arc',   atk: 8, aps: 0.83, color: '#5fe0c8', desc: '합칠 때 빈 땅에 무작위 1단계 포탑 소환. 유도 정령 구슬', range: 3 },
    combo:   { name: '콤보탑',   fam: '비전', dmgType: 'arc',   atk: 10, aps: 1.0,  color: '#ff8adf', desc: '2타 공격. 콤보탑끼리 합칠 때마다 콤보 +1(모든 콤보탑 피해 +4%씩)', range: 2 },
    beacon:  { name: '봉화탑',   fam: '성역', dmgType: 'holy',  atk: 7, aps: 1.0,  color: '#ffb347', desc: '같은 구역 포탑 피해 +(단계×2)%(요새면 2배, 최대 +12%). 은신을 드러낸다', range: 3 },
    growth:  { name: '성장탑',   fam: '성역', dmgType: 'holy',  atk: 11, aps: 1.0,  color: '#fff2a0', desc: '20초마다 성장 시도: 33%(5단계 50%) +1단계(무작위 종류) / 실패 −1단계', range: 2 },
    corrode: { name: '부식탑',   fam: '심연', dmgType: 'abyss', atk: 27, aps: 0.67, color: '#a6e04a', desc: '부식(받는 피해 +7%/중첩, 최대 단계×2). 4단계부터 터지는 산성 덩어리', range: 2 },
    greed:   { name: '탐욕탑',   fam: '심연', dmgType: 'abyss', atk: 15, aps: 1.0,  color: '#ffd23a', desc: '금화 15당 피해 +5%(최대 +40%). 합칠 때 금화 몬스터가 나온다', range: 2 },
    prism:   { name: '프리즘탑', fam: '조커', dmgType: 'none',  atk: 8,  aps: 1.0,  color: '#e0d0ff', desc: '조커: 같은 단계면 어떤 포탑과도 합친다(결과 = 상대 +1). 출동 없음', range: 2 },
  };
  // [v4.5] 사거리(길을 따라 앞뒤 칸) = 계열 · 컨셉별 기본 + 단계 보너스. 짧음 1.5 = 근접 · 화력형(화염 · 채굴 · 콤보 · 폭군), 2 = 보통,
  //   2.5 ~ 3 = 지원 · 단일 화력이 약한 종류(맹독 · 성광 · 소환 · 봉화), 4 = 저격(레일건, 4단계부터는 판을 가로지름 12)
  // [v4.5 계열 덱 측정 후] 기계 덱 17%(성역 · 심연 88%) → 레일건 공격력 26 → 30(1~3단계는 ×1.8 — 판을 가로지르기 전 저격이 약했음) · 채굴 사거리 1.5 → 2 · 폭군 공격력 30 → 27 · 홀로 2배 → 1.8배 · 성장 6단계 ×4 → ×3 · 맹독 공격력 8 → 10 · 부식 중첩 8% → 7% · 봉화 상한 15% → 12% · 파쇄 1.6 → 1.4배 · 성장 성공 40 → 33%
  const RANGE_T = [0, 0, 0, 0.5, 0.5, 1, 1];
  const ALL = ['fire', 'ice', 'poison', 'gatling', 'railgun', 'mining', 'bolt', 'summon', 'combo', 'light', 'beacon', 'growth', 'tyrant', 'corrode', 'greed', 'prism'];
  const DECK = ['fire', 'gatling', 'bolt', 'light', 'tyrant'];
  const PRESETS = [
    { name: '기본 덱', deck: ['fire', 'gatling', 'bolt', 'light', 'tyrant'] },
    { name: '속성 반응(고수용)', deck: ['ice', 'fire', 'gatling', 'corrode', 'light'] },
    { name: '출동 콤보', deck: ['gatling', 'beacon', 'summon', 'light', 'prism'] },
    { name: '콤보', deck: ['combo', 'prism', 'summon', 'light', 'ice'] },
    { name: '단계업 경제', deck: ['mining', 'greed', 'fire', 'ice', 'growth'] },
    { name: '독 · 부식', deck: ['poison', 'fire', 'corrode', 'railgun', 'beacon'] },
  ];
  const TIER = {
    // [v4.5] 한 번에 쏘는 탄 = 단계 수(6단계 6발). vol = 한 번 공격의 총 피해 배수(예전 단계별 값 그대로), dmg = 탄 1발 = vol / shots
    shots: [0, 1, 2, 3, 4, 5, 6],
    vol:   [0, 1, 2, 3, 4.1, 5, 5.9],
    dmg:   [0, 1, 1, 1, 1.025, 1, 5.9 / 6],
    aps:   [0, 1, 1.1, 1.2, 1.35, 1.5, 1.7],
    name:  ['', '초소', '포루', '포탑', '성탑', '수호상', '전설'],
    ring:  ['', '#a8a29a', '#6fd36a', '#5aa8ff', '#b07cff', '#ff9a3a', '#ffd23a'],
  };
  const STRIKE = {
    fire: '불기둥 — 그 구역 길 전체에 불',
    gatling: '탄막 — 5초 동안 공속 3배',
    bolt: '낙뢰 — 판 위 적 (단계×3)마리',
    light: '축성 — 그 구역 포탑 10초 공속 2배',
    tyrant: '공포 정치 — 판 전체 피해',
    ice: '눈보라 — 판 전체 빙결 2중첩',
    poison: '독안개 — 그 구역 길 중독 5중첩',
    railgun: '궤도 포격 — 체력이 가장 높은 적에게 큰 한 방',
    mining: '노다지 — 금화 즉시(단계×4)',
    summon: '소환진 — 빈 땅 1칸에 1단계 포탑',
    combo: '연타 폭발 — 콤보 +1, 맨 앞 적에게 큰 한 방',
    beacon: '봉화 — 10초 동안 판 전체 피해 +30%',
    growth: '축복 — 다음 성장 확정 성공 + 지금 성장 시도',
    corrode: '부식 웅덩이 — 그 구역 길 부식 최대',
    greed: '황금 행렬 — 금화 몬스터 5마리',
    prism: '없음(조커)',
  };
  const AWAKEN = {
    fire: '화상이 옆 적에게 번진다', ice: '보스도 얼린다', poison: '중독된 적이 죽으면 주변에 전염', gatling: '대상이 바뀌어도 가속 유지',
    railgun: '처치하면 연쇄 저격', mining: '보유 금화 1%를 매초 이자(최대 6)', bolt: '연쇄가 50% 확률로 기절', summon: '소환 포탑이 2단계',
    combo: '어떤 포탑을 합쳐도 콤보 +1', light: '버프가 맞은편 칸에도', beacon: '그 구역은 요새가 아니어도 요새 효과', growth: '성장 실패가 없다',
    tyrant: '다른 폭군탑을 흡수(영구 공격력 +30)', corrode: '부식 중첩 제한 없음', greed: '놓친 금화 몬스터가 몬스터 수에 안 들어감', prism: '양옆 포탑의 공격을 함께 쏜다',
  };
  const MONSTERS = {
    normal:   { name: '꼬물이',     hp: 1,    spd: 1,   w: 1,  gold: 1 },
    fast:     { name: '날쌘이',     hp: 0.5,  spd: 2,   w: 1,  gold: 1 },
    armor:    { name: '철갑이',     hp: 1.5,  spd: 1,   w: 1,  gold: 1, resist: { mech: 0.5 } },
    giant:    { name: '왕꼬물',     hp: 10,   spd: 0.6, w: 3,  gold: 4 },
    barrier:  { name: '방울이',     hp: 1.5,  spd: 1,   w: 1,  gold: 1, resist: { elem: 0.5 } },
    splitter: { name: '쌍둥이',     hp: 0.8,  spd: 1,   w: 1,  gold: 1, split: 2 },
    mini:     { name: '꼬마둥이',   hp: 0.3,  spd: 1.2, w: 1,  gold: 0.3 },
    elite:    { name: '왕관 박쥐',  hp: 6,    spd: 0.9, w: 3,  gold: 5, occupy: true },
    truck:    { name: '현금 수송차', hp: 8,   spd: 1.0, w: 0,  gold: 0 },
    stealth:  { name: '그림자',     hp: 1,    spd: 1.1, w: 1,  gold: 1.5, stealth: true },
    goldmon:  { name: '금화 꼬물',  hp: 0.6,  spd: 1.1, w: 1,  gold: 0 },
  };
  const BOSSES = {
    destroyer: { name: '파괴왕',   kind: 'disrupt', desc: '포탑 2개에 망치 예고 — 15초 안에 그 칸에 멈춰 구조(못 구하면 −1단계)' },
    ghost:     { name: '정전 귀신', kind: 'disrupt', desc: '포탑 3개를 잠시 멈춘다' },
    piggy:     { name: '저금통',   kind: 'reward',  desc: '60초 버티면 가진 금화의 50% 보너스' },
    goblin:    { name: '황금 고블린', kind: 'reward', desc: '한 바퀴 안에 잡으면 작전 카드 2번' },
    witch:     { name: '마녀',     kind: 'disrupt', desc: '포탑 1개의 종류를 무작위로 바꾼다' },
    magician:  { name: '마술사',   kind: 'disrupt', desc: '가장 낮은 포탑 1개를 프리즘탑(조커)으로 — 아무 포탑과 합쳐지는 선물' },
    quake:     { name: '지진 거인', kind: 'disrupt', desc: '포탑 2개의 자리를 뒤섞는다(속성은 칸에 남음)' },
    swindler:  { name: '사기꾼',   kind: 'disrupt', desc: '포탑 1개 점령 — 그 칸에 멈춰 탈환' },
  };
  const TRAITS = {
    arms:   { name: '무기고',   good: true,  desc: '공격력 +30%' },
    drill:  { name: '훈련장',   good: true,  desc: '공속 +25%' },
    watch:  { name: '망루',     good: true,  desc: '사거리 +1칸 · 치명 +10%' },
    holy:   { name: '성지',     good: true,  desc: '출동 피해 ×2' },
    gold:   { name: '금맥',     good: true,  desc: '멈추면 금화 +라운드 수 · 처치 금화 +1' },
    luck:   { name: '행운의 땅', good: true, desc: '합치기 · 단계업 때 20%로 +1단계 더' },
    choke:  { name: '길목',     good: true,  desc: '앞 길 몬스터 속도 −20%' },
    fog:    { name: '안개',     good: false, desc: '사거리 −1칸' },
    web:    { name: '거미줄',   good: false, desc: '공속 −20%' },
    target: { name: '표적지',   good: false, desc: '보스 교란이 여기부터 노린다' },
  };
  // [v4.7] 땅 기운 — 말이 이 땅에 멈추면 판 전체에 n초 동안 효과(사용자: '좋은 것 = n초 치명 · 공격력 · 몬스터 방어 깎기, 나쁜 것 = n초 몬스터 방어 · 이동 속도 증가')
  //   칸 위 포탑만 바꾸던 땅 속성(위 TRAITS)은 그대로 두고, 멈추는 순간 판 전체가 바뀌는 장면을 더함. 같은 기운이 또 걸리면 시간만 새로(겹치지 않음)
  //   행운의 땅 = 좋은 기운 하나를 무작위로(룰렛), 금맥 = 기운 대신 금화(그대로)
  //   [측정] 좋은 기운 +30% · 8초면 몬스터 생존 3.9 → 3.2초(v4.6 호흡이 다시 빨라짐) → +25% · 6초 = 3.9초 유지, 승률 보통 60 → 70%대(봇 60판, 기운 없음과 비교)
  // [v5.5] plain = 알림 띠 제목(사용자: '느림' 같은 줄임말 대신 '몬스터 이동 속도 감소'처럼 한 번에 읽히게) · amt = 띠 아래 숫자
  const LANDFX = {
    atk:     { name: '무기 보급',   good: true, plain: '포탑 공격력 증가', amt: '+25%',  trait: 'arms',   dur: 6, v: 0.25, short: '공격↑', desc: '모든 포탑 공격력 +25%' },
    aps:     { name: '맹훈련',      good: true, plain: '포탑 공격 속도 증가', amt: '+25%',  trait: 'drill',  dur: 6, v: 0.25, short: '공속↑', desc: '모든 포탑 공격 속도 +25%' },
    crit:    { name: '약점 포착',   good: true, plain: '포탑 치명 확률 증가', amt: '+25%',  trait: 'watch',  dur: 6, v: 0.25, short: '치명↑', desc: '모든 포탑 치명 확률 +25%' },
    armDown: { name: '정화의 빛',   good: true, plain: '몬스터 방어력 감소', amt: '−25%',  trait: 'holy',   dur: 6, v: 0.25, short: '방어↓', desc: '몬스터 방어력 −25%(받는 피해 +25%)' },
    slow:    { name: '길막기',      good: true, plain: '몬스터 이동 속도 감소', amt: '−25%',  trait: 'choke',  dur: 6, v: 0.25, short: '이속↓', desc: '몬스터 이동 속도 −25%' },
    armUp:   { name: '짙은 안개',   good: false, plain: '몬스터 방어력 증가', amt: '+25%', trait: 'fog',    dur: 8, v: 0.25, short: '방어↑', desc: '몬스터 방어력 +25%(받는 피해 −25%)' },
    apsDown: { name: '거미줄 덫',   good: false, plain: '포탑 공격 속도 감소', amt: '−25%', trait: 'web',    dur: 8, v: 0.25, short: '공속↓', desc: '모든 포탑 공격 속도 −25%' },
    rush:    { name: '돌격 신호',   good: false, plain: '몬스터 이동 속도 증가', amt: '+30%', trait: 'target', dur: 8, v: 0.3,  short: '이속↑', desc: '몬스터 이동 속도 +30%' },
  };
  const FX_OF = {}; for (const k in LANDFX) FX_OF[LANDFX[k].trait] = k;
  if (typeof process !== 'undefined' && process.env && process.env.LFX) { const x = JSON.parse(process.env.LFX); for (const k in LANDFX) Object.assign(LANDFX[k], x[k] || x[LANDFX[k].good ? 'good' : 'bad'] || {}); }   // 측정용: LFX='{"good":{"v":0}}'
  // 정복 1장 땅 배치(좋은 땅 9 · 나쁜 땅 3 · 평지 8)
  const MAP1 = { 1: 'choke', 3: 'arms', 5: 'fog', 7: 'watch', 9: 'luck', 10: 'web', 14: 'holy', 16: 'gold', 17: 'target', 19: 'drill', 21: 'arms', 23: 'gold' };
  const CORNER = { 0: 'start', 6: 'island', 12: 'key', 18: 'space' };
  const ZONE_COLOR = ['#5fbf6a', '#4a9bff', '#ff6161', '#f2c230'];
  const ZONE_NAME = ['녹색', '청색', '적색', '황색'];

  const UPGRADE_COST = [20, 35, 55, 80, 110, 150, 200, 260, 330, 420];   // [v4.6 금화 단위 1/8 · 후반이 덜 가파르게: 전 100 ~ 5,000]

  const COMMANDERS = {
    gambler:   { name: '도박사',   mode: 'tap',  cd: 60,  act: '황금 주사위 1개', pas: '더블이 나오면 금화 +라운드×2' },
    cheer:     { name: '응원단장', mode: 'tap',  cd: 65,  act: '10초 동안 판 전체 공속 +30%', pas: '요새 구역 공속 +10%' },
    architect: { name: '건축가',   mode: 'drag', cd: 180, act: '끌어 놓은 포탑 즉시 +1단계(4단계까지)', pas: '착지 단계업 비용 −10%' },
    demolish:  { name: '철거반장', mode: 'drag', cd: 50,  act: '끌어 놓은 포탑 철거 → 금화(단계×8) + 구역 폭발', pas: '쿵 피해 +30%' },
    mechanic:  { name: '정비공',   mode: 'drag', cd: 60,  act: '끌어 놓은 포탑 → 같은 단계, 판에 가장 많은 종류로(합칠 짝 만들기)', pas: '1단계를 지을 때 10%로 2단계' },   // [v4.0: 단계를 깎는 능력이라 38%로 가장 약했음]
    teleporter:{ name: '순간이동술사', mode: 'drag', cd: 45, act: '끌어 놓은 포탑과 고른 칸의 자리 바꾸기', pas: '우주여행이 2번(원하는 칸으로 2연속)' },
  };
  const PAWNS = {
    // [v4.1] 말 = 단순한 보드게임 말 6색(캐릭터가 되면 포탑보다 눈에 띈다 — 사용자 지적). 효과는 그대로, id는 저장 호환을 위해 유지
    car:  { name: '빨간 말',   desc: '지나간 칸의 포탑 3초 동안 공속 +40%' },
    dog:  { name: '파란 말', desc: '내 포탑 칸에 멈추면 출동 피해 +35%' },
    hat:  { name: '노란 말', desc: '출발을 지나면 월급 +10%' },
    boat: { name: '주황 말',     desc: '쿵 피해 +50%, 앞뒤 1칸 길까지' },
    boot: { name: '초록 말', desc: '지나간 칸 앞 길 2초 동안 몬스터 둔화 30%' },
    cat:  { name: '보라 말', desc: '빈 땅에 멈추면 15%로 2단계 건설' },
  };

  // 작전 카드 — 등급: c 일반 · r 희귀 · l 전설
  // [v4.2] st: 1 = 판 시작 카드로도 나옴 · 2 = 시작에만 나옴. 표시 없음 = 중간(보스 처치)에만 — 시작엔 포탑이 없어 소용없는 카드(끌어올리기 · 요새 · 출동 · 단계업 등)를 빼려고(사용자 지적)
  // [v5.4] 작전 카드 4등급: c 일반 · r 희귀 · e 영웅 · l 전설(사용자: '일반/희귀/영웅/전설 · 전설이 가장 좋지만 덜 나오게 · 너무 안 나오면 안 됨 → 보정')
  // st: 1 = 판 시작 카드로도 나옴 · 2 = 시작에만 나옴. 표시 없음 = 중간(보스 처치)에만
  const CARDS = {
    // [v5.6 등급 검토] 사용자(2026-11-10): '일반이 희귀보다 좋아 보이는 게 있다' → test/card_value.js(어려움 · 카드당 24판 · 카드 없음 승률 33%)로 재고 등급 · 수치를 맞춤
    quickhand: { name: '빠른 손',     g: 'l', st: 1, desc: '굴리기 비용이 +2 대신 +1씩 오른다' },   // 일반 → 전설(승률 83% — 영웅 최고 62%보다 높고 전설 미다스 다음)
    bighand:   { name: '큰손',        g: 'c', st: 1, desc: '금화 +라운드×3 (최소 20) 즉시' },
    sharp:     { name: '날카로운 탄', g: 'c', st: 1, desc: '1~3단계 포탑 피해 +25%' },
    wall:      { name: '단단한 성벽', g: 'c', st: 1, desc: '허용 몬스터 수 +8' },
    seed:      { name: '첫 진지',     g: 'c', st: 2, desc: '빈 땅 2칸에 1단계 포탑을 바로 짓는다' },
    freeroll:  { name: '공짜 굴림',   g: 'c', st: 2, desc: '처음 5번은 금화 없이 굴린다' },
    fortx2:    { name: '철통 요새',   g: 'r', desc: '요새 효과 2.5배' },   // 2 → 2.5배(카드 없음과 같았음)
    fort4:     { name: '4칸 요새',    g: 'r', desc: '4칸만 채워도 요새' },
    tierdisc:  { name: '단계업 할인', g: 'r', desc: '착지 단계업 비용 −25%' },
    reclaim:   { name: '개간',        g: 'r', st: 1, desc: '평지 3칸을 무작위 좋은 땅으로' },   // 2 → 3칸(카드 없음보다 낮았음)
    focus:     { name: '집중 사격',   g: 'r', st: 1, desc: '덱의 무작위 한 종류 피해 +40%' },
    gdice2:    { name: '황금 주사위 둘', g: 'r', st: 2, desc: '황금 주사위 +2 (원하는 칸으로 두 번)' },
    strikex2:  { name: '출동 대장',   g: 'e', desc: '출동 피해 3배 · 출동한 포탑은 6초 동안 공격 속도 +50%' },   // 2배 → 3배 + 공속(봇 기준 카드 없음보다 낮았음)
    lift:      { name: '끌어올리기',  g: 'e', desc: '가장 낮은 단계 포탑 3개 즉시 +1단계' },   // 2 → 3개
    critEye:   { name: '치명의 눈',   g: 'e', st: 1, desc: '치명 확률 +10%, 치명 피해 +30%' },
    elemental: { name: '원소 폭주',   g: 'e', desc: '속성 반응 피해 3배' },   // 2 → 3배
    salary:    { name: '두둑한 월급', g: 'e', st: 1, desc: '월급 2배' },
    haste:     { name: '질풍',        g: 'e', st: 1, desc: '모든 포탑 공격 속도 +30%' },   // 20 → 30%(카드 없음과 비슷했음)
    lonely:    { name: '고독한 탑',   g: 'l', desc: '판 위 포탑이 12개 이하면 모든 피해 +60%' },   // 8개 · 50% → 12개 · 60%(카드 없음보다 낮았음)
    deal:      { name: '위험한 거래', g: 'l', st: 1, desc: '허용 몬스터 수 −10, 모든 피해 +50%' },
    awaken:    { name: '각성 맛보기', g: 'l', desc: '덱의 무작위 두 종류 — 피해 +30% · 전설 각성을 3단계부터 미리 켠다' },   // 한 종류 · 4단계 → 두 종류 · 3단계
    midas:     { name: '미다스의 손', g: 'l', st: 1, desc: '굴리기 비용이 세 번에 한 번만 오른다' },   // 안 오름(승률 100% · 판이 끝남) → 3번에 1번
  };
  // 등급별 기본 확률(카드 한 장마다, %) — 판이 깊어질수록 높은 등급이 잦아짐
  const CARD_ODDS = [[0, { c: 58, r: 30, e: 10, l: 2 }], [1, { c: 58, r: 30, e: 10, l: 2 }], [5, { c: 50, r: 32, e: 14, l: 4 }], [10, { c: 42, r: 34, e: 18, l: 6 }], [15, { c: 34, r: 36, e: 22, l: 8 }]];
  // 보정(천장): 영웅 이상이 안 나온 묶음이 쌓이면 영웅 +4%p씩(2묶음부터) · 4묶음째 1장은 반드시 영웅 이상 /
  //            전설이 안 나온 묶음이 쌓이면 전설 +2%p씩(4묶음부터) · 10묶음째 1장은 반드시 전설. 묶음 수는 판을 넘어 이어짐(기기 저장)
  const CARD_PITY = { e: { from: 2, step: 4, sure: 4 }, l: { from: 4, step: 2, sure: 10 } };
  const KEYS = {
    space:   { name: '우주여행권',  good: true,  desc: '다음 굴림은 원하는 칸으로' },
    world:   { name: '세계일주 진군', good: true, desc: '한 바퀴 돌며 지나는 칸마다 쿵! + 월급' },
    order:   { name: '출동 명령',   good: true,  desc: '가장 높은 단계 포탑으로 가서 출동' },
    back:    { name: '후진',        good: true,  desc: '뒤로 2칸, 그 칸 착지 효과가 한 번 더' },
    medal:   { name: '훈장',        good: true,  desc: '덱 무작위 1종 강화 +1 무료' },
    supply:  { name: '보급 상자',   good: true,  desc: '금화 +라운드×2 (최소 20)' },
    shield:  { name: '방패 부적',   good: true,  desc: '다음 나쁜 일 1번을 막는다' },
    gdice:   { name: '황금 주사위', good: true,  desc: '황금 주사위 +1' },
    mines:   { name: '지뢰 파티',   good: true,  desc: '20초 동안 말이 지나간 길에 지뢰' },
    island:  { name: '무인도행',    good: false, desc: '무인도로, 3초 굴리기 잠김' },
    demol:   { name: '철거 위기',   good: false, desc: '가장 높은 단계 포탑에 파괴 예고 15초' },
    broken:  { name: '고장',        good: false, desc: '가장 많은 종류의 포탑 전부 4초 정지' },
    rampage: { name: '폭주',        good: false, desc: '10초 동안 몬스터 이동 속도 +30%(돌격 신호)' },
  };
  const MISSIONS = {
    noT1:     { name: '1단계 포탑을 하나도 남기지 마라' },
    fort:     { name: '요새 1개 완성' },
    combo5:   { name: '연속 출동 ×5' },
    t4x2:     { name: '4단계 이상 포탑 2개' },
    good4:    { name: '좋은 땅 4칸에 포탑' },
    thud10:   { name: '쿵으로 10마리 처치' },
    gold3000: { name: '금화 400 모으기' },
    noroll:   { name: '30초 동안 굴리지 마라' },
    nbr3:     { name: '같은 종류 3개를 이웃으로' },
    elite:    { name: '엘리트나 수송차 처치' },
  };

  const ECON = {
    // [v4.6 호흡] 참고 영상(소환 20 + 2씩 · 웨이브당 소환 약 2번 · 처치 1마리 = 소환 값의 1/20)에 맞춰 금화 단위를 약 1/8로 낮추고 굴리기 값은 천천히 오르게.
    //   전: 굴리기 10 + 10씩 · 처치 10 + 8×R · 월급 100 + 20×R → 10R 수입 약 5,000/라운드(초당 240) · 라운드당 굴림 5~7번 · 몬스터 생존 2.5~5초
    //   후: 굴리기 20 + 2씩 · 처치 6 + 0.3×R · 월급 40 + 6×R → 10R 수입 약 550/라운드(초당 26) · 라운드당 굴림 3~4번 · 몬스터 생존 4~8초(node test/pace.js)
    startGold: 100, rollBase: 20, rollStep: 2,
    salary: r => 40 + 6 * r,
    kill: r => 6 + 0.3 * r,
    hp: r => (typeof process !== 'undefined' && process.env && process.env.HPF) ? Function('r', 'return ' + process.env.HPF)(r)
      // [v4.6] 굴림이 줄어 포탑 성장이 느려진 만큼 다시 맞춤. 42×1.16^(R−1) × 초반 배수(1 + 2e^(−(R−1)/6)) × 3~9R 혹(+70%, 6R 정점) + 2~5R 혹(+50%, 3.5R 정점) — 영상처럼 초반에도 몬스터가 판 위에 남아 돌게(포탑이 '겨우 따라잡는' 구간)
      //   × (12 + 2R)/(마릿수) — 마릿수를 고르게 바꾼 만큼 라운드 총 체력은 유지
      : 42 * Math.pow(1.16, r - 1) * (1 + 2 * Math.exp(-(r - 1) / 6)) * (1 + 0.7 * Math.exp(-Math.pow((r - 6) / 4, 2)) + 0.5 * Math.exp(-Math.pow((r - 3.5) / 1.5, 2))) * (12 + 2 * r) / (18 + 1.4 * r),   // 일반 몬스터 체력 [조정: 40×1.23^(R−1) → 50×1.19^(R−1)] [v4.5 상향: 초반 ×3.5 → 점점 줄어 20R ×1.3 — 참고 영상처럼 초반 웨이브에도 몬스터가 버티게(1~4R 압박 5% → 15~20%)]
    count: r => Math.ceil(18 + 1.4 * r),       // 라운드 몬스터 수 [v4.6: 12 + 2R → 18 + 1.4R — 영상처럼 웨이브마다 고르게 많이(1R 14 → 20 · 20R 52 → 46)]
    roundTime: 21, spawnTime: 15, rounds: 20, limit: 50,
    bossHp: 58, bossW: 10, enrage: 40, finalLimit: 90,   // [v5.6] 60 → 58: 보스 단독 · A안(철거 없음)에서 보스 처치 시간 중간값 44초(전 42초) — node test/balance.js 40 두 표본
    bossSpd: 1.2, bossHold: 60, bossGold: 0.5,      // [v5.6] 보스 이동 +20% · 보스가 살아 있는 동안 다음 라운드를 최대 60초 미룸(보스 단독) · 보스 처치 금화 = 그 라운드 일반 몬스터 처치 금화 × 이 배수
    monSpeed: 1.0,                             // 칸/초 [조정: 기획 1.2 → 1.0]
    thud: 0.5, strikeMul: 3, upgStep: 0.15,      // 강화 1레벨당 공격력 [조정: 10% → 15%]
    // v4.0 주사위 박자(모두의 마블 · 모노폴리 GO 참고): 굴림 연출 → 칸마다 통통 → 착지 멈춤 → 효과. 한 번에 약 1.9초
    diceT: (typeof process !== 'undefined' && process.env && process.env.DICET ? +process.env.DICET : 0.95), hop: 0.13, hopLast: 0.2, landBeat: 0.3, offerT: 4, rollQMax: 1,
    tierUp: (typeof process !== 'undefined' && process.env && process.env.TIERUP) ? [0].concat(process.env.TIERUP.split(',').map(Number)) : [0, 2.0, 3.2, 4.6, 6.4],          // 착지 단계업 값 = 굴리기 값 × 이 배수(1→2 ··· 4→5)
    ctrl: 0.45,                                // 주사위 조절 성공 확률(규칙만 남김 — [v4.2] 화면의 꾹 누르기 게이지는 없앰)
  };

  // [v4.6] 조정 장치: ECONX='{"rollStep":2,"kill":"6+0.3*r","upg":[..]}' — 수치를 바꿔 넣고 봇을 돌려 호흡을 맞출 때만 쓴다(게임에서는 안 씀)
  if (typeof process !== 'undefined' && process.env && process.env.ECONX) {
    const x = JSON.parse(process.env.ECONX);
    for (const k in x) { if (k === 'upg') UPGRADE_COST.splice(0, UPGRADE_COST.length, ...x.upg); else ECON[k] = typeof x[k] === 'string' ? Function('r', 'return ' + x[k]) : x[k]; }
  }

  // 난이도: 수치만이 아니라 규칙으로(기획 12장) — 어려움 = 나쁜 땅 +2 · 요새 절반, 지옥 = + 몬스터 한도 40 · 보스 교란 빠름
  const DIFF = {
    normal: { name: '보통', hp: 1, desc: '처음 하는 판' },
    hard:   { name: '어려움', hp: 1.5, badLand: 2, fortHalf: true, desc: '체력 ×1.5 · 나쁜 땅 +2 · 요새 효과 절반' },
    hell:   { name: '지옥', hp: 1.6, badLand: 4, fortHalf: true, limit: 40, fastBoss: true, desc: '체력 ×1.6 · 나쁜 땅 +4 · 요새 절반 · 한도 40 · 보스 교란 빠름' },
  };
  // [v5.5] 계열 색 — 한눈에 계열이 갈리게 서로 다른 다섯 색(전엔 원소·기계·성역·심연이 모두 따뜻한 색이라 덱에서 구분이 안 됐음). 아웃게임 · 도감 · 합치기 힌트가 모두 이 표를 쓴다
  const FAMC = { 원소: '#ff6a3d', 기계: '#38c4ff', 비전: '#a77bff', 성역: '#ffd84a', 심연: '#ff3d8a', 조커: '#e8dcff' };
  const REACT = { thermal: '열충격!', superc: '초전도!', toxic: '유독 폭발!', shatter: '파쇄!' };
  const DATA = { FAMC, LANDFX, FX_OF, RANGE_T, DIFF, TOWERS, ALL, PRESETS, AWAKEN, REACT, DECK, TIER, STRIKE, MONSTERS, BOSSES, TRAITS, MAP1, CORNER, ZONE_COLOR, ZONE_NAME, UPGRADE_COST, COMMANDERS, PAWNS, CARDS, CARD_ODDS, CARD_PITY, KEYS, MISSIONS, ECON };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA; else root.DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
