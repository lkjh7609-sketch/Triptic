---
name: triptic-3-0-rewrite-progress
description: "Triptic 3.0 전면 개편(docs/DEVELOPMENT_PLAN.md 기반) 진행 상황 — Phase 2·3·4·5 main에 완료. AI 전부 DeepSeek 전환. Phase 6(다국어+접근성+오프라인+푸시) 진행 중 컴퓨터 종료로 중단(커밋 409cee4) — i18n 인프라/CI검사/오프라인캐시/푸시배선/공통·홈·설정·서류·커뮤니티 화면 전환 완료, Plan 탭(PlanScreen 이후 9개 파일) 미완료. push 안 됨, 마이그레이션 0024 미적용. Phase 7 0%. 재개 방법 최상단에 정리"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b57a391-3287-4815-ac26-803d7e6f1704
  modified: 2026-09-21T09:57:04.147Z
---

## 🔴🔴🔴🔴🔴 2026-09-21 (사용자가 컴퓨터를 꺼야 해서 강제 중단) — 다음 세션은 반드시 이 문단부터 읽을 것

사용자가 "나 지금 컴퓨터 꺼야해"라고 알려서 세션이 중단됐다. **작업 자체는
안전하게 커밋해뒀다(`409cee4`, 로컬 main 브랜치, 4게이트 전부 통과 확인 후
커밋함)** — 디스크에 남아있으므로 컴퓨터를 다시 켜면 그대로 이어받을 수
있다. 단, **아직 origin에 push 안 했다** (이 세션에서 origin과 1개
커밋 이상 차이 나는 상태 — 다음 세션 시작 시 `git log --oneline
origin/main..HEAD`로 몇 개인지 재확인할 것, push는 매번 사용자 확인 후
진행하는 원칙 유지).

### 이번 세션(Phase 6)에서 일어난 일 전체 타임라인

1. 사용자가 "phase 6 바로 진행해줘" 지시 → fork로 전수조사(Phase 6가
   실제로는 0% 착수 상태임을 확인 — 아래 "2026-09-21 (Phase 6 착수)
   전수조사 결과" 문단 참고, 지금도 유효).
2. **i18n 인프라 구축** — 커밋 `a544079`. `src/shared/i18n/`
   (index.ts, backend.ts, particle.ts, fonts.ts, useSyncLocale.ts),
   `src/locales/{ko,en,zh-CN}/*.json`(7개 네임스페이스: common/home/
   plan/documents/community/settings/weather). i18next-icu는 번들
   크기 때문에 뺐다(ICU 없이 i18next 내장 plural만 사용).
3. **CI 검사 스크립트 + 의사 로케일** — 커밋 `6224bf2`, 버그 수정
   `6d1f84e`. `scripts/check-i18n.js`(`npm run check:i18n`), CI
   워크플로(`i18n` job, 아직 build의 `needs`에는 안 넣음 — 전환 다
   끝나면 넣을 것). `VITE_PSEUDO_LOCALE=1` 의사 로케일 지원.
4. **접근성 죽은 코드 정리** — 커밋 `80b0996`, 다크모드 테스트 추가
   `59d3f4f`. `src/utils/accessibility.ts`(완전 죽은 코드, 아무도
   import 안 함) 삭제하고 `src/shared/a11y/`(useFocusTrap.ts,
   contrast.ts+test, announce.ts)로 재작성.
5. **오프라인 캐시** — 커밋 `1d4f5dd`. TanStack Query 공식 persist
   플러그인(`@tanstack/react-query-persist-client` +
   `query-async-storage-persister`) + `idb-keyval`로 IndexedDB
   영속화. `App.tsx`가 `PersistQueryClientProvider` 사용, 로그아웃 시
   `clearOfflineCache()` 호출.
6. **푸시 알림 클라이언트 배선 + 설정 언어 실전환** — 커밋 `29da1a9`.
   `@capacitor/push-notifications` 설치, `src/shared/push/`
   (registerPush.ts, pushService.ts), `supabase/migrations/
   0024_push_tokens.sql`(**프로덕션에 아직 미적용** — 사전 확인
   필요), `src/shared/platform.ts`(isNativeApp 공용화). 설정 화면
   언어 select가 이미 `useSyncLocale`로 실제 전환되고 있었음을
   확인(안내 문구만 지움).
7. **fork1(공통/홈/설정 화면 i18n)** — 커밋 `4c42241`. 완료.
8. **fork2(Plan 탭)와 fork3(Documents/Community)를 병렬 실행** —
   fork2가 `src/features/plan/expenses.ts`(통화 `Intl.NumberFormat`화),
   `planDateFormat.ts`(신규, 날짜 포맷 공용 유틸) 등을 만들며 진행하다
   `PlanScreen.tsx` 진입 직후, fork3가 4게이트 중 build 실행 직전에
   **사용자의 컴퓨터 종료로 강제 중단됨(status: killed)**.
9. 중단 직후 상태 점검: `npm run typecheck`가 `PlanScreen.tsx`의
   미사용 `t` 변수 에러 하나만 있었음 → `void t;` 임시 마커로 해소하고
   4게이트 전부 통과 확인 → **`409cee4`로 안전 커밋**.

### 다음 세션이 정확히 어디서 이어야 하는지

**완료된 화면(더 손댈 것 없음)**: common/home/settings(fork1),
community 9개 파일 전체, documents 4개 파일 전체, shared 3개 파일
(GuestNameModal/SharedTripScreen/SuggestPlaceModal, community.json에
통합) — 전부 `409cee4`와 그 이전 커밋에 포함됨.

**Plan 탭 — 부분 완료, 여기서 이어갈 것**:
- 완료: `AddPlaceModal`, `BackupModal`, `CreateTripModal`, `DayChips`,
  `DayCityModal`, `ExpenseChart`(+test), `ExpenseModal`,
  `FixedPointCard`, `FlightModal`, `ItemDetailSheet`, `MealsModal`,
  `expenses.ts`(+test, 통화 포맷 `Intl.NumberFormat`화),
  `planDateFormat.ts`(신규 — 날짜 포맷 공용 유틸, 07-i18n.md §5.1).
- **미완료 — `PlanScreen.tsx`**: `useTranslation(['plan','common'])`
  훅만 추가된 채 본문 15줄이 그대로 한글 하드코딩이다. 파일 25-26행에
  `void t; // TODO(Phase6-C 재개): ...` 마커를 심어뒀다 — **이 줄부터
  찾아서 이어서 작업할 것.**
- **전혀 손 안 댐**: `LegLabel.tsx`, `SampleTripCard.tsx`,
  `SetHotelModal.tsx`, `ShareSheet.tsx`, `SortableItineraryItem.tsx`,
  `SuggestionsModal.tsx`, `TripCard.tsx`, `TripDetailScreen.tsx`,
  `TripMapView.tsx` (9개 파일, `src/features/plan/` 아래).
- 이 그룹 지시사항은 이전에 fork2에게 준 프롬프트 그대로 재사용
  가능하다 — 포커스 트랩 적용 대상 모달 목록(`SetHotelModal`,
  `ShareSheet`, `SuggestionsModal`도 포함됨), 날짜는
  `planDateFormat.ts`(이미 있음, 재사용), 통화는 `expenses.ts`의
  갱신된 포맷 함수 재사용.

**그 다음 순서(원래 계획 그대로, 변화 없음)**:
1. Plan 탭 마저 완료(위 9개 파일 + PlanScreen.tsx).
2. 전체 `npm run check:i18n` 돌려서 하드코딩 한글 0건 확인(지금은
   plan 탭 미완료분이 걸릴 것 — 정상).
3. CI 워크플로의 `i18n` job을 `build`의 `needs`에 추가해 실제 게이트로
   승격.
4. `supabase/migrations/0024_push_tokens.sql` 적용 여부 사용자에게
   확인 후 적용(`mcp__supabase__apply_migration`).
5. 접근성 마무리: Plan/Documents/Community 모달들에 `useFocusTrap`
   실제 적용 확인(fork2/fork3가 어디까지 했는지 diff로 확인 필요 —
   지시는 했지만 중단으로 전부 반영됐는지 미확인).
6. VoucherArchive.tsx의 오프라인 자동 다운로드는 fork3에게 "인프라
   차원에서 이미 해결됐을 가능성이 높으니 깊이 파지 말라"고 지시해둠
   — 실제로 어떻게 처리했는지 diff 확인 필요.
7. 최종 4게이트 + git push(사용자 확인 후) + 이 memory 파일 정리.
8. Phase 6 완료 기준(DEVELOPMENT_PLAN.md §9): "3개 언어 모두 문자열
   누락 0건, 레이아웃 깨짐 0건. VoiceOver로 여행 생성~일정 추가 완주
   가능. 비행기 모드에서 일정·바우처 열람 가능." VoiceOver 실기기
   검증과 실제 비행기 모드 검증은 이 환경(브라우저 자동화 도구도
   이번 세션 중 연결 끊김)에서 완전히 검증하기 어려울 수 있음 —
   코드 레벨 보장(포커스 트랩, aria-label, IndexedDB 캐시)까지가
   현실적 목표일 수 있다는 걸 염두에 둘 것.

### 알아둘 것

- `npm run check:i18n`은 4게이트에 포함 안 됨(별도 스크립트) — 화면
  전환 커밋마다 수동으로 같이 돌려서 확인해왔다.
- en 전용 `_one` 플러럴 키를 ko 기준 고아 키로 오탐하던 버그는
  `6d1f84e`에서 이미 고쳤다.
- 초기 번들(`preview-*.js`) 크기: 190.51KB(gzip), 예산 250KB 내지만
  여유가 많이 줄었다(도입 전 108.23KB) — 이후 기능 추가 시 계속 확인할 것.
- push_tokens 마이그레이션(0024)은 코드만 있고 DB에 미적용 상태.
  실제 발송(APNs)은 Apple Developer Program 미가입으로 여전히 미구현
  — 배선만 해두는 기존 원칙과 동일.

## ⚠️⚠️⚠️⚠️ 2026-09-21 (Phase 6 착수) 전수조사 결과

Phase 5 완료 직후 사용자가 "phase 6 바로 진행해줘"라고 지시해서 착수. 시작
전에 fork로 Phase 6 관련 코드를 전수조사했는데, **설정 화면 UI만 보고
"꽤 됐다"고 착각할 뻔했다가 바로잡았다.** 결론: **Phase 6는 실질적으로
0% 착수 상태**다.

**확인된 사실 (fork 조사, 2026-09-21)**:
- `src/locales/` 디렉토리 자체가 없음(이전 감사와 동일, 여전히 정확).
  `src/shared/i18n/`은 존재하지만 빈 디렉토리. i18next/react-i18next는
  `package.json`에 설치만 돼 있고 `useTranslation`/`from 'i18next'` 코드
  참조 **0건**.
- **설정 탭(`SettingsScreen.tsx`, 272줄)은 UI와 DB 저장까지는 이미 완성돼
  있다** — 이전 메모리의 "70% 플레이스홀더" 기록은 stale했다. 계정/데이터/
  정보 섹션은 완전히 동작. 환경설정 섹션도 테마는 실제 동작(로컬
  `theme.ts`), 온도/거리/통화/언어는 `profiles` 테이블에 저장까지 되지만
  **"저장만" 되고 실제로 앱에 반영(표시 언어 전환, 지도 단위 변환)은 안
  됨** — 코드 스스로 그렇게 명시(190행 "표시 언어 전환은 다음 업데이트에서
  지원돼요"). 알림 섹션도 UI+저장(`profiles.notification_prefs` jsonb,
  0017 마이그레이션)은 있지만 **실제 발송 파이프라인 0%**.
  → **결론: profileService/useProfile 백엔드 레이어는 재사용 가능, 할 일은
  "그 값을 실제로 소비하는 로직"을 만드는 것.**
- **바우처 보관함**(`VoucherArchive.tsx`, 187줄)은 **이미 상당히 구현돼
  있었다**(이전 감사엔 "0%"로 잘못 기록돼 있었음 — Phase 4 후속 세션에서
  만들어진 듯). 목록/이미지뷰어/공유/삭제 동작. TripDetailScreen의 🎟
  버튼으로 모달 진입(별도 라우트 없음, 스펙도 요구 안 함). 빠진 건
  오프라인 자동 다운로드 캐시뿐. **"연결된 일정 항목으로 이동" 링크는
  ADR-002에서 의도적으로 안 만들기로 결정된 상태**라 02-screens.md §3.6
  스펙과 배치됨 — Phase 6 진행 전에 이 결정을 유지할지 재검토 필요(다음
  세션 판단 필요, 아직 안 함).
- `src/utils/accessibility.ts`(210줄, `setAriaAttributes`/`trapFocus`/
  `getContrastRatio` 등)는 **완전히 죽은 코드** — 어디서도 import 안 됨,
  구 3.0 이전 커밋(`f755b0f`)의 잔재. 삭제하거나 실제로 배선할지 결정
  필요. `aria-label` 실사용 19건뿐.
- IndexedDB 관련 코드 0건(`indexedDB`/`idb-keyval`/`from 'idb'` 전부
  0건, 이전 감사와 동일). `sw.js`는 Phase 2 수준 PWA 캐싱(cache-first
  정적자산, network-first HTML/API)까지만, 오프라인 쓰기 큐 없음.
- `@capacitor/push-notifications` 미설치, 관련 코드 0건. 알림 테이블/
  발송 함수도 없음(0017은 "설정값 저장"만, 발송 파이프라인 아님).
- `git worktree list`/`git branch --no-merged main` 둘 다 깨끗함 —
  entitlements 때처럼 숨겨진 미병합 브랜치는 **이번엔 없음**. Phase 6는
  정말 어디에도 없다.

**다음 세션(또는 이어지는 이 세션) 시작점**(우선순위 순):
1. `src/locales/{ko,en,zh-CN}/*.json` 생성 + i18next 초기화(`main.tsx`
   배선) + `src/shared/i18n/particle.ts`(07-i18n.md §2, §3.1 그대로).
2. 전체 화면(128개 파일에 한글 하드코딩, `grep -rlP '[가-힣]' src/
   --include="*.tsx" --include="*.ts" | grep -v .test. | wc -l`로 확인)
   순차 i18n 전환 + en/zh-CN 번역 — 화면/모듈 단위로 커밋 분리.
3. `scripts/check-i18n.ts` CI 게이트(§9).
4. 설정 화면의 "언어" select에 실제 `i18n.changeLanguage()` 연결, 거리
   단위 실제 반영은 지도/경로 표시 쪽 후속 작업으로 분리 가능.
5. `src/utils/accessibility.ts` 죽은 코드 처리(삭제 vs 재배선) 먼저
   결정.
6. IndexedDB 오프라인 쓰기 큐 + VoucherArchive 자동 다운로드 캐시는 같은
   인프라로 묶어서 설계.
7. 푸시는 `@capacitor/push-notifications` 설치부터, 발송 테이블/함수
   마이그레이션 신설. **Apple Developer Program 미가입이라 실제 APNs
   키는 이전 원칙과 동일하게 배선만 하고 비워둘 것.**

## ⚠️⚠️⚠️ 2026-09-21 (세 번째 후속) Phase 5 전체 구현+검증+DeepSeek 전환 완료 — 다음 세션은 이 문단부터

이전 두 문단(전수 감사, 재점검)이 "Phase 5 0%"라고 적어둔 건 그 시점 기준
정확했지만 **그 이후 별도 세션(들)에서 Phase 5가 통째로 구현되어 이미
main에 커밋·배포·검증까지 끝났다.** 이 문단이 가장 최신 사실이다.

**Phase 5(커뮤니티+모더레이션) 완료 — 06-community.md 기준 전 기능 구현**:
- 스키마: `0020_community_core.sql`(profiles.role, blocks, destinations+
  translations, posts, post_images, comments, reactions,
  destination_follows, community_profiles 뷰, 카운터 트리거, post-images
  버킷), `0021_community_safety.sql`(reports, moderation_events,
  `check_report_threshold()` 자동 숨김 트리거 — ≥3명 distinct 신고자),
  `0022_destinations_seed.sql`(여행지 50곳+번역 150건),
  `0023_moderation_rpc.sql`(posts/comments insert RLS를 안전하게 좁히고
  `create_moderated_post`/`create_moderated_comment` SECURITY DEFINER
  RPC로 게시 상태 결정을 서버가 전담하도록 함 — 클라이언트가 RLS를 우회해도
  최악이 "검토 대기"가 되도록 스펙 원문 이상으로 하드닝).
- Edge Function: `moderate-content`(배드워드 사전+스팸 휴리스틱+AI
  텍스트/이미지 분류 병렬 실행, 3초 예산, fail-closed), `translate`.
- 화면 전부: 피드/여행지 채널, 글쓰기(이미지 업로드, EXIF는 canvas
  재인코딩으로 자동 제거), 글 상세(댓글/좋아요/번역보기), 신고/차단 UI,
  설정 탭 차단 목록, 사용자 프로필, 운영 콘솔(`/admin`, role='admin'만),
  entitlements `community.post` 게이트, 약관 무관용원칙 문구.
- 라우트 전부 등록(`community/d/:slug`, `community/compose`,
  `community/post/:postId`, `community/user/:userId`, `/admin`).
- 순수 로직(badwords/spamHeuristics/decideStatus/normalizeText/
  languageDetect) 단위 테스트 커버.

**🔴 중요 발견 — Gemini API 키가 프로덕션에서 무효화됨, DeepSeek로 전면 전환**:
Phase 5 최종 검증 중 `moderation_events.categories.text: null`(분류기
fail-closed 흔적)을 발견 → 원인 추적 결과 배포된 `GEMINI_API_KEY` 시크릿이
"API_KEY_INVALID"로 거부됨(로컬 `.env.local`의 동일 키 값은 curl로 직접
때리면 정상 동작 — 원인 불명, 재현 안 해봄). 대체 모델
`gemini-3.6-flash`는 "thinking" 모델이라 응답에 8~25초 걸려 3초 분류
예산을 크게 초과. **사용자가 이 시점에 "AI를 사용하는 곳은 전부 DeepSeek
API로 교체"를 명시적으로 지시**(모델명 `deepseek-flash`, 키는 이 세션
중 Supabase secret `DEEPSEEK_API_KEY`로 등록 — 코드에 하드코딩 안 함).

