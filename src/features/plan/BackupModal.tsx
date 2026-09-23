import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tripService, type LocalProject, type TripRow } from '@/shared/api/tripService';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import styles from './BackupModal.module.css';
import modalStyles from './AddPlaceModal.module.css';
import { Cloud, AlertTriangle, Upload, Download, PartyPopper } from 'lucide-react';

interface BackupModalProps {
  trips: TripRow[];
  onClose: () => void;
  onImported: () => void;
}

/**
 * 기기 동기화 & 백업 (index.html exportAllData/importAllData/mergeImportedProjects 이식)
 * legacy는 localStorage allProjects(이름을 키로 하는 객체) 전체를 JSON으로 주고받았다 —
 * 새 앱도 같은 스키마(제목 → LocalProject)로 내보내/가져와서 legacy 백업 파일과도
 * 호환된다. 이름이 겹치면 무조건 덮어쓰지 않고 선택하게 하는 것도 원본과 동일하다.
 */
export function BackupModal({ trips, onClose, onImported }: BackupModalProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<Record<string, LocalProject> | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [message, setMessage] = useState<React.ReactNode | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  function handleExport() {
    try {
      const obj: Record<string, LocalProject> = {};
      trips.forEach((t) => {
        obj[t.title] = tripService.toLocalProject(t);
      });
      const str = JSON.stringify(obj, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${t('backup.fileNamePrefix')}_${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      captureError(err, { context: 'exportAllData' });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(String(ev.target?.result));
        if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
          throw new Error('Invalid format');
        }
        const names = Object.keys(imported);
        const existingTitles = new Set(trips.map((t) => t.title));
        const conflictNames = names.filter((n) => existingTitles.has(n));
        if (conflictNames.length > 0) {
          setPendingImport(imported);
          setConflicts(conflictNames);
        } else {
          void applyMerge(imported, 'keep');
        }
      } catch {
        setMessage(t('backup.invalidFile'));
      }
    };
    reader.readAsText(file);
  }

  /** mode: 'keep'이면 이름이 겹칠 때 "(가져옴)"을 붙여 둘 다 보관, 'overwrite'면 기존 여행을 덮어쓴다 */
  async function applyMerge(imported: Record<string, LocalProject>, mode: 'keep' | 'overwrite') {
    setImporting(true);
    try {
      const names = Object.keys(imported);
      const existingByTitle = new Map(trips.map((t) => [t.title, t]));
      let count = 0;

      for (const name of names) {
        const project = imported[name];
        if (!project || typeof project !== 'object' || Array.isArray(project)) continue;

        const existing = existingByTitle.get(name);
        if (!existing) {
          await tripService.saveTrip({ ...project, supabaseId: undefined }, name);
        } else if (mode === 'overwrite') {
          await tripService.saveTrip({ ...project, supabaseId: existing.id }, name);
        } else {
          let altName = `${name} ${t('backup.importedSuffix')}`;
          let n = 1;
          while (existingByTitle.has(altName)) altName = `${name} ${t('backup.importedSuffixN', { n: ++n })}`;
          await tripService.saveTrip({ ...project, supabaseId: undefined }, altName);
        }
        count++;
      }

      onImported();
      setPendingImport(null);
      setConflicts([]);
      setMessage(<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><PartyPopper size={18} /> {t('backup.importSuccess', { count })}</span>);
    } catch (err) {
      captureError(err, { context: 'importAllData' });
      setMessage(t('backup.importError'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('backup.title')}
      >
        <h2 className={modalStyles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Cloud size={18} /> {t('backup.title')}</span></h2>

        {pendingImport ? (
          <div className={styles.conflictBox}>
            <p className={styles.conflictTitle}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} /> {t('backup.conflictTitle')}</span></p>
            <p className={styles.conflictDesc}>
              {t('backup.conflictDesc')}{' '}
              <b>
                {conflicts.slice(0, 3).join(', ')}
                {conflicts.length > 3 ? t('backup.conflictMore', { count: conflicts.length - 3 }) : ''}
              </b>{' '}
              {t('backup.conflictQuestion')}
            </p>
            <div className={styles.conflictActions}>
              <button
                type="button"
                className={modalStyles.primary}
                disabled={importing}
                onClick={() => applyMerge(pendingImport, 'keep')}
              >
                {t('backup.keepBoth')}
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                disabled={importing}
                onClick={() => applyMerge(pendingImport, 'overwrite')}
              >
                {t('backup.overwrite')}
              </button>
              <button
                type="button"
                className={modalStyles.secondary}
                onClick={() => {
                  setPendingImport(null);
                  setConflicts([]);
                }}
              >
                {t('action.cancel', { ns: 'common' })}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.desc}>{t('backup.desc')}</p>
            {message ? <p className={styles.message}>{message}</p> : null}
            <button type="button" className={modalStyles.primary} onClick={handleExport}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Upload size={18} /> {t('backup.exportBtn')}</span>
            </button>
            <label className={styles.importLabel}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Download size={18} /> {t('backup.importBtn')}</span>
              <input
                type="file"
                accept="application/json"
                className={styles.fileInput}
                disabled={importing}
                onChange={handleFileChange}
              />
            </label>
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.secondary} onClick={onClose}>
                {t('action.close', { ns: 'common' })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
