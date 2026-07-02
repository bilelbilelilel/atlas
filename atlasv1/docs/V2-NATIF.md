# V2 natif SwiftUI — plan de portage

La V2 ne peut pas être produite ici (elle exige Xcode/macOS pour compiler,
signer et tester). Ce document rend le portage mécanique : chaque module V1 a
son équivalent Swift désigné, et la logique est déjà isolée de l'UI.

## Pourquoi la V2 (rappel roadmap)

Live Activity (timer + « ensuite : Rowing 12 @ 24 kg » sur l'écran verrouillé),
widgets (Contrat du jour / pesée), HealthKit (pas + poids automatiques),
haptiques CoreHaptics, 120 Hz. **Critère de sortie : tu ne déverrouilles plus
le téléphone entre deux séries.**

## Mapping module par module

| V1 (JS, testé) | V2 (Swift) | Notes |
| --- | --- | --- |
| `js/engine.js` | `Engine.swift` (struct pure) | Port ligne à ligne ; les 20 tests moteur deviennent des `XCTest` — mêmes entrées, mêmes sorties attendues |
| `js/inventory.js` | `Inventory.swift` | Somme de sous-ensembles bornés : identique |
| `js/nutrition.js` | `Nutrition.swift` | Fenêtres de 7 jours sur `Date` ; verdicts = enum |
| `js/program.js` | `Program.swift` (constantes) | Versionné (`programmeVersion`) |
| `js/store.js` | SwiftData `@Model` + `Migrator` | **Import du JSON V1 = la migration.** Les clés sont déjà en ASCII, `Codable` direct |
| `js/screens/seance.js` | `SeanceFlow` (View + `@Observable` state) | Le timer devient une Live Activity (`ActivityKit`) |
| `js/screens/home.js` | `TodayView` + WidgetKit | L'état avatar est une fonction pure → partageable avec le widget |
| `js/sprites.js` | `SpriteKit`/`Canvas` ou assets Aseprite | Les squelettes JSON s'exportent ; ou remplacement par les sprite sheets Tier 1 |
| `js/charts.js` | Swift Charts | Poids/défense/escalier = 3 `Chart` |
| `sw.js` / manifest | — | Sans objet en natif |

## Ordre de portage recommandé

1. **Package `AtlasCore`** (SPM, sans UI) : Engine + Inventory + Nutrition +
   Program + les tests. Compile sur n'importe quel Mac en 1 h, valide 100 % de
   la logique avant la première View.
2. **SwiftData + import JSON V1** : ouvrir l'export ATLAS et retrouver son
   historique — la preuve de migration avant l'UI.
3. **SeanceFlow + Live Activity** : LA feature qui justifie le natif.
4. Écrans restants, widgets, HealthKit, avatar.

## Décisions à prendre (roadmap §8)

- **Signature** : compte développeur Apple (99 €/an) recommandé pour une app
  quotidienne ; sinon AltStore/SideStore (re-signature auto 7 jours).
- **Sprites** : garder le rendu par squelettes (portable) ou basculer sur les
  sprite sheets Aseprite Tier 1 (plus beau, plus de travail).
