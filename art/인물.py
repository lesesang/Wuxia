# 강호행의 인물 그림. NovelAI Diffusion V4.5 Full, Anlas가 들지 않는 조건(832x1216, 28 steps, 한 장씩)만 쓴다.
#   cd art && python3 인물.py 출력폴더 [이름 일부] [시드 덧셈]
# 이미 그린 그림은 건너뛴다. 다시 그리려면 그 파일을 지운다.
import os, subprocess, sys

# 고정 그림체(바, 표지 애니). 인물마다 바꾸지 않는다
STYLE = ("high quality anime illustration, martial arts novel cover style, painterly digital painting, clean lineart, "
         "semi-realistic proportions, wuxia, ancient china, cinematic lighting, gentle rim light, balanced contrast, misty background, "
         "natural colors, detailed face, mature features, sharp eyes, layered robes, detailed fabric folds, highly detailed, "
         "detailed hands, five fingers, correct anatomy, detailed weapon, realistic weapon proportions")
# 늘 빼는 것(gen.py의 기본 제외에 덧붙음)
UC = ("cute, moe, childish face, chibi, simple background, pastel colors, photorealistic, 3d, "
      "oversized weapon, giant weapon, weapon too large, stiff pose, awkward pose, unnatural pose, twisted torso, "
      "missing fingers, fused fingers, extra hands, deformed hands, deformed weapon, broken weapon, ugly face, deformed face, "
      "asymmetrical eyes, bad anatomy, ornate weapon, fantasy weapon, multiple weapons, western clothes, fantasy armor, glasses")
HERO = {"남": "1boy, solo, wuxia protagonist, young man, early twenties, handsome, sharp jawline, refined facial features, heroic, charismatic, dignified posture",
        "녀": "1girl, solo, wuxia protagonist, young woman, early twenties, beautiful, elegant refined features, heroic, charismatic, dignified posture"}
POSE = "three-quarter view, standing, contrapposto, looking at viewer, upper body"
SEED = {"남": 7013, "녀": 8013}

