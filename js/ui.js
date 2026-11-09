// 화면 위 글자 · 버튼(DOM) + 입력(누르기 · 끌기 · 칸 고르기) + 창(로비 · 카드 · 결과 · 멈춤)
(function (root) {
  const DEX_FAMS = [['원소', '#ff8a3a', '불 · 얼음 · 독'], ['기계', '#b8c0c8', '총 · 레일 · 채굴'], ['비전', '#b58cff', '번개 · 소환 · 콤보'], ['성역', '#ffe48a', '빛 · 봉화 · 성장'], ['심연', '#ff5a5a', '폭군 · 부식 · 탐욕'], ['조커', '#e0d0ff', '무엇과도 합침']];
  const D = root.DATA, G = root.GEOM;
  const $ = id => document.getElementById(id);
  const fmt = n => Math.floor(n).toLocaleString('ko-KR');
  const DIE = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  function dieHTML(v) { return DIE[v].map(p => `<i style="grid-area:${Math.ceil(p / 3)}/${(p - 1) % 3 + 1}"></i>`).join(''); }
  const store = {
    get(k, d) { try { const v = localStorage.getItem('marble_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('marble_' + k, JSON.stringify(v)); } catch (e) { /* 저장 안 됨 */ } },
  };

  class UI {
    constructor(app) {
      this.app = app;
      this.settings = Object.assign({ sound: true, music: true, dmg: true, speed: 1, haptic: !(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches) }, store.get('settings', {}));
      // [v4.8] 단추를 누르는 순간 짧은 진동(모든 단추 공통)
      document.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.disabled && root.HAPTIC) root.HAPTIC.play('tap'); }, true);
      this.choice = Object.assign({ commander: 'gambler', pawn: 'car', mode: 'conquest', diff: 'normal', chapter: 1, deck: D.DECK.slice() }, store.get('choice', {}));
      if (!Array.isArray(this.choice.deck) || this.choice.deck.length !== 5 || this.choice.deck.some(k => !D.TOWERS[k])) this.choice.deck = D.DECK.slice();
      this.buildDeck();
      this.bind();
    }
    get g() { return this.app.game; }
    img(k) { return 'assets/img/' + k + '.png'; }
    sfx() { return root.SFX; }

    buildDeck(deck) {
      $('deckRow').innerHTML = (deck || D.DECK).map(k => `<button class="deck" data-k="${k}"><span class="lv">Lv 0</span><img src="${this.img('t_' + k + '_1')}" alt=""><div class="pr"><span class="coin"></span><b>100</b></div></button>`).join('');
      $('gdImg').src = this.img('i_gdice');
      $('gaugeIco').src = this.img('m_normal');
    }

    // ------------------------------------------------------------ 입력
    bind() {
      const s = this.sfx();
      // [v4.2] 굴리기: 누르면 바로 굴림. 꾹 눌러 조절하는 게이지는 없앰(이 게임에선 영향이 작다 — 사용자). 자동 굴리기는 버튼 왼쪽 위 '자동' 단추
      const roll = $('rollBtn');
      let down = false;
      roll.addEventListener('pointerdown', e => {
        if (e.target.id === 'autoBtn') return;
        e.preventDefault(); s.init(); roll.classList.add('press');
        if (!this.g || this.g.over) return;
        down = true; if (!(root.HAPTIC && root.HAPTIC.ios)) try { roll.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }   // 아이폰: 잡아 두면 눌린 click이 투명 라벨로 안 가 틱이 안 남
      });
      const up = cancel => { if (!down) return; down = false; roll.classList.remove('press'); if (!cancel) this.doRoll(false); };
      roll.addEventListener('pointerup', () => up(false));
      roll.addEventListener('pointercancel', () => up(true));
      if (root.HAPTIC && root.HAPTIC.ios) roll.addEventListener('pointerleave', () => up(true));
      $('autoBtn').addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); s.init(); this.auto = !this.auto; $('autoBtn').classList.toggle('on', this.auto); s.click && s.click(); });
      $('ocNo').addEventListener('pointerdown', e => { e.stopPropagation(); s.init(); if (this.g && this.app.cmd('skipOffer')) $('offerCard').hidden = true; });
      $('ocAuto').addEventListener('change', e => { this.app.cmd('setAutoTier', [e.target.checked]); store.set('autoTier', e.target.checked); });
      $('gdBtn').addEventListener('click', () => {
        s.init(); const g = this.g; if (!g) return;
        if (g.pick && g.pick.kind === 'gold') { this.app.cmd('cancelPick'); s.click(); return; }
        if (this.app.cmd('useGoldenDice')) s.card(); else s.error();
      });
      $('offerBtn').addEventListener('pointerdown', e => { e.stopPropagation(); s.init(); if (this.g && this.app.cmd('acceptOffer')) $('offerCard').hidden = true; });
      $('cmdBtn').addEventListener('click', () => {
        s.init(); const g = this.g; if (!g) return;
        const C = D.COMMANDERS[g.cmd.id];
        if (C.mode === 'tap') { if (!this.app.cmd('useCommander')) s.error(); }
        else this.toast('지휘관', C.name, '포탑을 끌어 이 버튼에 놓으세요', false, 1.6);
      });
      $('p2Btn').addEventListener('pointerdown', e => { e.preventDefault(); s.init(); if (this.g && this.g.partnerPress && this.app.cmd('partnerPress')) s.click(); else s.error(); });
      $('truckBtn').addEventListener('click', () => { s.init(); if (!(this.g && this.app.cmd('callTruck'))) s.error(); });
      $('pauseBtn').addEventListener('click', () => { s.init(); s.click(); this.pauseMenu(); });
      $('deckRow').addEventListener('click', e => {
        const b = e.target.closest('.deck'); if (!b || !this.g) return; s.init();
        if (this.app.cmd('upgrade', [b.dataset.k])) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
      });
      // 판(캔버스): 누르기 · 끌기
      const cv = $('world');
      cv.addEventListener('pointerdown', e => this.down(e));
      window.addEventListener('pointermove', e => this.move(e));
      window.addEventListener('pointerup', e => this.up(e));
      window.addEventListener('keydown', e => {
        if (!this.g || this.modalOpen()) return;
        if (e.code === 'Space') { e.preventDefault(); s.init(); this.doRoll(); }
        if (e.key === 'u' || e.key === 'U') this.app.cmd('acceptOffer');
        if (e.key === 'g' || e.key === 'G') $('gdBtn').click();
        if (e.key === 'Escape') this.pauseMenu();
        if (e.key === 'Enter' && this.g.partner && this.g.partner.human) { e.preventDefault(); this.app.cmd('partnerPress'); }
      });
    }
    doRoll(auto, aim) {
      const g = this.g; if (!g || g.over || g.cardPick) return;
      if (g.t < g.lockUntil && !auto && !(g.pawn.moving || g.pawn.next)) { this.sfx().error(); return; }
      if (!this.app.cmd('roll', aim ? [aim] : []) && !auto) this.sfx().error();
    }
    pt(e) {
      const r = $('stage').getBoundingClientRect(), k = r.width / 720;
      return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
    }
    towerAt(x, y) {
      const g = this.g; let best = null, by = -1;
      for (const t of g.tiles) {
        if (!t.tower) continue;
        const R = this.app.renderer.towerRect(g, t.i);
        if (x >= R.x + R.w * 0.12 && x <= R.x + R.w * 0.88 && y >= R.y + R.h * 0.08 && y <= R.y + R.h * 0.98 && R.cy > by) { best = t.i; by = R.cy; }
      }
      return best;
    }
    tileAt(x, y) {
      // [v4.1] 판 칸 또는 그 칸의 포탑 자리(판 바깥 둥근 자리)
      const inPoly = q => { let inside = false; for (let a = 0, b = q.length - 1; a < q.length; b = a++) { const [xi, yi] = q[a], [xj, yj] = q[b]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
      for (const t of G.tiles) if (inPoly(t.quad)) return t.i;
      for (const t of G.tiles) if (!t.corner && inPoly(t.pad)) return t.i;
      return null;
    }
    down(e) {
      const g = this.g; if (!g || g.over || g.paused) return;
      this.sfx().init();
      const [x, y] = this.pt(e);
      if (g.pick) {
        let i = this.tileAt(x, y);
        if (i == null) { const tw = this.towerAt(x, y); if (tw != null) i = tw; }
        if (i != null && g.pick.tiles.includes(i)) { this.app.cmd('choose', [i]); this.sfx().click(); }
        else if (g.pick.kind === 'swap') { g.pick = null; this.toast('순간이동술사', '취소', '', true, 1); }
        return;
      }
      const i = this.towerAt(x, y);
      if (i == null) { this.hideInfo(); return; }
      this.press = { i, x, y, t: performance.now(), id: e.pointerId };
    }
    move(e) {
      const p = this.press, g = this.g; if (!p || !g) return;
      const [x, y] = this.pt(e);
      const R = this.app.renderer;
      if (!R.drag && Math.hypot(x - p.x, y - p.y) > 10) {
        if (!g.tiles[p.i].tower) { this.press = null; return; }
        const f = G.tiles[p.i].tower;
        R.drag = { from: p.i, offX: f[0] - p.x, offY: f[1] - p.y, active: true, target: null };
        if (root.HAPTIC) root.HAPTIC.play('pick');   // [v4.8] 탑을 집어 드는 순간(소리 없음, 물리)
        this.hideInfo();
      }
      if (R.drag) {
        const d = R.drag; d.fx = x + d.offX; d.fy = y + d.offY;
        // 끄는 포탑 그림과 대상 포탑 그림이 50% 이상 겹치면 대상
        const me = R.towerRect(g, d.from), w = me.w, h = me.h * 0.8;
        const gx0 = d.fx - w / 2, gy0 = d.fy - h;
        let best = null, bo = 0;
        for (const t of g.tiles) {
          if (!t.tower || t.i === d.from) continue;
          const tr = R.towerRect(g, t.i), tw2 = tr.w, th = tr.h * 0.8, tx0 = tr.cx - tw2 / 2, ty0 = tr.cy - th;
          const ix = Math.max(0, Math.min(gx0 + w, tx0 + tw2) - Math.max(gx0, tx0)), iy = Math.max(0, Math.min(gy0 + h, ty0 + th) - Math.max(gy0, ty0));
          const ov = ix * iy / (w * h);
          if (ov > bo) { bo = ov; best = t.i; }
        }
        const tg0 = d.target; d.target = bo >= 0.5 && g.canMerge(d.from, best) ? best : null;
        if (d.target != null && d.target !== tg0 && root.HAPTIC) root.HAPTIC.play('select');   // [v4.8] 합칠 자리에 닿는 순간
        d.overlap = bo; d.near = best;
        const cb = $('cmdBtn').getBoundingClientRect(), k = $('stage').getBoundingClientRect().width / 720;
        const over = e.clientX >= cb.left && e.clientX <= cb.right && e.clientY >= cb.top && e.clientY <= cb.bottom;
        d.cmd = over && D.COMMANDERS[g.cmd.id].mode === 'drag';
        $('cmdBtn').classList.toggle('droptarget', !!d.cmd);
        void k;
      }
    }
    up(e) {
      const p = this.press, g = this.g, R = this.app.renderer;
      this.press = null;
      if (!g) return;
      if (R.drag) {
        const d = R.drag; R.drag = null; $('cmdBtn').classList.remove('droptarget');
        if (d.cmd) { if (!this.app.cmd('useCommander', [d.from])) { this.sfx().error(); this.toast('지휘관', '아직 못 써요', g.cmdReady() ? '이 포탑에는 쓸 수 없어요' : '쿨다운 중', true, 1.2); } return; }
        if (d.target != null) { this.app.cmd('merge', [d.from, d.target]); return; }
        if (d.overlap > 0.15) { this.sfx().error(); if (root.HAPTIC) root.HAPTIC.play('deny'); }
        return;
      }
      if (p && performance.now() - p.t < 400) this.showInfo(p.i);
      void e;
    }
    showInfo(i) {
      // [v4.5] 포탑 정보 = 화면 위쪽 세로 카드(참고 영상: 누르면 반경 + 위쪽 정보) — 고른 포탑 반대편 쪽에 붙여 그 포탑과 사거리를 덜 가림
      const g = this.g, t = g.tiles[i], tw = t.tower; if (!tw) return;
      const T = D.TOWERS[tw.type], tt = tw.tier, vol = g.dmgMul(i) * D.TIER.vol[tt], n = tw.type === 'gatling' ? 3 * tt : tw.type === 'railgun' ? [0, 1, 1, 2, 2, 3, 4][tt] : tt, per = tw.type === 'gatling' ? vol / tt : vol / n, aps = g.apsOf(i), rg = g.rangeOf(i);
      const tr = t.trait ? D.TRAITS[t.trait] : null, fam = (D.TOWERS[tw.type] || {}).fam, col = T.color;
      const stars = '★'.repeat(tw.tier) + '<i>' + '★'.repeat(6 - tw.tier) + '</i>';
      const rgTxt = rg >= 12 ? '판 전체' : '앞뒤 ' + String(+rg.toFixed(1)) + '칸';
      const box = $('infoBox');
      box.innerHTML = `<div class="ib-top"><div class="ib-pic" style="--c:${col}"><img src="${this.img('t_' + tw.type + '_' + tw.tier)}" alt=""></div>
          <div class="ib-name"><b>${T.name}</b><span class="ib-tier" style="color:${D.TIER.ring[tw.tier]}">${tw.tier}단계 ${D.TIER.name[tw.tier]}</span><span class="ib-stars">${stars}</span><span class="ib-fam">${fam}</span></div></div>
        <div class="ib-stats">
          <div><span>공격</span><b>${fmt(per)}${n > 1 ? '<small> × ' + n + '발</small>' : ''}</b></div>
          <div><span>공속</span><b>${aps.toFixed(2)}<small>회/초</small></b></div>
          <div><span>초당 피해</span><b style="color:#ffd23a">${fmt(per * n * aps)}</b></div>
          <div><span>사거리</span><b>${rgTxt}</b></div>
        </div>
        <div class="ib-land ${tr ? (tr.good ? 'good' : 'bad') : ''}">${tr ? tr.name + ' · ' + tr.desc : '평지'}</div>
        <p class="ib-desc">${T.desc}</p>
        <p class="ib-sub"><b>출동</b> ${D.STRIKE[tw.type]}</p>
        ${tw.tier >= 6 || g.awakened(tw.type) ? `<p class="ib-sub aw"><b>각성</b> ${D.AWAKEN[tw.type]}</p>` : ''}
        <div class="dbgTier">${[1, 2, 3, 4, 5, 6].map(k => `<button data-dbg="${k}" class="${k === tw.tier ? 'on' : ''}">${k}성</button>`).join('')}</div>`;   // [v4.2 디버그 — 나중에 없앰] 바로 그 단계로
      this.infoI = i;
      if (!box._dbg) { box._dbg = 1; box.addEventListener('pointerdown', ev => { const b = ev.target.closest('[data-dbg]'); if (!b) return; ev.stopPropagation(); ev.preventDefault(); if (this.app.cmd('debugTier', [this.infoI, +b.dataset.dbg])) { this.sfx().click && this.sfx().click(); this.showInfo(this.infoI); } }); }
      const [x] = G.tiles[i].tower;
      const right = x < 360;   // 포탑이 왼쪽이면 오른쪽 위에, 오른쪽이면 왼쪽 위에
      box.classList.toggle('r', right); box.classList.toggle('l', !right);
      box.style.left = right ? 'auto' : '12px'; box.style.right = right ? '12px' : 'auto'; box.style.top = '128px';
      const was = !box.hidden; box.hidden = false; if (!was) { box.classList.remove('in'); void box.offsetWidth; box.classList.add('in'); }
      const R = this.app.renderer; if (R.sel !== i) { R.sel = i; R.selT = R.time; if (root.HAPTIC) root.HAPTIC.play('select'); }
      clearTimeout(this.infoT); this.infoT = setTimeout(() => this.hideInfo(), 8000);
    }
    hideInfo() { $('infoBox').hidden = true; if (this.app.renderer) this.app.renderer.sel = null; }

    // ------------------------------------------------------------ 매 장면 갱신
    update() {
      const g = this.g; if (!g) return;
      const r = Math.max(1, g.round);
      $('roundTxt').textContent = g.mode === 'endless' ? `${r} 라운드` : `${r} / 20`;
      const lim = g.limit, w = g.weight;
      $('gaugeTxt').textContent = `${w} / ${lim}`;
      $('gaugeFill').style.width = Math.min(100, w / lim * 100) + '%';
      $('gauge').classList.toggle('warn', w / lim > 0.75);
      // 타이머: 라운드 남은 시간 / 마지막 보스 제한
      let tt = g.finalT != null ? Math.max(0, 90 - g.finalT) : Math.max(0, 21 - g.roundT);
      if (g.round === 0) tt = 0;
      $('timerTxt').textContent = `${Math.floor(tt / 60)}:${String(Math.floor(tt % 60)).padStart(2, '0')}`;
      // 카드 칩
      const chips = g.cards.map(c => `<span class="chip ${D.CARDS[c].g}">${D.CARDS[c].name}</span>`).join('');
      if (chips !== this._chips) { $('chips').innerHTML = chips; this._chips = chips; }
      // 보스
      const b = g.boss;
      $('bossBar').hidden = !b; $('stage').classList.toggle('boss', !!b);
      if (b) {
        $('bossName').textContent = D.BOSSES[b.boss].name;
        $('bossFill').style.width = Math.max(0, b.hp / b.maxHp * 100) + '%';
        const en = g.bossT > D.ECON.enrage && D.BOSSES[b.boss].kind === 'disrupt';
        $('bossInfo').textContent = b.boss === 'piggy' ? (b.paid ? '보너스 지급 완료' : `보너스까지 ${Math.ceil(60 - g.bossT)}초`) : b.boss === 'goblin' ? '한 바퀴 안에 잡아라!' : en ? '광폭화!' : `광폭화까지 ${Math.ceil(D.ECON.enrage - g.bossT)}초`;
      }
      // 미션
      const ms = g.mission;
      $('missionBox').hidden = !ms;
      if (ms) {
        $('missionName').textContent = D.MISSIONS[ms.id].name;
        $('missionTime').textContent = Math.ceil(ms.until - g.t) + '초';
        const pr = g.missionProgress() || [0, 1];
        $('missionFill').style.width = Math.min(100, pr[0] / pr[1] * 100) + '%';
        $('missionProg').textContent = `${fmt(pr[0])} / ${fmt(pr[1])}`;
      }
      // 연속 출동
      const hasCombo = g.deck.includes('combo');
      $('comboBox').hidden = g.combo < 1 && !(hasCombo && g.comboStack > 0);
      $('stackTxt').hidden = !hasCombo; if (hasCombo) $('stackTxt').textContent = '콤보 ' + g.comboStack + ' · 콤보탑 +' + g.comboStack * 5 + '%';
      if (g.combo !== this._combo) { $('comboN').textContent = '×' + g.combo; $('comboPct').textContent = '출동 피해 +' + g.combo * 10 + '%'; const cb = $('comboBox'); cb.classList.remove('pop'); void cb.offsetWidth; cb.classList.add('pop'); this._combo = g.combo; }
      // 금화
      // [v4.7] 날아오는 동전이 금화 칸에 들어갈 때 숫자가 오른다(renderer.goldPending = 아직 날아오는 금화)
      const want = Math.max(0, g.gold - (this.app.renderer.goldPending || 0));
      const shown = this._gold == null ? want : this._gold + (want - this._gold) * 0.25;
      this._gold = Math.abs(shown - want) < 1 ? want : shown;
      $('goldTxt').textContent = this.app.net && this.app.net.role === 'guest' && g.partner ? fmt(g.partner.gold) : fmt(this._gold);
      if (this.app.renderer.goldBump && this.app.renderer.goldBump !== this._bump) { this._bump = this.app.renderer.goldBump; const gr = $('goldRow'); gr.classList.remove('bump'); void gr.offsetWidth; gr.classList.add('bump'); }
      // 굴리기
      $('rollCost').textContent = fmt(this.app.net && this.app.net.role === 'guest' && g.partner ? g.partner.rollCost : g.rollCost);
      $('rollBtn').classList.toggle('poor', !g.rollAffordable());
      $('rollBtn').classList.toggle('locked', g.t < g.lockUntil);
      const d = this.app.renderer.diceShow;
      const dv = d ? [d.d1, d.d2] : (this._lastDice || [3, 4]);
      if (d) this._lastDice = dv;
      const key = dv.join(',');
      if (key !== this._dk) { $('dieA').innerHTML = dieHTML(dv[0]); $('dieB').innerHTML = dieHTML(dv[1]); this._dk = key; }
      // 황금 주사위
      $('gdN').textContent = '×' + g.goldenDice;
      $('gdBtn').classList.toggle('off', g.goldenDice === 0 && !(g.pick && g.pick.kind === 'gold'));
      $('gdBtn').classList.toggle('on', g.goldenDice > 0);
      $('gdBtn').classList.toggle('active', !!(g.pick && g.pick.kind === 'gold'));
      // 지휘관 · 수송차
      const C = D.COMMANDERS[g.cmd.id];
      const cdP = g.cmdReady() ? 0 : Math.min(100, (g.cmd.readyAt - g.t) / (g.cmd.readyAt <= 10 ? 10 : C.cd) * 100);
      $('cmdCd').style.setProperty('--p', cdP + '%');
      $('cmdBtn').classList.toggle('ready', g.cmdReady());
      const trP = g.truckReady() ? 0 : g.round === 0 ? 100 : Math.min(100, Math.max(0, (g.truck.readyAt - g.t) / 30 * 100));
      $('truckCd').style.setProperty('--p', (g.monsters.some(m => m.kind === 'truck') ? 100 : trP) + '%');
      $('truckBtn').classList.toggle('ready', g.truckReady());
      // 단계업 카드(내 포탑에 멈춤): 지금 그림 → 다음 단계 그림, 값, 단계업 / 넘기기, 남은 시간 띠
      const o = g.offer, oc = $('offerCard'), guest = this.app.net && this.app.net.role === 'guest';
      if (o && g.t <= o.until && g.tiles[o.i].tower && !guest) {
        const tw = g.tiles[o.i].tower, key = o.i + ':' + o.t0;
        if (this._offerI !== key) {
          this._offerI = key; $('ocFrom').src = this.img('t_' + tw.type + '_' + o.tier); $('ocTo').src = this.img('t_' + tw.type + '_' + (o.tier + 1));
          $('ocName').textContent = D.TOWERS[tw.type].name.replace('탑', '') + ' → ' + (o.tier + 1) + '단계'; $('offerCost').textContent = fmt(o.cost);
          oc.hidden = false; oc.style.animation = 'none'; void oc.offsetWidth; oc.style.animation = '';
          $('ocAuto').checked = !!g.autoTier;
        }
        $('offerBar').style.transform = `scaleX(${Math.max(0, (o.until - g.t) / D.ECON.offerT)})`;
        oc.classList.toggle('poor', g.gold < o.cost);
        $('ocNo').textContent = g.gold < o.cost ? '닫기' : '넘기기';
      } else { oc.hidden = true; this._offerI = null; }
      // 자동 굴리기
      if (this.auto && !g.over && !g.cardPick && !g.pick && !g.pawn.moving && !g.pawn.next && !g.rollQ.length && !(g.offer && g.offer.block) && g.t >= g.lockUntil && g.rollAffordable() && !this.modalOpen()) this.app.cmd('roll');
      // 덱 강화 버튼
      for (const b2 of document.querySelectorAll('.deck')) {
        const k = b2.dataset.k, lv = g.upg[k], c = g.upgradeCost(k);
        b2.querySelector('.lv').textContent = 'Lv ' + lv;
        b2.querySelector('.pr b').textContent = lv >= 10 ? 'MAX' : fmt(c);
        b2.classList.toggle('poor', g.gold < c); b2.classList.toggle('max', lv >= 10);
      }
      // 2P(사람) 버튼
      const hp = g.partner && g.partner.human && !this.app.net; $('p2Btn').hidden = !hp;
      if (hp) { $('p2Cost').textContent = fmt(g.partner.rollCost); $('p2Gold').textContent = '금화 ' + fmt(g.partner.gold); $('p2Btn').classList.toggle('poor', g.partner.gold < g.partner.rollCost); if (this._p2d) { $('p2A').innerHTML = dieHTML(this._p2d[0]); $('p2B').innerHTML = dieHTML(this._p2d[1]); } }
      // 처음 하는 사람 안내(한 번만)
      if (!this.tut) this.tut = store.get('tut', {});
      if (!this.tut.roll && g.round >= 1 && g.stats.rolls === 0) { $('rollBtn').classList.add('tut'); }
      else if ($('rollBtn').classList.contains('tut')) { $('rollBtn').classList.remove('tut'); this.tut.roll = 1; store.set('tut', this.tut); }
      if (!this.tut.merge && g.stats.merges === 0 && !this.modalOpen()) {
        const T = g.towersList();
        const pair = T.find(a2 => T.some(b2 => g.canMerge(a2.i, b2.i)));
        if (pair && !this._mergeHint) { this._mergeHint = 1; this.toast('합치기', '같은 포탑끼리 끌어 겹쳐 보세요', '같은 종류 + 같은 단계 → 한 단계 위', false, 3.2); }
      }
      if (!this.tut.merge && g.stats.merges > 0) { this.tut.merge = 1; store.set('tut', this.tut); }
      // 사건 → 알림 창
      if (g.cardPick && !this.modalOpen() && g.cardPick !== this._cardDone) { if (this.app.net && this.app.net.role === 'guest') { if (this._cardToast !== g.cardPick) { this._cardToast = g.cardPick; this.toast('작전 카드', '1P가 고르는 중', '잠시만요', false, 2); } } else this.cardModal(); }
      if (g.over && !this._overShown) { this._overShown = true; setTimeout(() => this.resultModal(), 1200); }
    }
    onEvent(e) {
      // [v4.7] 황금열쇠는 판 위 카드 · 리본으로(render8) — 알림 상자 없음
      if (e.ev === 'mission') this.toast('라운드 미션 · 60초', e.name, '성공하면 황금 주사위 +1', false, 2.2);
      if (e.ev === 'pick' && e.kind === 'space') this.toast('우주여행', '갈 칸을 누르세요', '판의 아무 칸이나', false, 1.6);
      if (e.ev === 'pick' && e.kind === 'swap') this.toast('순간이동술사', '바꿀 칸을 누르세요', '빈 칸이면 그 칸으로 옮김', false, 1.6);
      if (e.ev === 'pick' && e.kind === 'space' && e.second) this.toast('순간이동술사', '우주여행 한 번 더!', '갈 칸을 누르세요', false, 1.6);
      if (e.ev === 'pick' && e.kind === 'gold') this.toast('황금 주사위', '갈 칸을 누르세요', '2~12칸 앞 · 다시 누르면 취소', false, 1.4);
      if (e.ev === 'boss') this.toast('보스 등장', e.name, D.BOSSES[e.boss].desc, true, 2.2);
      if (e.ev === 'commander') this.toast('지휘관', D.COMMANDERS[e.id].name, D.COMMANDERS[e.id].act, false, 1.4);
      if (e.ev === 'upgrade' && e.free) this.toast('훈장', D.TOWERS[e.type].name + ' 강화 +1', 'Lv ' + e.lv, false, 1.6);
      if (e.ev === 'rescueRoll') this.toast('구조 굴림', '금화가 모자라 무료로 굴려요', '포탑이 하나도 없을 때만', false, 1.6);
      if (e.ev === 'nogold') { const r = $('rollBtn'); r.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 200 }); }
      if (e.ev === 'land') this.app.renderer.lastLand = this.app.renderer.time;
      if (e.ev === 'dice2') this._p2d = [e.d1, e.d2];
      if (e.ev === 'round' && e.round === 1 && this.g.chapter > 1) this.toast(this.g.chapter + '장 ' + this.g.CH.name, '규칙', this.g.CH.rule, false, 2.4);
    }
    toast(k, n, d, bad, dur) {
      const t = $('toast');
      t.className = bad ? 'bad' : ''; t.innerHTML = `<div class="k">${k}</div><div class="n">${n}</div><div class="d">${d || ''}</div>`;
      t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
      clearTimeout(this.toastT); this.toastT = setTimeout(() => (t.hidden = true), (dur || 1.8) * 1000);
    }

    // ------------------------------------------------------------ 창
    modalOpen() { return !$('modal').hidden; }
    open(html, cls) {
      // [v4.5] 열려 있는 창을 같은 종류로 다시 그리면(성장 트리 구매 등) 튀어나오는 애니메이션 없이 · 스크롤 위치 그대로 — '누를 때마다 창이 꺼졌다 켜진다'(사용자)
      const m = $('modal'), k = this._kind || ''; this._kind = '';
      const same = !m.hidden && m.className === (cls || '') && m.dataset.kind === k;
      const old = m.querySelector('.mbox'), top = old ? old.scrollTop : 0;
      m.className = cls || ''; m.dataset.kind = k; m.innerHTML = html; m.hidden = false;
      const nb = m.querySelector('.mbox'); if (same && nb) { nb.classList.add('still'); nb.scrollTop = top; }
      return m;
    }
    close() { $('modal').hidden = true; $('modal').innerHTML = ''; $('modal').dataset.kind = ''; }
    kind(k) { this._kind = k; return this; }
    lobby() {
      const s = this.sfx();
      const best = store.get('best', {});
      const ch = this.choice;
      const cmdIds = Object.keys(D.COMMANDERS), pawnIds = Object.keys(D.PAWNS);
      const meta = META.load(); this.meta = meta;
      ch.deck = ch.deck.filter(k => META.owned(meta, k)); for (const k of D.DECK) if (ch.deck.length < 5 && !ch.deck.includes(k)) ch.deck.push(k);
      const html = `<div class="lobbybg"></div><div class="mbox" style="width:660px">
        <div class="title">마블 디펜스</div>
        <p class="sub">주사위를 굴려 판 위에 포탑을 세우고, 합쳐서 전설까지!</p>
        <div class="wallet"><span class="coin"></span><b data-sync="gold"></b> 골드 <span class="core"></span><b data-sync="core"></b> 코어 <button class="btn sec small" data-act="tree">성장 트리</button></div>
        ${this.dbgRow()}
        <div class="sec-t">정복 — 장 고르기 (20라운드 · 마지막 보스를 잡으면 승리)</div>
        <div class="chapters">${META.CHAPTERS.map(c => `<button class="chap" data-chap="${c.n}"><img src="assets/img/${c.board}.jpg" alt=""><b>${c.n}장 ${c.name}</b><span class="st"></span></button>`).join('')}
          <button class="chap" data-coop="1"><div class="endl" style="color:#7ec0ff">2P</div><b>협동</b><span class="st"></span></button>
          <button class="chap" data-mode="endless"><div class="endl">∞</div><b>무한 토벌</b><span>${best.endless ? fmt(best.endless.kills) + '마리' : '기록 없음'}</span></button></div>
        <p class="deckdesc" data-sync="chap"></p>
        <div class="sec-t">난이도</div>
        <div class="sel" style="grid-template-columns:1fr 1fr 1fr">${Object.keys(D.DIFF).map(k => `<button class="opt" data-diff="${k}" style="min-height:84px"><b>${D.DIFF[k].name}</b><span class="ds">${D.DIFF[k].desc}</span></button>`).join('')}</div>
        <div class="sec-t">덱 — 포탑 5종 (<span data-sync="cnt"></span>/5)</div>
        <div class="presets">${D.PRESETS.map((p2, k) => `<button class="chip pbtn" data-preset="${k}">${p2.name}</button>`).join('')}</div>
        <div class="decksel">${D.ALL.map(k => { const own = META.owned(meta, k); return `<button class="dk ${own ? '' : 'lock'}" data-tw="${k}" title="${D.TOWERS[k].desc}"><img src="${this.img('t_' + k + '_1')}" alt=""><span>${D.TOWERS[k].name.replace('탑', '')}</span><i>${own ? D.TOWERS[k].fam : this.lockTxt(meta, k)}</i></button>`; }).join('')}</div>
        <p class="deckdesc" data-sync="deck"></p>
        <div class="sec-t">지휘관 — 왼쪽 아래 버튼</div>
        <div class="sel">${cmdIds.map(k => `<button class="opt" data-cmd="${k}"><img src="${this.img('c_' + k)}" alt=""><b>${D.COMMANDERS[k].name}</b><span class="ds">${D.COMMANDERS[k].mode === 'drag' ? '끌기: ' : '탭: '}${D.COMMANDERS[k].act}<br>· ${D.COMMANDERS[k].pas}</span></button>`).join('')}</div>
        <div class="sec-t">말 — 판을 도는 내 말</div>
        <div class="sel">${pawnIds.map(k => `<button class="opt" data-pawn="${k}"><img src="${this.img('p_' + k)}" alt=""><b>${D.PAWNS[k].name}</b><span class="ds">${D.PAWNS[k].desc}</span></button>`).join('')}</div>
        <div class="btns sticky"><button class="btn sec" data-act="online">${this.app.net ? '온라인 연결됨' : '온라인 협동'}</button><button class="btn sec" data-act="dex">포탑 도감</button><button class="btn sec" data-act="help">하는 법</button><button class="btn sec" data-act="sound"></button><button class="btn green" data-act="start" style="min-width:220px">시작!</button></div>
      </div>`;
      const m = this.kind('lobby').open(html, 'lobby');
      // [v4.5] 고른 것만 표시를 바꾼다(창 전체를 다시 그리면 꺼졌다 켜지고 스크롤이 맨 위로 — 사용자 지적)
      const sync = () => {
        const q = (sel, f) => m.querySelectorAll(sel).forEach(f);
        q('[data-chap]', b => { const n = +b.dataset.chap, cl = meta.cleared[n + '_' + (ch.diff || 'normal')] || 0; b.classList.toggle('on', ch.mode === 'conquest' && (ch.chapter || 1) === n); b.querySelector('.st').textContent = '★'.repeat(cl) + '☆'.repeat(3 - cl); });
        q('[data-coop]', b => { b.classList.toggle('on', !!ch.coop); b.querySelector('.st').textContent = ch.coop === 'human' ? '친구와(한 화면)' : ch.coop ? 'AI 동료와' : '끔'; });
        q('[data-mode=endless]', b => b.classList.toggle('on', ch.mode === 'endless'));
        const C = META.CHAPTERS[(ch.chapter || 1) - 1];
        m.querySelector('[data-sync=chap]').innerHTML = ch.mode === 'endless' ? '끝없이 — 5라운드마다 보스, 처치 수가 기록' : '<b>' + C.name + '</b> · 규칙: ' + C.rule + ' · ' + C.desc;
        q('[data-diff]', b => b.classList.toggle('on', (ch.diff || 'normal') === b.dataset.diff));
        m.querySelector('[data-sync=cnt]').textContent = ch.deck.length;
        q('[data-preset]', b => b.classList.toggle('on', D.PRESETS[+b.dataset.preset].deck.join() === ch.deck.join()));
        q('[data-tw]', b => { const own = META.owned(meta, b.dataset.tw); b.classList.toggle('on', ch.deck.includes(b.dataset.tw)); b.classList.toggle('lock', !own); b.querySelector('i').textContent = own ? D.TOWERS[b.dataset.tw].fam : this.lockTxt(meta, b.dataset.tw); });
        m.querySelector('[data-sync=deck]').innerHTML = ch.deck.map(k => '<b>' + D.TOWERS[k].name + '</b> ' + D.TOWERS[k].desc).join('<br>');
        q('[data-cmd]', b => b.classList.toggle('on', ch.commander === b.dataset.cmd));
        q('[data-pawn]', b => b.classList.toggle('on', ch.pawn === b.dataset.pawn));
        m.querySelector('[data-act=sound]').textContent = this.settings.sound ? '소리 켜짐' : '소리 꺼짐';
        m.querySelector('[data-sync=gold]').textContent = fmt(meta.gold); m.querySelector('[data-sync=core]').textContent = fmt(meta.core);
      };
      sync();
      m.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        s.init(); s.click(); s.music('lobby');
        // [v4.5 디버그 — 출시 전 삭제] 코어 올리기 · 내리기(잠긴 포탑 · 코어 노드 확인용)
        if (this.dbgMeta(b, meta)) { ch.deck = ch.deck.filter(k => META.owned(meta, k)); for (const k of D.DECK) if (ch.deck.length < 5 && !ch.deck.includes(k)) ch.deck.push(k); sync(); return; }
        if (b.dataset.mode) ch.mode = b.dataset.mode;
        if (b.dataset.cmd) ch.commander = b.dataset.cmd;
        if (b.dataset.diff) ch.diff = b.dataset.diff;
        if (b.dataset.pawn) ch.pawn = b.dataset.pawn;
        if (b.dataset.chap) { ch.mode = 'conquest'; ch.chapter = +b.dataset.chap; }
        if (b.dataset.coop) ch.coop = !ch.coop ? 'ai' : ch.coop === 'ai' ? 'human' : false;   // 끔 → AI 동료 → 친구(한 화면) → 끔
        if (b.dataset.mode) ch.coop = ch.coop && b.dataset.mode !== 'endless';
        if (b.dataset.act === 'tree') { this.tree('elem', () => this.lobby()); return; }
        if (b.dataset.preset != null) { const pd = D.PRESETS[+b.dataset.preset].deck; const miss = pd.filter(k => !META.owned(meta, k)); if (miss.length) { this.toast('잠긴 포탑', miss.map(k => D.TOWERS[k].name).join(' · '), '성장 트리에서 코어로 열 수 있어요', true, 2); return; } ch.deck = pd.slice(); }
        if (b.dataset.tw && !META.owned(meta, b.dataset.tw)) { this.tree(META.FAM_OF[b.dataset.tw] || 'common', () => this.lobby()); return; }
        if (b.dataset.tw) { const k = b.dataset.tw; if (ch.deck.includes(k)) { if (ch.deck.length > 1) ch.deck = ch.deck.filter(x => x !== k); } else { if (ch.deck.length >= 5) ch.deck.shift(); ch.deck.push(k); } }
        if (b.dataset.act === 'start' && ch.deck.length !== 5) { this.toast('덱', '포탑 5종을 고르세요', ch.deck.length + '/5', true, 1.4); return; }
        store.set('choice', ch);
        if (b.dataset.act === 'start') { this.close(); this.app.start(ch); return; }
        if (b.dataset.act === 'help') { this.help(() => this.lobby()); return; }
        if (b.dataset.act === 'online') { this.onlineModal(); return; }
        if (b.dataset.act === 'dex') { this.dex(ch.deck[0], () => this.lobby()); return; }
        if (b.dataset.act === 'sound') { this.settings.sound = !this.settings.sound; store.set('settings', this.settings); s.setOn(this.settings.sound); }
        sync();
      };
    }
    // [v4.6] 잠금 표시: 나무 Lv 조건까지(전에는 '코어 25'만 보여 코어를 올려도 왜 안 열리는지 알 수 없었다)
    lockTxt(m, t) { const n = META.unlockNeed(m, t); return n ? '🔒 ' + (n.lv ? `Lv${n.lv} · ` : '') + '코어 ' + n.core : '🔒'; }
    // [v4.5 · v4.6 디버그 — 출시 전 삭제] 코어 · 골드 · 나무 Lv · 포탑 해금을 바로 바꾼다(로비 · 성장 트리 공용). fam = 성장 트리에서 보고 있는 계열
    dbgRow(fam) {
      return `<div class="dbgcore" title="디버그 — 출시 전 삭제"><span>디버그 · 코어</span><button data-dbgcore="-100">−100</button><button data-dbgcore="-10">−10</button><button data-dbgcore="10">+10</button><button data-dbgcore="100">+100</button></div>
        <div class="dbgcore" title="디버그 — 출시 전 삭제"><span>골드 · 나무 · 해금</span><button data-dbg="gold">골드 +1만</button><button data-dbg="lv">나무 Lv+10</button><button data-dbg="open">포탑 모두 열기</button><button data-dbg="lock">잠금 되돌리기</button></div>`;
    }
    dbgMeta(b, m, fam) {
      const d = b.dataset;
      if (d.dbgcore) m.core = Math.max(0, m.core + +d.dbgcore);
      else if (d.dbg === 'gold') m.gold += 10000;
      else if (d.dbg === 'lv') for (const f of (fam && fam !== 'common' ? [fam] : META.FAMS.map(x => x.id))) m.nodes[f + '.dbg'] = (m.nodes[f + '.dbg'] || 0) + 10;   // 나무 Lv에만 더해지는 가짜 노드(효과 없음)
      else if (d.dbg === 'open') { for (const t in META.UNLOCK) if (!m.unlocked.includes(t)) m.unlocked.push(t); }
      else if (d.dbg === 'lock') { m.unlocked = []; for (const k in m.nodes) if (k.endsWith('.dbg')) delete m.nodes[k]; }
      else return false;
      META.save(m); this.toast('디버그', d.dbgcore ? '코어 ' + m.core : d.dbg === 'gold' ? '골드 ' + fmt(m.gold) : d.dbg === 'lv' ? '나무 Lv +10' + (fam && fam !== 'common' ? '' : '(모든 계열)') : d.dbg === 'open' ? '잠긴 포탑 6종 모두 열림' : '해금 · 디버그 나무 Lv 되돌림', '', false, 1.1);
      return true;
    }
    tree(fam, back) {
      const m = META.load();
      const tabs = META.FAMS.map(f => ({ id: f.id, name: f.name, color: f.color })).concat([{ id: 'common', name: '공용', color: '#6ab0ff' }]);
      const F = META.FAMS.find(f => f.id === fam);
      const tl = fam === 'common' ? 0 : META.treeLv(m, fam);
      const nodes = fam === 'common' ? META.COMMON_NODES : META.FAM_NODES;
      const card = (n) => {
        const inf = META.nodeInfo(m, fam, n);
        const title = n.rule ? '규칙 · ' + META.RULES[fam].name : n.name;
        const desc = n.rule ? META.RULES[fam].desc : n.desc || (n.per ? `${F ? F.name + ' 포탑 ' : ''}${n.name} +${n.per}${n.unit}/Lv (지금 +${(inf.cur * n.per).toFixed(1).replace('.0', '')}${n.unit})` : '');
        const lvTxt = n.once ? (inf.cur ? '완료' : '1회') : `Lv ${inf.cur}/${n.max}`;
        const cost = inf.maxed ? '최대' : inf.locked ? `나무 Lv${n.need} 필요` : inf.cost.core ? `코어 ${inf.cost.core}` : `골드 ${fmt(inf.cost.gold)}`;
        return `<button class="tnode ${n.rule ? 'rule' : ''} ${inf.maxed ? 'max' : ''} ${inf.locked ? 'lock' : ''} ${inf.can ? 'can' : ''}" data-node="${n.id}"><b>${title}</b><span class="ds">${desc}</span><i>${lvTxt} · ${cost}</i></button>`;
      };
      const towers = fam === 'common' ? ['prism'] : F.towers;
      const tw = towers.map(t => { const own = META.owned(m, t), u = META.UNLOCK[t]; const can = !own && u && (u.common || tl >= u.lv) && m.core >= u.core;
        return `<button class="tnode tw ${own ? 'max' : ''} ${can ? 'can' : ''}" data-unlock="${t}"><img src="${this.img('t_' + t + '_3')}" alt=""><b>${D.TOWERS[t].name}</b><i>${own ? '보유' : (u.common ? '' : '나무 Lv' + u.lv + ' · ') + '코어 ' + u.core}</i></button>`; }).join('');
      const next = nodes.map(n => [n, META.nodeInfo(m, fam, n)]).find(([n, i]) => !i.maxed && !i.locked);
      const mm = this.kind('tree').open(`<div class="mbox" style="width:690px"><h2>성장 트리</h2>
        <div class="wallet"><span class="coin"></span><b>${fmt(m.gold)}</b> 골드 <span class="core"></span><b>${fmt(m.core)}</b> 코어</div>
        ${this.dbgRow(fam)}
        <div class="presets" style="justify-content:center">${tabs.map(t => `<button class="chip pbtn ${t.id === fam ? 'on' : ''}" data-fam="${t.id}" style="${t.id === fam ? 'border-color:' + t.color + ';color:' + t.color : ''}">${t.name}${t.id !== 'common' ? ' Lv' + META.treeLv(m, t.id) : ''}</button>`).join('')}</div>
        <p class="sub">${fam === 'common' ? '모든 판에 붙는 공용 노드' : F.name + ' 나무 Lv ' + tl + ' — 찍은 레벨의 합이 오를수록 아래 칸이 열린다'}${next ? ' · 다음 목표: <b style="color:var(--gold)">' + (next[0].rule ? META.RULES[fam].name : next[0].name) + '</b>' : ''}</p>
        <div class="tgrid">${tw}</div>
        <div class="tgrid">${nodes.map(card).join('')}</div>
        ${fam === 'common' ? '' : `<div class="sec-t">갈림길 — 둘 중 하나(언제든 무료로 바꿈${m.nodes['fork.' + fam] ? '' : ' · 처음 열 때 나무 Lv20 · 코어 10'})</div>
        <div class="tgrid" style="grid-template-columns:1fr 1fr">${META.FORKS[fam].map((f, k) => `<button class="tnode ${m.nodes['fork.' + fam] === k + 1 ? 'max' : ''} ${tl < 20 && !m.nodes['fork.' + fam] ? 'lock' : ''}" data-fork="${k + 1}" style="min-height:70px"><b>${'AB'[k]} · ${f[1]}</b><i>${m.nodes['fork.' + fam] === k + 1 ? '켜짐' : '누르면 이쪽으로'}</i></button>`).join('')}</div>`}
        <div class="sec-t">특성 3칸 — 포탑마다(일반 Lv1~30 = 그 포탑 피해 +1.5%/Lv · 특수①은 일반 Lv10 · 특수②는 Lv20에 열림)</div>
        <div class="traits">${towers.map(t => { const ti = META.traitInfo(m, t), own = META.owned(m, t), sp = META.TRAIT_SP[t];
          return `<div class="trow ${own ? '' : 'lock'}"><img src="${this.img('t_' + t + '_2')}" alt=""><b>${D.TOWERS[t].name}</b>
            <button class="tslot ${ti.g >= 30 ? 'max' : ''}" data-trait="${t}" data-slot="g">일반 Lv${ti.g}<i>${ti.g >= 30 ? '최대' : '골드 ' + fmt(ti.gCost)}</i></button>
            <button class="tslot ${ti.s1 ? 'max' : ti.g < 10 ? 'lock' : ''}" data-trait="${t}" data-slot="s1">${sp[0][1]}<i>${ti.s1 ? '보유' : '골드 2만 · 코어 10'}</i></button>
            <button class="tslot ${ti.s2 ? 'max' : ti.g < 20 ? 'lock' : ''}" data-trait="${t}" data-slot="s2">${sp[1][1]}<i>${ti.s2 ? '보유' : '골드 5만 · 코어 20'}</i></button></div>`; }).join('')}</div>
        <p class="deckdesc">판을 끝내면 골드 · 코어를 받는다(이기면 더, 장마다 첫 클리어는 코어 ×3). 판 밖 성장은 최대 약 3배 — 판 안 합치기 · 강화(최대 20배)가 훨씬 크다.</p>
        <div class="btns"><button class="btn" data-act="back">닫기</button></div></div>`);
      mm.onclick = e => {
        const b = e.target.closest('button'); if (!b) return; this.sfx().init();
        if (this.dbgMeta(b, m, fam)) { this.sfx().click(); this.tree(fam, back); return; }   // [v4.5 · v4.6 디버그 — 출시 전 삭제]
        if (b.dataset.fam) { this.sfx().click(); this.tree(b.dataset.fam, back); return; }
        if (b.dataset.fork) { if (META.setFork(m, fam, +b.dataset.fork)) { this.sfx().upgrade(); this.tree(fam, back); } else this.sfx().error(); return; }
        if (b.dataset.trait) { if (META.buyTrait(m, b.dataset.trait, b.dataset.slot)) { this.sfx().upgrade(); this.tree(fam, back); } else this.sfx().error(); return; }
        if (b.dataset.node) { if (META.buy(m, fam, b.dataset.node)) { this.sfx().upgrade(); this.tree(fam, back); } else this.sfx().error(); return; }
        if (b.dataset.unlock) { if (META.unlock(m, b.dataset.unlock)) { this.sfx().jackpot(); this.toast('새 포탑', D.TOWERS[b.dataset.unlock].name + ' 해금!', '덱에 넣을 수 있어요', false, 1.6); this.tree(fam, back); } else { this.sfx().error(); const n = META.unlockNeed(m, b.dataset.unlock); if (n && !META.owned(m, b.dataset.unlock)) this.toast('아직 못 열어요', (n.lvOk ? '' : `${META.FAMS.find(f => f.id === n.fam).name} 나무 Lv${n.lv} 필요(지금 Lv${n.lvNow}) `) + (n.coreOk ? '' : `코어 ${n.core} 필요(지금 ${m.core})`), '나무 Lv = 이 계열 노드를 찍은 레벨 합(골드로 올림)', true, 2.4); } return; }
        if (b.dataset.act === 'back') { this.sfx().click(); back(); }
      };
    }
    onlineModal(step) {
      const net = this.app.net, s = this.sfx();
      const status = net ? (net.open ? (net.role === 'host' ? '연결됨 — 로비에서 [시작!]을 누르면 친구와 같은 판이 시작돼요' : '연결됨 — 1P가 시작하기를 기다리는 중') : '연결 중…') : '';
      const m = this.open(`<div class="mbox" style="width:600px"><h2>온라인 협동</h2>
        <p class="sub">서버 없이 두 기기를 잇습니다. '방 코드'를 메신저로 보내고, 친구가 준 '답 코드'를 붙여 넣으면 끝.<br>1P(방장) = 내 말 · 카드 · 강화 · 지휘관, 2P(친구) = 파란 말 굴리기 · 합치기.</p>
        ${status ? `<p class="sub" style="color:#8fffa0">${status}</p>` : ''}
        ${!net ? `<div class="btns"><button class="btn green" data-act="host">방 만들기(1P)</button><button class="btn" data-act="join">참가하기(2P)</button></div>` : ''}
        ${step === 'host' ? `<div class="sec-t">① 이 방 코드를 친구에게 보내세요</div><textarea id="codeOut" readonly class="code">${net.code || '만드는 중…'}</textarea><button class="btn sec small" data-act="copy">복사</button>
           <div class="sec-t">② 친구가 보낸 답 코드를 붙여 넣으세요</div><textarea id="codeIn" class="code" placeholder="답 코드"></textarea><div class="btns"><button class="btn green" data-act="accept">연결</button></div>` : ''}
        ${step === 'join' ? `<div class="sec-t">① 친구(방장)가 보낸 방 코드를 붙여 넣으세요</div><textarea id="codeIn" class="code" placeholder="방 코드"></textarea><div class="btns"><button class="btn green" data-act="answer">답 코드 만들기</button></div>
           ${net && net.code ? `<div class="sec-t">② 이 답 코드를 방장에게 보내세요</div><textarea id="codeOut" readonly class="code">${net.code}</textarea><button class="btn sec small" data-act="copy">복사</button>` : ''}` : ''}
        <div class="btns"><button class="btn sec" data-act="back">${net && net.open ? '로비로' : '닫기'}</button>${net ? '<button class="btn sec" data-act="hang">연결 끊기</button>' : ''}</div></div>`);
      m.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return; s.init(); s.click();
        const a = b.dataset.act;
        try {
          if (a === 'host') { this.app.netCreate('host'); this.onlineModal('host'); this.app.net.code = await this.app.net.link.host(); this.onlineModal('host'); }
          if (a === 'join') { this.app.netCreate('guest'); this.onlineModal('join'); }
          if (a === 'answer') { const code = document.getElementById('codeIn').value; this.app.net.code = await this.app.net.link.join(code); this.onlineModal('join'); }
          if (a === 'accept') { await this.app.net.link.accept(document.getElementById('codeIn').value); this.toast('온라인', '연결 중…', '', false, 1.5); }
          if (a === 'copy') { const t = document.getElementById('codeOut'); t.select(); try { await navigator.clipboard.writeText(t.value); } catch (err) { document.execCommand('copy'); } this.toast('복사됨', '메신저에 붙여 보내세요', '', false, 1.2); }
          if (a === 'hang') { this.app.netClose(); this.lobby(); }
          if (a === 'back') this.lobby();
        } catch (err) { this.toast('연결 실패', '코드를 다시 확인해 주세요', String(err.message || err).slice(0, 60), true, 2.5); }
      };
    }
    // [v4.4] 도감 = 계열별 줄(사용자 '그냥 나열하니 계열 구분이 안 됨')
    dexBody(k) {
      const T = D.TOWERS[k];
      return `<div class="dexrow">${[1, 2, 3, 4, 5, 6].map(t => `<div class="dexc"><img src="${this.img('t_' + k + '_' + t)}" alt="" style="width:${Math.round(Math.min(104, ((root.MANIFEST['t_' + k + '_' + t] || {}).w || 150) * 0.52 * root.Renderer.TSZ[t]))}px"><b style="color:${D.TIER.ring[t]}">${t}단계</b><span>${D.TIER.name[t]}</span></div>`).join('')}</div>
        <div class="howto" style="font-size:17px"><p><b>${T.name}</b> · ${T.fam} · 공격력 ${T.atk} · 초당 ${T.aps}회 · 사거리 ±${T.range || 2}칸</p>
        <p>${T.desc}</p><p><b>출동</b>: ${D.STRIKE[k]}</p><p><b>6단계 각성</b>: ${D.AWAKEN[k]}</p>
        <p style="color:var(--sub)">단계가 오를수록 한 번에 쏘는 탄이 늘고(1단계 1발 → 6단계 6발) 더 빠르고 화려해진다. 5단계 수호상은 주기 강공격, 6단계 전설은 각성.</p></div>`;
    }
    dex(k, back) {
      const m = this.kind('dex').open(`<div class="mbox" style="width:680px"><h2>포탑 도감</h2>
        <div class="dexfams">${DEX_FAMS.map(([f, col, note]) => `<div class="dexfam" style="--fc:${col}"><span class="famtag">${f}<i>${note}</i></span>${D.ALL.filter(x => D.TOWERS[x].fam === f).map(x => `<button class="chip pbtn ${x === k ? 'on' : ''}" data-k="${x}">${D.TOWERS[x].name}</button>`).join('')}</div>`).join('')}</div>
        <div class="dexbody">${this.dexBody(k)}</div>
        <div class="btns"><button class="btn" data-act="back">닫기</button></div></div>`);
      // [v4.5] 포탑을 눌러도 창은 그대로 — 고른 표시와 아래 내용만 바꾼다
      m.onclick = e => {
        const b = e.target.closest('button'); if (!b) return; this.sfx().click();
        if (b.dataset.k) { m.querySelectorAll('[data-k]').forEach(c => c.classList.toggle('on', c === b)); m.querySelector('.dexbody').innerHTML = this.dexBody(b.dataset.k); }
        else if (b.dataset.act === 'back') back();
      };
    }
    help(back) {
      const m = this.open(`<div class="mbox"><h2>하는 법</h2><ol class="howto">
        <li><b>굴리기</b>: 금화를 내고 주사위 2개. 말이 그만큼 판을 돈다. '자동'을 켜면 계속 굴린다.</li>
        <li><b>빈 땅</b>에 멈추면 덱 5종 중 무작위 포탑 건설.</li>
        <li><b>내 포탑</b>에 멈추면 <b>출동</b>(필살기) + 금화로 <b>단계업</b> 버튼(4초).</li>
        <li><b>같은 포탑 + 같은 단계</b>를 끌어서 50% 넘게 겹쳐 놓으면 합쳐서 한 단계 위. 6단계 전설은 합치기로만.</li>
        <li>칸마다 <b>땅 속성</b>(배지): 금테 = 좋은 땅, 보라 테 = 나쁜 땅. 합치면 놓은 칸의 속성을 받는다.</li>
        <li>한 변 5칸을 꽉 채우면 <b>요새</b>(공격력 +50%). 내 포탑 칸에 연달아 멈추면 <b>연속 출동</b>.</li>
        <li>몬스터는 판 바깥 길을 계속 돈다. 판 위 몬스터가 한도를 넘으면 패배. 5라운드마다 보스.</li>
        <li>모서리: 출발(월급) · 무인도(3초 쉼) · 황금열쇠(카드) · 우주여행(원하는 칸).</li>
        <li>아래 덱 버튼 = 그 종류 전체 강화. 왼쪽 아래 = 지휘관, 오른쪽 아래 = 현금 수송차(잡으면 금화 대박).</li>
        <li><b>속성 반응</b>: 빙결 + 화염 = 열충격(3배) · 빙결 + 번개 = 초전도(연쇄 +3) · 중독 + 화염 = 유독 폭발 · 부식 + 기계 = 파쇄(1.4배).</li>
        <li><b>조커(프리즘탑)</b>는 같은 단계면 어떤 포탑과도 합쳐진다. 6단계 전설은 <b>각성</b>(규칙 하나 깨기)이 켜진다.</li>
        <li>키보드: 스페이스 = 굴리기, U = 단계업, G = 황금 주사위, Esc = 멈춤.</li>
      </ol><div class="btns"><button class="btn" data-act="back">알겠어요</button></div></div>`);
      m.onclick = e => { if (e.target.closest('[data-act=back]')) { this.sfx().click(); back ? back() : this.close(); } };
    }
    cardModal() {
      const g = this.g, cp = g.cardPick;
      const G2 = { c: '일반', r: '희귀', l: '전설' };
      const ICON = { quickhand: '⚡', bighand: '💰', sharp: '🗡', wall: '🧱', fortx2: '🏰', fort4: '🏯', strikex2: '💥', tierdisc: '🏷', lift: '⬆', reclaim: '🌱', focus: '🎯', critEye: '👁', lonely: '🗼', deal: '😈', salary: '💵', seed: '🏗', freeroll: '🆓', gdice2: '🎲' };
      const cost = cp.rerolls === 0 ? '무료' : (15 * cp.rerolls) + '금화', rr = cp.rerolls === 0 || g.gold - 15 * cp.rerolls >= g.rollCost;
      const m = this.open(`<div class="mbox" style="width:690px"><h2>작전 카드</h2><p class="sub">${g.round === 0 ? '판 시작 — 이번 판의 전략을 고르세요' : '보스 처치 보상'}${cp.left > 1 ? ' · ' + cp.left + '장 남음' : ''}</p>
        <div class="cards reveal">${cp.opts.map((id, k) => `<button class="card ${D.CARDS[id].g}" data-k="${k}" style="--k:${k}"><i class="cover"></i><span class="g">${G2[D.CARDS[id].g]}</span><div class="ico"><img src="${this.img('k_' + id)}" alt="" onerror="this.replaceWith(document.createTextNode('${ICON[id] || '★'}'))"></div><div class="nm">${D.CARDS[id].name}</div><div class="ds">${D.CARDS[id].desc}</div></button>`).join('')}</div>
        <div class="btns"><button class="btn sec" data-act="reroll"${rr ? '' : ' disabled title="굴릴 금화는 남겨 둬요"'}>다시 뽑기 (${cost})${rr ? '' : ' · 금화 부족'}</button></div></div>`);
      root.SFX.card();
      cp.opts.forEach((id, k) => setTimeout(() => { try { root.SFX.click(); if (D.CARDS[id].g === 'l') root.SFX.jackpot(); } catch (err) { /* 소리 없음 */ } }, 560 + k * 220));
      m.onclick = e => {
        const c = e.target.closest('.card');
        if (c) { this.close(); root.SFX.card(); this._cardDone = g.cardPick; this.app.cmd('pickCard', [+c.dataset.k]); if (g.round <= 1) root.SFX.music('battle'); return; }
        if (e.target.closest('[data-act=reroll]')) { if (this.app.net) { this.close(); this._cardDone = g.cardPick; this.app.cmd('rerollCards'); return; } if (g.rerollCards()) { this.close(); this.cardModal(); } else root.SFX.error(); }
      };
    }
    pauseMenu() {
      const g = this.g; if (!g || g.over || this.modalOpen()) return;
      if (!this.app.net) this.app.paused = true;
      const st = this.settings;
      const m = this.open(`<div class="mbox" style="width:520px"><h2>잠시 멈춤</h2><p class="sub">${g.mode === 'endless' ? '무한 토벌' : '정복 ' + g.chapter + '장'} · ${D.DIFF[g.diff].name} · ${Math.max(1, g.round)}라운드 · 처치 ${fmt(g.stats.kills)}</p>
        <div class="btns" style="flex-direction:column;align-items:stretch">
          <button class="btn green" data-act="resume">계속하기</button>
          <button class="btn sec" data-act="speed">게임 속도: ${st.speed}×</button>
          <button class="btn sec" data-act="sound">소리: ${st.sound ? '켜짐' : '꺼짐'}</button>
          <button class="btn sec" data-act="music">배경음: ${st.music ? '켜짐' : '꺼짐'}</button>
          <button class="btn sec" data-act="haptic">진동: ${st.haptic ? '켜짐' : '꺼짐'}</button>
          <button class="btn sec" data-act="dmg">피해 숫자: ${st.dmg ? '보임' : '숨김'}</button>
          <button class="btn sec" data-act="help">하는 법</button>
          <button class="btn sec" data-act="lobby">로비로 (이번 판 포기)</button>
        </div></div>`);
      m.onclick = e => {
        const b = e.target.closest('[data-act]'); if (!b) return; root.SFX.click();
        const a = b.dataset.act;
        if (a === 'resume') { this.close(); this.app.paused = false; return; }
        if (a === 'speed') st.speed = st.speed === 1 ? 2 : 1;
        if (a === 'sound') { st.sound = !st.sound; root.SFX.setOn(st.sound); }
        if (a === 'music') { st.music = !st.music; root.SFX.setMusic(st.music); }
        if (a === 'haptic') { st.haptic = !st.haptic; if (root.HAPTIC) { root.HAPTIC.setOn(st.haptic); root.HAPTIC.play('tap'); } }
        if (a === 'dmg') { st.dmg = !st.dmg; this.app.renderer.showDmg = st.dmg; }
        if (a === 'help') { this.help(() => { this.close(); this.pauseMenu(); }); return; }
        if (a === 'lobby') { this.close(); this.app.toLobby(); return; }
        store.set('settings', st); this.close(); this.pauseMenu();
      };
    }
    resultModal() {
      const g = this.g, win = g.over === 'win';
      if (this.app.embed) {   // [v5.3] 시안 안: 결과는 시안 결과 화면에서(보상 · 별은 시안 저장에)
        let mt = 0; for (const t of g.towersList()) mt = Math.max(mt, t.tower.tier);
        root.SFX.music(null); win ? root.SFX.win() : root.SFX.lose();
        this.app.post({ type: 'over', win, mode: g.mode, chapter: g.chapter, diff: g.diff, stars: g.stars(), kills: g.stats.kills, round: g.round, t: Math.round(g.t), legends: g.stats.legends, maxTier: Math.max(mt, g.stats.legends ? 6 : 0), score: g.score(), rolls: g.stats.rolls, merges: g.stats.merges, comboMax: g.comboMax, maxWeight: g.stats.maxWeight, loseReason: g.loseReason || null });
        return;
      }
      const stars = g.stars(), score = g.score();
      const best = store.get('best', {});
      if (g.mode === 'endless') { if (!best.endless || g.stats.kills > best.endless.kills) best.endless = { kills: g.stats.kills, round: g.round }; }
      else { const key = 'conquest' + (g.diff === 'normal' ? '' : '_' + g.diff); if (!best[key] || score > best[key].score) best[key] = { score, stars }; }
      store.set('best', best);
      root.SFX.music(null); win ? root.SFX.win() : root.SFX.lose();
      const rw = this.app.qaNoReward ? { gold: 0, core: 0 } : META.reward(META.load(), g);
      const total = Object.values(g.stats.dmg).reduce((a, b) => a + b, 0) || 1;
      const rows = g.deck.map(k => `<div class="dmgbar"><img src="${this.img('t_' + k + '_1')}" alt=""><span style="width:80px">${D.TOWERS[k].name}</span><div class="bar"><i style="width:${(g.stats.dmg[k] || 0) / total * 100}%"></i></div><span style="width:52px;text-align:right">${Math.round((g.stats.dmg[k] || 0) / total * 100)}%</span></div>`).join('');
      const why = g.loseReason === 'time' ? '마지막 보스를 90초 안에 못 잡았어요' : '판 위 몬스터가 한도를 넘었어요';
      const m = this.open(`<div class="mbox"><h2 style="font-size:48px;color:${win ? '#ffd23a' : '#ff8a8a'}">${win ? '승리!' : g.mode === 'endless' ? '토벌 끝' : '패배'}</h2>
        ${win ? `<div class="stars">${[1, 2, 3].map(n => `<span class="${n <= stars ? 'on' : ''}">★</span>`).join('')}</div><p class="sub">★ 승리 · ★ 몬스터 30 이하 유지 · ★ 전설 1개 이상</p>` : `<p class="sub">${why}</p>`}
        <div class="stat">
          <div><span>라운드</span><b>${g.round}</b></div><div><span>처치</span><b>${fmt(g.stats.kills)}</b></div>
          <div><span>전설</span><b>${g.stats.legends}</b></div><div><span>최대 연속 출동</span><b>×${g.comboMax}</b></div>
          <div><span>굴림</span><b>${g.stats.rolls}</b></div><div><span>합치기</span><b>${g.stats.merges}</b></div>
          <div><span>미션 성공</span><b>${g.missionsDone}</b></div><div><span>점수</span><b>${fmt(score)}</b></div>
        </div>
        ${g.partner ? `<div class="sec-t">협동 기여도</div><div class="dmgbar"><span style="width:60px">나</span><div class="bar"><i style="width:${(g.stats.dmgBy[1] / ((g.stats.dmgBy[1] + g.stats.dmgBy[2]) || 1) * 100).toFixed(0)}%"></i></div><span style="width:52px;text-align:right">${(g.stats.dmgBy[1] / ((g.stats.dmgBy[1] + g.stats.dmgBy[2]) || 1) * 100).toFixed(0)}%</span></div><div class="dmgbar"><span style="width:60px;color:#7ec0ff">동료</span><div class="bar"><i style="width:${(g.stats.dmgBy[2] / ((g.stats.dmgBy[1] + g.stats.dmgBy[2]) || 1) * 100).toFixed(0)}%;background:linear-gradient(#7ec0ff,#3a7ad0)"></i></div><span style="width:52px;text-align:right">${(g.stats.dmgBy[2] / ((g.stats.dmgBy[1] + g.stats.dmgBy[2]) || 1) * 100).toFixed(0)}%</span></div><p class="deckdesc">동료: 굴림 ${g.partner.rolls} · 건설 ${g.partner.built} · 합치기 ${g.partner.merges}</p>` : ''}
        <div class="reward"><span class="coin"></span>+${fmt(rw.gold)} 골드 <span class="core"></span>+${rw.core} 코어${rw.first ? ' <b>첫 클리어 ×3!</b>' : ''}</div>
        <div class="sec-t">포탑별 피해</div>${rows}
        <div class="btns"><button class="btn sec" data-act="lobby">로비</button><button class="btn sec" data-act="tree">성장 트리</button><button class="btn green" data-act="again">다시 하기</button></div></div>`);
      m.onclick = e => {
        const b = e.target.closest('[data-act]'); if (!b) return; root.SFX.click();
        this.close();
        if (b.dataset.act === 'tree') { this.app.game = null; this.tree('elem', () => this.app.toLobby()); return; }
        if (b.dataset.act === 'again') this.app.start(this.choice); else this.app.toLobby();
      };
    }
    reset() { this._overShown = false; this._gold = null; this._chips = null; this._combo = null; $('offerCard').hidden = true; this.auto = false; $('autoBtn').classList.remove('on'); this.hideInfo(); $('toast').hidden = true; }
  }
  root.UI = UI;
  root.STORE = store;
})(window);
