# 강호행의 인물 그림. NovelAI Diffusion V4.5 Full, Anlas가 들지 않는 조건(832x1216, 28 steps, 한 장씩)만 쓴다.
#   cd art && python3 인물.py 출력폴더 [이름 일부] [시드 덧셈]
# 이미 그린 그림은 건너뛴다. 다시 그리려면 그 파일을 지운다.
import os, subprocess, sys

# 고정 그림체(웹툰 표지, B3에 B2를 섞음). 인물마다 바꾸지 않는다
STYLE = ("manhwa cover art, korean webtoon key visual, murim, wuxia, chinese martial arts, ancient china, traditional chinese clothing, flowing hanfu, "
         "polished digital painting with clean edges, crisp lineart, high contrast, cool cinematic color grading, strong rim light, sharp shadows, "
         "wind, flowing hair and robes, semi-realistic manhwa face, mature handsome face, natural oval face, balanced facial proportions, "
         "natural jawline, defined nose bridge, deep-set sharp eyes, natural eye size, layered robes, detailed background, scenery, atmospheric depth, "
         "1.2::detailed hands, beautiful hands, anatomically correct hands, natural finger placement, five fingers::, "
         "correct anatomy")
# 병기를 든 인물에게만 붙인다. 맨손 인물에게 붙이면 없는 병기가 그려진다
WEAPON = ("1.15::firm grip, fingers wrapped around the handle, detailed weapon, realistic weapon proportions, detailed hilt and guard, "
          "leather-wrapped grip, polished metal, metal reflections, detailed scabbard::")
# 늘 빼는 것(gen.py의 기본 제외에 덧붙음)
UC = ("giant red moon, big red sun behind character, red circle behind head, halo, flat red background, "
      "pointed chin, sharp chin, v-shaped jaw, needle chin, overly sharp jawline, elongated face, long face, narrow face, tiny chin, big eyes, oversized eyes, sleepy eyes, "
      "comical, silly expression, goofy, cartoonish, exaggerated features, cute, moe, childish face, chibi, simple background, pastel colors, photorealistic, 3d, "
      "oversized weapon, giant weapon, weapon too large, stiff pose, awkward pose, unnatural pose, twisted torso, "
      "missing fingers, fused fingers, extra hands, deformed hands, deformed weapon, broken weapon, ugly face, deformed face, "
      "asymmetrical eyes, bad anatomy, ornate weapon, fantasy weapon, multiple weapons, western clothes, fantasy armor, glasses, "
      "bad hands, malformed hands, extra fingers, too many fingers, claw hands, wrong grip, floating weapon, weapon merging with hand, "
      "bent blade, warped blade, blurry weapon, melted metal")
HERO = {"남": "1boy, solo, wuxia protagonist, young man, early twenties, handsome, refined facial features, athletic build, broad shoulders, heroic, charismatic, dignified posture",
        "녀": "1girl, solo, wuxia protagonist, young woman, early twenties, beautiful, elegant refined features, clear bright eyes, slender athletic build, heroic, charismatic, dignified posture"}
POSE = "three-quarter view, standing, contrapposto, looking at viewer, upper body"
SEED = {"남": 7013, "녀": 8013}