# (파일 이름, 성별들, 배경, 인물, 더 뺄 것)
MAIN = [
 ("무림초출", "남녀", "cliff edge above a sea of clouds, distant ink-wash mountain peaks, crooked old pine, small thatched hermitage behind, early morning sun through mist, falling pine needles",
  "disciple who just came down the mountain after ten years with a hermit master, black hair, very long hair, high ponytail tied with a long red ribbon fluttering in the wind, loose strands framing face, dark brown eyes, calm confident half smile, white cross-collar inner robe, dark blue outer robe with silver cloud embroidery on hems and cuffs, black sash knotted at waist, worn leather bracers over cloth wrist wraps, plain cloth bundle tied across back, cloth boots, faint dust on hem, arms crossed over chest, empty hands, unarmed",
  "weapon, sword, holding weapon, sheath, quiver, arrows"),
 ("남궁세가", "남녀", "ruins of a burned noble manor at dusk, charred pillars, collapsed gate with a scorched plaque reading nothing, drifting embers, orange sky fading to ash grey",
  "last heir of a fallen sword clan, black hair, long straight hair, half updo held by a silver hair crown, grey eyes, fair skin, noble bearing, white silk inner robe, sky blue outer robe with silver cloud embroidery, torn left sleeve, scorched hem, blue sash with white jade pendant, jian sheathed at left hip in a white jade scabbard, blue tassel hanging from the pommel, right hand resting on the sword hilt, calm resolute gaze, quiet pride",
  "curved sword, dao, drawn sword"),
 ("하북팽가", "남녀", "courtyard of a ruined clan house at night, broken wooden gate, heavy rain, puddles reflecting red lanterns, stone tiger statue with a cracked head",
  "youngest of five brothers of a saber clan, black hair, long wild ponytail, red headband, amber eyes, fierce eyes, rain-soaked hair, black inner robe, dark orange outer robe with gold tiger embroidery, wide leather belt with bronze tiger head buckle, leather bracers, dao in a black curved scabbard at left hip, red cloth wrapped hilt, small round bronze guard, right hand gripping the hilt ready to draw, left hand holding the scabbard, fierce confident smirk",
  "jian, straight sword, drawn sword, scythe, polearm, long handle"),
 ("표국표사", "남녀", "mountain pass under an overcast sky, row of stone cairns, broken escort cart, torn red escort banner on a leaning pole, wind carrying dust",
  "lone surviving escort guard, black hair, high ponytail tied with red cord, a few loose strands, small scar on cheek, brown eyes, steady confident eyes, dark brown hanfu, brown leather vest, rope belt with a bronze escort agency token, cloth wrist wraps, travel-worn cloak, chinese spear held upright with its butt planted beside the feet, steel spearhead with red horsehair tassel visible above the head, right hand gripping the shaft at shoulder height",
  "sword, flag on weapon, banner on spear, leaves, branch, beard"),
 ("개방제자", "남녀", "underneath an old stone arch bridge at night, river reflecting paper lanterns, straw mats and a small campfire on the bank",
  "fifth-knot disciple of the beggar sect, black hair, messy hair tied in a short ponytail, smudge of dirt on cheek, bright mischievous black eyes, patched and frayed pale green robe, rope belt with five knotted cords, bandaged forearms, wine gourd at waist, straw sandals, plain wooden staff planted on the ground, leaning on it with one hand, sly grin",
  "sword, blade, armor, child"),
 ("권마계승", "남녀", "rocky canyon at sunset, huge boulders marked with deep fist-shaped craters, cave entrance with a stone seat, red-orange sky, swirling dust",
  "inheritor of a legendary fist master's secret manual, black hair, long wild loose hair, sharp features, crimson eyes with a faint red glow, dark grey sleeveless robe over black inner shirt, dark red sash, muscular forearms with faint visible veins, cloth-wrapped fists, small scars on knuckles, faint red aura around the right fist, right fist clenched in front of chest, left arm relaxed, controlled fury",
  "weapon, sword, holding weapon, gauntlet, metal claws"),
 ("혈지생환", "남녀", "edge of a dried blood pond, cracked dark red earth, ruined shrine pillars, crimson dusk sky, crows on dead branches",
  "sole survivor of a sacrificial blood pond, black hair, short messy hair, pale skin, faint dark circles under the eyes, haunted crimson eyes, grey hooded cloak with the hood down, black high-collar inner robe, faint red scar-like markings on the palms glowing softly, right hand raised at chest height with palm open, quiet cold expression",
  "weapon, sword, holding weapon, blood, dripping blood, gore"),
 ("하오문", "남녀", "narrow alley of a night market, tiled rooftops and red lanterns, teahouse signboard, thin mist, moonlight on wet stones",
  "information broker of the back alleys, black hair, long hair in a low ponytail over the shoulder, side bangs, narrow black eyes, faint knowing smile, dark grey hanfu, black hooded cloak with the hood down, leather belt with small pouches and a thin ledger book, cloth wrist wraps, three short steel throwing knives fanned between the fingers of the raised right hand, left hand holding a folded note",
  "sword, long sword, kunai, claws, leaves"),
]

