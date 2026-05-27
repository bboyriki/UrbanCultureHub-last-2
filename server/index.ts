import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { registerExternalApi } from "./externalApi";
import { log } from "./logger";
import { serveStatic } from "./static";
import { createDefaultAdmin } from "./admin";
import { initCloudinary } from "./cloudinary";
import { initializeStripePrices } from "./stripe";
import { initKvkApi } from "./kvk";
import { DatabaseStorage } from "./storage";
import { emailSystem } from './email';
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { StripeWebhookHandlers } from './stripeWebhookHandlers';
import './firebase';
import { seedVenues, correctVenueData } from './seed';
import { runColumnMigrations } from './migrations';
import { seedDemoAccount } from './demoSeeder';
import { eventsCache, prewarmCaches } from './routes';
import { startVoiceCleanup } from './voiceCleanup';
import { startEventScheduler } from './eventScheduler';
import { startLinkedInAutoPostScheduler } from './linkedinAutoPost';
import { startInstagramAutomationScheduler } from './instagramAutomationScheduler';
import { recordRequest } from './perfTracker';
import { logEnvironment } from './env';

// Log which environment is active at startup
logEnvironment();

// Ensure KVK API uses v1 endpoint
if (process.env.KVK_API_URL && process.env.KVK_API_URL.includes('/v2/')) {
  process.env.KVK_API_URL = process.env.KVK_API_URL.replace('/v2/', '/v1/');
}

const app = express();

// ── /health MUST be first — responds before any middleware or async work ──
// Deployment health checkers hit this endpoint to verify the server is alive.
// Note: no timestamp — avoids leaking server timing data.
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// Trust all proxy layers (needed for Railway + Replit reverse proxies)
app.set("trust proxy", true);

// Security headers with strict CSP
// ── App origin resolution ─────────────────────────────────────────────────
// Priority: APP_URL (explicit) > REPLIT_DOMAINS (Replit fallback) > empty (local dev)
// On Railway set APP_URL=https://your-app.up.railway.app in the Variables panel.
const _REPLIT_DOMAIN = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "";
const APP_ORIGIN =
  process.env.APP_URL?.replace(/\/$/, "") ||
  (_REPLIT_DOMAIN ? `https://${_REPLIT_DOMAIN}` : "");

