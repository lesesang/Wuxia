# 강호행의 조연(적, 동료, 말만 하는 사람, 짐승)과 사건 배경 그림. 인물.py와 같은 그림체를 쓴다.
# NovelAI Diffusion V4.5 Full, Anlas가 들지 않는 조건(832x1216 또는 1216x832, 28 steps, 한 장씩)만 쓴다.
#   cd art && python3 조연.py 출력폴더 [이름 일부] [시드 ...]
# 시드를 주면 이름_시드.png로 후보를 여럿 뽑고, 주지 않으면 PICK이나 기본 시드로 한 장씩 뽑는다.
import os, subprocess, sys
from 인물 import STYLE, WEAPON, UC

# 짐승과 영물: 사람 얼굴과 손 태그를 빼고 같은 채색을 쓴다
BEAST = ("manhwa cover art, korean webtoon key visual, wuxia, ancient china, polished digital painting with clean edges, crisp lineart, "
         "high contrast, cool cinematic color grading, strong rim light, sharp shadows, wind, detailed background, scenery, atmospheric depth, "
         "no humans, animal focus, majestic creature, detailed fur and scales, realistic animal anatomy, powerful presence")
# 사건 배경: 사람 없이 장소만
SCENE = ("korean webtoon background art, anime style background, illustration, manhwa key visual, murim, wuxia, ancient china, "
         "traditional chinese architecture, intricate details, polished digital painting with clean edges, crisp lineart, "
         "cinematic lighting, volumetric light, rich colors, atmospheric depth, wide shot, establishing shot, scenery, no humans, highly detailed background")
UC_PERSON = "monochrome, greyscale, faceless, blank face, crowd"
UC_BEAST = "photorealistic, photo, 3d, human, 1boy, 1girl, person, rider, cute, chibi, cartoon animal, deformed animal, extra legs, extra heads, extra tails, fused limbs"
UC_SCENE = "photorealistic, photo, 3d render, realistic, people, person, human, character, 1boy, 1girl, crowd, face, text, signature, modern building, car, power lines, western castle"

POSE = "three-quarter view, looking at viewer, cowboy shot"
SEX = {"남": "1boy, solo", "녀": "1girl, solo", "무리": "multiple boys, group, a leader standing in front, several followers behind him"}
ALL = []

def P(key, sex, look, bg, kind="무", extra=""):
    """사람. kind: 무(병기를 듦), 맨(맨손), 작(작은 암기나 도구)"""
    ALL.append((key, "인", f"{SEX[sex]}, {look}, {POSE}", bg, kind, extra))

def B(key, look, bg, extra=""):
    ALL.append((key, "수", f"{look}", bg, "수", extra))

def S(key, look, extra=""):
    ALL.append((key, "배", look, "", "배", extra))

# ---------------------------------------------------------------- 1장의 길(이류, 일류)
P("산적", "무리", "mountain bandits, ragged hemp clothes, headbands, unkempt beards, the leader holding a rusty single-edged saber, greedy grins", "narrow mountain pass ambush, rocks and twisted pines, dusty afternoon")
P("낭인", "남", "wandering ronin swordsman for hire, thirties, stubble, tired cold eyes, faded grey travel robe, straw rain cape, worn saber in a battered scabbard at the hip, hand resting on the hilt", "rainy crossroads with a broken wayside shrine, misty fields")
P("흑풍채두목", "남", "bandit chief called one-eyed saber, forties, black eyepatch over the left eye, thick beard, scarred muscular arms, black fur vest, heavy broad axe resting on the shoulder, cruel smirk", "mountain bandit fortress gate, wooden palisade, black banners, torchlight at dusk")
P("녹림호걸", "남", "greenwood outlaw with his own code of honor, thirties, rugged handsome face, headband, sleeveless dark green tunic, rope belt, heavy saber held low, bold confident grin", "pine forest trail, sunlight through trees")
P("사파자객", "녀", "unorthodox sect assassin woman, black hair in a tight bun, cold narrow eyes, black fitted clothes, dark face veil lowered under the chin, short twin daggers in reverse grip", "moonlit tiled rooftops, night mist", "작")
P("사이비도사", "남", "fake taoist charlatan, fifties, thin mustache, shifty eyes, shabby yellow taoist robe, paper talismans in one hand, gourd at the waist, sly smile", "village square at dusk, incense stand, curious crowd far behind", "작", "sword")
P("배신표사", "남", "treacherous escort guard, thirties, greedy eyes, brown escort uniform with a torn agency badge, spear held across the body, nervous sneer", "abandoned escort cart on a mountain road, scattered cargo boxes")
P("세가공자", "무리", "spoiled son of a local landlord in silk brocade robe with a folding fan in front, arrogant smirk, thugs in black behind him holding clubs", "busy town street, shop signs, onlookers")
P("혈단중독자", "남", "young laborer under a blood pact, twenties, bare muscular arms, glowing red seal mark on the palm, bloodshot eyes, torn hemp clothes, wild hair", "dim village alley at night, red lanterns", "맨", "weapon")
P("마단장정", "남", "village strongman burning with a dark flame, twenties, black flames visible under the skin like veins, smoke rising from the shoulders, torn sleeveless shirt, clenched fists, pained fierce face", "burning barn at night, sparks", "맨", "weapon")
P("잠화표사", "남", "escort guard with a hidden fire inside, thirties, calm face with faintly glowing ember-colored eyes, neat brown escort uniform, saber at the hip, faint dark glow under the belly", "inn courtyard at dusk, escort carts")

