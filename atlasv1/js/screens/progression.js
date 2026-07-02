// ATLAS — PROGRESSION. L'escalier des paliers par exercice, l'historique brut
// en Space Mono, et le Mur des paliers : chaque palier = une plaque gravée.

import { EXERCISES, SESSIONS } from '../program.js';
import { logsOf } from '../store.js';
import { fmtKg } from '../inventory.js';
import { chartEscalier } from '../charts.js';
import { h, clear, fmtDateCourt } from '../ui.js';

let selected = null;

export function renderProgression(ctx, root) {
  clear(root);
  const state = ctx.state;
  const suivis = [...new Set(Object.values(SESSIONS).flatMap((s) => s.exercices))]
    .map((id) => state.exercices[id]?.substitue || id);

  if (!selected || !suivis.includes(selected)) selected = suivis.find((id) => (state.logs[id] || []).length) || suivis[0];

  root.append(h('h2', { class: 'fade-in' }, 'Progression'));

  // Sélecteur d'exercice
  const sel = h('div', { class: 'chips', style: { flexWrap: 'wrap', justifyContent: 'flex-start', margin: '12px 0' } });
  for (const id of suivis) {
    sel.append(h('button', {
      class: 'chip' + (id === selected ? ' on' : ''),
      style: { minWidth: 'auto', padding: '8px 12px', fontSize: '12px' },
      onclick: () => { selected = id; ctx.rerender(); },
    }, EXERCISES[id].nom));
  }
  root.append(sel);

  const ex = EXERCISES[selected];
  const histo = logsOf(state, selected);

  if (!histo.length) {
    root.append(h('div', { class: 'card flat center stack' },
      h('p', { class: 'muted' }, 'Ton premier point de référence se crée à la prochaine séance.'),
      h('p', { class: 'mono small' }, 'Séance 1 = étalonnage.'),
    ));
  } else {
    root.append(
      h('div', { class: 'card' },
        h('span', { class: 'eyebrow ocre' }, 'ESCALIER DES PALIERS'),
        chartEscalier(histo, ex),
      ),
      h('div', { class: 'card' },
        h('span', { class: 'eyebrow' }, 'HISTORIQUE'),
        histo.slice(-14).reverse().map((s) => h('div', { class: 'hist-line' },
          h('b', {}, s.reps.join('·')),
          s.niveau ? ` · niveau ${s.niveau}` : (ex.type === 'lest' ? (s.charge ? ` @ +${fmtKg(s.charge)}` : ' @ corps') : ` @ ${fmtKg(s.charge ?? 0)}`),
          s.reserve?.length ? ` · R${s.reserve.at(-1)}` : '',
          ` · ${fmtDateCourt(s.d)}`,
        )),
      ),
    );
  }

  // Le Mur des paliers — le trophée du kéké, screenshotable.
  root.append(h('div', { class: 'meandre' }), h('span', { class: 'eyebrow ocre' }, 'LE MUR DES PALIERS'));
  if (!state.paliers.length) {
    root.append(h('p', { class: 'muted small', style: { marginTop: '8px' } },
      'Chaque charge conquise se grave ici. Le premier palier tombe en général semaine 3-4.'));
  } else {
    const mur = h('div', { class: 'mur', style: { marginTop: '10px' } });
    for (const p of [...state.paliers].reverse()) {
      mur.append(h('div', { class: 'plaque' },
        h('div', { class: 'charge' }, p.niveau ? `N${p.niveau}` : fmtKg(p.charge)),
        h('div', { class: 'quoi' }, EXERCISES[p.exerciceId]?.nom || p.exerciceId),
        h('div', { class: 'quand' }, fmtDateCourt(p.d).toUpperCase()),
      ));
    }
    root.append(mur);
  }
}