// In development we need 'unsafe-inline' because Vite injects HMR client scripts
// inline into index.html. In production the bundle is fully external, so we drop
// 'unsafe-inline' from scriptSrc/scriptSrcAttr to actually enforce script CSP.
const IS_DEV = process.env.NODE_ENV !== "production";
const SCRIPT_SRC: string[] = [
  "'self'",
  ...(IS_DEV ? ["'unsafe-inline'"] : []),
  "https://maps.googleapis.com",
  "https://js.stripe.com",
  "https://unpkg.com",
  "https://cdn.jsdelivr.net",  // Monaco Editor CDN fallback
  "https://apis.google.com",
  // Google Ads / gtag.js conversion tracking
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://www.googleadservices.com",
  "https://googleads.g.doubleclick.net",
];
const SCRIPT_SRC_ATTR: string[] = IS_DEV ? ["'unsafe-inline'"] : ["'none'"];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:      ["'self'"],
      scriptSrc:       SCRIPT_SRC,
      scriptSrcAttr:   SCRIPT_SRC_ATTR,
      styleSrc: [
        "'self'",
        "'unsafe-inline'",   // Tailwind + shadcn inline styles
        "https://fonts.googleapis.com",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:",
      ],
      // ── Images ────────────────────────────────────────────────────────────────
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://res.cloudinary.com",          // Cloudinary images / thumbnails
        "https://*.tile.openstreetmap.org",     // OSM tiles (fallback)
        "https://*.basemaps.cartocdn.com",      // CARTO map tiles (active provider)
        "https://*.cartocdn.com",               // CARTO CDN
        "https://unpkg.com",
        "https://maps.googleapis.com",
        "https://maps.gstatic.com",
        "https://lh3.googleusercontent.com",    // Google profile photos
        "https://avatars.githubusercontent.com",
        "https://*.cloudfront.net",             // AWS CloudFront CDN (RunwayML, etc.)
        "https://*.ticketm.net",                // Ticketmaster event images
        "https://s1.ticketm.net",
        "https://secure.gravatar.com",
        "https://*.blob.core.windows.net",      // Azure Blob (OpenAI DALL-E images)
        "https://oaidalleapiprodscus.blob.core.windows.net",
        "https://*.openai.com",                 // OpenAI image CDN
        "https://images.unsplash.com",          // Unsplash stock photos
        "https://plus.unsplash.com",            // Unsplash premium photos
        "https://img.youtube.com",              // YouTube video thumbnails
        "https://i.ytimg.com",                  // YouTube image CDN
        "https://server.arcgisonline.com",       // Esri satellite map tiles
        "https://services.arcgisonline.com",     // Esri services
        // Google Ads / gtag.js conversion tracking pixels
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://www.googleadservices.com",
        "https://googleads.g.doubleclick.net",
        "https://stats.g.doubleclick.net",
        "https://www.google.com",
        "https://www.google.nl",
      ],
      // ── Video / Audio (mediaSrc) ───────────────────────────────────────────
      // Without this, <video> and <audio> fall back to default-src ('self')
      // which blocks ALL external media including Cloudinary reels/voice messages.
      mediaSrc: [
        "'self'",
        "blob:",                                // locally recorded audio/video
        "data:",
        "https://res.cloudinary.com",          // Reels, stories, voice messages
        "https://*.cloudfront.net",            // RunwayML / AI Studio video delivery
        "https://*.openai.com",               // Sora (OpenAI) generated videos
        "https://*.runwayml.com",             // RunwayML generated videos
      ],
      // ── Network / XHR / Fetch ─────────────────────────────────────────────
      connectSrc: [
        "'self'",
        // WebSocket — restrict to our own domain; fall back to self in dev
        ...(APP_ORIGIN
          ? [`wss://${new URL(APP_ORIGIN).host}`]
          : ["ws:", "wss:"]),
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://*.googleapis.com",
        "https://*.firebaseapp.com",
        "https://*.firebase.com",
        "https://fcm.googleapis.com",
        "https://api.cloudinary.com",           // Cloudinary direct upload
        "https://res.cloudinary.com",           // Cloudinary fetch
        "https://nominatim.openstreetmap.org",  // Geocoding
        "https://api.stripe.com",
        "https://api.kvk.nl",
        "https://unpkg.com",                    // Monaco Editor CDN
        "https://cdn.jsdelivr.net",             // Monaco Editor CDN fallback
        "https://api.anthropic.com",
        "https://api.openai.com",               // OpenAI / Sora
        "https://api.dev.runwayml.com",         // RunwayML
        // Google Ads / gtag.js conversion beacons
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://www.googleadservices.com",
        "https://googleads.g.doubleclick.net",
        "https://stats.g.doubleclick.net",
        "https://www.google.com",
        "https://www.google.nl",
        "https://region1.google-analytics.com",
        "https://analytics.google.com",
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://www.youtube-nocookie.com",   // YouTube privacy-enhanced embeds
        "https://www.youtube.com",            // YouTube standard embeds
      ],
      workerSrc:       ["'self'", "blob:"],     // Web workers (e.g. Vite HMR, PDF.js)
      objectSrc:       ["'none'"],
      baseUri:         ["'self'"],
      formAction:      ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Re-enable COOP: same-origin to protect against cross-origin window attacks.
  // COEP stays disabled — Stripe + YouTube iframes cannot send COEP headers.
  crossOriginOpenerPolicy: { policy: "same-origin" },
}));
app.disable("x-powered-by");


// ── CSRF: Origin / Referer check for state-changing requests ─────────────────
// Webhooks, tracking, and health checks are excluded because they are called
// by trusted third parties (Stripe, analytics) that cannot send our origin.
const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS  = [
  "/api/stripe/webhook",
  "/api/instagram/webhook",  // Meta webhook — called by Facebook servers
  "/api/tracking/",
  "/api/outreach/track/",
  "/api/webhook/mailgun/",
  "/health",
];
app.use((req: Request, res: Response, next: NextFunction) => {
  if (CSRF_SAFE_METHODS.has(req.method)) return next();
  if (CSRF_EXEMPT_PATHS.some((p) => req.path.startsWith(p))) return next();

  const origin  = req.headers.origin  as string | undefined;
  const referer = req.headers.referer as string | undefined;
  const host    = `https://${req.headers.host}`;

  // Determine if the request comes from our own domain
  const sourceUrl = origin || referer || "";
  const isOwnOrigin =
    sourceUrl.startsWith(host) ||
    (APP_ORIGIN && sourceUrl.startsWith(APP_ORIGIN)) ||
    // Allow only during explicit development mode (not staging / unconfigured prod)
    (!APP_ORIGIN && process.env.NODE_ENV === "development");

  if (!isOwnOrigin) {
    return res.status(403).json({ error: "Forbidden: cross-origin request rejected." });
  }
  next();
});

