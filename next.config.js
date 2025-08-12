/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    dirs: ['.'],
    ignoreDuringBuilds: true,
  },
  webpack(config) {
    config.infrastructureLogging = { debug: /PackFileCache/ };
    return config;
  },
};

module.exports = nextConfig;
