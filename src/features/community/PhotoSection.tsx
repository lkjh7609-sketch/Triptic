import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Check, ImagePlus, Plus, X } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PostPhoto, UploadProgress } from './usePostPhotos';
import styles from './PhotoSection.module.css';

interface PhotoSectionProps {
  photos: PostPhoto[];
  progress: UploadProgress | null;
  max: number;
  /** PC 레이아웃(끌어다 놓는 큰 영역·카드 머리글) */
  desktop: boolean;
  onFiles: (files: File[]) => void;
  onCancel: () => void;
  onRemove: (storagePath: string) => void;
  onMove: (from: number, to: number) => void;
}

const RING = 91; // 반지름 14.5 원의 둘레(2πr)

function SortableThumb({ photo, index, onRemove }: { photo: PostPhoto; index: number; onRemove: (storagePath: string) => void }) {
  const { t } = useTranslation('community');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.storagePath });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.thumb} ${index === 0 ? styles.thumbCover : ''} ${isDragging ? styles.thumbDragging : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <img src={photo.previewUrl} alt="" className={styles.thumbImg} draggable={false} />
      {index === 0 ? <span className={styles.coverBadge}>{t('compose.photo.cover')}</span> : null}
      <button
        type="button"
        className={styles.remove}
        // 지우기 버튼을 눌러도 드래그가 시작되지 않게
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={() => onRemove(photo.storagePath)}
        aria-label={t('compose.photo.remove')}
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * 글쓰기 사진 영역(시안): 비어 있을 때 큰 추가 영역(PC는 끌어다 놓기), 올리는 중에는 진행 카드(n/m·% ·취소)와 썸네일 줄,
 * 다 올린 뒤에는 썸네일 줄(첫 사진이 대표, ×로 삭제, 끌어서 순서 바꾸기). 사진은 올릴 때 줄여서(장변 1600px, WebP) 저장된다.
 */
export function PhotoSection({ photos, progress, max, desktop, onFiles, onCancel, onRemove, onMove }: PhotoSectionProps) {
  const { t } = useTranslation('community');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // 손가락으로 줄을 옆으로 넘기는 것과 구분하려고 잠깐 눌러야 집어 올려진다
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function pickFiles() {
    inputRef.current?.click();
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) onFiles(files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (progress) return;
    onFiles(Array.from(e.dataTransfer.files));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = photos.findIndex((p) => p.storagePath === active.id);
    const to = photos.findIndex((p) => p.storagePath === over.id);
    onMove(from, to);
  }

  const empty = photos.length === 0 && !progress;
  const percent = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const currentIndex = progress ? progress.done + 1 : 0;
  const queued = progress ? Math.max(0, progress.total - progress.done - 1) : 0;

  return (
    <section
      className={`${styles.section} ${desktop ? styles.sectionDesktop : ''} ${dragOver ? styles.dragOver : ''}`}
      aria-label={t('compose.photo.title')}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {desktop ? (
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>
            {t('compose.photo.title')} <span className={styles.cardTitleSub}>{t('compose.photo.max', { max })}</span>
          </h2>
          <span className={styles.cardHint}>{t('compose.photo.coverHint')}</span>
        </div>
      ) : null}

      {empty ? (
        <button type="button" className={desktop ? styles.dropzone : styles.emptyBox} onClick={pickFiles}>
          <span className={styles.emptyIcon}>
            {desktop ? <ImagePlus size={26} aria-hidden="true" /> : <Camera size={22} aria-hidden="true" />}
          </span>
          {desktop ? (
            <>
              <span className={styles.emptyTitle}>{t('compose.photo.dropTitle')}</span>
              <span className={styles.emptyDesc}>{t('compose.photo.dropHint')}</span>
              <span className={styles.findBtn}>
                <Plus size={16} aria-hidden="true" />
                {t('compose.photo.findOnPc')}
              </span>
            </>
          ) : (
            <>
              <span className={styles.emptyTitle}>
                {t('compose.photo.add')} <span className={styles.emptyTitleSub}>{t('compose.photo.max', { max })}</span>
              </span>
              <span className={styles.emptyDesc}>{t('compose.photo.emptyHint')}</span>
            </>
          )}
        </button>
      ) : null}

      {progress ? (
        <div className={styles.uploading}>
          <div className={styles.progressCard}>
            <div className={styles.shimmer} aria-hidden="true" />
            <div className={styles.progressTop}>
              <span className={styles.progressTitle}>
                <span className={styles.ping} aria-hidden="true">
                  <span className={styles.pingWave} />
                  <span className={styles.pingDot} />
                </span>
                {t('compose.photo.processing')}{' '}
                <span className={styles.progressCount}>
                  ({currentIndex > progress.total ? progress.total : currentIndex}/{progress.total})
                </span>
              </span>
              <button type="button" className={styles.cancelUpload} onClick={onCancel}>
                {t('compose.photo.cancelUpload')}
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.progressBody}>
              <div className={styles.ringWrap}>
                <svg viewBox="0 0 36 36" className={styles.ring} aria-hidden="true">
                  <circle cx="18" cy="18" r="14.5" fill="none" strokeWidth="3" className={styles.ringTrack} />
                  <circle
                    cx="18"
                    cy="18"
                    r="14.5"
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={RING}
                    strokeDashoffset={RING - (RING * percent) / 100}
                    className={styles.ringFill}
                  />
                </svg>
                <span className={styles.ringLabel}>{percent}%</span>
              </div>
              <div className={styles.barWrap}>
                <span className={styles.barText}>{t('compose.photo.optimizing')}</span>
                <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('compose.photo.processing')}>
                  <div className={styles.barFill} style={{ width: `${percent}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.stripHead}>
            <span>{t('compose.photo.progressStatus', { done: progress.done, total: progress.total })}</span>
          </div>
          <div className={styles.strip}>
            {photos.map((p, i) => (
              <div key={p.storagePath} className={`${styles.thumb} ${styles.thumbSmall} ${i === 0 ? styles.thumbCover : ''}`}>
                <img src={p.previewUrl} alt="" className={styles.thumbImg} draggable={false} />
                {i === 0 ? <span className={styles.coverBadge}>{t('compose.photo.cover')}</span> : null}
                <span className={styles.doneMark}>
                  <Check size={10} strokeWidth={3} aria-hidden="true" />
                </span>
              </div>
            ))}
            <div className={`${styles.tile} ${styles.tileBusy}`}>
              <span className={styles.spinner} aria-hidden="true" />
              <span className={styles.tileLabel}>{t('compose.photo.uploadingTile')}</span>
            </div>
            {Array.from({ length: queued }, (_, i) => (
              <div key={i} className={`${styles.tile} ${styles.tileQueued}`}>
                <Plus size={16} aria-hidden="true" />
                <span className={styles.tileLabel}>{t('compose.photo.queued', { n: currentIndex + 1 + i, total: progress.total })}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {photos.length > 0 && !progress ? (
        <div className={styles.filled}>
          <div className={styles.stripHead}>
            <span>
              {t('compose.photo.registered', { count: photos.length, max })}
            </span>
            <span className={styles.stripHint}>{t('compose.photo.dragHint')}</span>
          </div>
          <div className={styles.strip}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              accessibility={{ screenReaderInstructions: { draggable: t('compose.photo.dragHelp') } }}
            >
              <SortableContext items={photos.map((p) => p.storagePath)} strategy={horizontalListSortingStrategy}>
                {photos.map((p, i) => (
                  <SortableThumb key={p.storagePath} photo={p} index={i} onRemove={onRemove} />
                ))}
              </SortableContext>
            </DndContext>
            {photos.length < max ? (
              <button type="button" className={styles.addTile} onClick={pickFiles}>
                <Plus size={18} aria-hidden="true" />
                <span>{t('compose.photo.addTile')}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <input ref={inputRef} type="file" accept="image/*" multiple className={styles.hiddenInput} onChange={handleInput} />
    </section>
  );
}
