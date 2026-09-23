import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Search, Plane, Briefcase, Tent, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './HomeDesktop.module.css';

function DestinationPreviewModal({ dest, onClose, onStart, t }: { dest: any, onClose: () => void, onStart: () => void, t: any }) {
  const [desc, setDesc] = useState(dest.desc);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadDesc() {
      setLoading(true);
      try {
        const isNativeApp = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        const apiUrl = import.meta.env.DEV ? `https://triptic-ten.vercel.app/api/cityDesc?city=${encodeURIComponent(dest.title)}` : (isNativeApp ? `https://triptic-ten.vercel.app/api/cityDesc?city=${encodeURIComponent(dest.title)}` : `/api/cityDesc?city=${encodeURIComponent(dest.title)}`);
        
        const res = await fetch(apiUrl);
        const data = await res.json();
        if (data.success && data.description) {
          setDesc(data.description);
        }
      } catch (err) {
        console.error('Failed to load AI city desc:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDesc();
  }, [dest.title]);

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: 500, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <img src={dest.image} style={{ width: '100%', height: 240, objectFit: 'cover' }} alt={dest.title} />
        <div style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 24, color: 'var(--text-heading)' }}>{dest.title}</h2>
          <div style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)', minHeight: 60, lineHeight: 1.6 }}>
            {loading ? <span style={{ opacity: 0.5 }}>{t('desktop.previewLoading', { defaultValue: '✨ AI가 도시 정보를 불러오고 있습니다...' })}</span> : desc}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>{t('desktop.previewCancel', { defaultValue: '취소' })}</button>
            <button onClick={onStart} style={{ padding: '10px 20px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: '999px', cursor: 'pointer', fontWeight: 600 }}>{t('desktop.previewStart', { defaultValue: '이 도시로 계획 만들기' })}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function HomeDesktop() {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const [previewDest, setPreviewDest] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.5;
      scrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const handleStartPlanning = (city?: string) => {
    if (city) {
      navigate(`/plan?autoCreate=${encodeURIComponent(city)}`);
    } else if (searchQuery) {
      navigate(`/plan?autoCreate=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/plan');
    }
  };

  const featuredDestinations = [
    { title: t('desktop.destKyoto') || 'Kyoto, Japan', desc: t('desktop.descKyoto') || 'Ancient temples and traditional tea houses', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1000&auto=format&fit=crop' },
    { title: t('desktop.destParis') || 'Paris, France', desc: t('desktop.descParis') || 'Art, fashion, gastronomy, and culture', image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1000&auto=format&fit=crop' },
    { title: t('desktop.destNY') || 'New York, USA', desc: t('desktop.descNY') || 'The city that never sleeps', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=1000&auto=format&fit=crop' },
    { title: t('desktop.destLondon') || 'London, UK', desc: t('desktop.descLondon') || 'A modern city with a rich history', image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1000&auto=format&fit=crop' },
    { title: t('desktop.destRome') || 'Rome, Italy', desc: t('desktop.descRome') || 'The eternal city of ruins and romance', image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1000&auto=format&fit=crop' },
    { title: t('desktop.destTokyo') || 'Tokyo, Japan', desc: t('desktop.descTokyo') || 'Neon lights and traditional culture', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?q=80&w=1000&auto=format&fit=crop' },
  ];

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <img 
          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=2000&auto=format&fit=crop" 
          alt="Travel background" 
          className={styles.heroBg}
        />
        <div className={styles.heroContent}>
          <div className={styles.searchPill}>
            <Search size={20} color="#0F2942" style={{ marginRight: '12px' }} />
            <input 
              type="text" 
              className={styles.searchInput} 
              placeholder={t('desktop.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartPlanning()}
            />
            <button className={styles.searchBtn} onClick={() => handleStartPlanning()}>
              {t('desktop.startPlanning')}
            </button>
          </div>
          <div className={styles.quickCategories}>
            <a href="https://www.skyscanner.co.kr/" target="_blank" rel="noopener noreferrer" className={styles.categoryPill}><Plane size={16}/> Flights</a>
            <a href="https://www.agoda.com/" target="_blank" rel="noopener noreferrer" className={styles.categoryPill}><Briefcase size={16}/> Stays</a>
            <a href="https://www.klook.com/" target="_blank" rel="noopener noreferrer" className={styles.categoryPill}><Tent size={16}/> Activities</a>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sliderWrapper}>
          <button className={styles.sliderBtnLeft} onClick={() => scroll('left')} aria-label="Scroll left"><ChevronLeft size={24}/></button>
          <div className={styles.grid} ref={scrollRef}>
            {featuredDestinations.map((dest, i) => (
              <div key={i} className={styles.card} onClick={() => setPreviewDest(dest)}>
                <img src={dest.image} alt={dest.title} className={styles.cardImage} />
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{dest.title}</h3>
                  <p className={styles.cardDesc}>{dest.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button className={styles.sliderBtnRight} onClick={() => scroll('right')} aria-label="Scroll right"><ChevronRight size={24}/></button>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>{t('desktop.terms', { defaultValue: '이용약관 (Terms)' })}</a>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>{t('desktop.privacy', { defaultValue: '개인정보처리방침 (Privacy)' })}</a>
          <a href="mailto:support@triptic.com" className={styles.footerLink}>{t('desktop.contact', { defaultValue: '고객센터 (Contact)' })}</a>
        </div>
        <div>&copy; {new Date().getFullYear()} Triptic. All rights reserved.</div>
      </footer>

      {previewDest && (
        <DestinationPreviewModal 
          dest={previewDest} 
          onClose={() => setPreviewDest(null)} 
          onStart={() => {
            setPreviewDest(null);
            handleStartPlanning(previewDest.title);
          }} 
          t={t}
        />
      )}
    </div>
  );
}