전환 완료된 곳(전부 OpenAI 호환 `chat/completions`, `response_format:
{type:'json_object'}`):
1. `src/features/community/moderation/deepseekClassifier.ts`(신규,
   `geminiClassifier.ts` 대체) — `moderate-content`가 사용.
2. `supabase/functions/translate/index.ts`.
3. `src/features/documents/parseBooking/llm.ts`(Phase 4, 예약 문서
   구조화 추출) — 기존 Gemini→Groq→OpenRouter 3단계 폴백 체인을 DeepSeek
   단일 호출+1회 재시도로 단순화. `supabase/functions/parse-booking`도
   재배포 완료.
4. `api/recommend.js`(Vercel 서버리스, "동행자 제안"/여행지 주변 추천) —
   동일하게 3-provider 체인을 DeepSeek 단일 호출로 교체, 4번 큐레이션
   폴백은 그대로 유지. **⚠️ Vercel 프로젝트 환경변수에 `DEEPSEEK_API_KEY`가
   아직 등록 안 됨(Vercel CLI가 이 환경에 없어서 등록 불가) — 등록 전까지는
   이 엔드포인트가 큐레이션 폴백만 반환한다. 다음 세션이나 사용자가 Vercel
   대시보드에서 직접 등록해야 함.**

커밋: `b56a925`(Phase 5 모더레이션/번역 DeepSeek 전환),
`2b4f59a`(Phase 4 llm.ts+recommend.js DeepSeek 전환). **아직 origin에
push 안 함** — push는 사용자 확인 후 진행 예정(트리거 시 Vercel
프로덕션 재배포가 걸리는 저장소라 명시적 승인 없이 push하지 않음).

**최종 검증(프로덕션 `triptic.my`, 실제 계정 3개 중 하나로 테스트,
전부 실행 후 데이터 정리 완료)**:
- 텍스트 게시(happy path) → published 정상.
- 좋아요/댓글 정상 동작.
- **유해 콘텐츠 차단 실증**: 마약 거래 예시 문구 제출 → DeepSeek가
  `illegal: 1.0`으로 정확히 분류 → `removed` 처리 확인(`moderation_events`
  score/categories 직접 조회로 fail-closed가 아니라 실제 탐지임을 확인).
- **이미지 업로드 E2E**: 실제 `ComposePostScreen`에서 PNG 업로드 → DeepSeek
  vision 분류 통과 → `published`, storage에서 이미지 정상 렌더링.
- **번역**: `translate` 엔드포인트 한→영 정상 동작.
- **3인 신고 자동 숨김**: 2명 신고까지 `published` 유지 → 3번째(distinct
  reporter) 신고 순간 트리거 발동, `status='hidden'`,
  `moderation_events.action='hidden', source='report_threshold'` 확인.
- **운영 콘솔**: 테스트 계정을 임시로 `role='admin'`으로 올려서(검증
  후 다시 `'user'`로 원복 완료) 신고 큐 확인 → "기각"(`dismissed`) /
  "삭제"(`actioned`+게시물 `status='removed'`) 둘 다 실제 동작 확인,
  큐가 정확히 줄어들고 빈 상태 UI까지 확인.
- **차단(bidirectional)**: 처음 테스트했을 때 차단해도 게시물이 보여서
  "버그인가?" 싶었으나, 원인은 **테스트 계정이 그 직전 admin 콘솔
  검증을 위해 `role='admin'`으로 바뀐 채였던 것**(RLS의 "admin read all
  posts" 정책이 다른 permissive 정책과 OR로 합쳐져 admin은 차단과 무관하게
  전부 보임 — 이건 의도된 설계). role을 `'user'`로 되돌리자 정상적으로
  차단된 사용자의 글이 안 보임 확인. **교훈**: 이 프로젝트에서 admin
  role을 테스트용으로 임시로 올릴 때는 다른 RLS 정책 테스트(특히 차단/
  가시성 관련) 전에 반드시 `'user'`로 원복부터 할 것 — 안 그러면 "차단이
  안 먹는다"는 거짓 양성이 나온다.
- 4게이트(typecheck/test 204개/lint/build) DeepSeek 전환 후 재실행,
  전부 통과.
- **커뮤니티 관련 테스트 데이터는 전부 정리 완료**(posts/comments/
  reactions/reports/moderation_events/blocks 모두 0건으로 원복, 다만
  `post-images` 스토리지에 테스트용 작은 PNG 1개가 orphan으로 남아있을
  수 있음 — 468바이트 수준이라 영향 미미, 정리 안 했음).

**미검증/남은 일(다음 세션 또는 사용자 확인 필요)**:
- `api/recommend.js`의 DeepSeek 연동은 Vercel에 `DEEPSEEK_API_KEY`가
  없어 실제로 호출된 적 없음(코드는 4게이트 통과, 패턴은 검증된 것과
  동일하지만 라이브 스모크 테스트 못 함).
- `llm.ts`(예약 문서 추출)도 DeepSeek 연동 패턴 자체는 이미 검증된 것과
  동일하지만, 실제 예약 문서(PDF) 업로드로 이 경로를 처음부터 끝까지
  테스트하지는 않음.
- 두 커밋(`b56a925`, `2b4f59a`) 아직 push 안 함 — 사용자 확인 필요.
- entitlements-wiring 브랜치 리뷰/병합 여부 여전히 미결정(아래 옛 문단
  참고, 이번 세션에서는 안 건드림).
- Phase 6/7은 여전히 0%(변화 없음).

## ⚠️ 2026-09-21 전수 감사로 정정된 사실 (이 문단을 최우선으로 읽을 것)

이전에 "Phase 0~4 전부 완료"라고 기록했던 건 **부정확했다** — Phase 2·3·4는 그
Phase *안에서만* 완료였지, `docs/DEVELOPMENT_PLAN.md` 전체 로드맵(Phase 0~7)
기준으로는 절반도 안 됐다. 사용자가 "docs 전체 기준으론 아직 많이 남은 것
같은데?"라고 직접 지적해서 fork로 전수 재감사(`docs/DEVELOPMENT_PLAN.md` +
`docs/specs/01~08` 전체를 다시 읽고 실제 코드와 대조)를 돌렸고, 다음이
확인됐다:

- **Phase 5(커뮤니티+모더레이션) 0%** — `src/features/community/`엔 "준비
  중이에요" 스텁 1개뿐. destinations/posts/comments/reactions/blocks/
  reports/moderation_events 테이블 전부 없음. App Store 1.2 리젝 리스크(R4)
  그대로 살아있음.
- **Phase 6(다국어+접근성+오프라인+푸시) 0%** — `i18next`/`react-i18next`는
  설치만 돼 있고 코드 참조 0건, `src/locales/` 없음, 모든 문자열 한국어
  하드코딩. 푸시 알림 미구현. IndexedDB 캐시 없음.
- **Phase 7(출시 준비) 0%** — `PrivacyInfo.xcprivacy` 없음, TestFlight 없음,
  Playwright/e2e 없음.
- **ADR-002(정규화 테이블 이관, M0~M7) — 감사 당시 0%였으나 같은 세션에서
  M2~M5 + 두 RPC 컷오버까지 완료함(아래 "완료 — ADR-002" 섹션 참고).**
  M6(2주 관찰)·M7(snapshot 컬럼 제거)·Plan 탭 자체의 정규화 전환은 여전히
  남아있다.
- `entitlements.can()` 정의만 있고 호출부 0곳(Phase 1 완료 기준 위반).
- 바우처 보관함 전용 화면 없음(Phase 4는 업로드/검수 모달만 만듦).
- 가계부 화면이 스펙 미달(환율 자동변환·차트 없음, 단순 입력 모달뿐).
- 설정 탭 70%가 "Phase 6 예정" 플레이스홀더.
- Places 세션 토큰 미사용(비용 방어선 R1 중 하나 빠짐), Playwright/e2e 없음.

**교훈**: Phase 경계 회귀 테스트("그 Phase 안에서 다 됐는지")와 로드맵 전체
정합성("문서 전체 기준으로 다 됐는지")은 별개 질문이다 — 이번처럼 큰 갭이
있을 때는 주기적으로(예: Phase 하나 끝날 때마다, 또는 사용자가 "완료"라고
말하기 전에) `docs/DEVELOPMENT_PLAN.md` 전체를 다시 읽고 대조해야 한다.
이 정정 이전의 아래 본문 내용(특히 "다음에 이어서 할 일" 절 상단의 낙관적
요약)은 **Phase 내부 완료 기준으로만 유효**하고, 로드맵 전체 관점은 이
문단이 최신이다.

## ⚠️⚠️ 2026-09-21 (같은 날 후속) 재점검 — 다음 세션은 반드시 이 문단부터

컨텍스트를 곧 비울 예정이라 사용자가 "5개 갭 + Phase 5/6/7 상태를 정확히
파악해서 문서에 자세히 적어두라"고 명시적으로 요청해서 실제 코드를 다시
전부 확인했다. **결론: 위 5개 갭 중 entitlements.can()만 부분적으로
전진했고(그것도 main에는 아직 없음), 나머지 4개(바우처 보관함·가계부·설정
탭·Places 세션 토큰/e2e/IndexedDB)와 Phase 5/6/7은 전수 감사 시점과
똑같이 그대로다.**

### 🚨 중요한 발견: 병합 안 된 워크트리 브랜치가 존재한다

`git worktree list`로 확인한 결과, 이 세션이 모르는 사이에 다른 실행에서
`entitlements.can()` 배선 작업이 진행돼 있었다:
- 브랜치: `worktree-entitlements-wiring` (`/Users/benlee/Triptic/.claude/
  worktrees/entitlements-wiring`, locked)
- 커밋: `0a02e8a` "entitlements.can() 실제 배선(DEVELOPMENT_PLAN.md §13.3 ①)"
  — `main`의 `70f2491`(이번 세션 ADR-002 마지막 커밋) 바로 위에 얹혀 있음.
- **main 브랜치(`/Users/benlee/Triptic`, 이 세션이 계속 작업해온 워킹
  디렉터리)에는 이 커밋이 병합되지 않았다** — `git status`도 깨끗하고
  `git log`에도 안 보인다. 즉 실제 배포된 프로덕션 코드에는 이 변경이
  **아직 없다.**
- 내용은 검토해보니 실제로 잘 짜여 있다(§13.3의 5개 게이트 중 4개 배선):
  - `tripService.saveTrip()`: 신규 여행 생성 시(`project.supabaseId` 없을
    때)만 `trip.create` 게이트, 기존 여행 갱신은 게이트 안 함.
  - `tripService.createShareLink()`: `trip.collaborate` 게이트.
  - `documentService.uploadAndParseDocument()`: `voucher.storage` +
    `document.parse` 게이트, Storage 업로드 전에 체크.
  - `offline.maps`는 의도적으로 미배선(해당 기능 자체가 아직 없어서 심을
    호출부가 없음 — 커밋 메시지에도 명시됨). 5개 중 4개, 나머지 1개는
    기능 부재로 배선 불가능한 상태이므로 사실상 "배선 가능한 건 다 함".
  - 커밋 메시지에 4게이트(typecheck/test 153/lint/build) 통과했다고 적혀
    있음(직접 재실행은 안 해봄 — 병합 전에 다시 돌릴 것).
