/* 游戏实体：玩家炮台(双武器) / 炮弹 / 敌人 / 地雷 / 爆炸特效（ES5，兼容 Chrome 69） */
(function (BH) {
  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  /* ---------- 玩家炮台 ---------- */
  function Player(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 4;
    this.length = 48;
    this.cannonCd = 0; this.cannonRate = 14; this.cannonDmg = 12;
    this.mgCd = 0; this.mgRate = 4; this.mgDmg = 5;
  }
  Player.prototype.aim = function (mx, my) {
    this.angle = Math.atan2(my - this.y, mx - this.x);
  };
  Player.prototype.canCannon = function () { return this.cannonCd <= 0; };
  Player.prototype.canMg = function () { return this.mgCd <= 0; };
  Player.prototype.update = function () {
    if (this.cannonCd > 0) this.cannonCd--;
    if (this.mgCd > 0) this.mgCd--;
  };
  Player.prototype.cannon = function () {
    this.cannonCd = this.cannonRate;
    var sx = this.x + Math.cos(this.angle) * this.length;
    var sy = this.y + Math.sin(this.angle) * this.length;
    return new Bullet(sx, sy, Math.cos(this.angle), Math.sin(this.angle), 11, this.cannonDmg, false);
  };
  Player.prototype.mg = function () {
    this.mgCd = this.mgRate;
    var sx = this.x + Math.cos(this.angle) * this.length;
    var sy = this.y + Math.sin(this.angle) * this.length;
    return new Bullet(sx, sy, Math.cos(this.angle), Math.sin(this.angle), 18, this.mgDmg, true);
  };
  Player.prototype.draw = function (ctx) {
    ctx.fillStyle = '#5a5a5a';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 28, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.fillRect(this.x - 28, this.y, 56, 20);
    ctx.fillStyle = '#3d3d3d';
    ctx.fillRect(this.x - 34, this.y + 16, 68, 10);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(0, -6, this.length, 12);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(this.length - 6, -7, 6, 14);
    ctx.restore();
    ctx.fillStyle = '#777';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 10, 0, 2 * Math.PI);
    ctx.fill();
  };

  /* ---------- 炮弹（line=true 为机枪直线弹，无重力） ---------- */
  function Bullet(x, y, dx, dy, speed, damage, line) {
    this.x = x; this.y = y;
    this.vx = dx * speed; this.vy = dy * speed;
    this.r = line ? 3 : 4;
    this.damage = damage;
    this.line = line;
    this.dead = false;
    this.life = line ? 130 : 240;
  }
  Bullet.prototype.update = function (g) {
    if (!this.line) this.vy += 0.22;
    this.x += this.vx; this.y += this.vy;
    this.life--;
    if (this.y > g.groundY + 60 || this.x > g.W + 60 || this.x < -60 || this.life <= 0) this.dead = true;
  };
  Bullet.prototype.draw = function (ctx) {
    if (this.line) {
      ctx.strokeStyle = '#ffec8b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 1.5, this.y - this.vy * 1.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = 'rgba(255,210,80,0.6)';
      ctx.beginPath(); ctx.arc(this.x - this.vx * 0.6, this.y - this.vy * 0.6, this.r * 0.6, 0, 2 * Math.PI); ctx.fill();
    }
  };

  /* ---------- 敌人 ---------- */
  function Enemy(type, opt) {
    var def = BH.ENEMY_DEF[type];
    this.type = type;
    this.x = opt.x; this.y = opt.y;
    this.speed = def.speed;
    this.r = def.r;
    this.hp = def.hp; this.maxhp = def.hp;
    this.damage = def.damage; this.reward = def.reward;
    this.lane = def.lane;
    this.dead = false; this.t = 0;
  }
  Enemy.prototype.update = function (g) {
    this.t++;
    this.x -= this.speed;
    if (this.lane === 'sky') this.y += Math.sin(this.t * 0.05) * 0.8;
    if (this.x < g.baseX) {
      this.dead = true;
      g.damageBase(this.damage);
    }
  };
  Enemy.prototype.hit = function (d) {
    this.hp -= d;
    if (this.hp <= 0) { this.dead = true; return true; }
    return false;
  };
  Enemy.prototype.draw = function (ctx, img) {
    var im = img[this.type];
    if (im) {
      var w = this.r * 2.6, h = this.r * 2.6;
      ctx.drawImage(im, this.x - w / 2, this.y - h / 2, w, h);
    } else {
      ctx.fillStyle = '#c33';
      ctx.fillRect(this.x - this.r, this.y - this.r, this.r * 2, this.r * 2);
    }
    if (this.hp < this.maxhp) {
      var bw = this.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.x - this.r, this.y - this.r - 9, bw, 4);
      ctx.fillStyle = '#5cd65c';
      ctx.fillRect(this.x - this.r, this.y - this.r - 9, bw * (this.hp / this.maxhp), 4);
    }
  };

  /* ---------- 地雷 ---------- */
  function Mine(x, y) {
    this.x = x; this.y = y;
    this.r = 22; this.damage = 30;
    this.armed = 30; this.dead = false;
  }
  Mine.prototype.update = function (g) {
    if (this.armed > 0) { this.armed--; return; }
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (e.dead || e.lane !== 'ground') continue;
      if (dist2(this.x, this.y, e.x, e.y) <= (this.r + e.r) * (this.r + e.r)) {
        this.explode(g); break;
      }
    }
  };
  Mine.prototype.explode = function (g) {
    this.dead = true;
    g.effects.push(new BH.Effect(this.x, this.y, 2));
    if (BH.Sound) BH.Sound.explosion();
    for (var i = 0; i < g.enemies.length; i++) {
      var e = g.enemies[i];
      if (e.dead) continue;
      if (dist2(this.x, this.y, e.x, e.y) <= (65 + e.r) * (65 + e.r)) {
        if (e.hit(this.damage)) { g.score += 10; g.gold += e.reward; }
      }
    }
  };
  Mine.prototype.draw = function (ctx) {
    if (this.armed > 0) return;
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(this.x, this.y, 6, 0, 6.28); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, 6.28); ctx.stroke();
  };

  /* ---------- 爆炸特效（scale 控制范围） ---------- */
  function Effect(x, y, scale) {
    this.x = x; this.y = y; this.scale = scale || 1;
    this.parts = [];
    var n = 12 + Math.floor(8 * this.scale);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, s = (1 + Math.random() * 3.5) * this.scale;
      this.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 18 + Math.random() * 16 });
    }
    this.dead = false;
  }
  Effect.prototype.update = function () {
    var alive = false;
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      if (p.life > 0) alive = true;
    }
    this.dead = !alive;
  };
  Effect.prototype.draw = function (ctx) {
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      if (p.life <= 0) continue;
      var k = p.life / 34;
      ctx.fillStyle = 'rgba(255,' + Math.floor(120 + p.life) + ',40,' + k + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.2 * this.scale, 0, 6.28); ctx.fill();
    }
  };

  BH.Player = Player;
  BH.Bullet = Bullet;
  BH.Enemy = Enemy;
  BH.Mine = Mine;
  BH.Effect = Effect;
})(window.BH);
