// 都市と、あなたの気候の「ずれ」。小さいほど似ている
export function distance(city, temp, precip) {
  let d = 0;
  for (let m = 0; m < 12; m++) {
    const dt = (city.temp[m] - temp[m]) / 5;                                  // 気温は5℃を1単位
    const dp = (Math.log1p(city.precip[m]) - Math.log1p(precip[m])) / 0.7;    // 降水は対数差
    d += dt * dt + dp * dp;
  }
  return Math.sqrt(d / 12);
}

export function nearest(cities, temp, precip, n = 3) {
  return cities
    .map(c => ({ c, d: distance(c, temp, precip) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

// 都市ミッションの点数（0〜100）。ぴったりで100点
export function scoreOf(city, temp, precip) {
  return Math.round(100 * Math.exp(-distance(city, temp, precip)));
}