# ---------------------------------------------------------------- 2, 3장의 길
P("귀도객", "남", "assassin swordsman called ghost blade, pale gaunt face, long messy black hair over one eye, black robe, long thin saber held low, emotionless stare", "foggy graveyard at dusk, leaning tombstones")
P("금의위밀정", "남", "imperial embroidered uniform guard spy, thirties, sharp eyes, red and gold flying-fish embroidered robe, black gauze official hat, narrow spring saber at the hip", "palace corridor with red pillars, lanterns")
P("수적두목", "남", "yangtze river pirate chief called water ghost, forties, sun-burned skin, wet hair tied back, tattoos of waves on the arms, open vest, harpoon spear in hand", "pirate boat on a wide river at stormy dusk")
P("독고객", "남", "lone poison wanderer, thirties, sallow skin, dark lips, wide straw hat, grey travel cloak, small poison vials on the belt, thin sword in a plain scabbard", "withered swamp forest, green mist", "작")
P("장강수적", "남", "elite river raider with twin axes, thirties, broad shoulders, sleeveless black vest, two hand axes held at the sides, fierce grin", "riverside granary on fire at night, boats")
P("녹림채주", "남", "chief of one of the seventy-two greenwood strongholds, forties, burly, thick beard, brown fur cloak, huge saber planted beside him", "mountain stronghold hall with tiger skins, torches")
P("종남검수", "남", "proud zhongnan sect swordsman, twenties, handsome stern face, topknot, dark blue zhongnan robes, straight jian held at the side, arrogant gaze", "zhongnan mountain stone steps, pines, morning mist")
P("혈교혈승", "남", "blood sect monk, forties, shaved head, red prayer beads, ash grey kasaya with dark red stains, iron monk staff, calm menacing eyes", "ruined mountain temple at red sunset, crows")
P("혈교혈사", "남", "blood sect zealot, thirties, shaved head with red ink scriptures written on the scalp, ash grey robe, saber in hand, chanting with fanatic eyes", "mountain road at dusk, blood sect banners")
P("동창번자", "남", "eastern depot agent serving the palace eunuchs, thirties, pale smooth face, brown official uniform with a black hat, thin saber, cold sneer", "government office courtyard at night, lanterns")
P("남만술사", "남", "southern miao tribe beast palace shaman, fifties, dark skin, heavy silver horn-shaped headdress and silver neck rings, indigo batik robes, tribal face paint, carved staff with a snake coiled on it, insects swarming around", "steaming southern jungle with giant trees, poisonous fog", "작")
P("독문고수", "남", "five poisons sect elder, sixties, long straight white hair, pale skin, green-black robe, long fingernails tinted green, venom dripping from fingertips, cruel smile", "jungle temple with snakes on the stones", "맨", "weapon, snakes in hair, medusa")
P("철혈대원", "남", "elite iron blood corps soldier of a regional army, thirties, heavy lamellar armor, iron helmet, long glaive, stern face", "military checkpoint on a highway, banners, dust")
P("절정고수", "남", "wandering swordsman selling his name, late twenties, handsome confident face, long hair tied loosely, white travel robe with a blue sash, jian in hand, faint smirk", "inn rooftop at sunset")
P("혈교수련자", "남", "blood cultivating monk with red eyes, thirties, shaved head, glowing red eyes, ash grey robe, prayer beads, red mist around the hands", "blood-stained stone meditation cave", "맨", "weapon")
P("세가호위", "남", "a guard captain of a noble clan searching for a runaway young lady, thirties, stern dutiful face, short beard, dark blue clan uniform with an embroidered crest, saber at the hip, hand on the hilt", "riverside town road at dusk, other guards blurred far behind")
P("점창제자", "남", "young diancang sect swordsman, late teens, eager face, light blue robes, thin fast sword held ready", "cangshan mountain with clouds, erhai lake far below")
P("살막살수", "남", "killer of the assassin house, black mask covering the whole face except cold eyes, black fitted clothes, thin black blade", "dark rooftops under a crescent moon")
P("세가무사", "남", "captain of the iron sword corps of the five great clans, late twenties, disciplined proud face, topknot with a silver crown, polished dark blue uniform with clan crest, straight sword held point down in both hands", "clan manor gate with stone lions")
P("철봉승", "남", "wandering mendicant monk with an iron club, forties, shaved head, thick eyebrows, patched brown robe, iron staff resting on the shoulder, hungry grin", "rural temple gate, autumn leaves")
P("젊은협객", "남", "young righteous hero, twenties, earnest brave face, white and blue robes, jian drawn, standing firm despite fear", "village gate at dawn")
P("현상금꾼", "남", "bounty hunter, thirties, rough stubbled face, scar over the eyebrow, leather vest over a dark cloth robe, iron chain coiled on the shoulder, saber at the hip, holding a crumpled wanted notice", "inn wall covered with paper notices, lanterns")
P("이름사냥꾼", "남", "young swordsman hungry for fame, early twenties, cocky overconfident face, brand new cheap white robe, sword drawn and pointed forward", "town square with onlookers blurred")
P("무명사냥꾼", "남", "thug who preys on unknown wanderers, thirties, sneering face, missing tooth, dirty brown clothes, wooden club studded with nails on the shoulder", "muddy back road at dusk")
P("수로채졸", "남", "river bandit, twenties, sun-burned face, wet hair under a cloth headband, sleeveless wet tunic, short hooked spear", "reedy riverbank at dawn mist, small boats")
P("흑사방향주", "남", "black snake gang hall master who runs gambling and smuggling, forties, slick hair, gold teeth, black silk robe with a snake pattern, twin sabers crossed on the back, dice in hand", "smoky gambling den with lanterns")
P("비무청성", "남", "qingcheng sect swordsman in a tournament, twenties, calm polite face, light green taoist robes, slender sword held in salute", "tournament stage at mount tai, banners, spectators blurred")
P("비무철권", "남", "iron fist king, thirties, huge muscular body, shaved head, bare torso with iron bracers, fists raised", "tournament stage at mount tai, banners", "맨", "weapon")
P("비무결승", "남", "the crimson-clad young master, twenties, beautiful cold face, long black hair, flowing crimson robe, slender sword dripping, chilling smile", "tournament stage at mount tai at sunset, blood on the stone")
P("조각무인", "남", "wandering martial artist clutching a torn manual page, thirties, haggard obsessive eyes, shabby robe, sword at the hip, torn page in the other hand", "ruined library cave with scattered scrolls")
P("무명노인", "남", "nameless old master testing a disciple, eighties, long white hair and beard blowing in the wind, plain worn grey robe, barefoot, holding a bamboo stick, mild amused eyes, overwhelming calm presence", "mountain cliff edge above a sea of clouds", "작", "sword, metal sword")
P("묘지기", "남", "old bodyguard who kept a dead hero's last words, seventies, white beard, weathered calm face, black robe, old saber across the knees, sitting before a grave", "lonely grave on a hill under an old tree, autumn")
P("십팔동인", "남", "one of the eighteen bronze men of shaolin, shaved head, whole body painted bronze like a statue, bare muscular torso, calm expressionless face, fists raised in a guard stance", "shaolin temple courtyard with stone floor and bronze statues", "맨", "weapon")
P("무당진인", "남", "wudang taoist master who parries swords with a twig, seventies, long white beard, serene smile, grey taoist robe, holding a pine twig like a sword", "wudang mountain pavilion in clouds", "작", "sword, metal sword")
P("화산장로", "남", "mount hua elder swordsman, sixties, grey beard, plum blossom embroidered robes, sword held vertically", "mount hua cliff path with plum trees")
P("아미사태", "녀", "emei buddhist nun swordswoman, fifties, shaved head under a grey nun cap, compassionate stern face, grey robes, sword held in prayer stance", "golden roof temple on emei peak in clouds", "무", "hair")
P("개방십걸", "남", "one of the ten heroes of the beggar sect, forties, messy hair tied with a rag, ruddy cheerful drunken face, stubble, patched green and brown clothes with knotted cords at the waist, wine gourd in one hand, bamboo staff on the shoulder, lazy grin", "under a stone bridge with lanterns")
P("당가배신자", "남", "traitor of the tang clan who once taught throwing knives, fifties, thin mustache, cold eyes, dark green tang clan robe, flying knives between fingers", "bamboo forest in sichuan mist", "작")
P("곤륜역도", "남", "kunlun sect uncle who fled with a secret manual, sixties, gaunt face, white hair, white kunlun robe torn by blizzards, old sword, scroll case on the back", "kunlun snow pass in a blizzard")
P("하오문주", "녀", "head of the information network of the lowly, old woman in her seventies, wrinkled sly face, grey hair in a bun, plain dark robe, many letters and a smoking pipe", "back room of a teahouse full of scroll shelves", "작", "sword")

