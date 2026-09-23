/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // File template .xlsx dibaca saat runtime oleh /api/generate, jadi harus ikut
  // terbawa ke bundle serverless (Vercel) -- kalau tidak, generate gagal.
  experimental: {
    outputFileTracingIncludes: {
      "/api/generate": ["./lib/template/**"],
    },
  },
};

export default nextConfig;
