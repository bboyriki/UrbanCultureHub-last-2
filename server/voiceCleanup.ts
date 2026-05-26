import { db } from './db';
import { chatMessages } from '../shared/schema';
import { and, eq, lt, not } from 'drizzle-orm';
import { v2 as cloudinary } from 'cloudinary';

function extractCloudinaryPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+$/);
  return match ? match[1] : null;
}

async function deleteVoiceFile(url: string): Promise<void> {
  try {
    const publicId = extractCloudinaryPublicId(url);
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true });
    console.log(`[VoiceCleanup] Deleted Cloudinary file: ${publicId}`);
  } catch (err) {
    console.error(`[VoiceCleanup] Failed to delete Cloudinary file for ${url}:`, err);
  }
}

export async function cleanupExpiredVoiceMessages(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const expired = await db.select()
      .from(chatMessages)
      .where(and(
        eq(chatMessages.type, 'voice'),
        not(eq(chatMessages.content, '[voice_expired]')),
        lt(chatMessages.createdAt as any, cutoff)
      ));

    if (expired.length === 0) return;

    console.log(`[VoiceCleanup] Expiring ${expired.length} voice message(s)`);

    for (const msg of expired) {
      await deleteVoiceFile(msg.content);
      await db.update(chatMessages)
        .set({ content: '[voice_expired]' })
        .where(eq(chatMessages.id, msg.id));
    }

    console.log(`[VoiceCleanup] Done expiring ${expired.length} voice message(s)`);
  } catch (err) {
    console.error('[VoiceCleanup] Error during cleanup:', err);
  }
}

export function startVoiceCleanup(): void {
  cleanupExpiredVoiceMessages();
  setInterval(cleanupExpiredVoiceMessages, 60 * 60 * 1000);
}
