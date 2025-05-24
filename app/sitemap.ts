import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Base URL for your website
  const baseUrl = 'https://bcexp.id'

  // Add static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Rute internal lainnya telah dihapus sesuai permintaan
  ]

  // Hanya mengembalikan rute statis publik
  return [...staticRoutes]
} 