- **다음 세션 액션 아이템**: 이 브랜치를 리뷰하고 `main`에 병합할지
  사용자에게 확인할 것. 병합 명령 예시: `git merge worktree-entitlements-
  wiring`(main 워킹 디렉터리에서) 또는 워크트리 자체를 정리하려면 먼저
  `git worktree remove`. **병합 전 반드시 4게이트 재실행.**
- **일반적 교훈**: 이 프로젝트는 앞으로도 `isolation: "worktree"` 방식의
  별도 에이전트 실행이 main 모르게 브랜치를 만들어둘 수 있다. 세션 시작
  시 또는 "지금까지 뭐가 됐는지" 파악할 때 `git worktree list`와
  `git branch --no-merged main`을 습관적으로 먼저 확인할 것 — 이번에
  이걸 안 했으면 이미 완료된 작업을 또 하거나, 반대로 메모리에 적힌
  "완료" 문구만 믿고 실제로는 main에 없는 코드를 있다고 착각할 뻔했다.

### 나머지 4개 갭 — 전수 감사 이후 변화 없음(재확인 완료, 2026-09-21)

- **바우처 보관함 전용 화면**: 여전히 0%. `find src/features/documents
  -iname "*voucher*"` 결과 0건. Phase 4는 업로드 모달(`UploadModal.tsx`)과
  검수 시트(`ReviewSheet.tsx`)만 만들었지, 여행 상세 헤더의 🎟 아이콘·문서
  목록·전체화면 뷰어(02-screens.md §3.6)는 손도 안 댐.
- **가계부 화면**: `src/features/plan/ExpenseModal.tsx` 여전히 108줄.
  `fx_rate`·`chart`/`Chart` 문자열 검색 0건 — 환율 자동변환(일별 스냅샷)도
  일자별/카테고리별 차트도 없음(02-screens.md §3.7 미달 그대로).
- **설정 탭**: `SettingsScreen.tsx` 71줄, 섹션 3개뿐(스펙은 5개 —
  02-screens.md §5 표: 계정/환경설정/알림/데이터/정보).
  - 계정: **완성도 높음.** 로그인/로그아웃 + `DeleteAccountFlow.tsx`(158줄)가
    스펙 §5.1(경고 화면에 여행·바우처·커뮤니티 글 개수 명시 → 재인증 →
    "삭제" 텍스트 입력 확인 → 30일 유예 안내)을 거의 그대로 구현해뒀다.
    다만 "프로필 편집"·"연결된 로그인" 항목은 스펙에 있는데 안 보임.
  - 환경설정: `<p>언어 · 테마 · 단위 (Phase 6 예정)</p>` 플레이스홀더
    문장 하나뿐 — 언어/테마/온도단위/거리단위/기본통화 전부 미구현.
  - **알림 섹션 자체가 아예 없다**(플레이스홀더조차 없음 — 코드에서 섹션이
    안 만들어짐). 출발 전 리마인더·항공편 변경·커뮤니티 답글·마케팅
    토글 전부 없음.
  - **데이터 섹션 자체가 아예 없다**(마찬가지로 완전 누락). 오프라인 캐시
    관리 UI는 확실히 없음. **단, JSON 내보내기/가져오기 "기능" 자체는
    Phase 2에서 이미 구현됨(`b40c181`, "기기 동기화 & 백업")** — 다음
    세션에서 그 UI가 정확히 어느 화면에 노출돼 있는지(설정 탭이 아닌
    다른 곳일 가능성 높음, 홈 탭 하단에 "기기 동기화 & 백업" 링크가
    있었던 걸로 기억함 — HomeScreen.tsx 확인) 먼저 확인하고, 스펙대로
    설정 > 데이터 섹션으로 옮기거나 여기서도 접근 가능하게 할지 판단할 것.
  - 정보: 버전 텍스트 한 줄뿐. 이용약관·개인정보처리방침·오픈소스
    라이선스·문의하기 전부 없음(App Store 심사에 약관/정책 링크가
    필수라 Phase 7 착수 시 반드시 채워야 함).
- **Places 세션 토큰**: `grep -rn "sessionToken\|AutocompleteSessionToken"
  src/` 결과 0건 — 여전히 미사용(R1 비용 방어선 중 하나 빠짐, CreateTripModal
  등 Places Autocomplete 쓰는 곳마다 세션 토큰 없이 매 키입력이 개별
  과금되는 상태로 추정됨. 정확한 영향 범위는 Google Places API 과금 방식
  재확인 필요).
- **Playwright/e2e**: `playwright.config.*`, `e2e/` 디렉터리 전부 없음.
  여전히 0%.
- **IndexedDB**: `indexedDB`/`idb-keyval`/`from 'idb'` 검색 전부 0건.
  여전히 0%. §6.4(로컬 localStorage → IndexedDB 이관)도 미착수.
- **`src/locales/` 디렉터리가 새로 생겨 있음 — 그런데 완전히 빈
  디렉터리다.** `find src/locales -type f` 결과 파일 0개, git에도 전혀
  추적 안 됨(빈 디렉터리는 git이 애초에 추적 못 함). `i18next`/
  `react-i18next` 코드 참조는 여전히 0건. **이 디렉터리의 존재만 보고
  "i18n 작업이 시작됐다"고 착각하지 말 것** — 실질적으로 아무 진행이
  아니다. 누가/왜 만들었는지 불명(아마 다른 워크트리 세션이 만들다 만
  흔적이거나 우연한 부산물).

### Phase 5·6·7 — 전수 감사 이후 변화 없음(재확인 완료, 2026-09-21)

- **Phase 5(커뮤니티+모더레이션) 0%**: `src/features/community/
  CommunityScreen.tsx` 딱 20줄. 내용 전문: `EmptyState`로 "커뮤니티는
  준비 중이에요"만 표시. 파일 상단 주석에 "06-community.md §5(모더레이션
  안전장치)가 기능과 같은 PR에서 함께 머지되기 전까지는 실제 피드/글쓰기를
  열지 않는다"고 명시돼 있음 — 즉 피드만 먼저 만들고 모더레이션 나중에
  붙이는 식으로는 절대 진행하면 안 된다는 뜻(App Store 1.2 리젝 리스크
  R4). `destinations`/`posts`/`comments`/`reactions`/`blocks`/`reports`/
  `moderation_events` 테이블 전부 없음(마이그레이션 파일에 흔적 0건).
  착수 시 `docs/specs/06-community.md`(394줄) 전체 정독 필수.
- **Phase 6(다국어+접근성+오프라인+푸시) 0%**: `i18next`/`react-i18next`는
  `package.json`에 설치만 돼 있고 코드 참조 0건(위 `src/locales/` 빈
  디렉터리 관련 내용 참고). 푸시 알림(`PushNotifications`/
  `@capacitor/push*`) 코드 검색 0건 — Capacitor 플러그인도 설치 안 됨.
  IndexedDB 캐시 0%(위 참고). 접근성(`aria-label` 등)은 이전 감사에서
  전체 11건뿐이라고 나왔었는데 이번엔 재검증 안 함 — 착수 시 재확인.
  `docs/specs/07-i18n.md`(293줄) 정독 필수.
- **Phase 7(출시 준비) 0%**: `PrivacyInfo.xcprivacy` 파일 전체 검색 0건.
  TestFlight/앱스토어 커넥트 설정 관련 흔적 없음. `docs/specs/
  08-release-checklist.md` 전체가 아직 체크 안 된 상태로 추정(이번엔
  파일 열어서 항목별로 대조까진 안 함 — 착수 시 처음부터 정독).

### 결론 요약 (다음 세션이 컨텍스트 없이 읽어도 바로 이해되게)

1. main 브랜치 기준 실제로 살아있는 신규 진행은 **ADR-002 M2~M5+RPC
   컷오버뿐**(이번 세션에서 완료, 커밋 `cf10645`/`39676d8`/`70f2491`).
2. entitlements.can() 배선은 **코드로는 존재하지만 병합 안 됨**
   (`worktree-entitlements-wiring` 브랜치, 커밋 `0a02e8a`) — 다음 세션이
   가장 먼저 처리하기 좋은 항목(리뷰 후 병합 여부 결정 → 병합 시 4게이트
   재실행).
3. 바우처 보관함·가계부·설정 탭(알림/데이터 섹션 완전 누락 포함)·Places
   세션 토큰·Playwright/e2e·IndexedDB는 전수 감사 때와 **완전히 동일**,
   진행 0%.
4. Phase 5/6/7은 **여전히 통째로 0%**, 이번에 새로 확인된 것도
   `src/locales/` 빈 디렉터리(무의미) 하나뿐.
5. 우선순위 제안은 그대로 유효(아래 "다음에 이어서 할 일" 절) — 다만
   1번 항목을 "entitlements.can() 배선"에서 "**entitlements-wiring
   브랜치 리뷰+병합 여부 결정**"으로 바꿔 읽을 것(코드는 이미 있으니
   새로 짤 필요는 없고 병합 판단만 하면 됨).

## 프로젝트 배경

