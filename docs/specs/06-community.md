# 06. 커뮤니티 & 콘텐츠 모더레이션

> ⚠️ **읽기 전에**: 이 문서의 §5(안전장치)는 선택 사항이 아니다. App Store 심사 가이드라인 1.2를 충족하지 못하면 앱 전체가 리젝된다. **기능과 모더레이션은 같은 PR에서 함께 머지한다.**

---

## 1. 구조

```
커뮤니티 탭
├── 피드 (전체 / 구독)
├── 여행지 채널 (도쿄, 오사카, 방콕, 파리 …)
│   ├── 채널 정보 (통화·시차·최적 시즌·평년 기온)
│   └── 채널 글 목록
├── 글 상세 (본문 · 이미지 · 댓글 · 좋아요)
├── 글쓰기
└── 사용자 프로필
```

---

## 2. 여행지 (Destination)

**사용자가 임의로 만들 수 없다.** 큐레이션된 목록만 존재한다.

- 이유 1: 중복 채널(도쿄/동경/Tokyo)이 생기면 커뮤니티가 파편화된다
- 이유 2: 채널 자체가 UGC가 되면 모더레이션 대상이 하나 더 늘어난다

### 2.1 초기 시드 (50곳)

| 권역 | 여행지 |
|---|---|
| 일본 (8) | 도쿄, 오사카, 교토, 후쿠오카, 삿포로, 오키나와, 나고야, 벳푸 |
| 동남아 (10) | 방콕, 다낭, 나트랑, 호치민, 하노이, 싱가포르, 쿠알라룸푸르, 발리, 세부, 보라카이 |
| 중화권 (6) | 타이페이, 가오슝, 홍콩, 마카오, 상하이, 베이징 |
| 국내 (8) | 제주, 부산, 강릉, 여수, 경주, 전주, 속초, 서울 |
| 유럽 (10) | 파리, 런던, 로마, 바르셀로나, 프라하, 빈, 취리히, 암스테르담, 리스본, 이스탄불 |
| 미주·오세아니아 (8) | 뉴욕, LA, 하와이, 밴쿠버, 시드니, 괌, 사이판, 샌프란시스코 |

추가는 관리자 콘솔에서만. 사용자 요청은 "여행지 추가 요청" 폼으로 받는다.

---

## 3. 스키마

```sql
create table public.destinations (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,          -- 'tokyo'
  country_code char(2) not null,
  lat          double precision not null,
  lng          double precision not null,
  timezone     text not null,
  currency     text,
  cover_url    text,
  is_featured  boolean not null default false,
  sort_order   int not null default 0,
  post_count   int not null default 0,        -- 비정규화 (트리거로 갱신)
  created_at   timestamptz not null default now()
);

create table public.destination_translations (
  destination_id uuid not null references public.destinations(id) on delete cascade,
  locale         text not null check (locale in ('ko','en','zh-CN')),
  name           text not null,
  description    text,
  primary key (destination_id, locale)
);

create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations(id) on delete restrict,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 2000),
  language       text,                          -- 자동 감지. 번역 버튼 노출 판단용
  trip_id        uuid references public.trips(id) on delete set null,  -- 일정 첨부(선택)
  status         text not null default 'published'
                 check (status in ('published','pending_review','hidden','removed')),
  like_count     int not null default 0,
  comment_count  int not null default 0,
  report_count   int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index on public.posts (destination_id, created_at desc)
  where status = 'published' and deleted_at is null;
create index on public.posts (author_id, created_at desc);

create table public.post_images (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  width      int, height int,
  position   int not null default 0,
  status     text not null default 'published'
             check (status in ('published','pending_review','removed'))
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.comments(id) on delete cascade,  -- 1단계만
  body       text not null check (char_length(body) between 1 and 500),
  status     text not null default 'published'
             check (status in ('published','hidden','removed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.comments (post_id, created_at);

create table public.reactions (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table public.destination_follows (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  destination_id uuid not null references public.destinations(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, destination_id)
);

-- ── 안전장치 ────────────────────────────────────────────────
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','user','image')),
  target_id   uuid not null,
  reason      text not null check (reason in
                ('spam','harassment','hate','sexual','violence','illegal',
                 'misinformation','impersonation','other')),
  detail      text check (char_length(detail) <= 500),
  status      text not null default 'open'
              check (status in ('open','reviewing','actioned','dismissed')),
  resolved_at timestamptz,
  resolver_id uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  -- 같은 대상을 한 사람이 여러 번 신고하지 못하게
  unique (reporter_id, target_type, target_id)
);
create index on public.reports (status, created_at);

create table public.moderation_events (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id   uuid not null,
  action      text not null,      -- 'auto_blocked','auto_flagged','hidden','restored','removed'
  source      text not null,      -- 'classifier','report_threshold','moderator'
  score       numeric(4,3),
  categories  jsonb,
  actor_id    uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
```

