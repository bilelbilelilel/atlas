// Tests du moteur ATLAS — `node --test atlas/tests/`
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EXERCISES, SESSIONS, SCHEDULE, MAJEURS, sessionForDay } from '../js/program.js';
import { possibleCharges, prochaineChargePossible, chargeAllegee, descriptionCharge } from '../js/inventory.js';
import {
  cibleSuivante, semaineCourante, modeParDefaut, seriesEffectives,
  palierRate2x, fusibleChargesAuto, indiceForceBrut, substitutionAPproposer,
} from '../js/engine.js';
import { moyenne7j, pentePctSemaine, verdictNutrition } from '../js/nutrition.js';
import { defaultState, archiverCycle } from '../js/store.js';

// Inventaire de référence : 2 barres de 2 kg, micro-disques 0,25, paires
// 2×1,25 / 2×2 / 4×5 / 2×10 par haltère, un haltère fixe de 10.
const INV = {
  barre: 2, nbBarres: 2,
  disques: [{ kg: 0.25, nb: 4 }, { kg: 1.25, nb: 4 }, { kg: 2, nb: 4 }, { kg: 5, nb: 8 }, { kg: 10, nb: 4 }],
  chargesFixes: [10], lestDips: true,
};

const log = (d, charge, reps, reserve = [], niveau = null) => ({ d, charge, reps, reserve, niveau });

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

test('programme : 5 séances planifiées, 6 exercices chacune', () => {
  assert.equal(Object.keys(SCHEDULE).length, 5);
  for (const s of Object.values(SESSIONS)) assert.equal(s.exercices.length, 6);
  assert.equal(sessionForDay(1).id, 'hautA');
  assert.equal(sessionForDay(6).id, 'fusible');
  assert.equal(sessionForDay(0), null);
});

test('programme : 18 segments par séance principale (hors fusible)', () => {
  for (const s of Object.values(SESSIONS)) {
    if (s.id === 'fusible') continue;
    const total = s.exercices.reduce((a, id) => a + EXERCISES[id].series, 0);
    assert.equal(total, 18, `${s.id} = ${total}`);
  }
});

test('programme : 6 exercices majeurs pour l’indice de force', () => {
  assert.equal(MAJEURS.length, 6);
});

// ---------------------------------------------------------------------------
// Inventaire
// ---------------------------------------------------------------------------

test('inventaire : charges symétriques uniquement, jamais une charge qui n’existe pas', () => {
  const deux = possibleCharges(INV, 'deux');
  assert.ok(deux.includes(2));      // barre vide
  assert.ok(deux.includes(4.5));    // 2 + 2×1,25
  assert.ok(deux.includes(12));     // 2 + 2×5
  assert.ok(deux.includes(22));     // 2 + 2×10
  assert.ok(!deux.includes(3));     // impossible symétriquement
  // Une seule paire de 10 au total : un haltère peut la prendre, pas deux.
  const inv2 = { barre: 2, nbBarres: 2, disques: [{ kg: 10, nb: 2 }] };
  assert.ok(possibleCharges(inv2, 'un').includes(22));
  assert.ok(!possibleCharges(inv2, 'deux').includes(22));
});

test('inventaire : prochaineChargePossible respecte le vrai saut', () => {
  const n = prochaineChargePossible(INV, 12, 'deux');
  assert.equal(n.charge, 12.5);     // micro-disques 0,25 → +0,5
  assert.ok(!n.tropBrutal);
  const gros = prochaineChargePossible({ barre: 2, nbBarres: 2, disques: [{ kg: 5, nb: 8 }] }, 12, 'deux');
  assert.equal(gros.charge, 22);
  assert.ok(gros.tropBrutal); // +83 % > 7 %
});

test('inventaire : lest dips — palier +2,5 kg minimum', () => {
  const n = prochaineChargePossible(INV, 0, 'un', 2.5);
  assert.ok(n.charge >= 2.5);
  const desc = descriptionCharge(INV, 10, EXERCISES.dips);
  assert.match(desc, /haltère de 10 kg entre les jambes/);
});

test('inventaire : plafond matériel → null', () => {
  assert.equal(prochaineChargePossible(INV, 999, 'deux'), null);
});

