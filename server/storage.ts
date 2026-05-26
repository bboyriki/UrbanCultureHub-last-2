import { 
  users, User, InsertUser,
  locations, Location, InsertLocation,
  events, Event, InsertEvent,
  rsvps, Rsvp, InsertRsvp,
  posts, Post, InsertPost,
  comments, Comment, InsertComment,
  likes, Like, InsertLike, 
  savedLocations, SavedLocation, InsertSavedLocation,
  tickets, Ticket, InsertTicket,
  memberships, Membership, InsertMembership,
  products, Product, InsertProduct,
  orders, Order, InsertOrder,
  orderItems, OrderItem, InsertOrderItem,
  adminActions, AdminAction, InsertAdminAction,
  contentFlags, ContentFlag, InsertContentFlag,
  userBlocks, UserBlock, InsertUserBlock,
  userFollows, UserFollow, InsertUserFollow,
  contentFilters, ContentFilter, InsertContentFilter,
  blockedKeywords, BlockedKeyword, InsertBlockedKeyword,
  eventTicketTypes, EventTicketType, InsertEventTicketType,
  eventCategories,
  dancerRegistrations,
  battleMatchups,
  battleJudges,
  battleVotes,
  explorePageImages, ExplorePageImage, InsertExplorePageImage,
  adminNotifications, AdminNotification, InsertAdminNotification,
  userNotifications, UserNotification, InsertUserNotification,
  systemStats, SystemStat, InsertSystemStat,
  services, Service, InsertService,
  availability, Availability, InsertAvailability,
  serviceBookings, ServiceBooking, InsertServiceBooking,
  serviceReviews, ServiceReview, InsertServiceReview,
  serviceTimeSlots, ServiceTimeSlot, InsertServiceTimeSlot,
  providerSkills, ProviderSkill, InsertProviderSkill,
  achievements, Achievement, InsertAchievement,
  userAchievements, UserAchievement, InsertUserAchievement,
  ContactSubmission, InsertContactSubmission, contactSubmissions,
  legalContent, LegalContent, InsertLegalContent,
  legalConsent, LegalConsent, InsertLegalConsent,
  dataDeletionRequests, DataDeletionRequest, InsertDataDeletionRequest,
  termsOfService, TermsOfService, InsertTermsOfService,
  chatConversations, chatParticipants, chatMessages, messageDeliveryStatus,
  ChatConversation, InsertChatConversation, ChatParticipant, InsertChatParticipant,
  ChatMessage, InsertChatMessage, MessageDeliveryStatus, InsertMessageDeliveryStatus,
  adminAiAssistant, AdminAiAssistant, InsertAdminAiAssistant,
  liveResultsViewers, LiveResultsViewer, InsertLiveResultsViewer,
  ContentFlagStatus, AdminActionType, TicketType, BookingStatus, ServiceCategory, ServiceType, AchievementType,
  NotificationType, TimeSlotStatus, RecurrenceType, ContentFilterLevel, ReportReasonType, MessageStatus,
  userSettings, UserSettings, InsertUserSettings,
  notificationPreferences, NotificationPreferences, InsertNotificationPreferences,
  loginSessions, LoginSession, InsertLoginSession,
  marketingCampaigns, MarketingCampaign, InsertMarketingCampaign,
  campaignRecipients, CampaignRecipient, InsertCampaignRecipient,
  CampaignStatus, AudienceType,
  trackingConsent, TrackingConsent, InsertTrackingConsent,
  webSessions, WebSession, InsertWebSession,
  pageViews, PageView, InsertPageView,
  interactionEvents, InteractionEvent, InsertInteractionEvent,
  conversionEvents, ConversionEvent, InsertConversionEvent,
  dailyAnalytics, DailyAnalytics,
  proximitySettings, ProximitySettings, InsertProximitySettings,
  userPresence, UserPresence, InsertUserPresence,
  userDiscoveries, UserDiscovery, InsertUserDiscovery,
  trustedContacts, TrustedContact, InsertTrustedContact,
  safetyBroadcasts, SafetyBroadcast, InsertSafetyBroadcast,
  fundingSources, FundingSource, InsertFundingSource,
  fundingOpportunities, FundingOpportunity, InsertFundingOpportunity,
  pushTokens, pushNotificationLogs, PushNotificationLog,
  reels, Reel, InsertReel, reelLikes, reelComments, ReelComment, InsertReelComment,
  savedEvents, SavedEvent,
  eventPolls, EventPoll, InsertEventPoll,
  pollVotes, PollVote, InsertPollVote,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, gt, lt, isNull, asc, sql, not, or, inArray, ne as notEq, ilike, count } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

// Event filter/sort type
export interface EventFilters {
  category?: string;
  city?: string;
  priceModel?: "free" | "paid" | "from";
  kidFriendly?: boolean;
  familyFriendly?: boolean;
  isIndoor?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  mood?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: "newest" | "soonest" | "popular" | "price_asc" | "price_desc";
  limit?: number;
  offset?: number;
}

// Interface for all storage operations
export interface IStorage {
  // Admin AI Assistant
  createAdminAiAssistant(data: InsertAdminAiAssistant): Promise<AdminAiAssistant>;
  getAdminAiAssistant(id: number): Promise<AdminAiAssistant | undefined>;
  updateAdminAiAssistant(id: number, data: Partial<AdminAiAssistant>): Promise<AdminAiAssistant | undefined>;
  deleteAdminAiAssistant(id: number): Promise<boolean>;
  getAdminAiAssistantHistory(userId: number, limit?: number): Promise<AdminAiAssistant[]>;
  markAdminAiAssistantComplete(id: number): Promise<AdminAiAssistant | undefined>;
  countAdminAiAssistantRequests(userId: number, timeWindow: number): Promise<number>;
  
  // Contact Submissions
  createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission>;
  getContactSubmission(id: number): Promise<ContactSubmission | undefined>;
  getAllContactSubmissions(): Promise<ContactSubmission[]>;
  getUnresolvedContactSubmissions(): Promise<ContactSubmission[]>;
  getContactSubmissionsByStatus(status: string): Promise<ContactSubmission[]>; 
  updateContactSubmission(id: number, data: Partial<ContactSubmission>): Promise<ContactSubmission | undefined>;
  resolveContactSubmission(id: number, adminId: number, notes?: string): Promise<ContactSubmission | undefined>;
  
  // Chat System
  // Conversations
  createChatConversation(data: InsertChatConversation): Promise<ChatConversation>;
  getChatConversation(id: number): Promise<ChatConversation | undefined>;
  updateChatConversation(id: number, data: Partial<ChatConversation>): Promise<ChatConversation | undefined>;
  deleteChatConversation(id: number): Promise<boolean>;
  getUserConversations(userId: number): Promise<any[]>; // Returns formatted conversation data with participants
  getChatConversationWithDetails(id: number): Promise<any | undefined>; // Returns conversation with participants
  findDirectConversation(userId1: number, userId2: number): Promise<any | undefined>;
  
  // Participants
  createChatParticipant(data: InsertChatParticipant): Promise<ChatParticipant>;
  getChatParticipant(conversationId: number, userId: number): Promise<ChatParticipant | undefined>;
  updateChatParticipant(conversationId: number, userId: number, data: Partial<ChatParticipant>): Promise<ChatParticipant | undefined>;
  removeChatParticipant(conversationId: number, userId: number): Promise<boolean>;
  getChatParticipants(conversationId: number): Promise<ChatParticipant[]>;
  getChatAdmins(conversationId: number): Promise<ChatParticipant[]>;
  isConversationParticipant(conversationId: number, userId: number): Promise<boolean>;
  
  // Messages
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  getChatMessage(id: number): Promise<ChatMessage | undefined>;
  updateChatMessage(id: number, data: Partial<ChatMessage>): Promise<ChatMessage | undefined>;
  deleteChatMessage(id: number): Promise<boolean>;
  getChatMessages(conversationId: number, page?: number, limit?: number): Promise<any[]>; // Returns messages with sender info
  
  // Message Delivery Status
  createMessageDelivery(data: InsertMessageDeliveryStatus): Promise<MessageDeliveryStatus>;
  getMessageDeliveryStatus(messageId: number, userId: number): Promise<MessageDeliveryStatus | undefined>;
  updateMessageDeliveryStatus(messageId: number, userId: number, data: Partial<MessageDeliveryStatus>): Promise<MessageDeliveryStatus | undefined>;
  markMessageAsRead(messageId: number, userId: number): Promise<MessageDeliveryStatus | undefined>;
  
  // User Search for Chat
  searchUsers(query: string): Promise<User[]>;
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByFirebaseUid(uid: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getActiveUsers(): Promise<User[]>;
  getEventOrganizers(): Promise<User[]>;
  
  // User Follows
  followUser(follow: InsertUserFollow): Promise<UserFollow>;
  unfollowUser(followerId: number, followedId: number): Promise<boolean>;
  getFollowersByUserId(userId: number): Promise<UserFollow[]>;
  getFollowingByUserId(userId: number): Promise<UserFollow[]>;
  isUserFollowing(followerId: number, followedId: number): Promise<boolean>;
  getFollowStatus(followerId: number, followedId: number): Promise<UserFollow | undefined>;
  updateFollowStatus(id: number, status: string): Promise<UserFollow | undefined>;
  
  // Legal Content
  getLegalContent(id: number): Promise<LegalContent | undefined>;
  getLegalContentByType(type: string, language?: string): Promise<LegalContent | undefined>;
  getActiveLegalContentByType(type: string, language?: string): Promise<LegalContent | undefined>;
  getAllLegalContent(): Promise<LegalContent[]>;
  createLegalContent(content: InsertLegalContent): Promise<LegalContent>;
  updateLegalContent(id: number, data: Partial<LegalContent>): Promise<LegalContent | undefined>;
  publishLegalContent(id: number): Promise<LegalContent | undefined>;
  
  // Terms of Service
  getTermsOfService(id: number): Promise<TermsOfService | undefined>;
  getActiveTermsOfService(): Promise<TermsOfService | undefined>;
  getAllTermsOfService(): Promise<TermsOfService[]>;
  createTermsOfService(terms: InsertTermsOfService): Promise<TermsOfService>;
  updateTermsOfService(id: number, data: Partial<TermsOfService>): Promise<TermsOfService | undefined>;
  activateTermsOfService(id: number): Promise<TermsOfService | undefined>;
  deactivateTermsOfService(id: number): Promise<TermsOfService | undefined>;
  
  // Legal Consent
  getUserConsent(userId: number): Promise<LegalConsent | undefined>;
  recordUserConsent(consent: InsertLegalConsent): Promise<LegalConsent>;
  updateUserConsent(userId: number, data: Partial<LegalConsent>): Promise<LegalConsent | undefined>;
  
  // Data Deletion Requests
  createDataDeletionRequest(request: InsertDataDeletionRequest): Promise<DataDeletionRequest>;
  getDataDeletionRequest(id: number): Promise<DataDeletionRequest | undefined>;
  getAllDataDeletionRequests(): Promise<DataDeletionRequest[]>;
  getDataDeletionRequestsByUser(userId: number): Promise<DataDeletionRequest[]>;
  getDataDeletionRequestsByStatus(status: string): Promise<DataDeletionRequest[]>;
  updateDataDeletionRequest(id: number, request: Partial<DataDeletionRequest>): Promise<DataDeletionRequest | undefined>;
  processDataDeletionRequest(id: number, adminId: number, approved: boolean, notes?: string): Promise<DataDeletionRequest | undefined>;
  
  // Locations
  getLocation(id: number): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: number, data: Partial<Location>): Promise<Location | undefined>;
  getAllLocations(): Promise<Location[]>;
  getVisibleLocations(): Promise<Location[]>; // Only approved and visible spots
  getPendingLocations(): Promise<Location[]>; // Pending approval spots
  approveLocation(id: number, adminId: number): Promise<Location | undefined>;
  rejectLocation(id: number, adminId: number, reason: string): Promise<Location | undefined>;
  toggleLocationVisibility(id: number, isVisible: boolean): Promise<Location | undefined>;
  getSavedLocationsByUser(userId: number): Promise<Location[]>;
  saveLocation(savedLocation: InsertSavedLocation): Promise<SavedLocation>;
  deleteLocation(id: number): Promise<boolean>;
  getLocationsByCreator(userId: number): Promise<Location[]>;
  
  // Events
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<Event>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;
  getAllEvents(): Promise<Event[]>;
  getFilteredEvents(filters: EventFilters): Promise<Event[]>;
  getFeaturedEvents(): Promise<Event[]>;
  getTrendingEvents(): Promise<Event[]>;
  getEventsByCategory(category: string): Promise<Event[]>;
  getEventsByUser(userId: number): Promise<Event[]>;
  toggleSavedEvent(userId: number, eventId: number): Promise<{ saved: boolean }>;
  getSavedEvents(userId: number): Promise<Event[]>;
  getSavedEventIds(userId: number): Promise<number[]>;
  
  // RSVPs
  getRsvp(id: number): Promise<Rsvp | undefined>;
  getRsvpByEventAndUser(eventId: number, userId: number): Promise<Rsvp | undefined>;
  createRsvp(rsvp: InsertRsvp): Promise<Rsvp>;
  updateRsvp(id: number, rsvp: Partial<Rsvp>): Promise<Rsvp | undefined>;
  getRsvpsByEvent(eventId: number): Promise<Rsvp[]>;
  getRsvpsByUser(userId: number): Promise<Rsvp[]>;
  
  // Posts
  getPost(id: number): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: number, post: Partial<Post>): Promise<Post | undefined>;
  deletePost(id: number): Promise<boolean>;
  getAllPosts(): Promise<Post[]>;
  getPostsByUser(userId: number): Promise<Post[]>;
  
  // Comments
  getComment(id: number): Promise<Comment | undefined>;
  createComment(comment: InsertComment): Promise<Comment>;
  getCommentsByPost(postId: number): Promise<Comment[]>;
  updateComment(id: number, comment: Partial<Comment>): Promise<Comment | undefined>;
  deleteComment(id: number): Promise<boolean>;
  getCommentsByUser(userId: number): Promise<Comment[]>;
  getCommentReplies(parentCommentId: number): Promise<Comment[]>;
  
  // Likes
  getLike(id: number): Promise<Like | undefined>;
  getLikeByPostAndUser(postId: number, userId: number): Promise<Like | undefined>;
  createLike(like: InsertLike): Promise<Like>;
  deleteLike(id: number): Promise<void>;
  getLikesByPost(postId: number): Promise<Like[]>;
  
  // Tickets
  getTicket(id: number): Promise<Ticket | undefined>;
  getTicketByPaymentIntentId(paymentIntentId: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  getTicketsByEvent(eventId: number): Promise<Ticket[]>;
  getTicketsByUser(userId: number): Promise<Ticket[]>;
  getAllTickets(): Promise<Ticket[]>;
  updateTicket(id: number, ticket: Partial<Ticket>): Promise<Ticket | undefined>;
  validateTicket(qrCode: string): Promise<Ticket | undefined>;
  deleteTicket(id: number): Promise<boolean>;
  addTicketToUser(userId: number, ticketId: number): Promise<void>;
  updatePaymentIntent(id: string, data: any): Promise<any>;
  
  // Memberships
  getMembership(id: number): Promise<Membership | undefined>;
  getMembershipByUser(userId: number): Promise<Membership | undefined>;
  getMembershipByStripeSubscriptionId(subscriptionId: string): Promise<Membership | undefined>;
  createMembership(membership: InsertMembership): Promise<Membership>;
  updateMembership(id: number, membership: Partial<Membership>): Promise<Membership | undefined>;
  cancelMembership(id: number): Promise<void>;
  getAllMemberships(): Promise<Membership[]>;
  getAllMembershipsWithUserData(): Promise<any[]>;
  
  // Products
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<Product>): Promise<Product | undefined>;
  getAllProducts(includeDeleted?: boolean): Promise<Product[]>;
  getProductsByCategory(category: string, includeDeleted?: boolean): Promise<Product[]>;
  getProductsBySeller(sellerId: number, includeDeleted?: boolean): Promise<Product[]>;
  
  // Orders
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order | undefined>;
  getOrdersByBuyer(buyerId: number): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  
  // Order Items
  getOrderItem(id: number): Promise<OrderItem | undefined>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  getOrderItemsByOrder(orderId: number): Promise<OrderItem[]>;
  
  // Admin Actions
  createAdminAction(action: InsertAdminAction): Promise<AdminAction>;
  getAdminAction(id: number): Promise<AdminAction | undefined>;
  getAdminActionsByAdmin(adminId: number): Promise<AdminAction[]>;
  getAdminActionsByType(actionType: string): Promise<AdminAction[]>;
  getAllAdminActions(): Promise<AdminAction[]>;
  
  // User Management Admin Functions
  approveUser(userId: number, adminId: number): Promise<User | undefined>;
  rejectUser(userId: number, adminId: number): Promise<User | undefined>;
  suspendUser(userId: number, adminId: number): Promise<User | undefined>;
  deleteUser(userId: number, adminId: number): Promise<void>;
  restoreUser(userId: number, adminId: number): Promise<User | undefined>;
  
  // Event Management Admin Functions
  approveEvent(eventId: number, adminId: number): Promise<Event | undefined>;
  rejectEvent(eventId: number, adminId: number): Promise<Event | undefined>;
  modifyEvent(eventId: number, adminId: number, event: Partial<Event>): Promise<Event | undefined>;
  
  // Content Moderation
  createContentFlag(flag: InsertContentFlag): Promise<ContentFlag>;
  getContentFlag(id: number): Promise<ContentFlag | undefined>;
  getPendingContentFlags(): Promise<ContentFlag[]>;
  reviewContentFlag(id: number, reviewerId: number, status: string, notes?: string): Promise<ContentFlag | undefined>;
  getContentFlagsByStatus(status: string): Promise<ContentFlag[]>;
  getContentFlagsByReporter(reporterId: number): Promise<ContentFlag[]>;
  getContentFlagsByContent(contentType: string, contentId: number): Promise<ContentFlag[]>;
  
  // User Blocks
  createUserBlock(block: InsertUserBlock): Promise<UserBlock>;
  getUserBlock(id: number): Promise<UserBlock | undefined>;
  getUserBlockByUsers(blockerId: number, blockedId: number): Promise<UserBlock | undefined>;
  getUserBlocksByBlocker(blockerId: number): Promise<UserBlock[]>;
  getUserBlocksByBlocked(blockedId: number): Promise<UserBlock[]>;
  deleteUserBlock(id: number): Promise<boolean>;
  isUserBlocked(userId: number, targetUserId: number): Promise<boolean>;
  
  // Content Filters
  createContentFilter(filter: InsertContentFilter): Promise<ContentFilter>;
  getContentFilter(id: number): Promise<ContentFilter | undefined>;
  getContentFilterByUser(userId: number): Promise<ContentFilter | undefined>;
  updateContentFilter(id: number, filter: Partial<ContentFilter>): Promise<ContentFilter | undefined>;
  
  // Blocked Keywords
  createBlockedKeyword(keyword: InsertBlockedKeyword): Promise<BlockedKeyword>;
  getBlockedKeyword(id: number): Promise<BlockedKeyword | undefined>;
  getBlockedKeywordByText(keyword: string): Promise<BlockedKeyword | undefined>;
  getBlockedKeywordsByCategory(category: string): Promise<BlockedKeyword[]>;
  getActiveBlockedKeywords(): Promise<BlockedKeyword[]>;
  updateBlockedKeyword(id: number, keyword: Partial<BlockedKeyword>): Promise<BlockedKeyword | undefined>;
  toggleBlockedKeywordStatus(id: number): Promise<BlockedKeyword | undefined>;
  
  // Content Filtering Functions
  filterContent(content: string, filterLevel?: string): Promise<{filtered: string, hasViolations: boolean, violations: string[]}>;
  isContentAllowed(content: string, filterLevel?: string): Promise<boolean>;
  
  // Explore Page Images
  getExplorePageImage(id: number): Promise<ExplorePageImage | undefined>;
  getExplorePageImages(): Promise<ExplorePageImage[]>;
  getExplorePageImagesBySection(section: string): Promise<ExplorePageImage[]>;
  createExplorePageImage(image: InsertExplorePageImage): Promise<ExplorePageImage>;
  updateExplorePageImage(id: number, updates: Partial<InsertExplorePageImage>): Promise<ExplorePageImage | undefined>;
  deleteExplorePageImage(id: number): Promise<ExplorePageImage | undefined>;
  
  // Event Ticket Types
  createEventTicketType(ticketType: InsertEventTicketType): Promise<EventTicketType>;
  getEventTicketType(id: number): Promise<EventTicketType | undefined>;
  getEventTicketTypesByEvent(eventId: number): Promise<EventTicketType[]>;
  updateEventTicketType(id: number, ticketType: Partial<EventTicketType>): Promise<EventTicketType | undefined>;
  deleteEventTicketType(id: number): Promise<boolean>;
  
  // Admin Notifications
  createAdminNotification(notification: InsertAdminNotification): Promise<AdminNotification>;
  getAdminNotification(id: number): Promise<AdminNotification | undefined>;
  getAdminNotificationsByUser(userId: number): Promise<AdminNotification[]>;
  markAdminNotificationAsRead(id: number): Promise<AdminNotification | undefined>;
  getUnreadAdminNotificationsByUser(userId: number): Promise<AdminNotification[]>;
  
  // User Notifications
  createUserNotification(notification: InsertUserNotification): Promise<UserNotification>;
  getUserNotification(id: number): Promise<UserNotification | undefined>;
  getUserNotificationsByUser(userId: number): Promise<UserNotification[]>;
  getUnreadUserNotificationsByUser(userId: number): Promise<UserNotification[]>;
  markUserNotificationAsRead(id: number): Promise<UserNotification | undefined>;
  markUserNotificationAsSeen(id: number): Promise<UserNotification | undefined>;
  markAllUserNotificationsAsRead(userId: number): Promise<number>;
  markAllUserNotificationsAsSeen(userId: number): Promise<number>;
  deleteUserNotification(id: number): Promise<boolean>;
  
  // System Stats
  createSystemStat(stat: InsertSystemStat): Promise<SystemStat>;
  getLatestSystemStats(): Promise<SystemStat | undefined>;
  getSystemStatsByDateRange(startDate: Date, endDate: Date): Promise<SystemStat[]>;
  updateSystemStat(id: number, data: Partial<SystemStat>): Promise<SystemStat | undefined>;
  updateDailyStats(): Promise<SystemStat>;
  getRealTimeAdminStats(): Promise<{
    totalUsers: number;
    newUsers: number;
    activeEvents: number;
    pendingEvents: number;
    totalPosts: number;
    totalComments: number;
    totalLikes: number;
    totalRsvps: number;
    flaggedContent: number;
    totalRevenue: number;
    ticketRevenue: number;
    serviceRevenue: number;
    ticketsSold: number;
  }>;
  getRevenueForPeriod(startDate: Date, endDate: Date): Promise<number>;
  
  // Services - Talent Marketplace
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<Service>): Promise<Service | undefined>;
  deleteService(id: number): Promise<boolean>;
  getAllServices(): Promise<Service[]>;
  getServicesByCategory(category: string): Promise<Service[]>;
  getServicesByProvider(providerId: number): Promise<Service[]>;
  getServicesByType(type: string): Promise<Service[]>;
  
  // Provider Availability
  getAvailability(id: number): Promise<Availability | undefined>;
  createAvailability(availability: InsertAvailability): Promise<Availability>;
  updateAvailability(id: number, availability: Partial<Availability>): Promise<Availability | undefined>;
  getAvailabilityByProvider(providerId: number): Promise<Availability[]>;
  getAvailabilityByService(serviceId: number): Promise<Availability[]>;
  getAvailabilityInRange(providerId: number, startDate: Date, endDate: Date): Promise<Availability[]>;
  
  // Service Time Slots
  getServiceTimeSlot(id: number): Promise<ServiceTimeSlot | undefined>;
  createServiceTimeSlot(timeSlot: InsertServiceTimeSlot): Promise<ServiceTimeSlot>;
  updateServiceTimeSlot(id: number, timeSlot: Partial<InsertServiceTimeSlot>): Promise<ServiceTimeSlot | undefined>;
  getServiceTimeSlotsByService(serviceId: number): Promise<ServiceTimeSlot[]>;
  getServiceTimeSlotsByProvider(providerId: number): Promise<ServiceTimeSlot[]>;
  getServiceTimeSlotsByDate(providerId: number, date: Date): Promise<ServiceTimeSlot[]>;
  getAvailableServiceTimeSlots(serviceId: number): Promise<ServiceTimeSlot[]>;
  updateServiceTimeSlotStatus(id: number, status: string): Promise<ServiceTimeSlot | undefined>;
  incrementCurrentBookings(id: number): Promise<ServiceTimeSlot | undefined>;
  decrementCurrentBookings(id: number): Promise<ServiceTimeSlot | undefined>;
  deleteServiceTimeSlot(id: number): Promise<boolean>;
  
  // Service Bookings
  getServiceBooking(id: number): Promise<ServiceBooking | undefined>;
  createServiceBooking(booking: InsertServiceBooking): Promise<ServiceBooking>;
  updateServiceBooking(id: number, booking: Partial<ServiceBooking>): Promise<ServiceBooking | undefined>;
  deleteServiceBooking(id: number): Promise<boolean>;
  getServiceBookingsByUser(userId: number): Promise<ServiceBooking[]>;
  getServiceBookingsByProvider(providerId: number): Promise<ServiceBooking[]>;
  getServiceBookingsByService(serviceId: number): Promise<ServiceBooking[]>;
  getServiceBookingsByStatus(status: string): Promise<ServiceBooking[]>;
  getServiceBookingsByPaymentIntentId(paymentIntentId: string): Promise<ServiceBooking[]>;
  getAllServiceBookings(): Promise<ServiceBooking[]>;
  approveServiceBooking(id: number): Promise<ServiceBooking | undefined>;
  rejectServiceBooking(id: number, message?: string): Promise<ServiceBooking | undefined>;
  completeServiceBooking(id: number): Promise<ServiceBooking | undefined>;
  cancelServiceBooking(id: number, message?: string): Promise<ServiceBooking | undefined>;
  
  // Service Reviews
  getServiceReview(id: number): Promise<ServiceReview | undefined>;
  createServiceReview(review: InsertServiceReview): Promise<ServiceReview>;
  getServiceReviewsByService(serviceId: number): Promise<ServiceReview[]>;
  getServiceReviewsByProvider(providerId: number): Promise<ServiceReview[]>;
  getServiceReviewsByUser(userId: number): Promise<ServiceReview[]>;
  getServiceReviewsByBooking(bookingId: number): Promise<ServiceReview[]>;
  
  // Provider Skills
  getProviderSkill(id: number): Promise<ProviderSkill | undefined>;
  createProviderSkill(skill: InsertProviderSkill): Promise<ProviderSkill>;
  getProviderSkillsByProvider(providerId: number): Promise<ProviderSkill[]>;
  getProviderSkillsByCategory(category: string): Promise<ProviderSkill[]>;
  verifyProviderSkill(id: number): Promise<ProviderSkill | undefined>;
  
  // Achievements
  getAchievement(id: number): Promise<Achievement | undefined>;
  getAllAchievements(): Promise<Achievement[]>;
  getAchievementsByType(type: string): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  
  // User Achievements
  getUserAchievement(id: number): Promise<UserAchievement | undefined>;
  getUserAchievementsByUser(userId: number): Promise<UserAchievement[]>;
  getUserAchievementByUserAndAchievement(userId: number, achievementId: number): Promise<UserAchievement | undefined>;
  createUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement>;
  updateUserAchievement(id: number, data: Partial<UserAchievement>): Promise<UserAchievement | undefined>;
  incrementUserAchievementProgress(userId: number, achievementId: number, amount?: number): Promise<UserAchievement | undefined>;
  completeUserAchievement(userId: number, achievementId: number): Promise<UserAchievement | undefined>;
  
  // Achievement Processing
  processEventAttendance(userId: number, eventId: number): Promise<UserAchievement[]>;
  processTicketPurchase(userId: number, eventId: number): Promise<UserAchievement[]>;
  checkAndUpdateTicketMilestones(userId: number): Promise<UserAchievement[]>;
  checkAndUpdateCategoryCollection(userId: number): Promise<UserAchievement[]>;
  
  // Friend functionality removed
  
  // Payment Intent Management
  updatePaymentIntent(id: string, data: any): Promise<any>;
  
  // Live Results Viewers - for projector display of battle results
  createLiveResultsViewer(data: InsertLiveResultsViewer): Promise<LiveResultsViewer>;
  getLiveResultsViewersByEvent(eventId: number): Promise<LiveResultsViewer[]>;
  getLiveResultsViewerByUserAndEvent(userId: number, eventId: number): Promise<LiveResultsViewer | undefined>;
  revokeLiveResultsViewer(id: number): Promise<boolean>;
  isUserLiveResultsViewer(userId: number, eventId: number): Promise<boolean>;
  
  // User Settings
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings | undefined>;
  
  // Notification Preferences
  getNotificationPreferences(userId: number): Promise<NotificationPreferences | undefined>;
  createNotificationPreferences(prefs: InsertNotificationPreferences): Promise<NotificationPreferences>;
  updateNotificationPreferences(userId: number, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences | undefined>;
  
  // Login Sessions
  createLoginSession(session: InsertLoginSession): Promise<LoginSession>;
  getLoginSession(id: number): Promise<LoginSession | undefined>;
  getLoginSessionByToken(token: string): Promise<LoginSession | undefined>;
  getLoginSessionsByUser(userId: number): Promise<LoginSession[]>;
  getActiveLoginSessionsByUser(userId: number): Promise<LoginSession[]>;
  updateLoginSessionActivity(id: number): Promise<LoginSession | undefined>;
  revokeLoginSession(id: number): Promise<LoginSession | undefined>;
  revokeAllUserSessions(userId: number, exceptSessionId?: number): Promise<number>;
  
  // Marketing Campaigns
  createMarketingCampaign(campaign: InsertMarketingCampaign): Promise<MarketingCampaign>;
  getMarketingCampaign(id: number): Promise<MarketingCampaign | undefined>;
  updateMarketingCampaign(id: number, campaign: Partial<MarketingCampaign>): Promise<MarketingCampaign | undefined>;
  getAllMarketingCampaigns(): Promise<MarketingCampaign[]>;
  getMarketingCampaignsByStatus(status: string): Promise<MarketingCampaign[]>;
  deleteMarketingCampaign(id: number): Promise<boolean>;
  
  // Campaign Recipients
  createCampaignRecipient(recipient: InsertCampaignRecipient): Promise<CampaignRecipient>;
  getCampaignRecipients(campaignId: number): Promise<CampaignRecipient[]>;
  updateCampaignRecipientStatus(id: number, status: string, errorMessage?: string): Promise<CampaignRecipient | undefined>;
  getCampaignRecipientsByStatus(campaignId: number, status: string): Promise<CampaignRecipient[]>;
  
  // Follow System Enhancements
  getFollowersCount(userId: number): Promise<number>;
  getFollowingCount(userId: number): Promise<number>;
  getFollowersWithDetails(userId: number): Promise<any[]>;
  getFollowingWithDetails(userId: number): Promise<any[]>;
  getPendingFollowRequests(userId: number): Promise<any[]>;
  acceptFollowRequest(followId: number): Promise<UserFollow | undefined>;
  rejectFollowRequest(followId: number): Promise<boolean>;
  
  // Chat functionality removed

  // Proximity & Matching
  getProximitySettings(userId: number): Promise<ProximitySettings | undefined>;
  upsertProximitySettings(userId: number, settings: Partial<InsertProximitySettings>): Promise<ProximitySettings>;
  updateUserPresence(userId: number, lat: number, lng: number, city?: string): Promise<UserPresence>;
  deleteUserPresence(userId: number): Promise<void>;
  getNearbyUsers(userId: number, coarseLat: string, coarseLng: string, radiusKm: number, visibilityMode?: string): Promise<any[]>;

  // Discovery
  recordDiscoveryAction(userId: number, discoveredUserId: number, action: string): Promise<any>;
  getDiscoverySuggestions(userId: number, coarseLat: string, coarseLng: string, radiusKm: number, limit?: number): Promise<any[]>;

  // Trusted Contacts
  getTrustedContacts(userId: number): Promise<any[]>;
  addTrustedContact(userId: number, contactUserId: number): Promise<TrustedContact>;
  confirmTrustedContact(contactId: number, contactUserId: number): Promise<TrustedContact | undefined>;
  removeTrustedContact(contactId: number, userId: number): Promise<boolean>;

  // Safety Broadcasts
  createSafetyBroadcast(broadcast: InsertSafetyBroadcast): Promise<SafetyBroadcast>;
  getActiveSafetyBroadcasts(userId: number): Promise<SafetyBroadcast[]>;
  deactivateSafetyBroadcast(broadcastId: number, userId: number): Promise<boolean>;

  // Funding, Subsidy & Sponsorship Intelligence
  getFundingSources(): Promise<FundingSource[]>;
  getFundingSource(id: number): Promise<FundingSource | undefined>;
  createFundingSource(source: InsertFundingSource): Promise<FundingSource>;
  updateFundingSource(id: number, data: Partial<FundingSource>): Promise<FundingSource | undefined>;
  deleteFundingSource(id: number): Promise<boolean>;
  getFundingOpportunities(filters?: { status?: string; category?: string; fundingType?: string; region?: string; search?: string; limit?: number; offset?: number }): Promise<FundingOpportunity[]>;
  getFundingOpportunity(id: number): Promise<FundingOpportunity | undefined>;
  createFundingOpportunity(opp: InsertFundingOpportunity): Promise<FundingOpportunity>;
  updateFundingOpportunity(id: number, data: Partial<FundingOpportunity>): Promise<FundingOpportunity | undefined>;
  deleteFundingOpportunity(id: number): Promise<boolean>;
  getFundingStats(): Promise<{ total: number; published: number; draft: number; expired: number; needsReview: number; duplicates: number }>;
  fundingDataExists(): Promise<boolean>;

  // Push notifications
  savePushToken(userId: number, token: string, platform?: string): Promise<void>;
  removePushToken(userId: number, token: string): Promise<void>;
  getPushTokensForUser(userId: number): Promise<string[]>;
  getAllPushDevices(): Promise<{ id: number; userId: number; token: string; platform: string; createdAt: Date; updatedAt: Date; user?: { displayName: string; email: string; profilePicture: string | null } }[]>;
  getPushDeviceStats(): Promise<{ total: number; ios: number; android: number; web: number; recentWeek: number }>;
  removePushTokenById(id: number): Promise<void>;
  logPushNotification(log: { sentBy: number; title: string; body: string; targetType: string; targetValue?: string; sentCount: number; failedCount: number; iconUrl?: string; actionUrl?: string }): Promise<PushNotificationLog>;
  getPushNotificationLogs(limit?: number): Promise<PushNotificationLog[]>;
  getAllUserIdsWithTokens(): Promise<number[]>;
  getUserIdsWithTokensBySegment(segment: string): Promise<number[]>;

  // Reels
  createReel(data: InsertReel): Promise<Reel>;
  getReel(id: number): Promise<Reel | undefined>;
  getReelsFeed(page?: number, limit?: number, requestingUserId?: number): Promise<any[]>;
  getUserReels(userId: number, requestingUserId?: number): Promise<any[]>;
  deleteReel(id: number): Promise<boolean>;
  incrementReelViews(id: number): Promise<void>;
  incrementReelShares(id: number): Promise<void>;
  toggleReelLike(reelId: number, userId: number): Promise<{ liked: boolean; likesCount: number }>;
  getReelComments(reelId: number): Promise<any[]>;
  toggleReelStatus(id: number, status: "active" | "disabled"): Promise<any>;
  adminGetAllReels(): Promise<any[]>;
  createReelComment(data: InsertReelComment): Promise<ReelComment>;
  deleteReelComment(id: number, userId: number): Promise<boolean>;

  // Back to the Street
  getBttsProgram(): Promise<any[]>;
  createBttsProgramItem(data: any): Promise<any>;
  updateBttsProgramItem(id: number, data: any): Promise<any>;
  deleteBttsProgramItem(id: number): Promise<boolean>;
  getBttsLineup(): Promise<any[]>;
  createBttsLineupMember(data: any): Promise<any>;
  updateBttsLineupMember(id: number, data: any): Promise<any>;
  deleteBttsLineupMember(id: number): Promise<boolean>;
  getBttsBattles(): Promise<any[]>;
  createBttsBattle(data: any): Promise<any>;
  updateBttsBattle(id: number, data: any): Promise<any>;
  deleteBttsBattle(id: number): Promise<boolean>;
  getBttsGallery(): Promise<any[]>;
  createBttsGalleryItem(data: any): Promise<any>;
  updateBttsGalleryItem(id: number, data: any): Promise<any>;
  deleteBttsGalleryItem(id: number): Promise<boolean>;
  // Founder Profile
  getFounderProfile(): Promise<import("@shared/schema").FounderProfile[]>;
  upsertFounderProfileSection(key: string, label: string, content: string, sortOrder?: number): Promise<import("@shared/schema").FounderProfile>;
  // AI Training Entries
  getAiTrainingEntries(includeInactive?: boolean): Promise<import("@shared/schema").AiTrainingEntry[]>;
  getPublicAiTrainingEntries(): Promise<import("@shared/schema").AiTrainingEntry[]>;
  createAiTrainingEntry(data: import("@shared/schema").InsertAiTrainingEntry): Promise<import("@shared/schema").AiTrainingEntry>;
  updateAiTrainingEntry(id: number, data: Partial<import("@shared/schema").InsertAiTrainingEntry>): Promise<import("@shared/schema").AiTrainingEntry>;
  deleteAiTrainingEntry(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private locations: Map<number, Location>;
  private events: Map<number, Event>;
  private rsvps: Map<number, Rsvp>;
  private posts: Map<number, Post>;
  private comments: Map<number, Comment>;
  private likes: Map<number, Like>;
  private savedLocations: Map<number, SavedLocation>;
  private tickets: Map<number, Ticket>;
  private userFollows: Map<number, UserFollow>;
  private memberships: Map<number, Membership>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  private adminActions: Map<number, AdminAction>;
  private contentFlags: Map<number, ContentFlag>;
  private eventTicketTypes: Map<number, EventTicketType>;
  private adminNotifications: Map<number, AdminNotification>;
  private userNotifications: Map<number, UserNotification>;
  private systemStats: Map<number, SystemStat>;
  private services: Map<number, Service>;
  private availability: Map<number, Availability>;
  private serviceTimeSlots: Map<number, ServiceTimeSlot>;
  private serviceBookings: Map<number, ServiceBooking>;
  private serviceReviews: Map<number, ServiceReview>;
  private providerSkills: Map<number, ProviderSkill>;
  private legalConsents: Map<number, LegalConsent>;
  private dataDeletionRequests: Map<number, DataDeletionRequest>;
  private legalContents: Map<number, LegalContent>;
  private contactSubmissions: Map<number, ContactSubmission>;
  private userBlocks: Map<number, UserBlock>;
  private contentFilters: Map<number, ContentFilter>;
  private blockedKeywords: Map<number, BlockedKeyword>;
  private termsOfServices: Map<number, TermsOfService>;
  private explorePageImages: Map<number, ExplorePageImage>;
  // Chat-related properties removed
  
  private currentUserId: number;
  private currentLocationId: number;
  private currentEventId: number;
  private currentRsvpId: number;
  private currentPostId: number;
  private currentCommentId: number;
  private currentLikeId: number;
  private currentSavedLocationId: number;
  private currentTicketId: number;
  private currentMembershipId: number;
  private currentProductId: number;
  private currentOrderId: number;
  private currentOrderItemId: number;
  private currentAdminActionId: number;
  private currentContentFlagId: number;
  private currentEventTicketTypeId: number;
  private currentAdminNotificationId: number;
  private currentUserNotificationId: number;
  private currentSystemStatId: number;
  private currentServiceId: number;
  private currentAvailabilityId: number;
  private currentServiceTimeSlotId: number;
  private currentServiceBookingId: number;
  private currentServiceReviewId: number;
  private currentProviderSkillId: number;
  private currentLegalConsentId: number;
  private currentDataDeletionRequestId: number;
  private currentLegalContentId: number;
  private currentContactSubmissionId: number;
  private currentUserBlockId: number;
  private currentUserFollowId: number;
  private currentContentFilterId: number;
  private currentBlockedKeywordId: number;
  private currentTermsOfServiceId: number;
  private currentExplorePageImageId: number;
  private currentConversationId: number;
  private currentChatMessageId: number;
  private currentMessageDeliveryId: number;
  private currentConversationParticipantId: number;
  // Friend-related properties removed

  constructor() {
    this.users = new Map();
    this.locations = new Map();
    this.events = new Map();
    this.rsvps = new Map();
    this.posts = new Map();
    this.comments = new Map();
    this.likes = new Map();
    this.savedLocations = new Map();
    this.tickets = new Map();
    this.memberships = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.adminActions = new Map();
    this.contentFlags = new Map();
    this.eventTicketTypes = new Map();
    this.adminNotifications = new Map();
    this.userNotifications = new Map();
    this.systemStats = new Map();
    this.services = new Map();
    this.availability = new Map();
    this.serviceTimeSlots = new Map();
    this.serviceBookings = new Map();
    this.serviceReviews = new Map();
    this.providerSkills = new Map();
    this.legalConsents = new Map();
    this.dataDeletionRequests = new Map();
    this.legalContents = new Map();
    this.contactSubmissions = new Map();
    this.userBlocks = new Map();
    this.userFollows = new Map();
    this.contentFilters = new Map();
    this.blockedKeywords = new Map();
    this.termsOfServices = new Map();
    this.explorePageImages = new Map();
    // Chat-related Maps removed
    
    this.currentUserId = 1;
    this.currentLocationId = 1;
    this.currentEventId = 1;
    this.currentRsvpId = 1;
    this.currentPostId = 1;
    this.currentCommentId = 1;
    this.currentLikeId = 1;
    this.currentSavedLocationId = 1;
    this.currentTicketId = 1;
    this.currentMembershipId = 1;
    this.currentProductId = 1;
    this.currentOrderId = 1;
    this.currentOrderItemId = 1;
    this.currentAdminActionId = 1;
    this.currentContentFlagId = 1;
    this.currentEventTicketTypeId = 1;
    this.currentAdminNotificationId = 1;
    this.currentUserNotificationId = 1;
    this.currentSystemStatId = 1;
    this.currentServiceId = 1;
    this.currentAvailabilityId = 1;
    this.currentServiceTimeSlotId = 1;
    this.currentServiceBookingId = 1;
    this.currentServiceReviewId = 1;
    this.currentProviderSkillId = 1;
    this.currentLegalConsentId = 1;
    this.currentDataDeletionRequestId = 1;
    this.currentLegalContentId = 1;
    this.currentContactSubmissionId = 1;
    this.currentUserBlockId = 1;
    this.currentUserFollowId = 1;
    this.currentContentFilterId = 1;
    this.currentBlockedKeywordId = 1;
    this.currentTermsOfServiceId = 1;
    this.currentExplorePageImageId = 1;
    this.currentConversationId = 1;
    this.currentChatMessageId = 1;
    this.currentMessageDeliveryId = 1;
    this.currentConversationParticipantId = 1;
    // Friend-related IDs removed
  }

  // Contact Submission Methods
  async createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission> {
    const newSubmission: ContactSubmission = {
      id: this.currentContactSubmissionId++,
      name: submission.name,
      email: submission.email,
      subject: submission.subject,
      message: submission.message,
      category: submission.category,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      adminId: null,
      adminNotes: null,
      resolvedAt: null
    };
    this.contactSubmissions.set(newSubmission.id, newSubmission);
    return newSubmission;
  }

  async getContactSubmission(id: number): Promise<ContactSubmission | undefined> {
    return this.contactSubmissions.get(id);
  }

  async getAllContactSubmissions(): Promise<ContactSubmission[]> {
    return Array.from(this.contactSubmissions.values());
  }

  async getUnresolvedContactSubmissions(): Promise<ContactSubmission[]> {
    return Array.from(this.contactSubmissions.values()).filter(
      (submission) => submission.status === "pending"
    );
  }

  async getContactSubmissionsByStatus(status: string): Promise<ContactSubmission[]> {
    return Array.from(this.contactSubmissions.values()).filter(
      (submission) => submission.status === status
    );
  }

  async updateContactSubmission(id: number, data: Partial<ContactSubmission>): Promise<ContactSubmission | undefined> {
    const submission = this.contactSubmissions.get(id);
    if (!submission) return undefined;

    const updatedSubmission = {
      ...submission,
      ...data,
      updatedAt: new Date()
    };
    this.contactSubmissions.set(id, updatedSubmission);
    return updatedSubmission;
  }

  async resolveContactSubmission(id: number, adminId: number, notes?: string): Promise<ContactSubmission | undefined> {
    const submission = this.contactSubmissions.get(id);
    if (!submission) return undefined;

    const resolvedSubmission = {
      ...submission,
      status: "resolved",
      adminId,
      adminNotes: notes || null,
      resolvedAt: new Date(),
      updatedAt: new Date()
    };
    this.contactSubmissions.set(id, resolvedSubmission);
    return resolvedSubmission;
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }
  
  async getUserByFirebaseUid(uid: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.firebaseUid === uid
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = { 
      ...insertUser,
      password: insertUser.password || null,
      bio: insertUser.bio || null,
      profilePicture: insertUser.profilePicture || null,
      artType: insertUser.artType || null,
      organizationName: insertUser.organizationName || null,
      kvkNumber: insertUser.kvkNumber || null,
      location: insertUser.location || null,
      firebaseUid: insertUser.firebaseUid || null,
      id, 
      createdAt: now, 
      updatedAt: now,
      isVerified: false,
      isApproved: insertUser.role === "enthusiast" || insertUser.role === "artist",
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = {
      ...user,
      ...userData,
      updatedAt: new Date(),
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }

  async getActiveUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.status === 'active');
  }

  async getEventOrganizers(): Promise<User[]> {
    const eventOrganizers = new Set<number>();
    for (const event of this.events.values()) {
      if (event.organizerId) eventOrganizers.add(event.organizerId);
    }
    return Array.from(this.users.values()).filter(user => eventOrganizers.has(user.id));
  }

  async searchUsers(query: string): Promise<User[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.users.values()).filter(user => 
      user.displayName?.toLowerCase().includes(lowerQuery) ||
      user.email?.toLowerCase().includes(lowerQuery)
    );
  }

  // Location Methods
  async getLocation(id: number): Promise<Location | undefined> {
    return this.locations.get(id);
  }
  
  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const id = this.currentLocationId++;
    const now = new Date();
    const location: Location = {
      ...insertLocation,
      description: insertLocation.description || null,
      address: insertLocation.address || null,
      images: insertLocation.images || null,
      createdBy: insertLocation.createdBy || null,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.locations.set(id, location);
    return location;
  }
  
  async updateLocation(id: number, data: Partial<Location>): Promise<Location | undefined> {
    const existingLocation = this.locations.get(id);
    if (!existingLocation) {
      return undefined;
    }
    
    const updatedLocation: Location = {
      ...existingLocation,
      ...data,
      updatedAt: new Date()
    };
    
    this.locations.set(id, updatedLocation);
    return updatedLocation;
  }
  
  async getAllLocations(): Promise<Location[]> {
    return Array.from(this.locations.values());
  }
  
  async getVisibleLocations(): Promise<Location[]> {
    return Array.from(this.locations.values())
      .filter(loc => loc.isVisible === true && loc.approvalStatus === 'approved');
  }
  
  async getPendingLocations(): Promise<Location[]> {
    return Array.from(this.locations.values())
      .filter(loc => loc.approvalStatus === 'pending');
  }
  
  async approveLocation(id: number, adminId: number): Promise<Location | undefined> {
    const location = this.locations.get(id);
    if (!location) return undefined;
    
    const updatedLocation: Location = {
      ...location,
      approvalStatus: 'approved',
      approvedBy: adminId,
      approvedAt: new Date(),
      updatedAt: new Date()
    };
    
    this.locations.set(id, updatedLocation);
    return updatedLocation;
  }
  
  async rejectLocation(id: number, adminId: number, reason: string): Promise<Location | undefined> {
    const location = this.locations.get(id);
    if (!location) return undefined;
    
    const updatedLocation: Location = {
      ...location,
      approvalStatus: 'rejected',
      approvedBy: adminId,
      rejectionReason: reason,
      updatedAt: new Date()
    };
    
    this.locations.set(id, updatedLocation);
    return updatedLocation;
  }
  
  async toggleLocationVisibility(id: number, isVisible: boolean): Promise<Location | undefined> {
    const location = this.locations.get(id);
    if (!location) return undefined;
    
    const updatedLocation: Location = {
      ...location,
      isVisible,
      updatedAt: new Date()
    };
    
    this.locations.set(id, updatedLocation);
    return updatedLocation;
  }
  
  async getSavedLocationsByUser(userId: number): Promise<Location[]> {
    const savedLocationsIds = Array.from(this.savedLocations.values())
      .filter(sl => sl.userId === userId)
      .map(sl => sl.locationId);
      
    return Array.from(this.locations.values())
      .filter(location => savedLocationsIds.includes(location.id));
  }
  
  async saveLocation(insertSavedLocation: InsertSavedLocation): Promise<SavedLocation> {
    const id = this.currentSavedLocationId++;
    const now = new Date();
    const savedLocation: SavedLocation = {
      ...insertSavedLocation,
      userId: insertSavedLocation.userId || null,
      locationId: insertSavedLocation.locationId || null,
      id,
      createdAt: now,
    };
    this.savedLocations.set(id, savedLocation);
    return savedLocation;
  }
  
  async deleteLocation(id: number): Promise<boolean> {
    const exists = this.locations.has(id);
    if (!exists) return false;
    
    this.locations.delete(id);
    
    // Also delete related saved locations
    const savedToDelete = Array.from(this.savedLocations.values())
      .filter(sl => sl.locationId === id)
      .map(sl => sl.id);
    
    savedToDelete.forEach(slId => this.savedLocations.delete(slId));
    
    return true;
  }
  
  async getLocationsByCreator(userId: number): Promise<Location[]> {
    return Array.from(this.locations.values())
      .filter(location => location.createdBy === userId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
  }

  // Event Methods
  async getEvent(id: number): Promise<Event | undefined> {
    return this.events.get(id);
  }
  
  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    console.log("Storage createEvent received:", insertEvent);
    console.log("Date in storage:", insertEvent.date, "Type:", typeof insertEvent.date, insertEvent.date instanceof Date);
    
    const id = this.currentEventId++;
    const now = new Date();
    const event: Event = {
      ...insertEvent,
      description: insertEvent.description || null,
      latitude: insertEvent.latitude || null,
      longitude: insertEvent.longitude || null,
      image: insertEvent.image || null,
      price: insertEvent.price || null,
      organizerId: insertEvent.organizerId || null,
      id,
      createdAt: now,
      updatedAt: now,
    };
    
    console.log("Created event object:", event);
    console.log("Final date:", event.date, "Type:", typeof event.date, event.date instanceof Date);
    
    this.events.set(id, event);
    return event;
  }
  
  async getAllEvents(): Promise<Event[]> {
    return Array.from(this.events.values());
  }
  
  async getEventsByCategory(category: string): Promise<Event[]> {
    return Array.from(this.events.values())
      .filter(event => event.category === category);
  }
  
  async getEventsByUser(userId: number): Promise<Event[]> {
    return Array.from(this.events.values())
      .filter(event => event.organizerId === userId);
  }

  async getFilteredEvents(filters: EventFilters): Promise<Event[]> {
    return Array.from(this.events.values()).filter(e => e.status === "approved");
  }
  async getFeaturedEvents(): Promise<Event[]> {
    return Array.from(this.events.values()).filter(e => e.isFeatured && e.status === "approved");
  }
  async getTrendingEvents(): Promise<Event[]> {
    return Array.from(this.events.values()).filter(e => e.isTrending && e.status === "approved");
  }
  async toggleSavedEvent(_userId: number, _eventId: number): Promise<{ saved: boolean }> {
    return { saved: false };
  }
  async getSavedEvents(_userId: number): Promise<Event[]> {
    return [];
  }
  async getSavedEventIds(_userId: number): Promise<number[]> {
    return [];
  }

  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;
    
    // Format date properly if it exists in the eventData
    const processedEventData = { ...eventData };
    
    console.log("Memory storage: Raw event data for update:", processedEventData);
    
    // Handle date if present - ensure it's a proper Date object
    if (processedEventData.date) {
      try {
        // If it's already a Date object, this is a no-op
        // If it's a string, it will be converted to a Date
        if (!(processedEventData.date instanceof Date)) {
          console.log("Memory storage: Converting date from", processedEventData.date, "type:", typeof processedEventData.date);
          processedEventData.date = new Date(processedEventData.date);
          console.log("Memory storage: Converted date to", processedEventData.date);
        }
      } catch (err) {
        console.error("Memory storage: Error converting date:", err);
        // Keep the original date from the storage if conversion fails
        processedEventData.date = event.date;
      }
    }
    
    // Make sure we don't have any invalid data formats
    for (const key in processedEventData) {
      if (processedEventData[key] === undefined) {
        delete processedEventData[key];
      }
    }
    
    console.log("Memory storage: Processed event data for update:", processedEventData);
    
    const updatedEvent = {
      ...event,
      ...processedEventData,
      updatedAt: new Date(),
    };
    
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }
  
  async deleteEvent(id: number): Promise<boolean> {
    const exists = this.events.has(id);
    if (!exists) return false;
    
    // Delete the event
    this.events.delete(id);
    
    // Also delete related RSVPs and tickets
    const rsvpsToDelete = Array.from(this.rsvps.values())
      .filter(rsvp => rsvp.eventId === id)
      .map(rsvp => rsvp.id);
    
    rsvpsToDelete.forEach(rsvpId => this.rsvps.delete(rsvpId));
    
    const ticketsToDelete = Array.from(this.tickets.values())
      .filter(ticket => ticket.eventId === id)
      .map(ticket => ticket.id);
    
    ticketsToDelete.forEach(ticketId => this.tickets.delete(ticketId));
    
    return true;
  }

  // RSVP Methods
  async getRsvp(id: number): Promise<Rsvp | undefined> {
    return this.rsvps.get(id);
  }
  
  async getRsvpByEventAndUser(eventId: number, userId: number): Promise<Rsvp | undefined> {
    return Array.from(this.rsvps.values())
      .find(rsvp => rsvp.eventId === eventId && rsvp.userId === userId);
  }
  
  async createRsvp(insertRsvp: InsertRsvp): Promise<Rsvp> {
    const id = this.currentRsvpId++;
    const now = new Date();
    const rsvp: Rsvp = {
      ...insertRsvp,
      userId: insertRsvp.userId || null,
      eventId: insertRsvp.eventId || null,
      id,
      createdAt: now,
    };
    this.rsvps.set(id, rsvp);
    return rsvp;
  }

  async updateRsvp(id: number, rsvpData: Partial<Rsvp>): Promise<Rsvp | undefined> {
    const rsvp = this.rsvps.get(id);
    if (!rsvp) return undefined;

    const updatedRsvp: Rsvp = {
      ...rsvp,
      ...rsvpData,
    };

    this.rsvps.set(id, updatedRsvp);
    return updatedRsvp;
  }
  
  async getRsvpsByEvent(eventId: number): Promise<Rsvp[]> {
    return Array.from(this.rsvps.values())
      .filter(rsvp => rsvp.eventId === eventId);
  }
  
  async getRsvpsByUser(userId: number): Promise<Rsvp[]> {
    return Array.from(this.rsvps.values())
      .filter(rsvp => rsvp.userId === userId);
  }

  // Post Methods
  async getPost(id: number): Promise<Post | undefined> {
    return this.posts.get(id);
  }
  
  async createPost(insertPost: InsertPost): Promise<Post> {
    const id = this.currentPostId++;
    const now = new Date();
    const post: Post = {
      ...insertPost,
      userId: insertPost.userId || null,
      image: insertPost.image || null,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.posts.set(id, post);
    return post;
  }
  
  async updatePost(id: number, postData: Partial<Post>): Promise<Post | undefined> {
    const post = this.posts.get(id);
    if (!post) return undefined;
    
    const updatedPost: Post = {
      ...post,
      ...postData,
      updatedAt: new Date()
    };
    
    this.posts.set(id, updatedPost);
    return updatedPost;
  }
  
  async getAllPosts(): Promise<Post[]> {
    return Array.from(this.posts.values());
  }
  
  async getPostsByUser(userId: number): Promise<Post[]> {
    return Array.from(this.posts.values())
      .filter(post => post.userId === userId);
  }
  
  async deletePost(id: number): Promise<boolean> {
    const post = this.posts.get(id);
    if (!post) return false;
    
    // Delete the post
    this.posts.delete(id);
    
    // Delete associated likes and comments
    const postLikes = Array.from(this.likes.entries())
      .filter(([_, like]) => like.postId === id);
    
    for (const [likeId] of postLikes) {
      this.likes.delete(likeId);
    }
    
    const postComments = Array.from(this.comments.entries())
      .filter(([_, comment]) => comment.postId === id);
    
    for (const [commentId] of postComments) {
      this.comments.delete(commentId);
    }
    
    return true;
  }

  // Comment Methods
  async getComment(id: number): Promise<Comment | undefined> {
    return this.comments.get(id);
  }
  
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = this.currentCommentId++;
    const now = new Date();
    const comment: Comment = {
      ...insertComment,
      userId: insertComment.userId || null,
      postId: insertComment.postId || null,
      id,
      createdAt: now,
    };
    this.comments.set(id, comment);
    return comment;
  }
  
  async getCommentsByPost(postId: number): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.postId === postId);
  }
  
  async getCommentReplies(parentCommentId: number): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.parentCommentId === parentCommentId);
  }

  // Like Methods
  async getLike(id: number): Promise<Like | undefined> {
    return this.likes.get(id);
  }
  
  async getLikeByPostAndUser(postId: number, userId: number): Promise<Like | undefined> {
    return Array.from(this.likes.values())
      .find(like => like.postId === postId && like.userId === userId);
  }
  
  async createLike(insertLike: InsertLike): Promise<Like> {
    const id = this.currentLikeId++;
    const now = new Date();
    const like: Like = {
      ...insertLike,
      userId: insertLike.userId || null,
      postId: insertLike.postId || null,
      id,
      createdAt: now,
    };
    this.likes.set(id, like);
    return like;
  }
  
  async deleteLike(id: number): Promise<void> {
    this.likes.delete(id);
  }
  
  async getLikesByPost(postId: number): Promise<Like[]> {
    return Array.from(this.likes.values())
      .filter(like => like.postId === postId);
  }

  // Ticket Methods
  async getTicket(id: number): Promise<Ticket | undefined> {
    return this.tickets.get(id);
  }

  async getTicketByPaymentIntentId(paymentIntentId: string): Promise<Ticket | undefined> {
    return Array.from(this.tickets.values())
      .find(ticket => ticket.paymentIntentId === paymentIntentId);
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const id = this.currentTicketId++;
    const now = new Date();
    const ticket: Ticket = {
      ...insertTicket,
      id,
      userId: insertTicket.userId || null,
      eventId: insertTicket.eventId || null,
      isUsed: false,
      purchasedAt: now,
      emailSent: false,
      ticketQuantity: insertTicket.ticketQuantity || 1,
    };
    this.tickets.set(id, ticket);
    return ticket;
  }

  async getTicketsByEvent(eventId: number): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(ticket => ticket.eventId === eventId);
  }

  async getTicketsByUser(userId: number): Promise<Ticket[]> {
    return Array.from(this.tickets.values())
      .filter(ticket => ticket.userId === userId);
  }

  async addTicketToUser(userId: number, ticketId: number): Promise<void> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket with ID ${ticketId} not found`);
    }
    
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Update the ticket with the user ID
    await this.updateTicket(ticketId, { userId });
    console.log(`Ticket ${ticketId} has been added to user ${userId}`);
  }
  
  async getAllTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values());
  }
  
  async deleteTicket(id: number): Promise<boolean> {
    const exists = this.tickets.has(id);
    if (exists) {
      this.tickets.delete(id);
      return true;
    }
    return false;
  }

  async updateTicket(id: number, ticketData: Partial<Ticket>): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;

    const updatedTicket = {
      ...ticket,
      ...ticketData,
      updatedAt: new Date(),
    };

    this.tickets.set(id, updatedTicket);
    return updatedTicket;
  }

  async validateTicket(qrCode: string): Promise<Ticket | undefined> {
    return Array.from(this.tickets.values())
      .find(ticket => ticket.qrCode === qrCode);
  }
  
  async updatePaymentIntent(id: string, data: any): Promise<any> {
    // In MemStorage we don't have a direct mapping to Stripe payment intents
    // This is just a stub method to maintain compatibility with the interface
    console.log(`[MemStorage] Updating payment intent ${id} with data:`, data);
    
    // Since this is a memory-only implementation, we'll just return a mock success
    return {
      id,
      metadata: data.metadata || {},
      status: 'succeeded',
      // Add any other fields that might be used in the application
      updated: true
    };
  }

  // Membership Methods
  async getMembership(id: number): Promise<Membership | undefined> {
    return this.memberships.get(id);
  }

  async getMembershipByUser(userId: number): Promise<Membership | undefined> {
    return Array.from(this.memberships.values())
      .find(membership => membership.userId === userId);
  }
  
  async getMembershipByStripeSubscriptionId(subscriptionId: string): Promise<Membership | undefined> {
    return Array.from(this.memberships.values())
      .find(membership => membership.stripeSubscriptionId === subscriptionId);
  }

  async createMembership(insertMembership: InsertMembership): Promise<Membership> {
    const id = this.currentMembershipId++;
    const now = new Date();
    const membership: Membership = {
      ...insertMembership,
      id,
      userId: insertMembership.userId || null,
      tier: insertMembership.tier,
      startDate: now,
      endDate: insertMembership.endDate || null,
      isActive: true,
      status: "active",
      cancelledAt: null,
      stripeSubscriptionId: insertMembership.stripeSubscriptionId || null,
      stripeCustomerId: insertMembership.stripeCustomerId || null,
    };
    this.memberships.set(id, membership);
    return membership;
  }

  async updateMembership(id: number, membershipData: Partial<Membership>): Promise<Membership | undefined> {
    const membership = this.memberships.get(id);
    if (!membership) return undefined;

    const updatedMembership = {
      ...membership,
      ...membershipData,
    };

    this.memberships.set(id, updatedMembership);
    return updatedMembership;
  }

  async cancelMembership(id: number): Promise<void> {
    const membership = this.memberships.get(id);
    if (membership) {
      this.updateMembership(id, {
        isActive: false,
        status: "cancelled",
        cancelledAt: new Date(),
      });
    }
  }
  
  async getAllMemberships(): Promise<Membership[]> {
    return Array.from(this.memberships.values());
  }
  
  async getAllMembershipsWithUserData(): Promise<any[]> {
    const allMemberships = Array.from(this.memberships.values());
    
    // Fetch user data for each membership
    return allMemberships.map(membership => {
      const user = this.users.get(membership.userId || 0);
      if (!user) {
        return {
          ...membership,
          user: {
            id: membership.userId,
            email: "Unknown",
            displayName: "Unknown User",
            profilePicture: null
          }
        };
      }
      
      return {
        ...membership,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          profilePicture: user.profilePicture
        }
      };
    });
  }

  // Product Methods
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const now = new Date();
    const product: Product = {
      ...insertProduct,
      id,
      description: insertProduct.description || null,
      images: insertProduct.images || null,
      stock: insertProduct.stock || 1,
      isDigital: false, // Digital products are disabled
      digitalContentUrl: null, // Digital products are disabled
      createdAt: now,
      updatedAt: now,
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

    const updatedProduct = {
      ...product,
      ...productData,
      // Always ensure digital products are disabled
      isDigital: false,
      digitalContentUrl: null,
      updatedAt: new Date(),
    };

    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async getAllProducts(includeDeleted: boolean = false): Promise<Product[]> {
    const allProducts = Array.from(this.products.values());
    
    // Only return active products unless includeDeleted is true
    if (!includeDeleted) {
      return allProducts.filter(product => product.status !== 'deleted');
    }
    
    return allProducts;
  }

  async getProductsByCategory(category: string, includeDeleted: boolean = false): Promise<Product[]> {
    const products = Array.from(this.products.values())
      .filter(product => product.category === category);
    
    // Only return active products unless includeDeleted is true
    if (!includeDeleted) {
      return products.filter(product => product.status !== 'deleted');
    }
    
    return products;
  }

  async getProductsBySeller(sellerId: number, includeDeleted: boolean = false): Promise<Product[]> {
    const products = Array.from(this.products.values())
      .filter(product => product.sellerId === sellerId);
    
    // Only return active products unless includeDeleted is true
    if (!includeDeleted) {
      return products.filter(product => product.status !== 'deleted');
    }
    
    return products;
  }

  // Order Methods
  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.currentOrderId++;
    const now = new Date();
    const order: Order = {
      ...insertOrder,
      id,
      status: "pending",
      paymentIntentId: insertOrder.paymentIntentId || null,
      shippingAddress: insertOrder.shippingAddress || null,
      trackingNumber: insertOrder.trackingNumber || null,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;

    const updatedOrder = {
      ...order,
      ...orderData,
      updatedAt: new Date(),
    };

    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async getOrdersByBuyer(buyerId: number): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.buyerId === buyerId);
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.status === status);
  }
  
  // Get all orders (admin only or for payment intent verification)
  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Order Item Methods
  async getOrderItem(id: number): Promise<OrderItem | undefined> {
    return this.orderItems.get(id);
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const id = this.currentOrderItemId++;
    const now = new Date();
    const orderItem: OrderItem = {
      ...insertOrderItem,
      id,
      quantity: insertOrderItem.quantity || 1,
      createdAt: now,
    };
    this.orderItems.set(id, orderItem);
    return orderItem;
  }

  async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values())
      .filter(item => item.orderId === orderId);
  }

  // Admin Action Methods
  async createAdminAction(action: InsertAdminAction): Promise<AdminAction> {
    const id = this.currentAdminActionId++;
    const now = new Date();
    const adminAction: AdminAction = {
      ...action,
      id,
      adminId: action.adminId || null,
      targetId: action.targetId || null,
      createdAt: now,
    };
    this.adminActions.set(id, adminAction);
    return adminAction;
  }

  async getAdminAction(id: number): Promise<AdminAction | undefined> {
    return this.adminActions.get(id);
  }

  async getAdminActionsByAdmin(adminId: number): Promise<AdminAction[]> {
    return Array.from(this.adminActions.values())
      .filter(action => action.adminId === adminId);
  }

  async getAdminActionsByType(actionType: string): Promise<AdminAction[]> {
    return Array.from(this.adminActions.values())
      .filter(action => action.actionType === actionType);
  }

  async getAllAdminActions(): Promise<AdminAction[]> {
    return Array.from(this.adminActions.values());
  }

  // User Management Admin Functions
  async approveUser(userId: number, adminId: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const updatedUser = await this.updateUser(userId, {
      isApproved: true,
      updatedAt: new Date(),
    });
    
    // Log admin action
    await this.createAdminAction({
      adminId,
      actionType: AdminActionType.USER_APPROVAL,
      targetId: userId,
      targetType: 'user',
      details: `Approved user: ${user.displayName} (${user.email})`,
    });
    
    return updatedUser;
  }

  async rejectUser(userId: number, adminId: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const updatedUser = await this.updateUser(userId, {
      isApproved: false,
      updatedAt: new Date(),
    });
    
    // Log admin action
    await this.createAdminAction({
      adminId,
      actionType: AdminActionType.USER_REJECTION,
      targetId: userId,
      targetType: 'user',
      details: `Rejected user: ${user.displayName} (${user.email})`,
    });
    
    return updatedUser;
  }

  async suspendUser(userId: number, adminId: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const updatedUser = await this.updateUser(userId, {
      isApproved: false,
      updatedAt: new Date(),
    });
    
    // Log admin action
    await this.createAdminAction({
      adminId,
      actionType: AdminActionType.USER_SUSPENSION,
      targetId: userId,
      targetType: 'user',
      details: `Suspended user: ${user.displayName} (${user.email})`,
    });
    
    return updatedUser;
  }

  async deleteUser(userId: number, adminId: number): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;
    
    // Just mark as deleted instead of actually removing
    const updatedUser = await this.updateUser(userId, {
      isApproved: false,
      updatedAt: new Date(),
    });
    
    // Log admin action
    await this.createAdminAction({
      adminId,
      actionType: AdminActionType.USER_DELETION,
      targetId: userId,
      targetType: 'user',
      details: `Deleted user: ${user.displayName} (${user.email})`,
    });
  }

  async restoreUser(userId: number, adminId: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const updatedUser = await this.updateUser(userId, {
      isApproved: true,
      updatedAt: new Date(),
    });
    
    // Log admin action
    await this.createAdminAction({
      adminId,
      actionType: AdminActionType.USER_RESTORATION,
      targetId: userId,
      targetType: 'user',
      details: `Restored user: ${user.displayName} (${user.email})`,
    });
    
    return updatedUser;
  }

  // Event Management Admin Functions
  async approveEvent(eventId: number, adminId: number): Promise<Event | undefined> {
    const event = await this.getEvent(eventId);
    if (!event) return undefined;
    
    // You would typically have an isApproved field on events
    // For now just updating the event
    const updatedEvent = { ...event, updatedAt: new Date() };
    this.events.set(eventId, updatedEvent);
    
    // Log admin action
    await this.createAdminAction({
      adminId,
      actionType: AdminActionType.EVENT_APPROVAL,
      targetId: eventId,
      targetType: 'event',
      details: `Approved event: ${event.title}`,
    });
    
    return updatedEvent;
  }

  async rejectEvent(eventId: number, adminId: number): Promise<Event | undefined> {
    const event = await this.getEvent(eventId);
    if (!event) return undefined;
    
    // You would typically have an isApproved field on events that would be set to false
    // For now just updating the event
    const updatedEvent = { ...event, updatedAt: new Date() };
    this.events.set(eventId, updatedEvent);
    
    // Log admin action
    await this.createAdminAction({
      adminId,
      actionType: AdminActionType.EVENT_REJECTION,
      targetId: eventId,
      targetType: 'event',
      details: `Rejected event: ${event.title}`,
    });
    
    return updatedEvent;
  }

  async modifyEvent(eventId: number, adminId: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const event = await this.getEvent(eventId);
    if (!event) return undefined;
    
    const updatedEvent = {
      ...event,
      ...eventData,
      updatedAt: new Date(),
    };
    
    this.events.set(eventId, updatedEvent);
    
    // Log admin action
    await this.createAdminAction({
      adminId,
      actionType: AdminActionType.EVENT_MODIFICATION,
      targetId: eventId,
      targetType: 'event',
      details: `Modified event: ${event.title}`,
    });
    
    return updatedEvent;
  }

  // Content Moderation
  async createContentFlag(flag: InsertContentFlag): Promise<ContentFlag> {
    const id = this.currentContentFlagId++;
    const now = new Date();
    const contentFlag: ContentFlag = {
      ...flag,
      id,
      reporterId: flag.reporterId || null,
      reviewerId: null,
      reviewedAt: null,
      reviewNotes: null,
      status: ContentFlagStatus.PENDING,
      createdAt: now,
    };
    this.contentFlags.set(id, contentFlag);
    return contentFlag;
  }

  async getContentFlag(id: number): Promise<ContentFlag | undefined> {
    return this.contentFlags.get(id);
  }

  async getPendingContentFlags(): Promise<ContentFlag[]> {
    return Array.from(this.contentFlags.values())
      .filter(flag => flag.status === ContentFlagStatus.PENDING);
  }

  async reviewContentFlag(id: number, reviewerId: number, status: string, notes?: string): Promise<ContentFlag | undefined> {
    const flag = this.contentFlags.get(id);
    if (!flag) return undefined;
    
    const updatedFlag = {
      ...flag,
      reviewerId,
      reviewedAt: new Date(),
      reviewNotes: notes || null,
      status,
    };
    
    this.contentFlags.set(id, updatedFlag);
    
    // Log admin action
    await this.createAdminAction({
      adminId: reviewerId,
      actionType: AdminActionType.POST_MODERATION,
      targetId: id,
      targetType: 'content_flag',
      details: `Reviewed content flag for ${flag.contentType} ID ${flag.contentId}. Status: ${status}`,
    });
    
    return updatedFlag;
  }

  async getContentFlagsByStatus(status: string): Promise<ContentFlag[]> {
    return Array.from(this.contentFlags.values())
      .filter(flag => flag.status === status);
  }
  
  async getContentFlagsByReporter(reporterId: number): Promise<ContentFlag[]> {
    return Array.from(this.contentFlags.values())
      .filter(flag => flag.reporterId === reporterId);
  }
  
  async getContentFlagsByContent(contentType: string, contentId: number): Promise<ContentFlag[]> {
    return Array.from(this.contentFlags.values())
      .filter(flag => flag.contentType === contentType && flag.contentId === contentId);
  }
  
  // User Blocks
  async createUserBlock(block: InsertUserBlock): Promise<UserBlock> {
    const id = this.currentUserBlockId++;
    const now = new Date();
    const userBlock: UserBlock = {
      id,
      blockerId: block.blockerId,
      blockedId: block.blockedId,
      reason: block.reason || null,
      createdAt: now,
      updatedAt: now
    };
    this.userBlocks.set(id, userBlock);
    return userBlock;
  }
  
  async getUserBlock(id: number): Promise<UserBlock | undefined> {
    return this.userBlocks.get(id);
  }
  
  async getUserBlockByUsers(blockerId: number, blockedId: number): Promise<UserBlock | undefined> {
    return Array.from(this.userBlocks.values())
      .find(block => block.blockerId === blockerId && block.blockedId === blockedId);
  }
  
  async getUserBlocksByBlocker(blockerId: number): Promise<UserBlock[]> {
    return Array.from(this.userBlocks.values())
      .filter(block => block.blockerId === blockerId);
  }
  
  async getUserBlocksByBlocked(blockedId: number): Promise<UserBlock[]> {
    return Array.from(this.userBlocks.values())
      .filter(block => block.blockedId === blockedId);
  }
  
  async deleteUserBlock(id: number): Promise<boolean> {
    const exists = this.userBlocks.has(id);
    if (exists) {
      this.userBlocks.delete(id);
    }
    return exists;
  }
  
  async isUserBlocked(userId: number, targetUserId: number): Promise<boolean> {
    // Check if userId has blocked targetUserId OR targetUserId has blocked userId
    return Array.from(this.userBlocks.values())
      .some(block => 
        (block.blockerId === userId && block.blockedId === targetUserId) ||
        (block.blockerId === targetUserId && block.blockedId === userId)
      );
  }
  
  // User Follows
  async followUser(follow: InsertUserFollow): Promise<UserFollow> {
    const id = this.currentUserFollowId++;
    const now = new Date();
    const userFollow: UserFollow = {
      id,
      followerId: follow.followerId,
      followedId: follow.followedId,
      status: follow.status || "active", // default to active if not specified
      createdAt: now,
      updatedAt: now
    };
    this.userFollows.set(id, userFollow);
    return userFollow;
  }
  
  async unfollowUser(followerId: number, followedId: number): Promise<boolean> {
    // Find the follow relationship
    const follow = Array.from(this.userFollows.values()).find(
      f => f.followerId === followerId && f.followedId === followedId
    );
    
    if (!follow) return false;
    
    // Delete the follow relationship
    return this.userFollows.delete(follow.id);
  }
  
  async getFollowersByUserId(userId: number): Promise<UserFollow[]> {
    // Get all users who follow the given user
    return Array.from(this.userFollows.values()).filter(
      follow => follow.followedId === userId
    );
  }
  
  async getFollowingByUserId(userId: number): Promise<UserFollow[]> {
    // Get all users that the given user follows
    return Array.from(this.userFollows.values()).filter(
      follow => follow.followerId === userId
    );
  }
  
  async isUserFollowing(followerId: number, followedId: number): Promise<boolean> {
    // Check if followerId is following followedId
    const follow = Array.from(this.userFollows.values()).find(
      f => f.followerId === followerId && 
           f.followedId === followedId && 
           f.status === "active"
    );
    return !!follow;
  }

  async getFollowStatus(followerId: number, followedId: number): Promise<UserFollow | undefined> {
    const follow = Array.from(this.userFollows.values()).find(
      f => f.followerId === followerId && 
           f.followedId === followedId
    );
    return follow;
  }
  
  async updateFollowStatus(id: number, status: string): Promise<UserFollow | undefined> {
    const follow = this.userFollows.get(id);
    if (!follow) return undefined;
    
    const updatedFollow = {
      ...follow,
      status,
      updatedAt: new Date()
    };
    
    this.userFollows.set(id, updatedFollow);
    return updatedFollow;
  }
  
  // Content Filters
  async createContentFilter(filter: InsertContentFilter): Promise<ContentFilter> {
    const id = this.currentContentFilterId++;
    const now = new Date();
    const contentFilter: ContentFilter = {
      id,
      userId: filter.userId,
      level: filter.level || ContentFilterLevel.MEDIUM,
      filterProfanity: filter.filterProfanity ?? true,
      filterViolence: filter.filterViolence ?? true,
      filterHateSpeech: filter.filterHateSpeech ?? true,
      filterExplicit: filter.filterExplicit ?? true,
      filterSpam: filter.filterSpam ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.contentFilters.set(id, contentFilter);
    return contentFilter;
  }
  
  async getContentFilter(id: number): Promise<ContentFilter | undefined> {
    return this.contentFilters.get(id);
  }
  
  async getContentFilterByUser(userId: number): Promise<ContentFilter | undefined> {
    const filter = Array.from(this.contentFilters.values())
      .find(filter => filter.userId === userId);
    
    // If no filter exists, create a default one
    if (!filter) {
      return this.createContentFilter({
        userId,
        level: ContentFilterLevel.MEDIUM,
        filterProfanity: true,
        filterViolence: true,
        filterHateSpeech: true,
        filterExplicit: true,
        filterSpam: true
      });
    }
    
    return filter;
  }
  
  async updateContentFilter(id: number, filterData: Partial<ContentFilter>): Promise<ContentFilter | undefined> {
    const filter = this.contentFilters.get(id);
    if (!filter) return undefined;
    
    const updatedFilter = {
      ...filter,
      ...filterData,
      updatedAt: new Date()
    };
    
    this.contentFilters.set(id, updatedFilter);
    return updatedFilter;
  }
  
  // Blocked Keywords
  async createBlockedKeyword(keyword: InsertBlockedKeyword): Promise<BlockedKeyword> {
    const id = this.currentBlockedKeywordId++;
    const now = new Date();
    const blockedKeyword: BlockedKeyword = {
      id,
      keyword: keyword.keyword,
      category: keyword.category,
      severity: keyword.severity || "medium",
      isRegex: keyword.isRegex || false,
      isActive: keyword.isActive ?? true,
      createdBy: keyword.createdBy || null,
      createdAt: now,
      updatedAt: now
    };
    this.blockedKeywords.set(id, blockedKeyword);
    return blockedKeyword;
  }
  
  async getBlockedKeyword(id: number): Promise<BlockedKeyword | undefined> {
    return this.blockedKeywords.get(id);
  }
  
  async getBlockedKeywordByText(keyword: string): Promise<BlockedKeyword | undefined> {
    return Array.from(this.blockedKeywords.values())
      .find(k => k.keyword === keyword);
  }
  
  async getBlockedKeywordsByCategory(category: string): Promise<BlockedKeyword[]> {
    return Array.from(this.blockedKeywords.values())
      .filter(k => k.category === category);
  }
  
  async getActiveBlockedKeywords(): Promise<BlockedKeyword[]> {
    // If blockedKeywords are empty, return default list
    const keywordsFromStorage = Array.from(this.blockedKeywords.values())
      .filter(k => k.isActive);
      
      
    if (keywordsFromStorage.length > 0) {
      return keywordsFromStorage;
    }
    
    
    // Return default profanity list if no keywords exist
    return [
      { 
        id: 1, 
        keyword: 'fuck', 
        category: 'profanity', 
        severity: 'high', 
        isRegex: false,
        isActive: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: 2, 
        keyword: 'shit', 
        category: 'profanity', 
        severity: 'medium', 
        isRegex: false,
        isActive: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: 3, 
        keyword: 'ass', 
        category: 'profanity', 
        severity: 'low', 
        isRegex: false,
        isActive: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      { 
        id: 4, 
        keyword: 'bitch', 
        category: 'profanity', 
        severity: 'medium', 
        isRegex: false,
        isActive: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }
  
  async updateBlockedKeyword(id: number, keywordData: Partial<BlockedKeyword>): Promise<BlockedKeyword | undefined> {
    const keyword = this.blockedKeywords.get(id);
    if (!keyword) return undefined;
    
    const updatedKeyword = {
      ...keyword,
      ...keywordData,
      updatedAt: new Date()
    };
    
    this.blockedKeywords.set(id, updatedKeyword);
    return updatedKeyword;
  }
  
  async toggleBlockedKeywordStatus(id: number): Promise<BlockedKeyword | undefined> {
    const keyword = this.blockedKeywords.get(id);
    if (!keyword) return undefined;
    
    const updatedKeyword = {
      ...keyword,
      isActive: !keyword.isActive,
      updatedAt: new Date()
    };
    
    this.blockedKeywords.set(id, updatedKeyword);
    return updatedKeyword;
  }
  
  // Content Filtering Functions
  async filterContent(content: string, filterLevel: string = ContentFilterLevel.MEDIUM): Promise<{filtered: string, hasViolations: boolean, violations: string[]}> {
    if (!content) {
      return { filtered: '', hasViolations: false, violations: [] };
    }
    
    // Get all active blocked keywords
    const keywords = await this.getActiveBlockedKeywords();
    
    let filteredContent = content;
    let hasViolations = false;
    const violations: string[] = [];
    
    // Apply different strictness based on filter level
    const severityLevels: {[key: string]: string[]} = {
      [ContentFilterLevel.NONE]: [],
      [ContentFilterLevel.LOW]: ['high'],
      [ContentFilterLevel.MEDIUM]: ['high', 'medium'],
      [ContentFilterLevel.HIGH]: ['high', 'medium', 'low'],
      [ContentFilterLevel.STRICT]: ['high', 'medium', 'low', 'minimal']
    };
    
    const appliedSeverities = severityLevels[filterLevel] || severityLevels[ContentFilterLevel.MEDIUM];
    
    if (appliedSeverities.length === 0) {
      return { filtered: content, hasViolations: false, violations: [] };
    }
    
    // Filter keywords based on severity level
    const applicableKeywords = keywords.filter(kw => appliedSeverities.includes(kw.severity));
    
    // Apply filtering
    for (const keyword of applicableKeywords) {
      try {
        if (keyword.isRegex) {
          // Handle regex pattern
          const regex = new RegExp(keyword.keyword, 'gi');
          if (regex.test(filteredContent)) {
            hasViolations = true;
            violations.push(keyword.category);
            filteredContent = filteredContent.replace(regex, '***');
          }
        } else {
          // Handle plain text keyword
          const lowercaseContent = filteredContent.toLowerCase();
          const lowercaseKeyword = keyword.keyword.toLowerCase();
          
          if (lowercaseContent.includes(lowercaseKeyword)) {
            hasViolations = true;
            if (!violations.includes(keyword.category)) {
              violations.push(keyword.category);
            }
            
            // Replace all occurrences with asterisks
            const replaceWith = '*'.repeat(keyword.keyword.length);
            const regex = new RegExp(keyword.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            filteredContent = filteredContent.replace(regex, replaceWith);
          }
        }
      } catch (error) {
        console.error(`Error applying filter for keyword ${keyword.keyword}:`, error);
      }
    }
    
    return { filtered: filteredContent, hasViolations, violations };
  }
  
  async isContentAllowed(content: string, filterLevel: string = ContentFilterLevel.MEDIUM): Promise<boolean> {
    
    if (!content) return true;

    // Get all active blocked keywords
    const keywords = await this.getActiveBlockedKeywords();
    
    const severityLevels: {[key: string]: string[]} = {
      [ContentFilterLevel.NONE]: [],
      [ContentFilterLevel.LOW]: ['high'],
      [ContentFilterLevel.MEDIUM]: ['high', 'medium'],
      [ContentFilterLevel.HIGH]: ['high', 'medium', 'low'],
      [ContentFilterLevel.STRICT]: ['high', 'medium', 'low', 'minimal']
    };
    
    const appliedSeverities = severityLevels[filterLevel] || severityLevels[ContentFilterLevel.MEDIUM];
    
    if (appliedSeverities.length === 0) {
      return true;
    }
    
    // Filter keywords based on severity level
    const applicableKeywords = keywords.filter(kw => appliedSeverities.includes(kw.severity));
    
    // Simplify to lowercase for case-insensitive matching
    const lowerContent = content.toLowerCase();
    
    // Check each keyword
    for (const keyword of applicableKeywords) {
      const lowerKeyword = keyword.keyword.toLowerCase();
      
      // Simple includes check (most reliable for catching profanity)
      if (lowerContent.includes(lowerKeyword)) {
        return false;
      }
    }
    
    return true;
  }

  // Event Ticket Types
  async createEventTicketType(ticketType: InsertEventTicketType): Promise<EventTicketType> {
    const id = this.currentEventTicketTypeId++;
    const now = new Date();
    const eventTicketType: EventTicketType = {
      ...ticketType,
      id,
      eventId: ticketType.eventId || null,
      maxQuantity: ticketType.maxQuantity || null,
      availableQuantity: ticketType.availableQuantity || null,
      benefits: ticketType.benefits || null,
      description: ticketType.description || null,
      createdAt: now,
      updatedAt: now,
    };
    this.eventTicketTypes.set(id, eventTicketType);
    return eventTicketType;
  }

  async getEventTicketType(id: number): Promise<EventTicketType | undefined> {
    return this.eventTicketTypes.get(id);
  }

  async getEventTicketTypesByEvent(eventId: number): Promise<EventTicketType[]> {
    return Array.from(this.eventTicketTypes.values())
      .filter(type => type.eventId === eventId);
  }

  async updateEventTicketType(id: number, ticketTypeData: Partial<EventTicketType>): Promise<EventTicketType | undefined> {
    const ticketType = this.eventTicketTypes.get(id);
    if (!ticketType) return undefined;
    
    const updatedTicketType = {
      ...ticketType,
      ...ticketTypeData,
      updatedAt: new Date(),
    };
    
    this.eventTicketTypes.set(id, updatedTicketType);
    return updatedTicketType;
  }

  async deleteEventTicketType(id: number): Promise<boolean> {
    return this.eventTicketTypes.delete(id);
  }

  // Admin Notifications
  async createAdminNotification(notification: InsertAdminNotification): Promise<AdminNotification> {
    const id = this.currentAdminNotificationId++;
    const now = new Date();
    const adminNotification: AdminNotification = {
      ...notification,
      id,
      fromAdminId: notification.fromAdminId || null,
      toUserId: notification.toUserId || null,
      isRead: false,
      createdAt: now,
    };
    this.adminNotifications.set(id, adminNotification);
    return adminNotification;
  }

  async getAdminNotification(id: number): Promise<AdminNotification | undefined> {
    return this.adminNotifications.get(id);
  }

  async getAdminNotificationsByUser(userId: number): Promise<AdminNotification[]> {
    return Array.from(this.adminNotifications.values())
      .filter(notification => notification.toUserId === userId);
  }

  async markAdminNotificationAsRead(id: number): Promise<AdminNotification | undefined> {
    const notification = this.adminNotifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification = {
      ...notification,
      isRead: true,
    };
    
    this.adminNotifications.set(id, updatedNotification);
    return updatedNotification;
  }

  async getUnreadAdminNotificationsByUser(userId: number): Promise<AdminNotification[]> {
    return Array.from(this.adminNotifications.values())
      .filter(notification => notification.toUserId === userId && !notification.isRead);
  }
  
  // User Notifications Methods
  async createUserNotification(notification: InsertUserNotification): Promise<UserNotification> {
    const id = this.currentUserNotificationId++;
    const now = new Date();
    
    const userNotification: UserNotification = {
      ...notification,
      id,
      createdAt: now,
      isRead: false,
      isSeen: false,
      userId: notification.userId || null,
      type: notification.type || "general",
      title: notification.title || "",
      actionLink: notification.actionLink || null,
      actionText: notification.actionText || null,
      contentId: notification.contentId || null,
      contentType: notification.contentType || null,
      image: notification.image || null,
      senderName: notification.senderName || null,
      senderId: notification.senderId || null,
    };
    
    this.userNotifications.set(id, userNotification);
    return userNotification;
  }
  
  async getUserNotification(id: number): Promise<UserNotification | undefined> {
    return this.userNotifications.get(id);
  }
  
  async getUserNotificationsByUser(userId: number): Promise<UserNotification[]> {
    return Array.from(this.userNotifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getUnreadUserNotificationsByUser(userId: number): Promise<UserNotification[]> {
    return Array.from(this.userNotifications.values())
      .filter(notification => notification.userId === userId && !notification.isRead)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async markUserNotificationAsRead(id: number): Promise<UserNotification | undefined> {
    const notification = this.userNotifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification = {
      ...notification,
      isRead: true,
      readAt: new Date()
    };
    
    this.userNotifications.set(id, updatedNotification);
    return updatedNotification;
  }
  
  async markUserNotificationAsSeen(id: number): Promise<UserNotification | undefined> {
    const notification = this.userNotifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification = {
      ...notification,
      isSeen: true,
      seenAt: new Date()
    };
    
    this.userNotifications.set(id, updatedNotification);
    return updatedNotification;
  }
  
  async markAllUserNotificationsAsRead(userId: number): Promise<number> {
    let count = 0;
    const now = new Date();
    
    for (const [id, notification] of this.userNotifications.entries()) {
      if (notification.userId === userId && !notification.isRead) {
        this.userNotifications.set(id, {
          ...notification,
          isRead: true,
          readAt: now
        });
        count++;
      }
    }
    
    return count;
  }
  
  async markAllUserNotificationsAsSeen(userId: number): Promise<number> {
    let count = 0;
    const now = new Date();
    
    for (const [id, notification] of this.userNotifications.entries()) {
      if (notification.userId === userId && !notification.isSeen) {
        this.userNotifications.set(id, {
          ...notification,
          isSeen: true,
          seenAt: now
        });
        count++;
      }
    }
    
    return count;
  }
  
  async deleteUserNotification(id: number): Promise<boolean> {
    return this.userNotifications.delete(id);
  }

  // Service Methods
  async getService(id: number): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async createService(insertService: InsertService): Promise<Service> {
    const id = this.currentServiceId++;
    const now = new Date();
    const service: Service = {
      ...insertService,
      id,
      description: insertService.description,
      images: insertService.images || null,
      location: insertService.location || null,
      requirements: insertService.requirements || null,
      isActive: insertService.isActive !== undefined ? insertService.isActive : true,
      isVerified: false,
      createdAt: now,
      updatedAt: now,
    };
    this.services.set(id, service);
    return service;
  }

  async updateService(id: number, serviceData: Partial<Service>): Promise<Service | undefined> {
    const service = this.services.get(id);
    if (!service) return undefined;

    const updatedService = {
      ...service,
      ...serviceData,
      updatedAt: new Date(),
    };

    this.services.set(id, updatedService);
    return updatedService;
  }

  async deleteService(id: number): Promise<boolean> {
    const service = this.services.get(id);
    if (!service) return false;
    
    // Delete the service
    this.services.delete(id);
    return true;
  }

  async getAllServices(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  async getServicesByCategory(category: string): Promise<Service[]> {
    return Array.from(this.services.values())
      .filter(service => service.category === category);
  }

  async getServicesByProvider(providerId: number): Promise<Service[]> {
    return Array.from(this.services.values())
      .filter(service => service.providerId === providerId);
  }

  async getServicesByType(type: string): Promise<Service[]> {
    return Array.from(this.services.values())
      .filter(service => service.type === type);
  }

  // Availability Methods
  async getAvailability(id: number): Promise<Availability | undefined> {
    return this.availability.get(id);
  }

  async createAvailability(insertAvailability: InsertAvailability): Promise<Availability> {
    const id = this.currentAvailabilityId++;
    const now = new Date();
    const availabilityEntry: Availability = {
      ...insertAvailability,
      id,
      recurrenceEndDate: insertAvailability.recurrenceEndDate || null,
      isBlocked: insertAvailability.isBlocked || false,
      notes: insertAvailability.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    this.availability.set(id, availabilityEntry);
    return availabilityEntry;
  }

  async updateAvailability(id: number, availabilityData: Partial<Availability>): Promise<Availability | undefined> {
    const availabilityEntry = this.availability.get(id);
    if (!availabilityEntry) return undefined;

    const updatedAvailability = {
      ...availabilityEntry,
      ...availabilityData,
      updatedAt: new Date(),
    };

    this.availability.set(id, updatedAvailability);
    return updatedAvailability;
  }

  async getAvailabilityByProvider(providerId: number): Promise<Availability[]> {
    return Array.from(this.availability.values())
      .filter(avail => avail.providerId === providerId);
  }

  async getAvailabilityByService(serviceId: number): Promise<Availability[]> {
    return Array.from(this.availability.values())
      .filter(avail => avail.serviceId === serviceId);
  }

  async getAvailabilityInRange(providerId: number, startDate: Date, endDate: Date): Promise<Availability[]> {
    return Array.from(this.availability.values())
      .filter(avail => {
        // Filter by provider ID
        if (avail.providerId !== providerId) return false;
        
        // Check if availability falls within the date range
        const availStart = new Date(avail.startTime);
        const availEnd = new Date(avail.endTime);
        
        // At least some part of the availability is within the range
        return (
          (availStart >= startDate && availStart <= endDate) ||  // Start is in range
          (availEnd >= startDate && availEnd <= endDate) ||      // End is in range
          (availStart <= startDate && availEnd >= endDate)       // Availability encompasses the range
        );
      });
  }

  // Service Time Slots Methods
  async getServiceTimeSlot(id: number): Promise<ServiceTimeSlot | undefined> {
    return this.serviceTimeSlots.get(id);
  }

  async createServiceTimeSlot(timeSlot: InsertServiceTimeSlot): Promise<ServiceTimeSlot> {
    const id = this.currentServiceTimeSlotId++;
    const now = new Date();
    
    const newTimeSlot: ServiceTimeSlot = {
      ...timeSlot,
      id,
      status: timeSlot.status || TimeSlotStatus.AVAILABLE,
      maxBookings: timeSlot.maxBookings || 1,
      currentBookings: timeSlot.currentBookings || 0,
      notes: timeSlot.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    
    this.serviceTimeSlots.set(id, newTimeSlot);
    return newTimeSlot;
  }

  async updateServiceTimeSlot(id: number, timeSlotData: Partial<InsertServiceTimeSlot>): Promise<ServiceTimeSlot | undefined> {
    const timeSlot = this.serviceTimeSlots.get(id);
    if (!timeSlot) return undefined;
    
    const updatedTimeSlot = {
      ...timeSlot,
      ...timeSlotData,
      updatedAt: new Date(),
    };
    
    this.serviceTimeSlots.set(id, updatedTimeSlot);
    return updatedTimeSlot;
  }

  async getServiceTimeSlotsByService(serviceId: number): Promise<ServiceTimeSlot[]> {
    return Array.from(this.serviceTimeSlots.values())
      .filter(slot => slot.serviceId === serviceId);
  }

  async getServiceTimeSlotsByProvider(providerId: number): Promise<ServiceTimeSlot[]> {
    return Array.from(this.serviceTimeSlots.values())
      .filter(slot => slot.providerId === providerId);
  }

  async getServiceTimeSlotsByDate(providerId: number, date: Date): Promise<ServiceTimeSlot[]> {
    // Create date objects for start and end of the requested day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return Array.from(this.serviceTimeSlots.values())
      .filter(slot => {
        if (slot.providerId !== providerId) return false;
        
        // Check if the time slot's date falls on the requested day
        const slotDate = new Date(slot.date);
        return slotDate >= startOfDay && slotDate <= endOfDay;
      });
  }

  async getAvailableServiceTimeSlots(serviceId: number): Promise<ServiceTimeSlot[]> {
    const now = new Date();
    
    return Array.from(this.serviceTimeSlots.values())
      .filter(slot => 
        slot.serviceId === serviceId && 
        slot.status === TimeSlotStatus.AVAILABLE &&
        slot.date > now && 
        slot.currentBookings < slot.maxBookings
      );
  }

  async updateServiceTimeSlotStatus(id: number, status: string): Promise<ServiceTimeSlot | undefined> {
    const timeSlot = this.serviceTimeSlots.get(id);
    if (!timeSlot) return undefined;
    
    const updatedTimeSlot = {
      ...timeSlot,
      status,
      updatedAt: new Date(),
    };
    
    this.serviceTimeSlots.set(id, updatedTimeSlot);
    return updatedTimeSlot;
  }

  async incrementCurrentBookings(id: number): Promise<ServiceTimeSlot | undefined> {
    const timeSlot = this.serviceTimeSlots.get(id);
    if (!timeSlot) return undefined;
    
    // Increment the current bookings
    const newBookingCount = timeSlot.currentBookings + 1;
    
    // If max bookings reached, update status to booked
    const newStatus = newBookingCount >= timeSlot.maxBookings 
      ? TimeSlotStatus.BOOKED 
      : timeSlot.status;
    
    const updatedTimeSlot = {
      ...timeSlot,
      currentBookings: newBookingCount,
      status: newStatus,
      updatedAt: new Date(),
    };
    
    this.serviceTimeSlots.set(id, updatedTimeSlot);
    return updatedTimeSlot;
  }

  async decrementCurrentBookings(id: number): Promise<ServiceTimeSlot | undefined> {
    const timeSlot = this.serviceTimeSlots.get(id);
    if (!timeSlot) return undefined;
    
    // Only decrement if greater than 0
    if (timeSlot.currentBookings <= 0) return timeSlot;
    
    // Decrement the current bookings
    const newBookingCount = timeSlot.currentBookings - 1;
    
    // If slot was booked and now has space, update status to available
    const newStatus = timeSlot.status === TimeSlotStatus.BOOKED && newBookingCount < timeSlot.maxBookings
      ? TimeSlotStatus.AVAILABLE
      : timeSlot.status;
    
    const updatedTimeSlot = {
      ...timeSlot,
      currentBookings: newBookingCount,
      status: newStatus,
      updatedAt: new Date(),
    };
    
    this.serviceTimeSlots.set(id, updatedTimeSlot);
    return updatedTimeSlot;
  }

  async deleteServiceTimeSlot(id: number): Promise<boolean> {
    const exists = this.serviceTimeSlots.has(id);
    if (!exists) return false;
    
    this.serviceTimeSlots.delete(id);
    return true;
  }

  // Service Booking Methods
  async getServiceBooking(id: number): Promise<ServiceBooking | undefined> {
    return this.serviceBookings.get(id);
  }

  async createServiceBooking(insertBooking: InsertServiceBooking): Promise<ServiceBooking> {
    const id = this.currentServiceBookingId++;
    const now = new Date();
    
    // Override status if it's a direct payment (isPaid is true)
    const status = insertBooking.isPaid === true 
      ? BookingStatus.PAYMENT_SUCCESSFUL 
      : BookingStatus.PENDING_APPROVAL;
    
    console.log(`[MemStorage] Creating service booking with payment status: isPaid=${insertBooking.isPaid}, status=${status}`);
    
    const booking: ServiceBooking = {
      ...insertBooking,
      id,
      status: status,
      message: insertBooking.message || null,
      participants: insertBooking.participants || 1,
      location: insertBooking.location || null,
      paymentIntentId: insertBooking.paymentIntentId || null,
      // Use provided isPaid value or default to false
      isPaid: insertBooking.isPaid === true ? true : false,
      isRefunded: false,
      adminMessage: null,
      emailSent: false,
      createdAt: now,
      updatedAt: now,
    };
    
    console.log(`[MemStorage] Service booking created: ID=${id}, isPaid=${booking.isPaid}, status=${booking.status}`);
    this.serviceBookings.set(id, booking);
    return booking;
  }

  async updateServiceBooking(id: number, bookingData: Partial<ServiceBooking>): Promise<ServiceBooking | undefined> {
    const booking = this.serviceBookings.get(id);
    if (!booking) return undefined;

    const updatedBooking = {
      ...booking,
      ...bookingData,
      updatedAt: new Date(),
    };

    this.serviceBookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async deleteServiceBooking(id: number): Promise<boolean> {
    const booking = this.serviceBookings.get(id);
    if (!booking) return false;
    
    // Delete the booking
    this.serviceBookings.delete(id);
    return true;
  }

  async getServiceBookingsByUser(userId: number): Promise<ServiceBooking[]> {
    return Array.from(this.serviceBookings.values())
      .filter(booking => booking.userId === userId);
  }

  async getServiceBookingsByProvider(providerId: number): Promise<ServiceBooking[]> {
    return Array.from(this.serviceBookings.values())
      .filter(booking => booking.providerId === providerId);
  }

  async getServiceBookingsByService(serviceId: number): Promise<ServiceBooking[]> {
    return Array.from(this.serviceBookings.values())
      .filter(booking => booking.serviceId === serviceId);
  }

  async getServiceBookingsByStatus(status: string): Promise<ServiceBooking[]> {
    return Array.from(this.serviceBookings.values())
      .filter(booking => booking.status === status);
  }
  
  async getServiceBookingsByPaymentIntentId(paymentIntentId: string): Promise<ServiceBooking[]> {
    return Array.from(this.serviceBookings.values())
      .filter(booking => booking.paymentIntentId === paymentIntentId);
  }

  async getAllServiceBookings(): Promise<ServiceBooking[]> {
    return Array.from(this.serviceBookings.values());
  }

  async approveServiceBooking(id: number): Promise<ServiceBooking | undefined> {
    const booking = this.serviceBookings.get(id);
    if (!booking) return undefined;

    const updatedBooking = {
      ...booking,
      status: BookingStatus.APPROVED,
      updatedAt: new Date(),
    };

    this.serviceBookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async rejectServiceBooking(id: number, message?: string): Promise<ServiceBooking | undefined> {
    const booking = this.serviceBookings.get(id);
    if (!booking) return undefined;

    const updatedBooking = {
      ...booking,
      status: BookingStatus.REJECTED,
      adminMessage: message || null,
      updatedAt: new Date(),
    };

    this.serviceBookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async completeServiceBooking(id: number): Promise<ServiceBooking | undefined> {
    const booking = this.serviceBookings.get(id);
    if (!booking) return undefined;

    const updatedBooking = {
      ...booking,
      status: BookingStatus.COMPLETED,
      updatedAt: new Date(),
    };

    this.serviceBookings.set(id, updatedBooking);
    return updatedBooking;
  }

  async cancelServiceBooking(id: number, message?: string): Promise<ServiceBooking | undefined> {
    const booking = this.serviceBookings.get(id);
    if (!booking) return undefined;

    const updatedBooking = {
      ...booking,
      status: BookingStatus.CANCELLED,
      adminMessage: message || booking.adminMessage,
      updatedAt: new Date(),
    };

    this.serviceBookings.set(id, updatedBooking);
    return updatedBooking;
  }

  // Service Review Methods
  async getServiceReview(id: number): Promise<ServiceReview | undefined> {
    return this.serviceReviews.get(id);
  }

  async createServiceReview(insertReview: InsertServiceReview): Promise<ServiceReview> {
    const id = this.currentServiceReviewId++;
    const now = new Date();
    const review: ServiceReview = {
      ...insertReview,
      id,
      content: insertReview.content || null,
      createdAt: now,
      updatedAt: now,
    };
    this.serviceReviews.set(id, review);
    return review;
  }

  async getServiceReviewsByService(serviceId: number): Promise<ServiceReview[]> {
    return Array.from(this.serviceReviews.values())
      .filter(review => review.serviceId === serviceId);
  }

  async getServiceReviewsByProvider(providerId: number): Promise<ServiceReview[]> {
    return Array.from(this.serviceReviews.values())
      .filter(review => review.providerId === providerId);
  }

  async getServiceReviewsByUser(userId: number): Promise<ServiceReview[]> {
    return Array.from(this.serviceReviews.values())
      .filter(review => review.reviewerId === userId);
  }

  async getServiceReviewsByBooking(bookingId: number): Promise<ServiceReview[]> {
    return Array.from(this.serviceReviews.values())
      .filter(review => review.bookingId === bookingId);
  }

  // Provider Skills Methods
  async getProviderSkill(id: number): Promise<ProviderSkill | undefined> {
    return this.providerSkills.get(id);
  }

  async createProviderSkill(insertSkill: InsertProviderSkill): Promise<ProviderSkill> {
    const id = this.currentProviderSkillId++;
    const now = new Date();
    const skill: ProviderSkill = {
      ...insertSkill,
      id,
      yearsExperience: insertSkill.yearsExperience || null,
      level: insertSkill.level || null,
      isVerified: false,
      createdAt: now,
    };
    this.providerSkills.set(id, skill);
    return skill;
  }

  async getProviderSkillsByProvider(providerId: number): Promise<ProviderSkill[]> {
    return Array.from(this.providerSkills.values())
      .filter(skill => skill.providerId === providerId);
  }

  async getProviderSkillsByCategory(category: string): Promise<ProviderSkill[]> {
    return Array.from(this.providerSkills.values())
      .filter(skill => skill.category === category);
  }

  async verifyProviderSkill(id: number): Promise<ProviderSkill | undefined> {
    const skill = this.providerSkills.get(id);
    if (!skill) return undefined;

    const updatedSkill = {
      ...skill,
      isVerified: true,
    };

    this.providerSkills.set(id, updatedSkill);
    return updatedSkill;
  }

  // System Stats
  async createSystemStat(stat: InsertSystemStat): Promise<SystemStat> {
    const id = this.currentSystemStatId++;
    const now = new Date();
    const systemStat: SystemStat = {
      ...stat,
      id,
      statDate: now,
      userCount: stat.userCount || null,
      eventCount: stat.eventCount || null,
      ticketsSold: stat.ticketsSold || null,
      revenue: stat.revenue || null,
      activeUsers: stat.activeUsers || null,
      postCount: stat.postCount || null,
      flaggedContent: stat.flaggedContent || null,
      servicesBooked: stat.servicesBooked || null,
      serviceRevenue: stat.serviceRevenue || null,
      processingTime: stat.processingTime || null,
    };
    this.systemStats.set(id, systemStat);
    return systemStat;
  }

  async getLatestSystemStats(): Promise<SystemStat | undefined> {
    const stats = Array.from(this.systemStats.values())
      .sort((a, b) => new Date(b.statDate).getTime() - new Date(a.statDate).getTime());
    
    return stats.length > 0 ? stats[0] : undefined;
  }

  async getSystemStatsByDateRange(startDate: Date, endDate: Date): Promise<SystemStat[]> {
    return Array.from(this.systemStats.values())
      .filter(stat => {
        const statDate = new Date(stat.statDate);
        return statDate >= startDate && statDate <= endDate;
      })
      .sort((a, b) => new Date(a.statDate).getTime() - new Date(b.statDate).getTime());
  }
  
  async updateSystemStat(id: number, data: Partial<SystemStat>): Promise<SystemStat | undefined> {
    const stat = this.systemStats.get(id);
    if (!stat) return undefined;
    
    const updatedStat = {
      ...stat,
      ...data,
      updatedAt: new Date()
    };
    
    this.systemStats.set(id, updatedStat);
    return updatedStat;
  }

  async updateDailyStats(): Promise<SystemStat> {
    const now = new Date();
    const userCount = this.users.size;
    const eventCount = this.events.size;
    const ticketsSold = this.tickets.size;
    const revenue = Array.from(this.tickets.values()).reduce((sum, ticket) => sum + (ticket.purchaseAmount || 0), 0);
    const activeUsers = this.users.size; // In a real app, would count active sessions
    const postCount = this.posts.size;
    const flaggedContent = Array.from(this.contentFlags.values()).filter(flag => flag.status === ContentFlagStatus.PENDING).length;
    
    // Service marketplace stats
    const servicesBooked = this.serviceBookings.size;
    const serviceRevenue = Array.from(this.serviceBookings.values())
      .filter(booking => booking.isPaid && !booking.isRefunded)
      .reduce((sum, booking) => sum + (booking.amount || 0), 0);
    
    const systemStat = await this.createSystemStat({
      userCount,
      eventCount,
      ticketsSold,
      revenue: revenue.toString(),
      activeUsers,
      postCount,
      flaggedContent,
      servicesBooked,
      serviceRevenue: serviceRevenue.toString(),
      processingTime: "100",
    });
    
    return systemStat;
  }

  async getRealTimeAdminStats(): Promise<{
    totalUsers: number;
    newUsers: number;
    activeEvents: number;
    pendingEvents: number;
    totalPosts: number;
    totalComments: number;
    totalLikes: number;
    totalRsvps: number;
    flaggedContent: number;
    totalRevenue: number;
    ticketRevenue: number;
    serviceRevenue: number;
    ticketsSold: number;
  }> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Ticket revenue in cents
    const ticketRevenueCents = Array.from(this.tickets.values()).reduce((sum, ticket) => sum + (ticket.purchaseAmount || 0), 0);
    
    // Service revenue - totalPrice is stored in dollars (not cents)
    const serviceRevenueDollars = Array.from(this.serviceBookings.values())
      .filter(booking => booking.isPaid && !booking.isRefunded)
      .reduce((sum, booking) => sum + (parseFloat(String(booking.totalPrice)) || 0), 0);
    
    const newUsers = Array.from(this.users.values()).filter(user => {
      const createdAt = user.createdAt;
      return createdAt && new Date(createdAt) >= thirtyDaysAgo;
    }).length;
    
    // Convert tickets from cents to dollars, service is already in dollars
    const ticketRevenue = ticketRevenueCents / 100;
    const serviceRevenue = serviceRevenueDollars;
    const totalRevenue = ticketRevenue + serviceRevenue;
    
    return {
      totalUsers: this.users.size,
      newUsers,
      activeEvents: Array.from(this.events.values()).filter(e => new Date(e.date) >= now).length,
      pendingEvents: Array.from(this.events.values()).filter(e => e.status === 'pending').length,
      totalPosts: this.posts.size,
      totalComments: this.comments.size,
      totalLikes: this.likes.size,
      totalRsvps: this.rsvps.size,
      flaggedContent: Array.from(this.contentFlags.values()).filter(flag => flag.status === ContentFlagStatus.PENDING).length,
      totalRevenue,
      ticketRevenue,
      serviceRevenue,
      ticketsSold: this.tickets.size,
    };
  }

  async getRevenueForPeriod(startDate: Date, endDate: Date): Promise<number> {
    // Ticket revenue in cents
    const ticketRevenueCents = Array.from(this.tickets.values())
      .filter(ticket => {
        const purchasedAt = ticket.purchasedAt;
        return purchasedAt && new Date(purchasedAt) >= startDate && new Date(purchasedAt) <= endDate;
      })
      .reduce((sum, ticket) => sum + (ticket.purchaseAmount || 0), 0);
    
    // Service revenue - totalPrice is in dollars
    const serviceRevenueDollars = Array.from(this.serviceBookings.values())
      .filter(booking => {
        const createdAt = booking.createdAt;
        return booking.isPaid && !booking.isRefunded && createdAt && new Date(createdAt) >= startDate && new Date(createdAt) <= endDate;
      })
      .reduce((sum, booking) => sum + (parseFloat(String(booking.totalPrice)) || 0), 0);
    
    return (ticketRevenueCents / 100) + serviceRevenueDollars;
  }

  // Friend-related methods removed
  
  // Legal Content Methods
  async getLegalContent(id: number): Promise<LegalContent | undefined> {
    return this.legalContents.get(id);
  }

  async getLegalContentByType(type: string, language?: string): Promise<LegalContent | undefined> {
    const lang = language || "en";
    return Array.from(this.legalContents.values()).find(
      content => content.type === type && content.language === lang
    );
  }

  async getActiveLegalContentByType(type: string, language?: string): Promise<LegalContent | undefined> {
    const lang = language || "en";
    return Array.from(this.legalContents.values()).find(
      content => content.type === type && content.language === lang && content.isActive
    );
  }

  async getAllLegalContent(): Promise<LegalContent[]> {
    return Array.from(this.legalContents.values());
  }

  async createLegalContent(content: InsertLegalContent): Promise<LegalContent> {
    const id = this.nextLegalContentId++;
    const now = new Date();
    const newContent: LegalContent = {
      id,
      type: content.type,
      title: content.title,
      content: content.content,
      language: content.language || "en",
      version: content.version,
      isActive: content.isActive === undefined ? true : content.isActive,
      createdAt: now,
      updatedAt: null,
      publishedAt: content.isActive ? now : null
    };
    this.legalContents.set(id, newContent);
    return newContent;
  }

  async updateLegalContent(id: number, data: Partial<LegalContent>): Promise<LegalContent | undefined> {
    const existingContent = this.legalContents.get(id);
    if (!existingContent) return undefined;

    const updatedContent = {
      ...existingContent,
      ...data,
      updatedAt: new Date()
    };
    this.legalContents.set(id, updatedContent);
    return updatedContent;
  }

  async publishLegalContent(id: number): Promise<LegalContent | undefined> {
    const existingContent = this.legalContents.get(id);
    if (!existingContent) return undefined;

    // Set all other content of the same type and language to inactive
    for (const [contentId, content] of this.legalContents.entries()) {
      if (content.type === existingContent.type && content.language === existingContent.language && content.id !== id) {
        this.legalContents.set(contentId, {
          ...content,
          isActive: false,
          updatedAt: new Date()
        });
      }
    }

    // Set the target content to active and published
    const publishedContent = {
      ...existingContent,
      isActive: true,
      publishedAt: new Date(),
      updatedAt: new Date()
    };
    this.legalContents.set(id, publishedContent);
    return publishedContent;
  }

  // Terms of Service Methods
  async getTermsOfService(id: number): Promise<TermsOfService | undefined> {
    return this.termsOfServices.get(id);
  }

  async getActiveTermsOfService(): Promise<TermsOfService | undefined> {
    return Array.from(this.termsOfServices.values()).find(
      terms => terms.isActive
    );
  }

  async getAllTermsOfService(): Promise<TermsOfService[]> {
    return Array.from(this.termsOfServices.values());
  }

  async createTermsOfService(terms: InsertTermsOfService): Promise<TermsOfService> {
    const id = this.currentTermsOfServiceId++;
    const now = new Date();
    const newTerms: TermsOfService = {
      id,
      version: terms.version,
      content: terms.content,
      isActive: terms.isActive === undefined ? false : terms.isActive,
      createdAt: now,
      publishedAt: terms.isActive ? now : null,
    };
    this.termsOfServices.set(id, newTerms);
    return newTerms;
  }

  async updateTermsOfService(id: number, data: Partial<TermsOfService>): Promise<TermsOfService | undefined> {
    const existingTerms = this.termsOfServices.get(id);
    if (!existingTerms) return undefined;

    const updatedTerms = {
      ...existingTerms,
      ...data,
    };
    this.termsOfServices.set(id, updatedTerms);
    return updatedTerms;
  }

  async activateTermsOfService(id: number): Promise<TermsOfService | undefined> {
    const existingTerms = this.termsOfServices.get(id);
    if (!existingTerms) return undefined;

    // Set all other terms to inactive
    for (const [termsId, terms] of this.termsOfServices.entries()) {
      if (termsId !== id) {
        this.termsOfServices.set(termsId, {
          ...terms,
          isActive: false,
        });
      }
    }

    // Set the target terms to active
    const activatedTerms = {
      ...existingTerms,
      isActive: true,
      publishedAt: new Date(),
    };
    this.termsOfServices.set(id, activatedTerms);
    return activatedTerms;
  }

  async deactivateTermsOfService(id: number): Promise<TermsOfService | undefined> {
    const existingTerms = this.termsOfServices.get(id);
    if (!existingTerms) return undefined;

    const deactivatedTerms = {
      ...existingTerms,
      isActive: false,
    };
    this.termsOfServices.set(id, deactivatedTerms);
    return deactivatedTerms;
  }

  // Explore Page Images Methods
  async getExplorePageImage(id: number): Promise<ExplorePageImage | undefined> {
    return this.explorePageImages.get(id);
  }

  async getExplorePageImages(): Promise<ExplorePageImage[]> {
    return Array.from(this.explorePageImages.values());
  }

  async getExplorePageImagesBySection(section: string): Promise<ExplorePageImage[]> {
    return Array.from(this.explorePageImages.values())
      .filter(image => image.section === section)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createExplorePageImage(image: InsertExplorePageImage): Promise<ExplorePageImage> {
    const id = this.currentExplorePageImageId++;
    const now = new Date();
    
    const newImage: ExplorePageImage = {
      ...image,
      id,
      createdAt: now,
      updatedAt: now,
      isActive: image.isActive !== undefined ? image.isActive : true,
      sortOrder: image.sortOrder !== undefined ? image.sortOrder : 0
    };
    
    this.explorePageImages.set(id, newImage);
    return newImage;
  }

  async updateExplorePageImage(id: number, updates: Partial<InsertExplorePageImage>): Promise<ExplorePageImage | undefined> {
    const image = this.explorePageImages.get(id);
    if (!image) {
      return undefined;
    }

    const now = new Date();
    const updatedImage: ExplorePageImage = {
      ...image,
      ...updates,
      updatedAt: now
    };

    this.explorePageImages.set(id, updatedImage);
    return updatedImage;
  }

  async deleteExplorePageImage(id: number): Promise<ExplorePageImage | undefined> {
    const image = this.explorePageImages.get(id);
    if (!image) {
      return undefined;
    }

    this.explorePageImages.delete(id);
    return image;
  }

  // Legal Consent Methods
  async getUserConsent(userId: number): Promise<LegalConsent | undefined> {
    return this.legalConsents.get(userId);
  }

  async recordUserConsent(consent: InsertLegalConsent): Promise<LegalConsent> {
    const id = this.nextLegalConsentId++;
    const now = new Date();
    const newConsent: LegalConsent = {
      id,
      userId: consent.userId,
      termsAccepted: consent.termsAccepted,
      privacyAccepted: consent.privacyAccepted,
      termsAcceptedAt: consent.termsAcceptedAt || null,
      privacyAcceptedAt: consent.privacyAcceptedAt || null,
      ipAddress: consent.ipAddress || null,
      userAgent: consent.userAgent || null,
      createdAt: now,
      updatedAt: null
    };
    this.legalConsents.set(consent.userId, newConsent);
    return newConsent;
  }

  async updateUserConsent(userId: number, data: Partial<LegalConsent>): Promise<LegalConsent | undefined> {
    const existingConsent = this.legalConsents.get(userId);
    if (!existingConsent) return undefined;

    const updatedConsent = {
      ...existingConsent,
      ...data,
      updatedAt: new Date()
    };
    this.legalConsents.set(userId, updatedConsent);
    return updatedConsent;
  }

  // Data Deletion Request Methods
  async createDataDeletionRequest(request: InsertDataDeletionRequest): Promise<DataDeletionRequest> {
    const id = this.nextDataDeletionRequestId++;
    const now = new Date();
    const newRequest: DataDeletionRequest = {
      id,
      userId: request.userId,
      reason: request.reason || null,
      status: "pending",
      adminNotes: null,
      processedBy: null,
      processedAt: null,
      createdAt: now,
      updatedAt: null
    };
    this.dataDeletionRequests.set(id, newRequest);
    return newRequest;
  }

  async getDataDeletionRequest(id: number): Promise<DataDeletionRequest | undefined> {
    return this.dataDeletionRequests.get(id);
  }

  async getDataDeletionRequestsByUser(userId: number): Promise<DataDeletionRequest[]> {
    return Array.from(this.dataDeletionRequests.values()).filter(
      request => request.userId === userId
    );
  }

  async getAllDataDeletionRequests(): Promise<DataDeletionRequest[]> {
    return Array.from(this.dataDeletionRequests.values());
  }

  async getDataDeletionRequestsByStatus(status: string): Promise<DataDeletionRequest[]> {
    return Array.from(this.dataDeletionRequests.values()).filter(
      request => request.status === status
    );
  }
  
  async updateDataDeletionRequest(id: number, request: Partial<DataDeletionRequest>): Promise<DataDeletionRequest | undefined> {
    const existingRequest = this.dataDeletionRequests.get(id);
    if (!existingRequest) return undefined;
    
    const updatedRequest = {
      ...existingRequest,
      ...request,
      updatedAt: new Date()
    };
    
    this.dataDeletionRequests.set(id, updatedRequest);
    return updatedRequest;
  }

  async processDataDeletionRequest(id: number, adminId: number, approved: boolean, notes?: string): Promise<DataDeletionRequest | undefined> {
    const existingRequest = this.dataDeletionRequests.get(id);
    if (!existingRequest) return undefined;

    const now = new Date();
    const updatedRequest = {
      ...existingRequest,
      status: approved ? "approved" : "rejected",
      adminNotes: notes || null,
      processedBy: adminId,
      processedAt: now,
      updatedAt: now
    };
    this.dataDeletionRequests.set(id, updatedRequest);
    return updatedRequest;
  }

  // Live Results Viewers - stub implementations for MemStorage
  async createLiveResultsViewer(data: InsertLiveResultsViewer): Promise<LiveResultsViewer> {
    throw new Error("Live results viewers not implemented in MemStorage");
  }

  async getLiveResultsViewersByEvent(eventId: number): Promise<LiveResultsViewer[]> {
    return [];
  }

  async getLiveResultsViewerByUserAndEvent(userId: number, eventId: number): Promise<LiveResultsViewer | undefined> {
    return undefined;
  }

  async revokeLiveResultsViewer(id: number): Promise<boolean> {
    return false;
  }

  async isUserLiveResultsViewer(userId: number, eventId: number): Promise<boolean> {
    return false;
  }

  async getProximitySettings(userId: number): Promise<ProximitySettings | undefined> { return undefined; }
  async upsertProximitySettings(userId: number, settings: Partial<InsertProximitySettings>): Promise<ProximitySettings> { throw new Error("Not implemented"); }
  async updateUserPresence(userId: number, lat: number, lng: number, city?: string): Promise<UserPresence> { throw new Error("Not implemented"); }
  async deleteUserPresence(userId: number): Promise<void> {}
  async getNearbyUsers(userId: number, coarseLat: string, coarseLng: string, radiusKm: number, visibilityMode?: string): Promise<any[]> { return []; }
  async recordDiscoveryAction(userId: number, discoveredUserId: number, action: string): Promise<any> { throw new Error("Not implemented"); }
  async getDiscoverySuggestions(userId: number, coarseLat: string, coarseLng: string, radiusKm: number, limit?: number): Promise<any[]> { return []; }
  async getTrustedContacts(userId: number): Promise<any[]> { return []; }
  async addTrustedContact(userId: number, contactUserId: number): Promise<TrustedContact> { throw new Error("Not implemented"); }
  async confirmTrustedContact(contactId: number, contactUserId: number): Promise<TrustedContact | undefined> { return undefined; }
  async removeTrustedContact(contactId: number, userId: number): Promise<boolean> { return false; }
  async createSafetyBroadcast(broadcast: InsertSafetyBroadcast): Promise<SafetyBroadcast> { throw new Error("Not implemented"); }
  async getActiveSafetyBroadcasts(userId: number): Promise<SafetyBroadcast[]> { return []; }
  async deactivateSafetyBroadcast(broadcastId: number, userId: number): Promise<boolean> { return false; }
  async getFundingSources(): Promise<FundingSource[]> { return []; }
  async getFundingSource(id: number): Promise<FundingSource | undefined> { return undefined; }
  async createFundingSource(source: InsertFundingSource): Promise<FundingSource> { throw new Error("Not implemented in MemStorage"); }
  async updateFundingSource(id: number, data: Partial<FundingSource>): Promise<FundingSource | undefined> { return undefined; }
  async deleteFundingSource(id: number): Promise<boolean> { return false; }
  async getFundingOpportunities(): Promise<FundingOpportunity[]> { return []; }
  async getFundingOpportunity(id: number): Promise<FundingOpportunity | undefined> { return undefined; }
  async createFundingOpportunity(opp: InsertFundingOpportunity): Promise<FundingOpportunity> { throw new Error("Not implemented in MemStorage"); }
  async updateFundingOpportunity(id: number, data: Partial<FundingOpportunity>): Promise<FundingOpportunity | undefined> { return undefined; }
  async deleteFundingOpportunity(id: number): Promise<boolean> { return false; }
  async getFundingStats(): Promise<{ total: number; published: number; draft: number; expired: number; needsReview: number; duplicates: number }> { return { total: 0, published: 0, draft: 0, expired: 0, needsReview: 0, duplicates: 0 }; }
  async fundingDataExists(): Promise<boolean> { return false; }
  async savePushToken(_userId: number, _token: string, _platform?: string): Promise<void> {}
  async removePushToken(_userId: number, _token: string): Promise<void> {}
  async getPushTokensForUser(_userId: number): Promise<string[]> { return []; }
  async getAllPushDevices(): Promise<any[]> { return []; }
  async getPushDeviceStats(): Promise<{ total: number; ios: number; android: number; web: number; recentWeek: number }> { return { total: 0, ios: 0, android: 0, web: 0, recentWeek: 0 }; }
  async removePushTokenById(_id: number): Promise<void> {}
  async logPushNotification(_log: any): Promise<PushNotificationLog> { throw new Error("Not implemented"); }
  async getPushNotificationLogs(_limit?: number): Promise<PushNotificationLog[]> { return []; }
  async getAllUserIdsWithTokens(): Promise<number[]> { return []; }
  async getUserIdsWithTokensBySegment(_segment: string): Promise<number[]> { return []; }

  async createReel(_data: InsertReel): Promise<Reel> { throw new Error("Not implemented"); }
  async getReel(_id: number): Promise<Reel | undefined> { return undefined; }
  async getReelsFeed(_page?: number, _limit?: number, _requestingUserId?: number): Promise<any[]> { return []; }
  async getUserReels(_userId: number, _requestingUserId?: number): Promise<any[]> { return []; }
  async deleteReel(_id: number): Promise<boolean> { return false; }
  async incrementReelViews(_id: number): Promise<void> {}
  async incrementReelShares(_id: number): Promise<void> {}
  async toggleReelLike(_reelId: number, _userId: number): Promise<{ liked: boolean; likesCount: number }> { return { liked: false, likesCount: 0 }; }
  async getReelComments(_reelId: number): Promise<any[]> { return []; }
  async toggleReelStatus(_id: number, _status: "active" | "disabled"): Promise<any> { return {}; }
  async adminGetAllReels(): Promise<any[]> { return []; }
  async createReelComment(_data: InsertReelComment): Promise<ReelComment> { throw new Error("Not implemented"); }
  async deleteReelComment(_id: number, _userId: number): Promise<boolean> { return false; }

  // Back to the Street — MemStorage stubs
  async getBttsProgram(): Promise<any[]> { return []; }
  async createBttsProgramItem(_data: any): Promise<any> { throw new Error("Not implemented"); }
  async updateBttsProgramItem(_id: number, _data: any): Promise<any> { return undefined; }
  async deleteBttsProgramItem(_id: number): Promise<boolean> { return false; }
  async getBttsLineup(): Promise<any[]> { return []; }
  async createBttsLineupMember(_data: any): Promise<any> { throw new Error("Not implemented"); }
  async updateBttsLineupMember(_id: number, _data: any): Promise<any> { return undefined; }
  async deleteBttsLineupMember(_id: number): Promise<boolean> { return false; }
  async getBttsBattles(): Promise<any[]> { return []; }
  async createBttsBattle(_data: any): Promise<any> { throw new Error("Not implemented"); }
  async updateBttsBattle(_id: number, _data: any): Promise<any> { return undefined; }
  async deleteBttsBattle(_id: number): Promise<boolean> { return false; }
  async getBttsGallery(): Promise<any[]> { return []; }
  async createBttsGalleryItem(_data: any): Promise<any> { throw new Error("Not implemented"); }
  async updateBttsGalleryItem(_id: number, _data: any): Promise<any> { return undefined; }
  async deleteBttsGalleryItem(_id: number): Promise<boolean> { return false; }
  // Founder Profile — MemStorage stubs
  async getFounderProfile(): Promise<any[]> { return []; }
  async upsertFounderProfileSection(_key: string, _label: string, _content: string, _sortOrder?: number): Promise<any> { throw new Error("Not implemented"); }
  // AI Training — MemStorage stubs
  async getAiTrainingEntries(_includeInactive?: boolean): Promise<any[]> { return []; }
  async getPublicAiTrainingEntries(): Promise<any[]> { return []; }
  async createAiTrainingEntry(_data: any): Promise<any> { throw new Error("Not implemented"); }
  async updateAiTrainingEntry(_id: number, _data: any): Promise<any> { throw new Error("Not implemented"); }
  async deleteAiTrainingEntry(_id: number): Promise<boolean> { return false; }
}

// PostgreSQL Database Storage Implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }
  
  // Helper method to handle undefined values in array fields for PostgreSQL
  private ensureArrayField(field: any[] | undefined): any[] {
    return field || [];
  }

  // Contact Submission Methods
  async createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission> {
    const now = new Date();
    const [newSubmission] = await db.insert(contactSubmissions).values({
      name: submission.name,
      email: submission.email,
      subject: submission.subject,
      message: submission.message,
      category: submission.category,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      adminId: null,
      adminNotes: null,
      resolvedAt: null
    }).returning();
    
    return newSubmission;
  }

  async getContactSubmission(id: number): Promise<ContactSubmission | undefined> {
    const [submission] = await db.select().from(contactSubmissions).where(eq(contactSubmissions.id, id));
    return submission;
  }

  async getAllContactSubmissions(): Promise<ContactSubmission[]> {
    return await db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }

  async getUnresolvedContactSubmissions(): Promise<ContactSubmission[]> {
    return await db.select().from(contactSubmissions)
      .where(eq(contactSubmissions.status, "pending"))
      .orderBy(desc(contactSubmissions.createdAt));
  }

  async getContactSubmissionsByStatus(status: string): Promise<ContactSubmission[]> {
    return await db.select().from(contactSubmissions)
      .where(eq(contactSubmissions.status, status))
      .orderBy(desc(contactSubmissions.createdAt));
  }

  async updateContactSubmission(id: number, data: Partial<ContactSubmission>): Promise<ContactSubmission | undefined> {
    const now = new Date();
    const [updatedSubmission] = await db.update(contactSubmissions)
      .set({
        ...data,
        updatedAt: now
      })
      .where(eq(contactSubmissions.id, id))
      .returning();
    
    return updatedSubmission;
  }

  async resolveContactSubmission(id: number, adminId: number, notes?: string): Promise<ContactSubmission | undefined> {
    const now = new Date();
    const [resolvedSubmission] = await db.update(contactSubmissions)
      .set({
        status: "resolved",
        adminId,
        adminNotes: notes || null,
        resolvedAt: now,
        updatedAt: now
      })
      .where(eq(contactSubmissions.id, id))
      .returning();
    
    return resolvedSubmission;
  }

  // User Methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  
  async getUserByFirebaseUid(uid: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.firebaseUid, uid));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const userData = {
      ...insertUser,
      password: insertUser.password || null,
      bio: insertUser.bio || null,
      profilePicture: insertUser.profilePicture || null,
      artType: insertUser.artType || null,
      organizationName: insertUser.organizationName || null,
      kvkNumber: insertUser.kvkNumber || null,
      location: insertUser.location || null,
      firebaseUid: insertUser.firebaseUid || null,
      createdAt: now,
      updatedAt: now,
      isVerified: false,
      isApproved: insertUser.role === "enthusiast" || insertUser.role === "artist",
    };
    
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }

  // Get all active users for admin broadcast
  async getActiveUsers(): Promise<User[]> {
    try {
      return await db.select()
        .from(users)
        .where(eq(users.status, 'active'));
    } catch (error) {
      console.error("Error getting active users:", error);
      return [];
    }
  }

  // Get event organizers (users who have created events)
  async getEventOrganizers(): Promise<User[]> {
    try {
      // Get distinct organizer IDs from events
      const eventOrganizers = await db.selectDistinct({ organizerId: events.organizerId })
        .from(events)
        .where(not(isNull(events.organizerId)));
      
      if (eventOrganizers.length === 0) return [];
      
      // Extract unique organizer IDs
      const organizerIds = [...new Set(eventOrganizers.map(e => e.organizerId).filter((id): id is number => id !== null))];
      
      if (organizerIds.length === 0) return [];
      
      // Get users who are organizers and are active
      return await db.select()
        .from(users)
        .where(and(
          inArray(users.id, organizerIds),
          eq(users.status, 'active')
        ));
    } catch (error) {
      console.error("Error getting event organizers:", error);
      return [];
    }
  }

  // Search users by display name or email for chat
  async searchUsers(query: string): Promise<User[]> {
    try {
      const lowerQuery = `%${query.toLowerCase()}%`;
      return await db.select()
        .from(users)
        .where(
          or(
            ilike(users.displayName, lowerQuery),
            ilike(users.email, lowerQuery)
          )
        )
        .limit(20);
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    }
  }

  // User Follows Methods
  async followUser(follow: InsertUserFollow): Promise<UserFollow> {
    const now = new Date();
    const [userFollow] = await db.insert(userFollows).values({
      followerId: follow.followerId,
      followedId: follow.followedId,
      status: follow.status || "active",
      createdAt: now,
      updatedAt: now
    }).returning();
    
    return userFollow;
  }
  
  async unfollowUser(followerId: number, followedId: number): Promise<boolean> {
    const result = await db.delete(userFollows)
      .where(and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followedId, followedId)
      ))
      .returning();
    
    return result.length > 0;
  }
  
  async getFollowersByUserId(userId: number): Promise<UserFollow[]> {
    return await db.select().from(userFollows)
      .where(eq(userFollows.followedId, userId));
  }
  
  async getFollowingByUserId(userId: number): Promise<UserFollow[]> {
    return await db.select().from(userFollows)
      .where(eq(userFollows.followerId, userId));
  }
  
  async isUserFollowing(followerId: number, followedId: number): Promise<boolean> {
    const follows = await db.select().from(userFollows)
      .where(and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followedId, followedId),
        eq(userFollows.status, "active")
      ));
    
    return follows.length > 0;
  }

  async getFollowStatus(followerId: number, followedId: number): Promise<UserFollow | undefined> {
    const [follow] = await db.select().from(userFollows)
      .where(and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followedId, followedId)
      ));
    return follow;
  }
  
  async updateFollowStatus(id: number, status: string): Promise<UserFollow | undefined> {
    const [updatedFollow] = await db.update(userFollows)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(userFollows.id, id))
      .returning();
    
    return updatedFollow;
  }

  // Location Methods
  async getLocation(id: number): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }
  
  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const now = new Date();
    const locationData = {
      ...insertLocation,
      description: insertLocation.description || null,
      address: insertLocation.address || null,
      images: insertLocation.images || null,
      createdBy: insertLocation.createdBy || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [location] = await db.insert(locations).values(locationData).returning();
    return location;
  }
  
  async updateLocation(id: number, data: Partial<Location>): Promise<Location | undefined> {
    const now = new Date();
    const updateData = {
      ...data,
      updatedAt: now
    };
    
    const [updatedLocation] = await db.update(locations)
      .set(updateData)
      .where(eq(locations.id, id))
      .returning();
      
    return updatedLocation;
  }
  
  async getAllLocations(): Promise<Location[]> {
    return await db.select().from(locations);
  }
  
  async getVisibleLocations(): Promise<Location[]> {
    return await db.select().from(locations)
      .where(and(
        eq(locations.isVisible, true),
        eq(locations.approvalStatus, 'approved')
      ));
  }
  
  async getPendingLocations(): Promise<Location[]> {
    return await db.select().from(locations)
      .where(eq(locations.approvalStatus, 'pending'));
  }
  
  async approveLocation(id: number, adminId: number): Promise<Location | undefined> {
    const now = new Date();
    const [updatedLocation] = await db.update(locations)
      .set({
        approvalStatus: 'approved',
        approvedBy: adminId,
        approvedAt: now,
        updatedAt: now
      })
      .where(eq(locations.id, id))
      .returning();
    
    return updatedLocation;
  }
  
  async rejectLocation(id: number, adminId: number, reason: string): Promise<Location | undefined> {
    const now = new Date();
    const [updatedLocation] = await db.update(locations)
      .set({
        approvalStatus: 'rejected',
        approvedBy: adminId,
        rejectionReason: reason,
        updatedAt: now
      })
      .where(eq(locations.id, id))
      .returning();
    
    return updatedLocation;
  }
  
  async toggleLocationVisibility(id: number, isVisible: boolean): Promise<Location | undefined> {
    const now = new Date();
    const [updatedLocation] = await db.update(locations)
      .set({
        isVisible,
        updatedAt: now
      })
      .where(eq(locations.id, id))
      .returning();
    
    return updatedLocation;
  }
  
  async getSavedLocationsByUser(userId: number): Promise<Location[]> {
    const result = await db
      .select({
        location: locations
      })
      .from(savedLocations)
      .innerJoin(locations, eq(savedLocations.locationId, locations.id))
      .where(eq(savedLocations.userId, userId));
    
    return result.map(r => r.location);
  }
  
  async saveLocation(insertSavedLocation: InsertSavedLocation): Promise<SavedLocation> {
    const now = new Date();
    const savedLocationData = {
      ...insertSavedLocation,
      userId: insertSavedLocation.userId || null,
      locationId: insertSavedLocation.locationId || null,
      createdAt: now,
    };
    
    const [savedLocation] = await db.insert(savedLocations).values(savedLocationData).returning();
    return savedLocation;
  }
  
  async deleteLocation(id: number): Promise<boolean> {
    // First delete related saved locations
    await db.delete(savedLocations).where(eq(savedLocations.locationId, id));
    
    // Then delete the location
    const result = await db.delete(locations).where(eq(locations.id, id)).returning();
    return result.length > 0;
  }
  
  async getLocationsByCreator(userId: number): Promise<Location[]> {
    return await db.select().from(locations)
      .where(eq(locations.createdBy, userId))
      .orderBy(desc(locations.createdAt));
  }

  // Event Methods
  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }
  
  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const now = new Date();
    const eventData = {
      ...insertEvent,
      description: insertEvent.description || null,
      latitude: insertEvent.latitude || null,
      longitude: insertEvent.longitude || null,
      image: insertEvent.image || null,
      price: insertEvent.price || null,
      organizerId: insertEvent.organizerId || null,
      status: insertEvent.status || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [event] = await db.insert(events).values(eventData).returning();
    return event;
  }
  
  async getAllEvents(): Promise<Event[]> {
    return await db.select().from(events);
  }
  
  async getEventsByCategory(category: string): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.category, category));
  }
  
  async getEventsByUser(userId: number): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.organizerId, userId));
  }
  
  async updateEvent(id: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, id));
    
    if (!event) return undefined;
    
    // Format date properly if it exists in the eventData
    const processedEventData = { ...eventData };
    
    console.log("Raw event data for update:", processedEventData);
    
    // Handle date if present - ensure it's a proper Date object
    if (processedEventData.date) {
      try {
        // If it's already a Date object, this is a no-op
        // If it's a string, it will be converted to a Date
        if (!(processedEventData.date instanceof Date)) {
          console.log("Converting date from", processedEventData.date, "type:", typeof processedEventData.date);
          processedEventData.date = new Date(processedEventData.date);
          console.log("Converted date to", processedEventData.date);
        }
      } catch (err) {
        console.error("Error converting date:", err);
        // Keep the original date from the database if conversion fails
        processedEventData.date = event.date;
      }
    }
    
    // Make sure we don't have any invalid data formats
    for (const key in processedEventData) {
      if (processedEventData[key] === undefined) {
        delete processedEventData[key];
      }
    }
    
    console.log("Processed event data for update:", processedEventData);
    
    const [updatedEvent] = await db
      .update(events)
      .set({
        ...processedEventData,
        updatedAt: new Date()
      })
      .where(eq(events.id, id))
      .returning();
    
    return updatedEvent;
  }
  
  async deleteEvent(id: number): Promise<boolean> {
    try {
      const eventCategoryRows = await db
        .select({ id: eventCategories.id })
        .from(eventCategories)
        .where(eq(eventCategories.eventId, id));
      const categoryIds = eventCategoryRows.map((c) => c.id);

      if (categoryIds.length > 0) {
        const battleJudgeRows = await db
          .select({ id: battleJudges.id })
          .from(battleJudges)
          .where(inArray(battleJudges.categoryId, categoryIds));
        const judgeIds = battleJudgeRows.map((j) => j.id);

        if (judgeIds.length > 0) {
          await db
            .delete(battleVotes)
            .where(inArray(battleVotes.judgeId, judgeIds));
        }

        await db
          .delete(battleJudges)
          .where(inArray(battleJudges.categoryId, categoryIds));

        await db
          .delete(liveResultsViewers)
          .where(inArray(liveResultsViewers.categoryId, categoryIds));
      }

      const matchupRows = await db
        .select({ id: battleMatchups.id })
        .from(battleMatchups)
        .where(eq(battleMatchups.eventId, id));
      const matchupIds = matchupRows.map((m) => m.id);

      if (matchupIds.length > 0) {
        await db
          .delete(battleVotes)
          .where(inArray(battleVotes.matchupId, matchupIds));
      }

      await db
        .delete(battleMatchups)
        .where(eq(battleMatchups.eventId, id));

      await db
        .delete(dancerRegistrations)
        .where(eq(dancerRegistrations.eventId, id));

      await db
        .delete(liveResultsViewers)
        .where(eq(liveResultsViewers.eventId, id));

      await db
        .delete(eventCategories)
        .where(eq(eventCategories.eventId, id));

      await db
        .delete(tickets)
        .where(eq(tickets.eventId, id));

      await db
        .delete(eventTicketTypes)
        .where(eq(eventTicketTypes.eventId, id));

      await db
        .delete(rsvps)
        .where(eq(rsvps.eventId, id));

      const result = await db
        .delete(events)
        .where(eq(events.id, id));

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  }

  // Extended Event Methods
  async getFilteredEvents(filters: EventFilters): Promise<Event[]> {
    const conditions: any[] = [];
    conditions.push(eq(events.status, "approved"));
    if (filters.category) conditions.push(eq(events.category, filters.category));
    if (filters.city) conditions.push(ilike(events.city, `%${filters.city}%`));
    if (filters.priceModel) conditions.push(eq(events.priceModel, filters.priceModel));
    if (filters.kidFriendly) conditions.push(eq(events.kidFriendly, true));
    if (filters.familyFriendly) conditions.push(eq(events.familyFriendly, true));
    if (filters.isIndoor !== undefined) conditions.push(eq(events.isIndoor, filters.isIndoor));
    if (filters.isFeatured) conditions.push(eq(events.isFeatured, true));
    if (filters.isTrending) conditions.push(eq(events.isTrending, true));
    if (filters.dateFrom) conditions.push(gte(events.date, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(events.date, filters.dateTo));
    if (filters.search) {
      conditions.push(or(
        ilike(events.title, `%${filters.search}%`),
        ilike(events.description, `%${filters.search}%`),
        ilike(events.location, `%${filters.search}%`)
      ));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    let query = db.select().from(events);
    if (whereClause) query = query.where(whereClause) as any;
    
    const sortBy = filters.sortBy || "soonest";
    if (sortBy === "newest") query = query.orderBy(desc(events.createdAt)) as any;
    else if (sortBy === "soonest") query = query.orderBy(asc(events.date)) as any;
    else if (sortBy === "popular") query = query.orderBy(desc(events.attendeeCount)) as any;
    else if (sortBy === "price_asc") query = query.orderBy(asc(events.price)) as any;
    else if (sortBy === "price_desc") query = query.orderBy(desc(events.price)) as any;
    else query = query.orderBy(asc(events.date)) as any;
    
    if (filters.limit) query = query.limit(filters.limit) as any;
    if (filters.offset) query = query.offset(filters.offset) as any;
    return await query;
  }

  async getFeaturedEvents(): Promise<Event[]> {
    return await db.select().from(events)
      .where(and(eq(events.isFeatured, true), eq(events.status, "approved")))
      .orderBy(desc(events.date))
      .limit(10);
  }

  async getTrendingEvents(): Promise<Event[]> {
    return await db.select().from(events)
      .where(and(eq(events.isTrending, true), eq(events.status, "approved")))
      .orderBy(desc(events.attendeeCount))
      .limit(20);
  }

  async toggleSavedEvent(userId: number, eventId: number): Promise<{ saved: boolean }> {
    const [existing] = await db.select().from(savedEvents)
      .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, eventId)));
    if (existing) {
      await db.delete(savedEvents)
        .where(and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, eventId)));
      return { saved: false };
    } else {
      await db.insert(savedEvents).values({ userId, eventId });
      return { saved: true };
    }
  }

  async getSavedEvents(userId: number): Promise<Event[]> {
    const saved = await db.select({ eventId: savedEvents.eventId })
      .from(savedEvents).where(eq(savedEvents.userId, userId));
    if (saved.length === 0) return [];
    const ids = saved.map(s => s.eventId);
    return await db.select().from(events).where(inArray(events.id, ids));
  }

  async getSavedEventIds(userId: number): Promise<number[]> {
    const saved = await db.select({ eventId: savedEvents.eventId })
      .from(savedEvents).where(eq(savedEvents.userId, userId));
    return saved.map(s => s.eventId);
  }

  // RSVP Methods
  async getRsvp(id: number): Promise<Rsvp | undefined> {
    const [rsvp] = await db.select().from(rsvps).where(eq(rsvps.id, id));
    return rsvp;
  }
  
  async getRsvpByEventAndUser(eventId: number, userId: number): Promise<Rsvp | undefined> {
    const [rsvp] = await db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId)));
    
    return rsvp;
  }
  
  async createRsvp(insertRsvp: InsertRsvp): Promise<Rsvp> {
    const now = new Date();
    const rsvpData = {
      ...insertRsvp,
      userId: insertRsvp.userId || null,
      eventId: insertRsvp.eventId || null,
      createdAt: now,
    };
    
    const [rsvp] = await db.insert(rsvps).values(rsvpData).returning();
    return rsvp;
  }

  async updateRsvp(id: number, rsvpData: Partial<Rsvp>): Promise<Rsvp | undefined> {
    try {
      const [updatedRsvp] = await db.update(rsvps)
        .set(rsvpData)
        .where(eq(rsvps.id, id))
        .returning();
        
      return updatedRsvp;
    } catch (error) {
      console.error("Error updating RSVP:", error);
      return undefined;
    }
  }
  
  async getRsvpsByEvent(eventId: number): Promise<Rsvp[]> {
    return await db.select().from(rsvps).where(eq(rsvps.eventId, eventId));
  }
  
  async getRsvpsByUser(userId: number): Promise<Rsvp[]> {
    return await db.select().from(rsvps).where(eq(rsvps.userId, userId));
  }

  // Post Methods
  async getPost(id: number): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }
  
  async createPost(insertPost: InsertPost): Promise<Post> {
    const now = new Date();
    const postData = {
      ...insertPost,
      userId: insertPost.userId || null,
      image: insertPost.image || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [post] = await db.insert(posts).values(postData).returning();
    return post;
  }
  
  async updatePost(id: number, postData: Partial<Post>): Promise<Post | undefined> {
    try {
      const now = new Date();
      const [updatedPost] = await db.update(posts)
        .set({
          ...postData,
          updatedAt: now
        })
        .where(eq(posts.id, id))
        .returning();
        
      return updatedPost;
    } catch (error) {
      console.error("Error updating post:", error);
      return undefined;
    }
  }
  
  async getAllPosts(): Promise<Post[]> {
    return await db.select().from(posts);
  }
  
  async getPostsByUser(userId: number): Promise<Post[]> {
    return await db.select().from(posts).where(eq(posts.userId, userId));
  }
  
  async deletePost(id: number): Promise<boolean> {
    try {
      // Delete associated likes first
      await db.delete(likes).where(eq(likes.postId, id));
      
      // Delete associated comments
      await db.delete(comments).where(eq(comments.postId, id));
      
      // Delete the post itself
      const result = await db.delete(posts).where(eq(posts.id, id));
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error("Error deleting post:", error);
      return false;
    }
  }

  // Comment Methods
  async getComment(id: number): Promise<Comment | undefined> {
    const [comment] = await db.select().from(comments).where(eq(comments.id, id));
    return comment;
  }
  
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const now = new Date();
    const commentData = {
      ...insertComment,
      userId: insertComment.userId || null,
      postId: insertComment.postId || null,
      createdAt: now,
    };
    
    const [comment] = await db.insert(comments).values(commentData).returning();
    return comment;
  }
  
  async updateComment(id: number, data: Partial<Comment>): Promise<Comment | undefined> {
    const [updatedComment] = await db
      .update(comments)
      .set(data)
      .where(eq(comments.id, id))
      .returning();
    
    return updatedComment;
  }
  
  async deleteComment(id: number): Promise<boolean> {
    try {
      // First delete any replies to this comment
      await db
        .delete(comments)
        .where(eq(comments.parentCommentId, id));
      
      // Then delete the comment itself
      const result = await db
        .delete(comments)
        .where(eq(comments.id, id));
      
      return true;
    } catch (error) {
      console.error("Error deleting comment:", error);
      return false;
    }
  }
  
  async getCommentsByPost(postId: number): Promise<Comment[]> {
    return await db.select().from(comments).where(eq(comments.postId, postId));
  }
  
  async getCommentsByUser(userId: number): Promise<Comment[]> {
    return await db.select().from(comments).where(eq(comments.userId, userId));
  }
  
  async getCommentReplies(parentCommentId: number): Promise<Comment[]> {
    return await db.select().from(comments).where(eq(comments.parentCommentId, parentCommentId));
  }

  // Like Methods
  async getLike(id: number): Promise<Like | undefined> {
    const [like] = await db.select().from(likes).where(eq(likes.id, id));
    return like;
  }
  
  async getLikeByPostAndUser(postId: number, userId: number): Promise<Like | undefined> {
    const [like] = await db
      .select()
      .from(likes)
      .where(and(eq(likes.postId, postId), eq(likes.userId, userId)));
    
    return like;
  }
  
  async createLike(insertLike: InsertLike): Promise<Like> {
    const now = new Date();
    const likeData = {
      ...insertLike,
      userId: insertLike.userId || null,
      postId: insertLike.postId || null,
      createdAt: now,
    };
    
    const [like] = await db.insert(likes).values(likeData).returning();
    return like;
  }
  
  async deleteLike(id: number): Promise<void> {
    await db.delete(likes).where(eq(likes.id, id));
  }
  
  async getLikesByPost(postId: number): Promise<Like[]> {
    return await db.select().from(likes).where(eq(likes.postId, postId));
  }

  // Ticket Methods
  async getTicket(id: number): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    return ticket;
  }
  
  async getTicketByPaymentIntentId(paymentIntentId: string): Promise<Ticket | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.paymentIntentId, paymentIntentId));
    return ticket;
  }
  
  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const now = new Date();
    const ticketData = {
      ...insertTicket,
      userId: insertTicket.userId || null,
      eventId: insertTicket.eventId || null,
      paymentIntentId: insertTicket.paymentIntentId || null,
      isUsed: insertTicket.isUsed || false,
      qrCode: insertTicket.qrCode || null,
      createdAt: now,
    };
    
    const [ticket] = await db.insert(tickets).values(ticketData).returning();
    return ticket;
  }
  
  async getTicketsByEvent(eventId: number): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.eventId, eventId));
  }
  
  async getTicketsByUser(userId: number): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.userId, userId));
  }
  
  async addTicketToUser(userId: number, ticketId: number): Promise<void> {
    // First check if the ticket and user exist
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket with ID ${ticketId} not found`);
    }
    
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Update the ticket with the user ID
    await db.update(tickets)
      .set({ userId })
      .where(eq(tickets.id, ticketId));
      
    console.log(`Ticket ${ticketId} has been added to user ${userId}`);
  }
  
  async updateTicket(id: number, ticketData: Partial<Ticket>): Promise<Ticket | undefined> {
    const [updatedTicket] = await db
      .update(tickets)
      .set(ticketData)
      .where(eq(tickets.id, id))
      .returning();
    
    return updatedTicket;
  }
  
  async validateTicket(qrCode: string): Promise<Ticket | undefined> {
    try {
      // First, attempt to parse the QR code as JSON if it's not a direct URL
      let ticketId: number | null = null;
      
      if (qrCode.startsWith('data:image/png;base64,')) {
        // This is an actual QR code image data URL, search for the ticket with this QR directly
        const [ticket] = await db.select().from(tickets).where(eq(tickets.qrCode, qrCode));
        return ticket;
      } else {
        // Try to parse as JSON in case it's a serialized QR code data
        try {
          const qrData = JSON.parse(qrCode);
          if (qrData.ticketId) {
            ticketId = qrData.ticketId;
          } else if (qrData.id) {
            ticketId = qrData.id;
          }
        } catch (parseError) {
          // Not valid JSON, continue to next check
          console.log("QR code is not valid JSON:", parseError);
        }
      }
      
      // If we extracted a ticketId from the QR code, search by ID
      if (ticketId) {
        const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
        return ticket;
      }
      
      // As a last resort, search for tickets with this QR code as a string
      const [ticket] = await db.select().from(tickets).where(eq(tickets.qrCode, qrCode));
      return ticket;
    } catch (error) {
      console.error("Error validating ticket in storage:", error);
      return undefined;
    }
  }
  
  async getAllTickets(): Promise<Ticket[]> {
    return await db.select().from(tickets);
  }
  
  async deleteTicket(id: number): Promise<boolean> {
    try {
      const result = await db.delete(tickets).where(eq(tickets.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting ticket:', error);
      return false;
    }
  }
  
  async updatePaymentIntent(id: string, data: any): Promise<any> {
    // For the database implementation, we might want to update a paymentIntents table
    // if it exists. Since we don't have direct access to the Stripe API in the database layer,
    // we're just logging the update request and returning mock data
    console.log(`[DatabaseStorage] Updating payment intent ${id} with data:`, data);
    
    // In a real implementation, you would:
    // 1. Update your local payment_intents table if you have one
    // 2. Possibly call the Stripe API directly (though this should ideally be done in a service layer)
    
    // For now, return a success response
    return {
      id,
      metadata: data.metadata || {},
      status: 'succeeded',
      updated: true
    };
  }

  // Membership Methods
  async getMembership(id: number): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships).where(eq(memberships.id, id));
    return membership;
  }
  
  async getMembershipByUser(userId: number): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships).where(eq(memberships.userId, userId));
    return membership;
  }
  
  async getMembershipByStripeSubscriptionId(subscriptionId: string): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships).where(eq(memberships.stripeSubscriptionId, subscriptionId));
    return membership;
  }
  
  async createMembership(insertMembership: InsertMembership): Promise<Membership> {
    const now = new Date();
    const membershipData = {
      ...insertMembership,
      userId: insertMembership.userId || null,
      stripeSubscriptionId: insertMembership.stripeSubscriptionId || null,
      startDate: insertMembership.startDate || now,
      endDate: insertMembership.endDate || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [membership] = await db.insert(memberships).values(membershipData).returning();
    return membership;
  }
  
  async updateMembership(id: number, membershipData: Partial<Membership>): Promise<Membership | undefined> {
    const [updatedMembership] = await db
      .update(memberships)
      .set({
        ...membershipData,
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, id))
      .returning();
    
    return updatedMembership;
  }
  
  async cancelMembership(id: number): Promise<void> {
    await db
      .update(memberships)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(memberships.id, id));
  }
  
  async getAllMemberships(): Promise<Membership[]> {
    return await db.select().from(memberships);
  }
  
  async getAllMembershipsWithUserData(): Promise<any[]> {
    const allMemberships = await db.select().from(memberships);
    
    // Create an array to store memberships with user data
    const membershipsWithUserData = [];
    
    // Fetch user data for each membership
    for (const membership of allMemberships) {
      if (!membership.userId) {
        membershipsWithUserData.push({
          ...membership,
          user: {
            id: membership.userId,
            email: "Unknown",
            displayName: "Unknown User",
            profilePicture: null
          }
        });
        continue;
      }
      
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          profilePicture: users.profilePicture
        })
        .from(users)
        .where(eq(users.id, membership.userId));
      
      membershipsWithUserData.push({
        ...membership,
        user: user || {
          id: membership.userId,
          email: "Unknown",
          displayName: "Unknown User",
          profilePicture: null
        }
      });
    }
    
    return membershipsWithUserData;
  }

  // Product Methods
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }
  
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const now = new Date();
    
    // Check if this is the special test product (name contains "Test Product" and price is "1.00")
    const isTestProduct = 
      insertProduct.name?.includes('Test Product') && 
      insertProduct.price === "1.00";
    
    const productData = {
      ...insertProduct,
      description: insertProduct.description || null,
      images: insertProduct.images || null,
      sellerId: insertProduct.sellerId || null,
      // Special case for test product - allow digital flag for test product only
      isDigital: isTestProduct ? (insertProduct.isDigital || false) : false,
      digitalContentUrl: isTestProduct ? (insertProduct.digitalContentUrl || null) : null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [product] = await db.insert(products).values(productData).returning();
    return product;
  }
  
  async updateProduct(id: number, productData: Partial<Product>): Promise<Product | undefined> {
    // Check if this is the special test product (id is 11)
    const isTestProduct = id === 11;
    
    // Get the current product to check its name/price
    const currentProduct = await this.getProduct(id);
    const isTestProductByNameAndPrice = 
      currentProduct?.name?.includes('Test Product') && 
      currentProduct?.price === "1.00";
    
    const [updatedProduct] = await db
      .update(products)
      .set({
        ...productData,
        // Special case for test product - allow digital flag for test product only
        isDigital: (isTestProduct || isTestProductByNameAndPrice) ? 
          (productData.isDigital !== undefined ? productData.isDigital : currentProduct?.isDigital || false) : 
          false,
        digitalContentUrl: (isTestProduct || isTestProductByNameAndPrice) ? 
          (productData.digitalContentUrl !== undefined ? productData.digitalContentUrl : currentProduct?.digitalContentUrl || null) : 
          null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    
    return updatedProduct;
  }
  
  async getAllProducts(includeDeleted: boolean = false): Promise<Product[]> {
    if (includeDeleted) {
      return await db.select().from(products);
    } else {
      return await db.select().from(products).where(not(eq(products.status, 'deleted')));
    }
  }
  
  async getProductsByCategory(category: string, includeDeleted: boolean = false): Promise<Product[]> {
    if (includeDeleted) {
      return await db.select().from(products).where(eq(products.category, category));
    } else {
      return await db.select().from(products)
        .where(and(
          eq(products.category, category),
          not(eq(products.status, 'deleted'))
        ));
    }
  }
  
  async getProductsBySeller(sellerId: number, includeDeleted: boolean = false): Promise<Product[]> {
    if (includeDeleted) {
      return await db.select().from(products).where(eq(products.sellerId, sellerId));
    } else {
      return await db.select().from(products)
        .where(and(
          eq(products.sellerId, sellerId),
          not(eq(products.status, 'deleted'))
        ));
    }
  }

  // Order Methods
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }
  
  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const now = new Date();
    const orderData = {
      ...insertOrder,
      buyerId: insertOrder.buyerId || null,
      paymentIntentId: insertOrder.paymentIntentId || null,
      shippingAddress: insertOrder.shippingAddress || null,
      trackingNumber: insertOrder.trackingNumber || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [order] = await db.insert(orders).values(orderData).returning();
    return order;
  }
  
  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order | undefined> {
    const [updatedOrder] = await db
      .update(orders)
      .set({
        ...orderData,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    
    return updatedOrder;
  }
  
  async getOrdersByBuyer(buyerId: number): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.buyerId, buyerId));
  }
  
  async getOrdersByStatus(status: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.status, status));
  }
  
  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  // Order Item Methods
  async getOrderItem(id: number): Promise<OrderItem | undefined> {
    const [orderItem] = await db.select().from(orderItems).where(eq(orderItems.id, id));
    return orderItem;
  }
  
  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const now = new Date();
    const orderItemData = {
      ...insertOrderItem,
      orderId: insertOrderItem.orderId || null,
      productId: insertOrderItem.productId || null,
      createdAt: now,
    };
    
    const [orderItem] = await db.insert(orderItems).values(orderItemData).returning();
    return orderItem;
  }
  
  async getOrderItemsByOrder(orderId: number): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  // Admin Action Methods
  async createAdminAction(insertAction: InsertAdminAction): Promise<AdminAction> {
    const now = new Date();
    const actionData = {
      ...insertAction,
      adminId: insertAction.adminId || null,
      targetId: insertAction.targetId || null,
      details: insertAction.details || null,
      createdAt: now,
    };
    
    const [action] = await db.insert(adminActions).values(actionData).returning();
    return action;
  }
  
  async getAdminAction(id: number): Promise<AdminAction | undefined> {
    const [action] = await db.select().from(adminActions).where(eq(adminActions.id, id));
    return action;
  }
  
  async getAdminActionsByAdmin(adminId: number): Promise<AdminAction[]> {
    return await db.select().from(adminActions).where(eq(adminActions.adminId, adminId));
  }
  
  async getAdminActionsByType(actionType: string): Promise<AdminAction[]> {
    return await db.select().from(adminActions).where(eq(adminActions.actionType, actionType));
  }
  
  async getAllAdminActions(): Promise<AdminAction[]> {
    return await db.select().from(adminActions).orderBy(desc(adminActions.createdAt));
  }

  // User Management Admin Functions
  async approveUser(userId: number, adminId: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        isApproved: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (updatedUser) {
      await this.createAdminAction({
        adminId,
        targetId: userId,
        actionType: AdminActionType.USER_APPROVE,
        targetType: "user",
        details: `User ${userId} approved by admin ${adminId}`,
      });
    }
    
    return updatedUser;
  }
  
  async rejectUser(userId: number, adminId: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        isApproved: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (updatedUser) {
      await this.createAdminAction({
        adminId,
        targetId: userId,
        actionType: AdminActionType.USER_REJECT,
        targetType: "user",
        details: `User ${userId} rejected by admin ${adminId}`,
      });
    }
    
    return updatedUser;
  }
  
  async suspendUser(userId: number, adminId: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        isApproved: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (updatedUser) {
      await this.createAdminAction({
        adminId,
        targetId: userId,
        actionType: AdminActionType.USER_SUSPEND,
        targetType: "user",
        details: `User ${userId} suspended by admin ${adminId}`,
      });
    }
    
    return updatedUser;
  }
  
  async deleteUser(userId: number, adminId: number): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
    
    await this.createAdminAction({
      adminId,
      targetId: userId,
      actionType: AdminActionType.USER_DELETE,
      targetType: "user",
      details: `User ${userId} deleted by admin ${adminId}`,
    });
  }
  
  async restoreUser(userId: number, adminId: number): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        isApproved: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (updatedUser) {
      await this.createAdminAction({
        adminId,
        targetId: userId,
        actionType: AdminActionType.USER_RESTORE,
        targetType: "user",
        details: `User ${userId} restored by admin ${adminId}`,
      });
    }
    
    return updatedUser;
  }

  // Event Management Admin Functions
  async approveEvent(eventId: number, adminId: number): Promise<Event | undefined> {
    const [updatedEvent] = await db
      .update(events)
      .set({
        status: "approved",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();
    
    if (updatedEvent) {
      await this.createAdminAction({
        adminId,
        targetId: eventId,
        actionType: AdminActionType.EVENT_APPROVAL,
        targetType: "event",
        details: `Event ${eventId} approved by admin ${adminId}`,
      });
    }
    
    return updatedEvent;
  }
  
  async rejectEvent(eventId: number, adminId: number): Promise<Event | undefined> {
    const [updatedEvent] = await db
      .update(events)
      .set({
        status: "rejected",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();
    
    if (updatedEvent) {
      await this.createAdminAction({
        adminId,
        targetId: eventId,
        actionType: AdminActionType.EVENT_REJECTION,
        targetType: "event",
        details: `Event ${eventId} rejected by admin ${adminId}`,
      });
    }
    
    return updatedEvent;
  }
  
  async modifyEvent(eventId: number, adminId: number, eventData: Partial<Event>): Promise<Event | undefined> {
    const [updatedEvent] = await db
      .update(events)
      .set({
        ...eventData,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();
    
    if (updatedEvent) {
      await this.createAdminAction({
        adminId,
        targetId: eventId,
        actionType: AdminActionType.EVENT_MODIFY,
        targetType: "event",
        details: `Event ${eventId} modified by admin ${adminId}`,
      });
    }
    
    return updatedEvent;
  }

  // Content Moderation
  async createContentFlag(insertFlag: InsertContentFlag): Promise<ContentFlag> {
    const now = new Date();
    const flagData = {
      ...insertFlag,
      reporterId: insertFlag.reporterId || null,
      reviewerId: insertFlag.reviewerId || null,
      notes: insertFlag.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [flag] = await db.insert(contentFlags).values(flagData).returning();
    return flag;
  }
  
  async getContentFlag(id: number): Promise<ContentFlag | undefined> {
    const [flag] = await db.select().from(contentFlags).where(eq(contentFlags.id, id));
    return flag;
  }
  
  async getPendingContentFlags(): Promise<ContentFlag[]> {
    return await db
      .select()
      .from(contentFlags)
      .where(eq(contentFlags.status, ContentFlagStatus.PENDING));
  }
  
  async reviewContentFlag(id: number, reviewerId: number, status: string, notes?: string): Promise<ContentFlag | undefined> {
    const [updatedFlag] = await db
      .update(contentFlags)
      .set({
        reviewerId,
        status,
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(contentFlags.id, id))
      .returning();
    
    return updatedFlag;
  }
  
  async getContentFlagsByStatus(status: string): Promise<ContentFlag[]> {
    return await db
      .select()
      .from(contentFlags)
      .where(eq(contentFlags.status, status));
  }
  
  async getContentFlagsByReporter(reporterId: number): Promise<ContentFlag[]> {
    return await db
      .select()
      .from(contentFlags)
      .where(eq(contentFlags.reporterId, reporterId));
  }
  
  async getContentFlagsByContent(contentType: string, contentId: number): Promise<ContentFlag[]> {
    return await db
      .select()
      .from(contentFlags)
      .where(and(
        eq(contentFlags.contentType, contentType),
        eq(contentFlags.contentId, contentId)
      ));
  }
  
  // User Blocks
  async createUserBlock(block: InsertUserBlock): Promise<UserBlock> {
    const now = new Date();
    const [userBlock] = await db.insert(userBlocks).values({
      blockerId: block.blockerId,
      blockedId: block.blockedId,
      reason: block.reason || null,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    return userBlock;
  }
  
  async getUserBlock(id: number): Promise<UserBlock | undefined> {
    const [block] = await db.select().from(userBlocks).where(eq(userBlocks.id, id));
    return block;
  }
  
  async getUserBlockByUsers(blockerId: number, blockedId: number): Promise<UserBlock | undefined> {
    const [block] = await db.select().from(userBlocks)
      .where(and(
        eq(userBlocks.blockerId, blockerId),
        eq(userBlocks.blockedId, blockedId)
      ));
    return block;
  }
  
  async getUserBlocksByBlocker(blockerId: number): Promise<UserBlock[]> {
    return await db.select().from(userBlocks).where(eq(userBlocks.blockerId, blockerId));
  }
  
  async getUserBlocksByBlocked(blockedId: number): Promise<UserBlock[]> {
    return await db.select().from(userBlocks).where(eq(userBlocks.blockedId, blockedId));
  }
  
  async deleteUserBlock(id: number): Promise<boolean> {
    try {
      const result = await db.delete(userBlocks).where(eq(userBlocks.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting user block:", error);
      return false;
    }
  }
  
  async isUserBlocked(userId: number, targetUserId: number): Promise<boolean> {
    // Check if userId has blocked targetUserId OR targetUserId has blocked userId
    const count = await db
      .select({ count: sql`count(*)` })
      .from(userBlocks)
      .where(
        or(
          and(
            eq(userBlocks.blockerId, userId),
            eq(userBlocks.blockedId, targetUserId)
          ),
          and(
            eq(userBlocks.blockerId, targetUserId),
            eq(userBlocks.blockedId, userId)
          )
        )
      );
    
    return count[0]?.count > 0;
  }
  
  // Content Filters
  async createContentFilter(filter: InsertContentFilter): Promise<ContentFilter> {
    const now = new Date();
    const [contentFilter] = await db.insert(contentFilters).values({
      userId: filter.userId,
      level: filter.level || ContentFilterLevel.MEDIUM,
      filterProfanity: filter.filterProfanity ?? true,
      filterViolence: filter.filterViolence ?? true,
      filterHateSpeech: filter.filterHateSpeech ?? true, 
      filterExplicit: filter.filterExplicit ?? true,
      filterSpam: filter.filterSpam ?? true,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    return contentFilter;
  }
  
  async getContentFilter(id: number): Promise<ContentFilter | undefined> {
    const [filter] = await db.select().from(contentFilters).where(eq(contentFilters.id, id));
    return filter;
  }
  
  async getContentFilterByUser(userId: number): Promise<ContentFilter | undefined> {
    const [filter] = await db.select().from(contentFilters).where(eq(contentFilters.userId, userId));
    
    // If no filter exists for this user, create a default one
    if (!filter) {
      return this.createContentFilter({
        userId,
        level: ContentFilterLevel.MEDIUM,
        filterProfanity: true,
        filterViolence: true,
        filterHateSpeech: true,
        filterExplicit: true,
        filterSpam: true
      });
    }
    
    return filter;
  }
  
  async updateContentFilter(id: number, filter: Partial<ContentFilter>): Promise<ContentFilter | undefined> {
    const now = new Date();
    const [updatedFilter] = await db
      .update(contentFilters)
      .set({
        ...filter,
        updatedAt: now
      })
      .where(eq(contentFilters.id, id))
      .returning();
    
    return updatedFilter;
  }
  
  // Blocked Keywords
  async createBlockedKeyword(keyword: InsertBlockedKeyword): Promise<BlockedKeyword> {
    const now = new Date();
    const [blockedKeyword] = await db.insert(blockedKeywords).values({
      keyword: keyword.keyword,
      category: keyword.category,
      severity: keyword.severity || "medium",
      isRegex: keyword.isRegex || false,
      isActive: keyword.isActive ?? true,
      createdBy: keyword.createdBy || null,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    return blockedKeyword;
  }
  
  async getBlockedKeyword(id: number): Promise<BlockedKeyword | undefined> {
    const [keyword] = await db.select().from(blockedKeywords).where(eq(blockedKeywords.id, id));
    return keyword;
  }
  
  async getBlockedKeywordByText(keyword: string): Promise<BlockedKeyword | undefined> {
    const [blockedKeyword] = await db.select().from(blockedKeywords).where(eq(blockedKeywords.keyword, keyword));
    return blockedKeyword;
  }
  
  async getBlockedKeywordsByCategory(category: string): Promise<BlockedKeyword[]> {
    return await db.select().from(blockedKeywords).where(eq(blockedKeywords.category, category));
  }
  
  async getActiveBlockedKeywords(): Promise<BlockedKeyword[]> {
    try {
      const result = await db.select().from(blockedKeywords).where(eq(blockedKeywords.isActive, true));
      return result;
    } catch (error) {
      console.warn("Error fetching blocked keywords, using default list:", error);
      // Create built-in profanity list as a fallback for when the table doesn't exist yet
      return [
        { 
          id: 1, 
          keyword: 'fuck', 
          category: 'profanity', 
          severity: 'high', 
          isRegex: false,
          isActive: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          id: 2, 
          keyword: 'shit', 
          category: 'profanity', 
          severity: 'medium', 
          isRegex: false,
          isActive: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          id: 3, 
          keyword: 'ass', 
          category: 'profanity', 
          severity: 'low', 
          isRegex: false,
          isActive: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        { 
          id: 4, 
          keyword: 'bitch', 
          category: 'profanity', 
          severity: 'medium', 
          isRegex: false,
          isActive: true,
          createdBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
    }
  }
  
  async updateBlockedKeyword(id: number, keyword: Partial<BlockedKeyword>): Promise<BlockedKeyword | undefined> {
    const now = new Date();
    const [updatedKeyword] = await db
      .update(blockedKeywords)
      .set({
        ...keyword,
        updatedAt: now
      })
      .where(eq(blockedKeywords.id, id))
      .returning();
    
    return updatedKeyword;
  }
  
  async toggleBlockedKeywordStatus(id: number): Promise<BlockedKeyword | undefined> {
    const keyword = await this.getBlockedKeyword(id);
    if (!keyword) return undefined;
    
    const now = new Date();
    const [updatedKeyword] = await db
      .update(blockedKeywords)
      .set({
        isActive: !keyword.isActive,
        updatedAt: now
      })
      .where(eq(blockedKeywords.id, id))
      .returning();
    
    return updatedKeyword;
  }
  
  // Content Filtering Functions
  async filterContent(content: string, filterLevel: string = ContentFilterLevel.MEDIUM): Promise<{filtered: string, hasViolations: boolean, violations: string[]}> {
    if (!content) {
      return { filtered: '', hasViolations: false, violations: [] };
    }
    
    // Get all active blocked keywords
    const keywords = await this.getActiveBlockedKeywords();
    
    let filteredContent = content;
    let hasViolations = false;
    const violations: string[] = [];
    
    // Apply different strictness based on filter level
    const severityLevels: {[key: string]: string[]} = {
      [ContentFilterLevel.NONE]: [],
      [ContentFilterLevel.LOW]: ['high'],
      [ContentFilterLevel.MEDIUM]: ['high', 'medium'],
      [ContentFilterLevel.HIGH]: ['high', 'medium', 'low'],
      [ContentFilterLevel.STRICT]: ['high', 'medium', 'low', 'minimal']
    };
    
    const appliedSeverities = severityLevels[filterLevel] || severityLevels[ContentFilterLevel.MEDIUM];
    
    if (appliedSeverities.length === 0) {
      return { filtered: content, hasViolations: false, violations: [] };
    }
    
    // Filter keywords based on severity level
    const applicableKeywords = keywords.filter(kw => appliedSeverities.includes(kw.severity));
    
    // Apply filtering
    for (const keyword of applicableKeywords) {
      try {
        if (keyword.isRegex) {
          // Handle regex pattern
          const regex = new RegExp(keyword.keyword, 'gi');
          if (regex.test(filteredContent)) {
            hasViolations = true;
            violations.push(keyword.category);
            filteredContent = filteredContent.replace(regex, '***');
          }
        } else {
          // Handle plain text keyword
          const lowercaseContent = filteredContent.toLowerCase();
          const lowercaseKeyword = keyword.keyword.toLowerCase();
          
          if (lowercaseContent.includes(lowercaseKeyword)) {
            hasViolations = true;
            if (!violations.includes(keyword.category)) {
              violations.push(keyword.category);
            }
            
            // Replace all occurrences with asterisks
            const replaceWith = '*'.repeat(keyword.keyword.length);
            const regex = new RegExp(keyword.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            filteredContent = filteredContent.replace(regex, replaceWith);
          }
        }
      } catch (error) {
        console.error(`Error applying filter for keyword ${keyword.keyword}:`, error);
      }
    }
    
    return { filtered: filteredContent, hasViolations, violations };
  }
  
  async isContentAllowed(content: string, filterLevel: string = ContentFilterLevel.MEDIUM): Promise<boolean> {
    
    if (!content) return true;

    // Get all active blocked keywords
    const keywords = await this.getActiveBlockedKeywords();
    
    const severityLevels: {[key: string]: string[]} = {
      [ContentFilterLevel.NONE]: [],
      [ContentFilterLevel.LOW]: ['high'],
      [ContentFilterLevel.MEDIUM]: ['high', 'medium'],
      [ContentFilterLevel.HIGH]: ['high', 'medium', 'low'],
      [ContentFilterLevel.STRICT]: ['high', 'medium', 'low', 'minimal']
    };
    
    const appliedSeverities = severityLevels[filterLevel] || severityLevels[ContentFilterLevel.MEDIUM];
    
    if (appliedSeverities.length === 0) {
      return true;
    }
    
    // Filter keywords based on severity level
    const applicableKeywords = keywords.filter(kw => appliedSeverities.includes(kw.severity));
    
    // Simplify to lowercase for case-insensitive matching
    const lowerContent = content.toLowerCase();
    
    // Check each keyword
    for (const keyword of applicableKeywords) {
      const lowerKeyword = keyword.keyword.toLowerCase();
      
      // Simple includes check (most reliable for catching profanity)
      if (lowerContent.includes(lowerKeyword)) {
        return false;
      }
    }
    
    return true;
  }

  // Event Ticket Types
  async createEventTicketType(insertTicketType: InsertEventTicketType): Promise<EventTicketType> {
    const now = new Date();
    const ticketTypeData = {
      ...insertTicketType,
      description: insertTicketType.description || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [ticketType] = await db.insert(eventTicketTypes).values(ticketTypeData).returning();
    return ticketType;
  }
  
  async getEventTicketType(id: number): Promise<EventTicketType | undefined> {
    const [ticketType] = await db.select().from(eventTicketTypes).where(eq(eventTicketTypes.id, id));
    return ticketType;
  }
  
  async getEventTicketTypesByEvent(eventId: number): Promise<EventTicketType[]> {
    return await db
      .select()
      .from(eventTicketTypes)
      .where(eq(eventTicketTypes.eventId, eventId));
  }
  
  async updateEventTicketType(id: number, ticketTypeData: Partial<EventTicketType>): Promise<EventTicketType | undefined> {
    const [updatedTicketType] = await db
      .update(eventTicketTypes)
      .set({
        ...ticketTypeData,
        updatedAt: new Date(),
      })
      .where(eq(eventTicketTypes.id, id))
      .returning();
    
    return updatedTicketType;
  }

  async deleteEventTicketType(id: number): Promise<boolean> {
    const result = await db.delete(eventTicketTypes).where(eq(eventTicketTypes.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Admin Notifications
  async createAdminNotification(insertNotification: InsertAdminNotification): Promise<AdminNotification> {
    const now = new Date();
    const notificationData = {
      ...insertNotification,
      title: insertNotification.title || "Notification",
      type: insertNotification.type || "info",
      actionLink: insertNotification.actionLink || null,
      actionText: insertNotification.actionText || null,
      fromAdminId: insertNotification.fromAdminId || null,
      toUserId: insertNotification.toUserId || null,
      isRead: false,
      createdAt: now,
    };
    
    const [notification] = await db.insert(adminNotifications).values(notificationData).returning();
    return notification;
  }
  
  async getAdminNotification(id: number): Promise<AdminNotification | undefined> {
    const [notification] = await db.select().from(adminNotifications).where(eq(adminNotifications.id, id));
    return notification;
  }
  
  async getAdminNotificationsByUser(userId: number): Promise<AdminNotification[]> {
    return await db
      .select()
      .from(adminNotifications)
      .where(eq(adminNotifications.toUserId, userId))
      .orderBy(desc(adminNotifications.createdAt));
  }
  
  async markAdminNotificationAsRead(id: number): Promise<AdminNotification | undefined> {
    const [updatedNotification] = await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(eq(adminNotifications.id, id))
      .returning();
    
    return updatedNotification;
  }
  
  async getUnreadAdminNotificationsByUser(userId: number): Promise<AdminNotification[]> {
    return await db
      .select()
      .from(adminNotifications)
      .where(and(
        eq(adminNotifications.toUserId, userId),
        eq(adminNotifications.isRead, false)
      ))
      .orderBy(desc(adminNotifications.createdAt));
  }

  // User Notification Methods
  async createUserNotification(notification: InsertUserNotification): Promise<UserNotification> {
    const [result] = await db
      .insert(userNotifications)
      .values(notification)
      .returning();
    
    if (!result) {
      throw new Error("Failed to create user notification");
    }
    
    return result;
  }

  async getUserNotification(id: number): Promise<UserNotification | undefined> {
    const [result] = await db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.id, id));
    
    return result;
  }

  async getUserNotificationsByUser(userId: number): Promise<UserNotification[]> {
    return await db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt));
  }

  async getUnreadUserNotificationsByUser(userId: number): Promise<UserNotification[]> {
    return await db
      .select()
      .from(userNotifications)
      .where(and(
        eq(userNotifications.userId, userId),
        eq(userNotifications.isRead, false)
      ))
      .orderBy(desc(userNotifications.createdAt));
  }

  async markUserNotificationAsRead(id: number): Promise<UserNotification | undefined> {
    const [result] = await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(eq(userNotifications.id, id))
      .returning();
    
    return result;
  }

  async markUserNotificationAsSeen(id: number): Promise<UserNotification | undefined> {
    const [result] = await db
      .update(userNotifications)
      .set({ isSeen: true })
      .where(eq(userNotifications.id, id))
      .returning();
    
    return result;
  }

  async markAllUserNotificationsAsRead(userId: number): Promise<number> {
    const result = await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(eq(userNotifications.userId, userId));
    
    return result.rowCount || 0;
  }

  async markAllUserNotificationsAsSeen(userId: number): Promise<number> {
    const result = await db
      .update(userNotifications)
      .set({ isSeen: true })
      .where(eq(userNotifications.userId, userId));
    
    return result.rowCount || 0;
  }

  async deleteUserNotification(id: number): Promise<boolean> {
    const result = await db
      .delete(userNotifications)
      .where(eq(userNotifications.id, id));
    
    return !!result.rowCount;
  }

  // Service Methods
  async getService(id: number): Promise<Service | undefined> {
    // Return the service only if it's active (not deleted)
    const [service] = await db.select().from(services).where(
      and(
        eq(services.id, id),
        eq(services.isActive, true)
      )
    );
    return service;
  }

  async createService(insertService: InsertService): Promise<Service> {
    const now = new Date();
    const serviceData = {
      ...insertService,
      description: insertService.description,
      // Make sure images is always an array, never null
      images: Array.isArray(insertService.images) ? insertService.images : [],
      location: insertService.location || null,
      requirements: insertService.requirements || null,
      isActive: insertService.isActive !== undefined ? insertService.isActive : true,
      isVerified: false,
      createdAt: now,
      updatedAt: now,
    };
    
    console.log("Creating service with data:", JSON.stringify(serviceData, null, 2));
    
    try {
      const [service] = await db.insert(services).values(serviceData).returning();
      console.log("Service created successfully:", service.id);
      return service;
    } catch (error) {
      console.error("Error in database while creating service:", error);
      throw error;
    }
  }

  async updateService(id: number, serviceData: Partial<Service>): Promise<Service | undefined> {
    // Make sure images is always an array if provided
    const sanitizedData = {
      ...serviceData
    };
    
    // Handle images field separately
    if (serviceData.images !== undefined) {
      sanitizedData.images = Array.isArray(serviceData.images) ? serviceData.images : [];
      console.log(`Updating service ${id} images:`, sanitizedData.images);
    }
    
    try {
      const [updatedService] = await db
        .update(services)
        .set({
          ...sanitizedData,
          updatedAt: new Date(),
        })
        .where(eq(services.id, id))
        .returning();
      
      console.log(`Service ${id} updated successfully`);
      return updatedService;
    } catch (error) {
      console.error(`Error updating service ${id}:`, error);
      throw error;
    }
  }

  async deleteService(id: number): Promise<boolean> {
    try {
      // Instead of deleting, update the service to set isActive = false
      const result = await db
        .update(services)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(services.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error soft-deleting service:", error);
      throw error;
    }
  }

  async getAllServices(): Promise<Service[]> {
    // Only return active services by default
    return await db
      .select()
      .from(services)
      .where(eq(services.isActive, true));
  }

  async getServicesByCategory(category: string): Promise<Service[]> {
    return await db.select().from(services).where(
      and(
        eq(services.category, category),
        eq(services.isActive, true)
      )
    );
  }

  async getServicesByProvider(providerId: number): Promise<Service[]> {
    return await db.select().from(services).where(
      and(
        eq(services.providerId, providerId),
        eq(services.isActive, true)
      )
    );
  }

  async getServicesByType(type: string): Promise<Service[]> {
    return await db.select().from(services).where(
      and(
        eq(services.type, type),
        eq(services.isActive, true)
      )
    );
  }

  // Availability Methods
  async getAvailability(id: number): Promise<Availability | undefined> {
    const [availabilityEntry] = await db.select().from(availability).where(eq(availability.id, id));
    return availabilityEntry;
  }

  async createAvailability(insertAvailability: InsertAvailability): Promise<Availability> {
    const now = new Date();
    const availabilityData = {
      ...insertAvailability,
      recurrenceEndDate: insertAvailability.recurrenceEndDate || null,
      recurrenceType: insertAvailability.recurrenceType || null,
      isBlocked: insertAvailability.isBlocked || false,
      notes: insertAvailability.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [availabilityEntry] = await db.insert(availability).values(availabilityData).returning();
    return availabilityEntry;
  }

  async updateAvailability(id: number, availabilityData: Partial<Availability>): Promise<Availability | undefined> {
    const [updatedAvailability] = await db
      .update(availability)
      .set({
        ...availabilityData,
        updatedAt: new Date(),
      })
      .where(eq(availability.id, id))
      .returning();
    
    return updatedAvailability;
  }

  async getAvailabilityByProvider(providerId: number): Promise<Availability[]> {
    return await db.select().from(availability).where(eq(availability.providerId, providerId));
  }

  async getAvailabilityByService(serviceId: number): Promise<Availability[]> {
    return await db.select().from(availability).where(eq(availability.serviceId, serviceId));
  }

  async getAvailabilityInRange(providerId: number, startDate: Date, endDate: Date): Promise<Availability[]> {
    return await db
      .select()
      .from(availability)
      .where(
        and(
          eq(availability.providerId, providerId),
          or(
            // Start time is within range
            and(
              gte(availability.startTime, startDate),
              lte(availability.startTime, endDate)
            ),
            // End time is within range
            and(
              gte(availability.endTime, startDate),
              lte(availability.endTime, endDate)
            ),
            // Range is within availability
            and(
              lte(availability.startTime, startDate),
              gte(availability.endTime, endDate)
            )
          )
        )
      );
  }

  // Service Time Slots Methods
  async getServiceTimeSlot(id: number): Promise<ServiceTimeSlot | undefined> {
    const result = await db.select().from(serviceTimeSlots).where(eq(serviceTimeSlots.id, id)).limit(1);
    return result[0];
  }

  async createServiceTimeSlot(timeSlot: InsertServiceTimeSlot): Promise<ServiceTimeSlot> {
    const now = new Date();
    const [newTimeSlot] = await db.insert(serviceTimeSlots).values({
      ...timeSlot,
      status: timeSlot.status || TimeSlotStatus.AVAILABLE,
      maxBookings: timeSlot.maxBookings || 1,
      currentBookings: timeSlot.currentBookings || 0,
      notes: timeSlot.notes || null,
      createdAt: now,
      updatedAt: now,
    }).returning();
    
    return newTimeSlot;
  }

  async updateServiceTimeSlot(id: number, timeSlotData: Partial<InsertServiceTimeSlot>): Promise<ServiceTimeSlot | undefined> {
    const [updatedTimeSlot] = await db.update(serviceTimeSlots)
      .set({
        ...timeSlotData,
        updatedAt: new Date(),
      })
      .where(eq(serviceTimeSlots.id, id))
      .returning();
    
    return updatedTimeSlot;
  }

  async getServiceTimeSlotsByService(serviceId: number): Promise<ServiceTimeSlot[]> {
    return await db.select()
      .from(serviceTimeSlots)
      .where(eq(serviceTimeSlots.serviceId, serviceId));
  }

  async getServiceTimeSlotsByProvider(providerId: number): Promise<ServiceTimeSlot[]> {
    return await db.select()
      .from(serviceTimeSlots)
      .where(eq(serviceTimeSlots.providerId, providerId));
  }

  async getServiceTimeSlotsByDate(providerId: number, date: Date): Promise<ServiceTimeSlot[]> {
    // Create date objects for start and end of the requested day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await db.select()
      .from(serviceTimeSlots)
      .where(
        and(
          eq(serviceTimeSlots.providerId, providerId),
          gte(serviceTimeSlots.date, startOfDay),
          lte(serviceTimeSlots.date, endOfDay)
        )
      );
  }

  async getAvailableServiceTimeSlots(serviceId: number): Promise<ServiceTimeSlot[]> {
    const now = new Date();
    
    return await db.select()
      .from(serviceTimeSlots)
      .where(
        and(
          eq(serviceTimeSlots.serviceId, serviceId),
          eq(serviceTimeSlots.status, TimeSlotStatus.AVAILABLE),
          gt(serviceTimeSlots.date, now),
          lt(serviceTimeSlots.currentBookings, serviceTimeSlots.maxBookings)
        )
      );
  }

  async updateServiceTimeSlotStatus(id: number, status: string): Promise<ServiceTimeSlot | undefined> {
    const [updatedTimeSlot] = await db.update(serviceTimeSlots)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(serviceTimeSlots.id, id))
      .returning();
    
    return updatedTimeSlot;
  }

  async incrementCurrentBookings(id: number): Promise<ServiceTimeSlot | undefined> {
    // First get the current time slot
    const timeSlot = await this.getServiceTimeSlot(id);
    if (!timeSlot) return undefined;
    
    // Increment the current bookings
    const newBookingCount = timeSlot.currentBookings + 1;
    
    // If max bookings reached, update status to booked
    const newStatus = newBookingCount >= timeSlot.maxBookings 
      ? TimeSlotStatus.BOOKED 
      : timeSlot.status;
    
    // Update the time slot
    const [updatedTimeSlot] = await db.update(serviceTimeSlots)
      .set({
        currentBookings: newBookingCount,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(serviceTimeSlots.id, id))
      .returning();
    
    return updatedTimeSlot;
  }

  async decrementCurrentBookings(id: number): Promise<ServiceTimeSlot | undefined> {
    // First get the current time slot
    const timeSlot = await this.getServiceTimeSlot(id);
    if (!timeSlot) return undefined;
    
    // Only decrement if greater than 0
    if (timeSlot.currentBookings <= 0) return timeSlot;
    
    // Decrement the current bookings
    const newBookingCount = timeSlot.currentBookings - 1;
    
    // If slot was booked and now has space, update status to available
    const newStatus = timeSlot.status === TimeSlotStatus.BOOKED && newBookingCount < timeSlot.maxBookings
      ? TimeSlotStatus.AVAILABLE
      : timeSlot.status;
    
    // Update the time slot
    const [updatedTimeSlot] = await db.update(serviceTimeSlots)
      .set({
        currentBookings: newBookingCount,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(serviceTimeSlots.id, id))
      .returning();
    
    return updatedTimeSlot;
  }

  async deleteServiceTimeSlot(id: number): Promise<boolean> {
    const result = await db.delete(serviceTimeSlots)
      .where(eq(serviceTimeSlots.id, id));
    
    return result.rowCount > 0;
  }

  // Service Booking Methods
  async getServiceBooking(id: number): Promise<ServiceBooking | undefined> {
    // Select specific fields that exist in the database to avoid errors with 'images' field
    const [booking] = await db.select({
      id: serviceBookings.id,
      serviceId: serviceBookings.serviceId,
      userId: serviceBookings.userId,
      providerId: serviceBookings.providerId,
      startTime: serviceBookings.startTime,
      endTime: serviceBookings.endTime,
      status: serviceBookings.status,
      message: serviceBookings.message,
      totalPrice: serviceBookings.totalPrice,
      participants: serviceBookings.participants,
      location: serviceBookings.location,
      paymentIntentId: serviceBookings.paymentIntentId,
      isPaid: serviceBookings.isPaid,
      isRefunded: serviceBookings.isRefunded,
      adminMessage: serviceBookings.adminMessage,
      emailSent: serviceBookings.emailSent,
      createdAt: serviceBookings.createdAt,
      updatedAt: serviceBookings.updatedAt,
      // Add a null images field to match the schema
      images: sql`NULL::text[]`.as('images')
    })
    .from(serviceBookings)
    .where(eq(serviceBookings.id, id));
    
    return booking;
  }

  async createServiceBooking(insertBooking: InsertServiceBooking): Promise<ServiceBooking> {
    const now = new Date();
    
    // Override status if it's a direct payment (isPaid is true)
    const status = insertBooking.isPaid === true 
      ? BookingStatus.PAYMENT_SUCCESSFUL 
      : BookingStatus.PENDING_APPROVAL;
    
    console.log(`Creating service booking with payment status: isPaid=${insertBooking.isPaid}, status=${status}`);
    
    const bookingData = {
      ...insertBooking,
      status,
      message: insertBooking.message || null,
      participants: insertBooking.participants || 1,
      location: insertBooking.location || null,
      paymentIntentId: insertBooking.paymentIntentId || null,
      // Use provided isPaid value or default to false
      isPaid: insertBooking.isPaid === true ? true : false,
      isRefunded: false,
      adminMessage: null,
      emailSent: false,
      createdAt: now,
      updatedAt: now,
    };
    
    const [booking] = await db.insert(serviceBookings).values(bookingData).returning();
    
    return booking;
  }

  async updateServiceBooking(id: number, bookingData: Partial<ServiceBooking>): Promise<ServiceBooking | undefined> {
    const [updatedBooking] = await db
      .update(serviceBookings)
      .set({
        ...bookingData,
        updatedAt: new Date(),
      })
      .where(eq(serviceBookings.id, id))
      .returning();
    
    if (updatedBooking) {
      return updatedBooking;
    }
    
    return undefined;
  }

  async deleteServiceBooking(id: number): Promise<boolean> {
    const result = await db
      .delete(serviceBookings)
      .where(eq(serviceBookings.id, id));
    
    return result.rowCount > 0;
  }

  async getServiceBookingsByUser(userId: number): Promise<ServiceBooking[]> {
    // Select specific fields that exist in the database to avoid errors with 'images' field
    return await db.select({
      id: serviceBookings.id,
      serviceId: serviceBookings.serviceId,
      userId: serviceBookings.userId,
      providerId: serviceBookings.providerId,
      startTime: serviceBookings.startTime,
      endTime: serviceBookings.endTime,
      status: serviceBookings.status,
      message: serviceBookings.message,
      totalPrice: serviceBookings.totalPrice,
      participants: serviceBookings.participants,
      location: serviceBookings.location,
      paymentIntentId: serviceBookings.paymentIntentId,
      isPaid: serviceBookings.isPaid,
      isRefunded: serviceBookings.isRefunded,
      adminMessage: serviceBookings.adminMessage,
      emailSent: serviceBookings.emailSent,
      createdAt: serviceBookings.createdAt,
      updatedAt: serviceBookings.updatedAt,
      // Add a null images field to match the schema
      images: sql`NULL::text[]`.as('images')
    })
    .from(serviceBookings)
    .where(eq(serviceBookings.userId, userId));
  }

  async getServiceBookingsByProvider(providerId: number): Promise<ServiceBooking[]> {
    // Select specific fields that exist in the database to avoid errors with 'images' field
    return await db.select({
      id: serviceBookings.id,
      serviceId: serviceBookings.serviceId,
      userId: serviceBookings.userId,
      providerId: serviceBookings.providerId,
      startTime: serviceBookings.startTime,
      endTime: serviceBookings.endTime,
      status: serviceBookings.status,
      message: serviceBookings.message,
      totalPrice: serviceBookings.totalPrice,
      participants: serviceBookings.participants,
      location: serviceBookings.location,
      paymentIntentId: serviceBookings.paymentIntentId,
      isPaid: serviceBookings.isPaid,
      isRefunded: serviceBookings.isRefunded,
      adminMessage: serviceBookings.adminMessage,
      emailSent: serviceBookings.emailSent,
      createdAt: serviceBookings.createdAt,
      updatedAt: serviceBookings.updatedAt,
      // Add a null images field to match the schema
      images: sql`NULL::text[]`.as('images')
    })
    .from(serviceBookings)
    .where(eq(serviceBookings.providerId, providerId));
  }

  async getServiceBookingsByService(serviceId: number): Promise<ServiceBooking[]> {
    // Select specific fields that exist in the database to avoid errors with 'images' field
    return await db.select({
      id: serviceBookings.id,
      serviceId: serviceBookings.serviceId,
      userId: serviceBookings.userId,
      providerId: serviceBookings.providerId,
      startTime: serviceBookings.startTime,
      endTime: serviceBookings.endTime,
      status: serviceBookings.status,
      message: serviceBookings.message,
      totalPrice: serviceBookings.totalPrice,
      participants: serviceBookings.participants,
      location: serviceBookings.location,
      paymentIntentId: serviceBookings.paymentIntentId,
      isPaid: serviceBookings.isPaid,
      isRefunded: serviceBookings.isRefunded,
      adminMessage: serviceBookings.adminMessage,
      emailSent: serviceBookings.emailSent,
      createdAt: serviceBookings.createdAt,
      updatedAt: serviceBookings.updatedAt,
      // Add a null images field to match the schema
      images: sql`NULL::text[]`.as('images')
    })
    .from(serviceBookings)
    .where(eq(serviceBookings.serviceId, serviceId));
  }

  async getServiceBookingsByStatus(status: string): Promise<ServiceBooking[]> {
    // Select specific fields that exist in the database to avoid errors with 'images' field
    return await db.select({
      id: serviceBookings.id,
      serviceId: serviceBookings.serviceId,
      userId: serviceBookings.userId,
      providerId: serviceBookings.providerId,
      startTime: serviceBookings.startTime,
      endTime: serviceBookings.endTime,
      status: serviceBookings.status,
      message: serviceBookings.message,
      totalPrice: serviceBookings.totalPrice,
      participants: serviceBookings.participants,
      location: serviceBookings.location,
      paymentIntentId: serviceBookings.paymentIntentId,
      isPaid: serviceBookings.isPaid,
      isRefunded: serviceBookings.isRefunded,
      adminMessage: serviceBookings.adminMessage,
      emailSent: serviceBookings.emailSent,
      createdAt: serviceBookings.createdAt,
      updatedAt: serviceBookings.updatedAt,
      // Add a null images field to match the schema
      images: sql`NULL::text[]`.as('images')
    })
    .from(serviceBookings)
    .where(eq(serviceBookings.status, status));
  }
  
  async getServiceBookingsByPaymentIntentId(paymentIntentId: string): Promise<ServiceBooking[]> {
    // Select specific fields that exist in the database to avoid errors with 'images' field
    return await db.select({
      id: serviceBookings.id,
      serviceId: serviceBookings.serviceId,
      userId: serviceBookings.userId,
      providerId: serviceBookings.providerId,
      startTime: serviceBookings.startTime,
      endTime: serviceBookings.endTime,
      status: serviceBookings.status,
      message: serviceBookings.message,
      totalPrice: serviceBookings.totalPrice,
      participants: serviceBookings.participants,
      location: serviceBookings.location,
      paymentIntentId: serviceBookings.paymentIntentId,
      isPaid: serviceBookings.isPaid,
      isRefunded: serviceBookings.isRefunded,
      adminMessage: serviceBookings.adminMessage,
      emailSent: serviceBookings.emailSent,
      createdAt: serviceBookings.createdAt,
      updatedAt: serviceBookings.updatedAt,
      // Add a null images field to match the schema
      images: sql`NULL::text[]`.as('images')
    })
    .from(serviceBookings)
    .where(eq(serviceBookings.paymentIntentId, paymentIntentId));
  }

  async getAllServiceBookings(): Promise<ServiceBooking[]> {
    // Select specific fields that exist in the database to avoid errors with 'images' field
    return await db.select({
      id: serviceBookings.id,
      serviceId: serviceBookings.serviceId,
      userId: serviceBookings.userId,
      providerId: serviceBookings.providerId,
      startTime: serviceBookings.startTime,
      endTime: serviceBookings.endTime,
      status: serviceBookings.status,
      message: serviceBookings.message,
      totalPrice: serviceBookings.totalPrice,
      participants: serviceBookings.participants,
      location: serviceBookings.location,
      paymentIntentId: serviceBookings.paymentIntentId,
      isPaid: serviceBookings.isPaid,
      isRefunded: serviceBookings.isRefunded,
      adminMessage: serviceBookings.adminMessage,
      emailSent: serviceBookings.emailSent,
      createdAt: serviceBookings.createdAt,
      updatedAt: serviceBookings.updatedAt,
      // Add a null images field to match the schema
      images: sql`NULL::text[]`.as('images')
    })
    .from(serviceBookings);
  }

  async approveServiceBooking(id: number): Promise<ServiceBooking | undefined> {
    const [updatedBooking] = await db
      .update(serviceBookings)
      .set({
        status: BookingStatus.APPROVED,
        updatedAt: new Date(),
      })
      .where(eq(serviceBookings.id, id))
      .returning();
    
    if (updatedBooking) {
      return updatedBooking;
    }
    
    return undefined;
  }

  async rejectServiceBooking(id: number, message?: string): Promise<ServiceBooking | undefined> {
    const [updatedBooking] = await db
      .update(serviceBookings)
      .set({
        status: BookingStatus.REJECTED,
        adminMessage: message || null,
        updatedAt: new Date(),
      })
      .where(eq(serviceBookings.id, id))
      .returning();
    
    if (updatedBooking) {
      return updatedBooking;
    }
    
    return undefined;
  }

  async completeServiceBooking(id: number): Promise<ServiceBooking | undefined> {
    const [updatedBooking] = await db
      .update(serviceBookings)
      .set({
        status: BookingStatus.COMPLETED,
        updatedAt: new Date(),
      })
      .where(eq(serviceBookings.id, id))
      .returning();
    
    if (updatedBooking) {
      return updatedBooking;
    }
    
    return undefined;
  }

  async cancelServiceBooking(id: number, message?: string): Promise<ServiceBooking | undefined> {
    const [updatedBooking] = await db
      .update(serviceBookings)
      .set({
        status: BookingStatus.CANCELLED,
        adminMessage: message || null,
        updatedAt: new Date(),
      })
      .where(eq(serviceBookings.id, id))
      .returning();
    
    if (updatedBooking) {
      return updatedBooking;
    }
    
    return undefined;
  }

  // Service Review Methods
  async getServiceReview(id: number): Promise<ServiceReview | undefined> {
    const [review] = await db.select().from(serviceReviews).where(eq(serviceReviews.id, id));
    return review;
  }

  async createServiceReview(insertReview: InsertServiceReview): Promise<ServiceReview> {
    const now = new Date();
    const reviewData = {
      ...insertReview,
      content: insertReview.content || null,
      createdAt: now,
      updatedAt: now,
    };
    
    const [review] = await db.insert(serviceReviews).values(reviewData).returning();
    return review;
  }

  async getServiceReviewsByService(serviceId: number): Promise<ServiceReview[]> {
    return await db.select().from(serviceReviews).where(eq(serviceReviews.serviceId, serviceId));
  }

  async getServiceReviewsByProvider(providerId: number): Promise<ServiceReview[]> {
    return await db.select().from(serviceReviews).where(eq(serviceReviews.providerId, providerId));
  }

  async getServiceReviewsByUser(userId: number): Promise<ServiceReview[]> {
    return await db.select().from(serviceReviews).where(eq(serviceReviews.reviewerId, userId));
  }

  async getServiceReviewsByBooking(bookingId: number): Promise<ServiceReview[]> {
    return await db.select().from(serviceReviews).where(eq(serviceReviews.bookingId, bookingId));
  }

  // Provider Skills Methods
  async getProviderSkill(id: number): Promise<ProviderSkill | undefined> {
    const [skill] = await db.select().from(providerSkills).where(eq(providerSkills.id, id));
    return skill;
  }

  async createProviderSkill(insertSkill: InsertProviderSkill): Promise<ProviderSkill> {
    const now = new Date();
    const skillData = {
      ...insertSkill,
      yearsExperience: insertSkill.yearsExperience || null,
      level: insertSkill.level || null,
      isVerified: false,
      createdAt: now,
    };
    
    const [skill] = await db.insert(providerSkills).values(skillData).returning();
    return skill;
  }

  async getProviderSkillsByProvider(providerId: number): Promise<ProviderSkill[]> {
    return await db.select().from(providerSkills).where(eq(providerSkills.providerId, providerId));
  }

  async getProviderSkillsByCategory(category: string): Promise<ProviderSkill[]> {
    return await db.select().from(providerSkills).where(eq(providerSkills.category, category));
  }

  async verifyProviderSkill(id: number): Promise<ProviderSkill | undefined> {
    const [updatedSkill] = await db
      .update(providerSkills)
      .set({
        isVerified: true,
      })
      .where(eq(providerSkills.id, id))
      .returning();
    
    return updatedSkill;
  }
  
  // Friend-related methods removed (part 1)
  
  // Friend-related methods removed (part 2)
  
  // Friend-related methods removed (part 3)

  // System Stats
  async createSystemStat(insertStat: InsertSystemStat): Promise<SystemStat> {
    const [stat] = await db.insert(systemStats).values(insertStat).returning();
    return stat;
  }
  
  async getLatestSystemStats(): Promise<SystemStat | undefined> {
    const [stat] = await db
      .select()
      .from(systemStats)
      .orderBy(desc(systemStats.statDate))
      .limit(1);
    
    return stat;
  }
  
  async getSystemStatsByDateRange(startDate: Date, endDate: Date): Promise<SystemStat[]> {
    return await db
      .select()
      .from(systemStats)
      .where(and(
        gte(systemStats.statDate, startDate),
        lte(systemStats.statDate, endDate)
      ))
      .orderBy(asc(systemStats.statDate));
  }
  
  // Allow updating an individual field in system stats
  async updateSystemStat(id: number, data: Partial<SystemStat>): Promise<SystemStat | undefined> {
    try {
      const [updatedStat] = await db
        .update(systemStats)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(systemStats.id, id))
        .returning();
      
      return updatedStat;
    } catch (error) {
      console.error("Error updating system stat:", error);
      return undefined;
    }
  }
  
  async updateDailyStats(): Promise<SystemStat> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      console.log("[STATS UPDATE] Starting to collect system statistics");
      
      // Get user counts
      const userCount = await db.select({ count: sql`count(*)` }).from(users);
      console.log("[STATS UPDATE] User count query completed:", userCount);
      
      const artistCount = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "artist"));
      const organizationCount = await db.select({ count: sql`count(*)` }).from(users).where(eq(users.role, "organization"));
      const eventCount = await db.select({ count: sql`count(*)` }).from(events);
      console.log("[STATS UPDATE] Event count query completed:", eventCount);
      
      // Handle optional tables that might not exist yet
      let activeTicketCount = 0;
      let usedTicketCount = 0;
      try {
        const activeTickets = await db.select({ count: sql`count(*)` }).from(tickets).where(eq(tickets.isUsed, false));
        activeTicketCount = parseInt(activeTickets[0]?.count as string || '0');
        
        const usedTickets = await db.select({ count: sql`count(*)` }).from(tickets).where(eq(tickets.isUsed, true));
        usedTicketCount = parseInt(usedTickets[0]?.count as string || '0');
      } catch (error) {
        console.warn("[STATS UPDATE] Error counting tickets:", error);
        // Continue without ticket data
      }
      
      // Get post and comment counts
      let postCount = 0;
      let commentCount = 0;
      try {
        const totalPosts = await db.select({ count: sql`count(*)` }).from(posts);
        postCount = parseInt(totalPosts[0]?.count as string || '0');
        
        const totalComments = await db.select({ count: sql`count(*)` }).from(comments);
        commentCount = parseInt(totalComments[0]?.count as string || '0');
      } catch (error) {
        console.warn("[STATS UPDATE] Error counting posts and comments:", error);
        // Continue without post/comment data
      }
      
      // Get order counts
      let orderCount = 0;
      let pendingOrderCount = 0;
      try {
        const totalOrders = await db.select({ count: sql`count(*)` }).from(orders);
        orderCount = parseInt(totalOrders[0]?.count as string || '0');
        
        const pendingOrders = await db.select({ count: sql`count(*)` }).from(orders).where(eq(orders.status, "pending"));
        pendingOrderCount = parseInt(pendingOrders[0]?.count as string || '0');
      } catch (error) {
        console.warn("[STATS UPDATE] Error counting orders:", error);
        // Continue without order data
      }
      
      // Calculate revenue (safely)
      let ticketRevenueValue = 0;
      try {
        const ticketRevenue = await db
          .select({ revenue: sql`COALESCE(sum(purchase_amount), 0)` })
          .from(tickets);
        ticketRevenueValue = parseFloat(ticketRevenue[0]?.revenue as string || '0');
      } catch (error) {
        console.warn("[STATS UPDATE] Error calculating ticket revenue:", error);
        // Continue without ticket revenue
      }
      
      // Calculate service booking revenue (safely)
      let serviceRevenueValue = 0;
      let serviceBookingCount = 0;
      try {
        const serviceBookingsRevenue = await db
          .select({ revenue: sql`COALESCE(sum(amount), 0)` })
          .from(serviceBookings)
          .where(and(
            eq(serviceBookings.isPaid, true),
            eq(serviceBookings.isRefunded, false)
          ));
        serviceRevenueValue = parseFloat(serviceBookingsRevenue[0]?.revenue as string || '0');
        
        const totalServiceBookings = await db
          .select({ count: sql`count(*)` })
          .from(serviceBookings);
        serviceBookingCount = parseInt(totalServiceBookings[0]?.count as string || '0');
      } catch (error) {
        console.warn("[STATS UPDATE] Error calculating service revenue:", error);
        // Continue without service revenue
      }
      
      // Count flagged content (safely)
      let flaggedContentCount = 0;
      try {
        const flaggedContent = await db
          .select({ count: sql`count(*)` })
          .from(contentFlags)
          .where(eq(contentFlags.status, ContentFlagStatus.PENDING));
        flaggedContentCount = parseInt(flaggedContent[0]?.count as string || '0');
      } catch (error) {
        console.warn("[STATS UPDATE] Error counting flagged content:", error);
        // Continue without flagged content data
      }
      
      // Calculate total revenue
      const totalRevenue = ticketRevenueValue + serviceRevenueValue;
      
      console.log("[STATS UPDATE] All data collected successfully");
      
      // Create the stat object
      const stat: Partial<SystemStat> = {
        statDate: today,
        userCount: parseInt(userCount[0]?.count as string || '0'),
        eventCount: parseInt(eventCount[0]?.count as string || '0'),
        ticketsSold: activeTicketCount + usedTicketCount,
        revenue: totalRevenue.toString(),
        activeUsers: parseInt(userCount[0]?.count as string || '0'), // In a real app, would count active sessions
        postCount: postCount,
        flaggedContent: flaggedContentCount,
        servicesBooked: serviceBookingCount,
        serviceRevenue: serviceRevenueValue.toString(),
        processingTime: "100", // Example value
      };
      
      console.log(`[STATS UPDATE] Generating system stats with revenue: ${totalRevenue}, users: ${stat.userCount}, events: ${stat.eventCount}, posts: ${stat.postCount}`);
      
      // Check if we already have a stat for today
      const existingStats = await db
        .select()
        .from(systemStats)
        .where(eq(systemStats.statDate, today));
      
      const existingStat = existingStats[0];
      
      if (existingStat) {
        console.log("[STATS UPDATE] Updating existing stats for today");
        const updatedStats = await db
          .update(systemStats)
          .set(stat)
          .where(eq(systemStats.id, existingStat.id))
          .returning();
        
        const updatedStat = updatedStats[0];
        console.log("[STATS UPDATE] Stats updated successfully");
        return updatedStat;
      } else {
        console.log("[STATS UPDATE] Creating new stats for today");
        const newStats = await db
          .insert(systemStats)
          .values(stat as SystemStat)
          .returning();
        
        const newStat = newStats[0];
        console.log("[STATS UPDATE] Stats created successfully");
        return newStat;
      }
    } catch (error) {
      console.error("[STATS UPDATE] Error in updateDailyStats:", error);
      // Create a fallback stat object with minimal data to avoid breaking the UI
      const fallbackStat: SystemStat = {
        id: -1, // Temporary ID
        statDate: new Date(),
        userCount: 0,
        eventCount: 0,
        ticketsSold: 0,
        revenue: "0",
        activeUsers: 0,
        postCount: 0,
        flaggedContent: 0,
        servicesBooked: 0,
        serviceRevenue: "0",
        processingTime: "0",
        createdAt: new Date(),
      };
      throw new Error(`Failed to update system stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRealTimeAdminStats(): Promise<{
    totalUsers: number;
    newUsers: number;
    activeEvents: number;
    pendingEvents: number;
    totalPosts: number;
    totalComments: number;
    totalLikes: number;
    totalRsvps: number;
    flaggedContent: number;
    totalRevenue: number;
    ticketRevenue: number;
    serviceRevenue: number;
    ticketsSold: number;
  }> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Run all 11 count/aggregate queries in parallel
      const [
        totalUsersResult,
        newUsersResult,
        activeEventsResult,
        pendingEventsResult,
        postsResult,
        commentsResult,
        likesResult,
        rsvpsResult,
        flaggedResult,
        ticketRevenueResult,
        serviceRevenueResult,
      ] = await Promise.all([
        db.select({ count: sql`count(*)` }).from(users),
        db.select({ count: sql`count(*)` }).from(users).where(gte(users.createdAt, thirtyDaysAgo)),
        db.select({ count: sql`count(*)` }).from(events).where(gte(events.date, now)),
        db.select({ count: sql`count(*)` }).from(events).where(eq(events.status, 'pending')),
        db.select({ count: sql`count(*)` }).from(posts),
        db.select({ count: sql`count(*)` }).from(comments),
        db.select({ count: sql`count(*)` }).from(likes),
        db.select({ count: sql`count(*)` }).from(rsvps),
        db.select({ count: sql`count(*)` }).from(contentFlags).where(eq(contentFlags.status, ContentFlagStatus.PENDING)),
        db.select({ revenue: sql`COALESCE(sum(purchase_amount), 0)`, count: sql`count(*)` }).from(tickets),
        db.select({ revenue: sql`COALESCE(sum(total_price), 0)` }).from(serviceBookings)
          .where(and(eq(serviceBookings.isPaid, true), eq(serviceBookings.isRefunded, false))),
      ]);

      const totalUsers    = parseInt(totalUsersResult[0]?.count as string || '0');
      const newUsers      = parseInt(newUsersResult[0]?.count as string || '0');
      const activeEvents  = parseInt(activeEventsResult[0]?.count as string || '0');
      const pendingEvents = parseInt(pendingEventsResult[0]?.count as string || '0');
      const totalPosts    = parseInt(postsResult[0]?.count as string || '0');
      const totalComments = parseInt(commentsResult[0]?.count as string || '0');
      const totalLikes    = parseInt(likesResult[0]?.count as string || '0');
      const totalRsvps    = parseInt(rsvpsResult[0]?.count as string || '0');
      const flaggedContent      = parseInt(flaggedResult[0]?.count as string || '0');
      const ticketRevenueCents  = parseInt(ticketRevenueResult[0]?.revenue as string || '0');
      const ticketsSold         = parseInt(ticketRevenueResult[0]?.count as string || '0');
      const serviceRevenueDollars = parseFloat(serviceRevenueResult[0]?.revenue as string || '0');

      const ticketRevenue = ticketRevenueCents / 100;
      const serviceRevenue = serviceRevenueDollars;
      const totalRevenue = ticketRevenue + serviceRevenue;
      
      return {
        totalUsers,
        newUsers,
        activeEvents,
        pendingEvents,
        totalPosts,
        totalComments,
        totalLikes,
        totalRsvps,
        flaggedContent,
        totalRevenue,
        ticketRevenue,
        serviceRevenue,
        ticketsSold,
      };
    } catch (error) {
      console.error("[REAL-TIME STATS] Error calculating stats:", error);
      return {
        totalUsers: 0,
        newUsers: 0,
        activeEvents: 0,
        pendingEvents: 0,
        totalPosts: 0,
        totalComments: 0,
        totalLikes: 0,
        totalRsvps: 0,
        flaggedContent: 0,
        totalRevenue: 0,
        ticketRevenue: 0,
        serviceRevenue: 0,
        ticketsSold: 0,
      };
    }
  }

  async getRevenueForPeriod(startDate: Date, endDate: Date): Promise<number> {
    try {
      const ticketRevenueResult = await db.select({ 
        revenue: sql`COALESCE(sum(purchase_amount), 0)` 
      }).from(tickets)
        .where(and(
          gte(tickets.purchasedAt, startDate),
          lte(tickets.purchasedAt, endDate)
        ));
      
      const ticketRevenueCents = parseInt(ticketRevenueResult[0]?.revenue as string || '0');
      
      const serviceRevenueResult = await db.select({ 
        revenue: sql`COALESCE(sum(total_price), 0)` 
      }).from(serviceBookings)
        .where(and(
          eq(serviceBookings.isPaid, true),
          eq(serviceBookings.isRefunded, false),
          gte(serviceBookings.createdAt, startDate),
          lte(serviceBookings.createdAt, endDate)
        ));
      
      const serviceRevenueDollars = parseFloat(serviceRevenueResult[0]?.revenue as string || '0');
      
      return (ticketRevenueCents / 100) + serviceRevenueDollars; // Convert tickets to dollars, service already in dollars
    } catch (error) {
      console.error("[REVENUE PERIOD] Error calculating revenue:", error);
      return 0;
    }
  }

  // Legal Content Methods
  async getLegalContent(id: number): Promise<LegalContent | undefined> {
    const [content] = await db.select().from(legalContent)
      .where(eq(legalContent.id, id));
    return content;
  }

  async getLegalContentByType(type: string, language?: string): Promise<LegalContent | undefined> {
    const lang = language || "en";
    const [content] = await db.select().from(legalContent)
      .where(
        and(
          eq(legalContent.type, type),
          eq(legalContent.language, lang)
        )
      )
      .orderBy(desc(legalContent.createdAt))
      .limit(1);
    
    return content;
  }

  async getActiveLegalContentByType(type: string, language?: string): Promise<LegalContent | undefined> {
    const lang = language || "en";
    const [content] = await db.select().from(legalContent)
      .where(
        and(
          eq(legalContent.type, type),
          eq(legalContent.language, lang),
          eq(legalContent.isActive, true)
        )
      )
      .orderBy(desc(legalContent.publishedAt))
      .limit(1);
    
    return content;
  }

  async getAllLegalContent(): Promise<LegalContent[]> {
    return await db.select().from(legalContent)
      .orderBy(desc(legalContent.createdAt));
  }

  async createLegalContent(content: InsertLegalContent): Promise<LegalContent> {
    const now = new Date();
    const [newContent] = await db.insert(legalContent).values({
      ...content,
      createdAt: now,
      updatedAt: now,
      publishedAt: content.isActive ? now : null
    }).returning();
    
    return newContent;
  }

  async updateLegalContent(id: number, data: Partial<LegalContent>): Promise<LegalContent | undefined> {
    const now = new Date();
    const [updatedContent] = await db.update(legalContent)
      .set({
        ...data,
        updatedAt: now
      })
      .where(eq(legalContent.id, id))
      .returning();
    
    return updatedContent;
  }

  async publishLegalContent(id: number): Promise<LegalContent | undefined> {
    // First, get the content to be published to find its type and language
    const [content] = await db.select().from(legalContent)
      .where(eq(legalContent.id, id));
    
    if (!content) return undefined;
    
    // Set all other content of the same type and language to inactive
    await db.update(legalContent)
      .set({
        isActive: false,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(legalContent.type, content.type),
          eq(legalContent.language, content.language),
          not(eq(legalContent.id, id))
        )
      );
    
    // Set the target content to active and published
    const now = new Date();
    const [publishedContent] = await db.update(legalContent)
      .set({
        isActive: true,
        publishedAt: now,
        updatedAt: now
      })
      .where(eq(legalContent.id, id))
      .returning();
    
    return publishedContent;
  }

  // Legal Consent Methods
  async getUserConsent(userId: number): Promise<LegalConsent | undefined> {
    const [consent] = await db.select().from(legalConsent)
      .where(eq(legalConsent.userId, userId));
    return consent;
  }

  async recordUserConsent(consent: InsertLegalConsent): Promise<LegalConsent> {
    const now = new Date();
    const [newConsent] = await db.insert(legalConsent).values({
      ...consent,
      createdAt: now,
      updatedAt: now
    }).returning();
    
    return newConsent;
  }

  async updateUserConsent(userId: number, data: Partial<LegalConsent>): Promise<LegalConsent | undefined> {
    const now = new Date();
    const [updatedConsent] = await db.update(legalConsent)
      .set({
        ...data,
        updatedAt: now
      })
      .where(eq(legalConsent.userId, userId))
      .returning();
    
    return updatedConsent;
  }

  // Data Deletion Request Methods
  async createDataDeletionRequest(request: InsertDataDeletionRequest): Promise<DataDeletionRequest> {
    const now = new Date();
    const [newRequest] = await db.insert(dataDeletionRequests).values({
      ...request,
      status: "pending",
      processedBy: null,
      processedAt: null,
      createdAt: now,
      updatedAt: null
    }).returning();
    
    return newRequest;
  }

  async getDataDeletionRequest(id: number): Promise<DataDeletionRequest | undefined> {
    const [request] = await db.select().from(dataDeletionRequests)
      .where(eq(dataDeletionRequests.id, id));
    return request;
  }

  async getDataDeletionRequestsByUser(userId: number): Promise<DataDeletionRequest[]> {
    return await db.select().from(dataDeletionRequests)
      .where(eq(dataDeletionRequests.userId, userId))
      .orderBy(desc(dataDeletionRequests.createdAt));
  }

  async getAllDataDeletionRequests(): Promise<DataDeletionRequest[]> {
    return await db.select().from(dataDeletionRequests)
      .orderBy(desc(dataDeletionRequests.createdAt));
  }
  
  async getDataDeletionRequestsByStatus(status: string): Promise<DataDeletionRequest[]> {
    return await db.select().from(dataDeletionRequests)
      .where(eq(dataDeletionRequests.status, status))
      .orderBy(desc(dataDeletionRequests.createdAt));
  }
  
  async updateDataDeletionRequest(id: number, request: Partial<DataDeletionRequest>): Promise<DataDeletionRequest | undefined> {
    const now = new Date();
    const [updatedRequest] = await db.update(dataDeletionRequests)
      .set({
        ...request,
        updatedAt: now
      })
      .where(eq(dataDeletionRequests.id, id))
      .returning();
    
    return updatedRequest;
  }

  async processDataDeletionRequest(id: number, adminId: number, approved: boolean, notes?: string): Promise<DataDeletionRequest | undefined> {
    const now = new Date();
    const [updatedRequest] = await db.update(dataDeletionRequests)
      .set({
        status: approved ? "approved" : "rejected",
        adminNotes: notes || null,
        processedBy: adminId,
        processedAt: now,
        updatedAt: now
      })
      .where(eq(dataDeletionRequests.id, id))
      .returning();
    
    return updatedRequest;
  }

  // Explore Page Image Methods
  async getExplorePageImage(id: number): Promise<ExplorePageImage | undefined> {
    const [image] = await db.select().from(explorePageImages).where(eq(explorePageImages.id, id));
    return image;
  }

  async getExplorePageImages(): Promise<ExplorePageImage[]> {
    return await db.select().from(explorePageImages);
  }

  async getExplorePageImagesBySection(section: string): Promise<ExplorePageImage[]> {
    return await db.select()
      .from(explorePageImages)
      .where(eq(explorePageImages.section, section))
      .orderBy(asc(explorePageImages.sortOrder));
  }

  async createExplorePageImage(image: InsertExplorePageImage): Promise<ExplorePageImage> {
    const now = new Date();
    const [newImage] = await db.insert(explorePageImages).values({
      ...image,
      createdAt: now,
      updatedAt: now,
      isActive: image.isActive !== undefined ? image.isActive : true,
      isCoverImage: image.isCoverImage !== undefined ? image.isCoverImage : false,
      sortOrder: image.sortOrder || 0,
    }).returning();
    
    return newImage;
  }

  async updateExplorePageImage(id: number, updates: Partial<InsertExplorePageImage>): Promise<ExplorePageImage | undefined> {
    const now = new Date();
    const [updatedImage] = await db.update(explorePageImages)
      .set({
        ...updates,
        updatedAt: now
      })
      .where(eq(explorePageImages.id, id))
      .returning();
    
    return updatedImage;
  }

  async deleteExplorePageImage(id: number): Promise<ExplorePageImage | undefined> {
    const [deletedImage] = await db.delete(explorePageImages)
      .where(eq(explorePageImages.id, id))
      .returning();
    
    return deletedImage;
  }

  // Chat - Conversations
  async getConversation(id: number): Promise<Conversation | undefined> {
    try {
      const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
      return conversation;
    } catch (error) {
      console.error("Error getting conversation:", error);
      return undefined;
    }
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const now = new Date();
    
    // Ensure participant IDs are properly formatted as an array for PostgreSQL
    const participantIds = this.ensureArrayField(conversation.participantIds);
    
    try {
      // Insert the conversation into the database
      const [newConversation] = await db.insert(conversations).values({
        participantIds: participantIds,
        title: conversation.title || null,
        createdById: conversation.createdById || null,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        isGroup: conversation.isGroup || false,
        avatar: conversation.avatar || null,
        metadata: conversation.metadata || null
      }).returning();
      
      return newConversation;
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  }
  
  // Chat - ChatConversations (direct message format)
  async updateConversation(id: number, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;

    const updatedConversation = {
      ...conversation,
      ...data,
      updatedAt: new Date()
    };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  async getConversationsByUser(userId: number): Promise<Conversation[]> {
    try {
      // Find all conversations where the user is in the participantIds array
      const results = await db.select()
        .from(conversations)
        .where(sql`${userId} = ANY(${conversations.participantIds})`)
        .orderBy(desc(conversations.lastMessageAt));
        
      return results;
    } catch (error) {
      console.error("Error getting conversations by user:", error);
      return [];
    }
  }

  async getConversationByParticipants(userIds: number[]): Promise<Conversation | undefined> {
    try {
      // Sort the userIds to ensure consistent array matching
      const sortedUserIds = [...userIds].sort((a, b) => a - b);
      
      // Find all conversations
      const allConversations = await db.select()
        .from(conversations)
        .where(sql`array_length(${conversations.participantIds}, 1) = ${sortedUserIds.length}`)
        .orderBy(desc(conversations.lastMessageAt));
      
      // Check each conversation to see if its participants exactly match the provided userIds
      for (const conversation of allConversations) {
        // Sort the conversation participant IDs for consistent comparison
        const conversationParticipants = [...conversation.participantIds].sort((a, b) => a - b);
        
        // Check if arrays have the same length and all participants match
        const sameLength = conversationParticipants.length === sortedUserIds.length;
        const allFound = sortedUserIds.every(id => conversationParticipants.includes(id));
        const exactMatch = sameLength && allFound;
        
        if (exactMatch) {
          return conversation;
        }
      }
      
      return undefined;
    } catch (error) {
      console.error("Error finding conversation by participants:", error);
      return undefined;
    }
  }

  // Chat - Messages
  async getChatMessage(id: number): Promise<ChatMessage | undefined> {
    try {
      const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
      return message;
    } catch (error) {
      console.error("Error getting chat message:", error);
      return undefined;
    }
  }

  async createChatMessage(message: any): Promise<ChatMessage> {
    try {
      const now = new Date();
      
      // Debug the incoming message object
      
      // Normalize fields from either snake_case or camelCase to our camelCase schema
      const senderId = Number(message.senderId || message.sender_id);
      const conversationId = Number(message.conversationId || message.conversation_id);
      const content = (message.content || "").trim();
      
      // Only require senderId and conversationId
      if (isNaN(senderId) || senderId <= 0) {
        throw new Error(`Invalid senderId: ${message.senderId || message.sender_id}`);
      }
      
      if (isNaN(conversationId) || conversationId <= 0) {
        throw new Error(`Invalid conversationId: ${message.conversationId || message.conversation_id}`);
      }
      
      if (!content) {
        throw new Error("Message content cannot be empty");
      }
      
      // Find the recipient ID in the conversation
      const conversation = await this.getChatConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation with ID ${conversationId} not found`);
      }
      
      // Determine the recipient_id based on who is the other participant in the conversation
      let recipientId = conversation.participantOneId;
      if (recipientId === senderId) {
        recipientId = conversation.participantTwoId;
      }
      
      if (!recipientId) {
        throw new Error(`Cannot determine recipient for conversation ${conversationId}`);
      }
      
        // Use camelCase field names that match the schema with actual DB columns
      const [newMessage] = await db.insert(chatMessages)
        .values({
          senderId,
          conversationId,
          content,
          createdAt: now,
          updatedAt: now, // Use updatedAt instead of editedAt
          status: 'sent',
          type: message.type || message.contentType || 'text',
          metadata: message.metadata || null,
          recipientId: recipientId, // Add the required recipient_id field
          isDelivered: false,
          isRead: false
        })
        .returning();
      
      
      // Update the lastActivity timestamp in the chat conversation
      await db.update(chatConversations)
        .set({ 
          lastActivity: now,
          lastMessageId: newMessage.id,
          updatedAt: now
        })
        .where(eq(chatConversations.id, conversationId));
      
      return newMessage;
    } catch (error) {
      console.error("[ERROR] Error creating chat message:", error);
      throw error;
    }
  }

  async updateChatMessage(id: number, data: Partial<ChatMessage>): Promise<ChatMessage | undefined> {
    try {
      // Check if the message exists
      const [existingMessage] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
      if (!existingMessage) return undefined;
      
      // Set the updated data with camelCase field names that match Drizzle schema
      // Use updatedAt instead of editedAt
      const now = new Date();
      const updateData = {
        ...data,
        updatedAt: now
      };
      
      // Update the message in the database
      const [updatedMessage] = await db.update(chatMessages)
        .set(updateData)
        .where(eq(chatMessages.id, id))
        .returning();
      
      return updatedMessage;
    } catch (error) {
      console.error("Error updating chat message:", error);
      return undefined;
    }
  }

  async deleteChatMessage(id: number): Promise<boolean> {
    try {
      // Check if the message exists
      const [existingMessage] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
      if (!existingMessage) return false;
      
      // Since we don't have an isDeleted column in the database, we'll use another approach
      // We'll update the message to have '[DELETED]' as content to indicate it's deleted
      const [updatedMessage] = await db.update(chatMessages)
        .set({ 
          content: '[DELETED]',
          updatedAt: new Date()
        })
        .where(eq(chatMessages.id, id))
        .returning();
      
      return !!updatedMessage;
    } catch (error) {
      console.error("Error deleting chat message:", error);
      return false;
    }
  }

  async getChatMessagesByConversation(conversationId: number, limit?: number, before?: Date): Promise<ChatMessage[]> {
    try {
      const conditions = [
        eq(chatMessages.conversationId, conversationId),
        not(eq(chatMessages.content, '[DELETED]'))
      ];
      if (before) conditions.push(lt(chatMessages.createdAt, before) as any);

      let query = db.select()
        .from(chatMessages)
        .where(and(...conditions))
        .orderBy(desc(chatMessages.createdAt));

      if (limit && limit > 0) query = query.limit(limit) as any;

      const messages = await query;
      return messages;
    } catch (error) {
      console.error("Error getting chat messages by conversation:", error);
      return [];
    }
  }
  
  // This function is called from the routes.ts file to get messages with delivery status
  async getChatMessages(conversationId: number, page: number = 1, limit: number = 50): Promise<any[]> {
    try {
      const offset = (page - 1) * limit;
      const messages = await db.select()
        .from(chatMessages)
        .where(and(
          eq(chatMessages.conversationId, conversationId),
          not(eq(chatMessages.content, '[DELETED]'))
        ))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit)
        .offset(offset);
      
      // For each message, get its delivery status information
      const messagesWithStatus = await Promise.all(
        messages.map(async message => {
          const deliveryStatus = await db.select()
            .from(messageDeliveryStatus)
            .where(eq(messageDeliveryStatus.messageId, message.id));
          
          return {
            ...message,
            deliveryStatus: deliveryStatus || []
          };
        })
      );
      
      
      // Return messages in chronological order (oldest first for display)
      return messagesWithStatus.reverse();
    } catch (error) {
      console.error("Error in getChatMessages:", error);
      return [];
    }
  }
  
  // Chat Conversations (Direct Message format)
  async getChatConversationByParticipants(userId1: number, userId2: number): Promise<ChatConversation | undefined> {
    try {
      // Find direct conversation where these two users are participants
      // We need to check both possible arrangements of participantOneId and participantTwoId
      // Using camelCase to match the schema definition
      const result = await db.select()
        .from(chatConversations)
        .where(
          or(
            and(
              eq(chatConversations.participantOneId, userId1),
              eq(chatConversations.participantTwoId, userId2)
            ),
            and(
              eq(chatConversations.participantOneId, userId2),
              eq(chatConversations.participantTwoId, userId1)
            )
          )
        )
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("Error getting chat conversation by participants:", error);
      throw error;
    }
  }
  
  // New Chat System - Conversations
  async createChatConversation(data: any): Promise<any> {
    try {
      const now = new Date();
      const userId = data.createdBy;
      const isGroup = data.isGroup === true;
      const participants: number[] = data.participants || [];

      // For 1-on-1: store participantOneId/participantTwoId
      const otherUserId = !isGroup && participants.length > 0 ? participants[0] : null;

      const insertResult = await db.execute(sql`
        INSERT INTO chat_conversations
          (created_at, updated_at, last_activity, participant_one_id, participant_two_id,
           status, is_group, title, group_avatar_url, created_by)
        VALUES
          (${now}, ${now}, ${now}, ${userId}, ${otherUserId},
           'active', ${isGroup}, ${data.title || null}, ${data.groupAvatarUrl || null}, ${userId})
        RETURNING *
      `);

      if (insertResult.rowCount === 0) {
        throw new Error("Failed to create conversation - no rows returned");
      }

      const row = insertResult.rows[0];
      const newConversation = {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastActivity: row.last_activity,
        participantOneId: row.participant_one_id,
        participantTwoId: row.participant_two_id,
        lastMessageId: row.last_message_id,
        status: row.status,
        isGroup: row.is_group,
        title: row.title,
        groupAvatarUrl: row.group_avatar_url,
      };

      // Add all participants (creator always isAdmin)
      try {
        const allParticipants = [userId, ...participants.filter((p: number) => p !== userId)];
        for (const pid of allParticipants) {
          await db.execute(sql`
            INSERT INTO chat_participants (conversation_id, user_id, joined_at, is_admin, is_muted)
            VALUES (${newConversation.id}, ${pid}, ${now}, ${pid === userId}, false)
            ON CONFLICT (conversation_id, user_id) DO NOTHING
          `);
        }
      } catch (participantError) {
        console.error("[CHAT] Error adding participants:", participantError);
      }

      return newConversation;
    } catch (error) {
      console.error("[CHAT] Error creating chat conversation:", error);
      throw error;
    }
  }
  
  async getChatConversation(id: number): Promise<any | undefined> {
    try {
      const result = await db.select()
        .from(chatConversations)
        .where(eq(chatConversations.id, id))
        .limit(1);
        
      return result[0];
    } catch (error) {
      console.error("Error getting chat conversation:", error);
      throw error;
    }
  }
  
  async updateChatConversation(id: number, data: any): Promise<any | undefined> {
    try {
      const [updatedConversation] = await db.update(chatConversations)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(chatConversations.id, id))
        .returning();
        
      return updatedConversation;
    } catch (error) {
      console.error("Error updating chat conversation:", error);
      throw error;
    }
  }
  
  async deleteChatConversation(id: number): Promise<boolean> {
    try {
      // Delete related entities first
      await db.delete(messageDeliveryStatus)
        .where(
          inArray(
            messageDeliveryStatus.messageId,
            db.select({ id: chatMessages.id })
              .from(chatMessages)
              .where(eq(chatMessages.conversationId, id))
          )
        );
        
      await db.delete(chatMessages)
        .where(eq(chatMessages.conversationId, id));
        
      await db.delete(chatParticipants)
        .where(eq(chatParticipants.conversationId, id));
        
      // Delete the conversation
      const result = await db.delete(chatConversations)
        .where(eq(chatConversations.id, id))
        .returning();
        
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting chat conversation:", error);
      throw error;
    }
  }
  
  async getUserConversations(userId: number): Promise<any[]> {
    try {
      // Single SQL query: conversations + other user + last message + unread count.
      // Replaces the previous N+1 pattern (20-50 queries) with exactly 1 round-trip.
      const rows = await db.execute(sql`
        SELECT
          cc.id,
          cc.created_at,
          cc.updated_at,
          cc.last_activity,
          cc.participant_one_id,
          cc.participant_two_id,
          cc.is_group,
          cc.title           AS conv_title,
          cc.group_avatar_url,
          -- Participant pin/archive status for this user
          cp.is_pinned,
          cp.is_archived,
          -- Other participant user details (for DMs)
          ou.id              AS ou_id,
          ou.display_name    AS ou_display_name,
          ou.profile_picture AS ou_profile_picture,
          ou.role            AS ou_role,
          -- Last message via LATERAL subquery (most recent per conversation)
          lm.id              AS lm_id,
          lm.content         AS lm_content,
          lm.type            AS lm_type,
          lm.sender_id       AS lm_sender_id,
          lm.created_at      AS lm_created_at,
          -- Unread count in a single correlated subquery
          COALESCE((
            SELECT COUNT(*)
            FROM   chat_messages cm2
            LEFT   JOIN message_delivery_status mds
                   ON mds.message_id = cm2.id AND mds.user_id = ${userId}
            WHERE  cm2.conversation_id = cc.id
              AND  cm2.sender_id       != ${userId}
              AND  cm2.content NOT IN ('[DELETED]', '[voice_expired]')
              AND  mds.read_at IS NULL
          ), 0) AS unread_count
        FROM chat_conversations cc
        -- Current user's participant record (for pin/archive)
        LEFT JOIN chat_participants cp
          ON cp.conversation_id = cc.id AND cp.user_id = ${userId}
        -- Resolve "other participant" from the two direct columns (DM only)
        LEFT JOIN users ou
          ON ou.id = CASE
               WHEN cc.is_group IS NOT TRUE AND cc.participant_one_id = ${userId} THEN cc.participant_two_id
               WHEN cc.is_group IS NOT TRUE THEN cc.participant_one_id
               ELSE NULL
             END
        -- Latest message per conversation
        LEFT JOIN LATERAL (
          SELECT id, content, type, sender_id, created_at
          FROM   chat_messages
          WHERE  conversation_id = cc.id
          ORDER  BY created_at DESC
          LIMIT  1
        ) lm ON true
        WHERE cc.participant_one_id = ${userId}
           OR cc.participant_two_id = ${userId}
           OR EXISTS (
             SELECT 1 FROM chat_participants xcp
             WHERE xcp.conversation_id = cc.id AND xcp.user_id = ${userId}
           )
        ORDER BY cc.last_activity DESC NULLS LAST
      `);

      return (rows.rows as any[]).map(row => {
        const isGroup = !!row.is_group;

        const otherUser = !isGroup && row.ou_id
          ? [{
              id: row.ou_id,
              displayName: row.ou_display_name || `User ${row.ou_id}`,
              profilePicture: row.ou_profile_picture || null,
              role: row.ou_role || 'user',
              isAdmin: false,
              isMuted: false,
              nickname: null,
            }]
          : [];

        const lastMessage = row.lm_id
          ? {
              id: row.lm_id,
              content: row.lm_content,
              type: row.lm_type || 'text',
              contentType: row.lm_type || 'text',
              senderId: row.lm_sender_id,
              createdAt: row.lm_created_at,
              metadata: null,
            }
          : null;

        return {
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastMessageAt: row.last_activity,
          isGroupChat: isGroup,
          isGroup,
          title: row.conv_title || (!isGroup ? (otherUser[0]?.displayName || null) : null),
          groupAvatarUrl: row.group_avatar_url || null,
          isPinned: !!row.is_pinned,
          isArchived: !!row.is_archived,
          participants: otherUser,
          lastMessage,
          unreadCount: parseInt(row.unread_count) || 0,
        };
      });
    } catch (error) {
      console.error("[Chat] Error getting user conversations:", error);
      throw error;
    }
  }
  
  async getChatConversationWithDetails(id: number): Promise<any | undefined> {
    try {
      // Get the conversation 
      const conversation = await this.getChatConversationById(id);
      
      if (!conversation) {
        return undefined;
      }
      
      const participants = [
        { 
          userId: conversation.participantOneId, 
          conversationId: id,
          isAdmin: false,
          isMuted: false,
          nickname: null
        },
        { 
          userId: conversation.participantTwoId, 
          conversationId: id,
          isAdmin: false,
          isMuted: false,
          nickname: null
        }
      ];
        
      // Get user details for each participant
      const participantsWithDetails = await Promise.all(
        participants.map(async p => {
          const user = await this.getUser(p.userId);
          return {
            userId: p.userId,
            displayName: user?.displayName || `User ${p.userId}`,
            profilePicture: user?.profilePicture || null,
            role: user?.role || 'user',
            isAdmin: p.isAdmin,
            isMuted: p.isMuted,
            nickname: p.nickname
          };
        })
      );
      
      // Get the last message
      const lastMessage = await db.select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, id))
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);
        
      return {
        ...conversation,
        participants: participantsWithDetails,
        lastMessage: lastMessage.length > 0 ? lastMessage[0] : null
      };
    } catch (error) {
      console.error("Error getting chat conversation with details:", error);
      throw error;
    }
  }
  
  async findDirectConversation(userId1: number, userId2: number): Promise<any | undefined> {
    try {
      // For a direct conversation, simply look for a conversation where the two users are participants
      const directConversations = await db.select()
        .from(chatConversations)
        .where(
          or(
            and(
              eq(chatConversations.participantOneId, userId1),
              eq(chatConversations.participantTwoId, userId2)
            ),
            and(
              eq(chatConversations.participantOneId, userId2),
              eq(chatConversations.participantTwoId, userId1)
            )
          )
        );
      
      if (directConversations.length === 0) {
        return undefined;
      }
      
      // Get the full conversation details for the first match
      return await this.getChatConversationWithDetails(directConversations[0].id);
    } catch (error) {
      console.error("Error finding direct conversation:", error);
      throw error;
    }
  }
  
  async getChatConversationById(id: number): Promise<ChatConversation | undefined> {
    try {
      const result = await db.select()
        .from(chatConversations)
        .where(eq(chatConversations.id, id))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("Error getting chat conversation by ID:", error);
      return undefined;
    }
  }
  
  async getChatConversationsByUserId(userId: number): Promise<ChatConversation[]> {
    try {
      // Find all conversations where the user is either participantOneId or participantTwoId
      // using camelCase to match the schema definition
      const result = await db.select()
        .from(chatConversations)
        .where(
          or(
            eq(chatConversations.participantOneId, userId),
            eq(chatConversations.participantTwoId, userId)
          )
        )
        .orderBy(desc(chatConversations.lastActivity));
      
      return result;
    } catch (error) {
      console.error("Error getting chat conversations by user ID:", error);
      return [];
    }
  }

  // Chat - Message Delivery Status
  async getMessageDeliveryStatus(messageId: number, userId: number): Promise<MessageDeliveryStatus | undefined> {
    try {
      const result = await db.select()
        .from(messageDeliveryStatus)
        .where(and(
          eq(messageDeliveryStatus.messageId, messageId),
          eq(messageDeliveryStatus.userId, userId)
        ))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("Error getting message delivery status:", error);
      return undefined;
    }
  }

  async createMessageDelivery(delivery: InsertMessageDeliveryStatus): Promise<MessageDeliveryStatus> {
    try {
      const now = new Date();
      const newDelivery = {
        ...delivery,
        createdAt: now,
        updatedAt: now,
        deliveredAt: null,
        readAt: null
      };
      
      const result = await db.insert(messageDeliveryStatus)
        .values(newDelivery)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error creating message delivery:", error);
      throw error;
    }
  }

  async updateMessageDelivery(messageId: number, userId: number, status: string): Promise<MessageDeliveryStatus | undefined> {
    try {
      // First get the existing delivery record
      const existingDelivery = await this.getMessageDeliveryStatus(messageId, userId);
      if (!existingDelivery) return undefined;
      
      const now = new Date();
      const updateData = {
        status,
        updatedAt: now
      };
      
      // Update the delivery status
      const result = await db.update(messageDeliveryStatus)
        .set(updateData)
        .where(and(
          eq(messageDeliveryStatus.messageId, messageId),
          eq(messageDeliveryStatus.userId, userId)
        ))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error updating message delivery:", error);
      return undefined;
    }
  }

  async markMessageAsDelivered(messageId: number, userId: number): Promise<MessageDeliveryStatus | undefined> {
    try {
      // First get the existing delivery record
      const existingDelivery = await this.getMessageDeliveryStatus(messageId, userId);
      if (!existingDelivery) return undefined;
      
      const now = new Date();
      const updateData = {
        status: 'delivered',
        deliveredAt: now,
        updatedAt: now
      };
      
      // Update the delivery status
      const result = await db.update(messageDeliveryStatus)
        .set(updateData)
        .where(and(
          eq(messageDeliveryStatus.messageId, messageId),
          eq(messageDeliveryStatus.userId, userId)
        ))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error marking message as delivered:", error);
      return undefined;
    }
  }
  
  async updateMessageDeliveryStatus(messageId: number, userId: number, data: Partial<MessageDeliveryStatus>): Promise<MessageDeliveryStatus | undefined> {
    try {
      // First check if a delivery status record exists
      const existingDelivery = await this.getMessageDeliveryStatus(messageId, userId);
      
      const now = new Date();
      if (existingDelivery) {
        // Update existing record
        const updateData: any = {
          updatedAt: now
        };
        
        if (data.status) updateData.status = data.status;
        
        // If transitioning to 'read' state, ensure both delivered and read timestamps are set
        if (data.status === 'read') {
          updateData.deliveredAt = existingDelivery.deliveredAt || now;
          updateData.readAt = existingDelivery.readAt || now;
        }
        
        // If just transitioning to 'delivered', set only delivered timestamp
        if (data.status === 'delivered' && !existingDelivery.deliveredAt) {
          updateData.deliveredAt = now;
        }
        
        // Update specific fields from data if provided
        if (data.deliveredAt) updateData.deliveredAt = data.deliveredAt;
        if (data.readAt) updateData.readAt = data.readAt;
        
        // Perform the update
        const result = await db.update(messageDeliveryStatus)
          .set(updateData)
          .where(and(
            eq(messageDeliveryStatus.messageId, messageId),
            eq(messageDeliveryStatus.userId, userId)
          ))
          .returning();
        
        return result[0];
      } else {
        // Create a new delivery status record
        // Set appropriate timestamps based on requested status
        const deliveredAt = (data.status === 'delivered' || data.status === 'read') ? now : null;
        const readAt = data.status === 'read' ? now : null;
        
        const newStatus = {
          messageId,
          userId,
          status: data.status || 'sent',
          deliveredAt,
          readAt,
          createdAt: now,
          updatedAt: now
        };
        
        const result = await db.insert(messageDeliveryStatus)
          .values(newStatus)
          .returning();
        
        return result[0];
      }
    } catch (error) {
      console.error("Error updating message delivery status:", error);
      return undefined;
    }
  }
  
  async markMessageAsRead(messageId: number, userId: number): Promise<MessageDeliveryStatus | undefined> {
    try {
      // First get the existing delivery record
      const existingDelivery = await this.getMessageDeliveryStatus(messageId, userId);
      if (!existingDelivery) return undefined;
      
      const now = new Date();
      const updateData = {
        status: 'read',
        deliveredAt: existingDelivery.deliveredAt || now, // ensure delivered timestamp is set
        readAt: now,
        updatedAt: now
      };
      
      // Update the delivery status
      const result = await db.update(messageDeliveryStatus)
        .set(updateData)
        .where(and(
          eq(messageDeliveryStatus.messageId, messageId),
          eq(messageDeliveryStatus.userId, userId)
        ))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error marking message as read:", error);
      return undefined;
    }
  }

  // Bulk mark all messages in a conversation as read — single query, no N+1
  async markConversationAsRead(conversationId: number, userId: number): Promise<number[]> {
    try {
      const now = new Date();
      // Update existing delivery status records for all messages in this conversation
      // that were not sent by this user and haven't been read yet
      const updated = await db.execute(sql`
        UPDATE message_delivery_status mds
        SET status = 'read', read_at = ${now}, updated_at = ${now},
            delivered_at = COALESCE(mds.delivered_at, ${now})
        FROM chat_messages cm
        WHERE mds.message_id = cm.id
          AND cm.conversation_id = ${conversationId}
          AND cm.sender_id != ${userId}
          AND mds.user_id = ${userId}
          AND mds.read_at IS NULL
        RETURNING cm.sender_id
      `);
      const senderIds = [...new Set((updated.rows as any[]).map(r => r.sender_id as number))];

      // Also update is_read flag on messages directly (fallback for messages without delivery records)
      await db.execute(sql`
        UPDATE chat_messages
        SET is_read = true
        WHERE conversation_id = ${conversationId}
          AND sender_id != ${userId}
          AND is_read = false
      `);

      return senderIds;
    } catch (error) {
      console.error("Error bulk-marking conversation as read:", error);
      return [];
    }
  }

  async markMessageAsSeen(messageId: number, userId: number): Promise<MessageDeliveryStatus | undefined> {
    try {
      // First get the existing delivery record
      const existingDelivery = await this.getMessageDeliveryStatus(messageId, userId);
      if (!existingDelivery) return undefined;
      
      const now = new Date();
      const updateData = {
        status: 'seen',
        deliveredAt: existingDelivery.deliveredAt || now,
        seenAt: now,
        updatedAt: now
      };
      
      // Update the delivery status
      const result = await db.update(messageDeliveryStatus)
        .set(updateData)
        .where(and(
          eq(messageDeliveryStatus.messageId, messageId),
          eq(messageDeliveryStatus.userId, userId)
        ))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error marking message as seen:", error);
      return undefined;
    }
  }

  // Chat - Conversation Participants

  async createChatParticipant(participant: InsertChatParticipant): Promise<ChatParticipant> {
    try {
      // Validate required fields
      if (!participant.conversationId) {
        console.error("[CHAT DEBUG] Missing conversationId in participant data:", participant);
        throw new Error("conversationId is required for creating chat participant");
      }
      
      if (!participant.userId) {
        console.error("[CHAT DEBUG] Missing userId in participant data:", participant);
        throw new Error("userId is required for creating chat participant");
      }
      
      
      // Use a direct SQL query to insert the participant
      // This approach bypasses any potential ORM issues
      const insertResult = await db.execute(sql`
        INSERT INTO chat_participants (conversation_id, user_id, joined_at, is_admin, nickname, is_muted) 
        VALUES (${participant.conversationId}, ${participant.userId}, NOW(), 
                ${participant.isAdmin || false}, ${participant.nickname || null}, ${participant.isMuted || false})
        RETURNING *
      `);
      
      if (insertResult.rowCount > 0) {
        return {
          id: insertResult.rows[0].id,
          conversationId: insertResult.rows[0].conversation_id,
          userId: insertResult.rows[0].user_id,
          joinedAt: insertResult.rows[0].joined_at,
          leftAt: insertResult.rows[0].left_at,
          isAdmin: insertResult.rows[0].is_admin,
          nickname: insertResult.rows[0].nickname,
          isMuted: insertResult.rows[0].is_muted,
          lastReadMessageId: insertResult.rows[0].last_read_message_id
        };
      } else {
        throw new Error("No rows returned from insert operation");
      }
    } catch (error) {
      console.error("[CHAT DEBUG] Error creating chat participant:", error);
      
      try {
        if (error instanceof Error) {
          console.error("[CHAT DEBUG] Error message:", error.message);
          console.error("[CHAT DEBUG] Error stack:", error.stack);
        } else {
          console.error("[CHAT DEBUG] Non-Error object thrown:", error);
        }
        
        // Log database tables for debugging
        const convResult = await db.execute(sql`SELECT COUNT(*) FROM chat_conversations`);
        
        const partResult = await db.execute(sql`SELECT COUNT(*) FROM chat_participants`);
        
        // Log the structure of the table
        const tableStructure = await db.execute(sql`
          SELECT column_name, data_type, is_nullable 
          FROM information_schema.columns 
          WHERE table_name = 'chat_participants'
        `);
        
      } catch (logError) {
        console.error("[CHAT DEBUG] Error while logging debug info:", logError);
      }
      
      throw new Error(`Failed to create chat participant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async removeChatParticipant(conversationId: number, userId: number): Promise<boolean> {
    try {
      // Instead of deleting the record, we can mark the participant as having left
      const now = new Date();
      const result = await db.update(chatParticipants)
        .set({ leftAt: now })
        .where(and(
          eq(chatParticipants.conversationId, conversationId),
          eq(chatParticipants.userId, userId)
        ));
      
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error("Error removing chat participant:", error);
      return false;
    }
  }

  async getChatParticipantsByConversation(conversationId: number): Promise<ChatParticipant[]> {
    try {
      const result = await db.select()
        .from(chatParticipants)
        .where(and(
          eq(chatParticipants.conversationId, conversationId),
          isNull(chatParticipants.leftAt) // Only return active participants
        ));
      
      return result;
    } catch (error) {
      console.error("Error getting chat participants:", error);
      return [];
    }
  }
  
  // Function to match the interface - alias of getChatParticipantsByConversation
  async getChatParticipants(conversationId: number): Promise<ChatParticipant[]> {
    console.log(`Getting chat participants for conversation ${conversationId}`);
    return this.getChatParticipantsByConversation(conversationId);
  }
  
  async getChatParticipant(conversationId: number, userId: number): Promise<ChatParticipant | undefined> {
    try {
      const result = await db.select()
        .from(chatParticipants)
        .where(and(
          eq(chatParticipants.conversationId, conversationId),
          eq(chatParticipants.userId, userId),
          isNull(chatParticipants.leftAt) // Only return active participants
        ))
        .limit(1);
      
      return result[0];
    } catch (error) {
      console.error("Error getting chat participant:", error);
      return undefined;
    }
  }
  
  // Check if a user is a participant in a conversation
  async isConversationParticipant(conversationId: number, userId: number): Promise<boolean> {
    try {
      // Single query: check direct participation OR chat_participants table
      const result = await db.execute(sql`
        SELECT 1 FROM chat_conversations
        WHERE id = ${conversationId}
          AND (participant_one_id = ${userId} OR participant_two_id = ${userId})
        UNION ALL
        SELECT 1 FROM chat_participants
        WHERE conversation_id = ${conversationId}
          AND user_id = ${userId}
          AND left_at IS NULL
        LIMIT 1
      `);
      return (result.rows?.length ?? 0) > 0;
    } catch (error) {
      console.error(`Error checking participant for conversation ${conversationId}:`, error);
      return false;
    }
  }
  
  // Alias function for isConversationParticipant with different parameter order
  async isUserInConversation(userId: number, conversationId: number): Promise<boolean> {
    return this.isConversationParticipant(conversationId, userId);
  }

  async updateChatParticipant(conversationId: number, userId: number, data: Partial<ChatParticipant>): Promise<ChatParticipant | undefined> {
    try {
      // Try update first
      const updateResult = await db.update(chatParticipants)
        .set(data as any)
        .where(and(
          eq(chatParticipants.conversationId, conversationId),
          eq(chatParticipants.userId, userId)
        ))
        .returning();
      if (updateResult.length > 0) return updateResult[0];

      // No existing row — insert one (upsert pattern for DMs where participant
      // rows are stored in the legacy two-column schema, not chat_participants)
      const insertResult = await db.insert(chatParticipants)
        .values({ conversationId, userId, ...(data as any) })
        .onConflictDoUpdate({
          target: [chatParticipants.conversationId, chatParticipants.userId],
          set: data as any,
        })
        .returning();
      return insertResult[0];
    } catch (error) {
      console.error("Error updating chat participant:", error);
      return undefined;
    }
  }

  async updateTypingStatus(conversationId: number, userId: number, isTyping: boolean): Promise<ChatParticipant | undefined> {
    try {
      // First get the existing participant
      const participant = await this.getChatParticipant(conversationId, userId);
      if (!participant) return undefined;
      
      const now = new Date();
      const updateData = {
        isTyping,
        lastTypingAt: isTyping ? now : participant.lastTypingAt
      };
      
      const result = await db.update(chatParticipants)
        .set(updateData)
        .where(and(
          eq(chatParticipants.conversationId, conversationId),
          eq(chatParticipants.userId, userId),
          isNull(chatParticipants.leftAt) // Only update active participants
        ))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error updating typing status:", error);
      return undefined;
    }
  }

  async markParticipantLastRead(conversationId: number, userId: number, messageId: number): Promise<ChatParticipant | undefined> {
    try {
      // First get the existing participant
      const participant = await this.getChatParticipant(conversationId, userId);
      if (!participant) return undefined;
      
      const now = new Date();
      const updateData = {
        lastReadMessageId: messageId,
        lastReadAt: now
      };
      
      const result = await db.update(chatParticipants)
        .set(updateData)
        .where(and(
          eq(chatParticipants.conversationId, conversationId),
          eq(chatParticipants.userId, userId),
          isNull(chatParticipants.leftAt) // Only update active participants
        ))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      return undefined;
    }
  }

  // Admin AI Assistant Methods
  async createAdminAiAssistant(data: InsertAdminAiAssistant): Promise<AdminAiAssistant> {
    try {
      const now = new Date();
      const [newAssistantEntry] = await db.insert(adminAiAssistant).values({
        ...data,
        createdAt: now,
        updatedAt: now,
        isCompleted: false
      }).returning();
      
      return newAssistantEntry;
    } catch (error) {
      console.error("Error creating admin AI assistant entry:", error);
      throw error;
    }
  }

  async getAdminAiAssistant(id: number): Promise<AdminAiAssistant | undefined> {
    try {
      const [assistantEntry] = await db.select().from(adminAiAssistant).where(eq(adminAiAssistant.id, id));
      return assistantEntry;
    } catch (error) {
      console.error("Error getting admin AI assistant entry:", error);
      return undefined;
    }
  }

  async updateAdminAiAssistant(id: number, data: Partial<AdminAiAssistant>): Promise<AdminAiAssistant | undefined> {
    try {
      const updatedData = {
        ...data,
        updatedAt: new Date()
      };
      
      const [updatedEntry] = await db.update(adminAiAssistant)
        .set(updatedData)
        .where(eq(adminAiAssistant.id, id))
        .returning();
      
      return updatedEntry;
    } catch (error) {
      console.error("Error updating admin AI assistant entry:", error);
      return undefined;
    }
  }

  async deleteAdminAiAssistant(id: number): Promise<boolean> {
    try {
      await db.delete(adminAiAssistant).where(eq(adminAiAssistant.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting admin AI assistant entry:", error);
      return false;
    }
  }

  async getAdminAiAssistantHistory(adminId: number, limit: number = 20): Promise<AdminAiAssistant[]> {
    try {
      const history = await db.select()
        .from(adminAiAssistant)
        .where(eq(adminAiAssistant.adminId, adminId))
        .orderBy(desc(adminAiAssistant.createdAt))
        .limit(limit);
      
      return history;
    } catch (error) {
      console.error("Error getting admin AI assistant history:", error);
      return [];
    }
  }

  async markAdminAiAssistantComplete(id: number): Promise<AdminAiAssistant | undefined> {
    try {
      const [updatedEntry] = await db.update(adminAiAssistant)
        .set({ 
          isComplete: true  // Changed from isCompleted to isComplete to match schema
        })
        .where(eq(adminAiAssistant.id, id))
        .returning();
      
      return updatedEntry;
    } catch (error) {
      console.error("Error marking admin AI assistant complete:", error);
      return undefined;
    }
  }

  async countAdminAiAssistantRequests(adminId: number, timeWindow: number): Promise<number> {
    try {
      // timeWindow is in minutes
      const cutoffTime = new Date(Date.now() - timeWindow * 60 * 1000);
      
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(adminAiAssistant)
        .where(
          and(
            eq(adminAiAssistant.adminId, adminId), // Changed from userId to adminId
            gte(adminAiAssistant.createdAt, cutoffTime)
          )
        );
      
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error counting admin AI assistant requests:", error);
      return 0;
    }
  }

  // Live Results Viewers - for projector display of battle results
  async createLiveResultsViewer(data: InsertLiveResultsViewer): Promise<LiveResultsViewer> {
    try {
      const [viewer] = await db.insert(liveResultsViewers).values(data).returning();
      return viewer;
    } catch (error) {
      console.error("Error creating live results viewer:", error);
      throw error;
    }
  }

  async getLiveResultsViewersByEvent(eventId: number): Promise<LiveResultsViewer[]> {
    try {
      return await db.select()
        .from(liveResultsViewers)
        .where(and(
          eq(liveResultsViewers.eventId, eventId),
          eq(liveResultsViewers.isActive, true)
        ))
        .orderBy(desc(liveResultsViewers.createdAt));
    } catch (error) {
      console.error("Error getting live results viewers:", error);
      return [];
    }
  }

  async getLiveResultsViewerByUserAndEvent(userId: number, eventId: number): Promise<LiveResultsViewer | undefined> {
    try {
      const [viewer] = await db.select()
        .from(liveResultsViewers)
        .where(and(
          eq(liveResultsViewers.userId, userId),
          eq(liveResultsViewers.eventId, eventId),
          eq(liveResultsViewers.isActive, true)
        ))
        .limit(1);
      return viewer;
    } catch (error) {
      console.error("Error getting live results viewer:", error);
      return undefined;
    }
  }

  async revokeLiveResultsViewer(id: number): Promise<boolean> {
    try {
      await db.update(liveResultsViewers)
        .set({ isActive: false })
        .where(eq(liveResultsViewers.id, id));
      return true;
    } catch (error) {
      console.error("Error revoking live results viewer:", error);
      return false;
    }
  }

  async isUserLiveResultsViewer(userId: number, eventId: number): Promise<boolean> {
    try {
      const viewer = await this.getLiveResultsViewerByUserAndEvent(userId, eventId);
      return !!viewer;
    } catch (error) {
      console.error("Error checking if user is live results viewer:", error);
      return false;
    }
  }

  // ==================== User Settings ====================
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    try {
      const [settings] = await db.select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);
      return settings;
    } catch (error) {
      console.error("Error getting user settings:", error);
      return undefined;
    }
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    try {
      const [created] = await db.insert(userSettings).values(settings).returning();
      return created;
    } catch (error) {
      console.error("Error creating user settings:", error);
      throw error;
    }
  }

  async updateUserSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings | undefined> {
    try {
      const [updated] = await db.update(userSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating user settings:", error);
      return undefined;
    }
  }

  // ==================== Notification Preferences ====================
  async getNotificationPreferences(userId: number): Promise<NotificationPreferences | undefined> {
    try {
      const [prefs] = await db.select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);
      return prefs;
    } catch (error) {
      console.error("Error getting notification preferences:", error);
      return undefined;
    }
  }

  async createNotificationPreferences(prefs: InsertNotificationPreferences): Promise<NotificationPreferences> {
    try {
      const [created] = await db.insert(notificationPreferences).values(prefs).returning();
      return created;
    } catch (error) {
      console.error("Error creating notification preferences:", error);
      throw error;
    }
  }

  async updateNotificationPreferences(userId: number, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences | undefined> {
    try {
      const [updated] = await db.update(notificationPreferences)
        .set({ ...prefs, updatedAt: new Date() })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      return undefined;
    }
  }

  // ==================== Login Sessions ====================
  async createLoginSession(session: InsertLoginSession): Promise<LoginSession> {
    try {
      const [created] = await db.insert(loginSessions).values(session).returning();
      return created;
    } catch (error) {
      console.error("Error creating login session:", error);
      throw error;
    }
  }

  async getLoginSession(id: number): Promise<LoginSession | undefined> {
    try {
      const [session] = await db.select()
        .from(loginSessions)
        .where(eq(loginSessions.id, id))
        .limit(1);
      return session;
    } catch (error) {
      console.error("Error getting login session:", error);
      return undefined;
    }
  }

  async getLoginSessionByToken(token: string): Promise<LoginSession | undefined> {
    try {
      const [session] = await db.select()
        .from(loginSessions)
        .where(eq(loginSessions.sessionToken, token))
        .limit(1);
      return session;
    } catch (error) {
      console.error("Error getting login session by token:", error);
      return undefined;
    }
  }

  async getLoginSessionsByUser(userId: number): Promise<LoginSession[]> {
    try {
      return await db.select()
        .from(loginSessions)
        .where(eq(loginSessions.userId, userId))
        .orderBy(desc(loginSessions.lastActive));
    } catch (error) {
      console.error("Error getting login sessions by user:", error);
      return [];
    }
  }

  async getActiveLoginSessionsByUser(userId: number): Promise<LoginSession[]> {
    try {
      return await db.select()
        .from(loginSessions)
        .where(and(
          eq(loginSessions.userId, userId),
          eq(loginSessions.isActive, true)
        ))
        .orderBy(desc(loginSessions.lastActive));
    } catch (error) {
      console.error("Error getting active login sessions:", error);
      return [];
    }
  }

  async updateLoginSessionActivity(id: number): Promise<LoginSession | undefined> {
    try {
      const [updated] = await db.update(loginSessions)
        .set({ lastActive: new Date() })
        .where(eq(loginSessions.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating login session activity:", error);
      return undefined;
    }
  }

  async revokeLoginSession(id: number): Promise<LoginSession | undefined> {
    try {
      const [revoked] = await db.update(loginSessions)
        .set({ isActive: false, revokedAt: new Date() })
        .where(eq(loginSessions.id, id))
        .returning();
      return revoked;
    } catch (error) {
      console.error("Error revoking login session:", error);
      return undefined;
    }
  }

  async revokeAllUserSessions(userId: number, exceptSessionId?: number): Promise<number> {
    try {
      const condition = exceptSessionId
        ? and(eq(loginSessions.userId, userId), notEq(loginSessions.id, exceptSessionId))
        : eq(loginSessions.userId, userId);
      
      const result = await db.update(loginSessions)
        .set({ isActive: false, revokedAt: new Date() })
        .where(condition);
      
      return result.rowCount || 0;
    } catch (error) {
      console.error("Error revoking all user sessions:", error);
      return 0;
    }
  }

  // ==================== Marketing Campaigns ====================
  async createMarketingCampaign(campaign: InsertMarketingCampaign): Promise<MarketingCampaign> {
    try {
      const [created] = await db.insert(marketingCampaigns).values(campaign).returning();
      return created;
    } catch (error) {
      console.error("Error creating marketing campaign:", error);
      throw error;
    }
  }

  async getMarketingCampaign(id: number): Promise<MarketingCampaign | undefined> {
    try {
      const [campaign] = await db.select()
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.id, id))
        .limit(1);
      return campaign;
    } catch (error) {
      console.error("Error getting marketing campaign:", error);
      return undefined;
    }
  }

  async updateMarketingCampaign(id: number, campaign: Partial<MarketingCampaign>): Promise<MarketingCampaign | undefined> {
    try {
      const [updated] = await db.update(marketingCampaigns)
        .set({ ...campaign, updatedAt: new Date() })
        .where(eq(marketingCampaigns.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating marketing campaign:", error);
      return undefined;
    }
  }

  async getAllMarketingCampaigns(): Promise<MarketingCampaign[]> {
    try {
      return await db.select()
        .from(marketingCampaigns)
        .orderBy(desc(marketingCampaigns.createdAt));
    } catch (error) {
      console.error("Error getting all marketing campaigns:", error);
      return [];
    }
  }

  async getMarketingCampaignsByStatus(status: string): Promise<MarketingCampaign[]> {
    try {
      return await db.select()
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.status, status))
        .orderBy(desc(marketingCampaigns.createdAt));
    } catch (error) {
      console.error("Error getting marketing campaigns by status:", error);
      return [];
    }
  }

  async deleteMarketingCampaign(id: number): Promise<boolean> {
    try {
      await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, id));
      await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting marketing campaign:", error);
      return false;
    }
  }

  // ==================== Campaign Recipients ====================
  async createCampaignRecipient(recipient: InsertCampaignRecipient): Promise<CampaignRecipient> {
    try {
      const [created] = await db.insert(campaignRecipients).values(recipient).returning();
      return created;
    } catch (error) {
      console.error("Error creating campaign recipient:", error);
      throw error;
    }
  }

  async getCampaignRecipients(campaignId: number): Promise<CampaignRecipient[]> {
    try {
      return await db.select()
        .from(campaignRecipients)
        .where(eq(campaignRecipients.campaignId, campaignId))
        .orderBy(desc(campaignRecipients.createdAt));
    } catch (error) {
      console.error("Error getting campaign recipients:", error);
      return [];
    }
  }

  async updateCampaignRecipientStatus(id: number, status: string, errorMessage?: string): Promise<CampaignRecipient | undefined> {
    try {
      const updateData: any = { status };
      if (status === 'sent') updateData.sentAt = new Date();
      if (status === 'delivered') updateData.deliveredAt = new Date();
      if (status === 'opened') updateData.openedAt = new Date();
      if (status === 'clicked') updateData.clickedAt = new Date();
      if (errorMessage) updateData.errorMessage = errorMessage;
      
      // Use conditional update to ensure idempotency
      // Only update if the corresponding timestamp is null (not already set)
      let whereCondition;
      if (status === 'opened') {
        whereCondition = and(
          eq(campaignRecipients.id, id),
          isNull(campaignRecipients.openedAt)
        );
      } else if (status === 'clicked') {
        whereCondition = and(
          eq(campaignRecipients.id, id),
          isNull(campaignRecipients.clickedAt)
        );
      } else {
        whereCondition = eq(campaignRecipients.id, id);
      }
      
      const result = await db.update(campaignRecipients)
        .set(updateData)
        .where(whereCondition)
        .returning();
      
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      console.error("Error updating campaign recipient status:", error);
      return undefined;
    }
  }

  async getCampaignRecipientsByStatus(campaignId: number, status: string): Promise<CampaignRecipient[]> {
    try {
      return await db.select()
        .from(campaignRecipients)
        .where(and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.status, status)
        ))
        .orderBy(desc(campaignRecipients.createdAt));
    } catch (error) {
      console.error("Error getting campaign recipients by status:", error);
      return [];
    }
  }

  // ==================== Follow System Enhancements ====================
  async getFollowersCount(userId: number): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(userFollows)
        .where(and(
          eq(userFollows.followedId, userId),
          eq(userFollows.status, 'active')
        ));
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting followers count:", error);
      return 0;
    }
  }

  async getFollowingCount(userId: number): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(userFollows)
        .where(and(
          eq(userFollows.followerId, userId),
          eq(userFollows.status, 'active')
        ));
      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error getting following count:", error);
      return 0;
    }
  }

  async getFollowersWithDetails(userId: number): Promise<any[]> {
    try {
      const followers = await db.select({
        follow: userFollows,
        user: users
      })
        .from(userFollows)
        .innerJoin(users, eq(userFollows.followerId, users.id))
        .where(and(
          eq(userFollows.followedId, userId),
          eq(userFollows.status, 'active')
        ))
        .orderBy(desc(userFollows.createdAt));
      
      return followers.map(f => ({
        ...f.follow,
        follower: f.user
      }));
    } catch (error) {
      console.error("Error getting followers with details:", error);
      return [];
    }
  }

  async getFollowingWithDetails(userId: number): Promise<any[]> {
    try {
      const following = await db.select({
        follow: userFollows,
        user: users
      })
        .from(userFollows)
        .innerJoin(users, eq(userFollows.followedId, users.id))
        .where(and(
          eq(userFollows.followerId, userId),
          eq(userFollows.status, 'active')
        ))
        .orderBy(desc(userFollows.createdAt));
      
      return following.map(f => ({
        ...f.follow,
        following: f.user
      }));
    } catch (error) {
      console.error("Error getting following with details:", error);
      return [];
    }
  }

  async getPendingFollowRequests(userId: number): Promise<any[]> {
    try {
      const requests = await db.select({
        follow: userFollows,
        user: users
      })
        .from(userFollows)
        .innerJoin(users, eq(userFollows.followerId, users.id))
        .where(and(
          eq(userFollows.followedId, userId),
          eq(userFollows.status, 'pending')
        ))
        .orderBy(desc(userFollows.createdAt));
      
      return requests.map(r => ({
        ...r.follow,
        requester: r.user
      }));
    } catch (error) {
      console.error("Error getting pending follow requests:", error);
      return [];
    }
  }

  async acceptFollowRequest(followId: number): Promise<UserFollow | undefined> {
    try {
      const [updated] = await db.update(userFollows)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(userFollows.id, followId))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error accepting follow request:", error);
      return undefined;
    }
  }

  async rejectFollowRequest(followId: number): Promise<boolean> {
    try {
      await db.delete(userFollows).where(eq(userFollows.id, followId));
      return true;
    } catch (error) {
      console.error("Error rejecting follow request:", error);
      return false;
    }
  }

  // ==================== Analytics & Tracking ====================
  
  // Tracking Consent
  async createTrackingConsent(consent: InsertTrackingConsent): Promise<TrackingConsent> {
    try {
      const [created] = await db.insert(trackingConsent).values(consent).returning();
      return created;
    } catch (error) {
      console.error("Error creating tracking consent:", error);
      throw error;
    }
  }

  async getTrackingConsentByVisitorId(visitorId: string): Promise<TrackingConsent | undefined> {
    try {
      const [consent] = await db.select()
        .from(trackingConsent)
        .where(eq(trackingConsent.visitorId, visitorId));
      return consent;
    } catch (error) {
      console.error("Error getting tracking consent:", error);
      return undefined;
    }
  }

  async updateTrackingConsent(visitorId: string, data: Partial<TrackingConsent>): Promise<TrackingConsent | undefined> {
    try {
      const [updated] = await db.update(trackingConsent)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(trackingConsent.visitorId, visitorId))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating tracking consent:", error);
      return undefined;
    }
  }

  // Web Sessions
  async createWebSession(session: InsertWebSession): Promise<WebSession> {
    try {
      const [created] = await db.insert(webSessions).values(session).returning();
      return created;
    } catch (error) {
      console.error("Error creating web session:", error);
      throw error;
    }
  }

  async getWebSession(sessionId: string): Promise<WebSession | undefined> {
    try {
      const [session] = await db.select()
        .from(webSessions)
        .where(eq(webSessions.sessionId, sessionId));
      return session;
    } catch (error) {
      console.error("Error getting web session:", error);
      return undefined;
    }
  }

  async updateWebSession(sessionId: string, data: Partial<WebSession>): Promise<WebSession | undefined> {
    try {
      const [updated] = await db.update(webSessions)
        .set(data)
        .where(eq(webSessions.sessionId, sessionId))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating web session:", error);
      return undefined;
    }
  }

  // Page Views
  async createPageView(pageView: InsertPageView): Promise<PageView> {
    try {
      const [created] = await db.insert(pageViews).values(pageView).returning();
      
      // Update session page count
      await db.update(webSessions)
        .set({ pageCount: sql`page_count + 1` })
        .where(eq(webSessions.sessionId, pageView.sessionId));
      
      return created;
    } catch (error) {
      console.error("Error creating page view:", error);
      throw error;
    }
  }

  // Interaction Events
  async createInteractionEvent(event: InsertInteractionEvent): Promise<InteractionEvent> {
    try {
      const [created] = await db.insert(interactionEvents).values(event).returning();
      
      // Update session event count
      await db.update(webSessions)
        .set({ eventCount: sql`event_count + 1` })
        .where(eq(webSessions.sessionId, event.sessionId));
      
      return created;
    } catch (error) {
      console.error("Error creating interaction event:", error);
      throw error;
    }
  }

  // Conversion Events
  async createConversionEvent(event: InsertConversionEvent): Promise<ConversionEvent> {
    try {
      const [created] = await db.insert(conversionEvents).values(event).returning();
      return created;
    } catch (error) {
      console.error("Error creating conversion event:", error);
      throw error;
    }
  }

  // Analytics Queries
  async getAnalyticsOverview(startDate: Date, endDate: Date): Promise<{
    uniqueVisitors: number;
    totalSessions: number;
    totalPageViews: number;
    avgSessionDuration: number;
    totalConversions: number;
  }> {
    try {
      // Get unique visitors
      const visitorsResult = await db.select({
        count: sql<number>`COUNT(DISTINCT visitor_id)`
      })
        .from(webSessions)
        .where(and(
          gte(webSessions.startedAt, startDate),
          lte(webSessions.startedAt, endDate)
        ));

      // Get session stats
      const sessionsResult = await db.select({
        count: sql<number>`COUNT(*)`,
        avgDuration: sql<number>`COALESCE(AVG(duration), 0)`
      })
        .from(webSessions)
        .where(and(
          gte(webSessions.startedAt, startDate),
          lte(webSessions.startedAt, endDate)
        ));

      // Get page views
      const pageViewsResult = await db.select({
        count: sql<number>`COUNT(*)`
      })
        .from(pageViews)
        .where(and(
          gte(pageViews.viewedAt, startDate),
          lte(pageViews.viewedAt, endDate)
        ));

      // Get conversions
      const conversionsResult = await db.select({
        count: sql<number>`COUNT(*)`
      })
        .from(conversionEvents)
        .where(and(
          gte(conversionEvents.createdAt, startDate),
          lte(conversionEvents.createdAt, endDate)
        ));

      return {
        uniqueVisitors: visitorsResult[0]?.count || 0,
        totalSessions: sessionsResult[0]?.count || 0,
        totalPageViews: pageViewsResult[0]?.count || 0,
        avgSessionDuration: Math.round(sessionsResult[0]?.avgDuration || 0),
        totalConversions: conversionsResult[0]?.count || 0
      };
    } catch (error) {
      console.error("Error getting analytics overview:", error);
      return {
        uniqueVisitors: 0,
        totalSessions: 0,
        totalPageViews: 0,
        avgSessionDuration: 0,
        totalConversions: 0
      };
    }
  }

  async getTopPages(startDate: Date, endDate: Date, limit: number = 10): Promise<{ path: string; views: number }[]> {
    try {
      const result = await db.select({
        path: pageViews.path,
        views: sql<number>`COUNT(*)`
      })
        .from(pageViews)
        .where(and(
          gte(pageViews.viewedAt, startDate),
          lte(pageViews.viewedAt, endDate)
        ))
        .groupBy(pageViews.path)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(limit);
      
      return result;
    } catch (error) {
      console.error("Error getting top pages:", error);
      return [];
    }
  }

  async getTrafficSources(startDate: Date, endDate: Date): Promise<{ source: string; sessions: number }[]> {
    try {
      const result = await db.select({
        source: sql<string>`COALESCE(utm_source, 'direct')`,
        sessions: sql<number>`COUNT(*)`
      })
        .from(webSessions)
        .where(and(
          gte(webSessions.startedAt, startDate),
          lte(webSessions.startedAt, endDate)
        ))
        .groupBy(sql`COALESCE(utm_source, 'direct')`)
        .orderBy(desc(sql`COUNT(*)`));
      
      return result;
    } catch (error) {
      console.error("Error getting traffic sources:", error);
      return [];
    }
  }

  async getDeviceBreakdown(startDate: Date, endDate: Date): Promise<{ device: string; sessions: number }[]> {
    try {
      const result = await db.select({
        device: sql<string>`COALESCE(device_type, 'unknown')`,
        sessions: sql<number>`COUNT(*)`
      })
        .from(webSessions)
        .where(and(
          gte(webSessions.startedAt, startDate),
          lte(webSessions.startedAt, endDate)
        ))
        .groupBy(sql`COALESCE(device_type, 'unknown')`)
        .orderBy(desc(sql`COUNT(*)`));
      
      return result;
    } catch (error) {
      console.error("Error getting device breakdown:", error);
      return [];
    }
  }

  async getRecentSessions(limit: number = 20): Promise<WebSession[]> {
    try {
      return await db.select()
        .from(webSessions)
        .orderBy(desc(webSessions.startedAt))
        .limit(limit);
    } catch (error) {
      console.error("Error getting recent sessions:", error);
      return [];
    }
  }

  async getDailyTraffic(startDate: Date, endDate: Date): Promise<{ date: string; sessions: number; pageViews: number }[]> {
    try {
      const result = await db.select({
        date: sql<string>`DATE(started_at)::text`,
        sessions: sql<number>`COUNT(*)`
      })
        .from(webSessions)
        .where(and(
          gte(webSessions.startedAt, startDate),
          lte(webSessions.startedAt, endDate)
        ))
        .groupBy(sql`DATE(started_at)`)
        .orderBy(sql`DATE(started_at)`);
      
      // Get page views for same period
      const pageViewsResult = await db.select({
        date: sql<string>`DATE(viewed_at)::text`,
        pageViews: sql<number>`COUNT(*)`
      })
        .from(pageViews)
        .where(and(
          gte(pageViews.viewedAt, startDate),
          lte(pageViews.viewedAt, endDate)
        ))
        .groupBy(sql`DATE(viewed_at)`)
        .orderBy(sql`DATE(viewed_at)`);
      
      // Merge results
      const pageViewMap = new Map(pageViewsResult.map(p => [p.date, p.pageViews]));
      
      return result.map(r => ({
        date: r.date,
        sessions: r.sessions,
        pageViews: pageViewMap.get(r.date) || 0
      }));
    } catch (error) {
      console.error("Error getting daily traffic:", error);
      return [];
    }
  }

  async getConversionsByType(startDate: Date, endDate: Date): Promise<{ type: string; count: number; value: number }[]> {
    try {
      const result = await db.select({
        type: conversionEvents.conversionType,
        count: sql<number>`COUNT(*)`,
        value: sql<number>`COALESCE(SUM(conversion_value), 0)`
      })
        .from(conversionEvents)
        .where(and(
          gte(conversionEvents.createdAt, startDate),
          lte(conversionEvents.createdAt, endDate)
        ))
        .groupBy(conversionEvents.conversionType)
        .orderBy(desc(sql`COUNT(*)`));
      
      return result;
    } catch (error) {
      console.error("Error getting conversions by type:", error);
      return [];
    }
  }

  async getCampaignAttributions(startDate: Date, endDate: Date): Promise<{ campaignId: number; name: string; sessions: number; conversions: number }[]> {
    try {
      const sessionResults = await db.select({
        campaignId: webSessions.campaignId,
        sessions: sql<number>`COUNT(*)`
      })
        .from(webSessions)
        .where(and(
          gte(webSessions.startedAt, startDate),
          lte(webSessions.startedAt, endDate),
          not(isNull(webSessions.campaignId))
        ))
        .groupBy(webSessions.campaignId);

      const conversionResults = await db.select({
        campaignId: conversionEvents.campaignId,
        conversions: sql<number>`COUNT(*)`
      })
        .from(conversionEvents)
        .where(and(
          gte(conversionEvents.createdAt, startDate),
          lte(conversionEvents.createdAt, endDate),
          not(isNull(conversionEvents.campaignId))
        ))
        .groupBy(conversionEvents.campaignId);

      // Get campaign names
      const campaignIds = [...new Set([
        ...sessionResults.map(s => s.campaignId).filter(Boolean),
        ...conversionResults.map(c => c.campaignId).filter(Boolean)
      ])] as number[];

      if (campaignIds.length === 0) return [];

      const campaigns = await db.select({
        id: marketingCampaigns.id,
        name: marketingCampaigns.name
      })
        .from(marketingCampaigns)
        .where(inArray(marketingCampaigns.id, campaignIds));

      const campaignMap = new Map(campaigns.map(c => [c.id, c.name]));
      const conversionMap = new Map(conversionResults.map(c => [c.campaignId, c.conversions]));

      return sessionResults.map(s => ({
        campaignId: s.campaignId as number,
        name: campaignMap.get(s.campaignId as number) || 'Unknown Campaign',
        sessions: s.sessions,
        conversions: conversionMap.get(s.campaignId) || 0
      }));
    } catch (error) {
      console.error("Error getting campaign attributions:", error);
      return [];
    }
  }

  // ==========================================
  // PROXIMITY & MATCHING IMPLEMENTATIONS
  // ==========================================

  async getProximitySettings(userId: number): Promise<ProximitySettings | undefined> {
    const [settings] = await db.select().from(proximitySettings).where(eq(proximitySettings.userId, userId));
    return settings;
  }

  async upsertProximitySettings(userId: number, settings: Partial<InsertProximitySettings>): Promise<ProximitySettings> {
    const existing = await this.getProximitySettings(userId);
    if (existing) {
      const [updated] = await db
        .update(proximitySettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(proximitySettings.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(proximitySettings)
        .values({ userId, ...settings })
        .returning();
      return created;
    }
  }

  async updateUserPresence(userId: number, lat: number, lng: number, city?: string): Promise<UserPresence> {
    const coarseLat = lat.toFixed(2);
    const coarseLng = lng.toFixed(2);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const now = new Date();
    const [result] = await db
      .insert(userPresence)
      .values({ userId, coarseLat, coarseLng, city, expiresAt })
      .onConflictDoUpdate({
        target: userPresence.userId,
        set: { coarseLat, coarseLng, city, expiresAt, updatedAt: now },
      })
      .returning();
    return result;
  }

  async deleteUserPresence(userId: number): Promise<void> {
    await db.delete(userPresence).where(eq(userPresence.userId, userId));
  }

  async getNearbyUsers(userId: number, coarseLat: string, coarseLng: string, radiusKm: number, visibilityMode?: string): Promise<any[]> {
    const now = new Date();
    const latVal = parseFloat(coarseLat);
    const lngVal = parseFloat(coarseLng);
    const delta = radiusKm * 0.009;
    const latMin = (latVal - delta).toFixed(2);
    const latMax = (latVal + delta).toFixed(2);
    const lngMin = (lngVal - delta).toFixed(2);
    const lngMax = (lngVal + delta).toFixed(2);

    const results = await db
      .select({
        userId: userPresence.userId,
        city: userPresence.city,
        coarseLat: userPresence.coarseLat,
        coarseLng: userPresence.coarseLng,
        displayName: users.displayName,
        role: users.role,
        artType: users.artType,
        profilePicture: users.profilePicture,
        isVerified: users.isVerified,
        bio: users.bio,
        visibilityMode: proximitySettings.visibilityMode,
      })
      .from(userPresence)
      .innerJoin(users, eq(userPresence.userId, users.id))
      .leftJoin(proximitySettings, eq(userPresence.userId, proximitySettings.userId))
      .where(
        and(
          gt(userPresence.expiresAt, now),
          sql`CAST(${userPresence.coarseLat} AS FLOAT) BETWEEN ${latMin} AND ${latMax}`,
          sql`CAST(${userPresence.coarseLng} AS FLOAT) BETWEEN ${lngMin} AND ${lngMax}`,
          eq(proximitySettings.discoveryEnabled, true),
          notEq(userPresence.userId, userId)
        )
      );

    let filtered = results.filter(u => u.visibilityMode !== 'ghost');

    if (visibilityMode === 'friends_only') {
      const following = await db
        .select({ followedId: userFollows.followedId })
        .from(userFollows)
        .where(and(eq(userFollows.followerId, userId), eq(userFollows.status, 'active')));
      const followingIds = new Set(following.map(f => f.followedId));
      filtered = filtered.filter(u => followingIds.has(u.userId));
    } else if (visibilityMode === 'events_only') {
      const myRsvps = await db
        .select({ eventId: rsvps.eventId })
        .from(rsvps)
        .where(eq(rsvps.userId, userId));
      const myEventIds = myRsvps.map(r => r.eventId);
      if (myEventIds.length > 0) {
        const coAttendees = await db
          .select({ userId: rsvps.userId })
          .from(rsvps)
          .where(and(
            inArray(rsvps.eventId, myEventIds),
            notEq(rsvps.userId, userId)
          ));
        const coAttendeeIds = new Set(coAttendees.map(a => a.userId));
        filtered = filtered.filter(u => coAttendeeIds.has(u.userId));
      } else {
        filtered = [];
      }
    }

    const blockedByMe = await db
      .select({ blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(eq(userBlocks.blockerId, userId));
    const blockedMe = await db
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(eq(userBlocks.blockedId, userId));
    const blockedIds = new Set([
      ...blockedByMe.map(b => b.blockedId),
      ...blockedMe.map(b => b.blockerId)
    ]);
    filtered = filtered.filter(u => !blockedIds.has(u.userId));

    return filtered;
  }

  async recordDiscoveryAction(userId: number, discoveredUserId: number, action: string): Promise<any> {
    const [record] = await db
      .insert(userDiscoveries)
      .values({ userId, discoveredUserId, action })
      .returning();
    return record;
  }

  async getDiscoverySuggestions(userId: number, coarseLat: string, coarseLng: string, radiusKm: number, limit: number = 10): Promise<any[]> {
    const now = new Date();
    const latVal = parseFloat(coarseLat);
    const lngVal = parseFloat(coarseLng);
    const delta = radiusKm * 0.009;
    const latMin = (latVal - delta).toFixed(2);
    const latMax = (latVal + delta).toFixed(2);
    const lngMin = (lngVal - delta).toFixed(2);
    const lngMax = (lngVal + delta).toFixed(2);

    const alreadySeen = db
      .select({ discoveredUserId: userDiscoveries.discoveredUserId })
      .from(userDiscoveries)
      .where(eq(userDiscoveries.userId, userId));

    const blockedByMe = db
      .select({ blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(eq(userBlocks.blockerId, userId));

    const blockedMe = db
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(eq(userBlocks.blockedId, userId));

    const results = await db
      .select({
        userId: userPresence.userId,
        coarseLat: userPresence.coarseLat,
        coarseLng: userPresence.coarseLng,
        city: userPresence.city,
        displayName: users.displayName,
        role: users.role,
        artType: users.artType,
        bio: users.bio,
        profilePicture: users.profilePicture,
        isVerified: users.isVerified,
        visibilityMode: proximitySettings.visibilityMode,
      })
      .from(userPresence)
      .innerJoin(users, eq(userPresence.userId, users.id))
      .leftJoin(proximitySettings, eq(userPresence.userId, proximitySettings.userId))
      .where(
        and(
          gt(userPresence.expiresAt, now),
          sql`CAST(${userPresence.coarseLat} AS FLOAT) BETWEEN ${latMin} AND ${latMax}`,
          sql`CAST(${userPresence.coarseLng} AS FLOAT) BETWEEN ${lngMin} AND ${lngMax}`,
          eq(proximitySettings.discoveryEnabled, true),
          notEq(userPresence.userId, userId),
          sql`${userPresence.userId} NOT IN (${alreadySeen})`,
          sql`${userPresence.userId} NOT IN (${blockedByMe})`,
          sql`${userPresence.userId} NOT IN (${blockedMe})`
        )
      )
      .limit(limit);

    return results.filter(u => u.visibilityMode !== 'ghost');
  }

  async getTrustedContacts(userId: number): Promise<any[]> {
    const contacts = await db
      .select({
        id: trustedContacts.id,
        contactUserId: trustedContacts.contactUserId,
        status: trustedContacts.status,
        createdAt: trustedContacts.createdAt,
        displayName: users.displayName,
        profilePicture: users.profilePicture,
        role: users.role,
      })
      .from(trustedContacts)
      .innerJoin(users, eq(trustedContacts.contactUserId, users.id))
      .where(eq(trustedContacts.userId, userId));
    return contacts;
  }

  async addTrustedContact(userId: number, contactUserId: number): Promise<TrustedContact> {
    const [contact] = await db
      .insert(trustedContacts)
      .values({ userId, contactUserId, status: 'pending' })
      .returning();
    return contact;
  }

  async confirmTrustedContact(contactId: number, contactUserId: number): Promise<TrustedContact | undefined> {
    const [updated] = await db
      .update(trustedContacts)
      .set({ status: 'confirmed' })
      .where(and(eq(trustedContacts.id, contactId), eq(trustedContacts.contactUserId, contactUserId)))
      .returning();
    return updated;
  }

  async removeTrustedContact(contactId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(trustedContacts)
      .where(and(eq(trustedContacts.id, contactId), eq(trustedContacts.userId, userId)));
    return true;
  }

  async createSafetyBroadcast(broadcast: InsertSafetyBroadcast): Promise<SafetyBroadcast> {
    const [created] = await db.insert(safetyBroadcasts).values(broadcast).returning();
    return created;
  }

  async getActiveSafetyBroadcasts(userId: number): Promise<SafetyBroadcast[]> {
    const now = new Date();
    return await db
      .select()
      .from(safetyBroadcasts)
      .where(and(eq(safetyBroadcasts.userId, userId), eq(safetyBroadcasts.isActive, true), gt(safetyBroadcasts.expiresAt, now)));
  }

  async deactivateSafetyBroadcast(broadcastId: number, userId: number): Promise<boolean> {
    await db
      .update(safetyBroadcasts)
      .set({ isActive: false })
      .where(and(eq(safetyBroadcasts.id, broadcastId), eq(safetyBroadcasts.userId, userId)));
    return true;
  }

  // ── Funding, Subsidy & Sponsorship Intelligence ──────────────────────────

  async getFundingSources(): Promise<FundingSource[]> {
    return await db.select().from(fundingSources).orderBy(desc(fundingSources.createdAt));
  }

  async getFundingSource(id: number): Promise<FundingSource | undefined> {
    const [row] = await db.select().from(fundingSources).where(eq(fundingSources.id, id));
    return row;
  }

  async createFundingSource(source: InsertFundingSource): Promise<FundingSource> {
    const [row] = await db.insert(fundingSources).values(source).returning();
    return row;
  }

  async updateFundingSource(id: number, data: Partial<FundingSource>): Promise<FundingSource | undefined> {
    const [row] = await db.update(fundingSources).set(data).where(eq(fundingSources.id, id)).returning();
    return row;
  }

  async deleteFundingSource(id: number): Promise<boolean> {
    await db.delete(fundingSources).where(eq(fundingSources.id, id));
    return true;
  }

  async getFundingOpportunities(filters?: { status?: string; category?: string; fundingType?: string; region?: string; search?: string; limit?: number; offset?: number }): Promise<FundingOpportunity[]> {
    let query = db.select().from(fundingOpportunities).$dynamic();
    const conditions = [];
    if (filters?.status && filters.status !== 'all') conditions.push(eq(fundingOpportunities.status, filters.status));
    if (filters?.fundingType && filters.fundingType !== 'all') conditions.push(eq(fundingOpportunities.fundingType, filters.fundingType));
    if (filters?.search) conditions.push(ilike(fundingOpportunities.title, `%${filters.search}%`));
    if (filters?.category && filters.category !== 'all') conditions.push(sql`${filters.category} = ANY(${fundingOpportunities.categories})`);
    if (conditions.length) query = query.where(and(...conditions));
    query = query.orderBy(desc(fundingOpportunities.createdAt)).limit(filters?.limit ?? 200).offset(filters?.offset ?? 0);
    return await query;
  }

  async getFundingOpportunity(id: number): Promise<FundingOpportunity | undefined> {
    const [row] = await db.select().from(fundingOpportunities).where(eq(fundingOpportunities.id, id));
    return row;
  }

  async createFundingOpportunity(opp: InsertFundingOpportunity): Promise<FundingOpportunity> {
    const [row] = await db.insert(fundingOpportunities).values({ ...opp, updatedAt: new Date() }).returning();
    return row;
  }

  async updateFundingOpportunity(id: number, data: Partial<FundingOpportunity>): Promise<FundingOpportunity | undefined> {
    const [row] = await db.update(fundingOpportunities).set({ ...data, updatedAt: new Date() }).where(eq(fundingOpportunities.id, id)).returning();
    return row;
  }

  async deleteFundingOpportunity(id: number): Promise<boolean> {
    await db.delete(fundingOpportunities).where(eq(fundingOpportunities.id, id));
    return true;
  }

  async getFundingStats(): Promise<{ total: number; published: number; draft: number; expired: number; needsReview: number; duplicates: number }> {
    const now = new Date();
    const all = await db.select().from(fundingOpportunities);
    return {
      total: all.length,
      published: all.filter(o => o.status === 'published').length,
      draft: all.filter(o => o.status === 'draft').length,
      expired: all.filter(o => o.deadline && new Date(o.deadline) < now).length,
      needsReview: all.filter(o => o.reviewStatus === 'pending').length,
      duplicates: all.filter(o => o.isDuplicate).length,
    };
  }

  async fundingDataExists(): Promise<boolean> {
    const [row] = await db.select({ id: fundingOpportunities.id }).from(fundingOpportunities).limit(1);
    return !!row;
  }

  async getAllPushDevices(): Promise<any[]> {
    const rows = await db
      .select({
        id: pushTokens.id,
        userId: pushTokens.userId,
        token: pushTokens.token,
        platform: pushTokens.platform,
        createdAt: pushTokens.createdAt,
        updatedAt: pushTokens.updatedAt,
        displayName: users.displayName,
        email: users.email,
        profilePicture: users.profilePicture,
      })
      .from(pushTokens)
      .leftJoin(users, eq(pushTokens.userId, users.id))
      .orderBy(desc(pushTokens.updatedAt));
    return rows.map(r => ({
      id: r.id,
      userId: r.userId,
      token: r.token,
      platform: r.platform,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      user: { displayName: r.displayName || 'Unknown', email: r.email || '', profilePicture: r.profilePicture || null },
    }));
  }

  async getPushDeviceStats(): Promise<{ total: number; ios: number; android: number; web: number; recentWeek: number }> {
    const all = await db.select({ platform: pushTokens.platform, updatedAt: pushTokens.updatedAt }).from(pushTokens);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return {
      total: all.length,
      ios: all.filter(r => r.platform === 'ios').length,
      android: all.filter(r => r.platform === 'android').length,
      web: all.filter(r => r.platform === 'web').length,
      recentWeek: all.filter(r => r.updatedAt && new Date(r.updatedAt) > weekAgo).length,
    };
  }

  async removePushTokenById(id: number): Promise<void> {
    await db.delete(pushTokens).where(eq(pushTokens.id, id));
  }

  async logPushNotification(log: { sentBy: number; title: string; body: string; targetType: string; targetValue?: string; sentCount: number; failedCount: number; iconUrl?: string; actionUrl?: string }): Promise<PushNotificationLog> {
    const [row] = await db.insert(pushNotificationLogs).values({
      sentBy: log.sentBy,
      title: log.title,
      body: log.body,
      targetType: log.targetType,
      targetValue: log.targetValue || null,
      sentCount: log.sentCount,
      failedCount: log.failedCount,
      iconUrl: log.iconUrl || null,
      actionUrl: log.actionUrl || null,
    }).returning();
    return row;
  }

  async getPushNotificationLogs(limit: number = 50): Promise<PushNotificationLog[]> {
    return db.select().from(pushNotificationLogs).orderBy(desc(pushNotificationLogs.createdAt)).limit(limit);
  }

  async getAllUserIdsWithTokens(): Promise<number[]> {
    const rows = await db.selectDistinct({ userId: pushTokens.userId }).from(pushTokens);
    return rows.map(r => r.userId);
  }

  async getUserIdsWithTokensBySegment(segment: string): Promise<number[]> {
    if (segment === 'all') return this.getAllUserIdsWithTokens();
    const roleFilter = segment === 'premium' ? 'premium' : segment === 'admin' ? 'admin' : null;
    if (!roleFilter) return this.getAllUserIdsWithTokens();
    const tokenUsers = await db.selectDistinct({ userId: pushTokens.userId }).from(pushTokens);
    const tokenUserIds = tokenUsers.map(r => r.userId);
    if (!tokenUserIds.length) return [];
    const matching = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, tokenUserIds), eq(users.role as any, roleFilter)));
    return matching.map(r => r.id);
  }

  async savePushToken(userId: number, token: string, platform: string = 'web'): Promise<void> {
    await db
      .insert(pushTokens)
      .values({ userId, token, platform, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { userId, platform, updatedAt: new Date() },
      });
  }

  async removePushToken(userId: number, token: string): Promise<void> {
    await db
      .delete(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
  }

  async getPushTokensForUser(userId: number): Promise<string[]> {
    const rows = await db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));
    return rows.map(r => r.token);
  }

  // ===== REELS =====

  async createReel(data: InsertReel): Promise<Reel> {
    const [reel] = await db.insert(reels).values(data).returning();
    return reel;
  }

  async getReel(id: number): Promise<Reel | undefined> {
    const [reel] = await db.select().from(reels).where(eq(reels.id, id));
    return reel;
  }

  async getReelsFeed(page = 1, limit = 10, requestingUserId?: number): Promise<any[]> {
    const offset = (page - 1) * limit;
    const userCols = {
      id: users.id,
      displayName: users.displayName,
      profilePicture: users.profilePicture,
    };
    const rows = await db
      .select({ reel: reels, user: userCols })
      .from(reels)
      .innerJoin(users, eq(reels.userId, users.id))
      .where(eq(reels.status, 'active'))
      .orderBy(desc(reels.createdAt))
      .limit(limit)
      .offset(offset);

    if (!requestingUserId || rows.length === 0) {
      return rows.map(r => ({ ...r.reel, user: r.user, isLiked: false }));
    }

    const reelIds = rows.map(r => r.reel.id);
    const likedRows = await db
      .select({ reelId: reelLikes.reelId })
      .from(reelLikes)
      .where(and(eq(reelLikes.userId, requestingUserId), inArray(reelLikes.reelId, reelIds)));
    const likedSet = new Set(likedRows.map(l => l.reelId));
    return rows.map(r => ({ ...r.reel, user: r.user, isLiked: likedSet.has(r.reel.id) }));
  }

  async getUserReels(userId: number, requestingUserId?: number): Promise<any[]> {
    const userCols = {
      id: users.id,
      displayName: users.displayName,
      profilePicture: users.profilePicture,
    };
    const rows = await db
      .select({ reel: reels, user: userCols })
      .from(reels)
      .innerJoin(users, eq(reels.userId, users.id))
      .where(and(eq(reels.userId, userId), eq(reels.status, 'active')))
      .orderBy(desc(reels.createdAt));

    if (!requestingUserId || rows.length === 0) {
      return rows.map(r => ({ ...r.reel, user: r.user, isLiked: false }));
    }

    const reelIds = rows.map(r => r.reel.id);
    const likedRows = await db
      .select({ reelId: reelLikes.reelId })
      .from(reelLikes)
      .where(and(eq(reelLikes.userId, requestingUserId), inArray(reelLikes.reelId, reelIds)));
    const likedSet = new Set(likedRows.map(l => l.reelId));
    return rows.map(r => ({ ...r.reel, user: r.user, isLiked: likedSet.has(r.reel.id) }));
  }

  async deleteReel(id: number): Promise<boolean> {
    const result = await db.delete(reels).where(eq(reels.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async incrementReelViews(id: number): Promise<void> {
    await db
      .update(reels)
      .set({ viewsCount: sql`${reels.viewsCount} + 1` })
      .where(eq(reels.id, id));
  }

  async incrementReelShares(id: number): Promise<void> {
    await db
      .update(reels)
      .set({ sharesCount: sql`${reels.sharesCount} + 1` })
      .where(eq(reels.id, id));
  }

  async toggleReelLike(reelId: number, userId: number): Promise<{ liked: boolean; likesCount: number }> {
    const existing = await db
      .select()
      .from(reelLikes)
      .where(and(eq(reelLikes.reelId, reelId), eq(reelLikes.userId, userId)));

    if (existing.length > 0) {
      await db.delete(reelLikes).where(and(eq(reelLikes.reelId, reelId), eq(reelLikes.userId, userId)));
      const [updated] = await db
        .update(reels)
        .set({ likesCount: sql`GREATEST(${reels.likesCount} - 1, 0)` })
        .where(eq(reels.id, reelId))
        .returning();
      return { liked: false, likesCount: updated?.likesCount ?? 0 };
    } else {
      await db.insert(reelLikes).values({ reelId, userId });
      const [updated] = await db
        .update(reels)
        .set({ likesCount: sql`${reels.likesCount} + 1` })
        .where(eq(reels.id, reelId))
        .returning();
      return { liked: true, likesCount: updated?.likesCount ?? 0 };
    }
  }

  async getReelComments(reelId: number): Promise<any[]> {
    const userCols = {
      id: users.id,
      displayName: users.displayName,
      profilePicture: users.profilePicture,
    };
    const rows = await db
      .select({ comment: reelComments, user: userCols })
      .from(reelComments)
      .innerJoin(users, eq(reelComments.userId, users.id))
      .where(eq(reelComments.reelId, reelId))
      .orderBy(desc(reelComments.createdAt));
    return rows.map(r => ({ ...r.comment, user: r.user }));
  }

  async createReelComment(data: InsertReelComment): Promise<ReelComment> {
    const [comment] = await db.insert(reelComments).values(data).returning();
    await db
      .update(reels)
      .set({ commentsCount: sql`${reels.commentsCount} + 1` })
      .where(eq(reels.id, data.reelId));
    return comment;
  }

  async deleteReelComment(id: number, userId: number): Promise<boolean> {
    const [comment] = await db.select().from(reelComments).where(eq(reelComments.id, id));
    if (!comment || comment.userId !== userId) return false;
    await db.delete(reelComments).where(eq(reelComments.id, id));
    await db
      .update(reels)
      .set({ commentsCount: sql`GREATEST(${reels.commentsCount} - 1, 0)` })
      .where(eq(reels.id, comment.reelId));
    return true;
  }

  async toggleReelStatus(id: number, status: "active" | "disabled"): Promise<any> {
    const [updated] = await db
      .update(reels)
      .set({ status, updatedAt: new Date() })
      .where(eq(reels.id, id))
      .returning();
    return updated;
  }

  async adminGetAllReels(): Promise<any[]> {
    const userCols = {
      id: users.id,
      displayName: users.displayName,
      profilePicture: users.profilePicture,
    };
    const rows = await db
      .select({ reel: reels, user: userCols })
      .from(reels)
      .innerJoin(users, eq(reels.userId, users.id))
      .orderBy(desc(reels.createdAt));

    // Get report counts per reel
    const reelIds = rows.map(r => r.reel.id);
    let reportCounts: Record<number, number> = {};
    if (reelIds.length > 0) {
      const flagRows = await db
        .select({ contentId: contentFlags.contentId })
        .from(contentFlags)
        .where(and(
          eq(contentFlags.contentType, "reel"),
          inArray(contentFlags.contentId, reelIds)
        ));
      for (const f of flagRows) {
        reportCounts[f.contentId] = (reportCounts[f.contentId] || 0) + 1;
      }
    }

    return rows.map(r => ({
      ...r.reel,
      user: r.user,
      reportCount: reportCounts[r.reel.id] || 0,
    }));
  }

  // ── EVENT POLLS ────────────────────────────────────────────────────────────

  async createPoll(data: InsertEventPoll): Promise<EventPoll> {
    const [poll] = await db.insert(eventPolls).values(data).returning();
    return poll;
  }

  async getPollsByEvent(eventId: number): Promise<EventPoll[]> {
    return db
      .select()
      .from(eventPolls)
      .where(eq(eventPolls.eventId, eventId))
      .orderBy(desc(eventPolls.createdAt));
  }

  async getPollById(pollId: number): Promise<EventPoll | undefined> {
    const [poll] = await db.select().from(eventPolls).where(eq(eventPolls.id, pollId));
    return poll;
  }

  async updatePoll(pollId: number, data: Partial<EventPoll>): Promise<EventPoll> {
    const [updated] = await db
      .update(eventPolls)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(eventPolls.id, pollId))
      .returning();
    return updated;
  }

  async deletePoll(pollId: number): Promise<void> {
    await db.delete(pollVotes).where(eq(pollVotes.pollId, pollId));
    await db.delete(eventPolls).where(eq(eventPolls.id, pollId));
  }

  async castVote(pollId: number, userId: number, option: string): Promise<{ poll: EventPoll; vote: PollVote; results: Record<string, number> }> {
    // Check if already voted
    const [existing] = await db
      .select()
      .from(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));
    if (existing) throw new Error("ALREADY_VOTED");

    // Insert vote
    const [vote] = await db.insert(pollVotes).values({ pollId, userId, option }).returning();

    // Update totalVotes counter
    const [updatedPoll] = await db
      .update(eventPolls)
      .set({ totalVotes: sql`${eventPolls.totalVotes} + 1`, updatedAt: new Date() })
      .where(eq(eventPolls.id, pollId))
      .returning();

    const results = await this.getPollResults(pollId);
    return { poll: updatedPoll, vote, results };
  }

  async getUserVote(pollId: number, userId: number): Promise<PollVote | null> {
    const [vote] = await db
      .select()
      .from(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));
    return vote || null;
  }

  async getPollResults(pollId: number): Promise<Record<string, number>> {
    const votes = await db
      .select({ option: pollVotes.option })
      .from(pollVotes)
      .where(eq(pollVotes.pollId, pollId));

    const counts: Record<string, number> = {};
    for (const v of votes) {
      counts[v.option] = (counts[v.option] || 0) + 1;
    }
    return counts;
  }

  async getAllPollsAdmin(): Promise<any[]> {
    const rows = await db
      .select({
        poll: eventPolls,
        event: { id: events.id, title: events.title },
        creator: { id: users.id, displayName: users.displayName },
      })
      .from(eventPolls)
      .innerJoin(events, eq(eventPolls.eventId, events.id))
      .innerJoin(users, eq(eventPolls.createdBy, users.id))
      .orderBy(desc(eventPolls.createdAt));
    return rows.map(r => ({ ...r.poll, event: r.event, creator: r.creator }));
  }

  async resetPollVotes(pollId: number): Promise<EventPoll> {
    await db.delete(pollVotes).where(eq(pollVotes.pollId, pollId));
    const [updated] = await db
      .update(eventPolls)
      .set({ totalVotes: 0, updatedAt: new Date() })
      .where(eq(eventPolls.id, pollId))
      .returning();
    return updated;
  }

  async getPollVoters(pollId: number): Promise<Array<{ userId: number; displayName: string; option: string; votedAt: Date }>> {
    const rows = await db
      .select({
        userId: pollVotes.userId,
        displayName: users.displayName,
        option: pollVotes.option,
        votedAt: pollVotes.votedAt,
      })
      .from(pollVotes)
      .innerJoin(users, eq(pollVotes.userId, users.id))
      .where(eq(pollVotes.pollId, pollId))
      .orderBy(desc(pollVotes.votedAt));
    return rows;
  }

  async getPollVoteTimeline(pollId: number): Promise<Array<{ hour: string; count: number }>> {
    const rows = await db.execute(
      sql`
        SELECT date_trunc('hour', voted_at) AS hour, COUNT(*)::int AS count
        FROM poll_votes
        WHERE poll_id = ${pollId}
        GROUP BY hour
        ORDER BY hour ASC
      `
    );
    return (rows as any).rows?.map((r: any) => ({ hour: r.hour, count: r.count })) || [];
  }

  async duplicatePoll(pollId: number, createdBy: number): Promise<EventPoll> {
    const original = await this.getPollById(pollId);
    if (!original) throw new Error("Poll not found");
    const { id, totalVotes, createdAt, updatedAt, ...data } = original;
    const [newPoll] = await db
      .insert(eventPolls)
      .values({ ...data, question: `${data.question} (Copy)`, status: "draft", createdBy })
      .returning();
    return newPoll;
  }

  async bulkUpdatePollStatus(pollIds: number[], status: string): Promise<void> {
    await db
      .update(eventPolls)
      .set({ status, updatedAt: new Date() })
      .where(sql`id = ANY(${pollIds})`);
  }

  async bulkDeletePolls(pollIds: number[]): Promise<void> {
    await db.delete(pollVotes).where(sql`poll_id = ANY(${pollIds})`);
    await db.delete(eventPolls).where(sql`id = ANY(${pollIds})`);
  }

  async searchEventsForPoll(query: string, limit = 20): Promise<Array<{ id: number; title: string; date: Date | null }>> {
    const q = query.trim();
    const baseQuery = db
      .select({ id: events.id, title: events.title, date: events.date })
      .from(events)
      .orderBy(desc(events.date))
      .limit(limit);

    const rows = q
      ? await baseQuery.where(ilike(events.title, `%${q}%`))
      : await baseQuery;

    return rows;
  }

  // ── Back to the Street ────────────────────────────────────────────
  async getBttsProgram(): Promise<any[]> {
    const { bttsProgram } = await import("@shared/schema");
    return db.select().from(bttsProgram).orderBy(asc(bttsProgram.sortOrder), asc(bttsProgram.time));
  }
  async createBttsProgramItem(data: any): Promise<any> {
    const { bttsProgram } = await import("@shared/schema");
    const [row] = await db.insert(bttsProgram).values(data).returning();
    return row;
  }
  async updateBttsProgramItem(id: number, data: any): Promise<any> {
    const { bttsProgram } = await import("@shared/schema");
    const [row] = await db.update(bttsProgram).set(data).where(eq(bttsProgram.id, id)).returning();
    return row;
  }
  async deleteBttsProgramItem(id: number): Promise<boolean> {
    const { bttsProgram } = await import("@shared/schema");
    await db.delete(bttsProgram).where(eq(bttsProgram.id, id));
    return true;
  }

  async getBttsLineup(): Promise<any[]> {
    const { bttsLineup } = await import("@shared/schema");
    return db.select().from(bttsLineup).orderBy(asc(bttsLineup.sortOrder), asc(bttsLineup.name));
  }
  async createBttsLineupMember(data: any): Promise<any> {
    const { bttsLineup } = await import("@shared/schema");
    const [row] = await db.insert(bttsLineup).values(data).returning();
    return row;
  }
  async updateBttsLineupMember(id: number, data: any): Promise<any> {
    const { bttsLineup } = await import("@shared/schema");
    const [row] = await db.update(bttsLineup).set(data).where(eq(bttsLineup.id, id)).returning();
    return row;
  }
  async deleteBttsLineupMember(id: number): Promise<boolean> {
    const { bttsLineup } = await import("@shared/schema");
    await db.delete(bttsLineup).where(eq(bttsLineup.id, id));
    return true;
  }

  async getBttsBattles(): Promise<any[]> {
    const { bttsBattles } = await import("@shared/schema");
    return db.select().from(bttsBattles).orderBy(asc(bttsBattles.position));
  }
  async createBttsBattle(data: any): Promise<any> {
    const { bttsBattles } = await import("@shared/schema");
    const [row] = await db.insert(bttsBattles).values(data).returning();
    return row;
  }
  async updateBttsBattle(id: number, data: any): Promise<any> {
    const { bttsBattles } = await import("@shared/schema");
    const [row] = await db.update(bttsBattles).set(data).where(eq(bttsBattles.id, id)).returning();
    return row;
  }
  async deleteBttsBattle(id: number): Promise<boolean> {
    const { bttsBattles } = await import("@shared/schema");
    await db.delete(bttsBattles).where(eq(bttsBattles.id, id));
    return true;
  }

  async getBttsGallery(): Promise<any[]> {
    const { bttsGallery } = await import("@shared/schema");
    return db.select().from(bttsGallery).orderBy(desc(bttsGallery.featured), asc(bttsGallery.sortOrder));
  }
  async createBttsGalleryItem(data: any): Promise<any> {
    const { bttsGallery } = await import("@shared/schema");
    const [row] = await db.insert(bttsGallery).values(data).returning();
    return row;
  }
  async updateBttsGalleryItem(id: number, data: any): Promise<any> {
    const { bttsGallery } = await import("@shared/schema");
    const [row] = await db.update(bttsGallery).set(data).where(eq(bttsGallery.id, id)).returning();
    return row;
  }
  async deleteBttsGalleryItem(id: number): Promise<boolean> {
    const { bttsGallery } = await import("@shared/schema");
    await db.delete(bttsGallery).where(eq(bttsGallery.id, id));
    return true;
  }

  // ── City Passport Stamps ───────────────────────────────────────────────────
  async getJourneyStamps(userId: number) {
    const { userJourneyStamps } = await import("@shared/schema");
    return db.select().from(userJourneyStamps)
      .where(eq(userJourneyStamps.userId, userId))
      .orderBy(userJourneyStamps.visitedAt);
  }

  async upsertJourneyStamp(userId: number, waypointId: number) {
    const { userJourneyStamps } = await import("@shared/schema");
    const existing = await db.select().from(userJourneyStamps)
      .where(and(eq(userJourneyStamps.userId, userId), eq(userJourneyStamps.waypointId, waypointId)))
      .limit(1);
    if (existing.length > 0) return existing[0];
    const [row] = await db.insert(userJourneyStamps)
      .values({ userId, waypointId })
      .returning();
    return row;
  }

  // ── Founder Profile ────────────────────────────────────────────────────────
  async getFounderProfile() {
    const { founderProfile } = await import("@shared/schema");
    return db.select().from(founderProfile).orderBy(founderProfile.sortOrder);
  }

  async upsertFounderProfileSection(key: string, label: string, content: string, sortOrder: number = 0) {
    const { founderProfile } = await import("@shared/schema");
    const existing = await db.select().from(founderProfile).where(eq(founderProfile.key, key));
    if (existing.length > 0) {
      const [row] = await db.update(founderProfile)
        .set({ label, content, sortOrder, updatedAt: new Date() })
        .where(eq(founderProfile.key, key))
        .returning();
      return row;
    }
    const [row] = await db.insert(founderProfile).values({ key, label, content, sortOrder }).returning();
    return row;
  }

  // ── AI Training Entries ────────────────────────────────────────────────────
  async getAiTrainingEntries(includeInactive = false) {
    const { aiTrainingEntries } = await import("@shared/schema");
    if (includeInactive) {
      return db.select().from(aiTrainingEntries).orderBy(aiTrainingEntries.sortOrder, aiTrainingEntries.createdAt);
    }
    return db.select().from(aiTrainingEntries)
      .where(eq(aiTrainingEntries.isActive, true))
      .orderBy(aiTrainingEntries.sortOrder, aiTrainingEntries.createdAt);
  }

  async getPublicAiTrainingEntries() {
    const { aiTrainingEntries } = await import("@shared/schema");
    return db.select().from(aiTrainingEntries)
      .where(and(eq(aiTrainingEntries.isActive, true), eq(aiTrainingEntries.isPublic, true)))
      .orderBy(aiTrainingEntries.sortOrder, aiTrainingEntries.createdAt);
  }

  async createAiTrainingEntry(data: import("@shared/schema").InsertAiTrainingEntry) {
    const { aiTrainingEntries } = await import("@shared/schema");
    const [row] = await db.insert(aiTrainingEntries).values(data).returning();
    return row;
  }

  async updateAiTrainingEntry(id: number, data: Partial<import("@shared/schema").InsertAiTrainingEntry>) {
    const { aiTrainingEntries } = await import("@shared/schema");
    const [row] = await db.update(aiTrainingEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiTrainingEntries.id, id))
      .returning();
    return row;
  }

  async deleteAiTrainingEntry(id: number) {
    const { aiTrainingEntries } = await import("@shared/schema");
    await db.delete(aiTrainingEntries).where(eq(aiTrainingEntries.id, id));
    return true;
  }
}

// Initialize with PostgreSQL storage
export const storage = new DatabaseStorage();
