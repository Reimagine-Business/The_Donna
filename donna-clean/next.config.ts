// next.config.js
// This forces Vercel to use the stable Webpack builder instead of broken Turbopack
const nextConfig = {
  webpack: (config) => config,   // dummy webpack config = Turbopack disabled
}

module.exports = nextConfig
