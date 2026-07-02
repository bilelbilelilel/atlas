// ATLAS — AUJOURD'HUI. L'athlète d'amphore en haut, le Contrat du jour,
// un seul bouton. Jour de repos : pas du jour + prochaine séance.
// Samedi : FUSIBLE — sauter n'est jamais visuellement une défaite.

import { sessionForDay, SESSIONS, SCHEDULE } from '../program.js';
import { fmtKg } from '../inventory.js';
import { todayISO } from '../store.js';
import { moyenne7j } from '../nutrition.js';
import { h, clear, JOURS, haptic } from '../ui.js';
import { mountSprite } from '../sprites.js';
import { openSeance, buildTargets } from './seance.js';

let avatarStop = null;

// L'avatar ne parle pas, ne culpabilise pas. Il reflète.
export function etatAvatar(ctx, jourEntrainement) {
  const state = ctx.state;
  const d = todayISO();
  const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const dernierPalier = state.paliers.at(-1);
  if (dernierPalier && (dernierPalier.d === d || dernierPalier.d === hier)) return 'palier';

  const dernierBilan = state.fusibles.at(-1);
  if (dernierBilan) {
    const rouges = dernierBilan.flags.filter(Boolean).length;
    if (rouges >= 2) return 'entame';
    if (dernierBilan.verdict === 'gagnee' && new Date().getDay() <= 2) return 'laure';
  }

  if (state.poids.length > 6) {
    const debut = moyenne7j(state.poids, state.poids[Math.min(6, state.poids.length - 1)].d);
    const maintenant = moyenne7j(state.poids, d);
    if (debut && maintenant && (debut - maintenant) / debut >= 0.02) return 'affute';
  }

  return jourEntrainement ? 'pret' : 'repos';
}

export function renderHome(ctx, root) {
  clear(root);
  avatarStop?.(); avatarStop = null;

  const state = ctx.state;
  const d = todayISO();
  const dow = new Date().getDay();
  const session = sessionForDay(dow);
  const semaine = ctx.semaine();
  const mode = ctx.mode();
  const faite = state.seances.find((s) => s.d === d && s.etat === 'faite');
  const sautee = state.seances.find((s) => s.d === d && s.etat === 'sautee');
  const brouillon = state.seances.find((s) => s.d === d && s.etat === 'brouillon');

  // Samedi masqué en semaine allégée.
  const sessionEff = (mode === 'allegee' && session?.id === 'fusible') ? null : session;

  const avatarBox = h('div', { class: 'sprite-box' });
  avatarStop = mountSprite(avatarBox, etatAvatar(ctx, !!sessionEff && !faite), { scale: 6 });

  const modeLabel = { rampe: 'RAMPE', normal: '', allegee: 'SEMAINE ALLÉGÉE', maintien: 'MAINTIEN' }[mode];
  const cycle = state.settings.cycle ?? 1;
  root.append(
    h('div', { class: 'center fade-in' },
      h('span', { class: 'eyebrow' },
        `${JOURS[dow].toUpperCase()}${cycle > 1 ? ` · CYCLE ${cycle}` : ''} · SEMAINE ${Math.max(semaine, 1)}${modeLabel ? ' · ' + modeLabel : ''}`),
      avatarBox,
    ),
  );

  // Dimanche soir : le bilan hebdo attend.
  if (dow === 0 && state.settings.rappels?.bilan !== false
    && semaine >= 1 && !state.fusibles.some((f) => f.semaine === semaine)) {
    root.append(h('div', { class: 'card flat row between', onclick: () => ctx.navigate('bilan') },
      h('span', { class: 'small muted' }, 'Le bilan de la semaine t’attend — 4 questions, 30 secondes'),
      h('span', { class: 'eyebrow ocre' }, '→ BILAN'),
    ));
  }

  // ≥2 fusibles rouges : l'app propose l'allégée, sans morale.
  const dernierBilan = state.fusibles.at(-1);
  if (dernierBilan && dernierBilan.flags.filter(Boolean).length >= 2 && mode !== 'allegee') {
    root.append(h('div', { class: 'card stack' },
      h('span', { class: 'eyebrow', style: { color: 'var(--sang-seche)' } }, 'FUSIBLES ROUGES'),
      h('p', { class: 'small' }, 'Semaine allégée prête : 2 séries, −25 %, réserve 3-4, pas de samedi.'),
      h('button', { class: 'btn laurier', onclick: () => {
        ctx.setMode('allegee', 7); ctx.persist(); haptic.moyen(); ctx.rerender();
      } }, 'Activer la semaine allégée'),
    ));
  }

  if (!state.settings.dateDebut || semaine < 1) {
    root.append(h('div', { class: 'card center stack' },
      h('h2', {}, 'Le cycle démarre lundi'),
      h('p', { class: 'muted small' }, 'Séance 1 = étalonnage. D’ici là : pèse-toi chaque matin, ça calibre la boucle nutrition.'),
    ));
    return;
  }

  if (faite) {
    root.append(h('div', { class: 'card center stack' },
      h('span', { class: 'eyebrow ocre' }, 'SÉANCE FAITE'),
      h('h2', {}, SESSIONS[faite.id]?.nom || ''),
      h('p', { class: 'muted small' }, prochaineSeanceTexte(dow)),
    ));
    renderPesee(ctx, root);
    return;
  }

  if (sessionEff && session.id === 'fusible' && !sautee) return renderFusible(ctx, root, session, brouillon);
  if (sessionEff && !sautee) return renderContrat(ctx, root, sessionEff, brouillon);

  // Jour de repos (ou samedi sauté).
  if (sautee) {
    root.append(h('div', { class: 'card center stack' },
      h('span', { class: 'eyebrow', style: { color: 'var(--laurier)' } }, 'FUSIBLE UTILISÉ À RAISON'),
      h('p', { class: 'small muted' }, 'Récupérer fait partie du programme. Prochaine séance : lundi.'),
    ));
  } else {
    root.append(h('div', { class: 'card center stack' },
      h('span', { class: 'eyebrow' }, 'JOUR DE REPOS'),
      h('p', { class: 'small muted' }, `Marche : vise tes pas quotidiens. ${prochaineSeanceTexte(dow)}`),
    ));
  }
  renderPas(ctx, root);
  renderPesee(ctx, root);
}

