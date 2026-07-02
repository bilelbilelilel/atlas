// ATLAS — le flux séance. Trois états qui alternent automatiquement :
// carte exercice → timer de repos (avec le sprite SUIVANT) → carte suivante.
// Un tap suffit dans ~80 % des cas. Quitter = brouillon repris tel quel.

import { EXERCISES } from '../program.js';
import { cibleSuivante, substitutionAPproposer } from '../engine.js';
import { possibleCharges, descriptionCharge, fmtKg } from '../inventory.js';
import { logsOf, pushLog, todayISO } from '../store.js';
import { h, clear, haptic, son } from '../ui.js';
import { mountSprite } from '../sprites.js';

let S = null;          // runtime de la séance en cours
let timerInt = null;
let spriteStop = null;
let wakeLock = null;

// L'écran reste allumé pendant la séance — pas de déverrouillage entre les séries.
async function acquireWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* pas supporté */ }
}
document.addEventListener('visibilitychange', () => {
  if (S && document.visibilityState === 'visible') acquireWakeLock();
});

const ZONES = ['épaule', 'coude', 'poignet', 'dos', 'hanche', 'genou'];

export function resolveEx(state, id) {
  const sub = state.exercices[id]?.substitue;
  return sub ? EXERCISES[sub] : EXERCISES[id];
}

export function buildTargets(ctx, sessionDef) {
  return sessionDef.exercices.map((id) => {
    const ex = resolveEx(ctx.state, id);
    const target = cibleSuivante(ex, logsOf(ctx.state, ex.id), {
      mode: ctx.mode(), inventaire: ctx.state.inventaire,
      exState: ctx.state.exercices[ex.id] || {},
      seriesOverride: sessionDef.seriesOverride,
    });
    return { ex, target };
  });
}

// ---------------------------------------------------------------------------
// Ouverture / reprise
// ---------------------------------------------------------------------------

export function openSeance(ctx, sessionDef) {
  const items = buildTargets(ctx, sessionDef).map(({ ex, target }) => ({
    ex, target,
    charge: target.charge,       // null → étalonnage à saisir
    niveau: target.niveau,
    sets: [],                    // [{ reps, reserve }]
  }));

  S = {
    def: sessionDef, items, cur: 0, phase: 'exo',
    start: Date.now(), timer: null, debrief: { douleur: null, zone: null, exId: null },
  };

  // Reprise de brouillon du jour, tel quel.
  const d = todayISO();
  const draft = ctx.state.seances.find((s) => s.d === d && s.id === sessionDef.id && s.etat === 'brouillon');
  if (draft?.brouillon) {
    const b = draft.brouillon;
    for (const it of items) {
      const saved = b.items?.find((x) => x.exId === it.ex.id);
      if (saved) { it.sets = saved.sets || []; if (saved.charge != null) it.charge = saved.charge; }
    }
    S.cur = Math.min(b.cur ?? 0, items.length - 1);
    S.start = Date.now() - (b.ecoule ?? 0);
  }

  document.getElementById('seance').classList.add('open');
  acquireWakeLock();
  renderSeance(ctx);
}

function saveDraft(ctx) {
  const d = todayISO();
  let entry = ctx.state.seances.find((s) => s.d === d && s.id === S.def.id);
  if (!entry) { entry = { d, id: S.def.id, etat: 'brouillon', duree: 0 }; ctx.state.seances.push(entry); }
  if (entry.etat !== 'brouillon') return;
  entry.brouillon = {
    cur: S.cur, ecoule: Date.now() - S.start,
    items: S.items.map((it) => ({ exId: it.ex.id, charge: it.charge, sets: it.sets })),
  };
  ctx.persist();
}

