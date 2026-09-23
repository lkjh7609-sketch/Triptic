-- 0025_ai_recommendation_cache.sql
-- AI 추천 결과 위치 기반 캐싱 테이블 (카테고리 개편 반영: hotel -> culture)

create table if not exists public.ai_recommendation_cache (
  id            bigserial primary key,
  place_name    text not null,
  city          text not null,
  category      text not null,
  lat           double precision,
  lng           double precision,
  recommendations jsonb not null,
  provider      text not null default 'DeepSeek',
  model_used    text not null default 'deepseek-flash',
  hit_count     int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '90 days') -- 요청사항 반영 (만료 길게)
);

-- 카테고리 제약조건 추가
alter table public.ai_recommendation_cache 
  add constraint ai_rec_category_check 
  check (category in ('restaurant', 'cafe', 'culture', 'spot'));

-- 도시 + 카테고리 기반 빠른 조회를 위한 인덱스
create index if not exists idx_ai_rec_cache_location 
  on public.ai_recommendation_cache(city, category);

-- 만료일자 인덱스
create index if not exists idx_ai_rec_cache_expires 
  on public.ai_recommendation_cache(expires_at);

-- RLS 활성화
alter table public.ai_recommendation_cache enable row level security;

-- 읽기 권한
create policy "Anyone can read cache"
  on public.ai_recommendation_cache for select
  using (true);
