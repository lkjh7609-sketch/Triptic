# 08. App Store 출시 체크리스트

> 출시 2주 전부터 이 문서를 위에서 아래로 소화한다. **한 항목이라도 비어 있으면 제출하지 않는다.**
> 이 문서는 법률 자문이 아니다. 법무 항목(§7)은 반드시 전문가 검토를 받는다.

---

## 1. 빌드 환경 (⚠️ 강제 요건)

- [ ] **Xcode 26 이상**으로 빌드 (2026년 4월 28일부터 App Store Connect 업로드 필수 요건)
- [ ] **iOS 26 SDK**로 빌드
- [ ] macOS Sequoia 15.6 이상 (Xcode 26 요구사항)
- [ ] Deployment Target은 낮춰도 된다 → **iOS 16.0** 권장 (구형 기기 지원과 API 가용성의 균형)
- [ ] Capacitor 8.5+ 최신 패치
- [ ] Release 빌드에서 소스맵·콘솔로그 제거
- [ ] Bitcode 관련 설정 불필요 (이미 폐지됨)

## 2. 앱 식별·서명

- [ ] Apple Developer Program 멤버십 유효 ($99/년, WeatherKit도 여기 포함)
- [ ] App ID: `com.triptic.travel` (기존 `capacitor.config.json`과 일치)
- [ ] Capability: Sign in with Apple, Push Notifications, **WeatherKit**, Associated Domains(유니버설 링크)
- [ ] 배포 인증서 + 프로비저닝 프로파일
- [ ] App Store Connect 앱 레코드 생성

## 3. 필수 기능 요건 (없으면 확정 리젝)

### 3.1 계정 삭제 — Guideline 5.1.1(v)

- [ ] **앱 내에서** 계정 삭제가 완결된다 (웹 링크로 보내면 안 됨)
- [ ] 설정 > 계정 > 계정 삭제 경로가 3단계 이내
- [ ] 삭제되는 데이터를 사전 고지
- [ ] 재인증 후 실행
- [ ] 30일 유예 후 `auth.users` 포함 완전 삭제 (스케줄러 동작 확인)
- [ ] 심사 노트에 경로를 명시

### 3.2 로그인 — Guideline 4.8

소셜 로그인으로 주 계정을 만드는 앱은, 아래 3조건을 만족하는 **대체 로그인**을 함께 제공해야 한다:
① 이름·이메일만 수집 ② 이메일 비공개 옵션 제공 ③ 동의 없는 광고 추적 없음

- [ ] **Sign in with Apple 구현** (Google/Kakao만으로는 ②를 만족하지 못한다)
- [ ] Apple 로그인 버튼이 목록 **최상단**에 배치
- [ ] Apple의 "이메일 숨기기(Private Relay)" 주소로도 정상 가입·이용 가능한지 테스트
- [ ] 기존 Google/Kakao 계정과의 계정 병합 정책 결정 및 구현

### 3.3 UGC — Guideline 1.2

→ [`06-community.md` §5](06-community.md)

- [ ] 게시 전 자동 콘텐츠 필터 동작
- [ ] 모든 콘텐츠·사용자에 신고 기능
- [ ] 사용자 차단 기능 (양방향 즉시 반영)
- [ ] 개발자 연락처가 앱 내에 **표시**됨
- [ ] EULA에 "무관용 원칙" 문구 (3개 언어)
- [ ] 24시간 내 신고 처리 프로세스 문서화
- [ ] 심사 노트에 테스트 방법 기재

## 4. 개인정보

### 4.1 Privacy Manifest (`PrivacyInfo.xcprivacy`)

2024년 5월 1일부터 Required Reason API 사용을 선언하지 않으면 App Store Connect가 업로드를 거부한다.

- [ ] `ios/App/App/PrivacyInfo.xcprivacy` 생성
- [ ] `NSPrivacyAccessedAPITypes` 선언:
  - `NSPrivacyAccessedAPICategoryUserDefaults` → 이유 `CA92.1` (앱 자체 설정 저장)
  - `NSPrivacyAccessedAPICategoryFileTimestamp` → 사용 시 `C617.1`
  - `NSPrivacyAccessedAPICategoryDiskSpace` → 사용 시 `E174.1`
- [ ] `NSPrivacyCollectedDataTypes` 선언 (수집 항목·목적·연결 여부)
- [ ] 사용 중인 **서드파티 SDK의 privacy manifest·서명** 확인 (Capacitor 플러그인, Sentry, PostHog)
- [ ] `NSPrivacyTracking` = false (추적 안 함)

### 4.2 Info.plist 권한 문구

현재 `NSLocationWhenInUseUsageDescription`만 있다. 신규 기능에 필요한 것을 추가한다.

