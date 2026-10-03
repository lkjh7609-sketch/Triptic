import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, TriangleAlert, X } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { useDestinations } from './hooks/useDestinations';
import { useCreatePost } from './hooks/usePosts';
import { DestinationPickerModal } from './DestinationPickerModal';
import { PhotoSection } from './PhotoSection';
import { TripPickerSheet, TripThumb } from './TripPickerSheet';
import { clearDraft, isEmptyDraft, readDraft, writeDraft, type ComposeDraft } from './composeDraft';
import { formatTripPeriod } from './tripPeriodText';
import { CATEGORY_ICONS } from './categoryIcons';
import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  normalizeTag,
  POST_CATEGORIES,
  type PostCategory,
} from './postMeta';
import { MAX_POST_IMAGES, photoFromStored, usePostPhotos } from './usePostPhotos';
import type { Destination } from './types';
import styles from './ComposePostScreen.module.css';

// 편집기(Lexical)는 글쓰기 화면에서만 필요해서 따로 내려받는다 — 앱 첫 로딩에는 들어가지 않는다
const RichTextEditor = lazy(() => import('./editor/RichTextEditor'));

const MAX_BODY_LENGTH = 2000;
const AUTOSAVE_DELAY_MS = 700;
const QUICK_PICK_COUNT = 4;

/**
 * 글쓰기 — Stitch 시안(Stitch/community/Writing)대로: 사진 → 여행지(필수) → 이야기(필수) → 내 일정 첨부(선택).
 * 제출은 moderate-content Edge Function을 거친다(클라이언트가 직접 published로 insert 불가, 0023).
 * 쓰는 내용은 이 기기에 자동 임시저장되고(composeDraft.ts) 다시 열면 이어 쓸지 묻는다.
 * 모바일은 하단 고정 "게시하기" 버튼, PC(1024px~)는 위쪽 줄에 임시저장·게시하기 버튼과 카드 구성이다.
 */
export function ComposePostScreen() {
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
  return <ComposeForm key={user.id} userId={user.id} />;
}

