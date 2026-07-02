// ATLAS — inventaire matériel.
// ATLAS ne propose jamais une charge qui n'existe pas chez toi.
//
// inventaire = {
//   barre: 2,                                  // poids d'une barre courte vide (kg)
//   nbBarres: 2,
//   disques: [{ kg: 1.25, nb: 4 }, ...],       // nb = nombre TOTAL de disques
//   chargesFixes: [10, 16],                    // haltères fixes / kettlebells (kg)
//   lestDips: true,                            // un haltère peut servir de lest
// }

const EPS = 1e-6;

function round1(x) { return Math.round(x * 100) / 100; }

// Charges atteignables sur UN implément, chargé symétriquement.
// materiel 'un'   : un seul haltère utilisé → chaque taille fournit floor(nb/2) paires.
// materiel 'deux' : deux haltères chargés pareil → floor(nb/4) paires par haltère.
export function possibleCharges(inventaire, materiel = 'deux') {
  const inv = inventaire || {};
  const divisor = materiel === 'un' ? 2 : 4;
  const barre = inv.barre ?? 0;
  const hasBars = (inv.nbBarres ?? 0) >= (materiel === 'deux' ? 2 : 1);

  let sums = new Set([0]);
  if (hasBars) {
    for (const d of inv.disques || []) {
      const pairs = Math.floor((d.nb || 0) / divisor);
      if (pairs <= 0) continue;
      const next = new Set(sums);
      for (const s of sums) {
        for (let k = 1; k <= pairs; k++) next.add(round1(s + 2 * d.kg * k));
      }
      sums = next;
    }
  }

  const charges = new Set();
  if (hasBars) for (const s of sums) charges.add(round1(barre + s));
  for (const c of inv.chargesFixes || []) charges.add(round1(c));
  charges.add(0); // poids de corps / sans lest, toujours possible
  return [...charges].sort((a, b) => a - b);
}

// Le vrai saut suivant. Retourne { charge, sautPct, tropBrutal } ou null si plafond atteint.
// minSaut : pour les exercices lestés, palier = +2,5 kg minimum.
export function prochaineChargePossible(inventaire, chargeActuelle, materiel = 'deux', minSaut = 0) {
  const charges = possibleCharges(inventaire, materiel);
  const seuil = chargeActuelle + Math.max(minSaut, EPS);
  const next = charges.find((c) => c >= seuil - EPS && c > chargeActuelle + EPS);
  if (next === undefined) return null;
  const sautPct = chargeActuelle > 0 ? (next - chargeActuelle) / chargeActuelle : 0;
  // Saut > ~7 % → règle du programme : fourchette élargie avant le prochain palier.
  return { charge: next, sautPct, tropBrutal: chargeActuelle > 0 && sautPct > 0.07 };
}

// Charge la plus proche INFÉRIEURE ou égale à une cible (semaine allégée : -25 %).
export function chargeAllegee(inventaire, chargeActuelle, materiel = 'deux') {
  const cible = chargeActuelle * 0.75;
  const charges = possibleCharges(inventaire, materiel);
  let best = 0;
  for (const c of charges) if (c <= cible + EPS) best = c;
  return best;
}

// Décrit concrètement comment monter la charge (« lest : haltère de 10 entre les jambes »).
export function descriptionCharge(inventaire, charge, exercice) {
  if (charge <= 0) return exercice.type === 'lest' ? 'poids de corps' : 'sans charge';
  if (exercice.type === 'lest') {
    const fixes = inventaire?.chargesFixes || [];
    if (fixes.some((c) => Math.abs(c - charge) < EPS)) {
      return `lest : haltère de ${fmtKg(charge)} entre les jambes`;
    }
    return `lest : ${fmtKg(charge)}`;
  }
  const parHaltere = exercice.materiel === 'deux' ? ` par haltère` : '';
  return `${fmtKg(charge)}${parHaltere}`;
}

export function fmtKg(x) {
  const s = Number.isInteger(x) ? String(x) : String(round1(x)).replace('.', ',');
  return `${s} kg`;
}
