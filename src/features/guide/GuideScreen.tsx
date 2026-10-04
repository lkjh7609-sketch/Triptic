import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Download, ExternalLink, FileText, FileUp, Link2, ListChecks, MapPinned, MessagesSquare, Plane, Printer, Sparkles, Users, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { trackScreenView } from '@/shared/monitoring';
import styles from './GuideScreen.module.css';

const SAMPLE_PDF = '/samples/triptic-sample-tokyo-ko.pdf';
const PDF_PAGES = [1, 2, 3, 4, 5, 6, 7] as const;

type StepKey = 'start' | 'docs' | 'plan' | 'share' | 'companion' | 'community' | 'pdf' | 'before';

const STEPS: { key: StepKey; icon: ReactNode }[] = [
  { key: 'start', icon: <Plane size={26} aria-hidden="true" /> },
  { key: 'docs', icon: <FileUp size={26} aria-hidden="true" /> },
  { key: 'plan', icon: <MapPinned size={26} aria-hidden="true" /> },
  { key: 'share', icon: <Link2 size={26} aria-hidden="true" /> },
  { key: 'companion', icon: <Users size={26} aria-hidden="true" /> },
  { key: 'community', icon: <MessagesSquare size={26} aria-hidden="true" /> },
  { key: 'pdf', icon: <Printer size={26} aria-hidden="true" /> },
  { key: 'before', icon: <ListChecks size={26} aria-hidden="true" /> },
];

/**
 * 사용 가이드 (/guide) — 로그인 없이 누구나 본다. 시작 → 예약 서류 → 장소·동선 → 링크로 함께 편집 → 동행 →
 * 커뮤니티 → PDF 내보내기(하이라이트, 실제 샘플 PDF) → 여행 전·중 순서. 문구는 guide 네임스페이스(4개 언어).
 * 사진은 public/guide(앱 화면 캡처, 샘플 PDF 쪽 미리보기)이고, PDF 파일은 public/samples에 있다.
 */
