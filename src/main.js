
import * as THREE from 'three';
import { drawClimograph } from './chart.js';
import { nearest, scoreOf } from './match.js';
import { koppen, koppenName } from './koppen.js';
import { pickZone, pickCity, grade } from './missions.js';

const $ = s => document.querySelector(s);

// ===== 設定 =====
const MONTH_SEC = 6;
const MM_PER_DROP = 1;
const DROPS_PER_SEC = 40;
const RED_START = 30;
const BLUE_START = -10;
const BLUE_FULL = -20;

const PARAMS = {
  free: { decayPerSec: 3, tempPerTurn: 3 },
  zone: { decayPerSec: 3, tempPerTurn: 3 },
  city: { decayPerSec: 3, tempPerTurn: 3 },
};

// ===== シーン =====
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.z = 10;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ===== 空 =====
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'));
  return new THREE.CanvasTexture(c);
}

scene.background = canvasTex(2, 256, g => {
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#1f6fd6');
  gr.addColorStop(1, '#bfe3ff');
  g.fillStyle = gr;
  g.fillRect(0, 0, 2, 256);
});

const cloudMat = new THREE.SpriteMaterial({
  map: canvasTex(128, 128, g => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }),
  transparent: true,
  depthWrite: false,
});

const clouds = [];

for (let i = 0; i < 40; i++) {
  const s = new THREE.Sprite(cloudMat);
  s.position.set(
    (Math.random() - .5) * 40,
    (Math.random() - .5) * 20,
    -5 - Math.random() * 20
  );
  s.scale.setScalar(4 + Math.random() * 6);
  scene.add(s);
  clouds.push(s);
}

// ===== 雨 =====
const MAX = 4000;

const dropMesh = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.07, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0x1e90ff }),
  MAX
);

dropMesh.frustumCulled = false;
scene.add(dropMesh);

const px = new Float32Array(MAX);
const py = new Float32Array(MAX);
const vy = new Float32Array(MAX);
const alive = new Uint8Array(MAX);

const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

for (let i = 0; i < MAX; i++) {
  dropMesh.setMatrixAt(i, hidden);
}

const dummy = new THREE.Object3D();
const FLOOR = -Math.tan(
  THREE.MathUtils.degToRad(25)
) * 10 - 0.3;

let cursor = 0;
let landed = 0;

function spawn(x, y) {
  for (let k = 0; k < MAX; k++) {
    const i = (cursor + k) % MAX;

    if (!alive[i]) {
      alive[i] = 1;
      px[i] = x;
      py[i] = y;
      vy[i] = 0;
      cursor = i + 1;
      return;
    }
  }
}

function updateDrops(dt) {
  for (let i = 0; i < MAX; i++) {
    if (!alive[i]) continue;

    vy[i] += 9.8 * dt;
    py[i] -= vy[i] * dt;

    if (py[i] < FLOOR) {
      alive[i] = 0;
      landed++;
      dropMesh.setMatrixAt(i, hidden);
    } else {
      dummy.position.set(px[i], py[i], 0);
      dummy.updateMatrix();
      dropMesh.setMatrixAt(i, dummy.matrix);
    }
  }

  dropMesh.instanceMatrix.needsUpdate = true;
}

const ray = new THREE.Raycaster();
const plane = new THREE.Plane(
  new THREE.Vector3(0, 0, 1),
  0
);
const hit = new THREE.Vector3();

function toWorld(cx, cy) {
  ray.setFromCamera(
    new THREE.Vector2(
      cx / innerWidth * 2 - 1,
      -(cy / innerHeight) * 2 + 1
    ),
    camera
  );

  ray.ray.intersectPlane(plane, hit);
  return hit;
}

const pressed = new Map();

canvas.addEventListener('pointerdown', e => {
  if (!playing) return;

  canvas.setPointerCapture(e.pointerId);

  pressed.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY,
    acc: 1
  });
});

canvas.addEventListener('pointermove', e => {
  const p = pressed.get(e.pointerId);

  if (p) {
    p.x = e.clientX;
    p.y = e.clientY;
  }
});

['pointerup', 'pointercancel'].forEach(t => {
  canvas.addEventListener(t, e => {
    pressed.delete(e.pointerId);
  });
});

