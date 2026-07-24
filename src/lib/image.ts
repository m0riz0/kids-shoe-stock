// 写真をアップロード前にクライアントでリサイズ・圧縮する（FR-S-6）。
// 長辺 1200px・JPEG 品質 0.8 で目安 300KB 以下に収める。
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1200;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8)
  );
  if (!blob) throw new Error("image compression failed");
  return blob;
}
