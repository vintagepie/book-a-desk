import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import desksRouter from "./desks";
import deskBookingsRouter from "./desk_bookings";
import meetingRoomsRouter from "./meeting_rooms";
import meetingRoomBookingsRouter from "./meeting_room_bookings";
import notificationsRouter from "./notifications";
import analyticsRouter from "./analytics";
import maintenanceRouter from "./maintenance";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/desks", desksRouter);
router.use("/desk-bookings", deskBookingsRouter);
router.use("/meeting-rooms", meetingRoomsRouter);
router.use("/meeting-room-bookings", meetingRoomBookingsRouter);
router.use("/notifications", notificationsRouter);
router.use("/analytics", analyticsRouter);
router.use("/dashboard", analyticsRouter);
router.use("/maintenance-logs", maintenanceRouter);

export default router;
