import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const desksTable = pgTable("desks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  floor: text("floor").notNull(),
  zone: text("zone"),
  status: text("status").notNull().default("available"), // available | maintenance
  amenities: text("amenities"),
  qrCode: text("qr_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDeskSchema = createInsertSchema(desksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDesk = z.infer<typeof insertDeskSchema>;
export type Desk = typeof desksTable.$inferSelect;