test('inventaire : chargeAllegee arrondit vers le bas sur du matériel réel', () => {
  assert.ok(chargeAllegee(INV, 20, 'deux') <= 15);
});

// ---------------------------------------------------------------------------
// Moteur de progression
// ---------------------------------------------------------------------------

test('moteur : histo vide → étalonnage, cible = bas de fourchette, réserve 2-3', () => {
  const t = cibleSuivante(EXERCISES.rowing_incline, [], { mode: 'normal', inventaire: INV });
  assert.equal(t.type, 'etalonnage');
  assert.equal(t.charge, null);
  assert.deepEqual(t.repsCible, [8, 8, 8, 8]);
  assert.deepEqual(t.reserve, [2, 3]);
});

test('moteur : battre — +1 sur la première série sous le haut', () => {
  const histo = [log('2026-06-22', 12, [11, 9, 8, 8])];
  const t = cibleSuivante(EXERCISES.rowing_incline, histo, { mode: 'normal', inventaire: INV });
  assert.equal(t.type, 'battre');
  assert.deepEqual(t.repsCible, [12, 9, 8, 8]); // 11→12 (haut=12)
  assert.equal(t.charge, 12);
  assert.match(t.affichage, /battre 11·9·8·8 @ 12 kg/);
});

test('moteur : battre — première série déjà au haut → +1 sur la suivante', () => {
  const histo = [log('2026-06-22', 12, [12, 9, 8, 8])];
  const t = cibleSuivante(EXERCISES.rowing_incline, histo, { mode: 'normal', inventaire: INV });
  assert.deepEqual(t.repsCible, [12, 10, 8, 8]);
});

test('moteur : palier — toutes les séries au haut → charge suivante, cible = bas', () => {
  const histo = [log('2026-06-22', 12, [12, 12, 12, 12])];
  const t = cibleSuivante(EXERCISES.rowing_incline, histo, { mode: 'normal', inventaire: INV });
  assert.equal(t.type, 'palier');
  assert.equal(t.charge, 12.5);
  assert.deepEqual(t.repsCible, [8, 8, 8, 8]);
});

test('moteur : saut matériel > 7 % → fourchette élargie, pas de palier prématuré', () => {
  const invPauvre = { barre: 2, nbBarres: 2, disques: [{ kg: 5, nb: 8 }] }; // 12 → 22 direct
  const histo = [log('2026-06-22', 12, [12, 12, 11, 10])];
  const t = cibleSuivante(EXERCISES.rowing_incline, histo, { mode: 'normal', inventaire: invPauvre });
  assert.equal(t.type, 'battre'); // 11 et 10 sous le haut élargi (14)
  const histo2 = [log('2026-06-22', 12, [14, 14, 14, 14])];
  const t2 = cibleSuivante(EXERCISES.rowing_incline, histo2, { mode: 'normal', inventaire: invPauvre });
  assert.equal(t2.type, 'palier'); // haut élargi atteint → on saute quand même
  assert.equal(t2.charge, 22);
});

test('moteur : plafond matériel → fourchette élargie, jamais de charge inexistante', () => {
  const invMini = { barre: 2, nbBarres: 2, disques: [] };
  const histo = [log('2026-06-22', 2, [12, 12, 12, 12])];
  const t = cibleSuivante(EXERCISES.rowing_incline, histo, { mode: 'normal', inventaire: invMini });
  assert.equal(t.type, 'battre');
  assert.equal(t.charge, 2);
  assert.ok(t.notes.some((n) => /Plafond matériel/.test(n)));
});

test('moteur : échelle — 12 propres partout → niveau+1, reps reset à 6', () => {
  const histo = [log('2026-06-23', null, [12, 12, 12], [], 2)];
  const t = cibleSuivante(EXERCISES.leg_curl, histo, { mode: 'normal', inventaire: INV });
  assert.equal(t.type, 'palier');
  assert.equal(t.niveau, 3);
  assert.deepEqual(t.repsCible, [6, 6, 6]);
});

test('moteur : échelle — niveau 4 max, pas de niveau 5', () => {
  const histo = [log('2026-06-23', null, [12, 12, 12], [], 4)];
  const t = cibleSuivante(EXERCISES.leg_curl, histo, { mode: 'normal', inventaire: INV });
  assert.equal(t.type, 'battre');
  assert.equal(t.niveau, 4);
});

