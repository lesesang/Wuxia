# 강호행의 조연(적, 동료, 말만 하는 사람, 짐승)과 사건 배경 그림. 인물.py와 같은 그림체를 쓴다.
# NovelAI Diffusion V4.5 Full, Anlas가 들지 않는 조건(832x1216 또는 1216x832, 28 steps, 한 장씩)만 쓴다.
#   cd art && python3 조연.py 출력폴더 [이름 일부] [시드 ...]
# 시드를 주면 이름_시드.png로 후보를 여럿 뽑고, 주지 않으면 PICK이나 기본 시드로 한 장씩 뽑는다.
import os, subprocess, sys
from 인물 import STYLE, WEAPON, UC

# 짐승과 영물: 사람 얼굴과 손 태그를 빼고 같은 채색을 쓴다
BEAST = ("korean webtoon key visual, manhwa illustration, anime style, wuxia, ancient china, clean crisp lineart, cel shading with smooth gradients, "
         "polished digital painting with clean edges, high contrast, cool cinematic color grading, strong rim light, sharp shadows, wind, "
         "detailed background, scenery, atmospheric depth, no humans, animal focus, majestic creature, detailed fur and scales, "
         "realistic animal anatomy, powerful presence, dynamic pose")
# 사건 배경: 사람 없이 장소만
SCENE = ("korean webtoon background art, anime style background, illustration, manhwa key visual, murim, wuxia, ancient china, "
         "traditional chinese architecture, intricate details, polished digital painting with clean edges, crisp lineart, "
         "cinematic lighting, volumetric light, rich colors, atmospheric depth, wide shot, establishing shot, scenery, no humans, highly detailed background")
UC_PERSON = "caucasian, european, western face, blonde hair, light brown hair, modern hairstyle, slicked back hair, undercut, leather jacket, belt buckle, buttons, collar shirt, english text, latin letters, monochrome, greyscale, faceless, blank face, crowd, giant moon, red moon, big red sun behind character, halo, circle behind head, eclipse, black sun, sun, moon behind head"
UC_BEAST = "photorealistic, photo, 3d, realistic painting, full moon, giant moon, big sun, symmetrical composition, human, 1boy, 1girl, person, rider, cute, chibi, cartoon animal, deformed animal, extra legs, extra heads, extra tails, fused limbs"
UC_SCENE = "torii, japanese architecture, floating island, photorealistic, photo, 3d render, realistic, people, person, human, character, 1boy, 1girl, crowd, face, text, signature, modern building, car, power lines, western castle"

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
P("산적", "남", "mountain bandit, thirties, rough sun-burned face, unkempt beard, dirty cloth headband, ragged hemp clothes with rope belt, rusty single-edged saber held low, greedy grin", "narrow mountain pass ambush, rocks and twisted pines, dusty afternoon")
P("낭인", "남", "wandering ronin swordsman for hire, thirties, stubble, tired cold eyes, faded grey travel robe, straw rain cape, worn saber in a battered scabbard at the hip, hand resting on the hilt", "rainy crossroads with a broken wayside shrine, misty fields")
P("흑풍채두목", "남", "bandit chief called one-eyed saber, forties, black eyepatch over the left eye, thick black beard, hair in a rough topknot, scarred muscular arms, black fur vest over a dark brown tunic, heavy chinese broad-bladed axe with a long wooden handle resting on the shoulder, cruel smirk", "mountain bandit fortress gate, wooden palisade, black banners, torchlight at dusk", "무", "viking, double-bladed axe, european axe, horned helmet")
P("녹림호걸", "남", "greenwood outlaw with his own code of honor, thirties, rugged handsome east asian face, black hair in a ponytail, headband, sleeveless dark green tunic, rope belt, heavy saber held low, bold confident grin", "pine forest trail, sunlight through trees")
P("사파자객", "녀", "unorthodox sect assassin woman, black hair in a tight bun, cold narrow eyes, black fitted clothes, dark face veil lowered under the chin, short twin daggers in reverse grip", "moonlit tiled rooftops, night mist", "작")
P("사이비도사", "남", "fake taoist charlatan, fifties, east asian face, black hair in a messy taoist topknot with a wooden pin, thin mustache, shifty eyes, shabby yellow taoist robe, paper talismans in one hand, gourd at the waist, sly smile", "village square at dusk, incense stand, curious crowd far behind", "작", "sword")
P("배신표사", "남", "treacherous escort guard, thirties, east asian face, black hair tied in a topknot with a red cord, greedy eyes, brown escort uniform with a torn agency badge, spear held across the body, nervous sneer", "abandoned escort cart on a mountain road, scattered cargo boxes")
P("세가공자", "남", "spoiled son of a local landlord, early twenties, smooth arrogant handsome face, smirk, hair in a topknot with a jade crown, luxurious embroidered silk brocade robe, folding fan in hand", "busy town street with shop signs", "작", "sword")
P("혈단중독자", "남", "young laborer under a blood pact, twenties, bare muscular arms, glowing red seal mark on the palm, bloodshot eyes, torn hemp clothes, wild hair", "dim village alley at night, red lanterns", "맨", "weapon")
P("마단장정", "남", "village strongman burning with a dark flame, twenties, black flames visible under the skin like veins, smoke rising from the shoulders, torn sleeveless shirt, clenched fists, pained fierce face", "burning barn at night, sparks", "맨", "weapon")
P("잠화표사", "남", "escort guard with a hidden fire inside, thirties, calm east asian face, black hair tied in a topknot, with faintly glowing ember-colored eyes, neat brown escort uniform, saber at the hip, faint dark glow under the belly", "inn courtyard at dusk, escort carts")

# ---------------------------------------------------------------- 2, 3장의 길
P("귀도객", "남", "assassin swordsman called ghost blade, pale gaunt face, long messy black hair over one eye, black robe, long thin saber held low, emotionless stare", "foggy graveyard at dusk, leaning tombstones")
P("금의위밀정", "남", "imperial embroidered uniform guard spy, thirties, sharp eyes, red and gold flying-fish embroidered robe, black gauze official hat, narrow spring saber at the hip", "palace corridor with red pillars, lanterns")
P("수적두목", "남", "yangtze river pirate chief called water ghost, forties, sun-burned skin, wet hair tied back, tattoos of waves on the arms, open vest, harpoon spear in hand", "pirate boat on a wide river at stormy dusk")
P("독고객", "남", "lone poison wanderer, thirties, sallow skin, dark lips, wide straw hat, grey travel cloak, small poison vials on the belt, thin sword in a plain scabbard", "withered swamp forest, green mist", "작")
P("장강수적", "남", "elite river raider with twin axes, thirties, broad shoulders, sleeveless black vest, two hand axes held at the sides, fierce grin", "riverside granary on fire at night, boats")
P("녹림채주", "남", "chief of one of the seventy-two greenwood strongholds, forties, burly, thick beard, brown fur cloak, huge saber planted beside him", "mountain stronghold hall with tiger skins, torches")
P("종남검수", "남", "proud zhongnan sect swordsman, twenties, handsome stern face, topknot, dark blue zhongnan robes, straight jian held at the side, arrogant gaze", "zhongnan mountain stone steps, pines, morning mist")
P("혈교혈승", "남", "blood sect monk, forties, completely shaved bald head, red prayer beads, ash grey kasaya with dark red stains, iron monk staff, calm menacing eyes", "ruined mountain temple under a grey overcast sky, crows, mist", "무", "hair, topknot, ponytail, long hair")
P("혈교혈사", "남", "blood sect zealot, thirties, shaved head with red ink scriptures written on the scalp, ash grey robe, saber in hand, chanting with fanatic eyes", "grey mountain road under an overcast sky, ash grey blood sect banners, mist")
P("동창번자", "남", "eastern depot agent serving the palace eunuchs, thirties, pale smooth face, brown official uniform with a black hat, thin saber, cold sneer", "government office courtyard at night, lanterns")
P("남만술사", "남", "southern miao tribe beast palace shaman, fifties, dark skin, heavy silver horn-shaped headdress and silver neck rings, indigo batik robes, tribal face paint, carved staff with a snake coiled on it, insects swarming around", "steaming southern jungle with giant trees, poisonous fog", "작")
P("독문고수", "남", "five poisons sect elder, sixties, long straight white hair, pale skin, green-black robe, long fingernails tinted green, venom dripping from fingertips, cruel smile", "jungle temple with snakes on the stones", "맨", "weapon, snakes in hair, medusa")
P("철혈대원", "남", "elite iron blood corps soldier of a regional army, thirties, stern square face clearly visible, short beard, heavy lamellar armor, iron helmet held under one arm, long glaive in the other hand", "military checkpoint on a highway, banners, dust", "무", "face hidden, helmet on head, visor")
P("절정고수", "남", "wandering swordsman selling his name, late twenties, handsome confident east asian face, long black hair tied in a high ponytail, white travel robe with a blue sash, jian in hand, faint smirk", "inn rooftop at sunset")
P("혈교수련자", "남", "blood cultivating monk of the blood sect, thirties, shaved head, natural tan skin, detailed face, sharp eyes with red irises, ash grey robe, red prayer beads, faint red mist around the hands", "blood-stained stone meditation cave with candles", "맨", "weapon, grey skin, blank eyes, glowing eyes, faceless")
P("세가호위", "남", "a guard captain of a noble clan searching for a runaway young lady, thirties, stern dutiful east asian face, short black beard, black hair in a topknot with a cloth band, dark blue cross-collar clan robe with an embroidered crest, saber at the hip, hand on the hilt", "riverside town road at dusk, other guards blurred far behind")
P("점창제자", "남", "young diancang sect swordsman, late teens, eager face, light blue robes, thin fast sword held ready", "cangshan mountain with clouds, erhai lake far below")
P("살막살수", "남", "killer of the assassin house, black mask covering the whole face except cold eyes, black fitted clothes, thin black blade", "dark rooftops under a crescent moon")
P("세가무사", "남", "captain of the iron sword corps of the five great clans, late twenties, disciplined proud face, topknot with a silver crown, polished dark blue uniform with clan crest, straight sword held point down in both hands", "clan manor gate with stone lions")
P("철봉승", "남", "wandering mendicant monk with an iron club, forties, completely shaved bald head, east asian face, thick eyebrows, patched brown robe, iron staff resting on the shoulder, hungry grin", "rural temple gate in daylight, autumn leaves", "무", "hair, topknot, ponytail")
P("젊은협객", "남", "young righteous hero, twenties, earnest brave face, white and blue robes, jian drawn, standing firm despite fear", "village gate at dawn")
P("현상금꾼", "남", "bounty hunter, thirties, rough stubbled east asian face, scar over the eyebrow, black hair in a rough topknot, padded dark cloth vest over a cross-collar robe, iron chain coiled on the shoulder, saber at the hip, holding a crumpled wanted notice", "inn wall covered with paper notices written in chinese brush calligraphy, lanterns")
P("이름사냥꾼", "남", "young swordsman hungry for fame, early twenties, cocky overconfident face, brand new cheap white robe, sword drawn and pointed forward", "town square with onlookers blurred")
P("무명사냥꾼", "남", "thug who preys on unknown wanderers, thirties, sneering face, missing tooth, dirty brown clothes, wooden club studded with nails on the shoulder", "muddy back road at dusk")
P("수로채졸", "남", "river bandit, twenties, sun-burned face, wet hair under a cloth headband, sleeveless wet tunic, short hooked spear", "reedy riverbank at dawn mist, small boats")
P("흑사방향주", "남", "black snake gang hall master who runs gambling and smuggling, forties, east asian face, black hair in a topknot with a gold pin, thin mustache, gold teeth, black silk robe with a snake pattern, twin sabers crossed on the back, dice in hand", "smoky gambling den with lanterns")
P("비무청성", "남", "qingcheng sect swordsman in a tournament, twenties, calm polite face, light green taoist robes, slender sword held in salute", "tournament stage at mount tai, banners, spectators blurred")
P("비무철권", "남", "iron fist king, thirties, huge muscular body, shaved head, bare torso with iron bracers, fists raised", "tournament stage at mount tai, banners", "맨", "weapon")
P("비무결승", "남", "the crimson-clad young master, twenties, beautiful cold face, long black hair, flowing crimson robe, slender sword dripping, chilling smile", "stone tournament stage on mount tai under a grey overcast sky, banners, blood on the stone")
P("조각무인", "남", "wandering martial artist clutching a torn manual page, thirties, haggard obsessive eyes, shabby robe, sword at the hip, torn page in the other hand", "ruined library cave with scattered scrolls")
P("무명노인", "남", "nameless old master testing a disciple, eighties, long white hair and beard blowing in the wind, plain worn grey robe, barefoot, holding a bamboo stick, mild amused eyes, overwhelming calm presence", "mountain cliff edge above a sea of clouds", "작", "sword, metal sword")
P("십팔동인", "남", "one of the eighteen bronze men of shaolin, shaved head, whole body painted bronze like a statue, bare muscular torso, calm expressionless face, fists raised in a guard stance", "shaolin temple courtyard with stone floor and bronze statues", "맨", "weapon")
P("무당진인", "남", "wudang taoist master who parries swords with a twig, seventies, long white beard, serene smile, grey taoist robe, holding a pine twig like a sword", "wudang mountain pavilion in clouds", "작", "sword, metal sword")
P("화산장로", "남", "mount hua elder swordsman, sixties, grey beard, plum blossom embroidered robes, sword held vertically", "mount hua cliff path with plum trees")
P("아미사태", "녀", "chinese buddhist bhikkhuni swordswoman of emei, middle-aged woman in her fifties, completely shaved bald head, fine wrinkles, compassionate stern face, plain grey chinese monastic robe with wide sleeves, brown kasaya over one shoulder, prayer beads, sword held vertically before her", "golden roof temple on emei peak in clouds", "무", "hair, young girl, nun habit, veil, wimple, coif, christian nun, western nun, catholic, hood")
P("개방십걸", "남", "one of the ten heroes of the beggar sect, forties, messy hair tied with a rag, weathered tanned face with slightly flushed cheeks, short stubble, sharp amused eyes, patched green and brown clothes with knotted cords at the waist, wine gourd in one hand, bamboo staff on the shoulder, relaxed confident smirk, closed mouth", "under a stone bridge with lanterns")
P("당가배신자", "남", "traitor of the tang clan who once taught throwing knives, fifties, thin mustache, cold eyes, dark green tang clan robe, flying knives between fingers", "bamboo forest in sichuan mist", "작")
P("곤륜역도", "남", "kunlun sect uncle who fled with a secret manual, sixties, gaunt face, white hair, white kunlun robe torn by blizzards, old sword, scroll case on the back", "kunlun snow pass in a blizzard")
P("하오문주", "녀", "head of the information network of the lowly, old woman in her seventies, wrinkled sly face, grey hair in a bun, plain dark robe, many letters and a smoking pipe", "back room of a teahouse full of scroll shelves", "작", "sword")

