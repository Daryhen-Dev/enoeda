import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Next's file tracer cannot statically resolve `pg`'s dynamic
  // `require("pg-cloudflare")` (it is gated behind a runtime check), so it
  // only copies the non-Workers stub. The OpenNext esbuild pass runs with the
  // `workerd` condition and needs the real implementation.
  // See https://github.com/opennextjs/opennextjs-cloudflare/issues/1214
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/pg-cloudflare/dist/**",
      "./node_modules/pg-cloudflare/esm/**",
    ],
  },
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
