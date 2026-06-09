import { Router } from "express";
import { db, meetingRoomBookingsTable, meetingRoomsTable, usersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { logger } from "../lib/logger";

const router = Router();

const formatBooking = (b: any) => ({
  id: b.id,
  roomId: b.roomId,
  userId: b.userId,
  title: b.title,
  description: b.description,
  startTime: b.startTime,
  endTime: b.endTime,
  status: b.status,
  attendees: b.attendees,
  createdAt: b.createdAt,
  room: b.room ? {
    id: b.room.id,
    name: b.room.name,
    capacity: b.room.capacity,
    floor: b.room.floor,
    status: b.room.status,
    facilities: b.room.facilities,
    description: b.room.description,
    createdAt: b.room.createdAt,
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
    .from(meetingRoomBookingsTable)
    .leftJoin(meetingRoomsTable, eq(meetingRoomBookingsTable.roomId, meetingRoomsTable.id))
    .leftJoin(usersTable, eq(meetingRoomBookingsTable.userId, usersTable.id))
    .where(eq(meetingRoomBookingsTable.id, id))
    .limit(1);
  if (!rows[0]) return null;
  const r = rows[0];
  return { ...r.meeting_room_bookings, room: r.meeting_rooms, user: r.users };
}

// GET /api/meeting-room-bookings
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId, date, userId, page = "1", limit = "20" } = req.query as {
      roomId?: string; date?: string; userId?: string; page?: string; limit?: string;
    };
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (req.user!.role !== "admin") {
      conditions.push(eq(meetingRoomBookingsTable.userId, req.user!.id));
    } else if (userId) {
      conditions.push(eq(meetingRoomBookingsTable.userId, parseInt(userId)));
    }
    if (roomId) conditions.push(eq(meetingRoomBookingsTable.roomId, parseInt(roomId)));
    if (date) {
      conditions.push(sql`DATE(${meetingRoomBookingsTable.startTime}) = ${date}`);
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(meetingRoomBookingsTable)
      .leftJoin(meetingRoomsTable, eq(meetingRoomBookingsTable.roomId, meetingRoomsTable.id))
      .leftJoin(usersTable, eq(meetingRoomBookingsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(meetingRoomBookingsTable.startTime))
      .limit(limitNum)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(meetingRoomBookingsTable)
      .where(whereClause);

    const data = rows.map(r => formatBooking({ ...r.meeting_room_bookings, room: r.meeting_rooms, user: r.users }));
    res.json({ data, total: count, page: pageNum, limit: limitNum });
  } catch (err) {
    logger.error({ err }, "List meeting room bookings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/meeting-room-bookings
router.post("/", authenticate, requireRole("admin", "team_lead"), async (req: AuthRequest, res) => {
  try {
    const { roomId, title, description, startTime, endTime, attendees } = req.body as {
      roomId: number; title: string; description?: string; startTime: string; endTime: string; attendees?: string;
    };
    if (!roomId || !title || !startTime || !endTime) {
      res.status(400).json({ error: "roomId, title, startTime, endTime required" }); return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (start >= end) { res.status(400).json({ error: "endTime must be after startTime" }); return; }

    // Check room exists
    const [room] = await db.select().from(meetingRoomsTable).where(eq(meetingRoomsTable.id, roomId)).limit(1);
    if (!room) { res.status(404).json({ error: "Meeting room not found" }); return; }
    if (room.status === "maintenance") { res.status(400).json({ error: "Room is under maintenance" }); return; }

    // Conflict detection
    const [conflict] = await db.select()
      .from(meetingRoomBookingsTable)
      .where(and(
        eq(meetingRoomBookingsTable.roomId, roomId),
        eq(meetingRoomBookingsTable.status, "confirmed"),
        sql`${meetingRoomBookingsTable.startTime} < ${endTime} AND ${meetingRoomBookingsTable.endTime} > ${startTime}`
      )).limit(1);
    if (conflict) { res.status(409).json({ error: "Room is already booked during this time" }); return; }

    const [booking] = await db.insert(meetingRoomBookingsTable).values({
      roomId,
      userId: req.user!.id,
      title,
      description,
      startTime: start,
      endTime: end,
      attendees,
      status: "confirmed",
    }).returning();

    await createNotification(req.user!.id, "booking_confirmed",
      `Meeting room "${room.name}" booked for "${title}" on ${start.toLocaleDateString()}.`);

    const full = await getBookingWithRelations(booking.id);
    res.status(201).json(formatBooking(full));
  } catch (err) {
    logger.error({ err }, "Create meeting room booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/meeting-room-bookings/:id
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
    logger.error({ err }, "Get meeting room booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/meeting-room-bookings/:id
router.patch("/:id", authenticate, requireRole("admin", "team_lead"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [booking] = await db.select().from(meetingRoomBookingsTable).where(eq(meetingRoomBookingsTable.id, id)).limit(1);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (req.user!.role !== "admin" && booking.userId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }

    const { title, description, startTime, endTime, attendees } = req.body as {
      title?: string; description?: string; startTime?: string; endTime?: string; attendees?: string;
    };
    const updateData: Partial<typeof meetingRoomBookingsTable.$inferInsert> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (attendees !== undefined) updateData.attendees = attendees;

    const [updated] = await db.update(meetingRoomBookingsTable).set(updateData).where(eq(meetingRoomBookingsTable.id, id)).returning();
    const full = await getBookingWithRelations(updated.id);
    res.json(formatBooking(full));
  } catch (err) {
    logger.error({ err }, "Update meeting room booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/meeting-room-bookings/:id/cancel
router.post("/:id/cancel", authenticate, requireRole("admin", "team_lead"), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [booking] = await db.select().from(meetingRoomBookingsTable).where(eq(meetingRoomBookingsTable.id, id)).limit(1);
    if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }
    if (req.user!.role !== "admin" && booking.userId !== req.user!.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (booking.status !== "confirmed") {
      res.status(400).json({ error: "Only confirmed bookings can be cancelled" }); return;
    }
    const [updated] = await db.update(meetingRoomBookingsTable)
      .set({ status: "cancelled" })
      .where(eq(meetingRoomBookingsTable.id, id))
      .returning();

    await createNotification(booking.userId, "booking_cancelled",
      `Your meeting room booking "${booking.title}" has been cancelled.`);

    const full = await getBookingWithRelations(updated.id);
    res.json(formatBooking(full));
  } catch (err) {
    logger.error({ err }, "Cancel meeting room booking error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