# ---------------------------------------------------------------- 3, 4장과 정마대전
P("마교장로", "남", "demonic cult elder called gloomy wind lord, seventies, gaunt human face with deep wrinkles, sunken cold eyes, long grey hair and thin grey beard, black and crimson robe, dark wind swirling around, thin old human hands", "black mountain fortress of the demonic cult, crimson banners", "맨", "weapon, skeleton, skull, bone hands, undead")
P("혈마대귀", "남", "blood demon corps captain, thirties, pale skin with crimson veins, red armor pieces over black clothes, saber, fearless deathly eyes", "battlefield at dusk, smoke")
P("십이마장", "남", "fifth demon general called mountain crusher, forties, giant muscular body, bald head, thick beard, crimson war paint on the face, black chinese lamellar armor with crimson cords over a black robe, enormous iron mace", "shattered fortress wall, crimson banners", "무", "plate armor, european armor, knight, western armor")
P("십이마장귀곡", "남", "seventh demon general ghost valley master who controls living puppets, fifties, sunken eyes, long black robe, silver threads from his fingers to puppet-like figures in the dark", "misty valley with hanging lanterns", "작", "sword")
P("혈수라", "남", "third demon general blood asura, thirties, wild red hair, many scars over a muscular bare torso, crazed grin, twin sabers dripping", "burning battlefield at night")
P("천마친위대", "남", "commander of the heavenly demon guard called stone-faced ghost, forties, expressionless stone-like face clearly visible, short black beard, bare head with topknot, black chinese lamellar armor with crimson trim, long halberd", "black stone gate of the heavenly demon peak, snow", "무", "helmet, visor, face hidden, mask, plate armor, knight")
P("무림맹추격대", "남", "wind-breaking sword of the alliance pursuit squad, thirties, stern righteous face, white and blue alliance uniform, sword drawn", "forest road at dawn")
P("혈수인", "남", "master of the red handprint, hooded figure, pale hand stained with blood red, face half hidden in shadow", "burned manor courtyard with red handprints on the walls", "맨", "weapon")
P("마교심판자", "남", "black punishment judge of the demonic cult, sixties, gaunt face, black judge robe, iron ledger in one hand, iron brush pen in the other", "edge of a blood lake in an underground cavern", "작")
P("권마의그림자", "남", "shadowy will of an ancient fist demon, translucent dark figure of a powerful old man, glowing eyes, bandaged fists, ink-like aura", "ancient stone cave with fist craters on the walls", "맨", "weapon")
P("백년천마잔영", "남", "shadow of the heavenly demon from a hundred years ago, young man in his twenties, cold beautiful face, long black hair, black robe with crimson trim, transparent ghostly edges, black aura", "natural rough rock cave for closed-door seclusion with carved walls", "맨", "weapon, gothic arch, pointed arch, cathedral, doorway, halo")
P("혈마미완", "남", "withered blood demon awakened without enough blood, gaunt tall figure in the center of the frame, cowboy shot, skin cracked like dry bark, glowing red eyes, long dark red hair, tattered crimson robe, red mist, dim red light from below", "dried cracked blood lake bed in an underground temple with stone pillars", "맨", "weapon, crown, tiny figure, far away")
P("화경마인", "남", "left guardian of the blood sect, red-haired demon, fifties, wild red hair loose, inhuman cold eyes, ash grey robe with crimson trim, saber", "stone altar of the blood sect in a misty mountain gorge, overcast grey sky, torches")
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
P("마교척살조", "녀", "crimson sleeve assassin of the demonic cult, twenties, cold beautiful face, black hair in a tight bun, black robe with long crimson sleeves, curved blade held low", "dark tiled rooftops of a chinese town at night, lanterns below, mist, no moon")
P("사파복수귀", "남", "vengeful unorthodox fighter called poison arm, thirties, one arm wrapped in black bandages, hateful eyes, flying knives", "funeral ground with white banners", "작")
P("마교암살귀", "남", "silent ghost assassin of the demonic cult, thin man in black, cloth over the mouth, dead eyes, thin blade", "alliance command tent at night")
P("천마사냥개", "남", "nine-blood demon hound, tracker of the heavenly demon, forties, beast-like face, sniffing, chain whip, fur collar over black armor", "snowy forest at night with blood trail")
P("포도대장", "남", "constable captain called iron claw, middle-aged man in his forties, weathered square face, thick short beard, crow's feet, dark red constable uniform with black trim, black official hat, iron gauntlet with hooked claws on the right hand, stern glare", "magistrate office courtyard")
P("동창추포대", "남", "arrest officer of the eastern depot, thirties, pale cruel face, brown official uniform, black hat, iron chain whip", "town gate at night with lanterns")
P("맹집법사", "남", "iron-faced judge of the martial alliance, middle-aged man in his fifties, stern square face with deep frown lines, greying short beard, black judge robe with silver trim, iron ruler tucked in the belt, sword held point down", "alliance court hall")
P("천하도전자", "남", "challenger who only duels famous masters, thirties, lean face, single saber, white headband, cold confidence", "cliff top at dawn")
P("십대고수", "남", "unmoving sword, one of the ten great masters, middle-aged man in his fifties, calm weathered face, neat greying beard, grey hair tied up, heavy calm presence, plain grey robe, both hands resting on the pommel of a sword planted point down", "mountain pavilion in rain")
P("강호승냥이", "남", "jackal who preys on the weak in wartime, forties, gaunt scarred face, stubble, cold greedy eyes, black hair in a messy topknot, east asian face, torn lamellar armor scraps over a dirty brown cross-collar robe, notched saber held low", "burned village with smoke at dusk", "무", "animal ears, kemonomimi, grin, teeth")
P("귀문술사", "남", "bone monk of the ghost gate sect, old man in his sixties, gaunt hollow-cheeked human face with sunken eyes, shaved head, grey robes, spear with a shaft woven of bones, ghost fires", "graveyard with blue ghost lanterns", "무", "skull, skull face, skeleton")
P("호교대", "남", "devotee of the demonic cult guard, twenties, detailed face, sharp fanatic eyes, thin lips, short black hair, black robe with crimson sash, long spear held upright", "black stone temple stairs with crimson banners at dusk", "무", "faceless, blank face, featureless face")
P("혈마귀졸", "남", "soldier of the blood demon corps, twenties, pale skin with faint red veins on the neck, dead calm dark eyes, short black hair, dark red lacquered armor pieces over black clothes, saber at the hip", "smoky battlefield at dusk, dark sky, broken banners")
P("떠돌이패", "남", "mercenary of the black wolf band, thirties, scarred east asian face, black hair tied back, wolf pelt over the shoulders, worn chinese lamellar vest over a dark robe, saber", "war-torn road with broken carts")
P("맹순찰조", "남", "patrol warrior of the martial alliance, twenties, upright serious face, white and blue alliance uniform, straight sword at the hip, holding an alliance token", "highway checkpoint with alliance banners")
P("적면마", "남", "red-faced old demon, old man in his seventies, deep reddish weathered complexion, deep wrinkles, wild white hair and long white beard, cold cruel eyes, thin cruel smile, black robe, long fingernails", "battlefield after the battle at dusk, crows", "맨", "weapon, hand on face, grin, teeth, bright red skin, demon, horns")
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
P("외전_곽승", "남", "demonic cult elder who guarded the blood lake for a hundred years, very old man, long white eyebrows tinged dark red drooping past the cheeks, bald crown with long snow-white hair at the back, east asian face, long white beard, deep wrinkles, black robe with crimson sleeves, gnarled black iron staff, commanding glare", "steep valley path at night leading to a blood lake, torches")
P("외전_혜명", "남", "head monk of the arhat hall of shaolin, fifties, shaved head with ordination scars, thick black eyebrows, square stern face, muscular, brown monk robe with sleeves tied back, long iron-bound wooden staff held across the body", "shaolin martial monks courtyard with stone floor, closed temple gate, morning mist")
P("외전_적암", "남", "old monk who guarded the scripture pavilion for forty years, eighties, long white eyebrows, thin weathered kind face, faded saffron robe, a cloth bundle of twelve scripture copies tied on the back, wooden walking stick", "mountain road leading away from shaolin at dawn, pine trees", "작", "sword")
P("외전_송결", "남", "second disciple of wudang who wants the gate closed, forties, stern disciplined face, neat black topknot with a wooden pin, short beard, grey taoist robe with yin yang emblem, sword moving in a circular guard", "wudang mountain gate with stone stairs and clouds")
P("외전_진무", "남", "first disciple of wudang leading his juniors on the battlefield, forties, tired resolute face, topknot loosened, grey taoist robe torn and stained by battle, straight sword held low", "battlefield at dusk with wudang banners and smoke")
P("외전_정심", "녀", "old chinese buddhist bhikkhuni guarding the emei discipline hall, woman in her sixties, completely shaved bald head, deep wrinkles, strict calm face, plain grey chinese monastic robe, brown kasaya, prayer beads on the wrist, sword raised", "emei temple hall with golden roof in clouds", "무", "hair, nun habit, veil, wimple, coif, christian nun, western nun, catholic, hood")
P("외전_묵현", "남", "cold blood elder of the demonic cult who hunts deserters to the end, sixties, gaunt cold face, thin grey mustache, slicked back grey hair, black robe with crimson sleeves, bare pale hands with long nails", "lonely mountain road at night with an abandoned cart", "맨", "weapon")
P("외전_갈무진", "남", "iron fist, leader of kongtong sect, fifties, broad heavy body, short grey beard, thick neck, brown and ochre robe with sleeves rolled up, huge scarred fists", "alliance meeting hall with a smashed wooden table", "맨", "weapon")
P("외전_구양열", "남", "yellow sand demon lord, demonic cult elder who rules the western trade road, sixties, sun-darkened leathery face clearly visible, grey beard, sharp eyes, desert turban without veil, black robe with crimson trim, sand swirling from his hands", "desert caravan road with ruined beacon towers and camels far away", "맨", "weapon, face veil, mask, face hidden, sun behind head")
P("외전_모용백", "남", "elder of the murong clan who keeps the genealogy, seventies, neat white beard, dignified face, white and blue robes, old silver spear held upright", "chinese ancestral hall with rows of wooden spirit tablets, red pillars and candles", "무", "gothic, church, cathedral, arch window, western interior")
P("외전_나곤", "남", "snow spear of changbai, forties, rugged weathered face, short black beard with frost, hair tied up with a fur-trimmed headband, heavy dark fur-lined chinese robe and fur cloak, long red-tasseled spear", "changbai mountains in deep snow, birch trees", "무", "ushanka, russian hat, fur hat")
P("외전_마철", "남", "twin hook blade of the debt collection hall, thirties, lean hard face, scar across the nose, black hair tied back, dark grey clothes, two hook swords held crossed", "debt collection hall with ledgers and hanging lanterns")
P("외전_사마주", "남", "iron abacus guardian of the unorthodox alliance ledgers, fifties, shrewd narrow eyes, neat goatee, black robe with crimson lining, heavy iron abacus held like a weapon", "ledger hall with stacked account books and candles", "작")
P("외전_제갈문", "남", "new master of the heavenly mechanism pavilion, thirties, sharp intelligent face, neat topknot with a silver crown, dark blue scholar robe, mechanical crossbow on the forearm, hand raised to signal", "room lined with mounted crossbows and gears", "작")
P("외전_공야반", "남", "ghost hand master craftsman, sixties, wiry body, grey hair tied up, sharp eyes, sleeves rolled up, leather apron with tools, a wooden ox automaton behind him", "workshop full of gears and wooden mechanisms", "작", "sword")
P("외전_육허", "남", "exorcist taoist abbot of the azure cloud temple, fifties, stern face, long black beard, black and yellow taoist robe, yellow paper talismans flying around, peachwood sword", "taoist temple courtyard at night with blue lanterns")
P("외전_엄대웅", "남", "greenwood king, old but mighty, sixties, huge frame, white bushy beard and eyebrows, tiger fur cloak over dark armor, heavy iron club planted beside him", "greenwood stronghold great hall with tiger skins and torches")
P("외전_단철웅", "남", "mountain-splitting axe, patrol chief of the greenwood, forties, huge muscular body, shaved head, east asian face, thick black beard, sleeveless dark hemp tunic with a fur mantle, broad cloth sash, huge chinese broad-bladed axe with a long handle on the shoulder", "mountain stronghold on a cliff")
P("외전_염칠", "남", "dice master, second table master of the black snake gang, thirties, sly handsome east asian face, long black hair tied in a low ponytail, black silk robe with gold snakes, three iron dice between fingers", "smoky gambling hall with lanterns", "작")
P("외전_하백", "남", "golden hand, first table master of the black snake gang, fifties, fat smiling east asian face, thin mustache, black hair in a topknot with a gold crown, luxurious black and gold robes, gold rings on every finger", "luxurious gambling hall with piles of silver", "작")
P("외전_육종", "남", "best swordsman of the imperial embroidered guard, forties, stern iron face, short beard, red flying fish robe, black gauze hat, spring saber held ready", "palace gate at night with lanterns")
P("외전_위소경", "남", "white-faced director of the eastern depot, middle-aged eunuch man in his fifties, pale powdered beardless face with fine wrinkles, narrow cunning eyes, thin smile, hair in a neat topknot with a small black official crown, purple silk robes with wide sleeves, holding a folded document", "palace office with screens", "작", "sword, wide hat, conical hat, beret")
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
P("외전_방노삼", "남", "white-haired ferryman who rowed fifty years, old man in his seventies, deeply wrinkled tanned face, white beard, wiry body, white hair tied back, straw hat on the back, long bamboo punting pole", "yellow river ferry crossing")
P("외전_곽호", "남", "black dragon of the yellow river water fortress, forties, sun-darkened, wet black clothes, iron harpoon", "yellow river water fortress")
P("외전_구참", "남", "old coastal garrison officer, sixties, tired scarred face, old armor, spear leaning beside", "coastal fortress wall at dusk")
P("외전_석무광", "남", "salt sea ghost, east sea pirate chief, forties, sea-weathered face, braided hair, iron hook spear", "pirate ship deck at sea in a storm")

