/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure the policy markdown files are bundled with the reindex route on Vercel.
    outputFileTracingIncludes: {
      "/api/policies/reindex": ["./data/policies/**/*"],
    },
  },
};

export default nextConfig;
