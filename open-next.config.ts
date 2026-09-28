// default open-next.config.ts file created by @opennextjs/cloudflare
// NOTE: the R2 incremental cache is intentionally disabled until the
// `enoeda-opennext-cache` bucket is created (see wrangler.jsonc).
// To enable it, create the bucket, add the r2_buckets binding in
// wrangler.jsonc, and restore:
//   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
//   export default defineCloudflareConfig({ incrementalCache: r2IncrementalCache });
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