- [ ] `NSLocationWhenInUseUsageDescription` (기존 — 유지)
- [ ] `NSPhotoLibraryUsageDescription` — 커뮤니티 이미지, 바우처 업로드
- [ ] `NSCameraUsageDescription` — 바우처 촬영 (카메라 기능 넣을 경우)
- [ ] `NSPhotoLibraryAddUsageDescription` — 일정 이미지 저장 기능 넣을 경우
- [ ] 문구는 **구체적으로**. "사진 접근이 필요합니다" ❌ → "여행 사진을 커뮤니티에 올리기 위해 사진 보관함에 접근합니다" ✅
- [ ] 3개 언어 현지화 (`InfoPlist.strings`)

### 4.3 개인정보 라벨 (App Store Connect)

실제 수집 항목과 **정확히** 일치해야 한다. 틀리면 나중에 리젝된다.

| 데이터 | 수집 | 앱 기능 연결 | 추적 |
|---|---|---|---|
| 이메일 주소 | 예 (로그인) | 예 | 아니오 |
| 이름 | 예 | 예 | 아니오 |
| 사진 | 예 (커뮤니티·바우처) | 예 | 아니오 |
| 정확한 위치 | 예 (지도 현재 위치) | 예 | 아니오 |
| 사용자 콘텐츠 | 예 (여행 일정·글·문서) | 예 | 아니오 |
| 진단 데이터 | 예 (Sentry) | 예 | 아니오 |
| 사용 데이터 | 예 (PostHog) | 예 | 아니오 |

- [ ] **예약 문서(바우처)** 항목을 "기타 사용자 콘텐츠"로 반드시 선언
- [ ] 개인정보처리방침에 문서 파싱 과정(외부 AI 전송, 마스킹, 미저장)을 **명시**

## 5. 기능 검증 (실기기)

- [ ] iPhone SE(작은 화면) / iPhone 표준 / iPhone Pro Max / iPad 에서 레이아웃 확인
- [ ] 다크 모드 전 화면
- [ ] 3개 언어 전 화면
- [ ] Dynamic Type 최대 크기
- [ ] VoiceOver로 핵심 플로우 완주
- [ ] **비행기 모드**: 일정·바우처 열람 가능, 쓰기는 큐에 적재 후 복구 시 동기화
- [ ] 느린 네트워크(Network Link Conditioner 3G)에서 타임아웃·스켈레톤 정상
- [ ] 백그라운드 → 포그라운드 복귀 시 상태 유지
- [ ] 푸시 알림 수신 → 딥링크로 해당 화면 진입
- [ ] 유니버설 링크: 공유 링크를 Safari에서 열면 앱으로 전환
- [ ] **인앱 결제 없음 확인** — 3.0은 과금 코드를 포함하지 않는다. 결제·구독·가격 관련 UI나 외부 결제 링크가 **하나도 남아 있지 않은지** 검색으로 확인 (심사자가 결제 흐름을 찾다가 리젝하는 일을 막는다)

## 6. 성능·안정성

- [ ] 콜드 스타트 → 첫 화면 **≤ 2.5초** (중급 기기)
- [ ] 초기 JS 번들 ≤ 250KB (gzip)
- [ ] 메모리: 30개 일정 여행 열람 시 ≤ 250MB
- [ ] 크래시 프리 세션 ≥ 99.5% (TestFlight 2주 기준)
- [ ] Sentry 릴리즈 태깅 + 소스맵 업로드
- [ ] 지도 화면에서 60fps 스크롤 유지
- [ ] 메모리 누수 점검 (여행 상세 10회 진입/이탈 후 메모리 안정)

## 7. 법무 (전문가 검토 필수)

- [ ] 이용약관 3개 언어 — UGC 무관용 조항 포함
- [ ] 개인정보처리방침 3개 언어 — 아래 내용 반드시 포함
  - 수집 항목·목적·보유기간
  - **예약 문서 처리**: 외부 AI 서비스 전송 사실, 마스킹 범위, 원문 미저장
  - 국외 이전 (Supabase, Vercel, Google, Apple 서버 위치)
  - 제3자 제공 현황
  - 이용자 권리 (열람·정정·삭제·처리정지)
  - 개인정보보호책임자 연락처
- [ ] 만 14세 미만 가입 처리 방침 (한국 개인정보보호법)
- [ ] **위치기반서비스 사업 신고** 필요 여부 검토 (한국 위치정보법)
- [ ] 오픈소스 라이선스 고지 페이지
- [ ] 연령 등급 설정 — UGC가 있으면 보통 12+ 이상
- [ ] 수출 규정: HTTPS만 사용 → `ITSAppUsesNonExemptEncryption = false` (기존 설정 유지, 단 암호화 기능 추가 시 재검토)

## 8. 스토어 리스팅 (3개 언어)

