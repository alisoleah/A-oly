import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
    // Placeholder product imagery is SVG (own brand assets, generated locally).
    // Real photography (raster) lands with the lookbook; SVG opt is then removable.
    // CSP below restricts SVG scripts so served SVGs can't execute.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
