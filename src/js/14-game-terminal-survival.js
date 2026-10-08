/* ----- Game: Terminal (typing) -----
   Each line is a card's front and back ("France: Paris") with one word missing.
   Four options sit above the line; you type the whole line, choosing the right word for the gap. */
let tg = null;
function stopTerminal(){ if (tg){ tg.alive = false; clearInterval(tg.timer); tg = null; } }
// Accents never count against you (most keyboards can't type them easily); the missing word also ignores capitals.
const termNorm = (ch, loose) => { const c = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return loose ? c.toLowerCase() : c; };
const termClean = t => t.replace(/\s+/g, ' ').trim();
// Words that make poor blanks: they're either too common to test anything, or give the answer away by grammar alone.
const TERM_STOP = new Set(('the a an and or of to in on at by for with from as is are was were be been it its this that these those into than then over under not no ' +
  'also very just more most some such each other only both many much onto upon your their there which when where what will would could should ' +
  'have has had does did can may might must about after before while because between through without within across every being them they ' +
  'make makes made use used uses using like well even still into same thing things something').split(' '));
const termWords = text => [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu)].map(m => ({ w: m[0], i: m.index }));
const termKey = w => termNorm(w, true);
const termGood = w => w.length >= 4 && !TERM_STOP.has(w.toLowerCase()) && !/^\d+$/.test(w);
// Pick the missing piece of one side: the whole side if it's 1-2 words, otherwise one of its most meaningful words
// (the longer content words, which tend to be the key terms) so the question actually tests something.
function termPickGap(text){
  const words = termWords(text);
  if (words.length <= 2) return { start: 0, end: text.length, whole: true };
  const good = words.filter(x => termGood(x.w)).sort((a, b) => b.w.length - a.w.length).slice(0, 3);
  const pick = good.length ? good[Math.floor(Math.random() * good.length)] : words.reduce((a, b) => b.w.length > a.w.length ? b : a);
  return { start: pick.i, end: pick.i + pick.w.length, whole: false };
}
// A word's "shape": the ending that decides where it fits in a sentence. Decoys with the same shape read naturally
// in the blank, so the right answer can't be spotted by grammar alone.
function wordShape(w){
  const x = w.toLowerCase();
  if (/(tion|sion|ment|ness|ity|ance|ence|ship|ism)$/.test(x)) return 'noun';
  if (/(tions|sions|ments|nesses|ities|ances|ences|ships|isms)$/.test(x)) return 'nouns';
  if (/ing$/.test(x)) return 'ing';
  if (/ed$/.test(x)) return 'ed';
  if (/ly$/.test(x)) return 'ly';
  if (/(ous|ive|ful|able|ible|less|ical)$/.test(x)) return 'adj';
  if (/[^s]s$/.test(x)) return 'plural';
  return 'base';
}
// Three decoys for a blank, drawn from the other cards. Same shape first, then similar length; never a word
// already visible in the sentence. Shared by Terminal and the quiz.
function pickDecoys(answer, whole, side, card, cards, sentence){
  const key = w => termNorm(w, true), shown = new Set(termWords(sentence || '').map(x => key(x.w)));
  const pool = new Map(), add = w => { const k = key(w); if (k && k !== key(answer) && !pool.has(k) && (whole || !shown.has(k))) pool.set(k, w); };
  const others = cards.filter(c => c.id !== card.id), other = side === 'front' ? 'back' : 'front', clean = t => termClean(t);
  if (whole) others.forEach(c => add(clean(c[side])));
  else others.forEach(c => termWords(clean(c[side])).forEach(x => termGood(x.w) && add(x.w)));
  if (pool.size < 3) others.forEach(c => termWords(clean(c[other])).forEach(x => termGood(x.w) && add(x.w)));
  if (pool.size < 3) others.forEach(c => { add(clean(c.front)); add(clean(c.back)); });
  const shape = wordShape(answer);
  const score = w => (whole || wordShape(w) === shape ? 0 : 6) + Math.abs(w.length - answer.length) + Math.random() * 2;
  return [...pool.values()].map(w => [score(w), w]).sort((a, b) => a[0] - b[0]).slice(0, 3).map(x => x[1]);
}
// Capital letters can give a blank away (only the answer starts a sentence, say). When the options mix
// capitals and lower case, show them all in lower case.
function washCase(options){
  const first = o => o[0] === o[0].toUpperCase() && o[0] !== o[0].toLowerCase();
  return options.every(o => first(o) === first(options[0])) ? options.slice() : options.map(o => o.toLowerCase());
}
const termDistractors = (answer, whole, side, card, sentence) => pickDecoys(answer, whole, side, card, tg.cards, sentence);
GAMES.push({
  id: 'terminal', name: 'Terminal', minCards: 4,
  desc: "Type each card's front and back as fast and accurately as you can. One word is missing; choose it from four options and type it in. Every word you type adds a second.",
  usable: deck => deck.cards.filter(c => termClean(c.front) && termClean(c.back)),
  settings: [
    { key: 'blank', label: 'Missing word from', default: 'back',
      options: () => [{ value: 'back', label: 'Back of card' }, { value: 'front', label: 'Front of card' }, { value: 'either', label: 'Either side' }] },
    { key: 'secs', label: 'Time', default: 60, options: () => [30, 60, 120].map(x => ({ value: x, label: `${x} seconds` })) }],
  summary(deck){
    const b = gameSetting(deck, this, 'blank');
    return `Missing word from ${b === 'either' ? 'either side' : `the ${b}`}, ${gameSetting(deck, this, 'secs')} seconds`;
  },
  start(deck){ termBegin(deck, this.usable(deck), { blank: gameSetting(deck, this, 'blank'), secs: gameSetting(deck, this, 'secs'), survival: false }); }
});
// Survival: same terminal and lines, but no clock, no options, and 3 lives. Tab buys the next letter of the blank for a life.
const SURVIVAL_LIVES = 3;
GAMES.push({
  id: 'survival', name: 'Survival', minCards: 2,
  desc: 'Each card appears with one word missing. Type just that word from memory. No clock and no options. You have 3 lives; spend one to reveal the next letter.',
  usable: deck => deck.cards.filter(c => termClean(c.front) && termClean(c.back)),
  settings: [{ key: 'blank', label: 'Missing word from', default: 'back',
    options: () => [{ value: 'back', label: 'Back of card' }, { value: 'front', label: 'Front of card' }, { value: 'either', label: 'Either side' }] }],
  summary(deck){ const b = gameSetting(deck, this, 'blank'); return `Missing word from ${b === 'either' ? 'either side' : `the ${b}`}, 3 lives`; },
  start(deck){ termBegin(deck, this.usable(deck), { blank: gameSetting(deck, this, 'blank'), secs: 0, survival: true }); }
});
function termBegin(deck, cards, { blank, secs, survival }){
  stopTerminal(); show('terminal');
  tg = { deckId: deck.id, blank, secs, survival, cards, order: shuffle(cards), idx: 0, typed: '', started: false, elapsed: 0,
         tickAt: performance.now(), keys: 0, goodKeys: 0, doneChars: 0, done: 0, revealed: false, gapMiss: false,
         lives: SURVIVAL_LIVES, hintN: 0, hintsUsed: 0, bonus: 0, wordsTyped: 0,
         missed: new Map(), history: [], alive: true, paused: false, phase: 'play', queued: [], last: 0 };
  const slug = deck.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
  $('#termTitle').textContent = `sage@${survival ? 'survival' : 'terminal'}: ~/${slug}`;
  tg.history = [survival ? 'SAGE SURVIVAL' : 'SAGE TERMINAL',
                survival ? `loaded ${cards.length} cards, ${SURVIVAL_LIVES} lives, no clock` : `loaded ${cards.length} cards, ${secs}s on the clock`,
                survival ? 'type the missing word to begin_' : 'start typing to begin_'].map(t => `<div>${esc(t)}</div>`);
  $('#termHistory').innerHTML = tg.history.join('');
  $('#terminalPaused').hidden = true; $('#terminalPause').textContent = 'Pause';
  $('#terminalHeading').textContent = survival ? 'Fill in the blank from memory' : 'Type each card, filling in the blank';
  $('#termKeys').textContent = survival
    ? 'Type only the missing word; it moves on as soon as it\'s right. Capitals and accents don\'t matter. Tab or the hint button reveals a letter for 1 life.'
    : 'Type the whole line, filling the blank with one of the options above it. Every word you type adds a second to the clock. Tab or the hint button shows the answer, Esc pauses.';
  $('#termHintBtn').textContent = survival ? 'Reveal a letter (costs 1 life)' : 'Show the answer';
  termNext(true); termStatus();
  if (!survival) tg.timer = setInterval(() => {
    if (!tg) return;
    const now = performance.now();
    if (tg.started && !tg.paused && tg.phase === 'play') tg.elapsed += now - tg.tickAt;
    tg.tickAt = now;
    if (tg.phase === 'play' && tg.elapsed >= tg.secs * 1000 + tg.bonus) return termEnd();
    termStatus();
  }, 100);
  $('#termInput').value = ''; $('#termInput').focus();
}
function termNext(first){
  if (tg.idx >= tg.order.length){ tg.order = shuffle(tg.cards); tg.idx = 0; }
  const c = tg.order[tg.idx++], front = termClean(c.front), back = termClean(c.back), sep = ': ';
  const side = tg.blank === 'either' ? (Math.random() < 0.5 ? 'front' : 'back') : tg.blank;
  const gap = termPickGap(side === 'front' ? front : back), offset = side === 'front' ? 0 : front.length + sep.length;
  tg.card = c; tg.typed = ''; tg.guess = ''; tg.revealed = false; tg.gapMiss = false; tg.hintN = 0; tg.lineWords = 0;
  tg.target = front + sep + back; tg.frontLen = front.length;
  tg.gap = { start: gap.start + offset, end: gap.end + offset };
  tg.answer = tg.target.slice(tg.gap.start, tg.gap.end);
  const inp = $('#termInput'); inp.value = ''; inp.maxLength = tg.target.length + 30;   // room for a wrong guess in the blank
  if (tg.survival){ $('#termOptions').innerHTML = ''; termSurvivalHint(); }
  else {
    tg.options = shuffle([tg.answer, ...termDistractors(tg.answer, gap.whole, side, c, tg.target)]);
    $('#termOptions').innerHTML = washCase(tg.options).map(o => `<span>[ ${esc(o)} ]</span>`).join('');
    $('#termHint').textContent = '';
  }
  termRender(); if (!first) termStatus();
}
const termInGap = i => i >= tg.gap.start && i < tg.gap.end;
const termOk = (typed, i) => termNorm(typed, termInGap(i)) === termNorm(tg.target[i], termInGap(i));
const termMatch = i => termOk(tg.typed[i], i);
// Has the blank been filled in correctly? (Everything typed after the blank's start, checked against the answer.)
function termGapDone(typed){
  const L = tg.answer.length, rest = typed.slice(tg.gap.start);
  return typed.length > tg.gap.start && rest.length >= L && [...tg.answer].every((c, k) => termNorm(rest[k], true) === termNorm(c, true));
}
function termSurvivalRender(){
  const g = tg.gap, T = tg.target, plain = i => `<span class="ok${i < tg.frontLen ? ' f' : ''}">${esc(T[i])}</span>`;
  let html = '';
  for (let i = 0; i < g.start; i++) html += plain(i);
  const inner = [...tg.guess].map((c, k) => `<span class="${k < tg.hintN ? 'bought' : 'guess'}">${esc(k < tg.hintN ? tg.answer[k] : c)}</span>`).join('');
  html += `<span class="gapbox">${inner}<span class="cur gap"> </span></span>`;
  for (let i = g.end; i < T.length; i++) html += plain(i);
  $('#termLine').innerHTML = html;
}
// Right/wrong colors in the blank only appear once the guess is 5 letters long, or is a complete option that's wrong,
// or is longer than every option. Before that, colors would give away the answer letter by letter.
const TERM_VERDICT_AT = 5;
function termGapVerdict(buf){
  if (!buf) return false;
  const k = termNorm(buf, true), opts = tg.options || [];
  return buf.length >= TERM_VERDICT_AT || opts.some(o => termNorm(o, true) === k) || buf.length > Math.max(0, ...opts.map(o => o.length));
}
function termRender(){
  if (tg.survival) return termSurvivalRender();
  const g = tg.gap, T = tg.target, typed = tg.typed, gapDone = termGapDone(typed);
  const plain = i => {                              // one character outside the blank
    const f = i < tg.frontLen ? ' f' : '';
    if (i < typed.length){ const ok = termMatch(i); return `<span class="${ok ? 'ok' : 'bad'}${f}">${esc(T[i])}</span>`; }
    return `<span class="${i === typed.length ? 'cur' : 'todo'}${f}">${esc(T[i])}</span>`;
  };
  let html = '';
  for (let i = 0; i < g.start; i++) html += plain(i);
  let inner = '';
  if (gapDone) inner = `<span class="ok${g.start < tg.frontLen ? ' f' : ''}">${esc(tg.answer)}</span>`;
  else {
    const buf = typed.length > g.start ? typed.slice(g.start) : '';
    if (tg.survival){                               // no right/wrong colors in the blank, so guessing gives nothing away
      [...buf].forEach((c, k) => { inner += `<span class="${k < tg.hintN ? 'bought' : 'guess'}">${esc(k < tg.hintN ? tg.answer[k] : c)}</span>`; });
      if (typed.length >= g.start) inner += '<span class="cur gap"> </span>';
      html += `<span class="gapbox">${inner}</span>`;
      for (let i = g.end; i < T.length; i++) html += `<span class="todo${i < tg.frontLen ? ' f' : ''}">${esc(T[i])}</span>`;
      $('#termLine').innerHTML = html; return;
    }
    if (!termGapVerdict(buf)){                       // too early to say: letters stay neutral so red can't point to the answer
      [...buf].forEach(c => { inner += `<span class="guess">${esc(c)}</span>`; });
    } else {
      let broken = false;                           // after the first wrong letter, the rest of the guess is wrong too
      [...buf].forEach((c, k) => {
        const ok = !broken && k < tg.answer.length && termNorm(c, true) === termNorm(tg.answer[k], true);
        if (!ok) broken = true;
        inner += `<span class="${ok ? 'ok' : 'bad'}">${esc(ok ? tg.answer[k] : c)}</span>`;
      });
    }
    if (typed.length >= g.start) inner += '<span class="cur gap"> </span>';
  }
  html += `<span class="gapbox${gapDone ? ' done' : ''}">${inner}</span>`;
  for (let i = g.end; i < T.length; i++){
    html += gapDone ? plain(i) : `<span class="todo${i < tg.frontLen ? ' f' : ''}">${esc(T[i])}</span>`;
  }
  $('#termLine').innerHTML = html;
}
function termStatus(){
  if (tg.survival){
    const hearts = '\u2665'.repeat(Math.max(0, tg.lives)) + '\u2661'.repeat(SURVIVAL_LIVES - Math.max(0, tg.lives));
    $('#termStatus').textContent = `[ ${hearts} ]  cards ${tg.done}  hints ${tg.hintsUsed}`;
    return;
  }
  const left = Math.max(0, tg.secs * 1000 + tg.bonus - tg.elapsed) / 1000, mins = tg.elapsed / 60000;
  let prefix = 0; while (prefix < tg.typed.length && termMatch(prefix)) prefix++;
  const wpm = mins > 0.02 ? Math.round((tg.doneChars + prefix) / 5 / mins) : 0;
  const acc = tg.keys ? Math.round(tg.goodKeys / tg.keys * 100) : 100;
  const secsLeft = Math.ceil(left), clock = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`;
  $('#termStatus').textContent = `[ ${tg.started ? clock : 'ready'} ]  wpm ${wpm}  acc ${acc}%  cards ${tg.done}`;
}
function termLog(){
  const clean = !tg.revealed && !tg.gapMiss && !tg.hintN;
  const label = tg.hintN ? `[hint x${tg.hintN}]` : tg.revealed ? '[shown]' : tg.gapMiss ? '[fixed]' : '[ok]';
  const piece = (a, b) => {                    // front part in blue, back part in green
    const f = Math.min(b, tg.frontLen), from = Math.max(a, tg.frontLen);
    return (a < f ? `<span class="hf">${esc(tg.target.slice(a, f))}</span>` : '') + (b > from ? esc(tg.target.slice(from, b)) : '');
  };
  const line = piece(0, tg.gap.start) + `<span class="${clean ? 'ok' : 'bad'}">${esc(tg.answer)}</span>` + piece(tg.gap.end, tg.target.length);
  tg.history.push(`<div><span class="${clean ? 'ok' : 'bad'}">${label}</span> ${line}</div>`);
  $('#termHistory').innerHTML = tg.history.slice(-5).join('');
}
$('#termInput').addEventListener('input', e => {
  if (!tg || tg.paused || tg.phase !== 'play'){ e.target.value = tg ? (tg.survival ? tg.guess : tg.typed) : ''; return; }
  if (tg.survival) return termSurvivalInput(e.target);
  let val = e.target.value.slice(0, tg.target.length + 30);
  if (tg.survival && tg.hintN && val.length < tg.gap.start + tg.hintN && tg.typed.length >= tg.gap.start + tg.hintN){
    val = tg.typed.slice(0, tg.gap.start + tg.hintN); e.target.value = val;     // letters bought with a life can't be erased
  }
  if (!tg.started){ tg.started = true; tg.tickAt = performance.now(); }
  for (let i = tg.typed.length; i < val.length; i++){                     // each new character is one keystroke
    if (tg.survival && i >= tg.gap.start && !termGapDone(val.slice(0, i))) continue;   // blank guesses aren't scored for accuracy
    tg.keys++;
    let ok;
    if (i < tg.gap.start || termGapDone(val.slice(0, i))) ok = termOk(val[i], i);
    else {                                                                  // typing inside the blank
      const k = i - tg.gap.start, sofar = val.slice(tg.gap.start, i);
      ok = k < tg.answer.length && [...sofar].every((c, j) => termNorm(c, true) === termNorm(tg.answer[j], true))
           && termNorm(val[i], true) === termNorm(tg.answer[k], true);
      if (!ok && termGapVerdict(val.slice(tg.gap.start, i + 1))) tg.gapMiss = true;   // a wrong option, once it's clearly wrong
    }
    if (ok) tg.goodKeys++;
  }
  tg.typed = val;
  termWordBonus();
  termRender(); termStatus();
  if (tg.typed.length === tg.target.length && [...tg.target].every((_, i) => termMatch(i))){
    tg.doneChars += tg.target.length + 1;           // +1 counts the "space" between lines, like normal WPM
    tg.done++;
    termFinishLine();
  }
});
// Every correctly typed word adds a second to the clock, so skilled typists can keep going well past the starting time.
const TERM_WORD_BONUS = 1000;
function termWordBonus(){
  if (tg.survival) return;
  let p = 0; while (p < tg.typed.length && termMatch(p)) p++;       // length of the correct part so far
  const done = p === tg.target.length;
  const words = (tg.target.slice(0, p).match(/\S\s/g) || []).length + (done ? 1 : 0);   // a word counts once the space after it is typed
  if (words > tg.lineWords){ const n = words - tg.lineWords; tg.lineWords = words; tg.bonus += n * TERM_WORD_BONUS; tg.wordsTyped += n; }
}
function termFinishLine(){
  if (tg.revealed || tg.gapMiss || tg.hintN) tg.missed.set(tg.card.id, tg.card);
  termLog(); termNext(false);
}
$('#termInput').addEventListener('paste', e => e.preventDefault());
$('#termInput').addEventListener('keydown', e => {
  if (!tg || tg.paused || e.key !== 'Tab') return;
  e.preventDefault(); termHintPressed();
});
// Hint: Tab, or the button under the terminal (phones and tablets have no Tab key).
function termHintPressed(){
  if (!tg || tg.paused || tg.phase !== 'play') return;
  if (tg.survival) return termBuyLetter();
  if (!tg.revealed){ tg.revealed = true; termRender(); $('#termHint').textContent = `The missing word is "${tg.answer}".`; }
}
$('#termHintBtn').addEventListener('pointerdown', e => e.preventDefault());   // keep the keyboard open on phones
$('#termHintBtn').onclick = () => { termHintPressed(); $('#termInput').focus(); };
function termSurvivalHint(){
  $('#termHint').textContent = tg.lives > 1 ? 'Type the missing word. Stuck? Press Tab or the hint button to reveal the next letter for 1 life.'
    : 'Last life. A hint still reveals a letter, but it ends the game.';
  $('#termHintBtn').textContent = tg.lives > 1 ? 'Reveal a letter (costs 1 life)' : 'Reveal a letter (ends the game)';
}
function termSurvivalInput(input){
  if (!tg.started) tg.started = true;
  let val = input.value.slice(0, tg.answer.length + 30);
  const bought = tg.answer.slice(0, tg.hintN);
  if (val.length < bought.length || termNorm(val.slice(0, bought.length), true) !== termNorm(bought, true)){
    val = bought + val.slice(bought.length);                // letters bought with a life can't be erased
  }
  input.value = val; tg.guess = val;
  termRender();
  if (termNorm(val, true) === termNorm(tg.answer, true)){ tg.done++; termStatus(); termFinishLine(); }
}
function termBuyLetter(){
  if (tg.phase !== 'play') return;
  tg.lives--; tg.hintsUsed++;
  if (tg.lives <= 0) return termEnd('lives');
  tg.hintN = Math.min(tg.answer.length, tg.hintN + 1);
  tg.guess = tg.answer.slice(0, tg.hintN);                   // your guess is replaced by the revealed letters
  $('#termInput').value = tg.guess;
  termSurvivalHint(); termRender(); termStatus();
  if (tg.hintN === tg.answer.length){ tg.done++; termFinishLine(); }
}
$('#termInput').addEventListener('focus', () => $('#term').classList.remove('blurred'));
$('#termInput').addEventListener('blur', () => $('#term').classList.add('blurred'));
$('#term').addEventListener('pointerdown', e => { if (!e.target.closest('.pause-overlay')){ e.preventDefault(); $('#termInput').focus(); } });
function termEnd(reason){
  tg.phase = 'over'; termStatus();
  $('#termOptions').textContent = ''; $('#termHint').textContent = '';
  $('#termLine').textContent = reason === 'lives' ? `> out of lives. The missing word was "${tg.answer}".` : '> time is up';
  $('#termInput').blur();
  if (tg.survival){ tg.missed.set(tg.card.id, tg.card); return later(tg, termSurvivalResults, 1600); }
  later(tg, () => {
    const g = tg, deck = getDeck(g.deckId), store = gameStore(deck, 'terminal');
    const wpm = Math.round(g.doneChars / 5 / Math.max(1 / 60, g.elapsed / 60000)), acc = g.keys ? Math.round(g.goodKeys / g.keys * 100) : 0;
    const key = `${g.blank}-${g.secs}`, prev = store.best[key] || 0, isBest = wpm > prev;
    if (isBest){ store.best[key] = wpm; save(); }
    const missed = [...g.missed.values()].slice(0, 10);
    const list = missed.length ? `<br><br>Cards worth reviewing:<ul class="review-list">${missed.map(c => `<li>${esc(c.front)}: ${esc(c.back)}</li>`).join('')}</ul>` : '';
    showResults({
      title: isBest && prev ? 'New best speed!' : 'Time is up',
      msg: (isBest && prev ? `<span class="new-best">You beat your old record of ${prev} wpm.</span>`
          : prev ? `Your best with these settings is ${prev} wpm.` : 'First run with these settings. Play again to beat it.') + list,
      stats: [['Words per minute', String(wpm)], ['Accuracy', acc + '%'], ['Cards typed', String(g.done)], ['Time played', fmtClock(g.elapsed)]]
    });
  }, 900);
}
function termSurvivalResults(){
  const g = tg, deck = getDeck(g.deckId), store = gameStore(deck, 'survival');
  const key = g.blank, prev = store.best[key] || 0, isBest = g.done > prev;
  if (isBest){ store.best[key] = g.done; save(); }
  const missed = [...g.missed.values()].slice(0, 10);
  const list = missed.length ? `<br><br>Cards worth reviewing:<ul class="review-list">${missed.map(c => `<li>${esc(c.front)}: ${esc(c.back)}</li>`).join('')}</ul>` : '';
  showResults({
    title: isBest && prev ? 'New record!' : 'Out of lives',
    msg: (isBest && prev ? `<span class="new-best">You beat your old record of ${plural(prev, 'card')}.</span>`
        : prev ? `Your record with these settings is ${plural(prev, 'card')}.` : 'First run with these settings. Play again to beat it.') + list,
    stats: [['Cards survived', String(g.done)], ['Letters revealed', String(g.hintsUsed)]]
  });
}
$('#terminalPause').onclick = () => { if (!tg) return; setPaused(tg, !tg.paused, 'terminal'); if (!tg.paused) $('#termInput').focus(); };
$('#terminalQuit').onclick = () => { stopTerminal(); openGames(gameDeckId); };

