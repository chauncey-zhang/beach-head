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
    shopNewLevel: false, shopRects: [], weaponBtnRect: null, weaponMenuRects: [], weaponMenuOpen: false,
    pressing: false, sat: 0, sab: 0, sal: 0, sar: 0,
    ready: false
  };

  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  /* ---------- 布局 ---------- */
  Game.resize = function () {
    var w = this.canvas.clientWidth || window.innerWidth;
    var h = this.canvas.clientHeight || window.innerHeight;
    if (!w || !h) { w = window.innerWidth; h = window.innerHeight; }
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.W = w; this.H = h;
    // 竖屏（手机尺寸）时通过 CSS 旋转铺满，记录旋转状态用于触摸坐标逆映射
    this.rotated = (window.innerHeight > window.innerWidth) && window.innerWidth <= 900;
    this.seaY = h * 0.48;
    this.coastY = h * 0.64;     // 水线：海与沙滩交界（仅用于背景绘制）
    this.groundY = h * 0.88;    // 站立线：炮台 / 士兵 / 地雷所在的沙滩位置（下移以铺满海滩）
    var cs = getComputedStyle(document.documentElement);
    function env(n) { var v = parseFloat(cs.getPropertyValue(n)); return isNaN(v) ? 0 : v; }
    this.sat = env('--sat'); this.sab = env('--sab'); this.sal = env('--sal'); this.sar = env('--sar');
    this.baseX = 70 + this.sal;
    if (this.player) { this.player.x = 80 + this.sal; this.player.y = this.groundY; }
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
      var cx = e.clientX, cy = e.clientY;
      if (e.touches && e.touches[0]) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
      if (self.rotated) {
        // 画面顺时针旋转 90°：屏幕坐标 -> canvas 内部坐标的逆映射
        self.mouse.x = cy;
        self.mouse.y = window.innerWidth - cx;
      } else {
        var r = self.canvas.getBoundingClientRect();
        self.mouse.x = cx - r.left;
        self.mouse.y = cy - r.top;
      }
    }
    this.canvas.addEventListener('mousemove', function (e) { toLocal(e); });
    this.canvas.addEventListener('mousedown', function (e) { toLocal(e); var h = self.hitUI(self.mouse.x, self.mouse.y); self.pressing = !(h && (h.type === 'weapon' || h.type === 'weaponToggle' || h.type === 'weaponMenu')); self.onClick(); });
    window.addEventListener('mouseup', function () { self.pressing = false; });
    this.canvas.addEventListener('touchmove', function (e) { toLocal(e); e.preventDefault(); }, { passive: false });
    this.canvas.addEventListener('touchstart', function (e) { toLocal(e); var h = self.hitUI(self.mouse.x, self.mouse.y); self.pressing = !(h && (h.type === 'weapon' || h.type === 'weaponToggle' || h.type === 'weaponMenu')); self.onClick(); e.preventDefault(); }, { passive: false });
    this.canvas.addEventListener('touchend', function (e) { self.pressing = false; e.preventDefault(); }, { passive: false });

    BH.loadAssets({
      bg: 'assets/bg.svg',
      soldier: 'assets/soldier.svg',
      tank: 'assets/tank.svg',
      boat: 'assets/boat.svg',
      plane: 'assets/plane.svg'
    }, function () {
      self.ready = true;
      self.player = new BH.Player(80 + self.sal, self.groundY);
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
    var h = this.hitUI(this.mouse.x, this.mouse.y);
    if (h && h.type === 'weaponToggle') {
      this.weaponMenuOpen = !this.weaponMenuOpen;
      if (BH.Sound) BH.Sound.click();
      return;
    }
    if (h && h.type === 'weaponMenu') {
      this.weapon = h.id; this.weaponMenuOpen = false;
      if (BH.Sound) BH.Sound.click();
      return;
    }
    if (this.weaponMenuOpen) { this.weaponMenuOpen = false; return; } // 点外部收起菜单，不触发开火/布雷
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
    this.weapon = 'cannon'; this.mineCount = 3; this.weaponMenuOpen = false;
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
    if (this.pressing && !this.weaponMenuOpen && (this.weapon === 'cannon' || this.weapon === 'mg')) this.fire();

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

  Game._cloud = function (ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.5, y + h * 0.3, w * 0.6, h * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.5, y + h * 0.3, w * 0.6, h * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  Game.drawBackground = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    var skyY = this.seaY;
    var groundY = this.coastY;   // 背景中的海/沙交界，使用水线而非站立线
    var now = Date.now();

    // ---- 天空 ----
    var sky = ctx.createLinearGradient(0, 0, 0, skyY);
    sky.addColorStop(0, '#2a6fb0');
    sky.addColorStop(0.6, '#5fa8d8');
    sky.addColorStop(1, '#cfecf5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, skyY);

    // 太阳光晕 + 日盘
    var sx = W * 0.80, sy = skyY * 0.32;
    var sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.min(160, W * 0.25));
    sun.addColorStop(0, 'rgba(255,247,210,0.95)');
    sun.addColorStop(0.4, 'rgba(255,232,150,0.35)');
    sun.addColorStop(1, 'rgba(255,232,150,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, skyY);
    ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,251,230,0.95)'; ctx.fill();

    // 飘云
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    var ct = now / 4000;
    this._cloud(ctx, (W * 0.18 + ct * 9) % (W + 240) - 120, skyY * 0.28, 60, 20);
    this._cloud(ctx, (W * 0.52 + ct * 6) % (W + 240) - 120, skyY * 0.55, 84, 26);
    this._cloud(ctx, (W * 0.82 + ct * 7) % (W + 240) - 120, skyY * 0.2, 50, 17);

    // ---- 海面 ----
    var sea = ctx.createLinearGradient(0, skyY, 0, groundY);
    sea.addColorStop(0, '#86c8dc');
    sea.addColorStop(0.5, '#2f7fb0');
    sea.addColorStop(1, '#0f4f7a');
    ctx.fillStyle = sea;
    ctx.fillRect(0, skyY, W, groundY - skyY);

    // 流动波纹
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 1.5;
    var wt = now / 600;
    for (var wy = skyY + 8; wy < groundY; wy += 15) {
      ctx.beginPath();
      for (var wx = 0; wx <= W; wx += 12) {
        var yy = wy + Math.sin(wx * 0.03 + wt + wy * 0.05) * 3;
        if (wx === 0) ctx.moveTo(wx, yy); else ctx.lineTo(wx, yy);
      }
      ctx.stroke();
    }
    // 海面阳光反光（太阳正下方垂直光柱，越靠岸越宽、随波浪闪动）
    ctx.strokeStyle = 'rgba(255,246,205,0.32)';
    ctx.lineWidth = 2;
    for (var ry = skyY + 4; ry < groundY; ry += 7) {
      var spread = 8 + (ry - skyY) * 0.55;
      var half = spread * (0.45 + 0.55 * Math.abs(Math.sin(ry * 0.5 + wt * 2)));
      ctx.beginPath();
      ctx.moveTo(sx - half, ry);
      ctx.lineTo(sx + half, ry);
      ctx.stroke();
    }

    // 远处海平线军舰剪影（缓慢漂移，增加纵深与战场感）
    ctx.save();
    ctx.fillStyle = 'rgba(18,38,58,0.32)';
    var ships = [[0.12, 0.9], [0.46, 1.30], [0.78, 0.75]];
    for (var si = 0; si < ships.length; si++) {
      var sp = ships[si];
      var shx = ((sp[0] * W + now * 0.006 * sp[1]) % (W + 320)) - 160;
      var shy = skyY + sp[1] * 9 + 1;
      var sw = 76 * sp[1], sh = 13 * sp[1];
      ctx.beginPath();
      ctx.moveTo(shx - sw * 0.5, shy);
      ctx.lineTo(shx + sw * 0.5, shy);
      ctx.lineTo(shx + sw * 0.36, shy + sh * 0.55);
      ctx.lineTo(shx - sw * 0.44, shy + sh * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(shx - sw * 0.10, shy - sh * 0.95, sw * 0.22, sh * 0.95);
      ctx.fillRect(shx - sw * 0.01, shy - sh * 1.55, sw * 0.045, sh * 0.62);
      ctx.fillRect(shx + sw * 0.09, shy - sh * 1.45, sw * 0.055, sh * 0.52);
    }
    ctx.restore();

    // ---- 沙滩 ----
    var sand = ctx.createLinearGradient(0, groundY, 0, H);
    sand.addColorStop(0, '#ecdcb0');
    sand.addColorStop(0.15, '#dcc690');
    sand.addColorStop(1, '#c2a86a');
    ctx.fillStyle = sand;
    ctx.fillRect(0, groundY, W, H - groundY);

    // 浪花白沫（海岸线）
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    var ft = now / 300;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (var fx = 0; fx <= W; fx += 10) {
      var fy = groundY + Math.sin(fx * 0.05 + ft) * 2;
      ctx.lineTo(fx, fy);
    }
    ctx.lineTo(W, groundY + 7); ctx.lineTo(0, groundY + 7); ctx.closePath(); ctx.fill();

    // 砂砾质感
    ctx.fillStyle = 'rgba(120,90,40,0.22)';
    for (var s = 0; s < 90; s++) {
      var rx = (s * 137.5) % W;
      var ry = groundY + 12 + ((s * 53) % Math.max(1, H - groundY - 12));
      ctx.fillRect(rx, ry, 2, 2);
    }
  };

  /* ---------- 渲染 ---------- */
  Game.render = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);
    this.drawBackground();

    // 基地 · 海岸碉堡
    var bx = this.baseX;
    // 投影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(bx - 16, this.groundY + 20, 32, 8, 0, 0, 6.283); ctx.fill();
    // 前排沙袋（两垛交错）
    ctx.fillStyle = '#c2a86a'; ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
    this.roundRect(ctx, bx - 42, this.groundY + 4, 20, 16, 7); ctx.fill(); ctx.stroke();
    this.roundRect(ctx, bx - 24, this.groundY + 8, 20, 14, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(120,90,40,0.35)';
    this.roundRect(ctx, bx - 40, this.groundY + 10, 16, 3, 1.5); ctx.fill();
    this.roundRect(ctx, bx - 22, this.groundY + 14, 16, 3, 1.5); ctx.fill();
    // 混凝土碉堡主体
    var cg = ctx.createLinearGradient(0, this.groundY - 30, 0, this.groundY + 20);
    cg.addColorStop(0, '#8c9199'); cg.addColorStop(0.5, '#5f636a'); cg.addColorStop(1, '#33373c');
    ctx.fillStyle = cg;
    this.roundRect(ctx, bx - 32, this.groundY - 28, 34, 48, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    // 砖缝
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 15, this.groundY - 28); ctx.lineTo(bx - 15, this.groundY + 20);
    ctx.moveTo(bx - 32, this.groundY - 6); ctx.lineTo(bx + 2, this.groundY - 6);
    ctx.moveTo(bx - 32, this.groundY + 8); ctx.lineTo(bx + 2, this.groundY + 8);
    ctx.stroke();
    // 顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    this.roundRect(ctx, bx - 29, this.groundY - 26, 28, 6, 3); ctx.fill();
    // 拱形射击孔
    ctx.fillStyle = '#1a1c1f';
    ctx.beginPath();
    ctx.moveTo(bx - 24, this.groundY + 6);
    ctx.lineTo(bx - 24, this.groundY - 4);
    ctx.arc(bx - 17, this.groundY - 4, 7, Math.PI, 2 * Math.PI);
    ctx.lineTo(bx - 10, this.groundY + 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,80,80,0.18)';
    ctx.beginPath(); ctx.arc(bx - 17, this.groundY - 1, 4, 0, 6.283); ctx.fill();
    // 旗杆 + 红旗
    ctx.strokeStyle = '#caa37a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx - 25, this.groundY - 28); ctx.lineTo(bx - 25, this.groundY - 54); ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(bx - 25, this.groundY - 54);
    ctx.lineTo(bx - 7, this.groundY - 48);
    ctx.lineTo(bx - 25, this.groundY - 42);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(bx - 23, this.groundY - 52);
    ctx.lineTo(bx - 13, this.groundY - 49);
    ctx.lineTo(bx - 23, this.groundY - 46);
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

    if (this.state !== 'shop') this.drawHUD();
    if (this.state === 'menu') this.drawMenu();
    else if (this.state === 'win') this.drawEnd(true);
    else if (this.state === 'lose') this.drawEnd(false);
    else if (this.state === 'playing') this.drawWeaponSelector();
    else if (this.state === 'shop') this.drawShop();
  };

  Game.drawHUD = function () {
    var ctx = this.ctx;
    var cardX = 12 + this.sal, cardY = 12 + this.sat;
    var pad = 13, rowH = 26, rgap = 8;
    var hpBarW = 104;
    var ratio = Math.max(0, this.baseHp / this.baseMax);

    var levelName = BH.LEVELS[this.level] ? BH.LEVELS[this.level].name : '未知区域';
    var waveTxt = '第 ' + (this.wave + 1) + ' 波';

    // 量算各模块宽度，确保卡片不溢出
    ctx.font = 'bold 13px sans-serif';
    var sTxt = '得分 ' + this.score;
    var gTxt = '金币 ' + this.gold;
    var scoreW = ctx.measureText(sTxt).width;
    var goldW = ctx.measureText(gTxt).width;
    ctx.font = '13px sans-serif';
    var waveW = ctx.measureText(levelName + '  ·  ' + waveTxt).width;

    var topW = 34 + 6 + hpBarW + 10 + 56;            // 基地 + 血条 + 数值
    var midW = waveW + 4;
    var botW = 16 + 6 + scoreW + 16 + 16 + 6 + goldW; // 星+得分 + 间隔 + 币+金币
    var innerW = Math.max(topW, midW, botW);
    var cardW = innerW + pad * 2;
    var cardH = pad * 2 + rowH * 3 + rgap * 2;

    // 卡片背景（海蓝玻璃质感，呼应天空/海面，金边呼应阳光，顶部高光）
    this.roundRect(ctx, cardX, cardY, cardW, cardH, 14);
    var bg = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    bg.addColorStop(0, 'rgba(38,112,168,0.66)');
    bg.addColorStop(1, 'rgba(11,58,98,0.78)');
    ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,210,74,0.42)'; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cardX + 16, cardY + 1.5); ctx.lineTo(cardX + cardW - 16, cardY + 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();

    var cx0 = cardX + pad;
    var cy0 = cardY + pad;
    ctx.textBaseline = 'middle';

    // ---- 第一行：基地 + 血条 + 数值 ----
    var ry = cy0 + rowH / 2;
    ctx.fillStyle = '#ffd24a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('基地', cx0, ry);
    var barX = cx0 + 34 + 6, barY = ry - 5;
    this.roundRect(ctx, barX, barY, hpBarW, 10, 5); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    var col = ratio > 0.5 ? '#46c846' : (ratio > 0.3 ? '#f1c40f' : '#e74c3c');
    if (ratio > 0) { this.roundRect(ctx, barX, barY, hpBarW * ratio, 10, 5); ctx.fillStyle = col; ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; this.roundRect(ctx, barX, barY, hpBarW, 10, 5); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(this.baseHp + '/' + this.baseMax, barX + hpBarW + 8, ry);

    // 分隔线
    var sepY = cy0 + rowH + rgap / 2;
    ctx.beginPath(); ctx.moveTo(cx0, sepY); ctx.lineTo(cardX + cardW - pad, sepY);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();

    // ---- 第二行：关卡 · 波次 ----
    ry = cy0 + rowH + rgap + rowH / 2;
    ctx.fillStyle = '#cfe3ff'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(levelName + '  ·  ' + waveTxt, cx0, ry);

    // ---- 第三行：得分 + 金币 ----
    ry = cy0 + (rowH + rgap) * 2 + rowH / 2;
    this.drawFireIcon(ctx, cx0 + 8, ry, 13);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(sTxt, cx0 + 16 + 6, ry);
    var gx0 = cx0 + 16 + 6 + scoreW + 16;
    ctx.beginPath(); ctx.arc(gx0 + 8, ry, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd24a'; ctx.fill();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#8a5a00'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('¥', gx0 + 8, ry + 1);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(gTxt, gx0 + 16 + 6, ry);

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  };

  Game.roundRect = function (ctx, x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  Game.drawWeaponIcon = function (ctx, type, cx, cy, s, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.10); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (type === 'cannon') {
      ctx.beginPath(); ctx.moveTo(cx - s * 0.12, cy + s * 0.05); ctx.lineTo(cx + s * 0.42, cy - s * 0.38); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx - s * 0.18, cy + s * 0.22, s * 0.27, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx + s * 0.42, cy - s * 0.38, s * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - s * 0.42, cy + s * 0.46); ctx.lineTo(cx + s * 0.06, cy + s * 0.46); ctx.stroke();
    } else if (type === 'mg') {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.42, cy + s * 0.28);
      ctx.lineTo(cx - s * 0.42, cy - s * 0.06);
      ctx.lineTo(cx + s * 0.08, cy - s * 0.14);
      ctx.lineTo(cx + s * 0.46, cy - s * 0.2);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy + s * 0.28); ctx.lineTo(cx - s * 0.02, cy + s * 0.46); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - s * 0.42, cy + s * 0.04); ctx.lineTo(cx - s * 0.52, cy + s * 0.3); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx - s * 0.42, cy - s * 0.02, s * 0.1, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'mine') {
      ctx.lineWidth = Math.max(1.5, s * 0.07);
      for (var a = 0; a < 8; a++) {
        var ang = a * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * s * 0.3, cy + Math.sin(ang) * s * 0.3);
        ctx.lineTo(cx + Math.cos(ang) * s * 0.52, cy + Math.sin(ang) * s * 0.52);
        ctx.stroke();
      }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, s * 0.26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(cx - s * 0.04, cy - s * 0.04, s * 0.1, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'strike') {
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.55, cy); ctx.lineTo(cx - s * 0.28, cy);
      ctx.moveTo(cx + s * 0.28, cy); ctx.lineTo(cx + s * 0.55, cy);
      ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx, cy - s * 0.28);
      ctx.moveTo(cx, cy + s * 0.28); ctx.lineTo(cx, cy + s * 0.55);
      ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, s * 0.18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  Game.drawFireIcon = function (ctx, cx, cy, s) {
    ctx.save(); ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var r = (i % 2 === 0) ? s * 0.55 : s * 0.24;
      var x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  Game.drawBadge = function (ctx, x, y, text, color) {
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(text), x, y);
  };

  Game.hitUI = function (x, y) {
    if (this.weaponMenuOpen) {
      for (var i = 0; i < this.weaponMenuRects.length; i++) {
        var m = this.weaponMenuRects[i];
        if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) return { type: 'weaponMenu', id: m.id };
      }
    }
    if (this.weaponBtnRect && x >= this.weaponBtnRect.x && x <= this.weaponBtnRect.x + this.weaponBtnRect.w && y >= this.weaponBtnRect.y && y <= this.weaponBtnRect.y + this.weaponBtnRect.h) {
      return { type: 'weaponToggle' };
    }
    return null;
  };

  Game.drawWeaponSelector = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    var items = [
      { key: 'cannon', label: '主炮', num: '1' },
      { key: 'mg', label: '机枪', num: '2' },
      { key: 'mine', label: '地雷', num: '3' },
      { key: 'strike', label: '空袭', num: '4' }
    ];
    var pad = Math.max(7, W * 0.011);
    var bw = Math.max(96, Math.min(150, W * 0.22));
    var bh = Math.max(34, Math.min(46, H * 0.075));
    var bx = W - this.sar - pad - bw;
    var by = this.sat + pad;
    this.weaponBtnRect = { x: bx, y: by, w: bw, h: bh };

    // 当前武器按钮（精致半透明 + 金边 + 投影）
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
    this.roundRect(ctx, bx, by, bw, bh, 10);
    var g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, 'rgba(42,116,172,0.70)'); g.addColorStop(1, 'rgba(14,62,102,0.82)');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,210,74,0.42)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(bx + 12, by + 1.5); ctx.lineTo(bx + bw - 12, by + 1.5); ctx.stroke();
    this.drawWeaponIcon(ctx, this.weapon, bx + bh * 0.5, by + bh * 0.5, bh * 0.52, '#ffd24a');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.max(13, bh * 0.34) + 'px sans-serif';
    ctx.fillText(this._wlabel(this.weapon), bx + bh + 4, by + bh * 0.5);
    // 向下箭头
    var ax = bx + bw - 15, ay = by + bh * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.moveTo(ax - 5, ay - 3); ctx.lineTo(ax + 5, ay - 3); ctx.lineTo(ax, ay + 4); ctx.closePath(); ctx.fill();

    this.weaponMenuRects = [];
    if (this.weaponMenuOpen) {
      var rowH = bh, gap = 5;
      var py = by + bh + gap;
      var ph = items.length * (rowH + gap) + gap;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
      this.roundRect(ctx, bx, py, bw, ph, 10);
      var mg = ctx.createLinearGradient(0, py, 0, py + ph);
      mg.addColorStop(0, 'rgba(34,108,162,0.82)'); mg.addColorStop(1, 'rgba(12,56,96,0.90)');
      ctx.fillStyle = mg; ctx.fill();
      ctx.restore();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,210,74,0.42)'; ctx.stroke();
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var ry = py + gap + i * (rowH + gap);
        var active = this.weapon === it.key;
        var rx = bx + gap, rw = bw - gap * 2;
        this.roundRect(ctx, rx, ry, rw, rowH, 8);
        ctx.fillStyle = active ? 'rgba(255,210,74,0.16)' : 'rgba(255,255,255,0.04)';
        ctx.fill();
        if (active) { ctx.strokeStyle = 'rgba(255,210,74,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
        this.drawWeaponIcon(ctx, it.key, rx + rowH * 0.5, ry + rowH * 0.5, rowH * 0.52, active ? '#ffd24a' : '#e8e8e8');
        ctx.fillStyle = active ? '#ffd24a' : '#fff';
        ctx.font = 'bold ' + Math.max(13, rowH * 0.34) + 'px sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(it.label, rx + rowH + 4, ry + rowH * 0.5);
        // 序号角标
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); ctx.arc(rx + rw - 14, ry + 13, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(it.num, rx + rw - 14, ry + 13);
        if (it.key === 'mine') this.drawBadge(ctx, rx + 13, ry + rowH - 13, this.mineCount, '#46c846');
        if (it.key === 'strike' && this.strikeCd > 0) {
          ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(11, rowH * 0.28) + 'px sans-serif';
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(Math.ceil(this.strikeCd / 60) + 's', rx + rw - 28, ry + rowH * 0.5);
        }
        this.weaponMenuRects.push({ x: rx, y: ry, w: rw, h: rowH, id: it.key });
      }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  };

  Game._wlabel = function (k) {
    return k === 'cannon' ? '主炮' : k === 'mg' ? '机枪' : k === 'mine' ? '地雷' : '空袭';
  };

  Game.drawItemIcon = function (ctx, id, cx, cy, s) {
    if (id === 'repair') {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, 0, 6.283); ctx.fillStyle = '#46c846'; ctx.fill();
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, s * 0.12); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.22, cy); ctx.lineTo(cx + s * 0.22, cy);
      ctx.moveTo(cx, cy - s * 0.22); ctx.lineTo(cx, cy + s * 0.22);
      ctx.stroke();
      ctx.restore();
    } else if (id === 'mine') this.drawWeaponIcon(ctx, 'mine', cx, cy, s, '#ffd24a');
    else if (id === 'cannon') this.drawWeaponIcon(ctx, 'cannon', cx, cy, s, '#ffd24a');
    else if (id === 'mg') this.drawWeaponIcon(ctx, 'mg', cx, cy, s, '#ffd24a');
  };

  Game._inRect = function (r) {
    return this.mouse.x >= r.x && this.mouse.x <= r.x + r.w && this.mouse.y >= r.y && this.mouse.y <= r.y + r.h;
  };

  Game.drawShop = function () {
    var ctx = this.ctx, W = this.W, H = this.H;
    // 暗色渐变蒙版（而非死黑）
    var ov = ctx.createLinearGradient(0, 0, 0, H);
    ov.addColorStop(0, 'rgba(6,18,32,0.74)'); ov.addColorStop(1, 'rgba(3,10,18,0.82)');
    ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);

    // 居中玻璃面板
    var sideM = Math.max(22, W * 0.05), topM = this.sat + Math.max(16, H * 0.035), botM = this.sab + Math.max(16, H * 0.035);
    var px = this.sal + sideM, pw = W - this.sal - this.sar - 2 * sideM, py = topM, ph = H - topM - botM;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    this.roundRect(ctx, px, py, pw, ph, 20);
    var pg = ctx.createLinearGradient(0, py, 0, py + ph);
    pg.addColorStop(0, 'rgba(38,112,168,0.55)'); pg.addColorStop(1, 'rgba(10,52,90,0.82)');
    ctx.fillStyle = pg; ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,210,74,0.42)'; this.roundRect(ctx, px, py, pw, ph, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px + 22, py + 2); ctx.lineTo(px + pw - 22, py + 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();

    var pad = Math.max(16, pw * 0.04);
    var innerX = px + pad, innerW = pw - 2 * pad;

    // 标题（金色渐变 + 微光）
    var titleFs = Math.min(30, H * 0.058);
    var title = this.shopNewLevel ? ('通过！进入 ' + BH.LEVELS[this.level].name) : '布防商店';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var ty = py + pad + titleFs * 0.62;
    var tg = ctx.createLinearGradient(0, ty - titleFs * 0.6, 0, ty + titleFs * 0.6);
    tg.addColorStop(0, '#fff4cc'); tg.addColorStop(0.5, '#ffd24a'); tg.addColorStop(1, '#e3a531');
    ctx.save(); ctx.shadowColor = 'rgba(255,210,74,0.5)'; ctx.shadowBlur = 14;
    ctx.fillStyle = tg; ctx.font = 'bold ' + titleFs + 'px sans-serif';
    ctx.fillText(title, W / 2, ty); ctx.restore();

    // 金币 / 基地 状态胶囊
    var chipH = Math.max(26, H * 0.04), chipY = ty + titleFs * 0.7 + chipH * 0.5 + 6;
    // 与 _drawChip 内绘制文字使用同一字号，保证测量宽度与实际渲染一致
    ctx.font = 'bold ' + Math.min(15, chipH * 0.52) + 'px sans-serif';
    var gTxt = '金币 ' + this.gold, bTxt = '基地 ' + this.baseHp + '/' + this.baseMax;
    var chipPadR = 14; // 文字右侧内边距，避免贴边溢出
    var gW = chipH + chipPadR + ctx.measureText(gTxt).width;
    var bW = chipH + chipPadR + ctx.measureText(bTxt).width;
    var chipGap = 14, totalChips = gW + bW + chipGap;
    var cx0 = W / 2 - totalChips / 2;
    this._drawChip(ctx, cx0, chipY - chipH / 2, gW, chipH, 'coin', gTxt);
    this._drawChip(ctx, cx0 + gW + chipGap, chipY - chipH / 2, bW, chipH, 'shield', bTxt, this.baseHp / this.baseMax);

    // 分隔线
    var divY = chipY + chipH * 0.5 + 12;
    ctx.beginPath(); ctx.moveTo(innerX, divY); ctx.lineTo(innerX + innerW, divY);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.stroke();

    // 升级项（2 列网格）
    var items = [
      { id: 'repair', label: '维修基地', sub: '恢复 +25', cost: 30, can: this.gold >= 30 && this.baseHp < this.baseMax },
      { id: 'mine', label: '补充地雷', sub: '地雷 +3', cost: 20, can: this.gold >= 20 },
      { id: 'cannon', label: '强化主炮', sub: '伤害 +4', cost: 50, can: this.gold >= 50 },
      { id: 'mg', label: '机枪射速', sub: '射速提升', cost: 40, can: this.gold >= 40 }
    ];
    var cols = 2, rows = 2, gap = Math.max(12, H * 0.018);
    var cardW = (innerW - (cols - 1) * gap) / cols;
    var startH = Math.min(54, H * 0.08);
    var gridTop = divY + 14;
    var gridBottom = py + ph - pad - startH - gap - 6;
    var cardH = (gridBottom - gridTop - (rows - 1) * gap) / rows;

    this.shopRects = [];
    for (var i = 0; i < items.length; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      var x = innerX + c * (cardW + gap), y = gridTop + r * (cardH + gap);
      var it = items[i];
      var hov = this._inRect({ x: x, y: y, w: cardW, h: cardH }) && it.can;
      // 卡片玻璃底
      ctx.save();
      if (hov) { ctx.shadowColor = 'rgba(255,210,74,0.35)'; ctx.shadowBlur = 16; }
      this.roundRect(ctx, x, y, cardW, cardH, 12);
      var cg = ctx.createLinearGradient(0, y, 0, y + cardH);
      if (it.can) { cg.addColorStop(0, 'rgba(255,255,255,0.14)'); cg.addColorStop(1, 'rgba(255,255,255,0.06)'); }
      else { cg.addColorStop(0, 'rgba(255,255,255,0.05)'); cg.addColorStop(1, 'rgba(255,255,255,0.02)'); }
      ctx.fillStyle = cg; ctx.fill();
      ctx.restore();
      ctx.lineWidth = hov ? 1.6 : 1.2;
      ctx.strokeStyle = it.can ? (hov ? 'rgba(255,210,74,0.85)' : 'rgba(255,210,74,0.40)') : 'rgba(255,255,255,0.10)';
      this.roundRect(ctx, x, y, cardW, cardH, 12); ctx.stroke();

      // 图标徽章
      var badgeR = Math.min(cardH * 0.30, 24);
      var bcx = x + badgeR + 14, bcy = y + cardH / 2;
      ctx.beginPath(); ctx.arc(bcx, bcy, badgeR, 0, 6.283); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
      ctx.save(); if (!it.can) ctx.globalAlpha = 0.45;
      this.drawItemIcon(ctx, it.id, bcx, bcy, badgeR * 1.5); ctx.restore();

      // 文案
      var tx = bcx + badgeR + 12;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = it.can ? '#fff' : '#8b94a3'; ctx.font = 'bold ' + Math.min(17, cardH * 0.26) + 'px sans-serif';
      ctx.fillText(it.label, tx, y + cardH * 0.38);
      ctx.fillStyle = it.can ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.40)';
      ctx.font = Math.min(13, cardH * 0.19) + 'px sans-serif';
      ctx.fillText(it.sub, tx, y + cardH * 0.66);
      // 价格标签（右上角）
      if (it.can) {
        var pr = 9;
        ctx.beginPath(); ctx.arc(x + cardW - 16, y + 16, pr, 0, 6.283); ctx.fillStyle = '#ffd24a'; ctx.fill();
        ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#8a5a00'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('¥', x + cardW - 16, y + 16 + 1);
        ctx.fillStyle = '#ffd24a'; ctx.font = 'bold ' + Math.min(15, cardH * 0.24) + 'px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText('' + it.cost, x + cardW - 30, y + 16 + 1);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = Math.min(13, cardH * 0.19) + 'px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        var noTxt = (it.id === 'repair' && this.baseHp >= this.baseMax) ? '无需维修' : '金币不足';
        ctx.fillText(noTxt, x + cardW - 14, y + 16 + 1);
      }
      this.shopRects.push({ x: x, y: y, w: cardW, h: cardH, id: it.id, cost: it.cost, can: it.can });
    }

    // 开始下一波（绿色金边主按钮）
    var sx = innerX, sy = py + ph - pad - startH, sw = innerW, sh = startH;
    var shov = this._inRect({ x: sx, y: sy, w: sw, h: sh });
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = shov ? 22 : 14; ctx.shadowOffsetY = 6;
    this.roundRect(ctx, sx, sy, sw, sh, 14);
    var sg = ctx.createLinearGradient(0, sy, 0, sy + sh);
    sg.addColorStop(0, shov ? '#54c96a' : '#3fae57'); sg.addColorStop(1, '#1f7a37');
    ctx.fillStyle = sg; ctx.fill(); ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,210,74,0.55)'; this.roundRect(ctx, sx, sy, sw, sh, 14); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.min(20, sh * 0.42) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶  开始下一波', W / 2, sy + sh / 2 + 1);
    this.shopRects.push({ x: sx, y: sy, w: sw, h: sh, id: 'start', cost: 0, can: true });

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  };

  Game._drawChip = function (ctx, x, y, w, h, kind, text, ratio) {
    this.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,210,74,0.35)'; ctx.stroke();
    var cyc = y + h / 2;
    if (kind === 'coin') {
      ctx.beginPath(); ctx.arc(x + h / 2, cyc, h * 0.30, 0, 6.283); ctx.fillStyle = '#ffd24a'; ctx.fill();
      ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#8a5a00'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('¥', x + h / 2, cyc + 1);
    } else {
      var col = (ratio == null || ratio > 0.3) ? '#46c846' : '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(x + h / 2, cyc - h * 0.32); ctx.lineTo(x + h / 2 + h * 0.26, cyc - h * 0.12);
      ctx.lineTo(x + h / 2 + h * 0.26, cyc + h * 0.06); ctx.quadraticCurveTo(x + h / 2 + h * 0.26, cyc + h * 0.28, x + h / 2, cyc + h * 0.32);
      ctx.quadraticCurveTo(x + h / 2 - h * 0.26, cyc + h * 0.28, x + h / 2 - h * 0.26, cyc + h * 0.06);
      ctx.lineTo(x + h / 2 - h * 0.26, cyc - h * 0.12); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.min(15, h * 0.52) + 'px sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + h + 2, cyc);
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
