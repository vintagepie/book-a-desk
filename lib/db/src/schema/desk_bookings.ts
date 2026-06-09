import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { desksTable } from "./desks";
import { relations } from "drizzle-orm";

export const deskBookingsTable = pgTable("desk_bookings", {
  id: serial("id").primaryKey(),
  deskId: integer("desk_id").notNull().references(() => desksTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("confirmed"), // confirmed | checked_in | cancelled | expired
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const deskBookingsRelations = relations(deskBookingsTable, ({ one }) => ({
  desk: one(desksTable, {
    fields: [deskBookingsTable.deskId],
    references: [desksTable.id],
  }),
  user: one(usersTable, {
    fields: [deskBookingsTable.userId],
    references: [usersTable.id],
  }),
}));

export const insertDeskBookingSchema = createInsertSchema(deskBookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeskBooking = z.infer<typeof insertDeskBookingSchema>;
export type DeskBooking = typeof deskBookingsTable.$inferSelect;
