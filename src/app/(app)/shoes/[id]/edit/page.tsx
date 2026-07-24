import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Child, Shoe } from "@/lib/domain";
import ShoeForm from "@/components/ShoeForm";

export default async function EditShoePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: shoe }, { data: children }] = await Promise.all([
    supabase.from("shoes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("children")
      .select("id, family_id, name, sort_order")
      .order("sort_order")
      .order("created_at"),
  ]);

  if (!shoe) notFound();

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur">
        <Link href={`/shoes/${id}`} className="text-xl" aria-label="戻る">
          ←
        </Link>
        <h1 className="text-lg font-bold">靴を編集</h1>
      </header>
      <ShoeForm
        childrenList={(children ?? []) as Child[]}
        initialChildId={(shoe as Shoe).child_id}
        shoe={shoe as Shoe}
      />
    </div>
  );
}
