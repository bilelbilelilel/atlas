// ATLAS — le moteur nutrition. Une saisie par jour (le poids), zéro tracking.
// Applique la boucle du programme, verbatim. Pas de morale, des règles.

// poids : [{ d: 'YYYY-MM-DD', kg }] ordre chronologique.
export function moyenne7j(poids, jour) {
  const t1 = ts(jour);
  const t0 = t1 - 6 * 86400000;
  const fen = (poids || []).filter((p) => ts(p.d) >= t0 && ts(p.d) <= t1);
  if (!fen.length) return null;
  return fen.reduce((a, p) => a + p.kg, 0) / fen.length;
}

// Pente en %/semaine entre la moyenne 7 j de cette semaine et celle d'il y a 7 jours.
export function pentePctSemaine(poids, jour) {
  const now = moyenne7j(poids, jour);
  const prev = moyenne7j(poids, addDays(jour, -7));
  if (now == null || prev == null || prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

// Le verdict du moteur, verbatim la table du programme.
// Retour : { code, message, action?: { deltaKcal, nouvelleCible, label } }
export function verdictNutrition({ poids, jour, semaine, kcalCible, finDeCycle = false }) {
  if (finDeCycle || semaine >= 12) {
    const cible = kcalCible + 400;
    return {
      code: 'maintien',
      message: `Fin de cycle. Passage maintien : cible ${cible} kcal (+400).`,
      action: { deltaKcal: 400, nouvelleCible: cible, label: 'Passer en maintien' },
    };
  }
  if (semaine <= 2) {
    return { code: 'eau', message: 'Chute d’eau normale. On ne conclut rien avant la semaine 3.' };
  }

  const p = pentePctSemaine(poids, jour);
  if (p == null) {
    return { code: 'donnees', message: 'Pas assez de pesées. Monte sur la balance le matin, c’est tout.' };
  }

  if (p <= -1.0) {
    const cible = kcalCible + 175;
    return {
      code: 'trop_vite',
      message: `Trop vite = du muscle. Ajoute 150-200 kcal → cible ${cible}.`,
      action: { deltaKcal: 175, nouvelleCible: cible, label: `Passer à ${cible} kcal` },
    };
  }
  if (p <= -0.4) {
    return { code: 'ok', message: 'Ne touche à rien.' };
  }

  // Plat (ou remontée) : on ne corrige qu'après 2 semaines de plat confirmé.
  const pPrev = pentePctSemaine(poids, addDays(jour, -7));
  const platConfirme = pPrev != null && pPrev > -0.4 && p > -0.4;
  if (platConfirme) {
    const cible = kcalCible - 200;
    return {
      code: 'plat',
      message: `Plat depuis 2 semaines. Retire 200 kcal → nouvelle cible : ${cible}.`,
      action: { deltaKcal: -200, nouvelleCible: cible, label: `Appliquer ${cible} kcal` },
    };
  }
  return {
    code: 'observe',
    message: 'Un peu lent cette semaine. Si c’est encore plat dimanche prochain, on corrige.',
  };
}

// Bande cible du graphe : −0,4 à −0,7 %/semaine depuis la référence semaine 2.
export function bandeCible(poidsRef, semainesDepuisRef) {
  return {
    haut: poidsRef * Math.pow(1 - 0.004, semainesDepuisRef),
    bas: poidsRef * Math.pow(1 - 0.007, semainesDepuisRef),
  };
}

function ts(d) { return (typeof d === 'string' ? new Date(d + 'T00:00:00') : d).getTime(); }
function addDays(d, n) { return new Date(ts(d) + n * 86400000); }
