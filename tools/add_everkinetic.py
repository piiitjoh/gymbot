#!/usr/bin/env python3
"""Gives Gymbot exercises Everkinetic drawings (CC BY-SA 4.0) where a matching drawing exists.

For each mapped exercise: anim/ek-<id>.webp (start and end position, looping, 300x300, white
background, like the existing animations) and thumb/ek-<id>.webp (96x96, end position). The
exercise's "a" field in exercises.json is set to ek-<id>, so app.js needs no change to show it.
Gymbot uses Everkinetic drawings only: every exercise without a match gets no "a" field, and the
app then shows no drawing for it.

Usage: python3 add_everkinetic.py <everkinetic data repo> <gymbot folder>
"""
import json
import os
import re
import sys

from PIL import Image, ImageOps

# Gymbot exercise name -> Everkinetic id_num. Only drawings that show the same movement; an
# exercise with no match gets no drawing. "approx" marks a close but not identical
# variant (other grip, seated instead of standing, other equipment).
MAP = {
    'Bench Press (Dumbbell)': '0055',
    'Incline Bench Press (Barbell)': '0043',
    'Incline Bench Press (Dumbbell)': '0061',
    'Incline Bench Press (Smith Machine)': '0081',
    'Decline Bench Press (Barbell)': '0051',
    'Iso-Lateral Chest Press (Machine)': '0066',
    'Chest Fly (Dumbbell)': '0056',
    'Incline Chest Fly (Dumbbell)': '0062',
    'Chest Fly (Cable)': '0048',
    'Chest Dip': '0054',
    'Push Up': '0077',
    'Triceps Dip': '0172',
    'Triceps Dip (Assisted)': '0171',
    'Seated dip': '0171',
    'Skullcrusher (Barbell)': '0183',
    'Triceps Extension (Barbell)': '0201',
    'Triceps Extension (Dumbbell)': '0192',
    'Triceps Extension': '0198',
    'Bicep Curl (Dumbbell)': '0224',
    'Bicep Curl (Cable)': '0212',
    'Hammer Curl (Dumbbell)': '0227',
    'Concentration Curl (Dumbbell)': '0220',
    'Preacher Curl (Dumbbell)': '0249',
    'Preacher Curl (Machine)': '0236',
    'Lateral Raise (Dumbbell)': '0018',
    'Reverse Fly (Dumbbell)': '0032',
    'One Arm Overhead Shoulder (Dumbbell)': '0038',
    'Overhead Press (Barbell)': '0004',          # approx: seated military press
    'Cross-over back (cable)': '0017',           # approx: bent-over cable rear delt raise
    'Pull Up': '0087',
    'Palms Up Close Grip Pulldown (Biceps)': '0093',
    'Seated Row (Cable)': '0025',
    'Bent Over Row (Barbell)': '0026',           # approx: underhand grip
    'Bent Over Row (Plate loaded)': '0029',      # approx: T-bar row
    'Deadlift (Barbell)': '0099',
    'Romanian Deadlift (Barbell)': '0118',
    'Stiff Leg Deadlift (Barbell)': '0118',      # approx: Romanian deadlift
    'Romanian Deadlift (Dumbbell)': '0107',      # approx: dumbbell deadlift
    'Stiff Leg Deadlift (Dumbbell)': '0107',     # approx: dumbbell deadlift
    'Back Extension': '0103',
    'Back Extension (Machine)': '0103',          # approx: hyperextension bench
    'Lunge (Dumbbell)': '0115',
    'Seated Leg Press (Machine)': '0127',
    'Hack Squat': '0123',
    'Leg Extension (Machine)': '0142',
    'Standing Calf Raise (Machine)': '0282',
    'Standing Calf Raise (Barbell)': '0281',
    'Calf Press on Seated Leg Press': '0273',
    'Cable Crunch': '0288',                      # approx: seated cable crunch
    'Decline Crunch': '0292',
    'Ab Wheel': '0286',                          # approx: barbell rollout on knees
}

