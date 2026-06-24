import { Router } from "express";
import { db, desksTable, meetingRoomsTable, usersTable, deskBookingsTable, meetingRoomBookingsTable, notificationsTable, maintenanceLogsTable } from "@workspace/db";
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

function dayKey(value: Date | string) {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function addDays(date: Date, offset: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + offset);
  return copy;
}

function buildDateRange(endDate: Date, days: number) {
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    dates.push(dayKey(addDays(endDate, -offset)));
  }
  return dates;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percent(part: number, total: number) {
  return total > 0 ? round((part / total) * 100, 2) : 0;
}

function trend(current: number, previous: number) {
  const delta = round(current - previous, 2);
  return {
    delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  return lines.join("\n");
}

async function loadAnalyticsContext() {
  const [users, desks, rooms, deskBookings, roomBookings, maintenanceLogs] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(desksTable),
    db.select().from(meetingRoomsTable),
    db.select().from(deskBookingsTable),
    db.select().from(meetingRoomBookingsTable),
    db.select().from(maintenanceLogsTable),
  ]);

  return {
    users,
    desks,
    rooms,
    deskBookings,
    roomBookings,
    maintenanceLogs,
    userById: new Map(users.map((user) => [user.id, user])),
    deskById: new Map(desks.map((desk) => [desk.id, desk])),
    roomById: new Map(rooms.map((room) => [room.id, room])),
  };
}

