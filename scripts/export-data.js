// export-data.js — js/data.js のバランス値を balance/*.csv に書き出す(Excel で開けるよう UTF-8 BOM 付き)
// 使い方: node scripts/export-data.js
// ※ 下の FORMULA は world.js / core.js の計算式を写したもの。ゲーム側を変更したらここも合わせる。
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8') + '\nthis.DATA = DATA;', ctx);
const D = ctx.DATA;

const FORMULA = {
  xpFor: l => Math.floor(4 + l * 2.6 + Math.pow(l, 1.72)),              // world.js xpFor
  lvK: (kind, lv) => 1 + D.enemyLevel[kind] * (lv - 1),                 // world.js lvK(混沌なし)
};

const outDir = path.join(root, 'balance');
fs.mkdirSync(outDir, { recursive: true });
const esc = v => (v === undefined || v === null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
const r2 = v => Math.round(v * 100) / 100;
function write(name, header, rows) {
  const csv = '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n') + '\r\n';
  fs.writeFileSync(path.join(outDir, name), csv);
  console.log(`balance/${name} (${rows.length} 行)`);
}

// ---------- 武器(Lv1〜5 + 進化) ----------
const statKeys = Object.keys(D.statLabels);
// 参考DPS: 単体に全弾命中・補正なしの概算(ブレードは接触判定依存のため空欄)
function refDps(k, s) {
  if (k === 'aura') return s.dmg / s.tick;
  if (k === 'blizzard') return s.dmg * 4 * s.dur / s.cd;
  if (k === 'bhole') return s.dmg * 10 * s.dur / s.cd;
  if (k === 'fire') return (s.dmg * (s.count || 1) + s.burn * 3) / s.cd;
  if (s.cd) return s.dmg * (s.count || s.strikes || 1) / s.cd;
  return '';
}
const wRows = [];
for (const k in D.weapons) {
  const w = D.weapons[k];
  const stages = [...w.lv.map((s, i) => ['Lv' + (i + 1), s]), ['EVO', w.evo.st]];
  for (const [st, s] of stages) {
    const dps = refDps(k, s);
    wRows.push([k, st === 'EVO' ? w.evo.name : w.name, st, ...statKeys.map(sk => s[sk]), dps === '' ? '' : r2(dps),
      st === 'EVO' ? w.evo.need : '', st === 'EVO' ? w.evo.desc : w.desc]);
  }
}
write('weapons.csv', ['ID', '名称', '段階', ...statKeys.map(k => D.statLabels[k]), '参考DPS', '進化素材', '説明'], wRows);

// ---------- パッシブ / アーティファクト / 永続強化 ----------
write('passives.csv', ['ID', '名称', '最大Lv', '効果(1Lvあたり)', '進化対象武器'],
  Object.entries(D.passives).map(([k, p]) => [k, p.name, p.max, p.desc, Object.keys(D.weapons).filter(w => D.weapons[w].evo.need === k).join(' ')]));
write('artifacts.csv', ['ID', '名称', '効果'], Object.entries(D.artifacts).map(([k, a]) => [k, a.name, a.desc]));
const maxMeta = Math.max(...Object.values(D.meta).map(m => m.costs.length));
write('meta.csv', ['ID', '名称', '効果(1Lvあたり)', '最大Lv', ...Array.from({ length: maxMeta }, (_, i) => `Lv${i + 1}費用`), '累計費用'],
  Object.entries(D.meta).map(([k, m]) => [k, m.name, m.desc, m.costs.length, ...Array.from({ length: maxMeta }, (_, i) => m.costs[i] ?? ''), m.costs.reduce((a, b) => a + b, 0)]));

// ---------- 敵(Lv別) ----------
// 敵Lvは interval 秒ごとに +1(ボス出現中は停止)。目安時刻はボス停止時間を含まない
const EL = D.enemyLevel, lvs = [1, 5, 10, 15, 20, 30];
const spdK = lv => Math.min(EL.spdMax, FORMULA.lvK('spd', lv));
write('enemies.csv', ['ID', 'HP', '速度', '攻撃力', '経験値', '半径', 'AI', '特殊', ...lvs.map(l => `HP@Lv${l}`), ...lvs.map(l => `攻撃@Lv${l}`), `エリートHP@Lv${lvs.at(-1)}`],
  Object.entries(D.enemies).map(([k, e]) => [k, e.hp, e.spd, e.dmg, e.xp, e.r, e.ai,
    [e.split && '分裂→' + e.split, e.shot && `射撃(CD${e.shot.cd}s/弾速${e.shot.spd}/威力${e.shot.dmg})`, e.ghost && 'すり抜け', e.kbRes && 'ノックバック耐性' + e.kbRes].filter(Boolean).join(' / '),
    ...lvs.map(l => Math.round(e.hp * FORMULA.lvK('hp', l))), ...lvs.map(l => r2(e.dmg * FORMULA.lvK('dmg', l))), Math.round(e.hp * FORMULA.lvK('hp', lvs.at(-1)) * EL.elite)]));

write('enemy_level.csv', ['敵Lv', '到達目安(ボス時間除く)', 'HP倍率', '攻撃倍率', '速度倍率', '経験値倍率', 'ボスHP倍率'],
  Array.from({ length: 40 }, (_, i) => { const l = i + 1, t = (l - 1) * EL.interval;
    return [l, `${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}`, r2(FORMULA.lvK('hp', l)), r2(FORMULA.lvK('dmg', l)), r2(spdK(l)), r2(FORMULA.lvK('xp', l)), r2(FORMULA.lvK('boss', l))]; }));

// ボス出現時の Lv 目安: 出現時刻までの経過から、それ以前のボス戦分は停止しないものとして概算
const bossAt = Object.fromEntries(D.schedule.filter(s => s.boss).map(s => [s.boss, s.t]));
const lvAt = t => 1 + Math.floor(t / EL.interval);
write('bosses.csv', ['ID', '名称', '基本HP', '出現(秒)', '出現時Lv目安', '出現時HP目安', '速度', '攻撃力', '半径', 'BGM'],
  Object.entries(D.bosses).map(([k, b]) => { const t = bossAt[k]; const l = t !== undefined ? lvAt(t) : '';
    return [k, b.name, b.hp, t ?? '', l, l ? Math.round(b.hp * FORMULA.lvK('boss', l)) : '', b.spd, b.dmg, b.r, b.music]; }));

// ---------- 出現スケジュール ----------
write('schedule.csv', ['時刻(秒)', '時刻', '種別', '出現敵', '出現間隔(秒)', '毎秒出現数', '最大同時数'],
  D.schedule.map(s => [s.t, `${(s.t / 60) | 0}:${String(s.t % 60).padStart(2, '0')}`, s.boss ? 'ボス' : s.event ? 'イベント' : '通常',
    s.boss || s.event || s.types.join(' '), s.interval ?? '', s.interval ? r2(1 / s.interval) : '', s.max ?? '']));

// ---------- 経験値テーブル ----------
let cum = 0;
write('xp.csv', ['レベル', '次Lvまでの必要経験値', '累計経験値'],
  Array.from({ length: 60 }, (_, i) => { const need = FORMULA.xpFor(i + 1); cum += need; return [i + 1, need, cum]; }));

// ---------- その他 ----------
write('player.csv', ['項目', '値'], [['最大HP', D.player.hp], ['移動速度', D.player.speed], ['吸引範囲', D.player.magnet],
  ['ダッシュCD(秒)', D.player.dashCd], ['ダッシュ時間(秒)', D.player.dashTime], ['ダッシュ速度', D.player.dashSpeed]]);
