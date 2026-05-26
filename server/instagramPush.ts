/**
 * Instagram Push Notification Utility
 * Sends real-time push notifications to all admin/super_admin users for
 * Instagram events: new comments (with AI reply suggestion), mentions,
 * DMs, scheduled post publish/fail, and engagement spikes.
 */
import { db } from "./db";
import { users } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { sendPushToUser } from "./push";

async function getAdminUserIds(): Promise<number[]> {
  try {
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.role as any, ["admin", "super_admin"]));
    return admins.map(a => a.id);
  } catch {
    return [];
  }
}

async function sendIgPushToAdmins(payload: {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
}): Promise<void> {
  try {
    const adminIds = await getAdminUserIds();
    await Promise.allSettled(
      adminIds.map(id =>
        sendPushToUser(id, {
          title: payload.title,
          body: payload.body,
          url: payload.url || "/admin/instagram?zone=notifications",
          icon: "/logo.jpg",
          data: payload.data || {},
        })
      )
    );
  } catch (err: any) {
    console.error("[IGPush] sendIgPushToAdmins error:", err.message);
  }
}

// ── Public notification functions ─────────────────────────────────────────────

/** New comment detected — with optional AI-generated reply suggestion */
export async function notifyIgNewComment(opts: {
  adminUserId?: number;
  username: string;
  commentText: string;
  suggestedReply?: string;
  actionId?: number;
}): Promise<void> {
  const { username, commentText, suggestedReply, actionId } = opts;
  const preview = commentText.length > 70 ? commentText.slice(0, 70) + "…" : commentText;
  const body = suggestedReply
    ? `@${username}: "${preview}"\n\n💡 Suggestie: "${suggestedReply.slice(0, 60)}"`
    : `@${username}: "${preview}"`;

  await sendIgPushToAdmins({
    title: "💬 Nieuwe Instagram reactie",
    body,
    url: `/admin/instagram?zone=notifications${actionId != null ? `&actionId=${actionId}` : ""}`,
    data: {
      type: "ig_comment",
      username,
      actionId: actionId != null ? String(actionId) : "",
    },
  });
}

/** Tagged or mentioned in another post/story */
export async function notifyIgMention(opts: {
  username: string;
  mediaId: string;
  caption?: string;
}): Promise<void> {
  const { username, mediaId, caption } = opts;
  await sendIgPushToAdmins({
    title: "📌 Instagram mention",
    body: `@${username} heeft je getagd${caption ? `: "${caption.slice(0, 80)}"` : ""}`,
    url: "/admin/instagram?zone=notifications",
    data: { type: "ig_mention", username, mediaId },
  });
}

/** Direct message received */
export async function notifyIgDM(opts: {
  senderId: string;
  message?: string;
}): Promise<void> {
  await sendIgPushToAdmins({
    title: "✉️ Instagram DM ontvangen",
    body: opts.message ? `"${opts.message.slice(0, 100)}"` : "Nieuw DM bericht",
    url: "/admin/instagram?zone=inbox",
    data: { type: "ig_dm", senderId: opts.senderId },
  });
}

/** Scheduled post successfully published */
export async function notifyIgPostPublished(opts: {
  adminUserId: number;
  postId: number;
  caption?: string;
  permalink?: string;
  mediaType?: string;
}): Promise<void> {
  const { adminUserId, postId, caption, permalink, mediaType } = opts;
  const typeLabel = mediaType === "REELS" ? "Reel" : mediaType === "VIDEO" ? "Video" : "Post";
  await sendPushToUser(adminUserId, {
    title: `✅ ${typeLabel} gepubliceerd!`,
    body: caption ? `"${caption.slice(0, 100)}"` : "Ingeplande post succesvol gepubliceerd.",
    url: permalink || "/admin/instagram?zone=schedule",
    icon: "/logo.jpg",
    data: { type: "ig_published", postId: String(postId), permalink: permalink || "" },
  });
}

/** Scheduled post failed to publish */
export async function notifyIgPostFailed(opts: {
  adminUserId: number;
  postId: number;
  caption?: string;
  error?: string;
}): Promise<void> {
  const { adminUserId, postId, caption, error } = opts;
  await sendPushToUser(adminUserId, {
    title: "❌ Instagram post mislukt",
    body: `"${(caption || "Post").slice(0, 60)}" kon niet worden gepubliceerd: ${(error || "Onbekende fout").slice(0, 80)}`,
    url: "/admin/instagram?zone=schedule",
    icon: "/logo.jpg",
    data: { type: "ig_failed", postId: String(postId) },
  });
}

/** Post reached an engagement spike threshold */
export async function notifyIgEngagementSpike(opts: {
  adminUserId: number;
  caption?: string;
  totalEngagement: number;
  mediaId?: string;
}): Promise<void> {
  const { adminUserId, caption, totalEngagement } = opts;
  await sendPushToUser(adminUserId, {
    title: "🔥 Engagement piek!",
    body: `Post "${(caption || "").slice(0, 60)}" heeft ${totalEngagement} interacties bereikt`,
    url: "/admin/instagram?zone=analytics",
    icon: "/logo.jpg",
    data: { type: "ig_spike", engagement: String(totalEngagement) },
  });
}

/** Story reply / interaction received */
export async function notifyIgStoryReply(opts: {
  username: string;
  message?: string;
}): Promise<void> {
  await sendIgPushToAdmins({
    title: "📖 Story reactie",
    body: `@${opts.username}: "${(opts.message || "").slice(0, 100)}"`,
    url: "/admin/instagram?zone=notifications",
    data: { type: "ig_story_reply", username: opts.username },
  });
}
