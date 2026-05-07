# Master Template (v5.5)

16개 사이트가 공유하는 Astro 마스터 템플릿. 사이트별 디자인 토큰 자동 주입으로 각자 다른 디자이너 톤.

## 구조

```
master-template/
├── src/
│   ├── components/        # shadcn-style + Tailwind
│   ├── layouts/           # Base + Article (v5.3 14항목 + v5.4 5항목 자동)
│   ├── pages/             # index·about·editorial-process·editorial-standards·404·posts/[slug]
│   ├── content/           # Astro Content Collections (v5.3 스키마 강제)
│   └── styles/            # global.css + tokens.css (사이트별 자동)
├── public/
│   └── images/            # 사이트별 일러스트 자동 저장 위치
├── astro.config.mjs
├── tailwind.config.mjs
├── package.json
└── README.md
```

## 사용

마스터 템플릿은 직접 사용 X. `../scripts/setup_site.sh <domain>` 으로 사이트 자동 생성.

## v5.3·v5.4·v5.5 자동 강제 항목

### v5.3 글 1편당 14항목 (콘텐츠)
- 텍스트 8항목: 1차 자료 8건+ / 수치 12개+ / 글자수 / 분석 단락 / 반직관 / 계산 / 조건부 결론 / References
- 시각 5종: 인포그래픽 / 비교표 / 데이터 차트 / 다이어그램 / 제품 일러스트
- 동영상 1편: 30-60초 요약

### v5.4 사이트 운영 14항목
- Editorial Process·About·Editorial Standards·AI 디스클로저·Schema.org
- 발행 시간 랜덤화·글 길이 분포·템플릿 차별화·누적 곡선
- Last Updated 분기 갱신·내부 링크·TOC+FAQ
- 단일 분야 깊이·외부 백링크
- AI 사용 투명성

### v5.5 디자인 시스템
- 사이트별 컬러 토큰 16종
- 사이트별 폰트 토큰 16종
- 사이트별 일러스트 톤 16종
- 다크 모드 자동 토글
- shadcn-style 컴포넌트
- 마이크로 인터랙션

## 새 사이트 추가하려면

`../scripts/design-tokens.json` 에 사이트 토큰 1세트 추가 후:
```bash
../scripts/setup_site.sh <new-domain>
```
