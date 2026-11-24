# 출신 전용 자질과 기틀을 같은 값어치로 맞춘 표(tools/check/shop_value.py의 기준). build.py가 덮어쓴다
TRAIT_TUNE = {
 "사부의보따리": {
  "cost": 10,
  "effects": [
   {
    "type": "start_style_tool",
    "amount": 6
   },
   {
    "type": "start_style_skill",
    "grade": "명품"
   },
   {
    "type": "start_silver",
    "amount": 70
   }
  ],
  "desc": "주무공 계열 수련 도구를 6개 들고 시작하고 주무공 계열 명품 공격무공 하나를 더 익히고 시작하고 은자 70을 더 들고 시작한다. 고수와 노인이 얽힌 사건에서 사부의 이름이 나온다."
 },
 "사부의잔소리": {
  "cost": 10,
  "effects": [
   {
    "type": "mastery_rate",
    "percent": 90
   },
   {
    "type": "mindset_power",
    "percent": 25
   }
  ],
  "desc": "무공 성취를 9할 더 빠르게 얻고 심법 회복이 2할 5푼 늘어난다. 십 년 들은 잔소리가 위기마다 귀에 울린다."
 },
 "창궁의기세": {
  "cost": 10,
  "effects": [
   {
    "type": "first_strike",
    "percent": 105
   },
   {
    "type": "crit",
    "percent": 20
   }
  ],
  "desc": "전투의 첫 합에서 주는 피해가 1배 5푼 늘어나고 회심의 일격 확률이 2할 오른다. 남궁의 옛사람들이 그 기세를 먼저 알아본다."
 },
 "창궁의혈통": {
  "cost": 10,
  "effects": [
   {
    "type": "start_mastery",
    "amount": 50
   },
   {
    "type": "start_fame",
    "amount": 40
   },
   {
    "type": "crit",
    "percent": 10
   }
  ],
  "desc": "주무공 성취 50을 쌓은 채로 시작하고 명성 40으로 시작하고 회심의 일격 확률이 1할 오른다. 오대세가와 맹의 일에 남궁의 이름이 통한다."
 },
 "네형의칼": {
  "cost": 10,
  "effects": [
   {
    "type": "low_hp_power",
    "below": 40,
    "percent": 80
   }
  ],
  "desc": "체력이 4할 이하일 때 주는 피해가 8할 늘어난다. 〈남매〉와 불이 얽힌 사건에서 물러서지 않는다."
 },
 "호랑이맷집": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 9
   },
   {
    "type": "turn_regen",
    "hp_pct": 6,
    "qi_pct": 0
   }
  ],
  "desc": "받는 피해가 9푼 줄어들고 매달 체력을 6푼 더 회복한다. 팽가 사람은 맞으면서 가르치고 맞으면서 배운다."
 },
 "표로의다리": {
  "cost": 10,
  "effects": [
   {
    "type": "start_silver",
    "amount": 70
   },
   {
    "type": "flee_rate",
    "percent": 30
   },
   {
    "type": "turn_regen",
    "hp_pct": 6,
    "qi_pct": 6
   }
  ],
  "desc": "은자 70을 더 들고 시작하고 달아날 확률이 3할 오르고 매달 체력과 내력을 6푼씩 더 회복한다. 길과 표물이 얽힌 사건에서 앞장선다."
 },
 "표행길몸": {
  "cost": 10,
  "effects": [
   {
    "type": "market_discount",
    "percent": 25
   },
   {
    "type": "turn_regen",
    "hp_pct": 6,
    "qi_pct": 6
   }
  ],
  "desc": "장터 값이 2할 5푼 싸지고 매달 체력과 내력을 6푼씩 더 회복한다. 표로의 객잔과 나루가 표두의 얼굴을 기억한다."
 },
 "거지의귀": {
  "cost": 10,
  "effects": [
   {
    "type": "fortune_rate",
    "percent": 45
   },
   {
    "type": "turn_regen",
    "hp_pct": 8,
    "qi_pct": 8
   }
  ],
  "desc": "기연을 만날 확률이 4할 5푼 오르고 매달 체력과 내력을 8푼씩 더 회복한다. 소문과 끼니가 얽힌 사건에서 먼저 듣는다."
 },
 "동냥밥심": {
  "cost": 10,
  "effects": [
   {
    "type": "turn_regen",
    "hp_pct": 9,
    "qi_pct": 9
   },
   {
    "type": "heal_rate",
    "percent": 70
   }
  ],
  "desc": "매달 체력과 내력을 9푼씩 더 회복하고 요양으로 되찾는 체력과 내력이 7할 늘어난다. 얻어먹어 본 사람끼리는 말이 필요 없다."
 },
 "권마의주먹뼈": {
  "cost": 10,
  "effects": [
   {
    "type": "main_weapon_bonus",
    "percent": 45
   },
   {
    "type": "crit",
    "percent": 15
   }
  ],
  "desc": "주무공과 계열이 맞는 병기의 위력이 4할 5푼 늘어나고 회심의 일격 확률이 1할 5푼 오른다. 비록대로 부수고 다시 굳힌 손이다."
 },
 "권마의혈맥": {
  "cost": 10,
  "effects": [
   {
    "type": "secret_power",
    "percent": 25
   }
  ],
  "desc": "비기의 피해가 2할 5푼 늘어난다. 권사와 원한이 얽힌 사건에서 권마의 이름이 먼저 간다."
 },
 "식은연못": {
  "cost": 10,
  "effects": [
   {
    "type": "heal_rate",
    "percent": 150
   },
   {
    "type": "turn_regen",
    "hp_pct": 0,
    "qi_pct": 10
   }
  ],
  "desc": "요양으로 되찾는 체력과 내력이 1배 5할 늘어나고 매달 내력을 1할 더 회복한다. 마교와 혈교가 얽힌 사건에서 연못의 기억이 깨어난다."
 },
 "식지않는손": {
  "cost": 10,
  "effects": [
   {
    "type": "inflict_poison",
    "power": 6
   },
   {
    "type": "mindset_power",
    "percent": 120
   }
  ],
  "desc": "공격이 적을 중독시키고 심법 회복이 1배 2할 늘어난다. 그 손을 잡아 본 사람은 연못을 안다."
 },
 "외상장부": {
  "cost": 10,
  "effects": [
   {
    "type": "market_discount",
    "percent": 30
   },
   {
    "type": "silver_rate",
    "percent": 55
   }
  ],
  "desc": "장터 값이 3할 싸지고 얻는 은자가 5할 5푼 늘어난다. 거래와 비밀이 얽힌 사건에서 값을 먼저 안다."
 },
 "귀동냥": {
  "cost": 10,
  "effects": [
   {
    "type": "fortune_rate",
    "percent": 95
   },
   {
    "type": "extra_stock",
    "amount": 4
   }
  ],
  "desc": "기연을 만날 확률이 9할 5푼 오르고 장터에 물건이 4개 더 진열된다. 찻집 구석에 앉으면 소문 길이 들린다."
 },
 "독손끝": {
  "cost": 10,
  "effects": [
   {
    "type": "first_strike",
    "percent": 105
   },
   {
    "type": "crit",
    "percent": 20
   }
  ],
  "desc": "전투의 첫 합에서 주는 피해가 1배 5푼 늘어나고 회심의 일격 확률이 2할 오른다. 독과 암기가 얽힌 사건에서 손끝이 먼저 안다."
 },
 "약손길": {
  "cost": 10,
  "effects": [
   {
    "type": "heal_rate",
    "percent": 110
   },
   {
    "type": "consumable_rate",
    "percent": 60
   }
  ],
  "desc": "요양으로 되찾는 체력과 내력이 1배 1할 늘어나고 상비약 회복이 6할 늘어난다. 병과 약이 얽힌 사건에서 다른 길이 열린다."
 },
 "빙하의숨": {
  "cost": 10,
  "effects": [
   {
    "type": "mindset_power",
    "percent": 105
   },
   {
    "type": "turn_regen",
    "hp_pct": 0,
    "qi_pct": 10
   }
  ],
  "desc": "심법 회복이 1배 5푼 늘어나고 매달 내력을 1할 더 회복한다. 추위와 고요가 얽힌 사건에서 흔들리지 않는다."
 },
 "적는눈": {
  "cost": 10,
  "effects": [
   {
    "type": "event_growth",
    "percent": 95
   },
   {
    "type": "mastery_rate",
    "percent": 35
   }
  ],
  "desc": "사건과 기연에서 오르는 기량이 9할 5푼 늘어나고 무공 성취를 3할 5푼 더 빠르게 얻는다. 처음 보는 것을 놓치지 않는다."
 },
 "스승의이름": {
  "cost": 10,
  "effects": [
   {
    "type": "start_fame",
    "amount": 150
   },
   {
    "type": "start_silver",
    "amount": 100
   }
  ],
  "desc": "명성 150으로 시작하고 은자 100을 더 들고 시작한다. 스승의 이름을 아는 사람들이 먼저 말을 건다."
 },
 "새벽수련": {
  "cost": 10,
  "effects": [
   {
    "type": "mastery_rate",
    "percent": 70
   },
   {
    "type": "crit",
    "percent": 10
   }
  ],
  "desc": "무공 성취를 7할 더 빠르게 얻고 회심의 일격 확률이 1할 오른다. 수련이 얽힌 사건에서 몸이 먼저 깬다."
 },
 "한칼버릇": {
  "cost": 10,
  "effects": [
   {
    "type": "first_strike",
    "percent": 120
   },
   {
    "type": "crit",
    "percent": 20
   }
  ],
  "desc": "전투의 첫 합에서 주는 피해가 1배 2할 늘어나고 회심의 일격 확률이 2할 오른다. 숨어들어 지우는 일에서 길을 안다."
 },
 "죽은걸음": {
  "cost": 10,
  "effects": [
   {
    "type": "flee_rate",
    "percent": 45
   },
   {
    "type": "crit",
    "percent": 8
   }
  ],
  "desc": "달아날 확률이 4할 5푼 오르고 회심의 일격 확률이 8푼 오른다. 쫓고 쫓기는 사건에서 먼저 움직인다."
 },
 "강바닥숨": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 10
   },
   {
    "type": "heal_rate",
    "percent": 50
   }
  ],
  "desc": "받는 피해가 1할 줄어들고 요양으로 되찾는 체력과 내력이 5할 늘어난다. 물이 얽힌 사건에서 물밑 길을 안다."
 },
 "채주핏줄": {
  "cost": 10,
  "effects": [
   {
    "type": "start_silver",
    "amount": 340
   },
   {
    "type": "silver_rate",
    "percent": 65
   }
  ],
  "desc": "은자 340을 더 들고 시작하고 얻는 은자가 6할 5푼 늘어난다. 청교채의 옛 식구들이 먼저 알아본다."
 },
 "피의경": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_bonus",
    "percent": 10
   },
   {
    "type": "mindset_power",
    "percent": 30
   }
  ],
  "desc": "주는 피해가 1할 늘어나고 심법 회복이 3할 늘어난다. 피와 경전이 얽힌 사건에서 구절이 먼저 떠오른다."
 },
 "탁발의발": {
  "cost": 10,
  "effects": [
   {
    "type": "fortune_rate",
    "percent": 40
   },
   {
    "type": "turn_regen",
    "hp_pct": 8,
    "qi_pct": 8
   }
  ],
  "desc": "기연을 만날 확률이 4할 오르고 매달 체력과 내력을 8푼씩 더 회복한다. 문전에서 쫓겨나는 일에 익숙하다."
 },
 "짐승의귀": {
  "cost": 10,
  "effects": [
   {
    "type": "fortune_rate",
    "percent": 45
   },
   {
    "type": "flee_rate",
    "percent": 45
   }
  ],
  "desc": "기연을 만날 확률이 4할 5푼 오르고 달아날 확률이 4할 5푼 오른다. 산과 짐승이 얽힌 사건에서 뜻이 먼저 들린다."
 },
 "범의젖심": {
  "cost": 10,
  "effects": [
   {
    "type": "crit_power",
    "percent": 65
   },
   {
    "type": "damage_bonus",
    "percent": 4
   }
  ],
  "desc": "회심의 일격 피해가 6할 5푼 늘어나고 주는 피해가 4푼 늘어난다. 힘으로 겨루는 사건에서 밀리지 않는다."
 },
 "나한의뼈": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 8
   },
   {
    "type": "battle_exp",
    "amount": 1
   }
  ],
  "desc": "받는 피해가 8푼 줄어들고 실전 경험을 싸움마다 하나 더 얻는다. 맞으며 버티는 일에서 뼈가 먼저 견딘다."
 },
 "목탁소리": {
  "cost": 10,
  "effects": [
   {
    "type": "mindset_power",
    "percent": 65
   },
   {
    "type": "mastery_rate",
    "percent": 65
   }
  ],
  "desc": "심법 회복이 6할 5푼 늘어나고 무공 성취를 6할 5푼 더 빠르게 얻는다. 경과 좌선이 얽힌 사건에서 숨이 먼저 고요해진다."
 },
 "돌문의인내": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 9
   },
   {
    "type": "turn_regen",
    "hp_pct": 6,
    "qi_pct": 0
   }
  ],
  "desc": "받는 피해가 9푼 줄어들고 매달 체력을 6푼 더 회복한다. 기다리고 버티는 일에서 먼저 지치지 않는다."
 },
 "태극의눈": {
  "cost": 10,
  "effects": [
   {
    "type": "hit_bonus",
    "percent": 15
   },
   {
    "type": "crit",
    "percent": 8
   }
  ],
  "desc": "명중이 1할 5푼 오르고 회심의 일격 확률이 8푼 오른다. 다투는 두 사람 사이에서 가운데가 먼저 보인다."
 },
 "종루의귀": {
  "cost": 10,
  "effects": [
   {
    "type": "flee_rate",
    "percent": 25
   },
   {
    "type": "hit_bonus",
    "percent": 15
   }
  ],
  "desc": "달아날 확률이 2할 5푼 오르고 명중이 1할 5푼 오른다. 쫓기고 숨는 일에서 발소리를 먼저 듣는다."
 },
 "연잎의손": {
  "cost": 10,
  "effects": [
   {
    "type": "consumable_rate",
    "percent": 70
   },
   {
    "type": "heal_rate",
    "percent": 70
   }
  ],
  "desc": "상비약 회복이 7할 늘어나고 요양으로 되찾는 체력과 내력이 7할 늘어난다. 다친 사람과 지친 사람을 돌보는 일에서 손이 먼저 간다."
 },
 "모래의뼈": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 8
   },
   {
    "type": "battle_exp",
    "amount": 1
   }
  ],
  "desc": "받는 피해가 8푼 줄어들고 실전 경험을 싸움마다 하나 더 얻는다. 거친 땅과 거친 싸움에서 뼈가 먼저 견딘다."
 },
 "보장의셈": {
  "cost": 10,
  "effects": [
   {
    "type": "start_silver",
    "amount": 230
   },
   {
    "type": "market_discount",
    "percent": 30
   }
  ],
  "desc": "은자 230을 더 들고 시작하고 장터 값이 3할 싸진다. 곡식과 값을 다루는 일에서 셈이 먼저 선다."
 },
 "담밖의창": {
  "cost": 10,
  "effects": [
   {
    "type": "first_strike",
    "percent": 105
   },
   {
    "type": "crit_power",
    "percent": 75
   }
  ],
  "desc": "전투의 첫 합에서 주는 피해가 1배 5푼 늘어나고 회심의 일격 피해가 7할 5푼 늘어난다. 얕보이는 자리에서 먼저 창을 낸다."
 },
 "세가의말씨": {
  "cost": 10,
  "effects": [
   {
    "type": "start_fame",
    "amount": 100
   },
   {
    "type": "market_discount",
    "percent": 25
   }
  ],
  "desc": "명성 100으로 시작하고 장터 값이 2할 5푼 싸진다. 세가의 이름을 빌려야 하는 일에서 말이 먼저 통한다."
 },
 "주판손": {
  "cost": 10,
  "effects": [
   {
    "type": "silver_rate",
    "percent": 55
   },
   {
    "type": "market_discount",
    "percent": 30
   }
  ],
  "desc": "얻는 은자가 5할 5푼 늘어나고 장터 값이 3할 싸진다. 값과 셈이 얽힌 사건에서 숫자가 먼저 보인다."
 },
 "빚쟁이눈": {
  "cost": 10,
  "effects": [
   {
    "type": "first_strike",
    "percent": 110
   },
   {
    "type": "flee_rate",
    "percent": 45
   }
  ],
  "desc": "전투의 첫 합에서 주는 피해가 1배 1할 늘어나고 달아날 확률이 4할 5푼 오른다. 달아나는 자와 숨는 자를 먼저 알아본다."
 },
 "기관손": {
  "cost": 10,
  "effects": [
   {
    "type": "start_battle_tool",
    "amount": 8
   },
   {
    "type": "hit_bonus",
    "percent": 15
   }
  ],
  "desc": "주무공 계열 전투 도구를 8개 들고 시작하고 명중이 1할 5푼 오른다. 기관과 장치가 얽힌 사건에서 손이 먼저 간다."
 },
 "서자의셈": {
  "cost": 10,
  "effects": [
   {
    "type": "mastery_rate",
    "percent": 60
   },
   {
    "type": "event_growth",
    "percent": 60
   }
  ],
  "desc": "무공 성취를 6할 더 빠르게 얻고 사건과 기연에서 오르는 기량이 6할 늘어난다. 얕보이는 자리에서 먼저 읽는다."
 },
 "무덤의귀": {
  "cost": 10,
  "effects": [
   {
    "type": "mindset_power",
    "percent": 105
   },
   {
    "type": "turn_regen",
    "hp_pct": 0,
    "qi_pct": 10
   }
  ],
  "desc": "심법 회복이 1배 5푼 늘어나고 매달 내력을 1할 더 회복한다. 죽음과 장례가 얽힌 사건에서 혼의 소리를 먼저 듣는다."
 },
 "상여꾼의어깨": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 9
   },
   {
    "type": "heal_rate",
    "percent": 65
   }
  ],
  "desc": "받는 피해가 9푼 줄어들고 요양으로 되찾는 체력과 내력이 6할 5푼 늘어난다. 무거운 것을 지고 오래 걷는 일에서 어깨가 먼저 버틴다."
 },
 "곰보장씨": {
  "cost": 10,
  "effects": [
   {
    "type": "consumable_rate",
    "percent": 50
   },
   {
    "type": "market_discount",
    "percent": 25
   }
  ],
  "desc": "상비약 회복이 5할 늘어나고 장터 값이 2할 5푼 싸진다. 곳간과 식구가 얽힌 일에서 부채주가 먼저 셈을 한다."
 },
 "산채의목청": {
  "cost": 10,
  "effects": [
   {
    "type": "start_fame",
    "amount": 140
   },
   {
    "type": "start_silver",
    "amount": 140
   }
  ],
  "desc": "명성 140으로 시작하고 은자 140을 더 들고 시작한다. 산적과 무리가 얽힌 일에서 목소리 하나로 사람을 모은다."
 },
 "노름꾼의감": {
  "cost": 10,
  "effects": [
   {
    "type": "crit",
    "percent": 20
   },
   {
    "type": "fortune_rate",
    "percent": 40
   }
  ],
  "desc": "회심의 일격 확률이 2할 오르고 기연을 만날 확률이 4할 오른다. 내기와 노름이 얽힌 일에서 판이 먼저 읽힌다."
 },
 "밀수꾼의길": {
  "cost": 10,
  "effects": [
   {
    "type": "silver_rate",
    "percent": 45
   },
   {
    "type": "flee_rate",
    "percent": 45
   }
  ],
  "desc": "얻는 은자가 4할 5푼 늘어나고 달아날 확률이 4할 5푼 오른다. 관의 눈을 피하는 일에서 뒷길을 먼저 안다."
 },
 "형장의손": {
  "cost": 10,
  "effects": [
   {
    "type": "first_strike",
    "percent": 105
   },
   {
    "type": "crit_power",
    "percent": 75
   }
  ],
  "desc": "전투의 첫 합에서 주는 피해가 1배 5푼 늘어나고 회심의 일격 피해가 7할 5푼 늘어난다. 한 번에 끝내야 하는 일에서 손이 떨리지 않는다."
 },
 "판결문읽는눈": {
  "cost": 10,
  "effects": [
   {
    "type": "event_growth",
    "percent": 90
   },
   {
    "type": "mastery_rate",
    "percent": 45
   }
  ],
  "desc": "사건과 기연에서 오르는 기량이 9할 늘어나고 무공 성취를 4할 5푼 더 빠르게 얻는다. 관의 문서와 도장이 얽힌 일에서 거짓이 먼저 보인다."
 },
 "솔잎의귀": {
  "cost": 10,
  "effects": [
   {
    "type": "flee_rate",
    "percent": 20
   },
   {
    "type": "hit_bonus",
    "percent": 15
   }
  ],
  "desc": "달아날 확률이 2할 오르고 명중이 1할 5푼 오른다. 숨어든 자를 찾아내는 일에서 바람의 소리를 먼저 듣는다."
 },
 "독을아는손": {
  "cost": 10,
  "effects": [
   {
    "type": "consumable_rate",
    "percent": 65
   },
   {
    "type": "poison_immune"
   }
  ],
  "desc": "상비약 회복이 6할 5푼 늘어나고 독에 당하지 않는다. 독이 얽힌 사건에서 손이 먼저 맥을 짚는다."
 },
 "외당의주먹": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_bonus",
    "percent": 8
   },
   {
    "type": "damage_reduce",
    "percent": 4
   }
  ],
  "desc": "주는 피해가 8푼 늘어나고 받는 피해가 4푼 줄어든다. 맞서는 일에서 굽지 않는다."
 },
 "빚의셈": {
  "cost": 10,
  "effects": [
   {
    "type": "start_silver",
    "amount": 360
   },
   {
    "type": "silver_rate",
    "percent": 60
   }
  ],
  "desc": "은자 360을 더 들고 시작하고 얻는 은자가 6할 늘어난다. 빚과 이자가 얽힌 일에서 셈이 먼저 선다."
 },
 "마을의맹세": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_bonus",
    "percent": 5
   },
   {
    "type": "low_hp_power",
    "below": 50,
    "percent": 55
   }
  ],
  "desc": "주는 피해가 5푼 늘어나고 체력이 5할 이하일 때 주는 피해가 5할 5푼 늘어난다. 교단과 맹세가 얽힌 일에서 물러서지 않는다."
 },
 "시린손": {
  "cost": 10,
  "effects": [
   {
    "type": "mindset_power",
    "percent": 50
   },
   {
    "type": "crit",
    "percent": 20
   }
  ],
  "desc": "심법 회복이 5할 늘어나고 회심의 일격 확률이 2할 오른다. 칼과 혼이 얽힌 일에서 손이 먼저 차가워진다."
 },
 "웃는얼굴": {
  "cost": 10,
  "effects": [
   {
    "type": "start_fame",
    "amount": 100
   },
   {
    "type": "market_discount",
    "percent": 25
   }
  ],
  "desc": "명성 100으로 시작하고 장터 값이 2할 5푼 싸진다. 사람을 모으고 달래는 일에서 웃음이 먼저 나간다."
 },
 "소매속침": {
  "cost": 10,
  "effects": [
   {
    "type": "first_strike",
    "percent": 105
   },
   {
    "type": "crit",
    "percent": 20
   }
  ],
  "desc": "전투의 첫 합에서 주는 피해가 1배 5푼 늘어나고 회심의 일격 확률이 2할 오른다. 말이 막히는 자리에서 침이 먼저 나간다."
 },
 "바람의손": {
  "cost": 10,
  "effects": [
   {
    "type": "hit_bonus",
    "percent": 15
   },
   {
    "type": "crit",
    "percent": 8
   }
  ],
  "desc": "명중이 1할 5푼 오르고 회심의 일격 확률이 8푼 오른다. 빠르게 끝내야 하는 일에서 손이 먼저 나간다."
 },
 "벌레를아는귀": {
  "cost": 10,
  "effects": [
   {
    "type": "poison_immune"
   },
   {
    "type": "consumable_rate",
    "percent": 65
   }
  ],
  "desc": "독에 당하지 않고 상비약 회복이 6할 5푼 늘어난다. 독과 벌레가 얽힌 일에서 소리가 먼저 들린다."
 },
 "눈길의손": {
  "cost": 10,
  "effects": [
   {
    "type": "consumable_rate",
    "percent": 70
   },
   {
    "type": "heal_rate",
    "percent": 70
   }
  ],
  "desc": "상비약 회복이 7할 늘어나고 요양으로 되찾는 체력과 내력이 7할 늘어난다. 아이들과 약한 자를 돌보는 일에서 손이 먼저 간다."
 },
 "만년설의숨": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 8
   },
   {
    "type": "turn_regen",
    "hp_pct": 0,
    "qi_pct": 8
   }
  ],
  "desc": "받는 피해가 8푼 줄어들고 매달 내력을 8푼 더 회복한다. 추위와 기다림이 얽힌 일에서 숨이 흐트러지지 않는다."
 },
 "바위주먹": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_bonus",
    "percent": 8
   },
   {
    "type": "battle_exp",
    "amount": 1
   }
  ],
  "desc": "주는 피해가 8푼 늘어나고 실전 경험을 싸움마다 하나 더 얻는다. 힘으로 버티는 일에서 먼저 깨부순다."
 },
 "갱도의눈": {
  "cost": 10,
  "effects": [
   {
    "type": "fortune_rate",
    "percent": 55
   },
   {
    "type": "damage_reduce",
    "percent": 7
   }
  ],
  "desc": "기연을 만날 확률이 5할 5푼 오르고 받는 피해가 7푼 줄어든다. 무너질 것과 숨겨진 것을 먼저 본다."
 },
 "물살의어깨": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 9
   },
   {
    "type": "heal_rate",
    "percent": 65
   }
  ],
  "desc": "받는 피해가 9푼 줄어들고 요양으로 되찾는 체력과 내력이 6할 5푼 늘어난다. 물과 배가 얽힌 일에서 몸이 먼저 버틴다."
 },
 "나루의얼굴": {
  "cost": 10,
  "effects": [
   {
    "type": "start_fame",
    "amount": 140
   },
   {
    "type": "start_silver",
    "amount": 140
   }
  ],
  "desc": "명성 140으로 시작하고 은자 140을 더 들고 시작한다. 나루를 오간 사람들이 먼저 알아본다."
 },
 "성벽의창": {
  "cost": 10,
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 10
   },
   {
    "type": "first_strike",
    "percent": 50
   }
  ],
  "desc": "받는 피해가 1할 줄어들고 전투의 첫 합에서 주는 피해가 5할 늘어난다. 지키는 싸움에서 먼저 창을 낸다."
 },
 "군호의셈": {
  "cost": 10,
  "effects": [
   {
    "type": "start_battle_tool",
    "amount": 9
   },
   {
    "type": "start_silver",
    "amount": 360
   }
  ],
  "desc": "주무공 계열 전투 도구를 9개 들고 시작하고 은자 360을 더 들고 시작한다. 병기와 군량이 얽힌 일에서 셈이 먼저 선다."
 }
}
UPGRADE_TUNE = {
 "사부회초리": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "start_mastery",
    "amount": 20
   },
   {
    "type": "mastery_rate",
    "percent": 9
   }
  ],
  "desc": "단계마다 주무공 성취 20을 쌓은 채로 시작하고 무공 성취를 9푼 더 빠르게 얻는다."
 },
 "창궁검리": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "crit",
    "percent": 2
   },
   {
    "type": "secret_power",
    "percent": 4
   }
  ],
  "desc": "단계마다 회심의 일격 확률이 2푼 오르고 비기의 피해가 4푼 늘어난다."
 },
 "오호기개": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 2
   },
   {
    "type": "crit_power",
    "percent": 6
   }
  ],
  "desc": "단계마다 받는 피해가 2푼 줄어들고 회심의 일격 피해가 6푼 늘어난다."
 },
 "표행밑천": {
  "costs": [
   10,
   15,
   25
  ]
 },
 "거지인심": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "turn_regen",
    "hp_pct": 2,
    "qi_pct": 2
   },
   {
    "type": "fortune_rate",
    "percent": 2
   }
  ],
  "desc": "단계마다 매달 체력과 내력을 2푼씩 더 회복하고 기연을 만날 확률이 2푼 오른다."
 },
 "비록되새김": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "secret_power",
    "percent": 5
   },
   {
    "type": "crit_power",
    "percent": 4
   }
  ],
  "desc": "단계마다 비기의 피해가 5푼 늘어나고 회심의 일격 피해가 4푼 늘어난다."
 },
 "연못의기억": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "mindset_power",
    "percent": 25
   },
   {
    "type": "heal_rate",
    "percent": 20
   }
  ],
  "desc": "단계마다 심법 회복이 2할 5푼 늘어나고 요양으로 되찾는 체력과 내력이 2할 늘어난다."
 },
 "단골장부": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "market_discount",
    "percent": 7
   },
   {
    "type": "silver_rate",
    "percent": 10
   }
  ],
  "desc": "단계마다 장터 값이 7푼 싸지고 얻는 은자가 1할 늘어난다."
 },
 "당가침통": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "crit",
    "percent": 3
   },
   {
    "type": "consumable_rate",
    "percent": 10
   }
  ],
  "desc": "단계마다 회심의 일격 확률이 3푼 오르고 상비약 회복이 1할 늘어난다."
 },
 "빙백의결": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 2
   },
   {
    "type": "mindset_power",
    "percent": 15
   }
  ],
  "desc": "단계마다 받는 피해가 2푼 줄어들고 심법 회복이 1할 5푼 늘어난다."
 },
 "빈검집": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "mastery_rate",
    "percent": 9
   },
   {
    "type": "crit_power",
    "percent": 15
   }
  ],
  "desc": "단계마다 무공 성취를 9푼 더 빠르게 얻고 회심의 일격 피해가 1할 5푼 늘어난다."
 },
 "검은패": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "first_strike",
    "percent": 30
   },
   {
    "type": "silver_rate",
    "percent": 20
   }
  ],
  "desc": "단계마다 전투의 첫 합에서 주는 피해가 3할 늘어나고 얻는 은자가 2할 늘어난다."
 },
 "청교깃발": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "start_silver",
    "amount": 40
   },
   {
    "type": "damage_reduce",
    "percent": 2
   }
  ],
  "desc": "단계마다 은자 40을 더 들고 시작하고 받는 피해가 2푼 줄어든다."
 },
 "잿빛가사": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "turn_regen",
    "hp_pct": 2,
    "qi_pct": 2
   },
   {
    "type": "damage_bonus",
    "percent": 1
   }
  ],
  "desc": "단계마다 매달 체력과 내력을 2푼씩 더 회복하고 주는 피해가 1푼 늘어난다."
 },
 "손등표식": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "crit_power",
    "percent": 7
   },
   {
    "type": "turn_regen",
    "hp_pct": 3,
    "qi_pct": 0
   }
  ],
  "desc": "단계마다 회심의 일격 피해가 7푼 늘어나고 매달 체력을 3푼 더 회복한다."
 },
 "닳은곤자루": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 2
   },
   {
    "type": "mindset_power",
    "percent": 5
   }
  ],
  "desc": "단계마다 받는 피해가 2푼 줄어들고 심법 회복이 5푼 늘어난다."
 },
 "닳은문고리": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "mastery_rate",
    "percent": 15
   },
   {
    "type": "mindset_power",
    "percent": 15
   }
  ],
  "desc": "단계마다 무공 성취를 1할 5푼 더 빠르게 얻고 심법 회복이 1할 5푼 늘어난다."
 },
 "해진신발": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "flee_rate",
    "percent": 8
   },
   {
    "type": "turn_regen",
    "hp_pct": 1,
    "qi_pct": 1
   }
  ],
  "desc": "단계마다 달아날 확률이 8푼 오르고 매달 체력과 내력을 1푼씩 더 회복한다."
 },
 "흙벽": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 1
   },
   {
    "type": "damage_bonus",
    "percent": 1
   }
  ],
  "desc": "단계마다 받는 피해가 1푼 줄어들고 주는 피해가 1푼 늘어난다."
 },
 "제비무늬": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "crit_power",
    "percent": 20
   },
   {
    "type": "first_strike",
    "percent": 20
   }
  ],
  "desc": "단계마다 회심의 일격 피해가 2할 늘어나고 전투의 첫 합에서 주는 피해가 2할 늘어난다."
 },
 "붉은먹": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "silver_rate",
    "percent": 15
   },
   {
    "type": "crit",
    "percent": 4
   }
  ],
  "desc": "단계마다 얻는 은자가 1할 5푼 늘어나고 회심의 일격 확률이 4푼 오른다."
 },
 "굴대": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "crit",
    "percent": 4
   },
   {
    "type": "mastery_rate",
    "percent": 7
   }
  ],
  "desc": "단계마다 회심의 일격 확률이 4푼 오르고 무공 성취를 7푼 더 빠르게 얻는다."
 },
 "짧은심지": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "mindset_power",
    "percent": 15
   },
   {
    "type": "crit",
    "percent": 3
   }
  ],
  "desc": "단계마다 심법 회복이 1할 5푼 늘어나고 회심의 일격 확률이 3푼 오른다."
 },
 "흑송가지": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_bonus",
    "percent": 1
   },
   {
    "type": "turn_regen",
    "hp_pct": 2,
    "qi_pct": 0
   }
  ],
  "desc": "단계마다 주는 피해가 1푼 늘어나고 매달 체력을 2푼 더 회복한다."
 },
 "갈아둔동전": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "crit_power",
    "percent": 15
   },
   {
    "type": "silver_rate",
    "percent": 9
   }
  ],
  "desc": "단계마다 회심의 일격 피해가 1할 5푼 늘어나고 얻는 은자가 9푼 늘어난다."
 },
 "씻은칼": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "first_strike",
    "percent": 10
   },
   {
    "type": "damage_reduce",
    "percent": 2
   }
  ],
  "desc": "단계마다 전투의 첫 합에서 주는 피해가 1할 늘어나고 받는 피해가 2푼 줄어든다."
 },
 "혼례의독침": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "crit",
    "percent": 2
   },
   {
    "type": "damage_reduce",
    "percent": 2
   }
  ],
  "desc": "단계마다 회심의 일격 확률이 2푼 오르고 받는 피해가 2푼 줄어든다."
 },
 "빚문서": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_bonus",
    "percent": 2
   },
   {
    "type": "silver_rate",
    "percent": 6
   }
  ],
  "desc": "단계마다 주는 피해가 2푼 늘어나고 얻는 은자가 6푼 늘어난다."
 },
 "묶인혼": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_bonus",
    "percent": 2
   },
   {
    "type": "crit_power",
    "percent": 6
   }
  ],
  "desc": "단계마다 주는 피해가 2푼 늘어나고 회심의 일격 피해가 6푼 늘어난다."
 },
 "금실한올": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "crit",
    "percent": 4
   },
   {
    "type": "silver_rate",
    "percent": 15
   }
  ],
  "desc": "단계마다 회심의 일격 확률이 4푼 오르고 얻는 은자가 1할 5푼 늘어난다."
 },
 "창산바람": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "crit",
    "percent": 4
   },
   {
    "type": "flee_rate",
    "percent": 6
   }
  ],
  "desc": "단계마다 회심의 일격 확률이 4푼 오르고 달아날 확률이 6푼 오른다."
 },
 "털신스무켤레": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "heal_rate",
    "percent": 10
   },
   {
    "type": "damage_reduce",
    "percent": 2
   }
  ],
  "desc": "단계마다 요양으로 되찾는 체력과 내력이 1할 늘어나고 받는 피해가 2푼 줄어든다."
 },
 "굳은살": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_bonus",
    "percent": 1
   },
   {
    "type": "damage_reduce",
    "percent": 1
   }
  ],
  "desc": "단계마다 주는 피해가 1푼 늘어나고 받는 피해가 1푼 줄어든다."
 },
 "오십년노": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 1
   },
   {
    "type": "turn_regen",
    "hp_pct": 2,
    "qi_pct": 0
   }
  ],
  "desc": "단계마다 받는 피해가 1푼 줄어들고 매달 체력을 2푼 더 회복한다."
 },
 "천호의깃대": {
  "costs": [
   10,
   15,
   25
  ],
  "effects": [
   {
    "type": "damage_reduce",
    "percent": 2
   },
   {
    "type": "first_strike",
    "percent": 10
   }
  ],
  "desc": "단계마다 받는 피해가 2푼 줄어들고 전투의 첫 합에서 주는 피해가 1할 늘어난다."
 }
}
