export function drawClimograph(cv, temp, precip, ref) {
  const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const L = 44, R = 44, T = 60, B = 32, pw = W - L - R, ph = H - T - B;
  const TMIN = -20, TMAX = 40, PMAX = 300;           // 気温-20〜40℃ / 降水量0〜300mm
  const yT = t => T + ph * (1 - (t - TMIN) / (TMAX - TMIN));
  const yP = p => T + ph * (1 - p / PMAX);
  const bw = pw / 12;

  g.fillStyle = '#fff'; g.fillRect(L, T, pw, ph);    // 枠
  g.font = '12px system-ui'; g.textAlign = 'center';

  precip.forEach((p, i) => {                          // 降水量（枠を超えてもそのまま描く）
    g.fillStyle = '#2f7be5';
    g.fillRect(L + i * bw + bw * .15, yP(p), bw * .7, yP(0) - yP(p));
  });
  g.beginPath();                                      // 気温
  temp.forEach((t, i) => { const x = L + (i + .5) * bw; i ? g.lineTo(x, yT(t)) : g.moveTo(x, yT(t)); });
  g.strokeStyle = '#e5382f'; g.lineWidth = 3; g.stroke();

  if (ref) {                                          // お題を点線で重ねる
    g.setLineDash([5, 4]); g.lineWidth = 2;
    g.strokeStyle = '#0b3d91';
    ref.precip.forEach((p, i) => g.strokeRect(L + i * bw + bw * .15, yP(p), bw * .7, yP(0) - yP(p)));
    g.beginPath();
    ref.temp.forEach((t, i) => { const x = L + (i + .5) * bw; i ? g.lineTo(x, yT(t)) : g.moveTo(x, yT(t)); });
    g.strokeStyle = '#8a1c14'; g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#fff'; g.textAlign = 'left';
    g.fillText('塗り・実線：あなた　点線：お題', L, 24);
  }

  g.fillStyle = '#fff'; g.textAlign = 'center';
  for (let i = 0; i < 12; i++) g.fillText(`${i + 1}`, L + (i + .5) * bw, H - 10);
  g.textAlign = 'right'; for (let t = TMIN; t <= TMAX; t += 20) g.fillText(`${t}℃`, L - 4, yT(t) + 4);
  g.textAlign = 'left';  for (let p = 0; p <= PMAX; p += 100) g.fillText(`${p}mm`, W - R + 4, yP(p) + 4);
}