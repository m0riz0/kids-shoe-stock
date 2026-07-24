import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "@/components/SettingsClient";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id, families(name)")
    .limit(1)
    .maybeSingle();

  const familyId = membership?.family_id as string;
  const familyName =
    (membership as { families: { name: string } | null } | null)?.families
      ?.name ?? "我が家";

  const { data: members } = await supabase
    .from("family_members")
    .select("user_id, profiles(email, display_name)")
    .eq("family_id", familyId);

  const memberList = ((members ?? []) as unknown as {
    user_id: string;
    profiles: { email: string; display_name: string | null } | null;
  }[]).map((m) => ({
    id: m.user_id,
    label: m.profiles?.display_name || m.profiles?.email || "不明なユーザー",
  }));

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-xl" aria-label="戻る">
          ←
        </Link>
        <h1 className="text-lg font-bold">設定</h1>
      </header>

      <main className="space-y-4 px-4 py-4">
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500">アカウント</h2>
          <p className="mt-2">{user?.email}</p>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-500">家族</h2>
          <p className="mt-2 font-bold">{familyName}</p>
          <ul className="mt-2 space-y-1">
            {memberList.map((m) => (
              <li key={m.id} className="text-sm text-gray-600">
                👤 {m.label}
              </li>
            ))}
          </ul>
        </section>

        <SettingsClient familyId={familyId} />
      </main>
    </div>
  );
}