# ---------------------------------------------------------------- 3, 4장과 정마대전
P("마교장로", "남", "demonic cult elder called gloomy wind lord, seventies, gaunt human face with deep wrinkles, sunken cold eyes, long grey hair and thin grey beard, black and crimson robe, dark wind swirling around, thin old human hands", "black mountain fortress of the demonic cult, crimson banners", "맨", "weapon, skeleton, skull, bone hands, undead")
P("혈마대귀", "남", "blood demon corps captain, thirties, pale skin with crimson veins, red armor pieces over black clothes, saber, fearless deathly eyes", "battlefield at dusk, smoke")
P("십이마장", "남", "fifth demon general called mountain crusher, forties, giant muscular body, bald head, crimson war paint, black heavy armor, enormous iron mace", "shattered fortress wall, crimson banners")
P("십이마장귀곡", "남", "seventh demon general ghost valley master who controls living puppets, fifties, sunken eyes, long black robe, silver threads from his fingers to puppet-like figures in the dark", "misty valley with hanging lanterns", "작", "sword")
P("혈수라", "남", "third demon general blood asura, thirties, wild red hair, many scars over a muscular bare torso, crazed grin, twin sabers dripping", "burning battlefield at night")
P("천마친위대", "남", "commander of the heavenly demon's guard called stone-faced ghost, forties, expressionless face like stone, full black armor with crimson trim, long halberd", "black stone gate of the heavenly demon peak, snow")
P("무림맹추격대", "남", "wind-breaking sword of the alliance pursuit squad, thirties, stern righteous face, white and blue alliance uniform, sword drawn", "forest road at dawn")
P("혈수인", "남", "master of the red handprint, hooded figure, pale hand stained with blood red, face half hidden in shadow", "burned manor courtyard with red handprints on the walls", "맨", "weapon")
P("마교심판자", "남", "black punishment judge of the demonic cult, sixties, gaunt face, black judge robe, iron ledger in one hand, iron brush pen in the other", "edge of a blood lake in an underground cavern", "작")
P("권마의그림자", "남", "shadowy will of an ancient fist demon, translucent dark figure of a powerful old man, glowing eyes, bandaged fists, ink-like aura", "ancient stone cave with fist craters on the walls", "맨", "weapon")
P("생사문지기", "남", "ancient master who became the gate itself, half stone half man, long white hair, closed eyes, robes merging into a stone gate", "giant ancient stone gate in clouds", "맨", "weapon")
P("전대천마잔영", "남", "shadow of the heavenly demon from a hundred years ago, young man in his twenties, cold beautiful face, long black hair, black robe with crimson trim, transparent ghostly edges, black aura", "secluded cave of seclusion with carved walls", "맨", "weapon")
P("혈마미완", "남", "withered blood demon awakened without enough blood, gaunt tall figure, skin cracked like dry bark, long dark red hair, tattered crimson robe, red mist", "dried cracked blood lake bed in an underground temple", "맨", "weapon, crown")
P("화경마인", "남", "left guardian of the blood sect, red-haired demon, fifties, wild red hair loose, inhuman cold eyes, ash grey robe with crimson trim, saber", "blood sect mountain altar at red dusk")
P("혈교우호법", "남", "right guardian of the blood sect, needle of blood, fifties, thin face, long thin mustache, ash grey robe, blood red needles between fingers", "blood sect cavern with red candles", "작")
P("혈교혈위대", "남", "blood guard of the blood sect, thirties, shaved head, red scripture tattoos on the neck, ash grey robe, saber held in both hands, chanting with half-closed eyes", "blood sect cave temple with red candles")
P("연단마군", "남", "demonic cult elder of the furnace hall, seventies, bald with burn scars, black flames dancing on the shoulders, black robe, standing before a giant bronze furnace", "furnace hall with a huge glowing cauldron", "맨", "weapon")
P("겁화대마졸", "남", "calamity fire corps warrior, thirties, black flame aura around the body, black armor with burning red cracks, saber", "battlefield at night with black flames")
P("겁화대주", "남", "captain of the calamity fire corps, forties, three burning embers visible on the belly, black heavy armor, dark flaming saber, calm eyes", "black fire battlefield")
P("잠화무인", "남", "alliance warrior with hidden fire inside, thirties, alliance uniform, dazed eyes with ember glow, sword dripping, faint dark glow from the belly", "alliance camp at night, burning tent")
P("잠화당주", "남", "black wind hall master of the unorthodox alliance, forties, cold calculating smile, black robe, abacus at the waist, thin sword", "dark office with ledgers and candles")
P("잠화장로", "남", "demonic cult elder who plants hidden fire, sixties, gentle scholarly face, white beard, plain white robe hiding black embers in his palm", "elegant meeting hall with tea tables", "맨", "weapon")
P("사도련향주", "남", "district master of the unorthodox alliance called blade mark, forties, scarred face, black robe with crimson lining, broad saber", "warehouse on a dock at night")
P("사도련고수", "남", "mercenary of the black hand squad of the unorthodox alliance, thirties, black cloth mask over the lower face, cold eyes, black clothes, saber", "back alley at night")
P("북해고수", "녀", "young lady master of the north sea ice palace called snow spirit, twenties, silver white hair, ice blue eyes, white fur cloak, ice sword", "frozen ice palace gate, blizzard")
P("구파협객", "남", "white-clad sword of the nine sects, thirties, noble handsome face, white robes, sword drawn, righteous anger", "mountain road with nine sect banners")
P("나한승", "남", "shaolin warrior monk sent to subdue demons, thirties, shaved head, brown robes, iron staff, solemn face", "shaolin gate in morning mist")
P("정파명숙", "남", "great elder of the orthodox sects called mount tai sword, seventies, long white beard, dignified face, grey robe, heavy sword", "mount tai summit in clouds")
P("맹주호법", "남", "twin wall sword, guardian of the alliance leader, forties, stern face, white alliance robe with gold trim, two swords", "alliance hall with banners")
P("마교척살조", "녀", "crimson sleeve assassin of the demonic cult, twenties, cold beautiful face, black hair in a tight bun, black robe with long crimson sleeves, curved blade held low", "rooftops at night under a red moon")
P("사파복수귀", "남", "vengeful unorthodox fighter called poison arm, thirties, one arm wrapped in black bandages, hateful eyes, flying knives", "funeral ground with white banners", "작")
P("마교암살귀", "남", "silent ghost assassin of the demonic cult, thin man in black, cloth over the mouth, dead eyes, thin blade", "alliance command tent at night")
P("천마사냥개", "남", "nine-blood demon hound, tracker of the heavenly demon, forties, beast-like face, sniffing, chain whip, fur collar over black armor", "snowy forest at night with blood trail")
P("포도대장", "남", "constable captain called iron claw, middle-aged man in his forties, weathered square face, thick short beard, crow's feet, dark red constable uniform with black trim, black official hat, iron gauntlet with hooked claws on the right hand, stern glare", "magistrate office courtyard")
P("동창추포대", "남", "arrest officer of the eastern depot, thirties, pale cruel face, brown official uniform, black hat, iron chain whip", "town gate at night with lanterns")
P("맹집법사", "남", "iron-faced judge of the martial alliance, middle-aged man in his fifties, stern square face with deep frown lines, greying short beard, black judge robe with silver trim, iron ruler tucked in the belt, sword held point down", "alliance court hall")
P("천하도전자", "남", "challenger who only duels famous masters, thirties, lean face, single saber, white headband, cold confidence", "cliff top at dawn")
P("십대고수", "남", "unmoving sword, one of the ten great masters, middle-aged man in his fifties, calm weathered face, neat greying beard, grey hair tied up, heavy calm presence, plain grey robe, both hands resting on the pommel of a sword planted point down", "mountain pavilion in rain")
P("강호승냥이", "남", "jackal who preys on the weak in wartime, forties, hungry grin, ragged armor scraps over dirty clothes, notched saber", "burned village with smoke")
P("귀문술사", "남", "bone monk of the ghost gate sect, old man in his sixties, gaunt hollow-cheeked human face with sunken eyes, shaved head, grey robes, spear with a shaft woven of bones, ghost fires", "graveyard with blue ghost lanterns", "무", "skull, skull face, skeleton")
P("호교대", "남", "nameless devotee of the demonic cult guard, twenties, fanatic eyes, black robe, crimson sash, long spear", "demonic cult temple stairs with crimson banners")
P("혈마귀졸", "남", "soldier of the blood demon corps, twenties, pale skin with faint red veins, dead calm eyes, red lacquered armor pieces over black clothes, saber", "blood red battlefield with smoke")
P("떠돌이패", "남", "mercenary of the black wolf band, thirties, scarred face, wolf pelt over the shoulders, worn leather armor, saber", "war-torn road with broken carts")
P("맹순찰조", "남", "patrol warrior of the martial alliance, twenties, upright serious face, white and blue alliance uniform, straight sword at the hip, holding an alliance token", "highway checkpoint with alliance banners")
P("적면마", "남", "red-faced old demon, old man in his seventies, ruddy dark red complexion, deep wrinkles, wild white hair and beard, black robe, both hands lowered at the sides with long nails, cruel grin", "battlefield after the battle, crows", "맨", "weapon, hand on face, covering face")
P("옛무인그림자", "남", "silent shadow of an ancient master, translucent figure in old robes, face hidden, only the tip of a sword visible", "stone chamber on a mountain ridge")
P("십이마장백골", "남", "sixth demon general white bone spear demon, middle-aged man in his fifties, pale gaunt human face with a thin beard, bone ornaments, black armor, long spear with skulls threaded", "barren field with bone formations", "무", "skull face, skull mask, skeleton")
P("십이마장흑풍", "남", "eighth demon general black wind eagle, forties, sharp hawk-like face, black feathered cloak, claw gauntlets, hovering in the air", "stormy sky over cliffs", "맨", "weapon")
P("십이마장소면", "남", "twelfth demon general smiling buddha, thirties, shaved head, always smiling with closed eyes, black monk robe, prayer beads, creepy calm", "ruined temple at dusk", "맨", "weapon")

