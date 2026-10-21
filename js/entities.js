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
    this.recoil = 0;
  }
  Player.prototype.aim = function (mx, my) {
    this.angle = Math.atan2(my - this.y, mx - this.x);
  };
  Player.prototype.canCannon = function () { return this.cannonCd <= 0; };
  Player.prototype.canMg = function () { return this.mgCd <= 0; };
  Player.prototype.update = function () {
    if (this.cannonCd > 0) this.cannonCd--;
    if (this.mgCd > 0) this.mgCd--;
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - 0.8);
  };
  Player.prototype.cannon = function () {
    this.cannonCd = this.cannonRate;
    this.recoil = 8;
    var sx = this.x + Math.cos(this.angle) * this.length;
    var sy = this.y + Math.sin(this.angle) * this.length;
    return new Bullet(sx, sy, Math.cos(this.angle), Math.sin(this.angle), 11, this.cannonDmg, false);
  };
  Player.prototype.mg = function () {
    this.mgCd = this.mgRate;
    this.recoil = 3;
    var sx = this.x + Math.cos(this.angle) * this.length;
    var sy = this.y + Math.sin(this.angle) * this.length;
    return new Bullet(sx, sy, Math.cos(this.angle), Math.sin(this.angle), 18, this.mgDmg, true);
  };
  Player.prototype.draw = function (ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // 投影
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 22, 32, 9, 0, 0, 6.283); ctx.fill();
    // 混凝土工事底座
    var bg = ctx.createLinearGradient(0, -26, 0, 24);
    bg.addColorStop(0, '#8a8f97'); bg.addColorStop(0.5, '#62666d'); bg.addColorStop(1, '#34383d');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(0, 3, 27, Math.PI, 2 * Math.PI); ctx.fill();
    ctx.fillRect(-27, 3, 54, 19);
    // 砖缝阴影
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-12, 4); ctx.lineTo(-12, 21);
    ctx.moveTo(8, 4); ctx.lineTo(8, 21);
    ctx.moveTo(-27, 13); ctx.lineTo(27, 13);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 3, 27, Math.PI, 2 * Math.PI); ctx.stroke();
    ctx.strokeRect(-27, 3, 54, 19);
    // 顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.arc(0, 3, 27, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(-14, 3); ctx.closePath(); ctx.fill();
    // 旋转炮塔 + 炮管
    ctx.rotate(this.angle);
    ctx.translate(-this.recoil * 0.7, 0);
    // 锥形炮管渐变
    var bgr = ctx.createLinearGradient(0, -7, this.length, 7);
    bgr.addColorStop(0, '#4c5057'); bgr.addColorStop(0.5, '#838891'); bgr.addColorStop(1, '#2f3236');
    ctx.fillStyle = bgr;
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(this.length - 10, -7);
    ctx.lineTo(this.length, 0); ctx.lineTo(this.length - 10, 7);
    ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    // 炮口制退器
    ctx.fillStyle = '#23262b';
    ctx.fillRect(this.length - 12, -5, 12, 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(this.length - 12, -5, 12, 10);
    // 炮管高光脊
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, -5.5, this.length - 12, 2.5);
    // 炮塔圆顶
    var tg = ctx.createRadialGradient(-4, -6, 3, 0, 0, 20);
    tg.addColorStop(0, '#9aa0a8'); tg.addColorStop(1, '#4a4e54');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI, 2 * Math.PI); ctx.fill();
    ctx.fillRect(-15, 0, 30, 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI, 2 * Math.PI); ctx.stroke();
    ctx.strokeRect(-15, 0, 30, 8);
    // 铆钉
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (var k = -10; k <= 10; k += 10) { ctx.beginPath(); ctx.arc(k, 5, 1.4, 0, 6.283); ctx.fill(); }
    // 炮塔高光
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(0, 0, 15, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(-12, -2); ctx.closePath(); ctx.fill();
    // 炮口闪光（随开火后坐衰减）
    if (this.recoil > 0.5) {
      var fl = this.recoil / 8;
      var mx = this.length + 2, my = 0;
      var fgr = ctx.createRadialGradient(mx, my, 0, mx, my, this.recoil * 1.6 + 4);
      fgr.addColorStop(0, 'rgba(255,255,225,' + (0.9 * fl) + ')');
      fgr.addColorStop(0.5, 'rgba(255,200,80,' + (0.7 * fl) + ')');
      fgr.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = fgr;
      ctx.beginPath(); ctx.arc(mx, my, this.recoil * 1.6 + 4, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,235,160,' + (0.85 * fl) + ')'; ctx.lineWidth = 2;
      for (var b = 0; b < 6; b++) {
        var ba = b * Math.PI / 3 + 0.3;
        ctx.beginPath(); ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(ba) * (this.recoil * 1.8 + 6), my + Math.sin(ba) * (this.recoil * 1.8 + 6));
        ctx.stroke();
      }
    }
    ctx.restore();
    // 旋转轴帽（同心金属圆）
    var ag = ctx.createRadialGradient(this.x - 3, this.y - 3, 1, this.x, this.y, 10);
    ag.addColorStop(0, '#c4cad2'); ag.addColorStop(1, '#2b2e33');
    ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, 6.283); ctx.fillStyle = ag; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, 6.283); ctx.fillStyle = '#aeb4bc'; ctx.fill();
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
  Enemy.prototype.draw = function (ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // 行进/待机 微摆动，让精灵更生动
    var s = this.t;
    if (this.type === 'plane') {
      ctx.rotate(Math.sin(s * 0.07) * 0.03);
    } else if (this.type === 'boat') {
      ctx.rotate(Math.sin(s * 0.05) * 0.045);
    } else if (this.type === 'tank') {
      ctx.translate(0, Math.sin(s * 0.16) * 0.6);
    } else {
      ctx.translate(0, Math.abs(Math.sin(s * 0.22)) * this.r * 0.07);
    }
    if (this.type === 'boat') this._boat(ctx);
    else if (this.type === 'tank') this._tank(ctx);
    else if (this.type === 'plane') this._plane(ctx);
    else this._soldier(ctx);
    ctx.restore();
    if (this.hp < this.maxhp) {
      var bw = this.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(this.x - this.r, this.y - this.r - 12, bw, 4);
      ctx.fillStyle = '#5cd65c';
      ctx.fillRect(this.x - this.r, this.y - this.r - 12, bw * (this.hp / this.maxhp), 4);
    }
  };

  function rr(ctx, x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  Enemy.prototype._soldier = function (ctx) {
    var r = this.r;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 0.9, r * 0.3, 0, 0, 6.283); ctx.fill();
    // 腿
    ctx.fillStyle = '#39451f';
    ctx.fillRect(-r * 0.45, r * 0.1, r * 0.32, r * 0.85);
    ctx.fillRect(r * 0.12, r * 0.1, r * 0.32, r * 0.85);
    // 躯干（迷彩渐变 + 斑点）
    var g = ctx.createLinearGradient(-r * 0.6, -r * 0.4, r * 0.6, r * 0.8);
    g.addColorStop(0, '#86a653'); g.addColorStop(0.5, '#6d8a3d'); g.addColorStop(1, '#4a632a');
    ctx.fillStyle = g;
    rr(ctx, -r * 0.6, -r * 0.55, r * 1.2, r * 0.75, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(40,60,20,0.5)';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.2, r * 0.16, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.25, r * 0.1, r * 0.13, 0, 6.283); ctx.fill();
    // 背带/弹匣
    ctx.fillStyle = '#2f3a1a';
    ctx.fillRect(-r * 0.1, -r * 0.5, r * 0.16, r * 0.7);
    // 头盔
    var hg = ctx.createLinearGradient(0, -r, 0, -r * 0.3);
    hg.addColorStop(0, '#6f8a3e'); hg.addColorStop(1, '#45602a');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, -r * 0.62, r * 0.55, Math.PI, 2 * Math.PI); ctx.fill();
    ctx.fillRect(-r * 0.55, -r * 0.62, r * 1.1, r * 0.16);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-r * 0.55, -r * 0.5, r * 1.1, r * 0.05);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(0, -r * 0.62, r * 0.55, Math.PI * 1.1, Math.PI * 1.9); ctx.lineTo(-r * 0.3, -r * 0.62); ctx.closePath(); ctx.fill();
    // 脸（阴影）
    ctx.fillStyle = '#caa37a';
    ctx.beginPath(); ctx.arc(0, -r * 0.32, r * 0.22, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(r * 0.05, -r * 0.32, r * 0.22, -0.6, 0.6); ctx.fill();
    // 朝左步枪
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(-r * 1.6, -r * 0.35, r * 1.2, r * 0.14);
    ctx.fillRect(-r * 1.5, -r * 0.35, r * 0.16, r * 0.45);
    ctx.fillStyle = '#444';
    ctx.fillRect(-r * 0.5, -r * 0.4, r * 0.18, r * 0.1);
    // 手
    ctx.fillStyle = '#caa37a';
    ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.25, r * 0.12, 0, 6.283); ctx.fill();
  };

  Enemy.prototype._tank = function (ctx) {
    var r = this.r;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 1.2, r * 0.28, 0, 0, 6.283); ctx.fill();
    // 履带
    ctx.fillStyle = '#1a1c1f';
    rr(ctx, -r * 1.05, r * 0.2, r * 2.1, r * 0.62, r * 0.28); ctx.fill();
    // 负重轮
    for (var w = -r * 0.7; w <= r * 0.7; w += r * 0.45) {
      ctx.fillStyle = '#3a3d42';
      ctx.beginPath(); ctx.arc(w, r * 0.5, r * 0.18, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#23262b';
      ctx.beginPath(); ctx.arc(w, r * 0.5, r * 0.07, 0, 6.283); ctx.fill();
    }
    // 车体（多层橄榄绿）
    var g = ctx.createLinearGradient(0, -r * 0.25, 0, r * 0.3);
    g.addColorStop(0, '#94a85c'); g.addColorStop(0.5, '#6f8440'); g.addColorStop(1, '#46582a');
    ctx.fillStyle = g;
    rr(ctx, -r, -r * 0.1, r * 2, r * 0.5, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    // 上部斜面高光
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    rr(ctx, -r * 0.95, -r * 0.06, r * 1.9, r * 0.12, 3); ctx.fill();
    // 侧裙板线
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-r * 0.9, r * 0.18); ctx.lineTo(r * 0.9, r * 0.18); ctx.stroke();
    // 炮塔
    var tg = ctx.createRadialGradient(-r * 0.2, -r * 0.25, 2, 0, -r * 0.1, r * 0.55);
    tg.addColorStop(0, '#9aa85f'); tg.addColorStop(1, '#566b2e');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.ellipse(0, -r * 0.12, r * 0.55, r * 0.42, 0, Math.PI, 2 * Math.PI); ctx.fill();
    ctx.fillRect(-r * 0.55, -r * 0.12, r * 1.1, r * 0.16);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
    // 舱盖
    ctx.fillStyle = '#3a4522';
    ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.18, r * 0.16, 0, 6.283); ctx.fill();
    // 观察镜
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.15, r * 0.08, 0, 6.283); ctx.fill();
    // 朝左炮管（锥形 + 制退器）
    ctx.fillStyle = '#3f4a24';
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.18); ctx.lineTo(-r * 1.5, -r * 0.22);
    ctx.lineTo(-r * 1.6, -r * 0.12); ctx.lineTo(-r * 1.5, -r * 0.02);
    ctx.lineTo(-r * 0.5, -r * 0.02); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 1.15, -r * 0.24); ctx.lineTo(-r * 1.15, r * 0.02);
    ctx.moveTo(-r * 1.32, -r * 0.24); ctx.lineTo(-r * 1.32, r * 0.02);
    ctx.stroke();
    // 炮管高光
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-r * 1.5, -r * 0.2, r * 1.0, r * 0.05);
  };

  Enemy.prototype._boat = function (ctx) {
    var r = this.r;
    // 海面投影 + 尾迹
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(0, r * 0.62, r * 1.3, r * 0.32, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(r * 1.3, r * 0.55, r * 0.55, r * 0.12, 0, 0, 6.283); ctx.fill();
    // 船体（多层钢灰渐变）
    var g = ctx.createLinearGradient(0, -r * 0.25, 0, r * 0.6);
    g.addColorStop(0, '#aab2bd'); g.addColorStop(0.45, '#7d8691'); g.addColorStop(1, '#3f474f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r * 1.25, -r * 0.1);
    ctx.lineTo(r * 1.15, -r * 0.1);
    ctx.lineTo(r * 0.92, r * 0.5);
    ctx.lineTo(-r * 0.95, r * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    // 吃水线高光
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 1.1, r * 0.1); ctx.lineTo(r * 1.0, r * 0.1); ctx.stroke();
    // 顶部高光带
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(-r * 1.15, -r * 0.1); ctx.lineTo(r * 1.05, -r * 0.1);
    ctx.lineTo(r * 1.0, r * 0.02); ctx.lineTo(-r * 1.1, r * 0.02);
    ctx.closePath(); ctx.fill();
    // 上层建筑（舰桥）
    var bg = ctx.createLinearGradient(0, -r * 0.85, 0, -r * 0.1);
    bg.addColorStop(0, '#9aa2ac'); bg.addColorStop(1, '#5f6770');
    ctx.fillStyle = bg;
    rr(ctx, -r * 0.45, -r * 0.85, r * 0.85, r * 0.7, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    // 舷窗
    ctx.fillStyle = '#cfe6ff';
    for (var p = -r * 0.32; p <= r * 0.25; p += r * 0.2) {
      ctx.beginPath(); ctx.arc(p, -r * 0.45, r * 0.08, 0, 6.283); ctx.fill();
    }
    // 烟囱 + 烟雾
    ctx.fillStyle = '#4a525b';
    rr(ctx, r * 0.1, -r * 1.05, r * 0.28, r * 0.25, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath(); ctx.arc(r * 0.24, -r * 1.15, r * 0.12, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.34, -r * 1.28, r * 0.1, 0, 6.283); ctx.fill();
    // 雷达天线
    ctx.strokeStyle = '#8a929b'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-r * 0.15, -r * 0.85); ctx.lineTo(-r * 0.15, -r * 1.1); ctx.stroke();
    ctx.fillStyle = '#8a929b'; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 1.12, r * 0.05, 0, 6.283); ctx.fill();
    // 朝左主炮（炮塔 + 炮管）
    ctx.fillStyle = '#5a636c';
    ctx.beginPath(); ctx.arc(-r * 0.6, -r * 0.12, r * 0.3, Math.PI, 2 * Math.PI); ctx.fill();
    ctx.fillRect(-r * 0.9, -r * 0.12, r * 0.6, r * 0.18);
    ctx.fillStyle = '#3f474f';
    ctx.fillRect(-r * 1.35, -r * 0.14, r * 0.55, r * 0.1);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-r * 1.3, -r * 0.13, r * 0.5, r * 0.03);
  };

  Enemy.prototype._plane = function (ctx) {
    var r = this.r;
    // 尾喷焰（多色径向，随帧闪烁）
    var flick = 0.6 + 0.4 * Math.abs(Math.sin(this.t * 0.6));
    var fg = ctx.createRadialGradient(r * 1.15, 0, 1, r * 0.9, 0, r * 0.5);
    fg.addColorStop(0, 'rgba(255,255,255,' + (0.9 * flick) + ')');
    fg.addColorStop(0.4, 'rgba(255,200,80,' + (0.8 * flick) + ')');
    fg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(r * 0.9, -r * 0.18); ctx.lineTo(r * 1.7, 0); ctx.lineTo(r * 0.9, r * 0.18); ctx.closePath(); ctx.fill();
    // 机身（银灰多层渐变）
    var g = ctx.createLinearGradient(0, -r * 0.4, 0, r * 0.4);
    g.addColorStop(0, '#f2f5f8'); g.addColorStop(0.5, '#c3cad3'); g.addColorStop(1, '#8b929d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r * 1.5, 0);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.32, r * 0.7, -r * 0.16);
    ctx.lineTo(r * 1.1, 0);
    ctx.lineTo(r * 0.7, r * 0.16);
    ctx.quadraticCurveTo(-r * 0.5, r * 0.32, -r * 1.5, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    // 座舱盖（蓝色玻璃）
    var cg = ctx.createRadialGradient(-r * 0.45, -r * 0.05, 1, -r * 0.4, 0, r * 0.3);
    cg.addColorStop(0, '#bfe6ff'); cg.addColorStop(1, '#2f7fb8');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.02, r * 0.28, r * 0.16, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    // 主翼（后掠）
    var wg = ctx.createLinearGradient(-r * 0.3, r * 0.1, r * 0.2, r * 0.95);
    wg.addColorStop(0, '#d8dee5'); wg.addColorStop(1, '#9aa1ad');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.05); ctx.lineTo(-r * 0.7, r * 0.85);
    ctx.lineTo(r * 0.2, r * 0.12); ctx.closePath(); ctx.fill();
    // 平尾
    ctx.beginPath();
    ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 1.0, -r * 0.45);
    ctx.lineTo(r * 0.8, 0); ctx.closePath(); ctx.fill();
    // 垂尾
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.05); ctx.lineTo(r * 0.95, -r * 0.45);
    ctx.lineTo(r * 0.7, -r * 0.05); ctx.closePath(); ctx.fill();
    // 翼尖挂载
    ctx.fillStyle = '#3aa0d8';
    ctx.beginPath(); ctx.arc(-r * 0.45, r * 0.55, r * 0.1, 0, 6.283); ctx.fill();
    // 机身高光脊
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(-r * 1.3, -r * 0.05); ctx.quadraticCurveTo(-r * 0.3, -r * 0.18, r * 0.7, -r * 0.08);
    ctx.lineTo(r * 0.7, 0); ctx.quadraticCurveTo(-r * 0.3, -r * 0.06, -r * 1.3, r * 0.02); ctx.closePath(); ctx.fill();
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