// Gzip compression
app.use(compression());

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: (req) => req.path.startsWith("/api/stripe/webhook"),
});
// NOTE: globalLimiter is mounted AFTER the more specific limiters below
// (auth/upload/push). Express applies middleware in registration order, so
// keeping the specific limiters first guarantees they always run for their
// scoped paths even if anything is later inserted above the global mount.

// Auth rate limiter — 100 requests per 15 minutes per IP.
// No skip function: cookie presence is never a sufficient signal of legitimacy
// because an attacker who obtains any session cookie string (even expired) would
// bypass the limiter entirely. Legitimate token refreshes happen infrequently
// and stay well within 100 req/15 min even without skipping.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests, please try again later." },
});

const pushLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many notification registration requests." },
});

// ── Instagram webhook — capture raw body for HMAC-SHA256 signature check ──
app.post(
  '/api/instagram/webhook',
  express.raw({ type: '*/*' }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      (req as any).rawBody = req.body;
      try { req.body = JSON.parse(req.body.toString()); } catch { req.body = {}; }
    }
    next();
  },
);

// ── Stripe webhook MUST use express.raw() BEFORE express.json() ──
app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing stripe-signature' });
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        log('STRIPE WEBHOOK ERROR: req.body is not a Buffer', 'error');
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      const { uuid } = req.params;
      await StripeWebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);
      res.status(200).json({ received: true });
    } catch (error: any) {
      log(`Webhook error: ${error.message}`, 'error');
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// JSON middleware for all other routes.
// Global limit kept tight (1mb) to mitigate DoS via giant payloads; only the
// upload routes that legitimately need large JSON (base64 images / theme
// imports / homepage configs) get the 10mb override below.
app.use("/api/upload", express.json({ limit: '10mb' }));
app.use("/api/upload", express.urlencoded({ extended: false, limit: '10mb' }));
// Career photo upload sends a base64-encoded image — needs a generous limit
app.use("/api/admin/career/profile/photo", express.json({ limit: '10mb' }));
// Admin tools that legitimately POST big JSON (homepage config snapshots,
// theme imports, AI-generated layouts). Paths verified against the actual
// route registrations in server/routes.ts.
app.use("/api/admin/homepage-config", express.json({ limit: '5mb' }));
app.use("/api/admin/homepage-builder", express.json({ limit: '5mb' }));
app.use("/api/admin/theme", express.json({ limit: '5mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      recordRequest(req.method, path, duration, res.statusCode);
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      const sensitivePathPrefixes = ['/api/auth', '/api/users', '/api/admin', '/api/push', '/api/sessions', '/api/settings'];
      const isSensitivePath = sensitivePathPrefixes.some(p => path.startsWith(p));
      if (capturedJsonResponse && !isSensitivePath) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      } else if (capturedJsonResponse && isSensitivePath) {
        logLine += ` :: [${Array.isArray(capturedJsonResponse) ? capturedJsonResponse.length + ' items' : 'object'}]`;
      }
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      log(logLine);
    }
  });
  next();
});

// Rate limiters for specific paths — registered BEFORE the global limiter so
// they always fire for their scoped routes regardless of insertion order.
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/upload", uploadLimiter);
app.use("/api/push", pushLimiter);

// Global API rate limiter (mounted last so the specific limiters above win).
app.use("/api", globalLimiter);

// ── Create the HTTP server and start listening IMMEDIATELY ──────────────────
// The /health endpoint is already registered above and will respond to
// deployment health checks right away. All heavy initialization (route
// registration, DB migrations, Stripe, caches) runs after listen() returns.
const port = parseInt(process.env.PORT || "5000", 10);
const server = createServer(app);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    log(`Port ${port} is already in use. Exiting so the process manager can retry.`, "error");
    process.exit(1);
  } else {
    throw err;
  }
});

server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
  log(`serving on port ${port}`);

  // Defer ALL initialization so the server handles health checks first.
  // Each async operation is independently fire-and-forget so one failure
  // cannot block the others.
  setImmediate(() => backgroundInit());
});

