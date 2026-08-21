/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['remotion', '@remotion/player'],
  eslint: {
    dirs: ['.'],
    ignoreDuringBuilds: true,
  },
  webpack(config, { isServer }) {
    config.infrastructureLogging = { debug: /PackFileCache/ };

    if (!isServer) {
      // Allow webpack to handle "node:" URI scheme used by pptxgenjs
      config.plugins.push(
        new (require('webpack').NormalModuleReplacementPlugin)(
          /^node:/,
          (resource) => {
            if (resource.context && resource.context.includes('pptxgenjs')) {
              resource.request = resource.request.replace(/^node:/, '');
            }
          },
        ),
      );
    }

    return config;
  },
};

module.exports = nextConfig;