function closeModal() {
  clearInterval(timerInt); timerInt = null;
  spriteStop?.(); spriteStop = null;
  wakeLock?.release().catch(() => {}); wakeLock = null;
  document.getElementById('seance').classList.remove('open');
  S = null;
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

function renderSeance(ctx) {
  const root = clear(document.querySelector('#seance .seance-inner'));
  clearInterval(timerInt); spriteStop?.(); spriteStop = null;
  if (!S) return;

  root.append(progressBar());
  root.append(h('div', { class: 'row between', style: { marginBottom: '8px' } },
    h('span', { class: 'eyebrow' }, S.def.nom.toUpperCase()),
    h('button', { class: 'btn-mini', onclick: () => { saveDraft(ctx); closeModal(); ctx.navigate('home'); } }, 'Quitter'),
  ));

  if (S.phase === 'exo') renderExo(ctx, root);
  else if (S.phase === 'repos') renderRepos(ctx, root);
  else if (S.phase === 'etalonnage') renderEtalonnage(ctx, root);
  else if (S.phase === 'debrief') renderDebrief(ctx, root);
  else if (S.phase === 'fin') renderFin(ctx, root);
}

function progressBar() {
  const total = S.items.reduce((a, it) => a + it.target.series, 0);
  let done = 0;
  for (const it of S.items) done += it.sets.length;
  const bar = h('div', { class: 'progress-segs' });
  for (let i = 0; i < total; i++) {
    bar.append(h('i', { class: i < done ? 'done' : i === done ? 'cur' : '' }));
  }
  return bar;
}

function cur() { return S.items[S.cur]; }

// --- Carte exercice ---------------------------------------------------------

function renderExo(ctx, root) {
  const it = cur();
  if (it.target.type === 'etalonnage' && it.charge == null && it.ex.type === 'charge') {
    S.phase = 'etalonnage'; return renderSeance(ctx);
  }

  const setIdx = it.sets.length;
  const cible = it.target.repsCible[setIdx] ?? it.target.repsCible.at(-1);
  const unit = it.ex.type === 'temps' ? 's' : 'reps';
  let reps = cible;
  let repsFaible = null;   // écart G/D : renseigné seulement si demandé
  let reserve = it.target.reserve[0];

  const spriteBox = h('div', { class: 'sprite-box' });
  spriteStop = mountSprite(spriteBox, it.ex.sprite, { scale: 5 });

  const repsVal = h('div', { class: 'val' }, reps);
  const chargeLabel = () => it.ex.type === 'echelle'
    ? (it.ex.niveauxLabels?.[(it.niveau ?? 1) - 1] ?? `niveau ${it.niveau}`)
    : descriptionCharge(ctx.state.inventaire, it.charge ?? 0, it.ex);
  const chargeEl = h('div', { class: 'mono center' }, chargeLabel());

  const chips = h('div', { class: 'chips' });
  for (const r of [0, 1, 2, 3, 4]) {
    const c = h('button', { class: 'chip' + (r === reserve ? ' on' : ''), onclick: () => {
      reserve = r;
      chips.querySelectorAll('.chip').forEach((el, i) => el.classList.toggle('on', i === r));
    } }, r);
    chips.append(c);
  }

  const valide = () => {
    haptic.leger();
    // Avec écart G/D, la progression suit le côté faible.
    const set = repsFaible != null
      ? { reps: Math.min(reps, repsFaible), reserve, gd: [reps, repsFaible] }
      : { reps, reserve };
    it.sets.push(set);
    saveDraft(ctx);
    avancer(ctx);
  };

  // Unilatéral : une saisie = les deux côtés, option écart G/D si besoin.
  let uniBloc = null;
  if (it.ex.unilateral) {
    const faibleVal = h('span', { class: 'mono', style: { fontSize: '24px', minWidth: '3ch', textAlign: 'center' } }, '—');
    const faibleRow = h('div', { class: 'row', style: { justifyContent: 'center', display: 'none' } },
      h('button', { class: 'btn-mini', onclick: () => { if (repsFaible > 0) { repsFaible--; faibleVal.textContent = repsFaible; } } }, '−'),
      h('div', { class: 'center' }, h('div', { class: 'eyebrow' }, 'CÔTÉ FAIBLE'), faibleVal),
      h('button', { class: 'btn-mini', onclick: () => { repsFaible++; faibleVal.textContent = repsFaible; } }, '+'),
    );
    uniBloc = h('div', { class: 'center stack' },
      h('button', { class: 'btn-mini', onclick: (e) => {
        if (repsFaible == null) { repsFaible = reps; faibleVal.textContent = repsFaible; faibleRow.style.display = 'flex'; e.target.textContent = 'même des deux côtés'; }
        else { repsFaible = null; faibleRow.style.display = 'none'; e.target.textContent = 'écart G/D ?'; }
      } }, 'écart G/D ?'),
      faibleRow,
    );
  }

  root.append(
    h('div', { class: 'fade-in stack' },
      h('div', { class: 'center' },
        h('span', { class: 'eyebrow ocre' }, `SÉRIE ${setIdx + 1}/${it.target.series}`),
        h('h2', {}, it.ex.nom),
        h('div', { class: 'mono' }, it.target.affichage),
      ),
      spriteBox,
      it.ex.tempo ? h('div', { class: 'center eyebrow accent' }, it.ex.tempo.toUpperCase()) : null,
      it.ex.unilateral ? h('div', { class: 'center mono small' }, 'une saisie = les deux côtés') : null,
      uniBloc,
      h('div', { class: 'stepper' },
        h('button', { onclick: () => { reps = Math.max(0, reps - 1); repsVal.textContent = reps; } }, '−'),
        repsVal,
        h('button', { onclick: () => { reps += 1; repsVal.textContent = reps; } }, '+'),
      ),
      h('div', { class: 'center mono small' }, unit),
      // Rampe (sem 1-2) : le lest est masqué — poids de corps d'abord.
      it.ex.type !== 'echelle' && it.ex.materiel !== 'aucun'
        && !(it.ex.type === 'lest' && ctx.mode() === 'rampe')
        ? chargeStepper(ctx, it, chargeEl) : null,
      chargeEl,
      h('div', {},
        h('div', { class: 'center eyebrow', style: { marginBottom: '6px' } }, 'EN RÉSERVE'),
        chips,
      ),
      h('button', { class: 'btn big', onclick: valide }, '✓ Comme prévu'),
      it.target.notes.length ? h('div', { class: 'mono small center' }, it.target.notes[0]) : null,
      propositionBloc(ctx, it),
    ),
  );
}

// Le moteur propose (palier raté 2× → élargir la fourchette) ; toi tu tranches, 1 tap.
function propositionBloc(ctx, it) {
  const prop = it.target.propositions?.[0];
  if (!prop || ctx.state.exercices[it.ex.id]?.fourchetteElargie) return null;
  return h('div', { class: 'card stack' },
    h('span', { class: 'eyebrow ocre' }, 'PROPOSITION DU MOTEUR'),
    h('p', { class: 'small' }, prop.texte),
    h('button', { class: 'btn ghost', onclick: () => {
      if (!ctx.state.exercices[it.ex.id]) ctx.state.exercices[it.ex.id] = {};
      ctx.state.exercices[it.ex.id].fourchetteElargie = true;
      it.target = cibleSuivante(it.ex, logsOf(ctx.state, it.ex.id), {
        mode: ctx.mode(), inventaire: ctx.state.inventaire,
        exState: ctx.state.exercices[it.ex.id],
        seriesOverride: S.def.seriesOverride,
      });
      ctx.persist(); haptic.leger();
      renderSeance(ctx);
    } }, 'Élargir la fourchette'),
  );
}

function chargeStepper(ctx, it, chargeEl) {
  const charges = possibleCharges(ctx.state.inventaire, it.ex.materiel);
  const move = (dir) => {
    const c = it.charge ?? 0;
    const next = dir > 0 ? charges.find((x) => x > c + 1e-6) : [...charges].reverse().find((x) => x < c - 1e-6);
    if (next != null) { it.charge = next; chargeEl.textContent = descriptionCharge(ctx.state.inventaire, next, it.ex); }
  };
  return h('div', { class: 'row', style: { justifyContent: 'center', gap: '10px' } },
    h('button', { class: 'btn-mini', onclick: () => move(-1) }, '− charge'),
    h('button', { class: 'btn-mini', onclick: () => move(1) }, '+ charge'),
  );
}

// --- Étalonnage ---------------------------------------------------------------

function renderEtalonnage(ctx, root) {
  const it = cur();
  const input = h('input', { type: 'number', inputmode: 'decimal', placeholder: 'kg' });
  root.append(
    h('div', { class: 'fade-in stack center' },
      h('span', { class: 'eyebrow accent' }, 'ÉTALONNAGE'),
      h('h2', {}, it.ex.nom),
      h('p', { class: 'muted' }, 'Première fois sur cet exercice. Prends léger, garde 2-3 en réserve — la charge parfaite, c’est celle que tu domines.'),
      input,
      h('div', { class: 'mono small' }, `Charges possibles : ${possibleCharges(ctx.state.inventaire, it.ex.materiel).slice(0, 12).map((c) => fmtKg(c)).join(' · ')}…`),
      h('button', { class: 'btn', onclick: () => {
        const v = parseFloat(String(input.value).replace(',', '.'));
        if (Number.isNaN(v) || v < 0) return;
        const charges = possibleCharges(ctx.state.inventaire, it.ex.materiel);
        it.charge = charges.reduce((best, c) => Math.abs(c - v) < Math.abs(best - v) ? c : best, charges[0] ?? 0);
        S.phase = 'exo'; renderSeance(ctx);
      } }, 'C’est parti'),
    ),
  );
}

// --- Avancement & repos ---------------------------------------------------------

function avancer(ctx) {
  const it = cur();
  if (it.sets.length >= it.target.series) {
    finExercice(ctx, it);
    if (S.cur >= S.items.length - 1) { S.phase = 'debrief'; return renderSeance(ctx); }
    S.cur += 1;
    S.phase = 'repos';
    S.timer = { end: Date.now() + 90_000 };
    return renderSeance(ctx);
  }
  S.phase = 'repos';
  S.timer = { end: Date.now() + it.target.repos * 1000 };
  renderSeance(ctx);
}

function finExercice(ctx, it) {
  // Palier gravé : la cible était un palier ET la charge/niveau cible a été tenue.
  const t = it.target;
  const estPalier = t.type === 'palier'
    && (it.ex.type === 'echelle' ? it.niveau === t.niveau : it.charge === t.charge);
  if (estPalier) {
    ctx.state.paliers.push({
      d: todayISO(), exerciceId: it.ex.id,
      charge: it.ex.type === 'echelle' ? null : it.charge,
      niveau: it.ex.type === 'echelle' ? it.niveau : null,
    });
    // Palier pris : la fourchette élargie a fait son travail, retour à la normale.
    const st = ctx.state.exercices[it.ex.id];
    if (st?.fourchetteElargie) delete st.fourchetteElargie;
    ctx.celebratePalier(it.ex, it);
  }
}

function renderRepos(ctx, root) {
  const it = cur();
  const setIdx = it.sets.length;
  const suivantTxt = `${it.ex.nom} — ${it.target.repsCible[setIdx] ?? it.target.repsCible.at(-1)}${it.ex.type === 'temps' ? ' s' : ''}`
    + (it.ex.type === 'echelle' ? ` · niveau ${it.niveau}` : (it.charge ? ` @ ${fmtKg(it.charge)}` : ''));

  // Basé sur l'horloge, pas sur un décrément : le compte reste juste même si
  // l'écran se verrouille ou que l'onglet passe en arrière-plan.
  const left = () => Math.max(0, Math.ceil((S.timer.end - Date.now()) / 1000));
  const num = h('div', { class: 'timer-num' }, left());
  const spriteBox = h('div', { class: 'sprite-box' });
  spriteStop = mountSprite(spriteBox, it.ex.sprite, { scale: 5 });

  root.append(
    h('div', { class: 'fade-in stack center' },
      h('span', { class: 'eyebrow' }, 'REPOS'),
      num,
      h('div', { class: 'meandre' }),
      h('span', { class: 'eyebrow ocre' }, setIdx === 0 ? 'ENSUITE' : `ENSUITE : SÉRIE ${setIdx + 1}/${it.target.series}`),
      h('h2', {}, suivantTxt),
      spriteBox,
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '10px' } },
        h('button', { class: 'btn-mini', onclick: () => { S.timer.end += 30_000; num.textContent = left(); } }, '+30 s'),
        h('button', { class: 'btn-mini', onclick: () => { S.phase = 'exo'; renderSeance(ctx); } }, 'Passer'),
      ),
    ),
  );

  timerInt = setInterval(() => {
    const l = left();
    num.textContent = l;
    num.classList.toggle('fin', l <= 5);
    if (l <= 0) {
      clearInterval(timerInt);
      haptic.leger();
      son(ctx.state, 'timer');
      S.phase = 'exo';
      renderSeance(ctx);
    }
  }, 250);
}

