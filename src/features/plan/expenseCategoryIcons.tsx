import type { ReactNode } from 'react';
import { Bus, FerrisWheel, Hotel, Package, ShoppingBag, Utensils } from 'lucide-react';
import type { ExpenseCategory } from './types';

/** 경비 분류 아이콘 — 경비 창과 더치페이 창이 같이 쓴다 */
export const CATEGORY_ICON: Record<ExpenseCategory, ReactNode> = {
  food: <Utensils size={18} />,
  transport: <Bus size={18} />,
  lodging: <Hotel size={18} />,
  shopping: <ShoppingBag size={18} />,
  activity: <FerrisWheel size={18} />,
  other: <Package size={18} />,
};
