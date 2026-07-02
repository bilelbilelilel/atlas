// ATLAS — définition du programme (versionnée).
// Types d'exercice :
//   'charge'  : haltères / disques (charge en kg)
//   'lest'    : poids de corps + lest optionnel (dips, tractions) — palier = +2,5 kg
//   'echelle' : niveaux 1→4 remplacent la charge (leg curl glissé)
//   'temps'   : les secondes remplacent les reps (planche)

export const PROGRAM_VERSION = 1;

export const EXERCISES = {
  dips: {
    id: 'dips', nom: 'Dips', type: 'lest', materiel: 'un',
    fourchette: [6, 10], series: 4, repos: 90, majeur: true, isolation: false,
    sprite: 'dips', consigne: 'Coudes près du corps, descente contrôlée.',
    substitution: 'developpe_prise_neutre',
  },
  rowing_incline: {
    id: 'rowing_incline', nom: 'Rowing incliné', type: 'charge', materiel: 'deux',
    fourchette: [8, 12], series: 4, repos: 90, majeur: true, isolation: false,
    sprite: 'rowing', consigne: 'Poitrine collée au banc, tire vers la hanche.',
  },
  developpe_incline: {
    id: 'developpe_incline', nom: 'Développé incliné', type: 'charge', materiel: 'deux',
    fourchette: [8, 12], series: 3, repos: 90, majeur: false, isolation: false,
    sprite: 'press', consigne: 'Omoplates serrées, trajectoire légèrement arrière.',
  },
  curl: {
    id: 'curl', nom: 'Curl', type: 'charge', materiel: 'deux',
    fourchette: [8, 12], series: 3, repos: 60, majeur: false, isolation: true,
    sprite: 'curl', consigne: 'Coudes fixes, pas d’élan.',
  },
  elevations_laterales: {
    id: 'elevations_laterales', nom: 'Élévations latérales', type: 'charge', materiel: 'deux',
    fourchette: [12, 15], series: 2, repos: 60, majeur: false, isolation: true,
    sprite: 'raise', consigne: 'Monte avec le coude, pas la main.',
  },
  extension_triceps: {
    id: 'extension_triceps', nom: 'Extension triceps nuque', type: 'charge', materiel: 'un',
    fourchette: [10, 15], series: 2, repos: 60, majeur: false, isolation: true,
    sprite: 'triceps', consigne: 'Coudes serrés vers le plafond.',
  },
  squat_talons: {
    id: 'squat_talons', nom: 'Squat talons surélevés', type: 'charge', materiel: 'un',
    fourchette: [6, 10], series: 4, repos: 90, majeur: true, isolation: false,
    sprite: 'squat', consigne: 'Goblet, talons sur cale, buste droit.',
  },
  sdt: {
    id: 'sdt', nom: 'Soulevé de terre roumain', type: 'charge', materiel: 'deux',
    fourchette: [6, 10], series: 4, repos: 90, majeur: true, isolation: false,
    sprite: 'hinge', consigne: 'Hanches en arrière, dos neutre, tension ischio.',
  },
  leg_curl: {
    id: 'leg_curl', nom: 'Leg curl glissé', type: 'echelle', materiel: 'aucun',
    fourchette: [6, 12], series: 3, repos: 60, majeur: false, isolation: false,
    niveaux: 4, sprite: 'legcurl',
    consigne: 'Hanches hautes du début à la fin. Point.',
    niveauxLabels: ['N1 · deux jambes', 'N2 · excentrique lent', 'N3 · frein 4-6 s une jambe', 'N4 · une jambe complète'],
  },
  mollets: {
    id: 'mollets', nom: 'Mollets', type: 'charge', materiel: 'un',
    fourchette: [10, 15], series: 3, repos: 45, majeur: false, isolation: true,
    tempo: 'pause 2 s en bas', sprite: 'calf',
    consigne: 'Pause 2 s en bas, montée complète.',
  },
  roue_abdo: {
    id: 'roue_abdo', nom: 'Roue abdominale', type: 'lest', materiel: 'aucun',
    fourchette: [6, 12], series: 2, repos: 60, majeur: false, isolation: false,
    sprite: 'wheel', consigne: 'Bassin rétroversé, ne creuse pas le dos.',
  },
  planche: {
    id: 'planche', nom: 'Planche', type: 'temps', materiel: 'aucun',
    fourchette: [30, 60], series: 2, repos: 60, majeur: false, isolation: false,
    sprite: 'plank', consigne: 'Gainage total, respiration continue.',
  },
  developpe_couche: {
    id: 'developpe_couche', nom: 'Développé couché', type: 'charge', materiel: 'deux',
    fourchette: [6, 10], series: 4, repos: 90, majeur: true, isolation: false,
    sprite: 'bench', consigne: 'Pieds ancrés, barre de sécurité mentale : contrôle.',
  },
  tractions_pronation: {
    id: 'tractions_pronation', nom: 'Tractions pronation', type: 'lest', materiel: 'un',
    fourchette: [6, 10], series: 4, repos: 90, majeur: true, isolation: false,
    sprite: 'pullup', consigne: 'Poitrine vers la barre, descente complète.',
  },
  tractions_supination: {
    id: 'tractions_supination', nom: 'Tractions supination', type: 'lest', materiel: 'un',
    fourchette: [6, 10], series: 3, repos: 90, majeur: false, isolation: false,
    sprite: 'chinup', consigne: 'Coudes vers les côtes, pas de balancier.',
  },
  oiseau: {
    id: 'oiseau', nom: 'Oiseau', type: 'charge', materiel: 'deux',
    fourchette: [12, 15], series: 3, repos: 60, majeur: false, isolation: true,
    sprite: 'fly', consigne: 'Buste penché, ouvre avec les coudes.',
  },
  curl_marteau: {
    id: 'curl_marteau', nom: 'Curl marteau', type: 'charge', materiel: 'deux',
    fourchette: [8, 12], series: 2, repos: 60, majeur: false, isolation: true,
    sprite: 'hammer', consigne: 'Prise neutre, contrôle en descente.',
  },
  squat_bulgare: {
    id: 'squat_bulgare', nom: 'Squat bulgare', type: 'charge', materiel: 'deux',
    fourchette: [8, 12], series: 4, repos: 90, majeur: false, isolation: false,
    unilateral: true, sprite: 'bulgarian', consigne: 'Genou avant stable, descends droit.',
  },
  hip_thrust: {
    id: 'hip_thrust', nom: 'Hip thrust', type: 'charge', materiel: 'un',
    fourchette: [10, 15], series: 4, repos: 90, majeur: false, isolation: false,
    sprite: 'hipthrust', consigne: 'Menton rentré, verrouille en haut 1 s.',
  },
  sdt_unilateral: {
    id: 'sdt_unilateral', nom: 'SDT unilatéral', type: 'charge', materiel: 'un',
    fourchette: [8, 12], series: 3, repos: 60, majeur: false, isolation: false,
    unilateral: true, sprite: 'hinge', consigne: 'Hanche arrière, bassin fermé.',
  },
  fentes_arriere: {
    id: 'fentes_arriere', nom: 'Fentes arrière', type: 'charge', materiel: 'deux',
    fourchette: [8, 12], series: 2, repos: 60, majeur: false, isolation: false,
    unilateral: true, sprite: 'lunge', consigne: 'Recule, descends, pousse dans le talon avant.',
  },
  developpe_prise_neutre: {
    id: 'developpe_prise_neutre', nom: 'Développé prise neutre', type: 'charge', materiel: 'deux',
    fourchette: [8, 12], series: 4, repos: 90, majeur: true, isolation: false,
    sprite: 'press', consigne: 'Variante de substitution des dips (épaules sensibles).',
  },
};

