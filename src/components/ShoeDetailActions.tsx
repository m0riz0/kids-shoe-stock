"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, statusLabel, type Shoe, type ShoeStatus } from "@/lib/domain";

export default function ShoeDetailActions({ shoe }: { shoe: Shoe }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeStatus = async (next: ShoeStatus) => {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("shoes")
      .update({ status: next })
      .eq("id", shoe.id);
    setBusy(false);
    if (error) {
      setError("状態の変更に失敗しました");
      return;
    }
    router.refresh();
  };

  const remove = async () => {
    if (!confirm("この靴を削除しますか？（元に戻せません）")) return;
    setBusy(true);
    const { error } = await supabase.from("shoes").delete().eq("id", shoe.id);
    setBusy(false);
    if (error) {
      setError("削除に失敗しました");
      return;
    }
    router.push("/");
    router.refresh();
  };

  const nextStatuses = STATUSES.filter((s) => s.value !== shoe.status);

  return (
    <div className="space-y-3">
      {/* 状態変更（FR-S-9） */}
      <div className="flex gap-2">
        {nextStatuses.map((s) => (
          <button
            key={s.value}
            onClick={() => changeStatus(s.value)}
            disabled={busy}
            className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm font-bold text-gray-700 active:bg-gray-50 disabled:opacity-50"
          >
            {statusLabel(s.value)}にする
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/shoes/${shoe.id}/edit`}
          className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-center font-bold text-white active:bg-orange-600"
        >
          編集する
        </Link>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 active:bg-red-50 disabled:opacity-50"
        >
          削除
        </button>
      </div>

      {error && (
        <p className="text-center text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
