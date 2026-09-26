import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Minus, Plus } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { CalendarRangePicker } from '@/shared/ui/CalendarRangePicker';
import { useDestinations } from './hooks/useDestinations';
import { useCreateCompanionPost } from './hooks/useCompanionPosts';
import composeStyles from './ComposePostScreen.module.css';
import styles from './CompanionComposeScreen.module.css';

const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 2000;
const MIN_GROUP_SIZE = 2;
const MAX_GROUP_SIZE = 20;

/** 동행 모집글 작성 — moderate-content(kind: 'companion_post')를 거친다(0032) */
export function CompanionComposeScreen() {
  const { t } = useTranslation(['community', 'common']);
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: destinations } = useDestinations();
  const createCompanionPost = useCreateCompanionPost();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [groupSize, setGroupSize] = useState(2);
  const [showCalendar, setShowCalendar] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    trackScreenView('community_companion_compose');
  }, []);

  if (!user) {
    return (
      <div className={composeStyles.wrap}>
        <p className={composeStyles.hint}>{t('compose.loginRequired')}</p>
      </div>
    );
  }

  async function handleSubmit() {
    setStatusMessage(null);
    if (!title.trim()) {
      setStatusMessage({ type: 'error', text: t('companion.compose.titleRequiredError') });
      return;
    }
    if (!body.trim()) {
      setStatusMessage({ type: 'error', text: t('compose.bodyRequiredError') });
      return;
    }
    if (!startDateStr || !endDateStr) {
      setStatusMessage({ type: 'error', text: t('companion.compose.dateRequiredError') });
      return;
    }
    try {
      const result = await createCompanionPost.mutateAsync({
        destinationId: destinationId || null,
        title: title.trim(),
        body: body.trim(),
        startDate: startDateStr,
        endDate: endDateStr,
        groupSize,
        userId: user!.id,
      });
      if (result.status === 'removed') {
        setStatusMessage({ type: 'error', text: t('compose.moderationBlockedError') });
        return;
      }
      navigate(result.status === 'pending_review' ? '/community' : `/community/companion/${result.id}`);
    } catch (err) {
      captureError(err, { context: 'createCompanionPost' });
      setStatusMessage({ type: 'error', text: t('compose.submitError') });
    }
  }

  return (
    <div className={composeStyles.wrap}>
      <div className={composeStyles.topBar}>
        <button type="button" className={composeStyles.cancelBtn} onClick={() => navigate(-1)}>
          {t('action.cancel', { ns: 'common' })}
        </button>
        <h1 className={composeStyles.title}>{t('companion.compose.title')}</h1>
        <button type="button" className={composeStyles.submitBtn} disabled={createCompanionPost.isPending} onClick={handleSubmit}>
          {createCompanionPost.isPending ? t('compose.submitting') : t('compose.submit')}
        </button>
      </div>

      <div className={composeStyles.field}>
        <label className={composeStyles.label}>{t('companion.compose.titleLabel')}</label>
        <input
          type="text"
          className={styles.titleInput}
          placeholder={t('companion.compose.titlePlaceholder')}
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className={composeStyles.field}>
        <textarea
          className={composeStyles.bodyInput}
          placeholder={t('companion.compose.bodyPlaceholder')}
          value={body}
          maxLength={MAX_BODY_LENGTH}
          onChange={(e) => setBody(e.target.value)}
        />
        <span className={composeStyles.counter}>
          {body.length}/{MAX_BODY_LENGTH}
        </span>
      </div>

      <div className={composeStyles.field}>
        <label className={composeStyles.label}>{t('companion.compose.destinationLabel')}</label>
        <select className={composeStyles.select} value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
          <option value="">{t('companion.compose.destinationAny')}</option>
          {(destinations ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className={composeStyles.field}>
        <label className={composeStyles.label}>{t('companion.compose.dateLabel')}</label>
        <button type="button" className={composeStyles.select} onClick={() => setShowCalendar(true)}>
          {startDateStr && endDateStr ? `${startDateStr} ~ ${endDateStr}` : t('companion.compose.datePlaceholder')}
        </button>
      </div>

      <div className={composeStyles.field}>
        <label className={composeStyles.label}>{t('companion.compose.groupSizeLabel')}</label>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepperBtn}
            disabled={groupSize <= MIN_GROUP_SIZE}
            onClick={() => setGroupSize((n) => Math.max(MIN_GROUP_SIZE, n - 1))}
            aria-label={t('companion.compose.groupSizeDecrease')}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <span className={styles.stepperValue}>{t('companion.compose.groupSizeValue', { count: groupSize })}</span>
          <button
            type="button"
            className={styles.stepperBtn}
            disabled={groupSize >= MAX_GROUP_SIZE}
            onClick={() => setGroupSize((n) => Math.min(MAX_GROUP_SIZE, n + 1))}
            aria-label={t('companion.compose.groupSizeIncrease')}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {statusMessage ? (
        <p className={statusMessage.type === 'error' ? composeStyles.errorMessage : composeStyles.infoMessage}>
          {statusMessage.text}
        </p>
      ) : null}

      {showCalendar ? (
        <div className={styles.calendarOverlay} onClick={() => setShowCalendar(false)}>
          <div className={styles.calendarSheet} onClick={(e) => e.stopPropagation()}>
            <CalendarRangePicker
              startDate={startDateStr ? new Date(startDateStr) : null}
              endDate={endDateStr ? new Date(endDateStr) : null}
              onChange={(start, end) => {
                setStartDateStr(start ? format(start, 'yyyy-MM-dd') : '');
                setEndDateStr(end ? format(end, 'yyyy-MM-dd') : '');
                if (start && end) setTimeout(() => setShowCalendar(false), 300);
              }}
            />
            <div className={styles.calendarActions}>
              <button type="button" className={composeStyles.submitBtn} onClick={() => setShowCalendar(false)}>
                {t('action.confirm', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