`docs/DEVELOPMENT_PLAN.md` + `docs/specs/01~08`(총 3,677줄)는 Triptic을 기존
8,254줄 단일 `index.html` 바닐라 JS 앱에서 React 19 + TypeScript 기반 4탭 앱으로
전면 재작성하는 22주(2인 개발 기준) 로드맵이다. 사용자는 이 문서와 **한 치도
어긋나지 않게** 구현할 것을 명시적으로 요구했다 ("한치라도 docs폴더
작업계획서에 어긋나면 안돼. 완벽하고 정확하게 검증해서 개발 진행해줘").

Apple Developer Program 미가입 상태라 WeatherKit/Sign in with Apple 등 Apple
관련 API 키는 배선만 해두고 값은 비워둔다 (사용자 명시 승인).

**전환 전략(ADR-001, Strangler 패턴)**: 기존 vanilla JS 앱은 그대로 루트
`index.html`(8,254줄)에 보존하고, 새 React 앱은 `/preview/` 경로에 병행
구축한다. `vercel.json`의 `rewrites`가 `/preview/(.*)` → `/preview/index.html`로
매핑한다. 패리티 체크리스트(§10.3, 아래 참고) 100% 통과 전까지 루트는 절대
건드리지 않는다.

**Why**: 사용자 데이터가 이미 존재하는 운영 서비스(`triptic.my`)이므로, 새 앱이
불완전한 상태에서 실사용자에게 노출되면 안 된다는 것이 이 전략의 핵심 이유.

## 완료된 것 — Phase 0 (기반 정비)

커밋 `bf261ed`, `0aa26ce`, `d078aff`. React 19 + TS strict + Vite 7 스캐폴딩,
Jest→Vitest 이관(기존 47개 테스트 유지), ESLint 9 flat config, 디자인 토큰
CSS 변수화(`src/shared/ui/tokens.css`), Sentry/PostHog 배선(키 없으면 no-op),
Supabase 마이그레이션 체계 도입. **완료 기준 충족 확인함.**

## 완료된 것 — Phase 1 (DB 비파괴 항목)

하단 4탭 라우팅(`src/app/router.tsx`, React Router 7, `basename: '/preview'`
**필수** — 없으면 전체 404), 공통 4상태 컴포넌트(`src/shared/ui/states/`),
Supabase 서비스 계층(`src/shared/api/tripService.ts`), entitlements 스텁.

## 완료된 것 — Supabase 마이그레이션 (실제 운영 DB 적용 완료)

project_ref: `ifzykfemjzqquyzgpqax`. **`0000`~`0012`, `0013` 전부 실제 운영
프로젝트에 적용 완료.** `0008_shared_trip_cutover.sql`만 **의도적으로 미적용**
상태 유지 (정규화 테이블에 실제 데이터가 아직 없어서 — `03-data-model.md` §6의
M0~M7 절차 중 M4 완료 전까지는 적용 금지, 적용하면 모든 공유 링크가 즉시 빈
일정을 반환하게 됨). 상세 절차는 `supabase/migrations/README.md` 참고.

`0013_fix_get_shared_trip_columns.sql`은 이번 세션에서 발견한 **프로덕션
버그 수정**: `get_shared_trip()` RPC가 `0000`에서 rename된 옛 컬럼명
(`t.name`, `t.currency`)을 여전히 참조하고 있어 공유 링크를 실제로 열면
에러가 나는 상태였다. 사용자 승인 받고 즉시 적용, 실제 데이터로 정상 동작
확인함.

## 완료된 것 — Phase 2 (계획 탭 + 지도, 패리티 체크리스트 §10.3) ✅ 19/19 전부 완료

패리티 체크리스트는 `DEVELOPMENT_PLAN.md` §10.3에 19개 항목으로 정의되어
있고 "하나라도 빠지면 Phase 2를 통과시키지 않는다"는 게 문서 원문 규칙.
**2026-09-21 세션에서 19/19 전부 완료, phase 경계 회귀 테스트까지 마침 —
Phase 2 관문 통과.** 다음은 Phase 3(날씨 + 홈 대시보드)로 진입.

**완료 (19/19)**:
- [x] 일차별 장소 추가/삭제/순서변경/다른 날로 이동
- [x] 시간·메모 편집
- [x] 일차별 다른 도시 설정(dayCities) + 이후 일자 일괄 적용 — `c86395d`
- [x] 구간별 대중교통 경로 지도 렌더링 (실패 시 점선 폴백) — `0a233fe`
- [x] 하루 내 존 분리 — `0a233fe` (`computeDayZones`)
- [x] 경로 캐시 — `0a233fe` (`DirectionsCache`)
- [x] 구간별 Google Maps 길찾기 딥링크 — `0a233fe`, 버그 수정 `1503ebd`
- [x] 숙소 지정 — `d2624b7`
- [x] 아침/점심/저녁 식사 슬롯 — `ba954a7`
- [x] 경비 입력 + 통화별 합계 — `ba954a7`
- [x] 항공편 편명 조회 자동 입력 + 수동 입력 — `1503ebd`
- [x] 여행 복제 / 삭제 / 이름 변경 — `d2624b7`
- [x] 공유 링크 생성·해제, 조회수 — `d2624b7` + `6ac5289`(뷰어 화면).
  **조회수 UI는 의도적으로 추가하지 않음** — legacy `openShareModal`
  전체를 확인했으나 `view_count`를 UI에 노출하는 코드가 legacy에도
  없다(DB 컬럼만 있고 백엔드에서 자동 집계될 뿐). 두 앱이 같은
  `shared_trips` 테이블/RPC를 쓰므로 집계 자체는 이미 동일 — legacy에
  없는 UI를 새로 추가하는 건 패리티 범위 밖이라 보고 건너뜀. (이전
  세션 메모에 "UI 노출 필요"라고 적었던 건 legacy를 실제로 확인하지
  않은 채 넘겨짚은 오판이었음 — 이번에 정정함.)
- [x] 동행자 장소 제안 → 수락/거절 — `6ac5289` (가장 큰 작업, 아래 상세)
- [x] 일정 텍스트 복사, PDF 출력 — 텍스트 복사 `0493c19`, **PDF 출력
  `7bc3600`(2026-09-21)**. legacy `exportToPDF`(타임라인 요약표 + 장소별
  상세 카드 + 일자별 경비, 한글 폰트 임베딩)를 색상·레이아웃까지 그대로
  포팅(`pdfExport.ts`). 상세는 아래 "PDF 출력 기능 상세" 참고.
- [x] JSON 내보내기/가져오기 — `b40c181`
- [x] 현재 위치 버튼 — `0493c19`
- [x] **비로그인 샘플 여행 둘러보기** — `188fc19` (2026-09-21). legacy
  `SAMPLE_PROJECT_NAME`/`SAMPLE_PROJECT_DATA`(`index.html` 3629~3809행, 도쿄
  3박4일)를 데이터까지 그대로 `src/features/plan/sampleTrip.ts`로 이식.
  **읽기전용이 아니라 legacy와 동일하게 완전 편집 가능** — 로그인 없이
  `TripDetailScreen`을 그대로 열어 장소 추가/편집/삭제/드래그/숙소/식사/
  경비/항공편까지 다 되지만 Supabase에는 절대 쓰지 않고 메모리에만
  반영되며, 로비로 돌아가면 다음에 열 때 원본으로 리셋된다(legacy
  renderLobby가 매번 리셋하던 것과 동일). 공유 링크 생성·제안 검토는
  legacy와 동일하게 비활성화, 텍스트 복사·PDF 출력은 legacy처럼 막지
  않음(아래 ShareSheet isSample 설명 참고). 상세 설계는 아래 "샘플 여행
  기능 상세" 참고.
- [x] **PWA 설치 · 오프라인 열람** — `75711ac` (2026-09-21). sw.js가
  legacy 루트 전용으로만 만들어져 있어 `/preview/` 새 앱은 서비스워커
  등록 자체가 없었고, 오프라인 폴백도 항상 legacy 셸만 반환하던 걸
  고침. 상세는 아래 "PWA 수정 상세" 참고.

### 동행자 제안 기능 상세 (`6ac5289`, 가장 복잡했던 작업)

- `/shared/:code` 신규 라우트(`src/app/router.tsx`) — `AppShell`(하단 탭) 밖
  독립 화면. `src/features/shared/SharedTripScreen.tsx`가 메인.
- `tripService.getSharedTripByCode()` RPC 호출, **10초 폴링**(React Query
  `refetchInterval: 10_000`)으로 소유자 변경사항 자동 반영 — legacy
  `startSharedPolling`과 동일 주기.
- 게스트 이름은 `localStorage`(`src/features/shared/guestName.ts`,
  legacy와 동일 키 `tripticGuestName`).
- 제안 전송: `SuggestPlaceModal` → `tripService.addSuggestion`.
- 소유자 쪽: `TripDetailScreen`에 배지(💡 + 개수) + `SuggestionsModal`.
  수락 시 `handleAcceptSuggestion`이 해당 일차 맨 뒤에 항목 추가(제안자
  이름을 메모 접두사로 포함하는 것까지 legacy와 동일) 후
  `deleteSuggestion` 호출.
- **리팩터링**: `FixedPointCard`/`FlightPointCard`/`LegBetween`을
  `TripDetailScreen.tsx`에서 `src/features/plan/FixedPointCard.tsx`로
  분리해 `SharedTripScreen`과 공유.
- **버그 수정도 같이 커밋됨**: `ShareSheet.tsx`의 공유 URL이
  `${origin}/shared/${code}`였는데 라우터 `basename`이 `/preview`라서
  실제로는 404가 나는 링크였음 → `/preview/shared/${code}`로 수정.

### 샘플 여행 기능 상세 (`188fc19`, 2026-09-21)

- `sampleTrip.ts`: `SAMPLE_TRIP_ID = 'sample-tokyo-3n4d'` 고정 문자열 ID +
  legacy 데이터 그대로 + `resetSampleTrip()`/`getSampleTripRow()`/
  `updateSampleTripSnapshot()`. 모듈 스코프 변수 하나에 현재 상태를 들고
  있는 극단적으로 단순한 메모리 저장소.
- `useTrips.ts`의 `useTrip`/`useUpdateTripSnapshot`이 `tripId ===
  SAMPLE_TRIP_ID`를 감지하면 `tripService`(Supabase) 대신 `sampleTrip.ts`를
  호출하도록 분기 — `tripService.ts` 자체(순수 Supabase 레이어)는 전혀
  건드리지 않았다. `useSuggestions`도 샘플이면 아예 쿼리를 비활성화
  (`enabled: false`) — 존재하지 않는 tripId로 Supabase에 잘못된 UUID
  포맷 쿼리가 나가는 걸 막기 위해서다.
- `PlanScreen.tsx`: `!user`일 때 로비에 `SampleTripCard` 노출. 로비 마운트
  시(= 로그인 안 한 채 목록 화면에 도착할 때마다) `resetSampleTrip()` +
  `queryClient.removeQueries(tripQueryKey(SAMPLE_TRIP_ID))`를 같이 호출해서
  react-query 캐시도 함께 지운다 — 이게 없으면 리셋해도 캐시된 이전 편집
  내용이 다시 보임.
- `/preview/plan/:tripId` 라우트를 그대로 재사용(`TripDetailScreen`).
  `isSample = tripId === SAMPLE_TRIP_ID`로 헤더에 "체험용 샘플" 배지,
  공유(↗)/제안(💡) 버튼 `disabled` + 툴팁.

### PWA 수정 상세 (`75711ac`, 2026-09-21)

- ⚠️ **`sw.js`의 원본은 레포 루트(`/sw.js`)다.** `public/sw.js`, `www/sw.js`는
  `scripts/build.js`(모든 `npm run dev`/`npm run build`가 먼저 실행)가 루트
  파일을 그대로 복사해 만드는 **빌드 산출물**이다 — 처음에 실수로
  `public/sw.js`를 직접 고쳤다가 다음 빌드에서 그대로 덮어써져 수정이
  통째로 사라진 적 있음. 항상 루트 `sw.js`를 고치고 빌드를 다시 돌려
  `public/`·`www/` 사본에 반영할 것.
- `getOfflineFallback(request)`가 요청 경로를 보고 `/preview/`면 새 앱 셸
  (`./preview/index.html`), 아니면 legacy 셸(`./index.html`)을 반환하도록
  수정 — 기존엔 항상 legacy만 반환해서 `/preview/`가 오프라인일 때 엉뚱한
  화면이 떴다. `APP_SHELL` 프리캐시 목록에 `./preview/index.html` 추가.
  `CACHE_NAME` v5→v6.
- `src/app/main.tsx`가 같은 `/sw.js`를 `{ scope: '/preview/' }`로 별도
  등록(legacy는 index.html에서 루트 스코프로 등록) — 두 개의 독립된
  `ServiceWorkerRegistration`이 생기지만 Cache Storage는 오리진 단위로
  공유되므로 문제없다.
- 정적 자산(JS/CSS 청크)은 fetch 핸들러의 캐시 우선 전략이 경로 무관하게
  이미 처리해서 별도 프리캐시가 필요 없다 — 단, 코드 스플리팅된 라우트
  청크는 온라인 상태에서 한 번 방문해야 오프라인에서도 열람 가능하다
  (legacy의 단일 번들 방식과 의도적으로 다른 부분).
- **검증**: 브라우저에서 `navigator.serviceWorker.getRegistrations()`로
  `/preview/` 스코프 등록이 `activated` 상태인지, `caches.open('triptic-v6')`
  안에 `/preview/index.html`·`/preview/`가 실제로 캐시됐는지 확인함. 실제
  네트워크를 끊고 오프라인 폴백이 동작하는지까지는 이 세션의 브라우저
  자동화 도구로는 확인 못 함(오프라인 토글 액션이 없음) — 다음에 실제
  기기나 Chrome DevTools Network 패널로 직접 확인 필요.

### PDF 출력 기능 상세 (`7bc3600`, 2026-09-21)

- `pdfExport.ts`: legacy `exportToPDF`(2026-09-21 기준 `index.html`
  7623~8252행, ~570줄)를 색상·표 레이아웃·장소별 상세 카드·경비 요약까지
  그대로 포팅. 한글 폰트(NanumGothic TTF)는 CDN에서 fetch해 base64로
  모듈 레벨 캐시.
- 구간 이동시간은 새로 계산하지 않고 `useTripRoutes.ts`의
  `sharedDirectionsCache`를 그대로 재사용하도록 export했다 — legacy
  `getTransitToNext`와 동일하게, 아직 지도/목록에서 방문한 적 없는
  날짜의 구간은 캐시가 비어 있으면 이동시간 없이 표시된다(의도된
  best-effort 동작, 버그 아님).
- **번들 크기 함정**: jsPDF가 `html2canvas`/`dompurify`를 딸려온다(gzip
  ~120KB). `ShareSheet.tsx`에 정적 import했다가 `TripDetailScreen` 청크가
  100→148KB(gzip)로 폭증한 걸 뒤늦게 발견 — PDF 버튼 클릭 시점에만
  `await import('./pdfExport')`로 동적 로드하도록 고쳐 별도 지연 청크로
  분리했다. **PDF 관련 코드를 고칠 때 절대 정적 import로 되돌리지 말 것**
  (`npm run build` 후 `dist/assets/TripDetailScreen-*.js` 크기로 회귀
  확인 가능 — 31KB대여야 정상, 100KB 넘으면 잘못 합쳐진 것).
- **버그 수정 동반**: 샘플 여행에서 공유(↗) 버튼 자체를 비활성화했더니
  같이 있던 텍스트 복사/PDF까지 막혀버렸다 — legacy는 `openShareModal`
  (링크 생성)만 막고 `openExportModal`(복사/PDF)은 막지 않는다.
  `ShareSheet`에 `isSample` prop을 추가해 링크 생성 섹션만 안내 문구로
  바꾸고, 복사/PDF 버튼은 그대로 노출하도록 수정. 공유 트리거 버튼(↗)
  자체는 다시 항상 활성화 상태로 되돌렸다.
- **검증**: 샘플 여행에서 "전체 일정 PDF" 버튼을 실제로 클릭해 PDF가
  다운로드되는 것까지 확인함(사용자가 직접 내용도 확인, 정상).

## 진행 중 — Phase 3 (날씨 + 홈 대시보드, 2026-09-21 착수)

`DEVELOPMENT_PLAN.md` §9 Phase 3 항목: WeatherKit 프록시+캐시, 일자 헤더
최고/최저+항목별 기온, 10일 초과 평년값 폴백, 대시보드 통계 RPC+화면,
세계지도. **완료 기준**(§9): "날씨 API 호출량 사용자당 하루 ≤10회(캐시
적중률 ≥80%)"은 Apple Developer Program 미가입으로 WeatherKit이 아직 실제
호출된 적이 없어 **라이브로 검증 불가능** — 캐싱 로직(요청 단위 gridKey
묶음, DB TTL, 클라이언트 30분 캐시)은 스펙대로 구현했지만 실측은 키가
채워진 뒤에나 가능하다.

**완료**:
- [x] **CreateTripModal 좌표 캡처 버그 선행 수정** — `7f5c96b`. Phase 3
  착수 전 발견: 여행 생성 모달의 "도시"가 일반 텍스트 입력이라
  cityLat/cityLng를 저장하지 않고 있었다(좌표 없으면 날씨·지도 경로
  둘 다 불가능). Places Autocomplete((cities)) 필수 선택으로 교체 +
  통화 선택 복구(legacy엔 있었는데 새 앱에서 누락, 지금까지 모든 새
  여행이 무조건 KRW 고정이었음). legacy 항공편 입력 필드는 의도적으로
  안 옮김(이미 동등한 FlightModal 있음).
- [x] **날씨: WeatherKit 프록시 + 일자 헤더** — `d2ba196`. 상세는 아래.
- [x] **홈 대시보드** — `760c87b`. 상세는 아래.

**미완료**:
- [ ] 항목별 시간별 기온(§6.2) — 시간대 정보 없이는 정확한 매칭이 안 돼
  일부러 보류(아래 날씨 상세 참고).
- [ ] climate_normals 실데이터(ERA5/NOAA GHCN 500개 도시 ETL, §5.2) — 스키마/
  조회 로직만 있고 비어있음. 채우기 전까진 10일 초과 날짜는 전부 "데이터
  없음"으로 빈 영역 처리됨(스펙대로의 정확한 동작, 버그 아님).
- [ ] 세계지도 탭 → 국가별 여행 목록 필터(계획 탭에 그 기능 자체가 없음).
- [ ] "여행중" 히어로의 현재 위치 기반 이동 안내(위치 권한 필요).
- [ ] "예정 여행 없음" 상태의 커뮤니티 인기 여행지 3곳(커뮤니티 탭이
  아직 스텁).
- [ ] WEATHERKIT_* 4개 환경변수, SUPABASE_SERVICE_ROLE_KEY(날씨 캐시
  쓰기용) 전부 Vercel에 미등록 — 실제 값이 생기면 등록 필요.

### 날씨 기능 상세 (`d2ba196`, 2026-09-21)

- `api/weather.js`: WeatherKit REST 프록시(ES256 JWT, `jose`) + DB 캐시
  (`weather_cache`, TTL 오늘 1시간/예보 3시간) + 평년값 폴백
  (`climate_normals`, 반경 50km 최근접 격자). `AVIATIONSTACK_API_KEY`와
  동일 원칙으로 키를 클라이언트에 절대 노출 안 함. 캐시 쓰기는
  `SUPABASE_SERVICE_ROLE_KEY`(service_role) 필요 — 없으면(현재 상태)
  캐시 없이 동작(그래도 WEATHERKIT_* 자체가 없어 항상 503이라 지금은
  무관).
