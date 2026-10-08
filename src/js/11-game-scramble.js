/* ----- Game: Scramble ----- */
let bl = null;
function stopScramble(){ if (bl){ bl.alive = false; cancelAnimationFrame(bl.raf); bl = null; } }
function scrambleLater(fn, ms){ if (bl) later(bl, fn, ms); }
const scrambleAns = c => bl.dir === 'front' ? c.back : c.front;
const scrambleQ = c => bl.dir === 'front' ? c.front : c.back;
GAMES.push({
  id: 'scramble', name: 'Scramble', minCards: 4,
  desc: 'Answers fall from above. Hit the one that matches the prompt before it gets away. It speeds up as you go.',
  usable: deck => matchPick(deck, Infinity),
  settings: [PROMPT_SETTING, { key: 'lives', label: 'Lives', default: 3,
    options: () => [1, 2, 3, 5, 10].map(x => ({ value: x, label: livesText(x) })) }],
  summary(deck){ return `${promptLabel(gameSetting(deck, this, 'dir'))}, ${livesText(gameSetting(deck, this, 'lives'))}`; },
  start(deck){
    const dir = gameSetting(deck, this, 'dir'), lives = gameSetting(deck, this, 'lives');
    const cards = matchPick(deck, Infinity);
    show('scramble');
    bl = { id: uid(), deckId: deck.id, dir, cards, order: shuffle(cards), idx: 0, score: 0, lives, maxLives: lives,
           correct: 0, level: 1, rocks: [], phase: 'between', raf: 0, last: 0, missed: new Map(),
           alive: true, paused: false, queued: [] };
    $('#scramblePaused').hidden = true; $('#scramblePause').textContent = 'Pause';
    const arena = $('#scrambleArena');
    arena.querySelectorAll('.rock,.rocket,.debris,.dust').forEach(e => e.remove());
    bl.miner = { x: arena.clientWidth / 2 - SCR_MINER_W / 2, fireAt: null }; bl.rockets = []; bl.lastShot = 0;
    bl.aim = { x: arena.clientWidth / 2, y: arena.clientHeight * 0.3 };
    scrambleHud(); scrambleRound();
    bl.raf = requestAnimationFrame(scrambleTick);
  }
});
function scrambleHud(){
  $('#scrambleScore').textContent = bl.score; $('#scrambleLevel').textContent = bl.level;
  $('#scrambleLives').textContent = '\u2665'.repeat(bl.lives) + '\u2661'.repeat(bl.maxLives - bl.lives);
  $('#scrambleLives').setAttribute('aria-label', `${bl.lives} lives left`);
}
/* Scramble's cave: a pixel miner with a rocket launcher shoots falling rocks. */
const SCR_FLOOR = 26, SCR_MINER_W = 56, SCR_MINER_H = 72, SCR_PIVOT = { right: 46, left: 10, y: 33.5 }, SCR_BARREL = 31, SCR_MINER_SPEED = 620, SCR_GRAVITY = 2600, SCR_ROCKET_SPEED = 1500, SCR_COOLDOWN = 140, SCR_DASH_SPEED = 2000, SCR_BLAST_SPEED = 2800;   // the backblast outruns even a sprinting miner
const SCR_SHAPES = [
  'polygon(8% 18%,30% 4%,62% 0,88% 12%,100% 42%,94% 78%,70% 98%,34% 100%,6% 84%,0 50%)',
  'polygon(14% 6%,48% 0,80% 8%,98% 30%,100% 66%,84% 94%,50% 100%,18% 92%,2% 64%,0 30%)',
  'polygon(4% 30%,22% 6%,56% 2%,86% 0,100% 28%,96% 70%,78% 100%,40% 96%,10% 88%,0 60%)',
  'polygon(10% 10%,40% 0,70% 6%,96% 20%,100% 56%,90% 88%,60% 100%,26% 98%,4% 80%,0 40%)',
  'polygon(0 22%,18% 2%,50% 6%,78% 0,100% 18%,98% 58%,88% 92%,56% 100%,22% 94%,4% 72%)'];
