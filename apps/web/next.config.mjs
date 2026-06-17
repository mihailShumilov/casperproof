/**
 * Next.js configuration for the CasperProof dApp (`app.casperproof.com`).
 *
 * The build is intentionally network-free: no `next/font/google`, no remote
 * assets. ESLint is skipped during `next build` (lint runs as its own task);
 * type errors still fail the build so regressions are caught.
 *
 * The `@casperproof/*` workspace packages are transpiled so their ESM `.js`
 * sources resolve cleanly inside the Next bundler.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for the Docker image (docker/Dockerfile.web).
  output: 'standalone',
  // Lint is a separate `pnpm lint` task; don't fail the production build on it.
  eslint: { ignoreDuringBuilds: true },
  // Type errors must still fail the build.
  typescript: { ignoreBuildErrors: false },
  // Workspace packages ship ESM; let Next transpile them.
  transpilePackages: ['@casperproof/ui', '@casperproof/casper-sdk', '@casperproof/commitment'],
  experimental: {
    // Keep imports tree-shaken; recharts is heavy.
    optimizePackageImports: ['recharts'],
  },
};

export default nextConfig;
