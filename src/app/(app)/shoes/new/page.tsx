import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Child } from "@/lib/domain";
import ShoeForm from "@/components/ShoeForm";

export default async function NewShoePage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { child } = await searchParams;
  const supabase = await createClient();

  const { data: children } = await supabase
    .from("children")
    .select("id, family_id, name, sort_order")
    .order("sort_order")
    .order("created_at");

  const childrenList = (children ?? []) as Child[];
  const initialChildId =
    childrenList.find((c) => c.id === child)?.id ?? childrenList[0]?.id ?? "";

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-xl" aria-label="戻る">
          ←
        </Link>
        <h1 className="text-lg font-bold">靴を登録</h1>
      </header>
      <ShoeForm childrenList={childrenList} initialChildId={initialChildId} />
    </div>
  );
}
