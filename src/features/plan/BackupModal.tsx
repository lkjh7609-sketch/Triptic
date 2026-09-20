import { useState } from 'react';
import { tripService, type LocalProject, type TripRow } from '@/shared/api/tripService';
import { captureError } from '@/shared/monitoring';
import styles from './BackupModal.module.css';
import modalStyles from './AddPlaceModal.module.css';

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
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<Record<string, LocalProject> | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

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
      a.download = `Triptic_백업_${today}.json`;
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
        setMessage('올바른 백업 JSON 파일이 아닙니다.');
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
          let altName = `${name} (가져옴)`;
          let n = 1;
          while (existingByTitle.has(altName)) altName = `${name} (가져옴 ${++n})`;
          await tripService.saveTrip({ ...project, supabaseId: undefined }, altName);
        }
        count++;
      }

      onImported();
      setPendingImport(null);
      setConflicts([]);
      setMessage(`🎉 ${count}개의 여행을 불러왔습니다!`);
    } catch (err) {
      captureError(err, { context: 'importAllData' });
      setMessage('가져오는 중 오류가 발생했습니다.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>☁️ 기기 동기화 & 백업</h2>

        {pendingImport ? (
          <div className={styles.conflictBox}>
            <p className={styles.conflictTitle}>⚠️ 이름이 같은 여행이 있습니다</p>
            <p className={styles.conflictDesc}>
              <b>
                {conflicts.slice(0, 3).join(', ')}
                {conflicts.length > 3 ? ` 외 ${conflicts.length - 3}개` : ''}
              </b>
              은(는) 이미 존재하는 여행 이름입니다. 어떻게 처리할까요?
            </p>
            <div className={styles.conflictActions}>
              <button
                type="button"
                className={modalStyles.primary}
                disabled={importing}
                onClick={() => applyMerge(pendingImport, 'keep')}
              >
                둘 다 보관하기
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                disabled={importing}
                onClick={() => applyMerge(pendingImport, 'overwrite')}
              >
                기존 여행 덮어쓰기
              </button>
              <button
                type="button"
                className={modalStyles.secondary}
                onClick={() => {
                  setPendingImport(null);
                  setConflicts([]);
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.desc}>내 모든 여행을 JSON 파일로 내려받거나, 백업 파일에서 다시 불러올 수 있어요.</p>
            {message ? <p className={styles.message}>{message}</p> : null}
            <button type="button" className={modalStyles.primary} onClick={handleExport}>
              📤 백업 파일 내보내기
            </button>
            <label className={styles.importLabel}>
              📥 백업 파일 가져오기
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
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
