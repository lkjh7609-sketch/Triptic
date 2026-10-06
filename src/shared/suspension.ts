/** 이용 정지 사유 코드 — api/_lib/suspension.js·0095 표의 check 제약과 같은 목록(문구는 common.json suspension.reasons) */
export const SUSPENSION_REASONS = ['abuse', 'spam', 'fraud', 'privacy', 'illegal', 'impersonation', 'terms'] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];
