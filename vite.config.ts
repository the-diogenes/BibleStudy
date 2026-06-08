import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// For GitHub Pages PROJECT sites, set VITE_BASE to "/<repo-name>/" at build time.
// For a user/org page (username.github.io) or local dev, leave it as "/".
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "config.js"],
      manifest: {
        name: "Bible Study",
        short_name: "BibleStudy",
        description: "Group Bible study: reader, original languages, discussion, and notes.",
        theme_color: "#1c1917",
        background_color: "#faf9f7",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
          { src: "icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === "bible.helloao.org",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "bible-text",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ]
});
