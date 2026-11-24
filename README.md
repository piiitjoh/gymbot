# Gymbot

Offline treningslogg «Gymbot» (PWA). All data lagres lokalt på telefonen (IndexedDB). Ingen server, ingen konto.

## Publisere på GitHub Pages
1. Lag et nytt **offentlig** repo på GitHub, f.eks. `gymbot`. Gratis Pages krever offentlig repo, men det er bare koden som ligger der, aldri treningsdataene dine.
2. Last opp **innholdet** i denne mappen til roten av repoet (index.html skal ligge øverst). Det er ca. 1 750 bildefiler, så bruk `git push` heller enn opplasting i nettleseren:
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

Åpne appen fra ikonet én gang mens du er på nett. Da lagres appen og bildene av dine egne øvelser, og etter det fungerer den helt offline.

## Første gang
**Mer → Importer fra Strong (CSV)** → velg Strong-eksporten. Importen lager også rutiner av de navngitte øktene dine. Kjører du importen på nytt, dupliserer den ikke økter.

## Oppdatere appen
Endre filene, øk `VERSION` i `sw.js` (f.eks. `'v2'`) og push. Telefonen henter den nye versjonen neste gang appen åpnes med nett, og dataene dine beholdes.

## Backup
**Mer → Eksporter backup** lagrer en JSON-fil (via delingsmenyen på telefonen). Sletter du appen eller nettleserdataene for nettstedet, forsvinner dataene, så ta backup innimellom.

Øvelsesbilder og -beskrivelser: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain).
