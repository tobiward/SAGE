/* ===================== Help ===================== */
function openHelp(topic){
  show('help');
  if (topic){ const el = $(`#help-${topic}`); if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' })); }
}
$('#helpBtn').onclick = () => openHelp();
document.addEventListener('click', e => {
  const b = e.target.closest('[data-help]'); if (!b) return;
  e.preventDefault(); openHelp(b.dataset.help);
});
$('#helpOpenAI').onclick = openAI;
$('#pasteUse').onclick = () => {
  const raw = $('#pasteText').value.trim();
  if (!raw) return toast('Paste some text first.');
  importText(raw, 'Pasted cards.csv', parsePasted(raw));
};

