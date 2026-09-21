/**
 * 모더레이션 점수 → 게시 상태 결정 (06-community.md §5.1)
 *
 * 점수 ≥ 0.85  → 차단(글은 'removed', 댓글도 'removed' — 댓글엔 pending 상태가 없음)
 * 0.60 ~ 0.85  → 글은 'pending_review' + 운영자 큐, 댓글은 스키마에 pending이
 *               없어 안전하게 'removed'로 처리한다(문서에 댓글 임계치가 따로
 *               명시돼 있지 않아 이 라운드에서 정한 해석 — 위 스키마 제약 때문).
 * < 0.60       → 'published'
 *
 * **fail closed**: 분류기(텍스트/이미지)가 응답하지 않으면 결정론적 신호
 * (금칙어·스팸)만으로 0.85 이상이 아닌 한 무조건 "차단 가능성 있음" 취급으로
 * 떨어진다 — 절대 곧바로 published로 통과시키지 않는다.
 */
export type ModerationKind = 'post' | 'comment';

export interface ModerationSignals {
  /** 금칙어 사전 매치(항상 즉시 계산 가능, 네트워크 불필요) */
  badword: number;
  /** 스팸 휴리스틱(항상 즉시 계산 가능) */
  spam: number;
  /** 텍스트 분류기 점수. 실패/타임아웃이면 null(fail closed) */
  textClassifier: number | null;
  /** 이미지 분류기 최댓값. 이미지가 없으면 0, 실패/타임아웃이면 null(fail closed) */
  imageClassifier: number | null;
}

export interface ModerationDecision {
  status: 'published' | 'pending_review' | 'removed';
  score: number;
  failClosed: boolean;
}

export function decideStatus(kind: ModerationKind, signals: ModerationSignals): ModerationDecision {
  const deterministic = Math.max(signals.badword, signals.spam);

  if (deterministic >= 0.85) {
    return { status: 'removed', score: deterministic, failClosed: false };
  }

  const { textClassifier, imageClassifier } = signals;
  if (textClassifier == null || imageClassifier == null) {
    const partial = Math.max(deterministic, textClassifier ?? 0, imageClassifier ?? 0);
    return {
      status: kind === 'post' ? 'pending_review' : 'removed',
      score: partial,
      failClosed: true,
    };
  }

  const overall = Math.max(deterministic, textClassifier, imageClassifier);
  if (overall >= 0.85) return { status: 'removed', score: overall, failClosed: false };
  if (overall >= 0.6) {
    return { status: kind === 'post' ? 'pending_review' : 'removed', score: overall, failClosed: false };
  }
  return { status: 'published', score: overall, failClosed: false };
}