export default function GuideScreen() {
  const { t } = useTranslation('guide');
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    trackScreenView('guide');
  }, []);

  // 제목·설명은 이 화면에서만 바꾸고 나갈 때 되돌린다(검색 로봇은 api/seo가 같은 문구를 넣어 준다)
  useEffect(() => {
    const prev = document.title;
    document.title = `${t('meta.title')} | Triptic`;
    return () => {
      document.title = prev;
    };
  }, [t]);

  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? i : Math.min(PDF_PAGES.length - 1, i + 1)));
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>{t('hero.eyebrow')}</p>
          <h1 className={styles.heroTitle}>{t('hero.title')}</h1>
          <p className={styles.heroLead}>{t('hero.lead')}</p>
          <div className={styles.heroActions}>
            <a href="#step-pdf" className={styles.primaryBtn}>
              <FileText size={18} aria-hidden="true" /> {t('hero.ctaPdf')}
            </a>
            <Link to="/plan" className={styles.ghostBtn}>
              {t('hero.ctaStart')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <nav className={styles.toc} aria-label={t('toc')}>
        {STEPS.map(({ key }, i) => (
          <a key={key} href={`#step-${key}`} className={`${styles.tocItem} ${key === 'pdf' ? styles.tocItemStar : ''}`}>
            <span className={styles.tocNo}>{i + 1}</span>
            {t(`steps.${key}.title`)}
          </a>
        ))}
      </nav>

      <main className={styles.steps}>
        {STEPS.map(({ key, icon }, i) => {
          const isPdf = key === 'pdf';
          const points = isPdf ? ['p1', 'p2', 'p3', 'p4'] : ['p1', 'p2', 'p3'];
          return (
            <section key={key} id={`step-${key}`} className={`${styles.step} ${isPdf ? styles.stepPdf : ''}`} aria-labelledby={`title-${key}`}>
              <div className={styles.stepHead}>
                <span className={styles.stepIcon}>{icon}</span>
                <div>
                  <p className={styles.stepLabel}>
                    {t('stepLabel', { n: i + 1 })}
                    {isPdf ? <span className={styles.badge}>{t('steps.pdf.badge')}</span> : null}
                  </p>
                  <h2 id={`title-${key}`} className={styles.stepTitle}>
                    {t(`steps.${key}.title`)}
                  </h2>
                </div>
              </div>
              <p className={styles.stepLead}>{t(`steps.${key}.lead`)}</p>
              <ul className={styles.points}>
                {points.map((p) => (
                  <li key={p}>
                    <CheckCircle2 size={18} aria-hidden="true" className={styles.check} />
                    <span>{t(`steps.${key}.${p}`)}</span>
                  </li>
                ))}
              </ul>

              {key === 'plan' ? (
                <figure className={styles.shots}>
                  <img src="/guide/app-trip-pc.webp" alt={t('images.tripPc')} className={styles.shotPc} loading="lazy" width={1100} height={688} />
                  <img src="/guide/app-trip-m.webp" alt={t('images.tripM')} className={styles.shotM} loading="lazy" width={420} height={862} />
                </figure>
              ) : null}

              {key === 'start' ? (
                <div className={styles.inlineActions}>
                  <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={styles.softBtn}>
                    <Sparkles size={16} aria-hidden="true" /> {t('hero.ctaSample')}
                  </Link>
                </div>
              ) : null}

              {isPdf ? (
                <div className={styles.gallery}>
                  <div className={styles.galleryHead}>
                    <div>
                      <h3 className={styles.galleryTitle}>{t('steps.pdf.galleryTitle')}</h3>
                      <p className={styles.galleryHint}>{t('steps.pdf.galleryHint')}</p>
                    </div>
                    <div className={styles.galleryActions}>
                      <a href={SAMPLE_PDF} target="_blank" rel="noopener noreferrer" className={styles.primaryBtn}>
                        <ExternalLink size={16} aria-hidden="true" /> {t('steps.pdf.open')}
                      </a>
                      <a href={SAMPLE_PDF} download className={styles.ghostBtnDark}>
                        <Download size={16} aria-hidden="true" /> {t('steps.pdf.download')}
                      </a>
                    </div>
                  </div>
                  <ul className={styles.thumbs}>
                    {PDF_PAGES.map((n, idx) => (
                      <li key={n}>
                        <button type="button" className={styles.thumb} onClick={() => setLightbox(idx)} aria-label={t('steps.pdf.pageAlt', { n })}>
                          <img src={`/guide/sample-p${n}.webp`} alt="" loading="lazy" width={760} height={Math.round(760 * 1.414)} />
                          <span className={styles.thumbNo}>{n}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.pagesNote}>{t('steps.pdf.pages')}</p>
                </div>
              ) : null}
            </section>
          );
        })}

        <section className={styles.faq} aria-labelledby="guide-faq">
          <h2 id="guide-faq" className={styles.faqTitle}>
            {t('faq.title')}
          </h2>
          {(['1', '2', '3'] as const).map((n) => (
            <details key={n} className={styles.faqItem}>
              <summary>{t(`faq.q${n}`)}</summary>
              <p>{t(`faq.a${n}`)}</p>
            </details>
          ))}
        </section>

        <section className={styles.cta}>
          <CalendarDays size={28} aria-hidden="true" />
          <h2 className={styles.ctaTitle}>{t('cta.title')}</h2>
          <p className={styles.ctaBody}>{t('cta.body')}</p>
          <div className={styles.heroActions}>
            <Link to="/plan" className={styles.primaryBtn}>
              {t('cta.start')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={styles.ghostBtn}>
              {t('cta.sample')}
            </Link>
          </div>
        </section>
      </main>

      {lightbox !== null ? (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={t('steps.pdf.pageAlt', { n: lightbox + 1 })}>
          <button type="button" className={styles.lbClose} onClick={() => setLightbox(null)} aria-label={t('lb.close')}>
            <X size={22} aria-hidden="true" />
          </button>
          {lightbox > 0 ? (
            <button type="button" className={`${styles.lbNav} ${styles.lbPrev}`} onClick={() => setLightbox(lightbox - 1)} aria-label={t('lb.prev')}>
              <ChevronLeft size={26} aria-hidden="true" />
            </button>
          ) : null}
          <img src={`/guide/sample-p${PDF_PAGES[lightbox]}.webp`} alt={t('steps.pdf.pageAlt', { n: lightbox + 1 })} className={styles.lbImg} />
          {lightbox < PDF_PAGES.length - 1 ? (
            <button type="button" className={`${styles.lbNav} ${styles.lbNext}`} onClick={() => setLightbox(lightbox + 1)} aria-label={t('lb.next')}>
              <ChevronRight size={26} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