function spawnFromPointers(dt) {
  for (const p of pressed.values()) {
    p.acc += DROPS_PER_SEC * dt;

    while (p.acc >= 1) {
      p.acc -= 1;

      const w = toWorld(
        p.x + (Math.random() - .5) * 20,
        p.y
      );

      spawn(w.x, w.y);
    }
  }
}

// ===== ゲームの状態 =====
let mode = 'free';
let mission = null;

// ★追加：都市ミッションの難易度
let cityDifficulty = 'easy';
// easy = 目標数値を表示
// hard = 目標数値を非表示

const result = {
  temp: [],
  precip: []
};

let monthIdx = 0;
let monthT = 0;
let tempAcc = 0;
let temp = 0;
let playing = false;

let decayPerSec = 3;
let tempPerDeg = 3 / 360;

// ===== 都市データ =====
const citiesPromise = fetch(`${import.meta.env.BASE_URL}cities.json`)
  .then(r => {
    if (!r.ok) {
      throw new Error('cities.json の読み込みに失敗');
    }
    return r.json();
  })
  .catch(e => {
    console.error('cities.json を読み込めませんでした', e);
    return [];
  });

// ===== 月の進行 =====
function tickMonth(dt) {
  const step = decayPerSec * dt;

  temp = Math.abs(temp) <= step
    ? 0
    : temp - Math.sign(temp) * step;

  monthT += dt;
  tempAcc += temp * dt;

  if (monthT >= MONTH_SEC) {
    result.temp.push(tempAcc / MONTH_SEC);
    result.precip.push(landed * MM_PER_DROP);

    landed = 0;
    tempAcc = 0;
    monthT = 0;
    monthIdx++;

    if (monthIdx === 12) {
      finish();
    }
  }
}

function resetGame() {
  playing = false;
  pressed.clear();
  dialId = null;

  result.temp.length = 0;
  result.precip.length = 0;

  monthIdx = 0;
  monthT = 0;
  tempAcc = 0;
  temp = 0;
  landed = 0;

  alive.fill(0);

  for (let i = 0; i < MAX; i++) {
    dropMesh.setMatrixAt(i, hidden);
  }

  dropMesh.instanceMatrix.needsUpdate = true;
}

// ===== 気温回転盤 =====
const dial = $('#dial');
const dialRot = $('#dialRot');

let dialId = null;
let lastAng = 0;

const angleOf = e => {
  const r = dial.getBoundingClientRect();

  return Math.atan2(
    e.clientY - (r.top + r.height / 2),
    e.clientX - (r.left + r.width / 2)
  );
};

dial.addEventListener('pointerdown', e => {
  dial.setPointerCapture(e.pointerId);
  dialId = e.pointerId;
  lastAng = angleOf(e);
});

dial.addEventListener('pointermove', e => {
  if (e.pointerId !== dialId || !playing) return;

  const a = angleOf(e);
  let d = a - lastAng;

  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;

  lastAng = a;

  temp = Math.max(
    -50,
    Math.min(50, temp + d * 180 / Math.PI * tempPerDeg)
  );
});

['pointerup', 'pointercancel'].forEach(t => {
  dial.addEventListener(t, e => {
    if (e.pointerId === dialId) {
      dialId = null;
    }
  });
});

// ===== ゲーム中の表示 =====
const lerp = (a, b, t) => a + (b - a) * t;

const BASE = [255, 255, 255, 0.13];
const RED = [255, 80, 70, 0.45];
const BLUE = [50, 120, 255, 0.6];

// ★変更：難易度による目標表示の切り替え
function goalText() {
  if (mode === 'zone' && mission) {
    return `目標：${mission.zone.name}`;
  }

  if (mode === 'city' && mission) {
    const c = mission.city;
    const i = Math.min(monthIdx, 11);

    const currentRain = Math.round(
      landed * MM_PER_DROP
    );

    // 難しい：目標気温・目標降水量を隠す
    if (cityDifficulty === 'hard') {
      return `${c.name}　今月の雨 ${currentRain}mm`;
    }

    // 簡単：目標数値を表示
    return `${c.name}　目標 ${c.temp[i].toFixed(0)}℃ ／ 雨${c.precip[i]}mm（今月の雨 ${currentRain}mm）`;
  }

  return '';
}

