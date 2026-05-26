/**
 * Dev-only Vite middleware — this file imports "vite" and is therefore
 * NEVER imported in production. server/index.ts loads it via dynamic import
 * only when NODE_ENV !== "production".
 */
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { type Express } from "express";
import { type Server } from "http";
import { nanoid } from "nanoid";
import { createServer as createViteServer, createLogger } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── setupVite: dev-only ───────────────────────────────────────────────────
// Uses configFile:false so we never import vite.config.ts as a module
// (which would cause esbuild to hoist that local file import and break prod).
export async function setupVite(app: Express, server: Server) {
  const viteLogger = createLogger();
  const clientRoot = path.resolve(__dirname, "..", "client");

  const vite = await createViteServer({
    configFile: false,
    root: clientRoot,
    plugins: [
      react(),
      themePlugin(),
      runtimeErrorOverlay(),
    ],
    resolve: {
      alias: {
        "@":       path.resolve(__dirname, "..", "client", "src"),
        "@shared": path.resolve(__dirname, "..", "shared"),
        "@assets": path.resolve(__dirname, "..", "attached_assets"),
      },
    },
    server: {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as any,
    },
    appType: "custom",
    customLogger: {
      ...viteLogger,
      error: (msg: string, options?: any) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(clientRoot, "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