// --- Debrief : 30 secondes qui calibrent tout -----------------------------------

function renderDebrief(ctx, root) {
  const db = S.debrief;
  const semaine = ctx.semaine();
  const exChips = h('div', { class: 'chips', style: { flexWrap: 'wrap' } });
  const zoneChips = h('div', { class: 'chips', style: { flexWrap: 'wrap', display: 'none' } });
  const bloc = h('div', { class: 'stack', style: { display: 'none' } });

  for (const it of S.items) {
    exChips.append(h('button', { class: 'chip', style: { minWidth: 'auto', padding: '10px 12px' }, onclick: (e) => {
      db.exId = it.ex.id;
      exChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
      e.target.classList.add('on');
    } }, it.ex.nom));
  }
  for (const z of ZONES) {
    zoneChips.append(h('button', { class: 'chip', style: { minWidth: 'auto', padding: '10px 12px' }, onclick: (e) => {
      db.zone = z;
      zoneChips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
      e.target.classList.add('on');
    } }, z));
  }

  let calibOk = null;
  const calib = semaine <= 3 ? h('div', { class: 'card stack' },
    h('span', { class: 'eyebrow' }, 'CALIBRATION RÉSERVE'),
    h('p', { class: 'small' }, `Ta dernière série de ${S.items[0].ex.nom.toLowerCase()} : tu pouvais vraiment en faire ${S.items[0].sets.at(-1)?.reserve ?? 2} de plus ?`),
    h('div', { class: 'row' },
      h('button', { class: 'btn-mini', onclick: (e) => { calibOk = true; marque(e); } }, 'Oui, vraiment'),
      h('button', { class: 'btn-mini', onclick: (e) => { calibOk = false; marque(e); } }, 'Non, j’étais au bout'),
    ),
  ) : null;
  const marque = (e) => {
    e.target.parentElement.querySelectorAll('.btn-mini').forEach((b) => b.style.borderColor = '');
    e.target.style.borderColor = 'var(--terre-cuite)';
  };

  root.append(
    h('div', { class: 'fade-in stack' },
      h('div', { class: 'center' },
        h('span', { class: 'eyebrow ocre' }, 'DEBRIEF'),
        h('h2', {}, '30 secondes, pas plus'),
      ),
      h('div', { class: 'card stack' },
        h('p', {}, 'Une douleur articulaire ?'),
        h('div', { class: 'row' },
          h('button', { class: 'btn-mini', onclick: (e) => { db.douleur = false; bloc.style.display = 'none'; marque(e); } }, 'Non'),
          h('button', { class: 'btn-mini', onclick: (e) => { db.douleur = true; bloc.style.display = ''; zoneChips.style.display = 'flex'; marque(e); } }, 'Oui'),
        ),
        bloc,
      ),
      calib,
      h('button', { class: 'btn big', onclick: () => terminer(ctx, calibOk) }, 'Terminer la séance'),
    ),
  );
  bloc.append(h('div', { class: 'eyebrow' }, 'OÙ ?'), zoneChips, h('div', { class: 'eyebrow' }, 'SUR QUEL EXERCICE ?'), exChips);
}

