import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { tripService } from '@/shared/api/tripService';
import { captureError, track } from '@/shared/monitoring';
import { useSession } from '@/shared/hooks/useSession';
import type { PdfExportInput } from './pdfExport';
import { useTripMembers, initialsOf } from './hooks/useTripMembers';
import { useLeaveTrip, useRemoveTripMember } from './hooks/useTrips';
import styles from './ShareSheet.module.css';
import { Link, Clipboard, BookOpen, FileText, Users } from 'lucide-react';

interface ShareSheetProps {
  tripId: string;
  onClose: () => void;
  /** 텍스트 복사(index.html copyItineraryText 이식)용 — 없으면 텍스트 복사 버튼을 숨긴다 */
  itineraryText?: string;
  /** PDF 내보내기(index.html exportToPDF 이식)용 — 없으면 PDF 버튼을 숨긴다 */
  pdfInput?: PdfExportInput;
  /** 샘플 여행이면 공유 링크 생성만 막는다 — 텍스트/PDF 내보내기는 legacy도 막지 않는다
   * (index.html openShareModal만 SAMPLE_PROJECT_NAME을 검사하고, openExportModal/
   * copyItineraryText/openPdfModal은 검사하지 않는다) */
  isSample?: boolean;
  /** 로그인 전에 이 기기에만 만든 임시 여행 — isSample과 같이 잠기지만 안내 문구가 다르다 */
  isDraft?: boolean;
  /** 여행 소유자 — 링크 만들기·끊기·멤버 내보내기는 소유자만(shared_trips/trip_members 정책) */
  ownerId: string;
}

/**
 * 공유 시트 — 함께 편집할 사람 초대(0057).
 * 링크(/shared/:code)를 받은 사람은 로그인한 뒤 이 여행의 편집 멤버가 되어 같은 여행 화면에서
 * 실시간으로 함께 고친다. 아래에 함께하는 사람 목록(소유자는 내보내기, 멤버는 나가기)을 둔다.
 * 전체 일정 텍스트 복사·PDF도 같은 시트에 얹었다 — 헤더가 이미 버튼으로 빽빽해서.
 */
