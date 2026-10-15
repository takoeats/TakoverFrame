# TakoverFrame

워프레임 비공식 도우미 앱 [WFHelper](https://github.com/WFHelper/WFHelper)를 **한국어 게임
클라이언트**에서 쓸 수 있게 만든 포크입니다. 인벤토리를 읽어 warframe.market 실시간 시세로 가격을
매기고, 화면의 성유물 보상을 인식하며, EE.log로 중재 기록을 추적합니다.

이 포크가 더한 것은 **한국어 성유물 보상 인식**과 **한국어 화면**이고, 나머지 기능은 모두 WFHelper
개발자들의 작업입니다. 이 포크는 **WFHelper 측의 허락을 받아** 공개 배포하며, WFHelper를 바탕으로
만들었음을 밝힙니다.

![WFHelper 인벤토리 화면과 warframe.market 시세](.github/screenshots/inventory.png)

<sub>WFHelper 원본 화면(midnight-blue 테마). 테마 16종이 들어 있고 직접 만들 수도 있습니다.</sub>

## 기능

앱 안에서:

- 인벤토리: 계정 전체를 플래티넘 시세·주문 현황과 함께, 무기·워프레임 장비 탭 포함
- 성유물: 보유한 성유물의 구성품, 드롭 위치, 보상
- 주조소: 제작에 필요한 재료를 부품 단위까지
- 마스터리: 아직 마스터하지 않은 것과 지금 만들 수 있는 것
- 리벤: 보유 리벤과 시장 비교, 리벤 찾기
- 마켓: warframe.market 주문을 앱에서 관리 (로그인 선택)
- 중재: EE.log로 매 판 분석(처치 수, 드론, 로테이션, 기대 드롭률 대비 바이투스 운), 즐겨찾기한
  노드의 일정 알림
- 월드: 주기, 균열, 침공, 현상금, 서킷 로테이션
- 통계: 일별 플래티넘·크레딧·엔도, 거래 기록
- 위키: 아이템 드롭 위치와 성유물 보상표
- 테마: 기본 테마 또는 직접 만들기

게임 위 오버레이 (워프레임을 테두리 없는 창 모드로):

- 성유물 보상: 분대의 성유물이 열리면 보상마다 가격 표시 — **한국어 클라이언트 지원**
- 성유물 플래너: 성유물 선택 화면에서 보유 성유물 순위 — 아직 영어 클라이언트만
- 리벤 스캐너: 리벤을 돌릴 때 옵션을 읽어 이전·새 수치 비교 — 아직 영어 클라이언트만
- 중재 요약: 임무가 끝나면 바로 그 판의 통계

알림: 게임 귓속말, warframe.market 메시지, 중재 일정을 플레이 중 데스크톱 알림으로 받을 수 있습니다.

> **게임 언어는 한국어와 영어 모두 됩니다.** 성유물 보상은 둘 다 인식하고, 성유물 플래너와 리벤
> 스캐너는 아직 영어 클라이언트에서만 동작합니다. 앱 화면 언어는 게임 언어를 따르며, 설정에서 따로
> 바꿀 수 있습니다.

## 설치

[릴리스 페이지](https://github.com/takoeats/TakoverFrame/releases/latest)에서 최신
`TakoverFrame-<버전>-Setup.exe`를 받아 실행하세요. 설치한 뒤에는 앱이 시작할 때 새 버전을 확인하고,
받을지는 직접 고릅니다.

설치 파일에 코드 서명이 없어 처음에 Windows SmartScreen 경고가 뜰 수 있습니다. **추가 정보 → 실행**을
누르세요.

한국어 보상 인식은 Windows의 한국어 OCR 기능을 씁니다. 한국어 Windows에는 보통 들어 있고, 없으면
앱이 알려 줍니다(설정 → 시간 및 언어 → 언어 및 지역 → 한국어 → 언어 옵션에서 설치).

Windows용 설치본만 냅니다. 리눅스에서는 WFHelper 원본을 쓰세요.

### 인벤토리 데이터

게임에는 인벤토리를 읽는 공식 수단이 없어서, 처음 실행할 때 세 가지 중에서 고릅니다.

- warframe-api-helper (권장): [Sainan/warframe-api-helper](https://github.com/Sainan/warframe-api-helper)를
  받아 플레이하는 동안 만들어지는 `inventory.json`을 불러옵니다.
- JSON 불러오기: 이미 가진 `inventory.json` 파일을 엽니다.
- AlecaFrame 불러오기: AlecaFrame의 로컬 캐시 `lastData.dat`을 복호화해 읽습니다.

"인벤토리 없이 계속"도 고를 수 있습니다. 월드, warframe.market 기능, 성유물 보상·리벤·중재 오버레이는
인벤토리 없이도 됩니다. 보유량에 기반한 기능(보유 수, 성유물 플래너, 주조소, 마스터리)은 인벤토리가
필요하며, 나중에 설정에서 연결할 수 있습니다.

게임 메모리를 읽는 것은 권장 방식(warframe-api-helper)과 선택 기능인 임무 추적뿐이며, **읽기만** 합니다.
JSON·AlecaFrame 불러오기와 오버레이는 메모리를 읽지 않습니다. 게임 파일을 고치거나 게임에 코드를
주입하거나 플레이를 자동화하지 않습니다. 그래도 서드파티 도구가 계정 안전을 보장할 수는 없으니
사용은 본인 책임입니다.

## 개인정보

인벤토리 스냅샷, 기록한 중재 로그, 통계는 내 PC에만 남습니다. 앱은 warframe.market 시세·아이콘·새
성유물 데이터를 위해 **WFHelper가 운영하는 캐시 서버**와, 아래 공개 게임 데이터 출처와, 업데이트 확인을
위해 GitHub와 통신합니다. 서버에 보내는 요청은 `TakoverFrame`으로 이 앱임을 밝힙니다.

충돌 보고나 사용 통계(telemetry)는 없습니다. WFHelper 서버는 요청마다 경로·상태·시간·아이템 이름을
Cloudflare와 Grafana에 기록하고, 하루 사용자 수를 익명으로 셉니다. 앱 안의 피드백 전송은 WFHelper로
가지 않도록 꺼 두었습니다. 이 앱에 관한 문의는 WFHelper가 아니라 이 저장소의 Issues로 해 주세요.

## 소스에서 빌드

Node 22.12 이상과 pnpm 11(corepack)이 필요합니다.

```
corepack enable
pnpm install --frozen-lockfile
pnpm run dev        # 개발 모드로 실행
pnpm run dist:win   # Windows 설치 파일(NSIS) 빌드
```

## 크레딧

- [WFHelper](https://github.com/WFHelper/WFHelper): 이 앱의 바탕. 한국어 지원을 뺀 모든 기능
- [warframe.market](https://warframe.market): 시세와 주문 데이터
- Digital Extremes의 Public Export: 아이템 데이터와 이미지, 한국어 아이템 이름
  ([warframe-public-export-plus](https://www.npmjs.com/package/warframe-public-export-plus) 경유)
- [WFCD](https://github.com/WFCD) 커뮤니티 프로젝트: 아이템 데이터베이스
  ([warframe-items](https://github.com/WFCD/warframe-items)), 드롭 테이블
  ([drops.warframestat.us](https://drops.warframestat.us)), 월드 상태 API
- [browse.wf](https://browse.wf): 추가 아이템 아이콘
- [sves의 arbi analyzer](https://svesk.github.io/arbi/): 중재 분석기의 통계 모델
- [Sainan/warframe-api-helper](https://github.com/Sainan/warframe-api-helper): 인벤토리 스냅샷 도구
- AlecaFrame: 불러오기가 읽는 `lastData.dat` 형식

## 후원

TakoverFrame은 WFHelper 위에서만 돌아갑니다. 도움이 됐다면 WFHelper의
[Patreon](https://www.patreon.com/WFHelper)을 후원해 주세요. 앱이 쓰는 Cloudflare 서버 비용에 쓰입니다.

## 면책

비공식 팬 프로젝트이며 WFHelper, Digital Extremes, warframe.market과 제휴하거나 그들의 보증을 받지
않았습니다. "Warframe"과 관련 콘텐츠는 Digital Extremes Ltd.의 재산입니다.

## 라이선스

[MIT](LICENSE). 원저작물 WFHelper(Copyright (c) 2026 WFHelper)도 MIT이며, 그 저작권 표시와 허가 문구를
LICENSE에 그대로 두었습니다. 이 포크에서 고친 부분(Copyright (c) 2026 takoeats)도 같은 MIT 조건입니다.
설치본에도 `LICENSE.txt`와 `NOTICE.md`가 함께 들어 있습니다. 소프트웨어는 "있는 그대로" 제공되며 어떤
보증도 하지 않습니다.

`renderer/fonts/`의 Barlow·Rajdhani 글꼴은 SIL Open Font License 1.1, npm 의존성은 각자의 라이선스를
따릅니다. 자세한 고지는 [NOTICE.md](NOTICE.md)에 있습니다.
