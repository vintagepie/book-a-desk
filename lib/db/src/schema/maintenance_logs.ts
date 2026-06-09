import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { desksTable } from "./desks";
import { relations } from "drizzle-orm";

export const maintenanceLogsTable = pgTable("maintenance_logs", {
  id: serial("id").primaryKey(),
  deskId: integer("desk_id").notNull().references(() => desksTable.id),
  action: text("action").notNull(), // marked_maintenance | restored
  reason: text("reason"),
  performedBy: integer("performed_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const maintenanceLogsRelations = relations(maintenanceLogsTable, ({ one }) => ({
  desk: one(desksTable, {
    fields: [maintenanceLogsTable.deskId],
    references: [desksTable.id],
  }),
  performer: one(usersTable, {
    fields: [maintenanceLogsTable.performedBy],
    references: [usersTable.id],
  }),
}));

export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLogsTable).omit({ id: true, createdAt: true });
export type InsertMaintenanceLog = z.infer<typeof insertMaintenanceLogSchema>;
export type MaintenanceLog = typeof maintenanceLogsTable.$inferSelect;
