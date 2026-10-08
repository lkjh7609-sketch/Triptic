import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './HotelSearchWidget.module.css';

/**
 * 웹(앱이 아닌 브라우저)의 호텔 검색 — 제휴사가 제공하는 검색창 위젯(반응형)을 그대로 넣는다. 자동완성·검색 결과는 위젯이 처리하고
 * 결과 페이지는 제휴사 사이트에서 열린다. 앱에서는 이 위젯 대신 우리 화면의 검색·필터를 쓴다(HotelsScreen).
 * 위젯 코드는 제휴 포털에서 만든 것이고 Cid·ReferenceKey 등은 위젯 설정값이라 비밀이 아니다(브라우저에 그대로 내려간다).
 */
const SCRIPT_SRC = 'https://cdn0.agoda.net/images/sherpa/js/sherpa_init1_08.min.js';
const CONTAINER_ID = 'adgshp475988994';

const WIDGET_LANGUAGE = { ko: 'ko-kr', en: 'en-us', ja: 'ja-jp', 'zh-TW': 'zh-tw' } as const;

/** 표시 언어 → 위젯 언어 코드 */
export function widgetLanguage(language: string): (typeof WIDGET_LANGUAGE)[keyof typeof WIDGET_LANGUAGE] {
  if (language.startsWith('ko')) return WIDGET_LANGUAGE.ko;
  if (language.startsWith('ja')) return WIDGET_LANGUAGE.ja;
  if (language.startsWith('zh')) return WIDGET_LANGUAGE['zh-TW'];
  return WIDGET_LANGUAGE.en;
}

interface SherpaSettings {
  crt: string;
  version: string;
  id: string;
  name: string;
  width: string;
  height: string;
  ReferenceKey: string;
  Layout: string;
  Language: string;
  Cid: string;
  DestinationName: string;
  OverideConf: boolean;
}

type SherpaCtor = new (settings: SherpaSettings) => { initialize: () => void };

function loadScript(): Promise<void> {
  const w = window as unknown as { AgdSherpa?: SherpaCtor };
  if (w.AgdSherpa) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('widget script failed')), { once: true });
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

export function HotelSearchWidget() {
  const { i18n } = useTranslation();
  const language = widgetLanguage(i18n.language);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    // 언어가 바뀌면 위젯 칸을 비우고 새 언어로 다시 만든다
    host.replaceChildren();
    const mount = document.createElement('div');
    mount.id = CONTAINER_ID;
    host.appendChild(mount);
    loadScript()
      .then(() => {
        const Sherpa = (window as unknown as { AgdSherpa?: SherpaCtor }).AgdSherpa;
        if (cancelled || !Sherpa) return;
        new Sherpa({
          crt: '7180842352289',
          version: '1.04',
          id: CONTAINER_ID,
          name: CONTAINER_ID,
          width: '1012px',
          height: '286px',
          ReferenceKey: 'aVtGLJJNMZRrF0vtICWNQg==',
          Layout: 'Oneline',
          Language: language,
          Cid: '1976105',
          DestinationName: '',
          OverideConf: false,
        }).initialize();
      })
      .catch(() => {
        // 스크립트를 못 불러오면(차단·오프라인) 칸만 비어 있다
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  return <div ref={hostRef} className={styles.host} />;
}
