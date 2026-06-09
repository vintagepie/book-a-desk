import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authenticate, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/notifications
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { unreadOnly } = req.query as { unreadOnly?: string };
    const conditions: any[] = [eq(notificationsTable.userId, req.user!.id)];
    if (unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));

    const notifications = await db.select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(100);

    res.json(notifications.map(n => ({
      id: n.id,
      userId: n.userId,
      type: n.type,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })));
  } catch (err) {
    logger.error({ err }, "List notifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/notifications/:id/read
router.post("/:id/read", authenticate, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [notification] = await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user!.id)))
      .returning();
    if (!notification) { res.status(404).json({ error: "Notification not found" }); return; }
    res.json({
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });
  } catch (err) {
    logger.error({ err }, "Mark notification read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/notifications/read-all
router.post("/read-all", authenticate, async (req: AuthRequest, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, req.user!.id));
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    logger.error({ err }, "Mark all notifications read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
