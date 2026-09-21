-- ============================================================================
-- 0017: 알림 설정 저장 컬럼 (설정 탭 §5 표 "알림" 섹션)
-- profiles는 이미 legacy(2.x)에서 own-row RLS(select/insert/update)가 적용돼
-- 있어(0000_reconcile_legacy_schema.sql에서 rename만 함, RLS는 원래부터 존재)
-- 별도 정책 추가가 필요 없다.
--
-- 실제 발송 로직(Phase 6, 푸시 알림)은 아직 없다 — 이 컬럼은 사용자의 알림
-- 설정 "값"만 저장해 두고, 발송 파이프라인이 생기면 그때 참조한다
-- (entitlements.can() 배선과 같은 패턴: 값은 실제로 저장되지만 소비자는 아직 없음).
-- ============================================================================

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default jsonb_build_object(
    'preDeparture', true,
    'flightChanges', true,
    'communityReplies', true,
    'marketing', false
  );