# Catalog exercises (not logged by Peter) -> Everkinetic id_num, checked by hand.
EXTRA = {
 'Dumbbell Tate Press':'0203','Barbell Bench Press':'0042','Smith Bench Press':'0078',
 'Dumbbell Shrug':'0005','Cable Front Raise':'0008','Cable Shrug':'0009','Smith Upright Row':'0013',
 'Barbell Upright Row':'0014','Cable Upright Row':'0015','Dumbbell Upright Row':'0016',
 'Lying Leg Raise Flat Bench':'0021','Smith Rear Delt Row':'0022','Dumbbell Lying Rear Lateral Raise':'0023',
 'Dumbbell Rear Delt Row (shoulder)':'0024','Barbell Reverse Grip Bent Over Row':'0026','Barbell Rear Delt Row':'0028',
 'Lever T Bar Row':'0029','Barbell Shrug':'0030','Dumbbell Front Raise':'0033',
 'Cable Seated Shoulder Internal Rotation':'0034','Cable Seated Rear Lateral Raise':'0035',
 'Dumbbell Lying One Arm Rear Lateral Raise':'0037','Dumbbell Seated One Arm Shoulder Press':'0038',
 'Dumbbell One Arm Upright Row':'0039','Smith Shrug':'0041','Barbell Bent Arm Pullover':'0045',
 'Dumbbell Pullover':'0046','Barbell Close-Grip Bench Press':'0049','Dumbbell Decline Bench Press':'0052',
 'Dumbbell Decline Fly':'0053','Cable Lying Fly':'0057','Barbell Front Raise And Pullover':'0058',
 'Cable Incline Fly':'0060','Barbell Decline Wide-Grip Pullover':'0064','Chest Press (Machine)':'0066',
 'Push-Up (bosu Ball)':'0069','Push Up On Bosu Ball':'0069','Barbell One Arm Floor Press':'0070',
 'Dumbbell One Arm Bench Fly':'0071','Decline Push-Up':'0075','Push-Up (on Stability Ball)':'0076',
 'Dumbbell Straight Arm Pullover':'0079','Smith Wide Grip Bench Press':'0082',
 'Smith Wide Grip Decline Bench Press':'0083','Lever Decline Chest Press':'0085','Inverted Row':'0086',
 'Chin-Ups (narrow Parallel Grip)':'0090','Cable Straight Arm Pulldown':'0092',
 'Cable Lateral Pulldown With V-Bar':'0096','Dumbbell Pullover On Exercise Ball':'0098',
 'Smith Deadlift':'0100','Barbell Good Morning':'0101','Smith Bent Knee Good Morning':'0102',
 'Back Extension On Exercise Ball':'0104','Dumbbell Deadlift':'0107','Low Glute Bridge On Floor':'0109',
 'Cable Kickback':'0112','Barbell Lunge':'0114','Flutter Kicks':'0116','Lever Lying Leg Curl':'0117',
 'Lever Seated Leg Curl':'0119','Standing Single Leg Curl':'0120','Walking Lunge':'0121',
 'Barbell Full Squat':'0122','Smith Squat':'0124','Barbell Hack Squat':'0125','Smith Hack Squat':'0126',
 'Sled 45° Leg Press (side Pov)':'0127','Sled 45° Leg Press (back Pov)':'0127','Barbell Rear Lunge':'0128',
 'Dumbbell Rear Lunge':'0129','Dumbbell Squat':'0130','Barbell Side Split Squat':'0131',
 'Barbell Bench Squat':'0133','Barbell Step-Up':'0134','Cable Hip Adduction':'0135','Dumbbell Bench Squat':'0136',
 'Dumbbell Step-Up':'0137','Barbell Front Squat':'0138','Barbell Bench Front Squat':'0139',
 'Dumbbell Iron Cross':'0140','Barbell Jefferson Squat':'0141','Barbell Narrow Stance Squat':'0146',
 'Barbell One Leg Squat':'0147','Barbell One Arm Snatch':'0148','Barbell One Arm Side Deadlift':'0150',
 'Barbell Overhead Squat':'0151','Barbell Speed Squat':'0154','Band Squat':'0155',
 'Lever Seated Hip Abduction':'0156','Lever Seated Hip Adduction':'0157','Weighted Sissy Squat':'0158',
 'Barbell Wide Squat':'0160','Barbell Zercher Squat':'0161','Bench Dip On Floor':'0162',
 'Cable Incline Pushdown':'0163','Cable Incline Triceps Extension':'0164',
 'Cable Lying Triceps Extension (Rope)':'0165','Cable Standing One Arm Triceps Extension':'0166',
 'Dumbbell Decline Triceps Extension':'0169','Ez Barbell Decline Triceps Extension':'0170',
 'Lever Overhand Triceps Dip':'0171','Dumbbell One Arm Triceps Extension (on Bench)':'0173',
 'Barbell Jm Bench Press':'0175','Cable Kneeling Triceps Extension':'0177',
 'Barbell Lying Close-Grip Triceps Extension':'0179','Barbell Lying Close-Grip Press':'0180',
 'Dumbbell Lying Triceps Extension':'0181','Dumbbell Lying Extension (across Face)':'0182',
 'Barbell Lying Triceps Extension':'0183','Dumbbell Lying One Arm Pronated Triceps Extension':'0186',
 'Dumbbell Lying One Arm Supinated Triceps Extension':'0187','Close-Grip Push-Up':'0188','Diamond Push-Up':'0188',
 'Cable Reverse-Grip Pushdown':'0189','Barbell Reverse Close-Grip Bench Press':'0190',
 'Dumbbells Seated Triceps Extension':'0192','Barbell Seated Overhead Triceps Extension':'0193',
 'Smith Close-Grip Bench Press':'0195','Dumbbell Standing Bent Over One Arm Triceps Extension':'0196',
 'Dumbbell Standing Bent Over Two Arm Triceps Extension':'0197','Dumbbell Standing Triceps Extension':'0198',
 'Assisted Standing Triceps Extension (with Towel)':'0202','Dumbbell Kickback':'0204',
 'Cable Pushdown (with Rope Attachment)':'0206','Cable Triceps Pushdown (v-Bar)':'0207',
 'Weighted Side Bend (on Stability Ball)':'0208','Dumbbell Incline Triceps Extension':'0209',
 'Lever Triceps Extension':'0210','Bicep Curl (Barbell)':'0211','Dumbbell Hammer Curl (Alternating)':'0213',
 'Dumbbell Incline Curl':'0214','Dumbbell Incline Biceps Curl':'0214','Barbell Prone Incline Curl':'0215',
 'Cable Hammer Curl (with Rope)':'0216','Cable Preacher Curl':'0217','Ez Barbell Close-Grip Curl':'0218',
 'Barbell Standing Close Grip Curl':'0219','Dumbbell Cross Body Hammer Curl':'0221','Barbell Drag Curl':'0222',
 'Dumbbell Prone Incline Curl':'0225','Ez Barbell Curl':'0226','Dumbbell Incline Inner Biceps Curl':'0231',
 'Cable Lying Bicep Curl':'0232','Cable Lying Close-Grip Curl':'0233','Dumbbell Lying Supine Curl':'0235',
 'Dumbbell Lying Supine Biceps Curl':'0235','Lever Preacher Curl':'0236','Cable Overhead Curl':'0238',
 'Barbell Preacher Curl':'0239','Dumbbell Preacher Hammer Curl':'0240',
 'Barbell Seated Close-Grip Concentration Curl':'0242','Dumbbell Seated Curl':'0243',
 'Dumbbell Seated Bicep Curl':'0243','Dumbbell Seated Inner Biceps Curl':'0244',
 'Dumbbell Standing Inner Biceps Curl':'0246','Cable One Arm Curl':'0247',
 'Dumbbell Standing One Arm Curl Over Incline Bench':'0248','Dumbbell Standing One Arm Curl (over Incline Bench)':'0248',
 'Barbell Standing Wide-Grip Curl':'0250','Barbell Standing Wide Grip Biceps Curl':'0250',
 'Dumbbell Zottman Curl':'0251','Dumbbell Zottman Preacher Curl':'0252','Lever Bicep Curl':'0253',
 'Dumbbell Seated Biceps Curl (on Stability Ball)':'0255','Dumbbell Biceps Curl Squat':'0256',
 'Dumbbell Biceps Curl Reverse':'0257','Dumbbell One Arm Concentration Curl (on Stability Ball)':'0258',
 'Band Alternating Biceps Curl':'0261','Dumbbell Bicep Curl Lunge With Bowling Motion':'0262',
 'Dumbbell Step Up Single Leg Balance With Bicep Curl':'0266','Dumbbell Bicep Curl With Stork Stance':'0268',
 'Ankle Circles':'0270','Barbell Seated Calf Raise':'0272','Lever Calf Press':'0273','Donkey Calf Raise':'0275',
 'Dumbbell Seated One Leg Calf Raise':'0276','Barbell Standing Rocking Leg Calf Raise':'0278',
 'Lever Seated Calf Raise':'0279','Smith Reverse Calf Raises':'0280','Air Bike':'0284',
 'Hip Raise (bent Knee)':'0287','Cable Seated Crunch':'0288','Cross Body Crunch':'0289',
 'Crunch Floor':'0291','Dumbbell Side Bend':'0294','Crunch (on Stability Ball)':'0295',
 'Pull-In (on Stability Ball)':'0296',
}
MAP.update(EXTRA)

