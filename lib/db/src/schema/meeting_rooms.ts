import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const meetingRoomsTable = pgTable("meeting_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  floor: text("floor").notNull(),
  status: text("status").notNull().default("available"), // available | maintenance
  facilities: text("facilities"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMeetingRoomSchema = createInsertSchema(meetingRoomsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMeetingRoom = z.infer<typeof insertMeetingRoomSchema>;
export type MeetingRoom = typeof meetingRoomsTable.$inferSelect;
