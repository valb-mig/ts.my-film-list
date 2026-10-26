/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // scripts/serve.sh builds into .next-prod, so the always-on server and `npm run dev` can share
  // a checkout without overwriting each other's output.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
