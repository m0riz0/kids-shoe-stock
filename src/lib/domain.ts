// 靴ドメインの定数と型。カテゴリ・状態は固定値（PROJECT_BRIEF 準拠）。

export const CATEGORIES = [
  { value: "home", label: "家（登園）" },
  { value: "yard", label: "園庭" },
  { value: "indoor", label: "上履き" },
] as const;

export type ShoeCategory = (typeof CATEGORIES)[number]["value"];

export const STATUSES = [
  { value: "in_use", label: "使用中" },
  { value: "stock", label: "ストック" },
  { value: "outgrown", label: "サイズアウト" },
] as const;

export type ShoeStatus = (typeof STATUSES)[number]["value"];

export const categoryLabel = (c: ShoeCategory) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? c;

export const statusLabel = (s: ShoeStatus) =>
  STATUSES.find((x) => x.value === s)?.label ?? s;

// サイズ選択肢: 11.0cm 〜 25.0cm、0.5cm 刻み
export const SIZE_OPTIONS: number[] = Array.from(
  { length: (25 - 11) * 2 + 1 },
  (_, i) => 11 + i * 0.5
);

export const formatSize = (size: number) =>
  `${size.toFixed(1).replace(/\.0$/, "")}cm`;

export interface Child {
  id: string;
  family_id: string;
  name: string;
  sort_order: number;
}

export interface Shoe {
  id: string;
  child_id: string;
  family_id: string;
  category: ShoeCategory;
  size: number;
  status: ShoeStatus;
  brand: string | null;
  storage_location: string | null;
  storage_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoePhoto {
  id: string;
  shoe_id: string;
  family_id: string;
  storage_path: string;
}