---

## 4. RLS

```sql
alter table public.posts enable row level security;

-- 읽기: 게시 상태이고, 내가 차단한 사용자의 글이 아닐 것
create policy "read published posts"
  on public.posts for select
  using (
    status = 'published'
    and deleted_at is null
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = posts.author_id
    )
    -- 나를 차단한 사람의 글도 숨긴다 (양방향)
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = posts.author_id and b.blocked_id = auth.uid()
    )
  );

-- 본인 글은 상태와 무관하게 볼 수 있다 (숨김 처리된 이유를 알아야 하므로)
create policy "read own posts"
  on public.posts for select using (author_id = auth.uid());

create policy "insert own posts"
  on public.posts for insert with check (author_id = auth.uid());

create policy "update own posts"
  on public.posts for update using (author_id = auth.uid())
  with check (author_id = auth.uid() and status = 'published');

create policy "soft delete own posts"
  on public.posts for delete using (author_id = auth.uid());
```

동일한 차단 조건을 `comments`에도 적용한다.

> **차단은 "흐리게 보이기"가 아니라 "존재하지 않는 것처럼"이어야 한다.** RLS 레벨에서 거르면 클라이언트 구현 실수로 새어 나갈 여지가 없다.

---

## 5. App Store 1.2 필수 안전장치 ⭐

Apple은 UGC 앱에 아래 네 가지를 요구하며, **심사 중 직접 테스트한다**. 2026년 2월 개정으로 적용 범위가 더 넓어졌다.

### 5.1 ① 유해 콘텐츠 사전 필터

게시 **전에** 자동 검사한다.

```
사용자 [게시] 탭
   ↓
moderate-content Edge Function
   ├─ 텍스트 분류 (Gemini safety 또는 전용 분류 모델)
   │    카테고리: 성적 · 폭력 · 혐오 · 괴롭힘 · 자해 · 불법 · 스팸
   ├─ 금칙어 사전 (ko/en/zh 각각. 한국어 초성·자소분리 우회 대응)
   ├─ 이미지 분류 (업로드된 모든 이미지)
   └─ 스팸 휴리스틱 (동일 문구 반복, 외부 링크 과다, 연락처 노출)
   ↓
점수 ≥ 0.85  → 게시 차단 + 사유 안내 (status='removed', 저장은 하되 비공개)
0.60 ~ 0.85  → 게시하되 status='pending_review' + 운영자 큐
< 0.60       → status='published'
```

**응답 시간 예산 3초.** 분류기가 응답하지 않으면 `pending_review`로 보낸다 — **실패 시 통과시키지 않는다(fail closed).**

한국어 우회 패턴 대응:
```ts
// 자소 분리("ㅅㅂ"), 초성, 특수문자 삽입("씨1발"), 로마자 표기를 정규화 후 검사
normalizeKo(text)  // NFC 정규화 → 자모 결합 → 특수문자 제거 → 유사자 치환
```

### 5.2 ② 신고 기능

- **모든** 글·댓글·이미지·사용자에 `⋮` → "신고" 노출
- 사유 선택(9종) + 상세 설명(선택)
- 신고 즉시: 신고자에게는 해당 콘텐츠가 숨겨진다
- **자동 숨김 임계치**: 서로 다른 사용자 3명 이상이 신고 → `status='hidden'` + 운영자 큐 상단
- 처리 결과를 신고자에게 알림으로 통보

### 5.3 ③ 사용자 차단

- 프로필 또는 글 `⋮` → "차단"
- 차단 즉시 양방향으로 콘텐츠가 사라진다 (RLS에서 처리)
- 설정 > 차단한 사용자 목록에서 해제 가능

### 5.4 ④ 개발자 연락처 공개

- 설정 > 문의하기에 **이메일 주소를 실제로 표시**한다 (폼만 두지 말 것)
- App Store Connect의 지원 URL에도 동일 정보
- 개인정보처리방침·이용약관에 운영자 정보 명시

### 5.5 ⑤ 이용약관(EULA) 문구

App Store는 UGC 앱에 **"불쾌한 콘텐츠와 학대 행위에 대한 무관용 원칙"** 을 약관에 명시할 것을 요구한다. 3개 언어 모두에 포함한다.

> 예시(한국어): "본 서비스는 불쾌감을 주는 콘텐츠 및 이용자에 대한 학대 행위에 대해 무관용 원칙을 적용합니다. 신고된 콘텐츠는 24시간 이내에 검토되며, 위반 시 콘텐츠 삭제 및 계정 정지 조치가 이루어집니다."

### 5.6 ⑥ 24시간 처리 SLA

- 운영자 큐를 매일 확인한다 (초기에는 수동으로 충분하다)
- 신고 접수 → 24시간 내 검토 → 조치 또는 기각
- 처리 시간을 `reports.resolved_at - created_at`으로 계측하고 대시보드에 표시

