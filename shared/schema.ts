import { pgTable, text, serial, integer, bigint, boolean, timestamp, jsonb, numeric, doublePrecision, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Constants
export const UserRole = {
  ARTIST: "artist",
  ATHLETE: "athlete",
  ENTHUSIAST: "enthusiast",
  MUNICIPALITY: "municipality",
  SCHOOL: "school",
  SPOT_OWNER: "spot_owner",
  ADMIN: "admin",
  MODERATOR: "moderator",
  SUPER_ADMIN: "super_admin",
} as const;

// Notification Types
export const NotificationType = {
  EVENT_INVITATION: "event_invitation",
  EVENT_REMINDER: "event_reminder",
  EVENT_UPDATE: "event_update",
  EVENT_CANCELED: "event_canceled",
  EVENT_RSVP: "event_rsvp",
  SPOT_ADDED: "spot_added",
  SPOT_UPDATED: "spot_updated",
  SERVICE_BOOKED: "service_booked",
  SERVICE_BOOKING_APPROVED: "service_booking_approved",
  SERVICE_BOOKING_REJECTED: "service_booking_rejected",
  SERVICE_BOOKING_COMPLETED: "service_booking_completed",
  SERVICE_BOOKING_CANCELED: "service_booking_canceled",
  SERVICE_REVIEWED: "service_reviewed",
  POST_LIKE: "post_like",
  POST_COMMENT: "post_comment",
  POST_MENTION: "post_mention",
  COMMENT_REPLY: "comment_reply",
  ARTIST_FOLLOWED: "artist_followed",
  NEARBY_EVENT: "nearby_event",
  KVK_VERIFICATION_APPROVED: "kvk_verification_approved",
  KVK_VERIFICATION_REJECTED: "kvk_verification_rejected",
  SYSTEM_ANNOUNCEMENT: "system_announcement",
  ACHIEVEMENT_UNLOCKED: "achievement_unlocked",
  FRIEND_REQUEST: "friend_request",
  FRIEND_REQUEST_ACCEPTED: "friend_request_accepted",
  FRIEND_REQUEST_REJECTED: "friend_request_rejected",
  MODERATION: "moderation", // Added for content moderation notifications
} as const;

// Admin Action Types
export const AdminActionType = {
  USER_APPROVAL: "user_approval",
  USER_REJECTION: "user_rejection", 
  USER_SUSPENSION: "user_suspension",
  USER_DELETION: "user_deletion",
  USER_RESTORATION: "user_restoration",
  EVENT_APPROVAL: "event_approval",
  EVENT_REJECTION: "event_rejection",
  EVENT_MODIFICATION: "event_modification",
  POST_MODERATION: "post_moderation",
  COMMENT_MODERATION: "comment_moderation",
  SYSTEM_CHANGE: "system_change",
  
  // Ticket validation actions
  TICKET_VALIDATION: "ticket_validation",
  TICKET_SCAN: "ticket_scan",
  TICKET_ISSUANCE: "ticket_issuance",
  TICKET_DELETION: "ticket_deletion",
} as const;

// Ticket Types
export const TicketType = {
  STANDARD: "standard",
  VIP: "vip",
  PREMIUM: "premium",
} as const;

// Content Flag Status
export const ContentFlagStatus = {
  PENDING: "pending",
  REVIEWED: "reviewed",
  APPROVED: "approved", 
  REJECTED: "rejected",
} as const;

// Report Reason Types
export const ReportReasonType = {
  INAPPROPRIATE: "inappropriate_content",
  HARASSMENT: "harassment",
  HATE_SPEECH: "hate_speech",
  VIOLENCE: "violence",
  SPAM: "spam",
  MISINFORMATION: "misinformation",
  COPYRIGHT: "copyright_violation",
  EXPLICIT: "explicit_content",
  OTHER: "other"
} as const;

// Content Filter Level
export const ContentFilterLevel = {
  NONE: "none",           // No filtering
  LOW: "low",             // Filter only extreme content
  MEDIUM: "medium",       // Default - filters most objectionable content
  HIGH: "high",           // High filtering for objectionable content
  STRICT: "strict",       // Strictest filtering for all potentially objectionable content
} as const;

// Friend Request Status removed

// KVK Verification Status
export const KvkVerificationStatus = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
  MANUAL_REVIEW: "manual_review",
} as const;

export const ProductCategory = {
  ARTWORK: "artwork",
  CLOTHING: "clothing",
  ACCESSORIES: "accessories",
  SHOES: "shoes",
  EQUIPMENT: "equipment",
  VINYL_MUSIC: "vinyl_music",
  BOOKS: "books",
  COLLECTIBLES: "collectibles",
  PERFORMANCE: "performance",
  WORKSHOP: "workshop",
  LESSON: "lesson",
  EVENT_SERVICE: "event_service",
  TECHNICAL: "technical",
  OTHER: "other",
} as const;

export const ProductCondition = {
  NEW: "new",
  LIKE_NEW: "like_new",
  GOOD: "good",
  FAIR: "fair",
  POOR: "poor",
} as const;

export const ListingType = {
  SECONDHAND: "secondhand",
  NEW: "new",
} as const;

export const DeliveryOption = {
  PICKUP: "pickup",
  SHIPPING: "shipping",
  BOTH: "both",
} as const;

export const OrderStatus = {
  PENDING: "pending",         // Initial state, payment pending
  PAID: "paid",               // Paid but waiting for seller approval
  APPROVED: "approved",       // Seller has approved the order
  PROCESSING: "processing",   // Order is being prepared
  SHIPPED: "shipped",         // Order has been shipped
  DELIVERED: "delivered",     // Order has been delivered
  COMPLETED: "completed",     // Order is complete (esp. for digital items)
  CANCELLED: "cancelled",     // Order has been cancelled by buyer or seller
  REJECTED: "rejected",       // Order has been rejected by seller
  REFUNDED: "refunded"        // Order has been refunded
} as const;

export const MembershipTier = {
  FREE: "free",
  PREMIUM: "premium",
} as const;

export const SubscriptionPeriod = {
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

// Message status for read receipts and delivery status
export const MessageStatus = {
  SENT: "sent",           // Message has been sent to the server
  DELIVERED: "delivered", // Message has been delivered to the recipient's device
  READ: "read",           // Message has been read by the recipient
} as const;

// Location categories for map filtering
export const LocationType = {
  // Urban Art & Performance Categories
  GRAFFITI: "graffiti",          // Murals, tagging, street art spots
  DANCE: "dance",                // Breakdance, Hip-Hop, House, Krump
  MUSIC: "music",                // DJ practice, studio, street music
  RAP: "rap",                    // Freestyle rap battle locations
  PERFORMANCE: "performance",    // Circus acts, theater, urban shows
  BEATBOX: "beatbox",            // Beatbox sessions and battle spots

  // Urban Sports & Training
  SKATE: "skate",                // Skateparks, street skating spots
  PARKOUR: "parkour",            // Urban free-running / freerunning spots
  TRAINING: "training",          // Outdoor calisthenics parks, pull-up bars
  FITNESS: "fitness",            // Indoor gyms, fitness centers
  BMX: "bmx",                    // BMX parks and dirt tracks
  STREET_SPORTS: "street_sports", // Street football, volleyball, handball
  BASKETBALL: "basketball",      // Basketball courts (indoor & outdoor)
  TABLE_TENNIS: "table_tennis",  // Table tennis clubs and outdoor tables
  BOULDERING: "bouldering",      // Bouldering & climbing gyms
  PADEL: "padel",                // Padel courts

  // Food, Social & Culture
  CAFE: "cafe",                  // Cafés with urban culture vibe
  RESTAURANT: "restaurant",      // Restaurants popular with the community
  WELLNESS: "wellness",          // Spa, sauna, wellness & recovery
  NIGHTLIFE: "nightlife",        // Clubs, nights, late-night culture venues

  // Community & Events Spaces
  CULTURAL_HUB: "cultural_hub", // Community centers, cultural venues
  OPEN_MIC: "open_mic",          // Spoken word & live music events
  WORKSHOP: "workshop",          // Dance & urban art training spaces

  // Catch-all
  OTHER: "other",                // Any other location type
} as const;

// User table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default(UserRole.ENTHUSIAST),
  bio: text("bio"),
  profilePicture: text("profile_picture"),
  artType: text("art_type"),
  organizationName: text("organization_name"),
  kvkNumber: text("kvk_number"),
  btwNumber: text("btw_number"), // BTW (VAT) number
  kvkVerificationStatus: text("kvk_verification_status").default(KvkVerificationStatus.PENDING),
  kvkVerifiedAt: timestamp("kvk_verified_at"),
  kvkVerificationFailReason: text("kvk_verification_fail_reason"),
  isVerified: boolean("is_verified").default(false),
  isApproved: boolean("is_approved").default(false),
  isHiddenInCommunity: boolean("is_hidden_in_community").default(false), // Admin can hide/show artists in community
  isAiPremium: boolean("is_ai_premium").default(false), // Granted by admin or via paid subscription
  canAddSpots: boolean("can_add_spots").default(false), // Granted by admin — user can submit community spots
  canCreatePolls: boolean("can_create_polls").default(false), // Granted by admin — user can create event polls
  canShareContent: boolean("can_share_content").default(false), // Granted by admin — user can share posts/reels externally
  location: text("location"),
  homeStreet: text("home_street"),
  homePostcode: text("home_postcode"),
  homeCity: text("home_city"),
  homeCountry: text("home_country"),
  stripeCustomerId: text("stripe_customer_id"),
  status: text("status").default("active"), // active, suspended, deleted
  tosAccepted: boolean("tos_accepted").default(false),
  tosAcceptedAt: timestamp("tos_accepted_at"),
  tosVersion: text("tos_version"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  firebaseUid: text("firebase_uid").unique(),
});

// Spot/Location approval status
export const SpotApprovalStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

// Locations table
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address"),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  type: text("type").notNull(), // graffiti, dance, training, etc.
  accessibility: text("accessibility"), // wheelchair, limited, not_accessible, unknown
  openingHours: text("opening_hours"),
  surfaceType: text("surface_type"), // concrete, asphalt, wood, etc.
  skillLevel: text("skill_level"), // beginner, intermediate, advanced, all
  isFree: boolean("is_free").default(true),
  website: text("website"),
  contactInfo: text("contact_info"),
  images: text("images").array(),
  createdBy: integer("created_by").references(() => users.id),
  isVisible: boolean("is_visible").default(true), // Admin can hide/show spots
  approvalStatus: text("approval_status").default("pending"), // pending, approved, rejected
  approvedBy: integer("approved_by").references(() => users.id), // Admin who approved
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Extended rich fields (same as OSM spots)
  indoorOutdoor: text("indoor_outdoor"), // indoor / outdoor / covered / both
  lighting: text("lighting"),           // full / partial / none
  amenities: text("amenities").array(), // parking, toilets, wifi, changing_room, etc.
  crowdLevel: text("crowd_level"),      // quiet / moderate / busy / varies
  floorMaterial: text("floor_material"), // smooth_concrete, rough_concrete, marble, tiles, wood, asphalt, dirt, grass
  osmCategory: text("osm_category"),    // for AI finder categorization
  osmId: text("osm_id"),               // link to OSM spot if claimed
  capacity: integer("capacity"),        // max people / event capacity
  instagram: text("instagram"),         // @handle
  rules: text("rules"),                // spot rules / access info
  bestFor: text("best_for").array(),   // ["beginners","filming","competitions"]
  tags: text("tags").array(),          // free-form tags
});

