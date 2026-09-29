import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { flagInvalid } from '@/shared/ui/invalidField';
import { openExternal, openKlookSearch, openMyrealtripSearch, useMyrealtripLink } from '@/features/plan/partnerLinks';
import { ACTIVITY_PROVIDERS, saveActivityProvider, type ActivityProvider } from './activityProviders';
import styles from './SectionScreen.module.css';

interface ActivitySearchFormProps {
  provider: ActivityProvider;
  onProviderChange: (next: ActivityProvider) => void;
}

/**
 * 액티비티 검색 — 제휴사 선택(Klook | 마이리얼트립) + 검색창(키워드 그대로 그 제휴사에서 검색).
 * 액티비티 탭(ActivitiesScreen)과 홈 히어로의 액티비티 탭이 같이 쓴다. 고른 제휴사는 저장되고,
 * 어느 제휴사의 추천을 보여 줄지는 부르는 쪽이 provider로 알아서 정한다.
 */
export function ActivitySearchForm({ provider, onProviderChange }: ActivitySearchFormProps) {
  const { t, i18n } = useTranslation('home');
  const [keyword, setKeyword] = useState('');
  const searchFormRef = useRef<HTMLFormElement>(null);
  // 마이리얼트립 검색은 입력이 잠깐 멈추면 링크를 미리 받아 둔다 — 검색을 누르면 바로 열리게
  // (미리 받아 두지 않으면 클릭 뒤 비동기로 새 탭을 열게 돼 팝업 차단에 걸린다)
  const [typedKeyword, setTypedKeyword] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setTypedKeyword(keyword.trim()), 600);
    return () => window.clearTimeout(id);
  }, [keyword]);
  const prefetchedSearch = useMyrealtripLink(
    provider === 'myrealtrip' && typedKeyword.length >= 2 ? { kind: 'search', q: typedKeyword, placement: 'search' } : null,
  );

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = keyword.trim();
    if (!q) {
      flagInvalid(searchFormRef.current);
      return;
    }
    if (provider === 'myrealtrip') {
      if (prefetchedSearch && typedKeyword === q) openExternal(prefetchedSearch);
      else void openMyrealtripSearch(q, 'search');
    } else void openKlookSearch(q, i18n.language);
  }

  function chooseProvider(next: ActivityProvider) {
    onProviderChange(next);
    saveActivityProvider(next);
  }

  return (
    <>
      <div className={styles.providerToggle} role="group" aria-label={t('activities.providerLabel')}>
        {ACTIVITY_PROVIDERS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={provider === p}
            className={provider === p ? styles.providerOn : styles.providerOff}
            onClick={() => chooseProvider(p)}
          >
            {t(`activities.provider.${p}`)}
          </button>
        ))}
      </div>

      <form ref={searchFormRef} className={styles.searchForm} onSubmit={handleSearch} role="search">
        <Search size={18} className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          className={styles.searchInput}
          placeholder={t('activities.searchPlaceholder')}
          aria-label={t('activities.searchPlaceholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          enterKeyHint="search"
        />
        <button type="submit" className={styles.searchButton}>
          {t('activities.searchButton')}
        </button>
      </form>
    </>
  );
}