# ---------------------------------------------------------------- 사건에만 나오는 이름 있는 상대(초절정 이상)
P("엄충", "남", "iron square hand, grain supply hall master of the demonic cult, fifties, stocky heavy body, square stern face, thick black beard, black robe with crimson sleeves over a padded vest, broad iron-plated forearm guards, standing guard", "huge granary warehouse with mountains of grain sacks, torches, snowy night", "맨", "weapon")
P("낙일봉무인", "남", "white-haired hermit swordsman of the setting sun peak, old man in his seventies, long white hair and beard, calm smiling eyes, faded grey robe, old sword held loosely", "mountain peak at moonrise, old pine, sea of clouds")
P("법목", "남", "blood sect ambush monk, thirties, shaved head, lean hard face, ash grey kasaya splashed with mud, red prayer beads, iron monk staff", "reed marsh beside a river ferry at dusk")
P("무각", "남", "blood blade executioner of the red canyon, forties, shaved head with a red cloth band, heavy-browed cruel face, bare muscular arms stained red, ash grey robe tied at the waist, huge broad executioner saber", "red rock canyon with a cave lit by red lanterns")
P("혁련수", "남", "vanguard captain of the demonic cult, fifties, sharp hawk-like face, grey streaked hair tied up, scar across the cheek, black lamellar armor with crimson cords, black cloak, bare hands with black aura", "frontier fort under siege at dusk, crimson banners", "맨", "weapon")
P("초량", "남", "black wind demon lord, demonic cult elder in charge of supplies, sixties, gaunt pale face, thin white beard, long black robe with crimson lining, dark wind swirling around the sleeves", "supply wagons on a mountain road at night", "맨", "weapon")
P("진후", "남", "exiled old general, sixties, weathered dignified face, grey beard, battered old armor over a plain robe, long halberd planted beside him", "frontier exile camp in the snow")
P("하진", "남", "patrol commander of the martial alliance, thirties, upright stern face, short beard, white and blue alliance uniform with silver trim, straight sword", "highway checkpoint with alliance banners")
P("오현철", "남", "captain of the iron blood corps of the regional army, forties, square hard face, short beard, heavy black lamellar armor, iron helmet under the arm, long glaive", "army camp gate with banners, dust")
P("곽준명", "남", "guardian elder of the martial alliance, sixties, stern dignified face, long grey beard, white alliance robe with gold trim, sword at the hip", "alliance hall with banners")
P("석담", "남", "ninth demon general drunken dream ghost, man in his forties, handsome dangerous face with faint stubble, half-closed languid eyes with a cold glint, thin smile, loose long black hair, black robe open at the chest with crimson lining, wine gourd in hand, faint dreamy mist around him", "dark pavilion with hanging lanterns and drifting mist", "맨", "weapon, blush, blushing, embarrassed, shy, open chest, cleavage")
P("혁천", "남", "envoy of the demonic cult, forties, cold polite face, neat beard, black robe with crimson sleeves, holding a sealed letter, hands folded", "inn courtyard at night", "작", "sword")
P("귀호", "남", "pursuit captain of the blood demon corps, thirties, pale face with red veins, wild black hair, blood red armor pieces over black clothes, two short sabers", "burning village at night")
P("철목", "남", "bodyguard captain of the unorthodox alliance, forties, huge muscular body, shaved head, black robe with crimson lining, iron staff", "warehouse dock at night")
P("모극", "남", "head envoy of the north sea ice palace, fifties, cold noble face, silver hair and beard, white fur cloak over pale blue robes, ice sword", "snowy road with an envoy procession")
P("적련", "녀", "envoy of the demonic cult called red lotus, twenties, beautiful cold smile, black hair in an elegant bun with a red lotus pin, crimson robe with wide sleeves", "rainy night street with red lanterns", "작", "sword")
P("오문철", "남", "vice captain of the heavenly demon guard, forties, stern expressionless face, full black armor with crimson trim, long halberd", "black stone gate in snow")
P("곡진", "남", "iron fist martial arts instructor of a town martial hall, man in his forties, broad muscular body, black hair in a short topknot, square weathered face with a short beard, sleeveless brown cross-collar training tunic, black sash, cloth-wrapped fists raised in a guard stance", "martial arts hall with a wooden floor and weapon racks", "맨", "weapon, modern clothes, karate gi, blue skin, spiky hair")
P("소칠", "녀", "night cat, chaser of the information network of the lowly, twenties, sly sharp face, black hair tied in a high ponytail, dark grey cross-collar tunic and trousers, cloth wrist wraps, black sash, throwing knives between fingers", "tiled rooftops of a town at night with lanterns", "작", "bob cut, short hair, modern clothes, moon, claws")
P("하후청", "남", "enforcement captain of the martial alliance, forties, iron-faced stern man, black and white alliance robe, sword and an iron token", "alliance court yard")
P("은거기인", "남", "hidden master in a pavilion, old man in his eighties, long white beard, serene smile, plain robe, teacup in hand, overwhelming calm presence", "lakeside pavilion in mist", "맨", "weapon")
P("여추", "남", "tenth demon general soul-severing wanderer, thirties, gaunt pale handsome face, long black hair, wide straw hat, black travel cloak, thin long sword", "lonely crossroads in rain at night")
P("혁련철", "남", "gate captain of the heavenly demon peak, forties, scarred fierce face, black armor with fur collar, heavy chain whip", "black stone stairs of the heavenly demon peak in snow")
P("마흥", "남", "gold claw, county constable chief, forties, cunning face, thin mustache, dark red constable robe, iron claw gauntlet with gold inlay", "magistrate office courtyard")
P("곽양", "남", "unorthodox grandmaster, sixties, heavy powerful build, grey beard, black and crimson robe, cold eyes, hands behind the back", "luxurious hall with screens", "맨", "weapon")
P("법천", "남", "high priest of the blood sacrifice, seventies, shaved head, deep wrinkles, long white eyebrows, crimson kasaya over ash grey robe, ritual staff with a red jewel", "blood altar with red candles", "작", "sword")
P("진숭", "남", "border army commandant, forties, stern weathered face, black beard, scale armor with red cloak, sword", "border fortress wall at dusk")
P("곽귀", "남", "king of tomb robbers, fifties, sly wrinkled face, sparse beard, dusty brown clothes, shovel slung on the back, holding a small paper lantern", "ancient chinese tomb entrance at night", "작", "sword, kerosene lamp, hurricane lamp, oil lantern, metal lantern")
P("곽수", "남", "traitorous guardian of the alliance called silver palm, fifties, smooth deceptive smile, grey beard, white alliance robe, silver glove on one hand", "alliance hall at night", "맨", "weapon")
P("파랑", "남", "black tooth poison insect shaman of the beast palace, forties, dark skin, blackened teeth, silver neck rings, indigo robes, insects crawling on his arms", "steaming southern jungle", "작")
P("사량", "남", "eleventh demon general poison dragon, forties, pale greenish skin, slit-pupil eyes, long black hair, black robe with green dragon embroidery, green poison mist from his hands", "poison swamp at night", "맨", "weapon")
P("소운진인", "남", "hermit taoist of wudang, seventies, gentle face, long white beard, grey taoist robe, horsetail whisk", "wudang mountain hermitage in clouds", "작", "sword")
P("유청운", "남", "plum blossom swordsman of mount hua, twenties, handsome serious face, topknot, white robe with plum blossom embroidery, sword", "mount hua cliff with plum blossoms")
P("마진", "남", "iron rake, ferry hall master of the unorthodox alliance, forties, rough scarred face, wet black robe, iron rake weapon", "river ferry at dusk")
P("구양천", "남", "elder of the martial alliance, seventies, dignified white beard, white robe with gold trim, staff", "alliance council hall", "작", "sword")
P("도각", "남", "iron bell necromancer monk of the ghost gate sect, man in his fifties, gaunt hollow-cheeked human face with sunken dark eyes, natural skin, shaved head, grey robe, small iron bell in one hand and a staff in the other, blue ghost fires floating around", "graveyard at night with blue lanterns", "무", "skull, skull face, skeleton, bone, undead, cross, christian cross, western gravestone, celtic cross")
P("마랑", "녀", "black spider, poison woman, thirties, pale beautiful face, dark lips, black hair with spider pins, black and purple robe, poison threads between fingers", "dark room with spider webs", "작")
P("상한", "남", "patrol captain of the ice palace, thirties, cold handsome face, silver hair, white fur armor, ice spear", "frozen sea at dusk")
P("육청", "남", "head plum blossom swordsman of mount hua, thirties, sharp proud face, topknot with a plum blossom pin, white and red robe, sword", "mount hua training ground with plum trees")
P("도곤", "남", "black hair pursuit captain of the blood guard, thirties, wild long black hair, shaved sides, ash grey robe, saber", "mountain path at night with torches")
P("구하", "남", "furnace keeper elder of the calamity fire hall, sixties, burn-scarred face, bald head, black robe, black flames on the hands, giant bronze furnace behind", "furnace hall glowing red", "맨", "weapon")
P("홍매", "녀", "red thread woman of the dark soul squad, twenties, beautiful cold face, black hair, dark red robe, red silk threads wrapped around the fingers", "silk shop at night with lanterns", "작")
P("단조", "남", "red fang, captain of the blood guard, forties, fierce face, red tattoos on the scalp, ash grey robe with crimson trim, twin sabers", "blood sect cave temple")
P("고담", "남", "blood lake keeper elder of the demonic cult, seventies, gaunt face, long grey hair, black robe with crimson sleeves, hands stained red", "edge of the underground blood lake", "맨", "weapon")
P("염교", "남", "blood collector of the blood sect, thirties, thin cruel face, shaved head, ash grey robe, bronze bowl and a curved knife", "village square with an iron cauldron", "작")
P("위소", "남", "young spearman, early twenties, eager fierce face, black hair in a high ponytail, simple dark blue clothes, long red-tasseled spear", "riverbank at dawn")
P("흑아", "남", "black fang, captain of the demonic cult beast core hunters, human man in his thirties, lean hard human face with a scar on the chin, sharp hunter eyes, black hair tied back, grey wolf pelt cloak over the shoulders, dark leather armor, coiled net on the hip, hooked spear", "dark forest with traps at night", "무", "furry, anthro, wolf head, animal head, kemono, animal ears")
P("구량", "남", "red-eyed demon, forties, shaved head, glowing red eyes, ash grey robe, bloody hands", "ruined temple at night", "맨", "weapon")
P("구호", "남", "blood-robed demon, thirties, pale face, long messy black hair, blood red robe, saber dripping", "battlefield at night")

# ---------------------------------------------------------------- 동료(결전에 달려오는 사람)
P("위무결", "남", "rival saber master of the clear river, twenties, fierce handsome face, short spiky black hair, dark blue robe, broad saber resting on the shoulder, competitive grin", "riverside at dawn")
P("소연화", "녀", "mistress of the medicine king valley, twenties, gentle beautiful face, long black hair with a jade pin, pale green robes, golden acupuncture needles between fingers", "herb garden valley with mist", "작", "sword")
P("석대우", "남", "iron wall great general who led a hundred thousand border soldiers, fifties, huge broad body, short grey beard, heavy black armor, tower shield and spear", "frontier fortress wall with banners")
P("묘아", "녀", "the greatest thief under heaven, twenties, playful sly smile, cat-like eyes, black hair tied in a short high ponytail, dark navy cross-collar night-walker tunic and trousers, cloth wrist and ankle wraps, black sash, holding a stolen green jade", "imperial palace tiled rooftops at night with lanterns", "작", "sword, modern clothes, bob cut, jacket, bodysuit")
P("무애", "남", "drunken monk, former head of the shaolin arhat hall, sixties, completely shaved bald head with ordination scars, red nose, jolly wrinkled face, big belly, patched brown monk robe, wine gourd in hand", "mountain tavern interior with wine jars", "맨", "weapon, hair, topknot, red sun, sun")
P("장칠", "남", "chief of all seventy-two greenwood strongholds, forties, rugged tanned face, short black beard, scar over the eyebrow, confident grin, black hair in a rough topknot, brown fur cloak over dark leather armor, hand axe at the belt", "greenwood fortress hall with torches", "무", "grey skin, pale skin, washed out")
P("적연", "녀", "crimson-robed rakshasa, former elder of the demonic cult, forties, beautiful fierce face, long black hair, crimson robe", "blood lake cave", "맨", "weapon")
P("연무휘", "남", "carefree sword, swordsman who left for the jianghu the same year, twenties, handsome cheerful face, white robe, sword", "town gate")
P("왕백로", "남", "noodle king, retired master who was one of the ten great masters thirty years ago, old man in his seventies, round kind wrinkled face, white mustache, grey hair in a small topknot, sleeves of a brown cross-collar robe tied back, plain cloth apron, hands dusted with flour, wooden rolling pin", "noodle shop kitchen", "작", "sword")
P("은비", "녀", "ageless elegant beauty, mature face, long straight silver hair flowing down, silver hairpin, golden eyes, 1.3::human ears, no animal ears::, hair covering ears, nine fluffy silver fox tails spreading behind, layered white and pale blue hanfu", "moonlit bamboo forest", "맨", "weapon, animal ears, fox ears, cat ears")
B("설백", "white tiger spirit beast, huge and noble, blue eyes, gentle but powerful", "snowy mountain forest")

