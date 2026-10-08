/* ----- Shared helpers for real-time games -----
   A game state object g has: alive, paused, queued (functions waiting for resume), last (frame time). */
function later(g, fn, ms){
  setTimeout(() => { if (!g.alive) return; if (g.paused) g.queued.push(fn); else fn(); }, ms);
}
function setPaused(g, on, name){
  if (!g || !g.alive || g.phase === 'over') return;
  g.paused = on; g.last = 0;
  $(`#${name}Paused`).hidden = !on;
  $(`#${name}Pause`).textContent = on ? 'Resume' : 'Pause';
  if (!on) g.queued.splice(0).forEach(fn => fn());
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-resume]'); if (!b) return;
  const name = b.dataset.resume; setPaused({ blast: bz, scramble: bl, circuit: cg, terminal: tg, lightning: lt }[name], false, name);
});
document.addEventListener('visibilitychange', () => {     // auto-pause when you switch tabs
  if (!document.hidden) return;
  if (bl && !bl.paused) setPaused(bl, true, 'scramble');
  if (bz && !bz.paused) setPaused(bz, true, 'blast');
  if (cg && !cg.paused) setPaused(cg, true, 'circuit');
  if (tg && !tg.paused && tg.started) setPaused(tg, true, 'terminal');
  if (lt && !lt.paused) setPaused(lt, true, 'lightning');
});
document.addEventListener('keydown', e => {
  if (document.querySelector('dialog[open]') || !(e.key === 'p' || e.key === 'P' || e.key === 'Escape')) return;
  if (!$('#view-scramble').hidden && bl){ e.preventDefault(); setPaused(bl, !bl.paused, 'scramble'); }
  else if (!$('#view-blast').hidden && bz){ e.preventDefault(); setPaused(bz, !bz.paused, 'blast'); }
  else if (!$('#view-circuit').hidden && cg){ e.preventDefault(); setPaused(cg, !cg.paused, 'circuit'); }
  else if (!$('#view-lightning').hidden && lt){ e.preventDefault(); setPaused(lt, !lt.paused, 'lightning'); }
  else if (!$('#view-terminal').hidden && tg && e.key === 'Escape'){ e.preventDefault(); setPaused(tg, !tg.paused, 'terminal'); if (!tg.paused) $('#termInput').focus(); }
});

