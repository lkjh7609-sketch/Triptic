import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, MapPin, Minus, Plus, TriangleAlert } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
import { useDestinations } from './hooks/useDestinations';
import { useCreateCompanionPost } from './hooks/useCompanionPosts';
import { DestinationPickerModal } from './DestinationPickerModal';
import { DateRangeDialog } from './DateRangeDialog';
import { CompanionPrefsFields } from './CompanionPrefsFields';
import { EMPTY_PREFS, type CompanionPrefs } from './companionPrefs';
import {
  MAX_GROUP_SIZE,
  MIN_GROUP_SIZE,
  clearCompanionDraft,
  isEmptyCompanionDraft,
  readCompanionDraft,
  writeCompanionDraft,
  type CompanionDraft,
} from './companionDraft';
import { formatShortDate, parseYmd, toYmd, tripLength, type DateRangeValue } from './dateRangeCalendar';
import type { Destination } from './types';
import styles from './CompanionComposeScreen.module.css';

const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 2000;
const AUTOSAVE_DELAY_MS = 700;
const QUICK_PICK_COUNT = 6;

/**
 * 동행 구하기 — Stitch 시안(Stitch/community/Companions)대로: 제목·상세 내용 → 여행 정보(여행지·일정·인원) → 선호 조건.
 * 제출은 moderate-content Edge Function(kind: 'companion_post')을 거친다(0032).
 * 여행지는 선택 사항("어디든 상관없어요"), 일정은 날짜를 고르거나 "날짜 미정 / 협의 가능"을 고른다(0072).
 * 쓰는 내용은 이 기기에 자동 임시저장되고(companionDraft.ts) 다시 열면 이어 쓸지 묻는다.
 * 모바일은 하단 고정 "동행 모집글 게시하기" 버튼, PC(1024px~)는 위쪽 줄과 맨 아래에 게시 버튼이 있다.
 */
export function CompanionComposeScreen() {
  const { t } = useTranslation('community');
  const { user } = useSession();
  if (!user) {
    return (
      <div className={styles.page}>
        <p className={styles.loginHint}>{t('compose.loginRequired')}</p>
      </div>
    );
  }
  // 사용자가 정해진 뒤에 그리고, 사용자가 바뀌면 처음부터 다시(임시저장도 사용자별)
  return <CompanionComposeForm key={user.id} userId={user.id} />;
}

