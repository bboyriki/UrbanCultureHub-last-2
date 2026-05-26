# Urban Culture Connect
A social platform unifying the urban culture community by fostering economic opportunities, bridging community gaps, and centralizing cultural activities.

## Run & Operate
- **Run:** `NODE_OPTIONS='--max-old-space-size=4096' npm run dev`
- **Build:** _Populate as you build_
- **Typecheck:** _Populate as you build_
- **Codegen:** _Populate as you build_
- **DB Push:** _Populate as you build_

## Stack
- **Frameworks:** Express.js, React 18, Radix UI, shadcn/ui, Tailwind CSS
- **Runtime:** Node.js (with increased heap to 4GB)
- **ORM:** Drizzle ORM
- **Validation:** _Populate as you build_
- **Build Tool:** Vite
- **Database:** PostgreSQL (Neon PostgreSQL)
- **Real-time:** WebSockets

## Where things live
- **Backend API:** `server/`
  - Routes: `server/routes.ts`
  - Admin Export Builder: `server/exportBuilder.ts`
  - Memory Calendar: `server/memoryCalendarRoutes.ts`, `server/memoryReminderScheduler.ts`
- **Frontend App:** `client/src/`
  - Admin Lead Export UI: `client/src/pages/admin/lead-export.tsx`
  - Admin Memory Calendar UI: `client/src/pages/admin/memory-calendar.tsx`
- **Shared Schema:** `shared/schema.ts` (for DB definitions)
- **Database Schema:** `shared/schema.ts` (primary source of truth for Drizzle ORM)
- **API Contracts:** _Populate as you build_
- **Theme Files:** Tailwind CSS configuration, Radix UI/shadcn/ui styling

## Architecture decisions
- **Full-stack TypeScript:** Enhances type safety and developer experience across the application.
- **Mobile-first design with Radix UI/shadcn/ui & Tailwind CSS:** Ensures consistent, accessible, and responsive UI components.
- **Firebase Admin SDK for Auth + PostgreSQL-backed sessions:** Leverages Firebase for robust token verification while maintaining custom session management for flexibility and role-based access control.
- **Drizzle ORM for PostgreSQL:** Provides a type-safe and efficient way to interact with the database.
- **AI integrations throughout the platform:** Leverages OpenAI and Anthropic for various features like spot finding, content creation, and security analysis, enhancing user experience and administrative capabilities.
- **Increased Node.js heap to 4GB:** Addresses out-of-memory issues for large data processing tasks like admin exports.

## Product
- Location discovery and interactive maps (Leaflet/OpenStreetMap).
- Event management with ticketing (Stripe integration, QR codes).
- Service marketplace (artist profiles, scheduling, reviews).
- Secondhand/new item trading marketplace (AI-assisted listing).
- Real-time chat (delivery/read receipts, E2E encryption indication, WebRTC calls).
- Class booking system for venues (scheduling, Stripe payments).
- Dedicated `spot_owner` role with management dashboard.
- Advanced admin tools (moderation, legal, API keys, security).
- AI Map Finder, Admin AI Creative Studio, in-app AI Assistant, contextual AI widgets.
- GDPR/AVG compliant legal framework.
- Stories and TikTok-style Reels media functionalities.
- Multi-sport competition system.
- "Back to the Street" (BTTS) event module for breakdancing.
- "Culture Hub" with nine community features (Street Cred, Crews, Freestyle Challenges, Cypher Finder, Graffiti Wall, Beat Lab & Radio, Hall of Fame, Style Match, Style DNA, Sync to Beat).
- AI-powered security & privacy scanner for admins.
- LinkedIn AI Brain for customized AI writing and auto-posting.
- AI Lead Discovery v2 for targeted outreach.
- AI Control Panel for image generation model selection.
- LinkedIn auto-post approval queue with self-healing scheduler.
- Comprehensive security hardening (dependency updates, input sanitization, rate limiting).
- Outreach Intelligence System (BI and lead export platform).
- Career Suite for founder's profile management.
- Google Ads conversion tracking.
- Admin Memory Calendar with Claude AI assistance and multi-channel reminders.

## User preferences
Preferred communication style: Simple, everyday language.

## Gotchas
- **Admin Lead Export Antivirus False Positives:** CSV exports now include formula-injection guards, and PDFs/XLSX files have complete metadata to reduce false positives.
- **XLSX Export Visual Quality:** ExcelJS replaced SheetJS for visually richer and more standard XLSX output.
- **Node.js Heap Limit:** The Node.js heap was increased to 4GB to prevent OOM errors during large admin data exports.
- **Memory Calendar Table Creation:** `memory_events`, `memory_reminders`, `memory_access` tables were created via direct SQL due to `npm run db:push` interactive prompts.

## Pointers
- **Stripe:** [https://stripe.com/docs](https://stripe.com/docs)
- **Cloudinary:** [https://cloudinary.com/documentation](https://cloudinary.com/documentation)
- **Mailgun:** [https://www.mailgun.com/docs/](https://www.mailgun.com/docs/)
- **OpenAI:** [https://platform.openai.com/docs/](https://platform.openai.com/docs/)
- **Anthropic:** [https://docs.anthropic.com/](https://docs.anthropic.com/)
- **KVK API (Netherlands Chamber of Commerce):** _Populate as you build_
- **Leaflet:** [https://leafletjs.com/reference.html](https://leafletjs.com/reference.html)
- **OpenStreetMap:** [https://wiki.openstreetmap.org/wiki/API](https://wiki.openstreetmap.org/wiki/API)
- **Firebase Admin SDK:** [https://firebase.google.com/docs/admin/setup](https://firebase.google.com/docs/admin/setup)
- **Neon PostgreSQL:** [https://neon.tech/docs/](https://neon.tech/docs/)
- **Instagram Graph API:** [https://developers.facebook.com/docs/instagram-api/](https://developers.facebook.com/docs/instagram-api/)
- **TikTok API:** [https://developers.tiktok.com/](https://developers.tiktok.com/)
- **Drizzle ORM:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **React:** [https://react.dev/](https://react.dev/)
- **Express.js:** [https://expressjs.com/](https://expressjs.com/)
- **Tailwind CSS:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Radix UI:** [https://www.radix-ui.com/docs/primitives](https://www.radix-ui.com/docs/primitives)
- **shadcn/ui:** [https://ui.shadcn.com/docs](https://ui.shadcn.com/docs)