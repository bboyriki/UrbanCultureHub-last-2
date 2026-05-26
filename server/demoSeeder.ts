/**
 * Demo Account Seeder — Apple App Store Review
 *
 * Seeds the demo account (rikim5736@gmail.com, id=8) with rich, realistic
 * urban-culture content so Apple reviewers can explore a fully populated app
 * experience. Runs automatically on every server start, but only writes data
 * if the account is not already populated (idempotent).
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

const DEMO_USER_ID = 8;
const MIN_POSTS_THRESHOLD = 10; // skip seeding if account already has this many

export async function seedDemoAccount() {
  try {
    // ── Guard: skip if already richly populated ──────────────────────────────
    const countResult = await db.execute(
      sql`SELECT COUNT(*)::int AS cnt FROM posts WHERE user_id = ${DEMO_USER_ID}`
    );
    const existing = Number((countResult.rows[0] as any)?.cnt ?? 0);
    if (existing >= MIN_POSTS_THRESHOLD) {
      console.log(`[DemoSeeder] Account already has ${existing} posts — skipping.`);
      return;
    }

    console.log("[DemoSeeder] Seeding demo account for App Store review…");

    // ── 1. Update profile ────────────────────────────────────────────────────
    await db.execute(sql`
      UPDATE users SET
        display_name    = 'Urban Demo',
        bio             = '🎨 Breaking artist & urban culture explorer | Amsterdam 🇳🇱 | Street art, movement, music. Demo account for App Store review — explore all features freely.',
        art_type        = 'Breaking / Street Art',
        location        = 'Amsterdam, Netherlands',
        role            = 'artist',
        is_verified     = true,
        status          = 'active'
      WHERE id = ${DEMO_USER_ID}
    `);

    // ── 2. Demo Posts ────────────────────────────────────────────────────────
    const now = new Date();
    const ago = (days: number, hours = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      d.setHours(d.getHours() - hours);
      return d.toISOString();
    };

    const posts = [
      {
        content: "Just landed at STRAAT Museum in Amsterdam Noord — 160 murals by artists from around the world under one roof 🎨 If you haven't been yet, this is your sign. Added it to the spots map so you can find it too. #StreetArt #Amsterdam #STRAAT #UrbanCulture",
        image: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&q=80",
        created_at: ago(12),
      },
      {
        content: "Breaking session at House of Urban Sports tonight 🔥 The energy in the room was something else. If you're in Amsterdam and want to train, come through — open sessions every week. All levels welcome.",
        image: null,
        created_at: ago(10, 3),
      },
      {
        content: "Used the AI Discovery feature today to find the best graffiti spots near me — it surfaced three walls in Amsterdam Oost I'd never noticed before, and actually gave me the history and context of each location 🤖🎨 This is exactly why I love this platform.",
        image: null,
        created_at: ago(9),
      },
      {
        content: "Shoutout to everyone who showed up to the cypher at OT301 last Saturday 🙌 Amsterdam's underground culture scene is alive and growing stronger every month. See you at the next one. #Cypher #HipHop #Amsterdam",
        image: "https://images.unsplash.com/photo-1535525153412-5a42439a210d?w=800&q=80",
        created_at: ago(8, 5),
      },
      {
        content: "Bijlmer Hall of Fame — Amsterdam's most authentic graffiti wall 🖌️ Added it to my favourite spots on the map. The history of this place runs deep. If you're serious about Amsterdam street art culture, make the trip to Zuidoost.",
        image: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&q=80",
        created_at: ago(7),
      },
      {
        content: "Heading to the BTTS Breaking Battle next weekend 🕺 Who else is coming? These battles are what the scene is built on — no politics, just movement and music. Tag someone who needs to be there 👇",
        image: null,
        created_at: ago(6, 2),
      },
      {
        content: "Urban Culture Hub is building something I've wanted for years — one place where artists, dancers, graffiti writers, spot-hunters and culture lovers across the Netherlands can actually connect. This is why we're here 🙏 #Community #UrbanCulture",
        image: null,
        created_at: ago(5),
      },
      {
        content: "Spotted this incredible mural in Amsterdam West this morning — the detail in the lettering and the layering of colour is insane 🖼️ I've added the location to the spots map so you can find it. Go see it in person, photos don't do it justice.",
        image: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?w=800&q=80",
        created_at: ago(4),
      },
      {
        content: "Morning run through Flevopark, then a breaking practice at the outdoor spot by the basketball courts ☀️ Amsterdam mornings hit different when the city is still waking up. What's your morning routine?",
        image: null,
        created_at: ago(3, 8),
      },
      {
        content: "The map feature has completely changed how I discover the city 📍 You can filter by category — street art, skate, dance, open-mic, food — and find spots you'd never stumble on by accident. I found a new bouldering gym in Noord this way last week.",
        image: null,
        created_at: ago(2, 12),
      },
      {
        content: "Community feed is looking 🔥 this week. Love seeing what people are creating and discovering across the Netherlands. Drop your latest finds below 👇 Let's keep building this together. #UrbanCultureHub #Netherlands",
        image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80",
        created_at: ago(1, 6),
      },
      {
        content: "New feature drop 💫 You can now star, forward and reply to messages in the chat. The Urban Culture Hub team keeps shipping — if you have feature ideas, drop them in the community feed. We read everything. #ProductUpdate",
        image: null,
        created_at: ago(0, 14),
      },
    ];

    for (const post of posts) {
      await db.execute(sql`
        INSERT INTO posts (content, image, user_id, privacy, created_at, updated_at)
        VALUES (
          ${post.content},
          ${post.image},
          ${DEMO_USER_ID},
          'public',
          ${post.created_at}::timestamptz,
          ${post.created_at}::timestamptz
        )
        ON CONFLICT DO NOTHING
      `);
    }

    // ── 3. Demo Stories ──────────────────────────────────────────────────────
    const storyExpiry = new Date(now);
    storyExpiry.setHours(storyExpiry.getHours() + 24 * 3); // 3 days from now

    const stories = [
      {
        caption: "Amsterdam breaking scene is alive 🔥 Come train with us at House of Urban Sports — open sessions every week, all levels welcome.",
        media_url: "https://images.unsplash.com/photo-1535525153412-5a42439a210d?w=800&q=80",
        media_type: "image",
        bg_color: "linear-gradient(135deg,#667eea,#764ba2)",
        created_at: ago(1),
      },
      {
        caption: "Discovered 3 new graffiti walls today using the map 📍 This is why Urban Culture Hub exists — find what the city is hiding.",
        media_url: "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800&q=80",
        media_type: "image",
        bg_color: "linear-gradient(135deg,#43e97b,#38f9d7)",
        created_at: ago(0, 6),
      },
      {
        caption: "STRAAT Museum visit ✅ If you're in Amsterdam, this is non-negotiable. The world's largest indoor street art museum is right here 🎨",
        media_url: "https://images.unsplash.com/photo-1563089145-599997674d42?w=800&q=80",
        media_type: "image",
        bg_color: "linear-gradient(135deg,#f093fb,#f5576c)",
        created_at: ago(0, 2),
      },
    ];

    // Delete old stories and re-insert fresh ones
    await db.execute(sql`DELETE FROM stories WHERE user_id = ${DEMO_USER_ID}`);

    for (const story of stories) {
      await db.execute(sql`
        INSERT INTO stories (user_id, media_url, media_type, caption, bg_color, view_count, expires_at, created_at)
        VALUES (
          ${DEMO_USER_ID},
          ${story.media_url},
          ${story.media_type},
          ${story.caption},
          ${story.bg_color},
          ${Math.floor(Math.random() * 40) + 10},
          ${storyExpiry.toISOString()}::timestamptz,
          ${story.created_at}::timestamptz
        )
      `);
    }

    // ── 4. Add some follows so the feed looks active ─────────────────────────
    // Follow the first 5 other active users (so the community feed is populated)
    const otherUsers = await db.execute(sql`
      SELECT id FROM users
      WHERE id != ${DEMO_USER_ID} AND status = 'active'
      ORDER BY id
      LIMIT 8
    `);

    for (const row of otherUsers.rows as any[]) {
      await db.execute(sql`
        INSERT INTO user_follows (follower_id, followed_id, status, created_at, updated_at)
        VALUES (${DEMO_USER_ID}, ${row.id}, 'accepted', NOW(), NOW())
        ON CONFLICT DO NOTHING
      `);
    }

    // ── 5. App Settings — ensure "reviewer note" is set if supported ─────────
    // (best-effort — ignore if table/column doesn't exist)
    try {
      await db.execute(sql`
        UPDATE app_settings
        SET reviewer_note = 'This is the Apple App Store review demo account. Username: rikim5736@gmail.com. All features are enabled. Use the Map to discover spots, Community to see posts, AI for smart recommendations, Chat to message, and Profile to see account settings.'
        WHERE reviewer_note IS NOT NULL
      `);
    } catch (_) { /* column may not exist — that is fine */ }

    console.log("[DemoSeeder] ✅ Demo account seeded successfully.");
  } catch (err) {
    console.error("[DemoSeeder] ⚠️ Seeding error (non-fatal):", err);
  }
}
