// ===== 気候帯ミッションのお題 =====
// test には koppen.js が返すコード（例 'Cfa'）を渡して、当てはまれば true
export const ZONES = [
  { id: 'Af', name: '熱帯雨林気候',
    test: c => c === 'Af',
    hint: '一年中ずっと高温（どの月も18℃以上）で、毎月たっぷり雨が降る（最も少ない月でも60mm以上）' },
  { id: 'Aw', name: 'サバナ気候',
    test: c => c === 'Aw',
    hint: '一年中高温（どの月も18℃以上）。雨がとても少ない月（乾季）がある' },
  { id: 'BW', name: '砂漠気候',
    test: c => c.startsWith('BW'),
    hint: 'ほとんど雨が降らない。年間降水量がごく少ない' },
  { id: 'BS', name: 'ステップ気候',
    test: c => c.startsWith('BS'),
    hint: '雨が少なめ。砂漠ほどではないが、年間降水量はあまり多くない' },
  { id: 'Cfa', name: '温暖湿潤気候',
    test: c => c === 'Cfa',
    hint: '夏は暑く（最暖月22℃以上）、冬は寒すぎない（最寒月が−3〜18℃）。雨は一年中ある' },
  { id: 'Cfb', name: '西岸海洋性気候',
    test: c => /^Cf[bc]$/.test(c),
    hint: '夏も涼しめ（最暖月が22℃未満）で、冬もそれほど寒くない。雨は一年中ある' },
  { id: 'Cs', name: '地中海性気候',
    test: c => c.startsWith('Cs'),
    hint: '暖かい季節は乾燥（月40mm未満の月がある）、涼しい季節に雨が降る' },
  { id: 'Df', name: '亜寒帯（冷帯）湿潤気候',
    test: c => c.startsWith('Df'),
    hint: '冬はとても寒く（最寒月が−3℃未満）、夏は10℃以上の月がある。雨は一年中ある' },
  { id: 'ET', name: 'ツンドラ気候',
    test: c => c === 'ET',
    hint: 'どの月も10℃未満。ただし最も暖かい月は0℃以上' },
];

export function pickZone(prevId) {
  const pool = ZONES.filter(z => z.id !== prevId);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ===== 都市ミッションのお題 =====
// 今の操作（回転盤）で作りやすい範囲に絞る。遊んでみて難しすぎ/簡単すぎなら変える
export const CITY_TEMP_MIN = -10;     // どの月もこれ以上
export const CITY_TEMP_MAX = 25;      // どの月もこれ以下
export const CITY_PRECIP_MAX = 400;   // どの月もこれ以下(mm)

export function pickCity(cities, prev) {
  const pool = cities.filter(c =>
    c !== prev &&
    Math.min(...c.temp) >= CITY_TEMP_MIN &&
    Math.max(...c.temp) <= CITY_TEMP_MAX &&
    Math.max(...c.precip) <= CITY_PRECIP_MAX);
  const list = pool.length ? pool : cities;
  return list[Math.floor(Math.random() * list.length)];
}

// ===== ランク =====
export function grade(score) {
  if (score >= 90) return { rank: 'S', msg: 'ほぼ完全再現！' };
  if (score >= 75) return { rank: 'A', msg: 'かなり近い！' };
  if (score >= 55) return { rank: 'B', msg: 'いい線いってる！' };
  return { rank: 'C', msg: 'もう少し！気温と雨の月ごとの変化を見直そう' };
}