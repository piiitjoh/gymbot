#!/usr/bin/env python3
"""Gives Gymbot exercises Workout Guide drawings (CC BY-SA 4.0) where a matching drawing exists.

Source: https://github.com/bryllim/workout-guide (drawings by Bryl Lim, partly derived from
Everkinetic, both CC BY-SA 4.0). Each exercise has three frames; Gymbot plays them 1-2-3-2 at
900 ms per frame so the loop never jumps from the last frame back to the first.

For each mapped exercise: anim/wg-<slug>.webp (300x300, black lines on white) and
thumb/wg-<slug>.webp (96x96, frame 2). The exercise's "a" field in exercises.json is set to
wg-<slug>; every other exercise loses its "a" field and shows no drawing. Also rewrites
images.json and the OWN_IMAGES list in sw.js.

Needs rsvg-convert (librsvg) and Pillow.
Usage: python3 add_workout_guide.py <workout-guide repo> <gymbot folder>
"""
import io
import json
import os
import re
import subprocess
import sys

from PIL import Image, ImageOps

# Peter's own (Strong) exercises -> Workout Guide slug, checked by hand. "approx" marks a close
# but not identical variant (other equipment, grip or angle). No entry = no drawing.
MAP = {
    'Ab Wheel': 'ab-wheel',
    'Back Extension': 'back-extension',
    'Back Extension (Machine)': 'back-extension',                  # approx: bench, not machine
    'Bench Press (Dumbbell)': 'dumbbell-bench-press',
    'Bent Over One Arm Row (Cable)': 'single-arm-cable-row',       # approx
    'Bent Over One Arm Row (Dumbbell)': 'one-arm-dumbbell-row',
    'Bent Over Row (Barbell)': 'barbell-row',
    'Bent Over Row (Dumbbell)': 'dumbbell-bent-over-row',
    'Bent Over Row (Plate loaded)': 't-bar-row',                   # approx
    'Bicep Curl (Barbell)': 'ez-bar-curl',                         # approx: EZ bar
    'Bicep Curl (Cable)': 'cable-curl',
    'Bicep Curl (Dumbbell)': 'bicep-curl',
    'Bulgarian Split Squat': 'bulgarian-split-squat',              # approx: with dumbbells
    'Bulgarian Split Squat (Smith machine)': 'smith-machine-bulgarian-split-squat',
    'Cable Crunch': 'cable-crunch',
    'Calf Press on Seated Leg Press': 'leg-press-calf-raise',
    'Chest Dip': 'chest-dip',
    'Chest Fly': 'pec-deck',
    'Chest Fly (Band)': 'cable-fly',                               # approx: cable, not band
    'Chest Fly (Cable)': 'cable-fly',
    'Chest Fly (Dumbbell)': 'dumbbell-fly',
    'Chest Press (Machine)': 'machine-chest-press',
    'Chin Up': 'chin-up',
    'Concentration Curl (Dumbbell)': 'concentration-curl',
    'Converging Chest Press (Machine)': 'machine-chest-press',      # approx
    'Cross-over back (cable)': 'cable-rear-delt-fly',
    'Deadlift (Barbell)': 'deadlift',
    'Decline Bench Press (Barbell)': 'decline-bench-press',
    'Decline Crunch': 'decline-sit-up',                            # approx: full sit-up
    'Face Pull (Cable)': 'face-pull',
    'Farmers Walk': 'farmer-carry',
    'Goblet Squat (Kettlebell)': 'goblet-squat',                   # approx: dumbbell
    'Hack Squat': 'hack-squat',
    'Hammer Curl (Dumbbell)': 'hammer-curl',
    'Hanging Knee Raise': 'hanging-knee-raise',
    'Hip Thrust (Barbell)': 'hip-thrust',
    'Incline Bench Press (Barbell)': 'incline-bench-press',
    'Incline Bench Press (Dumbbell)': 'incline-dumbbell-press',
    'Incline Bench Press (Smith Machine)': 'incline-bench-press',  # approx: free barbell
    'Incline Chest Fly (Dumbbell)': 'incline-cable-fly',           # approx: cables
    'Incline Chest Press (Machine)': 'machine-chest-press',        # approx: flat machine
    'Incline Row (Dumbbell)': 'chest-supported-row',               # approx: machine
    'Iso-Lateral Chest Press (Machine)': 'machine-chest-press',
    'Jackknife Sit Up': 'v-up',
    "Knee Raise (Captain's Chair)": 'captains-chair-knee-raise',
    'Lat Pulldown (Cable)': 'lat-pulldown',
    'Lat Pulldown (Machine)': 'lat-pulldown',                      # approx: cable
    'Lateral Raise (Cable)': 'cable-lateral-raise',
    'Lateral Raise (Dumbbell)': 'lateral-raise',
    'Lateral Raise (Machine)': 'machine-lateral-raise',
    'Leg Extension (Machine)': 'leg-extension',
    'Lunge (Dumbbell)': 'walking-lunge',                           # approx: walking
    'One Arm Overhead Shoulder (Dumbbell)': 'standing-dumbbell-press',  # approx: both arms
    'Overhead Press (Barbell)': 'overhead-press',
    'Overhead Press (Dumbbell)': 'standing-dumbbell-press',
    'Palms Up Close Grip Pulldown (Biceps)': 'close-grip-lat-pulldown',  # approx: grip
    'Pec Deck (Machine)': 'pec-deck',
    'Preacher Curl (Dumbbell)': 'preacher-curl',                   # approx: machine
    'Preacher Curl (Machine)': 'preacher-curl',
    'Pull Up': 'pull-up',
    'Push Up': 'push-up',
    'Reverse Fly (Dumbbell)': 'rear-delt-fly',
    'Romanian Deadlift (Barbell)': 'romanian-deadlift',
    'Romanian Deadlift (Dumbbell)': 'dumbbell-romanian-deadlift',
    'Seated dip': 'assisted-dip',                                  # approx: assisted dip machine
    'Seated Leg Press (Machine)': 'leg-press',
    'Seated Row (Cable)': 'seated-row',
    'Seated Row (Machine)': 'machine-row',
    'Shoulder Press (Plate Loaded)': 'machine-shoulder-press',
    'Skullcrusher (Barbell)': 'skull-crusher',
    'Squat (Bodyweight)': 'bodyweight-squat',
    'Standing Calf Raise (Barbell)': 'standing-calf-raise',        # approx: machine
    'Standing Calf Raise (Dumbbell)': 'calf-raise',                # approx: bodyweight
    'Standing Calf Raise (Machine)': 'standing-calf-raise',
    'Standing Calf Raise (Smith Machine)': 'standing-calf-raise',  # approx: machine
    'Stiff Leg Deadlift (Barbell)': 'romanian-deadlift',           # approx
    'Stiff Leg Deadlift (Dumbbell)': 'dumbbell-romanian-deadlift',  # approx
    'Triceps Dip': 'dip',
    'Triceps Dip (Assisted)': 'assisted-dip',
    'Triceps Extension': 'tricep-pushdown',                        # Strong's = cable pushdown
    'Triceps Extension (Barbell)': 'overhead-tricep-extension',    # approx: cable
    'Triceps Extension (Cable)': 'overhead-tricep-extension',
    'Triceps Extension (Dumbbell)': 'single-arm-dumbbell-tricep-extension',
}