SIDE = [
 ("외전당가", "남녀", "bamboo grove of the tang clan in sichuan, misty herb garden, stone lanterns, faint green mist",
  "direct heir of the sichuan tang poison clan, black hair, neat high ponytail with a jade pin, cold intelligent green eyes, black inner robe, dark green outer robe with silver bamboo embroidery, single black leather glove on the right hand, needle case and small medicine pouches at the belt, three thin steel needles held between gloved fingers, calm calculating expression",
  "sword, spear"),
 ("외전빙궁", "남녀", "frozen northern sea, ice palace of the north sea in the distance, gentle snowfall, pale blue sky",
  "direct disciple of the north sea ice palace, long silver-white hair, ice blue eyes, porcelain skin, white hanfu with pale blue snowflake embroidery, white fur collar, frost clinging to the sleeves, visible cold breath, right palm raised with swirling frost mist, cold serene expression",
  "weapon, sword, holding weapon"),
 ("외전매화", "남녀", "plum blossom trees on the steep cliffs of mount hua, falling plum petals, small thatched hut on a ledge, morning mist",
  "plum blossom swordsman of mount hua and last disciple of a legendary old swordsman, black hair, long hair in a half updo with a plum blossom hairpin, clear determined eyes, white hanfu with pink plum blossom embroidery, pale rose sash, jian sheathed at the left hip in a white scabbard, plum blossom tassel, right hand resting on the hilt, gentle resolute smile",
  "curved sword, dao, drawn sword"),
 ("외전살막", "남녀", "tiled rooftops at night under a full moon, light rain, distant lanterns",
  "assassin bound to the ledger of an assassin house, black hair, short ponytail, sharp emotionless eyes, black close-fitting night clothes, black cloth mask pulled down to the neck, wooden name token hanging from the belt, short dao sheathed at the hip, hand resting on the hilt",
  "jian, long sword"),
 ("외전수로", "남녀", "wide yangtze river at dusk, wooden pirate boats, reeds, mist over the water",
  "heir of a fallen river stronghold, black hair tied back with a cloth band, sun-tanned skin, confident grin, white shirt with rolled sleeves under a dark blue sleeveless vest, red waist sash, coil of rope on the shoulder, long iron-tipped fishing harpoon planted upright beside the body",
  "sword"),
 ("외전혈승", "남녀", "grey mountain road, ruined shrine, red sunset, crows",
  "wandering monk of the blood sect, bald, shaved head, calm half-closed eyes, ash grey kasaya, long red prayer beads around the neck, monk staff with iron rings planted on the ground, one hand raised in a prayer gesture, quiet unsettling serenity",
  "sword, hair"),
 ("외전야수", "남녀", "southern jungle, waterfall, giant ferns, a white tiger lying behind",
  "child of the beast palace raised by tigers, wild messy black hair, sun-tanned skin, golden eyes, tiger fur shawl, necklace of bone and fangs, sleeveless brown tunic, cloth wrapped fists, feral grin",
  "weapon, sword, holding weapon"),
 ("외전소림", "남", "closed mountain gate of shaolin temple, stone stairs, old pines, bell tower in morning mist",
  "lay disciple of shaolin temple, short black hair, earnest steady eyes, ochre and brown practice robe, wooden prayer beads at the wrist, plain wooden staff planted on the ground with one hand resting on it, calm determined expression",
  "sword, blade, bald"),
 ("외전무당", "남녀", "stone door of a sealed meditation cave on wudang mountain, misty peaks, old pine",
  "taoist disciple of wudang guarding a sealed door, black hair in a topknot with a wooden hairpin, clear calm eyes, white and light blue taoist robe with taiji embroidery, jian sheathed at the hip, hand resting on the hilt, composed expression",
  "curved sword, dao, drawn sword"),
 ("외전아미", "여", "golden summit of mount emei above a sea of clouds, temple bell tower, morning light",
  "lay disciple of emei escorting a fugitive, black hair, long low ponytail, kind but firm eyes, white and pale grey robe with lotus embroidery, jian sheathed at the hip, one hand on the hilt, other hand holding a torn red sleeve, protective resolute expression",
  "curved sword, dao, drawn sword"),
 ("외전공동", "남녀", "earthen frontier fortress walls, ruins of the great wall, sand storm, desert sun",
  "swordsman of kongtong guarding an abandoned frontier fort, black hair, sand-colored headscarf, sun-tanned skin, steady watchful eyes, sand-colored cloak over a dark robe, red sword cord tied to the hilt, jian sheathed at the hip, hand on the hilt",
  "curved sword, dao, drawn sword"),
 ("외전모용", "남녀", "snowy changbai mountains, tall pines, falling snow",
  "unrecognized scion of the murong clan, black hair, long hair tied with a silver ring, proud sharp eyes, fur-lined dark green robe with silver embroidery, long spear held upright, spearhead visible above the head, snow on the shoulders, determined expression",
  "sword"),
 ("외전사도련", "남녀", "debt collection hall of the unorthodox alliance, stacks of ledgers, iron abacus, red lanterns",
  "debt collector of the unorthodox alliance, black hair slicked back, cold eyes, black and dark red robe, ledger book tucked in the belt, dao sheathed at the hip, hand resting on the hilt, thin cold smile",
  "jian"),
 ("외전제갈", "남녀", "workshop filled with wooden gears, a wooden mechanical ox, scrolls and blueprints",
  "mechanist of the zhuge clan, black hair in a neat bun, intelligent eyes, deep blue robe with geometric patterns, small wooden repeating crossbow strapped to the forearm, rolled blueprint in the other hand, thoughtful expression",
  "sword, gun"),
 ("외전귀문", "남녀", "dark hall with thousands of soul lanterns, paper talismans hanging, cold blue flames",
  "spear bearer of the ghost gate cult, pale skin, long straight black hair, hollow grey eyes, black robe with white talisman patterns, spear held upright with a small paper lantern hanging below the spearhead, solemn expression",
  "sword"),
 ("외전녹림", "남녀", "mountain bandit stronghold, wooden palisade, pine forest, campfire smoke",
  "chief of a small bandit stronghold, black hair in a wild ponytail, scar on the chin, bold grin, fur vest over rough dark brown clothes, rope belt, heavy wooden club resting on the shoulder",
  "sword, blade"),
 ("외전흑사", "남녀", "smoky gambling den, dice tables, hanging lanterns",
  "gambler of the black snake gang, black hair with side bangs, sly eyes, black robe with gold coin patterns, gold coins held between the fingers, sly smile",
  "sword, spear"),
 ("외전망나니", "남녀", "execution ground in the rain, wooden platform, overcast sky",
  "former executioner hunting the truth, black hair unkempt, tired heavy eyes, plain grey clothes, wide executioner's saber wrapped in cloth carried on the back with the hilt over the shoulder, grim expression",
  "jian"),
 ("외전청성", "남녀", "pine forest of qingcheng mountain, torn red wedding ribbons on the branches",
  "disciple of qingcheng who guarded a broken wedding, black hair in a long ponytail, gentle firm eyes, green robe with pine needle embroidery, red ribbon tied on the wrist, jian sheathed at the hip, hand on the hilt, resolute expression",
  "curved sword, dao, drawn sword"),
 ("외전종남", "남녀", "village at the foot of zhongnan mountain, wheat fields, straw roofs",
  "outer hall swordsman of zhongnan paying off a debt, black hair in a simple topknot, honest eyes, plain brown hanfu, worn sword sheathed at the hip, folded debt document in one hand, steady expression",
  "curved sword, dao, drawn sword"),
 ("외전신교", "남녀", "village of the heavenly demon cult, crimson banners, dark sky",
  "young blade of the heavenly demon cult, long black hair, red eyes, cold ambitious gaze, black and crimson robe with red sleeves, heavy dao sheathed at the hip, hand on the hilt, pale wisps drifting around the scabbard",
  "jian"),
 ("외전홍수", "남녀", "night banquet hall in luoyang, red lanterns, silk curtains",
  "agent of the red sleeves of the demonic cult, black hair in an elegant updo, alluring sharp eyes, crimson robe with very long red sleeves, thin steel needles glinting from the cuff, folding fan in the other hand, enigmatic smile",
  "sword, spear"),
 ("외전점창", "남녀", "cangshan mountain above erhai lake, swarms of insects in the mist, stone pillar",
  "fast swordsman of diancang, black hair in a high ponytail, focused sharp eyes, light blue robe with lightning embroidery, jian sheathed at the hip, hand on the hilt ready to draw",
  "curved sword, dao, drawn sword"),
 ("외전곤륜", "남녀", "snowy kunlun peaks, glacier, a line of small footprints in the snow",
  "disciple of kunlun entrusted with twenty children, long black hair, gentle protective eyes, snow-white robe with fur collar, jian sheathed at the hip, hand on the hilt",
  "curved sword, dao, drawn sword"),
 ("외전광부", "남녀", "silver mine tunnel, wooden supports, oil lamps, rubble",
  "miner who broke out of a collapsed mine with bare fists, black hair with a sweat band, dust on the face, muscular arms, torn sleeveless shirt, bandaged fists, clenched fist at the chest, burning eyes",
  "weapon, sword, holding weapon, pickaxe"),
 ("외전사공", "남녀", "yellow river ferry crossing, muddy water, wooden boats, cliffs",
  "ferryman of the yellow river, black hair tied back, sun-tanned skin, straw hat hanging on the back, rolled up trousers, long bamboo punting pole planted upright, easygoing smile",
  "sword, blade"),
 ("외전위소", "남녀", "ruins of a coastal fortress, broken walls, stormy sea, tattered banner",
  "child of a fallen coastal garrison, black hair in a topknot with red cord, determined eyes, worn military padded coat over a dark robe, red tasseled spear held upright, spearhead visible, stern expression",
  "sword"),
]

