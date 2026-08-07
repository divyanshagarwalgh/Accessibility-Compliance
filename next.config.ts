import type { NextConfig } from "next";

/**
 * basePath and assetPrefix MUST match the Webflow Cloud environment's mount path
 * exactly, or routing and asset loading break. Mount path: /app
 *
 * Kept clear of /tools/*, so the native Webflow SEO pages can never be shadowed
 * by this app.
 */
const MOUNT_PATH = "/app";

const nextConfig: NextConfig = {
  basePath: MOUNT_PATH,
  assetPrefix: MOUNT_PATH,
  reactStrictMode: true,

  // next/link applies basePath on its own, but `fetch` does not. Inlining the
  // mount path at build time lets src/lib/api-path.ts build absolute API URLs
  // from client components without a second copy of the value to keep in sync.
  env: { NEXT_PUBLIC_BASE_PATH: MOUNT_PATH },

  // Webflow Cloud always replaces Cache-Control with `private, no-cache`, so there is
  // no point designing around HTTP caching. Hot state lives in KV, artifacts in R2.
  poweredByHeader: false,

  eslint: {
    // Lint runs as its own step in CI rather than blocking the Workers build.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

// Enables getCloudflareContext() — and therefore the D1/KV/R2 bindings — during `next dev`.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