- [ ] 대상 언어는 **한국어 / English / 简体中文(zh-CN) 3종**. 번체(zh-TW)는 3.0 범위 밖
- [ ] 앱 이름 (30자), 부제 (30자)
- [ ] 설명 (4,000자) — 핵심 기능 3가지를 앞 3줄에
- [ ] 키워드 (100자) — 언어별로 다르게 최적화
- [ ] 프로모션 텍스트 (170자)
- [ ] **스크린샷**: 6.9인치 필수 + 6.5인치 · iPad 12.9인치(iPad 지원 시)
  - 권장 순서: ① 서류 자동 인식 ② 지도 동선 ③ 대시보드 ④ 커뮤니티 ⑤ 바우처
- [ ] 앱 프리뷰 영상 (선택, 있으면 전환율에 유리)
- [ ] 앱 아이콘 1024×1024 (알파 채널 없음) — 기존 `icon-1024.png` 검증
- [ ] 지원 URL / 마케팅 URL / 개인정보처리방침 URL
- [ ] 카테고리: 여행 (1차), 라이프스타일 (2차)

## 9. 심사 노트 (App Review Information)

```
Demo account:
  ID: review@triptic.my
  PW: (App Store Connect에 입력)
  ※ 이 계정에는 샘플 여행 2건과 샘플 바우처가 미리 들어 있습니다.

Notes for reviewer:

1) Document auto-fill (main feature)
   Plan tab → open "Tokyo Trip" → "+ Document" → pick the bundled
   sample PDF → review sheet appears → confirm → itinerary is filled.
   Sensitive fields (passport / card numbers) are redacted on-device
   before any external processing.

2) Content moderation (Guideline 1.2)
   - Posts and images are screened automatically before publishing.
   - Report: any post → "⋮" (top-right) → Report.
   - Block: any user profile → "⋮" → Block User. Blocked users'
     content disappears from the feed immediately.
   - Support contact: Settings → Contact Us (email is shown in-app).
   - Reports are reviewed within 24 hours.

3) Account deletion (Guideline 5.1.1(v))
   Settings → Account → Delete Account. Completes fully in-app.

4) Sign in with Apple is offered alongside Google and Kakao.

5) Location is used only to show the user's position on the map and
   to search nearby places. The app works fully without it.
```

## 10. 제출 직전

- [ ] 버전·빌드 번호 증가
- [ ] TestFlight 외부 테스트 **2주 이상, 20명 이상** 완료
- [ ] TestFlight에서 보고된 크래시 전부 해결
- [ ] 프로덕션 환경변수 확인 (스테이징 키가 섞이지 않았는지)
- [ ] Supabase 프로덕션 RLS 정책 전수 점검 — **정책 없는 테이블 0개**
- [ ] Google Maps API 키에 iOS 번들 ID 제한 적용
- [ ] API 일일 쿼터 알람 설정 (Maps, Gemini, aviationstack)
- [ ] 서비스 상태 페이지 또는 장애 공지 수단 준비
- [ ] 롤백 계획: 심각한 버그 발견 시 이전 버전으로 되돌리는 절차

## 11. 출시 후 첫 주

- [ ] 크래시율 일 1회 확인
- [ ] 신고 큐 일 1회 확인 (24시간 SLA)
- [ ] API 비용 일 1회 확인 (특히 Google Maps)
- [ ] 리뷰 응답 (App Store Connect에서 직접 답변)
- [ ] 문서 파싱 실패 로그 수집 → 파서 개선 우선순위 결정
- [ ] 핫픽스 브랜치 준비

---

## 12. 자주 리젝되는 항목 (사전 점검)

| 가이드라인 | 내용 | 대비 |
|---|---|---|
| 2.1 App Completeness | 데모 계정 미작동, 기능 미완성 | 제출 전 데모 계정으로 전 기능 직접 확인 |
| 4.2 Minimum Functionality | "웹사이트를 감싼 앱"으로 판단 | 네이티브 기능(푸시·위젯·오프라인·카메라) 명확히 |
| 5.1.1 Data Collection | 불필요한 권한 요구, 회원가입 강요 | 비로그인 둘러보기 제공 (이미 구현되어 있음) |
| 5.1.1(v) | 계정 삭제 없음 | §3.1 |
| 4.8 | 대체 로그인 없음 | §3.2 |
| 1.2 | UGC 안전장치 미흡 | §3.3 |
| 3.1.1 | 외부 결제 유도 | **3.0은 해당 없음** (IAP 미포함). 단 "프리미엄", "업그레이드" 같은 문구도 남기지 말 것 — 결제 수단 없이 유료를 암시하면 혼선을 준다. 4.0에서 IAP 추가 시 StoreKit만 사용하고 **재심사 대상**이 된다 |
| 2.3.x | 스크린샷이 실제 화면과 다름 | 실기기 캡처만 사용 |
