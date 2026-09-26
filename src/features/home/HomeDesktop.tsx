import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Search, Plane, Briefcase, Tent, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useDestinations } from '@/features/community/hooks/useDestinations';
import { apiUrl } from '@/shared/api/apiUrl';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { CONTACT_EMAIL } from '@/shared/config';
import { captureError } from '@/shared/monitoring';
import { useHomeStats } from './useHomeStats';
import { StatsTiles } from './StatsTiles';
import styles from './HomeDesktop.module.css';

interface FeaturedDestination {
  /** 번역 키 접미사 (home:desktop.dest{key}/desc{key}) */
  key: 'Kyoto' | 'Paris' | 'NY' | 'London' | 'Rome' | 'Tokyo';
  /** 여행 만들기·AI 소개에 넘기는 도시명(Google Places 검색이 잘 되는 영어 이름) */
  city: string;
  image: string;
}

const FEATURED: FeaturedDestination[] = [
  { key: 'Kyoto', city: 'Kyoto, Japan', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1000&auto=format&fit=crop' },
  { key: 'Paris', city: 'Paris, France', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1000&auto=format&fit=crop' },
  { key: 'NY', city: 'New York, USA', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=1000&auto=format&fit=crop' },
  { key: 'London', city: 'London, UK', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1000&auto=format&fit=crop' },
  { key: 'Rome', city: 'Rome, Italy', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1000&auto=format&fit=crop' },
  { key: 'Tokyo', city: 'Tokyo, Japan', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1000&auto=format&fit=crop' },
];

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
  const [aiDesc, setAiDesc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 모달은 여행지마다 새로 마운트되므로(열 때마다 조건부 렌더) 초기 state가 곧 로딩 상태다
    const controller = new AbortController();
    fetch(apiUrl(`/api/cityDesc?city=${encodeURIComponent(dest.city)}&locale=${encodeURIComponent(locale)}`), {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { description?: string } | null) => {
        if (data?.description) setAiDesc(data.description);
      })
      .catch((err) => {
        if (!controller.signal.aborted) captureError(err, { context: 'homeDesktop.cityDesc' });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [dest.city, locale]);

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose}>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const stats = useHomeStats();
  const { data: destinations } = useDestinations();

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

          <div className={styles.quickCategories}>
            <a href="https://www.skyscanner.co.kr/" target="_blank" rel="noopener noreferrer" className={styles.categoryPill}>
              <Plane size={16} aria-hidden="true" /> {t('desktop.flights')}
            </a>
            <a href="https://www.agoda.com/" target="_blank" rel="noopener noreferrer" className={styles.categoryPill}>
              <Briefcase size={16} aria-hidden="true" /> {t('desktop.stays')}
            </a>
            <a href="https://www.klook.com/" target="_blank" rel="noopener noreferrer" className={styles.categoryPill}>
              <Tent size={16} aria-hidden="true" /> {t('desktop.activities')}
            </a>
          </div>

          {stats.data ? (
            <div className={styles.statsWrap}>
              <StatsTiles stats={stats.data} />
            </div>
          ) : null}
        </div>
      </section>

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

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
            {t('desktop.terms')}
          </a>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
            {t('desktop.privacy')}
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className={styles.footerLink}>
            {t('desktop.contact')}
          </a>
        </div>
        <div>&copy; {new Date().getFullYear()} Triptic</div>
      </footer>

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
