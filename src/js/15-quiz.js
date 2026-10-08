/* ===================== Quiz =====================
   A one-page test built from a deck: multiple choice, true or false, and fill in the missing word (picked from a word list).
   Mouse only, no typing. Settings are remembered per deck. If the "mark missed cards as Hard" setting is on,
   missed cards that have been studied are rated Hard and made due now; otherwise the schedule is untouched. */
const QUIZ_TYPES = { mc: 'Multiple choice', tf: 'True or false', fill: 'Fill in the missing word' };
const QUIZ_HOW = { mc: 'Choose the matching answer.', tf: 'Is this the matching answer? Choose true or false.', fill: 'Choose the word that completes the answer.' };
const QUIZ_DEFAULTS = { count: 10, types: ['mc', 'tf', 'fill'], dir: 'back', feedback: 'instant', hard: false, bump: true };
let qz = null, quizDeckId = null;
const qClean = t => String(t).replace(/\s+/g, ' ').trim();
const qKey = t => qClean(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const quizUsable = deck => deck.cards.filter(c => qClean(c.front) && qClean(c.back));
function quizSettings(deck){                       // saved settings, dropping any question type that no longer exists
  const st = { ...QUIZ_DEFAULTS, ...(deck.quiz?.settings || {}) };
  st.types = st.types.filter(t => QUIZ_TYPES[t]);
  if (!st.types.length) st.types = QUIZ_DEFAULTS.types.slice();
  return st;
}

function openQuizSetup(deckId){
  const deck = getDeck(deckId); if (!deck) return renderHome();
  quizDeckId = deckId;
  const n = quizUsable(deck).length, st = quizSettings(deck);
  $('#qsTitle').textContent = `Quiz: ${deck.name}`;
  const last = deck.quiz?.last;
  $('#qsLast').textContent = n < 2 ? 'Add at least 2 cards with a front and back to take a quiz.'
    : last ? `Last quiz: ${last.pct}% on ${plural(last.n, 'question')}, ${new Date(last.date).toLocaleDateString()}.` : `${plural(n, 'card')} available.`;
  const counts = [5, 10, 15, 20, 30].filter(x => x < n);
  $('#qsCount').innerHTML = counts.map(x => `<option value="${x}">${x}</option>`).join('') + `<option value="0">All ${n}</option>`;
  $('#qsCount').value = String(counts.includes(st.count) ? st.count : 0);
  $('#qsDir').value = st.dir; $('#qsFeedback').value = st.feedback; $('#qsHard').checked = !!st.hard; $('#qsBump').checked = !!st.bump;
  document.querySelectorAll('#qsTypes input').forEach(b => b.checked = st.types.includes(b.value));
  $('#qsStart').disabled = n < 2;
  show('quizsetup');
}
$('#qsStart').onclick = () => {
  const deck = getDeck(quizDeckId);
  const st = { count: +$('#qsCount').value, dir: $('#qsDir').value, feedback: $('#qsFeedback').value, hard: $('#qsHard').checked, bump: $('#qsBump').checked,
               types: [...document.querySelectorAll('#qsTypes input:checked')].map(b => b.value) };
  if (!st.types.length) return toast('Pick at least one question type.');
  deck.quiz = deck.quiz || {}; deck.quiz.settings = st; save();
  quizStart(deck, st, null);
};

// Word list for a fill-in question: the right word plus 3 from the deck, preferring ones of a similar length.
// Word list for a fill-in question: the right word plus 3 decoys that fit the same spot in the sentence (see pickDecoys).
const quizWordBank = (expected, whole, side, card, all, sentence) => shuffle([expected, ...pickDecoys(expected, whole, side, card, all, sentence)]);
function quizBuild(deck, st, onlyCards){
  const all = quizUsable(deck);
  let pool = onlyCards ? onlyCards.slice() : all.slice();
  if (st.hard && !onlyCards){      // most-forgotten and hardest cards first, with a little shuffle among equals
    pool = pool.map(c => ({ c, k: (c.lapses || 0) * 3 + (c.state === 'new' ? 0 : c.d || 0) + Math.random() }))
               .sort((a, b) => b.k - a.k).map(x => x.c);
  } else pool = shuffle(pool);
  if (!onlyCards && st.count) pool = pool.slice(0, st.count);
  const types = shuffle(st.types);
  return shuffle(pool).map((c, i) => {
    const dir = st.dir === 'mixed' ? (Math.random() < 0.5 ? 'back' : 'front') : st.dir, side = dir === 'back' ? 'back' : 'front';
    const prompt = qClean(dir === 'back' ? c.front : c.back), answer = qClean(c[side]);
    const others = [...new Map(all.filter(o => o.id !== c.id).map(o => qClean(o[side]))
                     .filter(a => qKey(a) !== qKey(answer)).map(a => [qKey(a), a])).values()];
    const q = { card: c, type: types[i % types.length], prompt, answer, user: null, correct: null };
    if (q.type === 'mc'){ q.options = shuffle([answer, ...shuffle(others).slice(0, 3)]); q.right = q.options.indexOf(answer); }
    if (q.type === 'tf'){
      q.truth = !others.length || Math.random() < 0.5;
      q.candidate = q.truth ? answer : others[Math.floor(Math.random() * others.length)];
      q.options = ['True', 'False']; q.right = q.truth ? 0 : 1;
    }
    if (q.type === 'fill'){
      const g = termPickGap(answer);
      q.before = answer.slice(0, g.start); q.after = answer.slice(g.end); q.expected = answer.slice(g.start, g.end);
      q.options = quizWordBank(q.expected, g.whole, side, c, all, answer); q.right = q.options.indexOf(q.expected);
      q.labels = washCase(q.options);           // capitals mustn't hint at the answer
    }
    return q;
  });
}
function quizStart(deck, st, onlyCards){
  qz = { deckId: deck.id, st, qs: quizBuild(deck, st, onlyCards), graded: false, retry: !!onlyCards };
  $('#qzTitle').textContent = `Quiz: ${deck.name}`;
  const used = [...new Set(qz.qs.map(q => QUIZ_TYPES[q.type].toLowerCase()))];
  $('#qzSub').textContent = `${plural(qz.qs.length, 'question')}${qz.retry ? ', retrying the ones you missed' : ''}. ` +
    `${used.join(', ').replace(/^./, c => c.toUpperCase())}.`;
  $('#qzScore').hidden = true; $('#qzScore').innerHTML = '';
  $('#qzList').innerHTML = qz.qs.map((q, i) => `<li class="pq" id="pq-${i}"></li>`).join('');
  qz.qs.forEach((q, i) => quizRenderQ(i));
  quizFoot(); quizProgress();
  show('quiz');
}
const quizShowsResult = q => qz.graded || (qz.st.feedback === 'instant' && q.user !== null);
function quizRenderQ(i){
  const q = qz.qs[i], done = quizShowsResult(q), letters = 'ABCD';
  const li = $(`#pq-${i}`);
  li.className = 'pq' + (done ? (q.correct ? ' right' : ' wrong') : '');
  let body = `<p class="pq-text">${esc(q.prompt)}</p>`;
  if (q.type === 'tf') body += `<p class="pq-claim"><span class="lbl">Answer:</span> ${esc(q.candidate)}</p>`;
  if (q.type === 'fill'){
    const chosen = q.user === null ? '' : done && q.correct ? q.options[q.user] : (q.labels || q.options)[q.user];
    body += `<p class="pq-claim">${esc(q.before)}<span class="pq-blank">${esc(chosen)}</span>${esc(q.after)}</p>`;
  }
  body += `<div class="pq-opts${q.type === 'mc' ? '' : ' row'}">` + q.options.map((o, k) => {
    const cls = ['pq-opt', q.user === k ? 'sel' : '', done && k === q.right ? 'is-answer' : '', done && q.user === k && !q.correct ? 'is-wrong' : ''].join(' ');
    return `<button class="${cls.trim()}" data-q="${i}" data-o="${k}" ${done ? 'disabled' : ''}><span class="bubble">${letters[k]}</span><span class="txt">${esc((q.labels || q.options)[k])}</span></button>`;
  }).join('') + '</div>';
  if (done){
    const correctText = q.type === 'tf' ? (q.truth ? 'True' : `False. The matching answer is "${q.answer}"`) : q.options[q.right];
    body += q.correct ? '<p class="pq-result ok">Correct</p>'
      : `<p class="pq-result bad">${q.user === null ? 'Not answered' : 'Incorrect'}. The answer is ${esc(correctText)}.</p>`;
  }
  li.innerHTML = `<div class="pq-head"><span class="pq-num">${i + 1}.</span><span class="pq-type">${QUIZ_HOW[q.type]}</span></div>${body}`;
}
function quizProgress(){
  const n = qz.qs.length, answered = qz.qs.filter(q => q.user !== null).length;
  $('#qzProgress').textContent = qz.graded ? 'Quiz graded' : `Answered ${answered} of ${n}`;
}
function quizFoot(){
  $('#qzFoot').innerHTML = !qz.graded && qz.st.feedback === 'end' ? '<button class="btn primary" id="qzSubmit">Submit quiz</button>' : '';
}
$('#qzList').addEventListener('click', e => {
  const b = e.target.closest('.pq-opt'); if (!b || b.disabled || !qz || qz.graded) return;
  const i = +b.dataset.q, k = +b.dataset.o, q = qz.qs[i];
  if (quizShowsResult(q)) return;
  q.user = k; q.correct = k === q.right;                  // when grading at the end, answers can still be changed
  quizRenderQ(i); quizProgress();
  if (qz.st.feedback === 'instant' && qz.qs.every(x => x.user !== null)) quizGrade();
});
$('#qzFoot').addEventListener('click', async e => {
  if (!e.target.closest('#qzSubmit') || !qz) return;
  const blank = qz.qs.filter(q => q.user === null).length;
  if (blank && !await askConfirm('Submit the quiz?', `${plural(blank, 'question')} ${blank === 1 ? 'is' : 'are'} unanswered and will count as missed.`, 'Submit quiz')) return;
  quizGrade();
});
function quizGrade(){
  qz.graded = true;
  qz.qs.forEach(q => { if (q.user === null) q.correct = false; });
  qz.qs.forEach((q, i) => quizRenderQ(i));
  const deck = getDeck(qz.deckId), n = qz.qs.length, right = qz.qs.filter(q => q.correct).length, pct = Math.round(right / n * 100);
  const missed = qz.qs.filter(q => !q.correct).length;
  deck.quiz = deck.quiz || {}; deck.quiz.last = { pct, n, date: Date.now() };
  // Optional link to flash cards: each missed card that has been studied gets a Hard rating's difficulty bump and is due now.
  let bumped = 0;
  if (qz.st.bump){
    const ids = new Set(qz.qs.filter(q => !q.correct).map(q => q.card.id)), now = Date.now();
    for (const c of deck.cards){
      if (!ids.has(c.id) || c.state === 'new') continue;
      c.d = nextD(c.d, 2); c.due = Math.min(c.due, now); bumped++;
    }
  }
  save();
  const bumpNote = bumped ? `<div class="hint">${plural(bumped, 'missed card')} marked Hard and due in flash cards now.</div>` : '';
  $('#qzScore').innerHTML = `<div class="score-big">${pct}%</div><div>${right} of ${plural(n, 'question')} correct${bumpNote}</div>
    <div class="actions">${missed ? `<button class="btn primary" id="qdRetry">Retry missed (${missed})</button>` : ''}
      <button class="btn" id="qdNew">New quiz</button><button class="btn" data-act="home">Back to decks</button></div>`;
  $('#qzScore').hidden = false;
  quizFoot(); quizProgress();
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
$('#qzScore').addEventListener('click', e => {
  if (!qz) return;
  if (e.target.closest('#qdRetry')){
    const deck = getDeck(qz.deckId), cards = [...new Set(qz.qs.filter(q => !q.correct).map(q => q.card))];
    quizStart(deck, qz.st, cards);
  } else if (e.target.closest('#qdNew')) openQuizSetup(qz.deckId);
});
$('#qzQuit').onclick = async () => {
  if (qz && !qz.graded && qz.qs.some(q => q.user !== null) && !await askConfirm('Leave the quiz?', 'Your answers will not be scored.', 'Leave quiz')) return;
  openQuizSetup(qz ? qz.deckId : quizDeckId);
};

