// RLS 統合テスト: 別 Family のデータへ一切アクセスできないことを検証する。
// 実行: npm run test:rls （ローカル Supabase が起動していること）
//
// service_role でテストユーザーを2人作成し、それぞれ別 Family を作成。
// User A のデータに対する User B の SELECT / INSERT / UPDATE / DELETE と
// Storage アクセスがすべて拒否されることを確認する。

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY を環境変数で指定してください"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name} ${detail}`);
  }
}

async function createTestUser(email) {
  const password = "test-password-12345";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser failed: ${error.message}`);

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`signIn failed: ${signInError.message}`);
  return { id: data.user.id, client };
}

async function main() {
  const run = Date.now();
  console.log("=== RLS 統合テスト ===");

  const userA = await createTestUser(`rls-test-a-${run}@example.com`);
  const userB = await createTestUser(`rls-test-b-${run}@example.com`);

  // --- セットアップ: A と B がそれぞれ自分の Family を作成 ---
  const { data: familyAId, error: createFamilyAError } =
    await userA.client.rpc("create_family", { family_name: "A家" });
  check("A が Family を作成できる", !createFamilyAError, createFamilyAError?.message);

  const { data: familyBId, error: createFamilyBError } =
    await userB.client.rpc("create_family", { family_name: "B家" });
  check("B が Family を作成できる", !createFamilyBError, createFamilyBError?.message);

  const { data: childA, error: childAError } = await userA.client
    .from("children")
    .insert({ family_id: familyAId, name: "A家の長男" })
    .select()
    .single();
  check("A が自分の Family に子供を登録できる", !childAError, childAError?.message);

  const { data: shoeA, error: shoeAError } = await userA.client
    .from("shoes")
    .insert({
      child_id: childA.id,
      family_id: familyAId,
      category: "home",
      size: 18.0,
      status: "stock",
      storage_location: "押入れ上段",
    })
    .select()
    .single();
  check("A が自分の Family に靴を登録できる", !shoeAError, shoeAError?.message);

  console.log("\n--- 越境アクセスの拒否 ---");

  // SELECT: B から A のデータが見えないこと
  const { data: bSeesFamilies } = await userB.client
    .from("families")
    .select("*")
    .eq("id", familyAId);
  check("B から A の Family が見えない", (bSeesFamilies ?? []).length === 0);

  const { data: bSeesChildren } = await userB.client
    .from("children")
    .select("*")
    .eq("family_id", familyAId);
  check("B から A の子供が見えない", (bSeesChildren ?? []).length === 0);

  const { data: bSeesShoes } = await userB.client
    .from("shoes")
    .select("*")
    .eq("family_id", familyAId);
  check("B から A の靴が見えない", (bSeesShoes ?? []).length === 0);

  // INSERT: B が A の Family / Child に書き込めないこと
  const { error: bInsertChild } = await userB.client
    .from("children")
    .insert({ family_id: familyAId, name: "不正な子供" });
  check("B が A の Family に子供を登録できない", !!bInsertChild);

  const { error: bInsertShoe, data: bInsertShoeData } = await userB.client
    .from("shoes")
    .insert({
      child_id: childA.id,
      family_id: familyBId, // 自分の family_id を偽装しても
      category: "home",
      size: 18.0,
      status: "stock",
    })
    .select();
  // トリガーが child から family_id を強制するため、RLS 違反になるはず
  check(
    "B が A の子供に靴を登録できない（family_id 偽装込み）",
    !!bInsertShoe && !bInsertShoeData?.length,
    bInsertShoe?.message ?? "insert が成功してしまった"
  );

  // UPDATE / DELETE: 0 rows affected であること
  const { data: bUpdate } = await userB.client
    .from("shoes")
    .update({ storage_location: "改ざん" })
    .eq("id", shoeA.id)
    .select();
  check("B が A の靴を更新できない", (bUpdate ?? []).length === 0);

  const { data: bDelete } = await userB.client
    .from("shoes")
    .delete()
    .eq("id", shoeA.id)
    .select();
  check("B が A の靴を削除できない", (bDelete ?? []).length === 0);

  // 招待 RPC: B が A の Family の招待コードを発行できないこと
  const { error: bInvite } = await userB.client.rpc("create_family_invite", {
    target_family_id: familyAId,
  });
  check("B が A の Family の招待コードを発行できない", !!bInvite);

  // profiles: 家族が異なるうちは互いの profile が見えない
  const { data: bSeesAProfile } = await userB.client
    .from("profiles")
    .select("id")
    .eq("id", userA.id);
  check("B から A の profile が見えない（別 Family）", (bSeesAProfile ?? []).length === 0);

  console.log("\n--- Storage の越境アクセス拒否 ---");

  const photoPath = `${familyAId}/${shoeA.id}/test.jpg`;
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);
  const { error: aUpload } = await userA.client.storage
    .from("shoe-photos")
    .upload(photoPath, jpegBytes, { contentType: "image/jpeg" });
  check("A が自分の Family パスに画像を保存できる", !aUpload, aUpload?.message);

  const { data: bDownload, error: bDownloadError } = await userB.client.storage
    .from("shoe-photos")
    .download(photoPath);
  check("B が A の画像をダウンロードできない", !bDownload && !!bDownloadError);

  const { data: bSigned, error: bSignedError } = await userB.client.storage
    .from("shoe-photos")
    .createSignedUrl(photoPath, 60);
  check(
    "B が A の画像の署名 URL を発行できない",
    !bSigned?.signedUrl && !!bSignedError
  );

  const { error: bUploadCross } = await userB.client.storage
    .from("shoe-photos")
    .upload(`${familyAId}/${shoeA.id}/evil.jpg`, jpegBytes, {
      contentType: "image/jpeg",
    });
  check("B が A の Family パスに画像を保存できない", !!bUploadCross);

  console.log("\n--- 招待フロー ---");

  const { data: inviteCode, error: inviteError } = await userA.client.rpc(
    "create_family_invite",
    { target_family_id: familyAId }
  );
  check("A が招待コードを発行できる", !inviteError, inviteError?.message);

  const { error: joinError } = await userB.client.rpc("join_family_by_code", {
    invite_code: inviteCode,
  });
  check("B が招待コードで A の Family に参加できる", !joinError, joinError?.message);

  const { data: bSeesShoesAfterJoin } = await userB.client
    .from("shoes")
    .select("*")
    .eq("family_id", familyAId);
  check(
    "参加後は B から A の靴が見える",
    (bSeesShoesAfterJoin ?? []).length === 1
  );

  // 参加後は同じ Family になった A の profile も見える（設定画面のメンバー表示に必要）
  const { data: bSeesAProfileAfterJoin } = await userB.client
    .from("profiles")
    .select("id")
    .eq("id", userA.id);
  check(
    "参加後は B から A の profile が見える（同じ Family）",
    (bSeesAProfileAfterJoin ?? []).length === 1
  );

  const { error: reuseError } = await userB.client.rpc("join_family_by_code", {
    invite_code: inviteCode,
  });
  check("使用済みコードは再利用できない", !!reuseError);

  // --- クリーンアップ ---
  await admin.storage.from("shoe-photos").remove([photoPath]);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
  await admin.from("families").delete().in("id", [familyAId, familyBId]);

  console.log(`\n結果: ${passed} passed / ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("テスト実行エラー:", e);
  process.exit(1);
});