export function ShareSheet({ tripId, onClose, itineraryText, pdfInput, isSample, isDraft, ownerId }: ShareSheetProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState<'all' | 'current' | null>(null);
  const [linkUnavailable, setLinkUnavailable] = useState(false);
  const { user } = useSession();
  const navigate = useNavigate();
  const isOwner = !!user && user.id === ownerId;
  const members = useTripMembers(isSample ? [] : [tripId]);
  const memberList = members.data?.[tripId] ?? [];
  const leaveTrip = useLeaveTrip();
  const removeMember = useRemoveTripMember(tripId);

  async function handleCreate() {
    setLoading(true);
    try {
      const code = await tripService.createShareLink(tripId);
      setShareCode(code);
      track('share_link_created');
    } catch (err) {
      // 멤버는 소유자가 만든 링크만 받아 쓸 수 있다 — 아직 없으면 안내만
      setLinkUnavailable(true);
      captureError(err, { context: 'createShareLink' });
    } finally {
      setLoading(false);
    }
  }

  function handleRemoveMember(userId: string, name: string | null) {
    if (!window.confirm(t('collab.removeConfirm', { name: name ?? t('desktop.memberUnknown') }))) return;
    removeMember.mutate(userId, { onError: (err) => captureError(err, { context: 'removeTripMember' }) });
  }

  function handleLeave() {
    if (!window.confirm(t('collab.leaveConfirmShort'))) return;
    leaveTrip.mutate(tripId, {
      onSuccess: () => navigate('/plan', { replace: true }),
      onError: (err) => captureError(err, { context: 'leaveTrip' }),
    });
  }

  useEffect(() => {
    if (isSample) return;
    // 외부 시스템(Supabase RPC) 호출로 shareCode를 채우는 것이 이 effect의 목적
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 시트가 열릴 때 1회만 생성/조회
  }, [isSample]);


  const shareUrl = shareCode ? `${window.location.origin}/shared/${shareCode}` : '';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      captureError(err, { context: 'copyShareLink' });
    }
  }

  async function handleCopyText() {
    if (!itineraryText) return;
    try {
      await navigator.clipboard.writeText(itineraryText);
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2000);
    } catch (err) {
      captureError(err, { context: 'copyItineraryText' });
    }
  }

  async function handleExportPdf(mode: 'all' | 'current') {
    if (!pdfInput || pdfGenerating) return;
    setPdfGenerating(mode);
    try {
      // jsPDF는 html2canvas/dompurify 등 무거운 의존성을 끌고 오므로(gzip
      // ~120KB) 정적 import하면 트립 상세 화면을 열 때마다 같이 로드된다 —
      // PDF 버튼을 실제로 누를 때만 동적 import로 받는다.
      const { exportToPdf } = await import('./pdfExport');
      await exportToPdf(pdfInput, mode);
    } catch (err) {
      captureError(err, { context: 'exportToPdf', mode });
    } finally {
      setPdfGenerating(null);
    }
  }

  async function handleRevoke() {
    if (!window.confirm(t('share.revokeConfirm'))) return;
    setLoading(true);
    try {
      await tripService.revokeShareLinks(tripId);
      setShareCode(null);
      onClose();
    } catch (err) {
      captureError(err, { context: 'revokeShareLinks' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Link size={18} /> {t('share.title')}</span></h2>

        {isSample ? (
          <>
            <p className={styles.desc}>{t(isDraft ? 'share.draftMessage' : 'share.sampleMessage')}</p>
            <button type="button" className={styles.secondary} onClick={onClose}>
              {t('common:action.close')}
            </button>
          </>
        ) : (
          <>
            <p className={styles.desc}>
              {t('share.desc')}
            </p>

            <div className={styles.linkRow}>
              <input
                className={styles.linkInput}
                readOnly
                value={loading ? t('share.generatingLink') : linkUnavailable ? t('collab.ownerOnlyLink') : shareUrl}
              />
            </div>

            <div className={styles.actions}>
              {isOwner ? (
                <button
                  type="button"
                  className={styles.danger}
                  disabled={!shareCode || loading}
                  onClick={handleRevoke}
                >
                  {t('share.revoke')}
                </button>
              ) : null}
              <button type="button" className={styles.primary} disabled={!shareCode || loading} onClick={handleCopy}>
                {copied ? t('share.copied') : t('common:action.copy')}
              </button>
              <button type="button" className={styles.secondary} onClick={onClose}>
                {t('common:action.close')}
              </button>
            </div>

            <div className={styles.members}>
              <h3 className={styles.membersTitle}>
                <Users size={16} aria-hidden="true" /> {t('collab.membersTitle', { count: Math.max(1, memberList.length) })}
              </h3>
              {memberList.map((m) => (
                <div key={m.userId} className={styles.memberRow}>
                  <span className={styles.memberAvatar} aria-hidden="true">{initialsOf(m.name)}</span>
                  <span className={styles.memberName}>
                    {m.name ?? t('desktop.memberUnknown')}
                    {m.userId === user?.id ? <span className={styles.memberMe}> {t('collab.me')}</span> : null}
                  </span>
                  <span className={styles.memberRole}>{t(`desktop.role.${m.role}`, { defaultValue: m.role })}</span>
                  {isOwner && m.role !== 'owner' ? (
                    <button
                      type="button"
                      className={styles.memberAction}
                      disabled={removeMember.isPending}
                      onClick={() => handleRemoveMember(m.userId, m.name)}
                    >
                      {t('collab.remove')}
                    </button>
                  ) : !isOwner && m.userId === user?.id ? (
                    <button type="button" className={styles.memberAction} disabled={leaveTrip.isPending} onClick={handleLeave}>
                      {t('collab.leave')}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}

        {itineraryText ? (
          <button type="button" className={styles.secondary} onClick={handleCopyText}>
            {textCopied ? t('share.textCopied') : (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clipboard size={16} /> {t('share.copyText')}</span>)}
          </button>
        ) : null}

        {pdfInput ? (
          <div className={styles.exportRow}>
            <button
              type="button"
              className={styles.secondary}
              disabled={pdfGenerating !== null}
              onClick={() => handleExportPdf('all')}
            >
              {pdfGenerating === 'all' ? t('share.generatingPdf') : (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BookOpen size={16} /> {t('share.pdfAllBtn', { days: pdfInput.totalDays })}</span>)}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={pdfGenerating !== null}
              onClick={() => handleExportPdf('current')}
            >
              {pdfGenerating === 'current' ? t('share.generatingPdf') : (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FileText size={16} /> {t('share.pdfCurrentBtn', { day: pdfInput.currentDay })}</span>)}
            </button>
          </div>
        ) : null}

      </div>
    </div>
  );
}
