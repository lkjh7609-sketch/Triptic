import { ChevronDown, Megaphone, Pin, Rocket } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { trackScreenView } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { LightMarkdown } from '@/features/community/editor/LightMarkdown';
import { useAnnouncements } from './useAnnouncements';
import type { AnnouncementKind } from './noticeService';
import styles from './NoticesScreen.module.css';

type Filter = 'all' | AnnouncementKind;
const FILTERS: Filter[] = ['all', 'notice', 'update'];

/**
 * 공지사항·업데이트 (/notices) — 로그인 없이 누구나 본다. 운영자가 운영 콘솔 '공지' 탭에서 쓴 것을 보여 주고,
 * 새 공지는 종 알림에도 뜬다(?open=ID로 들어오면 그 공지가 펼쳐진다).
 */
export default function NoticesScreen() {
  const { t } = useTranslation('community');
  const [searchParams] = useSearchParams();
  const openFromLink = searchParams.get('open');
  const { data, isLoading, isError, refetch } = useAnnouncements();
  const [filter, setFilter] = useState<Filter>('all');
  const [opened, setOpened] = useState<string | null>(openFromLink);

  useEffect(() => {
    trackScreenView('notices');
  }, []);

  useEffect(() => {
    if (!openFromLink || !data) return;
    document.getElementById(`notice-${openFromLink}`)?.scrollIntoView({ block: 'center' });
  }, [openFromLink, data]);

  const items = useMemo(() => (data ?? []).filter((a) => filter === 'all' || a.kind === filter), [data, filter]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden="true">
          <Megaphone size={26} />
        </span>
        <div>
          <h1 className={styles.title}>{t('notices.title')}</h1>
          <p className={styles.sub}>{t('notices.subtitle')}</p>
        </div>
      </header>

      <div className={styles.filters} role="group" aria-label={t('notices.filterAria')}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={filter === f ? styles.filterOn : styles.filter} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`notices.filter.${f}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <>
          <Skeleton height="72px" />
          <div style={{ height: 12 }} />
          <Skeleton height="72px" />
        </>
      ) : isError ? (
        <ErrorState summary={t('notices.loadError')} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Megaphone size={28} />} message={t('notices.empty')} />
      ) : (
        <ul className={styles.list}>
          {items.map((a) => {
            const open = opened === a.id;
            return (
              <li key={a.id} id={`notice-${a.id}`} className={`${styles.item} ${open ? styles.itemOpen : ''}`}>
                <button type="button" className={styles.itemHead} aria-expanded={open} onClick={() => setOpened(open ? null : a.id)}>
                  <span className={styles.chips}>
                    <span className={a.kind === 'update' ? styles.chipUpdate : styles.chipNotice}>
                      {a.kind === 'update' ? <Rocket size={12} aria-hidden="true" /> : <Megaphone size={12} aria-hidden="true" />}
                      {t(`notices.kind.${a.kind}`)}
                    </span>
                    {a.version ? <span className={styles.chipVersion}>v{a.version}</span> : null}
                    {a.pinned ? (
                      <span className={styles.chipPin}>
                        <Pin size={12} aria-hidden="true" /> {t('notices.pinned')}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.itemTitle}>{a.title}</span>
                  <span className={styles.itemMeta}>
                    <time dateTime={a.published_at}>{format(new Date(a.published_at), 'yyyy.MM.dd')}</time>
                    <ChevronDown size={18} aria-hidden="true" className={styles.chev} />
                  </span>
                </button>
                {open ? <LightMarkdown text={a.body} className={styles.body} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