function CompanionComposeForm({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation(['community', 'common']);
  const locale = i18n.language;
  const navigate = useNavigate();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { data: destinations } = useDestinations();
  const [searchParams] = useSearchParams();
  const initialDestSlug = searchParams.get('destination');
  const createCompanionPost = useCreateCompanionPost();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [range, setRange] = useState<DateRangeValue>({ start: null, end: null, tbd: false });
  const [groupSize, setGroupSize] = useState(MIN_GROUP_SIZE);
  const [prefs, setPrefs] = useState<CompanionPrefs>(EMPTY_PREFS);
  const [showErrors, setShowErrors] = useState(false);
  // 제재로 막힌 글 — 같은 내용으로는 다시 게시할 수 없다(고치면 풀린다)
  const [blockedKey, setBlockedKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<'destination' | 'date' | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── 임시저장 ─────────────────────────────────────────────────────────────
  // 처음 열 때 저장된 글이 있으면 이어 쓸지 묻는다(답하기 전에는 자동 저장을 켜지 않아 이전 글을 덮어쓰지 않는다)
  const [pendingDraft, setPendingDraft] = useState<CompanionDraft | null>(() => readCompanionDraft(userId));
  const [autosaveReady, setAutosaveReady] = useState(() => pendingDraft === null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const publishedRef = useRef(false);

  useEffect(() => {
    trackScreenView('community_companion_compose');
  }, []);

  // ?destination=slug 로 들어오면 그 도시를 미리 고른다. 이어 쓰기를 고르면 임시저장 글의 도시가 우선한다
  useEffect(() => {
    if (!initialDestSlug || !destinations || destinationId) return;
    const d = destinations.find((x) => x.slug === initialDestSlug);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d) setDestinationId(d.id);
  }, [destinations, initialDestSlug, destinationId]);

  const selectedDestination = destinations?.find((d) => d.id === destinationId);
  const featured = useMemo(
    () => (destinations ?? []).filter((d) => d.is_featured).sort((a, b) => a.sort_order - b.sort_order).slice(0, QUICK_PICK_COUNT),
    [destinations],
  );
  const countryName = useCallback(
    (code: string) => {
      try {
        return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
      } catch {
        return code;
      }
    },
    [locale],
  );
  const destLabel = (d: Destination) => `${d.name}, ${countryName(d.country_code)}`;

  const current = useCallback(
    (): Omit<CompanionDraft, 'savedAt'> => ({
      title,
      body,
      destinationId,
      startDate: range.start,
      endDate: range.end,
      datesTbd: range.tbd,
      groupSize,
      prefs,
    }),
    [title, body, destinationId, range, groupSize, prefs],
  );

  // 쓰는 대로 잠깐 멈추면 저장한다
  useEffect(() => {
    if (!autosaveReady || publishedRef.current) return;
    const timer = window.setTimeout(() => {
      const saved = writeCompanionDraft(userId, current());
      setSavedAt(saved ? Date.now() : null);
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [userId, autosaveReady, current]);

  function resumeDraft() {
    if (!pendingDraft) return;
    setTitle(pendingDraft.title);
    setBody(pendingDraft.body);
    // 지금 없는 도시는 빼고 복구한다
    if (!destinations || pendingDraft.destinationId === '' || destinations.some((d) => d.id === pendingDraft.destinationId)) {
      setDestinationId(pendingDraft.destinationId);
    }
    // 이미 지난 날짜는 복구하지 않는다(다시 고르게)
    const today = toYmd(new Date());
    const stale = !!pendingDraft.startDate && pendingDraft.startDate < today && !pendingDraft.datesTbd;
    setRange(
      stale ? { start: null, end: null, tbd: false } : { start: pendingDraft.startDate, end: pendingDraft.endDate, tbd: pendingDraft.datesTbd },
    );
    setGroupSize(pendingDraft.groupSize);
    setPrefs(pendingDraft.prefs);
    setPendingDraft(null);
    setAutosaveReady(true);
  }

  function discardDraft() {
    clearCompanionDraft(userId);
    setPendingDraft(null);
    setAutosaveReady(true);
  }

  function saveNow() {
    const saved = writeCompanionDraft(userId, current());
    setSavedAt(saved ? Date.now() : null);
    if (saved) showToast(t('compose.draft.savedToast'), { tone: 'success' });
  }

  const hasContent = !isEmptyCompanionDraft(current());

  function handleCancel() {
    if (hasContent) setLeaveOpen(true);
    else navigate(-1);
  }

  function leaveWithDraft() {
    writeCompanionDraft(userId, current());
    navigate(-1);
  }

  // ── 게시 ────────────────────────────────────────────────────────────────
  const hasDates = !!range.start && !!range.end;
  const missingTitle = showErrors && !title.trim();
  const missingBody = showErrors && !body.trim();
  const missingDate = showErrors && !hasDates && !range.tbd;
  const anyMissing = !title.trim() || !body.trim() || (!hasDates && !range.tbd);
  const blocked = blockedKey !== null && blockedKey === `${title}\n${body}`;
  const publishDisabled = createCompanionPost.isPending || blocked;

  async function handlePublish() {
    setSubmitError(null);
    if (anyMissing) {
      setShowErrors(true);
      // 빨간 테두리·흔들림·포커스·스크롤은 flagInvalid가 한다(앱 공통 동작)
      flagInvalid(!title.trim() ? titleRef.current : !body.trim() ? bodyRef.current : dateRef.current);
      return;
    }
    try {
      const result = await createCompanionPost.mutateAsync({
        destinationId: destinationId || null,
        title: title.trim(),
        body: body.trim(),
        startDate: range.tbd ? null : range.start,
        endDate: range.tbd ? null : range.end,
        groupSize,
        userId,
        prefs,
      });
      if (result.status === 'removed') {
        setBlockedKey(`${title}\n${body}`);
        return;
      }
      publishedRef.current = true;
      clearCompanionDraft(userId);
      // 글쓰기 화면은 기록에서 바꿔치기 — 게시 뒤 뒤로가기가 작성 화면이 아니라 이전 화면으로 간다
      navigate(result.status === 'pending_review' ? '/community' : `/community/companion/${result.id}`, { replace: true });
    } catch (err) {
      captureError(err, { context: 'createCompanionPost' });
      setSubmitError(t('compose.submitError'));
    }
  }

  const publishLabel = createCompanionPost.isPending ? t('compose.submitting') : t('companion.compose.submit');

  // 일정 줄에 보이는 값
  const startDate = parseYmd(range.start);
  const endDate = parseYmd(range.end);
  let dateValue: string | null = null;
  if (range.tbd) {
    dateValue = t('companion.compose.dateTbdValue');
  } else if (startDate && endDate) {
    const { nights, days } = tripLength(startDate, endDate);
    const length = nights === 0 ? t('dateDialog.sameDay') : t('dateDialog.length', { nights, days });
    dateValue = `${formatShortDate(startDate, locale)} ~ ${formatShortDate(endDate, locale)} · ${length}`;
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topInner}>
          <button type="button" className={styles.cancelBtn} onClick={handleCancel}>
            {desktop ? <ChevronLeft size={18} aria-hidden="true" /> : null}
            {t('action.cancel', { ns: 'common' })}
          </button>
          <h1 className={styles.title}>{t('companion.compose.title')}</h1>
          <div className={styles.topActions}>
            {desktop && savedAt ? (
              <span className={styles.savedLabel}>
                <span className={styles.savedDot} aria-hidden="true" />
                {t('compose.draft.saved')}
              </span>
            ) : null}
            <button type="button" className={desktop ? styles.saveBtn : styles.saveText} onClick={saveNow}>
              {t('compose.draft.save')}
            </button>
            {desktop ? (
              <button type="button" className={styles.publishTop} disabled={publishDisabled} onClick={handlePublish}>
                {createCompanionPost.isPending ? t('compose.submitting') : t('compose.submit')}
                {createCompanionPost.isPending ? null : <ArrowRight size={16} aria-hidden="true" />}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {pendingDraft ? (
        <div className={styles.notice} role="status">
          <span className={styles.noticeText}>{t('compose.draft.resumeTitle')}</span>
          <span className={styles.noticeActions}>
            <button type="button" className={styles.noticePrimary} onClick={resumeDraft}>
              {t('compose.draft.resume')}
            </button>
            <button type="button" className={styles.noticeSecondary} onClick={discardDraft}>
              {t('compose.draft.fresh')}
            </button>
          </span>
        </div>
      ) : null}

      {blocked ? (
        <div className={styles.alert} role="alert">
          <TriangleAlert size={20} aria-hidden="true" className={styles.alertIcon} />
          <p className={styles.alertText}>{t('compose.moderationBlockedError')}</p>
        </div>
      ) : null}

      <main className={styles.body}>
        <div className={styles.intro}>
          <h2 className={styles.introTitle}>{t('companion.compose.introTitle')}</h2>
          <p className={styles.introSub}>{t('companion.compose.introSub')}</p>
        </div>

        <section className={desktop ? styles.card : undefined} aria-label={t('companion.compose.titleLabel')}>
          <div className={styles.fieldBlock}>
            <div className={styles.labelRow}>
              <label htmlFor="companion-title" className={styles.label}>
                {t('companion.compose.titleLabel')} <span className={styles.required}>*</span>
              </label>
              {missingTitle ? (
                <span className={styles.errorText} role="alert">
                  {t('companion.compose.titleRequiredError')}
                </span>
              ) : null}
              <span className={styles.counter}>
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
            <input
              id="companion-title"
              ref={titleRef}
              type="text"
              className={`${styles.input} ${missingTitle ? styles.inputError : ''}`}
              placeholder={t('companion.compose.titlePlaceholder')}
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(e) => {
                setTitle(e.target.value);
                clearInvalid(titleRef.current);
              }}
            />
          </div>

          <div className={styles.fieldBlock}>
            <div className={styles.labelRow}>
              <label htmlFor="companion-body" className={styles.label}>
                {t('companion.compose.bodyLabel')} <span className={styles.required}>*</span>
              </label>
              {missingBody ? (
                <span className={styles.errorText} role="alert">
                  {t('compose.bodyRequiredError')}
                </span>
              ) : null}
              <span className={styles.counter}>
                {body.length}/{MAX_BODY_LENGTH}
              </span>
            </div>
            <div className={`${styles.writing} ${missingBody ? styles.writingError : ''}`}>
              <textarea
                id="companion-body"
                ref={bodyRef}
                className={styles.textarea}
                value={body}
                maxLength={MAX_BODY_LENGTH}
                rows={desktop ? 8 : 6}
                placeholder={t('companion.compose.bodyPlaceholder')}
                onChange={(e) => {
                  setBody(e.target.value);
                  clearInvalid(bodyRef.current);
                }}
              />
              <div className={styles.writingFoot}>
                <span className={styles.minHint}>{t('companion.compose.minHint')}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.group} aria-labelledby="companion-info-title">
          <div className={styles.groupHead}>
            <h2 id="companion-info-title" className={styles.groupTitle}>
              {t('companion.compose.infoTitle')}
            </h2>
          </div>
          <div className={styles.rows}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>{t('companion.compose.destinationLabel')}</span>
              <button type="button" className={styles.valueBtn} onClick={() => setPicker('destination')}>
                <span className={styles.valueText}>
                  {selectedDestination ? destLabel(selectedDestination) : t('companion.compose.destinationAny')}
                </span>
                <ChevronRight size={18} aria-hidden="true" className={styles.valueIcon} />
              </button>
            </div>

            {desktop && featured.length > 0 ? (
              <div className={styles.quickRow}>
                <div className={styles.quick}>
                  <span className={styles.quickLabel}>{t('companion.compose.quick')}</span>
                  {featured.map((d) => (
                    <button key={d.id} type="button" className={styles.quickChip} onClick={() => setDestinationId(d.id)}>
                      <MapPin size={14} aria-hidden="true" />
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles.row}>
              <span className={styles.rowLabel}>
                {t('companion.compose.dateLabel')}
                <span className={styles.rowSub}>{t('companion.compose.dateSub')}</span>
              </span>
              <button
                type="button"
                ref={dateRef}
                className={`${styles.valueBtn} ${styles.valueBtnDate} ${missingDate ? styles.valueBtnError : ''}`}
                onClick={() => {
                  clearInvalid(dateRef.current);
                  setPicker('date');
                }}
              >
                <span className={`${styles.valueText} ${dateValue ? '' : styles.valueEmpty}`}>
                  {dateValue ?? t('companion.compose.datePlaceholder')}
                </span>
                <Calendar size={18} aria-hidden="true" className={styles.valueIcon} />
              </button>
            </div>

            {missingDate ? (
              <p className={styles.rowError} role="alert">
                {t('companion.compose.dateRequiredError')}
              </p>
            ) : null}

            <div className={styles.row}>
              <span className={styles.rowLabel}>
                <span>
                  {t('companion.compose.groupSizeLabel')} <span className={styles.rowNote}>{t('companion.compose.groupSizeNote')}</span>
                </span>
              </span>
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
                <span className={styles.stepperValue} aria-live="polite">
                  {t('companion.compose.groupSizeValue', { count: groupSize })}
                </span>
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
          </div>
        </section>

        <section className={styles.group} aria-labelledby="companion-prefs-title">
          <div className={styles.groupHead}>
            <h2 id="companion-prefs-title" className={styles.groupTitle}>
              {t('companion.prefs.title')}
            </h2>
            <p className={styles.groupNote}>{t('companion.prefs.hint')}</p>
          </div>
          <div className={styles.prefsWrap}>
            <CompanionPrefsFields value={prefs} onChange={setPrefs} />
          </div>
        </section>

        <p className={styles.guide}>{t('companion.compose.guide')}</p>
        {desktop ? (
          <button type="button" className={styles.publishPc} disabled={publishDisabled} onClick={handlePublish}>
            {publishLabel}
            {createCompanionPost.isPending ? null : <ArrowRight size={18} aria-hidden="true" />}
          </button>
        ) : null}
        {submitError ? (
          <p className={styles.submitError} role="alert">
            {submitError}
          </p>
        ) : null}
      </main>

      {desktop ? null : (
        <footer className={styles.footer}>
          {showErrors && anyMissing ? (
            <p className={styles.footerWarning} role="alert">
              <TriangleAlert size={14} aria-hidden="true" />
              {t('companion.compose.missing')}
            </p>
          ) : null}
          <button type="button" className={styles.publishBottom} disabled={publishDisabled} onClick={handlePublish}>
            {publishLabel}
          </button>
        </footer>
      )}

      {picker === 'destination' ? (
        <DestinationPickerModal
          destinations={destinations ?? []}
          selectedId={destinationId || null}
          onConfirm={(d) => setDestinationId(d.id)}
          onClear={() => setDestinationId('')}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {picker === 'date' ? (
        <DateRangeDialog value={range} onConfirm={setRange} onClose={() => setPicker(null)} />
      ) : null}
      {leaveOpen ? (
        <ConfirmDialog
          title={t('compose.leave.title')}
          message={t('compose.leave.message')}
          cancelLabel={t('compose.leave.stay')}
          confirmLabel={t('compose.leave.leave')}
          onConfirm={leaveWithDraft}
          onClose={() => setLeaveOpen(false)}
        />
      ) : null}
    </div>
  );
}