# (파일 이름, 성별들, 배경, 인물, 더 뺄 것)
MAIN = [
 ("무림초출", "남녀", "cliff edge above a sea of clouds, distant ink-wash mountain peaks, crooked old pine, small thatched hermitage behind, early morning sun through mist, falling pine needles",
  "disciple who just came down the mountain after ten years with a hermit master, black hair, very long hair, high ponytail tied with a long red ribbon fluttering in the wind, loose strands framing face, dark brown eyes, calm confident half smile, white cross-collar inner robe, dark blue outer robe with silver cloud embroidery on hems and cuffs, black sash knotted at waist, worn leather bracers over cloth wrist wraps, plain cloth bundle tied across back, cloth boots, faint dust on hem, arms crossed over chest, empty hands, unarmed",
  "weapon, sword, holding weapon, sheath, quiver, arrows"),
 ("남궁세가", "남녀", "ruins of a burned chinese noble clan manor at dusk, charred wooden pillars, fallen grey roof tiles, collapsed wooden gate with a scorched plaque, drifting embers, orange sky fading to ash grey",
  "last heir of a fallen sword clan, black hair, long straight hair, half updo held by a silver hair crown, grey eyes, fair skin, noble bearing, white silk inner robe, sky blue outer robe with silver cloud embroidery, torn left sleeve, scorched hem, blue sash with white jade pendant, jian sheathed at left hip in a white jade scabbard, blue tassel hanging from the pommel, right hand resting on the sword hilt, calm resolute gaze, quiet pride",
  "curved sword, dao, drawn sword, western ruins, gothic, spire, cathedral, stone columns"),
 ("하북팽가", "남녀", "courtyard of a ruined clan house at night, broken wooden gate, heavy rain, puddles reflecting red lanterns, stone tiger statue with a cracked head",
  "youngest of five brothers of a saber clan, black hair, long wild ponytail, red headband, amber eyes, fierce eyes, rain-soaked hair, black inner robe, dark orange outer robe with gold tiger embroidery, wide leather belt with bronze tiger head buckle, leather bracers, dao in a black curved scabbard at left hip, red cloth wrapped hilt, small round bronze guard, right hand gripping the hilt ready to draw, left hand holding the scabbard, fierce confident smirk",
  "jian, straight sword, drawn sword, scythe, polearm, long handle"),
 ("표국표사", "남녀", "mountain pass under an overcast sky, row of stone cairns, broken escort cart, torn red escort banner on a leaning pole, wind carrying dust",
  "lone surviving escort guard, black hair, high ponytail tied with red cord, a few loose strands, small scar on cheek, brown eyes, steady confident eyes, dark brown hanfu, brown leather vest, rope belt with a bronze escort agency token, cloth wrist wraps, travel-worn cloak, chinese spear held upright with its butt planted beside the feet, steel spearhead with red horsehair tassel visible above the head, right hand gripping the shaft at shoulder height",
  "sword, flag on weapon, banner on spear, leaves, branch, beard"),
 ("개방제자", "남녀", "under an old stone arch bridge at night, river reflecting paper lanterns",
  "fifth-knot disciple of the beggar sect, black hair, messy hair tied in a short ponytail, smudge of dirt on cheek, bright clever black eyes, patched and frayed pale green robe, rope belt with five knotted cords, bandaged forearms, wine gourd at waist, straw sandals, plain wooden staff planted on the ground, leaning on it with one hand, faint knowing smile, closed mouth, cowboy shot, close view",
  "sword, blade, armor, child, grin, open mouth, teeth, laughing"),
 ("권마계승", "남녀", "rocky canyon at sunset, huge boulders marked with deep fist-shaped craters, cave entrance with a stone seat, red-orange sky, swirling dust",
  "inheritor of a legendary fist master's secret manual, black hair, long wild loose hair, sharp features, crimson eyes with a faint red glow, dark grey sleeveless robe over black inner shirt, dark red sash, muscular forearms with faint visible veins, cloth-wrapped fists, small scars on knuckles, faint red aura around the right fist, right fist clenched in front of chest, left arm relaxed, controlled fury",
  "weapon, sword, holding weapon, staff, gauntlet, metal claws"),
 ("혈지생환", "남녀", "edge of a dried blood pond in a mountain valley, cracked dark earth, ruined stone shrine pillars, grey overcast dusk sky with a faint red glow, crows on dead branches, mist",
  "sole survivor of a sacrificial blood pond, black hair tied back in a low ponytail with loose strands, pale skin, faint dark circles under the eyes, haunted dark eyes with a faint crimson glint, mature calm face, grey cloak with the hood down, black high-collar inner robe, faint red scar-like markings on the palms glowing softly, right hand raised at chest height with palm open, quiet cold expression",
  "weapon, sword, holding weapon, staff, blood, dripping blood, gore, emo, messy short hair, glowing red eyes, hoodie"),
 ("하오문", "남녀", "narrow alley of a night market, tiled rooftops and red lanterns, teahouse signboard, thin mist, moonlight on wet stones",
  "information broker of the back alleys, black hair, long hair in a low ponytail over the shoulder, side bangs, narrow black eyes, faint knowing smile, dark grey hanfu, black hooded cloak with the hood down, leather belt with small pouches and a thin ledger book, cloth wrist wraps, three short steel throwing knives fanned between the fingers of the raised right hand, left hand holding a folded note",
  "sword, long sword, kunai, claws, leaves"),
]

