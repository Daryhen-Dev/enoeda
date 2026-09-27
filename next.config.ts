import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Dojo story posters are cache-busted with a content-version query so
    // replaced media is not pinned in browser/CDN caches. Next only allows
    // query strings on local images when a pattern covers them.
    localPatterns: [
      {
        pathname: "/media/dojo-stories/*.webp",
      },
    ],
  },
};

export default nextConfig;
