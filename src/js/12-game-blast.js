/* ----- Game: Blast ----- */
const BLAST_ENTER_SECONDS = 0.45, BLAST_EXIT_SPEED = 1100;     // how planets arrive and leave between rounds
const BLAST_STREAK_MAX = 10, BLAST_FAST_SECONDS = 5, BLAST_STREAK_BONUS = 5, BLAST_WRONG_PENALTY = 2;
const BLAST_FIRST_GOAL = 10, BLAST_GOAL_STEP = 2;   // level 1 needs 10 correct, then 12, 14, ...
let bz = null;
function stopBlast(){ if (bz){ bz.alive = false; cancelAnimationFrame(bz.raf); bz = null; } }
const blastAns = c => bz.dir === 'front' ? c.back : c.front;
const blastQ = c => bz.dir === 'front' ? c.front : c.back;
GAMES.push({
  id: 'blast', name: 'Blast', minCards: 4,
  desc: 'Answers bounce around space. Shoot enough right answers to clear each level before time runs out. Every level resets the clock, multiplies your points, and asks for 2 more answers.',
  usable: deck => matchPick(deck, Infinity),
  settings: [PROMPT_SETTING,
    { key: 'secs', label: 'Time per level', default: 60, options: () => [30, 60, 90, 120].map(x => ({ value: x, label: `${x} seconds` })) },
    { key: 'lives', label: 'Lives', default: 3, hint: `With unlimited lives, a wrong shot costs ${BLAST_WRONG_PENALTY} seconds instead.`,
      options: () => [1, 3, 5, 0].map(x => ({ value: x, label: x ? livesText(x) : 'Unlimited' })) }],
  summary(deck){
    return `${promptLabel(gameSetting(deck, this, 'dir'))}, ${gameSetting(deck, this, 'secs')} seconds per level, ${livesText(gameSetting(deck, this, 'lives'))}`;
  },
  start(deck){
    const dir = gameSetting(deck, this, 'dir'), secs = gameSetting(deck, this, 'secs'), lives = gameSetting(deck, this, 'lives');
    show('blast');
    bz = { id: uid(), deckId: deck.id, dir, secs, cards: matchPick(deck, Infinity), order: [], idx: 0,
           timeLeft: secs, clock: 0, levelCorrect: 0, levelGoal: BLAST_FIRST_GOAL, lives, maxLives: lives, score: 0, correct: 0, level: 1, streak: 0, bestStreak: 0, rocks: [], phase: 'between',
           raf: 0, last: 0, roundStart: 0, missed: new Map(), alive: true, paused: false, queued: [] };
    bz.order = shuffle(bz.cards); bz.flyers = [];
    $('#blastArena').querySelectorAll('.astro').forEach(e => e.remove());
    $('#blastPaused').hidden = true; $('#blastPause').textContent = 'Pause';
    $('#blastStreak').innerHTML = '<i></i>'.repeat(BLAST_STREAK_MAX);
    blastHud(); blastRound();
    bz.raf = requestAnimationFrame(blastTick);
  }
});
function blastHud(){
  $('#blastScore').textContent = bz.score;
  $('#blastLives').textContent = bz.maxLives ? '\u2665'.repeat(bz.lives) + '\u2661'.repeat(bz.maxLives - bz.lives) : '';
  $('#blastLives').setAttribute('aria-label', bz.maxLives ? `${bz.lives} lives left` : 'Unlimited lives');
  const t = Math.max(0, Math.ceil(bz.timeLeft));
  $('#blastTime').textContent = t; $('#blastTime').classList.toggle('low', t <= 10);
  $('#blastLvl').innerHTML = `Lvl ${bz.level} <span class="mult">\u00d7${bz.level} points</span>`;
  $('#blastProg').textContent = `${bz.levelCorrect}/${bz.levelGoal}`;
  $('#blastBar').style.width = (bz.levelCorrect / bz.levelGoal * 100) + '%';
  document.querySelectorAll('#blastStreak i').forEach((el, i) => el.classList.toggle('on', i < bz.streak));
}
function blastFlash(text, bad){
  const b = $('#blastBonus'); b.textContent = text; b.classList.toggle('bad', !!bad); b.classList.add('show');
  clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 900);
}
function blastRound(){
  const arena = $('#blastArena');
  for (const r of bz.rocks) if (!bz.flyers.includes(r)) r.el.remove();     // leftovers from last round (flyers remove themselves)
  if (bz.idx >= bz.order.length){ bz.order = shuffle(bz.cards); bz.idx = 0; }
  const c = bz.order[bz.idx++]; bz.card = c;
  const count = Math.min(bz.cards.length, 4 + (bz.level >= 3) + (bz.level >= 5));     // more targets at higher levels
  const options = shuffle([c, ...shuffle(bz.cards.filter(x => x.id !== c.id)).slice(0, count - 1)]);
  const W = arena.clientWidth, H = arena.clientHeight;
  const size = Math.round(Math.max(96, Math.min(160, W / (count + 0.8))));
  const speed = 45 + (bz.level - 1) * 14;
  const placed = [];
  bz.rocks = options.map(o => {
    let x, y, tries = 0;
    do { x = Math.random() * (W - size); y = 40 + Math.random() * (H - size - 120); tries++; }
    while (tries < 40 && placed.some(p => Math.hypot(p.x - x, p.y - y) < size * 1.05));
    placed.push({ x, y });
    const ang = Math.random() * Math.PI * 2;
    const el = document.createElement('button');
    const text = blastAns(o);
    el.className = `astro p${Math.floor(Math.random() * 6)}` + (text.length > 90 ? ' xlong' : text.length > 45 ? ' long' : '');
    const label = document.createElement('span'); label.className = 'astro-text'; label.textContent = text; el.append(label);
    el.style.width = el.style.height = size + 'px';
    // Fly in from whichever edge (top, left, or right) is closest to the planet's spot.
    const fromTop = y, fromLeft = x, fromRight = W - size - x, m = Math.min(fromTop, fromLeft, fromRight);
    const sx = m === fromLeft ? -size - 30 : m === fromRight ? W + 30 : x;
    const sy = m === fromTop ? -size - 30 : y;
    el.style.transform = `translate(${sx}px,${sy}px)`;
    arena.append(el);
    return { el, x: sx, y: sy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, size, correct: o.id === c.id, alive: true,
             enter: { sx, sy, tx: x, ty: y, t: 0 } };
  });
  $('#blastPrompt').textContent = blastQ(c);
  bz.roundStart = bz.clock;      // game-clock time the round began (pauses don't count)
  bz.phase = 'play';
}
function blastTick(t){
  if (!bz) return;
  if (bz.paused){ bz.raf = requestAnimationFrame(blastTick); return; }
  const dt = bz.last ? Math.min(0.05, (t - bz.last) / 1000) : 0; bz.last = t;
  if (bz.phase !== 'over'){
    bz.timeLeft -= dt; bz.clock += dt;
    if (bz.timeLeft <= 0){ bz.timeLeft = 0; blastHud(); return blastEnd(); }
    const arena = $('#blastArena'), W = arena.clientWidth, H = arena.clientHeight;
    bz.flyers = bz.flyers.filter(f => {          // planets leaving after a correct answer
      f.x += f.vx * dt; f.y += f.vy * dt; f.el.style.transform = `translate(${f.x}px,${f.y}px)`;
      const gone = f.x < -f.size - 60 || f.x > W + 60 || f.y < -f.size - 60 || f.y > H + 60;
      if (gone) f.el.remove();
      return !gone;
    });
    const rocks = bz.rocks.filter(r => r.alive && !r.enter);
    for (const r of bz.rocks){                    // planets arriving: ease into place
      if (!r.alive || !r.enter) continue;
      const e = r.enter; e.t = Math.min(1, e.t + dt / BLAST_ENTER_SECONDS);
      const k = 1 - Math.pow(1 - e.t, 3);
      r.x = e.sx + (e.tx - e.sx) * k; r.y = e.sy + (e.ty - e.sy) * k;
      r.el.style.transform = `translate(${r.x}px,${r.y}px)`;
      if (e.t >= 1) r.enter = null;
    }
    for (const r of rocks){
      r.x += r.vx * dt; r.y += r.vy * dt;
      if (r.x < 0){ r.x = 0; r.vx = Math.abs(r.vx); } else if (r.x > W - r.size){ r.x = W - r.size; r.vx = -Math.abs(r.vx); }
      if (r.y < 0){ r.y = 0; r.vy = Math.abs(r.vy); } else if (r.y > H - r.size){ r.y = H - r.size; r.vy = -Math.abs(r.vy); }
    }
    for (let i = 0; i < rocks.length; i++) for (let j = i + 1; j < rocks.length; j++){   // bounce off each other
      const a = rocks[i], b = rocks[j];
      const dx = (b.x - a.x), dy = (b.y - a.y), dist = Math.hypot(dx, dy) || 1, min = (a.size + b.size) / 2;
      if (dist >= min) continue;
      const nx = dx / dist, ny = dy / dist, p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (p > 0){ a.vx -= p * nx; a.vy -= p * ny; b.vx += p * nx; b.vy += p * ny; }
      const push = (min - dist) / 2; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
    for (const r of rocks) r.el.style.transform = `translate(${r.x}px,${r.y}px)`;
    blastHud();
  }
  bz.raf = requestAnimationFrame(blastTick);
}
function blastAim(ang){
  const deg = Math.max(-85, Math.min(85, ang * 180 / Math.PI + 90));      // keep the barrel pointing upward
  $('#blastShip').style.setProperty('--aim', deg + 'deg');
}
function blastBoom(x, y){
  const b = document.createElement('div'); b.className = 'boom';
  b.style.left = x + 'px'; b.style.top = y + 'px';
  b.innerHTML = Array.from({ length: 8 }, (_, k) =>
    `<i style="--a:${k * 45 + Math.random() * 20}deg;--d:${24 + Math.random() * 14}px"></i>`).join('');
  $('#blastArena').append(b); setTimeout(() => b.remove(), 360);
}
$('#blastArena').addEventListener('pointermove', e => {
  if (!bz || bz.paused) return;
  const rect = $('#blastArena').getBoundingClientRect();
  const sx = rect.left + rect.width / 2, sy = rect.top + rect.height - 14;
  blastAim(Math.atan2(e.clientY - sy, e.clientX - sx));
});
function blastLaser(x1, y1, x2, y2, cls){
  const l = document.createElement('div');
  l.className = 'laser' + (cls ? ' ' + cls : '');
  l.style.left = x1 + 'px'; l.style.top = y1 + 'px';
  l.style.width = Math.hypot(x2 - x1, y2 - y1) + 'px';
  l.style.setProperty('--r', Math.atan2(y2 - y1, x2 - x1) + 'rad');
  $('#blastArena').append(l); setTimeout(() => l.remove(), 420);
}
function blastShoot(r, miss){
  const arena = $('#blastArena'), W = arena.clientWidth, H = arena.clientHeight;
  const sx = W / 2, sy = H - 14, tx = r.x + r.size / 2, ty = r.y + r.size / 2;
  blastAim(Math.atan2(ty - sy, tx - sx));
  blastLaser(sx, sy, tx, ty);
  if (!miss) return;
  // Wrong planet: the shot bounces off and hits the station.
  setTimeout(() => {
    blastLaser(tx, ty, sx, sy, 'reflect');
    setTimeout(() => {
      const ship = $('#blastShip'); ship.classList.add('damaged');
      setTimeout(() => ship.classList.remove('damaged'), 350);
    }, 110);
  }, 90);
}
function blastHit(r){
  if (!bz || bz.paused || bz.phase !== 'play' || !r.alive) return;
  if (r.correct){
    blastShoot(r, false);
    const took = bz.clock - bz.roundStart;
    bz.streak = took <= BLAST_FAST_SECONDS ? bz.streak + 1 : 0;      // slow answers break the streak
    bz.bestStreak = Math.max(bz.bestStreak, bz.streak);
    bz.score += (100 + bz.streak * 20) * bz.level;          // your level is your multiplier
    bz.correct++; bz.levelCorrect++;
    if (bz.streak >= BLAST_STREAK_MAX){ bz.timeLeft += BLAST_STREAK_BONUS; bz.streak = 0; blastFlash(`Streak! +${BLAST_STREAK_BONUS}s`); }
    if (bz.levelCorrect >= bz.levelGoal){                    // level cleared: reset clock, raise multiplier and goal
      bz.level++; bz.levelCorrect = 0; bz.levelGoal += BLAST_GOAL_STEP; bz.timeLeft = bz.secs;
      blastFlash(`Level ${bz.level}! Clock reset, \u00d7${bz.level} points`);
    }
    r.alive = false; r.el.classList.add('hit'); blastBoom(r.x + r.size / 2, r.y + r.size / 2);
    const arena = $('#blastArena'), W = arena.clientWidth, H = arena.clientHeight;
    bz.rocks.forEach(o => {                      // the rest fly off screen, away from the middle
      if (o === r || !o.alive) return;
      o.alive = false; o.enter = null; o.el.tabIndex = -1; o.el.style.pointerEvents = 'none';
      const dx = o.x + o.size / 2 - W / 2, dy = o.y + o.size / 2 - H * 0.45, d = Math.hypot(dx, dy) || 1;
      o.vx = dx / d * BLAST_EXIT_SPEED; o.vy = dy / d * BLAST_EXIT_SPEED; bz.flyers.push(o);
    });
    bz.phase = 'between'; blastHud(); later(bz, blastRound, 180);
  } else {
    blastShoot(r, true);
    r.el.classList.add('wrong'); r.alive = false;
    setTimeout(() => { r.el.style.transition = 'opacity .25s'; r.el.style.opacity = '0'; r.el.style.pointerEvents = 'none'; }, 200);
    bz.missed.set(bz.card.id, bz.card);
    bz.streak = 0;
    if (bz.maxLives){
      bz.lives--; blastFlash(bz.lives ? '-1 life' : 'Out of lives', true);
    } else {
      bz.timeLeft = Math.max(0, bz.timeLeft - BLAST_WRONG_PENALTY); blastFlash(`-${BLAST_WRONG_PENALTY}s`, true);
    }
    const arena = $('#blastArena'); setTimeout(() => { arena.classList.add('hurt'); setTimeout(() => arena.classList.remove('hurt'), 250); }, 200);
    blastHud();
    if (bz.maxLives && bz.lives <= 0) blastEnd('lives');
  }
}
function blastEnd(reason){
  bz.phase = 'over';
  const outOfLives = reason === 'lives';
  $('#blastPrompt').textContent = outOfLives ? 'Out of lives!' : "Time's up!";
  bz.rocks.forEach(o => { o.alive = false; });
  later(bz, () => {
    const g = bz, deck = getDeck(g.deckId), key = g.maxLives ? `${g.dir}-${g.secs}-${g.maxLives}` : `${g.dir}-${g.secs}`;
    const best = deck.games.blast.best, prev = best[key] || 0, isBest = g.score > prev;
    if (isBest){ best[key] = g.score; save(); }
    const missed = [...g.missed.values()].slice(0, 10);
    const list = missed.length ? `<br><br>Cards worth reviewing:<ul class="review-list">${missed.map(c => `<li>${esc(c.front)}: ${esc(c.back)}</li>`).join('')}</ul>` : '';
    showResults({
      title: isBest && prev ? 'New high score!' : outOfLives ? 'Out of lives' : "Time's up",
      msg: (isBest && prev ? `<span class="new-best">You beat your old record of ${prev}.</span>`
          : prev ? `Your high score with these settings is ${prev}.` : 'First game with these settings. Play again to beat it.') + list,
      stats: [['Score', String(g.score)], ['Correct', String(g.correct)], ['Best streak', String(g.bestStreak)], ['Level', String(g.level)]]
    });
  }, 1200);
}
$('#blastArena').addEventListener('pointerdown', e => {
  const el = e.target.closest('.astro'); if (!el || !bz) return;
  const r = bz.rocks.find(x => x.el === el); if (r){ e.preventDefault(); blastHit(r); }
});
$('#blastArena').addEventListener('keydown', e => {      // keyboard users: Tab to an answer, Enter or Space to shoot
  if (!(e.key === 'Enter' || e.key === ' ')) return;
  const el = e.target.closest('.astro'); if (!el || !bz) return;
  const r = bz.rocks.find(x => x.el === el); if (r){ e.preventDefault(); blastHit(r); }
});
$('#blastPause').onclick = () => bz && setPaused(bz, !bz.paused, 'blast');
$('#blastQuit').onclick = () => { stopBlast(); openGames(gameDeckId); };

