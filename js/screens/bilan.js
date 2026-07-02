// ATLAS — BILAN hebdo. 4 questions fusibles, un verdict tamponné,
// la correction kcal si la boucle l'exige, et la soupape : la semaine allégée.
// Réglages ici : kcal, export JSON/CSV en un tap — tes données t'appartiennent.

import { EXERCISES, MAJEURS, SCHEDULE } from '../program.js';
import { fusibleChargesAuto } from '../engine.js';
import { moyenne7j, pentePctSemaine } from '../nutrition.js';
import { exportJSON, exportCSV, importJSON, todayISO, archiverCycle } from '../store.js';
import { h, clear, haptic, download } from '../ui.js';
import { inventaireEditor } from '../inventaire-editor.js';

const QUESTIONS = [
  ['charges', 'Les charges ont-elles reculé ?'],
  ['articulations', 'Articulations qui tirent ?'],
  ['sommeil', 'Sommeil dégradé ?'],
  ['envie', 'Plus envie d’y aller ?'],
];

export function renderBilan(ctx, root) {
  clear(root);
  const state = ctx.state;
  const semaine = ctx.semaine();
  const d = todayISO();

  root.append(h('h2', { class: 'fade-in' }, 'Bilan'));

  // --- Carte de la semaine -------------------------------------------------
  const { faites, planifiees, repsPrises, tenues } = statsSemaine(ctx);
  const pente = pentePctSemaine(state.poids, d);
  const dejaFait = state.fusibles.find((f) => f.semaine === semaine);

  root.append(h('div', { class: 'card' },
    h('span', { class: 'eyebrow ocre' }, `SEMAINE ${Math.max(semaine, 1)}`),
    h('div', { class: 'mur', style: { marginTop: '10px' } },
      stat('SÉANCES', `${faites}/${planifiees}`),
      stat('REPS PRISES', repsPrises >= 0 ? `+${repsPrises}` : `${repsPrises}`),
      stat('POIDS', pente != null ? `${pente > 0 ? '+' : ''}${pente.toFixed(1)} %` : '—'),
      stat('CHARGES TENUES', `${tenues}/${MAJEURS.length}`),
    ),
  ));

  // --- Les 4 questions fusibles ---------------------------------------------
  const flags = dejaFait ? [...dejaFait.flags] : [fusibleChargesAuto(state.logs), false, false, false];
  const toggles = h('div', { class: 'stack' });
  QUESTIONS.forEach(([_, label], i) => {
    const btn = h('button', { class: 'toggle' + (flags[i] ? ' rouge' : ''), onclick: () => {
      flags[i] = !flags[i];
      btn.classList.toggle('rouge', flags[i]);
    } }, h('span', {}, label), h('span', { class: 'dot' }));
    toggles.append(btn);
  });

  const verdictBox = h('div', {});
  if (dejaFait) afficherVerdict(ctx, verdictBox, dejaFait.verdict, dejaFait.flags, semaine);

  root.append(h('div', { class: 'card stack' },
    h('span', { class: 'eyebrow' }, 'LES 4 FUSIBLES'),
    flags[0] && !dejaFait ? h('p', { class: 'mono small' }, 'Le fusible « charges » s’est pré-coché seul (régression détectée).') : null,
    toggles,
    !dejaFait ? h('button', { class: 'btn', onclick: (e) => {
      const verdict = calculVerdict(flags, faites, planifiees);
      state.fusibles.push({ semaine, flags: [...flags], verdict });
      ctx.persist(); haptic.moyen();
      e.target.style.display = 'none';
      afficherVerdict(ctx, verdictBox, verdict, flags, semaine);
    } }, 'Tamponner la semaine') : null,
    verdictBox,
  ));

  // --- Maintien → nouveau cycle ---------------------------------------------
  if (ctx.mode() === 'maintien') {
    const n = (state.settings.cycle ?? 1) + 1;
    root.append(h('div', { class: 'card stack' },
      h('span', { class: 'eyebrow ocre' }, 'MAINTIEN EN COURS'),
      h('p', { class: 'small' }, 'Mêmes séances, kcal d’équilibre. Après 2-4 semaines, on repart : l’historique est conservé, seul le compteur repart (rampe comprise).'),
      h('button', { class: 'btn', onclick: () => {
        const d = todayISO();
        archiverCycle(state, d);
        const cible = Math.max(state.settings.kcalCible - 400, 1200);
        state.settings.historiqueKcal.push({ d, de: state.settings.kcalCible, vers: cible, raison: 'nouveau_cycle' });
        state.settings.kcalCible = cible;
        ctx.persist(); haptic.moyen(); ctx.rerender();
      } }, `Démarrer le cycle ${n} lundi prochain`),
    ));
  }

  // --- Cycles archivés ----------------------------------------------------------
  if (state.cycles?.length) {
    root.append(h('div', { class: 'card' },
      h('span', { class: 'eyebrow' }, 'CYCLES ARCHIVÉS'),
      state.cycles.slice().reverse().map((c) => h('div', { class: 'hist-line' },
        h('b', {}, `Cycle ${c.n}`),
        ` · ${c.debut} → ${c.fin} · ${c.paliers} paliers`,
        c.poidsDebut && c.poidsFin ? ` · ${c.poidsDebut} → ${c.poidsFin} kg` : '',
      )),
    ));
  }

  // --- Fin de cycle -----------------------------------------------------------
  if (semaine >= 12 && ctx.mode() !== 'maintien') {
    root.append(h('div', { class: 'card stack' },
      h('span', { class: 'eyebrow ocre' }, 'SEMAINE 12 — BILAN DE CYCLE'),
      h('p', { class: 'small' }, `Cycle terminé : ${state.paliers.length} paliers gravés. Phase maintien 2-4 semaines (kcal d'équilibre, mêmes séances), puis nouveau cycle.`),
      h('button', { class: 'btn ocre', onclick: () => {
        ctx.setMode('maintien');
        const cible = state.settings.kcalCible + 400;
        state.settings.historiqueKcal.push({ d, de: state.settings.kcalCible, vers: cible, raison: 'maintien' });
        state.settings.kcalCible = cible;
        ctx.persist(); haptic.moyen(); ctx.rerender();
      } }, 'Passer en maintien'),
    ));
  }

  // --- Partage & réglages -------------------------------------------------------
  root.append(h('div', { class: 'meandre' }));
  renderReglages(ctx, root);
}

