import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/site';

/**
 * Static robots.txt. With `output: 'export'` Next renders this to
 * `out/robots.txt` at build time and points crawlers at the sitemap.
 */
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
