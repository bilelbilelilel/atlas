// ATLAS — CORPS. Une saisie (le poids), et le moteur fait le reste.
// Le message visuel : ignore les points, suis la ligne.
// En bas : la Ligne de défense — tu perds du gras, pas du muscle.

import { EXERCISES, MAJEURS } from '../program.js';
import { indiceForceBrut } from '../engine.js';
import { moyenne7j, pentePctSemaine, verdictNutrition } from '../nutrition.js';
import { upsertPoids, todayISO } from '../store.js';
import { chartPoids, chartDefense } from '../charts.js';
import { h, clear, haptic } from '../ui.js';

export function renderCorps(ctx, root) {
  clear(root);
  const state = ctx.state;
  const d = todayISO();
  const semaine = ctx.semaine();
  const auj = state.poids.find((p) => p.d === d);

  root.append(h('h2', { class: 'fade-in' }, 'Corps'));

  // Saisie du poids — clavier numérique direct.
  const input = h('input', {
    type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'kg',
    value: auj?.kg ?? '',
  });
  root.append(h('div', { class: 'card stack' },
    h('span', { class: 'eyebrow accent' }, auj ? 'PESÉE DU JOUR ✓' : 'PESÉE DU MATIN'),
    h('div', { class: 'row' },
      input,
      h('button', { class: 'btn-mini', onclick: () => {
        const v = parseFloat(String(input.value).replace(',', '.'));
        if (Number.isNaN(v) || v <= 0) return;
        upsertPoids(state, d, v);
        ctx.persist(); haptic.leger(); ctx.rerender();
      } }, 'OK'),
    ),
  ));

  // Tendance & graphe
  const moy = moyenne7j(state.poids, d);
  const pente = pentePctSemaine(state.poids, d);
  if (state.poids.length >= 2) {
    root.append(h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('div', {},
          h('span', { class: 'eyebrow' }, 'MOYENNE 7 J'),
          h('div', { class: 'hero-num', style: { fontSize: '44px' } }, moy ? moy.toFixed(1) : '—',
            h('span', { class: 'unit' }, ' kg')),
        ),
        pente != null ? h('div', { class: 'center' },
          h('span', { class: 'eyebrow' }, '/SEMAINE'),
          h('div', { class: 'mono', style: { fontSize: '20px', color: pente <= -0.4 && pente >= -1 ? 'var(--laurier)' : 'var(--albatre)' } },
            `${pente > 0 ? '+' : ''}${pente.toFixed(2)} %`),
        ) : null,
      ),
      chartPoids(state.poids),
      h('div', { class: 'mono small' }, 'points quotidiens · ligne = moyenne 7 j · bande = cible −0,4/−0,7 %'),
    ));
  }

  // Verdict du moteur nutrition + kcal cible du moment.
  const v = verdictNutrition({
    poids: state.poids, jour: d, semaine,
    kcalCible: state.settings.kcalCible,
    finDeCycle: ctx.mode() === 'maintien',
  });
  const dejaApplique = v.action && state.settings.historiqueKcal.some((hh) => hh.d === d);
  root.append(h('div', { class: 'card stack' },
    h('div', { class: 'row between' },
      h('span', { class: 'eyebrow ocre' }, 'NUTRITION'),
      h('span', { class: 'mono' }, `cible : ${state.settings.kcalCible} kcal`),
    ),
    h('p', {}, v.message),
    v.action && !dejaApplique ? h('button', { class: 'btn ghost', onclick: () => {
      state.settings.historiqueKcal.push({ d, de: state.settings.kcalCible, vers: v.action.nouvelleCible, raison: v.code });
      state.settings.kcalCible = v.action.nouvelleCible;
      if (v.code === 'maintien') ctx.setMode('maintien');
      ctx.persist(); haptic.moyen(); ctx.rerender();
    } }, v.action.label) : null,
    state.settings.historiqueKcal.length ? h('div', {},
      state.settings.historiqueKcal.slice(-3).reverse().map((c) => h('div', { class: 'hist-line' },
        h('b', {}, `${c.de} → ${c.vers} kcal`), ` · ${c.raison} · ${c.d}`)),
    ) : null,
  ));

  renderDefense(ctx, root);
}

// --- La Ligne de défense : un seul graphe, deux lignes -------------------------

function renderDefense(ctx, root) {
  const state = ctx.state;
  const debut = state.settings.dateDebut;
  if (!debut) return;
  const semaine = ctx.semaine();
  if (semaine < 3) {
    root.append(h('div', { class: 'card flat center' },
      h('span', { class: 'eyebrow' }, 'LIGNE DE DÉFENSE'),
      h('p', { class: 'muted small', style: { marginTop: '6px' } },
        'Base 100 fixée en semaine 3 — encore un peu de données et la défense s’affiche.')));
    return;
  }

  const serie = [];
  for (let w = 3; w <= semaine; w++) {
    const fin = new Date(new Date(debut + 'T00:00:00').getTime() + (w * 7 - 1) * 86400000)
      .toISOString().slice(0, 10);
    const logsAvant = {};
    for (const [id, histo] of Object.entries(state.logs)) {
      logsAvant[id] = histo.filter((s) => s.d <= fin);
    }
    const poids = moyenne7j(state.poids, fin);
    const force = indiceForceBrut(logsAvant, EXERCISES, MAJEURS, poids ?? 0);
    if (poids && force) serie.push({ x: w, poids, force });
  }

  if (serie.length < 2) {
    root.append(h('div', { class: 'card flat center' },
      h('span', { class: 'eyebrow' }, 'LIGNE DE DÉFENSE'),
      h('p', { class: 'muted small', style: { marginTop: '6px' } }, 'Deux semaines de données et la ligne apparaît.')));
    return;
  }

  const first = serie[0], last = serie.at(-1);
  const forceTient = last.force >= first.force * 0.97;
  const poidsDescend = last.poids < first.poids;

  root.append(h('div', { class: 'card stack' },
    h('span', { class: 'eyebrow ocre' }, 'LIGNE DE DÉFENSE'),
    chartDefense(serie),
    h('div', { class: 'mono small' }, 'terre cuite = indice de force · cendre = poids (base 100)'),
    forceTient && poidsDescend
      ? h('div', { class: 'verdict gagnee' }, `Défense tenue — semaine ${ctx.semaine()}. Tu perds du gras, pas du muscle.`)
      : !forceTient
        ? h('div', { class: 'verdict tendue' }, 'La ligne de force fléchit. Vérifie sommeil et kcal — le bilan de dimanche tranchera.')
        : null,
  ));
}
