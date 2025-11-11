/** @type {import('next').NextConfig} */
const path = require('path');
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qvuvgfvvsmmuiunlajud.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
    minimumCacheTTL: 60,
    unoptimized: false,
  },
  webpack: (config) => {
    // Ini adalah pendekatan yang tepat untuk mengatasi peringatan dari kode pihak ketiga
    // yang tidak dapat kita ubah langsung
    config.ignoreWarnings = [
      // Peringatan terkait dynamic require di Supabase
      {
        module: /node_modules\/@supabase\/realtime-js\/dist\/main\/RealtimeClient\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      }
    ];
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    };
    return config;
  },
  // Reduce bundle size and improve performance
  // swcMinify is default in Next.js 12.2+ and can be removed or configured
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://www.best.borneoekspedisi.com/api',
    NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY || 'borneo-test-api-key',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://bcexpress.vercel.app'
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Content-Type, Authorization' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" }
        ]
      },
      // Long-term caching only for static assets
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      },
      {
        source: '/_next/image/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      },
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      },
      // Ensure API responses are not cached long-term
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Content-Type, Authorization' }
        ]
      },
      // More permissive iframe policy for mobile app critical routes
      {
        source: '/agent/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'  // Allow iframe for agent routes in mobile app
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *"  // Allow all frame ancestors for agent routes
          }
        ]
      },
      {
        source: '/courier/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'  // Allow iframe for courier routes in mobile app
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *"  // Allow all frame ancestors for courier routes
          }
        ]
      }
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*'
      }
    ]
  },
  turbopack: {
    rules: {
      // Konfigurasi loader jika diperlukan
    },
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    resolveAlias: {
      // Konfigurasi alias jika diperlukan
    }
  }
}

module.exports = nextConfig