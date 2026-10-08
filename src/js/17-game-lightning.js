/* ----- Game: Lightning -----
   A thunderstorm true-or-false sprint: is this answer the right match for the prompt? */
// Every right answer adds time and every wrong one takes it away, so good players can keep a storm going for a long time.
// After 5 minutes the reward shrinks so games still end eventually.
const LT_PENALTY = 5, LT_BONUS = 5, LT_BONUS_LATE = 3, LT_LATE_AFTER = 300, LT_STREAK_STEP = 5, LT_MAX_MULT = 4;
let lt = null;
function stopLightning(){ if (lt){ lt.alive = false; clearInterval(lt.timer); lt = null; } }
GAMES.push({
  id: 'lightning', name: 'Lightning', minCards: 2,
  desc: 'A prompt and an answer flash up. Decide true or false as fast as you can. Right answers add 5 seconds, wrong ones take 5 away, and streaks multiply your points.',
  usable: deck => matchPick(deck, Infinity),
  settings: [PROMPT_SETTING, { key: 'secs', label: 'Starting time', default: 60, options: () => [30, 60, 90].map(x => ({ value: x, label: `${x} seconds` })) }],
  summary(deck){ return `${promptLabel(gameSetting(deck, this, 'dir'))}, starts with ${gameSetting(deck, this, 'secs')} seconds`; },
  start(deck){
    const dir = gameSetting(deck, this, 'dir'), secs = gameSetting(deck, this, 'secs');
    stopLightning(); show('lightning');
    const cards = matchPick(deck, Infinity);
    lt = { deckId: deck.id, dir, secs, cards, order: shuffle(cards), idx: 0, timeLeft: secs, elapsed: 0, score: 0, streak: 0, bestStreak: 0,
           correct: 0, total: 0, missed: new Map(), alive: true, paused: false, phase: 'play', queued: [], last: 0, tickAt: performance.now() };
    $('#lightningPaused').hidden = true; $('#lightningPause').textContent = 'Pause';
    ltHud(); ltNext();
    lt.timer = setInterval(() => {
      if (!lt) return;
      const now = performance.now();
      if (!lt.paused && lt.phase !== 'over'){ lt.timeLeft -= (now - lt.tickAt) / 1000; lt.elapsed += (now - lt.tickAt) / 1000; }
      lt.tickAt = now;
      if (lt.phase !== 'over' && lt.timeLeft <= 0){ lt.timeLeft = 0; ltHud(); return ltEnd(); }
      ltHud();
    }, 100);
  }
});
const ltMult = () => Math.min(LT_MAX_MULT, 1 + Math.floor(lt.streak / LT_STREAK_STEP));
function ltHud(){
  $('#ltScore').textContent = lt.score; $('#ltStreak').textContent = lt.streak;
  $('#ltMult').textContent = ltMult() > 1 ? `\u00d7${ltMult()}` : '';
  const t = Math.ceil(lt.timeLeft); $('#ltTime').textContent = t; $('#ltTime').classList.toggle('low', t <= 10);
}
function ltNext(){
  if (lt.idx >= lt.order.length){ lt.order = shuffle(lt.cards); lt.idx = 0; }
  const c = lt.order[lt.idx++], q = x => lt.dir === 'front' ? x.front : x.back, a = x => lt.dir === 'front' ? x.back : x.front;
  const others = lt.cards.filter(x => x.id !== c.id);
  lt.card = c; lt.truth = !others.length || Math.random() < 0.5;
  lt.shown = lt.truth ? a(c) : a(others[Math.floor(Math.random() * others.length)]);
  $('#ltPrompt').textContent = q(c); $('#ltAnswer').textContent = lt.shown;
  $('#ltCard').classList.remove('zap', 'miss');
  lt.phase = 'play';
}
function ltFlash(text, bad){
  const b = $('#ltBonus'); b.textContent = text; b.classList.toggle('bad', !!bad); b.classList.add('show');
  clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 800);
  const f = $('#ltFlash'); f.classList.remove('on', 'bad'); void f.offsetWidth; f.classList.add('on'); f.classList.toggle('bad', !!bad);
}
function ltBolt(){                                   // a fresh jagged bolt from the clouds down to the card
  const arena = $('#ltArena'), W = arena.clientWidth, H = arena.clientHeight, card = $('#ltCard');
  const endY = card.offsetTop - card.offsetHeight / 2, endX = W / 2 + (Math.random() - 0.5) * W * 0.3;
  let x = endX + (Math.random() - 0.5) * W * 0.4, y = 0, d = `M${x} ${y}`, branch = '';
  const steps = 7;
  for (let i = 1; i <= steps; i++){
    y = endY * i / steps; x = i === steps ? endX : x + (endX - x) / (steps - i + 1) + (Math.random() - 0.5) * 60;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    if (i === 3) branch = `M${x.toFixed(1)} ${y.toFixed(1)} l${(Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 40)} ${40 + Math.random() * 30} l${(Math.random() - 0.5) * 30} 30`;
  }
  const svg = $('#ltBolt'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `<path d="${d}"/><path class="branch" d="${branch}"/>`;
  svg.classList.remove('on'); void svg.offsetWidth; svg.classList.add('on');
}
function ltNote(text){                                // quiet time reminder, without the sky flash
  const b = $('#ltBonus'); b.textContent = text; b.classList.remove('bad'); b.classList.add('show');
  clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 600);
}
function ltAnswer(said){
  if (!lt || lt.paused || lt.phase !== 'play') return;
  lt.phase = 'between'; lt.total++;
  const card = $('#ltCard');
  if (said === lt.truth){
    lt.streak++; lt.bestStreak = Math.max(lt.bestStreak, lt.streak); lt.correct++;
    lt.score += 100 * ltMult();
    const gain = lt.elapsed >= LT_LATE_AFTER ? LT_BONUS_LATE : LT_BONUS;
    lt.timeLeft += gain;
    card.classList.add('zap'); ltBolt();
    if (lt.streak % LT_STREAK_STEP === 0 && ltMult() <= LT_MAX_MULT) ltFlash(`${lt.streak} in a row! \u00d7${ltMult()} points, +${gain}s`);
    else ltNote(`+${gain}s`);
    ltHud(); later(lt, ltNext, 260);
  } else {
    lt.streak = 0; lt.timeLeft = Math.max(0, lt.timeLeft - LT_PENALTY); lt.missed.set(lt.card.id, lt.card);
    card.classList.add('miss');
    const arena = $('#ltArena'); arena.classList.remove('shake'); void arena.offsetWidth; arena.classList.add('shake', 'hurt');
    setTimeout(() => arena.classList.remove('hurt'), 300);
    ltFlash(`-${LT_PENALTY}s. That was ${lt.truth ? 'true' : 'false'}.`, true);
    ltHud(); later(lt, ltNext, 700);
  }
}
function ltEnd(){
  lt.phase = 'over';
  $('#ltPrompt').textContent = 'The storm has passed'; $('#ltAnswer').textContent = ''; $('#ltCard').classList.remove('zap', 'miss');
  later(lt, () => {
    const g = lt, deck = getDeck(g.deckId), store = gameStore(deck, 'lightning'), key = `${g.dir}-${g.secs}`;
    const prev = store.best[key] || 0, isBest = g.score > prev;
    if (isBest){ store.best[key] = g.score; save(); }
    const missed = [...g.missed.values()].slice(0, 10);
    const list = missed.length ? `<br><br>Cards worth reviewing:<ul class="review-list">${missed.map(c => `<li>${esc(c.front)}: ${esc(c.back)}</li>`).join('')}</ul>` : '';
    showResults({
      title: isBest && prev ? 'New high score!' : "Time's up",
      msg: (isBest && prev ? `<span class="new-best">You beat your old record of ${prev}.</span>`
          : prev ? `Your high score with these settings is ${prev}.` : 'First game with these settings. Play again to beat it.') + list,
      stats: [['Score', String(g.score)], ['Correct', `${g.correct}/${g.total}`], ['Best streak', String(g.bestStreak)], ['Time survived', fmtClock(g.elapsed * 1000)]]
    });
  }, 1000);
}
$('#ltArena').addEventListener('click', e => { const b = e.target.closest('[data-lt]'); if (b) ltAnswer(b.dataset.lt === '1'); });
document.addEventListener('keydown', e => {
  if ($('#view-lightning').hidden || !lt || document.querySelector('dialog[open]')) return;
  if (e.key === 'ArrowLeft'){ e.preventDefault(); ltAnswer(true); }
  if (e.key === 'ArrowRight'){ e.preventDefault(); ltAnswer(false); }
});
$('#lightningPause').onclick = () => lt && setPaused(lt, !lt.paused, 'lightning');
$('#lightningQuit').onclick = () => { stopLightning(); openGames(gameDeckId); };

