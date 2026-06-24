import { Router } from "express";
import { db, meetingRoomsTable, meetingRoomBookingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

const formatRoom = (r: typeof meetingRoomsTable.$inferSelect) => ({
  id: r.id,
  name: r.name,
  capacity: r.capacity,
  floor: r.floor,
  status: r.status,
  facilities: r.facilities,
  description: r.description,
  createdAt: r.createdAt,
});

// GET /api/meeting-rooms
router.get("/", authenticate, async (req, res) => {
  try {
    const { date, capacity } = req.query as { date?: string; capacity?: string };
    const conditions: any[] = [];
    if (capacity) conditions.push(sql`${meetingRoomsTable.capacity} >= ${parseInt(capacity)}`);

    const rooms = conditions.length
      ? await db.select().from(meetingRoomsTable).where(and(...conditions)).orderBy(meetingRoomsTable.name)
      : await db.select().from(meetingRoomsTable).orderBy(meetingRoomsTable.name);

    res.json(rooms.map(formatRoom));
  } catch (err) {
    logger.error({ err }, "List meeting rooms error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/meeting-rooms
router.post("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { name, capacity, floor, facilities, description } = req.body as {
      name: string; capacity: number; floor: string; facilities?: string; description?: string;
    };
    if (!name || !capacity || !floor) { res.status(400).json({ error: "name, capacity, floor required" }); return; }
    const [room] = await db.insert(meetingRoomsTable).values({ name, capacity, floor, facilities, description }).returning();
    res.status(201).json(formatRoom(room));
  } catch (err) {
    logger.error({ err }, "Create meeting room error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/meeting-rooms/:id
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [room] = await db.select().from(meetingRoomsTable).where(eq(meetingRoomsTable.id, id)).limit(1);
    if (!room) { res.status(404).json({ error: "Meeting room not found" }); return; }
    res.json(formatRoom(room));
  } catch (err) {
    logger.error({ err }, "Get meeting room error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/meeting-rooms/:id
router.patch("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { name, capacity, floor, facilities, description, status } = req.body as {
      name?: string; capacity?: number; floor?: string; facilities?: string; description?: string; status?: string;
    };
    const updateData: Partial<typeof meetingRoomsTable.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (capacity !== undefined) updateData.capacity = capacity;
    if (floor !== undefined) updateData.floor = floor;
    if (facilities !== undefined) updateData.facilities = facilities;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    const [room] = await db.update(meetingRoomsTable).set(updateData).where(eq(meetingRoomsTable.id, id)).returning();
    if (!room) { res.status(404).json({ error: "Meeting room not found" }); return; }
    res.json(formatRoom(room));
  } catch (err) {
    logger.error({ err }, "Update meeting room error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/meeting-rooms/:id
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await db.delete(meetingRoomsTable).where(eq(meetingRoomsTable.id, id));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Delete meeting room error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
