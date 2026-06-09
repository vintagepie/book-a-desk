import { Router } from "express";
import { db, desksTable, deskBookingsTable, maintenanceLogsTable, notificationsTable, usersTable } from "@workspace/db";
import { eq, and, sql, ne } from "drizzle-orm";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";

const router = Router();

const formatDesk = (desk: typeof desksTable.$inferSelect, isAvailable?: boolean) => ({
  id: desk.id,
  name: desk.name,
  floor: desk.floor,
  zone: desk.zone,
  status: desk.status,
  amenities: desk.amenities,
  qrCode: desk.qrCode,
  isAvailable: isAvailable ?? desk.status === "available",
  createdAt: desk.createdAt,
});

// GET /api/desks
router.get("/", authenticate, async (req, res) => {
  try {
    const { date, floor, status } = req.query as { date?: string; floor?: string; status?: string };
    let query = db.select().from(desksTable);
    const conditions = [];
    if (floor) conditions.push(eq(desksTable.floor, floor));
    if (status) conditions.push(eq(desksTable.status, status));
    const allDesks = conditions.length
      ? await db.select().from(desksTable).where(and(...conditions)).orderBy(desksTable.name)
      : await db.select().from(desksTable).orderBy(desksTable.name);

    if (date) {
      // Get booked desk IDs for this date
      const bookedBookings = await db.select({ deskId: deskBookingsTable.deskId })
        .from(deskBookingsTable)
        .where(and(
          eq(deskBookingsTable.date, date),
          sql`${deskBookingsTable.status} NOT IN ('cancelled', 'expired')`
        ));
      const bookedIds = new Set(bookedBookings.map(b => b.deskId));
      res.json(allDesks.map(d => formatDesk(d, d.status === "available" && !bookedIds.has(d.id))));
    } else {
      res.json(allDesks.map(d => formatDesk(d)));
    }
  } catch (err) {
    logger.error({ err }, "List desks error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/desks
router.post("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { name, floor, zone, amenities } = req.body as { name: string; floor: string; zone?: string; amenities?: string };
    if (!name || !floor) { res.status(400).json({ error: "name and floor required" }); return; }
    const qrCode = `DESK-${uuidv4().toUpperCase().slice(0, 8)}`;
    const [desk] = await db.insert(desksTable).values({ name, floor, zone, amenities, qrCode }).returning();
    res.status(201).json(formatDesk(desk));
  } catch (err) {
    logger.error({ err }, "Create desk error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/desks/:id
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [desk] = await db.select().from(desksTable).where(eq(desksTable.id, id)).limit(1);
    if (!desk) { res.status(404).json({ error: "Desk not found" }); return; }
    res.json(formatDesk(desk));
  } catch (err) {
    logger.error({ err }, "Get desk error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/desks/:id
router.patch("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, floor, zone, amenities, status } = req.body as { name?: string; floor?: string; zone?: string; amenities?: string; status?: string };
    const updateData: Partial<typeof desksTable.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (floor !== undefined) updateData.floor = floor;
    if (zone !== undefined) updateData.zone = zone;
    if (amenities !== undefined) updateData.amenities = amenities;
    if (status !== undefined) updateData.status = status;
    const [desk] = await db.update(desksTable).set(updateData).where(eq(desksTable.id, id)).returning();
    if (!desk) { res.status(404).json({ error: "Desk not found" }); return; }
    res.json(formatDesk(desk));
  } catch (err) {
    logger.error({ err }, "Update desk error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/desks/:id
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(desksTable).where(eq(desksTable.id, id));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Delete desk error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/desks/:id/maintenance
router.post("/:id/maintenance", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body as { reason: string };
    if (!reason) { res.status(400).json({ error: "reason required" }); return; }

    const [desk] = await db.update(desksTable).set({ status: "maintenance" }).where(eq(desksTable.id, id)).returning();
    if (!desk) { res.status(404).json({ error: "Desk not found" }); return; }

    // Log maintenance
    await db.insert(maintenanceLogsTable).values({ deskId: id, action: "marked_maintenance", reason, performedBy: req.user!.id });

    // Notify affected users with confirmed bookings in the future
    const today = new Date().toISOString().slice(0, 10);
    const affectedBookings = await db.select({
      userId: deskBookingsTable.userId,
    })
      .from(deskBookingsTable)
      .where(and(
        eq(deskBookingsTable.deskId, id),
        eq(deskBookingsTable.status, "confirmed"),
        sql`${deskBookingsTable.date} >= ${today}`
      ));

    for (const booking of affectedBookings) {
      await createNotification(booking.userId, "maintenance_alert",
        `Desk ${desk.name} has been marked under maintenance. Please book an alternative desk.`);
    }

    res.json(formatDesk(desk));
  } catch (err) {
    logger.error({ err }, "Mark desk maintenance error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/desks/:id/restore
router.post("/:id/restore", authenticate, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [desk] = await db.update(desksTable).set({ status: "available" }).where(eq(desksTable.id, id)).returning();
    if (!desk) { res.status(404).json({ error: "Desk not found" }); return; }
    await db.insert(maintenanceLogsTable).values({ deskId: id, action: "restored", reason: "Restored by admin", performedBy: req.user!.id });
    res.json(formatDesk(desk));
  } catch (err) {
    logger.error({ err }, "Restore desk error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { maintenanceLogsTable };
export default router;