const SCR_ROCK_COLORS = [['#8C7B66', '#625446', '#3E352C'], ['#7E7A74', '#57534E', '#33302C'], ['#8A6A50', '#5E4636', '#3A2A20'], ['#6F675C', '#4C463E', '#2C2924']];
// Pixel miner, one character per pixel. Legs have two frames for walking.
const MINER_COLORS = { Y: '#F2C230', D: '#B88A12', L: '#FFF6B0', S: '#E9B98E', E: '#1A1410', B: '#2F6FB0', b: '#24568A', K: '#5A3A1A', P: '#3A3F55', O: '#4A2E1A' };
const MINER_BODY = ['....YYYYYY....', '...YYYYYYYLL..', '..DDDDDDDDDD..', '....SSSSSS....', '....SESSES....', '....SSSSSS....', '.....SSSS.....',
  '...BBBBBBBB...', '..SBBBBBBBBS..', '..SBBbBBbBBS..', '..SBBBBBBBBS..', '...KKKKKKKK...', '....PPPPPP....', '....PPPPPP....'];
const MINER_LEGS_A = ['...PP....PP...', '...PP....PP...', '..OOO....OOO..', '..OOO....OOO..'];
const MINER_LEGS_B = ['....PP..PP....', '....PP..PP....', '...OOO..OOO...', '...OOO..OOO...'];
const pixels = (rows, y0) => rows.map((row, y) => [...row].map((ch, x) =>
  ch === '.' ? '' : `<rect x="${x}" y="${y + y0}" width="1.02" height="1.02" fill="${MINER_COLORS[ch]}"/>`).join('')).join('');
$('#scrambleMiner svg').innerHTML = pixels(MINER_BODY, 0) + `<g class="legA">${pixels(MINER_LEGS_A, 14)}</g><g class="legB">${pixels(MINER_LEGS_B, 14)}</g>`;