### 5.7 심사 대응 준비물

제출 시 App Review 노트에 반드시 적는다:

```
Test account: review@triptic.my / (password)

Content moderation:
- All posts and images are automatically screened before publishing.
- To test reporting: open any post → "⋮" (top-right) → Report.
- To test blocking: open any user profile → "⋮" → Block User.
- Blocked users' content disappears immediately from the feed.
- Support contact is listed at Settings → Contact Us.
- Reports are reviewed within 24 hours by our operations team.
```

---

## 6. 피드 알고리즘 (단순하게 시작)

**3.0에서는 추천 알고리즘을 만들지 않는다.** 콘텐츠가 부족한 초기에는 최신순이 가장 낫다.

| 탭 | 정렬 |
|---|---|
| 전체 | `created_at desc` (커서 페이지네이션) |
| 구독 | 내가 팔로우한 여행지 글만, `created_at desc` |
| 채널 내부 | `created_at desc` + 상단에 공지 고정 |

커서: `(created_at, id)` 복합. `offset`은 쓰지 않는다 (중복·누락 발생).

```sql
select * from public.posts
where destination_id = $1
  and (created_at, id) < ($cursor_time, $cursor_id)
order by created_at desc, id desc
limit 20;
```

인기순·추천은 일간 게시물이 100건을 넘어선 뒤에 도입한다.

---

## 7. 이미지 처리

| 단계 | 처리 |
|---|---|
| 선택 | 최대 10장 |
| 클라이언트 | 장변 1600px 리사이즈, WebP 변환, **EXIF 전체 제거 (GPS 포함)** |
| 업로드 | Storage `post-images` 버킷 (공개 읽기, 인증 쓰기) |
| 서버 | 이미지 모더레이션 → 통과 시 `status='published'` |
| 표시 | 썸네일 400px / 원본은 탭 시 로드 |

> EXIF GPS 제거는 **사용자 안전 문제**다. 집 근처에서 찍은 사진의 좌표가 그대로 올라가면 주소가 노출된다.

---

## 8. 번역

원문 언어(`posts.language`)가 사용자 로케일과 다르면 "번역 보기" 버튼을 노출한다.

```
POST /api/translate
{ "text": "...", "source": "ko", "target": "en" }
```

- 번역 결과는 클라이언트 메모리에만 (DB 저장 안 함 — 저장하면 원문 수정 시 불일치)
- 번역문에는 **"자동 번역됨"** 라벨을 항상 표시
- 언어 감지는 게시 시점에 1회 수행해 `posts.language`에 저장

---

## 9. 운영 콘솔 (최소 기능)

별도 앱을 만들지 않고, 관리자 계정으로만 접근 가능한 웹 페이지(`/admin`)로 시작한다.

| 화면 | 기능 |
|---|---|
| 신고 큐 | 미처리 신고 목록, 콘텐츠 미리보기, [삭제] [기각] [계정 정지] |
| 자동 플래그 큐 | `pending_review` 상태 콘텐츠 |
| 사용자 | 검색, 정지 이력, 신고 이력 |
| 여행지 | 추가·수정·번역 관리 |

접근 제어: `profiles.role = 'admin'` 컬럼 추가 + RLS + Supabase Auth MFA 필수.

---

## 10. 알림

| 이벤트 | 알림 |
|---|---|
| 내 글에 댓글 | 푸시 + 인앱 |
| 내 댓글에 답글 | 푸시 + 인앱 |
| 내 글 좋아요 | 인앱만 (푸시는 피로도가 높다) |
| 내 콘텐츠 숨김/삭제 | 푸시 + 사유 안내 |
| 신고 처리 완료 | 인앱 |

모든 알림은 설정에서 개별로 끌 수 있어야 한다.

---

## 11. 테스트

```ts
describe('community safety', () => {
  it('차단한 사용자의 글은 피드 쿼리 결과에 포함되지 않는다', ...);
  it('나를 차단한 사용자의 글도 보이지 않는다', ...);
  it('유해 텍스트는 게시 전에 차단된다', ...);
  it('자소 분리 우회 표현도 걸러낸다', ...);        // 'ㅅㅂ', '씨1발'
  it('분류기 타임아웃 시 pending_review로 간다 (통과 아님)', ...);
  it('서로 다른 3명이 신고하면 자동 숨김된다', ...);
  it('같은 사람이 같은 글을 두 번 신고할 수 없다', ...);
  it('업로드 이미지의 EXIF GPS가 제거된다', ...);
  it('본인 글은 hidden 상태여도 본인에게는 보인다', ...);
});
```

E2E(Playwright)에서 **신고 → 숨김 → 운영자 처리** 전 과정을 1개 시나리오로 반드시 커버한다. 심사 리젝을 막는 가장 중요한 테스트다.
