// ATLAS — le moteur de progression. Le cerveau.
// Tourne en local, hors ligne, sans un seul appel réseau. Déterministe, testable.

import { prochaineChargePossible, chargeAllegee, descriptionCharge, fmtKg } from './inventory.js';

export const ELARGISSEMENT = 2; // fourchette élargie : +2 reps sur le haut

// ---------------------------------------------------------------------------
// Semaine & mode
// ---------------------------------------------------------------------------

export function semaineCourante(dateDebut, aujourdHui) {
  const d0 = toDate(dateDebut);
  const d1 = toDate(aujourdHui);
  const days = Math.floor((d1 - d0) / 86400000);
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}

// Mode par défaut selon la semaine. La semaine allégée et le maintien sont des
// décisions (1 tap) stockées dans state.mode — le moteur les respecte telles quelles.
export function modeParDefaut(semaine) {
  if (semaine <= 0) return 'normal';
  if (semaine <= 2) return 'rampe';
  return 'normal';
}

export function reserveCible(mode, etalonnage = false) {
  if (mode === 'allegee') return [3, 4];
  if (mode === 'rampe' || etalonnage) return [2, 3];
  return [1, 2];
}

export function seriesEffectives(ex, mode, seriesOverride) {
  let n = seriesOverride ?? ex.series;
  if (mode === 'allegee') return Math.min(n, 2);
  if (mode === 'rampe') return ex.isolation ? Math.min(n, 2) : Math.min(n, 3);
  return n;
}

// ---------------------------------------------------------------------------
// Fourchette effective (élargissements automatiques)
// ---------------------------------------------------------------------------

// Palier raté = séance dont la charge vient de monter et dont la première série
// n'atteint même pas le bas de la fourchette. Raté 2× de suite → proposer +2.
export function palierRate2x(ex, histo) {
  if (!histo || histo.length < 3) return false;
  const [avant, s1, s2] = histo.slice(-3);
  const bas = ex.fourchette[0];
  const monte = chargeDe(s1, ex) > chargeDe(avant, ex);
  const memeCharge = chargeDe(s2, ex) === chargeDe(s1, ex);
  return monte && memeCharge && (s1.reps[0] ?? 0) < bas && (s2.reps[0] ?? 0) < bas;
}

// Fourchette réellement en vigueur pour cet exercice.
// exState.fourchetteElargie : élargissement accepté (palier raté 2×) ou appliqué
// automatiquement (saut matériel > 7 %).
export function fourchetteEffective(ex, histo, inventaire, exState = {}) {
  let [bas, haut] = ex.fourchette;
  let raison = null;
  if (exState.fourchetteElargie) {
    haut += ELARGISSEMENT;
    raison = 'elargie';
  } else if (ex.type === 'charge' || ex.type === 'lest') {
    const d = dernier(histo);
    if (d) {
      const saut = prochaineChargePossible(inventaire, d.charge ?? 0, ex.materiel, ex.type === 'lest' ? 2.5 : 0);
      if (saut && saut.tropBrutal) {
        haut += ELARGISSEMENT;
        raison = 'saut';
      }
    }
  }
  return { bas, haut, raison };
}

// ---------------------------------------------------------------------------
// cibleSuivante — la fonction centrale
// ---------------------------------------------------------------------------
// ex        : définition d'exercice (program.js)
// histo     : logs de l'exercice, ordre chronologique [{ d, charge, reps[], reserve[], niveau }]
// ctx       : { mode, semaine, inventaire, exState, seriesOverride }
//
// Retour : { type: 'etalonnage'|'battre'|'palier', charge, niveau, repsCible[],
//            reserve, series, repos, affichage, notes[], propositions[] }

