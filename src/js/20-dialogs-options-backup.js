/* ===================== Confirmation ===================== */
function askConfirm(title, msg, yesLabel){
  return new Promise(resolve => {
    const dlg = $('#confirmDlg');
    $('#confirmTitle').textContent = title; $('#confirmMsg').textContent = msg; $('#confirmYes').textContent = yesLabel;
    const done = ok => { dlg.onclose = null; if (dlg.open) dlg.close(); resolve(ok); };
    $('#confirmYes').onclick = () => done(true);
    $('#confirmNo').onclick = () => done(false);
    dlg.onclose = () => done(false);       // Esc or click outside
    dlg.showModal(); $('#confirmNo').focus();
  });
}

/* ===================== Deck options ===================== */
let optDeckId = null;
function openOptions(id){
  const d = getDeck(id); optDeckId = id;
  $('#setName').value = d.name; $('#setNew').value = d.settings.newPerDay; $('#setSession').value = d.settings.sessionSize;
  $('#setRet').value = Math.round(d.settings.retention * 100); $('#retVal').textContent = $('#setRet').value + '%';
  $('#settingsDlg').showModal();
}
// X button closes any dialog without saving
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close('cancel'));
// Clicking the dark area outside a dialog also closes it without saving
document.querySelectorAll('dialog').forEach(dlg => dlg.addEventListener('click', e => {
  if (e.target !== dlg) return;
  const r = dlg.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close('cancel');
}));
$('#setRet').addEventListener('input', e => $('#retVal').textContent = e.target.value + '%');
$('#saveOpts').onclick = () => {
  const d = getDeck(optDeckId); if (!d) return;
  if (!$('#setName').value.trim()){ toast('Give the deck a name.'); $('#setName').focus(); return; }
  d.name = $('#setName').value.trim() || d.name;
  d.settings.newPerDay = Math.max(0, Math.min(9999, parseInt($('#setNew').value, 10) || 0));
  d.settings.sessionSize = Math.max(1, Math.min(9999, parseInt($('#setSession').value, 10) || 1));
  d.settings.retention = Math.max(0.7, Math.min(0.97, +$('#setRet').value / 100));
  save(); $('#settingsDlg').close(); renderHome(); toast('Options saved');
};
$('#resetDeck').onclick = async () => {
  const d = getDeck(optDeckId);
  if (!await askConfirm('Reset progress?', `Every card in "${d.name}" becomes new again. Your cards are kept.`, 'Reset progress')) return;
  d.cards = d.cards.map(c => newCard(c.front, c.back)); d.today = { date: todayKey(), newCount: 0 };
  save(); $('#settingsDlg').close(); renderHome(); toast('Progress reset');
};
$('#deleteDeck').onclick = async () => {
  const d = getDeck(optDeckId);
  if (!await askConfirm('Delete deck?', `"${d.name}" and all ${d.cards.length} cards will be removed. This can't be undone.`, 'Delete deck')) return;
  db.decks = db.decks.filter(x => x.id !== optDeckId);
  save(); $('#settingsDlg').close(); renderHome(); toast('Deck deleted');
};

/* ===================== Backup ===================== */
$('#backupBtn').onclick = () => $('#backupDlg').showModal();
$('#closeBackup').onclick = () => $('#backupDlg').close();
$('#exportBtn').onclick = exportBackup;          // defined in data-safety
$('#restoreIn').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 50 * 1048576){ toast('That file is too large to be a SAGE backup.'); e.target.value = ''; return; }
  const r = new FileReader();
  r.onload = async () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || !Array.isArray(data.decks)) throw 0;
      const clean = cleanDb(data);
      if (!await askConfirm('Restore backup?', `Your current decks will be replaced with the ${data.decks.length} deck(s) in this backup.`, 'Replace decks')){ e.target.value = ''; return; }
      db = clean; save(); $('#backupDlg').close(); renderHome(); toast('Backup restored');
    } catch { toast('That file is not a valid backup.'); }
    e.target.value = '';
  };
  r.readAsText(f);
};

/* ===================== Sample deck ===================== */
$('#sampleBtn').onclick = () => {
  const d = makeDeck('Sample: world capitals');
  [['France','Paris'],['Japan','Tokyo'],['Canada','Ottawa'],['Australia','Canberra'],['Brazil','Brasília'],
   ['Kenya','Nairobi'],['Norway','Oslo'],['Peru','Lima'],['Egypt','Cairo'],['South Korea','Seoul']]
   .forEach(([f,b]) => d.cards.push(newCard(f, b)));
  db.decks.push(d); save(); renderHome();
};

