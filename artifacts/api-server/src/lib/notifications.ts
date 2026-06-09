import { db, notificationsTable } from "@workspace/db";
import { logger } from "./logger";

export async function createNotification(
  userId: number,
  type: string,
  message: string
) {
  try {
    await db.insert(notificationsTable).values({ userId, type, message });
  } catch (err) {
    logger.error({ err }, "Failed to create notification");
  }
}
