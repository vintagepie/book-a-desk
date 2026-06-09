import { Router } from "express";
import { db, deskBookingsTable, desksTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { authenticate, AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { logger } from "../lib/logger";

const router = Router();

const formatBooking = (b: any) => ({
  id: b.id,
  deskId: b.deskId,
  userId: b.userId,
  date: b.date,
  status: b.status,
  checkedInAt: b.checkedInAt,
  cancelledAt: b.cancelledAt,
  createdAt: b.createdAt,
  desk: b.desk ? {
    id: b.desk.id,
    name: b.desk.name,
    floor: b.desk.floor,
    zone: b.desk.zone,
    status: b.desk.status,
    amenities: b.desk.amenities,
    qrCode: b.desk.qrCode,
    isAvailable: b.desk.status === "available",
    createdAt: b.desk.createdAt,
  } : undefined,
  user: b.user ? {
    id: b.user.id,
    email: b.user.email,
    name: b.user.name,
    role: b.user.role,
    department: b.user.department,
    avatarUrl: b.user.avatarUrl,
    isActive: b.user.isActive,
    createdAt: b.user.createdAt,
  } : undefined,
});

async function getBookingWithRelations(id: number) {
  const rows = await db
    .select()
    .from(deskBookingsTable)
    .leftJoin(desksTable, eq(deskBookingsTable.deskId, desksTable.id))
    .leftJoin(usersTable, eq(deskBookingsTable.userId, usersTable.id))
    .where(eq(deskBookingsTable.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const r = rows[0];
  return { ...r.desk_bookings, desk: r.desks, user: r.users };
}

// GET /api/desk-bookings
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { userId, date, status, page = "1", limit = "20" } = req.query as {
      userId?: string; date?: string; status?: string; page?: string; limit?: string;
    };
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    // Non-admins can only see their own bookings
    if (req.user!.role !== "admin") {
      conditions.push(eq(deskBookingsTable.userId, req.user!.id));
    } else if (userId) {
      conditions.push(eq(deskBookingsTable.userId, parseInt(userId)));
    }
    if (date) conditions.push(eq(deskBookingsTable.date, date));
    if (status) conditions.push(eq(deskBookingsTable.status, status));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(deskBookingsTable)
      .leftJoin(desksTable, eq(deskBookingsTable.deskId, desksTable.id))
      .leftJoin(usersTable, eq(deskBookingsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(deskBookingsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deskBookingsTable)
      .where(whereClause);

    const data = rows.map(r => formatBooking({ ...r.desk_bookings, desk: r.desks, user: r.users }));
    res.json({ data, total: count, page: pageNum, limit: limitNum });
  } catch (err) {
    logger.error({ err }, "List desk bookings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/desk-bookings
router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { deskId, date } = req.body as { deskId: number; date: string };
    if (!deskId || !date) { res.status(400).json({ error: "deskId and date required" }); return; }

    const userId = req.user!.id;
    const today = new Date().toISOString().slice(0, 10);

    // Booking cutoff: 9:00 AM today
    if (date === today) {
      const now = new Date();
      const cutoffHour = 9;
      if (now.getHours() >= cutoffHour) {
        res.status(400).json({ error: "Booking cutoff time (9:00 AM) has passed for today" }); return;
      }
    }

    if (date < today) { res.status(400).json({ error: "Cannot book in the past" }); return; }

    // One booking per employee per day
    const [existing] = await db.select()
      .from(deskBookingsTable)
      .where(and(
        eq(deskBookingsTable.userId, userId),
        eq(deskBookingsTable.date, date),
        sql`${deskBookingsTable.status} NOT IN ('cancelled', 'expired')`
      )).limit(1);
    if (existing) { res.status(409).json({ error: "You already have a desk booking for this date" }); return; }

    // Check desk exists and is available
    const [desk] = await db.select().from(desksTable).where(eq(desksTable.id, deskId)).limit(1);
    if (!desk) { res.status(404).json({ error: "Desk not found" }); return; }
    if (desk.status === "maintenance") { res.status(400).json({ error: "Desk is under maintenance" }); return; }

    // Double booking prevention
    const [deskBooked] = await db.select()
      .from(deskBookingsTable)
      .where(and(
        eq(deskBookingsTable.deskId, deskId),
        eq(deskBookingsTable.date, date),
        sql`${deskBookingsTable.status} NOT IN ('cancelled', 'expired')`
      )).limit(1);
    if (deskBooked) { res.status(409).json({ error: "Desk is already booked for this date" }); return; }

    const [booking] = await db.insert(deskBookingsTable).values({ deskId, userId, date, status: "confirmed" }).returning();

    await createNotification(userId, "booking_confirmed",
      `Your desk booking for ${desk.name} on ${date} is confirmed.`);

    const full = await getBookingWithRelations(booking.id);
    res.status(201).json(formatBooking(full));
  } catch (err) {
    logger.error({ err }, "Create desk booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/desk-bookings/:id
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const booking = await getBookingWithRelations(id);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (req.user!.role !== "admin" && booking.userId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    res.json(formatBooking(booking));
  } catch (err) {
    logger.error({ err }, "Get desk booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/desk-bookings/:id/cancel
router.post("/:id/cancel", authenticate, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [booking] = await db.select().from(deskBookingsTable).where(eq(deskBookingsTable.id, id)).limit(1);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (req.user!.role !== "admin" && booking.userId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (booking.status !== "confirmed") {
      res.status(400).json({ error: "Only confirmed bookings can be cancelled" }); return;
    }

    // Cancellation cutoff: 9 AM on the day of booking
    const today = new Date().toISOString().slice(0, 10);
    if (booking.date === today) {
      const now = new Date();
      if (now.getHours() >= 9 && req.user!.role !== "admin") {
        res.status(400).json({ error: "Cancellation cutoff time (9:00 AM) has passed for today" }); return;
      }
    }

    const [updated] = await db.update(deskBookingsTable)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(deskBookingsTable.id, id))
      .returning();

    await createNotification(booking.userId, "booking_cancelled",
      `Your desk booking on ${booking.date} has been cancelled.`);

    const full = await getBookingWithRelations(updated.id);
    res.json(formatBooking(full));
  } catch (err) {
    logger.error({ err }, "Cancel desk booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/desk-bookings/:id/checkin
router.post("/:id/checkin", authenticate, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { qrCode } = req.body as { qrCode: string };
    if (!qrCode) { res.status(400).json({ error: "qrCode required" }); return; }

    const [booking] = await db.select().from(deskBookingsTable).where(eq(deskBookingsTable.id, id)).limit(1);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (req.user!.role !== "admin" && booking.userId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (booking.status !== "confirmed") {
      res.status(400).json({ error: "Can only check in for confirmed bookings" }); return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (booking.date !== today) {
      res.status(400).json({ error: "Can only check in on the day of the booking" }); return;
    }

    // Validate QR code
    const [desk] = await db.select().from(desksTable).where(eq(desksTable.id, booking.deskId)).limit(1);
    if (!desk || desk.qrCode !== qrCode) {
      res.status(400).json({ error: "Invalid QR code" }); return;
    }

    // Check-in deadline: 9:45 AM
    const now = new Date();
    if (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 45)) {
      res.status(400).json({ error: "Check-in deadline (9:45 AM) has passed" }); return;
    }

    const [updated] = await db.update(deskBookingsTable)
      .set({ status: "checked_in", checkedInAt: new Date() })
      .where(eq(deskBookingsTable.id, id))
      .returning();

    const full = await getBookingWithRelations(updated.id);
    res.json(formatBooking(full));
  } catch (err) {
    logger.error({ err }, "Check-in error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
