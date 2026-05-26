import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  plugins: [
    react(),
    // Only load dev-only overlays in non-production builds
    ...(!isProduction ? [runtimeErrorOverlay()] : []),
    themePlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    minify: "esbuild",
    target: "esnext",
    chunkSizeWarningLimit: 2000,
    // Disable compressed size reporting — saves significant memory during build
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Split into logical chunks rather than merging — reduces peak memory per chunk
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-toast"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-maps": ["leaflet", "react-leaflet"],
          "vendor-stripe": ["@stripe/react-stripe-js", "@stripe/stripe-js"],
        },
      },
    },
  },
  server: {
    middlewareMode: true,
    allowedHosts: true,
  },
});