test('moteur : temps (planche) — les secondes remplacent les reps, pas de 5 s', () => {
  const histo = [log('2026-06-23', null, [45, 40])];
  const t = cibleSuivante(EXERCISES.planche, histo, { mode: 'normal', inventaire: INV });
  assert.deepEqual(t.repsCible, [50, 40]);
  assert.match(t.affichage, /battre 45·40 s/);
});

test('moteur : rampe — séries 4→3, isolation→2, réserve 2-3', () => {
  assert.equal(seriesEffectives(EXERCISES.dips, 'rampe'), 3);
  assert.equal(seriesEffectives(EXERCISES.curl, 'rampe'), 2);
  const histo = [log('2026-06-22', 12, [10, 9, 8])];
  const t = cibleSuivante(EXERCISES.rowing_incline, histo, { mode: 'rampe', inventaire: INV });
  assert.equal(t.series, 3);
  assert.deepEqual(t.reserve, [2, 3]);
});

test('moteur : allégée — 2 séries, charge -25 % snappée inventaire, réserve 3-4', () => {
  const histo = [log('2026-06-22', 22, [12, 10, 9, 8])];
  const t = cibleSuivante(EXERCISES.rowing_incline, histo, { mode: 'allegee', inventaire: INV });
  assert.equal(t.series, 2);
  assert.ok(t.charge <= 16.5);
  assert.ok(possibleCharges(INV, 'deux').includes(t.charge));
  assert.deepEqual(t.reserve, [3, 4]);
});

test('moteur : palier raté 2× de suite → proposition d’élargir', () => {
  const ex = EXERCISES.rowing_incline;
  const histo = [
    log('2026-06-08', 12, [12, 12, 12, 12]),
    log('2026-06-15', 12.5, [7, 6, 6, 5]),
    log('2026-06-22', 12.5, [7, 7, 6, 5]),
  ];
  assert.ok(palierRate2x(ex, histo));
  const t = cibleSuivante(ex, histo, { mode: 'normal', inventaire: INV });
  assert.ok(t.propositions.some((p) => p.type === 'elargir_fourchette'));
  // fourchette élargie acceptée → le haut monte de 2
  const t2 = cibleSuivante(ex, histo, { mode: 'normal', inventaire: INV, exState: { fourchetteElargie: true } });
  assert.equal(t2.type, 'battre');
});

test('moteur : régression ≥2 séances sur ≥3 exercices → fusible charges auto', () => {
  const reg = (c) => [log('2026-06-08', c, [10, 9, 8]), log('2026-06-15', c, [9, 8, 8]), log('2026-06-22', c, [8, 8, 7])];
  const logsByEx = { a: reg(10), b: reg(12), c: reg(14) };
  assert.ok(fusibleChargesAuto(logsByEx));
  assert.ok(!fusibleChargesAuto({ a: reg(10), b: reg(12) }));
});

test('moteur : substitution proposée après 2 douleurs sur le même exercice', () => {
  const douleurs = [
    { d: '2026-06-15', exerciceId: 'dips', zone: 'épaule' },
    { d: '2026-06-22', exerciceId: 'dips', zone: 'épaule' },
  ];
  assert.ok(substitutionAPproposer(douleurs, 'dips'));
  assert.ok(!substitutionAPproposer(douleurs, 'curl'));
});

test('moteur : indice de force — le lest inclut le poids de corps', () => {
  const logsByEx = {
    dips: [log('2026-06-22', 10, [9, 8, 8, 7])],
    rowing_incline: [log('2026-06-22', 12, [11, 9, 8, 8])],
  };
  const idx = indiceForceBrut(logsByEx, EXERCISES, ['dips', 'rowing_incline'], 80);
  assert.equal(idx, (80 + 10) * 9 + 12 * 11);
});

test('moteur : semaine courante et mode par défaut', () => {
  assert.equal(semaineCourante('2026-06-22', '2026-06-22'), 1);
  assert.equal(semaineCourante('2026-06-22', '2026-06-29'), 2);
  assert.equal(semaineCourante('2026-06-22', '2026-07-06'), 3);
  assert.equal(modeParDefaut(1), 'rampe');
  assert.equal(modeParDefaut(3), 'normal');
});

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

