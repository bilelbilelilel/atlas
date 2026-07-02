# ATLAS — le carnet qui calcule à ta place

L'exécutable de TON programme. Il connaît la règle de progression, les paires,
les repos, les fusibles et la boucle nutrition — et il les exécute pour toi.
Toi, tu soulèves et tu tapes ✓.

**Le test de réussite : logger une série prend moins de 3 secondes.**

> Projet autonome, zéro dépendance, zéro build. Ce dossier vit ici en attendant
> son propre repo : il suffit de le copier tel quel (`git filter-repo` ou un
> simple `cp -r`), rien ne pointe vers l'extérieur.

## Lancer

```bash
cd atlas
python3 -m http.server 8787   # ou n'importe quel serveur statique
# puis http://localhost:8787
```

Déploiement : c'est un site statique — GitHub Pages, Vercel, Netlify, tout
marche. Un workflow Pages prêt à l'emploi est inclus
(`.github/workflows/pages.yml`) : il s'active dès qu'`atlas/` devient la racine
de son propre repo (tests du moteur puis déploiement). Sur iPhone : Safari →
Partager → « Sur l'écran d'accueil » → l'app s'installe et fonctionne hors
ligne (service worker, polices auto-hébergées — 120 Ko).

## Tester

```bash
cd atlas
npm test        # node --test : 31 tests du moteur (progression, inventaire, nutrition)
npm run icons   # régénère les icônes PNG/SVG (zéro dépendance, zlib de Node)
```

## Ce qui est implémenté (V1 complète)

- **Le moteur de progression** (`js/engine.js`) — étalonnage / battre / palier,
  échelle leg curl à 4 niveaux, lest (+2,5 kg), temps (planche), tempo (mollets
  2 s), unilatéral. Garde-fous : palier raté 2× → proposition d'élargir la
  fourchette (+2), saut matériel > 7 % → fourchette élargie automatique,
  régression sur 3 exercices → fusible « charges » pré-coché. Local, hors
  ligne, déterministe, testé.
- **L'inventaire matériel** (`js/inventory.js`) — tu déclares barres, disques,
  haltères fixes ; ATLAS ne propose **jamais** une charge qui n'existe pas chez
  toi, et calcule le vrai saut suivant (symétrie des disques comprise).
- **Le moteur nutrition** (`js/nutrition.js`) — une pesée par jour, verdicts
  verbatim du programme (chute d'eau, ne touche à rien, plat 2 sem → −200,
  trop vite → +150-200, semaine 12 → maintien +400), correction en 1 tap.
- **Le circuit complet** — rampe (sem 1-2), semaine allégée (2 séries, −25 %,
  réserve 3-4, samedi masqué), maintien, bilan hebdo avec 4 fusibles et verdict
  tamponné, samedi FUSIBLE avec « Je la saute » récompensé.
- **Le flux séance** — contrat du jour, carte exercice pré-remplie (✓ = 1 tap),
  timer de repos avec le sprite de l'exercice suivant, étalonnage guidé,
  brouillon repris tel quel, debrief 30 s (douleur 2× → substitution avec
  transfert d'historique), 18 segments de progression.
- **La Ligne de défense** — poids (cendre) qui descend, indice de force
  (terre cuite) qui tient. « Tu perds du gras, pas du muscle. »
- **Le Mur des paliers** — chaque palier gravé sur une plaque ocre ; la seule
  animation riche de l'app est la fête du palier (2 s, aucun confetti, jamais).
- **L'athlète d'amphore** — sprites pixel générés par squelettes
  (`js/sprites.js`) : 20 boucles d'exercices au tempo réel prescrit + 7 états
  d'avatar pilotés par les vraies données (prêt, repos, lauré, palier, entamé,
  affûté).
- **Local-first absolu** — un seul document JSON dans localStorage, export
  JSON/CSV et import en un tap, carte de la semaine partageable en image
  (format story). Pas de compte, pas de serveur, pas d'analytics.