# ---------------------------------------------------------------- 말로 만나는 사람
P("각명대사", "남", "abbot of shaolin, bald old monk in his seventies, shaved head, long white eyebrows drooping past the eyes, kind wise wrinkled face, red and gold kasaya over a brown robe, long prayer beads, one hand raised in blessing", "shaolin main hall with a great golden buddha and incense smoke", "맨", "weapon, hair, long hair, ponytail")
P("청허진인", "남", "leader of wudang in closed seclusion, eighties, ethereal serene face, long white hair and beard, white taoist robe, seated in meditation, faint white aura", "mountain cave on wudang peak with clouds", "맨", "weapon")
P("운암자", "남", "leader of mount hua sect, old man in his sixties, refined calm face, neat grey beard, white robe with plum blossom embroidery, facing the viewer, hands folded in front", "mount hua hall with plum blossoms outside", "맨", "weapon")
P("정연사태", "녀", "leader of emei sect, old chinese buddhist bhikkhuni in her sixties, completely shaved bald head, wrinkled serene face with gentle eyes, plain grey chinese monastic robe, golden-brown kasaya, long prayer beads, palms together", "emei golden temple hall with incense", "맨", "weapon, hair, nun habit, veil, wimple, coif, christian nun, western nun, catholic, hood")
P("청송자", "남", "leader of qingcheng sect, sixties, gentle taoist, thin grey beard, grey topknot, green taoist robe, holding a taoist fly whisk with a wooden handle and long white horsehair", "qingcheng temple among pines", "맨", "weapon, whisk, kitchen")
P("당천기", "남", "ten thousand poisons hand, head of the tang clan, sixties, cold elegant face, thin black and grey beard, dark green robes with gold trim, black gloves", "tang clan hall with bamboo screens", "맨", "weapon")
P("모용진", "남", "head of the murong clan, fifties, noble handsome face, short beard, white and sky blue robes, jade pendant", "murong manor by the lake", "맨", "weapon")
P("제갈현", "남", "head of the zhuge clan, fifties, wise calm face, long beard, blue scholar robe, white feather fan", "study with maps and models", "작", "sword")
P("설란", "녀", "ice queen of the north sea ice palace, forties, regal cold beauty, long silver hair, ice blue eyes, white fur cloak, crown of ice crystals", "ice palace throne hall", "맨", "weapon")
P("위숙", "남", "old librarian of the martial alliance archives, seventies, thin body, long grey beard, ink-stained fingers, faded blue robe, arms full of old scrolls", "alliance archive with tall shelves", "작", "sword")
P("붉은옷여인", "녀", "mysterious woman in crimson from the demonic cult, twenties, captivating smile, long black hair, crimson robe with wide sleeves, offering a red pill on her palm", "rainy inn at night", "작", "sword")
P("신교사자", "남", "envoy of the demonic cult, thirties, polite cold smile, neat topknot, black robe with crimson sleeves, bowing slightly while holding a rolled paper scroll tied with red cord", "inn courtyard at dusk", "작", "sword, phone, smartphone, card, tablet")
P("수상한누군가", "남", "mysterious peddler, deep hood hiding the upper face, faint knowing smile, patched dark cloak, a wooden cart full of rare treasures and scrolls", "foggy crossroads at night with a single lantern", "작", "sword")
P("장터상인", "남", "market merchant, forties, friendly round east asian face, small black mustache, black hair under a black cloth merchant cap, brown cross-collar merchant robe, abacus in hand", "busy market street with stalls", "작", "sword")
P("객잔주인", "녀", "inn owner, forties, sharp but warm face, hair in a bun with a wooden pin, apron over a dark red dress, holding a ledger", "inn hall with wooden tables", "작", "sword")
P("점소이", "남", "inn waiter boy, late teens, cheerful face, white towel over the shoulder, carrying a tray with a teapot", "inn hall with lanterns", "작", "sword")
P("의원", "남", "village doctor, sixties, kind face, grey beard, plain blue robe, wooden medicine box on the shoulder", "clinic with herb drawers", "작", "sword")
P("대장장이", "남", "chinese village blacksmith, forties, east asian face, black hair tied in a topknot with a cloth band, muscular sweaty arms, sleeves of a cross-collar hemp tunic rolled up, cloth apron, soot on face, hammer in hand", "forge with glowing coals and sparks", "작", "sword")
P("장원집사", "남", "manor steward, fifties, neat grey beard, dark robe, respectful bow, ledger under the arm", "manor courtyard with a pond", "작", "sword")
P("표국국주", "남", "head of an escort agency, fifties, stern dignified face, grey beard, brown robe, escort banner behind", "escort agency yard with carts", "맨", "weapon")
P("촌장", "남", "village elder, seventies, white beard, kind tired face, plain robe, walking cane", "village gate with an old tree", "작", "sword")
P("기녀", "녀", "courtesan musician, twenties, elegant beauty, hair ornaments, silk robes, holding a pipa", "pleasure house with silk curtains", "작", "sword")
P("서생", "남", "young chinese scholar, twenties, gentle timid face, black futou scholar cap, light blue scholar robe, holding a thread-bound book", "study with books and a lattice window", "작", "sword, mortarboard, graduation cap, square academic cap")
P("포두", "남", "local constable, middle-aged man in his forties, strict weathered face, short black beard, dark red and black traditional constable robe, soft black cloth headwrap of a ming dynasty yamen runner, saber at the hip", "magistrate office courtyard in daylight, grey stone and wooden buildings", "무", "monochrome red, red tint, red background, peaked cap, military cap, police hat, visor, modern uniform")

# ---------------------------------------------------------------- 짐승과 영물
B("늑대무리", "pack of starving winter wolves, thin grey wolves with bared fangs, glowing eyes", "snowy forest at night")
B("멧돼지떼", "herd of four enraged wild boars with long tusks charging across a ruined field, bristly dark brown fur, kicked up dirt, daylight", "destroyed mountain farm field at morning", "silhouette, backlit")
B("독사떼", "dozens of venomous vipers coiling over each other, several raising their heads and baring fangs, green and black scales, forked tongues", "rocky valley floor covered with snakes, fog")
B("불곰", "huge fierce brown bear standing on hind legs, roaring", "autumn mountain forest")
B("식인호랑이", "man-eating tiger, scarred, crouching to pounce, burning eyes", "dark bamboo forest")
B("왕지네", "giant centuries-old centipede, armored black and red segments, many legs", "damp cave")
B("설표", "snow leopard on a cliff, pale spotted fur, piercing eyes", "snowy mountain pass")
B("금안조", "giant golden-eyed divine eagle with spread wings", "cliff top above clouds")
B("백액호", "huge white-browed king tiger, orange fur with black stripes, white fur on the brow, the chinese character wang marked in the stripes on its forehead, majestic, standing on a rock", "mountain shrine forest")
B("철갑현귀", "colossal thousand-year black turtle with an ancient carved stone stele standing on its shell, moss and runes on the shell, wise old eyes, head raised, emerging from a misty lake", "ancient lake shore at dawn with mist and old pines", "silhouette, backlit, dark shape")
B("이무기", "thousand-year serpent dragon without horns, giant, coiled in a pond", "mountain pond under storm")
B("천년혈망", "colossal thousand-year python with dark crimson scales, body thick as a tree trunk, coiling around ancient tree roots, menacing golden slit eyes, head raised, mist", "dark swamp with dead trees at dusk", "cartoon, cute, simple")
B("만년빙잠", "giant ten-thousand-year ice silkworm larva, segmented plump caterpillar body, translucent white like jade, frost crystals on its body, cold mist breathing out", "ice cave")
B("금섬", "giant golden toad breathing poison mist", "poison marsh")
B("불가사리", "ancient iron-eating beast bulgasari, bear-like body with an elephant-like trunk and rhinoceros eyes, hide of dark iron plates with rust, needle-like bristles, glowing eyes, chewing on a broken sword", "ruined forge")
B("천년백사", "huge thousand-year white serpent with pearly scales, head raised with golden eyes clearly visible, coiled around a glowing spirit herb on a cliff ledge", "cliff garden with clouds and rare herbs", "headless, no head")
B("흑룡", "chinese long dragon with black scales and long whiskers rising out of a deep pool, head clearly visible with glowing golden eyes, serpentine body coiled, lightning lighting it from the front", "deep mountain pool under a thunderstorm", "silhouette, backlit, western dragon, wings")
B("해치", "haetae, divine lion-like beast with one horn, judging", "ancient palace courtyard")
B("외전_백공", "giant white ape guardian with long arms, wise eyes", "jungle throne ruins")

# ---------------------------------------------------------------- 사건 배경
S("천마봉", "the heavenly demon peak, a jagged black mountain piercing crimson storm clouds, stone stairs carved up the cliff, crimson banners, snow")
S("천마봉_정상", "flat snowy summit of a black mountain, an empty black stone throne carved with dragons on a stone dais, black stone pillars with crimson banners, crimson lightning in the dark sky, sea of clouds below", "pagoda, tower, temple, building")
S("피연못", "vast underground cavern with a still lake of dark red blood, ancient carved stone pillars and a stone altar at the edge, red mist low over the surface, beams of pale light from cracks above, torches along the walls")
S("혈교산사", "blood sect mountain temple, grey stone buildings, red banners, red sunset, crows")
S("낙양_불", "the city of luoyang burning at night, pagodas and city walls on fire, smoke and sparks")
S("태산_비무대", "large square stone martial arts tournament stage on a mountain plateau of mount tai, surrounded by wooden spectator stands and tall colorful sect banners on poles, empty stage, sea of clouds and distant peaks behind, bright daylight")
S("무림맹_본청", "grand hall of the martial alliance, tall pillars, banners of nine sects and five clans, long table")
S("소림사", "shaolin temple compound on songshan mountain, long stone stairway up to a red temple gate with a big plaque, grey tiled halls, stone pagoda forest beside, old cypress trees, morning mist and sunlight", "lake, river, water")
S("무당산", "wudang mountain taoist palace complex built along steep green peaks, red walls and green-glazed tiled roofs with upturned eaves, long stone stairways, golden summit hall on the highest peak, sea of clouds, morning sun", "pagoda, japanese architecture, castle")
S("화산", "narrow wooden plank walkway bolted to the sheer granite cliff face of mount hua, iron chains as handrails, dizzying drop below, jagged granite peaks, a few plum trees blooming on ledges, small taoist pavilion on a far peak, morning mist")
S("아미금정", "golden summit temple of mount emei above the sea of clouds")
S("곤륜설산", "kunlun snowy mountain sect gate in a blizzard")
S("객잔", "interior of a roadside inn, wooden tables and benches, wine jars, warm lanterns, wooden staircase to the second floor, counter with an abacus, evening warm light through paper windows")
S("장터", "bustling market street of a chinese town, stalls, banners, lanterns")
S("표국", "outdoor courtyard of an escort agency under open sky, seen from the main gate, wooden escort carts loaded with crates in the yard, tall red triangular escort banner flags on poles, weapon racks with spears, grey tiled roof buildings around, morning light", "indoors, interior, curtains")
S("고갯길", "narrow dirt road winding through a high mountain pass between rocky cliffs, twisted pines, a stone marker by the road, dusty afternoon light, no river")
S("장강", "great yangtze river with boats and cliffs at dusk")
S("녹림산채", "bandit stronghold in a pine forest on a mountain slope, tall sharpened log palisade wall, wooden gate with watchtowers, rough log cabins and thatched huts inside, torches and black banners, dusk")
S("하오문_골목", "dark back alley with red lanterns, rain, wet stones")
S("기루", "elegant pleasure house interior, silk curtains, red lanterns")
S("관아", "courtyard of a county magistrate office seen from the main gate, big red complaint drum on a wooden stand, pair of stone lions, red pillared hall with a black plaque, stone-paved yard, daylight")
S("장원", "traditional chinese courtyard manor seen from inside the front courtyard at eye level, white walls with grey tiled roofs, a moon gate leading to inner courtyards, a lotus pond with a small stone bridge and pavilion, willow trees, warm afternoon light", "aerial view, bird's-eye view, from above")
S("연무장", "open-air martial arts training ground in a manor courtyard at dawn, packed earth yard with wooden training dummies, weapon racks holding spears, staffs and swords, stone lifting weights, a drum, surrounding grey walls and a small pavilion, light mist", "empty square, stage")
S("서고", "ancient library with tall shelves of scrolls, candlelight")
S("약방", "herbal medicine shop with drawers, hanging herbs")
S("비동", "secret stone cave for closed-door seclusion, rough rock walls covered with carved reliefs of small human figures in martial arts stances and columns of ancient chinese script, a flat stone meditation platform in the center, a single beam of light from a crack above, dust in the air", "smooth walls, empty walls")
S("북해빙궁", "chinese-style palace complex built of white ice and blue ice blocks on a frozen northern sea, curved ice roofs with upturned eaves, ice pillars and a great ice gate, glaciers behind, faint aurora in the night sky, snow")
S("남만밀림", "southern jungle with giant trees, poisonous fog, ruined temple")
S("다리밑", "under an old stone arch bridge at night, river with floating lanterns")
S("무덤", "a single earthen burial mound with a small upright stone grave tablet on a grassy hill, an old bare tree beside it, fallen autumn leaves blowing in the wind, wide valley below, overcast evening")
S("정마대전", "great battlefield between orthodox and demonic armies, banners, smoke, fallen weapons")
S("청운장", "massacred manor at night, broken doors, red handprints on walls, scattered lanterns")
S("신교분타", "demonic cult branch fortress, black walls, crimson banners, burning")
S("설산고개", "snowy high mountain pass, blizzard, narrow trail")
S("대나무숲", "dense bamboo forest with moonlight and mist")
S("산정_일출", "mountain summit at sunrise above a sea of clouds, old pine")

