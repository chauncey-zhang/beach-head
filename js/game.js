/* 抢滩大战 · 主逻辑：状态机 / 主循环 / 输入 / 渲染 / HUD / 武器 / 商店 */
(function (BH) {
  var Game = {
    state: 'menu', // menu | playing | shop | win | lose
    canvas: null, ctx: null, dpr: 1,
    W: 0, H: 0,
    groundY: 0, seaY: 0, baseX: 70,
    player: null,
    bullets: [], enemies: [], effects: [], mines: [],
    baseHp: 100, baseMax: 100,
    score: 0, gold: 0,
    level: 0, wave: 0,
    spawnList: [], waveClock: 0, waveActive: false,
    mouse: { x: 0, y: 0 },
    weapon: 'cannon', mineCount: 3,
    strikeCd: 0, strikeCdMax: 480, strikeTimer: 0, strikeTarget: null,
    shopNewLevel: false, shopRects: [], weaponRects: [],
    pressing: false, sat: 0, sab: 0, sal: 0, sar: 0,
    ready: false
  };

  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  /* ---------- 布局 ---------- */
  Game.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.W = w; this.H = h;
    this.groundY = h * 0.80;
    this.seaY = h * 0.58;
    var cs = getComputedStyle(document.documentElement);
    function env(n) { var v = parseFloat(cs.getPropertyValue(n)); return isNaN(v) ? 0 : v; }
    this.sat = env('--sat'); this.sab = env('--sab'); this.sal = env('--sal'); this.sar = env('--sar');
    this.baseX = 70 + this.sal;
    if (this.player) { this.player.x = 80 + this.sal; this.player.y = this.groundY - 6; }
  };

  Game.enterFullscreen = function () {
    var d = document.documentElement;
    var fn = d.requestFullscreen || d.webkitRequestFullscreen || d.msRequestFullscreen;
    if (fn) { try { fn.call(d); } catch (e) {} }
    // 移动端地址栏隐藏（iOS 不支持全屏 API）
    setTimeout(function () { window.scrollTo(0, 1); }, 120);
    var self = this;
    setTimeout(function () { self.resize(); }, 300);
  };

  /* ---------- 初始化 ---------- */
  Game.init = function () {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    var self = this;
    window.addEventListener('resize', function () { self.resize(); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { self.resize(); }, 200); });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () { self.resize(); });
    }
    window.addEventListener('keydown', function (e) {
      if (self.state !== 'playing') return;
      if (e.key === '1') self.weapon = 'cannon';
      else if (e.key === '2') self.weapon = 'mg';
      else if (e.key === '3') self.weapon = 'mine';
      else if (e.key === '4') self.weapon = 'strike';
    });

    function toLocal(e) {
      var r = self.canvas.getBoundingClientRect();
      var cx = e.clientX, cy = e.clientY;
      if (e.touches && e.touches[0]) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      self.mouse.x = cx - r.left;
      self.mouse.y = cy - r.top;
    }
    this.canvas.addEventListener('mousemove', function (e) { toLocal(e); });
    this.canvas.addEventListener('mousedown', function (e) { toLocal(e); self.pressing = true; self.onClick(); });
    window.addEventListener('mouseup', function () { self.pressing = false; });
    this.canvas.addEventListener('touchmove', function (e) { toLocal(e); e.preventDefault(); }, { passive: false });
    this.canvas.addEventListener('touchstart', function (e) { toLocal(e); self.pressing = true; self.onClick(); e.preventDefault(); }, { passive: false });
    this.canvas.addEventListener('touchend', function (e) { self.pressing = false; e.preventDefault(); }, { passive: false });

    BH.loadAssets({
      bg: 'assets/bg.svg',
      soldier: 'assets/soldier.svg',
      tank: 'assets/tank.svg',
      boat: 'assets/boat.svg',
      plane: 'assets/plane.svg'
    }, function () {
      self.ready = true;
      self.player = new BH.Player(80, self.groundY - 6);
      if (BH.Sound) BH.Sound.init();
      self.loop();
    });
  };

  Game.onClick = function () {
    if (BH.Sound) BH.Sound.resume();
    if (this.state === 'menu' || this.state === 'win' || this.state === 'lose') {
      this.startGame();
      return;
    }
    if (this.state === 'shop') { this.handleShopClick(); return; }
    // playing：先判断是否点中武器栏
    for (var i = 0; i < this.weaponRects.length; i++) {
      var r = this.weaponRects[i];
      if (this.mouse.x >= r.x && this.mouse.x <= r.x + r.w && this.mouse.y >= r.y && this.mouse.y <= r.y + r.h) {
        this.weapon = r.id;
        if (BH.Sound) BH.Sound.click();
        return;
      }
    }
    // 动作型武器：轻点单次触发（地雷 / 空袭）
    if (this.weapon === 'mine') this.placeMine();
    else if (this.weapon === 'strike') this.doStrike();
    // cannon / mg 改为「按住持续发射」，由 update 中 pressing 驱动
  };

  /* ---------- 关卡 / 波次 ---------- */
  Game.startGame = function () {
    this.pressing = false;
    this.enterFullscreen();
    this.state = 'playing';
    this.level = 0; this.wave = 0;
    this.score = 0; this.gold = 0;
    this.bullets = []; this.enemies = []; this.effects = []; this.mines = [];
    this.baseMax = BH.LEVELS[0].baseHp;
    this.baseHp = this.baseMax;
    this.weapon = 'cannon'; this.mineCount = 3;
    this.strikeCd = 0; this.strikeTimer = 0; this.strikeTarget = null;
    this.buildWave(0);
  };

  Game.buildWave = function (w) {
    var def = BH.LEVELS[this.level].waves[w];
    var list = [], clock = 0;
    def.enemies.forEach(function (g) {
      for (var i = 0; i < g.count; i++) {
        list.push({ type: g.type, at: clock });
        clock += (g.gap || 60);
      }
    });
    this.spawnList = list;
    this.waveClock = 0;
    this.waveActive = true;
  };

  Game.spawnEnemy = function (type) {
    var def = BH.ENEMY_DEF[type];
    var y;
    if (def.lane === 'sea') y = this.seaY;
    else if (def.lane === 'sky') y = this.H * 0.2;
    else y = this.groundY - def.r;
    this.enemies.push(new BH.Enemy(type, { x: this.W + 40, y: y }));
  };

  Game.damageBase = function (d) {
    this.baseHp -= d;
    if (this.baseHp <= 0) {
      this.baseHp = 0;
      this.state = 'lose';
      if (BH.Sound) BH.Sound.lose();
    }
  };

  Game.fire = function () {
    if (this.weapon === 'cannon') {
      if (this.player.canCannon()) { this.bullets.push(this.player.cannon()); if (BH.Sound) BH.Sound.shoot(); }
    } else if (this.weapon === 'mg') {
      if (this.player.canMg()) { this.bullets.push(this.player.mg()); if (BH.Sound) BH.Sound.mg(); }
    }
  };

  Game.placeMine = function () {
    if (this.mineCount <= 0) return;
    var x = Math.max(this.baseX, Math.min(this.W - 10, this.mouse.x));
    this.mines.push(new BH.Mine(x, this.groundY - 4));
    this.mineCount--;
    if (BH.Sound) BH.Sound.click();
  };

  Game.doStrike = function () {
    if (this.strikeCd > 0) return;
    this.strikeTarget = { x: this.mouse.x, y: this.mouse.y };
    this.strikeTimer = 45;
    this.strikeCd = this.strikeCdMax;
    if (BH.Sound) BH.Sound.click();
  };

  Game.detonateStrike = function () {
    var t = this.strikeTarget; if (!t) return;
    this.effects.push(new BH.Effect(t.x, t.y, 3));
    if (BH.Sound) BH.Sound.explosion();
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead) continue;
      if (dist2(t.x, t.y, e.x, e.y) <= (120 + e.r) * (120 + e.r)) {
        if (e.hit(40)) { this.score += 10; this.gold += e.reward; }
      }
    }
  };

  /* ---------- 更新 ---------- */
  Game.update = function () {
    if (this.state !== 'playing') return;

    this.player.aim(this.mouse.x, this.mouse.y);
    this.player.update();
    // 按住持续发射（主炮 / 机枪），移动端触摸与鼠标通用
    if (this.pressing && (this.weapon === 'cannon' || this.weapon === 'mg')) this.fire();

    if (this.waveActive) {
      this.waveClock++;
      while (this.spawnList.length && this.spawnList[0].at <= this.waveClock) {
        this.spawnEnemy(this.spawnList.shift().type);
      }
      if (this.spawnList.length === 0 && this.enemies.length === 0) {
        this.waveActive = false;
        this.wave++;
        if (this.wave < BH.LEVELS[this.level].waves.length) {
          this.state = 'shop'; this.shopNewLevel = false;
        } else {
          this.level++;
          if (this.level < BH.LEVELS.length) {
            this.state = 'shop'; this.shopNewLevel = true;
          } else {
            this.state = 'win';
            if (BH.Sound) BH.Sound.win();
          }
        }
      }
    }

    var i, j;
    for (i = 0; i < this.bullets.length; i++) this.bullets[i].update(this);
    for (i = 0; i < this.enemies.length; i++) this.enemies[i].update(this);
    for (i = 0; i < this.mines.length; i++) this.mines[i].update(this);
    for (i = 0; i < this.effects.length; i++) this.effects[i].update();

    if (this.strikeTimer > 0) {
      this.strikeTimer--;
      if (this.strikeTimer === 0) this.detonateStrike();
    }
    if (this.strikeCd > 0) this.strikeCd--;

    // 碰撞：子弹 vs 敌人
    for (i = 0; i < this.bullets.length; i++) {
      var b = this.bullets[i];
      if (b.dead) continue;
      for (j = 0; j < this.enemies.length; j++) {
        var e = this.enemies[j];
        if (e.dead) continue;
        var rr = b.r + e.r;
        if (dist2(b.x, b.y, e.x, e.y) <= rr * rr) {
          b.dead = true;
          if (e.hit(b.damage)) {
            this.score += 10; this.gold += e.reward;
            this.effects.push(new BH.Effect(e.x, e.y, 1));
            if (BH.Sound) BH.Sound.hit();
          } else {
            this.effects.push(new BH.Effect(b.x, b.y, 0.7));
          }
          break;
        }
      }
    }

    this.bullets = this.bullets.filter(function (o) { return !o.dead; });
    this.enemies = this.enemies.filter(function (o) { return !o.dead; });
    this.mines = this.mines.filter(function (o) { return !o.dead; });
    this.effects = this.effects.filter(function (o) { return !o.dead; });
  };

  /* ---------- 渲染 ---------- */
  Game.render = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);
    var bg = BH.images.bg;
    if (bg) ctx.drawImage(bg, 0, 0, W, H);

    // 基地
    ctx.fillStyle = '#7a4a2a';
    ctx.fillRect(this.baseX - 30, this.groundY - 30, 30, 50);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(this.baseX - 28, this.groundY - 46, 4, 16);
    ctx.beginPath();
    ctx.moveTo(this.baseX - 24, this.groundY - 46);
    ctx.lineTo(this.baseX - 8, this.groundY - 46);
    ctx.lineTo(this.baseX - 24, this.groundY - 34);
    ctx.closePath(); ctx.fill();

    // 空袭落点提示
    if (this.strikeTimer > 0 && this.strikeTarget) {
      ctx.strokeStyle = 'rgba(255,80,80,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.strikeTarget.x, this.strikeTarget.y, 120, 0, 6.28); ctx.stroke();
    }

    this.player.draw(ctx);
    for (var i = 0; i < this.mines.length; i++) this.mines[i].draw(ctx);
    for (i = 0; i < this.enemies.length; i++) this.enemies[i].draw(ctx, BH.images);
    for (i = 0; i < this.bullets.length; i++) this.bullets[i].draw(ctx);
    for (i = 0; i < this.effects.length; i++) this.effects[i].draw(ctx);

    this.drawHUD();
    if (this.state === 'menu') this.drawMenu();
    else if (this.state === 'win') this.drawEnd(true);
    else if (this.state === 'lose') this.drawEnd(false);
    else if (this.state === 'playing') this.drawWeaponBar();
    else if (this.state === 'shop') this.drawShop();
  };

  Game.drawHUD = function () {
    var ctx = this.ctx;
    var ox = 10 + this.sal, oy = 10 + this.sat;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(ox, oy, 300, 70);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('基地', ox + 12, oy + 8);
    ctx.fillStyle = '#444';
    ctx.fillRect(ox + 50, oy + 10, 160, 12);
    var ratio = this.baseHp / this.baseMax;
    ctx.fillStyle = ratio > 0.3 ? '#46c846' : '#e74c3c';
    ctx.fillRect(ox + 50, oy + 10, 160 * ratio, 12);
    ctx.strokeStyle = '#000'; ctx.strokeRect(ox + 50, oy + 10, 160, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText(this.baseHp + '/' + this.baseMax, ox + 220, oy + 8);
    var info = BH.LEVELS[this.level] ? BH.LEVELS[this.level].name : '';
    ctx.fillText(info + '  第 ' + (this.wave + 1) + ' 波', ox + 12, oy + 30);
    ctx.fillText('得分 ' + this.score + '   金币 ' + this.gold, ox + 12, oy + 50);
  };

  Game.drawWeaponBar = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    var items = [
      ['1 主炮', 'cannon'],
      ['2 机枪', 'mg'],
      ['3 地雷', 'mine'],
      ['4 空袭', 'strike']
    ];
    var gap = 10, n = items.length;
    var bw = (W - this.sal - this.sar - (n + 1) * gap) / n;
    var bh = Math.max(42, H * 0.08);
    var x0 = this.sal + gap, y0 = H - bh - 8 - this.sab;
    this.weaponRects = [];
    for (var i = 0; i < items.length; i++) {
      var x = x0 + i * (bw + gap);
      var active = this.weapon === items[i][1];
      ctx.fillStyle = active ? '#ffd24a' : 'rgba(0,0,0,0.4)';
      ctx.fillRect(x, y0, bw, bh);
      ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y0, bw, bh);
      ctx.fillStyle = active ? '#000' : '#fff';
      ctx.font = Math.min(16, bw * 0.11) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var label = items[i][0];
      if (items[i][1] === 'mine') label += ' (' + this.mineCount + ')';
      if (items[i][1] === 'strike') label += this.strikeCd > 0 ? (' ' + Math.ceil(this.strikeCd / 60) + 's') : ' 就绪';
      ctx.fillText(label, x + bw / 2, y0 + bh / 2);
      this.weaponRects.push({ x: x, y: y0, w: bw, h: bh, id: items[i][1] });
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  };

  Game.drawShop = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(this.shopNewLevel ? ('通过！进入：' + BH.LEVELS[this.level].name) : '布防商店（波次间隙）', W / 2, H * 0.16);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('金币：' + this.gold + '      基地：' + this.baseHp + '/' + this.baseMax, W / 2, H * 0.16 + 46);

    var items = [
      { id: 'repair', label: '维修基地 +25 (30金)', cost: 30, can: this.gold >= 30 && this.baseHp < this.baseMax },
      { id: 'mine', label: '购买地雷 +3 (20金)', cost: 20, can: this.gold >= 20 },
      { id: 'cannon', label: '升级主炮 伤害+4 (50金)', cost: 50, can: this.gold >= 50 },
      { id: 'mg', label: '升级机枪 射速+ (40金)', cost: 40, can: this.gold >= 40 },
      { id: 'start', label: '▶ 开始下一波', cost: 0, can: true }
    ];
    this.shopRects = [];
    var bw = Math.min(360, W - this.sal - this.sar - 40), bh = 48, gap = 16;
    var x0 = (W - bw) / 2, y0 = H * 0.30 + this.sat;
    for (var i = 0; i < items.length; i++) {
      var x = x0, y = y0 + i * (bh + gap);
      var it = items[i];
      ctx.fillStyle = it.id === 'start' ? (it.can ? '#46c846' : '#555')
        : (it.can ? 'rgba(255,255,255,0.15)' : 'rgba(80,80,80,0.35)');
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y, bw, bh);
      ctx.fillStyle = it.can ? '#fff' : '#999';
      ctx.font = '18px sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText(it.label, x + bw / 2, y + bh / 2);
      this.shopRects.push({ x: x, y: y, w: bw, h: bh, id: it.id, cost: it.cost, can: it.can });
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  };

  Game.handleShopClick = function () {
    if (BH.Sound) BH.Sound.click();
    for (var i = 0; i < this.shopRects.length; i++) {
      var r = this.shopRects[i];
      if (this.mouse.x >= r.x && this.mouse.x <= r.x + r.w && this.mouse.y >= r.y && this.mouse.y <= r.y + r.h) {
        this.buyOrStart(r); return;
      }
    }
  };

  Game.buyOrStart = function (r) {
    if (r.id === 'start') { this.startNextWave(); return; }
    if (!r.can) return;
    if (r.id === 'repair') { this.gold -= r.cost; this.baseHp = Math.min(this.baseMax, this.baseHp + 25); }
    else if (r.id === 'mine') { this.gold -= r.cost; this.mineCount += 3; }
    else if (r.id === 'cannon') { this.gold -= r.cost; this.player.cannonDmg += 4; }
    else if (r.id === 'mg') { this.gold -= r.cost; if (this.player.mgRate > 2) this.player.mgRate -= 1; }
  };

  Game.startNextWave = function () {
    this.state = 'playing';
    if (this.shopNewLevel) {
      this.shopNewLevel = false;
      this.wave = 0;
      this.baseMax = BH.LEVELS[this.level].baseHp;
      this.baseHp = this.baseMax;
    }
    this.buildWave(this.wave);
  };

  Game.drawMenu = function () {
    var ctx = this.ctx;
    var touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('抢 滩 大 战', this.W / 2, this.H / 2 - 90);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    if (touch) {
      ctx.fillText('手指按住屏幕瞄准，按住即持续开火', this.W / 2, this.H / 2 - 20);
      ctx.fillText('武器：1主炮 2机枪 3地雷 4空袭', this.W / 2, this.H / 2 + 12);
      ctx.fillText('击退从海上登陆的敌军，守住基地！', this.W / 2, this.H / 2 + 44);
      ctx.fillStyle = '#7CFC00';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('点击屏幕开始', this.W / 2, this.H / 2 + 100);
    } else {
      ctx.fillText('移动鼠标瞄准，点击发射', this.W / 2, this.H / 2 - 20);
      ctx.fillText('武器：1主炮 2机枪 3地雷 4空袭', this.W / 2, this.H / 2 + 12);
      ctx.fillText('击退从海上登陆的敌军，守住基地！', this.W / 2, this.H / 2 + 44);
      ctx.fillStyle = '#7CFC00';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('点击屏幕开始', this.W / 2, this.H / 2 + 100);
    }
    ctx.textAlign = 'left';
  };

  Game.drawEnd = function (win) {
    var ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = win ? '#7CFC00' : '#e74c3c';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(win ? '全 线 胜 利 ！' : '基 地 失 守', this.W / 2, this.H / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('最终得分 ' + this.score, this.W / 2, this.H / 2 + 20);
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('点击重新开始', this.W / 2, this.H / 2 + 70);
    ctx.textAlign = 'left';
  };

  /* ---------- 主循环 ---------- */
  Game.loop = function () {
    var self = this;
    function frame() {
      self.update();
      self.render();
      requestAnimationFrame(frame);
    }
    frame();
  };

  BH.Game = Game;
  if (document.readyState !== 'loading') Game.init();
  else document.addEventListener('DOMContentLoaded', function () { Game.init(); });
})(window.BH);