# ---------------------------------------------------------------- 사문의 장로와 외전의 상대
P("종남장로", "남", "zhongnan elder called supreme sword, sixties, straight posture, grey beard, dark blue robe, sword thrust forward", "zhongnan peak")
P("점창장로", "남", "diancang elder called fast hand sword, old man in his sixties, grey hair and grey beard, wrinkles, lean sharp face, light blue robe, thin sword", "cangshan cliffs")
P("청성장로", "남", "qingcheng elder pine wind taoist, old man in his sixties, long grey beard, wrinkles, grey hair in a topknot, calm face, green taoist robe, sword", "qingcheng pine forest")
P("공동장로", "남", "kongtong elder tiger-taming fist, sixties, broad shoulders, grey beard, brown robe, fists", "kongtong desert mountain", "맨", "weapon")
P("모용장로", "남", "murong elder called returning heaven spear, sixties, noble face, white and blue robes, long spear", "suzhou garden with lake")
P("제갈장로", "남", "zhuge elder called heavenly mechanism, sixties, scholarly face, feather fan, blue robe, crossbow mechanism on the wrist", "study with maps and mechanisms", "작")
P("세가직계", "남", "jade-faced spear, direct heir of the murong clan, twenties, arrogant handsome face, white robes, silver spear", "murong clan training ground")
P("외전_오독문주", "녀", "spider poison mother, matriarch of the five poisons sect, old woman in her sixties, grey streaked hair in an elegant bun, fine wrinkles, cold proud face, dark lips, black and green robes, spider ornaments, poison mist", "southern jungle temple with spider webs", "맨", "weapon")
P("외전_철필", "남", "iron brush, elder of the zhuge clan who records the ten masters list, seventies, stern scholar, long white beard, iron judge brush", "library hall with scrolls", "작")
P("외전_추살수좌", "남", "traceless killer of assassins, forties, plain forgettable face, grey clothes, thin dark sword", "rain-soaked alley")
P("외전_총채주", "남", "water ghost, lord of the yangtze waterways, fifties, massive, wet black robe, harpoon, cruel grin", "great river fleet at night")
P("외전_곽승", "남", "red-browed demonic cult elder who guarded the blood lake for a hundred years, very old man, long thick crimson eyebrows drooping past the cheeks, bald crown with long white hair at the back, deep wrinkles, black robe with crimson sleeves, gnarled black iron staff, commanding glare", "steep valley path at night leading to a blood lake, torches of a recapture squad")
P("외전_혜명", "남", "head monk of the arhat hall of shaolin, fifties, shaved head with ordination scars, thick black eyebrows, square stern face, muscular, brown monk robe with sleeves tied back, long iron-bound wooden staff held across the body", "shaolin martial monks courtyard with stone floor, closed temple gate, morning mist")
P("외전_적암", "남", "old monk who guarded the scripture pavilion for forty years, eighties, long white eyebrows, thin weathered kind face, faded saffron robe, a cloth bundle of twelve scripture copies tied on the back, wooden walking stick", "mountain road leading away from shaolin at dawn, pine trees", "작", "sword")
P("외전_송결", "남", "second disciple of wudang who wants the gate closed, forties, stern disciplined face, neat black topknot with a wooden pin, short beard, grey taoist robe with yin yang emblem, sword moving in a circular guard", "wudang mountain gate with stone stairs and clouds")
P("외전_진무", "남", "first disciple of wudang leading his juniors on the battlefield, forties, tired resolute face, topknot loosened, grey taoist robe torn and stained by battle, straight sword held low", "battlefield at dusk with wudang banners and smoke")
P("외전_정심", "녀", "old nun guarding the emei discipline hall, sixties, shaved head under a grey nun cap, strict calm face, grey nun robes, prayer beads on the wrist, sword raised like a closing lotus", "emei temple hall with golden roof in clouds", "무", "hair")
P("외전_묵현", "남", "cold blood elder of the demonic cult who hunts deserters to the end, sixties, gaunt cold face, thin grey mustache, slicked back grey hair, black robe with crimson sleeves, bare pale hands with long nails", "lonely mountain road at night with an abandoned cart", "맨", "weapon")
P("외전_갈무진", "남", "iron fist, leader of kongtong sect, fifties, broad heavy body, short grey beard, thick neck, brown and ochre robe with sleeves rolled up, huge scarred fists", "alliance meeting hall with a smashed wooden table", "맨", "weapon")
P("외전_구양열", "남", "yellow sand demon lord, demonic cult elder who rules the western trade road, sixties, sun-darkened leathery face, sharp eyes, desert turban and veil, black robe with crimson trim, sand swirling from his hands", "desert caravan road with ruined beacon towers and camels far away", "맨", "weapon")
P("외전_모용백", "남", "elder of the murong clan who keeps the genealogy, seventies, neat white beard, dignified face, white and blue robes, old silver spear held upright", "murong ancestral hall with tablets and candles")
P("외전_나곤", "남", "snow spear of changbai, forties, rugged weathered face, short black beard with frost, fur hat and heavy fur coat, long red-tasseled spear", "changbai mountains in deep snow, birch trees")
P("외전_마철", "남", "twin hook blade of the debt collection hall, thirties, lean hard face, scar across the nose, black hair tied back, dark grey clothes, two hook swords held crossed", "debt collection hall with ledgers and hanging lanterns")
P("외전_사마주", "남", "iron abacus guardian of the unorthodox alliance ledgers, fifties, shrewd narrow eyes, neat goatee, black robe with crimson lining, heavy iron abacus held like a weapon", "ledger hall with stacked account books and candles", "작")
P("외전_제갈문", "남", "new master of the heavenly mechanism pavilion, thirties, sharp intelligent face, neat topknot with a silver crown, dark blue scholar robe, mechanical crossbow on the forearm, hand raised to signal", "room lined with mounted crossbows and gears", "작")
P("외전_공야반", "남", "ghost hand master craftsman, sixties, wiry body, grey hair tied up, sharp eyes, sleeves rolled up, leather apron with tools, a wooden ox automaton behind him", "workshop full of gears and wooden mechanisms", "작", "sword")
P("외전_육허", "남", "exorcist taoist abbot of the azure cloud temple, fifties, stern face, long black beard, black and yellow taoist robe, yellow paper talismans flying around, peachwood sword", "taoist temple courtyard at night with blue lanterns")
P("외전_엄대웅", "남", "greenwood king, old but mighty, sixties, huge frame, white bushy beard and eyebrows, tiger fur cloak over dark armor, heavy iron club planted beside him", "greenwood stronghold great hall with tiger skins and torches")
P("외전_단철웅", "남", "mountain-splitting axe, patrol chief of the greenwood, forties, huge muscular body, bald head, thick black beard, sleeveless leather armor, huge double-bladed axe on the shoulder", "mountain stronghold on a cliff")
P("외전_염칠", "남", "dice master, second table master of the black snake gang, thirties, sly handsome face, slicked hair, black silk robe with gold snakes, three iron dice between fingers", "smoky gambling hall with lanterns", "작")
P("외전_하백", "남", "golden hand, first table master of the black snake gang, fifties, fat smiling face, thin mustache, luxurious black and gold robes, gold rings on every finger", "luxurious gambling hall with piles of silver", "작")
P("외전_육종", "남", "best swordsman of the imperial embroidered guard, forties, stern iron face, short beard, red flying fish robe, black gauze hat, spring saber held ready", "palace gate at night with lanterns")
P("외전_위소경", "남", "white-faced director of the eastern depot, middle-aged eunuch man in his fifties, pale powdered beardless face with fine wrinkles, narrow cunning eyes, thin smile, black gauze official hat, purple silk robes with wide sleeves, holding a folded document", "palace office with screens", "작", "sword")
P("외전_당한", "남", "poison dragon hand, elder of the tang clan, sixties, cold elegant face, thin grey beard, dark green robes, green poison mist curling from the sleeves", "sichuan bamboo forest in mist", "맨", "weapon")
P("외전_연비", "녀", "red thread assassin, captain of the dark soul squad of the demonic cult, thirties, beautiful cold face, black hair in an elegant bun, black and crimson robe, red silk thread wrapped around both hands", "wedding hall with red decorations and candles", "작")
P("외전_하문겸", "남", "straight sword, leader of zhongnan sect, fifties, upright honest face, black beard, dark blue robes, straight sword pointing forward", "zhongnan mountain gate")
P("외전_구양학", "남", "seven soul saber, second disciple of the soul binding saber, thirties, gaunt pale face, long black hair, black robe, heavy saber wreathed in seven faint ghostly wisps", "edge of a blood lake in a cavern")
P("외전_홍의", "녀", "golden thread sleeve, head of the crimson sleeves, thirties, elegant cold beauty, black hair with gold pins, crimson robe with gold-threaded sleeves, needles hidden between fingers", "room with red curtains", "작")
P("외전_상관혁", "남", "shadow-cutting sword, old swordsman helping the alliance, old man in his sixties, lean wrinkled face, grey hair tied up, grey beard, grey robe, sword drawn", "village road at dusk")
P("외전_사마굉", "남", "lightning sword, leader of diancang, fifties, lean sharp face, short black beard, light blue robes, sword crackling with speed", "cangshan peak with lightning clouds")
P("외전_아누", "남", "old insect formation shaman of the southern miao beast palace, old man in his seventies, dark wrinkled skin, heavy silver neck rings and silver headdress, indigo batik robe, carved wooden staff with a coiled centipede, swarm of glowing insects", "southern jungle with mist", "작")
P("외전_설봉자", "남", "snow peak master, leader of kunlun, sixties, long white beard, white robes, sword raising swirling snow", "kunlun summit in a snowstorm")
P("외전_맹추", "남", "iron arm enforcer of the shanxi silver house, thirties, broad muscular body, rough square face, short black hair, thick iron bracers on both forearms, sleeveless dark work tunic, fists clenched in a fighting stance", "silver mine entrance with carts", "맨", "weapon")
P("외전_갈석", "남", "diamond hand, chief of the shanxi silver house, middle-aged man in his fifties, heavy build, thick greying beard, wrinkles, shrewd eyes, rich brown robes, crushing a silver ingot in his bare hand", "silver vault with stacked ingots", "맨", "weapon")
P("외전_방노삼", "남", "white-haired ferryman who rowed fifty years, seventies, wiry tanned body, long white hair, straw hat on the back, long bamboo punting pole", "yellow river ferry crossing")
P("외전_곽호", "남", "black dragon of the yellow river water fortress, forties, sun-darkened, wet black clothes, iron harpoon", "yellow river water fortress")
P("외전_구참", "남", "old coastal garrison officer, sixties, tired scarred face, old armor, spear leaning beside", "coastal fortress wall at dusk")
P("외전_석무광", "남", "salt sea ghost, east sea pirate chief, forties, sea-weathered face, braided hair, iron hook spear", "pirate ship deck at sea in a storm")

