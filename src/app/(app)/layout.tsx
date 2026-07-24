import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 認証済み + Family 所属済みユーザー専用のレイアウト。
// 未認証は proxy でも弾かれるが、ここでも検証する（多層防御）。
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  return <div className="mx-auto min-h-dvh max-w-md">{children}</div>;
}
