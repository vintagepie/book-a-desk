import { db, usersTable, desksTable, meetingRoomsTable, deskBookingsTable, meetingRoomBookingsTable, notificationsTable, maintenanceLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";

export async function seedDatabase() {
  try {
    // Check if already seeded
    const existing = await db.select().from(usersTable).limit(1);
    if (existing.length > 0) {
      logger.info("Database already seeded, skipping");
      return;
    }

    logger.info("Seeding database...");

    const hash = (p: string) => bcrypt.hash(p, 12);

    // Users
    const [admin] = await db.insert(usersTable).values({
      email: "admin@company.com",
      name: "Alex Admin",
      passwordHash: await hash("admin123"),
      role: "admin",
      department: "IT",
    }).returning();

    const [teamlead] = await db.insert(usersTable).values({
      email: "lead@company.com",
      name: "Sam Lead",
      passwordHash: await hash("lead123"),
      role: "team_lead",
      department: "Engineering",
    }).returning();

    const [employee1] = await db.insert(usersTable).values({
      email: "jane@company.com",
      name: "Jane Doe",
      passwordHash: await hash("pass123"),
      role: "employee",
      department: "Marketing",
    }).returning();

    const [employee2] = await db.insert(usersTable).values({
      email: "john@company.com",
      name: "John Smith",
      passwordHash: await hash("pass123"),
      role: "employee",
      department: "Engineering",
    }).returning();

    // Desks — Floor 1
    const deskData = [
      { name: "A-101", floor: "Floor 1", zone: "Zone A", amenities: "Standing desk, 2 monitors" },
      { name: "A-102", floor: "Floor 1", zone: "Zone A", amenities: "Standard desk, 1 monitor" },
      { name: "A-103", floor: "Floor 1", zone: "Zone A", amenities: "Standard desk" },
      { name: "B-101", floor: "Floor 1", zone: "Zone B", amenities: "Standing desk, whiteboard" },
      { name: "B-102", floor: "Floor 1", zone: "Zone B", amenities: "Standard desk, docking station" },
      { name: "C-101", floor: "Floor 2", zone: "Zone C", amenities: "Standard desk, 2 monitors" },
      { name: "C-102", floor: "Floor 2", zone: "Zone C", amenities: "Standard desk" },
      { name: "C-103", floor: "Floor 2", zone: "Zone C", amenities: "Standing desk" },
      { name: "D-101", floor: "Floor 2", zone: "Zone D", amenities: "Quiet zone, 1 monitor" },
      { name: "D-102", floor: "Floor 2", zone: "Zone D", amenities: "Quiet zone, standing desk" },
    ];

    const desks = await db.insert(desksTable).values(
      deskData.map(d => ({ ...d, qrCode: `DESK-${uuidv4().toUpperCase().slice(0, 8)}` }))
    ).returning();

    // Mark one desk under maintenance
    await db.update(desksTable).set({ status: "maintenance" }).where(eq(desksTable.id, desks[4].id));
    await db.insert(maintenanceLogsTable).values({
      deskId: desks[4].id,
      action: "marked_maintenance",
      reason: "Broken monitor stand needs replacement",
      performedBy: admin.id,
    });

    // Meeting rooms
    const rooms = await db.insert(meetingRoomsTable).values([
      { name: "Boardroom Alpha", capacity: 12, floor: "Floor 1", facilities: "Projector, Video conferencing, Whiteboard", description: "Large boardroom for all-hands meetings" },
      { name: "Focus Room 1", capacity: 4, floor: "Floor 1", facilities: "TV screen, Whiteboard", description: "Small focus room for quick syncs" },
      { name: "Innovation Lab", capacity: 8, floor: "Floor 2", facilities: "Smartboard, Video conferencing, Breakout area", description: "Creative space for workshops and brainstorming" },
      { name: "Executive Suite", capacity: 6, floor: "Floor 2", facilities: "Premium AV, Video conferencing", description: "Executive meeting space" },
    ]).returning();

    // Some desk bookings
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    await db.insert(deskBookingsTable).values([
      { deskId: desks[0].id, userId: employee1.id, date: today, status: "confirmed" },
      { deskId: desks[1].id, userId: employee2.id, date: today, status: "checked_in", checkedInAt: new Date() },
      { deskId: desks[2].id, userId: teamlead.id, date: today, status: "confirmed" },
      { deskId: desks[0].id, userId: employee1.id, date: yesterday, status: "checked_in", checkedInAt: new Date(Date.now() - 86400000) },
      { deskId: desks[3].id, userId: employee2.id, date: yesterday, status: "cancelled", cancelledAt: new Date(Date.now() - 86400000) },
      { deskId: desks[5].id, userId: employee1.id, date: tomorrow, status: "confirmed" },
    ]);

    // Meeting room bookings
    const now = new Date();
    const meetingStart = new Date(now);
    meetingStart.setHours(14, 0, 0, 0);
    const meetingEnd = new Date(now);
    meetingEnd.setHours(15, 30, 0, 0);

    const tomorrowMeetingStart = new Date(Date.now() + 86400000);
    tomorrowMeetingStart.setHours(10, 0, 0, 0);
    const tomorrowMeetingEnd = new Date(Date.now() + 86400000);
    tomorrowMeetingEnd.setHours(11, 0, 0, 0);

    await db.insert(meetingRoomBookingsTable).values([
      {
        roomId: rooms[0].id,
        userId: teamlead.id,
        title: "Q4 Planning Session",
        description: "Quarterly planning with the engineering team",
        startTime: meetingStart,
        endTime: meetingEnd,
        status: "confirmed",
        attendees: "jane@company.com, john@company.com, admin@company.com",
      },
      {
        roomId: rooms[1].id,
        userId: teamlead.id,
        title: "Sprint Review",
        description: "Weekly sprint review",
        startTime: tomorrowMeetingStart,
        endTime: tomorrowMeetingEnd,
        status: "confirmed",
        attendees: "john@company.com",
      },
    ]);

    // Notifications
    await db.insert(notificationsTable).values([
      { userId: employee1.id, type: "booking_confirmed", message: `Your desk booking for ${today} is confirmed. Enjoy your workspace!`, isRead: false },
      { userId: employee2.id, type: "booking_confirmed", message: `Your desk booking for ${today} is confirmed.`, isRead: true },
      { userId: teamlead.id, type: "booking_confirmed", message: "Meeting room 'Boardroom Alpha' booked for Q4 Planning Session.", isRead: false },
      { userId: employee1.id, type: "check_in_reminder", message: "Reminder: Please check in to your desk by 9:45 AM to keep your reservation.", isRead: false },
      { userId: employee1.id, type: "booking_confirmed", message: `Your desk booking for ${tomorrow} is confirmed.`, isRead: false },
    ]);

    logger.info("Database seeded successfully");
    logger.info("Demo accounts: admin@company.com/admin123 | lead@company.com/lead123 | jane@company.com/pass123");
  } catch (err) {
    logger.error({ err }, "Seeding failed");
  }
}
