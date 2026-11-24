const sum = a => a.reduce((s, v) => s + v, 0), avg = a => sum(a) / a.length;

export function koppen(T, P) {
  const Tann = avg(T), Pann = sum(P);
  const Tmax = Math.max(...T), Tmin = Math.min(...T), Pmin = Math.min(...P);
  // 夏半年＝暖かいほうの6か月（北半球は通常4〜9月）
  const AS = [3,4,5,6,7,8], OM = [9,10,11,0,1,2];
  const summer = avg(AS.map(i => T[i])) >= avg(OM.map(i => T[i])) ? AS : OM;
  const winter = [...Array(12).keys()].filter(i => !summer.includes(i));
  const Ps = summer.map(i => P[i]), Pw = winter.map(i => P[i]);
  const Psmin = Math.min(...Ps), Psmax = Math.max(...Ps);
  const Pwmin = Math.min(...Pw), Pwmax = Math.max(...Pw);

  // E：最暖月 10℃未満
  if (Tmax < 10) return Tmax >= 0 ? 'ET' : 'EF';

  // B：乾燥限界
  const rs = Pann > 0 ? sum(Ps) / Pann : 0.5;
  const Pth = rs >= 0.7 ? 2 * Tann + 28 : rs <= 0.3 ? 2 * Tann : 2 * Tann + 14;
  if (Pann < 10 * Pth) return (Pann < 5 * Pth ? 'BW' : 'BS') + (Tann >= 18 ? 'h' : 'k');

  // A：最寒月 18℃以上
  if (Tmin >= 18) return Pmin >= 60 ? 'Af' : (Pann >= 25 * (100 - Pmin) ? 'Am' : 'Aw');

  // C / D
  const first = Tmin >= -3 ? 'C' : 'D';
  const second = (Psmin < 40 && Psmin < Pwmax / 3) ? 's' : (Pwmin < Psmax / 10 ? 'w' : 'f');
  const warm = T.filter(t => t >= 10).length;
  let third = Tmax >= 22 ? 'a' : warm >= 4 ? 'b' : 'c';
  if (first === 'D' && Tmin < -38 && third === 'c') third = 'd';
  return first + second + third;
}

export function koppenName(code) {
  const k2 = code.slice(0, 2);
  if (k2 === 'Cf') return code[2] === 'a' ? '温暖湿潤気候' : '西岸海洋性気候';
  return ({ Af:'熱帯雨林気候', Am:'熱帯モンスーン気候', Aw:'サバナ気候',
    BS:'ステップ気候', BW:'砂漠気候', Cs:'地中海性気候', Cw:'温暖冬季少雨気候',
    Df:'亜寒帯（冷帯）湿潤気候', Dw:'亜寒帯冬季少雨気候', ET:'ツンドラ気候', EF:'氷雪気候' })[k2] ?? code;
}