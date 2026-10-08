/* ===================== FSRS-5 scheduler =====================
   Default parameters from FSRS-5. Optimizing these per user is a
   later feature; the defaults work well for most people. */
const W = [0.40255,1.18385,3.173,15.69105,7.1949,0.5345,1.4604,0.0046,1.54575,0.1192,
           1.01925,1.9395,0.11,0.29605,2.2698,0.2315,2.9898,0.51655,0.6621];
const DECAY = -0.5, FACTOR = 19/81;
const clampD = d => Math.min(10, Math.max(1, d));
const clampS = s => Math.max(0.01, s);
const retrievability = (days, s) => Math.pow(1 + FACTOR * days / s, DECAY);
const initS = g => clampS(W[g-1]);
const initD = g => clampD(W[4] - Math.exp(W[5] * (g-1)) + 1);
function nextD(d, g){
  const dp = d + (-W[6] * (g-3)) * (10 - d) / 9;          // linear damping
  return clampD(W[7] * initD(4) + (1 - W[7]) * dp);        // mean reversion
}
function recallS(d, s, r, g){
  const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
  return clampS(s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy));
}
function forgetS(d, s, r){
  return clampS(Math.min(W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)), s));
}
const shortS = (s, g) => clampS(s * Math.exp(W[17] * (g - 3 + W[18])));
function intervalDays(s, ret){
  const i = s / FACTOR * (Math.pow(ret, 1 / DECAY) - 1);
  return Math.min(36500, Math.max(1, Math.round(i)));
}

/* Returns the card's next state for each rating: {1: card, 2: card, 3: card, 4: card} */
function previewAll(c, now, ret){
  const out = {};
  const base = () => ({ ...c, reps: c.reps + 1, last: now });
  if (c.state === 'new'){
    for (const g of [1,2,3,4]){
      const n = base(); n.s = initS(g); n.d = initD(g);
      if (g === 4){ n.state = 'review'; n.due = now + intervalDays(n.s, ret) * DAY; }
      else { n.state = 'learning'; n.due = now + [0,1,5,10][g] * MIN; }
      out[g] = n;
    }
  } else if (c.state === 'learning' || c.state === 'relearning'){
    const goodIvl = intervalDays(shortS(c.s, 3), ret);
    for (const g of [1,2,3,4]){
      const n = base(); n.s = shortS(c.s, g); n.d = nextD(c.d, g);
      if (g <= 2){ n.due = now + (g === 1 ? 5 : 10) * MIN; }
      else {
        let ivl = intervalDays(n.s, ret);
        if (g === 4) ivl = Math.max(ivl, goodIvl + 1);
        n.state = 'review'; n.due = now + ivl * DAY;
      }
      out[g] = n;
    }
  } else { // review
    const r = retrievability(Math.max(0, (now - c.last) / DAY), c.s);
    const ivl = {};
    for (const g of [1,2,3,4]){
      const n = base(); n.d = nextD(c.d, g);
      if (g === 1){ n.s = forgetS(c.d, c.s, r); n.lapses = c.lapses + 1; n.state = 'relearning'; n.due = now + 10 * MIN; }
      else { n.s = recallS(c.d, c.s, r, g); n.state = 'review'; ivl[g] = intervalDays(n.s, ret); }
      out[g] = n;
    }
    const h = Math.min(ivl[2], ivl[3]);            // keep Hard < Good < Easy
    const gd = Math.max(ivl[3], h + 1);
    const e = Math.max(ivl[4], gd + 1);
    out[2].due = now + h * DAY; out[3].due = now + gd * DAY; out[4].due = now + e * DAY;
  }
  return out;
}

