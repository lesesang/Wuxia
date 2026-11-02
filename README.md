# 무협 로그라이크

5년(60턴) 동안 무공을 닦고 강호의 선택을 거쳐 천마봉에 오르는 한국어 텍스트 로그라이크 RPG입니다.
죽어도 카르마가 남아 다음 회차의 출신과 특성을 해금합니다.

## 실행

Windows에서는 `run.bat`을 더블클릭하면 필요한 것을 설치하고 브라우저를 엽니다.

직접 실행하려면:

```
pip install -r requirements.txt
python app.py
```

그다음 브라우저에서 http://127.0.0.1:5000 을 엽니다.

## 콘텐츠 추가

코드를 고치지 않고 `data/` 폴더의 JSON에 항목을 추가하면 게임에 나옵니다.

| 파일 | 내용 |
|---|---|
| `data/events_random.json` | 탐색 중 일어나는 사건과 선택지 |
| `data/events_story.json` | 정해진 턴의 줄거리 |
| `data/enemies.json` | 적 |
| `data/skills.json` | 무공, 심공, 경공 |
| `data/market.json` | 시장 품목 |
| `data/traits.json` | 특성 |

항목의 형식은 `game/events.py`, `game/enemy.py`, `game/market.py`, `game/traits.py` 맨 위의 설명을 참고하세요.

## 확인 도구

```
pip install pytest
python -m pytest tests            # 자동 테스트
python tools/simulate.py 100      # 봇으로 밸런스 확인, 저장 파일을 건드리지 않음
```

자세한 규칙은 [docs/설계서.md](docs/설계서.md)에 있습니다.
