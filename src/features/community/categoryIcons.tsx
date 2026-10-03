import { CircleHelp, Lightbulb, Plane, Utensils, type LucideIcon } from 'lucide-react';
import type { PostCategory } from './postMeta';

/** 분류별 선 아이콘(이모지 대신 — 사용자 결정) */
export const CATEGORY_ICONS: Record<PostCategory, LucideIcon> = {
  story: Plane,
  qna: CircleHelp,
  tips: Lightbulb,
  food: Utensils,
};
