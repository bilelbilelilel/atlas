// ATLAS — graphes SVG. Ignore les points, suis la ligne.

import { moyenne7j } from './nutrition.js';

const NS = 'http://www.w3.org/2000/svg';

function svg(w, hgt, cls) {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('viewBox', `0 0 ${w} ${hgt}`);
  el.setAttribute('class', cls || 'chart');
  el.setAttribute('preserveAspectRatio', 'none');
  return el;
}
function node(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function scaler(min, max, out0, out1) {
  const span = max - min || 1;
  return (v) => out0 + ((v - min) / span) * (out1 - out0);
}

// --- Graphe poids : points quotidiens cendre, moyenne 7 j terre cuite, bande cible.
export function chartPoids(poids, { dateDebut } = {}) {
  const W = 320, H = 150, PAD = 8;
  const el = svg(W, H);
  if (!poids || poids.length < 2) return el;

  const t = (d) => new Date(d + 'T00:00:00').getTime();
  const xs = poids.map((p) => t(p.d));
  const moy = poids.map((p) => ({ x: t(p.d), y: moyenne7j(poids, p.d) }));
  const allY = [...poids.map((p) => p.kg), ...moy.map((m) => m.y)];
  const X = scaler(Math.min(...xs), Math.max(...xs), PAD, W - PAD);
  const Y = scaler(Math.min(...allY) - 0.4, Math.max(...allY) + 0.4, H - PAD, PAD);

  // Bande cible −0,4 / −0,7 %/sem depuis le premier point.
  const ref = moy[0]?.y ?? poids[0].kg;
  const t0 = xs[0];
  const band = [];
  for (const x of xs) {
    const w = (x - t0) / (7 * 86400000);
    band.push({ x, haut: ref * Math.pow(0.996, w), bas: ref * Math.pow(0.993, w) });
  }
  const bandPath = band.map((b, i) => `${i ? 'L' : 'M'}${X(b.x).toFixed(1)},${Y(b.haut).toFixed(1)}`).join(' ')
    + ' ' + band.slice().reverse().map((b) => `L${X(b.x).toFixed(1)},${Y(b.bas).toFixed(1)}`).join(' ') + ' Z';
  el.append(node('path', { d: bandPath, fill: 'rgba(122,158,95,0.10)', stroke: 'none' }));

  for (const p of poids) {
    el.append(node('circle', { cx: X(t(p.d)).toFixed(1), cy: Y(p.kg).toFixed(1), r: 1.6, fill: '#8A7E6F' }));
  }
  const line = moy.map((m, i) => `${i ? 'L' : 'M'}${X(m.x).toFixed(1)},${Y(m.y).toFixed(1)}`).join(' ');
  el.append(node('path', { d: line, fill: 'none', stroke: '#C9622B', 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
  return el;
}

// --- Ligne de défense : poids (cendre, descend) vs indice de force (terre cuite, tient).
// series = [{ x, poids, force }] — les deux normalisés base 100 sur leur premier point.
export function chartDefense(serie) {
  const W = 320, H = 130, PAD = 8;
  const el = svg(W, H);
  const pts = (serie || []).filter((s) => s.poids != null && s.force != null);
  if (pts.length < 2) return el;

  const p0 = pts[0].poids, f0 = pts[0].force || 1;
  const norm = pts.map((s, i) => ({ i, p: (s.poids / p0) * 100, f: (s.force / f0) * 100 }));
  const allY = norm.flatMap((n) => [n.p, n.f]);
  const X = scaler(0, norm.length - 1, PAD, W - PAD);
  const Y = scaler(Math.min(...allY) - 2, Math.max(...allY) + 2, H - PAD, PAD);

  const path = (key, color, wdt) => node('path', {
    d: norm.map((n, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(n[key]).toFixed(1)}`).join(' '),
    fill: 'none', stroke: color, 'stroke-width': wdt, 'stroke-linecap': 'round',
  });
  el.append(path('p', '#8A7E6F', 1.8));
  el.append(path('f', '#C9622B', 2.6));
  return el;
}

// --- Escalier des paliers : charge (ou niveau) en marches d'escalier.
export function chartEscalier(histo, ex) {
  const W = 320, H = 120, PAD = 8;
  const el = svg(W, H);
  if (!histo || histo.length < 1) return el;

  const val = (s) => (ex.type === 'echelle' ? (s.niveau ?? 1) : (s.charge ?? 0));
  const ys = histo.map(val);
  const X = scaler(0, Math.max(histo.length - 1, 1), PAD, W - PAD);
  const Y = scaler(Math.min(...ys), Math.max(...ys) + (Math.max(...ys) === Math.min(...ys) ? 1 : 0), H - PAD, PAD);

  let d = `M${X(0).toFixed(1)},${Y(ys[0]).toFixed(1)}`;
  for (let i = 1; i < ys.length; i++) {
    d += ` L${X(i).toFixed(1)},${Y(ys[i - 1]).toFixed(1)} L${X(i).toFixed(1)},${Y(ys[i]).toFixed(1)}`;
  }
  el.append(node('path', { d, fill: 'none', stroke: '#E0A458', 'stroke-width': 2.4, 'stroke-linecap': 'square' }));
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] > ys[i - 1]) {
      el.append(node('circle', { cx: X(i).toFixed(1), cy: Y(ys[i]).toFixed(1), r: 3, fill: '#E0A458' }));
    }
  }
  return el;
}
