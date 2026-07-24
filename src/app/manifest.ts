import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kids Shoe Stock",
    short_name: "靴ストック",
    description: "子供の靴のストックを家族で管理するアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#f97316",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