function stat(label, val) {
  return h('div', { class: 'card flat center', style: { marginBottom: 0, padding: '10px' } },
    h('span', { class: 'eyebrow' }, label),
    h('div', { class: 'hero-num', style: { fontSize: '30px', marginTop: '4px' } }, val));
}

function calculVerdict(flags, faites, planifiees) {
  const rouges = flags.filter(Boolean).length;
  if (rouges >= 3) return 'corriger';
  if (rouges >= 2 || faites < planifiees - 1) return 'tendue';
  return 'gagnee';
}

function afficherVerdict(ctx, box, verdict, flags, semaine) {
  clear(box);
  const labels = { gagnee: 'SEMAINE GAGNÉE', tendue: 'SEMAINE TENDUE', corriger: 'À CORRIGER' };
  box.append(h('div', { class: 'center', style: { padding: '14px 0' } },
    h('span', { class: `tampon verdict ${verdict}`, style: { border: '3px solid currentColor', background: 'none' } }, labels[verdict]),
  ));

  // ≥2 fusibles rouges OU semaine 9 → semaine allégée, 1 tap.
  const rouges = flags.filter(Boolean).length;
  if ((rouges >= 2 || semaine === 9) && ctx.mode() !== 'allegee') {
    box.append(h('div', { class: 'card stack', style: { marginTop: '10px' } },
      h('span', { class: 'eyebrow', style: { color: 'var(--sang-seche)' } },
        semaine === 9 ? 'SEMAINE 9 — DÉCHARGE PLANIFIÉE' : `${rouges} FUSIBLES ROUGES`),
      h('p', { class: 'small' }, 'Semaine allégée générée : 2 séries, −25 %, réserve 3-4, pas de samedi. Activer ?'),
      h('button', { class: 'btn laurier', onclick: () => {
        ctx.setMode('allegee', 7);
        ctx.persist(); haptic.moyen(); ctx.rerender();
      } }, 'Activer la semaine allégée'),
    ));
  }
}

