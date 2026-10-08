/* ===================== Events ===================== */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-study],[data-opts],[data-games],[data-play],[data-quiz]'); if (!t) return;
  if (t.dataset.act === 'import') startImport();
  else if (t.dataset.act === 'home') renderHome();
  else if (t.dataset.study) startStudy(t.dataset.study);
  else if (t.dataset.opts) openOptions(t.dataset.opts);
  else if (t.dataset.games) openGames(t.dataset.games);
  else if (t.dataset.play) playGame(t.dataset.play);
  else if (t.dataset.quiz) openQuizSetup(t.dataset.quiz);
});
$('#homeBtn').onclick = renderHome;
$('#importBtn').onclick = startImport;
$('#fileIn').onchange = e => loadFile(e.target.files[0]);
const drop = $('#drop');
['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
$('#hasHeader').onchange = buildColumnSelects;
$('#colFront').onchange = renderPreview; $('#colBack').onchange = renderPreview;
document.querySelectorAll('input[name=target]').forEach(r => r.onchange = syncTarget);
$('#doImport').onclick = doImport;
$('#showBtn').onclick = reveal;
document.querySelectorAll('.rate').forEach(b => b.onclick = () => rate(+b.dataset.g));
$('#endBtn').onclick = () => { if (ses && ses.reviewed) finishSession(); else { ses = null; renderHome(); } };
document.addEventListener('keydown', e => {
  if ($('#view-study').hidden || document.querySelector('dialog[open]')) return;
  if (e.target.matches('input,select,textarea')) return;
  if ((e.key === ' ' || e.key === 'Enter') && !$('#answerBar').hidden){ e.preventDefault(); reveal(); }
  else if (['1','2','3','4'].includes(e.key)){ e.preventDefault(); rate(+e.key); }
});

