import { db } from "../../db";
import { aiConversations, aiMessages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IChatStorage {
  getConversation(id: number): Promise<typeof aiConversations.$inferSelect | undefined>;
  getAllConversationsByUser(userId: number): Promise<(typeof aiConversations.$inferSelect)[]>;
  createConversation(userId: number, title: string): Promise<typeof aiConversations.$inferSelect>;
  updateConversationTitle(id: number, title: string): Promise<void>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<(typeof aiMessages.$inferSelect)[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<typeof aiMessages.$inferSelect>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: number) {
    const [conversation] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
    return conversation;
  },

  async getAllConversationsByUser(userId: number) {
    return db.select().from(aiConversations)
      .where(eq(aiConversations.userId, userId))
      .orderBy(desc(aiConversations.updatedAt));
  },

  async createConversation(userId: number, title: string) {
    const [conversation] = await db.insert(aiConversations)
      .values({ userId, title })
      .returning();
    return conversation;
  },

  async updateConversationTitle(id: number, title: string) {
    await db.update(aiConversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(aiConversations.id, id));
  },

  async deleteConversation(id: number) {
    await db.delete(aiMessages).where(eq(aiMessages.conversationId, id));
    await db.delete(aiConversations).where(eq(aiConversations.id, id));
  },

  async getMessagesByConversation(conversationId: number) {
    return db.select().from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(aiMessages.createdAt);
  },

  async createMessage(conversationId: number, role: string, content: string) {
    const [message] = await db.insert(aiMessages)
      .values({ conversationId, role, content })
      .returning();
    return message;
  },
};