function statsSemaine(ctx) {
  const state = ctx.state;
  const now = new Date();
  const lundi = new Date(now.getTime() - ((now.getDay() + 6) % 7) * 86400000);
  const debut = lundi.toISOString().slice(0, 10);
  const planifiees = Object.keys(SCHEDULE).length - (ctx.mode() === 'allegee' ? 1 : 0);
  const seances = state.seances.filter((s) => s.d >= debut);
  const faites = seances.filter((s) => s.etat === 'faite').length
    + seances.filter((s) => s.etat === 'sautee').length; // sauter un fusible compte comme une décision, pas une défaite

  let repsPrises = 0, tenues = 0;
  for (const id of MAJEURS) {
    const histo = (state.logs[id] || []);
    const cette = histo.filter((s) => s.d >= debut).at(-1);
    const avant = histo.filter((s) => s.d < debut).at(-1);
    if (!cette) continue;
    if (avant) {
      repsPrises += cette.reps.reduce((a, b) => a + b, 0) - avant.reps.reduce((a, b) => a + b, 0);
      if ((cette.charge ?? 0) >= (avant.charge ?? 0)) tenues++;
    } else tenues++;
  }
  return { faites, planifiees, repsPrises, tenues };
}

// --- Réglages : kcal, export, import, remise à zéro ------------------------------

function renderReglages(ctx, root) {
  const state = ctx.state;
  const kcalInput = h('input', { type: 'number', inputmode: 'numeric', value: state.settings.kcalCible || '' });
  const fileInput = h('input', { type: 'file', accept: '.json', style: { display: 'none' } });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try {
      const imported = importJSON(await f.text());
      Object.assign(state, imported);
      ctx.persist(); ctx.rerender();
    } catch (e) { alert(e.message); }
  });

  const rappelToggle = (cle, label) => {
    const on = state.settings.rappels?.[cle] !== false;
    return h('button', { class: 'toggle' + (on ? '' : ' rouge'), onclick: (e) => {
      if (!state.settings.rappels) state.settings.rappels = {};
      state.settings.rappels[cle] = !(state.settings.rappels[cle] !== false);
      ctx.persist(); ctx.rerender();
    } }, h('span', {}, label), h('span', { class: 'dot' }));
  };

  const sonOn = state.settings.son === true;
  const editor = inventaireEditor(state.inventaire);
  const materiel = h('details', {},
    h('summary', { class: 'mono small', style: { cursor: 'pointer', padding: '6px 0' } }, 'Matériel (barres, disques, haltères fixes)'),
    h('div', { class: 'stack', style: { marginTop: '8px' } },
      editor.el,
      h('button', { class: 'btn ghost', onclick: (e) => {
        state.inventaire = editor.read();
        ctx.persist(); haptic.leger();
        e.target.textContent = 'Matériel enregistré ✓';
        setTimeout(() => { e.target.textContent = 'Enregistrer le matériel'; }, 1500);
      } }, 'Enregistrer le matériel'),
    ),
  );

  root.append(h('div', { class: 'card stack' },
    h('span', { class: 'eyebrow' }, 'RÉGLAGES'),
    rappelToggle('pesee', 'Rappel pesée du matin'),
    rappelToggle('bilan', 'Rappel bilan du dimanche'),
    h('button', { class: 'toggle' + (sonOn ? '' : ' rouge'), onclick: () => {
      state.settings.son = !sonOn;
      ctx.persist(); ctx.rerender();
    } }, h('span', {}, 'Son sec (timer & palier)'), h('span', { class: 'dot' })),
    materiel,
    h('div', { class: 'row' },
      kcalInput,
      h('button', { class: 'btn-mini', onclick: () => {
        const v = parseInt(kcalInput.value, 10);
        if (!v) return;
        state.settings.historiqueKcal.push({ d: todayISO(), de: state.settings.kcalCible, vers: v, raison: 'manuel' });
        state.settings.kcalCible = v; ctx.persist(); ctx.rerender();
      } }, 'kcal'),
    ),
    h('div', { class: 'row' },
      h('button', { class: 'btn-mini', style: { flex: 1 }, onclick: () =>
        download(`atlas-${todayISO()}.json`, exportJSON(state)) }, 'Export JSON'),
      h('button', { class: 'btn-mini', style: { flex: 1 }, onclick: () =>
        download(`atlas-${todayISO()}.csv`, exportCSV(state), 'text/csv') }, 'Export CSV'),
      h('button', { class: 'btn-mini', style: { flex: 1 }, onclick: () => fileInput.click() }, 'Import'),
      fileInput,
    ),
    h('button', { class: 'btn-mini', onclick: () => partagerCarte(ctx) }, 'Partager la semaine (image)'),
    h('button', { class: 'btn-mini', style: { color: 'var(--sang-seche)' }, onclick: () => {
      if (confirm('Tout effacer ? Exporte d’abord si tu veux garder tes données.')) {
        localStorage.removeItem('atlas-v1'); location.reload();
      }
    } }, 'Remise à zéro'),
  ));
}