function terminer(ctx, calibOk) {
  const d = todayISO();
  const duree = Math.round((Date.now() - S.start) / 1000);

  for (const it of S.items) {
    if (!it.sets.length) continue;
    pushLog(ctx.state, it.ex.id, {
      d, charge: it.ex.type === 'echelle' ? null : (it.charge ?? 0),
      reps: it.sets.map((s) => s.reps),
      reserve: it.sets.map((s) => s.reserve),
      niveau: it.ex.type === 'echelle' ? (it.niveau ?? 1) : null,
    });
  }

  const db = S.debrief;
  if (db.douleur && db.exId) {
    ctx.state.douleurs.push({ d, exerciceId: db.exId, zone: db.zone || '?' });
    if (substitutionAPproposer(ctx.state.douleurs, db.exId)) {
      const ex = EXERCISES[db.exId];
      if (ex.substitution && !ctx.state.exercices[db.exId]?.substitue) {
        S.proposeSub = { de: ex, vers: EXERCISES[ex.substitution] };
      }
    }
  }
  if (calibOk === false) S.calibNote = true;

  let entry = ctx.state.seances.find((s) => s.d === d && s.id === S.def.id);
  if (!entry) { entry = { d, id: S.def.id }; ctx.state.seances.push(entry); }
  entry.etat = 'faite'; entry.duree = duree; delete entry.brouillon;

  ctx.persist();
  haptic.double();
  S.phase = 'fin';
  renderSeance(ctx);
}