function hud() {
  $('#month').textContent =
    `${Math.min(monthIdx + 1, 12)}月`;

  $('#temp').textContent =
    `${temp.toFixed(1)}℃`;

  $('#bar i').style.width =
    `${monthT / MONTH_SEC * 100}%`;

  $('#goal').textContent = goalText();

  dialRot.style.transform =
    `rotate(${temp / tempPerDeg}deg)`;

  let to = BASE;
  let k = 0;

  if (temp > RED_START) {
    to = RED;
    k = Math.min((temp - RED_START) / 20, 1);
  } else if (temp < BLUE_START) {
    to = BLUE;
    k = Math.min(
      (BLUE_START - temp) / (BLUE_START - BLUE_FULL),
      1
    );
  }

  const c = BASE.map((v, i) =>
    lerp(v, to[i], k)
  );

  dial.style.background =
    `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`;
}

// ===== メインループ =====
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  clouds.forEach(c => {
    c.position.x += 0.2 * dt;

    if (c.position.x > 25) {
      c.position.x = -25;
    }
  });

  if (playing) {
    spawnFromPointers(dt);
    tickMonth(dt);
  }

  updateDrops(dt);
  hud();

  renderer.render(scene, camera);
});

// ===== 画面の切り替え =====

// ★変更：cityDifficulty を追加
const SCREENS = [
  'home',
  'cityDifficulty',
  'brief',
  'result',
  'howto'
];

function show(id) {
  for (const s of SCREENS) {
    const element = $('#' + s);

    element.style.display =
      s === id
        ? (s === 'result' ? 'block' : 'flex')
        : 'none';
  }
}

function setPlayUI(on) {
  $('#hud').style.display = on ? 'block' : 'none';
  dial.style.display = on ? 'block' : 'none';
  $('#quit').style.display = on ? 'block' : 'none';
}

function goHome() {
  resetGame();
  setPlayUI(false);
  $('#homeMsg').textContent = '';
  show('home');
}

function startPlay() {
  const p = PARAMS[mode];

  decayPerSec = p.decayPerSec;
  tempPerDeg = p.tempPerTurn / 360;

  resetGame();

  show(null);
  setPlayUI(true);

  playing = true;
}

// ===== お題を新しく決める =====
async function newMission() {
  if (mode === 'zone') {
    mission = {
      zone: pickZone(mission?.zone.id)
    };
    return true;
  }

  const cities = await citiesPromise;

  if (!cities.length) {
    return false;
  }

  mission = {
    city: pickCity(cities, mission?.city)
  };

  return true;
}

// ===== お題画面 =====
function showBrief() {
  show('brief');

  const chart = $('#briefChart');

  if (mode === 'zone') {
    $('#briefTitle').textContent =
      '気候帯ミッション';

    $('#briefBody').innerHTML =
      `<div class="target">${mission.zone.name}</div>` +
      `<p>${mission.zone.hint}</p>` +
      `<p><small>12か月ぶんの気候をつくって、この気候帯に入ればクリア！</small></p>`;

    chart.style.display = 'none';

  } else {
    const c = mission.city;

    $('#briefTitle').textContent =
      '都市ミッション';

    $('#briefBody').innerHTML =
      `<div class="target">${c.name}</div>` +
      `<p>${c.country}</p>` +
      `<p><small>この雨温図にどれだけ近づけるか！</small></p>`;

    chart.style.display = 'block';

    drawClimograph(
      chart,
      c.temp,
      c.precip
    );
  }
}

// ===== ボタン =====

// 自由プレイ
$('#btn-free').onclick = () => {
  mode = 'free';
  mission = null;
  startPlay();
};

// 気候帯ミッション
$('#btn-zone').onclick = async () => {
  mode = 'zone';
  mission = null;

  if (await newMission()) {
    showBrief();
  }
};

// ★変更：都市ミッションは最初に難易度選択へ
$('#btn-city').onclick = () => {
  mode = 'city';
  mission = null;

  $('#homeMsg').textContent = '';

  show('cityDifficulty');
};