# ---------------------------------------------------------------- 동료(결전에 달려오는 사람)
P("위무결", "남", "rival saber master of the clear river, twenties, fierce handsome face, short spiky black hair, dark blue robe, broad saber resting on the shoulder, competitive grin", "riverside at dawn")
P("소연화", "녀", "mistress of the medicine king valley, twenties, gentle beautiful face, long black hair with a jade pin, pale green robes, golden acupuncture needles between fingers", "herb garden valley with mist", "작", "sword")
P("석대우", "남", "iron wall great general who led a hundred thousand border soldiers, fifties, huge broad body, short grey beard, heavy black armor, tower shield and spear", "frontier fortress wall with banners")
P("묘아", "녀", "the greatest thief under heaven, twenties, playful sly smile, cat-like eyes, short black hair, tight black thief clothes, holding a stolen jade", "imperial palace rooftops at night", "작", "sword")
P("무애", "남", "drunken monk, former head of the shaolin arhat hall, sixties, bald, red nose, big belly, patched robe, wine gourd", "mountain tavern", "맨", "weapon")
P("장칠", "남", "chief of all seventy-two greenwood strongholds, forties, rugged, scarred, fur cloak, throwing axe", "greenwood fortress")
P("적연", "녀", "crimson-robed rakshasa, former elder of the demonic cult, forties, beautiful fierce face, long black hair, crimson robe", "blood lake cave", "맨", "weapon")
P("연무휘", "남", "carefree sword, swordsman who left for the jianghu the same year, twenties, handsome cheerful face, white robe, sword", "town gate")
P("왕백로", "남", "noodle king, one of the ten great masters thirty years ago, seventies, round kind face, apron over robes, rolling pin", "noodle shop kitchen", "작", "sword")
P("은비", "녀", "nine-tailed fox spirit in human form, ageless beauty, long silver hair, golden eyes, nine silver fox tails, white robes", "moonlit bamboo forest", "맨", "weapon")
B("설백", "white tiger spirit beast, huge and noble, blue eyes, gentle but powerful", "snowy mountain forest")