function renderFin(ctx, root) {
  const totalReps = S.items.reduce((a, it) => a + it.sets.reduce((b, s) => b + s.reps, 0), 0);
  const min = Math.round((Date.now() - S.start) / 60000);
  const sub = S.proposeSub;

  root.append(
    h('div', { class: 'fade-in stack center' },
      h('span', { class: 'eyebrow ocre' }, 'SÉANCE FAITE'),
      h('div', { class: 'giant' }, totalReps),
      h('div', { class: 'mono' }, `reps au total · ${min} min`),
      S.calibNote ? h('div', { class: 'card small' },
        'Tu étais au bout sur la dernière série — c’est trop tôt dans le cycle. La semaine prochaine, vise une réserve réelle de 2.') : null,
      sub ? h('div', { class: 'card stack' },
        h('span', { class: 'eyebrow', style: { color: 'var(--sang-seche)' } }, 'DOULEUR RÉCURRENTE'),
        h('p', { class: 'small' }, `2 signalements sur ${sub.de.nom}. Le programme prévoit la variante : ${sub.vers.nom}. L’historique sera transféré.`),
        h('button', { class: 'btn ghost', onclick: (e) => {
          if (!ctx.state.exercices[sub.de.id]) ctx.state.exercices[sub.de.id] = {};
          ctx.state.exercices[sub.de.id].substitue = sub.vers.id;
          ctx.state.logs[sub.vers.id] = (ctx.state.logs[sub.de.id] || []).slice();
          ctx.persist();
          e.target.textContent = 'Substitution activée ✓'; e.target.disabled = true;
        } }, `Remplacer par ${sub.vers.nom}`),
      ) : null,
      h('button', { class: 'btn big', onclick: () => { closeModal(); ctx.navigate('home'); } }, 'Retour'),
    ),
  );
}
