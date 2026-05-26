import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── log: pure utility, zero vite dependency — safe in production ──────────
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// ── setupVite: dev-only ───────────────────────────────────────────────────
//
// IMPORTANT — why dynamic package imports:
//   esbuild bundles local file imports (../vite.config) and hoists their
//   static `import` statements to the top of dist/index.js, causing
//   ERR_MODULE_NOT_FOUND for vite plugins at production startup.
//
//   Dynamic imports of *packages* (strings without ./ or ../) are left as
//   runtime-only `import()` expressions in the esbuild output — they are
//   never resolved unless this function is actually called.
//
//   In production NODE_ENV=production, setupVite is never called, so none
//   of these packages are ever loaded. ✅
//
export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer, createLogger } = await import("vite");
  const { default: react }               = await import("@vitejs/plugin-react");
  const { default: themePlugin }         = await import("@replit/vite-plugin-shadcn-theme-json");
  const { default: runtimeErrorOverlay } = await import("@replit/vite-plugin-runtime-error-modal");

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

// ── serveStatic: production — serves pre-built frontend, no vite needed ──
export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  app.use(express.static(distPath, { maxAge: 0 }));

  app.use("*", (_req, res) => {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma":        "no-cache",
      "Expires":       "0",
    });
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
