import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';

/**
 * Static sitemap. With `output: 'export'` Next renders this to
 * `out/sitemap.xml` at build time. Single-page site, so one canonical entry.
 */
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
