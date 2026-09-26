-- 0025_ai_recommendation_cache.sql
-- AI 응답 캐시 (api/recommend.js 주변 장소 추천, api/cityDesc.js 도시 소개).
-- 서버(service_role)만 읽고 쓴다 — 클라이언트는 항상 /api/* 를 거친다.
--
-- ⚠️ 처음 커밋된 버전(category에 'all'/'city_desc'가 빠진 CHECK, 언어·고유 키 없음)은
-- 프로덕션에 적용되지 않은 채 고쳐졌다. 그 버전 기준 코드는 캐시 쓰기가 전부 실패했다.

create table if not exists public.ai_recommendation_cache (
  id          bigserial primary key,
  kind        text not null check (kind in ('nearby', 'city_desc')),
  city_key    text not null,                 -- 정규화된 도시명(소문자, 공백 정리)
  place_key   text not null default '',      -- 정규화된 기준 장소명(city_desc는 '')
  category    text not null default 'all'
              check (category in ('all', 'restaurant', 'cafe', 'culture', 'spot')),
  locale      text not null default 'ko'
              check (locale in ('ko', 'en', 'zh-TW', 'ja')),
  payload     jsonb not null,               -- { recommendations: [...] } 또는 { description }
  provider    text,
  model_used  text,
  hit_count   int not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '90 days')
);

create unique index if not exists ai_rec_cache_key
  on public.ai_recommendation_cache (kind, city_key, place_key, category, locale);

create index if not exists ai_rec_cache_expires
  on public.ai_recommendation_cache (expires_at);

-- RLS: 정책 없음 = anon/authenticated 전부 차단, service_role만 접근
alter table public.ai_recommendation_cache enable row level security;
