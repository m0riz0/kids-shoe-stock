"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
  formatSize,
  statusLabel,
  type Child,
  type Shoe,
  type ShoeStatus,
} from "@/lib/domain";
import StatusBadge from "@/components/StatusBadge";

const SELECTED_CHILD_KEY = "kss:selectedChildId";

export default function HomeClient({
  childrenList,
  shoes,
}: {
  childrenList: Child[];
  shoes: Shoe[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [showOutgrown, setShowOutgrown] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [busy, setBusy] = useState(false);
  // 楽観的更新: 状態変更を即座に画面へ反映する
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, ShoeStatus>
  >({});

  // 選択中の子供を localStorage から復元する（FR-C-3）。
  // SSR ではストレージを参照できないため、マウント後の復元が必要。
  useEffect(() => {
    const saved = localStorage.getItem(SELECTED_CHILD_KEY);
    const restored =
      saved && childrenList.some((c) => c.id === saved)
        ? saved
        : (childrenList[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部ストア(localStorage)からの初期化はマウント後にしか行えない
    setSelectedChildId(restored);
  }, [childrenList]);

  const selectChild = (id: string) => {
    setSelectedChildId(id);
    localStorage.setItem(SELECTED_CHILD_KEY, id);
  };

  const addChild = async () => {
    if (!newChildName.trim()) return;
    setBusy(true);
    const familyId = childrenList[0]?.family_id ?? (await fetchFamilyId());
    const { error } = await supabase.from("children").insert({
      family_id: familyId,
      name: newChildName.trim(),
      sort_order: childrenList.length,
    });
    setBusy(false);
    if (!error) {
      setNewChildName("");
      setAddingChild(false);
      router.refresh();
    }
  };

  const fetchFamilyId = async (): Promise<string> => {
    const { data } = await supabase
      .from("family_members")
      .select("family_id")
      .limit(1)
      .single();
    return data!.family_id;
  };

  const changeStatus = async (shoe: Shoe, next: ShoeStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [shoe.id]: next }));
    const { error } = await supabase
      .from("shoes")
      .update({ status: next })
      .eq("id", shoe.id);
    if (error) {
      // 失敗時はロールバック
      setStatusOverrides((prev) => {
        const rest = { ...prev };
        delete rest[shoe.id];
        return rest;
      });
    } else {
      router.refresh();
    }
  };

  const effectiveShoes = useMemo(
    () =>
      shoes.map((s) =>
        statusOverrides[s.id] ? { ...s, status: statusOverrides[s.id] } : s
      ),
    [shoes, statusOverrides]
  );

  const childShoes = useMemo(
    () => effectiveShoes.filter((s) => s.child_id === selectedChildId),
    [effectiveShoes, selectedChildId]
  );

  const visibleShoes = useMemo(
    () =>
      showOutgrown
        ? childShoes
        : childShoes.filter((s) => s.status !== "outgrown"),
    [childShoes, showOutgrown]
  );

  // サイズ棚: サイズ昇順にグループ化（FR-L-1, L-2）
  const shelves = useMemo(() => {
    const map = new Map<number, Shoe[]>();
    for (const shoe of visibleShoes) {
      const size = Number(shoe.size);
      if (!map.has(size)) map.set(size, []);
      map.get(size)!.push(shoe);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [visibleShoes]);

  const outgrownCount = childShoes.length - visibleShoes.length;

  return (
    <div className="pb-24">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-3">
          <h1 className="text-lg font-bold">👟 靴ストック</h1>
          <Link
            href="/settings"
            className="rounded-full p-2 text-xl"
            aria-label="設定"
          >
            ⚙️
          </Link>
        </div>

        {/* 子供切り替えタブ（FR-C-2） */}
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {childrenList.map((child) => (
            <button
              key={child.id}
              onClick={() => selectChild(child.id)}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-bold transition-colors ${
                child.id === selectedChildId
                  ? "bg-orange-500 text-white"
                  : "bg-white text-gray-600 border border-gray-300"
              }`}
            >
              {child.name}
            </button>
          ))}
          <button
            onClick={() => setAddingChild(true)}
            className="shrink-0 rounded-full border border-dashed border-gray-400 px-4 py-2 text-sm text-gray-500"
            aria-label="子供を追加"
          >
            ＋
          </button>
        </div>
      </header>

      {/* 子供追加フォーム */}
      {addingChild && (
        <div className="mx-4 mt-4 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm font-bold">子供を追加</p>
          <div className="mt-2 flex gap-2">
            <input
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              placeholder="名前（例: 長男）"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              autoFocus
            />
            <button
              onClick={addChild}
              disabled={busy || !newChildName.trim()}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              追加
            </button>
            <button
              onClick={() => setAddingChild(false)}
              className="rounded-lg px-2 py-2 text-sm text-gray-500"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 空状態 */}
      {childrenList.length === 0 && !addingChild && (
        <div className="mt-20 px-6 text-center">
          <p className="text-4xl">🧒</p>
          <p className="mt-4 font-bold">まず子供を登録しましょう</p>
          <button
            onClick={() => setAddingChild(true)}
            className="mt-4 rounded-xl bg-orange-500 px-6 py-3 font-bold text-white"
          >
            子供を追加する
          </button>
        </div>
      )}

      {childrenList.length > 0 && childShoes.length === 0 && (
        <div className="mt-20 px-6 text-center">
          <p className="text-4xl">👟</p>
          <p className="mt-4 font-bold">まだ靴が登録されていません</p>
          <p className="mt-1 text-sm text-gray-500">
            右下の「＋」から最初の靴を登録しましょう
          </p>
        </div>
      )}

      {/* サイズ棚一覧 */}
      <main className="space-y-4 px-4 pt-4">
        {shelves.map(([size, sizeShoes]) => (
          <section key={size} className="rounded-xl bg-white shadow-sm">
            <h2 className="border-b border-gray-100 px-4 py-2.5 text-lg font-bold">
              {formatSize(size)}
            </h2>
            <ul>
              {CATEGORIES.map((cat) => {
                const catShoes = sizeShoes.filter(
                  (s) => s.category === cat.value
                );
                return (
                  <li
                    key={cat.value}
                    className="flex items-center border-b border-gray-50 px-4 py-2.5 last:border-b-0"
                  >
                    <span className="w-24 shrink-0 text-sm text-gray-600">
                      {cat.label}
                    </span>
                    {catShoes.length === 0 ? (
                      // 「なし」を明示する（FR-L-4）
                      <span className="text-sm text-gray-300">なし</span>
                    ) : (
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        {catShoes.map((shoe) => (
                          <ShoeRow
                            key={shoe.id}
                            shoe={shoe}
                            onChangeStatus={changeStatus}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {/* サイズアウト表示トグル（FR-L-5） */}
        {(outgrownCount > 0 || showOutgrown) && (
          <button
            onClick={() => setShowOutgrown((v) => !v)}
            className="w-full py-2 text-center text-sm text-gray-500 underline"
          >
            {showOutgrown
              ? "サイズアウトを隠す"
              : `サイズアウトを表示（${outgrownCount}件）`}
          </button>
        )}
      </main>

      {/* 登録 FAB */}
      <Link
        href={selectedChildId ? `/shoes/new?child=${selectedChildId}` : "#"}
        aria-disabled={!selectedChildId}
        className={`fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full text-3xl font-light text-white shadow-lg ${
          selectedChildId ? "bg-orange-500 active:bg-orange-600" : "bg-gray-300 pointer-events-none"
        }`}
        aria-label="靴を登録"
      >
        ＋
      </Link>
    </div>
  );
}

function ShoeRow({
  shoe,
  onChangeStatus,
}: {
  shoe: Shoe;
  onChangeStatus: (shoe: Shoe, next: ShoeStatus) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // 1タップ状態変更の遷移先候補（FR-S-9）
  const nextStatuses: ShoeStatus[] = (
    ["in_use", "stock", "outgrown"] as ShoeStatus[]
  ).filter((s) => s !== shoe.status);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={`状態を変更（現在: ${statusLabel(shoe.status)}）`}
      >
        <StatusBadge status={shoe.status} />
      </button>

      {menuOpen && (
        <div className="flex gap-1">
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => {
                onChangeStatus(shoe, s);
                setMenuOpen(false);
              }}
              className="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600 active:bg-gray-100"
            >
              → {statusLabel(s)}
            </button>
          ))}
        </div>
      )}

      {!menuOpen && (
        <Link
          href={`/shoes/${shoe.id}`}
          className="flex min-w-0 flex-1 items-center justify-between gap-2"
        >
          <span className="truncate text-xs text-gray-400">
            {[shoe.brand, shoe.storage_location].filter(Boolean).join(" · ") ||
              "詳細"}
          </span>
          <span className="text-gray-300">›</span>
        </Link>
      )}
    </div>
  );
}