# ---------------------------------------------------------------- 사건 배경 더하기(사문, 깊은 강호, 외전)
S("종남산", "zhongnan mountain sect gate, long straight stone stairway through dark pines up to a grey tiled gate hall, morning mist, steep ridges")
S("점창산", "diancang sect on cangshan mountain, temple halls on a green ridge above erhai lake, clouds at the peaks, bright morning")
S("청성산", "a taoist temple of qingcheng sect with grey tiled roofs and red pillars, clearly visible in the middle ground, nestled in a dense green pine and cypress forest on a mountain slope, mossy stone steps leading to its gate, quiet mist")
S("공동산", "kongtong mountain sect on rugged loess cliffs of the northwest, temple buildings on bare yellow rock, wind and dust, evening")
S("당가", "tang clan manor in sichuan, dark walls surrounded by a bamboo forest, green tiled roofs, drifting mist, a medicine garden")
S("모용세가", "murong clan manor in suzhou, elegant garden with lake, rock garden, covered corridors, white walls, willows, spring")
S("제갈세가", "zhuge clan estate at longzhong, thatched study halls among hills, a mechanism tower with wooden gears, bamboo grove")
S("남궁폐허", "ruins of a burned chinese noble clan manor at dusk, charred wooden pillars and fallen grey roof tiles, a collapsed wooden gate with a scorched plaque, broken stone lions, torn sky blue banners, drifting embers and ash", "western ruins, greek columns, stone columns, temple ruins, gothic")
S("팽가폐허", "ruined courtyard of a saber clan house at night in heavy rain, broken wooden gate, cracked stone tiger statue, puddles reflecting lanterns")
S("개방총타", "headquarters of the beggar sect in a ruined old temple by a river, patched tents and bamboo poles, cooking fires, evening")
S("사도련본단", "headquarters of the unorthodox alliance, a fortified black-walled mansion on a river port, crimson lanterns, guarded gates, night")
S("살막", "hidden assassin house inside a quiet mountain teahouse at night, paper lanterns, a hidden door behind shelves, mist")
S("장경각", "shaolin scripture pavilion, tall multistory wooden library with shelves of sutras, dust in beams of light, quiet")
S("천기각", "workshop interior of a mechanism master, large wooden gears and cogwheels on the walls, a wooden ox automaton on the floor, racks of crossbows, scattered blueprints on a long table, oil lamps, warm light", "empty room, throne, door")
S("겁화전", "dark stone hall with a colossal round bronze cauldron furnace in the center, black and red flames rising from its mouth, iron chains hanging from the ceiling, glowing embers on the floor, smoke, red light on carved pillars", "gothic arch, church, door, gate")
S("흑수동", "black water cave, a dark underground river in a vast cave, black water reflecting faint torchlight, stone cells carved in the walls")
S("검문소", "ancient chinese checkpoint on an unpaved dirt mountain road, a wooden barrier pole on two posts across the road, a small wooden guard hut with a grey tiled roof, cloth banners on bamboo poles, a horse cart and travelers with bundles waiting, pine slopes, dusk", "asphalt, paved road, road markings, modern road, guardrail, power lines, street lamp, bunting")
S("경매장", "underground auction house, crowded tiered wooden seats, a lit stage with a display table, lanterns and smoke, night")
S("혼례장", "traditional chinese wedding hall decorated in red, red lanterns and silk, double happiness ornaments, candles, banquet tables")
S("형장", "public execution ground in a chinese town square under grey rain, a raised wooden platform with a chopping block in the center, wooden posts, a magistrate canopy with a table at the side, empty wet stone square, bleak", "pier, dock, sea")
S("산해관", "great frontier pass gate at the end of the great wall by the sea, massive stone gate tower, banners, cold wind, dusk")
S("서역길", "silk road through a desert, ruined beacon towers, sand dunes, a caravan of camels in the distance, burning sunset")
S("초원", "vast northern grassland with felt tents, horses grazing, wide sky, distant mountains, wind over the grass")
S("황하나루", "ferry crossing on the muddy yellow river, tall loess cliffs, wooden ferry boats, mist over the water")
S("위소성벽", "ruined coastal garrison fortress walls by a stormy sea, broken battlements, tattered banners, crashing waves")
S("해적선", "deck of a chinese junk ship on a dark stormy sea, red-brown battened junk sails with bamboo ribs, wooden deck with ropes and barrels, swinging paper lanterns, lightning", "galleon, western ship, square sails, european ship")
S("수채", "river bandit water fortress of wooden houses on stilts above a reedy river, wooden walkways and watchtowers made of logs and bamboo, small boats moored below, banners, dusk", "stone castle, european castle, fortress walls")
S("폐광", "abandoned silver mine entrance in a dry mountain, wooden supports, rusted carts on rails, dust")
S("빙원", "endless frozen plain under a pale sky, ice ridges, blowing snow, a lone trail of footprints")
S("귀문교", "ghost gate cult temple at night, blue ghost lanterns hanging from bare trees, old graves, a dim temple hall")
S("무승원", "open-air courtyard of shaolin warrior monks, outdoors, large stone-paved yard with shallow footprint hollows worn into the stones, rows of wooden training dummies and weapon racks with staffs, temple halls with grey roofs around, morning light and mist", "indoors, interior, room")
S("봉마진", "ancient battlefield with a giant carved stone seal formation on the ground, broken weapons, runes, eerie dusk")
S("정자", "lakeside pavilion with a tea table in morning mist, willows, still water, mountains far away")
S("주루", "busy two-story restaurant tavern interior, wooden balconies, red lanterns, round tables, evening crowd noise implied")
S("나루", "small river ferry dock at dawn, wooden pier, moored boats, reeds, mist over the water")
S("산채_밤", "mountain bandit stronghold at night, sharpened log palisade wall and wooden gate with watchtowers, rough log huts inside, several roaring bonfires, black banners, torches, cliffs and stars above")