async function backgroundInit() {
  try {
    // 1. Register all routes (synchronous route handler setup, but large).
    //    Pass the already-listening server so the WebSocket server can attach.
    await registerRoutes(app, server);

    // External API — /api/v1/* (API key authenticated, CORS open for external sites)
    registerExternalApi(app);

    // 2. Error handler — must come after routes
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const isProd = process.env.NODE_ENV === "production";

      // In production, never expose raw error internals (stack traces, DB paths, etc.)
      // for 5xx errors. 4xx errors (validation, auth) may keep their message safely.
      const message = isProd && status >= 500
        ? "An unexpected error occurred. Please try again later."
        : err.message || "Internal Server Error";

      // Always log the full error server-side so we don't lose context
      if (status >= 500) {
        log(`[ERROR] ${err.message || err}${err.stack ? "\n" + err.stack : ""}`, "error");
      }

      res.status(status).json({ message });
    });

    // 3. Static file serving / Vite dev server
    // vite.ts is only imported in dev — it statically imports the "vite" npm
    // package which must NOT be loaded in production (it's a devDependency and
    // is pruned from the Docker image). Dynamic import keeps it dev-only.
    if (app.get("env") === "development") {
      const { setupVite } = await import("./vite.js");
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    log("Routes registered. Running background init tasks…");

    // Memory Calendar reminder scheduler — sends push/email at user-defined offsets
    try {
      const { startMemoryReminderScheduler } = await import("./memoryReminderScheduler");
      startMemoryReminderScheduler();
    } catch (err: any) {
      log(`Memory reminder scheduler failed to start: ${err.message}`, "warn");
    }

    // Google Sync scheduler — auto-imports appointments from Gmail + Google Calendar
    try {
      const { startGoogleSyncScheduler } = await import("./googleSyncScheduler");
      startGoogleSyncScheduler();
    } catch (err: any) {
      log(`Google sync scheduler failed to start: ${err.message}`, "warn");
    }


    // 4. All remaining heavy tasks — each is independently deferred and non-blocking
    runColumnMigrations().catch((err: any) =>
      log(`Column migrations failed (non-fatal): ${err.message}`, "warn")
    );

    prewarmCaches().catch((err: any) =>
      log(`Cache pre-warm error: ${err.message}`, "warn")
    );

    // Proactively re-warm the events + map-events caches every 9 minutes
    // so they never go cold (TTLs are 10 min and 15 min respectively)
    setInterval(() => {
      prewarmCaches().catch(() => {});
    }, 9 * 60 * 1000);

    initStripe().catch((err: any) =>
      log(`Stripe init error: ${err.message}`, "error")
    );

    createDefaultAdmin().catch((err: any) =>
      log(`Admin init error: ${err.message}`, "error")
    );

    (async () => {
      try {
        await correctVenueData();
        await seedVenues();
        // Note: venue seeding does NOT flush events cache — venues ≠ events
      } catch (err: any) {
        log(`Seed error: ${err.message}`, "error");
      }
    })();

    seedDemoAccount().catch((err: any) =>
      log(`Demo seeder error (non-fatal): ${err.message}`, "warn")
    );

    const cloudinaryOk = initCloudinary();
    log(cloudinaryOk
      ? "Cloudinary initialized successfully"
      : "Cloudinary initialization failed — some image features may not work"
    );

    initKvkApi();
    startVoiceCleanup();
    startEventScheduler();
    startLinkedInAutoPostScheduler();
    startInstagramAutomationScheduler();

    initializeStripePrices()
      .then((stripePrices) => {
        log(`Stripe prices initialized. Monthly: ${stripePrices.monthlyPriceId}, Yearly: ${stripePrices.yearlyPriceId}`);
      })
      .catch((error: any) => {
        log(`Stripe price init failed: ${error.message}`, "warn");
      });

  } catch (error: any) {
    log(`Background init error (non-fatal): ${error.message}`, "error");
    console.error("Background init stack:", error.stack);
  }
}