SIZE = 300
THUMB = 96
FRAME_MS = 900
PAD = 12
# Hanging exercises: keep the bar still instead of the feet
TOP_ALIGN = {'0087', '0093'}


def main(ek, gb):
    exercises = json.load(open(os.path.join(ek, 'exercises.json'), encoding='utf-8'))
    titles = {x['id_num']: x['title'] for x in exercises}
    png = os.path.join(ek, 'dist', 'png')
    catalog_path = os.path.join(gb, 'exercises.json')
    catalog = json.load(open(catalog_path, encoding='utf-8'))
    by_name = {}
    for x in catalog:
        by_name.setdefault(x['name'], []).append(x)

    os.makedirs(os.path.join(gb, 'anim'), exist_ok=True)
    os.makedirs(os.path.join(gb, 'thumb'), exist_ok=True)
    made, used, missing = set(), [], []
    for name, ek_id in MAP.items():
        if name not in by_name:
            missing.append(name)
            continue
        key = f'ek-{ek_id}'
        if key not in made:
            # Each drawing is framed on its own canvas. Crop both to the figure, scale them by the
            # same factor, and stand them on the same floor line, so only the body moves.
            crops = []
            for part in ('relaxation', 'tension'):
                im = Image.open(os.path.join(png, f'{ek_id}-{part}.png')).convert('L')
                crops.append(im.crop(ImageOps.invert(im).getbbox()))
            inner = SIZE - 2 * PAD
            scale = inner / max(max(c.width for c in crops), max(c.height for c in crops))
            out = []
            for c in crops:
                c = c.resize((max(1, round(c.width * scale)), max(1, round(c.height * scale))), Image.LANCZOS)
                bg = Image.new('L', (SIZE, SIZE), 255)
                y = PAD if ek_id in TOP_ALIGN else SIZE - PAD - c.height
                bg.paste(c, ((SIZE - c.width) // 2, y))
                out.append(bg.convert('RGB'))
            out[0].save(os.path.join(gb, 'anim', f'{key}.webp'), save_all=True, append_images=out[1:],
                        duration=FRAME_MS, loop=0, quality=82, method=6)
            out[1].resize((THUMB, THUMB), Image.LANCZOS).save(os.path.join(gb, 'thumb', f'{key}.webp'), quality=80, method=6)
            made.add(key)
        for x in by_name[name]:
            x['a'] = key
        used.append((name, ek_id, titles.get(ek_id)))

    for x in catalog:
        if 'a' in x and not str(x['a']).startswith('ek-'):
            del x['a']
    with open(catalog_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))
    for name, ek_id, title in used:
        print(f'{name:40} -> {ek_id} {title}')
    print(f'{len(used)} exercises, {len(made)} drawings; not in catalog: {missing}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