- **Pensé pour la salle** — timer basé sur l'horloge (juste même écran
  verrouillé), wake lock pendant la séance, écart G/D optionnel sur les
  unilatéraux (la progression suit le côté faible), lest masqué en rampe,
  rappels pesée/bilan débrayables, son sec optionnel (timer & palier).
- **Multi-cycles** — maintien → « Démarrer le cycle N » : le cycle s'archive
  (paliers, poids début/fin), l'historique des exercices est conservé, le
  compteur repart au lundi suivant (rampe comprise), kcal −400 (retour déficit).
- **Matériel éditable** — tu achètes des disques ? Réglages → Matériel, et le
  moteur recalcule tous les prochains sauts. La proposition « élargir la
  fourchette » (palier raté 2×) s'accepte en 1 tap pendant la séance et se
  referme d'elle-même au palier suivant.

## Architecture

```
atlas/
├── index.html              coquille (4 onglets + modal séance + overlay palier)
├── css/style.css           DA « amphore » : tokens, typo, motion budget strict
├── js/
│   ├── program.js          les 5 séances, fourchettes, repos — versionné
│   ├── engine.js           cibleSuivante() et les garde-fous (le cerveau)
│   ├── inventory.js        possibleCharges(), prochaineChargePossible()
│   ├── nutrition.js        moyenne 7 j, pente %/sem, verdicts
│   ├── store.js            schéma v1, localStorage, export/import
│   ├── sprites.js          rasterizer pixel + squelettes des 27 boucles
│   ├── charts.js           SVG : poids, ligne de défense, escalier des paliers
│   └── screens/            aujourd'hui, séance, progression, corps, bilan, onboarding
├── tests/engine.test.mjs   31 tests unitaires du moteur
├── scripts/make-icons.mjs  icônes PNG écrites à la main (zlib), zéro dépendance
├── sw.js                   hors-ligne cache-first
└── manifest.webmanifest    installable (PWA)
```

Choix assumés par rapport au cahier des charges :

- **Vanilla ES modules plutôt que React** : même architecture d'écrans, zéro
  build, zéro dépendance — la V1 se déploie en copiant le dossier. La logique
  (moteurs) est isolée et portera telle quelle vers la V2 SwiftUI.
- **Clés JSON sans accents** (`seances`, `reserve`…) : le schéma du cahier des
  charges avec accents est un piège d'encodage ; la structure est identique.
- **Sprites Tier 2 générés** : les squelettes en données donnent les 20+
  boucles d'un coup, cohérentes, au bon tempo. Le redessin Aseprite Tier 1
  (dips, tractions, couché, goblet, SDT, leg curl) reste la prochaine étape
  artistique — il suffira de remplacer une entrée de `SPRITES`.

## Ce qu'ATLAS ne fera jamais

Pas de tracking alimentaire, pas de social, pas de bibliothèque de 400
exercices, pas d'IA conversationnelle, pas de streaks culpabilisants.
Chaque « non » protège le test des 3 secondes.

## Tester sur iPhone (5 minutes)

1. Mets `atlas/` dans son propre repo GitHub (ou garde-le ici et déploie le
   sous-dossier sur Vercel/Netlify).
2. Si repo dédié : Settings → Pages → Source « GitHub Actions ». Le workflow
   inclus (`.github/workflows/pages.yml`) teste le moteur puis déploie.
3. Ouvre l'URL dans Safari → Partager → « Sur l'écran d'accueil ».
4. L'app est installée, hors ligne, plein écran. Tes données restent sur le
   téléphone (pense à Export JSON de temps en temps : c'est ta sauvegarde).

## Prochaines étapes (V2)

Natif SwiftUI : Live Activity pour le timer sur l'écran verrouillé, HealthKit
(pas + poids), widgets, haptiques fines. La migration = importer le JSON.
Plan de portage détaillé : `docs/V2-NATIF.md`.
