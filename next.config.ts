import type { NextConfig } from 'next';
import { config } from './src/lib/config';

const nextConfig: NextConfig = {
  distDir: process.env.PORTA_BUILD_DIR || '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

// Importing the typed configuration validates the environment before startup/build.
if (config.appMode === 'connected' && !config.apiBaseUrl)
  throw new Error('API configuration unavailable.');
export default nextConfig;
