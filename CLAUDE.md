# Triptic 작업 지침 (프로젝트)

> 이 저장소를 여는 Claude는 먼저 이 파일을 읽는다. 사용자(이재헌)와 admin·lkjh 두 계정이 같은 저장소를 쓴다(브랜치 `admin/*`, `lkjh/*` → PR → main). 문서는 `docs/updates/4-v1.1.0/changelog.md`(현재 단계 기록)에 날짜별로 쌓는다.

## 🚧 iOS 앱 출시 — 보류 중 (2026-10-08 결정)

**보류 이유**: 앱 출시와 함께 넣으려는 **항공 검색 결과(앱 안 목록)를 Kayak 운영 API로 제공**할 계획인데 Kayak 운영 키가 아직 안 나왔다(샌드박스만 통과, 2026-10-08 후속 메일 보냄). 마이리얼트립에도 항공 검색 결과 API를 문의 중. **API가 오면 그때 재개한다.**

**작업 방식(사용자 지시)**: 웹 사이트 운영은 그대로 한다. **앱 개편 때는 웹 폴더(`~/Triptic`)는 그대로 두고, 현재 내용을 복제한 새 폴더에서 앱 작업을 한다**(예: `~/Triptic-app`, 별도 브랜치·저장소). 웹 폴더·웹 배포(triptic.my)에는 앱 전용 변경을 넣지 않는다.

### 진행하다 만 것 (PR #10, 되돌려 main에서 빠짐 — 내용은 git 기록에 있다)
- 브랜치 `admin/native-push`(origin에 남아 있음), 머지 커밋 `e0f2133`(PR #10) — **되살리려면 새 폴더에서 이 브랜치/커밋을 가져온다**.
  - `3b76a8b` 푸시 서버: Edge Function `supabase/functions/send-push`(APNs, ES256 JWT를 WebCrypto로 서명) + `supabase/migrations/0103_push_delivery.sql`(댓글·답글 알림 트리거, 출발 3일 전 cron 09:05 한국, `push_log`). 함수 배포·APNs 비밀값(APNS_KEY·APNS_KEY_ID·APNS_TEAM_ID·APNS_TOPIC) 등록 **뒤에** 0103을 적용한다(운영 DB에는 **미적용**). 좋아요는 안 보낸다. 잠금 화면 문구엔 글 내용 없음.
  - `0dd4cb3` 푸시 앱 쪽: 로그인하면 권한 묻고 기기 등록(`PushBootstrap`), 알림 탭 → 앱 안 경로 이동, 로그아웃 때 이 기기 토큰 삭제.
  - `db349d9` iOS 설정: `App.entitlements`(푸시·Apple 로그인·`applinks:triptic.my`), `PrivacyInfo.xcprivacy`, Info.plist(원격 알림·사진 보관함 문구), AppDelegate 토큰 전달, pbxproj 연결, `public/.well-known/apple-app-site-association`(+vercel.json 헤더), `codemagic.yaml`.
- **사용자 결정**: **iPhone 전용**(project.pbxproj `TARGETED_DEVICE_FAMILY = "1,2"` → `"1"`로 바꾸고 iPad 방향 키 정리 — 아직 안 바꿈), 푸시 알림 포함.

### 이미 main에 있는 앱 관련 코드 (웹에서는 동작하지 않아야 한다)
- PR #9 앱 소셜 로그인: `src/shared/api/nativeAuth.ts`(인앱 브라우저 → `com.triptic.travel://auth/callback?code=` 복귀, 앱에서만 PKCE), `@capacitor/app`·`@capacitor/browser`, Info.plist URL scheme. ⚠️ Supabase Authentication → URL Configuration → Redirect URLs에 `com.triptic.travel://auth/callback` 등록 필요(운영 설정, 사용자).
- 앱에서 바깥 링크는 인앱 브라우저(`src/shared/externalLink.ts`), 호텔 탭은 웹=검색창 위젯 / 앱=구글 자동완성+우리 화면 결과(`HotelsScreen`).
- Kayak 연결은 **전부 제거됨**(PR #7, 커밋 `bae400c`) — Kayak 운영 키가 오면 그 이전 상태(항공 결과 목록은 `f09a626`에서 만들었다)를 되살려 항공에 붙인다. 호텔은 Agoda로 대체됨(화면에 제휴사 이름을 쓰지 않는다는 사용자 결정).

### 반드시 기억할 함정
1. **`isNativeApp()`**: `window.Capacitor`가 있는지만 보면 안 된다 — `@capacitor/core`를 번들에 넣으면 웹에서도 그 전역이 생긴다. 2026-10-08 푸시 코드를 메인 번들에 넣었다가 **웹 호텔 탭·소셜 로그인이 앱 방식으로 바뀌는 사고**가 났다. 지금은 `isNativePlatform()`을 본다(`src/shared/platform.ts`, 시험 있음). 앱 전용 코드를 웹 번들에 정적으로 import하기 전에 웹 동작을 꼭 확인할 것.
2. **약관·개인정보처리방침 원본은 루트 `terms.html`/`privacy.html`** 이다. 빌드(`scripts/build.js`)가 루트 → `public/`으로 덮어쓰므로 `public/`만 고치면 운영에 안 나간다(두 번 겪음). 현재 루트 문서에는 호텔 제휴 Agoda 전환·Open-Meteo 제거·담당자 '이재헌'이 **반영돼 있지 않다**(PR #10과 함께 되돌려짐) — 사용자에게 다시 반영할지 확인할 것.
3. Xcode가 이 컴퓨터에 없다(명령줄 도구만) — iOS 빌드는 **Codemagic**에서. pbxproj·plist는 문법(`plutil -lint`)·참조만 검증했고 실제 빌드는 못 했다.
4. 앱에서 구글 지도 키의 '웹 주소 제한'이 `capacitor://localhost`에서 막힐 수 있다 — 첫 TestFlight에서 지도가 뜨는지 확인.
5. 사용자 질문은 한두 번에 묶어서, 불확실하면 임의로 정하지 말고 묻는다. 비밀값(키·토큰)은 채팅에 쓰지 않는다.

### 재개 체크리스트
- [ ] Kayak 운영 API 키 확인(또는 마이리얼트립 항공 검색 API) → 항공 앱 안 결과 연동
- [ ] 새 폴더로 복제 → PR #10 내용(브랜치 `admin/native-push`) 가져오기 → iPhone 전용으로 pbxproj 수정
- [ ] Apple: App ID `com.triptic.travel`(Sign in with Apple·Push·Associated Domains), App Store Connect 앱 생성, API 키(Issuer ID·Key ID·.p8), APNs 키(.p8), EU DSA 사업자 신고(또는 한국 먼저 출시), 판매자 이름이 개인 이름으로 보이는 점 확인
- [ ] Supabase Redirect URL 등록, `send-push` 배포 + 비밀값 → 0103 적용
- [ ] Codemagic: 저장소 연결, App Store Connect 통합, 환경변수 그룹 `triptic_app`(`VITE_*`), `APP_STORE_APPLE_ID`
- [ ] 심사용 데모 계정, iPhone 6.7인치 스크린샷, App Privacy(수집 정보) 입력, 개인정보처리방침·약관 최신화(함정 2)
