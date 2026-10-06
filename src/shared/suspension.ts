/** 이용 정지 사유 코드 — api/_lib/suspension.js·0095 표의 check 제약과 같은 목록(문구는 common.json suspension.reasons) */
export const SUSPENSION_REASONS = ['abuse', 'spam', 'fraud', 'privacy', 'illegal', 'impersonation', 'terms', 'custom'] as const;
/** '직접 입력' 사유의 글자 수 한도 — api/_lib/suspension.js·0096 check 제약과 같다 */
export const SUSPENSION_REASON_TEXT_MAX = 200;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];
