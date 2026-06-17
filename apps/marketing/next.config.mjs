/**
 * Next.js config for the CasperProof marketing site.
 *
 * Static export (`output: 'export'`) → casperproof.com. The build is fully
 * offline: no remote fonts, unoptimized images (no server image loader), and
 * ESLint is skipped during the build (we run `typecheck` + `vitest` separately).
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  // The shared UI package ships ESM source for its stylesheet; transpile it so
  // the static export does not choke on the workspace package.
  transpilePackages: ['@casperproof/ui', '@casperproof/casper-sdk'],
};

export default nextConfig;
