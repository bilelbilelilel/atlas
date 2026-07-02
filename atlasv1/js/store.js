// ATLAS — persistance. Local-first absolu : un seul document JSON.
// Aucune donnée ne quitte l'appareil. Export/import JSON = la sauvegarde.

import { PROGRAM_VERSION } from './program.js';

const KEY = 'atlas-v1';

export function defaultState() {
  return {
    version: 1,
    programmeVersion: PROGRAM_VERSION,
    settings: {
      dateDebut: null,          // 'YYYY-MM-DD' (un lundi)
      kcalCible: 0,
      historiqueKcal: [],       // [{ d, de, vers, raison }]
      rappels: { bilan: true, pesee: true },
      son: false,               // blip timer & palier — optionnel
      cycle: 1,
      onboarded: false,
    },
    cycles: [],                 // cycles archivés [{ n, debut, fin, paliers, poidsDebut, poidsFin }]
    inventaire: { barre: 2, nbBarres: 2, disques: [], chargesFixes: [], lestDips: true },
    exercices: {},              // exerciceId -> { fourchetteElargie, substitue }
    logs: {},                   // exerciceId -> [{ d, charge, reps[], reserve[], niveau }]
    poids: [],                  // [{ d, kg }]
    pas: [],                    // [{ d, n }]
    seances: [],                // [{ d, id, etat: 'faite'|'sautee'|'brouillon', duree, brouillon? }]
    paliers: [],                // [{ d, exerciceId, charge, niveau }]
    fusibles: [],               // [{ semaine, flags: [charges, articulations, sommeil, envie], verdict }]
    douleurs: [],               // [{ d, exerciceId, zone }]
    mode: { type: 'rampe', semaine: 1, jusquA: null },
    indiceForceBase: null,      // { valeur, d } — base 100 fixée semaine 3
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return migrate({ ...defaultState(), ...parsed });
  } catch {
    return defaultState();
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function migrate(state) {
  // v1 : rien à migrer. Le champ version est là pour la V2 (import SwiftData trivial par design).
  return state;
}

// --- Export / import : tes données t'appartiennent, toujours ----------------

export function exportJSON(state) {
  return JSON.stringify(state, null, 2);
}

export function exportCSV(state) {
  const lines = ['date;exercice;charge;niveau;reps;reserve'];
  for (const [exId, histo] of Object.entries(state.logs || {})) {
    for (const s of histo) {
      lines.push(`${s.d};${exId};${s.charge ?? ''};${s.niveau ?? ''};${(s.reps || []).join('|')};${(s.reserve || []).join('|')}`);
    }
  }
  lines.push('', 'date;poids_kg');
  for (const p of state.poids || []) lines.push(`${p.d};${p.kg}`);
  return lines.join('\n');
}

export function importJSON(raw) {
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed.version == null) {
    throw new Error('Fichier invalide : pas un export ATLAS.');
  }
  return migrate({ ...defaultState(), ...parsed });
}

// --- Petits accès triés ------------------------------------------------------

export function logsOf(state, exId) {
  return (state.logs[exId] || []).slice().sort((a, b) => a.d.localeCompare(b.d));
}

export function pushLog(state, exId, entry) {
  if (!state.logs[exId]) state.logs[exId] = [];
  state.logs[exId].push(entry);
  state.logs[exId].sort((a, b) => a.d.localeCompare(b.d));
}

export function upsertPoids(state, d, kg) {
  const found = state.poids.find((p) => p.d === d);
  if (found) found.kg = kg;
  else { state.poids.push({ d, kg }); state.poids.sort((a, b) => a.d.localeCompare(b.d)); }
}

// Fin de maintien → nouveau cycle : on archive, on repart du lundi suivant.
// L'historique des exercices est conservé — la progression continue, seul le
// compteur de semaines repart (rampe comprise).
export function archiverCycle(state, aujourdHui = todayISO()) {
  const s = state.settings;
  const debut = s.dateDebut;
  state.cycles = state.cycles || [];
  const archive = {
    n: s.cycle ?? 1,
    debut,
    fin: aujourdHui,
    paliers: state.paliers.filter((p) => p.d >= debut).length,
    poidsDebut: state.poids.find((p) => p.d >= debut)?.kg ?? null,
    poidsFin: state.poids.at(-1)?.kg ?? null,
  };
  state.cycles.push(archive);
  s.cycle = (s.cycle ?? 1) + 1;
  const now = new Date(aujourdHui + 'T00:00:00');
  const delta = ((8 - now.getDay()) % 7) || 7; // toujours le lundi SUIVANT
  s.dateDebut = new Date(now.getTime() + delta * 86400000).toISOString().slice(0, 10);
  state.mode = { type: 'rampe', semaine: 1, jusquA: null };
  return archive;
}

export function todayISO(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