function bookingActivityTime(booking: {
  status: string;
  checkedInAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return booking.checkedInAt ?? booking.cancelledAt ?? booking.updatedAt ?? booking.createdAt;
}

router.get("/admin-dashboard", authenticate, requireRole("admin"), async (_req, res) => {
  try {
    const context = await loadAnalyticsContext();
    const today = new Date();
    const todayKey = dayKey(today);
    const yesterdayKey = dayKey(addDays(today, -1));
    const start30 = dayKey(addDays(today, -29));
    const start7 = dayKey(addDays(today, -6));

    const todaysDeskBookings = context.deskBookings.filter((booking) => booking.date === todayKey);
    const yesterdaysDeskBookings = context.deskBookings.filter((booking) => booking.date === yesterdayKey);
    const activeDeskBookingsToday = todaysDeskBookings.filter((booking) => booking.status === "confirmed" || booking.status === "checked_in");
    const activeDeskBookingsYesterday = yesterdaysDeskBookings.filter((booking) => booking.status === "confirmed" || booking.status === "checked_in");
    const checkedInToday = todaysDeskBookings.filter((booking) => booking.status === "checked_in");
    const checkedInYesterday = yesterdaysDeskBookings.filter((booking) => booking.status === "checked_in");

    const todaysRoomBookings = context.roomBookings.filter((booking) => dayKey(booking.startTime) === todayKey && booking.status === "confirmed");
    const yesterdaysRoomBookings = context.roomBookings.filter((booking) => dayKey(booking.startTime) === yesterdayKey && booking.status === "confirmed");

    const totalEmployees = context.users.filter((user) => user.isActive).length;
    const totalDesks = context.desks.length;
    const maintenanceDesks = context.desks.filter((desk) => desk.status === "maintenance").length;
    const bookedDeskIdsToday = new Set(activeDeskBookingsToday.map((booking) => booking.deskId));
    const availableDesks = Math.max(context.desks.filter((desk) => desk.status === "available").length - bookedDeskIdsToday.size, 0);
    const occupiedDesks = new Set(checkedInToday.map((booking) => booking.deskId)).size;
    const employeesCheckedInToday = new Set(checkedInToday.map((booking) => booking.userId)).size;
    const meetingRoomsOccupied = new Set(todaysRoomBookings.map((booking) => booking.roomId)).size;
    const occupancyRate = percent(occupiedDesks, totalDesks);

    const yesterdayBookedDeskIds = new Set(activeDeskBookingsYesterday.map((booking) => booking.deskId));
    const yesterdayAvailableDesks = Math.max(context.desks.filter((desk) => desk.status === "available").length - yesterdayBookedDeskIds.size, 0);
    const yesterdayOccupiedDesks = new Set(checkedInYesterday.map((booking) => booking.deskId)).size;
    const yesterdayEmployeesCheckedIn = new Set(checkedInYesterday.map((booking) => booking.userId)).size;
    const yesterdayMeetingRoomsOccupied = new Set(yesterdaysRoomBookings.map((booking) => booking.roomId)).size;
    const yesterdayOccupancyRate = percent(yesterdayOccupiedDesks, totalDesks);

    const deskUtilizationTrend = buildDateRange(today, 30).map((date) => {
      const dayBookings = context.deskBookings.filter((booking) => booking.date === date && (booking.status === "confirmed" || booking.status === "checked_in"));
      const occupied = new Set(dayBookings.map((booking) => booking.deskId)).size;
      return {
        date,
        occupiedDesks: occupied,
        occupancyRate: percent(occupied, totalDesks),
        activeBookings: dayBookings.length,
      };
    });

    const departmentTotals = new Map<string, number>();
    const departmentPresent = new Map<string, number>();
    for (const user of context.users) {
      if (!user.isActive) continue;
      const department = user.department?.trim() || "Unassigned";
      departmentTotals.set(department, (departmentTotals.get(department) ?? 0) + 1);
    }
    for (const booking of checkedInToday) {
      const user = context.userById.get(booking.userId);
      if (!user || !user.isActive) continue;
      const department = user.department?.trim() || "Unassigned";
      departmentPresent.set(department, (departmentPresent.get(department) ?? 0) + 1);
    }
    const departmentAttendance = [...departmentTotals.entries()]
      .map(([department, total]) => {
        const present = departmentPresent.get(department) ?? 0;
        return {
          department,
          totalEmployees: total,
          presentEmployees: present,
          attendanceRate: percent(present, total),
        };
      })
      .sort((a, b) => b.presentEmployees - a.presentEmployees || a.department.localeCompare(b.department));

    const meetingRoomUtilization = context.rooms
      .map((room) => {
        const bookings = context.roomBookings.filter((booking) => booking.roomId === room.id && booking.status === "confirmed" && dayKey(booking.startTime) >= start30 && dayKey(booking.startTime) <= todayKey);
        const bookedHours = bookings.reduce((sum, booking) => sum + (booking.endTime.getTime() - booking.startTime.getTime()) / 3_600_000, 0);
        return {
          roomId: room.id,
          roomName: room.name,
          floor: room.floor,
          capacity: room.capacity,
          bookingCount: bookings.length,
          bookedHours: round(bookedHours, 1),
          utilizationRate: percent(bookedHours, 30 * 8),
        };
      })
      .sort((a, b) => b.bookingCount - a.bookingCount || a.roomName.localeCompare(b.roomName));

    const weeklyBookingTrend = buildDateRange(today, 7).map((date) => {
      const deskBookings = context.deskBookings.filter((booking) => booking.date === date && (booking.status === "confirmed" || booking.status === "checked_in"));
      const roomBookings = context.roomBookings.filter((booking) => dayKey(booking.startTime) === date && booking.status === "confirmed");
      const checkIns = context.deskBookings.filter((booking) => booking.date === date && booking.status === "checked_in");
      const cancellations = context.deskBookings.filter((booking) => booking.date === date && booking.status === "cancelled");
      return {
        date,
        deskBookings: deskBookings.length,
        meetingRoomBookings: roomBookings.length,
        checkIns: checkIns.length,
        cancellations: cancellations.length,
      };
    });

    const recentActivity = [
      ...context.deskBookings
        .filter((booking) => booking.date >= start30)
        .map((booking) => {
          const user = context.userById.get(booking.userId);
          const desk = context.deskById.get(booking.deskId);
          return {
            activityType: "desk_booking",
            title:
              booking.status === "checked_in"
                ? "User checked in"
                : booking.status === "cancelled"
                  ? "Booking cancelled"
                  : booking.status === "expired"
                    ? "Booking expired"
                    : "Desk booked",
            summary: `${user?.name ?? "Unknown"} ${booking.status === "checked_in" ? "checked in to" : booking.status === "cancelled" ? "cancelled" : "booked"} ${desk?.name ?? "a desk"}`,
            actorName: user?.name ?? "Unknown",
            actorEmail: user?.email ?? "",
            subjectName: desk?.name ?? "",
            floor: desk?.floor ?? "",
            zone: desk?.zone ?? "",
            status: booking.status,
            activityAt: bookingActivityTime(booking).toISOString(),
          };
        }),
      ...context.roomBookings
        .filter((booking) => dayKey(booking.startTime) >= start30)
        .map((booking) => {
          const user = context.userById.get(booking.userId);
          const room = context.roomById.get(booking.roomId);
          return {
            activityType: "meeting_room",
            title: booking.status === "cancelled" ? "Meeting cancelled" : "Meeting room reserved",
            summary: `${user?.name ?? "Unknown"} reserved ${room?.name ?? "a room"} for ${booking.title}`,
            actorName: user?.name ?? "Unknown",
            actorEmail: user?.email ?? "",
            subjectName: room?.name ?? "",
            floor: room?.floor ?? "",
            zone: "",
            status: booking.status,
            activityAt: booking.updatedAt.toISOString(),
          };
        }),
      ...context.maintenanceLogs
        .filter((log) => dayKey(log.createdAt) >= start30)
        .map((log) => {
          const user = context.userById.get(log.performedBy);
          const desk = context.deskById.get(log.deskId);
          return {
            activityType: "maintenance",
            title: log.action === "restored" ? "Desk restored" : "Desk marked under maintenance",
            summary: `${user?.name ?? "Unknown"} updated ${desk?.name ?? "a desk"} maintenance status`,
            actorName: user?.name ?? "Unknown",
            actorEmail: user?.email ?? "",
            subjectName: desk?.name ?? "",
            floor: desk?.floor ?? "",
            zone: desk?.zone ?? "",
            status: log.action,
            activityAt: log.createdAt.toISOString(),
          };
        }),
    ]
      .sort((a, b) => b.activityAt.localeCompare(a.activityAt))
      .slice(0, 25);

    const maintenanceActivities = context.maintenanceLogs
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((log) => {
        const user = context.userById.get(log.performedBy);
        const desk = context.deskById.get(log.deskId);
        return {
          id: log.id,
          deskId: log.deskId,
          deskName: desk?.name ?? "",
          action: log.action,
          reason: log.reason,
          performedBy: user?.name ?? "Unknown",
          department: user?.department ?? "",
          createdAt: log.createdAt.toISOString(),
        };
      });

    const activeUsersThisWeek = new Set([
      ...context.deskBookings.filter((booking) => booking.date >= start7 && booking.date <= todayKey && (booking.status === "confirmed" || booking.status === "checked_in")).map((booking) => booking.userId),
      ...context.roomBookings.filter((booking) => dayKey(booking.startTime) >= start7 && dayKey(booking.startTime) <= todayKey && booking.status === "confirmed").map((booking) => booking.userId),
    ]).size;

    const topVisitors = new Map<number, number>();
    for (const booking of context.deskBookings) {
      if (booking.date < start30 || booking.date > todayKey) continue;
      if (booking.status !== "confirmed" && booking.status !== "checked_in") continue;
      topVisitors.set(booking.userId, (topVisitors.get(booking.userId) ?? 0) + 1);
    }
    for (const booking of context.roomBookings) {
      const date = dayKey(booking.startTime);
      if (date < start30 || date > todayKey) continue;
      if (booking.status !== "confirmed") continue;
      topVisitors.set(booking.userId, (topVisitors.get(booking.userId) ?? 0) + 1);
    }
    const mostFrequentVisitors = [...topVisitors.entries()]
      .map(([userId, visits]) => {
        const user = context.userById.get(userId);
        return {
          userId,
          name: user?.name ?? "Unknown",
          email: user?.email ?? "",
          department: user?.department ?? "Unassigned",
          visits,
        };
      })
      .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name))
      .slice(0, 5);

    const deskUsageByDesk = new Map<number, number>();
    const deskCheckInsByDesk = new Map<number, number>();
    const deskCancellationsByDesk = new Map<number, number>();
    for (const booking of context.deskBookings.filter((booking) => booking.date >= start30 && booking.date <= todayKey && (booking.status === "confirmed" || booking.status === "checked_in"))) {
      deskUsageByDesk.set(booking.deskId, (deskUsageByDesk.get(booking.deskId) ?? 0) + 1);
    }
    for (const booking of context.deskBookings.filter((booking) => booking.date >= start30 && booking.date <= todayKey && booking.status === "checked_in")) {
      deskCheckInsByDesk.set(booking.deskId, (deskCheckInsByDesk.get(booking.deskId) ?? 0) + 1);
    }
    for (const booking of context.deskBookings.filter((booking) => booking.date >= start30 && booking.date <= todayKey && booking.status === "cancelled")) {
      deskCancellationsByDesk.set(booking.deskId, (deskCancellationsByDesk.get(booking.deskId) ?? 0) + 1);
    }

    const topDeskEntry = [...deskUsageByDesk.entries()].sort((a, b) => b[1] - a[1])[0];
    const mostUsedDesk = topDeskEntry ? context.deskById.get(topDeskEntry[0]) : undefined;

    const attendanceByDay = buildDateRange(today, 30).map((date) => ({
      date,
      attendees: new Set(context.deskBookings.filter((booking) => booking.date === date && booking.status === "checked_in").map((booking) => booking.userId)).size,
    }));
    const peakAttendanceDay = attendanceByDay.slice().sort((a, b) => b.attendees - a.attendees || a.date.localeCompare(b.date))[0];

    const zoneStats = context.desks.reduce<Map<string, { desks: number; bookings: number }>>((acc, desk) => {
      const zone = desk.zone?.trim() || "Unassigned";
      const current = acc.get(zone) ?? { desks: 0, bookings: 0 };
      current.desks += 1;
      current.bookings += context.deskBookings.filter((booking) => booking.deskId === desk.id && booking.date >= start30 && booking.date <= todayKey && (booking.status === "confirmed" || booking.status === "checked_in")).length;
      acc.set(zone, current);
      return acc;
    }, new Map());
    const leastUtilizedZoneEntry = [...zoneStats.entries()]
      .map(([zone, value]) => ({
        zone,
        rate: percent(value.bookings, value.desks * 30),
      }))
      .sort((a, b) => a.rate - b.rate || a.zone.localeCompare(b.zone))[0];

    const mostDemandedRoom = meetingRoomUtilization[0];
    const recentOccupancyAverage = round(
      deskUtilizationTrend.slice(-7).reduce((sum, point) => sum + point.occupancyRate, 0) / Math.max(deskUtilizationTrend.slice(-7).length, 1),
      2,
    );
    const previousOccupancyAverage = round(
      deskUtilizationTrend.slice(-14, -7).reduce((sum, point) => sum + point.occupancyRate, 0) / Math.max(deskUtilizationTrend.slice(-14, -7).length, 1),
      2,
    );

    const smartInsights = [
      {
        key: "most_used_desk",
        title: "Most used desk",
        detail: `${mostUsedDesk?.name ?? "N/A"} leads desk demand over the last 30 days.`,
      },
      {
        key: "peak_attendance_day",
        title: "Peak attendance day",
        detail: `${peakAttendanceDay?.date ?? "N/A"} had the highest in-office attendance.`,
      },
      {
        key: "least_utilized_area",
        title: "Least utilized area",
        detail: `${leastUtilizedZoneEntry?.zone ?? "N/A"} is the quietest area and a candidate for repurposing.`,
      },
      {
        key: "meeting_room_demand",
        title: "Meeting room demand",
        detail: `${mostDemandedRoom?.roomName ?? "N/A"} has the strongest meeting room demand.`,
      },
      {
        key: "occupancy_trend",
        title: "Occupancy trend",
        detail: `${recentOccupancyAverage >= previousOccupancyAverage ? "Occupancy is up" : "Occupancy is down"} ${Math.abs(round(recentOccupancyAverage - previousOccupancyAverage, 2))}% week over week.`,
      },
    ];

    res.json({
      overview: {
        totalEmployees,
        totalDesks,
        activeBookingsToday: activeDeskBookingsToday.length,
        availableDesks,
        occupiedDesks,
        desksUnderMaintenance: maintenanceDesks,
        employeesCheckedInToday,
        meetingRoomsOccupied,
        occupancyRate,
      },
      cards: [
        { key: "totalEmployees", label: "Total Employees", value: totalEmployees, icon: "users", trend: trend(totalEmployees, totalEmployees) },
        { key: "totalDesks", label: "Total Desks", value: totalDesks, icon: "layout-grid", trend: trend(totalDesks, totalDesks) },
        { key: "activeBookingsToday", label: "Active Bookings Today", value: activeDeskBookingsToday.length, icon: "calendar-days", trend: trend(activeDeskBookingsToday.length, activeDeskBookingsYesterday.length) },
        { key: "availableDesks", label: "Available Desks", value: availableDesks, icon: "circle-check-big", trend: trend(availableDesks, yesterdayAvailableDesks) },
        { key: "occupiedDesks", label: "Occupied Desks", value: occupiedDesks, icon: "user-check", trend: trend(occupiedDesks, yesterdayOccupiedDesks) },
        { key: "desksUnderMaintenance", label: "Desks Under Maintenance", value: maintenanceDesks, icon: "wrench", trend: trend(maintenanceDesks, maintenanceDesks) },
        { key: "employeesCheckedInToday", label: "Employees Checked In Today", value: employeesCheckedInToday, icon: "badge-check", trend: trend(employeesCheckedInToday, yesterdayEmployeesCheckedIn) },
        { key: "meetingRoomsOccupied", label: "Meeting Rooms Occupied", value: meetingRoomsOccupied, icon: "panel-top", trend: trend(meetingRoomsOccupied, yesterdayMeetingRoomsOccupied) },
        { key: "occupancyRate", label: "Occupancy Rate", value: occupancyRate, suffix: "%", icon: "gauge", trend: trend(occupancyRate, yesterdayOccupancyRate) },
      ],
      deskUtilizationTrend,
      departmentAttendance,
      meetingRoomUtilization,
      weeklyBookingTrend,
      recentActivity,
      officeStatus: {
        totalDesks,
        bookedDesks: activeDeskBookingsToday.length,
        availableDesks,
        maintenanceDesks,
        occupancyPercentage: occupancyRate,
      },
      maintenance: {
        totalMaintenanceRequests: context.maintenanceLogs.length,
        openRequests: maintenanceDesks,
        completedRequests: context.maintenanceLogs.filter((log) => log.action === "restored").length,
        desksCurrentlyUnavailable: maintenanceDesks,
        recentActivities: maintenanceActivities,
      },
      userAnalytics: {
        totalEmployees,
        activeUsersThisWeek,
        employeesCheckedInToday,
        mostFrequentOfficeVisitors: mostFrequentVisitors,
        departmentAttendance,
      },
      smartInsights,
      reports: {
        deskUtilization: context.desks.map((desk) => {
          const bookings = context.deskBookings.filter((booking) => booking.deskId === desk.id && booking.date >= start30 && booking.date <= todayKey);
          const activeBookings = bookings.filter((booking) => booking.status === "confirmed" || booking.status === "checked_in");
          const checkIns = bookings.filter((booking) => booking.status === "checked_in").length;
          const cancellations = bookings.filter((booking) => booking.status === "cancelled").length;
          return {
            deskId: desk.id,
            deskName: desk.name,
            floor: desk.floor,
            zone: desk.zone,
            totalBookings: activeBookings.length,
            checkIns,
            cancellations,
            utilizationRate: percent(activeBookings.length, 30),
          };
        }).sort((a, b) => b.totalBookings - a.totalBookings || a.deskName.localeCompare(b.deskName)),
        attendance: buildDateRange(today, 30).flatMap((date) => {
          const byDepartment = new Map<string, number>();
          for (const booking of context.deskBookings.filter((entry) => entry.date === date && entry.status === "checked_in")) {
            const user = context.userById.get(booking.userId);
            const department = user?.department?.trim() || "Unassigned";
            byDepartment.set(department, (byDepartment.get(department) ?? 0) + 1);
          }
          return [...byDepartment.entries()].map(([department, presentEmployees]) => ({
            date,
            department,
            presentEmployees,
          }));
        }),
        meetingRoomUsage: meetingRoomUtilization,
        maintenance: context.maintenanceLogs
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((log) => {
            const user = context.userById.get(log.performedBy);
            const desk = context.deskById.get(log.deskId);
            return {
              id: log.id,
              deskId: log.deskId,
              deskName: desk?.name ?? "",
              floor: desk?.floor ?? "",
              zone: desk?.zone ?? "",
              action: log.action,
              reason: log.reason,
              performedBy: user?.name ?? "Unknown",
              department: user?.department ?? "",
              createdAt: log.createdAt.toISOString(),
            };
          }),
      },
    });
  } catch (err) {
    logger.error({ err }, "Admin dashboard analytics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/reports/:reportType", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const reportType = req.params.reportType;
    const format = String(req.query.format ?? "json").toLowerCase();
    const context = await loadAnalyticsContext();
    const today = new Date();
    const todayKey = dayKey(today);
    const start30 = dayKey(addDays(today, -29));

    let rows: Array<Record<string, unknown>> = [];

    if (reportType === "desk-utilization") {
      rows = context.desks.map((desk) => {
        const bookings = context.deskBookings.filter((booking) => booking.deskId === desk.id && booking.date >= start30 && booking.date <= todayKey);
        const activeBookings = bookings.filter((booking) => booking.status === "confirmed" || booking.status === "checked_in");
        return {
          deskId: desk.id,
          deskName: desk.name,
          floor: desk.floor,
          zone: desk.zone,
          totalBookings: activeBookings.length,
          checkIns: bookings.filter((booking) => booking.status === "checked_in").length,
          cancellations: bookings.filter((booking) => booking.status === "cancelled").length,
          utilizationRate: percent(activeBookings.length, 30),
        };
      });
    } else if (reportType === "attendance") {
      rows = buildDateRange(today, 30).flatMap((date) => {
        const byDepartment = new Map<string, number>();
        for (const booking of context.deskBookings.filter((entry) => entry.date === date && entry.status === "checked_in")) {
          const user = context.userById.get(booking.userId);
          const department = user?.department?.trim() || "Unassigned";
          byDepartment.set(department, (byDepartment.get(department) ?? 0) + 1);
        }
        return [...byDepartment.entries()].map(([department, presentEmployees]) => ({
          date,
          department,
          presentEmployees,
        }));
      });
    } else if (reportType === "meeting-room-usage") {
      rows = context.rooms.map((room) => {
        const bookings = context.roomBookings.filter((booking) => booking.roomId === room.id && booking.status === "confirmed" && dayKey(booking.startTime) >= start30 && dayKey(booking.startTime) <= todayKey);
        const bookedHours = bookings.reduce((sum, booking) => sum + (booking.endTime.getTime() - booking.startTime.getTime()) / 3_600_000, 0);
        return {
          roomId: room.id,
          roomName: room.name,
          floor: room.floor,
          capacity: room.capacity,
          bookingCount: bookings.length,
          bookedHours: round(bookedHours, 1),
          utilizationRate: percent(bookedHours, 30 * 8),
        };
      });
    } else if (reportType === "maintenance") {
      rows = context.maintenanceLogs
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((log) => {
          const user = context.userById.get(log.performedBy);
          const desk = context.deskById.get(log.deskId);
          return {
            id: log.id,
            createdAt: log.createdAt.toISOString(),
            deskId: log.deskId,
            deskName: desk?.name ?? "",
            floor: desk?.floor ?? "",
            zone: desk?.zone ?? "",
            action: log.action,
            reason: log.reason,
            performedBy: user?.name ?? "Unknown",
            department: user?.department ?? "",
          };
        });
    } else {
      res.status(404).json({ error: "Unknown report type" });
      return;
    }

    if (format === "csv") {
      const csv = toCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${reportType}.csv"`);
      res.send(csv);
      return;
    }

    res.json({ reportType, rows });
  } catch (err) {
    logger.error({ err }, "Report export error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
