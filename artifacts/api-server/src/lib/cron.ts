import cron from "node-cron";
import { db, deskBookingsTable, notificationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Runs daily at 9:45 AM: expire all confirmed desk bookings that haven't checked in
 */
export function startCronJobs() {
  // Every day at 9:45 AM — expire no-show bookings
  cron.schedule("45 9 * * *", async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      logger.info({ today }, "Running reservation expiry cron");

      const expiredBookings = await db
        .update(deskBookingsTable)
        .set({ status: "expired" })
        .where(and(
          eq(deskBookingsTable.date, today),
          eq(deskBookingsTable.status, "confirmed")
        ))
        .returning();

      logger.info({ count: expiredBookings.length }, "Expired bookings");

      // Notify users whose bookings expired
      for (const booking of expiredBookings) {
        await db.insert(notificationsTable).values({
          userId: booking.userId,
          type: "booking_expired",
          message: `Your desk reservation for today (${today}) has expired because you did not check in before 9:45 AM.`,
        });
      }
    } catch (err) {
      logger.error({ err }, "Reservation expiry cron failed");
    }
  });

  // Every day at 8:30 AM — send check-in reminders
  cron.schedule("30 8 * * *", async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const todayBookings = await db
        .select()
        .from(deskBookingsTable)
        .where(and(
          eq(deskBookingsTable.date, today),
          eq(deskBookingsTable.status, "confirmed")
        ));

      for (const booking of todayBookings) {
        await db.insert(notificationsTable).values({
          userId: booking.userId,
          type: "check_in_reminder",
          message: `Reminder: You have a desk booked for today. Please check in by 9:45 AM to keep your reservation.`,
        });
      }
      logger.info({ count: todayBookings.length }, "Sent check-in reminders");
    } catch (err) {
      logger.error({ err }, "Check-in reminder cron failed");
    }
  });

  logger.info("Cron jobs started");
}