# ---------------------------------------------------------------- 사건에만 나오는 이류에서 절정까지의 상대(이름 있거나 생김새가 다른 사람). 키는 사_로 시작
F = [
 ("사_떠돌이무사하진", "남", "wandering swordsman, late twenties, lean tired face, stubble, black hair tied back, faded grey travel robe, straw hat on the back, plain saber", "rainy mountain road", "무"),
 ("사_야행객흑묘", "남", "night walker thief called black cat, twenties, sly narrow eyes, black cloth over the lower face pulled down, black tight night clothes, short dagger", "tiled rooftops at night", "작"),
 ("사_왈패두목칠복", "남", "thug boss who extorts inns, forties, fat greasy face, thin mustache, gaudy brown silk robe, wooden club on the shoulder, sneer", "roadside inn front", "무"),
 ("사_무관주곽도명", "남", "master of a small town martial hall, fifties, stern face, grey-streaked beard, dark martial hall robe, saber", "martial hall courtyard with weapon racks", "무"),
 ("사_쌍작살강두", "남", "elite river raider with twin harpoons, thirties, sunburnt face, headband, wet sleeveless vest, two short harpoons", "river fortress dock", "무"),
 ("사_흑편노삼", "남", "squad leader of the demonic cult crimson sleeves called black whip, thirties, scarred cheek, black robe with crimson sleeves, coiled black leather whip", "night street", "작"),
 ("사_지객승혜정", "남", "guest-receiving monk of shaolin, forties, shaved head, calm stern face, brown monk robe, wooden staff", "shaolin gate", "무"),
 ("사_운계진인", "남", "mount hua elder taoist, sixties, grey beard, plum blossom robe, sword", "mount hua cliff path", "무"),
 ("사_혈승법담", "남", "blood sect monk, thirties, shaved head, ash grey kasaya, red prayer beads, iron staff", "grey mountain road", "무"),
 ("사_징혈승법조", "남", "blood collecting monk, forties, shaved head, thin cruel face, ash grey kasaya, bronze bowl and curved knife", "village square", "작"),
 ("사_적수마랑", "남", "envoy of the demonic cult crimson sleeves, thirties, cold handsome face, black robe with crimson sleeves, curved blade", "inn courtyard at dusk", "무"),
 ("사_대장장이아들석두", "남", "blacksmith's son with dark flame inside, early twenties, broad shoulders, soot on cheek, dark flame veins under the skin, sleeveless hemp tunic, hammer", "village forge at night", "무"),
 ("사_흑염사도견", "남", "furnace keeper of the calamity fire corps, thirties, burn scars, black robe, black flames on the hands", "dark furnace hall", "맨", "weapon"),
 ("사_겁화추격조장마영", "남", "pursuit captain of the calamity fire corps, thirties, sharp eyes, black armor with glowing red cracks, saber", "burning forest road at night", "무"),
 ("사_웃는맹무인", "남", "alliance warrior who cannot stop smiling, thirties, frozen eerie smile, faintly glowing ember eyes, white and blue alliance uniform, sword", "alliance camp at dusk", "무"),
 ("사_윤소겸", "남", "young disciple who doubts his master, early twenties, anxious tense face, black hair in a topknot, plain sect robe, sword", "mountain sect courtyard", "무"),
 ("사_법정", "남", "blood sect monk with a porridge cauldron in a market, forties, shaved head, kind-looking but cold eyes, ash grey kasaya, ladle", "busy market with a big iron cauldron", "작", "sword"),
 ("사_내단사냥꾼갈귀", "남", "demonic cult beast core hunter, thirties, wolfish lean face, fur cloak, coiled rope net, hooked spear", "dark forest with traps", "무"),
 ("사_철완노상", "남", "martial hall teacher with hidden fire, fifties, heavy iron bracers, grey beard, stern face with faint ember glow in the eyes, training robe", "martial hall at night", "맨", "weapon"),
 ("사_칼자국표두", "남", "escort chief with three scars on his face, forties, hard face with three parallel scars, brown escort uniform, broad saber", "escort caravan on a mountain road", "무"),
 ("사_비무초친아가씨", "녀", "young lady holding a marriage-by-duel tournament, late teens, proud beautiful face, black hair with gold ornaments, red martial dress, sword held confidently", "town square with a duel stage and red banners", "무"),
 ("사_파랑귀곽삼", "남", "river pirate called wave ghost, thirties, wild wet hair, tattooed arms, sleeveless dark vest, harpoon", "river boat in a storm", "무"),
 ("사_보물꾼탁삼", "남", "treasure hunter swordsman, thirties, cunning face, dusty travel robe with many pouches made of cloth, map scroll, sword", "ancient ruins entrance", "무"),
 ("사_백호기양", "남", "imperial embroidered guard centurion, thirties, sharp stern face, red flying fish robe, black gauze hat, spring saber", "government office at night", "무"),
 ("사_조철", "남", "attendant warrior of an alliance guardian, twenties, earnest face, white and blue alliance uniform, sword", "alliance hall corridor", "무"),
 ("사_염무", "남", "vice hall master of the unorthodox alliance, thirties, slick cunning face, black robe with crimson lining, twin hook swords", "dock warehouse at night", "무"),
 ("사_법운", "남", "blood sect tax-collecting monk, forties, shaved head, heavy-lidded eyes, ash grey kasaya, red ledger and iron staff", "village gate", "무"),
 ("사_노귀방삼", "남", "reed fortress chief called old turtle, fifties, wrinkled sunburnt face, sparse beard, straw raincoat, long boat hook", "reed marsh at dawn", "무"),
 ("사_구봉", "남", "seventh evil of the evil ghost valley, thirties, gaunt pale face, long messy black hair, dark green robe, poison-coated thin sword", "misty valley of dead trees", "무"),
 ("사_칼집도객", "남", "saber wanderer with pictures painted on his scabbard, thirties, calm face, black hair tied back, dark robe, saber in a painted scabbard", "inn courtyard", "무"),
 ("사_독푸는복면인", "남", "masked poisoner at a well, black cloth mask over the face except the eyes, dark clothes, small poison vial", "village well at night", "작"),
 ("사_화적대장", "남", "fire bandit chief, forties, burly, beard, scorched hemp clothes, torch and saber", "burning village", "무"),
 ("사_호삼", "남", "hidden assassin, thirties, plain forgettable face, grey clothes, thin dagger hidden in the sleeve", "crowded street", "작"),
 ("사_밀주왕염대", "남", "king of moonshine smuggling, forties, red nose, round face, brown robe, wine jar and cleaver", "smuggler warehouse with wine jars", "무"),
 ("사_백하", "남", "first disciple of kunlun, twenties, cold handsome face, white kunlun robe, sword", "kunlun snow pass", "무"),
 ("사_탁맹", "남", "unorthodox master hunting snow ginseng, forties, scarred face, fur cloak, saber", "snowy mountain forest", "무"),
 ("사_윤태석", "남", "zhongnan disciple called straight sword, twenties, upright stern face, dark blue zhongnan robe, sword pointed forward", "zhongnan mountain steps", "무"),
 ("사_탁운경", "남", "zhongnan swordsman, thirties, proud face, dark blue robe, sword", "zhongnan pine forest", "무"),
 ("사_노안", "남", "eastern depot officer called white face, forties, pale powdered beardless face, brown official robe, black hat, thin saber", "government office corridor", "무"),
 ("사_위경", "남", "eastern depot squad leader, thirties, cold eyes, brown official uniform, iron chain", "town gate at night", "작"),
 ("사_곽두", "남", "dog-beating elder of the beggar sect council, fifties, scruffy beard, patched clothes with many knots, green bamboo staff", "under a stone bridge", "무"),
 ("사_맹철", "남", "tiger mountain fortress chief called great blade, forties, huge body, thick beard, tiger fur mantle, giant saber", "mountain stronghold gate", "무"),
 ("사_모용현", "남", "jade-faced young master of the murong clan, twenties, beautiful arrogant face, white and blue robes, silver spear", "suzhou garden", "무"),
 ("사_사무쌍", "남", "assassin who speaks by sound transmission, thirties, silent pale face, black hood, thin sword", "dark rooftops", "무"),
 ("사_곽칠살막", "남", "assassin house contact, thirties, sly eyes, merchant disguise, hidden thin blade", "teahouse at night", "작"),
 ("사_곽운", "남", "wanderer called single wood, thirties, rugged face, wooden staff and worn robe", "war-torn road", "무"),
 ("사_사칠", "남", "twin assassin, twenties, identical cold face, black clothes, twin daggers", "rooftop at night", "작"),
 ("사_파계승혜진", "남", "fallen monk who broke his vows, thirties, shaved head growing stubble, wild eyes, torn monk robe, iron staff", "ruined temple", "무"),
 ("사_혜강", "남", "pursuing shaolin monk, thirties, shaved head, stern face, brown robe, staff", "mountain road", "무"),
 ("사_꼭두각시", "남", "living puppet controlled by threads, expressionless pale doll-like man, empty eyes, torn robe, faint silver threads from above", "dark hall with hanging threads", "맨", "weapon"),
 ("사_밀수왕파대", "남", "king of smugglers, fifties, heavy body, gold ring, black silk robe, saber", "river dock at night", "무"),
 ("사_유갑", "남", "demonic cult outpost captain called iron eye, forties, iron eyepatch, black robe with crimson trim, saber", "mountain outpost", "무"),
 ("사_염철수", "남", "black path grandmaster, fifties, stern heavy face, black robe, iron fan", "luxurious hall", "작"),
 ("사_곽맹", "남", "seven treasures fortress chief, forties, burly, gold earrings, fur vest, saber", "bandit fortress", "무"),
 ("사_혁패", "남", "demonic cult guard captain, thirties, fierce face, black robe with crimson sash, long spear", "demonic temple stairs", "무"),
 ("사_법경", "남", "blood sect pursuit monk, thirties, shaved head, red eyes, ash grey robe, saber", "mountain road at night", "무"),
 ("사_혁철", "남", "captain of the demonic cult guard, forties, scarred face, black armor with crimson cords, halberd", "black stone gate", "무"),
 ("사_구가", "남", "bearded bandit who robbed travelers, forties, huge beard, ragged clothes, rusty saber", "mountain pass", "무"),
 ("사_최삼", "남", "manor servant chief hunting runaway slaves, forties, mean face, servant robe, wooden club", "manor gate", "무"),
 ("사_마량무관", "남", "town martial hall master called iron fist, forties, broad body, short beard, training robe, wrapped fists", "martial hall", "맨", "weapon"),
 ("사_염가", "남", "poison thug hired by an innkeeper, thirties, sallow face, dirty clothes, poison vial", "inn back room", "작"),
 ("사_장팔", "남", "bodyguard of a drunken young master, thirties, bored tough face, dark guard uniform, saber", "pleasure house street", "무"),
 ("사_허팔", "남", "gambling den owner called hook, forties, sly grin, black silk robe, dice", "gambling den", "작"),
 ("사_염구", "남", "second chief of a bandit fortress called twin axes, thirties, fierce face, fur vest, two hand axes", "bandit fortress", "무"),
 ("사_아골", "남", "frontier horse bandit chief called black wind, forties, weathered face, fur hat, curved saber", "frontier steppe", "무"),
 ("사_흑피리곽두", "남", "child trafficker called black flute, forties, sinister thin face, black robe, bamboo flute", "war-torn village", "작", "sword"),
 ("사_소하", "남", "rising young swordsman of the north called clear river sword, twenties, handsome confident face, white robe, sword", "riverside", "무"),
 ("사_노진", "남", "soldier captain guarding a labor officer, thirties, stern face, chinese lamellar armor, spear", "village road", "무"),
 ("사_갈백", "남", "wandering poison master called ghost hand, forties, pale greenish face, black robe, poison mist", "swamp", "맨", "weapon"),
 ("사_장칠상여", "남", "smuggler disguised as a funeral bearer, forties, 1.3::coarse white hemp mourning clothes, white hemp headband of mourning::, long wooden coffin carrying pole", "funeral procession road", "무"),
 ("사_우칠", "남", "river pirate called water snake, thirties, slim body, wet clothes, short spear", "river at dusk", "무"),
 ("사_여소", "녀", "assassin disguised as a silk merchant called silver needle, twenties, beautiful calm face, silk merchant dress, silver needles between fingers", "silk shop", "작"),
 ("사_구상", "남", "one-eyed warrior who tears down martial hall plaques, thirties, eyepatch, rough face, saber", "martial hall gate with a plaque", "무"),
 ("사_곽평", "남", "murong clan guard captain called iron spear, thirties, stern face, white and blue guard uniform, iron spear", "murong manor gate", "무"),
 ("사_혜명나한", "남", "shaolin arhat hall warrior monk, thirties, shaved head, muscular, brown robe, staff", "shaolin courtyard", "무"),
 ("사_당백호", "남", "tang clan flying knife captain, thirties, cold face, dark green tang robe, flying knives between fingers", "sichuan bamboo forest", "작"),
 ("사_조삼", "남", "shadow of the information network of the lowly, twenties, nondescript face, grey clothes, throwing knives", "back alley", "작"),
 ("사_도천", "남", "greenwood pass chief called pickaxe, forties, muscular, fur vest, iron pickaxe", "mountain pass", "무"),
 ("사_염추", "남", "accountant of the unorthodox alliance, thirties, thin face, small mustache, black robe, abacus", "ledger room", "작"),
 ("사_귀영살수", "남", "assassin house killer called ghost shadow, twenties, black mask, black clothes, thin blade", "rooftops at night", "무"),
 ("사_전팔", "남", "black snake gang street hall master called two ears, thirties, notched ear, black robe, saber", "market street", "무"),
 ("사_곽청", "남", "iron sword corps warrior of a noble clan, twenties, disciplined face, clan uniform, straight sword", "clan warehouse", "무"),
 ("사_도각승병", "남", "warrior monk guarding bones, thirties, shaved head, grey robe, iron staff", "graveyard", "무"),
 ("사_심곽", "남", "poison hand behind a fake pharmacy, forties, sly face, merchant robe, poison needle", "pharmacy", "작"),
 ("사_구양휘", "남", "demonic cult guard squad leader called cold blood, thirties, cold face, black robe with crimson sash, spear", "night road", "무"),
 ("사_모용선", "남", "direct heir of the murong clan, twenties, arrogant handsome face, white and blue robe, spear", "murong training ground", "무"),
 ("사_염광", "남", "shanxi branch master of the demonic cult called black hand, forties, black robe with crimson sleeves, blackened hands", "branch hall", "맨", "weapon"),
 ("사_흑접", "녀", "assassin house killer called black butterfly, twenties, cold beautiful mature face, black hair tied in a tight high ponytail, black fitted clothes with butterfly embroidery, twin thin blades", "dark tiled rooftops of a chinese town at night with lanterns below", "작", "moon, full moon, cute, round eyes"),
 ("사_황구", "남", "gang boss called twin sabers, forties, scarred face, black vest, twin sabers", "town street", "무"),
 ("사_위호", "남", "alliance patrol captain called sky-piercing halberd, thirties, upright face, alliance uniform, halberd", "checkpoint", "무"),
 ("사_당목", "남", "needle room keeper of the tang clan, man in his fifties, thin wrinkled face, greying beard, dark green tang clan robe, rows of fine needles between fingers", "workshop with drawers of needles and poison jars", "작", "young"),
 ("사_방초", "남", "alliance patrol squad leader called willow sword, twenties, calm face, alliance uniform, sword", "riverside road", "무"),
 ("사_위개", "남", "demonic cult supply hall master, forties, heavy face, black robe, ledger", "supply wagons", "작", "sword"),
 ("사_진량", "남", "alliance grain escort chief, forties, sturdy face, escort uniform, spear", "grain wagons", "무"),
 ("사_사영", "남", "assassin house killer called snake shadow, twenties, thin face, black clothes, hooked dagger", "alley at night", "작"),
 ("사_엄달", "남", "river navy centurion, thirties, weathered face, navy armor, spear", "warship deck", "무"),
 ("사_방로", "남", "river bandit called twin sabers, thirties, wet clothes, twin sabers", "river boat", "무"),
 ("사_법공", "남", "old well-keeper monk, seventies, wrinkled kind face, shaved head, patched robe, wooden bucket", "temple well", "맨", "weapon"),
 ("사_곽표", "남", "crimson sleeve squad leader, thirties, scar, black robe with crimson sleeves, curved blade", "night town", "무"),
 ("사_구문", "남", "auction keeper of the unorthodox alliance called twin blades, thirties, sharp face, black robe, twin sabers", "auction house", "무"),
 ("사_곽도인", "남", "alliance elder at an auction, sixties, white beard, white robe, faint ember eyes", "auction house seats", "맨", "weapon"),
 ("사_혜원", "남", "ash grey robed offering monk, forties, shaved head, ash grey kasaya, bowl", "village road", "작", "sword"),
 ("사_장오", "남", "post station executioner, forties, heavy face, black clothes, broad execution saber", "post station yard", "무"),
 ("사_아쿤", "남", "young chief of a grassland tribe, twenties, sun-tanned face, fur-trimmed felt robe, curved saber", "grassland with felt tents", "무"),
 ("사_사묵", "남", "black hood horse bandit chief, thirties, black hood, desert clothes, curved saber", "desert", "무"),
 ("사_장패", "남", "ginseng post soldier captain, forties, stern face, lamellar armor, spear", "mountain checkpoint", "무"),
 ("사_하문", "남", "gambling den keeper, forties, sly face, black robe, dice", "gambling den", "작"),
 ("사_고목", "남", "zhongnan outer hall fist fighter, thirties, broad body, dark blue robe, wrapped fists", "mountain village", "맨", "weapon"),
 ("사_목수호위", "남", "workshop guard of a carpenter, thirties, plain face, work clothes, axe", "carpentry workshop", "무"),
 ("사_곽칠장터", "남", "market brawler, thirties, rough face, rolled sleeves, saber", "market", "무"),
 ("사_구섭", "남", "iron fan fortress chief called one eye, man in his forties, black cloth eyepatch over one eye, rough scarred face, thick beard, fur vest over a dark robe, large black iron folding fan held open", "mountain bandit fortress at dusk", "작", "both eyes visible, young, pretty"),
 ("사_녹림사자사칭", "남", "impostor claiming to be the greenwood king's envoy, thirties, smooth smile, fine robe, faint ember eyes", "mountain stronghold", "작", "sword"),
 ("사_염운사관인", "남", "salt patrol ship official, forties, official robe, black hat, saber", "patrol boat", "무"),
 ("사_금의위넷", "남", "imperial guard at a pleasure house gate, twenties, stern face, red flying fish robe, spring saber", "pleasure house gate at night", "무"),
 ("사_법혈", "남", "blood monk who buys blood at the execution ground, forties, shaved head, ash grey robe, bronze bowl", "execution ground", "작", "sword"),
 ("사_당평", "남", "young poison hand of the tang clan, twenties, sharp face, dark green robe, poison needles", "bamboo forest", "작"),
 ("사_법독", "남", "blood monk buying poison, forties, shaved head, ash grey robe, small poison jar", "poison market", "작", "sword"),
 ("사_우마", "남", "bandit chief called iron club, forties, huge body, beard, iron club", "mountain village", "무"),
 ("사_하운", "남", "young swordsman at the front of the alliance, twenties, brave face, white alliance robe, sword", "battlefield", "무"),
 ("사_법아", "남", "blood monk of a village, thirties, shaved head, ash grey robe, iron staff", "village", "무"),
 ("사_피리술사", "남", "flute-playing shaman of the beast palace, thirties, dark skin, silver neck rings, indigo robe, bone flute", "southern jungle", "작", "sword"),
 ("사_마괴", "남", "vice chief of the black river fortress called twin sabers, thirties, scarred face, wet clothes, twin sabers", "yellow river fortress", "무"),
 ("사_방추", "남", "revenge seeker, thirties, grim determined face, black robe, saber", "riverside", "무"),
 ("사_사마르", "남", "western caravan guard from the western regions, thirties, central asian face, beard, turban, curved saber", "desert caravan", "무"),
 ("사_설아", "녀", "young archer of the north sea ice palace, late teens, silver white hair, blue eyes, white fur clothes, bow", "frozen sea", "무"),
 ("사_노칠", "남", "carriage driver of the assassin house, fifties, quiet wrinkled face, straw hat, whip", "mountain road with a carriage", "작"),
 ("사_화묵", "남", "poison envoy of the calamity fire hall, thirties, black robe with flame patterns, black flame in palm", "furnace hall", "맨", "weapon"),
 ("사_염오", "남", "calamity fire corps squad leader who shared side fire, thirties, black armor with red cracks, saber", "battlefield at night", "무"),
 ("사_서문호", "남", "wandering swordsman bound by a blood pact, thirties, red veins on the neck, black robe, sword", "mountain road", "무"),
 ("사_단유", "녀", "ronin swordswoman with side fire called black plum, twenties, cold face, black robe, dark flames on the sword", "plum trees at night", "무"),
 ("사_막철", "남", "calamity fire corps warrior guarding charcoal boats, thirties, black armor, saber", "river with boats", "무"),
 ("사_화백", "남", "calamity fire corps warrior hunting pilgrims, thirties, black armor with red cracks, spear", "mountain path", "무"),
 ("사_하문원", "남", "alliance elder with hidden fire, sixties, white beard, white robe, faint ember eyes", "alliance hall", "맨", "weapon"),
 ("사_단목후", "남", "third inspector of the alliance, forties, stern face, black and white robe, sword", "city gate checkpoint", "무"),
 ("사_사구", "남", "man who survived the blood lake, thirties, gaunt pale face, haunted eyes, ragged robe, saber", "dried blood lake", "무"),
 ("사_하우진", "남", "alliance inspector sent to the northwest, thirties, upright face, alliance uniform, sword", "frontier gate", "무"),
 ("사_모용휘", "남", "second direct heir of the murong clan, twenties, arrogant face, white and blue robes, fan", "murong manor", "작", "sword"),
 ("사_모용승", "남", "murong elder with hidden fire, sixties, white beard, white and blue robe, faint ember eyes, spear", "murong ancestral hall", "무"),
 ("사_제갈숙", "남", "zhuge elder with hidden fire, sixties, scholarly face, feather fan, faint ember eyes", "zhuge study", "작", "sword"),
 ("사_황보칠", "남", "fortress chief with hidden fire, forties, burly, fur vest, faint ember eyes, saber", "mountain fortress", "무"),
 ("사_곽허", "남", "zhongnan elder with hidden fire, sixties, stern face, dark blue robe, faint ember eyes, sword", "zhongnan hall", "무"),
 ("사_흑풍마적", "남", "desert horse bandit chief called black wind, forties, weathered face, turban, curved saber", "desert", "무"),
 ("사_화삼", "남", "con man selling fake swords of the plum blossom master, thirties, smooth smile, merchant robe, a fake sword", "market stall", "무"),
 ("사_마칠수적", "남", "pirate squad leader who laughed on the chief's boat, thirties, grin, wet clothes, hook spear", "pirate boat", "무"),
 ("사_갈패", "남", "market boss selling baby spirit beasts, forties, greedy face, cage of small animals", "market", "작", "sword"),
 ("사_사본장수혜안", "남", "monk who left the warrior monk yard selling manuscript copies, thirties, shaved head, monk robe, bundle of books", "mountain road", "작", "sword"),
 ("사_홍련", "녀", "friend of the crimson sleeves, twenties, sharp beautiful face, crimson robe, needles", "inn at night", "작"),
 ("사_염치", "남", "boatswain of a salt boat, thirties, rough face, sailor clothes, rope and hook", "salt boat deck", "무"),
 ("사_장귀", "남", "blood lake guard called black water, thirties, black robe with crimson sleeves, saber", "blood lake edge", "무"),
 ("사_마철흑풍채", "남", "black wind fortress chief, forties, scar, fur vest, broad axe", "bandit fortress", "무"),
 ("사_진하", "남", "elder who came back with six others, sixties, white beard, serene face hiding faint ember eyes, white robe", "mountain path", "맨", "weapon"),
# 외전 인연과 본편 공통 사건의 상대, 새 사건에 나오는 사람
 ("사_회면조길", "남", "spy of the demonic cult disguised as a martial alliance man, forties, forgettable plain face, faint smirk, blue alliance robe with a small badge, hidden dagger in the sleeve", "busy inn interior with lanterns", "작"),
 ("사_소진", "남", "wandering young swordsman heading to a tournament, early twenties, eager bright eyes, tied black hair, plain blue travel robe, sheathed sword held at the hip", "roadside teahouse with a tournament notice board", "무"),
 ("사_반량", "남", "envoy of the unorthodox alliance, forties, calm calculating smile, ink-stained black fingers, dark brown merchant robe, ledger tucked under the arm", "quiet inn corner at night", "작"),
 ("사_사무현", "남", "raid captain of the demonic cult, thirties, fierce hawk-like eyes, black and crimson robes with iron shoulder guards, winged iron crest on the headband, broad saber", "muddy road with an overturned supply wagon in rain", "무"),
 ("사_갈사", "남", "poison master of the five poisons sect, thirties, gaunt face, centipede tattoo on the hand, dark green and black robe, poison needles between fingers", "old roadside shrine in a southern mountain", "작"),
 ("사_비랑", "녀", "golden-thread poison sorceress of the five poisons sect, thirties, sharp beautiful face, gold threads braided in black hair, dark purple robe with golden embroidery, golden needles", "herb garden at night with burning torches", "작"),
 ("사_범진", "남", "bodyguard captain of a rich merchant, forties, square jaw, shaved sides with topknot, iron-colored hardened hands, dark brown guard uniform", "ice storage cellar of a mansion", "맨", "weapon"),
 ("사_구척", "남", "incense master of the demonic cult northern branch, forties, expressionless cold face, fur collar over a black robe, curved saber", "snowy northern road at dusk", "무"),
 ("사_하진도", "남", "ambitious young swordsman called ghost sword, late twenties, handsome arrogant face, pale grey robe, thin sword", "river ferry crossing", "무"),
 ("사_사도율", "남", "leader of a gang of swordsmen called black wind sword, forties, scarred cheek, black robe, heavy sword", "mountain foot below mount hua", "무"),
 ("사_정소월", "남", "plum blossom swordsman of mount hua, thirties, upright refined face, white and pale pink robe with plum blossom embroidery, sword at the hip", "plum trees in bloom on mount hua", "무"),
 ("사_곽련", "남", "former imperial guard now a county magistrate's bodyguard called black hand, forties, cold eyes, black official uniform, embroidered spring saber", "magistrate's mansion corridor at night", "무"),
 ("사_반태웅", "남", "incense master of the unorthodox alliance called blood claw, forties, broad shoulders, red-stained iron claw gauntlet, dark red robe", "dim archive room with ledgers", "무"),
 ("사_칠패", "남", "young assassin who deserted the assassin guild, early twenties, desperate tired face, black clothes torn, short saber", "snowy mountain trail at night", "무"),
 ("사_곡노인", "남", "old tally keeper of the assassin guild, seventies, wrinkled face, thin white beard, half-closed knowing eyes, faded black robe, old ledger and abacus", "dim room full of wooden tallies", "맨", "weapon"),
 ("사_연서", "녀", "young woman seeking revenge for her father, early twenties, determined tearful eyes, plain grey clothes, short sword gripped tightly", "rainy alley", "무"),
 ("사_장횡", "남", "river pirate lieutenant with twin axes, forties, bald head with scars, tattooed arms, open vest, two short chinese hand axes", "river waterway with reeds in autumn", "무", "viking, european axe"),
 ("사_한무성", "남", "naval officer of the river fleet called iron armor, forties, stern face, short beard, dark blue military uniform, spear", "river warship deck", "무"),
 ("사_추삼낭", "녀", "leader of the lower river boatmen called white wolf, thirties, sun-tanned face, sharp grin, hair tied with a cloth, rolled up sleeves, short knife at the belt", "river boat deck with reeds", "작"),
 ("사_노영감", "남", "old boat helmsman, sixties, weathered wrinkled face, grey beard, straw hat, faded boatman clothes, holding a steering oar", "burnt river fortress dock", "맨", "weapon"),
 ("사_도하성", "남", "guardian of a demonic cult branch called iron face, fifties, face half covered with an iron mask, black robe, heavy club", "cult storehouse interior with torches", "무"),
 ("사_법도", "남", "executioner monk of the blood sect called red eye, forties, shaved head, red eyes, grey kasaya with blood stains, prayer beads, monk staff", "famine village with a porridge cauldron", "무"),
 ("사_죽솥승", "남", "old blood sect monk who cooks porridge for the starving, seventies, kind wrinkled face, shaved head, grey kasaya, wooden ladle by a big cauldron", "famine village square", "맨", "weapon"),
 ("사_갈만복", "남", "bandit chief called iron palm wearing a tiger claw gauntlet, forties, heavy beard, bear fur vest", "mountain bandit fortress courtyard", "무"),
 ("사_장무척", "남", "beast hunter captain of the demonic cult called blood cat, thirties, wild eyes, fur cloak, hunting spear, cages behind", "forest camp with iron cages", "무"),
 ("사_타라", "남", "esoteric monk guardian from the western regions called vajra hand, forties, central asian face, shaved head, saffron and red robes, prayer beads", "antique shop in a city", "맨", "weapon"),
 ("사_한우", "남", "head of the demonic cult archive corps called ink shadow, forties, scholarly pale face, black ink-stained robe, brush and scroll", "small mountain temple with children reading", "작"),
 ("사_마천행", "남", "unorthodox swordsman called black pine sword, thirties, sneering face, black robe with pine embroidery, sword", "stone gate cave on mount wudang", "무"),
 ("사_위상균", "남", "inspector of the martial alliance called iron brush, fifties, strict face, neat grey beard, blue official robe, iron writing brush as weapon", "wudang mountain hall", "작"),
 ("사_위염", "남", "vice captain of the cult pursuit squad called red claw, thirties, hard face, red-dyed gloves, black and red clothes", "army tent camp at night", "무"),
 ("사_사극", "남", "blade of the cult pursuit squad called blood seal, thirties, cold killer eyes, crimson seal tattoo on the neck, saber", "river ferry at dusk", "무"),
 ("사_홍란", "녀", "woman who fled the demonic cult, forties, tired gentle face, black hair with some grey, plain grey dress with roughly cut sleeves", "bell tower guesthouse on mount emei", "맨", "weapon"),
 ("사_칸바르", "남", "desert bandit chief of the western road called sand wolf, forties, central asian face, thick beard, turban, sheepskin coat, curved saber", "desert oasis with camels", "무"),
 ("사_혁련도", "남", "cavalry captain of the demonic cult northwest branch called black wind, thirties, fierce face, black fur hat, horseman clothes, long spear", "burning grassland", "무"),
 ("사_백구", "남", "one-armed old fort master of the frontier, sixties, weathered face, grey beard, empty left sleeve, worn military robe", "earthen frontier fort with an empty flag pole", "맨", "weapon"),
 ("사_모용준", "남", "third young master of the murong clan, early twenties, handsome arrogant noble face, white and blue silk robe, silver spear", "clan training ground inside high walls", "무"),
 ("사_호연타", "남", "northern bandit chief called snow spear, forties, wild beard, fur cloak, white wolf fur hat, spear", "snowy northern mountains", "무"),
 ("사_모용청", "남", "young direct-line member of the murong clan, early twenties, earnest face, blue robe, spear on the back", "clan courtyard", "무"),
 ("사_구만", "남", "fixer of the lower-class gang called iron hand, thirties, smirk, iron fingertip guards, dark clothes", "pawnshop vault", "맨", "weapon"),
 ("사_철주판", "남", "debt collector of the unorthodox alliance called ghost abacus, fifties, bony face, iron abacus as weapon, black robe", "gambling den", "작"),
 ("사_염마치", "남", "workshop master of the demonic cult called furnace master, fifties, burnt muscular arms, work apron, smith hammer", "cult weapon workshop with furnaces", "무"),
 ("사_묵삼", "남", "engineer corps captain of the demonic cult called iron shell, forties, stocky, soot on face, heavy gauntlets, wooden ox machines behind", "mountain valley with wooden ox carts", "무"),
 ("사_막삼", "남", "grave robber chief called ghost hand, forties, gaunt grey face, dirty clothes, short shovel and dagger", "cave filled with stolen tomb treasures", "작"),
 ("사_귀랑", "남", "right hand of the ghost sect lord called yin master, thirties, pale face, black and white robe, paper talismans, thin spear", "foggy riverside village", "무"),
 ("사_우대방", "남", "bandit fortress chief called iron head, fifties, bald hard head, thick neck, fur vest, iron club", "bandit fortress courtyard with an altar", "무"),
 ("사_마흑산", "남", "bandit fortress chief called blood saber, forties, cruel face, red headband, black fur cloak, broad saber", "greenwood council hall", "무"),
 ("사_엄소정", "녀", "daughter of the greenwood king, early twenties, bold cheerful face, hair in a high ponytail, green hunting clothes, short club at the belt", "small mountain fort with children", "무"),
 ("사_황묘", "녀", "bodyguard of the first gambling house called viper, late twenties, sharp cold beauty, black dress, twin throwing knives", "gambling hall", "작"),
 ("사_철사장", "남", "debt collector called ghost hand, forties, gaunt, iron-sand palm darkened hands, grey robe", "gambling hall back room", "맨", "weapon"),
 ("사_판지기", "남", "old gambling table keeper, sixties, sly kind wrinkled face, grey mustache, faded black clothes, coins between fingers", "gambling hall at night", "작"),
 ("사_단수", "남", "noble clan bodyguard called iron face, thirties, expressionless face, dark blue guard clothes, sword", "noble clan garden", "무"),
 ("사_왕소", "남", "agent of the eastern depot called black needle, thirties, sly pale face, black official uniform with embroidery, saber", "dark prison corridor", "무"),
 ("사_백규", "남", "squad leader of the cult assassin corps called yin shadow, thirties, sly face, black clothes with a veil, poison darts", "night market auction", "작"),
 ("사_우문령", "녀", "vice captain of the cult assassin corps called poison dart, thirties, cold beauty, black clothes, poison darts", "inn between two mountains", "작"),
 ("사_당연화", "녀", "bride of the tang clan, early twenties, gentle sad face, hair ornaments, red wedding clothes with a light jacket, medicine pouch", "qingcheng mountain at dawn with sea of clouds", "맨", "weapon"),
 ("사_사문호", "남", "back-alley fixer of chang'an called iron bone, thirties, rough face, sleeveless vest showing muscular arms, iron club", "blacksmith shop in a city", "무"),
 ("사_구양두", "남", "pursuit captain of the unorthodox alliance called iron plate, forties, square face, iron plate on the chest, saber", "outer hall of a mountain sect at night", "무"),
 ("사_사혁", "남", "subordinate of the seventh demon general called ghost saber, thirties, cruel grin, black and crimson robes, saber", "demonic cult village square", "무"),
 ("사_마운", "남", "tribute officer of the demonic cult called blood robe, forties, cold smile, crimson robe, register scroll, curved knife", "village with a tribute wagon", "작"),
 ("사_공손무", "남", "patrol captain of the martial alliance called iron sword, forties, stern upright face, blue alliance uniform, sword", "noble mansion courtyard", "무"),
 ("사_진서한", "남", "inspector of the martial alliance called white face, thirties, pale handsome face, white robe, thin sword", "hungry village", "무"),
 ("사_마라가", "남", "insect sorcerer of the southern beast palace called black finger, forties, south asian tribal face, painted face, feathers and bones, poison insects", "village blacksmith at night", "작"),
 ("사_사바르", "남", "chief disciple of the beast palace grand sorcerer called heaven insect, thirties, tribal tattoos, feather cloak, insect jar", "mountain village swarming with insects", "작"),
 ("사_하소운", "남", "fast swordsman of the south called wind sword, twenties, cheerful confident face, light green robe, thin fast sword", "cangshan mountain ridge", "무"),
 ("사_아미란", "녀", "young mountain herb girl who knows insects, about eighteen, bright clever eyes, simple ethnic dress, herb basket", "village at the foot of a mountain with herbs", "맨", "weapon"),
 ("사_다르한", "남", "treasure hunter from the western regions called ice axe, forties, central asian face, fur coat, ice axe", "ice cave", "무", "viking, european axe"),
 ("사_혁구", "남", "traitor disciple called snow wolf, thirties, cold face, white kunlun robe torn, sword", "icy plateau", "무"),
 ("사_운설", "남", "eldest of young kunlun disciples, fourteen years old boy, serious face, white disciple robe, wooden practice sword", "snowy kunlun courtyard", "무"),
 ("사_우치", "남", "silver mine overseer called black bone, forties, mean face, whip and club, brown clothes", "mine entrance", "무"),
 ("사_십장", "남", "old mine foreman who was once an escort boxer, sixties, scarred face, grey hair, muscular old body, iron knuckle gloves", "mine tunnel with lanterns", "맨", "weapon"),
 ("사_마칠", "남", "vice chief of the black river raiders called twin oars, forties, sun-tanned scarred face, two iron oars", "yellow river boat", "무"),
 ("사_위소강", "남", "bodyguard archer of a corrupt official called iron bow, thirties, sharp eyes, dark uniform, bow and arrows", "river ferry dock", "무"),
 ("사_원표", "남", "pirate captain of the black tide gang called ghost spear, forties, sea-weathered face, scar across the nose, black head cloth, spear", "pirate ship deck on a stormy sea", "무"),
 ("사_사도걸", "남", "slave trader of the black tide gang called black whip, forties, greasy smile, black clothes, whip", "ship hold with oars and chained rowers", "무"),
]
for key, sex, look, bg, kind, *extra in F:
    ex = [extra[0]] if extra and extra[0] else []
    monk = "monk" in look
    old = any(w in look for w in ("fifties", "sixties", "seventies", "elder", "old "))
    if monk:
        if "bald" not in look:
            look = look.replace("shaved head", "1.3::completely shaved bald head::") if "shaved head" in look else look + ", 1.3::completely shaved bald head::"
        look += ", east asian face"
        ex.append("hair, long hair, ponytail, topknot, blue hair")
    elif "silver" not in look and "white hair" not in look:
        look += ", east asian face" + ("" if old else ", black hair")
        ex.append("blue hair, light blue hair" + ("" if old else ", silver hair, white hair"))
    P(key, sex, look, bg + ", detailed environment, natural colors, varied lighting", kind, ", ".join(ex))

