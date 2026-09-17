# ✈️ Triptic (트립틱) - 스마트 여행 플래너

> 복잡한 여행 일정을 가장 단순하고 세련되게.  
> 회원가입 없는 올인원 PWA 여행 플래너 & 오프라인 여행 가이드.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Code Review](https://img.shields.io/badge/Code%20Review-Available-orange.svg)](CODE_REVIEW_REPORT.md)

---

## 🌟 주요 특징

- 🧭 **직관적인 일정 관리**: 드래그 앤 드롭으로 장소 순서 조정, 시간 및 메모 등록
- 🗺️ **구글 지도 & 대중교통 길찾기**: 실시간 동선 연결선 및 이동 시간(약 XX분) 자동 계산
- 🍽️ **식사 & 숙소 & 항공편 통합**: 아침/점심/저녁 맛집, 호텔 루프 승계, 항공편 연동
- ✨ **Gemini AI 추천**: Google Gemini API 기반 주변 맛집/카페/명소 큐레이션 및 구글 평점 연동
- 📄 **고화질 PDF 일정표 출력**: 타임라인 요약표와 장소별 상세 가이드가 포함된 A4 인쇄용 PDF 생성
- 🔄 **기기 간 동기화 & 백업**: 로그인 없이 백업 키로 PC와 모바일 간 1초 동기화
- 📱 **PWA & 오프라인 지원**: 비행기나 데이터가 없는 해외에서도 오프라인 사용 가능

---

## 📖 문서

- **[사용 설명서 (USER_MANUAL.md)](./USER_MANUAL.md)**: 전체 기능 및 상세 사용법
- **[코드 리뷰 보고서 (CODE_REVIEW_REPORT.md)](./CODE_REVIEW_REPORT.md)**: 아키텍처 분석 및 개선 제안

---

## 🚀 배포 및 로컬 실행

### 로컬 실행
정적 파일로 구성되어 있어 별도의 빌드 과정 없이 웹 서버를 띄워 바로 실행할 수 있습니다:

```bash
# Python 내장 서버
python3 -m http.server 8000

# Node.js http-server
npx http-server -p 8000

# PHP 내장 서버
php -S localhost:8000
```

브라우저에서 `http://localhost:8000` 접속

### Vercel 배포

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lkjh7609-sketch/Triptic)

```bash
# Vercel CLI로 배포
npm i -g vercel
vercel
```

### 환경 변수 설정 (AI 추천 기능)

Gemini AI 추천 기능을 사용하려면 Vercel 환경 변수에 API 키를 등록합니다:

1. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료 API 키 발급
2. Vercel 프로젝트 설정 → Environment Variables
3. 변수 추가:
   - **키 이름**: `GEMINI_API_KEY`
   - **키 값**: `AIza...` (발급받은 키)
   - **환경**: Production, Preview, Development 모두 선택

**무료 할당량**: 하루 1,500회 요청 무료

---

## 🏗️ 기술 스택

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Maps**: Google Maps JavaScript API, Places API
- **AI**: Google Gemini API
- **Storage**: localStorage (클라이언트 사이드)
- **PDF**: jsPDF
- **PWA**: Service Worker, Web App Manifest
- **Deployment**: Vercel (Serverless Functions)

---

## 📁 프로젝트 구조

```
triptic/
├── index.html              # 메인 애플리케이션 (SPA)
├── manifest.json           # PWA 매니페스트
├── sw.js                   # Service Worker
├── api/
│   └── recommend.js        # Vercel Serverless Function (AI 추천)
├── public/                 # 정적 자산
├── ios/                    # iOS Capacitor 빌드
├── README.md               # 프로젝트 개요
├── USER_MANUAL.md          # 사용자 가이드
└── CODE_REVIEW_REPORT.md   # 코드 리뷰 및 개선 제안
```

---

## 🔐 보안 및 프라이버시

- ✅ **회원가입 불필요**: 모든 데이터는 사용자 기기의 localStorage에 저장
- ✅ **서버 저장 없음**: 개인 여행 정보는 서버에 저장되지 않음
- ✅ **공유 링크**: 사용자가 명시적으로 생성한 경우에만 암호화된 URL로 공유
- ⚠️ **주의사항**: 브라우저 캐시 삭제 시 데이터 손실 가능 (백업 기능 사용 권장)

---

## 🐛 알려진 이슈 및 개선 계획

현재 Triptic은 MVP 단계로, 프로덕션 레벨 서비스를 위한 개선이 진행 중입니다.  
자세한 내용은 **[코드 리뷰 보고서](./CODE_REVIEW_REPORT.md)**를 참조하세요.

### 긴급 개선 사항
- [ ] XSS 취약점 패치 (innerHTML 사용 지점 sanitization)
- [ ] API 키 보안 강화
- [ ] localStorage 용량 초과 에러 처리

### 장기 개선 계획
- [ ] 파일 모듈화 (단일 HTML → 모듈 구조)
- [ ] TypeScript 마이그레이션
- [ ] 단위 테스트 및 E2E 테스트 구축
- [ ] WCAG 2.1 접근성 준수

---

## 🤝 기여하기

기여는 언제나 환영합니다! 다음 절차를 따라주세요:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

**코드 리뷰 체크리스트**:
- [ ] XSS 방어: 모든 사용자 입력에 `escapeHtml()` 적용
- [ ] 전역 변수 사용 최소화
- [ ] 에러 핸들링 추가
- [ ] 접근성 (ARIA 레이블, 키보드 네비게이션)

---

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

---

## 👨‍💻 개발자

**Ben Lee**  
GitHub: [@lkjh7609-sketch](https://github.com/lkjh7609-sketch)

---

## 🙏 감사의 말

- Google Maps Platform
- Google Gemini API
- Pretendard Font
- jsPDF Library
- Vercel Platform

---

**⭐ 이 프로젝트가 도움이 되셨다면 Star를 눌러주세요!**