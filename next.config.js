/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },

  // ✅ reemplaza "experimental.serverComponentsExternalPackages"
  serverExternalPackages: ["pdfkit"],
};

module.exports = nextConfig;