// ── Stripe initialization ─────────────────────────────────────────────────
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('DATABASE_URL not found. Skipping Stripe initialization.');
    return;
  }
  try {
    log('Initializing Stripe schema…');
    try {
      await runMigrations({ databaseUrl });
      log('Stripe schema ready');
    } catch (migrateErr: any) {
      // stripe-replit-sync may not work outside Replit — safe to skip
      log(`Stripe schema migration skipped: ${migrateErr?.message || migrateErr}`, 'warn');
    }

    const stripeSync = await getStripeSync();

    // ── Resolve the stable webhook base URL ──────────────────────────────
    // Priority: explicit env override > deployed .replit.app domain > current dev domain
    // The .replit.app domain is stable across restarts; the dev domain (REPLIT_DOMAINS)
    // can change between sessions, which is what causes stale webhook delivery failures.
    const _replitDomains = (process.env.REPLIT_DOMAINS || "").split(",").map(d => d.trim()).filter(Boolean);
    const stableDomain =
      process.env.WEBHOOK_BASE_URL?.replace(/\/$/, "")
      || APP_ORIGIN
      || _replitDomains[0]
      || "";

    if (!stableDomain) {
      log("STRIPE WEBHOOK WARNING: Cannot determine a webhook base URL. Skipping webhook setup.", "warn");
      return;
    }

    const webhookBaseUrl    = stableDomain.startsWith("http") ? stableDomain : `https://${stableDomain}`;
    const currentBaseUrl    = `${webhookBaseUrl}/api/stripe/webhook`;

    log(`Webhook base URL resolved to: ${currentBaseUrl}`);

    // ── Migrate any stale webhook URLs before calling findOrCreateManagedWebhook ──
    // If the domain changed (dev session rotated), the DB still holds the old URL.
    // findOrCreateManagedWebhook compares base URLs — if they differ it creates a NEW
    // webhook, leaving the old dead one in Stripe (causing the delivery failure emails).
    // Strategy: try to update the URL first; if that fails (e.g. null secret constraint),
    // delete the stale record entirely so findOrCreateManagedWebhook creates a clean one.
    try {
      const existingWebhooks = await stripeSync.listManagedWebhooks();
      for (const existing of existingWebhooks) {
        const existingBase = existing.url.replace(/\/[^/]+$/, ""); // strip trailing /uuid
        if (existingBase !== currentBaseUrl) {
          const newUrl = `${currentBaseUrl}/${existing.uuid}`;
          log(`Stale webhook detected [${existing.id}]: ${existing.url} → ${newUrl}`);
          try {
            await stripeSync.updateManagedWebhook(existing.id, { url: newUrl });
            log(`✅ Stale webhook URL updated successfully`);
          } catch (updateErr: any) {
            // Update failed (e.g. null secret in DB record) — delete instead so a fresh
            // one can be created with a proper secret by findOrCreateManagedWebhook.
            log(`Update failed for ${existing.id} (${updateErr.message}) — deleting stale webhook to recreate it`, "warn");
            try {
              await stripeSync.deleteManagedWebhook(existing.id);
              log(`✅ Stale webhook ${existing.id} deleted from Stripe and DB`);
            } catch (deleteErr: any) {
              log(`Could not delete stale webhook ${existing.id}: ${deleteErr.message}`, "warn");
            }
          }
        }
      }
    } catch (listErr: any) {
      log(`Could not list existing webhooks (will continue): ${listErr.message}`, "warn");
    }

    // ── Hint for stable production URL ───────────────────────────────────────
    if (!process.env.WEBHOOK_BASE_URL && !process.env.APP_URL && !_replitDomains.find(d => d.endsWith(".replit.app"))) {
      log(
        "💡 WEBHOOK TIP: The current webhook URL uses a dev domain that changes between sessions. " +
        "Set the WEBHOOK_BASE_URL environment variable to your stable deployed URL " +
        "(e.g. https://your-app.replit.app) to prevent delivery failures.",
        "warn"
      );
    }

    // ── Register or find the managed webhook ─────────────────────────────
    log('Setting up managed webhook…');
    const WEBHOOK_EVENTS = [
      // Payment events — critical for ticket & booking fulfilment
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'payment_intent.canceled',
      // Checkout events — fires when Stripe Checkout session completes
      'checkout.session.completed',
      'checkout.session.expired',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      // Subscription lifecycle
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.subscription.trial_will_end',
      // Invoice events
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'invoice.upcoming',
      // Charge events
      'charge.succeeded',
      'charge.failed',
      'charge.refunded',
      'charge.dispute.created',
    ];

    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      currentBaseUrl,
      {
        enabled_events: WEBHOOK_EVENTS,
        description:    'Urban Culture Hub — managed Stripe webh