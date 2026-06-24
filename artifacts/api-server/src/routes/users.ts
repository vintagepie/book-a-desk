import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireRole, AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

const formatUser = (u: typeof usersTable.$inferSelect) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  department: u.department,
  avatarUrl: u.avatarUrl,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

// GET /api/users
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    res.json(users.map(formatUser));
  } catch (err) {
    logger.error({ err }, "List users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users
router.post("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { email, name, role, password, department } = req.body as {
      email: string; name: string; role: string; password: string; department?: string;
    };
    if (!email || !name || !role || !password) {
      res.status(400).json({ error: "email, name, role, password required" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({ email, name, role, passwordHash, department }).returning();
    res.status(201).json(formatUser(user));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "Email already exists" });
      return;
    }
    logger.error({ err }, "Create user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:id
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (req.user!.role !== "admin" && req.user!.id !== id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(formatUser(user));
  } catch (err) {
    logger.error({ err }, "Get user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/:id
router.patch("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (req.user!.role !== "admin" && req.user!.id !== id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const { name, role, department, isActive, password } = req.body as {
      name?: string; role?: string; department?: string; isActive?: boolean; password?: string;
    };
    const updateData: Partial<typeof usersTable.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (department !== undefined) updateData.department = department;
    if (req.user!.role === "admin") {
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
    }
    const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(formatUser(user));
  } catch (err) {
    logger.error({ err }, "Update user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:id
router.delete("/:id", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Delete user error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