# ---------------------------------------------------------------- 말로 만나는 사람
P("각명대사", "남", "abbot of shaolin, seventies, long white eyebrows drooping past the eyes, kind wise face, red and gold kasaya over a brown robe, long prayer beads, one hand raised in blessing", "shaolin main hall with a great golden buddha and incense smoke", "맨", "weapon")
P("청허진인", "남", "leader of wudang in closed seclusion, eighties, ethereal serene face, long white hair and beard, white taoist robe, seated in meditation, faint white aura", "mountain cave on wudang peak with clouds", "맨", "weapon")
P("운암자", "남", "leader of mount hua sect, sixties, refined calm face, neat grey beard, white robe with plum blossom embroidery, hands behind the back", "mount hua hall with plum blossoms outside", "맨", "weapon")
P("정연사태", "녀", "leader of emei sect, sixties, serene nun with gentle eyes, grey nun cap, grey and white robes, prayer beads, palms together", "emei golden temple hall", "맨", "weapon, hair")
P("청송자", "남", "leader of qingcheng sect, sixties, gentle taoist, thin grey beard, green taoist robe, horsetail whisk", "qingcheng temple among pines", "맨", "weapon")
P("당천기", "남", "ten thousand poisons hand, head of the tang clan, sixties, cold elegant face, thin black and grey beard, dark green robes with gold trim, black gloves", "tang clan hall with bamboo screens", "맨", "weapon")
P("모용진", "남", "head of the murong clan, fifties, noble handsome face, short beard, white and sky blue robes, jade pendant", "murong manor by the lake", "맨", "weapon")
P("제갈현", "남", "head of the zhuge clan, fifties, wise calm face, long beard, blue scholar robe, white feather fan", "study with maps and models", "작", "sword")
P("설란", "녀", "ice queen of the north sea ice palace, forties, regal cold beauty, long silver hair, ice blue eyes, white fur cloak, crown of ice crystals", "ice palace throne hall", "맨", "weapon")
P("위숙", "남", "old librarian of the martial alliance archives, seventies, thin body, long grey beard, ink-stained fingers, faded blue robe, arms full of old scrolls", "alliance archive with tall shelves", "작", "sword")
P("붉은옷여인", "녀", "mysterious woman in crimson from the demonic cult, twenties, captivating smile, long black hair, crimson robe with wide sleeves, offering a red pill on her palm", "rainy inn at night", "작", "sword")
P("신교사자", "남", "envoy of the demonic cult, thirties, polite cold smile, black robe with crimson sleeves, bowing slightly while holding a sealed black invitation", "inn courtyard at dusk", "작", "sword")
P("수상한누군가", "남", "mysterious peddler, deep hood hiding the upper face, faint knowing smile, patched dark cloak, a wooden cart full of rare treasures and scrolls", "foggy crossroads at night with a single lantern", "작", "sword")
P("장터상인", "남", "market merchant, forties, friendly round face, small mustache, brown merchant robe, cap, abacus in hand", "busy market street with stalls", "작", "sword")
P("객잔주인", "녀", "inn owner, forties, sharp but warm face, hair in a bun with a wooden pin, apron over a dark red dress, holding a ledger", "inn hall with wooden tables", "작", "sword")
P("점소이", "남", "inn waiter boy, late teens, cheerful face, white towel over the shoulder, carrying a tray with a teapot", "inn hall with lanterns", "작", "sword")
P("의원", "남", "village doctor, sixties, kind face, grey beard, plain blue robe, wooden medicine box on the shoulder", "clinic with herb drawers", "작", "sword")
P("대장장이", "남", "blacksmith, forties, muscular sweaty arms, leather apron, soot on face, hammer in hand", "forge with glowing coals and sparks", "작", "sword")
P("장원집사", "남", "manor steward, fifties, neat grey beard, dark robe, respectful bow, ledger under the arm", "manor courtyard with a pond", "작", "sword")
P("표국국주", "남", "head of an escort agency, fifties, stern dignified face, grey beard, brown robe, escort banner behind", "escort agency yard with carts", "맨", "weapon")
P("촌장", "남", "village elder, seventies, white beard, kind tired face, plain robe, walking cane", "village gate with an old tree", "작", "sword")
P("기녀", "녀", "courtesan musician, twenties, elegant beauty, hair ornaments, silk robes, holding a pipa", "pleasure house with silk curtains", "작", "sword")
P("서생", "남", "young scholar, twenties, gentle timid face, scholar hat, light robe, holding a book", "study with books and a window", "작", "sword")
P("포두", "남", "local constable, forties, strict face, short beard, red constable uniform, saber at the hip", "magistrate office courtyard")

