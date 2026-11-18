# 외전 출신과 주요 인물을 고정 그림체로 그린다. Anlas가 들지 않는 조건(832x1216, 28 steps, 한 장씩)만 쓴다.
#   cd art && python3 주요인물.py 출력폴더 [이름 일부]
import os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "출신초상.sh"), encoding="utf-8").read()
STYLE = re.search(r'^S="(.*)"$', src, re.M).group(1)
X = re.search(r'^X="(.*)"$', src, re.M).group(1)
OUT = sys.argv[1]; ONLY = sys.argv[2] if len(sys.argv) > 2 else ""
os.makedirs(OUT, exist_ok=True)
HERO_M = "1boy, solo, wuxia protagonist, handsome, sharp facial features, heroic, charismatic, dignified posture, young man, early twenties"
HERO_F = "1girl, solo, wuxia protagonist, beautiful, elegant facial features, heroic, charismatic, dignified posture, young woman, early twenties"
POSE = "three-quarter view, standing, contrapposto, looking at viewer, upper body"

# 이름, 성별("남녀" "남" "여"), 배경, 인물, 더 뺄 것
SIDE = [
 ("외전당가", "남녀", "bamboo grove in sichuan, misty herb garden, faint green poison mist, stone lanterns",
  "heir of a poison clan, black hair, high ponytail, sharp cold eyes, green eyes, black inner robe, dark green outer robe with silver bamboo embroidery, leather glove on right hand, needle case and small pouches at belt, three thin steel needles held between gloved fingers, calm calculating expression", "sword, spear"),
 ("외전빙궁", "남녀", "frozen northern sea, ice palace in distance, falling snow, pale blue sky",
  "disciple of the northern ice palace, long white hair, ice blue eyes, white hanfu with pale blue snowflake embroidery, white fur collar, frost on sleeves, visible cold breath, right palm raised with swirling frost mist, cold serene expression", "weapon, sword, holding weapon"),
 ("외전매화", "남녀", "plum blossom trees on steep huashan cliffs, falling plum petals, small thatched hut on a ledge, morning mist",
  "plum blossom swordsman of mount hua, black hair, long hair, half updo, plum blossom hair ornament, white hanfu with pink plum blossom embroidery, pale pink sash, jian sheathed at left hip, white scabbard, right hand resting on sword hilt, gentle resolute smile", "curved sword, dao"),
 ("외전살막", "남녀", "tiled rooftops at night, full moon, light rain, distant lanterns",
  "assassin bound to a ledger, black hair, short ponytail, sharp eyes, black close-fitting clothes, black cloth mask pulled down to neck, wooden token hanging from belt, short dao (weapon) sheathed at hip, hand on hilt, emotionless gaze", "jian, long sword"),
 ("외전수로", "남녀", "wide yangtze river at dusk, wooden boats, reeds, mist over water",
  "heir of a river pirate stronghold, black hair, tied back with a cloth band, tanned skin, rolled up sleeves, dark blue sleeveless vest over white shirt, red waist sash, coil of rope on shoulder, long fishing harpoon spear planted upright beside body, confident grin", "sword"),
 ("외전혈승", "남녀", "grey mountain road, ruined shrine, red sunset, crows",
  "wandering monk of the blood sect, bald, shaved head, calm half-closed eyes, ash grey kasaya, red prayer beads around neck, monk staff with metal rings planted on the ground, one hand in prayer gesture, quiet unsettling serenity", "sword, hair"),
 ("외전야수", "남녀", "southern jungle, waterfall, giant ferns, a white tiger lying behind",
  "child of the beast palace raised by tigers, wild messy black hair, tanned skin, golden eyes, tiger fur shawl, bone and fang necklace, sleeveless brown tunic, cloth wrapped fists, feral grin", "weapon, sword, holding weapon"),
 ("외전소림", "남", "closed gate of shaolin temple, stone stairs, pine trees, morning bell tower in mist",
  "lay disciple of shaolin, short black hair, earnest eyes, ochre and brown practice robe, wooden prayer beads at wrist, plain wooden staff planted on the ground, hand resting on staff, calm determined expression", "sword, blade, bald"),
 ("외전무당", "남녀", "stone door of a secluded cave on wudang mountain, misty peaks, old pine",
  "taoist disciple of wudang, black hair in topknot with wooden hairpin, clear eyes, white and light blue taoist robe with taiji symbol embroidery, jian sheathed at hip, hand on hilt, composed expression", "curved sword, dao"),
 ("외전아미", "여", "golden summit of mount emei above a sea of clouds, temple bell tower, morning light",
  "lay disciple of emei, black hair, long hair, low ponytail, white and pale grey robe with lotus embroidery, jian sheathed at hip, one hand on hilt, other hand holding a torn red sleeve, protective resolute expression", "curved sword, dao"),
 ("외전공동", "남녀", "earthen frontier fortress walls, ruins of the great wall, sand storm, desert sun",
  "frontier swordsman of kongtong, black hair, headscarf against sand, sun-tanned skin, sand-colored cloak over dark robe, red sword cord tied to the hilt, jian sheathed at hip, hand on hilt, steady watchful gaze", "curved sword, dao"),
 ("외전모용", "남녀", "snowy changbai mountains, tall pines, falling snow",
  "outcast scion of the murong clan, black hair, long hair tied with silver ring, sharp eyes, fur-lined dark green robe, silver embroidery, long spear held upright, spearhead visible above head, snow on shoulders, proud determined expression", "sword"),
 ("외전사도련", "남녀", "debt collection hall, stacks of ledgers, iron abacus, red lanterns",
  "debt collector of the unorthodox alliance, black hair, slicked back, cold eyes, black and dark red robe, ledger book tucked in belt, dao (weapon) sheathed at hip, hand on hilt, thin cold smile", "jian"),
 ("외전제갈", "남녀", "workshop full of wooden gears, a wooden mechanical ox, scrolls and blueprints",
  "mechanist of the zhuge clan, black hair, neat bun, intelligent eyes, deep blue robe with geometric patterns, small wooden repeating crossbow strapped to forearm, rolled blueprint in other hand, thoughtful expression", "sword, gun"),
 ("외전귀문", "남녀", "dark hall with thousands of soul lanterns, paper talismans hanging, blue flames",
  "spear bearer of the ghost gate cult, pale skin, long black hair, hollow grey eyes, black robe with white talisman patterns, spear held upright with a small paper lantern hanging below the spearhead, solemn expression", "sword"),
 ("외전녹림", "남녀", "mountain bandit stronghold, wooden palisade, pine forest, campfire smoke",
  "chief of a small bandit stronghold, black hair, wild ponytail, scar on chin, fur vest over rough dark brown clothes, rope belt, heavy wooden staff resting on shoulder, bold grin", "sword, blade"),
 ("외전흑사", "남녀", "smoky gambling den, dice tables, hanging lanterns, gold coins",
  "gambler of the black snake gang, black hair, side bangs, sly eyes, black robe with gold coin patterns, gold coins held between fingers, other hand flipping a coin, sly smile", "sword, spear"),
 ("외전망나니", "남녀", "execution ground in the rain, wooden platform, overcast sky",
  "former executioner seeking the truth, black hair, unkempt, tired heavy eyes, plain grey clothes, wide executioner's saber wrapped in cloth carried on back, hilt over shoulder, grim expression", "jian"),
 ("외전청성", "남녀", "pine forest of qingcheng mountain, torn red wedding ribbons on branches",
  "disciple of qingcheng, black hair, long ponytail, gentle eyes, green robe with pine needle embroidery, red ribbon tied on wrist, jian sheathed at hip, hand on hilt, resolute expression", "curved sword, dao"),
 ("외전종남", "남녀", "village at the foot of zhongnan mountain, wheat fields, straw roofs",
  "outer hall swordsman of zhongnan, black hair, simple topknot, honest eyes, plain brown hanfu, worn sword sheathed at hip, folded debt document in one hand, steady expression", "curved sword, dao"),
 ("외전신교", "남녀", "village of the demonic cult, crimson banners, dark sky",
  "young blade of the heavenly demon cult, black hair, long hair, red eyes, black and crimson robe, red sleeves, heavy dao (weapon) sheathed at hip, hand on hilt, pale wisps drifting around the scabbard, cold ambitious gaze", "jian"),
 ("외전홍수", "남녀", "night banquet hall in luoyang, red lanterns, silk curtains",
  "agent of the red sleeves, black hair, elegant updo, alluring sharp eyes, crimson robe with very long red sleeves, thin steel needles glinting from the sleeve cuff, fan in other hand, enigmatic smile", "sword, spear"),
 ("외전점창", "남녀", "cangshan mountain above erhai lake, swarms of insects in mist, stone pillar",
  "fast swordsman of diancang, black hair, high ponytail, sharp eyes, light blue robe with lightning embroidery, jian sheathed at hip, hand on hilt ready to draw, focused expression", "curved sword, dao"),
 ("외전곤륜", "남녀", "snowy kunlun peaks, glacier, a line of small footprints in snow",
  "disciple of kunlun, black hair, long hair, snow-white robe with fur collar, jian sheathed at hip, hand on hilt, gentle protective expression", "curved sword, dao"),
 ("외전광부", "남녀", "silver mine tunnel, wooden supports, oil lamps, rubble",
  "miner who broke out of a collapsed mine, black hair, sweat band, dust on face, muscular arms, torn sleeveless shirt, bandaged fists, clenched fist at chest, burning eyes", "weapon, sword, holding weapon, pickaxe"),
 ("외전사공", "남녀", "yellow river ferry crossing, muddy water, wooden boats, cliffs",
  "ferryman of the yellow river, black hair, tied back, tanned skin, straw hat hanging on back, rolled up trousers, long bamboo punting pole planted upright, easygoing smile", "sword, blade"),
 ("외전위소", "남녀", "ruins of a coastal fortress, broken walls, stormy sea, tattered banner",
  "son of a fallen coastal garrison, black hair, topknot with red cord, determined eyes, worn military padded coat over dark robe, red tasseled spear held upright, spearhead visible, stern expression", "sword"),
]
# 이름, 성별, 배경, 인물, 더 뺄 것
NPC = [
 ("천마", "남", "summit of the heavenly demon peak, snow, dark storm clouds, crimson sky, black stone throne",
  "the heavenly demon, ageless handsome man, long black hair flowing, crimson eyes, black and crimson imperial robe with dragon embroidery, seated on a black stone throne, one hand resting on armrest, overwhelming calm presence, dark aura, looking down at viewer", "weapon, holding weapon, horns"),
 ("혈마", "남", "pool of blood in a ruined underground temple, red mist, ancient pillars",
  "ancient blood demon awakened, tall gaunt man, long crimson hair, glowing red eyes, pale skin with dark red vein patterns, tattered ancient crimson robe, red mist rising around body, menacing smile", "weapon, gore, horns"),
 ("혈불사도명", "남", "grey mountain temple courtyard, cauldron of porridge, red sunset",
  "leader of the blood sect, elderly monk, bald, calm smile, ash grey kasaya with dark red stains along the hem, long red prayer beads in hand, serene yet sinister", "weapon, gore"),
 ("무림맹주", "남", "martial alliance hall, great banners, crowd of martial artists in distance",
  "leader of the martial alliance, middle-aged man, dignified, neat beard, long black hair with grey streaks, white and gold robe, jian sheathed at hip, hand on hilt, solemn heavy gaze", "curved sword, dao"),
 ("무영", "남", "dark night, black mist, moonlight barely visible",
  "first general of the demonic cult, figure whose face is hidden in deep shadow, black hooded robe, only faint red eyes visible, edges dissolving into shadow, silent menace", "weapon"),
 ("환면마후", "여", "palace hall with hanging silk, floating porcelain masks",
  "second general of the demonic cult, beautiful mature woman, long black hair, crimson robe, holding a white porcelain mask near her face, several masks floating around, enigmatic smile", "weapon"),
 ("쇄혼도위극", "남", "battlefield at dusk, crimson banners, drifting pale wisps",
  "fourth general of the demonic cult, middle-aged man, scarred face, black armored robe, enormous dao (weapon) resting on shoulder with chains wrapped around it, pale ghostly wisps clinging to the blade, cold eyes", "jian"),
 ("공손야", "남", "hall of the unorthodox alliance, mountains of ledgers, iron abacus, dim lanterns",
  "lord of the unorthodox alliance, elderly man, grey hair tied back, iron-hard face, black robe with dark red trim, seated behind a desk of ledgers, brush in hand, cold calculating eyes", "weapon"),
 ("무면객", "남", "misty bamboo forest at night",
  "master of the assassin house, figure wearing a plain white featureless mask, grey robe, hands hidden in sleeves, unsettling stillness", "weapon"),
 ("노구산", "남", "under a stone bridge, river, lanterns, straw mats",
  "elder of the beggar sect, old man, messy grey hair, sharp sober eyes, ragged patched clothes, wine gourd at waist, wooden staff in hand, sly knowing smile", "sword, blade"),
 ("매화노검", "남", "plum blossom grove on a lonely island, petals on the wind, sea in background",
  "legendary old swordsman, long white hair and white beard, kind but sharp eyes, simple white robe, jian sheathed at hip, hand on hilt, plum petal on shoulder", "curved sword, dao"),
 ("초출사부", "남", "thatched hermitage on a misty mountain, pine tree, stone table with tea",
  "nameless hermit master, old man, grey hair in a topknot, short grey beard, plain faded robe, sitting on a stone with a cup of tea, gentle wise smile", "weapon"),
]

def run(name, seed, char, bg, extra):
    subprocess.run([sys.executable, "-I", os.path.join(HERE, "gen.py"), os.path.join(OUT, name), str(seed), STYLE, char, bg, X + ", " + extra], cwd=HERE)

for key, genders, bg, body, extra in SIDE:
    if ONLY and ONLY not in key: continue
    if "남" in genders and not os.path.exists(os.path.join(OUT, f"{key}_남.png")): run(f"{key}_남", 7014 if key == "외전망나니" else 7013, f"{HERO_M}, {body}, {POSE}", bg, extra)
    if ("녀" in genders or genders == "여") and not os.path.exists(os.path.join(OUT, f"{key}_녀.png")): run(f"{key}_녀", 8013, f"{HERO_F}, {body}, {POSE}", bg, extra)
for key, g, bg, body, extra in NPC:
    if ONLY and ONLY not in key: continue
    if os.path.exists(os.path.join(OUT, key + ".png")): continue
    head = "1boy, solo" if g == "남" else "1girl, solo"
    run(key, 9013, f"{head}, {body}, {POSE.replace('standing, contrapposto, ', '') if '천마' == key or '공손야' == key or '초출사부' == key else POSE}", bg, extra)