# (파일 이름, 성별, 배경, 인물, 더 뺄 것). 주요 인물은 시드 9013
NPC = [
 ("천마", "남", "summit of the heavenly demon peak, snow, dark storm clouds, crimson sky, black stone throne",
  "1boy, solo, the heavenly demon, ageless man who looks in his thirties, overwhelmingly handsome, long black hair flowing to the waist, crimson eyes, black and crimson imperial robe with gold dragon embroidery, black jade crown, seated on a black stone throne, one hand resting on the armrest, chin slightly raised, dark aura like smoke, calm overwhelming presence, looking down at viewer, three-quarter view, upper body",
  "weapon, holding weapon, horns"),
 ("혈마", "남", "pool of blood in a ruined underground temple, red mist, ancient carved pillars",
  "1boy, solo, the ancient blood demon awakened, tall gaunt man, long crimson hair, glowing red eyes, pale skin with dark red vein patterns, tattered ancient crimson robe, red mist rising around the body, menacing smile, three-quarter view, standing, upper body",
  "weapon, gore, horns"),
 ("혈불사도명", "남", "grey mountain temple courtyard, iron cauldron of porridge, red sunset",
  "1boy, solo, leader of the blood sect, elderly monk, bald, calm smile, ash grey kasaya with dark red stains along the hem, long red prayer beads in hand, serene yet sinister, three-quarter view, standing, upper body",
  "weapon, gore"),
 ("무림맹주", "남", "great hall of the martial alliance, huge banners, crowd of martial artists in the distance",
  "1boy, solo, leader of the martial alliance, dignified middle-aged man, neat beard, long black hair with grey streaks, white and gold robe, jian sheathed at the hip, hand on the hilt, solemn heavy gaze, three-quarter view, standing, upper body",
  "curved sword, dao"),
 ("무영", "남", "dark night, black mist, faint moonlight",
  "1boy, solo, first general of the demonic cult, figure whose face is hidden in deep shadow, black hooded robe, only faint red eyes visible, edges of the robe dissolving into shadow, silent menace, three-quarter view, standing, upper body",
  "weapon"),
 ("환면마후", "여", "palace hall with hanging silk, floating porcelain masks",
  "1girl, solo, second general of the demonic cult, beautiful mature woman, long black hair, crimson robe, holding a white porcelain mask near her face, several masks floating around her, enigmatic smile, three-quarter view, standing, upper body",
  "weapon"),
 ("쇄혼도위극", "남", "battlefield at dusk, crimson banners, drifting pale wisps",
  "1boy, solo, fourth general of the demonic cult, middle-aged man, scarred face, grey streaks in black hair, black lacquered robe with crimson trim, heavy dao resting on the shoulder with iron chains wrapped around it, pale ghostly wisps clinging to the blade, cold eyes, three-quarter view, standing, upper body",
  "jian"),
 ("공손야", "남", "hall of the unorthodox alliance, mountains of ledgers, iron abacus, dim lanterns",
  "1boy, solo, lord of the unorthodox alliance, elderly man, grey hair tied back, iron-hard face, black robe with dark red trim, seated behind a desk of ledgers, writing brush in hand, cold calculating eyes, three-quarter view, upper body",
  "weapon"),
 ("무면객", "남", "misty bamboo forest at night",
  "1boy, solo, master of the assassin house, figure wearing a plain white featureless mask, grey robe, hands hidden in the sleeves, unsettling stillness, three-quarter view, standing, upper body",
  "weapon"),
 ("노구산", "남", "under a stone bridge, river, paper lanterns, straw mats",
  "1boy, solo, elder of the beggar sect, old man, messy grey hair, sharp sober eyes, ragged patched clothes, wine gourd at the waist, wooden staff in hand, sly knowing smile, three-quarter view, standing, upper body",
  "sword, blade"),
 ("매화노검", "남", "plum blossom grove on a lonely island, petals on the wind, sea in the background",
  "1boy, solo, legendary old swordsman, long white hair and white beard, kind but sharp eyes, simple white robe, jian sheathed at the hip, hand on the hilt, plum petal on the shoulder, three-quarter view, standing, upper body",
  "curved sword, dao"),
 ("초출사부", "남", "thatched hermitage on a misty mountain, old pine, stone table with tea",
  "1boy, solo, nameless hermit master, old man, grey hair in a topknot, short grey beard, plain faded robe, sitting on a stone with a cup of tea, gentle wise smile, three-quarter view, upper body",
  "weapon"),
]

def run(out, name, seed, char, bg, extra):
    path = os.path.join(out, name)
    if os.path.exists(path + ".png"): return
    subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "gen.py"),
                    path, str(seed), STYLE, char, bg, UC + (", " + extra if extra else "")])
    if os.path.exists(path + ".json"): os.remove(path + ".json")

if __name__ == "__main__":
    out = sys.argv[1]; only = sys.argv[2] if len(sys.argv) > 2 else ""; plus = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    os.makedirs(out, exist_ok=True)
    for key, genders, bg, body, extra in MAIN + SIDE:
        if only and only not in key: continue
        for g in ("남", "녀"):
            if g in genders or (g == "녀" and genders == "여"):
                run(out, f"{key}_{g}", SEED[g] + plus, f"{HERO[g]}, {body}, {POSE}", bg, extra)
    for key, g, bg, body, extra in NPC:
        if only and only not in key: continue
        run(out, key, 9013 + plus, body, bg, extra)
