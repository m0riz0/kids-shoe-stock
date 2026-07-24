"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import {
  CATEGORIES,
  SIZE_OPTIONS,
  STATUSES,
  formatSize,
  type Child,
  type Shoe,
  type ShoeCategory,
  type ShoeStatus,
} from "@/lib/domain";

interface Props {
  childrenList: Child[];
  initialChildId: string;
  /** 編集時のみ */
  shoe?: Shoe;
}

export default function ShoeForm({ childrenList, initialChildId, shoe }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [childId, setChildId] = useState(shoe?.child_id ?? initialChildId);
  const [size, setSize] = useState<number>(shoe ? Number(shoe.size) : 15);
  const [category, setCategory] = useState<ShoeCategory>(
    shoe?.category ?? "home"
  );
  const [status, setStatus] = useState<ShoeStatus>(shoe?.status ?? "stock");
  const [brand, setBrand] = useState(shoe?.brand ?? "");
  const [storageLocation, setStorageLocation] = useState(
    shoe?.storage_location ?? ""
  );
  const [storageNote, setStorageNote] = useState(shoe?.storage_note ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);

    try {
      const values = {
        child_id: childId,
        // family_id は DB トリガーが child から強制設定する
        family_id: childrenList.find((c) => c.id === childId)!.family_id,
        category,
        size,
        status,
        brand: brand.trim() || null,
        storage_location: storageLocation.trim() || null,
        storage_note: storageNote.trim() || null,
      };

      let shoeId = shoe?.id;
      let familyId: string;

      if (shoe) {
        const { error } = await supabase
          .from("shoes")
          .update(values)
          .eq("id", shoe.id);
        if (error) throw error;
        familyId = shoe.family_id;
      } else {
        const { data, error } = await supabase
          .from("shoes")
          .insert(values)
          .select("id, family_id")
          .single();
        if (error) throw error;
        shoeId = data.id;
        familyId = data.family_id;
      }

      // 写真: 圧縮して Storage へ。パス規約 {family_id}/{shoe_id}/{ts}.jpg
      if (photoFile && shoeId) {
        const blob = await compressImage(photoFile);
        const path = `${familyId!}/${shoeId}/${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("shoe-photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;

        const { error: photoError } = await supabase
          .from("shoe_photos")
          .insert({ shoe_id: shoeId, family_id: familyId!, storage_path: path });
        if (photoError) throw photoError;
      }

      router.push("/");
      router.refresh();
    } catch {
      // 入力値は state に保持されたまま（UC-3 受け入れ基準）
      setError("保存に失敗しました。通信環境を確認してもう一度お試しください");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 px-4 py-4">
      {/* 子供 */}
      <Field label="子供" required>
        <div className="flex gap-2">
          {childrenList.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => setChildId(child.id)}
              className={segmentClass(child.id === childId)}
            >
              {child.name}
            </button>
          ))}
        </div>
      </Field>

      {/* サイズ（選択式: FR-S-3） */}
      <Field label="サイズ" required>
        <select
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-lg font-bold"
        >
          {SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {formatSize(s)}
            </option>
          ))}
        </select>
      </Field>

      {/* カテゴリ */}
      <Field label="カテゴリ" required>
        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={segmentClass(cat.value === category)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </Field>

      {/* 状態 */}
      <Field label="状態" required>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={segmentClass(s.value === status)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      {/* 任意項目 */}
      <Field label="ブランド">
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="例: ニューバランス"
          className="w-full rounded-xl border border-gray-300 px-4 py-3"
        />
      </Field>

      <Field label="保管場所">
        <input
          value={storageLocation}
          onChange={(e) => setStorageLocation(e.target.value)}
          placeholder="例: 押入れ上段"
          className="w-full rounded-xl border border-gray-300 px-4 py-3"
        />
      </Field>

      <Field label="保管場所メモ">
        <textarea
          value={storageNote}
          onChange={(e) => setStorageNote(e.target.value)}
          placeholder="例: 青い収納ボックスの中"
          rows={2}
          className="w-full rounded-xl border border-gray-300 px-4 py-3"
        />
      </Field>

      <Field label="写真">
        <label className="flex h-28 cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPreview}
              alt="選択した写真"
              className="h-full w-full rounded-xl object-cover"
            />
          ) : (
            <span className="text-sm text-gray-400">📷 タップして撮影・選択</span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPickPhoto}
            className="hidden"
          />
        </label>
      </Field>

      {error && (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={save}
        disabled={busy || !childId}
        className="w-full rounded-xl bg-orange-500 px-4 py-4 text-lg font-bold text-white active:bg-orange-600 disabled:opacity-50"
      >
        {busy ? "保存中..." : shoe ? "更新する" : "登録する"}
      </button>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-bold text-gray-700">
        {label}
        {required && <span className="ml-1 text-orange-500">*</span>}
      </p>
      {children}
    </div>
  );
}

function segmentClass(active: boolean) {
  return `flex-1 rounded-xl border px-3 py-3 text-sm font-bold ${
    active
      ? "border-orange-500 bg-orange-50 text-orange-600"
      : "border-gray-300 bg-white text-gray-500"
  }`;
}
