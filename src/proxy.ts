import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// セッションのリフレッシュと未認証リダイレクト。
// 認可の本体は Supabase RLS が担う（proxy はあくまで楽観的チェック）。
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims はローカルで JWT を検証する（getUser のような往復が発生しない）
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = !!data?.claims;

  const { pathname } = request.nextUrl;
  const isPublicPath =
    pathname.startsWith("/login") || pathname.startsWith("/auth");

  if (!isAuthenticated && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // 静的アセット等を除くすべてのパス
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
