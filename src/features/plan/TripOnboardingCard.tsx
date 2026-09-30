import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { track } from '@/shared/monitoring';
import { useDocumentsList } from '@/features/documents/useDocuments';
import { useTripMembers } from './hooks/useTripMembers';
import styles from './TripOnboardingCard.module.css';

export type OnboardingStep = 'place' | 'document' | 'invite';

const STEPS: readonly OnboardingStep[] = ['place', 'document', 'invite'];

function dismissKey(tripId: string) {
  return `triptic-onboarding-dismissed:${tripId}`;
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // 저장이 막힌 브라우저 — 이번 접속 동안만 닫아 둔다
  }
}

/** 이 여행에 공유 링크가 만들어진 적이 있는지(만든 것만으로도 "초대해 봤다") */
function useHasShareLink(tripId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['share-link-exists', tripId],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await getSupabaseClient().from('shared_trips').select('share_code').eq('trip_id', tripId).limit(1).maybeSingle();
      return !!data;
    },
  });
}

interface TripOnboardingCardProps {
  tripId: string;
  /** 일정에 장소가 하나라도 있는가 — 화면이 이미 들고 있는 일정에서 계산해 넘긴다 */
  hasPlace: boolean;
  /** 로그인 전 임시 여행 — 서류·초대는 로그인이 필요해서 누르면 로그인 안내(onLocked) */
  isDraft: boolean;
  onAddPlace: () => void;
  onUploadDocument: () => void;
  onInvite: () => void;
  onLocked: () => void;
}

/**
 * 첫 여행 시작 안내 — 장소 추가 · 예약 확인서 올리기 · 같이 갈 사람 초대, 3단계와 진행 표시.
 * 완료 여부는 이 기기에 적어 둔 값이 아니라 실제 데이터(일정·서류·멤버·공유 링크)에서 계산한다 — 다른 기기에서
 * 해도, 이미 해 둔 여행에서도 맞다. 기기에는 "닫았다"는 선택만 저장한다. 셋 다 끝나면 저절로 사라진다.
 * 샘플 여행에는 그리지 않는다(TripDetailScreen).
 */
export function TripOnboardingCard({ tripId, hasPlace, isDraft, onAddPlace, onUploadDocument, onInvite, onLocked }: TripOnboardingCardProps) {
  const { t } = useTranslation('plan');
  const [dismissed, setDismissed] = useState(() => readFlag(dismissKey(tripId)));
  const documents = useDocumentsList(isDraft ? undefined : tripId);
  const members = useTripMembers(isDraft ? [] : [tripId]);
  const shareLink = useHasShareLink(tripId, !isDraft);

  const loaded = isDraft || (documents.isSuccess && members.isSuccess && shareLink.isSuccess);
  const done: Record<OnboardingStep, boolean> = {
    place: hasPlace,
    document: (documents.data?.length ?? 0) > 0,
    invite: (members.data?.[tripId]?.length ?? 0) > 1 || shareLink.data === true,
  };
  const doneCount = STEPS.filter((s) => done[s]).length;

  // 이 화면을 보는 동안 "아직 → 끝"으로 바뀐 단계만 분석 이벤트로 보낸다(이미 해 둔 옛 여행을 열 때마다 쏘지 않게)
  const seenPending = useRef(new Set<OnboardingStep>());
  useEffect(() => {
    if (!loaded) return;
    for (const step of STEPS) {
      if (!done[step]) seenPending.current.add(step);
      else if (seenPending.current.delete(step)) track('onboarding_step_done', { step });
    }
  }, [loaded, done.place, done.document, done.invite]); // eslint-disable-line react-hooks/exhaustive-deps -- done의 세 값이 바뀔 때만

  if (dismissed || !loaded || doneCount === STEPS.length) return null;

  const actions: Record<OnboardingStep, () => void> = {
    place: onAddPlace,
    document: isDraft ? onLocked : onUploadDocument,
    invite: isDraft ? onLocked : onInvite,
  };

  return (
    <section className={styles.card} aria-label={t('onboarding.title')}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>{t('onboarding.title')}</h2>
          <span className={styles.progressLabel}>{t('onboarding.progress', { done: doneCount, total: STEPS.length })}</span>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label={t('onboarding.dismiss')}
          onClick={() => {
            writeFlag(dismissKey(tripId));
            setDismissed(true);
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={doneCount}>
        <span className={styles.barFill} style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
      </div>
      <ul className={styles.steps}>
        {STEPS.map((step) => (
          <li key={step} className={styles.step}>
            <span className={done[step] ? styles.checkDone : styles.check} aria-hidden="true">
              {done[step] ? <Check size={14} strokeWidth={3} /> : null}
            </span>
            <span className={done[step] ? styles.stepTextDone : styles.stepText}>{t(`onboarding.step.${step}`)}</span>
            {done[step] ? null : (
              <button type="button" className={styles.action} onClick={actions[step]}>
                {t(`onboarding.action.${step}`)}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
