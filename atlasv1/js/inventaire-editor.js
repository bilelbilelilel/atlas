// ATLAS — éditeur d'inventaire matériel, partagé entre l'onboarding et les
// réglages : tu achètes des disques, ATLAS le sait dans la minute.

import { possibleCharges, fmtKg } from './inventory.js';
import { h } from './ui.js';

const TAILLES = [0.5, 1.25, 2, 2.5, 5, 10, 15, 20];

// Retourne { el, read } : el à insérer dans l'écran, read() → inventaire.
export function inventaireEditor(inventaire = {}) {
  const barreInput = h('input', { type: 'number', inputmode: 'decimal', step: '0.5', value: inventaire.barre ?? 2 });
  const fixesInput = h('input', { type: 'text', placeholder: 'ex : 10, 16', value: (inventaire.chargesFixes || []).join(', ') });
  const counts = Object.fromEntries((inventaire.disques || []).map((d) => [d.kg, d.nb]));

  const read = () => ({
    barre: parseFloat(String(barreInput.value).replace(',', '.')) || 0,
    nbBarres: 2,
    disques: Object.entries(counts).filter(([, nb]) => nb > 0).map(([kg, nb]) => ({ kg: parseFloat(kg), nb })),
    chargesFixes: String(fixesInput.value).split(',').map((x) => parseFloat(x.trim().replace(',', '.'))).filter((x) => x > 0),
    lestDips: true,
  });

  const apercuEl = h('div', { class: 'mono small', style: { marginTop: '8px' } });
  const apercu = () => {
    const ch = possibleCharges(read(), 'deux').filter((c) => c > 0);
    apercuEl.textContent = ch.length
      ? `Charges possibles (2 haltères) : ${ch.slice(0, 10).map(fmtKg).join(' · ')}${ch.length > 10 ? '…' : ''}`
      : 'Déclare tes disques : ATLAS ne proposera jamais une charge impossible.';
  };
  fixesInput.addEventListener('input', apercu);
  barreInput.addEventListener('input', apercu);

  const disquesBox = h('div', { class: 'stack' });
  for (const kg of TAILLES) {
    const val = h('span', { class: 'mono', style: { minWidth: '3ch', textAlign: 'center' } }, counts[kg] ?? 0);
    disquesBox.append(h('div', { class: 'row between' },
      h('span', { class: 'mono' }, `disques de ${fmtKg(kg)}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn-mini', onclick: () => { counts[kg] = Math.max(0, (counts[kg] ?? 0) - 2); val.textContent = counts[kg]; apercu(); } }, '−2'),
        val,
        h('button', { class: 'btn-mini', onclick: () => { counts[kg] = (counts[kg] ?? 0) + 2; val.textContent = counts[kg]; apercu(); } }, '+2'),
      ),
    ));
  }
  apercu();

  const el = h('div', { class: 'stack' },
    h('div', { class: 'mono small' }, 'poids d’une barre courte vide (kg)'),
    barreInput,
    disquesBox,
    h('div', { class: 'mono small' }, 'haltères fixes / kettlebells (kg, séparés par des virgules)'),
    fixesInput,
    apercuEl,
  );
  return { el, read };
}
