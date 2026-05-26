import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Idempotent column migrations — safe to run on every startup.
 * Uses IF NOT EXISTS so it never fails on a database that already has the columns.
 * This ensures production databases stay in sync with development without manual SQL.
 */
export async function runColumnMigrations() {
  console.log("🔧 Running column migrations...");

  const migrations: Array<{ name: string; query: string }> = [
    // Programme items: link to a specific spot/location
    {
      name: "programme_items.location_id",
      query: `ALTER TABLE programme_items ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL`,
    },
    // Programme items: spot name for easy display (denormalized)
    {
      name: "programme_items.spot_name",
      query: `ALTER TABLE programme_items ADD COLUMN IF NOT EXISTS spot_name TEXT`,
    },
    // Events: music genre + external source tracking
    {
      name: "events.music_genre",
      query: `ALTER TABLE events ADD COLUMN IF NOT EXISTS music_genre TEXT`,
    },
    {
      name: "events.source",
      query: `ALTER TABLE events ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`,
    },
    {
      name: "events.external_id",
      query: `ALTER TABLE events ADD COLUMN IF NOT EXISTS external_id TEXT`,
    },
    // Events: bilingual title/description columns
    {
      name: "events.title_en",
      query: `ALTER TABLE events ADD COLUMN IF NOT EXISTS title_en TEXT`,
    },
    {
      name: "events.description_en",
      query: `ALTER TABLE events ADD COLUMN IF NOT EXISTS description_en TEXT`,
    },
    // spotlighted_places: widen osm_id from INTEGER to BIGINT
    {
      name: "spotlighted_places.osm_id_bigint",
      query: `ALTER TABLE spotlighted_places ALTER COLUMN osm_id TYPE BIGINT`,
    },
    // spotlighted_places: track which admin spotlighted the entry
    {
      name: "spotlighted_places.admin_id",
      query: `ALTER TABLE spotlighted_places ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id)`,
    },
    // saved_locations: allow saving OSM city spots (no location record needed)
    {
      name: "saved_locations.osm_id",
      query: `ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS osm_id BIGINT`,
    },
    {
      name: "saved_locations.osm_name",
      query: `ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS osm_name TEXT`,
    },
    {
      name: "saved_locations.osm_category",
      query: `ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS osm_category TEXT`,
    },
    {
      name: "saved_locations.osm_lat",
      query: `ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS osm_lat DOUBLE PRECISION`,
    },
    {
      name: "saved_locations.osm_lon",
      query: `ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS osm_lon DOUBLE PRECISION`,
    },
    {
      name: "saved_locations.osm_address",
      query: `ALTER TABLE saved_locations ADD COLUMN IF NOT EXISTS osm_address TEXT`,
    },
    // User presence: proximity discovery
    {
      name: "user_presence.coarse_lat",
      query: `ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS coarse_lat TEXT`,
    },
    {
      name: "user_presence.coarse_lng",
      query: `ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS coarse_lng TEXT`,
    },
    // Chat conversations: group chat support columns
    {
      name: "chat_conversations.title",
      query: `ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS title TEXT`,
    },
    {
      name: "chat_conversations.is_group",
      query: `ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT FALSE`,
    },
    {
      name: "chat_conversations.group_avatar_url",
      query: `ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS group_avatar_url TEXT`,
    },
    {
      name: "chat_conversations.created_by",
      query: `ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS created_by INTEGER`,
    },
    {
      name: "chat_conversations.disappearing_timer",
      query: `ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS disappearing_timer INTEGER`,
    },
    // Chat participants: per-user archive/pin state
    {
      name: "chat_participants.is_archived",
      query: `ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`,
    },
    {
      name: "chat_participants.is_pinned",
      query: `ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE`,
    },
    // Chat messages: extended fields
    {
      name: "chat_messages.deleted_at",
      query: `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`,
    },
    {
      name: "chat_messages.content_type",
      query: `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'text'`,
    },
    {
      name: "chat_messages.reply_to_id",
      query: `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER`,
    },
    {
      name: "chat_messages.is_forwarded",
      query: `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT FALSE`,
    },
    {
      name: "chat_messages.expires_at",
      query: `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`,
    },
    // Starred messages table
    {
      name: "starred_messages.table",
      query: `CREATE TABLE IF NOT EXISTS starred_messages (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        conversation_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, message_id)
      )`,
    },
    // Message delivery status: ensure table exists with correct columns
    {
      name: "message_delivery_status.table",
      query: `CREATE TABLE IF NOT EXISTS message_delivery_status (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'sent',
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(message_id, user_id)
      )`,
    },
    // Outreach email history — one row per email sent
    {
      name: "outreach_emails.table",
      query: `CREATE TABLE IF NOT EXISTS outreach_emails (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER REFERENCES outreach_leads(id) ON DELETE CASCADE NOT NULL,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT,
        subject TEXT NOT NULL,
        body_html TEXT,
        sent_at TIMESTAMP DEFAULT NOW() NOT NULL,
        mailgun_message_id TEXT,
        open_count INTEGER DEFAULT 0,
        first_opened_at TIMESTAMP,
        last_opened_at TIMESTAMP,
        is_bulk BOOLEAN DEFAULT FALSE,
        status TEXT NOT NULL DEFAULT 'sent'
      )`,
    },
    // Outreach email open events — one row per open event
    {
      name: "outreach_email_opens.table",
      query: `CREATE TABLE IF NOT EXISTS outreach_email_opens (
        id SERIAL PRIMARY KEY,
        email_id INTEGER REFERENCES outreach_emails(id) ON DELETE CASCADE NOT NULL,
        opened_at TIMESTAMP DEFAULT NOW() NOT NULL,
        ip_address TEXT,
        user_agent TEXT
      )`,
    },
    // LinkedIn auto-post: target audience for AI tone adaptation
    {
      name: "linkedin_auto_post_settings.target_audience",
      query: `ALTER TABLE linkedin_auto_post_settings ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50) NOT NULL DEFAULT 'general'`,
    },
    // LinkedIn auto-post: custom context for AI to weave into posts
    {
      name: "linkedin_auto_post_settings.custom_context",
      query: `ALTER TABLE linkedin_auto_post_settings ADD COLUMN IF NOT EXISTS custom_context TEXT NOT NULL DEFAULT ''`,
    },
    // LinkedIn auto-post: whether to generate an AI image with each post
    {
      name: "linkedin_auto_post_settings.include_image",
      query: `ALTER TABLE linkedin_auto_post_settings ADD COLUMN IF NOT EXISTS include_image BOOLEAN NOT NULL DEFAULT false`,
    },
    // LinkedIn posts: store AI-generated image URL
    {
      name: "linkedin_posts.image_url",
      query: `ALTER TABLE linkedin_posts ADD COLUMN IF NOT EXISTS image_url TEXT`,
    },
    // Outreach leads: track LinkedIn DM sent
    {
      name: "outreach_leads.linkedin_dm_sent_at",
      query: `ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS linkedin_dm_sent_at TIMESTAMP`,
    },
    {
      name: "outreach_leads.linkedin_dm_content",
      query: `ALTER TABLE outreach_leads ADD COLUMN IF NOT EXISTS linkedin_dm_content TEXT`,
    },
    // LinkedIn AI: feedback (rating + notes) per published post for learning loop
    {
      name: "linkedin_posts.feedback",
      query: `ALTER TABLE linkedin_posts ADD COLUMN IF NOT EXISTS feedback JSONB`,
    },
    // LinkedIn AI Brand Intel — admin-trained voice & rules used by every prompt
    {
      name: "linkedin_brand_intel",
      query: `CREATE TABLE IF NOT EXISTS linkedin_brand_intel (
        id SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        brand_story TEXT NOT NULL DEFAULT '',
        voice_rules TEXT[] NOT NULL DEFAULT '{}',
        do_not_say TEXT[] NOT NULL DEFAULT '{}',
        topics_love TEXT[] NOT NULL DEFAULT '{}',
        topics_avoid TEXT[] NOT NULL DEFAULT '{}',
        signature_phrases TEXT[] NOT NULL DEFAULT '{}',
        audience_notes TEXT NOT NULL DEFAULT '',
        preferred_hashtags TEXT[] NOT NULL DEFAULT '{}',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    // LinkedIn Post Examples — few-shot library of gold/edited/avoid posts
    {
      name: "linkedin_post_examples",
      query: `CREATE TABLE IF NOT EXISTS linkedin_post_examples (
        id SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        kind VARCHAR(20) NOT NULL DEFAULT 'gold',
        reason TEXT NOT NULL DEFAULT '',
        source_post_id INTEGER,
        post_type VARCHAR(50),
        language VARCHAR(10) NOT NULL DEFAULT 'en',
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`,
    },
    {
      name: "linkedin_post_examples.idx_admin",
      query: `CREATE INDEX IF NOT EXISTS idx_linkedin_post_examples_admin ON linkedin_post_examples(admin_user_id, kind)`,
    },
    // Approval workflow: when enabled, daily auto-posts wait for admin review before publishing
    {
      name: "linkedin_auto_post_settings.requires_approval",
      query: `ALTER TABLE linkedin_auto_post_settings ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false`,
    },
    // Competition categories: participant format (solo, 1v1, 2v2, 3v3, crew, singles, doubles, team)
    {
      name: "event_categories.participant_format",
      query: `ALTER TABLE event_categories ADD COLUMN IF NOT EXISTS participant_format TEXT DEFAULT '1V1'`,
    },
    // Battle matchups: physical table number for multi-table TT tournaments
    {
      name: "battle_matchups.table_number",
      query: `ALTER TABLE battle_matchups ADD COLUMN IF NOT EXISTS table_number INTEGER`,
    },
    // Users: poll creator permission
    {
      name: "users.can_create_polls",
      query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_polls BOOLEAN DEFAULT false`,
    },
    // Instagram AI Persona: AI feed & learn columns
    {
      name: "instagram_ai_persona.content_samples",
      query: `ALTER TABLE instagram_ai_persona ADD COLUMN IF NOT EXISTS content_samples JSONB NOT NULL DEFAULT '[]'`,
    },
    {
      name: "instagram_ai_persona.custom_vocabulary",
      query: `ALTER TABLE instagram_ai_persona ADD COLUMN IF NOT EXISTS custom_vocabulary JSONB NOT NULL DEFAULT '[]'`,
    },
    {
      name: "instagram_ai_persona.brand_facts",
      query: `ALTER TABLE instagram_ai_persona ADD COLUMN IF NOT EXISTS brand_facts JSONB NOT NULL DEFAULT '[]'`,
    },
    // Instagram AI Persona: learning history & analyzed profile
    {
      name: "instagram_ai_persona.learning_history",
      query: `ALTER TABLE instagram_ai_persona ADD COLUMN IF NOT EXISTS learning_history JSONB NOT NULL DEFAULT '[]'`,
    },
    {
      name: "instagram_ai_persona.analyzed_profile",
      query: `ALTER TABLE instagram_ai_persona ADD COLUMN IF NOT EXISTS analyzed_profile JSONB`,
    },
    // Per-account scoping for persona and automation rules
    {
      name: "instagram_ai_persona.instagram_connection_id",
      query: `ALTER TABLE instagram_ai_persona ADD COLUMN IF NOT EXISTS instagram_connection_id INTEGER REFERENCES instagram_connections(id) ON DELETE CASCADE`,
    },
    {
      name: "instagram_automation_rules.instagram_connection_id",
      query: `ALTER TABLE instagram_automation_rules ADD COLUMN IF NOT EXISTS instagram_connection_id INTEGER REFERENCES instagram_connections(id) ON DELETE CASCADE`,
    },
  ];

  let applied = 0;
  for (const migration of migrations) {
    try {
      await db.execute(sql.raw(migration.query));
      applied++;
    } catch (err: any) {
      // Column already exists with a different type or other non-critical error — log and continue
      if (!err.message?.includes("already exists")) {
        console.error(`Migration failed [${migration.name}]:`, err.message);
      }
    }
  }

  // Performance indexes — all idempotent (IF NOT EXISTS)
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_user_presence_coarse ON user_presence(coarse_lat, coarse_lng)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_conv_p1 ON chat_conversations(participant_one_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_conv_p2 ON chat_conversations(participant_two_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_conv_activity ON chat_conversations(last_activity DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_msgs_conv ON chat_messages(conversation_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_msgs_sender ON chat_messages(sender_id)`,
    `CREATE INDEX IF NOT EXISTS idx_mds_msg_user ON message_delivery_status(message_id, user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_mds_user ON message_delivery_status(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)`,
    `CREATE INDEX IF NOT EXISTS idx_outreach_emails_lead ON outreach_emails(lead_id)`,
    `CREATE INDEX IF NOT EXISTS idx_outreach_emails_sent ON outreach_emails(sent_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_outreach_opens_email ON outreach_email_opens(email_id)`,
    // Events performance indexes — critical with 1000+ rows
    `CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, date ASC)`,
    `CREATE INDEX IF NOT EXISTS idx_events_city ON events(city)`,
    `CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)`,
    `CREATE INDEX IF NOT EXISTS idx_events_source_extid ON events(source, external_id)`,
    `CREATE INDEX IF NOT EXISTS idx_events_featured ON events(is_featured) WHERE is_featured = true`,
    `CREATE INDEX IF NOT EXISTS idx_events_trending ON events(is_trending) WHERE is_trending = true`,
    // Notifications index — endpoint called on every page load with no cache previously
    `CREATE INDEX IF NOT EXISTS idx_user_notif_user ON user_notifications(user_id, created_at DESC)`,
    // Follow requests — queried per user on every page load
    `CREATE INDEX IF NOT EXISTS idx_user_follows_followed ON user_follows(followed_id, status)`,
    // Chat unread — complex JOIN across conversations + messages
    `CREATE INDEX IF NOT EXISTS idx_chat_conv_participants ON chat_conversations(participant_one_id, participant_two_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_msgs_unread ON chat_messages(conversation_id, sender_id, created_at DESC)`,
  ];
  for (const idx of indexes) {
    try { await db.execute(sql.raw(idx)); } catch (_) {}
  }

  // ── Event Polls ────────────────────────────────────────────────────────────
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS event_polls (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        created_by INTEGER NOT NULL REFERENCES users(id),
        question TEXT NOT NULL,
        poll_type TEXT NOT NULL DEFAULT 'yes_no',
        options TEXT[] NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        results_visibility TEXT NOT NULL DEFAULT 'live',
        voter_access TEXT NOT NULL DEFAULT 'all',
        closes_at TIMESTAMP,
        total_votes INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        id SERIAL PRIMARY KEY,
        poll_id INTEGER NOT NULL REFERENCES event_polls(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        option TEXT NOT NULL,
        voted_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_unique ON poll_votes(poll_id, user_id)`));
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_event_polls_event ON event_polls(event_id)`));
    await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_polls BOOLEAN DEFAULT false`));
  } catch (err: any) {
    console.error("Poll tables migration error:", err.message);
  }

  // One-time cleanup: delete all seeded/test events from the database.
  // Event seeding was permanently disabled — this ensures production DB matches dev.
  // Uses a tracking table so it only runs once per database.
  try {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS _migration_flags (flag TEXT PRIMARY KEY)`));
    const flagCheck = await db.execute(sql.raw(`SELECT 1 FROM _migration_flags WHERE flag = 'events_cleanup_v1'`));
    if ((flagCheck as any).rows?.length === 0) {
      const deleted = await db.execute(sql.raw(`DELETE FROM events`));
      const count = (deleted as any).rowCount || 0;
      if (count > 0) console.log(`🧹 Cleaned up ${count} seeded events from database`);
      await db.execute(sql.raw(`INSERT INTO _migration_flags (flag) VALUES ('events_cleanup_v1')`));
    }
  } catch (err: any) {
    console.error("Event cleanup migration error (non-fatal):", err.message);
  }

  // Poll enhancements: description field
  try {
    await db.execute(sql.raw(`ALTER TABLE event_polls ADD COLUMN IF NOT EXISTS description TEXT`));
  } catch (_) {}

  // API Keys table
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        key_prefix VARCHAR(12) NOT NULL,
        key_hash TEXT NOT NULL,
        permissions TEXT[] NOT NULL DEFAULT '{read}',
        request_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`));
    await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`));
  } catch (err: any) {
    console.error("API keys table migration error:", err.message);
  }

  // Instagram AI Persona table
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS instagram_ai_persona (
        id SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tone_and_voice TEXT NOT NULL DEFAULT '',
        communication_style TEXT NOT NULL DEFAULT '',
        business_direction TEXT NOT NULL DEFAULT '',
        topics_to_avoid TEXT NOT NULL DEFAULT '',
        example_interactions JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("instagram_ai_persona migration error:", err.message);
  }

  // Instagram Automation Rules table
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS instagram_automation_rules (
        id SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        trigger_type VARCHAR(100) NOT NULL,
        condition_keyword TEXT,
        action_type VARCHAR(100) NOT NULL,
        auto_send BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("instagram_automation_rules migration error:", err.message);
  }

  // Instagram AI Actions table
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS instagram_ai_actions (
        id SERIAL PRIMARY KEY,
        admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        trigger_type VARCHAR(100) NOT NULL,
        trigger_data JSONB NOT NULL DEFAULT '{}',
        raw_ai_output TEXT NOT NULL DEFAULT '',
        final_sent_text TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        rule_id INTEGER REFERENCES instagram_automation_rules(id) ON DELETE SET NULL,
        media_id VARCHAR(255),
        comment_id VARCHAR(255),
        source_text TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("instagram_ai_actions migration error:", err.message);
  }

  // BTTS (Back to the Street) tables
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS btts_program (
        id SERIAL PRIMARY KEY,
        time VARCHAR(20) NOT NULL,
        end_time VARCHAR(20),
        title VARCHAR(200) NOT NULL,
        artist VARCHAR(200),
        stage VARCHAR(100),
        type VARCHAR(50) NOT NULL DEFAULT 'performance',
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_highlight BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS btts_lineup (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        role VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'performer',
        bio TEXT,
        image_url TEXT,
        instagram VARCHAR(100),
        featured BOOLEAN NOT NULL DEFAULT false,
        sort_order INTEGER NOT NULL DEFAULT 0,
        added_by_ai BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS btts_battles (
        id SERIAL PRIMARY KEY,
        battle_type VARCHAR(50) NOT NULL DEFAULT '1v1',
        category VARCHAR(100) NOT NULL,
        round VARCHAR(50) NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        participant1 VARCHAR(200),
        participant2 VARCHAR(200),
        winner VARCHAR(200),
        scheduled_time VARCHAR(20),
        status VARCHAR(30) NOT NULL DEFAULT 'upcoming',
        added_by_ai BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS btts_gallery (
        id SERIAL PRIMARY KEY,
        media_type VARCHAR(20) NOT NULL DEFAULT 'image',
        url TEXT NOT NULL,
        thumbnail_url TEXT,
        caption TEXT,
        featured BOOLEAN NOT NULL DEFAULT false,
        sort_order INTEGER NOT NULL DEFAULT 0,
        uploaded_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS btts_registrations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        guest_name VARCHAR(200),
        crew_name VARCHAR(200),
        battle_type VARCHAR(50) NOT NULL DEFAULT '1v1',
        category VARCHAR(100) NOT NULL DEFAULT 'Breaking',
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        paid BOOLEAN NOT NULL DEFAULT false,
        notes TEXT,
        added_by VARCHAR(50) NOT NULL DEFAULT 'self',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS btts_judges (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        guest_name VARCHAR(200),
        specialty VARCHAR(100),
        bio TEXT,
        judge_number INTEGER NOT NULL,
        category VARCHAR(100) NOT NULL DEFAULT 'Breaking',
        avatar_url TEXT,
        added_by_ai BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS btts_tickets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        price INTEGER NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
        type VARCHAR(50) NOT NULL DEFAULT 'general',
        battle_format VARCHAR(50),
        total_spots INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS btts_ticket_purchases (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER REFERENCES btts_tickets(id),
        user_id INTEGER REFERENCES users(id),
        guest_name VARCHAR(200),
        guest_email VARCHAR(200),
        spot_number INTEGER,
        status VARCHAR(30) NOT NULL DEFAULT 'confirmed',
        registration_id INTEGER,
        stripe_session_id TEXT,
        amount_paid TEXT,
        qr_code TEXT,
        notes TEXT,
        checked_in BOOLEAN DEFAULT false,
        checked_in_at TIMESTAMP,
        scan_count INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("BTTS tables migration error:", err.message);
  }

  // Founder Profile table
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS founder_profile (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(200) NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("founder_profile migration error:", err.message);
  }

  // AI Training Entries table
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS ai_training_entries (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL DEFAULT 'general',
        title VARCHAR(300) NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        is_public BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("ai_training_entries migration error:", err.message);
  }

  // Street Cred Score
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS cred_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        reason VARCHAR(100) NOT NULL,
        reference_id INTEGER,
        reference_type VARCHAR(50),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cred_score INTEGER NOT NULL DEFAULT 0`));
  } catch (err: any) {
    console.error("cred_transactions migration error:", err.message);
  }

  // Crews + crew_members
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS crews (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        slug VARCHAR(200) NOT NULL UNIQUE,
        description TEXT,
        discipline VARCHAR(100) NOT NULL DEFAULT 'breaking',
        city VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Netherlands',
        logo_url TEXT,
        banner_url TEXT,
        founded_year INTEGER,
        instagram VARCHAR(100),
        is_public BOOLEAN NOT NULL DEFAULT true,
        founder_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS crew_members (
        id SERIAL PRIMARY KEY,
        crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("crews migration error:", err.message);
  }

  // Freestyle Challenges
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS freestyle_challenges (
        id SERIAL PRIMARY KEY,
        title VARCHAR(300) NOT NULL,
        description TEXT NOT NULL,
        theme VARCHAR(200),
        discipline VARCHAR(100) NOT NULL DEFAULT 'breaking',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        winner_id INTEGER REFERENCES users(id),
        created_by INTEGER NOT NULL REFERENCES users(id),
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS challenge_entries (
        id SERIAL PRIMARY KEY,
        challenge_id INTEGER NOT NULL REFERENCES freestyle_challenges(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        video_url TEXT NOT NULL,
        caption TEXT,
        vote_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS challenge_votes (
        id SERIAL PRIMARY KEY,
        entry_id INTEGER NOT NULL REFERENCES challenge_entries(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("freestyle_challenges migration error:", err.message);
  }

  // Cyphers
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS cyphers (
        id SERIAL PRIMARY KEY,
        host_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        discipline VARCHAR(100) NOT NULL DEFAULT 'breaking',
        description TEXT,
        lat DOUBLE PRECISION NOT NULL,
        lon DOUBLE PRECISION NOT NULL,
        location_name VARCHAR(300),
        starts_at TIMESTAMP NOT NULL,
        ends_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true,
        attendee_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("cyphers migration error:", err.message);
  }

  // Graffiti Wall
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS graffiti_tags (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type VARCHAR(30) NOT NULL DEFAULT 'sticker',
        image_url TEXT,
        text TEXT,
        color VARCHAR(30) DEFAULT '#ffffff',
        pos_x DOUBLE PRECISION NOT NULL DEFAULT 0,
        pos_y DOUBLE PRECISION NOT NULL DEFAULT 0,
        rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
        scale DOUBLE PRECISION NOT NULL DEFAULT 1,
        layer INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("graffiti_tags migration error:", err.message);
  }

  // Beat Lab
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS beats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(300) NOT NULL,
        genre VARCHAR(100) DEFAULT 'hip-hop',
        bpm INTEGER DEFAULT 90,
        audio_url TEXT NOT NULL,
        cover_url TEXT,
        duration INTEGER,
        tags TEXT[],
        play_count INTEGER NOT NULL DEFAULT 0,
        like_count INTEGER NOT NULL DEFAULT 0,
        is_public BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("beats migration error:", err.message);
  }

  // Community Radio
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS radio_submissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        title VARCHAR(300) NOT NULL,
        artist VARCHAR(200),
        genre VARCHAR(100) DEFAULT 'hip-hop',
        duration INTEGER,
        audio_url TEXT NOT NULL,
        cover_url TEXT,
        play_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("radio_submissions migration error:", err.message);
  }

  // Hall of Fame
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS hall_of_fame (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(200) NOT NULL,
        discipline VARCHAR(100) NOT NULL,
        city VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Netherlands',
        bio TEXT,
        achievement TEXT NOT NULL,
        year INTEGER,
        image_url TEXT,
        instagram_handle VARCHAR(100),
        sort_order INTEGER NOT NULL DEFAULT 0,
        added_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `));
  } catch (err: any) {
    console.error("hall_of_fame migration error:", err.message);
  }

  // ── DATA FIX: Ticketmaster events wrongly stored as free ──────────────
  // Old sync code defaulted to is_paid=false, price_model='free' when
  // Ticketmaster didn't return priceRanges. Every Ticketmaster event
  // requires a ticket, so correct all affected rows now.
  try {
    const tmFix = await db.execute(sql`
      UPDATE events
      SET    is_paid    = true,
             price_model = CASE
               WHEN price_model = 'free' OR price_model IS NULL THEN 'ticketed'
               ELSE price_model
             END
      WHERE  source = 'ticketmaster'
        AND  (is_paid = false OR is_paid IS NULL)
    `);
    const rowCount = (tmFix as any).rowCount ?? (tmFix as any).count ?? 0;
    if (rowCount > 0) {
      console.log(`🎫 Fixed ${rowCount} Ticketmaster events: is_paid=true, price_model=ticketed`);
    }
  } catch (err: any) {
    console.error("ticketmaster price fix migration error:", err.message);
  }

  // instagram_scheduled_posts table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS instagram_scheduled_posts (
        id              SERIAL PRIMARY KEY,
        admin_user_id   INTEGER NOT NULL,
        media_type      TEXT NOT NULL DEFAULT 'REELS',
        media_url       TEXT NOT NULL,
        caption         TEXT,
        hashtags        TEXT,
        scheduled_at    TIMESTAMPTZ NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        instagram_media_id TEXT,
        permalink       TEXT,
        error_message   TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("📅 instagram_scheduled_posts table ensured");
  } catch (err: any) {
    console.error("instagram_scheduled_posts migration error:", err.message);
  }

  try {
    await db.execute(sql.raw(
      `ALTER TABLE instagram_connections ADD COLUMN IF NOT EXISTS website TEXT`
    ));
  } catch (err: any) {
    console.error("instagram_connections website migration error:", err.message);
  }

  try {
    await db.execute(sql.raw(
      `ALTER TABLE instagram_scheduled_posts ADD COLUMN IF NOT EXISTS permalink TEXT`
    ));
  } catch (err: any) {
    console.error("instagram_scheduled_posts permalink migration error:", err.message);
  }

  try {
    await db.execute(sql.raw(
      `ALTER TABLE instagram_scheduled_posts ADD COLUMN IF NOT EXISTS carousel_slides TEXT`
    ));
  } catch (err: any) {
    console.error("instagram_scheduled_posts carousel_slides migration error:", err.message);
  }

  console.log(`✅ Column migrations done (${applied}/${migrations.length} applied)`);

  // LinkedIn account_slot column (multi-account switcher support)
  try {
    await db.execute(sql.raw(
      `ALTER TABLE linkedin_connections ADD COLUMN IF NOT EXISTS account_slot TEXT NOT NULL DEFAULT 'primary'`
    ));
  } catch (err: any) {
    console.error("linkedin_connections account_slot migration error:", err.message);
  }

  // One-time data migration: deactivate all spotlights so every spot clusters by default.
  // Admin can re-activate individual spots via the admin panel to pull them out of clusters.
  try {
    const flag = await db.execute(sql`
      SELECT value FROM app_settings WHERE key = 'spotlight_initial_deactivate_done'
    `);
    const rows = (flag as any).rows ?? flag;
    if (!rows || rows.length === 0) {
      await db.execute(sql`UPDATE spotlighted_places SET active = false`);
      await db.execute(sql`
        INSERT INTO app_settings (key, value, label)
        VALUES ('spotlight_initial_deactivate_done', 'true', 'Spotlight initial deactivation applied')
        ON CONFLICT (key) DO UPDATE SET value = 'true'
      `);
      console.log("🗺️ One-time migration: all spotlights deactivated (admin can re-enable per spot)");
    }
  } catch (err: any) {
    console.error("spotlight deactivation migration error:", err.message);
  }
}