// 5 séances / semaine. 0 = dimanche … 6 = samedi.
export const SESSIONS = {
  hautA: {
    id: 'hautA', nom: 'Haut A',
    exercices: ['dips', 'rowing_incline', 'developpe_incline', 'curl', 'elevations_laterales', 'extension_triceps'],
  },
  basA: {
    id: 'basA', nom: 'Bas A',
    exercices: ['squat_talons', 'sdt', 'leg_curl', 'mollets', 'roue_abdo', 'planche'],
  },
  hautB: {
    id: 'hautB', nom: 'Haut B',
    exercices: ['developpe_couche', 'tractions_pronation', 'tractions_supination', 'oiseau', 'curl_marteau', 'elevations_laterales'],
  },
  basB: {
    id: 'basB', nom: 'Bas B',
    exercices: ['squat_bulgare', 'hip_thrust', 'sdt_unilateral', 'fentes_arriere', 'mollets', 'planche'],
  },
  fusible: {
    id: 'fusible', nom: 'Fusible', optionnelle: true,
    exercices: ['dips', 'rowing_incline', 'squat_talons', 'hip_thrust', 'curl', 'roue_abdo'],
    seriesOverride: 2,
  },
};

export const SCHEDULE = { 1: 'hautA', 2: 'basA', 4: 'hautB', 5: 'basB', 6: 'fusible' };

export function sessionForDay(dayOfWeek) {
  const id = SCHEDULE[dayOfWeek];
  return id ? SESSIONS[id] : null;
}

export function exercisesOf(session) {
  return session.exercices.map((id) => EXERCISES[id]);
}

// Les 6 exercices majeurs de l'indice de force (planifiés — les substitutions
// héritent du statut majeur via l'historique transféré, pas via cette liste).
const PLANIFIES = new Set(Object.values(SESSIONS).flatMap((s) => s.exercices));
export const MAJEURS = Object.values(EXERCISES)
  .filter((e) => e.majeur && PLANIFIES.has(e.id))
  .map((e) => e.id);
