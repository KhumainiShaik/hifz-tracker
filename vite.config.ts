import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "/hifz-tracker/",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Khumaini's Hifz Journey",
        short_name: "Hifz Journey",
        description:
          "Abdul Khumaini Shaik's personal Quran memorization journey.",
        theme_color: "#174d3d",
        background_color: "#f7f8f4",
        display: "standalone",
        start_url: "/hifz-tracker/",
        scope: "/hifz-tracker/",
        id: "/hifz-tracker/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/hifz-tracker/index.html",
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: (id: string) =>
          /node_modules\/(?:@firebase|firebase)\//.test(id)
            ? "firebase"
            : undefined,
      },
    },
  },
});
