import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  categoryLabel,
  formatSize,
  type Shoe,
  type ShoePhoto,
} from "@/lib/domain";
import StatusBadge from "@/components/StatusBadge";
import ShoeDetailActions from "@/components/ShoeDetailActions";

export default async function ShoeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: shoeData }, { data: photos }, { data: child }] =
    await Promise.all([
      supabase.from("shoes").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("shoe_photos")
        .select("id, shoe_id, family_id, storage_path")
        .eq("shoe_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("shoes")
        .select("children(name)")
        .eq("id", id)
        .maybeSingle(),
    ]);

  if (!shoeData) notFound();
  const shoe = shoeData as Shoe;
  const childName =
    (child as { children: { name: string } | null } | null)?.children?.name ??
    "";

  // 非公開バケットのため署名 URL で表示（1時間有効）
  const photoUrls: string[] = [];
  for (const photo of (photos ?? []) as ShoePhoto[]) {
    const { data } = await supabase.storage
      .from("shoe-photos")
      .createSignedUrl(photo.storage_path, 3600);
    if (data?.signedUrl) photoUrls.push(data.signedUrl);
  }

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur">
        <Link href="/" className="text-xl" aria-label="戻る">
          ←
        </Link>
        <h1 className="text-lg font-bold">
          {formatSize(Number(shoe.size))} {categoryLabel(shoe.category)}
        </h1>
      </header>

      <main className="space-y-4 px-4 py-4">
        {photoUrls.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrls[0]}
            alt="靴の写真"
            className="w-full rounded-2xl object-cover shadow-sm"
          />
        )}

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <dl className="space-y-3">
            <Row label="子供" value={childName} />
            <Row label="サイズ" value={formatSize(Number(shoe.size))} />
            <Row label="カテゴリ" value={categoryLabel(shoe.category)} />
            <div className="flex items-center justify-between">
              <dt className="text-sm text-gray-500">状態</dt>
              <dd>
                <StatusBadge status={shoe.status} />
              </dd>
            </div>
            <Row label="ブランド" value={shoe.brand ?? "未設定"} />
            <Row
              label="保管場所"
              value={shoe.storage_location ?? "未設定"}
              emphasize
            />
            {shoe.storage_note && (
              <div>
                <dt className="text-sm text-gray-500">保管場所メモ</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm">
                  {shoe.storage_note}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <ShoeDetailActions shoe={shoe} />
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-sm text-gray-500">{label}</dt>
      <dd
        className={`truncate ${emphasize ? "font-bold" : ""} ${
          value === "未設定" ? "text-gray-300" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
