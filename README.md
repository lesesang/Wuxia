# 강호행

10년(120달) 동안 무공을 닦고 강호의 선택을 거쳐 천마봉에 오르는 한국어 텍스트 로그라이크 RPG입니다.
죽어도 카르마가 남아 출신, 자질, 기틀, 인연, 전설의 유산을 얻고 점점 강해집니다.

**플레이: https://lesesang.github.io/Wuxia/**

설치 없이 휴대폰과 PC 브라우저에서 바로 실행되고, 한 번 열면 인터넷 없이도 돌아갑니다.
기록은 기기에 저장됩니다. 다른 기기로 옮기려면 설정의 "기록 옮기기"를 쓰세요.

## 구조

서버가 필요 없는 정적 웹앱입니다. `www/` 폴더가 게임 전체입니다.

| 경로 | 내용 |
|---|---|
| `www/data/` | 사건, 적, 무공, 장터, 자질 같은 콘텐츠 (JSON) |
| `www/js/` | 게임 규칙(`game.js`, `battle.js` 등)과 화면(`ui.js`) |
| `www/css/`, `www/fonts/`, `www/icons/` | 디자인, 내장 글꼴, 앱 아이콘 |
| `www/sw.js`, `www/manifest.webmanifest` | 오프라인 실행과 홈 화면 설치 |
| `tests/` | 자동 테스트 |
| `tools/` | 밸런스 시뮬레이터(`simulate.js`, `probe.js`, `fuzz.js`), 적 수치 맞춤, 글꼴과 오프라인 목록 생성 |
| `tools/content/` | 외전과 장원의 사건, 외전 결말과 적을 만드는 원본 |
| `tools/check/` | 사건 검증, 문장과 조사 점검, 화면 점검, 외전 마지막 싸움 측정 |
| `docs/` | 설계서, 콘텐츠 가이드, 세계관 분석, 용어집, 앱 배포 안내 |
| `CLAUDE.md` | 작업 방식과 게임 규칙 |

## 개발

```
npm test                     # 자동 테스트
npm run serve                # http://localhost:8000 에서 실행
node tools/simulate.js 300   # 봇으로 조건별 승률 확인
node tools/probe.js 300      # 해마다 성장과 장별 난이도 측정
node tools/fuzz.js 60        # 아무렇게나 끝까지 해 보며 오류와 막힘 찾기
python3 tools/content/build.py   # 외전과 장원 다시 만들기
node tools/check/audit.mjs   # 사건 검증
```

`www/`에 파일을 더하면 `node tools/build_asset_list.js`로 오프라인 목록을 다시 만듭니다.

## 배포

`main`에 올리면 자동 테스트를 거쳐 GitHub Pages에 배포됩니다. 앱 스토어 출시는 [docs/앱배포.md](docs/앱배포.md)를 보세요.

## 콘텐츠 추가

코드를 고치지 않고 `www/data/`의 JSON에 항목을 추가하면 게임에 나옵니다. 외전과 장원(`events_side.json`, `events_manor.json`)만은 `tools/content`의 원본을 고쳐 다시 만듭니다. 형식은 [docs/콘텐츠-가이드.md](docs/콘텐츠-가이드.md), 규칙 전체는 [docs/설계서.md](docs/설계서.md), 세계의 사실은 [docs/세계관-분석.md](docs/세계관-분석.md)에 있습니다.