export function cibleSuivante(ex, histo, ctx = {}) {
  const mode = ctx.mode || 'normal';
  const inventaire = ctx.inventaire || {};
  const exState = ctx.exState || {};
  const series = seriesEffectives(ex, mode, ctx.seriesOverride);
  const notes = [];
  const propositions = [];

  // --- Première fois : étalonnage -----------------------------------------
  if (!histo || histo.length === 0) {
    const bas = ex.fourchette[0];
    const t = {
      type: 'etalonnage', series, repos: ex.repos,
      charge: ex.type === 'charge' ? null : 0,
      niveau: ex.type === 'echelle' ? 1 : null,
      repsCible: Array(series).fill(bas),
      reserve: reserveCible(mode, true),
      notes, propositions,
    };
    notes.push('Étalonnage : prends léger, garde 2-3 en réserve.');
    if (ex.tempo) notes.push(`Tempo : ${ex.tempo}.`);
    t.affichage = affichage(ex, t, inventaire);
    return t;
  }

  const d = dernier(histo);
  const { bas, haut, raison } = fourchetteEffective(ex, histo, inventaire, exState);

  // --- Semaine allégée : 2 séries, −25 %, réserve 3-4 ----------------------
  if (mode === 'allegee') {
    const mid = Math.round((ex.fourchette[0] + ex.fourchette[1]) / 2);
    const t = {
      type: 'battre', series, repos: ex.repos,
      charge: ex.type === 'charge' || ex.type === 'lest' ? chargeAllegee(inventaire, d.charge ?? 0, ex.materiel) : 0,
      niveau: ex.type === 'echelle' ? Math.max(1, (d.niveau ?? 1) - 1) : null,
      repsCible: Array(series).fill(ex.type === 'temps' ? bas : mid),
      reserve: reserveCible(mode), notes, propositions,
    };
    notes.push('Semaine allégée : on décharge, on ne teste rien.');
    t.affichage = affichage(ex, t, inventaire);
    return t;
  }

  const toutesAuHaut = d.reps.length > 0 && d.reps.every((r) => r >= haut);

  // --- Échelle (leg curl glissé) : le niveau remplace la charge -------------
  if (ex.type === 'echelle') {
    const niveau = d.niveau ?? 1;
    if (toutesAuHaut && niveau < (ex.niveaux ?? 4)) {
      const t = {
        type: 'palier', series, repos: ex.repos, charge: 0, niveau: niveau + 1,
        repsCible: Array(series).fill(bas), reserve: reserveCible(mode), notes, propositions,
      };
      notes.push(`Niveau ${niveau + 1} : ${ex.niveauxLabels?.[niveau] ?? ''}`.trim());
      t.affichage = affichage(ex, t, inventaire);
      return t;
    }
    const t = battre(ex, d, { series, bas, haut, mode, notes, propositions, niveau });
    if (toutesAuHaut) notes.push('Niveau max atteint — continue à engranger des reps propres.');
    t.affichage = affichage(ex, t, inventaire);
    return t;
  }

  // --- Temps (planche) ------------------------------------------------------
  if (ex.type === 'temps') {
    const t = battre(ex, d, { series, bas, haut, mode, notes, propositions, pas: 5 });
    if (toutesAuHaut) notes.push('Au-delà de la fourchette — envisage la version lestée.');
    t.affichage = affichage(ex, t, inventaire);
    return t;
  }

  // --- Charge & lest --------------------------------------------------------
  if (toutesAuHaut) {
    const saut = prochaineChargePossible(inventaire, d.charge ?? 0, ex.materiel, ex.type === 'lest' ? 2.5 : 0);
    if (saut && (!saut.tropBrutal || raison === 'elargie' || d.reps.every((r) => r >= haut))) {
      const t = {
        type: 'palier', series, repos: ex.repos, charge: saut.charge, niveau: null,
        repsCible: Array(series).fill(ex.fourchette[0]), reserve: reserveCible(mode), notes, propositions,
      };
      notes.push(`Palier : ${descriptionCharge(inventaire, saut.charge, ex)}.`);
      if (saut.tropBrutal) notes.push('Gros saut matériel — si ça coince, la fourchette s’élargira seule.');
      t.affichage = affichage(ex, t, inventaire);
      return t;
    }
    // Plafond matériel : on continue à engranger des reps.
    const t = battre(ex, d, { series, bas, haut: haut + ELARGISSEMENT, mode, notes, propositions });
    notes.push('Plafond matériel atteint — fourchette élargie en attendant plus lourd.');
    t.affichage = affichage(ex, t, inventaire);
    return t;
  }

  const t = battre(ex, d, { series, bas, haut, mode, notes, propositions });
  if (raison === 'saut') notes.push(`Fourchette élargie à ${bas}-${haut} : le prochain saut de charge est costaud.`);
  if (palierRate2x(ex, histo) && !ctx.exState?.fourchetteElargie) {
    propositions.push({
      type: 'elargir_fourchette',
      texte: `Palier raté 2× de suite — élargir la fourchette à ${bas}-${ex.fourchette[1] + ELARGISSEMENT} ?`,
    });
  }
  t.affichage = affichage(ex, t, inventaire);
  return t;
}