// Carte de la semaine en image (format story, esthétique amphore).
function partagerCarte(ctx) {
  const { faites, planifiees, repsPrises, tenues } = statsSemaine(ctx);
  const pente = pentePctSemaine(ctx.state.poids, todayISO());
  const dernierBilan = ctx.state.fusibles.at(-1);
  const verdict = { gagnee: 'SEMAINE GAGNÉE', tendue: 'SEMAINE TENDUE', corriger: 'À CORRIGER' }[dernierBilan?.verdict] || `SEMAINE ${ctx.semaine()}`;

  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  g.fillStyle = '#100D0B'; g.fillRect(0, 0, 1080, 1920);
  g.fillStyle = '#C9622B';
  g.font = '900 130px Archivo, sans-serif'; g.textAlign = 'center';
  g.fillText('ATLAS', 540, 320);
  g.fillStyle = '#8A7E6F'; g.font = '40px "Space Mono", monospace';
  g.fillText(`SEMAINE ${ctx.semaine()}`, 540, 400);
  g.fillStyle = dernierBilan?.verdict === 'gagnee' ? '#7A9E5F' : '#E0A458';
  g.font = '900 92px Archivo, sans-serif';
  g.fillText(verdict, 540, 640);
  g.strokeStyle = g.fillStyle; g.lineWidth = 8;
  g.strokeRect(140, 540, 800, 150);
  g.fillStyle = '#EDE4D3'; g.font = '54px "Space Mono", monospace';
  const lignes = [
    `séances       ${faites}/${planifiees}`,
    `reps prises   ${repsPrises >= 0 ? '+' : ''}${repsPrises}`,
    `poids         ${pente != null ? pente.toFixed(1) + ' %/sem' : '—'}`,
    `charges       ${tenues}/${MAJEURS.length} tenues`,
    `paliers       ${ctx.state.paliers.length} gravés`,
  ];
  lignes.forEach((l, i) => { g.textAlign = 'left'; g.fillText(l, 180, 900 + i * 110); });
  g.fillStyle = '#8A7E6F'; g.font = '36px "Space Mono", monospace'; g.textAlign = 'center';
  g.fillText('le carnet qui calcule à ta place', 540, 1780);
  c.toBlob((blob) => download(`atlas-semaine-${ctx.semaine()}.png`, blob, 'image/png'));
}
