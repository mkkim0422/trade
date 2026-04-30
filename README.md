# 강남구 일반음식점 폐업 위험 분석 시스템

> 데이터 기반 입지 진단 GIS 플랫폼 (MVP)

## 🎯 프로젝트 소개

강남구 일반음식점 폐업 데이터를 분석하여, 특정 입지의 **폐업 위험도**를 5종 진단 카드로 제공하는 시스템입니다.

**타겟 사용자**: 대형 프랜차이즈 점포개발팀장 (B2B)
**차별화**: "여기 망할 수도 있다"를 데이터로 진단하는 유일한 도구

## 🚀 주요 기능

### 1. 인터랙티브 지도
- 카카오 맵 기반 GIS 시스템
- 강남구 폐업 매장 마커 표시
- 클러스터링으로 성능 최적화
- 업태별 필터링 (한식/중국식/일반 등 10개 카테고리)

### 2. 5종 진단 카드
마커 클릭 시 좌패널에 표시:

| 카드 | 설명 |
|------|------|
| **폐업 위험도 (LUD)** | 반경 250m 내 폐업 밀집도 분석<br>점수(0-100), 위험도 레벨, 패턴 분류 |
| **장수 매장 분포 (SEG)** | 5년 이상 영업 비율, 평균 영업 기간 |
| **5년 추이 (Trend)** | 연도별 폐업 수, 증가/안정/감소 추세 |
| **AI 한 줄 평 (Narrative)** | LUD+SEG+Trend 종합 요약 |
| **기본 정보** | 개업일, 폐업일, 영업기간, 면적 |

### 3. 데이터 정직성
- 모든 Mock 데이터에 배지 표시
- 푸터에 데이터 출처 명시
- 추정 로직의 한계 투명하게 공개

## 🛠 기술 스택

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Map**: 카카오 맵 SDK + Geocoding API
- **Clustering**: MarkerClusterer

## 📦 설치 및 실행

### 1. 환경 변수 설정

`.env.local` 파일 생성:

```env
NEXT_PUBLIC_KAKAO_API_KEY=your_javascript_key_here
KAKAO_REST_API_KEY=your_rest_api_key_here
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 데이터 지오코딩 (최초 1회)

```bash
node scripts/geocode-gangnam.js
```

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 접속

## 📁 프로젝트 구조

```
trade2/
├── public/data/
│   ├── gangnam-localdata.csv  # 원본 데이터 (LOCALDATA 강남구)
│   └── stores.json            # 가공 데이터 (지오코딩 완료)
├── scripts/
│   └── geocode-gangnam.js     # 지오코딩 스크립트 (강남구)
├── src/
│   ├── app/
│   │   ├── page.tsx           # 메인 레이아웃
│   │   └── layout.tsx         # 루트 레이아웃
│   ├── components/
│   │   ├── map/
│   │   │   └── MapView.tsx    # 지도 + 클러스터링
│   │   ├── panels/
│   │   │   ├── LeftPanel.tsx  # 좌패널 (진단 카드)
│   │   │   └── FilterBar.tsx  # 업태 필터
│   │   └── cards/
│   │       ├── LUDCard.tsx    # 폐업 위험도
│   │       ├── SEGCard.tsx    # 장수 매장 분포
│   │       ├── TrendCard.tsx  # 5년 추이
│   │       └── NarrativeCard.tsx # AI 한 줄 평
│   ├── store/
│   │   └── useDashboardStore.ts # Zustand 스토어
│   ├── lib/
│   │   ├── analysis.ts        # 분석 로직
│   │   └── constants.ts       # 거리 계산, 상수
│   └── types/
│       └── index.ts           # 타입 정의
├── CLAUDE.md                   # 거버넌스 문서
└── README.md                   # 본 파일
```

## 📊 데이터

- **출처**: LOCALDATA 2024.10
- **범위**: 강남구 일반음식점 전체 폐업 매장 (행정구역 코드 11680)
- **가공**: 카카오 Geocoding API로 좌표 변환
- **Mock**: 폐업일자 2025-01-01 ~ 2026-03-31 랜덤 생성 (MVP용)

## 🗺 향후 계획

- [x] Phase 1: 지도 + 마커 + 클러스터링
- [x] Phase 2: 5종 진단 카드
- [x] Phase 3: 필터링
- [x] Phase 4: 우패널 맵 툴바 (통계, 히트맵, 클러스터 리스트)
- [ ] Phase 5: PDF 보고서 출력
- [ ] Phase 6: 행정동 경계 오버레이
- [ ] Phase 7: SEC 황금 핀 TOP 3
- [ ] v2: 편의점 데이터 전환
- [ ] v3: 실제 매출/유동인구 통합

## 📝 라이선스

MIT

---

**버전**: MVP v1.0
**작성일**: 2026-04-29