- `src/features/weather/`: `gridKey`(1.1km 격자) · `conditionMap`
  (WeatherKit 40여종 → 9종 압축, 매핑 없으면 unknown+Sentry 경고) ·
  `weatherRules`(10일 초과 평년값 판정, °C/°F 변환) · `useWeather`
  (TanStack Query, 여행 단위로 한 번만 묶어 조회).
- `TripDetailScreen` 일자 헤더에 최고/최저+아이콘+"평년" 배지. 로딩
  스켈레톤, 실패 시 완전히 조용히 숨김(에러 토스트 없음, §6.3).
- **항목별 기온(§6.2)은 이번엔 안 넣음** — `item.time`("11:30")은
  여행지 현지 시각인데 WeatherKit hourly 응답은 UTC라, 좌표→시간대
  변환(예: Google Time Zone API — 이 프로젝트는 Google Maps 키가 이미
  있어 자연스러운 후보) 없이 매칭하면 틀린 시각의 기온을 보여주게
  된다. `ItineraryItemCard`에 `weather` prop 자리는 만들어뒀지만
  값을 넘기지 않음 — 시간대 조회를 붙이는 게 다음 작업.
- **로컬 dev 테스트 중 발견한 함정(버그 아님, 캐시 이슈)**: 서비스워커가
  `/preview/` 스코프로 이미 등록된 브라우저 프로필에서 새 코드를
  테스트하면, 정적 자산 캐시 우선 전략(sw.js 규칙4) 때문에 **파일을
  고쳐도 예전 버전이 계속 보일 수 있다**(HomeScreen을 새로 만들었는데
  한참 옛날 빈 스텁이 뜬 적 있음). `navigator.serviceWorker.
  getRegistrations()`로 등록 해제 + `caches.delete()`로 지우고
  새로고침하면 해결된다. 프로덕션은 무관(빌드마다 파일명이 해시로
  바뀌어 캐시 키 자체가 달라짐) — 순수 로컬 dev 전용 함정.
- **검증**: 브라우저에서 `/api/weather?lat=...&start=...&end=...`가
  여행 시작~종료일 전체를 한 번에 묶어 정확히 호출되는 것, 503 응답을
  UI가 콘솔 에러 없이 조용히 숨기는 것까지 확인(WEATHERKIT_* 미설정
  상태이므로 항상 503 — 예상된 동작).

### 홈 대시보드 상세 (`760c87b`, 2026-09-21)

- legacy에는 홈 탭 자체가 없다 — `docs/specs/02-screens.md §2`를 원본
  삼아 새로 만든 화면(포팅 대상 아님).
- **통계 데이터 소스 결정(사용자 승인)**: 스펙의 `get_user_travel_stats()`
  (0009, 정규화 테이블 대상)는 실이관 데이터가 없어 전부 0을 반환한다
  (M2~M4 미완료). 대신 `trips.snapshot`에서 직접 같은 JSON 모양을
  계산하는 임시 RPC `get_user_travel_stats_snapshot()`을 새로 만들어
  운영 DB에 적용(`supabase/migrations/0014`, 사용자 승인 받고 적용).
  **정규화 이관(M4) 완료 후 원래 RPC로 되돌리고 0014는 삭제할 것.**
  - 국가/도시 판정: `trips.city`/`dayCities[*].name`이 "Tokyo, Japan"
    형식(Places `formatted_address`)이라는 전제로 마지막 쉼표 뒤=국가,
    앞=도시로 파싱. CreateTripModal 수정(위 참고)으로 이 형식이 보장됨.
  - `groundMeters`는 항상 `null`(0이 아님) — snapshot엔 구간거리가
    없다(클라이언트 `sharedDirectionsCache`에만 세션 메모리로 존재,
    DB 미영속). UI(`StatsTiles`)는 null이면 "—" 표시, 0km라고 속이지
    않는다.
- **세계지도**: Google Maps 대신 `react-svg-worldmap`(신규 npm 의존성,
  MIT, 지도 데이터 번들 포함 — 런타임 네트워크 호출 없음, ISO
  alpha-2 코드로 채색+클릭 핸들러 지원)을 채택 — 직접 SVG 지도를
  손으로 그리는 건 비현실적이라 판단. `countryLookup.ts`가 RPC의 영문
  국가명을 이 패키지의 ISO 코드로 변환(몇 가지 표기 차이는 별칭 표로
  보정 — 전수 검증은 못 함, 실사용 중 매칭 안 되는 국가 나오면 추가).
- `HeroCard`: 여행중(오늘 일정 목록) / 예정(D-day+날씨+첫일정+항공편)
  / 없음(CTA) 3분기. `TripCard`에 `showMenu` prop 추가해 홈의 "지난
  여행" 캐러셀에선 이름변경/복제/삭제 ⋮ 메뉴를 숨김(눌러도 아무 반응
  없는 버튼보다 아예 없는 게 낫다고 판단).
- **검증(2026-09-21, 실 배포 `triptic.my/preview/`, 실제 로그인 세션
  "Ben Lee" 계정 — 이 Chrome 프로필에 이미 로그인돼 있었음)**: 비로그인
  상태(흐림 처리 통계+로그인 유도) + 로그인 상태 전부 확인 완료.
  - 홈 대시보드: 실제 여행("도쿄 테스트 여행", D-19)으로 히어로 카드
    정상 렌더링, 통계 타일 전부 0(완료된 여행이 없어서 — 스펙대로
    정확한 동작, 버그 아님).
  - **CreateTripModal 수정 실사용 검증**: "Osaka" 입력 → Google Places
    자동완성 드롭다운 정상 표시 → "Osaka, Japan" 선택 → 통화 JPY로
    변경 → 실제 생성 성공(UUID `84648c16-...`), 계획 탭 카드에
    "Osaka, Japan" 칩 정확히 표시(좌표 캡처 확인). 콘솔 에러 없음.
  - 히어로 카드가 두 예정 여행 중 **더 가까운 쪽**(D-19)을 정확히
    선택하는 것도 확인(정렬 로직 검증).
  - `/api/weather` 요청이 여행 시작~종료일 전체를 gridKey 하나로 묶어
    정확히 호출되고 503을 조용히 처리하는 것도 프로덕션에서 재확인.
  - 검증용으로 만든 "오사카 검증용 여행"(2026-11-05~08, JPY)은
    **사용자가 직접 정리하기로 함** — 내가 지우지 않았음, 실제 유저
    계정에 아직 남아있을 수 있음.

### 이번 세션에서 발견/수정한 버그 전체 목록 (회귀 테스트 있음)

1. **배포 인프라 3연쇄 사고** (이전 세션): `vercel.json outputDirectory`가
   `dist/`가 아니라 레포 루트를 서빙 → React Router `basename` 누락 → CDN
   전파 지연. 전부 수정 확인됨(`21ee199`, `d676b6c`).
2. **Supabase 환경변수 누락**: Vercel 빌드에 `VITE_SUPABASE_URL` 등이 없어서
   새 앱이 크래시. Vercel 대시보드에 사용자가 직접 등록, 재배포로 해결
   (`e229965`).
3. **잘못된 날짜값 크래시**: 자동화 테스트 중 `<input type="date">`에
   비정상 값(`110120-02-06`) 입력됨 → `TripDetailScreen`의 `formatDayDate`가
   `RangeError`로 크래시. `CreateTripModal`의 Zod 스키마에 형식/연도 범위
   검증 추가 + `formatDayDate`/`formatItineraryText`/`tripStatus.ts`
   전부 방어적 처리 (`966d1a2`).
4. **`get_shared_trip` 컬럼명 불일치** (위에서 설명) — `afd25ef`.
5. **`TripTimeline`의 leg 인덱스 오프셋 버그**: `legs[index]`를 `dayItems`
   인덱스로 직접 매칭하고 있어서, 출발 숙소가 있는 날은 구간 라벨이 한 칸씩
   밀려 표시되고(숙소→첫 장소 구간 자체가 아예 안 보임) 있었다.
   `RouteWaypoint.ref` 기준 매칭으로 수정, 숙소/항공편 고정 카드도 타임라인에
   추가 — `1503ebd`.
6. **ShareSheet 공유 URL에 basename 누락** — `6ac5289`에 포함되어 수정됨.
7. **`TripTimeline`의 항공편 좌표 무한 렌더 루프** — `b39a3a3`
   (2026-09-21). `flightArrival`/`flightDeparture`에서 `{lat,lng}`를 뽑아
   `useTripRoutes`에 넘길 때 매 렌더마다 새 객체 리터럴을 만들고 있었다.
   `useTripRoutes`의 effect가 이 객체를 의존성 배열에 그대로 쓰므로
   참조가 바뀔 때마다 재실행 → `setLegs` → 재렌더 → 새 객체... 무한
   루프로 이어져 브라우저 탭이 완전히 멈췄다(Directions API 호출이 초당
   수백 건 쌓임). **첫날에 항공편 도착 정보가 있거나 마지막날에 출발
   정보가 있는 모든 실제 여행에 해당되는 버그**였다 — 샘플 여행을 실제
   데이터로 처음 열어보면서(Day1에 항공편+일정+숙소가 동시에 있는
   조합) 발견됨. `useMemo`로 참조를 고정해 해결. 이 버그는 **비로그인
   샘플 여행 기능과 무관하게 독립된 커밋(`b39a3a3`)으로 분리**했다
   — [[feedback_granular_commits_and_phase_regression]] 참고.

## 완료된 것 — Phase 4 (서류 자동 인식, 배포 불필요 범위 전부, 2026-09-21)

`docs/specs/04-document-ai.md` 기반. 사용자가 "배포 안 되는 부분부터 다 만들어놓기"를
선택(AskUserQuestion) — Supabase CLI 배포(`supabase login`, 사용자 계정 필요)가
있어야만 가능한 항목만 제외하고 나머지 전부 구현.

**완료 (커밋 `217855e`, `7cb5060`, `068f956`)**:
- 클라이언트 파이프라인 핵심(`src/features/documents/parseBooking/`): `redact.ts`
  (여권번호·카드번호 마스킹, §5 정규식), `schema.ts`(zod, `{value,confidence}` 래퍼),
  `patterns.ts`(DD/MM 모호성 해소 알고리즘), `airports.ts` + `data/airports.json`
  (OurAirports 공개 데이터 실제 9,055개 공항, `scripts/update-airports.js`로 생성),
  `validate.ts`(항공편/숙박 검증, 출발공항 좌표까지 채움), `parsers/`(registry +
  `generic-iata` 폴백 파서 — 항공사 전용 파서는 데이터 조작 안 하려고 의도적으로
  안 만듦), `llm.ts`(Gemini→Groq→OpenRouter 폴백, Gemini `responseSchema` 실제
  라이브 API로 스키마 호환성 검증 완료).
- Deno Edge Function(`supabase/functions/parse-booking/`): `index.ts`(전체 핸들러),
  `extractText.ts`(PDF 텍스트 추출), `sourceWeight.ts`(§8 신뢰도 가중), `deno.json`.
  **로컬 Deno 런타임이 없어 완전히 UNTESTED, 배포도 안 됨**(아래 사고 참고) — 코드
  리뷰로만 검증. 배포는 사용자가 `supabase login` 후 직접 해야 함.
- 클라이언트 UI: `consent.ts`(localStorage 동의 기록), `UploadModal.tsx`(동의→파일
  선택), `ReviewSheet.tsx`(검수 시트, `ConfidenceField.tsx`로 §6.6 3단계 신뢰도
  UI), `documentService.ts`/`useDocuments.ts`(Storage 업로드+Edge Function
  invoke+승인/거절), `commitBooking.ts`(항공편만 자동 커밋 — 좌표까지 갖춰져
  있어 outbound/return 슬롯 판정 가능), `TripDetailScreen.tsx`에 "📄 서류로
  추가" 버튼 통합(샘플 여행에선 숨김).

**의도적으로 스코프 밖(§1 "조용한 자동 확정 금지" 원칙 위반 방지 + 배포 제약)**:
- 항공사별 전용 파서(스펙엔 10개 언급) — 실제 항공사 서식 데이터 없이 만들면
  가짜 확신을 주는 파서가 되므로 안 만듦. `generic-iata`(범용 IATA 코드 파서,
  `detect()` 최대 0.75점, 실제 공항DB로 크로스체크해 오탐 방지)만 존재.
- 스캔본/사진 OCR(vision) 경로 — PDF 텍스트 추출만 구현.
- .pkpass/.ics 파싱.
- 숙소/철도/렌터카/액티비티 **자동** 일정 반영 — 호텔 좌표 해석(§7, Google
  Places 역지오코딩) 미구현이라 `GenericBookingCard`가 인식된 내용만 보여주고
  기존 🏨숙소/+일정추가로 **수동** 등록하도록 안내.
- 골든 테스트 100건 규모 — 현재는 합성(synthetic) fixture 2건뿐
  (`tests/fixtures/bookings/`, §11.2 명시대로 실제 개인정보 아님).

**사고 (로컬 Deno 검증 포기 원인)**: 이전에 실행해둔 `brew install poppler`
백그라운드 프로세스를 `pkill -f "brew install poppler"`로 죽이려 했는데 실제
프로세스명이 `ruby ... brew.rb install poppler`라 패턴이 안 맞아 1시간 넘게
계속 돌고 있었음 — 이게 `cmake` 락을 잡고 있어서 `brew install deno`가 막힘.
`ps aux`로 실제 PID 찾아 `kill -9`로 종료, `brew cleanup --prune=all`로 2.7GB
정리. 로컬 Deno 설치를 포기하고 코드 리뷰로 검증을 대체함(사용자에게 투명하게
보고함).

**Phase 경계 회귀 검증 (2026-09-21)**:
- `npm run typecheck` / `npm test -- --run`(153개 전부 통과) / `npm run build` /
  `npm run lint`(에러 0, 기존 `types/index.ts`의 `any` warning 5개는 이번 세션과
  무관한 기존 항목) 전부 통과.
- **로그인 세션이 프로덕션(`triptic.my`)과 로컬 dev(`localhost:3000`) 사이에
  공유 안 됨을 새로 발견** — Supabase Auth OAuth 리다이렉트 URL이 프로덕션
  도메인으로 고정돼 있어서, `localhost:3000`에서 로그인을 시도해도 콜백이
  `triptic.my`로 떨어짐(원인: Supabase Auth 설정의 Redirect URLs 목록에
  localhost가 없음 — 필요하면 사용자가 Supabase 대시보드에서 추가해야 함,
  계정 설정 변경이라 에이전트가 임의로 안 건드림). **우회**: `triptic.my`
  (프로덕션 루트)에서 로그인 → 같은 오리진인 `triptic.my/preview/`로 이동하면
  localStorage 세션이 그대로 유지되어, 실제 배포된 Phase 4 코드를 로그인 상태로
  확인할 수 있었음.