SIDE = [
 ("외전당가", "남녀", "bamboo grove of the tang clan in sichuan, misty herb garden, stone lanterns, faint green mist",
  "direct heir of the sichuan tang poison clan, black hair, neat high ponytail with a jade pin, cold intelligent green eyes, black inner robe, dark green outer robe with silver bamboo embroidery, single black leather glove on the right hand, needle case and small medicine pouches at the belt, three thin steel needles held between gloved fingers, calm calculating expression",
  "sword, spear"),
 ("외전빙궁", "남녀", "frozen northern sea, ice palace of the north sea in the distance, gentle snowfall, pale blue sky",
  "direct disciple of the north sea ice palace, long silver-white hair, ice blue eyes, porcelain skin, white hanfu with pale blue snowflake embroidery, white fur collar, frost clinging to the sleeves, visible cold breath, right palm raised with swirling frost mist, cold serene expression, mature face, sharp elegant features",
  "weapon, sword, holding weapon, halo, ring, cute, blush, round face"),
 ("외전매화", "남녀", "plum blossom trees on the steep cliffs of mount hua, falling plum petals, small thatched hut on a ledge, morning mist",
  "plum blossom swordsman of mount hua and last disciple of a legendary old swordsman, black hair, long hair in a half updo with a plum blossom hairpin, clear determined eyes, white hanfu with pink plum blossom embroidery, pale rose sash, jian sheathed at the left hip in a white scabbard, plum blossom tassel, right hand resting on the hilt, gentle resolute smile",
  "curved sword, dao, drawn sword"),
 ("외전살막", "남녀", "tiled rooftops at night under a full moon, light rain, distant lanterns",
  "assassin bound to the ledger of an assassin house, black hair, short ponytail, sharp emotionless eyes, black close-fitting night clothes, black cloth mask pulled down to the neck, wooden name token hanging from the belt, short dao sheathed at the hip, hand resting on the hilt",
  "jian, long sword"),
 ("외전수로", "남녀", "wide yangtze river at dusk, wooden pirate boats, reeds, mist over the water",
  "heir of a fallen river stronghold, black hair tied back with a cloth band, sun-tanned skin, confident grin, white shirt with rolled sleeves under a dark blue sleeveless vest, red waist sash, coil of rope on the shoulder, long iron-tipped fishing harpoon planted upright beside the body",
  "sword"),
 ("외전혈승", "남녀", "grey mountain road through pines, ruined stone shrine, overcast evening sky, crows, drifting mist",
  "wandering monk of the blood sect, bald, shaved head, calm half-closed eyes, ash grey kasaya, long red prayer beads around the neck, monk staff with iron rings planted on the ground, one hand raised in a prayer gesture, calm stern face, natural skin tone, dark eyes, quiet menacing serenity",
  "sword, hair, smile, red eyes, pale skin, white skin, creepy"),
 ("외전야수", "남녀", "southern jungle, waterfall, giant ferns, a white tiger lying behind",
  "child of the beast palace raised by tigers, wild messy black hair, sun-tanned skin, golden eyes, tiger fur shawl, necklace of bone and fangs, sleeveless brown tunic, cloth wrapped fists, fierce feral stare, closed mouth",
  "weapon, sword, holding weapon"),
 ("외전소림", "남", "closed mountain gate of shaolin temple, stone stairs, old pines, bell tower in morning mist",
  "lay disciple of shaolin temple, short black hair, earnest steady eyes, ochre and brown practice robe, wooden prayer beads at the wrist, plain wooden staff planted on the ground with one hand resting on it, calm determined expression",
  "sword, blade, bald"),
 ("외전무당", "남녀", "stone door of a sealed meditation cave on wudang mountain, misty peaks, old pine",
  "taoist disciple of wudang guarding a sealed door, black hair in a topknot with a wooden hairpin, clear calm eyes, white and light blue taoist robe with taiji embroidery, jian sheathed at the hip, hand resting on the hilt, composed expression",
  "curved sword, dao, drawn sword"),
 ("외전아미", "여", "temple with a golden roof on the misty peak of mount emei, sea of clouds below, stone stairway, morning light",
  "lay disciple of emei escorting a fugitive, black hair, long low ponytail, kind but firm eyes, white and pale grey robe with lotus embroidery, jian sheathed at the hip, one hand on the hilt, other hand holding a torn red sleeve, protective resolute expression",
  "curved sword, dao, drawn sword"),
 ("외전공동", "남녀", "earthen frontier fortress walls, ruins of the great wall, blowing sand, hazy afternoon light",
  "swordsman of kongtong guarding an abandoned frontier fort, black hair tied up, sand-colored headscarf around the neck, face fully visible, sun-tanned skin, steady watchful eyes, sand-colored cloak over a dark robe, red sword cord tied to the hilt, jian sheathed at the hip, hand on the hilt",
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
  "chief of a small bandit stronghold, black hair in a wild ponytail, scar on the chin, fierce confident smirk, sharp eyes, fur vest over rough dark brown clothes, rope belt, heavy iron-studded wooden club resting on the shoulder",
  "sword, blade, white background, cute, open mouth smile"),
 ("외전흑사", "남녀", "smoky gambling den, dice tables, hanging lanterns",
  "gambler of the black snake gang, black hair with side bangs, sly eyes, black robe with gold coin patterns, gold coins held between the fingers, sly smile",
  "sword, spear"),
 ("외전망나니", "남녀", "execution ground in the rain, wooden platform, overcast sky, dim lantern light, muted colors",
  "former executioner hunting the truth, black hair unkempt, tired heavy dark eyes, plain dark grey and black clothes with a dark red sash, long single-edged saber in a worn black scabbard slung across the back, hilt over the right shoulder, arms at the sides, grim tired expression",
  "jian, monochrome, greyscale, blank eyes, white eyes"),
 ("외전청성", "남녀", "pine forest of qingcheng mountain, torn red wedding ribbons on the branches",
  "disciple of qingcheng who guarded a broken wedding, black hair in a long ponytail, gentle firm eyes, green robe with pine needle embroidery, red ribbon tied on the wrist, jian sheathed at the hip, hand on the hilt, resolute expression",
  "curved sword, dao, drawn sword"),
 ("외전종남", "남녀", "village at the foot of zhongnan mountain under a cloudy sky, golden wheat fields, straw-roofed houses, mountain behind",
  "outer hall swordsman of zhongnan paying off a debt, black hair in a simple topknot, honest eyes, plain brown hanfu, worn sword sheathed at the hip, folded debt document in one hand, steady expression",
  "curved sword, dao, drawn sword"),
 ("외전신교", "남녀", "village of the heavenly demon cult, crimson banners, dark sky",
  "young blade of the heavenly demon cult, long black hair, red eyes, cold ambitious gaze, black and crimson robe with red sleeves, heavy dao sheathed at the hip, hand on the hilt, pale wisps drifting around the scabbard",
  "jian"),
 ("외전홍수", "남녀", "night banquet hall in luoyang, red lanterns, silk curtains",
  "agent of the red sleeves of the demonic cult, black hair in an elegant topknot, alluring sharp eyes, crimson robe with very long red sleeves, thin steel needles glinting from the cuff, folding fan in the other hand, enigmatic smile",
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
 ("외전사공", "남녀", "yellow river ferry crossing at dusk, muddy rushing water, wooden ferry boats, tall loess cliffs, drifting mist",
  "ferryman of the yellow river, black hair tied back, sun-tanned skin, straw hat hanging on the back, rolled up trousers, long bamboo punting pole planted upright, calm sharp eyes, faint smile, weathered strong hands",
  "sword, blade, white background, messy spiky hair"),
 ("외전위소", "남녀", "ruins of a coastal fortress, broken walls, stormy sea, tattered banner",
  "child of a fallen coastal garrison, black hair in a topknot with red cord, determined eyes, worn military padded coat over a dark robe, red tasseled spear held upright, spearhead visible, stern expression",
  "sword"),
]

# (파일 이름, 성별, 배경, 인물, 더 뺄 것). 주요 인물은 시드 9013
NPC = [
 ("천마", "남", "summit of the heavenly demon peak above a sea of storm clouds, dark night sky with crimson lightning, far below a vast army of kneeling cultists with crimson banners, falling snow",
  "1boy, solo, the heavenly demon, ruler of the demonic cult, ageless man who looks in his thirties, overwhelmingly handsome, cold majestic face, long black hair billowing in the wind, glowing crimson eyes, black and crimson imperial robe with gold dragon embroidery flowing in the wind, black jade crown, seated on a black stone throne carved with dragons, cowboy shot, the figure filling the frame, sitting upright with both hands resting on the armrests, back straight, head slightly raised, black flame aura rising like smoke, overwhelming godlike presence, looking down at viewer, low angle, from below, dramatic lighting, majestic, cowboy shot",
  "weapon, holding weapon, sword, horns, smile, hand on chin, hand on face, slouching"),
 ("혈마", "남", "vast underground temple of the blood sect, a still lake of dark blood, red mist drifting low over the surface, ancient carved stone pillars, grey-robed cultists prostrating far in the background, dim crimson light",
  "1boy, solo, the founder of the blood sect revived in a pool of blood, tall imposing man who looks in his forties, cold sharp handsome face, long straight dark crimson hair falling loose past the shoulders, deep red eyes with a faint glow, pale skin, thin dark red veins faintly visible on the neck and hands, dark crimson robe over a black inner robe with faded gold patterns, wide sleeves, standing tall on a black stone altar at the edge of the blood lake, body turned slightly, one hand behind his back, the other hand raised at chest height with a thin thread of blood mist curling from the fingertips, robe and hair stirred by a faint wind, dark red qi aura shimmering around the shoulders, cold contemptuous gaze down at viewer, calm terrifying majesty, three-quarter view, low angle, dramatic red rim light, cowboy shot",
  "weapon, holding weapon, staff, gore, horns, crown, floating hair, smile, open mouth, fangs, exaggerated, skull"),
 ("혈불사도명", "남", "grey mountain temple courtyard at dusk, iron cauldron of porridge steaming, rows of starving people kneeling, grey sky, incense smoke",
  "1boy, solo, leader of the blood sect, elderly monk, bald, deep lines on the face, gaunt dignified face, thin lips, faint merciful expression with cold half-lidded eyes, ash grey kasaya with dark red stains along the hem, long red prayer beads wrapped around the hand, standing before the cauldron, serene yet sinister, dramatic backlight, three-quarter view, cowboy shot",
  "weapon, holding weapon, staff, gore, smile, grin, smiling, open mouth, teeth, goofy"),
 ("무림맹주", "남", "great hall of the martial alliance, huge banners of the nine sects and five clans, rows of martial artists standing in formation, shafts of light from high windows",
  "1boy, solo, leader of the martial alliance, dignified middle-aged man, neat black beard with grey streaks, long black hair tied with a gold crown, white and gold robe with cloud embroidery, jian sheathed at the hip, left hand on the scabbard, right hand resting on the hilt, solemn heavy gaze, last pillar of the orthodox world, low angle, dramatic lighting, cowboy shot",
  "curved sword, dao"),
 ("무영", "남", "rooftops at midnight, black mist pouring like smoke, a thin crescent moon",
  "1boy, solo, first general of the demonic cult, assassin, man in his thirties, pale expressionless handsome face half hidden by a black cloth mask over the mouth and nose, cold narrow black eyes, black hair tied back, black hooded robe with the hood down, edges of the robe dissolving into black mist, a thin black blade held low in a reverse grip, silent menace, dramatic shadows, cowboy shot",
  "smile"),
 ("환면마후", "여", "palace hall of hanging crimson silk, dozens of white porcelain masks floating in the air, candlelight",
  "1girl, solo, second general of the demonic cult, beautiful dangerous mature woman, long black hair adorned with gold hairpins, crimson robe with gold phoenix embroidery, holding a white porcelain mask beside her face, masks floating around her, enigmatic smile, half of her face in shadow, dramatic lighting, cowboy shot",
  "weapon, holding weapon, staff, sword"),
 ("쇄혼도위극", "남", "battlefield at dusk, broken crimson banners, smoke, pale wisps of countless souls drifting",
  "1boy, solo, fourth general of the demonic cult, middle-aged warrior, scarred face, grey streaks in black hair tied back, black lacquered robe with crimson trim, a heavy dao resting on the shoulder with iron chains wrapped around the scabbard, pale ghostly faces swirling around the blade, cold eyes, imposing, low angle, cowboy shot",
  "jian"),
 ("공손야", "남", "hall of the unorthodox alliance, mountains of ledgers stacked to the ceiling, iron abacus, dim lanterns, kneeling debtors in the shadows",
  "1boy, solo, lord of the unorthodox alliance, elderly man, grey hair tied back, iron-hard face, black robe with dark red trim, seated behind a massive desk of ledgers, writing brush in hand, cold calculating eyes looking up at viewer, oppressive presence, dramatic lighting, cowboy shot",
  "weapon, holding weapon, sword"),
 ("무면객", "남", "misty bamboo forest at night, moonlight through the leaves",
  "1boy, solo, master of the assassin house, figure wearing a plain white featureless mask, grey robe, hands hidden in the sleeves, a single thin needle visible between two fingers, unsettling stillness, mist curling around the feet, dramatic shadows, cowboy shot",
  "smile"),
 ("노구산", "남", "under a stone bridge at night, river reflecting paper lanterns, hundreds of beggars gathered in the dark",
  "1boy, solo, acting head of the beggar sect, old man, messy grey hair, sharp sober eyes that miss nothing, ragged patched clothes, wine gourd at the waist, wooden staff planted on the ground, sly knowing smile, warm lantern light on the face, cowboy shot",
  "sword, blade"),
 ("매화노검", "남", "plum blossom grove on a lonely island, storm of petals on the wind, sea in the background",
  "1boy, solo, legendary old swordsman once among the ten greatest masters, long white hair and white beard flowing in the wind, kind but piercing eyes, simple white robe, jian sheathed at the hip, hand resting on the hilt, plum petals swirling around him, serene overwhelming presence, cowboy shot",
  "curved sword, dao"),
 ("초출사부", "남", "thatched hermitage on a misty mountain at dawn, ancient pine, stone table with tea",
  "1boy, solo, nameless hermit master at the peak of mastery, old man, grey hair in a topknot, short grey beard, plain faded robe, sitting on a stone with a cup of tea, gentle wise smile, sharp eyes, a single leaf hovering above his finger, quiet depth, cowboy shot",
  "weapon, holding weapon, sword, staff"),
]

# 고른 시드(파일 이름: 시드). 없으면 기본 시드를 쓴다
PICK = {
    "개방제자_남": 7021,
    "개방제자_녀": 7020,
    "공손야": 7021,
    "권마계승_남": 7020,
    "권마계승_녀": 7021,
    "노구산": 7021,
    "매화노검": 7021,
    "무림초출_남": 7020,
    "무영": 9018,
    "쇄혼도위극": 7021,
    "외전곤륜_녀": 7021,
    "외전공동_남": 9017,
    "외전광부_남": 7021,
    "외전귀문_녀": 7020,
    "외전녹림_남": 7020,
    "외전당가_녀": 7021,
    "외전망나니_남": 7021,
    "외전망나니_녀": 7021,
    "외전매화_남": 7020,
    "외전모용_남": 7021,
    "외전모용_녀": 7021,
    "외전빙궁_남": 7020,
    "외전빙궁_녀": 8014,
    "외전사도련_남": 7021,
    "외전사도련_녀": 7021,
    "외전살막_남": 7021,
    "외전살막_녀": 7021,
    "외전소림_남": 7020,
    "외전수로_남": 7021,
    "외전신교_남": 7021,
    "외전신교_녀": 7021,
    "외전아미_녀": 7021,
    "외전야수_남": 7021,
    "외전야수_녀": 7021,
    "외전위소_남": 7021,
    "외전위소_녀": 7021,
    "외전점창_녀": 7021,
    "외전종남_남": 7021,
    "외전청성_남": 7020,
    "외전혈승_남": 9018,
    "외전혈승_녀": 9016,
    "외전홍수_남": 7021,
    "외전홍수_녀": 7021,
    "외전흑사_남": 7021,
    "천마": 9017,
    "초출사부": 7021,
    "하북팽가_남": 7021,
    "하오문_남": 7021,
    "하오문_녀": 7020,
    "혈마": 7021,
    "혈불사도명": 9018,
    "혈지생환_남": 9018,
    "혈지생환_녀": 9016,
    "환면마후": 7021,
}

def entries():
    for key, genders, bg, body, extra in MAIN + SIDE:
        for g in ("남", "녀"):
            if g in genders or (g == "녀" and genders == "여"):
                yield f"{key}_{g}", SEED[g], f"{HERO[g]}, {body}, {POSE}", bg, extra
    for key, g, bg, body, extra in NPC:
        yield key, 9013, body, bg, extra

# 바늘, 동전, 비도, 소매 쇠뇌처럼 작은 암기를 쓰는 인물. 병기 강조를 붙이면 긴 병기가 그려진다
SMALL = ("외전당가", "외전흑사", "외전홍수", "외전제갈", "하오문")

def run(path, seed, char, bg, extra):
    small = any(os.path.basename(path).startswith(k) for k in SMALL)
    if small: extra = (extra + ", " if extra else "") + "long weapon, staff, polearm, spear, sword, club"
    elif "holding weapon" not in extra: char = f"{char}, {WEAPON}"
    if os.path.exists(path + ".png"): return
    subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "gen.py"),
                    path, str(seed), STYLE, char, bg, UC + (", " + extra if extra else "")])
    if os.path.exists(path + ".json"): os.remove(path + ".json")

if __name__ == "__main__":
    # 고른 그림 전부: python3 인물.py 출력폴더 [이름 일부]
    # 후보 여럿:     python3 인물.py 출력폴더 이름 시드 시드 ...   (파일은 이름_시드.png)
    out = sys.argv[1]; only = sys.argv[2] if len(sys.argv) > 2 else ""; seeds = [int(x) for x in sys.argv[3:]]
    os.makedirs(out, exist_ok=True)
    for name, seed, char, bg, extra in entries():
        if only and only not in name: continue
        if seeds:
            for sd in seeds: run(os.path.join(out, f"{name}_{sd}"), sd, char, bg, extra)
        else:
            run(os.path.join(out, name), PICK.get(name, seed), char, bg, extra)
