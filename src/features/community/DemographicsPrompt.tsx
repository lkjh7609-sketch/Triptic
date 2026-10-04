import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { useProfile, useUpdateProfile, profileQueryKey } from '@/shared/hooks/useProfile';
import { useSession } from '@/shared/hooks/useSession';
import { skipMyDemographics, type MemberAgeBand, type MemberGender } from '@/shared/api/profileService';
import { captureError } from '@/shared/monitoring';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import { DemographicsFields } from './DemographicsFields';
import styles from './DemographicsPrompt.module.css';

/** 몇 번까지 다시 묻는가 — 처음 한 번 + "나중에"를 누르면 한 번 더 */
export const MAX_DEMOGRAPHICS_SKIPS = 2;

/** 이 프로필에 팝업을 띄울지 — 둘 중 하나라도 비어 있고, 아직 두 번 넘게 건너뛰지 않았을 때 */
export function shouldAskDemographics(profile: { gender: unknown; age_band: unknown; demographics_skips: number } | undefined): boolean {
  if (!profile) return false;
  if (profile.gender && profile.age_band) return false;
  return (profile.demographics_skips ?? 0) < MAX_DEMOGRAPHICS_SKIPS;
}

/**
 * 커뮤니티에 처음 들어올 때 한 번 뜨는 팝업 — 나잇대·성별(선택). 동행 모집글·지원 화면에 표기하려고 받는다고 밝힌다.
 * 서버(profiles.gender/age_band/demographics_skips)를 기준으로 해서 다른 기기·기존 회원에게도 한 번씩 뜬다.
 */
export function DemographicsPrompt() {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const queryClient = useQueryClient();
  const [gender, setGender] = useState<MemberGender | null>(null);
  const [ageBand, setAgeBand] = useState<MemberAgeBand | null>(null);
  const [error, setError] = useState(false);
  const [closed, setClosed] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(() => void skip());

  if (!user || closed || !shouldAskDemographics(profile)) return null;

  async function skip() {
    setClosed(true);
    try {
      await skipMyDemographics();
      if (user) await queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
    } catch (err) {
      captureError(err, { context: 'skipDemographics' });
    }
  }

  async function save() {
    setError(false);
    try {
      await update.mutateAsync({ gender, age_band: ageBand });
      setClosed(true);
    } catch (err) {
      captureError(err, { context: 'saveDemographics' });
      setError(true);
    }
  }

  const empty = !gender && !ageBand;

  return (
    <div className={modalStyles.overlay}>
      <div ref={trapRef} className={modalStyles.sheet} role="dialog" aria-modal="true" aria-label={t('demographics.title')} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>{t('demographics.title')}</h2>
        <p className={styles.reason}>{t('demographics.reason')}</p>
        <DemographicsFields gender={gender} ageBand={ageBand} onChange={(next) => { setGender(next.gender); setAgeBand(next.ageBand); }} />
        {error ? (
          <p className={styles.error} role="alert">
            {t('demographics.saveError')}
          </p>
        ) : null}
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={() => void skip()}>
            {t('demographics.later')}
          </button>
          <button type="button" className={modalStyles.primary} disabled={empty || update.isPending} onClick={() => void save()}>
            {t('demographics.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