- 실제 트립("Phase4 테스트", Tokyo, 2026-10-10~13, Google Places 자동완성으로
  좌표까지 정상 캡처) 생성 → "📄 서류로 추가" 클릭 → 동의 화면(§3 마스킹 고지
  문구 정확히 일치) → 파일 선택 화면(PDF/JPG/PNG, 최대 20MB 안내) 전부 스펙대로
  정상 렌더링 확인.
  `<input type="date">`에 `computer type` 액션으로 슬래시 포함 문자열을 넣으면
  세그먼트가 꼬인다는 것도 재확인(`form_input` 도구로 `YYYY-MM-DD` 넣는 게
  안전).
- 콘솔에 앱 관련 에러 없음(Chrome 확장 자체의 "message channel closed" 노이즈만
  있었음, Triptic과 무관).
- 검증용 "Phase4 테스트" 트립은 사용자가 직접 정리하기로 함(에이전트가 안 지움
  — [[feedback_granular_commits_and_phase_regression]]에서도 같은 패턴).

## 완료 — Phase 4 Edge Function 배포 + 실사용 E2E 검증 (2026-09-21, 같은 세션 이어서)

사용자가 `supabase login` 완료를 알려와 배포 진행. `supabase projects list`로
로그인·프로젝트 연결(`ifzykfemjzqquyzgpqax`) 확인 후, 배포 전 사전 점검에서
두 가지 누락을 발견해 사용자 승인(AskUserQuestion) 받고 먼저 처리:

1. **`vouchers` Storage 버킷이 아예 없었음** — `0015_vouchers_bucket.sql`로
   비공개 버킷(20MB, PDF/JPG/PNG/.pkpass/.ics) + 경로 첫 세그먼트(user_id)
   본인 일치 RLS(select/insert/delete) 생성, 운영 DB에 적용 완료.
2. **Edge Function 시크릿 미등록** — `.env.local`의 `GEMINI_API_KEY`/
   `OPENROUTER_API_KEY`를 `supabase secrets set`으로 등록. `GROQ_API_KEY`는
   로컬에 없어서 생략(폴백 3단계 중 2번째만 비어있음 — Gemini가 보통
   성공하므로 당장 문제 아님, 필요해지면 사용자가 추가).

**배포 중 발견·수정한 버그 2건(둘 다 로컬 Deno 없이는 절대 못 잡는
종류였음 — 배포+실사용 테스트가 왜 필요한지 보여주는 사례)**:

1. **Deno 번들러가 상대 import를 못 찾음** (`84025b2`): "Module not found"로
   배포 자체가 실패. Deno는 Vite/tsc와 달리 상대 import에 파일 확장자가
   **필수**다 — `validate.ts`/`llm.ts`/`parsers/index.ts`/`parsers/registry.ts`/
   `parsers/flight/generic-iata.ts`의 모든 `from './schema'` 류를
   `from './schema.ts'`로 수정. `tsc --noEmit`이 깨지지 않도록
   `tsconfig.json`에 `allowImportingTsExtensions: true` 추가(Vite/esbuild는
   원래부터 확장자 유무 상관없이 잘 처리해서 문제 없었음 — 오직 Deno
   번들러만의 요구사항).
2. **CORS `Access-Control-Allow-Headers`에 `apikey`/`x-client-info` 누락**
   (`0928015`): 첫 배포 후 실제 PDF 업로드 테스트에서 "업로드 중 오류가
   발생했습니다"로 조용히 실패. 증상이 까다로웠음 — 프리플라이트(OPTIONS)는
   204로 정상 응답했는데 **실제 POST가 네트워크 로그에 아예 안 찍혔다**
   (Supabase `function_edge_logs`에 OPTIONS만 있고 POST가 없음, storage
   업로드와 documents insert는 200/201로 정상). 원인: supabase-js가 모든
   요청에 자동으로 붙이는 `apikey`/`x-client-info` 헤더가
   `Access-Control-Allow-Headers`(당시 `authorization, content-type`만
   있었음) 허용 목록에 없어서, **브라우저가 프리플라이트 응답을 보고 실제
   요청 자체를 보내지 않고 조용히 막았다**(콘솔 에러도 프로덕션 빌드라
   `captureError`가 Sentry로만 보내고 안 찍힘 — 진단이 오래 걸린 이유).
   Supabase 공식 예제의 CORS 헤더 목록(`authorization, x-client-info,
   apikey, content-type`)으로 맞춰 해결. **다음에 새 Edge Function을 만들
   때는 처음부터 이 4개 헤더를 기본으로 넣을 것.**

