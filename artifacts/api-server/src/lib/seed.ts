import { db, usersTable, desksTable, meetingRoomsTable, deskBookingsTable, meetingRoomBookingsTable, notificationsTable, maintenanceLogsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";

// 70 workplaces + 6 middle-area desks
// Row 1: W001–W008  (8 desks, wall-facing, top)
// Row 2: W009–W024  (16 desks, 8 facing 8)
// Row 3: W025–W040  (16 desks, 8 facing 8)
// Row 4: W041–W056  (16 desks, 8 facing 8)
// Row 5: W057–W064  (8 desks, wall-facing, bottom)
// Middle: W065–W070 (6 desks beside meeting rooms, 3 facing 3)
// Meeting rooms: MR-01, MR-02

function qr() { return `QR-${uuidv4().toUpperCase().slice(0, 8)}`; }

function makeDesks() {
  const desks: { name: string; floor: string; zone: string; amenities: string; qrCode: string }[] = [];

  // Row 1: W001–W008
  for (let i = 1; i <= 8; i++) {
    desks.push({ name: `W${String(i).padStart(3, "0")}`, floor: "Floor 1", zone: "Row 1", amenities: "Standard desk, 1 monitor", qrCode: qr() });
  }
  // Row 2: W009–W024
  for (let i = 9; i <= 24; i++) {
    desks.push({ name: `W${String(i).padStart(3, "0")}`, floor: "Floor 1", zone: "Row 2", amenities: "Standard desk, 2 monitors", qrCode: qr() });
  }
  // Row 3: W025–W040
  for (let i = 25; i <= 40; i++) {
    desks.push({ name: `W${String(i).padStart(3, "0")}`, floor: "Floor 1", zone: "Row 3", amenities: "Standard desk, 2 monitors", qrCode: qr() });
  }
  // Row 4: W041–W056
  for (let i = 41; i <= 56; i++) {
    desks.push({ name: `W${String(i).padStart(3, "0")}`, floor: "Floor 1", zone: "Row 4", amenities: "Standard desk, 2 monitors", qrCode: qr() });
  }
  // Row 5: W057–W064
  for (let i = 57; i <= 64; i++) {
    desks.push({ name: `W${String(i).padStart(3, "0")}`, floor: "Floor 1", zone: "Row 5", amenities: "Standing desk, 1 monitor", qrCode: qr() });
  }
  // Middle area W065–W070
  for (let i = 65; i <= 70; i++) {
    desks.push({ name: `W${String(i).padStart(3, "0")}`, floor: "Floor 1", zone: "Middle Area", amenities: "Compact desk, 1 monitor", qrCode: qr() });
  }

  return desks;
}

export async function seedDatabase() {
  try {
    const existing = await db.select().from(usersTable).limit(1);
    if (existing.length > 0) {
      logger.info("Database already seeded, skipping");
      return;
    }

    logger.info("Seeding database with new floor layout...");
    const hash = (p: string) => bcrypt.hash(p, 12);

    // ── Users ──────────────────────────────────────────────────
    const [admin] = await db.insert(usersTable).values({ email: "admin@company.com", name: "Alex Admin", passwordHash: await hash("admin123"), role: "admin", department: "IT" }).returning();
    const [teamlead] = await db.insert(usersTable).values({ email: "lead@company.com", name: "Sam Lead", passwordHash: await hash("lead123"), role: "team_lead", department: "Engineering" }).returning();
    const [employee1] = await db.insert(usersTable).values({ email: "jane@company.com", name: "Jane Doe", passwordHash: await hash("pass123"), role: "employee", department: "Marketing" }).returning();
    const [employee2] = await db.insert(usersTable).values({ email: "john@company.com", name: "John Smith", passwordHash: await hash("pass123"), role: "employee", department: "Engineering" }).returning();
    const [employee3] = await db.insert(usersTable).values({ email: "emily@company.com", name: "Emily Chen", passwordHash: await hash("pass123"), role: "employee", department: "Design" }).returning();
    const [employee4] = await db.insert(usersTable).values({ email: "mike@company.com", name: "Mike Torres", passwordHash: await hash("pass123"), role: "employee", department: "Sales" }).returning();

    // ── Desks ──────────────────────────────────────────────────
    const deskRows = makeDesks();
    const desks = await db.insert(desksTable).values(deskRows).returning();

    // Put a handful under maintenance
    const maintenanceIdxs = [2, 15, 38, 52]; // W003, W016, W039, W053
    for (const idx of maintenanceIdxs) {
      await db.update(desksTable).set({ status: "maintenance" }).where(
        (await import("drizzle-orm")).eq(desksTable.id, desks[idx].id)
      );
      await db.insert(maintenanceLogsTable).values({ deskId: desks[idx].id, action: "marked_maintenance", reason: "Scheduled equipment replacement", performedBy: admin.id });
    }

    // ── Meeting rooms ──────────────────────────────────────────
    const rooms = await db.insert(meetingRoomsTable).values([
      { name: "MR-01", capacity: 8, floor: "Floor 1", facilities: "Projector, Video conferencing, Whiteboard", description: "Main meeting room — top-left of floor" },
      { name: "MR-02", capacity: 6, floor: "Floor 1", facilities: "TV screen, Video conferencing", description: "Secondary meeting room — below MR-01" },
    ]).returning();

    // ── Sample bookings ────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    // Scatter bookings across the floor so the map looks realistic
    const bookingPairs: [number, typeof employee1][] = [
      [0, employee1],   // W001
      [5, employee2],   // W006
      [8, teamlead],    // W009
      [13, employee3],  // W014
      [20, employee4],  // W021
      [27, admin],      // W028
      [34, employee1],  // W035
      [44, employee2],  // W045
      [50, employee3],  // W051
      [57, employee4],  // W058
      [64, teamlead],   // W065
    ];

    for (const [idx, user] of bookingPairs) {
      if (desks[idx]) {
        await db.insert(deskBookingsTable).values({ deskId: desks[idx].id, userId: user.id, date: today, status: "confirmed" });
      }
    }

    // A couple already checked in
    const checkinPairs: [number, typeof employee1][] = [
      [10, employee1],  // W011
      [25, employee2],  // W026
    ];
    for (const [idx, user] of checkinPairs) {
      if (desks[idx]) {
        await db.insert(deskBookingsTable).values({ deskId: desks[idx].id, userId: user.id, date: today, status: "checked_in", checkedInAt: new Date() });
      }
    }

    // Tomorrow bookings
    await db.insert(deskBookingsTable).values({ deskId: desks[1].id, userId: employee3.id, date: tomorrow, status: "confirmed" });
    await db.insert(deskBookingsTable).values({ deskId: desks[60].id, userId: employee4.id, date: tomorrow, status: "confirmed" });

    // ── Meeting room bookings ──────────────────────────────────
    const todayStart = new Date(); todayStart.setHours(10, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(11, 30, 0, 0);
    await db.insert(meetingRoomBookingsTable).values({ roomId: rooms[0].id, userId: teamlead.id, title: "Sprint Planning", startTime: todayStart, endTime: todayEnd, status: "confirmed", attendees: "jane@company.com, john@company.com" });

    // ── Notifications ──────────────────────────────────────────
    await db.insert(notificationsTable).values([
      { userId: employee1.id, type: "booking_confirmed", message: "Your desk W001 is booked for today.", isRead: false },
      { userId: employee2.id, type: "booking_confirmed", message: "Your desk W006 is booked for today.", isRead: false },
      { userId: teamlead.id, type: "booking_confirmed", message: "Meeting room MR-01 booked for Sprint Planning.", isRead: false },
    ]);

    logger.info("Database seeded — 70 desks (W001–W070), 2 meeting rooms (MR-01, MR-02)");
  } catch (err) {
    logger.error({ err }, "Seeding failed");
    throw err;
  }
}
