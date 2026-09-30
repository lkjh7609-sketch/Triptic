import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useDestinations } from '@/features/community/hooks/useDestinations';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { FeedbackModal } from '@/features/settings/FeedbackModal';
import { cityDescCacheKey } from '@/shared/api/aiCacheKeys';
import { cityDescQueryKey, fetchCityDescription, readCachedCityDescriptions } from './cityDescription';
import { FEATURED, type FeaturedDestination } from './featuredDestinations';
import { HomeSectionTabs } from './HomeSectionTabs';
import styles from './HomeDesktop.module.css';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';

function DestinationPreviewModal({
  dest,
  onClose,
  onStart,
}: {
  dest: FeaturedDestination;
  onClose: () => void;
  onStart: () => void;
}) {
  const { t, i18n } = useTranslation(['home', 'common']);
  const locale = i18n.language;
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  // 한 번 받은 소개는 DB(서버)와 이 기기 캐시에 남아 있어서, 홈에서 미리 채워뒀거나
  // 전에 열어봤으면 첫 화면부터 바로 보인다. 실패하면 아래 기본 문구로.
  const { data: aiDesc, isPending: loading } = useQuery({
    queryKey: cityDescQueryKey(dest.city, locale),
    queryFn: () => fetchCityDescription(dest.city, locale),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return createPortal(
    <div className={styles.modalOverlay}>
      <div
        ref={trapRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dest-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label={t('common:action.close')}>
          <X size={18} />
        </button>
        <img src={dest.image} className={styles.modalImage} alt="" />
        <div className={styles.modalBody}>
          <h2 id="dest-preview-title" className={styles.modalTitle}>
            {t(`desktop.dest${dest.key}`)}
          </h2>
          <div className={styles.modalDesc} aria-live="polite">
            {loading ? (
              <span className={styles.modalLoading}>{t('desktop.previewLoading')}</span>
            ) : (
              (aiDesc ?? t(`desktop.desc${dest.key}`))
            )}
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.modalCancel} onClick={onClose}>
              {t('desktop.previewCancel')}
            </button>
            <button type="button" className={styles.modalStart} onClick={onStart}>
              {t('desktop.previewStart')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function HomeDesktop() {
  const { t, i18n } = useTranslation('home');
  const navigate = useNavigate();
  const [previewDest, setPreviewDest] = useState<FeaturedDestination | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const { data: destinations } = useDestinations();
  const queryClient = useQueryClient();
  const requireLogin = useRequireLogin();
  // 모바일(1024px 미만)은 검색창 없이 추천 여행지 → 시작하기 안내 순서. 도시 검색은 PC에서만(9/30 디자인 결정)
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // 추천 카드 소개 중 이미 DB에 저장된 것들을 한 번에 받아 채워둔다 — 카드를 눌렀을 때 기다림 없이
  useEffect(() => {
    const locale = i18n.language;
    const missing = FEATURED.filter((d) => queryClient.getQueryData(cityDescQueryKey(d.city, locale)) === undefined);
    if (missing.length === 0) return;
    let cancelled = false;
    void readCachedCityDescriptions(missing.map((d) => d.city), locale).then((byKey) => {
      if (cancelled) return;
      for (const d of missing) {
        const description = byKey[cityDescCacheKey(d.city)];
        if (description) queryClient.setQueryData(cityDescQueryKey(d.city, locale), description);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [queryClient, i18n.language]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollPausedRef = useRef(false);
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.5;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  // 여행지 카드가 끊김 없이 왼쪽으로 계속 흐르다 한 세트를 다 돌면 처음부터
  // 이어지는 것처럼 보이도록 한다 — 카드 목록을 DOM에서 두 벌 이어 붙여두고
  // (아래 JSX), 첫 벌의 너비만큼 스크롤되면 그만큼 즉시 되돌려서 두 벌째가
  // 첫 벌과 완전히 겹치게 만드는 방식(사용자 눈엔 끊김이 안 보인다).
  // prefers-reduced-motion이면 아예 안 돌린다(tokens.css의 접근성 원칙과 동일).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const PIXELS_PER_FRAME = 0.6;
    function step() {
      if (!autoScrollPausedRef.current && el) {
        const setWidth = el.scrollWidth / 2;
        el.scrollLeft += PIXELS_PER_FRAME;
        if (el.scrollLeft >= setWidth) {
          el.scrollLeft -= setWidth;
        }
      }
      raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleStartPlanning = (city?: string) => {
    // 계획 만들기는 로그인해야 한다(PC 비로그인 둘러보기 — 로그인 창을 띄운다)
    if (!requireLogin()) return;
    const target = (city ?? searchQuery).trim();
    navigate(target ? `/plan?autoCreate=${encodeURIComponent(target)}` : '/plan');
  };

  /** 여행지(4개 언어 이름) + 국가명(Intl.DisplayNames)으로 검색 추천 */
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !destinations) return [];
    let regionNames: Intl.DisplayNames | null = null;
    try {
      regionNames = new Intl.DisplayNames([i18n.language], { type: 'region' });
    } catch {
      regionNames = null;
    }
    return destinations
      .map((d) => ({ dest: d, country: regionNames?.of(d.country_code) ?? d.country_code }))
      .filter(({ dest, country }) => [dest.name, dest.slug, country].some((v) => v.toLowerCase().includes(q)))
      .slice(0, 10)
      .map(({ dest, country }) => ({ id: dest.id, label: `${dest.name} · ${country}`, city: dest.name }));
  }, [searchQuery, destinations, i18n.language]);

  return (
    <div className={styles.container}>
      <HomeSectionTabs />
      {isDesktop ? (
        <section className={`${styles.hero} ${styles.heroPlain}`}>
          <div className={styles.heroContent}>
            <div className={styles.searchPill}>
              <Search size={20} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t('desktop.searchPlaceholder')}
                aria-label={t('desktop.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(e) => e.key === 'Enter' && handleStartPlanning()}
              />
              <button type="button" className={styles.searchBtn} onClick={() => handleStartPlanning()}>
                {t('desktop.startPlanning')}
              </button>
              {isFocused && suggestions.length > 0 && (
                <ul className={styles.suggestions} role="listbox" aria-label={t('desktop.searchPlaceholder')}>
                  {suggestions.map((s) => (
                    <li
                      key={s.id}
                      role="option"
                      aria-selected={false}
                      className={styles.suggestion}
                      // onClick 대신 onMouseDown: 입력창 blur보다 먼저 처리돼야 목록이 사라지기 전에 선택된다
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleStartPlanning(s.city);
                      }}
                    >
                      {s.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('desktop.featuredTitle')}</h2>
        <div className={styles.sliderWrapper}>
          <button type="button" className={styles.sliderBtnLeft} onClick={() => scroll('left')} aria-label={t('desktop.scrollLeft')}>
            <ChevronLeft size={24} />
          </button>
          <div
            className={styles.grid}
            ref={scrollRef}
            onMouseEnter={() => { autoScrollPausedRef.current = true; }}
            onMouseLeave={() => { autoScrollPausedRef.current = false; }}
            onTouchStart={() => { autoScrollPausedRef.current = true; }}
            onTouchEnd={() => { autoScrollPausedRef.current = false; }}
            // 키보드로 카드에 포커스가 있는 동안에도 멈춘다(움직이는 목록은 멈출 수 있어야 한다 — WCAG 2.2.2)
            onFocus={() => { autoScrollPausedRef.current = true; }}
            onBlur={() => { autoScrollPausedRef.current = false; }}
          >
            {[...FEATURED, ...FEATURED].map((dest, i) => (
              <button
                type="button"
                key={`${dest.key}-${i < FEATURED.length ? 'a' : 'b'}`}
                className={styles.card}
                onClick={() => setPreviewDest(dest)}
                tabIndex={i < FEATURED.length ? 0 : -1}
                aria-hidden={i < FEATURED.length ? undefined : true}
              >
                <img src={dest.image} alt="" className={styles.cardImage} />
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{t(`desktop.dest${dest.key}`)}</h3>
                  <p className={styles.cardDesc}>{t(`desktop.desc${dest.key}`)}</p>
                </div>
              </button>
            ))}
          </div>
          <button type="button" className={styles.sliderBtnRight} onClick={() => scroll('right')} aria-label={t('desktop.scrollRight')}>
            <ChevronRight size={24} />
          </button>
        </div>
      </section>

      <section className={`${styles.section} ${styles.stepsSection}`}>
        <h2 className={styles.sectionTitle}>{t('desktop.stepsTitle')}</h2>
        <ol className={styles.stepList}>
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className={styles.step}>
              <span className={styles.stepNum} aria-hidden="true">
                {n}
              </span>
              <div className={styles.stepTitle}>{t(`desktop.step${n}Title`)}</div>
              <div className={styles.stepDesc}>{t(`desktop.step${n}Desc`)}</div>
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
            {t('desktop.terms')}
          </a>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
            {t('desktop.privacy')}
          </a>
          {/* 고객센터 = 설정의 문의하기와 같은 창(글 + 스크린샷 1장). 비로그인은 로그인부터 */}
          <button
            type="button"
            className={`${styles.footerLink} ${styles.footerButton}`}
            onClick={() => {
              if (requireLogin()) setShowContact(true);
            }}
          >
            {t('desktop.contact')}
          </button>
        </div>
        <div>&copy; {new Date().getFullYear()} Triptic</div>
      </footer>

      {showContact ? <FeedbackModal onClose={() => setShowContact(false)} /> : null}

      {previewDest && (
        <DestinationPreviewModal
          dest={previewDest}
          onClose={() => setPreviewDest(null)}
          onStart={() => {
            setPreviewDest(null);
            handleStartPlanning(previewDest.city);
          }}
        />
      )}
    </div>
  );
}
