"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const passwordAuthEnabled =
  process.env.NEXT_PUBLIC_ENABLE_PASSWORD_AUTH === "true";

// Supabase Auth のエラーを利用者向けの日本語に変換する。
// 未知のエラーは原因調査できるよう原文を併記する。
function authErrorMessage(mode: "signin" | "signup", message: string): string {
  if (/at least 6 characters|password.*short|weak.*password/i.test(message)) {
    return "パスワードは6文字以上にしてください";
  }
  if (/already registered|already been registered/i.test(message)) {
    return "このメールアドレスは登録済みです。「サインイン」をお試しください";
  }
  if (/invalid login credentials/i.test(message)) {
    return "メールアドレスまたはパスワードが違います";
  }
  if (/is invalid/i.test(message) && mode === "signup") {
    return "メールアドレスの形式が正しくありません";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "試行回数が多すぎます。しばらく待ってからやり直してください";
  }
  const base =
    mode === "signin" ? "サインインに失敗しました" : "サインアップに失敗しました";
  return `${base}（${message}）`;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signInWithGoogle = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError("Google サインインを開始できませんでした");
      setBusy(false);
    }
  };

  const signInWithPassword = async (mode: "signin" | "signup") => {
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) {
      setError(authErrorMessage(mode, error.message));
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <p className="text-5xl">👟</p>
        <h1 className="mt-3 text-2xl font-bold">Kids Shoe Stock</h1>
        <p className="mt-2 text-sm text-gray-500">
          子供の靴のストックを、家族で管理
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 font-medium text-gray-800 shadow-sm active:bg-gray-50 disabled:opacity-50"
        >
          <GoogleIcon />
          Google でサインイン
        </button>

        {passwordAuthEnabled && (
          <div className="rounded-xl border border-dashed border-gray-300 p-4">
            <p className="mb-3 text-xs font-medium text-gray-400">
              開発用サインイン
            </p>
            <div className="space-y-2">
              <input
                type="email"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                autoComplete="current-password"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => signInWithPassword("signin")}
                  disabled={busy || !email || !password}
                  className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  サインイン
                </button>
                <button
                  onClick={() => signInWithPassword("signup")}
                  disabled={busy || !email || !password}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  新規登録
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
