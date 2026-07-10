/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // File uploads go through Server Actions, whose body limit defaults to 1MB.
  // Raise it so document uploads and batched PDF ingestion don't fail.
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
  // whatsapp-web.js / puppeteer / imapflow are heavy Node-only deps used only by
  // the background workers (Phase 3); keep them out of the Next bundle so webpack
  // doesn't pull their trees into the shared server runtime.
  serverExternalPackages: ["@prisma/client", "whatsapp-web.js", "pdf-parse", "puppeteer", "qrcode", "imapflow"],
};

export default nextConfig;