**실사용 E2E 테스트 (2026-09-21, `triptic.my` 프로덕션, 합성 테스트 PDF)**:
`cupsfilter`로 텍스트→PDF 변환한 합성 항공권(KE801, ICN→NRT, 여권번호
포함해 마스킹 경로까지 지나가게 구성)을 "Phase4 테스트" 트립에 실제 업로드
→ 업로드→추출→마스킹→파서/LLM 추출→검증→가중치→`bookings` insert→
`ReviewSheet` 렌더링까지 전부 정상 동작 확인:
- 편명/시각은 신뢰도 <0.8이라 §6.6대로 빈칸+플레이스홀더("추출 실패 —
  직접 입력")로, 공항코드(ICN/NRT)는 0.8~0.9라 경고 배지("⚠️ 확인해
  주세요")로 정확히 3단계 UI 그대로 렌더링됨 — 버그 아니라 스펙대로의
  동작.
- 검수 시트에서 값 채워 넣고 "일정에 반영" 클릭 → `commitFlightBooking`이
  Day 1(출발일=여행 시작일)에 정확히 배치 → 실제 타임라인에 "✈️KE801
  Incheon International Airport → Narita International Airport, 08:00
  출발 → 10:30 도착" 카드 생성 확인. "검수할 예약이 없어요"로 정상 종료,
  대기 배지도 사라짐.
- `function_logs`(런타임 콘솔)에 에러 없음, 브라우저 콘솔에도 앱 관련
  에러 없음.

**이걸로 Phase 4는 배포 제약 없이 기능 전체가 실제로 동작하는 것까지
확인됨 — Edge Function 검증 갭이 완전히 해소됨.** 커밋: `84025b2`
(import 확장자), `0928015`(CORS), `14950d2`(vouchers 마이그레이션).

## 완료 — ADR-002 정규화 테이블 이관 M2~M5 + RPC 컷오버 (2026-09-21)

전수 감사(위 문단)에서 최우선 갭으로 지목, 사용자가 즉시 진행 승인. 상세
실행 계획은 `/Users/benlee/.claude/plans/whimsical-floating-barto.md`(plan
mode 산출물)에 그대로 남아있음 — 스코프 판단 근거를 다시 볼 때 참고.

**완료 (M1/RLS/두 RPC 본체는 이미 예전 세션에 작성돼 있었고, 이번엔
"실행"만 하면 됐다는 걸 먼저 확인함)**:
- M1(정규화 테이블)과 §4 RLS는 `0001~0007`로 이미 배포돼 있었음 — 새로
  안 만듦.
- `get_user_travel_stats()`(스펙 §5 원본)는 `0009`로 이미 배포돼 있었음.
- `get_shared_trip()` 정규화 버전은 `0008_shared_trip_cutover.sql`에 이미
  작성돼 "M4 완료 전 적용 금지" 경고와 함께 보류돼 있었음.
- **신규로 만든 건 M2(변환 로직)뿐**: `supabase/functions/sync-trip-normalized/
  index.ts`(신규 Edge Function) — `trips.snapshot`을 읽어
  `trip_days`/`itinerary_items`/`legs`/`expenses`를 멱등하게(매번 delete+
  insert) 재계산한다. Plan 탭이 이미 갖고 있던 순수 함수를 그대로
  재사용해서 만들었다: `getDayCity`(dayCities.ts), `syncMealItemsIntoDay`
  (map/meals.ts, 식사를 시간순 삽입), `dayIndexForDate`(commitBooking.ts,
  항공편 날짜→일차 변환), `haversineKm`(map/geo.ts, legs 거리 추정) —
  전부 렌더링 로직과 100% 동일한 규칙으로 변환되므로 "화면에 보이는 것"과
  "정규화 테이블에 저장되는 것"이 항상 일치한다.
- `tripService.ts`의 `saveTrip()` upsert 직후 이 함수를 fire-and-forget으로
  호출 — `useCreateTrip`/`useUpdateTripSnapshot`/`useRenameTrip`/
  `useDuplicateTrip`(전부 결국 `saveTrip()`을 호출) 전부가 자동으로
  M5(dual-write)에 편입됨. 샘플 여행은 Supabase를 안 건드리므로 자동 제외.
  **실사용으로 확인**: 실제 트립에 "Tokyo Tower" 장소를 UI로 추가했더니
  수동 호출 없이 `itinerary_items`에 즉시 반영되고 `legs`에 ICN↔도쿄타워
  haversine 거리(~1,203km)까지 자동 계산됨.
- M4 백필: 운영 DB에 트립이 1개(`Phase4 테스트`)뿐이라 별도 배치 스크립트
  없이 그 트립에 한 번 직접 invoke. M3 검증: 스펙 §6.3 체크섬 쿼리(snapshot
  place 개수 vs itinerary_items place 개수) 0행 확인, 날짜범위/좌표/시각대
  전부 정확히 일치 확인.
- `0008` 적용 → `get_shared_trip()`이 이제 `{trip,days,items,legs}`를
  반환. `SharedTripScreen.tsx`를 이 새 shape용 어댑터로 다시 작성
  (`toPlaceItem()` 헬퍼) — `ItineraryItemCard`/`FixedPointCard`/
  `LegBetween`/`useTripRoutes`(라이브 Directions) 등 기존 렌더링 컴포넌트는
  전혀 안 건드림. 실제 공유 링크(`MooJXXMuvf`)로 브라우저에서 확인, 콘솔
  에러 없음.
- `useHomeStats.ts`를 `get_user_travel_stats_snapshot`(0014, 임시)에서
  `get_user_travel_stats`(0009, 스펙 원본)로 전환, `0016` 마이그레이션으로
  0014 함수 자체를 drop. Home 탭에서 실사용 확인(완료된 여행이 없어 전부
  0 — 스펙대로 정확한 동작, Phase 3 때와 같은 이유).

**의도적으로 이번 패스에서 제외한 것(사용자에게 이미 보고함)**:
- **Plan 탭(`TripDetailScreen`/`PlanScreen`) 자체의 읽기/쓰기는 여전히
  snapshot이 1차 데이터.** 정규화 테이블은 "항상 최신인 파생 프로젝션"일
  뿐 — Phase 2에서 19/19 패리티까지 검증된 안정적 코드를 리스크 없이
  건드리지 않기로 한 명시적 결정. `tripService.ts` 헤더 주석에도 이 결정
  이유를 남겨둠.
- `itinerary_items.booking_id` 역방향 링크는 안 함(Document AI가 만든
  `bookings` 행과 스냅샷에서 변환한 항목을 자동으로 매칭하지 않음 —
  틀리게 매칭하느니 null이 낫다는 판단). `bookings` 테이블 자체는
  sync-trip-normalized가 절대 건드리지 않는다(생성도 삭제도 안 함).
- `country_code`는 트립 단위 근사치(트립/일차 도시 문자열의 국가 부분을
  작은 정적 매핑표로 변환) — 완벽한 역지오코딩 아님. **실측된 부작용**:
  KE801(인천 출발, 실제로는 한국)이 도쿄 트립이라는 이유로 `country_code`
  "JP"로 찍힘 — 항공편처럼 출발지가 트립 목적지와 다른 국가인 항목에서
  가장 두드러지는 한계. 정확도가 중요해지면 항목별 실제 역지오코딩으로
  교체할 것.
- 항공편(`type='flight'`) itinerary_items 행은 **출발공항 좌표만** 저장한다
  (도착공항 좌표는 이 스키마에 자리가 없음) — `SharedTripScreen`의
  `FlightPointCard`(출발·도착 2지점 고정 카드) 재현을 포기하고 일반 항목
  흐름에 편입시켰다. Plan 탭 자체 화면(snapshot 기반)은 영향 없음 — 거기는
  여전히 dep/arr 풀세트를 스냅샷에서 그대로 읽는다.
- **M6(2주 관찰)·M7(snapshot 컬럼 drop)은 미도달.** M6는 캘린더 시간이
  필요하고, M7은 Plan 탭이 snapshot 없이 동작해야 하는데 그건 이번
  스코프 밖이다. "ADR-002 완료"라고 말하면 안 된다 — 사용자에게도 이렇게
  보고함.

커밋: `cf10645`(2차 import 확장자 수정), `39676d8`(sync-trip-normalized +
tripService 훅), `70f2491`(RPC 컷오버). 신규 마이그레이션: `0016`.

## 운영 원칙 (계속 유지해야 함)

1. **사용자가 명시적으로 "한국말로만 말해"라고 요청함 — 항상 한국어로 응답.**
2. 운영 Supabase 프로젝트에 실제 스키마 변경/마이그레이션 적용은 **매번
   사전 확인 후 진행** (이미 승인받아 여러 번 실행 완료했지만, 새로운
   변경은 다시 확인받아야 함 — 실제로 `0013` 적용 전에 재확인받음).
3. 매 기능 구현 후 **4개 게이트 전부 통과 확인 후 커밋+푸시**:
   `npm run typecheck`, `npm test -- --run`, `npm run lint`, `npm run build`.
3-1. **(2026-09-21 추가)** 커밋은 기능/수정 단위로 잘게 쪼갠다 — 작업 중
   우연히 발견한 버그를 같이 고치더라도 버그 수정과 기능 추가는 별도
   커밋으로 분리한다(bisect 가능하게). phase 경계에서는 새 기능뿐 아니라
   이전 phase 기능도 같이 회귀 확인하는 걸 습관으로 삼는다. 상세:
   [[feedback_granular_commits_and_phase_regression]].
4. legacy 코드(`index.html`)를 먼저 정확히 읽고, 알고리즘/데이터 구조를
   그대로 이식하는 패턴을 유지해왔음(ADR-001). 파일 상단에 "원본:
   index.html 함수명 (라인 번호)" 주석을 남기는 관례가 자리잡음.
5. 커밋마다 Vercel에 자동 배포됨(`git push origin main` 트리거) — CDN
   전파에 10~90초 정도 걸릴 수 있음.
6. 커밋 메시지 끝에 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
   추가하는 게 시스템 규칙.

## ✅ 완료 — entitlements.can() 실제 배선, main 병합 확인 (2026-09-21, 같은 날 재확인)

**위 문단(전수 감사)이 걱정했던 "병합 안 됨" 상태는 이후 해소됐다.** 다음
세션 시작 시 `git status`/`git worktree list`/`git branch --no-merged
main`을 재확인한 결과: `worktree-entitlements-wiring` 워크트리는 이미
삭제돼 있었고, 커밋 `0a02e8a`는 **`origin/main`에 이미 push돼 있었다**
(로컬 `main`만 1커밋 뒤처져 있었음 — 아마 다른 세션/워크트리에서 직접
main으로 병합 후 push한 것으로 추정, 정확한 경위는 불명). `git pull
--ff-only origin main`으로 로컬 동기화 후 4게이트 재실행:
- `npm run typecheck` 통과
- `npm test -- --run` 153개 전부 통과
- `npm run lint` 에러 0(기존 `types/index.ts` any warning 5개만, 무관)
- `npm run build` 통과, `TripDetailScreen` 청크 90.00kB/gzip 29.39kB로
  정상 범위(100KB 회귀 없음)

`git show 0a02e8a`로 diff 재검토도 완료 — 아래 서술된 3곳 게이트(신규
여행 생성/공유 링크 생성/서류 업로드) 내용과 정확히 일치, 별도 수정
불필요. **이제 main/프로덕션에 실제로 존재한다.** 아래는 그 배선 내용
상세(참고용으로 유지).

전수 감사에서 지목된 "정의만 있고 호출부 0곳" 갭 해소를 겨냥한 작업이다.
`can()`이 3.0에서
항상 true를 반환하므로 동작 변화는 없는 순수 배선 작업(§13.3 ① 규칙: "항상
true를 반환하더라도 호출부를 지금 심어 둔다").

- `tripService.saveTrip()`: `project.supabaseId`가 없을 때(신규 생성)만
  `trip.create` 게이트. 기존 여행 갱신(upsert)은 게이트 안 함 — Feature가
  "여행 생성"이지 "여행 저장" 전체가 아니므로.
- `tripService.createShareLink()`: `trip.collaborate` 게이트.
- `documentService.uploadAndParseDocument()`: `voucher.storage` +
  `document.parse` 둘 다 Storage 업로드 전에 체크.
- **`offline.maps`는 게이트 안 함** — 조사 결과 관련 기능 자체가 아직
  구현돼 있지 않아(src 전역에 offline 지도 코드 없음) 심을 호출부가
  없었음. 나중에 오프라인 지도 기능(Phase 6 범위)을 만들 때 이 게이트를
  같이 넣어야 한다는 걸 잊지 말 것.
- 4개 게이트(typecheck/test 153개/lint/build) 전부 통과, 동작 변화 없음이
  기대대로 확인됨(can()이 여전히 항상 true).
- 실사용 UI 에러 노출(toast 등)은 이번 스코프에 포함 안 함 — 기존
  호출부들(`CreateTripModal`/`ShareSheet`/`UploadModal`)의 에러 처리
  패턴이 이미 제각각(captureError만 하는 곳, 로컬 state 메시지, react-query
  `isError` 렌더링 등 혼재)이라 이걸 통일하는 건 별도 작업 범위로 판단.
  4.0에서 실제로 `can()`이 false를 반환하기 시작할 때 이 갭이 드러날 것.

## ✅ 완료 — 설정 탭 환경설정/알림/데이터/정보 섹션 + 바우처 보관함 (2026-09-21, 같은 세션 이어서)

전수 감사 우선순위 2번("설정 탭 나머지 섹션 + 바우처 보관함 전용 화면")을
처리했다. 커밋 `78eb652`(버그수정)/`252af41`(설정 탭)/`997988e`(바우처
보관함), 전부 push 완료 후 프로덕션(`triptic.my/preview/`)에서 실사용
계정("Ben Lee")으로 로그인 상태·비로그인 상태 둘 다 실제 클릭/DB 조회로
검증함.

**설정 탭 (`02-screens.md` §5)**:
- 계정: 기존 그대로(변경 없음). "프로필 편집"·"연결된 로그인" 항목은
  여전히 없음(스킵, 아래 "남은 갭" 참고).
- 환경설정: **테마(시스템/라이트/다크)는 이번에 실제로 동작한다** —
  `src/shared/theme.ts`가 `tokens.css`의 기존 `data-theme` 스위치를 켜고
  끄기만 한다(값은 `localStorage`, 계정 동기화 대상 아님— 기기별 표시
  설정으로 판단). **온도 단위(°C/°F)도 실제로 반영된다** —
  `useTempUnit()`(`src/shared/hooks/useTempUnit.ts`)이 `profiles.temp_unit`을
  읽어 `HeroCard`/`ItineraryItemCard`/`TripDetailScreen`의 `formatTemp` 호출에
  전달한다(전엔 항상 `formatTemp(tempC)` 기본값 'C'만 호출해 죽은 코드였음).
  거리 단위·기본 통화·언어는 이미 있던 `profiles` 컬럼(`distance_unit`/
  `base_currency`/`locale`)에 값만 저장 — 화면에 각각 "지도·경로 표시에는
  아직 반영되지 않아요" / "표시 언어 전환은 다음 업데이트에서 지원돼요"라고
  정직하게 명시했다(entitlements.can()과 같은 "배선만 먼저" 패턴).
- 알림: `profiles.notification_prefs`(신규 컬럼, 마이그레이션 `0017`,
  **운영 DB 적용 완료** — 사용자 승인 받고 적용함) 4개 토글. 실제 발송
  파이프라인(Phase 6)은 없음, 값 저장만.
- 데이터: 기존 `BackupModal`(JSON 백업)을 설정에서도 열 수 있게 연결.
  오프라인 캐시(Cache Storage) 사용량 표시(`navigator.storage.estimate()`)
  + "캐시 지우기" 버튼(`caches.keys()`/`caches.delete()`). PDF 내보내기는
  여행별 기능이라 힌트 문구로 안내만("여행 상세의 공유(↗) 버튼에서").
- 정보: legacy가 이미 쓰던 `/terms.html`·`/privacy.html` 링크 재사용(새로
  작성 안 함), 오픈소스 라이선스는 `node_modules`의 실제 설치본
  `package.json`에서 뽑은 정적 스냅샷(`src/features/settings/
  licenses.data.ts`, 28개 런타임 의존성), 문의하기는 legacy 법적 고지에
  이미 공개돼 있던 이메일(`lkjh7609@gmail.com`) mailto 링크.

**바우처 보관함 (`02-screens.md` §3.6)**: `documentService.listDocuments()`
(documents+bookings를 document_id로 합쳐 타입 아이콘·예약번호 붙임) +
`deleteDocument()`(Storage 원본 삭제+DB 행 삭제) + `VoucherArchive.tsx`
(목록/뷰어/공유/삭제) + `TripDetailScreen` 헤더에 🎟 버튼(🗺·🎟·↗ 순서,
배지는 검수 대기 예약 수 재사용). **실제 프로덕션 문서로 검증**: "Phase4
테스트" 트립을 열어 🎟 클릭 → 이전 세션이 업로드해 둔 문서 2건이 정확히
표시됨(하나는 ✈️ 아이콘 — bookings와 매칭됨, 하나는 📄 아이콘 — 매칭 없음
— 조인 로직이 실제로 맞게 갈린다는 뜻).

**의도적으로 스코프 밖(문서화된 결정)**:
- "연결된 일정 항목으로 이동" 링크 — ADR-002에서 `itinerary_items.
  booking_id` 역방향 링크를 의도적으로 안 만들기로 했어서(부정확한 매칭
  방지) 구현 불가능. 나중에 그 링크를 만들면 같이 추가할 것.
- 오프라인 우선 자동 다운로드 캐시(바우처를 IndexedDB에) — IndexedDB
  자체가 없는 Phase 6 미착수 상태라 스코프 밖.
- PDF 뷰어는 pdf.js 대신 서명 URL을 새 탭으로 열어 브라우저/OS 기본
  처리기에 맡긴다(`ReviewSheet.openVoucher`가 이미 쓰던 패턴과 동일,
  번들 크기 문제 회피). 이미지만 인앱 전체화면 뷰어.
- 계정 섹션의 "프로필 편집"·"연결된 로그인" 항목 — 무엇을 편집 가능하게
  할지(닉네임? 아바타?) 설계 판단이 더 필요해 이번 라운드에서 보류.

**검증(2026-09-21, 프로덕션, 실제 로그인 계정)**:
- 4게이트(typecheck/test 153개/lint/build) 통과 확인 후 커밋.
- 로컬 dev(비로그인): 설정 탭 5개 섹션 전부 정상 렌더링, 테마 전환이
  전체 화면에 즉시 반영되는 것 확인(라이트/다크 토글 시 `data-theme`
  속성과 `localStorage` 값 둘 다 변경 확인).
- 프로덕션(로그인): 환경설정 4개 select(온도/거리/통화/언어)가 실제
  프로필 값으로 채워짐, 알림 4개 토글이 `0017`의 DB 기본값과 일치,
  오프라인 캐시 실사용량(389.4MB) 표시. 온도 단위를 'f'로 바꿔
  Supabase에서 직접 `select`로 실제 DB 반영 확인 후 다시 'c'로
  되돌려놓음(테스트 흔적 정리).
- 바우처 보관함: 위 설명대로 실제 문서 2건 렌더링 확인.
- 콘솔에 앱 관련 에러 없음(Chrome 확장 "message channel closed" 노이즈만,
  기존에도 계속 나오던 것과 동일 — Triptic과 무관).

## ✅ 완료 — 가계부 화면 스펙 갭 (02-screens.md §3.7, 2026-09-21 같은 세션 이어서)

전수 감사 우선순위 3번. 커밋 `f9a2b2f`, push+Vercel 배포+Supabase Edge
Function 재배포까지 전부 완료, 프로덕션 실사용 계정으로 검증함.

- `ExpenseItem`에 `currency`/`category`/`paymentMethod`/`fxRateToBase` 추가
  (하위호환: 없으면 각각 여행 기본통화/'other'로 간주).
- **환율 자동 변환**: `src/features/plan/fxRate.ts`가 Frankfurter(ECB 매일
  공시, 무료·키 불필요 공개 API)로 그날 환율을 조회해 `fxRateToBase`에
  스냅샷 저장(스펙 원문 "나중에 환율이 바뀌어도 기록은 고정" 요구사항대로
  이후 재계산 안 함). 조회 실패해도 저장은 막지 않고 합계에서만 제외 +
  경고 문구 표시. **실제 프로덕션에서 라이브 API 호출로 검증**(1,000엔 →
  8,791.6원, 실제 시세 반영 확인).
- **차트**: 별도 라이브러리 추가 없이 `ExpenseChart.tsx`(가로 막대 목록)로
  구현 — jsPDF 번들 크기 사고 이후 번들 크기에 민감하다는 판단(PDF 출력
  기능 상세 참고). 일자별 합계 + 카테고리별 합계 둘 다 `ExpenseModal` 안에
  표시.
- `pdfExport.ts`: 항목 통화가 여행 기본통화와 다르면 원본+환산 금액을 같이
  표기하도록 수정(전엔 전부 기본통화라고 가정해 부정확할 뻔했음 — 이번에
  per-item currency가 생기며 드러난 잠재 버그를 같은 커밋에서 미리 막음).
- `supabase/functions/sync-trip-normalized/index.ts`: `expenses` 테이블
  insert 시 `category`/`currency`/`fx_rate_to_base`/`payment_method`를
  스냅샷 실제 값으로 채우도록 수정(전엔 전부 `'other'`/여행 기본통화로
  하드코딩). **이 Edge Function은 git push로 자동배포 안 됨** —
  `supabase functions deploy sync-trip-normalized`로 별도 배포 필요하다는
  걸 이번에 재확인(사용자 승인 받고 배포, 프로덕션에서 정규화 테이블에
  실제로 category='food'/currency='JPY'/fx_rate_to_base=8.7916/
  payment_method='card'까지 정확히 들어가는 것 SQL로 직접 확인).
- (P1) 동행자 정산은 스펙에도 "(P1)"로 명시돼 있어 이번 라운드 제외.
- 테스트 인프라: 이 기능의 컴포넌트 테스트가 레포 첫 `.tsx` 테스트라
  `vitest.setup.ts` + `@testing-library/jest-dom` 타입 참조(`src/
  testing-library-jest-dom.d.ts`) 신규 추가. 4게이트 173/173 테스트 통과
  (기존 153 + 신규 20).

## ✅ 완료 — ADR-002 M0~M7 전체 완료(Plan 탭 + 레거시 정규화 전환 + snapshot drop, 2026-09-21)

아래 "🚧 진행 예정" 문단(착수 배경)에서 시작한 작업이 같은 세션 안에서
전부 끝났다. 커밋: `e73eef7`(공용 백엔드) → `5e00818`(3.0 컷오버) →
`e3d68c7`(레거시 컷오버) → `4f45421`(문서 주석) → `19be03d`(레거시
제목 버그 수정) → `a57fa85`(M7: snapshot drop). 전부 push+배포 완료.

**핵심 설계**: "JSON 계약을 그대로 유지한 채 저장소만 교체". 레거시
(`supabaseService.js`)와 3.0(`tripService.ts`)은 `saveTrip(project, name)`/
`toLocalProject(row)` 딱 두 함수로만 trips 테이블에 접근하는 걸 이미
확인했고, 이 두 함수의 **내부 구현만** 바꿨다 — TripDetailScreen/모든
모달/PlanScreen/BackupModal/sampleTrip.ts, legacy index.html의 렌더링·
편집 로직은 **단 한 줄도 안 건드렸다.**

**Stage 0 — 스키마(`0018_normalized_readwrite.sql`, `0019_drop_trips_
snapshot.sql`)**:
- `itinerary_items.extra jsonb`(nullable) 추가 — 항공편 도착 공항처럼
  구조화 컬럼에 자리 없는 필드를 원본 그대로 보존.
- `replace_trip_itinerary(p_trip_id, p_days, p_items, p_legs, p_expenses)`
  — plpgsql, 한 트립의 trip_days/itinerary_items/legs/expenses를 delete+
  insert로 **원자적으로** 전체 교체(단일 함수 호출 = 단일 트랜잭션이라
  기존 sync-trip-normalized의 "여러 개의 순차 supabase-js 호출" 방식보다
  안전해짐). `can_edit_trip()`으로 권한 체크, `security invoker`라 RLS가
  호출자 권한으로 정상 적용됨.
- `get_trip_itinerary_raw(p_trip_id)` — `trip_days`/`itinerary_items`/
  `legs`/`expenses`를 json으로 그대로 반환(`get_shared_trip()`과 동일한
  "SQL은 raw만, 재구성은 클라이언트" 패턴).
- **로컬 Supabase(Docker)가 꺼져 있어 plpgsql을 로컬 검증 못 함** — 대신
  `execute_sql`에서 `set_config('request.jwt.claims', ...)`로 인증
  컨텍스트를 흉내내 운영 DB의 더미 트립에 직접 두 함수를 실행해 검증(정상
  동작 확인 후 진행).

**Stage 1 — 백엔드**:
- `supabase/functions/sync-trip-normalized/` → `trip-itinerary-write/`로
  개명(`git mv`)·재작성. 예전엔 `trips.snapshot`을 읽어 파생 테이블을
  fire-and-forget 재계산했지만, 이제 **요청 본문으로 받은 콘텐츠**를
  `replace_trip_itinerary()` 한 번 호출로 반영하는 **유일한 쓰기 경로**다.
  기존 순수 함수(`getDayCity`/`syncMealItemsIntoDay`/`haversineKm`/
  `dayIndexForDate`)는 그대로 재사용. 항공편은 `extra: {leg, flight}`로
  `FlightInfo` 원본 전체(도착 좌표 포함)를 보존.
- `src/features/plan/itineraryTransform.ts`(신규, 3.0/레거시 공용) —
  `get_trip_itinerary_raw()` 결과를 예전 snapshot과 동일한 모양
  (`{data, hotels, meals, expenses, flights, dayCities}`)으로 역변환.
  단위 테스트 8건.
- 옛 `sync-trip-normalized` Edge Function은 아무도 안 부르게 된 뒤 삭제함
  (`supabase functions delete`).

**Stage 2/3 — 컷오버**:
- `tripService.ts`: `saveTrip()`이 `trip-itinerary-write`를 **await**
  호출(실패 시 저장 자체 실패 — 예전 fire-and-forget과 다름). `getTrip()`
  이 `get_trip_itinerary_raw()`+`reconstructTripContent()`로 콘텐츠를
  재구성해 `TripRow.content`(구 `.snapshot`)에 붙임. `listTrips()`는
  콘텐츠 없이 top-level 컬럼만(TripCard가 원래 그것만 씀).
- `supabaseService.js`(레거시): 동일 설계. 단, 레거시는 `getTrip(id)`
  단건 조회가 없고 `listTrips()`가 전체를 한 번에 `allProjects`로
  불러오는 구조라, `listTrips()` 안에서 각 트립마다 재구성해
  `row.content`에 붙인 뒤 반환(N+1 RPC, 트립 개수가 적어 무해).
  `index.html`은 이 서비스 계층을 통해서만 접근해 다른 수정 불필요
  (`.snapshot` 직접 참조 0건 grep 확인).

**Stage 4 — 검증(프로덕션, 실제 로그인 계정)**:
- 3.0(`/preview/`)에서 장소/숙소/식사/항공편/경비를 실제로 추가 →
  새로고침 → 정확히 재구성되는 것 확인. 항공편은 `extra`로 도착 좌표까지
  무손실 복원되어 구간거리까지 정확히 계산됨.
- 레거시(루트)에서 장소 추가(Meiji Jingu) → 3.0에서 만든 데이터를 레거시가
  그대로 읽고, 레거시가 쓴 데이터를 3.0이 그대로 읽는 **상호운용성**까지
  확인(같은 트립을 양쪽에서 번갈아 편집해도 무결).
- **발견한 사전 버그(제 작업과 무관)**: 레거시 `index.html`의
  `pullCloudTrips()`가 존재하지 않는 `row.name`(0000 정합화 때 `title`로
  rename된 옛 컬럼명)을 참조 — 여행 카드 제목이 항상 "undefined"로
  표시됨. `git log`로 Phase 0(`bf261ed`) 이후 안 건드려진 걸 확인,
  사용자 승인 받고 `row.title`로 수정(`19be03d`). **부작용 발견**: 이
  버그 때문에 실제 DB의 `trips.title`에도 문자열 `"undefined"`가 오염돼
  저장돼 있었음(테스트 트립 하나) — `update trips set title=...`로 복구.
- 4게이트(typecheck/181 tests/lint/build) 매 Stage마다 통과.

**Stage 5 — M7(`0019_drop_trips_snapshot.sql`)**: 위 컷오버 완료 +
`grep -rn "\.snapshot\b"` 코드 전체 재확인(주석만 남고 실제 참조 0건) 후
`alter table trips drop column snapshot` 실행. 직후 3.0/레거시 둘 다
프로덕션에서 재확인(콘솔 에러 없음, 데이터 정상).

**M6(2주 관찰) 생략 근거**: 사용자가 명시적으로 "실사용자 0명, 데이터
유실 무관"이라고 확인 — 캘린더 대기 대신 위 Stage 4 전수 재검증으로
대체. `supabase/migrations/README.md`에도 이 근거를 기록해둠.

**알려진 의도적 제약(사용자에게 투명하게 남겨둔 것)**:
- 식사 슬롯의 "건너뛰기(skip)" 상태, 일차별 도시의 "명시적 override vs
  여행 기본값 상속" 구분은 재구성 시 사라짐(스펙 §6.2도 요구 안 함).
- 수동 입력 항공편은 `bookings` 테이블에 안 넣기로 함(Document AI 파이프
  라인 소유 경계 보호 — bookings에 넣으면 delete-all-reinsert 구조상 매
  저장마다 가짜 예약이 바우처 보관함에 계속 나타나는 문제 발생).

## 🚧 진행 예정 — ADR-002 M6/M7 + Plan 탭 정규화 전환 (2026-09-21, 사용자 명시 승인) [완료됨 — 위 섹션 참고]

**중요한 결정 경위**: 사용자가 "가계부하고 m6/m7까지 진행하고 테스트해보자"고
지시. 확인 결과 M5(dual-write)가 바로 이 세션에서 막 시작돼(같은 날) 캘린더
2주가 전혀 지나지 않은 상태였다. AskUserQuestion으로 확인하니 사용자는 "지금
있는 데이터 다 지워져도 상관없어, 다 더미 데이터야"라고 답함 — 그런데 이건
"데이터 유실"과 "서비스 전체 장애"를 구분 못 한 답변일 수 있어서, **M7(snapshot
컬럼 drop)을 지금 하면 TripDetailScreen/PlanScreen(경비부 포함, 방금 만든
가계부 기능도 포함)이 여전히 snapshot을 1차 데이터로 읽고 써서 즉시 전체
장애가 난다**는 걸 구체적으로 재설명하고 재확인함. 사용자는 이걸 이해한 뒤
**"지금 Plan 탭까지 정규화 전환하고 M7 강행"**으로 최종 확정.

**즉, 이번엔 "M6 기다렸다가 M7만 하기"가 아니라 원래 별도 프로젝트급으로
미뤄뒀던 "Plan 탭 자체를 정규화 테이블 읽기/쓰기로 전환"까지 전부 이번
세션(또는 이어지는 세션)에서 하기로 스코프가 커졌다.** 착수 전 fork로
전수 조사(레거시 앱도 snapshot을 쓰는지, 3.0 쪽 snapshot 읽기/쓰기 지점
전부, 정규화 스키마로 손실 없이 매핑되는지, dnd-kit reorder 등 원자성
이슈, booking_id 역참조와의 상호작용)를 먼저 돌렸다 — **다음 세션은 그
조사 결과부터 확인하고 이어갈 것.** 조사 결과가 아직 이 문서에 반영 안
됐다면, 대화 맥락(fork 결과 알림)을 먼저 찾아볼 것.

**주의**: 레거시 앱(레포 루트 `index.html`, `triptic.my` 루트)이 만약
`trips.snapshot`을 공유해서 쓰고 있다면, 이 작업은 /preview/뿐 아니라
레거시 전체에도 영향을 미친다 — 조사 결과에서 이 부분을 최우선으로 확인할
것. 레거시가 별도 컬럼을 쓴다면 영향 범위가 /preview/로 한정된다.

## 다음에 이어서 할 일 (우선순위 순, 2026-09-21 전수 감사 + ADR-002 작업 반영)

**중요**: "Phase N 완료"는 그 Phase *안에서만* 완료라는 뜻이다.
`docs/DEVELOPMENT_PLAN.md` 로드맵 전체(Phase 0~7) 기준으로는 여전히 절반
미만이다 — 이 사실을 다음 세션에서도 절대 잊지 말 것(맨 위 "전수 감사로
정정된 사실" 문단 참고). 사용자에게 진행상황을 보고할 때 항상 "Phase
내부 완료"와 "로드맵 전체 완료"를 구분해서 말할 것.

1. ~~entitlements-wiring 브랜치 리뷰 + main 병합 여부 결정~~ **완료
   (2026-09-21)** — `0a02e8a`가 이미 origin/main에 있었음, pull+4게이트
   재검증 끝. 상세는 위 "✅ 완료 — entitlements.can() 실제 배선" 섹션.
2. ~~설정 탭 나머지 섹션 + 바우처 보관함 전용 화면~~ **완료 (2026-09-21)**
   — 환경설정(테마·온도단위 실동작, 거리단위/통화/언어는 저장만)·알림
   (저장만, `0017` 마이그레이션 적용)·데이터(백업 연동+캐시 삭제)·정보
   (약관/라이선스/문의) 전부 구현+배포+프로덕션 실사용 검증 끝. 바우처
   보관함도 목록/뷰어/공유/삭제 구현+실제 문서로 검증 끝. 상세는 위
   "✅ 완료 — 설정 탭 환경설정/알림/데이터/정보 섹션 + 바우처 보관함" 섹션.
   남은 갭(낮은 우선순위): 계정 섹션 "프로필 편집"·"연결된 로그인" 항목,
   거리단위 실제 지도 반영, 언어 실제 전환(Phase 6 i18n 필요),
   "연결된 일정 항목으로 이동" 링크(itinerary_items.booking_id 없어서
   ADR-002 완료 후에나 가능).
3. ~~**가계부 화면 스펙 갭**~~ **완료 (2026-09-21)** — 환율 자동변환
   (Frankfurter API, 일별 스냅샷)·카테고리·결제수단·일자별/카테고리별
   차트 전부 구현+배포+검증 끝. 상세는 위 "✅ 완료 — 가계부 화면 스펙 갭"
   섹션. (P1) 동행자 정산만 스펙대로 스코프 밖.
4. ~~**ADR-002 잔여(M6/M7)**~~ **완료 (2026-09-21)** — Plan 탭(3.0)뿐
   아니라 레거시까지 정규화 테이블 기반으로 전환하고 `trips.snapshot`
   컬럼을 실제로 drop함. 애초에 계획했던 "M6 기다렸다가 M7만" 수준을
   훨씬 넘어서는 큰 작업이 됐음 — 상세는 위 "✅ 완료 — ADR-002 M0~M7
   전체 완료" 섹션 참고. `country_code` 트립 단위 근사치는 여전히 남은
   한계(항공편 도착공항 좌표는 이번에 `extra` jsonb로 해결됨).
5. **Phase 5(커뮤니티+모더레이션) — 0%, App Store 리젝 리스크(R4) 있음.**
   시작 전. destinations/posts/comments/reactions/blocks/reports/
   moderation_events 테이블부터 `06-community.md`(394줄) 정독 후 착수.
6. **Phase 6(다국어/접근성/오프라인/푸시) — 0%.** `i18next`는 설치만 돼
   있고 코드 참조 0건. `07-i18n.md`(293줄) 정독 필요. IndexedDB 캐시,
   Playwright/e2e도 이 Phase 범위(§10.2). **오프라인 지도 기능을 여기서
   만들 때 `entitlements.ts`의 `offline.maps` 게이트도 같이 심을 것**(위
   "완료 — entitlements.can() 실제 배선" 참고 — 이번 세션엔 구현 자체가
   없어서 못 심었음).
7. **Phase 7(출시 준비) — 0%.** PrivacyInfo.xcprivacy, TestFlight,
   `08-release-checklist.md` 전체.
8. Phase 3 잔여 갭(낮은 우선순위): 항목별 시간별 기온(좌표→시간대 변환
   필요), climate_normals ETL(외부 데이터 소싱 필요), WEATHERKIT_* 등록
   (Apple Developer Program 가입 후), 세계지도 국가별 필터.
9. Phase 4 스코프 밖(낮은 우선순위, 필요해지면): 항공사별 전용 파서,
   스캔본 OCR, .pkpass/.ics, 숙소/철도/렌터카/액티비티 자동 커밋(호텔 좌표
   역지오코딩 선행 필요), 골든 테스트 100건 확충, `GROQ_API_KEY` 등록,
   EXIF 제거(§10.1), §10.2 오프라인 캐시·§10.3 바우처 뷰어 상세.

### 로컬 dev 서버로 Claude in Chrome 테스트할 때 주의 (계속 유효)

- `/preview/plan` 같은 하위 경로를 직접 새로고침/navigate하면 Vite dev
  서버가 SPA 폴백을 안 해줘서 **루트 legacy `index.html`이 대신 뜬다**
  (production은 vercel.json rewrite가 처리하지만 dev 서버엔 그게 없음).
  항상 `/preview/`(정확히 이 경로)로 먼저 들어간 다음 앱 내부 링크(하단
  탭 등)를 **클릭**해서 client-side 라우팅으로 이동할 것.
- **처음 쓰는 동적 import(예: `await import('./pdfExport')`)를 dev
  서버에서 첫 클릭하면 Vite가 새 의존성(jspdf 등)을 재최적화하면서
  자동으로 페이지를 강제 새로고침한다**(콘솔에 "new dependencies
  optimized" → "reloading" 로그). 이 새로고침이 위 SPA 폴백 문제와
  맞물리면 legacy 화면으로 떨어진다 — dev 전용 현상이고 프로덕션 빌드
  (`npm run build`)에서는 발생하지 않는다(정적 분석으로 미리 청크가
  잡힘). 당황하지 말고 `/preview/`로 다시 들어가서 한 번 더 클릭하면
  된다.
- `sw.js`를 고칠 땐 **레포 루트의 `sw.js`를 고칠 것** — `public/sw.js`,
  `www/sw.js`는 빌드 산출물이라 직접 고쳐도 다음 빌드에서 덮어써진다.

## 참고: 패리티 체크리스트 전문 위치

`docs/DEVELOPMENT_PLAN.md` §10.3 (498~520행 부근). 다음 세션에서 진행 상황을
재확인할 때는 이 섹션을 다시 읽고 위 목록과 대조할 것.
