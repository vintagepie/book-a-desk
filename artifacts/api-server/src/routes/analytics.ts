import { Router } from "express";
import { db, desksTable, meetingRoomsTable, usersTable, deskBookingsTable, meetingRoomBookingsTable, notificationsTable } from "@workspace/db";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/analytics/overview
router.get("/overview", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const today = new Date().toISOString().slice(0, 10);

    const [{ totalDesks }] = await db.select({ totalDesks: sql<number>`count(*)::int` }).from(desksTable);
    const [{ totalRooms }] = await db.select({ totalRooms: sql<number>`count(*)::int` }).from(meetingRoomsTable);
    const [{ totalUsers }] = await db.select({ totalUsers: sql<number>`count(*)::int` }).from(usersTable);
    const [{ maintenanceDesks }] = await db.select({ maintenanceDesks: sql<number>`count(*)::int` }).from(desksTable).where(eq(desksTable.status, "maintenance"));

    const [{ todayDeskBookings }] = await db.select({ todayDeskBookings: sql<number>`count(*)::int` })
      .from(deskBookingsTable)
      .where(and(eq(deskBookingsTable.date, today), sql`${deskBookingsTable.status} NOT IN ('cancelled', 'expired')`));

    const [{ todayRoomBookings }] = await db.select({ todayRoomBookings: sql<number>`count(*)::int` })
      .from(meetingRoomBookingsTable)
      .where(and(
        sql`DATE(${meetingRoomBookingsTable.startTime}) = ${today}`,
        eq(meetingRoomBookingsTable.status, "confirmed")
      ));

    const occupancyRate = totalDesks > 0 ? Math.round((todayDeskBookings / totalDesks) * 100) / 100 : 0;

    const [{ checkedIn }] = await db.select({ checkedIn: sql<number>`count(*)::int` })
      .from(deskBookingsTable)
      .where(and(eq(deskBookingsTable.date, today), eq(deskBookingsTable.status, "checked_in")));

    const checkInRate = todayDeskBookings > 0 ? Math.round((checkedIn / todayDeskBookings) * 100) / 100 : 0;

    res.json({ totalDesks, totalRooms, totalUsers, todayDeskBookings, todayRoomBookings, occupancyRate, checkInRate, maintenanceDesks });
  } catch (err) {
    logger.error({ err }, "Analytics overview error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/analytics/desk-utilization
router.get("/desk-utilization", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);

    const desks = await db.select().from(desksTable).orderBy(desksTable.name);
    const totalDays = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const result = await Promise.all(desks.map(async (desk) => {
      const [{ totalBookings }] = await db.select({ totalBookings: sql<number>`count(*)::int` })
        .from(deskBookingsTable)
        .where(and(
          eq(deskBookingsTable.deskId, desk.id),
          sql`${deskBookingsTable.date} >= ${start}`,
          sql`${deskBookingsTable.date} <= ${end}`,
          sql`${deskBookingsTable.status} NOT IN ('cancelled', 'expired')`
        ));

      const [{ checkIns }] = await db.select({ checkIns: sql<number>`count(*)::int` })
        .from(deskBookingsTable)
        .where(and(eq(deskBookingsTable.deskId, desk.id), eq(deskBookingsTable.status, "checked_in"), sql`${deskBookingsTable.date} >= ${start}`, sql`${deskBookingsTable.date} <= ${end}`));

      const [{ cancellations }] = await db.select({ cancellations: sql<number>`count(*)::int` })
        .from(deskBookingsTable)
        .where(and(eq(deskBookingsTable.deskId, desk.id), eq(deskBookingsTable.status, "cancelled"), sql`${deskBookingsTable.date} >= ${start}`, sql`${deskBookingsTable.date} <= ${end}`));

      const utilizationRate = Math.round((totalBookings / Math.max(totalDays, 1)) * 100) / 100;

      return {
        deskId: desk.id,
        deskName: desk.name,
        floor: desk.floor,
        totalBookings,
        checkIns,
        cancellations,
        utilizationRate,
      };
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Desk utilization error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/analytics/room-utilization
router.get("/room-utilization", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);

    const rooms = await db.select().from(meetingRoomsTable).orderBy(meetingRoomsTable.name);

    const result = await Promise.all(rooms.map(async (room) => {
      const bookings = await db.select()
        .from(meetingRoomBookingsTable)
        .where(and(
          eq(meetingRoomBookingsTable.roomId, room.id),
          eq(meetingRoomBookingsTable.status, "confirmed"),
          sql`DATE(${meetingRoomBookingsTable.startTime}) >= ${start}`,
          sql`DATE(${meetingRoomBookingsTable.startTime}) <= ${end}`
        ));

      const totalHours = bookings.reduce((sum, b) => {
        const duration = (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / (1000 * 60 * 60);
        return sum + duration;
      }, 0);

      const totalDays = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const maxHours = totalDays * 8; // 8 working hours per day
      const utilizationRate = Math.round((totalHours / Math.max(maxHours, 1)) * 100) / 100;

      return {
        roomId: room.id,
        roomName: room.name,
        floor: room.floor,
        capacity: room.capacity,
        totalBookings: bookings.length,
        totalHours: Math.round(totalHours * 10) / 10,
        utilizationRate,
      };
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Room utilization error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/analytics/daily-occupancy
router.get("/daily-occupancy", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const start = startDate || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);

    const [{ totalDesks }] = await db.select({ totalDesks: sql<number>`count(*)::int` }).from(desksTable);

    // Generate date range
    const dates: string[] = [];
    let current = new Date(start);
    const endDate2 = new Date(end);
    while (current <= endDate2) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    const result = await Promise.all(dates.map(async (date) => {
      const [{ deskBookings }] = await db.select({ deskBookings: sql<number>`count(*)::int` })
        .from(deskBookingsTable)
        .where(and(eq(deskBookingsTable.date, date), sql`${deskBookingsTable.status} NOT IN ('cancelled', 'expired')`));

      const [{ roomBookings }] = await db.select({ roomBookings: sql<number>`count(*)::int` })
        .from(meetingRoomBookingsTable)
        .where(and(
          sql`DATE(${meetingRoomBookingsTable.startTime}) = ${date}`,
          eq(meetingRoomBookingsTable.status, "confirmed")
        ));

      const occupancyRate = totalDesks > 0 ? Math.round((deskBookings / totalDesks) * 100) / 100 : 0;

      return { date, deskBookings, roomBookings, occupancyRate };
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Daily occupancy error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/dashboard/summary
router.get("/summary", authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().slice(0, 10);

    // Today's desk booking
    const todayBookingRows = await db
      .select()
      .from(deskBookingsTable)
      .leftJoin(desksTable, eq(deskBookingsTable.deskId, desksTable.id))
      .where(and(
        eq(deskBookingsTable.userId, userId),
        eq(deskBookingsTable.date, today),
        sql`${deskBookingsTable.status} NOT IN ('cancelled', 'expired')`
      )).limit(1);

    const todayBooking = todayBookingRows[0] ? {
      ...todayBookingRows[0].desk_bookings,
      desk: todayBookingRows[0].desks ? {
        id: todayBookingRows[0].desks.id,
        name: todayBookingRows[0].desks.name,
        floor: todayBookingRows[0].desks.floor,
        zone: todayBookingRows[0].desks.zone,
        status: todayBookingRows[0].desks.status,
        amenities: todayBookingRows[0].desks.amenities,
        qrCode: todayBookingRows[0].desks.qrCode,
        isAvailable: false,
        createdAt: todayBookingRows[0].desks.createdAt,
      } : undefined,
    } : null;

    // Upcoming meetings (team lead)
    const upcomingMeetingRows = await db
      .select()
      .from(meetingRoomBookingsTable)
      .leftJoin(meetingRoomsTable, eq(meetingRoomBookingsTable.roomId, meetingRoomsTable.id))
      .where(and(
        eq(meetingRoomBookingsTable.userId, userId),
        eq(meetingRoomBookingsTable.status, "confirmed"),
        sql`${meetingRoomBookingsTable.startTime} >= NOW()`
      ))
      .orderBy(meetingRoomBookingsTable.startTime)
      .limit(5);

    const upcomingMeetings = upcomingMeetingRows.map(r => ({
      ...r.meeting_room_bookings,
      room: r.meeting_rooms ? {
        id: r.meeting_rooms.id,
        name: r.meeting_rooms.name,
        capacity: r.meeting_rooms.capacity,
        floor: r.meeting_rooms.floor,
        status: r.meeting_rooms.status,
        facilities: r.meeting_rooms.facilities,
        description: r.meeting_rooms.description,
        createdAt: r.meeting_rooms.createdAt,
      } : undefined,
    }));

    // Recent bookings
    const recentBookingRows = await db
      .select()
      .from(deskBookingsTable)
      .leftJoin(desksTable, eq(deskBookingsTable.deskId, desksTable.id))
      .where(eq(deskBookingsTable.userId, userId))
      .orderBy(desc(deskBookingsTable.createdAt))
      .limit(5);

    const recentBookings = recentBookingRows.map(r => ({
      ...r.desk_bookings,
      desk: r.desks ? {
        id: r.desks.id,
        name: r.desks.name,
        floor: r.desks.floor,
        zone: r.desks.zone,
        status: r.desks.status,
        amenities: r.desks.amenities,
        qrCode: r.desks.qrCode,
        isAvailable: false,
        createdAt: r.desks.createdAt,
      } : undefined,
    }));

    // Unread notifications
    const [{ unreadNotifications }] = await db.select({ unreadNotifications: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));

    // Available desks today
    const bookedToday = await db.select({ deskId: deskBookingsTable.deskId })
      .from(deskBookingsTable)
      .where(and(eq(deskBookingsTable.date, today), sql`${deskBookingsTable.status} NOT IN ('cancelled', 'expired')`));
    const bookedIds = new Set(bookedToday.map(b => b.deskId));

    const allAvailableDesks = await db.select()
      .from(desksTable)
      .where(eq(desksTable.status, "available"));
    const availableDesksToday = allAvailableDesks.filter(d => !bookedIds.has(d.id)).length;

    res.json({
      todayBooking,
      upcomingMeetings,
      recentBookings,
      unreadNotifications,
      availableDesksToday,
    });
  } catch (err) {
    logger.error({ err }, "Dashboard summary error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