SIZE = 300
THUMB = 96
FRAME_MS = 900
PAD = 12


def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()


def render(svg_path):
    # Source drawings are white on transparent; draw them black on white
    svg = open(svg_path, encoding='utf-8').read().replace('fill="#fff"', 'fill="#000"').replace("fill='#fff'", "fill='#000'")
    png = subprocess.run(['rsvg-convert', '-w', '1024', '-b', 'white'], input=svg.encode(), capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(png)).convert('L')


def build(wg, ex, gb, key):
    frames = [render(os.path.join(wg, 'packages', 'workout-guide', f['path'])) for f in sorted(ex['frames'], key=lambda f: f['index'])]
    # One crop box for all frames, so only the body moves
    boxes = [ImageOps.invert(f).getbbox() for f in frames]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    w, h = box[2] - box[0], box[3] - box[1]
    scale = (SIZE - 2 * PAD) / max(w, h)
    out = []
    for f in frames:
        c = f.crop(box).resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        bg = Image.new('L', (SIZE, SIZE), 255)
        bg.paste(c, ((SIZE - c.width) // 2, (SIZE - c.height) // 2))
        out.append(bg.convert('RGB'))
    seq = out + out[-2:0:-1]  # 1-2-3-2
    seq[0].save(os.path.join(gb, 'anim', f'{key}.webp'), save_all=True, append_images=seq[1:],
                duration=FRAME_MS, loop=0, quality=82, method=6)
    out[min(1, len(out) - 1)].resize((THUMB, THUMB), Image.LANCZOS).save(
        os.path.join(gb, 'thumb', f'{key}.webp'), quality=80, method=6)


def main(wg, gb):
    manifest = json.load(open(os.path.join(wg, 'packages', 'workout-guide', 'manifest.json'), encoding='utf-8'))
    by_slug = {e['slug']: e for e in manifest}
    catalog_path = os.path.join(gb, 'exercises.json')
    catalog = json.load(open(catalog_path, encoding='utf-8'))

    # Catalog exercises with exactly the same name as a Workout Guide exercise also get its drawing
    wg_names = {}
    for e in manifest:
        wg_names.setdefault(norm(e['name']), e['slug'])
        wg_names.setdefault(norm(f"{e['name']} ({e['equipment']})"), e['slug'])

    bad = [s for s in MAP.values() if s not in by_slug]
    if bad:
        sys.exit(f'Unknown Workout Guide slugs: {bad}')

    os.makedirs(os.path.join(gb, 'anim'), exist_ok=True)
    os.makedirs(os.path.join(gb, 'thumb'), exist_ok=True)
    names = {x['name'] for x in catalog}
    missing = [n for n in MAP if n not in names]
    made, own, exact = set(), set(), 0
    for x in catalog:
        x.pop('a', None)
        slug = MAP.get(x['name'])
        if slug:
            own.add(slug)
        else:
            slug = wg_names.get(norm(x['name']))
            if slug:
                exact += 1
        if not slug:
            continue
        key = f'wg-{slug}'
        if key not in made:
            build(wg, by_slug[slug], gb, key)
            made.add(key)
        x['a'] = key

    with open(catalog_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(gb, 'images.json'), 'w', encoding='utf-8') as f:
        json.dump(sorted(f'anim/{k}.webp' for k in made), f, separators=(',', ':'))
    own_list = [f'anim/wg-{s}.webp' for s in sorted(own)] + [f'thumb/wg-{s}.webp' for s in sorted(own)]
    sw_path = os.path.join(gb, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    sw = re.sub(r'const OWN_IMAGES = \[.*?\];', 'const OWN_IMAGES = ' + json.dumps(own_list) + ';', sw, flags=re.S)
    with open(sw_path, 'w', encoding='utf-8') as f:
        f.write(sw)
    print(f'{sum(1 for x in catalog if x.get("a"))} exercises with a drawing ({exact} by exact name), '
          f'{len(made)} drawings; own exercises not in catalog: {missing}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