// --- Le Contrat du jour -------------------------------------------------------

function renderContrat(ctx, root, session, brouillon) {
  const targets = buildTargets(ctx, session);

  let repsAPrendre = 0, paliers = 0, etalonnages = 0;
  for (const { target } of targets) {
    if (target.type === 'palier') paliers++;
    else if (target.type === 'etalonnage') etalonnages++;
    else if (target.aBattre) {
      repsAPrendre += target.repsCible.reduce((a, r, i) => a + Math.max(0, r - (target.aBattre[i] ?? r)), 0);
    }
  }

  let heros, sous, taille = '72px';
  if (etalonnages === targets.length) { heros = 'Étalonnage'; sous = 'premier point de référence'; taille = '40px'; }
  else if (paliers > 0) { heros = `${paliers} palier${paliers > 1 ? 's' : ''}`; sous = 'à graver aujourd’hui'; taille = '56px'; }
  else { heros = `+${Math.max(repsAPrendre, 1)} reps`; sous = 'à prendre'; }

  root.append(
    h('div', { class: 'card fade-in' },
      h('span', { class: 'eyebrow accent' }, `CONTRAT DU JOUR · ${session.nom.toUpperCase()}`),
      h('div', { class: 'hero-num accent', style: { margin: '8px 0 2px', fontSize: taille } }, heros),
      h('div', { class: 'muted' }, sous),
      h('div', { class: 'meandre' }),
      h('div', {},
        targets.map(({ ex, target }) => h('div', { class: 'hist-line' },
          h('b', {}, ex.nom), ' — ',
          target.type === 'etalonnage' ? 'étalonnage' : target.affichage,
        )),
      ),
    ),
    h('button', { class: 'btn big', onclick: () => openSeance(ctx, session) }, brouillon ? 'Reprendre' : 'Commencer'),
  );
  renderPesee(ctx, root);
}

// --- Samedi : le fusible --------------------------------------------------------

function renderFusible(ctx, root, session, brouillon) {
  root.append(
    h('div', { class: 'card fade-in center stack' },
      h('span', { class: 'eyebrow ocre' }, 'FUSIBLE'),
      h('h2', {}, 'Séance bonus du samedi'),
      h('p', { class: 'small muted' }, 'Full body léger, 2 séries par exercice. La faire ou la sauter sont deux bonnes décisions — le programme est construit pour.'),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'btn', style: { flex: 1 }, onclick: () => openSeance(ctx, session) }, brouillon ? 'Reprendre' : 'Je la fais'),
        h('button', { class: 'btn ghost', style: { flex: 1 }, onclick: () => {
          ctx.state.seances.push({ d: todayISO(), id: 'fusible', etat: 'sautee', duree: 0 });
          ctx.persist(); haptic.leger(); ctx.rerender();
        } }, 'Je la saute'),
      ),
    ),
  );
  renderPesee(ctx, root);
}

// --- Widgets bas d'écran ----------------------------------------------------------

function renderPesee(ctx, root) {
  const d = todayISO();
  const deja = ctx.state.poids.find((p) => p.d === d);
  if (deja || ctx.state.settings.rappels?.pesee === false) return;
  root.append(h('div', { class: 'card flat row between', onclick: () => ctx.navigate('corps') },
    h('span', { class: 'small muted' }, 'Pesée du matin pas encore faite'),
    h('span', { class: 'eyebrow accent' }, '→ CORPS'),
  ));
}

function renderPas(ctx, root) {
  const d = todayISO();
  const entry = ctx.state.pas.find((p) => p.d === d);
  const input = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'pas du jour', value: entry?.n ?? '' });
  root.append(h('div', { class: 'card stack' },
    h('span', { class: 'eyebrow' }, 'PAS DU JOUR'),
    h('div', { class: 'row' },
      input,
      h('button', { class: 'btn-mini', onclick: () => {
        const n = parseInt(input.value, 10);
        if (Number.isNaN(n)) return;
        const e = ctx.state.pas.find((p) => p.d === d);
        if (e) e.n = n; else ctx.state.pas.push({ d, n });
        ctx.persist(); haptic.leger(); ctx.rerender();
      } }, 'OK'),
    ),
  ));
}

function prochaineSeanceTexte(dow) {
  for (let i = 1; i <= 7; i++) {
    const next = (dow + i) % 7;
    if (SCHEDULE[next]) return `Prochaine séance : ${SESSIONS[SCHEDULE[next]].nom}, ${JOURS[next]}.`;
  }
  return '';
}
