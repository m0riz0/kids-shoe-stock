"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 初回サインイン後、所属 Family がない場合の導線。
// 「家族を新しく作る」か「招待コードで参加する」を選ぶ。
export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createFamily = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("create_family");
    if (error) {
      setError("家族の作成に失敗しました。もう一度お試しください");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  const joinFamily = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("join_family_by_code", {
      invite_code: code,
    });
    if (error) {
      const msg = error.message.includes("code_expired")
        ? "招待コードの有効期限が切れています"
        : error.message.includes("code_already_used")
          ? "この招待コードは使用済みです"
          : "招待コードが正しくありません";
      setError(msg);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <p className="text-4xl">👨‍👩‍👦‍👦</p>
        <h1 className="mt-3 text-xl font-bold">はじめに</h1>
        <p className="mt-2 text-sm text-gray-500">
          靴のデータは家族単位で共有されます
        </p>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-bold">家族を新しく作る</h2>
          <p className="mt-1 text-sm text-gray-500">
            最初の1人はこちら。あとから配偶者を招待できます。
          </p>
          <button
            onClick={createFamily}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-white active:bg-orange-600 disabled:opacity-50"
          >
            家族を作成する
          </button>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-bold">招待コードで参加する</h2>
          <p className="mt-1 text-sm text-gray-500">
            家族から共有された8桁のコードを入力してください。
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="例: A2B3C4D5"
            maxLength={8}
            className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-3 text-center font-mono text-lg tracking-widest"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <button
            onClick={joinFamily}
            disabled={busy || code.length !== 8}
            className="mt-3 w-full rounded-xl border border-orange-500 px-4 py-3 font-bold text-orange-600 active:bg-orange-50 disabled:opacity-50"
          >
            参加する
          </button>
        </section>

        {error && (
          <p className="text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
