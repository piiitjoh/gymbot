# Gymbot

Gymbot is an offline strength-training log (PWA). All data is stored locally on the phone (IndexedDB). No server, no account.

## Publish on GitHub Pages
1. Create a new **public** repo on GitHub, e.g. `gymbot`. Free Pages needs a public repo, but only the code lives there, never your training data.
2. Upload the **contents** of this folder to the root of the repo (index.html must be at the top level). Use `git push` rather than uploading in the browser:
   ```
   git init && git add . && git commit -m "Gymbot"
   git branch -M main
   git remote add origin https://github.com/<user>/gymbot.git
   git push -u origin main
   ```
3. Go to the repo → **Settings → Pages**, choose "Deploy from a branch", `main` / `(root)`, and press **Save**.
4. After a minute or two the app is at `https://<user>.github.io/gymbot/`.

## Install on the phone
- **iPhone:** Open the address in Safari → Share button → "Add to Home Screen".
- **Android:** Open the address in Chrome → ⋮ → "Install app" / "Add to Home screen".

Open the app from its icon once while online. That saves the app and the animations of your own exercises; after that it works fully offline. **More → Download all animations** saves the rest.

## First run
**More → Import from Strong (CSV)** → choose your Strong export. The import also creates routines from your named workouts. Running the import again does not duplicate workouts.

## Hevy
- **More → Import from Hevy (CSV)** reads Hevy's own workout export (Hevy: Profile → Settings → Export & Import Data → Export Data → Export Workouts). Warm-up, drop and failure sets, RPE, kg or lbs, and distance/time are kept. Workouts already in Gymbot (same start time) are not imported twice.
- **More → Export for Hevy (CSV)** writes your history as a Strong-format CSV, because Hevy only imports Strong files. In Hevy: Profile → Settings → Export & Import Data → Import Data → Import Strong CSV. Exercise names Hevy doesn't recognise become custom exercises there.

## Update the app
Change the files, bump `VERSION` in `sw.js` (e.g. `'v2'`) and push. The phone fetches the new version the next time the app is opened online, and your data is kept.

## Backup
**More → Export backup (JSON)** saves a JSON file (through the phone's share menu). If you delete the app or the site's browser data, your data is gone, so take a backup now and then.

## Credits and licenses

Exercise drawings: [Workout Guide](https://github.com/bryllim/workout-guide) by [Bryl Lim](https://bryllim.com), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) – see `LICENSE-workout-guide-CC-BY-SA-4.0.md`. Workout Guide is partly based on drawings from [Everkinetic](https://github.com/everkinetic/data) by Greg Priday (CC BY-SA 4.0, see `LICENSE-everkinetic-CC-BY-SA-4.0.md`). The drawings have been recoloured (black on white), cropped, scaled and combined into animations in `anim/wg-*.webp` and thumbnails in `thumb/wg-*.webp`; these modified images are shared under the same license, CC BY-SA 4.0. Exercises without a matching drawing have no drawing. Made with `tools/add_workout_guide.py`.

Exercise descriptions: [Open Exercise Figures](https://github.com/AbanoubAmir/open-exercise-figures) (CC0, public domain).

Muscle map: SVG polygons from [body-highlighter](https://github.com/lahaxearnaud/body-highlighter) / react-body-highlighter, MIT license – see `LICENSE-body-highlighter.txt`.
