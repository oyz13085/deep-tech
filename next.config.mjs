/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Mapbox GL JS uses workers — needed for Next.js bundling
    config.resolve.alias = {
      ...config.resolve.alias,
      'mapbox-gl': 'mapbox-gl',
    };
    return config;
  },
};

export default nextConfig;
