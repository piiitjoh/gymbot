# Gymbot

Offline treningslogg «Gymbot» (PWA). All data lagres lokalt på telefonen (IndexedDB). Ingen server, ingen konto.

## Publisere på GitHub Pages
1. Lag et nytt **offentlig** repo på GitHub, f.eks. `gymbot`. Gratis Pages krever offentlig repo, men det er bare koden som ligger der, aldri treningsdataene dine.
2. Last opp **innholdet** i denne mappen til roten av repoet (index.html skal ligge øverst). Bruk `git push` heller enn opplasting i nettleseren:
   ```
   git init && git add . && git commit -m "Gymbot" 
   git branch -M main
   git remote add origin https://github.com/<bruker>/gymbot.git
   git push -u origin main
   ```
3. Gå til repoet → **Settings → Pages**, velg «Deploy from a branch», `main` / `(root)`, og trykk **Save**.
4. Etter et minutt eller to er appen på `https://<bruker>.github.io/gymbot/`.

## Installere på telefonen
- **iPhone:** Åpne adressen i Safari → Del-knappen → «Legg til på Hjem-skjerm».
- **Android:** Åpne adressen i Chrome → ⋮ → «Installer app» / «Legg til på startskjermen».

Åpne appen fra ikonet én gang mens du er på nett. Da lagres appen og animasjonene av dine egne øvelser, og etter det fungerer den helt offline.

## Første gang
**Mer → Importer fra Strong (CSV)** → velg Strong-eksporten. Importen lager også rutiner av de navngitte øktene dine. Kjører du importen på nytt, dupliserer den ikke økter.

## Oppdatere appen
Endre filene, øk `VERSION` i `sw.js` (f.eks. `'v2'`) og push. Telefonen henter den nye versjonen neste gang appen åpnes med nett, og dataene dine beholdes.

## Backup
**Mer → Eksporter backup** lagrer en JSON-fil (via delingsmenyen på telefonen). Sletter du appen eller nettleserdataene for nettstedet, forsvinner dataene, så ta backup innimellom.

Øvelsestegninger: kun [Everkinetic](https://github.com/everkinetic/data) av Greg Priday, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) – se `LICENSE-everkinetic-CC-BY-SA-4.0.md`. Tegningene er beskåret, skalert og satt sammen til animasjoner (start- og sluttposisjon) i `anim/ek-*.webp` og `thumb/ek-*.webp`; disse endrede bildene deles under samme lisens, CC BY-SA 4.0. Øvelser uten en passende Everkinetic-tegning har ingen tegning. Laget med `tools/add_everkinetic.py`.

Øvelsesbeskrivelser: [Open Exercise Figures](https://github.com/AbanoubAmir/open-exercise-figures) (CC0, public domain).

Muskelkart: SVG-polygoner fra [body-highlighter](https://github.com/lahaxearnaud/body-highlighter) / react-body-highlighter, MIT-lisens – se `LICENSE-body-highlighter.txt`.
