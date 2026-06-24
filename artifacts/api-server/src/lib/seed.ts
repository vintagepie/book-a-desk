import {
  db,
  usersTable,
  desksTable,
  meetingRoomsTable,
  deskBookingsTable,
  meetingRoomBookingsTable,
  notificationsTable,
  maintenanceLogsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";

type SeedUser = {
  email: string;
  name: string;
  password: string;
  role: "admin" | "team_lead" | "employee";
  department: string;
  avatarUrl?: string;
};

type DeskSeed = {
  name: string;
  floor: string;
  zone: string;
  amenities: string;
  qrCode: string;
};

function qr() {
  return `QR-${uuidv4().toUpperCase().slice(0, 8)}`;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function atDate(daysAgo: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledCopy<T>(items: T[], rand: () => number) {
  return [...items]
    .map((item) => ({ item, weight: rand() }))
    .sort((a, b) => a.weight - b.weight)
    .map((entry) => entry.item);
}

function makeDesks(): DeskSeed[] {
  const desks: DeskSeed[] = [];

  for (let i = 1; i <= 8; i++) {
    desks.push({
      name: `W${String(i).padStart(3, "0")}`,
      floor: "Floor 1",
      zone: "Row 1",
      amenities: "Standard desk, 1 monitor",
      qrCode: qr(),
    });
  }

  for (let i = 9; i <= 24; i++) {
    desks.push({
      name: `W${String(i).padStart(3, "0")}`,
      floor: "Floor 1",
      zone: "Row 2",
      amenities: "Standard desk, 2 monitors",
      qrCode: qr(),
    });
  }

  for (let i = 25; i <= 40; i++) {
    desks.push({
      name: `W${String(i).padStart(3, "0")}`,
      floor: "Floor 1",
      zone: "Row 3",
      amenities: "Standard desk, 2 monitors",
      qrCode: qr(),
    });
  }

  for (let i = 41; i <= 56; i++) {
    desks.push({
      name: `W${String(i).padStart(3, "0")}`,
      floor: "Floor 1",
      zone: "Row 4",
      amenities: "Standard desk, 2 monitors",
      qrCode: qr(),
    });
  }

  for (let i = 57; i <= 64; i++) {
    desks.push({
      name: `W${String(i).padStart(3, "0")}`,
      floor: "Floor 1",
      zone: "Row 5",
      amenities: "Standing desk, 1 monitor",
      qrCode: qr(),
    });
  }

  for (let i = 65; i <= 70; i++) {
    desks.push({
      name: `W${String(i).padStart(3, "0")}`,
      floor: "Floor 1",
      zone: "Middle Area",
      amenities: "Compact desk, 1 monitor",
      qrCode: qr(),
    });
  }

  return desks;
}

const seedUsers: SeedUser[] = [
  { email: "admin@company.com", name: "Alex Admin", password: "admin123", role: "admin", department: "IT" },
  { email: "lead@company.com", name: "Sam Lead", password: "lead123", role: "team_lead", department: "Engineering" },
  { email: "jane@company.com", name: "Jane Doe", password: "pass123", role: "employee", department: "Marketing" },
  { email: "john@company.com", name: "John Smith", password: "pass123", role: "employee", department: "Engineering" },
  { email: "emily@company.com", name: "Emily Chen", password: "pass123", role: "employee", department: "Design" },
  { email: "mike@company.com", name: "Mike Torres", password: "pass123", role: "employee", department: "Sales" },
  { email: "sara@company.com", name: "Sara Patel", password: "pass123", role: "employee", department: "HR" },
  { email: "dan@company.com", name: "Dan Brown", password: "pass123", role: "employee", department: "Finance" },
  { email: "priya@company.com", name: "Priya Shah", password: "pass123", role: "employee", department: "Operations" },
  { email: "lucas@company.com", name: "Lucas Green", password: "pass123", role: "employee", department: "Support" },
  { email: "nina@company.com", name: "Nina Lopez", password: "pass123", role: "employee", department: "Product" },
  { email: "oliver@company.com", name: "Oliver King", password: "pass123", role: "employee", department: "Legal" },
  { email: "chloe@company.com", name: "Chloe Park", password: "pass123", role: "employee", department: "Facilities" },
  { email: "ben@company.com", name: "Ben Harris", password: "pass123", role: "employee", department: "Customer Success" },
  { email: "alicia@company.com", name: "Alicia Moore", password: "pass123", role: "employee", department: "Engineering" },
  { email: "meera@company.com", name: "Meera Iyer", password: "pass123", role: "employee", department: "Marketing" },
];

const meetingTitles = [
  "Sprint Planning",
  "Weekly Standup",
  "Client Review",
  "Design Critique",
  "Budget Review",
  "Hiring Panel",
  "Roadmap Workshop",
  "Ops Sync",
  "Sales Pipeline Review",
  "All Hands Prep",
];

export async function seedDatabase() {
  try {
    const existing = await db.select().from(usersTable).limit(1);
    if (existing.length > 0) {
      logger.info("Database already seeded, skipping");
      return;
    }

    logger.info("Seeding office admin dataset with historical analytics...");
    const hash = async (value: string) => bcrypt.hash(value, 12);

    const insertedUsers = await db
      .insert(usersTable)
      .values(
        await Promise.all(
          seedUsers.map(async (user) => ({
            email: user.email,
            name: user.name,
            passwordHash: await hash(user.password),
            role: user.role,
            department: user.department,
            avatarUrl: user.avatarUrl,
          })),
        ),
      )
      .returning();

    const admin = insertedUsers.find((user) => user.role === "admin")!;
    const lead = insertedUsers.find((user) => user.role === "team_lead")!;
    const employees = insertedUsers.filter((user) => user.role === "employee");
    const activeUsers = insertedUsers.filter((user) => user.role !== "admin");

    const deskRows = makeDesks();
    const desks = await db.insert(desksTable).values(deskRows).returning();

    const maintenanceIdxs = [2, 15, 38, 52];
    const maintenanceDeskIds = maintenanceIdxs.map((idx) => desks[idx].id);
    for (const idx of maintenanceIdxs) {
      await db
        .update(desksTable)
        .set({ status: "maintenance" })
        .where(eq(desksTable.id, desks[idx].id));
    }

    const rooms = await db
      .insert(meetingRoomsTable)
      .values([
        {
          name: "MR-01",
          capacity: 8,
          floor: "Floor 1",
          facilities: "Projector, Video conferencing, Whiteboard",
          description: "Primary conference room near the north wall",
        },
        {
          name: "MR-02",
          capacity: 6,
          floor: "Floor 1",
          facilities: "TV screen, Video conferencing",
          description: "Secondary conference room by the support zone",
        },
      ])
      .returning();

    const employeeEmails = employees.map((user) => user.email);
    const allNonAdminUsers = activeUsers;
    const bookableDeskIds = desks
      .map((desk) => desk.id)
      .filter((deskId) => !maintenanceDeskIds.includes(deskId));

    const deskBookings: Array<{
      deskId: number;
      userId: number;
      date: string;
      status: "confirmed" | "checked_in" | "cancelled" | "expired";
      checkedInAt?: Date;
      cancelledAt?: Date;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    for (let offset = 29; offset >= 0; offset--) {
      const rand = mulberry32(9000 + offset * 97);
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const dateStr = isoDate(date);
      const shuffledUsers = shuffledCopy(allNonAdminUsers, rand);
      const shuffledDesks = shuffledCopy(bookableDeskIds, rand);
      const bookingCount = Math.min(
        shuffledUsers.length,
        10 + Math.floor(rand() * 4) + (offset % 7 === 0 ? 3 : 0) + (offset % 5 === 0 ? 1 : 0),
      );

      for (let i = 0; i < bookingCount; i++) {
        const user = shuffledUsers[i];
        const deskId = shuffledDesks[i % shuffledDesks.length];
        const roll = rand();
        let status: "confirmed" | "checked_in" | "cancelled" | "expired" = "confirmed";

        if (offset > 18 && i === bookingCount - 1 && roll < 0.35) {
          status = "expired";
        } else if (roll < 0.18) {
          status = "cancelled";
        } else if (roll < 0.58 || offset % 4 === 0) {
          status = "checked_in";
        }

        const createdAt = atDate(offset, 8, 10 + i * 4);
        const checkedInAt = status === "checked_in" ? atDate(offset, 9, 5 + i * 3) : undefined;
        const cancelledAt = status === "cancelled" ? atDate(offset, 7, 45 + i * 2) : undefined;
        const updatedAt = checkedInAt ?? cancelledAt ?? createdAt;

        deskBookings.push({
          deskId,
          userId: user.id,
          date: dateStr,
          status,
          checkedInAt,
          cancelledAt,
          createdAt,
          updatedAt,
        });
      }
    }

    await db.insert(deskBookingsTable).values(deskBookings);

    const roomBookings: Array<{
      roomId: number;
      userId: number;
      title: string;
      description: string;
      startTime: Date;
      endTime: Date;
      status: "confirmed" | "cancelled";
      attendees: string;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    for (let offset = 29; offset >= 0; offset--) {
      const rand = mulberry32(12000 + offset * 53);
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const meetingCount = 1 + Math.floor(rand() * 3) + (offset % 6 === 0 ? 1 : 0);
      const shuffledMeetingUsers = shuffledCopy(allNonAdminUsers, rand);

      for (let i = 0; i < meetingCount; i++) {
        const room = rooms[i % rooms.length];
        const owner = shuffledMeetingUsers[i];
        const startHour = 9 + (i % 4) * 2;
        const startTime = new Date(date);
        startTime.setHours(startHour, 0, 0, 0);
        const endTime = new Date(startTime);
        endTime.setHours(startHour + 1, 30, 0, 0);
        const cancelled = offset > 20 && i === meetingCount - 1 && rand() < 0.2;
        const status: "confirmed" | "cancelled" = cancelled ? "cancelled" : "confirmed";
        const attendeeEmails = shuffledMeetingUsers
          .slice(i + 1, i + 4)
          .map((user) => user.email)
          .join(", ");

        roomBookings.push({
          roomId: room.id,
          userId: owner.id,
          title: meetingTitles[(offset + i) % meetingTitles.length],
          description: `Auto-generated meeting for ${room.name}`,
          startTime,
          endTime,
          status,
          attendees: attendeeEmails,
          createdAt: new Date(startTime.getTime() - 45 * 60 * 1000),
          updatedAt: status === "cancelled" ? new Date(startTime.getTime() - 30 * 60 * 1000) : new Date(startTime.getTime() - 20 * 60 * 1000),
        });
      }
    }

    await db.insert(meetingRoomBookingsTable).values(roomBookings);

    const maintenanceEvents = [
      {
        deskId: desks[maintenanceIdxs[0]].id,
        action: "marked_maintenance",
        reason: "Scheduled equipment replacement",
        performedBy: admin.id,
        createdAt: atDate(21, 9, 0),
      },
      {
        deskId: desks[maintenanceIdxs[1]].id,
        action: "marked_maintenance",
        reason: "Docking station repair",
        performedBy: lead.id,
        createdAt: atDate(18, 14, 30),
      },
      {
        deskId: desks[maintenanceIdxs[2]].id,
        action: "marked_maintenance",
        reason: "Chair replacement",
        performedBy: admin.id,
        createdAt: atDate(12, 11, 15),
      },
      {
        deskId: desks[maintenanceIdxs[3]].id,
        action: "marked_maintenance",
        reason: "Power outlet maintenance",
        performedBy: lead.id,
        createdAt: atDate(9, 16, 45),
      },
      {
        deskId: desks[maintenanceIdxs[1]].id,
        action: "restored",
        reason: "Repair completed",
        performedBy: admin.id,
        createdAt: atDate(6, 10, 10),
      },
      {
        deskId: desks[maintenanceIdxs[1]].id,
        action: "marked_maintenance",
        reason: "Replacement requested",
        performedBy: lead.id,
        createdAt: atDate(2, 13, 20),
      },
    ];

    for (const event of maintenanceEvents) {
      await db.insert(maintenanceLogsTable).values(event);
    }

    const notifications = [
      { userId: employees[0].id, type: "booking_confirmed", message: "Your desk is booked for today.", isRead: false },
      { userId: employees[1].id, type: "booking_confirmed", message: "Your office booking was confirmed.", isRead: false },
      { userId: lead.id, type: "meeting_reminder", message: "Sprint planning is scheduled for 10:00 AM.", isRead: false },
      { userId: employees[2].id, type: "maintenance_alert", message: "A nearby desk is under maintenance.", isRead: false },
      { userId: employees[3].id, type: "booking_expired", message: "A past desk booking expired automatically.", isRead: true },
    ];
    await db.insert(notificationsTable).values(notifications);

    logger.info(
      {
        users: insertedUsers.length,
        desks: desks.length,
        bookings: deskBookings.length,
        meetings: roomBookings.length,
        maintenanceLogs: maintenanceEvents.length,
        employeeEmails,
      },
      "Database seeded with office analytics history",
    );
  } catch (err) {
    logger.error({ err }, "Seeding failed");
    throw err;
  }
}