// ★追加：難易度選択後にお題を決める
async function chooseCityDifficulty(difficulty) {
  mode = 'city';
  cityDifficulty = difficulty;
  mission = null;

  $('#btn-city-easy').disabled = true;
  $('#btn-city-hard').disabled = true;

  try {
    if (await newMission()) {
      showBrief();
    } else {
      show('home');
      $('#homeMsg').textContent =
        '都市データを読み込めませんでした';
    }
  } catch (e) {
    console.error(e);
    show('home');
    $('#homeMsg').textContent =
      '都市データの読み込みに失敗しました';
  } finally {
    $('#btn-city-easy').disabled = false;
    $('#btn-city-hard').disabled = false;
  }
}

// 簡単
$('#btn-city-easy').onclick = () => {
  chooseCityDifficulty('easy');
};

// 難しい
$('#btn-city-hard').onclick = () => {
  chooseCityDifficulty('hard');
};

// 難易度選択画面から戻る
$('#cityDifficultyBack').onclick = goHome;

// お題画面の操作
$('#briefStart').onclick = startPlay;

$('#briefReroll').onclick = async () => {
  if (await newMission()) {
    showBrief();
  }
};

$('#briefBack').onclick = () => {
  if (mode === 'city') {
    show('cityDifficulty');
  } else {
    goHome();
  }
};

// ゲーム中にホームへ
$('#quit').onclick = goHome;

// 同じお題でもう一度
$('#again').onclick = startPlay;

// 次のお題
$('#nextBtn').onclick = async () => {
  if (await newMission()) {
    showBrief();
  }
};

// ホームへ
$('#toHome').onclick = goHome;

// ===== 遊び方画面 =====
$('#btn-howto-small').onclick = () => {
  show('howto');
};

$('#howtoClose').onclick = () => {
  show('home');
};

// ===== 結果表示 =====
async function finish() {
  playing = false;
  pressed.clear();
  dialId = null;

  setPlayUI(false);

  const cities = await citiesPromise;

  const top = nearest(
    cities,
    result.temp,
    result.precip,
    3
  );

  const code = koppen(
    result.temp,
    result.precip
  );

  let missionHtml = '';
  let ref;

  if (mode === 'zone') {
    const ok = mission.zone.test(code);

    missionHtml =
      `<h1>${ok ? '🎉 クリア！' : '😢 ざんねん…'}</h1>` +
      `<p>お題：${mission.zone.name}</p>`;

  } else if (mode === 'city') {
    const c = mission.city;

    const sc = scoreOf(
      c,
      result.temp,
      result.precip
    );

    const g = grade(sc);

    const mean = a =>
      a.reduce((s, v) => s + v, 0) / a.length;

    const dT = mean(
      result.temp.map((t, i) =>
        Math.abs(t - c.temp[i])
      )
    );

    const dP = mean(
      result.precip.map((p, i) =>
        Math.abs(p - c.precip[i])
      )
    );

    missionHtml =
      `<h1>${g.rank}ランク　${sc}点</h1>` +
      `<p>${g.msg}</p>` +
      `<p>お題：${c.name}（${c.country}）<br>` +
      `<small>平均の差　気温 ${dT.toFixed(1)}℃ ／ 月降水量 ${Math.round(dP)}mm</small></p>`;

    ref = c;
  }

  show('result');

  $('#nextBtn').style.display =
    mode === 'free' ? 'none' : 'inline-block';

  drawClimograph(
    $('#chart'),
    result.temp,
    result.precip,
    ref
  );

  $('#info').innerHTML =
    missionHtml +
    `<h2>あなたの気候：${code}（${koppenName(code)}）</h2>` +
    `<h3>似ている都市</h3>` +
    (
      top.length
        ? `<ol>${top.map(t =>
            `<li>${t.c.name}（${t.c.country}）　${t.c.koppen ?? ''}</li>`
          ).join('')}</ol>`
        : `<p>都市データを読み込めませんでした</p>`
    ) +
    `<p><small>データ出典：WMO Member Nations (2023). WMO Climatological Standard Normals for 1991-2020 (NCEI Accession 0253808). NOAA National Centers for Environmental Information.</small></p>`;
}

// ===== 起動 =====
show('home');
