import axios from "axios";
import { db } from "./db";
import {
  instagramConnections, instagramAutomationRules, instagramAiActions, instagramAiPersona,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { buildPersonaSystemPrompt } from "./instagramAiRoutes";
import Anthropic from "@anthropic-ai/sdk";
import {
  notifyIgNewComment,
  notifyIgPostPublished,
  notifyIgPostFailed,
  notifyIgEngagementSpike,
} from "./instagramPush";

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || "missing",
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

const IG_GRAPH = "https://graph.instagram.com";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

function detectCommentLanguage(text: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return "Arabic";
  const dutchWords = ["de", "het", "een", "is", "dit", "dat", "je", "jij", "wat", "hoe", "mooi", "super", "top", "goed", "leuk", "gaaf", "vet", "dank", "bedankt", "ook", "maar", "wel", "niet"];
  const lower = text.toLowerCase();
  const words = lower.split(/[\s,.!?]+/);
  const dutchCount = dutchWords.filter(w => words.includes(w)).length;
  return dutchCount >= 2 ? "Dutch" : "English";
}

export async function generateDraftReply(
  sourceText: string,
  personaPrompt: string,
  context?: { postCaption?: string; username?: string },
): Promise<string> {
  const language = detectCommentLanguage(sourceText);
  const contextBlock = context?.postCaption
    ? `\nPost context: "${context.postCaption.slice(0, 300)}"\n`
    : "";
  const commenter = context?.username ? `@${context.username}` : "someone";

  const userPrompt = `${contextBlock}
Comment from ${commenter}: "${sourceText}"

Write ONE natural Instagram reply. Strict rules:
- Language: reply in ${language} (match the commenter's language exactly)
- Sound completely human — NOT like customer service, a bot, or AI
- Be direct, warm, and genuine — make it clear you actually read the comment
- NEVER open with: "Thanks for", "Thank you for", "Great comment", "Absolutely!", "Certainly!", "Of course!", "That's amazing!"
- Use 1-2 emojis naturally only if they match the creator's style
- If it's a question → give a real, direct answer
- If it's a compliment → respond naturally, not fake-enthusiastic
- If it's critical → stay calm, address it genuinely
- Max 150 characters ideally — short is powerful on Instagram
- ONLY output the reply text — no quotes, no labels, no explanation`;

  const { aiChat } = await import("./aiRouter");
  const msg = await aiChat({
    role: "instagram",
    maxTokens: 250,
    temperature: 0.85,
    system: personaPrompt || "You are an authentic Instagram creator who writes genuine, engaging replies that sound completely human. You care about your community.",
    messages: [{ role: "user", content: userPrompt }],
  });
  return msg.text.trim().replace(/^["']|["']$/g, "");
}

async function sendInstagramReply(
  commentId: string | null | undefined,
  mediaId: string | null | undefined,
  text: string,
  accessToken: string,
): Promise<void> {
  if (commentId) {
    await axios.post(`${IG_GRAPH}/${commentId}/replies`, null, {
      params: { message: text, access_token: accessToken },
    });
  } else if (mediaId) {
    await axios.post(`${IG_GRAPH}/${mediaId}/comments`, null, {
      params: { message: text, access_token: accessToken },
    });
  }
}

async function runAutomationForConnection(conn: any) {
  // ── MASTER SAFETY SWITCH ──────────────────────────────────────────────────
  // Automation never runs unless the admin has explicitly turned it ON.
  // This prevents surprise auto-posts when the app first starts.
  if (!conn.automationEnabled) {
    return; // silent — don't even log unless debugging
  }

  const adminUserId = conn.adminUserId as number;

  const connectionId = conn.id as number;

  const rules = await db.select().from(instagramAutomationRules).where(
    and(
      eq(instagramAutomationRules.adminUserId, adminUserId),
      eq(instagramAutomationRules.isActive, true),
      eq(instagramAutomationRules.instagramConnectionId, connectionId),
    )
  );

  if (rules.length === 0) return;

  const personaRows = await db.select().from(instagramAiPersona)
    .where(and(
      eq(instagramAiPersona.adminUserId, adminUserId),
      eq(instagramAiPersona.instagramConnectionId, connectionId),
    )).limit(1);
  const persona = personaRows[0] || null;
  const systemPrompt = buildPersonaSystemPrompt(persona);

  async function executeAction(rule: any, triggerData: any, sourceText: string | null, mediaId?: string, commentId?: string) {
    // Update trigger stats on the rule
    await db.update(instagramAutomationRules).set({
      triggerCount: (rule.triggerCount || 0) + 1,
      lastTriggeredAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(instagramAutomationRules.id, rule.id));

    const actionBase = {
      adminUserId,
      triggerType: rule.triggerType,
      triggerData,
      ruleId: rule.id,
      mediaId: mediaId || null,
      commentId: commentId || null,
      sourceText: sourceText || null,
    };

    if (rule.actionType === "draft_reply") {
      const draft = rule.replyTemplate || (sourceText ? await generateDraftReply(sourceText, systemPrompt, {
        postCaption: (triggerData as any)?.postCaption,
        username:    (triggerData as any)?.username,
      }) : "");
      const status = rule.autoSend ? "sent" : "pending";

      const [action] = await db.insert(instagramAiActions).values({
        ...actionBase,
        rawAiOutput: draft,
        status,
        finalSentText: rule.autoSend ? draft : null,
      }).returning();

      if (rule.autoSend && draft) {
        try {
          await sendInstagramReply(commentId, mediaId, draft, conn.accessToken);
        } catch (sendErr: any) {
          console.error(`[IG Scheduler AutoSend] rule=${rule.id}`, sendErr.message);
          await db.update(instagramAiActions).set({ status: "error", updatedAt: new Date() })
            .where(eq(instagramAiActions.id, action.id));
        }
      }

      // Push notification for pending replies (admin needs to review)
      if (!rule.autoSend && draft && sourceText) {
        const username = (triggerData as any)?.username || "iemand";
        notifyIgNewComment({
          adminUserId,
          username,
          commentText: sourceText,
          suggestedReply: draft,
          actionId: action.id,
        }).catch(e => console.warn("[IGPush] notify comment failed:", e.message));
      }

    } else if (rule.actionType === "notify_admin") {
      const notifText = sourceText
        ? `Regel "${rule.name}" getriggerd. Bron: "${sourceText.slice(0, 100)}"`
        : `Regel "${rule.name}" getriggerd.`;
      await db.insert(instagramAiActions).values({
        ...actionBase,
        rawAiOutput: notifText,
        status: "sent",
        finalSentText: notifText,
      });

    } else if (rule.actionType === "send_dm") {
      const draft = rule.replyTemplate || (sourceText ? await generateDraftReply(sourceText, systemPrompt, {
        postCaption: (triggerData as any)?.postCaption,
        username:    (triggerData as any)?.username,
      }) : "");
      await db.insert(instagramAiActions).values({
        ...actionBase,
        rawAiOutput: draft,
        status: "pending",
      });

    } else if (rule.actionType === "like_comment") {
      // Attempt to like the comment via Instagram Graph API
      let likeStatus = "pending";
      try {
        if (commentId && conn?.accessToken) {
          await axios.post(`${IG_GRAPH}/${commentId}/likes`, null, {
            params: { access_token: conn.accessToken },
          });
          likeStatus = "sent";
        }
      } catch (err: any) {
        console.error(`[IG Scheduler Like] rule=${rule.id}`, err.message);
        likeStatus = "error";
      }
      await db.insert(instagramAiActions).values({
        ...actionBase,
        rawAiOutput: `Like actie op comment ${commentId}`,
        status: likeStatus,
      });

    } else if (rule.actionType === "hide_comment") {
      let hideStatus = "pending";
      try {
        if (commentId && conn?.accessToken) {
          await axios.post(`${IG_GRAPH}/${commentId}`, null, {
            params: { hide: true, access_token: conn.accessToken },
          });
          hideStatus = "sent";
        }
      } catch (err: any) {
        console.error(`[IG Scheduler Hide] rule=${rule.id}`, err.message);
        hideStatus = "error";
      }
      await db.insert(instagramAiActions).values({
        ...actionBase,
        rawAiOutput: `Verberg actie op comment ${commentId}`,
        status: hideStatus,
      });

    } else if (rule.actionType === "tag_for_review") {
      await db.insert(instagramAiActions).values({
        ...actionBase,
        rawAiOutput: `[Review] ${sourceText?.slice(0, 200) || "Geen tekst"}`,
        status: "pending",
      });
    }
  }

  // Simple negative-sentiment keywords (no external AI call needed)
  function isNegativeSentiment(text: string): boolean {
    const neg = ["slecht", "terrible", "awful", "hate", "worst", "disappointing", "teleurstellend", "vreselijk", "erg slecht", "boos", "angry", "waardeloos", "nep", "scam"];
    const lower = text.toLowerCase();
    return neg.some(w => lower.includes(w));
  }

  // ── Fetch recent media and process comment-based rules ──
  const commentRules = rules.filter(r =>
    r.triggerType === "comment_received" || r.triggerType === "comment_contains_keyword" || r.triggerType === "comment_sentiment_negative"
  );

  if (commentRules.length > 0) {
    try {
      const mediaRes = await axios.get(`${IG_GRAPH}/me/media`, {
        params: {
          fields: "id,caption,timestamp",
          limit: 5,
          access_token: conn.accessToken,
        },
      });

      const mediaPosts = mediaRes.data?.data || [];

      for (const post of mediaPosts) {
        let commentsRes: any;
        try {
          commentsRes = await axios.get(`${IG_GRAPH}/${post.id}/comments`, {
            params: {
              fields: "id,text,username,timestamp",
              limit: 20,
              access_token: conn.accessToken,
            },
          });
        } catch { continue; }

        const comments = commentsRes.data?.data || [];

        for (const comment of comments) {
          // Check if we already have an action for this comment (avoid duplicate processing)
          const existing = await db.select().from(instagramAiActions).where(
            and(
              eq(instagramAiActions.adminUserId, adminUserId),
              eq(instagramAiActions.commentId, comment.id),
            )
          ).limit(1);
          if (existing.length > 0) continue;

          for (const rule of commentRules) {
            let matches = false;
            const lowerText = (comment.text || "").toLowerCase();
            if (rule.triggerType === "comment_received") {
              matches = true;
            } else if (rule.triggerType === "comment_contains_keyword" && rule.conditionKeyword) {
              matches = lowerText.includes(rule.conditionKeyword.toLowerCase());
            } else if (rule.triggerType === "comment_sentiment_negative") {
              matches = isNegativeSentiment(comment.text || "");
            }

            // Check exclude keyword
            if (matches && rule.conditionKeywordExclude) {
              if (lowerText.includes(rule.conditionKeywordExclude.toLowerCase())) matches = false;
            }

            if (!matches) continue;

            try {
              await executeAction(rule, { commentId: comment.id, mediaId: post.id, source: "scheduler", postCaption: post.caption, username: comment.username }, comment.text, post.id, comment.id);
            } catch (err: any) {
              console.error(`[IG Scheduler Comment] rule=${rule.id} comment=${comment.id}`, err.message);
            }
            break; // first matching rule per comment
          }
        }
      }
    } catch (err: any) {
      console.error(`[IG Scheduler Media] adminUserId=${adminUserId}`, err.message);
    }
  }

  // ── Fetch followers and process new_follower_dm rules ──
  const followerRules = rules.filter(r => r.triggerType === "new_follower_dm");
  if (followerRules.length > 0) {
    // Note: Instagram Graph API does not provide a direct "new followers" feed.
    // We document this in activity logs as a known limitation.
    // Follower rules can still be triggered manually via the evaluate endpoint.
    console.log(`[IG Scheduler] new_follower_dm rules exist but Graph API does not expose follower events — use evaluate endpoint`);
  }

  // ── Fetch media insights and process post_engagement_spike rules ──
  const spikeRules = rules.filter(r => r.triggerType === "post_engagement_spike");
  if (spikeRules.length > 0) {
    try {
      const mediaRes = await axios.get(`${IG_GRAPH}/me/media`, {
        params: {
          fields: "id,caption,like_count,comments_count,timestamp",
          limit: 10,
          access_token: conn.accessToken,
        },
      });

      const posts = mediaRes.data?.data || [];
      for (const post of posts) {
        const totalEngagement = (post.like_count || 0) + (post.comments_count || 0);

        // Check if we already logged a spike action for this post today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingSpike = await db.select().from(instagramAiActions).where(
          and(
            eq(instagramAiActions.adminUserId, adminUserId),
            eq(instagramAiActions.mediaId, post.id),
            eq(instagramAiActions.triggerType, "post_engagement_spike"),
          )
        ).limit(1);
        if (existingSpike.length > 0) continue;

        for (const rule of spikeRules) {
          const SPIKE_THRESHOLD = rule.engagementThreshold ?? 100;
          if (totalEngagement < SPIKE_THRESHOLD) continue;
          try {
            const spikeText = `Post "${(post.caption || "").slice(0, 80)}" heeft ${totalEngagement} engagements bereikt (likes + comments)`;
            await executeAction(rule, { mediaId: post.id, totalEngagement, caption: post.caption, source: "scheduler" }, spikeText, post.id);
            // Push notification for engagement spike
            notifyIgEngagementSpike({
              adminUserId,
              caption: post.caption,
              totalEngagement,
              mediaId: post.id,
            }).catch(e => console.warn("[IGPush] spike notify failed:", e.message));
          } catch (err: any) {
            console.error(`[IG Scheduler Spike] rule=${rule.id} post=${post.id}`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.error(`[IG Scheduler Insights] adminUserId=${adminUserId}`, err.message);
    }
  }
}

/* ── Scheduled Posts Publisher ─────────────────────────────────────────────── */
async function publishScheduledPosts() {
  try {
    const { pool } = await import("./db");
    const now = new Date();

    // Fetch all pending posts whose scheduled time has passed
    const result = await pool.query(
      `SELECT * FROM instagram_scheduled_posts
       WHERE status = 'pending' AND scheduled_at <= $1
       ORDER BY scheduled_at ASC
       LIMIT 10`,
      [now],
    );
    const posts: any[] = result.rows || [];
    if (posts.length === 0) return;

    console.log(`[IG Schedule] ${posts.length} post(s) ready to publish`);

    for (const post of posts) {
      // Mark as publishing
      await pool.query(
        `UPDATE instagram_scheduled_posts SET status = 'publishing', updated_at = NOW() WHERE id = $1`,
        [post.id],
      );

      try {
        const conn = await db.select().from(instagramConnections)
          .where(and(eq(instagramConnections.adminUserId, post.admin_user_id), eq(instagramConnections.isActive, true)))
          .limit(1).then(r => r[0]);

        if (!conn) throw new Error("No active Instagram connection for admin");

        const fullCaption = [post.caption || "", post.hashtags || ""].filter(Boolean).join("\n\n");
        const mediaType: string = post.media_type || "PHOTO";
        const mediaUrl: string = post.media_url;
        const igUserId = conn.instagramUserId;
        const token = conn.accessToken;
        const FB_GRAPH = "https://graph.facebook.com/v18.0";

        // Step 1: Create media container
        let containerId: string;

        if (mediaType === "CAROUSEL" && post.carousel_slides) {
          const slides: string[] = JSON.parse(post.carousel_slides);
          if (slides.length < 2) throw new Error("Carousel requires at least 2 slides");
          const childIds: string[] = [];
          for (const slideUrl of slides) {
            const childRes = await axios.post(`${FB_GRAPH}/${igUserId}/media`, null, {
              params: { image_url: slideUrl, is_carousel_item: "true", access_token: token },
            });
            childIds.push(childRes.data.id);
          }
          const carouselRes = await axios.post(`${FB_GRAPH}/${igUserId}/media`, null, {
            params: { media_type: "CAROUSEL", caption: fullCaption, children: childIds.join(","), access_token: token },
          });
          containerId = carouselRes.data.id;
        } else {
          const containerParams: Record<string, string> = {
            caption: fullCaption,
            access_token: token,
          };

          if (mediaType === "REELS") {
            containerParams.media_type = "REELS";
            containerParams.video_url = mediaUrl;
            containerParams.share_to_feed = "true";
          } else if (mediaType === "VIDEO") {
            containerParams.media_type = "VIDEO";
            containerParams.video_url = mediaUrl;
          } else if (mediaType === "STORY") {
            containerParams.media_type = "STORIES";
            // Detect video by URL extension — Story can be image or video
            const isVideoUrl = /\.(mp4|mov|avi|webm|m4v)(\?|$)/i.test(mediaUrl);
            if (isVideoUrl) containerParams.video_url = mediaUrl;
            else containerParams.image_url = mediaUrl;
          } else {
            containerParams.image_url = mediaUrl;
          }

          const containerRes = await axios.post(
            `${FB_GRAPH}/${igUserId}/media`,
            null,
            { params: containerParams },
          );
          containerId = containerRes.data.id;
        }

        // Step 2: Poll for container readiness (video needs encoding)
        const isVideoStory = mediaType === "STORY" && /\.(mp4|mov|avi|webm|m4v)(\?|$)/i.test(mediaUrl);
        if (mediaType === "REELS" || mediaType === "VIDEO" || isVideoStory) {
          let ready = false;
          for (let attempt = 0; attempt < 20 && !ready; attempt++) {
            await new Promise(r => setTimeout(r, 6000));
            const statusRes = await axios.get(`${FB_GRAPH}/${containerId}`, {
              params: { fields: "status_code", access_token: token },
            });
            if (statusRes.data.status_code === "FINISHED") ready = true;
            else if (statusRes.data.status_code === "ERROR") throw new Error("Media container encoding failed");
          }
          if (!ready) throw new Error("Timeout waiting for video encoding");
        }

        // Step 3: Publish
        const publishRes = await axios.post(
          `${FB_GRAPH}/${igUserId}/media_publish`,
          null,
          { params: { creation_id: containerId, access_token: token } },
        );
        const instagramMediaId: string = publishRes.data.id;

        // Fetch the real permalink from the Graph API
        let permalink: string | null = null;
        try {
          const permalinkRes = await axios.get(`${FB_GRAPH}/${instagramMediaId}`, {
            params: { fields: "permalink", access_token: token },
          });
          permalink = permalinkRes.data?.permalink || null;
        } catch { /* non-critical — leave null */ }

        await pool.query(
          `UPDATE instagram_scheduled_posts
           SET status = 'published', instagram_media_id = $2, permalink = $3, updated_at = NOW()
           WHERE id = $1`,
          [post.id, instagramMediaId, permalink],
        );
        console.log(`[IG Schedule] Post ${post.id} published → ${instagramMediaId}${permalink ? ` | ${permalink}` : ""}`);

        // Push notification: post published
        notifyIgPostPublished({
          adminUserId: post.admin_user_id,
          postId: post.id,
          caption: post.caption,
          permalink: permalink || undefined,
          mediaType: post.media_type,
        }).catch(e => console.warn("[IGPush] published notify failed:", e.message));

      } catch (err: any) {
        console.error(`[IG Schedule] Post ${post.id} failed:`, err.message);
        await pool.query(
          `UPDATE instagram_scheduled_posts
           SET status = 'failed', error_message = $2, updated_at = NOW()
           WHERE id = $1`,
          [post.id, (err.message || "Unknown error").slice(0, 500)],
        );

        // Push notification: post failed
        notifyIgPostFailed({
          adminUserId: post.admin_user_id,
          postId: post.id,
          caption: post.caption,
          error: err.message,
        }).catch(e => console.warn("[IGPush] failed notify failed:", e.message));
      }
    }
  } catch (err: any) {
    console.error("[IG Schedule] Publisher run failed:", err.message);
  }
}

export async function runInstagramAutomation() {
  // Also publish any pending scheduled posts
  await publishScheduledPosts().catch(err => console.error("[IG Schedule] publishScheduledPosts failed:", err.message));

  try {
    const connections = await db.select().from(instagramConnections)
      .where(eq(instagramConnections.isActive, true));

    for (const conn of connections) {
      try {
        await runAutomationForConnection(conn);
      } catch (err: any) {
        console.error(`[IG Automation] Failed for connection ${conn.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[IG Automation] Scheduler run failed:", err.message);
  }
}

export function startInstagramAutomationScheduler() {
  console.log("[IG Automation] Scheduler starting — checking every 5 minutes");

  // Initial run after 30 seconds (let other init tasks finish first)
  setTimeout(() => {
    runInstagramAutomation().catch(err => console.error("[IG Automation] Initial run failed:", err.message));
  }, 30_000);

  // Recurring run
  setInterval(() => {
    runInstagramAutomation().catch(err => console.error("[IG Automation] Scheduled run failed:", err.message));
  }, POLL_INTERVAL_MS);
}