DEFAULT = 9013
PICK = {
    "각명대사": 9018,
    "강호승냥이": 9027,
    "개방십걸": 9014,
    "개방총타": 9015,
    "객잔주인": 9014,
    "검문소": 9020,
    "겁화대마졸": 9014,
    "겁화대주": 9015,
    "겁화전": 9016,
    "고담": 9014,
    "곡진": 9017,
    "곤륜설산": 9015,
    "곤륜역도": 9014,
    "곽귀": 9022,
    "곽수": 9014,
    "곽양": 9014,
    "곽준명": 9014,
    "관아": 9015,
    "구량": 9014,
    "구양천": 9015,
    "구파협객": 9014,
    "구하": 9014,
    "구호": 9015,
    "권마의그림자": 9014,
    "귀도객": 9015,
    "귀문교": 9014,
    "귀문술사": 9015,
    "귀호": 9014,
    "금섬": 9015,
    "금안조": 9014,
    "금의위밀정": 9014,
    "기녀": 9014,
    "나루": 9015,
    "나한승": 9014,
    "낙양_불": 9014,
    "낙일봉무인": 9014,
    "남궁폐허": 9017,
    "남만밀림": 9014,
    "남만술사": 9014,
    "낭인": 9014,
    "녹림산채": 9015,
    "녹림호걸": 9026,
    "늑대무리": 9015,
    "다리밑": 9015,
    "단조": 9014,
    "당가": 9014,
    "당가배신자": 9014,
    "당천기": 9014,
    "대나무숲": 9015,
    "대장장이": 9026,
    "도각": 9023,
    "도곤": 9014,
    "독고객": 9014,
    "독문고수": 9014,
    "동창번자": 9014,
    "동창추포대": 9015,
    "떠돌이패": 9025,
    "마교심판자": 9014,
    "마교암살귀": 9014,
    "마교척살조": 9029,
    "마단장정": 9015,
    "마흥": 9014,
    "만년빙잠": 9015,
    "맹순찰조": 9015,
    "맹주호법": 9015,
    "맹집법사": 9015,
    "멧돼지떼": 9023,
    "모극": 9014,
    "모용세가": 9015,
    "묘아": 9016,
    "무각": 9014,
    "무당산": 9016,
    "무당진인": 9014,
    "무덤": 9014,
    "무림맹추격대": 9014,
    "무명노인": 9014,
    "무승원": 9017,
    "무애": 9024,
    "배신표사": 9025,
    "백년천마잔영": 9033,
    "법목": 9014,
    "법천": 9014,
    "봉마진": 9015,
    "북해고수": 9015,
    "북해빙궁": 9014,
    "붉은옷여인": 9015,
    "비동": 9016,
    "비무결승": 9028,
    "비무철권": 9014,
    "사_갈백": 9014,
    "사_갈패": 9015,
    "사_겁화추격조장마영": 9015,
    "사_고목": 9015,
    "사_곽도인": 9014,
    "사_곽두": 9014,
    "사_곽맹": 9014,
    "사_곽운": 9014,
    "사_곽칠살막": 9015,
    "사_곽칠장터": 9014,
    "사_곽평": 9015,
    "사_곽표": 9015,
    "사_곽허": 9014,
    "사_구문": 9014,
    "사_구봉": 9014,
    "사_구상": 9014,
    "사_구섭": 9018,
    "사_구양휘": 9015,
    "사_귀영살수": 9014,
    "사_금의위넷": 9014,
    "사_꼭두각시": 9015,
    "사_내단사냥꾼갈귀": 9015,
    "사_노칠": 9015,
    "사_녹림사자사칭": 9014,
    "사_당목": 9017,
    "사_당백호": 9015,
    "사_당평": 9014,
    "사_대장장이아들석두": 9015,
    "사_도각승병": 9015,
    "사_독푸는복면인": 9014,
    "사_마괴": 9014,
    "사_마량무관": 9014,
    "사_마철흑풍채": 9014,
    "사_마칠수적": 9015,
    "사_막철": 9014,
    "사_맹철": 9014,
    "사_모용선": 9014,
    "사_모용승": 9014,
    "사_모용현": 9015,
    "사_목수호위": 9015,
    "사_무관주곽도명": 9015,
    "사_밀주왕염대": 9014,
    "사_방로": 9014,
    "사_방추": 9014,
    "사_백하": 9014,
    "사_백호기양": 9014,
    "사_법공": 9015,
    "사_법독": 9014,
    "사_법아": 9015,
    "사_법운": 9014,
    "사_법정": 9014,
    "사_법혈": 9014,
    "사_비무초친아가씨": 9014,
    "사_사구": 9014,
    "사_사마르": 9014,
    "사_사무쌍": 9015,
    "사_사묵": 9014,
    "사_사본장수혜안": 9014,
    "사_사영": 9014,
    "사_사칠": 9014,
    "사_서문호": 9014,
    "사_설아": 9015,
    "사_소하": 9014,
    "사_심곽": 9015,
    "사_쌍작살강두": 9015,
    "사_아골": 9015,
    "사_아쿤": 9014,
    "사_야행객흑묘": 9015,
    "사_엄달": 9015,
    "사_여소": 9015,
    "사_염광": 9014,
    "사_염구": 9014,
    "사_염무": 9015,
    "사_염오": 9015,
    "사_염철수": 9014,
    "사_염추": 9015,
    "사_염치": 9014,
    "사_왈패두목칠복": 9014,
    "사_우마": 9014,
    "사_우칠": 9015,
    "사_웃는맹무인": 9015,
    "사_위개": 9014,
    "사_위경": 9014,
    "사_위호": 9015,
    "사_윤소겸": 9014,
    "사_윤태석": 9015,
    "사_장귀": 9015,
    "사_장오": 9015,
    "사_장칠상여": 9018,
    "사_적수마랑": 9015,
    "사_전팔": 9014,
    "사_조삼": 9014,
    "사_조철": 9014,
    "사_지객승혜정": 9014,
    "사_진량": 9014,
    "사_진하": 9014,
    "사_징혈승법조": 9014,
    "사_최삼": 9014,
    "사_칼자국표두": 9014,
    "사_칼집도객": 9014,
    "사_탁맹": 9015,
    "사_탁운경": 9014,
    "사_파랑귀곽삼": 9015,
    "사_피리술사": 9015,
    "사_하문": 9014,
    "사_하운": 9015,
    "사_허팔": 9014,
    "사_혁철": 9015,
    "사_혁패": 9015,
    "사_혈승법담": 9014,
    "사_혜강": 9014,
    "사_혜명나한": 9014,
    "사_혜원": 9014,
    "사_호삼": 9014,
    "사_홍련": 9015,
    "사_화묵": 9014,
    "사_화백": 9014,
    "사_화적대장": 9015,
    "사_황구": 9014,
    "사_황보칠": 9014,
    "사_흑염사도견": 9014,
    "사_흑접": 9016,
    "사_흑편노삼": 9014,
    "사_흑피리곽두": 9014,
    "사도련본단": 9015,
    "사도련향주": 9014,
    "사량": 9015,
    "사이비도사": 9025,
    "사파복수귀": 9014,
    "산적": 9022,
    "산정_일출": 9014,
    "산채_밤": 9017,
    "살막": 9014,
    "살막살수": 9014,
    "상한": 9014,
    "서고": 9015,
    "서생": 9023,
    "석담": 9016,
    "설란": 9015,
    "설백": 9015,
    "설표": 9014,
    "세가공자": 9022,
    "세가무사": 9015,
    "세가직계": 9014,
    "세가호위": 9026,
    "소림사": 9015,
    "소연화": 9014,
    "소운진인": 9014,
    "소칠": 9018,
    "수로채졸": 9015,
    "수적두목": 9015,
    "수채": 9018,
    "신교분타": 9014,
    "신교사자": 9018,
    "십대고수": 9014,
    "십이마장": 9022,
    "십이마장귀곡": 9014,
    "십이마장백골": 9015,
    "십이마장소면": 9016,
    "십이마장흑풍": 9014,
    "십팔동인": 9015,
    "아미사태": 9024,
    "엄충": 9015,
    "연단마군": 9014,
    "연무장": 9016,
    "연무휘": 9014,
    "염교": 9014,
    "오현철": 9014,
    "왕백로": 9026,
    "외전_갈석": 9014,
    "외전_곽승": 9026,
    "외전_곽호": 9015,
    "외전_구양열": 9017,
    "외전_구양학": 9014,
    "외전_구참": 9014,
    "외전_나곤": 9024,
    "외전_단철웅": 9026,
    "외전_당한": 9014,
    "외전_마철": 9014,
    "외전_맹추": 9015,
    "외전_모용백": 9022,
    "외전_묵현": 9014,
    "외전_방노삼": 9014,
    "외전_백공": 9014,
    "외전_사마굉": 9014,
    "외전_사마주": 9014,
    "외전_상관혁": 9014,
    "외전_석무광": 9014,
    "외전_설봉자": 9014,
    "외전_송결": 9014,
    "외전_아누": 9014,
    "외전_엄대웅": 9014,
    "외전_연비": 9014,
    "외전_염칠": 9026,
    "외전_오독문주": 9014,
    "외전_위소경": 9016,
    "외전_육종": 9015,
    "외전_육허": 9014,
    "외전_적암": 9015,
    "외전_정심": 9022,
    "외전_제갈문": 9014,
    "외전_진무": 9014,
    "외전_철필": 9015,
    "외전_총채주": 9014,
    "외전_추살수좌": 9014,
    "외전_하문겸": 9014,
    "외전_하백": 9025,
    "외전_혜명": 9014,
    "외전_홍의": 9014,
    "위소": 9015,
    "위숙": 9014,
    "유청운": 9015,
    "은비": 9015,
    "의원": 9014,
    "이름사냥꾼": 9015,
    "이무기": 9014,
    "잠화당주": 9014,
    "잠화무인": 9014,
    "잠화장로": 9014,
    "잠화표사": 9026,
    "장강": 9015,
    "장강수적": 9014,
    "장경각": 9015,
    "장원": 9016,
    "장원집사": 9014,
    "장칠": 9018,
    "장터": 9015,
    "장터상인": 9027,
    "적면마": 9016,
    "적연": 9028,
    "절정고수": 9026,
    "젊은협객": 9014,
    "점소이": 9014,
    "점창산": 9014,
    "점창장로": 9014,
    "점창제자": 9014,
    "정마대전": 9015,
    "정연사태": 9024,
    "정자": 9014,
    "정파명숙": 9014,
    "제갈세가": 9015,
    "제갈장로": 9014,
    "조각무인": 9014,
    "종남검수": 9014,
    "주루": 9014,
    "진숭": 9014,
    "진후": 9015,
    "천기각": 9018,
    "천년백사": 9017,
    "천년혈망": 9016,
    "천마봉": 9014,
    "천마봉_정상": 9014,
    "천마사냥개": 9015,
    "천마친위대": 9022,
    "천하도전자": 9014,
    "철갑현귀": 9017,
    "철목": 9015,
    "철봉승": 9032,
    "철혈대원": 9017,
    "청성산": 9016,
    "청성장로": 9014,
    "청송자": 9023,
    "청허진인": 9014,
    "초량": 9014,
    "초원": 9015,
    "촌장": 9014,
    "태산_비무대": 9015,
    "파랑": 9015,
    "폐광": 9014,
    "포도대장": 9014,
    "표국": 9022,
    "피연못": 9018,
    "하오문_골목": 9015,
    "하오문주": 9014,
    "하진": 9014,
    "하후청": 9015,
    "해적선": 9017,
    "해치": 9014,
    "혁련수": 9014,
    "혁련철": 9015,
    "혁천": 9014,
    "현상금꾼": 9026,
    "혈교산사": 9014,
    "혈교수련자": 9016,
    "혈교우호법": 9014,
    "혈교혈사": 9029,
    "혈교혈승": 9031,
    "혈교혈위대": 9014,
    "혈마귀졸": 9014,
    "혈마대귀": 9014,
    "혈마미완": 9024,
    "형장": 9017,
    "호교대": 9016,
    "혼례장": 9014,
    "홍매": 9014,
    "화경마인": 9028,
    "화산": 9015,
    "화산장로": 9015,
    "황하나루": 9015,
    "흑룡": 9023,
    "흑사방향주": 9026,
    "흑아": 9016,
    "흑풍채두목": 9022,
}

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
        if only and (only != key if only in keys else only not in key): continue
        for sd in (seeds or [PICK.get(key, DEFAULT)]):
            run(os.path.join(out, f"{key}_{sd}" if seeds else key), sd, key, kind, body, bg, wk, extra)
