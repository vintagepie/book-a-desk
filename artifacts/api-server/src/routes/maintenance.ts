import { Router } from "express";
import { db, maintenanceLogsTable, desksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/maintenance-logs
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { deskId } = req.query as { deskId?: string };
    const conditions: any[] = [];
    if (deskId) conditions.push(eq(maintenanceLogsTable.deskId, parseInt(deskId)));

    const rows = await db
      .select()
      .from(maintenanceLogsTable)
      .leftJoin(desksTable, eq(maintenanceLogsTable.deskId, desksTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(maintenanceLogsTable.createdAt))
      .limit(100);

    res.json(rows.map(r => ({
      id: r.maintenance_logs.id,
      deskId: r.maintenance_logs.deskId,
      action: r.maintenance_logs.action,
      reason: r.maintenance_logs.reason,
      performedBy: r.maintenance_logs.performedBy,
      createdAt: r.maintenance_logs.createdAt,
      desk: r.desks ? {
        id: r.desks.id,
        name: r.desks.name,
        floor: r.desks.floor,
        zone: r.desks.zone,
        status: r.desks.status,
        amenities: r.desks.amenities,
        qrCode: r.desks.qrCode,
        isAvailable: r.desks.status === "available",
        createdAt: r.desks.createdAt,
      } : undefined,
    })));
  } catch (err) {
    logger.error({ err }, "List maintenance logs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