// Mode BATTRE : cible = dernières reps, +1 sur la première série sous le haut.
function battre(ex, d, { series, bas, haut, mode, notes, propositions, niveau = null, pas = 1 }) {
  const reps = [];
  for (let i = 0; i < series; i++) {
    reps.push(d.reps[i] ?? d.reps[d.reps.length - 1] ?? bas);
  }
  let done = false;
  const cible = reps.map((r) => {
    if (!done && r < haut) { done = true; return Math.min(r + pas, haut); }
    return r;
  });
  return {
    type: 'battre', series, repos: ex.repos,
    charge: ex.type === 'charge' || ex.type === 'lest' ? (d.charge ?? 0) : 0,
    niveau: ex.type === 'echelle' ? niveau : null,
    repsCible: cible, reserve: reserveCible(mode), notes, propositions,
    aBattre: d.reps.slice(0, series),
  };
}

// « battre 11·9·8 @ +10 kg » — jamais de calcul mental.
function affichage(ex, t, inventaire) {
  const unit = ex.type === 'temps' ? ' s' : '';
  const reps = (t.aBattre?.length ? t.aBattre : t.repsCible).join('·') + unit;
  const verbe = t.type === 'battre' && t.aBattre ? 'battre ' : '';
  let charge = '';
  if (ex.type === 'echelle') charge = ` · niveau ${t.niveau}`;
  else if (ex.type === 'lest') charge = t.charge > 0 ? ` @ +${fmtKg(t.charge)}` : '';
  else if (ex.type === 'charge') charge = t.charge != null ? ` @ ${fmtKg(t.charge)}` : ' — étalonnage';
  return `${verbe}${reps}${charge}`;
}

// ---------------------------------------------------------------------------
// Garde-fous globaux
// ---------------------------------------------------------------------------

// Régression sur ≥2 séances pour ≥3 exercices → lever le fusible « charges ».
export function fusibleChargesAuto(logsByEx) {
  let regresses = 0;
  for (const histo of Object.values(logsByEx || {})) {
    if (!histo || histo.length < 3) continue;
    const [a, b, c] = histo.slice(-3);
    if (total(c) < total(b) && total(b) < total(a)
      && (c.charge ?? 0) === (b.charge ?? 0) && (b.charge ?? 0) === (a.charge ?? 0)) {
      regresses++;
    }
  }
  return regresses >= 3;
}

// Douleur signalée 2× sur le même exercice → proposer la substitution.
export function substitutionAPproposer(douleurs, exerciceId) {
  const n = (douleurs || []).filter((x) => x.exerciceId === exerciceId).length;
  return n >= 2;
}

// ---------------------------------------------------------------------------
// Indice de force — la Ligne de défense
// ---------------------------------------------------------------------------
// Somme des meilleures séries (charge effective × reps) des exercices majeurs.
// Pour les exercices lestés, la charge effective inclut le poids de corps.

export function indiceForceBrut(logsByEx, exercises, majeurs, poidsCorps) {
  let sum = 0;
  for (const id of majeurs) {
    const histo = logsByEx?.[id];
    const d = dernier(histo);
    if (!d || !d.reps.length) continue;
    const ex = exercises[id];
    const chargeEff = ex.type === 'lest' ? (poidsCorps || 0) + (d.charge ?? 0) : (d.charge ?? 0);
    sum += chargeEff * Math.max(...d.reps);
  }
  return sum;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function dernier(histo) { return histo && histo.length ? histo[histo.length - 1] : null; }
function total(s) { return (s.reps || []).reduce((a, b) => a + b, 0); }
function chargeDe(s, ex) { return ex.type === 'echelle' ? (s.niveau ?? 1) : (s.charge ?? 0); }
function toDate(d) { return typeof d === 'string' ? new Date(d + 'T00:00:00') : d; }
