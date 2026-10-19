/* 敌人基础数值与关卡配置 */
window.BH = window.BH || {};

/* 各兵种默认属性：hp 血量 / speed 左移速度(px/帧) / r 碰撞半径 / damage 突破伤害 / reward 击杀奖励 / lane 行进路线 */
BH.ENEMY_DEF = {
  soldier: { hp: 8,  speed: 0.9, r: 12, damage: 8,  reward: 4,  lane: 'ground' },
  tank:    { hp: 45, speed: 0.4, r: 24, damage: 25, reward: 16, lane: 'ground' },
  boat:    { hp: 22, speed: 0.6, r: 30, damage: 14, reward: 10, lane: 'sea' },
  plane:   { hp: 10, speed: 1.7, r: 16, damage: 12, reward: 8,  lane: 'sky' }
};

/* 关卡：每关包含若干 wave，每个 wave 由若干敌人编组构成（count 数量 / gap 出场间隔帧） */
BH.LEVELS = [
  {
    name: '第一关 · 滩头前哨',
    baseHp: 100,
    waves: [
      { enemies: [ { type: 'soldier', count: 6, gap: 55 }, { type: 'boat', count: 2, gap: 120 } ] },
      { enemies: [ { type: 'soldier', count: 8, gap: 45 }, { type: 'tank', count: 2, gap: 200 } ] }
    ]
  },
  {
    name: '第二关 · 海空夹击',
    baseHp: 100,
    waves: [
      { enemies: [ { type: 'soldier', count: 8, gap: 40 }, { type: 'plane', count: 3, gap: 90 } ] },
      { enemies: [ { type: 'boat', count: 4, gap: 100 }, { type: 'tank', count: 3, gap: 180 } ] },
      { enemies: [ { type: 'soldier', count: 10, gap: 35 }, { type: 'plane', count: 4, gap: 80 }, { type: 'tank', count: 2, gap: 220 } ] }
    ]
  },
  {
    name: '第三关 · 全面强攻',
    baseHp: 120,
    waves: [
      { enemies: [ { type: 'soldier', count: 12, gap: 30 }, { type: 'boat', count: 5, gap: 90 } ] },
      { enemies: [ { type: 'plane', count: 6, gap: 70 }, { type: 'tank', count: 4, gap: 160 } ] },
      { enemies: [ { type: 'soldier', count: 14, gap: 28 }, { type: 'boat', count: 5, gap: 85 }, { type: 'plane', count: 5, gap: 75 } ] },
      { enemies: [ { type: 'tank', count: 6, gap: 150 }, { type: 'soldier', count: 12, gap: 30 } ] }
    ]
  }
];
