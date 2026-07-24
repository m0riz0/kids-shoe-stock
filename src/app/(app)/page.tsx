import { createClient } from "@/lib/supabase/server";
import type { Child, Shoe } from "@/lib/domain";
import HomeClient from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  // 家族全体の子供と靴を一括取得し、子供の切り替えはクライアント側で行う
  // （切り替え時に再フェッチしない: NFR-P-2）
  const [{ data: children }, { data: shoes }] = await Promise.all([
    supabase
      .from("children")
      .select("id, family_id, name, sort_order")
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("shoes")
      .select(
        "id, child_id, family_id, category, size, status, brand, storage_location, storage_note, created_at, updated_at"
      )
      .order("size"),
  ]);

  return (
    <HomeClient
      childrenList={(children ?? []) as Child[]}
      shoes={(shoes ?? []) as Shoe[]}
    />
  );
}