# ---------------------------------------------------------------- 짐승과 영물
B("늑대무리", "pack of starving winter wolves, thin grey wolves with bared fangs, glowing eyes", "snowy forest at night")
B("멧돼지떼", "herd of enraged wild boars with tusks charging", "destroyed mountain farm field")
B("독사떼", "swarm of venomous snakes coiling over rocks, raised heads", "rocky valley with fog")
B("불곰", "huge fierce brown bear standing on hind legs, roaring", "autumn mountain forest")
B("식인호랑이", "man-eating tiger, scarred, crouching to pounce, burning eyes", "dark bamboo forest")
B("왕지네", "giant centuries-old centipede, armored black and red segments, many legs", "damp cave")
B("설표", "snow leopard on a cliff, pale spotted fur, piercing eyes", "snowy mountain pass")
B("금안조", "giant golden-eyed divine eagle with spread wings", "cliff top above clouds")
B("백액호", "huge white-browed king tiger with the character king on its forehead, majestic", "mountain shrine forest")
B("철갑현귀", "thousand-year black armored turtle carrying a stone stele on its back", "ancient lake shore")
B("이무기", "thousand-year serpent dragon without horns, giant, coiled in a pond", "mountain pond under storm")
B("천년혈망", "thousand-year blood python, giant crimson snake", "swamp")
B("만년빙잠", "ten-thousand-year ice silkworm, translucent glowing white", "ice cave")
B("금섬", "giant golden toad breathing poison mist", "poison marsh")
B("불가사리", "ancient iron-eating beast, bear-like body of iron, glowing eyes", "ruined forge")
B("천년백사", "thousand-year white serpent coiled around a spirit herb", "cliff garden")
B("흑룡", "black dragon rising from a deep pool, without a pearl, majestic", "deep pool under thunderstorm")
B("해치", "haetae, divine lion-like beast with one horn, judging", "ancient palace courtyard")
B("외전_백공", "giant white ape guardian with long arms, wise eyes", "jungle throne ruins")