function ComposeForm({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation(['community', 'common']);
  const navigate = useNavigate();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { data: destinations } = useDestinations();
  const { data: trips } = useTrips();
  const createPost = useCreatePost();
  const photoState = usePostPhotos(userId);
  const { photos, setPhotos } = photoState;
  const bodyRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLButtonElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const initialDestSlug = searchParams.get('destination');

  const [destinationId, setDestinationId] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<PostCategory | ''>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [tripId, setTripId] = useState('');
  // 첨부한 일정을 다른 사람이 복사해도 되는가 — 기본은 허용 안 함(0070)
  const [allowCopy, setAllowCopy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  // 제재로 막힌 글 — 같은 내용으로는 다시 게시할 수 없다(고치면 풀린다)
  const [blockedBody, setBlockedBody] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<'destination' | 'trip' | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── 임시저장 ─────────────────────────────────────────────────────────────
  // 처음 열 때 저장된 글이 있으면 이어 쓸지 묻는다(답하기 전에는 자동 저장을 켜지 않아 이전 글을 덮어쓰지 않는다)
  const [pendingDraft, setPendingDraft] = useState<ComposeDraft | null>(() => readDraft(userId));
  const [autosaveReady, setAutosaveReady] = useState(() => pendingDraft === null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const publishedRef = useRef(false);

  useEffect(() => {
    trackScreenView('community_compose');
  }, []);

  // ?destination=slug 로 들어오면 그 도시를 미리 고른다
  useEffect(() => {
    if (!initialDestSlug || !destinations || destinationId) return;
    const d = destinations.find((x) => x.slug === initialDestSlug);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d) setDestinationId(d.id);
  }, [destinations, initialDestSlug, destinationId]);

  const myTrips = useMemo(() => (trips ?? []).filter((trip) => trip.owner_id === userId), [trips, userId]);
  const selectedDestination = destinations?.find((d) => d.id === destinationId);
  const selectedTrip = myTrips.find((trip) => trip.id === tripId);
  const featured = useMemo(
    () => (destinations ?? []).filter((d) => d.is_featured).sort((a, b) => a.sort_order - b.sort_order).slice(0, QUICK_PICK_COUNT),
    [destinations],
  );
  const countryName = useCallback(
    (code: string) => {
      try {
        return new Intl.DisplayNames([i18n.language], { type: 'region' }).of(code) ?? code;
      } catch {
        return code;
      }
    },
    [i18n.language],
  );
  const destLabel = (d: Destination) => `${d.name}, ${countryName(d.country_code)}`;

  const current = useCallback(
    (): Omit<ComposeDraft, 'savedAt'> => ({
      destinationId,
      body,
      tripId,
      allowCopy,
      images: photos.map(({ storagePath, width, height }) => ({ storagePath, width, height })),
      category,
      tags,
    }),
    [destinationId, body, tripId, allowCopy, photos, category, tags],
  );

  // 쓰는 대로 잠깐 멈추면 저장한다
  useEffect(() => {
    if (!userId || !autosaveReady || publishedRef.current) return;
    const timer = window.setTimeout(() => {
      const saved = writeDraft(userId, current());
      setSavedAt(saved ? Date.now() : null);
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [userId, autosaveReady, current]);

  function resumeDraft() {
    if (!pendingDraft) return;
    // 지금 없는 도시·일정은 빼고 복구한다
    if (!destinations || pendingDraft.destinationId === '' || destinations.some((d) => d.id === pendingDraft.destinationId)) {
      setDestinationId(pendingDraft.destinationId);
    }
    setBody(pendingDraft.body);
    setCategory(pendingDraft.category);
    setTags(pendingDraft.tags);
    if (
      !trips ||
      pendingDraft.tripId === '' ||
      myTrips.some((trip) => trip.id === pendingDraft.tripId)
    ) {
      setTripId(pendingDraft.tripId);
      setAllowCopy(pendingDraft.allowCopy);
    }
    setPhotos(pendingDraft.images.map(photoFromStored));
    setPendingDraft(null);
    setAutosaveReady(true);
  }

  function discardDraft() {
    if (userId) clearDraft(userId);
    setPendingDraft(null);
    setAutosaveReady(true);
  }

  function saveNow() {
    if (!userId) return;
    const saved = writeDraft(userId, current());
    setSavedAt(saved ? Date.now() : null);
    if (saved) showToast(t('compose.draft.savedToast'), { tone: 'success' });
  }

  const hasContent = !isEmptyDraft(current());

  function handleCancel() {
    if (hasContent) setLeaveOpen(true);
    else navigate(-1);
  }

  function leaveWithDraft() {
    if (userId) writeDraft(userId, current());
    navigate(-1);
  }

  // ── 게시 ────────────────────────────────────────────────────────────────
  const missingDest = showErrors && !destinationId;
  const missingBody = showErrors && !body.trim();
  const missingCategory = showErrors && !category;
  // 편집기가 한도에서 입력을 막지만, 붙여넣기로 넘친 경우는 여기서 막는다(서버·DB도 2000자 제한)
  const tooLong = body.length > MAX_BODY_LENGTH;
  const blocked = blockedBody !== null && blockedBody === body;
  const publishDisabled = createPost.isPending || photoState.uploading || blocked;

  // ── 태그 입력 ──────────────────────────────────────────────────────────────
  function addTag(raw: string): boolean {
    const tag = normalizeTag(raw);
    if (!tag) return false;
    if (tags.length >= MAX_TAGS || tags.some((x) => x.toLowerCase() === tag.toLowerCase()))
      return false;
    setTags([...tags, tag]);
    return true;
  }

  /** 입력 칸에 남아 있는 글자도 태그로 쳐서 게시한다 */
  function finalTags(): string[] {
    const pending = normalizeTag(tagDraft);
    if (
      pending &&
      tags.length < MAX_TAGS &&
      !tags.some((x) => x.toLowerCase() === pending.toLowerCase())
    )
      return [...tags, pending];
    return tags;
  }

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter는 글자 확정이다
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (addTag(tagDraft)) setTagDraft('');
    } else if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  async function handlePublish() {
    setSubmitError(null);
    if (tooLong) {
      setSubmitError(t('compose.story.tooLong', { max: MAX_BODY_LENGTH }));
      return;
    }
    if (!destinationId || !category || !body.trim()) {
      setShowErrors(true);
      // 빨간 테두리·흔들림·포커스·스크롤은 flagInvalid가 한다(앱 공통 동작)
      flagInvalid(
        !destinationId ? destRef.current : !category ? categoryRef.current : bodyRef.current,
      );
      // flagInvalid는 칸 안의 첫 버튼(서식 도구)에 포커스를 주므로 글 칸으로 다시 옮긴다
      if (destinationId && category)
        bodyRef.current
          ?.querySelector<HTMLElement>('[contenteditable="true"]')
          ?.focus({ preventScroll: true });
      return;
    }
    try {
      const result = await createPost.mutateAsync({
        destinationId,
        body: body.trim(),
        tripId: tripId || null,
        allowCopy: !!tripId && allowCopy,
        category,
        tags: finalTags(),
        images: photos.map(({ storagePath, width, height }) => ({ storagePath, width, height })),
        userId,
      });
      if (result.status === 'removed') {
        setBlockedBody(body);
        return;
      }
      publishedRef.current = true;
      clearDraft(userId);
      if (result.status === 'pending_review') {
        navigate('/community');
        return;
      }
      navigate(`/community/post/${result.id}`);
    } catch (err) {
      captureError(err, { context: 'createPost' });
      setSubmitError(t('compose.submitError'));
    }
  }

  const publishLabel = createPost.isPending ? t('compose.submitting') : t('compose.submit');
  const storyLabel = desktop ? t('compose.story.labelPc') : t('compose.story.label');

  const destinationSection = (
    <section className={`${styles.section} ${desktop ? styles.card : ''}`} aria-labelledby="compose-dest-label">
      <div className={styles.labelRow}>
        <h2 id="compose-dest-label" className={styles.label}>
          {t('compose.dest.label')} <span className={styles.required}>*</span>
          {desktop ? <span className={styles.labelSub}> {t('compose.dest.requiredPc')}</span> : null}
        </h2>
        {missingDest ? (
          <span className={styles.errorText} role="alert">
            {desktop ? t('compose.dest.errorPc') : t('compose.dest.required')}
          </span>
        ) : null}
      </div>
      {selectedDestination ? (
        <div className={styles.destChosen}>
          <button type="button" ref={destRef} className={styles.destChip} onClick={() => setPickerOpen('destination')}>
            <MapPin size={16} aria-hidden="true" />
            <span className={styles.destChipText}>{destLabel(selectedDestination)}</span>
          </button>
          {desktop ? (
            <button type="button" className={styles.linkBtn} onClick={() => setPickerOpen('destination')}>
              {t('compose.dest.change')}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => setDestinationId('')}
            aria-label={t('compose.dest.clear')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          ref={destRef}
          className={`${styles.pill} ${missingDest ? styles.pillError : ''}`}
          onClick={() => {
            clearInvalid(destRef.current);
            setPickerOpen('destination');
          }}
        >
          <span className={styles.pillMain}>
            <MapPin size={18} aria-hidden="true" className={styles.pillIcon} />
            {t('compose.dest.pick')}
          </span>
          <span className={styles.pillEnd}>
            {desktop ? <span>{t('compose.dest.select')}</span> : null}
            <ChevronRight size={18} aria-hidden="true" />
          </span>
        </button>
      )}
      {desktop && featured.length > 0 ? (
        <div className={styles.quick}>
          <span className={styles.quickLabel}>{t('compose.dest.quick')}</span>
          {featured.map((d) => (
            <button key={d.id} type="button" className={styles.quickChip} onClick={() => setDestinationId(d.id)}>
              <MapPin size={14} aria-hidden="true" />
              {d.name}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );

  const categorySection = (
    <section
      className={`${styles.section} ${desktop ? styles.card : ''}`}
      aria-labelledby="compose-category-label"
    >
      <div className={styles.labelRow}>
        <h2 id="compose-category-label" className={styles.label}>
          {t('compose.category.label')} <span className={styles.required}>*</span>
          <span className={styles.labelSub}> {t('compose.category.hint')}</span>
        </h2>
        {missingCategory ? (
          <span className={styles.errorText} role="alert">
            {t('compose.category.error')}
          </span>
        ) : null}
      </div>
      <div
        ref={categoryRef}
        className={`${styles.categoryRow} ${missingCategory ? styles.categoryError : ''}`}
        role="radiogroup"
        aria-labelledby="compose-category-label"
      >
        {POST_CATEGORIES.map((key) => {
          const Icon = CATEGORY_ICONS[key];
          const on = category === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              className={on ? styles.categoryChipOn : styles.categoryChip}
              onClick={() => {
                setCategory(key);
                clearInvalid(categoryRef.current);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {t(`postCategory.${key}`)}
            </button>
          );
        })}
      </div>
    </section>
  );

  const tagsSection = (
    <section
      className={`${styles.section} ${desktop ? styles.card : ''}`}
      aria-labelledby="compose-tags-label"
    >
      <div className={styles.labelRow}>
        <h2 id="compose-tags-label" className={styles.label}>
          {t('compose.tags.label')}
          <span className={styles.labelSub}> {t('compose.tags.optional', { max: MAX_TAGS })}</span>
        </h2>
        <span className={styles.counter}>
          {tags.length}/{MAX_TAGS}
        </span>
      </div>
      <div className={styles.tagBox}>
        {tags.map((tag) => (
          <span key={tag} className={styles.tagChip}>
            #{tag}
            <button
              type="button"
              className={styles.tagRemove}
              aria-label={t('compose.tags.remove', { tag })}
              onClick={() => setTags(tags.filter((x) => x !== tag))}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        {tags.length < MAX_TAGS ? (
          <input
            className={styles.tagInput}
            value={tagDraft}
            maxLength={MAX_TAG_LENGTH + 1}
            placeholder={tags.length === 0 ? t('compose.tags.placeholder') : ''}
            aria-label={t('compose.tags.label')}
            onChange={(e) => setTagDraft(e.target.value.replace(/,/g, ''))}
            onKeyDown={onTagKeyDown}
            onBlur={() => {
              if (addTag(tagDraft)) setTagDraft('');
            }}
          />
        ) : null}
      </div>
      <p className={styles.tagHint}>{t('compose.tags.hint', { max: MAX_TAG_LENGTH })}</p>
    </section>
  );

  const storySection = (
    <section className={`${styles.section} ${desktop ? styles.card : ''}`} aria-labelledby="compose-story-label">
      <div className={styles.labelRow}>
        <span id="compose-story-label" className={styles.label}>
          {storyLabel} {desktop ? <span className={styles.required}>*</span> : null}
        </span>
        {desktop ? (
          <span className={`${styles.counterTop} ${tooLong ? styles.counterOver : ''}`}>{t('compose.story.counterPc', { count: body.length, max: MAX_BODY_LENGTH })}</span>
        ) : null}
        {missingBody ? (
          <span className={styles.errorText} role="alert">
            {t('compose.story.error')}
          </span>
        ) : null}
      </div>
      <div className={`${styles.writing} ${missingBody ? styles.writingError : ''}`}>
        <Suspense fallback={<div className={styles.editorFallback} aria-hidden="true" />}>
          <RichTextEditor
            editorRef={bodyRef}
            value={body}
            maxLength={MAX_BODY_LENGTH}
            minHeight={desktop ? 220 : 180}
            labelledBy="compose-story-label"
            placeholder={desktop ? t('compose.story.placeholderPc') : t('compose.story.placeholder')}
            onChange={setBody}
          />
        </Suspense>
        <div className={styles.writingFoot}>
          {desktop ? <span className={styles.minHint}>{t('compose.story.minHint')}</span> : <span />}
          {desktop ? null : <span className={`${styles.counter} ${tooLong ? styles.counterOver : ''}`}>{body.length}/{MAX_BODY_LENGTH}</span>}
        </div>
      </div>
    </section>
  );

  const tripSection = (
    <section className={`${styles.section} ${desktop ? styles.card : ''}`} aria-label={t('compose.trip.label')}>
      {/* 모바일 시안은 알약 버튼 자체가 "내 일정 첨부 (선택)"라 머리글이 따로 없다. 일정을 붙인 뒤나 PC에서는 머리글을 보여 준다 */}
      {desktop || selectedTrip ? (
        <div className={styles.labelRow}>
          <h2 id="compose-trip-label" className={styles.label}>
            {t('compose.trip.label')}
          </h2>
        </div>
      ) : null}
      {selectedTrip ? (
        <div className={styles.tripCard}>
          <div className={styles.tripTop}>
            <TripThumb city={selectedTrip.city} className={styles.tripThumb} />
            <div className={styles.tripText}>
              <span className={styles.tripTag}>{t('compose.trip.attached')}</span>
              <h3 className={styles.tripTitle}>{selectedTrip.title}</h3>
              <p className={styles.tripPeriod}>
                {formatTripPeriod(selectedTrip, t('compose.trip.days', { count: selectedTrip.total_days ?? 1 }))}
              </p>
            </div>
            <div className={styles.tripActions}>
              <button type="button" className={styles.linkBtn} onClick={() => setPickerOpen('trip')}>
                {t('compose.trip.change')}
              </button>
              <button type="button" className={styles.iconBtn} onClick={() => setTripId('')} aria-label={t('compose.trip.detach')}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className={styles.divider} />
          <div className={styles.switchRow}>
            <div className={styles.switchText}>
              <label htmlFor="compose-allow-copy" className={styles.switchLabel}>
                {t('compose.allowCopy')}
              </label>
              <p className={styles.switchHint}>{t('compose.allowCopyHint')}</p>
            </div>
            <label className={styles.switch}>
              <input
                id="compose-allow-copy"
                type="checkbox"
                role="switch"
                className={styles.switchInput}
                checked={allowCopy}
                onChange={(e) => setAllowCopy(e.target.checked)}
              />
              <span className={styles.switchTrack} aria-hidden="true" />
            </label>
          </div>
        </div>
      ) : (
        <button type="button" className={styles.pill} onClick={() => setPickerOpen('trip')}>
          <span className={styles.pillMain}>
            <CalendarDays size={18} aria-hidden="true" className={styles.pillIcon} />
            {desktop ? t('compose.trip.attach') : t('compose.tripLabel')}
          </span>
          <span className={styles.pillEnd}>
            {desktop ? <span>{t('compose.trip.list')}</span> : null}
            <ChevronRight size={18} aria-hidden="true" />
          </span>
        </button>
      )}
    </section>
  );

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topInner}>
          <button type="button" className={styles.cancelBtn} onClick={handleCancel}>
            {desktop ? <ChevronLeft size={18} aria-hidden="true" /> : null}
            {t('action.cancel', { ns: 'common' })}
          </button>
          <h1 className={styles.title}>{t('compose.title')}</h1>
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
                {publishLabel}
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
        <PhotoSection
          photos={photos}
          progress={photoState.progress}
          max={MAX_POST_IMAGES}
          desktop={desktop}
          onFiles={(files) => void photoState.upload(files)}
          onCancel={photoState.cancel}
          onRemove={photoState.remove}
          onMove={photoState.move}
        />
        {destinationSection}
        {categorySection}
        {storySection}
        {tagsSection}
        {tripSection}
        {submitError ? (
          <p className={styles.submitError} role="alert">
            {submitError}
          </p>
        ) : null}
      </main>

      {desktop ? null : (
        <footer className={styles.footer}>
          {showErrors && (!destinationId || !category || !body.trim()) ? (
            <p className={styles.footerWarning} role="alert">
              <TriangleAlert size={14} aria-hidden="true" />
              {t('compose.missing')}
            </p>
          ) : null}
          <button type="button" className={styles.publishBottom} disabled={publishDisabled} onClick={handlePublish}>
            {publishLabel}
          </button>
        </footer>
      )}

      {pickerOpen === 'destination' ? (
        <DestinationPickerModal
          destinations={destinations ?? []}
          selectedId={destinationId || null}
          onConfirm={(d) => {
            setDestinationId(d.id);
            clearInvalid(destRef.current);
          }}
          onClose={() => setPickerOpen(null)}
        />
      ) : null}
      {pickerOpen === 'trip' ? (
        <TripPickerSheet
          trips={myTrips}
          selectedId={tripId}
          onSelect={(id) => {
            setTripId(id);
            if (!id) setAllowCopy(false);
          }}
          onClose={() => setPickerOpen(null)}
        />
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
