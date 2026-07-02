// ATLAS — onboarding. 3 étapes : le cycle, la nutrition, l'inventaire matériel.
// L'inventaire est le détail que personne ne fait : ATLAS ne proposera jamais
// une charge qui n'existe pas chez toi.

import { upsertPoids, todayISO } from '../store.js';
import { h, clear } from '../ui.js';
import { mountSprite } from '../sprites.js';
import { inventaireEditor } from '../inventaire-editor.js';

export function renderOnboarding(ctx, root) {
  clear(root);
  const state = ctx.state;
  const s = state.settings;

  const spriteBox = h('div', { class: 'sprite-box' });
  mountSprite(spriteBox, 'pret', { scale: 6 });

  // Lundi prochain (ou aujourd'hui si lundi).
  const now = new Date();
  const lundi = new Date(now.getTime() + ((8 - now.getDay()) % 7) * 86400000);
  const dateInput = h('input', { type: 'date', value: s.dateDebut || lundi.toISOString().slice(0, 10) });
  const kcalInput = h('input', { type: 'number', inputmode: 'numeric', placeholder: 'kcal cible (déficit)', value: s.kcalCible || '' });
  const poidsInput = h('input', { type: 'number', inputmode: 'decimal', step: '0.1', placeholder: 'poids actuel (kg)' });
  const editor = inventaireEditor(state.inventaire);

  root.append(h('div', { class: 'fade-in stack' },
    h('div', { class: 'center' },
      h('span', { class: 'eyebrow accent' }, 'ATLAS'),
      spriteBox,
      h('h2', {}, 'Le carnet qui calcule à ta place'),
      h('p', { class: 'muted small' }, 'Un programme, un moteur, un athlète. Toi, tu soulèves et tu tapes ✓.'),
    ),
    h('div', { class: 'card stack' },
      h('span', { class: 'eyebrow' }, '1 · LE CYCLE'),
      h('p', { class: 'small muted' }, 'Le cycle de 12 semaines démarre un lundi. Semaines 1-2 = rampe (séries réduites, réserve 2-3).'),
      dateInput,
    ),
    h('div', { class: 'card stack' },
      h('span', { class: 'eyebrow' }, '2 · LA BOUCLE NUTRITION'),
      h('p', { class: 'small muted' }, 'Une pesée par jour pilote tout. Cible de départ : maintenance − 300 à 500 kcal.'),
      kcalInput, poidsInput,
    ),
    h('div', { class: 'card stack' },
      h('span', { class: 'eyebrow' }, '3 · L’INVENTAIRE MATÉRIEL'),
      editor.el,
    ),
    h('button', { class: 'btn big', onclick: () => {
      s.dateDebut = dateInput.value || lundi.toISOString().slice(0, 10);
      s.kcalCible = parseInt(kcalInput.value, 10) || 2200;
      state.inventaire = editor.read();
      const p = parseFloat(String(poidsInput.value).replace(',', '.'));
      if (p > 0) upsertPoids(state, todayISO(), p);
      s.onboarded = true;
      ctx.persist(); ctx.navigate('home');
    } }, 'Porter la charge'),
  ));
}