# ---------------------------------------------------------------- 사건 배경
S("천마봉", "the heavenly demon peak, a jagged black mountain piercing crimson storm clouds, stone stairs carved up the cliff, crimson banners, snow")
S("천마봉_정상", "flat snowy summit of a black mountain, an empty black stone throne carved with dragons on a stone dais, black stone pillars with crimson banners, crimson lightning in the dark sky, sea of clouds below", "pagoda, tower, temple, building")
S("피연못", "underground blood lake, still dark red water, ancient carved pillars, red mist, dim crimson light")
S("혈교산사", "blood sect mountain temple, grey stone buildings, red banners, red sunset, crows")
S("낙양_불", "the city of luoyang burning at night, pagodas and city walls on fire, smoke and sparks")
S("태산_비무대", "martial tournament stage on mount tai, stone platform, banners of many sects, sea of clouds")
S("무림맹_본청", "grand hall of the martial alliance, tall pillars, banners of nine sects and five clans, long table")
S("소림사", "shaolin temple compound on songshan mountain, long stone stairway up to a red temple gate with a big plaque, grey tiled halls, stone pagoda forest beside, old cypress trees, morning mist and sunlight", "lake, river, water")
S("무당산", "wudang mountain palaces on cliffs in clouds")
S("화산", "mount hua plank road on sheer cliffs, plum trees")
S("아미금정", "golden summit temple of mount emei above the sea of clouds")
S("곤륜설산", "kunlun snowy mountain sect gate in a blizzard")
S("객잔", "interior of a roadside inn, wooden tables and benches, wine jars, warm lanterns, wooden staircase to the second floor, counter with an abacus, evening warm light through paper windows")
S("장터", "bustling market street of a chinese town, stalls, banners, lanterns")
S("표국", "escort agency courtyard with carts, banners, weapon racks")
S("고갯길", "narrow mountain pass road, rocks, pines, dusty light")
S("장강", "great yangtze river with boats and cliffs at dusk")
S("녹림산채", "bandit mountain fortress with wooden palisade and watchtowers")
S("하오문_골목", "dark back alley with red lanterns, rain, wet stones")
S("기루", "elegant pleasure house interior, silk curtains, red lanterns")
S("관아", "magistrate office courtyard with drum, stone lions")
S("장원", "peaceful manor estate with courtyards, pond, training ground, guest house")
S("연무장", "open training ground with wooden dummies and weapon racks at dawn")
S("서고", "ancient library with tall shelves of scrolls, candlelight")
S("약방", "herbal medicine shop with drawers, hanging herbs")
S("비동", "secret seclusion cave with carved martial art figures on the walls, single beam of light")
S("북해빙궁", "ice palace of the north sea, glaciers, aurora")
S("남만밀림", "southern jungle with giant trees, poisonous fog, ruined temple")
S("다리밑", "under an old stone arch bridge at night, river with floating lanterns")
S("무덤", "lonely grave on a hill, old tree, autumn wind")
S("정마대전", "great battlefield between orthodox and demonic armies, banners, smoke, fallen weapons")
S("청운장", "massacred manor at night, broken doors, red handprints on walls, scattered lanterns")
S("신교분타", "demonic cult branch fortress, black walls, crimson banners, burning")
S("설산고개", "snowy high mountain pass, blizzard, narrow trail")
S("대나무숲", "dense bamboo forest with moonlight and mist")
S("산정_일출", "mountain summit at sunrise above a sea of clouds, old pine")

DEFAULT = 9013
PICK = {}

def run(path, seed, key, kind, body, bg, wk, extra):
    if os.path.exists(path + ".png"):
        return
    env = dict(os.environ)
    if kind == "인":
        style, uc, char = STYLE, UC + ", " + UC_PERSON, body
        if wk == "무":
            char = f"{char}, {WEAPON}"
        elif wk == "작":
            uc = uc + ", long weapon, staff, polearm, spear, sword, club"
        elif wk == "맨":
            uc = uc + ", weapon, holding weapon"
    elif kind == "수":
        style, uc, char = BEAST, UC_BEAST, body
    else:
        style, uc, char = SCENE, UC_SCENE, "no humans, scenery, " + body
        env["ART_W"], env["ART_H"] = "1216", "832"
        bg = body
    if extra:
        uc = uc + ", " + extra
    subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "gen.py"),
                    path, str(seed), style, char, bg, uc], env=env)
    if os.path.exists(path + ".json"):
        os.remove(path + ".json")

if __name__ == "__main__":
    out = sys.argv[1]; only = sys.argv[2] if len(sys.argv) > 2 else ""; seeds = [int(x) for x in sys.argv[3:]]
    os.makedirs(out, exist_ok=True)
    keys = [a[0] for a in ALL]
    assert len(keys) == len(set(keys)), [k for k in keys if keys.count(k) > 1]
    for key, kind, body, bg, wk, extra in ALL:
        if only and only not in key: continue
        for sd in (seeds or [PICK.get(key, DEFAULT)]):
            run(os.path.join(out, f"{key}_{sd}" if seeds else key), sd, key, kind, body, bg, wk, extra)