function scrambleLayout(){
  if (!bl) return;
  const W = $('#scrambleArena').clientWidth, lw = W / bl.rocks.length;
  bl.rocks.forEach((r, i) => { r.el.style.left = (i * lw + 6) + 'px'; r.el.style.width = (lw - 12) + 'px'; r.h = r.el.offsetHeight; });
}
window.addEventListener('resize', scrambleLayout);
const scrRockPos = r => r.el.style.transform = `translate(${r.dx || 0}px,${r.y}px)` + (r.spin ? ` rotate(${r.spin}deg)` : '');
function scrambleRound(){
  if (bl.idx >= bl.order.length){ bl.order = shuffle(bl.cards); bl.idx = 0; }
  const c = bl.order[bl.idx++]; bl.card = c; bl.clearX = null; bl.dash = null;
  const options = shuffle([c, ...shuffle(bl.cards.filter(x => x.id !== c.id)).slice(0, 3)]);
  const arena = $('#scrambleArena'); arena.querySelectorAll('.rock').forEach(r => r.remove());
  bl.rocks = options.map((o, i) => {
    const el = document.createElement('button');
    const text = scrambleAns(o), colors = SCR_ROCK_COLORS[Math.floor(Math.random() * SCR_ROCK_COLORS.length)];
    el.className = 'rock' + (text.length > 40 ? ' long' : ''); el.textContent = text; el.dataset.lane = i;
    el.style.setProperty('--shape', SCR_SHAPES[Math.floor(Math.random() * SCR_SHAPES.length)]);
    el.style.setProperty('--tilt', (Math.random() * 10 - 5).toFixed(1) + 'deg');
    colors.forEach((col, k) => el.style.setProperty(`--r${k + 1}`, col));
    arena.append(el);
    return { el, y: 0, h: 0, colors, correct: o.id === c.id, alive: true, falling: false, vy: 0 };
  });
  scrambleLayout();
  // All rocks start level, just above the ceiling, and fall together so every option is visible at once.
  const startY = -(Math.max(...bl.rocks.map(r => r.h)) + 10);
  for (const r of bl.rocks){ r.y = startY; scrRockPos(r); }
  $('#scramblePrompt').textContent = scrambleQ(c);
  bl.phase = 'play';
}
function scrambleDebris(x, y, colors, big){
  const d = document.createElement('div'); d.className = 'debris';
  d.style.left = x + 'px'; d.style.top = y + 'px';
  const n = big ? 14 : 8;
  d.innerHTML = Array.from({ length: n }, () => {
    const sz = 3 + Math.floor(Math.random() * 4), col = colors[Math.floor(Math.random() * colors.length)];
    return `<i style="--dx:${((Math.random() * 2 - 1) * (big ? 70 : 40)).toFixed(0)}px;--up:${(-(8 + Math.random() * (big ? 50 : 20))).toFixed(0)}px;` +
           `--down:${(30 + Math.random() * 80).toFixed(0)}px;width:${sz}px;height:${sz}px;background:${col}"></i>`;
  }).join('') + (big ? '<b></b>' : '');
  $('#scrambleArena').append(d); setTimeout(() => d.remove(), 600);
}
function scrambleCrash(r){
  const H = $('#scrambleArena').clientHeight, x = r.el.offsetLeft + r.el.offsetWidth / 2;
  r.el.classList.add('crash');
  const dust = document.createElement('div'); dust.className = 'dust';
  dust.style.left = x + 'px'; dust.style.top = (H - SCR_FLOOR - 12) + 'px';
  $('#scrambleArena').append(dust); setTimeout(() => dust.remove(), 460);
  scrambleDebris(x, H - SCR_FLOOR - 6, r.colors, false);
  setTimeout(() => r.el.remove(), 220);
}
function scramblePivot(){      // the launcher sits on whichever shoulder faces the target
  const H = $('#scrambleArena').clientHeight, m = bl.miner;
  return { x: m.x + (m.facingLeft ? SCR_PIVOT.left : SCR_PIVOT.right), y: H - 24 - SCR_MINER_H + SCR_PIVOT.y };
}
function scrambleMinerUpdate(dt){
  const m = bl.miner, W = $('#scrambleArena').clientWidth;
  if (m.stunned) dt = 0;                                                      // knocked back by a blast
  // After a correct hit he sprints under the cleared gap; for keys 1-4 he sprints under the chosen rock.
  const dashing = bl.clearX != null || !!bl.dash;
  const want = (bl.clearX != null ? bl.clearX : bl.dash ? bl.dash.x : bl.aim.x) - SCR_MINER_W / 2;
  const tx = Math.max(0, Math.min(W - SCR_MINER_W, want)), dx = tx - m.x, step = (dashing ? SCR_DASH_SPEED : SCR_MINER_SPEED) * dt;
  m.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
  const el = $('#scrambleMiner'), at = m.fireAt || bl.aim, mid = m.x + SCR_MINER_W / 2;
  if (at.x < mid - 14) m.facingLeft = true; else if (at.x > mid + 14) m.facingLeft = false;   // no flip-flopping when aiming straight up
  const p = scramblePivot();
  let ang = Math.atan2(at.y - p.y, at.x - p.x) * 180 / Math.PI;
  if (ang > 0) ang = at.x < p.x ? -175 : -5;                              // never aim into the floor
  ang = Math.max(-175, Math.min(-5, ang));
  el.style.transform = `translateX(${m.x}px)`;
  el.classList.toggle('walking', Math.abs(dx) > 1);
  el.classList.toggle('left', m.facingLeft);
  $('#scrambleLauncher').style.setProperty('--aim', ang + 'deg');
  if (bl.dash && Math.abs(dx) < 2){                                        // arrived under the rock: fire straight up
    const d = bl.dash; bl.dash = null;
    if (d.rock.alive && bl.phase === 'play'){ bl.lastShot = 0; scrambleLaunch(d.x, d.rock.y + d.rock.h * 0.6); }
  }
}
function scrambleLaunch(tx, ty){      // fire a rocket toward a point; it flies until it hits a rock or leaves the cave
  const now = performance.now();
  if (now - bl.lastShot < SCR_COOLDOWN) return;
  bl.lastShot = now;
  // Clicking below a rock means "that rock": aim at its middle (leading it slightly, since it keeps falling).
  const col = bl.rocks.find(r => r.alive && tx >= r.el.offsetLeft && tx <= r.el.offsetLeft + r.el.offsetWidth && ty > r.y + r.h / 2);
  const m = bl.miner;
  if (col){
    m.fireAt = { x: tx, y: col.y + col.h / 2 }; scrambleMinerUpdate(0);
    const p0 = scramblePivot(), dist = Math.hypot(tx - p0.x, col.y + col.h / 2 - p0.y);
    ty = col.y + col.h / 2 + (bl.v || 0) * dist / SCR_ROCKET_SPEED;
  }
  m.fireAt = { x: tx, y: ty };
  scrambleMinerUpdate(0);
  const p = scramblePivot();
  let ang = Math.atan2(ty - p.y, tx - p.x);
  ang = Math.max(-Math.PI * 175 / 180, Math.min(-Math.PI * 5 / 180, ang > 0 ? (tx < p.x ? -Math.PI : 0) : ang));
  const el = document.createElement('div'); el.className = 'rocket';
  $('#scrambleArena').append(el);
  const rk = { el, ang, x: p.x + Math.cos(ang) * SCR_BARREL, y: p.y + Math.sin(ang) * SCR_BARREL,
               vx: Math.cos(ang) * SCR_ROCKET_SPEED, vy: Math.sin(ang) * SCR_ROCKET_SPEED, target: col || null };
  el.style.transform = `translate(${rk.x}px,${rk.y}px) rotate(${ang}rad)`;
  bl.rockets.push(rk);
  clearTimeout(m.fireTimer); m.fireTimer = setTimeout(() => { if (bl && bl.miner === m) m.fireAt = null; }, 260);
}
function scrambleRockets(dt){
  const arena = $('#scrambleArena'), W = arena.clientWidth, H = arena.clientHeight, pad = 8;
  bl.rockets = bl.rockets.filter(rk => {
    rk.x += rk.vx * dt; rk.y += rk.vy * dt;
    rk.el.style.transform = `translate(${rk.x}px,${rk.y}px) rotate(${rk.ang}rad)`;
    const tipX = rk.x + Math.cos(rk.ang) * 14, tipY = rk.y + Math.sin(rk.ang) * 14;
    if (bl.phase === 'play'){
      // A rocket aimed at a rock's column flies past the others on its way there.
      const r = bl.rocks.find(r => r.alive && (!rk.target || r === rk.target) && tipX > r.el.offsetLeft + pad && tipX < r.el.offsetLeft + r.el.offsetWidth - pad
                                         && tipY > r.y + pad && tipY < r.y + r.h - pad);
      if (r){ rk.el.remove(); scrambleRockHit(r, tipX, tipY); return false; }
    }
    if (rk.x < -30 || rk.x > W + 30 || rk.y < -120 || rk.y > H){ rk.el.remove(); return false; }   // some room above the ceiling for rocks coming in
    return true;
  });
}
function scrambleTick(t){
  if (!bl) return;
  if (bl.paused){ bl.raf = requestAnimationFrame(scrambleTick); return; }
  const dt = bl.last ? Math.min(0.05, (t - bl.last) / 1000) : 0; bl.last = t;
  const H = $('#scrambleArena').clientHeight, floorY = H - SCR_FLOOR;
  if (bl.phase === 'play'){
    const fallSeconds = Math.max(3.5, 9 * Math.pow(0.92, bl.level - 1));
    bl.v = H / fallSeconds;
    for (const r of bl.rocks){
      if (!r.alive) continue;
      r.y += bl.v * dt; scrRockPos(r);
      if (r.y + r.h >= floorY){
        if (r.correct){ scrambleEscaped(); break; }
        r.alive = false; scrambleCrash(r);                                   // wrong answers just smash on the floor
      }
    }
  }
  { const W = $('#scrambleArena').clientWidth;
    for (const r of bl.rocks){                                                // rocks blown away by a backblast
      if (!r.blown) continue;
      r.dx += r.blown.vx * dt; r.y += r.blown.vy * dt; r.spin += r.blown.spin * dt; scrRockPos(r);
      const left = r.el.offsetLeft + r.dx;
      if (left > W + 40 || left + r.el.offsetWidth < -40 || r.y + r.h < -40 || r.y > H + 40){ r.blown = null; r.el.remove(); }
    } }
  for (const r of bl.rocks){                                                  // rocks dropping to clear the screen
    if (!r.falling) continue;
    r.vy += SCR_GRAVITY * dt; r.y += r.vy * dt;
    if (r.y + r.h >= floorY){ r.y = floorY - r.h; r.falling = false; scrambleCrash(r); }
    scrRockPos(r);
  }
  scrambleRockets(dt);
  scrambleMinerUpdate(dt);
  bl.raf = requestAnimationFrame(scrambleTick);
}
function scrambleDropAll(except){
  for (const o of bl.rocks){
    if (o === except || !o.alive) continue;
    o.alive = false; o.falling = true; o.vy = bl.v || 0; o.el.style.pointerEvents = 'none';
  }
}
function scrambleHit(lane){      // keys 1-4: sprint under that rock, then fire straight up
  if (!bl || bl.paused || bl.phase !== 'play' || bl.miner.stunned) return;
  const r = bl.rocks[lane]; if (!r || !r.alive) return;
  const x = r.el.offsetLeft + r.el.offsetWidth / 2;
  bl.dash = { rock: r, x }; bl.aim = { x, y: r.y + r.h / 2 };
}
function scrambleRockHit(r, hx, hy){
  r.alive = false;
  r.el.classList.add(r.correct ? 'hit' : 'shatter');
  scrambleDebris(hx, hy, r.correct ? [...r.colors, '#FFB347', '#FFD27A'] : r.colors, true);
  setTimeout(() => r.el.remove(), 450);
  if (r.correct){
    const H = $('#scrambleArena').clientHeight;
    const speedBonus = Math.round(Math.max(0, 1 - Math.max(0, r.y) / H) * 100);   // more points for early hits
    bl.score += 100 + speedBonus + (bl.level - 1) * 20;
    bl.correct++; if (bl.correct % 5 === 0) bl.level++;
    bl.clearX = r.el.offsetLeft + r.el.offsetWidth / 2; scrambleDropAll(r);
    bl.phase = 'between'; scrambleHud(); scrambleLater(scrambleRound, 750);
  } else {
    scrambleBackblast(hx, hy);
  }
}
function scrambleBackblast(hx, hy){
  bl.phase = 'between'; bl.dash = null; bl.missed.set(bl.card.id, bl.card);
  const arena = $('#scrambleArena'), m = bl.miner;
  // every rock is thrown away from the blast and off screen
  for (const o of bl.rocks){
    if (!o.alive) continue;
    o.alive = false; o.falling = false; o.el.style.pointerEvents = 'none';
    const cx = o.el.offsetLeft + o.el.offsetWidth / 2, cy = o.y + o.h / 2;
    let ax = cx - hx, ay = cy - hy - 120; const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
    const sp = 1300 + Math.random() * 500;
    o.blown = { vx: ax * sp, vy: ay * sp, spin: (Math.random() * 2 - 1) * 600 }; o.dx = 0; o.spin = 0;
  }
  // The blast homes in on the miner wherever he runs, so it always lands on him.
  const ball = document.createElement('div'); ball.className = 'backblast';
  ball.style.transform = `translate(${hx}px,${hy}px)`; arena.append(ball);
  let bx = hx, by = hy, last = performance.now();
  const impact = (tx, ty, fromLeft) => {
    scrambleDebris(tx, ty, ['#FFB347', '#E0531F', '#FFF4C2'], true);
    const el = $('#scrambleMiner'); el.classList.remove('hurt'); void el.offsetWidth; el.classList.add('hurt');
    m.stunned = true; m.x += (fromLeft ? 1 : -1) * 36;                    // knocked back away from the blast
    setTimeout(() => { el.classList.remove('hurt'); m.stunned = false; }, 550);
    $('#scramblePrompt').innerHTML = `${esc(scrambleQ(bl.card))} <span class="scramble-answer">= ${esc(scrambleAns(bl.card))}</span>`;
    if (!scrambleLoseLife()) scrambleLater(scrambleRound, 1400);
  };
  const fly = now => {
    if (!bl || bl.miner !== m){ ball.remove(); return; }
    if (bl.paused){ last = now; return requestAnimationFrame(fly); }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const tx = m.x + SCR_MINER_W / 2, ty = scramblePivot().y;
    const dx = tx - bx, dy = ty - by, d = Math.hypot(dx, dy), move = SCR_BLAST_SPEED * dt;
    if (d <= move + 8){ ball.remove(); return impact(tx, ty, dx > 0); }
    bx += dx / d * move; by += dy / d * move;
    ball.style.transform = `translate(${bx}px,${by}px)`;
    requestAnimationFrame(fly);
  };
  requestAnimationFrame(fly);
}
function scrambleEscaped(){
  bl.phase = 'between'; bl.missed.set(bl.card.id, bl.card);
  const r = bl.rocks.find(x => x.correct);
  r.alive = false; scrambleCrash(r); scrambleDropAll(r);
  $('#scramblePrompt').innerHTML = `${esc(scrambleQ(bl.card))} <span class="scramble-answer">= ${esc(scrambleAns(bl.card))}</span>`;
  if (!scrambleLoseLife()) scrambleLater(scrambleRound, 1500);
}
function scrambleLoseLife(){
  bl.lives--; scrambleHud();
  const arena = $('#scrambleArena'); arena.classList.add('hurt'); setTimeout(() => arena.classList.remove('hurt'), 300);
  if (bl.lives > 0) return false;
  bl.phase = 'over'; scrambleLater(finishScramble, 1500); return true;
}
function finishScramble(){
  const g = bl, deck = getDeck(g.deckId);
  const key = g.maxLives === 3 ? g.dir : `${g.dir}-${g.maxLives}`;     // 3-life scores keep their original key
  const best = deck.games.scramble.best, prev = best[key] || 0, isBest = g.score > prev;
  if (isBest){ best[key] = g.score; save(); }
  const missed = [...g.missed.values()].slice(0, 10);
  const list = missed.length ? `<br><br>Cards worth reviewing:<ul class="review-list">${missed.map(c => `<li>${esc(c.front)}: ${esc(c.back)}</li>`).join('')}</ul>` : '';
  showResults({
    title: isBest && prev ? 'New high score!' : 'Game over',
    msg: (isBest && prev ? `<span class="new-best">You beat your old record of ${prev}.</span>`
        : prev ? `Your high score with these settings is ${prev}.` : 'First game with these settings. Play again to beat it.') + list,
    stats: [['Score', String(g.score)], ['Correct', String(g.correct)], ['Level', String(g.level)]]
  });
}
$('#scramblePause').onclick = () => bl && setPaused(bl, !bl.paused, 'scramble');
$('#scrambleArena').addEventListener('pointerdown', e => {     // click anywhere: the rocket flies toward that spot
  if (!bl || bl.paused || bl.phase !== 'play' || e.button > 0 || e.target.closest('.pause-overlay') || bl.miner.stunned) return;
  e.preventDefault(); bl.dash = null;
  const rect = $('#scrambleArena').getBoundingClientRect();
  bl.aim = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  scrambleLaunch(bl.aim.x, bl.aim.y);
});
$('#scrambleArena').addEventListener('pointermove', e => {
  if (!bl) return;
  const rect = $('#scrambleArena').getBoundingClientRect();
  bl.aim = { x: e.clientX - rect.left, y: e.clientY - rect.top };
});
$('#scrambleQuit').onclick = () => { stopScramble(); openGames(gameDeckId); };
document.addEventListener('keydown', e => {
  if ($('#view-scramble').hidden || document.querySelector('dialog[open]')) return;
  if (['1','2','3','4'].includes(e.key)){ e.preventDefault(); scrambleHit(+e.key - 1); }
});