function poidsLineaire(kg0, pctParSemaine, jours, depuis = '2026-06-01') {
  const out = [];
  const t0 = new Date(depuis + 'T00:00:00').getTime();
  for (let i = 0; i < jours; i++) {
    const d = new Date(t0 + i * 86400000).toISOString().slice(0, 10);
    out.push({ d, kg: kg0 * Math.pow(1 + pctParSemaine / 100, i / 7) });
  }
  return out;
}

test('nutrition : semaines 1-2 → chute d’eau, on ne conclut rien', () => {
  const v = verdictNutrition({ poids: poidsLineaire(85, -1.5, 14), jour: '2026-06-14', semaine: 2, kcalCible: 2400 });
  assert.equal(v.code, 'eau');
});

test('nutrition : −0,4 à −0,7 %/sem → ne touche à rien', () => {
  const v = verdictNutrition({ poids: poidsLineaire(85, -0.55, 35), jour: '2026-07-05', semaine: 5, kcalCible: 2400 });
  assert.equal(v.code, 'ok');
});

test('nutrition : plat 2 semaines → retire 200 kcal, 1 tap', () => {
  const v = verdictNutrition({ poids: poidsLineaire(85, 0, 35), jour: '2026-07-05', semaine: 5, kcalCible: 2400 });
  assert.equal(v.code, 'plat');
  assert.equal(v.action.nouvelleCible, 2200);
});

test('nutrition : plat 1 semaine seulement → on observe, pas de correction', () => {
  const poids = [...poidsLineaire(85, -0.6, 21), ...poidsLineaire(83.5, 0, 14, '2026-06-22')];
  const v = verdictNutrition({ poids, jour: '2026-07-01', semaine: 5, kcalCible: 2400 });
  assert.equal(v.code, 'observe');
});

test('nutrition : > −1 %/sem après sem. 2 → ajoute 150-200 kcal', () => {
  const v = verdictNutrition({ poids: poidsLineaire(85, -1.4, 28), jour: '2026-06-28', semaine: 4, kcalCible: 2400 });
  assert.equal(v.code, 'trop_vite');
  assert.equal(v.action.nouvelleCible, 2575);
});

test('nutrition : semaine 12 → maintien +400', () => {
  const v = verdictNutrition({ poids: [], jour: '2026-08-30', semaine: 12, kcalCible: 2200 });
  assert.equal(v.code, 'maintien');
  assert.equal(v.action.nouvelleCible, 2600);
});

// ---------------------------------------------------------------------------
// Cycles
// ---------------------------------------------------------------------------

test('cycle : archiver → compteur+1, redémarrage le lundi SUIVANT, rampe', () => {
  const state = defaultState();
  state.settings.dateDebut = '2026-04-06';
  state.settings.cycle = 1;
  state.poids = [{ d: '2026-04-06', kg: 85 }, { d: '2026-07-01', kg: 80 }];
  state.paliers = [{ d: '2026-05-10', exerciceId: 'dips', charge: 5 }];
  const archive = archiverCycle(state, '2026-07-02'); // un jeudi
  assert.equal(archive.n, 1);
  assert.equal(archive.paliers, 1);
  assert.equal(archive.poidsDebut, 85);
  assert.equal(archive.poidsFin, 80);
  assert.equal(state.settings.cycle, 2);
  assert.equal(state.settings.dateDebut, '2026-07-06'); // lundi suivant
  assert.equal(state.mode.type, 'rampe');
  assert.equal(state.cycles.length, 1);
});

test('cycle : archiver un lundi → départ le lundi d’après, jamais le jour même', () => {
  const state = defaultState();
  state.settings.dateDebut = '2026-04-06';
  archiverCycle(state, '2026-07-06'); // un lundi
  assert.equal(state.settings.dateDebut, '2026-07-13');
});

test('nutrition : moyenne 7 j ignore les points hors fenêtre', () => {
  const poids = [{ d: '2026-06-01', kg: 90 }, { d: '2026-06-20', kg: 84 }, { d: '2026-06-22', kg: 83 }];
  assert.equal(moyenne7j(poids, '2026-06-22'), 83.5);
  assert.equal(moyenne7j(poids, '2026-05-01'), null);
});
