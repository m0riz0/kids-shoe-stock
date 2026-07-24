"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsClient({ familyId }: { familyId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const issueInvite = async () => {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("create_family_invite", {
      target_family_id: familyId,
    });
    setBusy(false);
    if (error) {
      setError("招待コードの発行に失敗しました");
      return;
    }
    setInviteCode(data as string);
    setCopied(false);
  };

  const copyCode = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <>
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-500">家族を招待</h2>
        <p className="mt-1 text-sm text-gray-500">
          招待コードを発行して、LINE などで配偶者に共有してください（7日間有効）。
        </p>

        {inviteCode ? (
          <div className="mt-3">
            <button
              onClick={copyCode}
              className="w-full rounded-xl bg-gray-50 py-4 text-center font-mono text-2xl font-bold tracking-widest active:bg-gray-100"
              aria-label="招待コードをコピー"
            >
              {inviteCode}
            </button>
            <p className="mt-1 text-center text-xs text-gray-400">
              {copied ? "コピーしました ✓" : "タップしてコピー"}
            </p>
          </div>
        ) : (
          <button
            onClick={issueInvite}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-orange-500 px-4 py-3 font-bold text-white active:bg-orange-600 disabled:opacity-50"
          >
            招待コードを発行する
          </button>
        )}

        {error && (
          <p className="mt-2 text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <button onClick={signOut} className="w-full py-1 text-sm text-red-600">
          サインアウト
        </button>
      </section>
    </>
  );
}