// Events table
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  latitude: text("latitude"),
  longitude: text("longitude"),
  date: timestamp("date").notNull(),
  endDate: timestamp("end_date"),
  image: text("image"),
  gallery: text("gallery").array(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  city: text("city"),
  tags: text("tags").array(),
  vibeLabels: text("vibe_labels").array(),
  moodTags: text("mood_tags").array(),
  // Pricing
  isPaid: boolean("is_paid").default(false),
  price: integer("price"),
  priceModel: text("price_model").default("free"), // free / paid / from
  adultPrice: integer("adult_price"),
  kidsPrice: integer("kids_price"),
  familyPrice: integer("family_price"),
  earlyBirdPrice: integer("early_bird_price"),
  ticketTiers: jsonb("ticket_tiers"),
  externalTicketLink: text("external_ticket_link"),
  // Capacity & engagement
  capacity: integer("capacity"),
  soldOut: boolean("sold_out").default(false),
  attendeeCount: integer("attendee_count").default(0),
  likeCount: integer("like_count").default(0),
  viewCount: integer("view_count").default(0),
  // Kids & Family
  kidFriendly: boolean("kid_friendly").default(false),
  familyFriendly: boolean("family_friendly").default(false),
  parentRequired: boolean("parent_required").default(false),
  strollerFriendly: boolean("stroller_friendly").default(false),
  minAge: integer("min_age"),
  maxAge: integer("max_age"),
  recommendedAge: text("recommended_age"),
  accessibilityOptions: text("accessibility_options").array(),
  // Venue
  isIndoor: boolean("is_indoor"),
  crowdLevel: text("crowd_level"), // low / medium / busy
  // Discovery / Curation
  isFeatured: boolean("is_featured").default(false),
  isTrending: boolean("is_trending").default(false),
  isVerifiedOrganizer: boolean("is_verified_organizer").default(false),
  // Organizer extras
  organizerBio: text("organizer_bio"),
  // Multilingual content
  titleEn: text("title_en"),
  descriptionEn: text("description_en"),
  // External sources
  source: text("source").default("manual"), // manual | eventbrite | meetup | ticketmaster
  externalId: text("external_id"),
  musicGenre: text("music_genre"), // electronic | hiphop | rnb | jazz | pop | rock | latin | classical | reggae | afrobeats | folk | world | dance
  // Status
  status: text("status").default("pending"), // pending, approved, rejected
  isCompetition: boolean("is_competition").default(false), // true = competition event with bracket system
  organizerId: integer("organizer_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Competition Sports constants
export const CompetitionSport = {
  // Dance (judge-panel with 5-criteria scoring)
  BREAKING: "BREAKING",
  POPPING: "POPPING",
  LOCKING: "LOCKING",
  HIPHOP: "HIPHOP",
  ALL_STYLES: "ALL_STYLES",
  WAACKING: "WAACKING",
  VOGUING: "VOGUING",
  // Urban sports
  TABLE_TENNIS: "TABLE_TENNIS",
  BASKETBALL_3V3: "BASKETBALL_3V3",
  FREESTYLE_FOOTBALL: "FREESTYLE_FOOTBALL",
  PADEL: "PADEL",
  // Combat
  BOXING: "BOXING",
  ARM_WRESTLING: "ARM_WRESTLING",
  // Mind sports
  CHESS: "CHESS",
  // Other
  CUSTOM: "CUSTOM",
} as const;

// Event Categories table - for battle/dance categories within events
export const eventCategories = pgTable("event_categories", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  name: text("name").notNull(), // e.g., "1vs1 Breaking", "All Styles Battle", "Kids Breaking"
  style: text("style").notNull(), // BREAKING, POPPING, LOCKING, HIPHOP, ALL_STYLES
  competitionSport: text("competition_sport").default("BREAKING"), // from CompetitionSport constants
  participantLabel: text("participant_label").default("dancer"), // dancer / player / athlete / team / competitor
  maxDancers: integer("max_dancers"), // capacity for this category
  registrationMode: text("registration_mode").notNull().default("RESERVATION_ONLY"), // PAID or RESERVATION_ONLY
  registrationFee: integer("registration_fee"), // in cents, null for free categories
  isActive: boolean("is_active").default(true),
  battleFormat: text("battle_format").default("SINGLE_ELIMINATION"), // SINGLE_ELIMINATION, DOUBLE_ELIMINATION, ROUND_ROBIN
  roundsToWin: integer("rounds_to_win").default(2), // Best of X rounds (2 = Best of 3, 3 = Best of 5)
  judgingMethod: text("judging_method").default("VOTE"), // VOTE, POINTS, KNOCKOUT, LIVE_JUDGES
  judgeCount: integer("judge_count").default(3), // Number of judges: 3, 5, or 7
  useJudgeVoting: boolean("use_judge_voting").default(true), // Enable live judge voting per round
  battleRules: text("battle_rules"), // Custom rules text
  participantFormat: text("participant_format").default("1V1"), // SOLO, 1V1, 2V2, 3V3, CREW, SINGLES, DOUBLES, TEAM
  allowSelfRegistration: boolean("allow_self_registration").default(true), // Whether dancers can self-register
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Dancer Registrations table - tracks registrations per event category
export const dancerRegistrations = pgTable("dancer_registrations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  categoryId: integer("category_id").references(() => eventCategories.id).notNull(),
  userId: integer("user_id").references(() => users.id), // Optional for admin-added external dancers
  paymentStatus: text("payment_status").notNull().default("NOT_REQUIRED"), // NOT_REQUIRED, REQUIRED_UNPAID, PAID
  status: text("status").notNull().default("CONFIRMED"), // CONFIRMED, WAITING_LIST, CANCELLED
  seedingIndex: integer("seeding_index"), // for bracket ordering
  paymentIntentId: text("payment_intent_id"), // Stripe payment ID for paid registrations
  source: text("source").notNull().default("SELF"), // SELF (user registered), ADMIN (admin added)
  displayName: text("display_name"), // For external dancers without user account
  contactEmail: text("contact_email"), // For external dancers
  addedByUserId: integer("added_by_user_id").references(() => users.id), // Admin who added the dancer
  notes: text("notes"), // Admin notes about the dancer
  registeredAt: timestamp("registered_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Battle Matchups table - stores bracket pairings
export const battleMatchups = pgTable("battle_matchups", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  categoryId: integer("category_id").references(() => eventCategories.id).notNull(),
  round: integer("round").notNull(), // 1 = first round, 2 = quarter finals, etc.
  position: integer("position").notNull(), // ordering within the round
  dancerARegistrationId: integer("dancer_a_registration_id").references(() => dancerRegistrations.id),
  dancerBRegistrationId: integer("dancer_b_registration_id").references(() => dancerRegistrations.id),
  status: text("status").notNull().default("SCHEDULED"), // SCHEDULED, IN_PROGRESS, VOTING, COMPLETED
  winnerRegistrationId: integer("winner_registration_id").references(() => dancerRegistrations.id),
  bestOf: integer("best_of").notNull().default(3), // Number of rounds (1, 3, 5, 7) - Best of 3 by default
  currentRound: integer("current_round").notNull().default(1), // Which round is currently active
  dancerARoundWins: integer("dancer_a_round_wins").notNull().default(0), // Rounds won by dancer A
  dancerBRoundWins: integer("dancer_b_round_wins").notNull().default(0), // Rounds won by dancer B
  isManual: boolean("is_manual").default(false), // True if matchup was manually created by admin
  scheduledTime: timestamp("scheduled_time"), // Optional scheduled time for the battle
  notes: text("notes"), // Admin notes for this matchup
  tableNumber: integer("table_number"), // Physical table number for multi-table TT (null = single table)
  // Live real-time scoring (Table Tennis & fast-paced sports)
  liveScoreA: integer("live_score_a").notNull().default(0), // Current game points for player A
  liveScoreB: integer("live_score_b").notNull().default(0), // Current game points for player B
  scoreData: jsonb("score_data"), // {sets:[{a:11,b:7},...], currentSetLog:['A','B',...], gamesA:0, gamesB:0}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Battle Judges table - assigns users as judges for a category
export const battleJudges = pgTable("battle_judges", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  categoryId: integer("category_id").references(() => eventCategories.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  judgeNumber: integer("judge_number").notNull(), // 1, 2, 3, etc. for display order
  isActive: boolean("is_active").default(true),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedByUserId: integer("assigned_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Battle Votes table - stores judge votes for each matchup with 5-criteria scoring
export const battleVotes = pgTable("battle_votes", {
  id: serial("id").primaryKey(),
  matchupId: integer("matchup_id").references(() => battleMatchups.id).notNull(),
  roundNumber: integer("round_number").notNull().default(1), // Which round this vote is for (1, 2, 3, etc.)
  judgeId: integer("judge_id").references(() => battleJudges.id).notNull(),
  judgeUserId: integer("judge_user_id").references(() => users.id).notNull(),
  votedForRegistrationId: integer("voted_for_registration_id").references(() => dancerRegistrations.id).notNull(),
  // 5-criteria Olympic Trivium-style scoring for DANCE (1-10 scale each, 20% weight)
  techniqueScore: integer("technique_score"), // Physical skill, control, power
  vocabularyScore: integer("vocabulary_score"), // Range of moves, creativity
  executionScore: integer("execution_score"), // Clean execution, flow
  musicalityScore: integer("musicality_score"), // Rhythm, timing, music interpretation
  originalityScore: integer("originality_score"), // Uniqueness, personal style
  // Flexible sport-specific score data (for non-dance sports)
  scoreData: jsonb("score_data"), // e.g. {sets:[{a:11,b:7},{a:9,b:11}]} for table tennis
  notes: text("notes"), // Optional judge notes
  votedAt: timestamp("voted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Live Results Viewers - users who can see battle results on projector for audience
export const liveResultsViewers = pgTable("live_results_viewers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  categoryId: integer("category_id").references(() => eventCategories.id),
  grantedByUserId: integer("granted_by_user_id").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// RSVPs table
export const rsvps = pgTable("rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id),
  userId: integer("user_id").references(() => users.id),
  status: text("status").notNull(), // going, maybe, not going
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved Events table - user watchlist
export const savedEvents = pgTable("saved_events", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Posts table
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  image: text("image"),
  userId: integer("user_id").references(() => users.id),
  privacy: text("privacy").notNull().default("public"),
  groupId: integer("group_id"), // null = public feed, set = group post
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  postId: integer("post_id").references(() => posts.id),
  userId: integer("user_id").references(() => users.id),
  parentCommentId: integer("parent_comment_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Likes table
export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => posts.id),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved locations table
export const savedLocations = pgTable("saved_locations", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").references(() => locations.id),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tickets table
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id),
  userId: integer("user_id").references(() => users.id),
  paymentIntentId: text("payment_intent_id").notNull().unique(), // Unique constraint prevents duplicate tickets
  qrCode: text("qr_code").notNull(),
  isUsed: boolean("is_used").default(false),
  isValid: boolean("is_valid").default(true),
  purchaseAmount: integer("purchase_amount").notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  emailSent: boolean("email_sent").default(false),
  ticketQuantity: integer("ticket_quantity").default(1),
  ticketNumber: text("ticket_number"),
  seat: text("seat"),
  checkInTime: timestamp("check_in_time"),
  type: text("type").default("standard"), // standard, vip, premium
  pdfUrl: text("pdf_url"),
  scanCount: integer("scan_count").default(0),
  lastScanned: timestamp("last_scanned"),
  notes: text("notes"),
});

// Memberships table
export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  tier: text("tier").notNull(), // free, premium
  period: text("period"), // monthly, yearly
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  status: text("status").default("active"), // active, cancelled
  cancelledAt: timestamp("cancelled_at"),
  price: numeric("price"),
  autoRenew: boolean("auto_renew").default(true),
  features: text("features").array(),
});

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price").notNull(),
  category: text("category").notNull(),
  images: text("images").array(),
  stock: integer("stock").default(1),
  sellerId: integer("seller_id").references(() => users.id),
  isDigital: boolean("is_digital").default(false),
  digitalContentUrl: text("digital_content_url"),
  status: text("status").default("active"), // active, deleted, discontinued
  // Enhanced marketplace fields
  condition: text("condition").default("good"), // new, like_new, good, fair, poor
  listingType: text("listing_type").default("secondhand"), // secondhand, new
  deliveryOption: text("delivery_option").default("shipping"), // pickup, shipping, both
  pickupCity: text("pickup_city"), // City for local pickup
  pickupAddress: text("pickup_address"), // Optional address detail for pickup
  brand: text("brand"), // Optional brand name
  size: text("size"), // Optional size (clothing, shoes etc)
  color: text("color"), // Optional color
  views: integer("views").default(0), // View counter
  aiQualityScore: integer("ai_quality_score"), // 0-100 AI-generated quality score
  aiQualityFeedback: text("ai_quality_feedback"), // AI feedback on listing
  shippingCost: numeric("shipping_cost").default("0"), // 0 = free, null = contact seller
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Terms of Service table
export const termsOfService = pgTable("terms_of_service", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  publishedAt: timestamp("published_at").defaultNow(),
});

// Explore Page Images table
export const explorePageImages = pgTable("explore_page_images", {
  id: serial("id").primaryKey(),
  section: text("section").notNull(), // e.g., 'events', 'marketplace', 'community', 'services'
  imageUrl: text("image_url").notNull(),
  imagePublicId: text("image_public_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  isCoverImage: boolean("is_cover_image").default(false), // Flag to mark an image as the main cover for its section
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").references(() => users.id),
  status: text("status").notNull().default(OrderStatus.PENDING),
  totalAmount: numeric("total_amount").notNull(),
  subtotalAmount: numeric("subtotal_amount"), // Price before shipping
  shippingCost: numeric("shipping_cost").default("7.00"), // Default €7.00 shipping cost
  paymentIntentId: text("payment_intent_id"),
  shippingAddress: text("shipping_address"),
  shippingPostalCode: text("shipping_postal_code"),
  shippingCity: text("shipping_city"),
  shippingCountry: text("shipping_country").default("Netherlands"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"), // PostNL tracking URL
  courierName: text("courier_name").default("PostNL"), // Default courier
  notes: text("notes"), // Buyer or seller notes
  emailSent: boolean("email_sent").default(false), // Track if confirmation email was sent
  sellerNotified: boolean("seller_notified").default(false), // Track if seller was notified
  rejectionReason: text("rejection_reason"), // If order is rejected by seller
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  productId: integer("product_id").references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  priceAtPurchase: numeric("price_at_purchase").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin Actions Log table
export const adminActions = pgTable("admin_actions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id),
  actionType: text("action_type").notNull(),
  targetId: integer("target_id"),
  targetType: text("target_type").notNull(), // 'user', 'event', 'post', 'comment', 'system'
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Content Flags table - for reported content
export const contentFlags = pgTable("content_flags", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").references(() => users.id),
  contentType: text("content_type").notNull(), // 'post', 'comment'
  contentId: integer("content_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default(ContentFlagStatus.PENDING),
  reviewerId: integer("reviewer_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Event Tickets Configuration table
export const eventTicketTypes = pgTable("event_ticket_types", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id),
  name: text("name").notNull(), // standard, vip, premium
  price: numeric("price").notNull(),
  description: text("description"),
  maxQuantity: integer("max_quantity"),
  availableQuantity: integer("available_quantity"),
  benefits: text("benefits"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin Notifications table
export const adminNotifications = pgTable("admin_notifications", {
  id: serial("id").primaryKey(),
  fromAdminId: integer("from_admin_id").references(() => users.id),
  toUserId: integer("to_user_id").references(() => users.id),
  title: text("title").notNull().default("Notification"),
  message: text("message").notNull(),
  type: text("type").notNull().default("system"), // user_approval, content_flag, event_approval, system_alert
  isRead: boolean("is_read").default(false),
  actionLink: text("action_link"),
  actionText: text("action_text"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin AI Assistant table to store interaction history
export const adminAiAssistant = pgTable("admin_ai_assistant", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => users.id),
  sessionId: text("session_id").notNull(), // To group conversations together
  prompt: text("prompt").notNull(), // The query/request from the admin
  response: text("response").notNull(), // The AI response
  codeLanguage: text("code_language"), // Language of code if applicable
  codeSnippet: text("code_snippet"), // Original code if provided
  fileName: text("file_name"), // Name of uploaded file if applicable
  fileSize: integer("file_size"), // Size of the uploaded file in bytes
  processingTime: numeric("processing_time"), // Time taken to generate response (ms)
  tokenCount: integer("token_count"), // Number of tokens used in this interaction
  model: text("model").default("gpt-3.5-turbo"), // Model used for generation
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata").default({}), // Additional data (file type, analysis results, etc.)
  isComplete: boolean("is_complete").default(true), // Whether the response was completed or stopped
});

// User Notifications table
export const userNotifications = pgTable("user_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  fromUserId: integer("from_user_id").references(() => users.id),
  title: text("title").notNull().default("Notification"),
  message: text("message").notNull(),
  type: text("type").notNull(), // Uses NotificationType values
  isRead: boolean("is_read").default(false),
  isSeen: boolean("is_seen").default(false), // For "seen but not read" status
  actionLink: text("action_link"),
  actionText: text("action_text"),
  thumbnail: text("thumbnail"), // Small image URL to show in notification
  targetId: integer("target_id"), // ID of related content (event, post, etc.)
  targetType: text("target_type"), // Type of related content (event, post, etc.)
  importance: text("importance").default("normal"), // "high", "normal", "low"
  expiresAt: timestamp("expires_at"), // When notification should be hidden
  metadata: jsonb("metadata"), // Additional data for notification
  createdAt: timestamp("created_at").defaultNow(),
});

// Service Categories for talent marketplace
export const ServiceCategory = {
  // Artists & Performers
  DANCE: "dance", // Breakdance, Hip-Hop, Popping, Locking, House, etc.
  GRAFFITI: "graffiti", // Street Art, Murals, Tagging
  BEATBOX: "beatbox",
  RAP: "rap", // Includes Spoken Word
  DJ: "dj", // Turntablists, Hip-Hop, EDM, Vinyl DJs
  MUSIC: "music", // Guitarists, Drummers, Pianists, Violinists, Producers
  THEATER: "theater", // Actors & Theater Performers
  CIRCUS: "circus", // Circus & Street Performers
  
  // Athletes & Sports Coaches
  SKATEBOARDING: "skateboarding",
  PARKOUR: "parkour",
  BMX: "bmx",
  ROLLERBLADING: "rollerblading",
  BASKETBALL: "basketball",
  FOOTBALL: "football",
  BOXING: "boxing",
  MMA: "mma",
  CAPOEIRA: "capoeira",
  GYMNASTICS: "gymnastics",
  FITNESS: "fitness", // Personal Trainers
  
  // Event Technicians & Production Crew
  LIGHTING: "lighting", // Lighting Engineers
  SOUND: "sound", // Sound Engineers
  STAGE_DESIGN: "stage_design", // Stage Designers & Special Effects
  PROJECTION: "projection", // Projection Mapping Specialists
  PHOTOGRAPHY: "photography", // Event Photographers
  VIDEOGRAPHY: "videography", // Event Videographers
  EVENT_MANAGEMENT: "event_management", // Event Managers & Coordinators
  
  OTHER: "other" // For custom inputs
} as const;

// Service Types
export const ServiceType = {
  // Workshops & Group Activities
  WORKSHOP: "workshop", // Group Workshops
  PRIVATE_LESSON: "private_lesson", // One-on-One Lessons
  
  // Performance Related
  PERFORMANCE: "performance", // Live Performances
  
  // Event Services
  EVENT_SERVICE: "event_service", // Event Bookings & Rentals
  TECHNICAL: "technical", // Technical Services
  
  // Freelance Services
  CREATIVE_SERVICE: "creative_service", // Freelance Creative Services
  
  // Skill Levels
  BEGINNER: "beginner", 
  INTERMEDIATE: "intermediate",
  PROFESSIONAL: "professional"
} as const;

// Booking Status
export const BookingStatus = {
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  PAYMENT_PENDING: "payment_pending",
  PAYMENT_FAILED: "payment_failed",
  PAYMENT_SUCCESSFUL: "payment_successful"
} as const;

// Availability Recurrence
export const RecurrenceType = {
  NONE: "none",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly"
} as const;

// Time Slot Status
export const TimeSlotStatus = {
  AVAILABLE: "available",
  BOOKED: "booked",
  BLOCKED: "blocked"
} as const;

// Skill Level
export const SkillLevel = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
  PROFESSIONAL: "professional",
  ALL_LEVELS: "all_levels"
} as const;

// Services table for talent marketplace
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // Uses ServiceCategory
  type: text("type").notNull(), // Uses ServiceType
  skillLevel: text("skill_level").default(SkillLevel.ALL_LEVELS), // Skill Level (beginner, intermediate, etc.)
  price: numeric("price").notNull(),
  duration: integer("duration").notNull(), // in minutes
  images: text("images").array(),
  location: text("location"),
  isRemote: boolean("is_remote").default(false),
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  maxParticipants: integer("max_participants").default(1),
  requirements: text("requirements"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Provider Availability table
export const availability = pgTable("availability", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => users.id).notNull(),
  serviceId: integer("service_id").references(() => services.id),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  recurrenceType: text("recurrence_type").default(RecurrenceType.NONE),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  isBlocked: boolean("is_blocked").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Time Slots table for more granular availability
export const serviceTimeSlots = pgTable("service_time_slots", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  providerId: integer("provider_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").default(TimeSlotStatus.AVAILABLE),
  maxBookings: integer("max_bookings").default(1),
  currentBookings: integer("current_bookings").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Bookings table
export const serviceBookings = pgTable("service_bookings", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  providerId: integer("provider_id").references(() => users.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").default(BookingStatus.PENDING_APPROVAL),
  message: text("message"),
  totalPrice: numeric("total_price").notNull(),
  participants: integer("participants").default(1),
  location: text("location"),
  paymentIntentId: text("payment_intent_id"),
  isPaid: boolean("is_paid").default(false),
  isRefunded: boolean("is_refunded").default(false),
  adminMessage: text("admin_message"),
  emailSent: boolean("email_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Reviews table
export const serviceReviews = pgTable("service_reviews", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => serviceBookings.id).notNull(),
  reviewerId: integer("reviewer_id").references(() => users.id).notNull(),
  providerId: integer("provider_id").references(() => users.id).notNull(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  rating: integer("rating").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Provider Skills & Specialties
export const providerSkills = pgTable("provider_skills", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => users.id).notNull(),
  skillName: text("skill_name").notNull(),
  category: text("category").notNull(),
  yearsExperience: integer("years_experience"),
  level: text("level"), // beginner, intermediate, expert
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// System Stats table for dashboard
export const systemStats = pgTable("system_stats", {
  id: serial("id").primaryKey(),
  statDate: timestamp("stat_date").defaultNow(),
  userCount: integer("user_count"),
  eventCount: integer("event_count"),
  ticketsSold: integer("tickets_sold"),
  revenue: numeric("revenue"),
  activeUsers: integer("active_users"),
  postCount: integer("post_count"),
  flaggedContent: integer("flagged_content"),
  servicesBooked: integer("services_booked"),
  serviceRevenue: numeric("service_revenue"),
  processingTime: numeric("processing_time"), // in ms
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isVerified: true,
  isApproved: true,
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    attendeeCount: true,
    likeCount: true,
    viewCount: true,
  })
  .extend({
    date: z.preprocess(
      (val) => val instanceof Date ? val : new Date(String(val)),
      z.date()
    ),
    endDate: z.preprocess(
      (val) => !val ? undefined : (val instanceof Date ? val : new Date(String(val))),
      z.date().optional()
    ),
    tags: z.array(z.string()).optional(),
    vibeLabels: z.array(z.string()).optional(),
    moodTags: z.array(z.string()).optional(),
    gallery: z.array(z.string()).optional(),
    accessibilityOptions: z.array(z.string()).optional(),
    ticketTiers: z.any().optional(),
  });

export const insertSavedEventSchema = createInsertSchema(savedEvents).omit({
  id: true,
  createdAt: true,
});

export const insertRsvpSchema = createInsertSchema(rsvps).omit({
  id: true,
  createdAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

export const insertSavedLocationSchema = createInsertSchema(savedLocations).omit({
  id: true,
  createdAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  purchasedAt: true,
  emailSent: true,
  isUsed: true,
  scanCount: true,
  checkInTime: true,
  lastScanned: true,
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  startDate: true,
  isActive: true,
  status: true,
  cancelledAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTermsOfServiceSchema = createInsertSchema(termsOfService).omit({
  id: true,
  createdAt: true,
  publishedAt: true,
});

export const insertExplorePageImageSchema = createInsertSchema(explorePageImages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  emailSent: true,
  sellerNotified: true,
}).extend({
  status: z.enum([
    OrderStatus.PENDING,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED
  ]).optional(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});

export const insertAdminActionSchema = createInsertSchema(adminActions).omit({
  id: true,
  createdAt: true,
});

export const insertContentFlagSchema = createInsertSchema(contentFlags).omit({
  id: true,
  createdAt: true,
  status: true,
  reviewerId: true,
  reviewedAt: true,
});

export const insertEventTicketTypeSchema = createInsertSchema(eventTicketTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminNotificationSchema = createInsertSchema(adminNotifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
  isSeen: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isVerified: true,
});

export const insertAvailabilitySchema = createInsertSchema(availability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startTime: z.preprocess(
    (val) => val instanceof Date ? val : new Date(String(val)),
    z.date()
  ),
  endTime: z.preprocess(
    (val) => val instanceof Date ? val : new Date(String(val)),
    z.date()
  ),
  recurrenceEndDate: z.preprocess(
    (val) => val === null ? null : val instanceof Date ? val : new Date(String(val)),
    z.date().nullable().optional()
  ),
});

export const insertServiceTimeSlotSchema = createInsertSchema(serviceTimeSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  currentBookings: true,
}).extend({
  date: z.preprocess(
    (val) => val instanceof Date ? val : new Date(String(val)),
    z.date()
  ),
});

export const insertServiceBookingSchema = createInsertSchema(serviceBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  isRefunded: true,
  emailSent: true,
  // Removed isPaid from the omit list to allow it in the request
}).extend({
  startTime: z.preprocess(
    (val) => val instanceof Date ? val : new Date(String(val)),
    z.date()
  ),
  endTime: z.preprocess(
    (val) => val instanceof Date ? val : new Date(String(val)),
    z.date()
  ),
});

export const insertServiceReviewSchema = createInsertSchema(serviceReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProviderSkillSchema = createInsertSchema(providerSkills).omit({
  id: true,
  createdAt: true,
  isVerified: true,
});

export const insertSystemStatSchema = createInsertSchema(systemStats).omit({
  id: true,
  statDate: true,
});

export const insertAdminAiAssistantSchema = createInsertSchema(adminAiAssistant).omit({
  id: true,
  createdAt: true,
  isComplete: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Service marketplace types
export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type Availability = typeof availability.$inferSelect;
export type InsertAvailability = z.infer<typeof insertAvailabilitySchema>;

export type ServiceTimeSlot = typeof serviceTimeSlots.$inferSelect;
export type InsertServiceTimeSlot = z.infer<typeof insertServiceTimeSlotSchema>;

export type ServiceBooking = typeof serviceBookings.$inferSelect;
export type InsertServiceBooking = z.infer<typeof insertServiceBookingSchema>;

export type ServiceReview = typeof serviceReviews.$inferSelect;
export type InsertServiceReview = z.infer<typeof insertServiceReviewSchema>;

export type ProviderSkill = typeof providerSkills.$inferSelect;
export type InsertProviderSkill = z.infer<typeof insertProviderSkillSchema>;

export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type Rsvp = typeof rsvps.$inferSelect;
export type InsertRsvp = z.infer<typeof insertRsvpSchema>;

export type SavedEvent = typeof savedEvents.$inferSelect;
export type InsertSavedEvent = z.infer<typeof insertSavedEventSchema>;

export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Like = typeof likes.$inferSelect;
export type InsertLike = z.infer<typeof insertLikeSchema>;

export type SavedLocation = typeof savedLocations.$inferSelect;
export type InsertSavedLocation = z.infer<typeof insertSavedLocationSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type TermsOfService = typeof termsOfService.$inferSelect;
export type InsertTermsOfService = z.infer<typeof insertTermsOfServiceSchema>;

export type ExplorePageImage = typeof explorePageImages.$inferSelect;
export type InsertExplorePageImage = z.infer<typeof insertExplorePageImageSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type AdminAction = typeof adminActions.$inferSelect;
export type InsertAdminAction = z.infer<typeof insertAdminActionSchema>;

export type ContentFlag = typeof contentFlags.$inferSelect;
export type InsertContentFlag = z.infer<typeof insertContentFlagSchema>;

export type EventTicketType = typeof eventTicketTypes.$inferSelect;
export type InsertEventTicketType = z.infer<typeof insertEventTicketTypeSchema>;

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type InsertAdminNotification = z.infer<typeof insertAdminNotificationSchema>;

export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;

// Achievement system
export const AchievementType = {
  EVENT_ATTENDANCE: "event_attendance",
  TICKET_MILESTONE: "ticket_milestone",
  CATEGORY_COLLECTION: "category_collection",
  STREAK: "streak",
  SPECIAL: "special"
} as const;

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  imageUrl: text("image_url"),
  threshold: integer("threshold").notNull().default(1),
  category: text("category"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
});

export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  achievementId: integer("achievement_id").references(() => achievements.id).notNull(),
  progress: integer("progress").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
});

export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;

export type SystemStat = typeof systemStats.$inferSelect;
export type InsertSystemStat = z.infer<typeof insertSystemStatSchema>;

export type AdminAiAssistant = typeof adminAiAssistant.$inferSelect;
export type InsertAdminAiAssistant = z.infer<typeof insertAdminAiAssistantSchema>;

// Location type for map filtering
export type LocationTypeValue = typeof LocationType[keyof typeof LocationType];

// Legal consent status
export const DataDeletionStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed"
} as const;

// Track user's legal consent
export const legalConsent = pgTable("legal_consent", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
  privacyAccepted: boolean("privacy_accepted").notNull().default(false),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  privacyAcceptedAt: timestamp("privacy_accepted_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
});

// Track data deletion requests
export const dataDeletionRequests = pgTable("data_deletion_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  processedBy: integer("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
});

// Legal text content for admin editing
export const legalContent = pgTable("legal_content", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // terms, privacy, permissions, etc.
  title: text("title").notNull(),
  content: text("content").notNull(),
  language: text("language").notNull().default("en"),
  version: text("version").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  publishedAt: timestamp("published_at")
});

export const insertLegalConsentSchema = createInsertSchema(legalConsent).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertDataDeletionRequestSchema = createInsertSchema(dataDeletionRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  processedBy: true,
  processedAt: true
});

export const insertLegalContentSchema = createInsertSchema(legalContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type LegalConsent = typeof legalConsent.$inferSelect;
export type InsertLegalConsent = z.infer<typeof insertLegalConsentSchema>;

export type DataDeletionRequest = typeof dataDeletionRequests.$inferSelect;
export type InsertDataDeletionRequest = z.infer<typeof insertDataDeletionRequestSchema>;

export type LegalContent = typeof legalContent.$inferSelect;
export type InsertLegalContent = z.infer<typeof insertLegalContentSchema>;

// Contact form submissions
export const ContactCategory = {
  GENERAL: "general",
  TECHNICAL: "technical",
  BILLING: "billing",
  LEGAL: "legal",
  OTHER: "other"
} as const;

// Friend tables removed

export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  category: text("category").notNull().default(ContactCategory.GENERAL),
  status: text("status").notNull().default("new"), // new, read, replied, spam
  isResolved: boolean("is_resolved").default(false),
  adminNotes: text("admin_notes"),
  adminId: integer("admin_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
  id: true,
  adminId: true,
  adminNotes: true,
  status: true,
  isResolved: true,
  createdAt: true,
  updatedAt: true,
});

// Friend schemas removed

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;

// User Blocks table - for blocking other users
export const userBlocks = pgTable("user_blocks", {
  id: serial("id").primaryKey(),
  blockerId: integer("blocker_id").notNull().references(() => users.id),
  blockedId: integer("blocked_id").notNull().references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Follows table - for following relationships between users
export const userFollows = pgTable("user_follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => users.id),
  followedId: integer("followed_id").notNull().references(() => users.id),
  status: text("status").notNull().default("active"), // active, pending, rejected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserBlockSchema = createInsertSchema(userBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;

export const insertUserFollowSchema = createInsertSchema(userFollows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserFollow = typeof userFollows.$inferSelect;
export type InsertUserFollow = z.infer<typeof insertUserFollowSchema>;

// Content Filters table - for user content filter preferences
export const contentFilters = pgTable("content_filters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  level: text("level").notNull().default(ContentFilterLevel.MEDIUM),
  filterProfanity: boolean("filter_profanity").default(true),
  filterViolence: boolean("filter_violence").default(true),
  filterHateSpeech: boolean("filter_hate_speech").default(true),
  filterExplicit: boolean("filter_explicit").default(true),
  filterSpam: boolean("filter_spam").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContentFilterSchema = createInsertSchema(contentFilters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ContentFilter = typeof contentFilters.$inferSelect;
export type InsertContentFilter = z.infer<typeof insertContentFilterSchema>;

// Blocked Keywords table - for content filtering
export const blockedKeywords = pgTable("blocked_keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull().unique(),
  category: text("category").notNull(), // 'profanity', 'hate_speech', 'violence', etc.
  severity: text("severity").notNull().default("medium"), // 'low', 'medium', 'high'
  isRegex: boolean("is_regex").default(false), // Whether the keyword is a regular expression
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlockedKeywordSchema = createInsertSchema(blockedKeywords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BlockedKeyword = typeof blockedKeywords.$inferSelect;
export type InsertBlockedKeyword = z.infer<typeof insertBlockedKeywordSchema>;

// Chat conversations table (matches conversations table in the database)
// Conversations table removed - Chat functionality has been removed

// Chat conversations table for real-time messaging
export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastActivity: timestamp("last_activity").defaultNow(), // For sorting conversations
  participantOneId: integer("participant_one_id").references(() => users.id),
  participantTwoId: integer("participant_two_id").references(() => users.id), 
  lastMessageId: integer("last_message_id"),
  status: text("status").default("active"),
  title: text("title"), // Optional group chat title
  isGroup: boolean("is_group").default(false), // Whether this is a group conversation
  groupAvatarUrl: text("group_avatar_url"), // Optional group avatar
  createdBy: integer("created_by").references(() => users.id), // Who created the group
  disappearingTimer: integer("disappearing_timer"), // Null=off, 86400=24h, 604800=7d
});

// Chat participants table to track users in conversations
export const chatParticipants = pgTable("chat_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => chatConversations.id),
  userId: integer("user_id").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"), // When user left the conversation (if applicable)
  isAdmin: boolean("is_admin").default(false), // For group chat admins
  nickname: text("nickname"), // Optional custom name in this conversation
  isMuted: boolean("is_muted").default(false), // Whether user has muted this conversation
  lastReadMessageId: integer("last_read_message_id"), // Last message read by this user
  isArchived: boolean("is_archived").default(false), // User-specific archive
  isPinned: boolean("is_pinned").default(false), // User-specific pin to top
});

// Chat messages table for storing message content
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => chatConversations.id),
  senderId: integer("sender_id").references(() => users.id),
  recipientId: integer("recipient_id").references(() => users.id).notNull(), // Add the required recipient_id field
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(), // Changed from sentAt to match the database column name
  updatedAt: timestamp("updated_at"),
  deletedAt: timestamp("deleted_at"), // Soft delete
  metadata: jsonb("metadata"),
  status: text("status"),
  type: text("type"),
  contentType: text("content_type").default("text"), // text, voice, image, video, file
  isRead: boolean("is_read").default(false),
  isDelivered: boolean("is_delivered").default(false),
  readAt: timestamp("read_at"),
  deliveredAt: timestamp("delivered_at"),
  messageStatus: text("message_status"),
  seenAt: timestamp("seen_at"),
  replyToId: integer("reply_to_id"), // Message this replies to
  isForwarded: boolean("is_forwarded").default(false), // Was this message forwarded?
  expiresAt: timestamp("expires_at"), // For disappearing messages
});

// Message delivery status table for read/delivery ticks
export const messageDeliveryStatus = pgTable("message_delivery_status", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => chatMessages.id),
  userId: integer("user_id").references(() => users.id), // User who received the message
  status: text("status").notNull().default(MessageStatus.SENT), // sent, delivered, read
  deliveredAt: timestamp("delivered_at"), // When message was delivered
  readAt: timestamp("read_at"), // When message was read
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Starred messages (bookmarks) — per user, per message
export const starredMessages = pgTable("starred_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  messageId: integer("message_id").references(() => chatMessages.id).notNull(),
  conversationId: integer("conversation_id").references(() => chatConversations.id).notNull(),
  starredAt: timestamp("starred_at").defaultNow(),
});

// Insert schemas for the chat tables
export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastActivity: true,
  lastMessageId: true,
});

export const insertChatParticipantSchema = createInsertSchema(chatParticipants).omit({
  id: true,
  joinedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true, // Changed from sentAt to match the new field name
  updatedAt: true,
});

export const insertMessageDeliveryStatusSchema = createInsertSchema(messageDeliveryStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deliveredAt: true,
  readAt: true,
});

// Type definitions for the chat tables
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;

export type ChatParticipant = typeof chatParticipants.$inferSelect;
export type InsertChatParticipant = z.infer<typeof insertChatParticipantSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type MessageDeliveryStatus = typeof messageDeliveryStatus.$inferSelect;
export type InsertMessageDeliveryStatus = z.infer<typeof insertMessageDeliveryStatusSchema>;

// Insert schemas for the battle/dancer registration tables
export const insertEventCategorySchema = createInsertSchema(eventCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDancerRegistrationSchema = createInsertSchema(dancerRegistrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  registeredAt: true,
});

export const insertBattleMatchupSchema = createInsertSchema(battleMatchups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBattleJudgeSchema = createInsertSchema(battleJudges).omit({
  id: true,
  createdAt: true,
  assignedAt: true,
});

export const insertBattleVoteSchema = createInsertSchema(battleVotes).omit({
  id: true,
  createdAt: true,
  votedAt: true,
});

// Type definitions for the battle/dancer registration tables
export type EventCategory = typeof eventCategories.$inferSelect;
export type InsertEventCategory = z.infer<typeof insertEventCategorySchema>;

export type DancerRegistration = typeof dancerRegistrations.$inferSelect;
export type InsertDancerRegistration = z.infer<typeof insertDancerRegistrationSchema>;

export type BattleMatchup = typeof battleMatchups.$inferSelect;
export type InsertBattleMatchup = z.infer<typeof insertBattleMatchupSchema>;

export type BattleJudge = typeof battleJudges.$inferSelect;
export type InsertBattleJudge = z.infer<typeof insertBattleJudgeSchema>;

export type BattleVote = typeof battleVotes.$inferSelect;
export type InsertBattleVote = z.infer<typeof insertBattleVoteSchema>;

export const insertLiveResultsViewerSchema = createInsertSchema(liveResultsViewers).omit({
  id: true,
  createdAt: true,
});

export type LiveResultsViewer = typeof liveResultsViewers.$inferSelect;
export type InsertLiveResultsViewer = z.infer<typeof insertLiveResultsViewerSchema>;

// Admin battle management validation schemas
export const adminAddDancerSchema = z.object({
  displayName: z.string().min(1, "Dancer name is required").max(100).optional(),
  contactEmail: z.string().email().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  targetUserId: z.number().optional(),
}).refine(data => data.displayName || data.targetUserId, {
  message: "Either displayName or targetUserId is required"
});

export const updateBattleRulesSchema = z.object({
  battleFormat: z.enum(["1v1", "2v2", "3v3", "7togo"]).optional(),
  roundsToWin: z.number().min(1).max(5).optional(),
  judgingMethod: z.enum(["points", "vote", "knockout"]).optional(),
  battleRules: z.string().max(2000).optional().nullable(),
  allowSelfRegistration: z.boolean().optional(),
});

export const createManualMatchupSchema = z.object({
  round: z.number().min(1),
  position: z.number().min(0),
  dancerARegistrationId: z.number().optional().nullable(),
  dancerBRegistrationId: z.number().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  scheduledTime: z.string().datetime().optional().nullable(),
});

export const updateMatchupSchema = z.object({
  dancerARegistrationId: z.number().optional().nullable(),
  dancerBRegistrationId: z.number().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  scheduledTime: z.string().datetime().optional().nullable(),
  status: z.enum(["SCHEDULED", "PENDING", "IN_PROGRESS", "VOTING", "COMPLETED"]).optional(),
  bestOf: z.number().refine(val => [1, 3, 5, 7, 9, 11].includes(val), {
    message: "Best of must be an odd number (1, 3, 5, 7, 9, or 11)"
  }).optional(),
});

export type AdminAddDancer = z.infer<typeof adminAddDancerSchema>;
export type UpdateBattleRules = z.infer<typeof updateBattleRulesSchema>;
export type CreateManualMatchup = z.infer<typeof createManualMatchupSchema>;
export type UpdateMatchup = z.infer<typeof updateMatchupSchema>;

// ==================== User Settings & Preferences ====================

// Profile visibility options
export const ProfileVisibility = {
  PUBLIC: "public",
  FOLLOWERS_ONLY: "followers_only",
  PRIVATE: "private",
} as const;

// Who can follow the user
export const FollowPermission = {
  EVERYONE: "everyone",
  APPROVED_ONLY: "approved_only",
  NOBODY: "nobody",
} as const;

// Message permission options
export const MessagePermission = {
  EVERYONE: "everyone",
  FOLLOWERS: "followers",
  NOBODY: "nobody",
} as const;

// User Settings table
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  
  // Account Settings
  language: text("language").default("en"),
  timezone: text("timezone").default("Europe/Amsterdam"),
  
  // Privacy Settings
  profileVisibility: text("profile_visibility").default(ProfileVisibility.PUBLIC),
  showEmail: boolean("show_email").default(false),
  showLocation: boolean("show_location").default(true),
  showActivityStatus: boolean("show_activity_status").default(true),
  allowMessages: boolean("allow_messages").default(true),
  messagePermission: text("message_permission").default(MessagePermission.EVERYONE),
  followPermission: text("follow_permission").default(FollowPermission.EVERYONE),
  
  // Display Preferences
  theme: text("theme").default("graffiti"),
  themeMode: text("theme_mode").default("system"),
  compactMode: boolean("compact_mode").default(false),
  
  // Security Settings
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorMethod: text("two_factor_method"), // 'app', 'sms', 'email'
  loginAlerts: boolean("login_alerts").default(true),
  sessionTimeout: integer("session_timeout").default(30), // minutes
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notification Preferences table
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  
  // Master Toggles
  pushEnabled: boolean("push_enabled").default(true),
  emailEnabled: boolean("email_enabled").default(true),
  
  // Activity Notifications
  newFollowers: boolean("new_followers").default(true),
  followRequests: boolean("follow_requests").default(true),
  mentions: boolean("mentions").default(true),
  comments: boolean("comments").default(true),
  likes: boolean("likes").default(true),
  
  // Event Notifications
  eventReminders: boolean("event_reminders").default(true),
  eventUpdates: boolean("event_updates").default(true),
  
  // Other Notifications
  newMessages: boolean("new_messages").default(true),
  systemNotifications: boolean("system_notifications").default(true),
  marketingEmails: boolean("marketing_emails").default(false),
  weeklyDigest: boolean("weekly_digest").default(false),
  
  // Legacy fields for backwards compatibility
  emailEvents: boolean("email_events").default(true),
  emailMessages: boolean("email_messages").default(true),
  emailFollows: boolean("email_follows").default(true),
  emailMarketing: boolean("email_marketing").default(false),
  pushEvents: boolean("push_events").default(true),
  pushMessages: boolean("push_messages").default(true),
  pushFollows: boolean("push_follows").default(true),
  pushLikes: boolean("push_likes").default(true),
  pushComments: boolean("push_comments").default(true),
  inAppEnabled: boolean("in_app_enabled").default(true),
  inAppEvents: boolean("in_app_events").default(true),
  inAppMessages: boolean("in_app_messages").default(true),
  inAppFollows: boolean("in_app_follows").default(true),
  inAppLikes: boolean("in_app_likes").default(true),
  inAppComments: boolean("in_app_comments").default(true),
  digestEnabled: boolean("digest_enabled").default(false),
  digestFrequency: text("digest_frequency").default("weekly"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Login Sessions table - for security monitoring
export const loginSessions = pgTable("login_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Session Info
  sessionToken: text("session_token").notNull().unique(),
  deviceType: text("device_type"), // 'desktop', 'mobile', 'tablet'
  deviceName: text("device_name"), // Browser/app name
  operatingSystem: text("operating_system"),
  browser: text("browser"),
  
  // Location Info
  ipAddress: text("ip_address"),
  city: text("city"),
  country: text("country"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isCurrentSession: boolean("is_current_session").default(false),
  lastActive: timestamp("last_active").defaultNow(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
});

// Marketing Campaign Status
export const CampaignStatus = {
  DRAFT: "draft",
  SCHEDULED: "scheduled",
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

// Marketing Campaign Audience Type
export const AudienceType = {
  ALL_USERS: "all_users",
  ARTISTS: "artists",
  ENTHUSIASTS: "enthusiasts",
  PREMIUM_MEMBERS: "premium_members",
  INACTIVE_USERS: "inactive_users",
  EVENT_ATTENDEES: "event_attendees",
  CUSTOM: "custom",
} as const;

// Marketing Campaigns table - for admin email marketing
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  
  // Campaign Details
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // HTML content
  previewText: text("preview_text"), // Email preview text
  imageUrl: text("image_url"), // Optional banner/header image for the email
  
  // Audience Targeting
  audienceType: text("audience_type").default(AudienceType.ALL_USERS),
  audienceFilters: jsonb("audience_filters"), // Custom filters as JSON
  estimatedRecipients: integer("estimated_recipients").default(0),
  
  // Delivery Settings
  status: text("status").default(CampaignStatus.DRAFT),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  
  // Metrics
  totalSent: integer("total_sent").default(0),
  totalDelivered: integer("total_delivered").default(0),
  totalOpened: integer("total_opened").default(0),
  totalClicked: integer("total_clicked").default(0),
  totalBounced: integer("total_bounced").default(0),
  totalUnsubscribed: integer("total_unsubscribed").default(0),
  
  // Tracking
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaign Recipients table - for tracking individual sends
export const campaignRecipients = pgTable("campaign_recipients", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  email: text("email").notNull(),
  
  // Status
  status: text("status").default("pending"), // 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed'
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoginSessionSchema = createInsertSchema(loginSessions).omit({
  id: true,
  createdAt: true,
  lastActive: true,
});

export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalSent: true,
  totalDelivered: true,
  totalOpened: true,
  totalClicked: true,
  totalBounced: true,
  totalUnsubscribed: true,
  sentAt: true,
});

export const insertCampaignRecipientSchema = createInsertSchema(campaignRecipients).omit({
  id: true,
  createdAt: true,
});

// Type definitions
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;

export type LoginSession = typeof loginSessions.$inferSelect;
export type InsertLoginSession = z.infer<typeof insertLoginSessionSchema>;

export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;

export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = z.infer<typeof insertCampaignRecipientSchema>;

// ==================== Analytics & Tracking ====================

// Consent categories
export const ConsentCategory = {
  ESSENTIAL: "essential",
  ANALYTICS: "analytics", 
  MARKETING: "marketing",
} as const;

// Tracking consent - stores user cookie consent preferences
export const trackingConsent = pgTable("tracking_consent", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull().unique(), // Cookie-based visitor ID
  userId: integer("user_id").references(() => users.id), // Linked user if logged in
  
  // Consent categories
  essentialConsent: boolean("essential_consent").default(true).notNull(),
  analyticsConsent: boolean("analytics_consent").default(false).notNull(),
  marketingConsent: boolean("marketing_consent").default(false).notNull(),
  
  // Tracking
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentedAt: timestamp("consented_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Web sessions - tracks visitor sessions
export const webSessions = pgTable("web_sessions", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  sessionId: text("session_id").notNull().unique(),
  
  // Session info
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  duration: integer("duration"), // in seconds
  
  // Traffic source
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id),
  
  // Device info
  deviceType: text("device_type"), // desktop, mobile, tablet
  browser: text("browser"),
  os: text("os"),
  
  // Engagement
  pageCount: integer("page_count").default(0),
  eventCount: integer("event_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Page views - tracks individual page visits
export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  
  // Page info
  path: text("path").notNull(),
  title: text("title"),
  
  // Timing
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  duration: integer("duration"), // time on page in seconds
  
  // Additional context
  referrer: text("referrer"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Interaction events - tracks clicks, form submissions, etc.
export const interactionEvents = pgTable("interaction_events", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  
  // Event info
  eventType: text("event_type").notNull(), // click, form_submit, scroll, etc.
  eventName: text("event_name").notNull(), // button_signup, nav_click, etc.
  eventCategory: text("event_category"), // navigation, cta, form, etc.
  
  // Event data
  elementId: text("element_id"),
  elementClass: text("element_class"),
  elementText: text("element_text"),
  pagePath: text("page_path").notNull(),
  
  // Additional properties
  properties: jsonb("properties"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Conversion events - tracks key business actions
export const conversionEvents = pgTable("conversion_events", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  sessionId: text("session_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  
  // Conversion info
  conversionType: text("conversion_type").notNull(), // signup, purchase, booking, etc.
  conversionValue: integer("conversion_value"), // monetary value in cents
  
  // Attribution
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  
  // Additional data
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily analytics aggregates for faster dashboard queries
export const dailyAnalytics = pgTable("daily_analytics", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull(),
  
  // Traffic metrics
  uniqueVisitors: integer("unique_visitors").default(0),
  totalSessions: integer("total_sessions").default(0),
  totalPageViews: integer("total_page_views").default(0),
  
  // Engagement metrics
  avgSessionDuration: integer("avg_session_duration").default(0), // in seconds
  bounceRate: integer("bounce_rate").default(0), // percentage * 100
  pagesPerSession: integer("pages_per_session").default(0), // * 100 for precision
  
  // Conversion metrics
  totalConversions: integer("total_conversions").default(0),
  totalConversionValue: integer("total_conversion_value").default(0),
  
  // Device breakdown
  desktopSessions: integer("desktop_sessions").default(0),
  mobileSessions: integer("mobile_sessions").default(0),
  tabletSessions: integer("tablet_sessions").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for tracking
export const insertTrackingConsentSchema = createInsertSchema(trackingConsent).omit({
  id: true,
  consentedAt: true,
  updatedAt: true,
});

export const insertWebSessionSchema = createInsertSchema(webSessions).omit({
  id: true,
  createdAt: true,
});

export const insertPageViewSchema = createInsertSchema(pageViews).omit({
  id: true,
  createdAt: true,
});

export const insertInteractionEventSchema = createInsertSchema(interactionEvents).omit({
  id: true,
  createdAt: true,
});

export const insertConversionEventSchema = createInsertSchema(conversionEvents).omit({
  id: true,
  createdAt: true,
});

// Type definitions for tracking
export type TrackingConsent = typeof trackingConsent.$inferSelect;
export type InsertTrackingConsent = z.infer<typeof insertTrackingConsentSchema>;

export type WebSession = typeof webSessions.$inferSelect;
export type InsertWebSession = z.infer<typeof insertWebSessionSchema>;

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = z.infer<typeof insertPageViewSchema>;

export type InteractionEvent = typeof interactionEvents.$inferSelect;
export type InsertInteractionEvent = z.infer<typeof insertInteractionEventSchema>;

export type ConversionEvent = typeof conversionEvents.$inferSelect;
export type InsertConversionEvent = z.infer<typeof insertConversionEventSchema>;

export type DailyAnalytics = typeof dailyAnalytics.$inferSelect;

// ==========================================
// PROXIMITY & MATCHING FEATURE TABLES
// ==========================================

// Proximity visibility modes
export const ProximityVisibility = {
  EVERYONE: "everyone",
  FRIENDS_ONLY: "friends_only",
  EVENTS_ONLY: "events_only",
  GHOST: "ghost",
} as const;

// Safety broadcast scope
export const SafetyBroadcastScope = {
  TRUSTED_CONTACTS: "trusted_contacts",
  NEARBY_VERIFIED: "nearby_verified",
} as const;

// Trusted contact status
export const TrustedContactStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
} as const;

// Proximity Settings table - stores consent and visibility preferences per user
export const proximitySettings = pgTable("proximity_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  discoveryEnabled: boolean("discovery_enabled").default(false),
  visibilityMode: text("visibility_mode").default(ProximityVisibility.GHOST),
  radiusKm: integer("radius_km").default(2),
  liveLocationEnabled: boolean("live_location_enabled").default(false),
  consentGiven: boolean("consent_given").default(false),
  consentGivenAt: timestamp("consent_given_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Presence table - ephemeral, coarse location (TTL managed by backend)
export const userPresence = pgTable("user_presence", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  coarseLat: text("coarse_lat").notNull(),
  coarseLng: text("coarse_lng").notNull(),
  city: text("city"),
  expiresAt: timestamp("expires_at").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Trusted Contacts table - for safety feature
export const trustedContacts = pgTable("trusted_contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  contactUserId: integer("contact_user_id").references(() => users.id).notNull(),
  status: text("status").default(TrustedContactStatus.PENDING),
  createdAt: timestamp("created_at").defaultNow(),
});

// Safety Broadcasts table - SOS broadcasts to trusted contacts
export const safetyBroadcasts = pgTable("safety_broadcasts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  message: text("message"),
  coarseLat: text("coarse_lat"),
  coarseLng: text("coarse_lng"),
  city: text("city"),
  broadcastScope: text("broadcast_scope").default(SafetyBroadcastScope.TRUSTED_CONTACTS),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Discoveries table - tracks swipe actions between users
export const userDiscoveries = pgTable("user_discoveries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  discoveredUserId: integer("discovered_user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // 'skip' | 'connect'
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserDiscoverySchema = createInsertSchema(userDiscoveries).omit({
  id: true,
  createdAt: true,
});

export const insertProximitySettingsSchema = createInsertSchema(proximitySettings).omit({
  id: true,
  updatedAt: true,
});

export const insertUserPresenceSchema = createInsertSchema(userPresence).omit({
  id: true,
  updatedAt: true,
});

export const insertTrustedContactSchema = createInsertSchema(trustedContacts).omit({
  id: true,
  createdAt: true,
});

export const insertSafetyBroadcastSchema = createInsertSchema(safetyBroadcasts).omit({
  id: true,
  createdAt: true,
});

// Types
export type ProximitySettings = typeof proximitySettings.$inferSelect;
export type InsertProximitySettings = z.infer<typeof insertProximitySettingsSchema>;

export type UserPresence = typeof userPresence.$inferSelect;
export type InsertUserPresence = z.infer<typeof insertUserPresenceSchema>;

export type TrustedContact = typeof trustedContacts.$inferSelect;
export type InsertTrustedContact = z.infer<typeof insertTrustedContactSchema>;

export type SafetyBroadcast = typeof safetyBroadcasts.$inferSelect;
export type InsertSafetyBroadcast = z.infer<typeof insertSafetyBroadcastSchema>;

export type UserDiscovery = typeof userDiscoveries.$inferSelect;
export type InsertUserDiscovery = z.infer<typeof insertUserDiscoverySchema>;

// ============================================================
// AI Agent Tables
// ============================================================

export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  title: text("title").notNull().default("New Chat"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiMessages = pgTable("ai_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({
  id: true,
  createdAt: true,
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;

// ==================== Security Tables ====================

export const securityEvents = pgTable("security_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "rate_limit_exceeded" | "auth_failure" | "ip_blocked" | "suspicious_request" | "admin_action"
  severity: text("severity").notNull().default("low"), // "low" | "medium" | "high" | "critical"
  ip: text("ip"),
  userId: integer("user_id").references(() => users.id),
  path: text("path"),
  method: text("method"),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ipBlocks = pgTable("ip_blocks", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull().unique(),
  reason: text("reason").notNull(),
  blockedBy: integer("blocked_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  permanent: boolean("permanent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const securitySettings = pgTable("security_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SecurityEvent = typeof securityEvents.$inferSelect;
export type IpBlock = typeof ipBlocks.$inferSelect;

// ==================== City Spotlight ====================

export const spotlightedPlaces = pgTable("spotlighted_places", {
  id: serial("id").primaryKey(),
  osmId: bigint("osm_id", { mode: "number" }),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  category: text("category").notNull(),
  address: text("address"),
  website: text("website"),
  adminNote: text("admin_note"),
  adminId: integer("admin_id").references(() => users.id),
  active: boolean("active").notNull().default(true),
  isSuperFeatured: boolean("is_super_featured").notNull().default(false),
  ownedByUserId: integer("owned_by_user_id").references(() => users.id),
  linkedLocationId: integer("linked_location_id").references(() => locations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSpotlightedPlaceSchema = createInsertSchema(spotlightedPlaces).omit({
  id: true,
  createdAt: true,
});

export type SpotlightedPlace = typeof spotlightedPlaces.$inferSelect;
export type InsertSpotlightedPlace = z.infer<typeof insertSpotlightedPlaceSchema>;

export const OutreachLeadStatus = {
  NEW: "new",
  CONTACTED: "contacted",
  REPLIED: "replied",
  INTERESTED: "interested",
  NOT_INTERESTED: "not_interested",
  MEETING_SCHEDULED: "meeting_scheduled",
} as const;

export const outreachLeads = pgTable("outreach_leads", {
  id: serial("id").primaryKey(),
  name: text("name"),
  organization: text("organization").notNull(),
  department: text("department"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  city: text("city"),
  notes: text("notes"),
  status: text("status").notNull().default("new"),
  type: text("type").notNull().default("municipality"),
  lastEmailSubject: text("last_email_subject"),
  lastEmailSentAt: timestamp("last_email_sent_at"),
  emailSentCount: integer("email_sent_count").default(0),
  linkedinUrl: text("linkedin_url"),
  linkedinDmSentAt: timestamp("linkedin_dm_sent_at"),
  linkedinDmContent: text("linkedin_dm_content"),
  // ── AI Lead Discovery v2 fields ──
  leadKind: varchar("lead_kind", { length: 24 }).default("organization"),
  role: text("role"),
  industry: varchar("industry", { length: 64 }),
  country: varchar("country", { length: 64 }),
  seniority: varchar("seniority", { length: 32 }),
  whyRelevant: text("why_relevant"),
  howToConnect: varchar("how_to_connect", { length: 64 }),
  suggestedOpener: text("suggested_opener"),
  tags: text("tags").array().default([]),
  score: integer("score"),
  aiConfidence: integer("ai_confidence"),
  discoveryQuery: text("discovery_query"),
  savedToBrain: boolean("saved_to_brain").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Saved AI Lead Discovery searches (for memory & re-run) ──────────────────
export const linkedinDiscoverySearches = pgTable("linkedin_discovery_searches", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  query: jsonb("query").notNull(),
  label: text("label"),
  resultCount: integer("result_count").default(0).notNull(),
  savedAsFavorite: boolean("saved_as_favorite").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LinkedinDiscoverySearch = typeof linkedinDiscoverySearches.$inferSelect;
export const insertLinkedinDiscoverySearchSchema = createInsertSchema(linkedinDiscoverySearches).omit({ id: true, createdAt: true });
export type InsertLinkedinDiscoverySearch = z.infer<typeof insertLinkedinDiscoverySearchSchema>;

export const insertOutreachLeadSchema = createInsertSchema(outreachLeads).omit({
  id: true,
  createdAt: true,
});

export type OutreachLead = typeof outreachLeads.$inferSelect;
export type InsertOutreachLead = z.infer<typeof insertOutreachLeadSchema>;

// Every individual email that has been sent to an outreach lead
export const outreachEmails = pgTable("outreach_emails", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => outreachLeads.id, { onDelete: "cascade" }).notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  mailgunMessageId: text("mailgun_message_id"),
  openCount: integer("open_count").default(0),
  firstOpenedAt: timestamp("first_opened_at"),
  lastOpenedAt: timestamp("last_opened_at"),
  isBulk: boolean("is_bulk").default(false),
  status: text("status").notNull().default("sent"), // sent | failed
});

export type OutreachEmail = typeof outreachEmails.$inferSelect;

// One row per open event (a single email may be opened multiple times)
export const outreachEmailOpens = pgTable("outreach_email_opens", {
  id: serial("id").primaryKey(),
  emailId: integer("email_id").references(() => outreachEmails.id, { onDelete: "cascade" }).notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export type OutreachEmailOpen = typeof outreachEmailOpens.$inferSelect;

// ── Admin Inbox Emails (inbound emails received at riki@dancehealthy.net) ─────
export const inboxEmails = pgTable("inbox_emails", {
  id: serial("id").primaryKey(),
  mailgunMessageId: text("mailgun_message_id").unique(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email").notNull(),
  subject: text("subject"),
  bodyText: text("body_text"),
  bodyHtml: text("body_html"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  isRead: boolean("is_read").default(false),
  isStarred: boolean("is_starred").default(false),
  matchedLeadId: integer("matched_lead_id").references(() => outreachLeads.id, { onDelete: "set null" }),
  inReplyToSubject: text("in_reply_to_subject"),
  headers: text("headers"), // JSON string of raw headers
});

export type InboxEmail = typeof inboxEmails.$inferSelect;
export const insertInboxEmailSchema = createInsertSchema(inboxEmails).omit({ id: true });
export type InsertInboxEmail = z.infer<typeof insertInboxEmailSchema>;

export const placeReviews = pgTable("place_reviews", {
  id: serial("id").primaryKey(),
  placeId: integer("place_id").references(() => spotlightedPlaces.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  review: text("review"),
  isStillOpen: boolean("is_still_open"),
  openingHoursCorrect: boolean("opening_hours_correct"),
  suggestedOpeningHours: text("suggested_opening_hours"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlaceReviewSchema = createInsertSchema(placeReviews).omit({
  id: true,
  createdAt: true,
});

export type PlaceReview = typeof placeReviews.$inferSelect;
export type InsertPlaceReview = z.infer<typeof insertPlaceReviewSchema>;

// ── Funding, Subsidy & Sponsorship Intelligence ─────────────────────────────

export const fundingSources = pgTable("funding_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("manual"),
  categoryFocus: varchar("category_focus", { length: 255 }),
  regionFocus: varchar("region_focus", { length: 100 }),
  isActive: boolean("is_active").default(true),
  crawlFrequency: varchar("crawl_frequency", { length: 50 }).default("weekly"),
  lastRun: timestamp("last_run"),
  lastSuccess: timestamp("last_success"),
  lastError: text("last_error"),
  notes: text("notes"),
  trustLevel: integer("trust_level").default(3),
  healthStatus: varchar("health_status", { length: 50 }).default("healthy"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFundingSourceSchema = createInsertSchema(fundingSources).omit({ id: true, createdAt: true });
export type FundingSource = typeof fundingSources.$inferSelect;
export type InsertFundingSource = z.infer<typeof insertFundingSourceSchema>;

export const fundingOpportunities = pgTable("funding_opportunities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  shortSummary: text("short_summary"),
  fullDescription: text("full_description"),
  providerName: varchar("provider_name", { length: 255 }),
  providerEmail: varchar("provider_email", { length: 255 }),
  providerPhone: varchar("provider_phone", { length: 50 }),
  providerWebsite: text("provider_website"),
  officialSourceLink: text("official_source_link"),
  applicationLink: text("application_link"),
  sourceId: integer("source_id").references(() => fundingSources.id),
  sourceName: varchar("source_name", { length: 255 }),
  status: varchar("status", { length: 50 }).default("published"),
  amountMin: integer("amount_min"),
  amountMax: integer("amount_max"),
  amountText: varchar("amount_text", { length: 255 }),
  applicationStartDate: timestamp("application_start_date"),
  deadline: timestamp("deadline"),
  workPeriod: varchar("work_period", { length: 255 }),
  targetAudience: text("target_audience"),
  eligibility: text("eligibility"),
  aiEligibilitySummary: text("ai_eligibility_summary"),
  whatItCanBeUsedFor: text("what_it_can_be_used_for"),
  restrictions: text("restrictions"),
  requiredDocuments: text("required_documents"),
  applicationSteps: text("application_steps"),
  faq: text("faq"),
  contactInfo: text("contact_info"),
  categories: text("categories").array(),
  applicantTypes: text("applicant_types").array(),
  regions: text("regions").array(),
  municipalities: text("municipalities").array(),
  provinces: text("provinces").array(),
  country: varchar("country", { length: 10 }).default("NL"),
  euNationalLocal: varchar("eu_national_local", { length: 50 }),
  tags: text("tags").array(),
  language: varchar("language", { length: 10 }).default("nl"),
  fundingType: varchar("funding_type", { length: 100 }),
  recurring: boolean("recurring").default(false),
  coFinancingRequired: boolean("co_financing_required").default(false),
  lastCheckedDate: timestamp("last_checked_date").defaultNow(),
  publishedAt: timestamp("published_at").defaultNow(),
  internalNotes: text("internal_notes"),
  aiConfidence: integer("ai_confidence").default(85),
  sourceSnapshot: text("source_snapshot"),
  isDuplicate: boolean("is_duplicate").default(false),
  duplicateOfId: integer("duplicate_of_id"),
  qualityFlags: text("quality_flags").array(),
  reviewStatus: varchar("review_status", { length: 50 }).default("approved"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFundingOpportunitySchema = createInsertSchema(fundingOpportunities).omit({ id: true, createdAt: true, updatedAt: true });
export type FundingOpportunity = typeof fundingOpportunities.$inferSelect;
export type InsertFundingOpportunity = z.infer<typeof insertFundingOpportunitySchema>;

export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  platform: varchar("platform", { length: 50 }).default("web"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({ id: true, createdAt: true, updatedAt: true });
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;

export const pushNotificationLogs = pgTable("push_notification_logs", {
  id: serial("id").primaryKey(),
  sentBy: integer("sent_by").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  targetType: varchar("target_type", { length: 50 }).notNull().default("all"),
  targetValue: text("target_value"),
  sentCount: integer("sent_count").default(0),
  failedCount: integer("failed_count").default(0),
  iconUrl: text("icon_url"),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PushNotificationLog = typeof pushNotificationLogs.$inferSelect;

// ==================== REELS ====================

export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  videoUrl: text("video_url").notNull(),
  videoPublicId: text("video_public_id").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption"),
  duration: integer("duration"),
  viewsCount: integer("views_count").default(0).notNull(),
  likesCount: integer("likes_count").default(0).notNull(),
  commentsCount: integer("comments_count").default(0).notNull(),
  sharesCount: integer("shares_count").default(0).notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReelSchema = createInsertSchema(reels).omit({ id: true, createdAt: true, updatedAt: true, viewsCount: true, likesCount: true, commentsCount: true, sharesCount: true });
export type Reel = typeof reels.$inferSelect;
export type InsertReel = z.infer<typeof insertReelSchema>;

export const reelLikes = pgTable("reel_likes", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull().references(() => reels.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueReelUser: unique("reel_likes_reel_user_unique").on(table.reelId, table.userId),
}));

export type ReelLike = typeof reelLikes.$inferSelect;

export const reelComments = pgTable("reel_comments", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull().references(() => reels.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReelCommentSchema = createInsertSchema(reelComments).omit({ id: true, createdAt: true });
export type ReelComment = typeof reelComments.$inferSelect;
export type InsertReelComment = z.infer<typeof insertReelCommentSchema>;

// ==================== BROADCAST LOGS ====================
export const broadcastLogs = pgTable("broadcast_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  target: text("target").notNull().default("all"), // all | premium | free
  actionLink: text("action_link"),
  actionText: text("action_text"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentAt: timestamp("sent_at").defaultNow(),
});
export type BroadcastLog = typeof broadcastLogs.$inferSelect;

// ==================== APP SETTINGS ====================
// Key-value store for admin-configurable feature flags and settings

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export type AppSetting = typeof appSettings.$inferSelect;

// ==================== PROGRAMME PLANNING ====================

export const PROGRAMME_CATEGORIES = {
  DJ_NIGHT: "dj_night",
  LIVE_MUSIC: "live_music",
  WORKSHOP: "workshop",
  EXHIBITION: "exhibition",
  SPORTS_TRAINING: "sports_training",
  OPEN_MIC: "open_mic",
  DANCE_BATTLE: "dance_battle",
  CINEMA: "cinema",
  MARKET: "market",
  NETWORKING: "networking",
  PRIVATE_EVENT: "private_event",
  OTHER: "other",
} as const;

export const PROGRAMME_CATEGORY_LABELS: Record<string, string> = {
  // Fitness & sports classes
  fitness_class: "Fitness Class",
  yoga: "Yoga",
  pilates: "Pilates",
  boxing: "Boxing",
  martial_arts: "Martial Arts",
  crossfit: "CrossFit",
  spinning: "Spinning",
  // Dance
  dance_class: "Dance Class",
  dance_battle: "Dance Battle",
  open_floor: "Open Floor",
  // Training
  open_training: "Open Training",
  personal_training: "Personal Training",
  group_session: "Group Session",
  sports_training: "Sports Training",
  // Events & culture
  workshop: "Workshop",
  dj_night: "DJ Night",
  live_music: "Live Music",
  exhibition: "Exhibition",
  open_mic: "Open Mic",
  event: "Event",
  // Other
  private_event: "Private Event",
  other: "Other",
};

export const programmeAccess = pgTable("programme_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  venueName: text("venue_name").notNull(),
  venueType: varchar("venue_type", { length: 50 }).notNull().default("venue"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  grantedByAdminId: integer("granted_by_admin_id").references(() => users.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  notes: text("notes"),
});

export const insertProgrammeAccessSchema = createInsertSchema(programmeAccess).omit({ id: true, grantedAt: true });
export type ProgrammeAccess = typeof programmeAccess.$inferSelect;
export type InsertProgrammeAccess = z.infer<typeof insertProgrammeAccessSchema>;

export const programmeItems = pgTable("programme_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
  spotName: text("spot_name"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull().default("other"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceType: varchar("recurrence_type", { length: 20 }),
  recurrenceEnd: timestamp("recurrence_end"),
  isPublic: boolean("is_public").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  capacity: integer("capacity"),
  ticketPrice: numeric("ticket_price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProgrammeItemSchema = createInsertSchema(programmeItems).omit({ id: true, createdAt: true });
export type ProgrammeItem = typeof programmeItems.$inferSelect;
export type InsertProgrammeItem = z.infer<typeof insertProgrammeItemSchema>;

export const PROGRAMME_REG_STATUS = {
  RESERVED: "reserved",
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  CANCELLED: "cancelled",
} as const;

export const programmeRegistrations = pgTable("programme_registrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  programmeItemId: integer("programme_item_id").notNull().references(() => programmeItems.id, { onDelete: "cascade" }),
  occurrenceDate: text("occurrence_date").notNull(),
  occurrenceStart: timestamp("occurrence_start"),
  occurrenceEnd: timestamp("occurrence_end"),
  status: varchar("status", { length: 25 }).notNull().default("reserved"),
  amountPaid: numeric("amount_paid"),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProgrammeRegistrationSchema = createInsertSchema(programmeRegistrations).omit({ id: true, createdAt: true });
export type ProgrammeRegistration = typeof programmeRegistrations.$inferSelect;
export type InsertProgrammeRegistration = z.infer<typeof insertProgrammeRegistrationSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Stories
// ────────────────────────────────────────────────────────────────────────────
export const stories = pgTable("stories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull().default("image"), // image | video
  caption: text("caption"),
  bgColor: text("bg_color"),                // for text-only stories
  viewCount: integer("view_count").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStorySchema = createInsertSchema(stories).omit({ id: true, viewCount: true, createdAt: true });
export type Story = typeof stories.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;

export const storyViews = pgTable("story_views", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  viewerId: integer("viewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
}, (t) => [unique().on(t.storyId, t.viewerId)]);

export type StoryView = typeof storyViews.$inferSelect;

// ────────────────────────────────────────────────────────────────────────────
// Location Ratings (community-submitted spots)
// ────────────────────────────────────────────────────────────────────────────
export const locationRatings = pgTable("location_ratings", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5
  review: text("review"),
  visitedAt: timestamp("visited_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.locationId, t.userId)]);

export const insertLocationRatingSchema = createInsertSchema(locationRatings).omit({ id: true, createdAt: true });
export type LocationRating = typeof locationRatings.$inferSelect;
export type InsertLocationRating = z.infer<typeof insertLocationRatingSchema>;

// ── LinkedIn Integration ─────────────────────────────────────────────────────

export const linkedinConnections = pgTable("linkedin_connections", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  accountSlot: text("account_slot").notNull().default("primary"),
  linkedinId: varchar("linkedin_id", { length: 255 }).notNull(),
  accessToken: text("access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  profileName: varchar("profile_name", { length: 255 }),
  profilePictureUrl: text("profile_picture_url"),
  email: varchar("email", { length: 255 }),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type LinkedinConnection = typeof linkedinConnections.$inferSelect;
export const insertLinkedinConnectionSchema = createInsertSchema(linkedinConnections).omit({ id: true, connectedAt: true, updatedAt: true });
export type InsertLinkedinConnection = z.infer<typeof insertLinkedinConnectionSchema>;

export const linkedinPosts = pgTable("linkedin_posts", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id).notNull(),
  linkedinPostId: varchar("linkedin_post_id", { length: 255 }),
  content: text("content").notNull(),
  postType: varchar("post_type", { length: 50 }).default("text"), // text, link, image
  linkUrl: text("link_url"),
  linkTitle: text("link_title"),
  imageUrl: text("image_url"),
  status: varchar("status", { length: 50 }).default("draft"), // draft, published, failed
  publishedAt: timestamp("published_at"),
  // Which platform feature this post is about — used by the AI brain to rotate topics
  // and avoid repeating the same feature across recent posts. Set at generation time.
  featureId: varchar("feature_id", { length: 64 }),
  // Admin feedback on this post — used by AI Brain learning loop ({rating: "up"|"down"|"neutral", notes?, at})
  feedback: jsonb("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LinkedinPost = typeof linkedinPosts.$inferSelect;
export const insertLinkedinPostSchema = createInsertSchema(linkedinPosts).omit({ id: true, createdAt: true });
export type InsertLinkedinPost = z.infer<typeof insertLinkedinPostSchema>;

export const linkedinAutoPostSettings = pgTable("linkedin_auto_post_settings", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  postTime: varchar("post_time", { length: 5 }).default("09:00").notNull(), // HH:MM
  timezone: varchar("timezone", { length: 100 }).default("Europe/Amsterdam").notNull(),
  topics: text("topics").array().default([]).notNull(),
  tone: varchar("tone", { length: 50 }).default("engaging").notNull(),
  template: varchar("template", { length: 50 }).default("community").notNull(),
  includeHashtags: boolean("include_hashtags").default(true).notNull(),
  includeCta: boolean("include_cta").default(true).notNull(),
  language: varchar("language", { length: 10 }).default("en").notNull(),
  targetAudience: varchar("target_audience", { length: 50 }).default("general").notNull(),
  customContext: text("custom_context").default("").notNull(),
  includeImage: boolean("include_image").default(false).notNull(),
  // When true, the daily auto-post is created as `pending_approval` instead of publishing immediately.
  // Admin must review, optionally edit, and approve from the dashboard before it goes live.
  requiresApproval: boolean("requires_approval").default(false).notNull(),
  lastPostedAt: timestamp("last_posted_at"),
  lastPostContent: text("last_post_content"),
  nextPostAt: timestamp("next_post_at"),
  postCount: integer("post_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type LinkedinAutoPostSettings = typeof linkedinAutoPostSettings.$inferSelect;
export const insertLinkedinAutoPostSettingsSchema = createInsertSchema(linkedinAutoPostSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLinkedinAutoPostSettings = z.infer<typeof insertLinkedinAutoPostSettingsSchema>;

// ── LinkedIn AI Brand Intel (admin-trained voice & rules — fed into every prompt) ──
export const linkedinBrandIntel = pgTable("linkedin_brand_intel", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  // Free-form admin-written brand bio that overrides/augments the hardcoded AUTHOR_PROFILE
  brandStory: text("brand_story").default("").notNull(),
  // Voice rules: short directives the AI must obey (e.g. "always include one concrete number")
  voiceRules: text("voice_rules").array().default([]).notNull(),
  // Hard NO list (e.g. "never say 'leverage'", "no humble brags")
  doNotSay: text("do_not_say").array().default([]).notNull(),
  // Topics the admin wants to lean into
  topicsLove: text("topics_love").array().default([]).notNull(),
  // Topics the admin wants the AI to steer away from
  topicsAvoid: text("topics_avoid").array().default([]).notNull(),
  // Signature phrases / opening hooks the admin uses
  signaturePhrases: text("signature_phrases").array().default([]).notNull(),
  // Audience notes — extra context about who's reading
  audienceNotes: text("audience_notes").default("").notNull(),
  // Hashtag bank — preferred hashtags to rotate
  preferredHashtags: text("preferred_hashtags").array().default([]).notNull(),
  // Auto-incremented every time admin updates intel — useful for cache busting
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type LinkedinBrandIntel = typeof linkedinBrandIntel.$inferSelect;
export const insertLinkedinBrandIntelSchema = createInsertSchema(linkedinBrandIntel).omit({ id: true, createdAt: true, updatedAt: true, version: true });
export type InsertLinkedinBrandIntel = z.infer<typeof insertLinkedinBrandIntelSchema>;

// ── LinkedIn Post Examples (few-shot library — gold standards & edits the admin saved) ──
export const linkedinPostExamples = pgTable("linkedin_post_examples", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  // 'gold' = exemplary post AI should imitate; 'avoid' = anti-example AI should steer away from; 'edited' = admin-edited version of an AI draft
  kind: varchar("kind", { length: 20 }).default("gold").notNull(),
  reason: text("reason").default("").notNull(),
  sourcePostId: integer("source_post_id"),
  postType: varchar("post_type", { length: 50 }),
  language: varchar("language", { length: 10 }).default("en").notNull(),
  // Number of times this example has been used in a prompt — for rotation
  usageCount: integer("usage_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LinkedinPostExample = typeof linkedinPostExamples.$inferSelect;
export const insertLinkedinPostExampleSchema = createInsertSchema(linkedinPostExamples).omit({ id: true, createdAt: true, usageCount: true });
export type InsertLinkedinPostExample = z.infer<typeof insertLinkedinPostExampleSchema>;

// ── Event Polls ────────────────────────────────────────────────────────────────

export const PollStatus = {
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  CLOSED: "closed",
} as const;

export const PollType = {
  YES_NO: "yes_no",
  CUSTOM: "custom",
} as const;

export const PollResultsVisibility = {
  LIVE: "live",
  AFTER_CLOSE: "after_close",
} as const;

export const PollVoterAccess = {
  ALL: "all",
  ATTENDEES: "attendees",
} as const;

export const eventPolls = pgTable("event_polls", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  question: text("question").notNull(),
  description: text("description"),
  pollType: text("poll_type").notNull().default("yes_no"), // yes_no | custom | rating
  options: text("options").array().notNull().default([]), // used for custom polls
  status: text("status").notNull().default("draft"), // draft | active | paused | closed
  resultsVisibility: text("results_visibility").notNull().default("live"), // live | after_close
  voterAccess: text("voter_access").notNull().default("all"), // all | attendees
  closesAt: timestamp("closes_at"), // optional auto-close timestamp
  totalVotes: integer("total_votes").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EventPoll = typeof eventPolls.$inferSelect;
export const insertEventPollSchema = createInsertSchema(eventPolls)
  .omit({ id: true, totalVotes: true, createdAt: true, updatedAt: true })
  .extend({ closesAt: z.coerce.date().optional().nullable() });
export type InsertEventPoll = z.infer<typeof insertEventPollSchema>;

export const pollVotes = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").references(() => eventPolls.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  option: text("option").notNull(), // "yes", "no", or custom option text
  votedAt: timestamp("voted_at").defaultNow().notNull(),
});

export type PollVote = typeof pollVotes.$inferSelect;
export const insertPollVoteSchema = createInsertSchema(pollVotes).omit({ id: true, votedAt: true });
export type InsertPollVote = z.infer<typeof insertPollVoteSchema>;

// ── Instagram Integration ──────────────────────────────────────────────────
export const instagramConnections = pgTable("instagram_connections", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  instagramUserId: varchar("instagram_user_id", { length: 255 }).notNull(),
  pageId: varchar("page_id", { length: 255 }),
  accessToken: text("access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at"),
  username: varchar("username", { length: 255 }),
  name: varchar("name", { length: 255 }),
  profilePictureUrl: text("profile_picture_url"),
  biography: text("biography"),
  website: text("website"),
  followersCount: integer("followers_count"),
  mediaCount: integer("media_count"),
  accountType: varchar("account_type", { length: 50 }),
  isActive: boolean("is_active").default(false).notNull(),
  automationEnabled: boolean("automation_enabled").default(false).notNull(),
  label: varchar("label", { length: 100 }),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InstagramConnection = typeof instagramConnections.$inferSelect;
export const insertInstagramConnectionSchema = createInsertSchema(instagramConnections).omit({ id: true, connectedAt: true, updatedAt: true });
export type InsertInstagramConnection = z.infer<typeof insertInstagramConnectionSchema>;

// ── API Keys ──────────────────────────────────────────────────────────────────
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  keyHash: text("key_hash").notNull(),
  permissions: text("permissions").array().notNull().default(["read"]),
  requestCount: integer("request_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, keyPrefix: true, keyHash: true, requestCount: true, lastUsedAt: true, createdAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// ── Back to the Street ────────────────────────────────────────────────────────

export const bttsProgram = pgTable("btts_program", {
  id: serial("id").primaryKey(),
  time: varchar("time", { length: 20 }).notNull(),
  endTime: varchar("end_time", { length: 20 }),
  title: varchar("title", { length: 200 }).notNull(),
  artist: varchar("artist", { length: 200 }),
  stage: varchar("stage", { length: 100 }),
  type: varchar("type", { length: 50 }).notNull().default("performance"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isHighlight: boolean("is_highlight").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BttsProgram = typeof bttsProgram.$inferSelect;
export const insertBttsProgramSchema = createInsertSchema(bttsProgram).omit({ id: true, createdAt: true });
export type InsertBttsProgram = z.infer<typeof insertBttsProgramSchema>;

export const bttsLineup = pgTable("btts_lineup", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  role: varchar("role", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("performer"),
  bio: text("bio"),
  imageUrl: text("image_url"),
  instagram: varchar("instagram", { length: 100 }),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  addedByAi: boolean("added_by_ai").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BttsLineup = typeof bttsLineup.$inferSelect;
export const insertBttsLineupSchema = createInsertSchema(bttsLineup).omit({ id: true, createdAt: true });
export type InsertBttsLineup = z.infer<typeof insertBttsLineupSchema>;

export const bttsBattles = pgTable("btts_battles", {
  id: serial("id").primaryKey(),
  battleType: varchar("battle_type", { length: 50 }).notNull().default("1v1"),
  category: varchar("category", { length: 100 }).notNull(),
  round: varchar("round", { length: 50 }).notNull(),
  position: integer("position").notNull().default(0),
  participant1: varchar("participant1", { length: 200 }),
  participant2: varchar("participant2", { length: 200 }),
  winner: varchar("winner", { length: 200 }),
  scheduledTime: varchar("scheduled_time", { length: 20 }),
  status: varchar("status", { length: 30 }).notNull().default("upcoming"),
  addedByAi: boolean("added_by_ai").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BttsBattle = typeof bttsBattles.$inferSelect;
export const insertBttsBattleSchema = createInsertSchema(bttsBattles).omit({ id: true, createdAt: true });
export type InsertBttsBattle = z.infer<typeof insertBttsBattleSchema>;

export const bttsGallery = pgTable("btts_gallery", {
  id: serial("id").primaryKey(),
  mediaType: varchar("media_type", { length: 20 }).notNull().default("image"),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption"),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BttsGallery = typeof bttsGallery.$inferSelect;
export const insertBttsGallerySchema = createInsertSchema(bttsGallery).omit({ id: true, createdAt: true });
export type InsertBttsGallery = z.infer<typeof insertBttsGallerySchema>;

// BTTS Registrations — battle sign-ups tied to ticket purchase
export const bttsRegistrations = pgTable("btts_registrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  guestName: varchar("guest_name", { length: 200 }),
  crewName: varchar("crew_name", { length: 200 }),
  battleType: varchar("battle_type", { length: 50 }).notNull().default("1v1"),
  category: varchar("category", { length: 100 }).notNull().default("Breaking"),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  paid: boolean("paid").notNull().default(false),
  notes: text("notes"),
  addedBy: varchar("added_by", { length: 50 }).notNull().default("self"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BttsRegistration = typeof bttsRegistrations.$inferSelect;
export const insertBttsRegistrationSchema = createInsertSchema(bttsRegistrations).omit({ id: true, createdAt: true });
export type InsertBttsRegistration = z.infer<typeof insertBttsRegistrationSchema>;

// BTTS Judges — judge assignments for the event
export const bttsJudges = pgTable("btts_judges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  guestName: varchar("guest_name", { length: 200 }),
  specialty: varchar("specialty", { length: 100 }),
  bio: text("bio"),
  judgeNumber: integer("judge_number").notNull(),
  category: varchar("category", { length: 100 }).notNull().default("Breaking"),
  avatarUrl: text("avatar_url"),
  addedByAi: boolean("added_by_ai").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BttsJudge = typeof bttsJudges.$inferSelect;
export const insertBttsJudgeSchema = createInsertSchema(bttsJudges).omit({ id: true, createdAt: true });
export type InsertBttsJudge = z.infer<typeof insertBttsJudgeSchema>;

// BTTS Tickets — ticket types / spot products created by admin
export const bttsTickets = pgTable("btts_tickets", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  price: integer("price").notNull().default(0),        // in whole euros (e.g. 20 = €20.00); 0 = free. Backend multiplies ×100 for Stripe.
  currency: varchar("currency", { length: 10 }).notNull().default("EUR"),
  type: varchar("type", { length: 50 }).notNull().default("general"), // "general" | "spot" | "guest"
  battleFormat: varchar("battle_format", { length: 50 }),             // "1v1", "2v2", etc.
  totalSpots: integer("total_spots").notNull().default(0),            // 0 = unlimited
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // Ticket phase system — groups tickets into progressive phases within a category
  phase: varchar("phase", { length: 30 }),             // null | "early_bird" | "regular" | "late"
  phaseGroup: varchar("phase_group", { length: 100 }), // e.g. "guest_adult", "guest_kids", "battle_1v1"
  ageGroup: varchar("age_group", { length: 30 }),      // null | "adult" | "kids"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BttsTicket = typeof bttsTickets.$inferSelect;
export const insertBttsTicketSchema = createInsertSchema(bttsTickets).omit({ id: true, createdAt: true });
export type InsertBttsTicket = z.infer<typeof insertBttsTicketSchema>;

// BTTS Ticket Purchases — individual spot/ticket claims by users
export const bttsTicketPurchases = pgTable("btts_ticket_purchases", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => bttsTickets.id),
  userId: integer("user_id").references(() => users.id),
  guestName: varchar("guest_name", { length: 200 }),
  guestEmail: varchar("guest_email", { length: 200 }),
  spotNumber: integer("spot_number"),
  status: varchar("status", { length: 30 }).notNull().default("confirmed"), // "confirmed"|"pending_payment"|"cancelled"|"waitlist"
  registrationId: integer("registration_id"),           // linked battle registration (if spot type)
  stripeSessionId: text("stripe_session_id"),           // Stripe Checkout Session ID for paid tickets
  amountPaid: text("amount_paid"),                      // amount actually paid (after Stripe confirms)
  qrCode: text("qr_code"),                             // base64 QR code image for in-app ticket scanning
  notes: text("notes"),
  checkedIn: boolean("checked_in").default(false),     // whether the ticket has been scanned at the door
  checkedInAt: timestamp("checked_in_at"),             // first check-in timestamp
  scanCount: integer("scan_count").default(0),         // total number of times this ticket has been scanned
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BttsTicketPurchase = typeof bttsTicketPurchases.$inferSelect;
export const insertBttsTicketPurchaseSchema = createInsertSchema(bttsTicketPurchases).omit({ id: true, createdAt: true });
export type InsertBttsTicketPurchase = z.infer<typeof insertBttsTicketPurchaseSchema>;

// ─── Founder Profile ──────────────────────────────────────────────────────────
// Editable profile sections for the founder / admin identity
export const founderProfile = pgTable("founder_profile", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  label: varchar("label", { length: 200 }).notNull(),
  content: text("content").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type FounderProfile = typeof founderProfile.$inferSelect;
export const insertFounderProfileSchema = createInsertSchema(founderProfile).omit({ id: true, updatedAt: true });
export type InsertFounderProfile = z.infer<typeof insertFounderProfileSchema>;

// ─── AI Training Entries ──────────────────────────────────────────────────────
// Admin feeds the AI with personal knowledge, story, tone, and values
export const aiTrainingEntries = pgTable("ai_training_entries", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 100 }).notNull().default("general"),
  title: varchar("title", { length: 300 }).notNull().default(""),
  content: text("content").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AiTrainingEntry = typeof aiTrainingEntries.$inferSelect;
export const insertAiTrainingEntrySchema = createInsertSchema(aiTrainingEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiTrainingEntry = z.infer<typeof insertAiTrainingEntrySchema>;

// ─── Instagram AI Persona ─────────────────────────────────────────────────────
export const instagramAiPersona = pgTable("instagram_ai_persona", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  instagramConnectionId: integer("instagram_connection_id").references(() => instagramConnections.id, { onDelete: "cascade" }),
  toneAndVoice: text("tone_and_voice").notNull().default(""),
  communicationStyle: text("communication_style").notNull().default(""),
  businessDirection: text("business_direction").notNull().default(""),
  topicsToAvoid: text("topics_to_avoid").notNull().default(""),
  exampleInteractions: jsonb("example_interactions").notNull().default([]),
  contentSamples: jsonb("content_samples").notNull().default([]),
  customVocabulary: jsonb("custom_vocabulary").notNull().default([]),
  brandFacts: jsonb("brand_facts").notNull().default([]),
  learningHistory: jsonb("learning_history").notNull().default([]),
  analyzedProfile: jsonb("analyzed_profile"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type InstagramAiPersona = typeof instagramAiPersona.$inferSelect;
export const insertInstagramAiPersonaSchema = createInsertSchema(instagramAiPersona).omit({ id: true, updatedAt: true });
export type InsertInstagramAiPersona = z.infer<typeof insertInstagramAiPersonaSchema>;

// ─── Instagram Automation Rules ───────────────────────────────────────────────
export const instagramAutomationRules = pgTable("instagram_automation_rules", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  instagramConnectionId: integer("instagram_connection_id").references(() => instagramConnections.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  triggerType: varchar("trigger_type", { length: 100 }).notNull(),
  conditionKeyword: text("condition_keyword"),
  conditionKeywordExclude: text("condition_keyword_exclude"),
  engagementThreshold: integer("engagement_threshold").default(100),
  replyTemplate: text("reply_template"),
  actionType: varchar("action_type", { length: 100 }).notNull(),
  autoSend: boolean("auto_send").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  triggerCount: integer("trigger_count").notNull().default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type InstagramAutomationRule = typeof instagramAutomationRules.$inferSelect;
export const insertInstagramAutomationRuleSchema = createInsertSchema(instagramAutomationRules).omit({ id: true, createdAt: true, updatedAt: true, triggerCount: true, lastTriggeredAt: true });
export type InsertInstagramAutomationRule = z.infer<typeof insertInstagramAutomationRuleSchema>;

// ─── Street Cred Score ────────────────────────────────────────────────────────
export const credTransactions = pgTable("cred_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  amount: integer("amount").notNull(),
  reason: varchar("reason", { length: 100 }).notNull(),
  referenceId: integer("reference_id"),
  referenceType: varchar("reference_type", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CredTransaction = typeof credTransactions.$inferSelect;
export const insertCredTransactionSchema = createInsertSchema(credTransactions).omit({ id: true, createdAt: true });
export type InsertCredTransaction = z.infer<typeof insertCredTransactionSchema>;

// ─── Crews ────────────────────────────────────────────────────────────────────
export const crews = pgTable("crews", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  description: text("description"),
  discipline: varchar("discipline", { length: 100 }).notNull().default("breaking"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Netherlands"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  foundedYear: integer("founded_year"),
  instagram: varchar("instagram", { length: 100 }),
  isPublic: boolean("is_public").notNull().default(true),
  founderId: integer("founder_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Crew = typeof crews.$inferSelect;
export const insertCrewSchema = createInsertSchema(crews).omit({ id: true, createdAt: true });
export type InsertCrew = z.infer<typeof insertCrewSchema>;

export const crewMembers = pgTable("crew_members", {
  id: serial("id").primaryKey(),
  crewId: integer("crew_id").references(() => crews.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
export type CrewMember = typeof crewMembers.$inferSelect;
export const insertCrewMemberSchema = createInsertSchema(crewMembers).omit({ id: true, joinedAt: true });
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;

// ─── Freestyle Challenges ─────────────────────────────────────────────────────
export const freestyleChallenges = pgTable("freestyle_challenges", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description").notNull(),
  theme: varchar("theme", { length: 200 }),
  discipline: varchar("discipline", { length: 100 }).notNull().default("breaking"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  winnerId: integer("winner_id").references(() => users.id),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FreestyleChallenge = typeof freestyleChallenges.$inferSelect;
export const insertFreestyleChallengeSchema = createInsertSchema(freestyleChallenges).omit({ id: true, createdAt: true });
export type InsertFreestyleChallenge = z.infer<typeof insertFreestyleChallengeSchema>;

export const challengeEntries = pgTable("challenge_entries", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").references(() => freestyleChallenges.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  videoUrl: text("video_url").notNull(),
  caption: text("caption"),
  voteCount: integer("vote_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ChallengeEntry = typeof challengeEntries.$inferSelect;
export const insertChallengeEntrySchema = createInsertSchema(challengeEntries).omit({ id: true, createdAt: true, voteCount: true });
export type InsertChallengeEntry = z.infer<typeof insertChallengeEntrySchema>;

export const challengeVotes = pgTable("challenge_votes", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").references(() => challengeEntries.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ChallengeVote = typeof challengeVotes.$inferSelect;
export const insertChallengeVoteSchema = createInsertSchema(challengeVotes).omit({ id: true, createdAt: true });
export type InsertChallengeVote = z.infer<typeof insertChallengeVoteSchema>;

// ─── Cyphers ──────────────────────────────────────────────────────────────────
export const cyphers = pgTable("cyphers", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  discipline: varchar("discipline", { length: 100 }).notNull().default("breaking"),
  description: text("description"),
  lat: doublePrecision("lat").notNull(),
  lon: doublePrecision("lon").notNull(),
  locationName: varchar("location_name", { length: 300 }),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  attendeeCount: integer("attendee_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Cypher = typeof cyphers.$inferSelect;
export const insertCypherSchema = createInsertSchema(cyphers).omit({ id: true, createdAt: true });
export type InsertCypher = z.infer<typeof insertCypherSchema>;

// ─── Graffiti Wall ────────────────────────────────────────────────────────────
export const graffitiTags = pgTable("graffiti_tags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 30 }).notNull().default("sticker"),
  imageUrl: text("image_url"),
  text: text("text"),
  color: varchar("color", { length: 30 }).default("#ffffff"),
  posX: doublePrecision("pos_x").notNull().default(0),
  posY: doublePrecision("pos_y").notNull().default(0),
  rotation: doublePrecision("rotation").notNull().default(0),
  scale: doublePrecision("scale").notNull().default(1),
  layer: integer("layer").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GraffitiTag = typeof graffitiTags.$inferSelect;
export const insertGraffitiTagSchema = createInsertSchema(graffitiTags).omit({ id: true, createdAt: true });
export type InsertGraffitiTag = z.infer<typeof insertGraffitiTagSchema>;

// ─── Beats (Beat Lab) ─────────────────────────────────────────────────────────
export const beats = pgTable("beats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  genre: varchar("genre", { length: 100 }).default("hip-hop"),
  bpm: integer("bpm").default(90),
  audioUrl: text("audio_url").notNull(),
  coverUrl: text("cover_url"),
  duration: integer("duration"),
  tags: text("tags").array(),
  playCount: integer("play_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Beat = typeof beats.$inferSelect;
export const insertBeatSchema = createInsertSchema(beats).omit({ id: true, createdAt: true, playCount: true, likeCount: true });
export type InsertBeat = z.infer<typeof insertBeatSchema>;

// ─── Community Radio ──────────────────────────────────────────────────────────
export const radioSubmissions = pgTable("radio_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  artist: varchar("artist", { length: 200 }),
  genre: varchar("genre", { length: 100 }).default("hip-hop"),
  duration: integer("duration"),
  audioUrl: text("audio_url").notNull(),
  coverUrl: text("cover_url"),
  playCount: integer("play_count").notNull().default(0),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RadioSubmission = typeof radioSubmissions.$inferSelect;
export const insertRadioSubmissionSchema = createInsertSchema(radioSubmissions).omit({ id: true, createdAt: true, playCount: true });
export type InsertRadioSubmission = z.infer<typeof insertRadioSubmissionSchema>;

// ─── Hall of Fame ─────────────────────────────────────────────────────────────
export const hallOfFame = pgTable("hall_of_fame", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: varchar("name", { length: 200 }).notNull(),
  discipline: varchar("discipline", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Netherlands"),
  bio: text("bio"),
  achievement: text("achievement").notNull(),
  year: integer("year"),
  imageUrl: text("image_url"),
  instagramHandle: varchar("instagram_handle", { length: 100 }),
  sortOrder: integer("sort_order").notNull().default(0),
  addedBy: integer("added_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type HallOfFameEntry = typeof hallOfFame.$inferSelect;
export const insertHallOfFameSchema = createInsertSchema(hallOfFame).omit({ id: true, createdAt: true });
export type InsertHallOfFame = z.infer<typeof insertHallOfFameSchema>;

// ── Instagram Scheduled Posts ─────────────────────────────────────────────────
export const instagramScheduledPosts = pgTable("instagram_scheduled_posts", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  mediaType: varchar("media_type", { length: 20 }).notNull().default("REELS"), // PHOTO | VIDEO | REELS | CAROUSEL
  mediaUrl: text("media_url").notNull(),
  caption: text("caption"),
  hashtags: text("hashtags"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | publishing | published | failed
  instagramMediaId: varchar("instagram_media_id", { length: 255 }),
  permalink: text("permalink"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type InstagramScheduledPost = typeof instagramScheduledPosts.$inferSelect;
export const insertInstagramScheduledPostSchema = createInsertSchema(instagramScheduledPosts).omit({ id: true, createdAt: true, updatedAt: true, instagramMediaId: true, errorMessage: true });
export type InsertInstagramScheduledPost = z.infer<typeof insertInstagramScheduledPostSchema>;

export const instagramAiActions = pgTable("instagram_ai_actions", {
  id: serial("id").primaryKey(),
  adminUserId: integer("admin_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  triggerType: varchar("trigger_type", { length: 100 }).notNull(),
  triggerData: jsonb("trigger_data").notNull().default({}),
  rawAiOutput: text("raw_ai_output").notNull().default(""),
  finalSentText: text("final_sent_text"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  ruleId: integer("rule_id").references(() => instagramAutomationRules.id, { onDelete: "set null" }),
  mediaId: varchar("media_id", { length: 255 }),
  commentId: varchar("comment_id", { length: 255 }),
  sourceText: text("source_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type InstagramAiAction = typeof instagramAiActions.$inferSelect;
export const insertInstagramAiActionSchema = createInsertSchema(instagramAiActions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInstagramAiAction = z.infer<typeof insertInstagramAiActionSchema>;

// ── Security Center ────────────────────────────────────────────────────────
export const securityReports = pgTable("security_reports", {
  id: serial("id").primaryKey(),
  scanId: varchar("scan_id", { length: 64 }).notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending|running|complete|failed
  triggeredBy: varchar("triggered_by", { length: 20 }).notNull().default("manual"), // manual|scheduled
  triggeredByUserId: integer("triggered_by_user_id").references(() => users.id),
  overallScore: integer("overall_score"),
  grade: varchar("grade", { length: 5 }),          // A/B/C/D/F
  sections: jsonb("sections").default([]),           // ScanSection[]
  summary: text("summary"),
  criticalCount: integer("critical_count").default(0),
  highCount: integer("high_count").default(0),
  mediumCount: integer("medium_count").default(0),
  lowCount: integer("low_count").default(0),
  emailSent: boolean("email_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export type SecurityReport = typeof securityReports.$inferSelect;


// ── Spot Schedules ────────────────────────────────────────────────────────
// Works for ALL spot types: city-{id}, osm-{id}, user-{id}
export const spotSchedules = pgTable("spot_schedules", {
  id: serial("id").primaryKey(),
  spotRef: varchar("spot_ref", { length: 64 }).notNull(), // e.g. "city-34", "osm-12345", "user-7"
  spotName: varchar("spot_name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  activityType: varchar("activity_type", { length: 100 }),        // "skate", "graffiti", "hip-hop", "breaking", etc.
  scheduleType: varchar("schedule_type", { length: 20 }).notNull().default("recurring"), // "recurring" | "one_time"
  // For recurring: which days of the week (JSON array: ["Mo","Tu","We"])
  recurringDays: jsonb("recurring_days").default([]),
  startTime: varchar("start_time", { length: 10 }),               // "HH:MM"
  endTime: varchar("end_time", { length: 10 }),                   // "HH:MM"
  // For one-time events (stored as "YYYY-MM-DD")
  eventDate: text("event_date"),
  // Extra info
  notes: text("notes"),
  isPublic: boolean("is_public").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SpotSchedule = typeof spotSchedules.$inferSelect;
export const insertSpotScheduleSchema = createInsertSchema(spotSchedules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSpotSchedule = z.infer<typeof insertSpotScheduleSchema>;

// ── Spot Ownership / Claiming System ─────────────────────────────────────
export const spotClaims = pgTable("spot_claims", {
  id: serial("id").primaryKey(),
  spotRef: varchar("spot_ref", { length: 64 }).notNull(),        // "city-34", "osm-12345", "user-7"
  spotName: varchar("spot_name", { length: 255 }).notNull(),
  spotCategory: varchar("spot_category", { length: 100 }),       // skate, graffiti, cafe, etc.
  spotAddress: text("spot_address"),
  claimantId: integer("claimant_id").references(() => users.id).notNull(),
  businessName: varchar("business_name", { length: 255 }),
  businessEmail: varchar("business_email", { length: 255 }),
  businessPhone: varchar("business_phone", { length: 50 }),
  role: varchar("role", { length: 100 }),                        // "owner", "manager", "staff"
  verificationNote: text("verification_note"),                   // why they own it
  websiteUrl: varchar("website_url", { length: 500 }),
  kvkNumber: varchar("kvk_number", { length: 30 }),              // Dutch Chamber of Commerce
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | approved | rejected | assigned
  adminNote: text("admin_note"),                                 // note from admin on decision
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
  aiSummary: text("ai_summary"),                                 // Claude-generated summary/verification
});
export type SpotClaim = typeof spotClaims.$inferSelect;
export const insertSpotClaimSchema = createInsertSchema(spotClaims).omit({ id: true, claimedAt: true, reviewedAt: true });
export type InsertSpotClaim = z.infer<typeof insertSpotClaimSchema>;

// Approved ownerships (active)
export const spotOwnerships = pgTable("spot_ownerships", {
  id: serial("id").primaryKey(),
  spotRef: varchar("spot_ref", { length: 64 }).notNull(),
  spotName: varchar("spot_name", { length: 255 }).notNull(),
  spotCategory: varchar("spot_category", { length: 100 }),
  spotAddress: text("spot_address"),
  ownerId: integer("owner_id").references(() => users.id).notNull(),
  claimId: integer("claim_id").references(() => spotClaims.id),  // link back to claim
  businessName: varchar("business_name", { length: 255 }),
  role: varchar("role", { length: 100 }).default("owner"),
  permissions: jsonb("permissions").default(["schedule", "info", "photos"]), // what owner can manage
  grantedBy: integer("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true),
});
export type SpotOwnership = typeof spotOwnerships.$inferSelect;
export const insertSpotOwnershipSchema = createInsertSchema(spotOwnerships).omit({ id: true, grantedAt: true });
export type InsertSpotOwnership = z.infer<typeof insertSpotOwnershipSchema>;

// ── Community Groups ──────────────────────────────────────────────────────────
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  type: varchar("type", { length: 50 }).notNull().default("topic"), // topic / city / discipline / artist / crew
  city: varchar("city", { length: 100 }),
  discipline: varchar("discipline", { length: 50 }), // breaking / graffiti / skate / hiphop / etc.
  tags: text("tags").array(),
  isPrivate: boolean("is_private").default(false),      // closed group — join needs approval
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending / active / archived
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  memberCount: integer("member_count").default(0),
  postCount: integer("post_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Group = typeof groups.$inferSelect;
export const insertGroupSchema = createInsertSchema(groups).omit({ id: true, createdAt: true, updatedAt: true, approvedAt: true, memberCount: true, postCount: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;

// ── AI Finder Promotions ──────────────────────────────────────────────────────
// Admin can promote specific spots to appear first in AI Finder results
export const aiFinderPromotions = pgTable("ai_finder_promotions", {
  id: serial("id").primaryKey(),
  spotRef: varchar("spot_ref", { length: 30 }).notNull(),   // "SP_12", "LOC_7", or "CS_30250452"
  spotName: text("spot_name").notNull(),
  spotCategory: varchar("spot_category", { length: 50 }),   // null = appears in ALL category searches
  boostScore: integer("boost_score").notNull().default(80), // 60-99: injected match score
  adminNote: text("admin_note"),                            // why this is promoted
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AiFinderPromotion = typeof aiFinderPromotions.$inferSelect;
export const insertAiFinderPromotionSchema = createInsertSchema(aiFinderPromotions).omit({ id: true, createdAt: true });
export type InsertAiFinderPromotion = z.infer<typeof insertAiFinderPromotionSchema>;

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"), // admin / moderator / member
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending / approved / banned
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  invitedBy: integer("invited_by").references(() => users.id),
});
export type GroupMember = typeof groupMembers.$inferSelect;
export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({ id: true, joinedAt: true });
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;

// ==================== Ads Hub (Phase 1: AI-drafted, manually launched) ====================
export const AdPlatform = {
  GOOGLE: "google",
  META: "meta",
  TIKTOK: "tiktok",
  LINKEDIN: "linkedin",
} as const;
export const AdGoal = {
  SIGNUPS: "signups",
  EVENT: "event",
  PREMIUM: "premium",
  AWARENESS: "awareness",
} as const;
export const AdCampaignStatus = {
  DRAFT: "draft",
  READY: "ready",
  LIVE: "live",
  PAUSED: "paused",
  ENDED: "ended",
} as const;

export const adCampaigns = pgTable("ad_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // google | meta | tiktok | linkedin
  goal: text("goal").notNull().default(AdGoal.SIGNUPS),
  status: text("status").notNull().default(AdCampaignStatus.DRAFT),
  dailyBudget: integer("daily_budget_cents").default(0), // in cents (EUR)
  totalBudget: integer("total_budget_cents").default(0),
  audience: jsonb("audience"), // {locations, ageRange, interests, behaviors, languages}
  creative: jsonb("creative"), // {headlines:[], descriptions:[], primaryText, cta, imagePrompt, hashtags:[], keywords:[]}
  utmSource: text("utm_source").notNull(),
  utmMedium: text("utm_medium").notNull().default("cpc"),
  utmCampaign: text("utm_campaign").notNull(),
  landingUrl: text("landing_url").notNull().default("/"),
  externalCampaignId: text("external_campaign_id"), // user-pasted id from the ad platform
  notes: text("notes"),
  launchedAt: timestamp("launched_at"),
  endedAt: timestamp("ended_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertAdCampaignSchema = createInsertSchema(adCampaigns).omit({
  id: true, createdAt: true, updatedAt: true, launchedAt: true, endedAt: true,
});
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type InsertAdCampaign = z.infer<typeof insertAdCampaignSchema>;

export const adSpendLogs = pgTable("ad_spend_logs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => adCampaigns.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  amountCents: integer("amount_cents").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0), // optional manual entry from platform
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertAdSpendLogSchema = createInsertSchema(adSpendLogs).omit({ id: true, createdAt: true });
export type AdSpendLog = typeof adSpendLogs.$inferSelect;
export type InsertAdSpendLog = z.infer<typeof insertAdSpendLogSchema>;

export const adAttributions = pgTable("ad_attributions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: text("session_id").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  referrer: text("referrer"),
  landingPath: text("landing_path"),
  landedAt: timestamp("landed_at").defaultNow().notNull(),
  convertedAt: timestamp("converted_at"),
  conversionType: text("conversion_type"), // signup | premium | etc.
});
export const insertAdAttributionSchema = createInsertSchema(adAttributions).omit({ id: true, landedAt: true });
export type AdAttribution = typeof adAttributions.$inferSelect;
export type InsertAdAttribution = z.infer<typeof insertAdAttributionSchema>;

export const adInsights = pgTable("ad_insights", {
  id: serial("id").primaryKey(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  periodDays: integer("period_days").notNull().default(7),
  summary: text("summary").notNull(),
  recommendations: jsonb("recommendations"), // [{action, platform, reason, priority}]
  kpis: jsonb("kpis"), // {totalSpendCents, signups, costPerSignup, byPlatform:{...}}
});
export type AdInsight = typeof adInsights.$inferSelect;

// ==================== Ads Hub: Marketing Brain & Platform Connections ====================
export const marketingContext = pgTable("marketing_context", {
  id: serial("id").primaryKey(),
  appName: text("app_name").notNull().default("Urban Culture Hub"),
  tagline: text("tagline"),
  pitch: text("pitch"), // long-form 1-2 paragraph elevator pitch
  features: jsonb("features"), // [{name, description, audienceFit}]
  uniqueValue: text("unique_value"), // what makes us different from competitors
  audiencePersonas: jsonb("audience_personas"), // [{name, description, painPoints, motivators}]
  brandVoice: text("brand_voice"), // tone & voice guidelines
  doSay: jsonb("do_say"), // string[]
  dontSay: jsonb("dont_say"), // string[]
  competitors: text("competitors"),
  geographicFocus: text("geographic_focus"),
  languages: jsonb("languages"), // string[]
  exampleWinningCopy: text("example_winning_copy"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});
export type MarketingContext = typeof marketingContext.$inferSelect;

export const adPlatformConnections = pgTable("ad_platform_connections", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull().unique(), // google | meta | tiktok | linkedin
  customerId: text("customer_id"), // e.g. Google Ads customer ID, Meta ad account id
  loginCustomerId: text("login_customer_id"), // Google MCC parent
  refreshToken: text("refresh_token"), // encrypted at rest is ideal but DB-level is fine for now
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  developerToken: text("developer_token"), // platform-specific (Google Ads needs one)
  status: text("status").notNull().default("disconnected"), // disconnected | connected | error
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncError: text("last_sync_error"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AdPlatformConnection = typeof adPlatformConnections.$inferSelect;

// ==================== Admin Career Suite (Claude-powered Identity, CV, Portfolio) ====================
export const adminCareerProfile = pgTable("admin_career_profile", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  // Identity & story
  fullName: text("full_name"),
  headline: text("headline"), // 1-line professional headline
  location: text("location"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  socials: jsonb("socials"), // { linkedin, instagram, tiktok, github, ... }
  story: text("story"), // long-form personal narrative — Claude reads this
  // Pillars / ventures (Stichting Coffee & Dance, Dance Healthy, Back to the Street, etc.)
  ventures: jsonb("ventures"), // [{name, role, period, summary, impact, tags}]
  experience: jsonb("experience"), // [{title, org, period, summary, achievements[]}]
  education: jsonb("education"), // [{degree, institution, period, notes}]
  skills: jsonb("skills"), // [{name, level, category}]
  languages: jsonb("languages"), // [{name, level}]
  achievements: jsonb("achievements"), // string[] or [{title, year, summary}]
  pressAndAwards: jsonb("press_and_awards"), // [{title, source, year, url}]
  // Claude-derived enrichment (refreshed by AI)
  strengths: jsonb("strengths"), // string[] — top strengths Claude inferred
  positioning: text("positioning"), // 1-paragraph elevator positioning Claude wrote
  uniqueValueProps: jsonb("unique_value_props"), // string[]
  targetRoles: jsonb("target_roles"), // string[] e.g. ["Marketing Lead", "Community Manager"]
  // Visual / public
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  publicSlug: text("public_slug").unique(), // /p/:slug
  publicEnabled: boolean("public_enabled").notNull().default(false),
  // Meta
  rawNotes: text("raw_notes"), // freeform brain dump Claude can mine for enrichment
  enrichedAt: timestamp("enriched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AdminCareerProfile = typeof adminCareerProfile.$inferSelect;

export const adminCareerCvs = pgTable("admin_career_cvs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => adminCareerProfile.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Marketing CV — corporate"
  style: text("style").notNull().default("modern"), // modern | corporate | creative | startup
  language: text("language").notNull().default("en"),
  targetRole: text("target_role"),
  targetJobDescription: text("target_job_description"),
  content: jsonb("content").notNull(), // { summary, experience[], education[], skills[], achievements[], extras }
  aiNotes: text("ai_notes"), // Claude's commentary on what was emphasized & why
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AdminCareerCv = typeof adminCareerCvs.$inferSelect;

export const adminCareerProjects = pgTable("admin_career_projects", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => adminCareerProfile.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category"), // venture | event | campaign | product | other
  period: text("period"),
  summary: text("summary"),
  story: text("story"), // longer Claude-polished narrative
  impact: text("impact"), // metrics / outcomes
  role: text("role"),
  tags: jsonb("tags"), // string[]
  mediaUrls: jsonb("media_urls"), // string[]
  links: jsonb("links"), // [{label, url}]
  highlight: boolean("highlight").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type AdminCareerProject = typeof adminCareerProjects.$inferSelect;

export const adminCareerJobMatches = pgTable("admin_career_job_matches", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => adminCareerProfile.id, { onDelete: "cascade" }),
  source: text("source"), // linkedin | indeed | manual | etc.
  jobTitle: text("job_title"),
  company: text("company"),
  location: text("location"),
  jobUrl: text("job_url"),
  jobDescription: text("job_description"),
  fitScore: integer("fit_score"), // 0-100
  fitAnalysis: jsonb("fit_analysis"), // { strengths[], gaps[], rewriteSuggestions[], coverLetterDraft }
  status: text("status").notNull().default("saved"), // saved | applied | interviewing | rejected | offer
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AdminCareerJobMatch = typeof adminCareerJobMatches.$inferSelect;

// ==================== Gemeente Outreach System ====================
export const gemeenteOutreach = pgTable("gemeente_outreach", {
  id: serial("id").primaryKey(),
  // Municipality identification
  municipalityName: text("municipality_name").notNull(),
  municipalityCode: text("municipality_code"),
  province: text("province"),
  city: text("city"),
  website: text("website"),
  // Department info
  department: text("department"),
  subDepartment: text("sub_department"),
  departmentEmail: text("department_email"),
  departmentPhone: text("department_phone"),
  // Contact person
  contactName: text("contact_name"),
  contactRole: text("contact_role"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactLinkedin: text("contact_linkedin"),
  // Outreach tracking
  outreachStatus: text("outreach_status").notNull().default("niet_gecontacteerd"),
  // niet_gecontacteerd | gecontacteerd | reactie_ontvangen | geinteresseerd | in_gesprek | partnership | afgewezen
  outreachDate: timestamp("outreach_date"),
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  emailSentCount: integer("email_sent_count").default(0),
  // Outreach context
  outreachGoal: text("outreach_goal"),
  // subsidie | partnerschap | pilot | culturele_samenwerking | evenement | platform_adoptie
  priority: text("priority").default("medium"), // high | medium | low
  // Cultural & urban culture relevance
  hasUrbanCultureBudget: boolean("has_urban_culture_budget").default(false),
  culturalBudgetInfo: text("cultural_budget_info"),
  relevantPrograms: text("relevant_programs").array().default([]),
  // Notes
  internalNotes: text("internal_notes"),
  meetingNotes: text("meeting_notes"),
  outreachHistory: jsonb("outreach_history").default([]),
  // Custom admin fields (future-proof)
  customFields: jsonb("custom_fields").default({}),
  tags: text("tags").array().default([]),
  // AI enrichment
  aiScore: integer("ai_score"), // 0-100 outreach value score
  aiSummary: text("ai_summary"),
  aiSuggestedApproach: text("ai_suggested_approach"),
  // Metadata
  addedBy: integer("added_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGemeenteOutreachSchema = createInsertSchema(gemeenteOutreach).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GemeenteOutreach = typeof gemeenteOutreach.$inferSelect;
export type InsertGemeenteOutreach = z.infer<typeof insertGemeenteOutreachSchema>;

// ==================== Lead Export Jobs (audit trail) ====================
export const leadExportJobs = pgTable("lead_export_jobs", {
  id: serial("id").primaryKey(),
  exportedBy: integer("exported_by").references(() => users.id),
  exportType: text("export_type").notNull(), // pdf | excel | csv
  dataSources: text("data_sources").array().default([]),
  filters: jsonb("filters").default({}),
  recordCount: integer("record_count").default(0),
  aiEnhanced: boolean("ai_enhanced").default(false),
  filename: text("filename"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LeadExportJob = typeof leadExportJobs.$inferSelect;

// ==================== Memory Calendar (Advanced AI Memory + Reminders) ====================
// Admin-first feature: smart calendar where every entry can be enriched, summarized,
// and prepared for by Claude. Reminders fire via push + email at user-defined offsets.

export const memoryEvents = pgTable("memory_events", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").references(() => users.id).notNull(),

  title: text("title").notNull(),
  description: text("description"),
  category: text("category").default("general"),
  // general | meeting | deadline | birthday | subsidy | event | follow_up |
  // project | personal | business | reminder | task
  project: text("project"),               // free-text project tag
  priority: text("priority").default("normal"), // low | normal | high | urgent
  tags: text("tags").array().default([]),

  // When it happens
  eventDate: timestamp("event_date").notNull(),
  endDate:   timestamp("end_date"),
  allDay:    boolean("all_day").default(false),
  location:  text("location"),

  // Repetition
  repeatRule: text("repeat_rule").default("none"), // none|daily|weekly|monthly|yearly
  repeatUntil: timestamp("repeat_until"),

  // Reminder configuration
  reminderOffsets: integer("reminder_offsets").array().default([60]), // minutes before
  reminderTone:    text("reminder_tone").default("professional"),
                                        // professional|motivational|urgent|friendly|business
  notifyPush:      boolean("notify_push").default(true),
  notifyEmail:     boolean("notify_email").default(false),

  // Sharing / privacy
  isPrivate: boolean("is_private").default(true),
  isShared:  boolean("is_shared").default(false),

  // AI enrichment
  aiContext:     text("ai_context"),       // Claude's interpretation of why it matters
  aiPreparation: text("ai_preparation"),   // suggested prep steps
  aiFollowUp:    text("ai_follow_up"),     // suggested follow-up

  completedAt: timestamp("completed_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export const insertMemoryEventSchema = createInsertSchema(memoryEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MemoryEvent       = typeof memoryEvents.$inferSelect;
export type InsertMemoryEvent = z.infer<typeof insertMemoryEventSchema>;

export const memoryReminders = pgTable("memory_reminders", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => memoryEvents.id, { onDelete: "cascade" }).notNull(),
  fireAt:  timestamp("fire_at").notNull(),
  channel: text("channel").notNull(),  // push | email | both
  tone:    text("tone").default("professional"),
  sent:    boolean("sent").default(false),
  sentAt:  timestamp("sent_at"),
  error:   text("error"),
});
export type MemoryReminder       = typeof memoryReminders.$inferSelect;
export const insertMemoryReminderSchema = createInsertSchema(memoryReminders).omit({ id: true, sent: true, sentAt: true, error: true });
export type InsertMemoryReminder = z.infer<typeof insertMemoryReminderSchema>;

export const memoryAccess = pgTable("memory_access", {
  id: serial("id").primaryKey(),
  userId:    integer("user_id").references(() => users.id).notNull().unique(),
  canUse:    boolean("can_use").default(true),
  canShare:  boolean("can_share").default(false),
  grantedBy: integer("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  // Quiet hours — push/email never fires inside this window. "HH:MM" 24h local.
  // Window may cross midnight (e.g. start=23:00, end=07:00). NULL on either = disabled.
  quietHoursStart: text("quiet_hours_start"),
  quietHoursEnd:   text("quiet_hours_end"),
});
export type MemoryAccess       = typeof memoryAccess.$inferSelect;
export const insertMemoryAccessSchema = createInsertSchema(memoryAccess).omit({ id: true, grantedAt: true });
export type InsertMemoryAccess = z.infer<typeof insertMemoryAccessSchema>;

// ==================== Memory Notes (multilingual, Claude-powered) ====================
// Standalone smart notes linked to the Memory Calendar owner. Each note can be
// written in English, Arabic or Dutch and enriched by Claude with a summary,
// key-points, action items and sentiment analysis.

export const memoryNotes = pgTable("memory_notes", {
  id:           serial("id").primaryKey(),
  ownerUserId:  integer("owner_user_id").references(() => users.id).notNull(),

  title:    text("title").notNull(),
  content:  text("content").notNull().default(""),
  language: text("language").default("en"),   // en | ar | nl
  category: text("category").default("general"),
  // general | idea | meeting | research | personal | business | task | draft | reference

  tags:     text("tags").array().default([]),
  priority: text("priority").default("normal"), // low | normal | high | urgent

  isPinned:    boolean("is_pinned").default(false),
  isPrivate:   boolean("is_private").default(true),
  isArchived:  boolean("is_archived").default(false),

  // Text-stat cache (recomputed on each save)
  wordCount:        integer("word_count").default(0),
  charCount:        integer("char_count").default(0),
  readTimeMinutes:  integer("read_time_minutes").default(0),

  // Claude AI enrichment (populated by POST /notes/:id/analyze)
  aiSummary:       text("ai_summary"),
  aiKeyPoints:     text("ai_key_points").array().default([]),
  aiActionItems:   text("ai_action_items").array().default([]),
  aiSentiment:     text("ai_sentiment"),           // positive | neutral | negative | mixed
  aiSuggestedTags: text("ai_suggested_tags").array().default([]),
  aiLanguageDetected: text("ai_language_detected"),
  aiTranslationEn: text("ai_translation_en"),      // English translation when note is AR/NL
  aiInsight:       text("ai_insight"),              // one free-form Claude observation
  lastAnalyzedAt:  timestamp("last_analyzed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMemoryNoteSchema = createInsertSchema(memoryNotes).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type MemoryNote       = typeof memoryNotes.$inferSelect;
export type InsertMemoryNote = z.infer<typeof insertMemoryNoteSchema>;

// ==================== AI Legal Assistant (Admin-only Dutch-law advisor) ====================
// Hybrid AI flow: primary Claude answer → secondary validation pass → final answer with
// confidence + flagged risks. All conversations are private to the admin who owns them.

export const legalConversations = pgTable("legal_conversations", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").references(() => users.id).notNull(),
  title: text("title").notNull().default("New consultation"),
  category: text("category").default("general"),
  // general | police | traffic | tax | business | consumer | privacy
  // | filming | municipality | housing | permits | criminal | other
  tags: text("tags").array().default([]),
  important: boolean("important").default(false),
  liveMode: boolean("live_mode").default(false), // true = urgent / "happening now"
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertLegalConversationSchema = createInsertSchema(legalConversations).omit({
  id: true, createdAt: true, updatedAt: true, archivedAt: true,
});
export type LegalConversation       = typeof legalConversations.$inferSelect;
export type InsertLegalConversation = z.infer<typeof insertLegalConversationSchema>;

export const legalMessages = pgTable("legal_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .references(() => legalConversations.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(), // user | assistant | system
  content: text("content").notNull(),
  // For assistant messages: structured answer fields (may be null for plain text)
  rights:       text("rights"),
  risks:        text("risks"),
  nextSteps:    text("next_steps"),
  thingsToAvoid: text("things_to_avoid"),
  shortSummary: text("short_summary"),
  // Validation pass output
  confidence:    text("confidence"),       // high | medium | low
  validationNotes: text("validation_notes"),
  flagged:       boolean("flagged").default(false),
  // Sources / lookups consulted (free-text labels, e.g. "Politiewet 2012 art. 7")
  sources: text("sources").array().default([]),
  voiceInput: boolean("voice_input").default(false),
  starred:    boolean("starred").default(false),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});
export const insertLegalMessageSchema = createInsertSchema(legalMessages).omit({
  id: true, createdAt: true,
});
export type LegalMessage       = typeof legalMessages.$inferSelect;
export type InsertLegalMessage = z.infer<typeof insertLegalMessageSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// AI Email Writer (admin) — settings, saved drafts, usage logs
// ─────────────────────────────────────────────────────────────────────────────

export const emailWriterSettings = pgTable("email_writer_settings", {
  id: serial("id").primaryKey(),
  // Model A
  modelAProvider: varchar("model_a_provider", { length: 24 }).default("anthropic").notNull(),
  modelAId:       varchar("model_a_id",       { length: 64 }).default("claude-sonnet-4-6").notNull(),
  // Model B
  modelBProvider: varchar("model_b_provider", { length: 24 }).default("openai").notNull(),
  modelBId:       varchar("model_b_id",       { length: 64 }).default("gpt-4o").notNull(),
  // Active mode for users: "A" | "B" | "combo"
  activeMode:        varchar("active_mode", { length: 8 }).default("combo").notNull(),
  realtimeEnabled:   boolean("realtime_enabled").default(true).notNull(),
  detectionEnabled:  boolean("detection_enabled").default(true).notNull(),
  humanizerEnabled:  boolean("humanizer_enabled").default(true).notNull(),
  defaultTone:       varchar("default_tone",     { length: 32 }).default("professional").notNull(),
  defaultLanguage:   varchar("default_language", { length: 8  }).default("en").notNull(),
  dailyLimitPerUser: integer("daily_limit_per_user").default(50).notNull(),
  rolesAllowed:      text("roles_allowed").array().default(["admin","super_admin"]).notNull(),
  updatedAt:         timestamp("updated_at").defaultNow().notNull(),
});
export const insertEmailWriterSettingsSchema = createInsertSchema(emailWriterSettings).omit({ id: true, updatedAt: true });
export type EmailWriterSettings       = typeof emailWriterSettings.$inferSelect;
export type InsertEmailWriterSettings = z.infer<typeof insertEmailWriterSettingsSchema>;

export const emailWriterDrafts = pgTable("email_writer_drafts", {
  id: serial("id").primaryKey(),
  ownerUserId: integer("owner_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  leadId:      integer("lead_id").references(() => outreachLeads.id, { onDelete: "set null" }),
  recipientName:    text("recipient_name"),
  recipientEmail:   text("recipient_email"),
  subject:          text("subject").default("").notNull(),
  body:             text("body").default("").notNull(),
  emailType:        varchar("email_type", { length: 32 }).default("custom").notNull(),
  tone:             varchar("tone",       { length: 32 }).default("professional").notNull(),
  language:         varchar("language",   { length: 8  }).default("en").notNull(),
  modeUsed:         varchar("mode_used",  { length: 8  }).default("A").notNull(),
  modelLabel:       text("model_label"),
  // Quality scoring (0-100)
  scoreClarity:           integer("score_clarity"),
  scorePersonalization:   integer("score_personalization"),
  scoreProfessionalism:   integer("score_professionalism"),
  scoreHumanTone:         integer("score_human_tone"),
  scoreCallToAction:      integer("score_call_to_action"),
  // AI detection
  aiVerdict: varchar("ai_verdict", { length: 24 }),  // natural | slightly_ai | too_robotic | needs_humanizing
  aiNotes:   text("ai_notes"),
  humanized: boolean("humanized").default(false).notNull(),
  status:    varchar("status", { length: 16 }).default("draft").notNull(), // draft | sent | saved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertEmailWriterDraftSchema = createInsertSchema(emailWriterDrafts).omit({ id: true, createdAt: true, updatedAt: true });
export type EmailWriterDraft       = typeof emailWriterDrafts.$inferSelect;
export type InsertEmailWriterDraft = z.infer<typeof insertEmailWriterDraftSchema>;

export const emailWriterUsageLogs = pgTable("email_writer_usage_logs", {
  id: serial("id").primaryKey(),
  userId:    integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  action:    varchar("action", { length: 32 }).notNull(), // generate | assist | detect | humanize | save | send
  mode:      varchar("mode",   { length: 8  }),
  modelUsed: text("model_used"),
  latencyMs: integer("latency_ms"),
  success:   boolean("success").default(true).notNull(),
  errorMsg:  text("error_msg"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type EmailWriterUsageLog = typeof emailWriterUsageLogs.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// Google Sync (Gmail + Calendar → Memory Calendar auto-import)
// ─────────────────────────────────────────────────────────────────────────────

export const googleSyncConnections = pgTable("google_sync_connections", {
  id:                   serial("id").primaryKey(),
  ownerUserId:          integer("owner_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  email:                text("email").notNull(),
  refreshToken:         text("refresh_token").notNull(),
  accessToken:          text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  scopes:               text("scopes").array().default([]).notNull(),
  syncGmail:            boolean("sync_gmail").default(true).notNull(),
  syncCalendar:         boolean("sync_calendar").default(true).notNull(),
  calendarId:           text("calendar_id").default("primary").notNull(),
  lastGmailSyncAt:      timestamp("last_gmail_sync_at"),
  lastCalendarSyncAt:   timestamp("last_calendar_sync_at"),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
  updatedAt:            timestamp("updated_at").defaultNow().notNull(),
});
export type GoogleSyncConnection = typeof googleSyncConnections.$inferSelect;

export const googleSyncPendingItems = pgTable("google_sync_pending_items", {
  id:           serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => googleSyncConnections.id, { onDelete: "cascade" }).notNull(),
  ownerUserId:  integer("owner_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  source:       varchar("source", { length: 16 }).notNull(), // "gmail" | "calendar"
  externalId:   text("external_id").notNull(),               // message ID or event ID
  title:        text("title").notNull(),
  suggestedDate: timestamp("suggested_date"),
  location:     text("location"),
  description:  text("description"),
  rawSnippet:   text("raw_snippet"),
  calendarEventId: text("calendar_event_id"),               // after auto-import
  status:       varchar("status", { length: 16 }).default("pending").notNull(), // pending | approved | rejected
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});
export type GoogleSyncPendingItem = typeof googleSyncPendingItems.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// City Passport Stamps (persistent journey progress)
// ─────────────────────────────────────────────────────────────────────────────

export const userJourneyStamps = pgTable("user_journey_stamps", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  waypointId:  integer("waypoint_id").notNull(), // matches WAYPOINTS[].id (1-5)
  visitedAt:   timestamp("visited_at").defaultNow().notNull(),
}, (t) => [unique().on(t.userId, t.waypointId)]);

export type UserJourneyStamp = typeof userJourneyStamps.$inferSelect;
export const insertUserJourneyStampSchema = createInsertSchema(userJourneyStamps).omit({ id: true, visitedAt: true });
export type InsertUserJourneyStamp = z.infer<typeof insertUserJourneyStampSchema>;
