import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { meetingRoomsTable } from "./meeting_rooms";
import { relations } from "drizzle-orm";

export const meetingRoomBookingsTable = pgTable("meeting_room_bookings", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => meetingRoomsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("confirmed"), // confirmed | cancelled
  attendees: text("attendees"), // comma-separated emails
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const meetingRoomBookingsRelations = relations(meetingRoomBookingsTable, ({ one }) => ({
  room: one(meetingRoomsTable, {
    fields: [meetingRoomBookingsTable.roomId],
    references: [meetingRoomsTable.id],
  }),
  user: one(usersTable, {
    fields: [meetingRoomBookingsTable.userId],
    references: [usersTable.id],
  }),
}));

export const insertMeetingRoomBookingSchema = createInsertSchema(meetingRoomBookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMeetingRoomBooking = z.infer<typeof insertMeetingRoomBookingSchema>;
export type MeetingRoomBooking = typeof meetingRoomBookingsTable.$inferSelect;
