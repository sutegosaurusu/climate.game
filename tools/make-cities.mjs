import fs from 'node:fs';
import { koppen } from '../src/koppen.js';   // Step 10の本物を入れておく（仮のままでも動く）

const NAME_JA_FILE = 'tools/city-name-ja.json';
const nameJa = fs.existsSync(NAME_JA_FILE)
  ? JSON.parse(fs.readFileSync(NAME_JA_FILE, 'utf8'))
  : {};

const MAX_ELEV = 2000;   // 山頂の観測所などを除く標高の上限(m)
const ONLY = [];         // 例: ['TOKYO','PARIS'] のように書くと、その名前を含む地点だけにする。空なら全部

// 引用符つきCSVも読める簡易パーサ
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const num = s => { const t = s.trim(); if (t === '') return NaN; const v = Number(t); return v <= -900 ? NaN : v; };
const title = s => s.toLowerCase().replace(/(^|[\s\-(])\S/g, m => m.toUpperCase());

function load(file) {
  const map = new Map();
  for (const r of parseCSV(fs.readFileSync(file, 'utf8'))) {
    if (r.length < 22 || !Number.isFinite(Number(r[0]))) continue;   // ヘッダー行や空行は飛ばす
    map.set(r[2], {
      lat: num(r[4]), lon: num(r[5]), elev: num(r[6]),
      country: r[7].trim(), name: r[8].trim(),
      vals: r.slice(9, 21).map(num),                                  // 12か月分（13個目の年値は使わない）
    });
  }
  return map;
}

const T = load('tools/wmo_normals_9120_TAVG.csv');
const P = load('tools/wmo_normals_9120_PRCP.csv');

const cities = [];
for (const [id, t] of T) {
  const p = P.get(id);
  if (!p) continue;
  if (t.vals.some(Number.isNaN) || p.vals.some(Number.isNaN)) continue;  // 欠けた月がある地点は除く
  if (p.vals.some(v => v < 0)) continue;
  if (Number.isFinite(t.elev) && t.elev > MAX_ELEV) continue;
  if (ONLY.length && !ONLY.some(k => t.name.toUpperCase().includes(k))) continue;
  const temp = t.vals.map(v => Math.round(v * 10) / 10);
  const precip = p.vals.map(v => Math.round(v));
  cities.push({
    name: nameJa[title(t.name)] ?? title(t.name), country: title(t.country),
    lat: t.lat, lon: t.lon, temp, precip, koppen: koppen(temp, precip),
  });
}

fs.writeFileSync('public/cities.json', JSON.stringify(cities));
console.log(`${cities.length} 地点を public/cities.json に書き出しました`);
console.log(cities.slice(0, 3));