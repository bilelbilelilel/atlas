// ATLAS — orchestration. 4 onglets + le flux séance en modal.
// Aucun cul-de-sac : chaque écran se termine par la prochaine action évidente.

import { load, save } from './store.js';
import { semaineCourante, modeParDefaut } from './engine.js';
import { fmtKg } from './inventory.js';
import { h, clear, haptic, son } from './ui.js';
import { mountSprite } from './sprites.js';
import { renderOnboarding } from './screens/onboarding.js';
import { renderHome } from './screens/home.js';
import { renderProgression } from './screens/progression.js';
import { renderCorps } from './screens/corps.js';
import { renderBilan } from './screens/bilan.js';

const state = load();
let route = 'home';

const ctx = {
  state,
  persist: () => save(state),
  navigate, rerender: () => render(),
  semaine() {
    return state.settings.dateDebut
      ? semaineCourante(state.settings.dateDebut, new Date())
      : 0;
  },
  // Mode courant : décision explicite (allégée/maintien) sinon défaut par semaine.
  mode() {
    const m = state.mode || {};
    const today = new Date().toISOString().slice(0, 10);
    if ((m.type === 'allegee') && m.jusquA && m.jusquA < today) {
      state.mode = { type: modeParDefaut(this.semaine()), semaine: this.semaine(), jusquA: null };
      save(state);
    }
    if (m.type === 'allegee' || m.type === 'maintien') return state.mode.type;
    return modeParDefaut(this.semaine());
  },
  setMode(type, jours = null) {
    const jusquA = jours ? new Date(Date.now() + jours * 86400000).toISOString().slice(0, 10) : null;
    state.mode = { type, semaine: this.semaine(), jusquA };
    save(state);
  },
  celebratePalier,
};

// --- La seule fête de l'app -----------------------------------------------------

function celebratePalier(ex, it) {
  const ov = document.getElementById('palier-overlay');
  clear(ov);
  const spriteBox = h('div', { class: 'sprite-box' });
  ov.append(
    h('span', { class: 'laurier-txt' }, '— PALIER —'),
    h('div', { class: 'plaque' },
      h('div', { class: 'charge' }, it.niveau != null && ex.type === 'echelle' ? `NIVEAU ${it.niveau}` : fmtKg(it.charge)),
      h('div', { class: 'quoi' }, ex.nom),
    ),
    spriteBox,
  );
  const stop = mountSprite(spriteBox, 'palier', { scale: 5 });
  ov.classList.add('open');
  haptic.moyen();
  son(state, 'palier');
  setTimeout(() => { ov.classList.remove('open'); stop(); }, 2200);
}

// --- Navigation --------------------------------------------------------------------

const TABS = [
  ['home', 'AUJOURD’HUI', '◈'],
  ['progression', 'PROGRESSION', '▲'],
  ['corps', 'CORPS', '●'],
  ['bilan', 'BILAN', '☰'],
];

function navigate(r) { route = r; render(); }

function render() {
  const root = document.getElementById('screen');
  const nav = document.getElementById('tabs');

  if (!state.settings.onboarded) {
    nav.style.display = 'none';
    renderOnboarding(ctx, root);
    return;
  }
  nav.style.display = '';
  nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.r === route));

  if (route === 'home') renderHome(ctx, root);
  else if (route === 'progression') renderProgression(ctx, root);
  else if (route === 'corps') renderCorps(ctx, root);
  else if (route === 'bilan') renderBilan(ctx, root);
  root.scrollTop = 0;
}

function initTabs() {
  const nav = document.getElementById('tabs');
  for (const [r, label, ico] of TABS) {
    nav.append(h('button', { 'data-r': r, onclick: () => navigate(r) },
      h('span', { class: 'ico' }, ico), label));
  }
}

// --- Boot -----------------------------------------------------------------------------

initTabs();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
