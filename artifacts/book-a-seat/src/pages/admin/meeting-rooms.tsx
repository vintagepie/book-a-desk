import { useListMeetingRooms, useListMeetingRoomBookings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Users, Building2, Clock } from "lucide-react";

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  maintenance: "destructive",
};

export default function AdminMeetingRooms() {
  const { data: rooms, isLoading: roomsLoading } = useListMeetingRooms();
  const { data: bookings, isLoading: bookingsLoading } = useListMeetingRoomBookings();

  if (roomsLoading || bookingsLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const allBookings = bookings?.data ?? [];
  const today = format(new Date(), "yyyy-MM-dd");
  const upcomingByRoom = (roomId: number) =>
    allBookings.filter(
      (b: any) =>
        b.roomId === roomId &&
        b.status === "confirmed" &&
        b.startTime.startsWith(today)
    );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Meeting Rooms Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rooms?.map((room) => {
          const todayBookings = upcomingByRoom(room.id);
          return (
            <Card key={room.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle>{room.name}</CardTitle>
                  <Badge variant={STATUS_BADGE[room.status] ?? "secondary"}>{room.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2 text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Capacity: {room.capacity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>Floor: {room.floor}</span>
                  </div>
                  {room.facilities && <p>{room.facilities}</p>}
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm font-semibold mb-2">Today's Schedule ({todayBookings.length} bookings)</p>
                  {todayBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No meetings today</p>
                  ) : (
                    <div className="space-y-1">
                      {todayBookings.map((b: any) => (
                        <div key={b.id} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="font-medium">{format(new Date(b.startTime), "h:mm")}–{format(new Date(b.endTime), "h:mm a")}</span>
                          <span className="text-muted-foreground truncate">{b.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">All Upcoming Bookings</h2>
        <div className="border rounded-md bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-semibold">Title</th>
                <th className="text-left p-3 font-semibold">Room</th>
                <th className="text-left p-3 font-semibold">Date & Time</th>
                <th className="text-left p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {allBookings.filter((b: any) => b.status === "confirmed").slice(0, 20).map((b: any) => (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{b.title}</td>
                  <td className="p-3 text-muted-foreground">{b.room?.name ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{format(new Date(b.startTime), "MMM d, h:mm a")}–{format(new Date(b.endTime), "h:mm a")}</td>
                  <td className="p-3">
                    <Badge variant="default" className="text-xs">{b.status}</Badge>
                  </td>
                </tr>
              ))}
              {allBookings.filter((b: any) => b.status === "confirmed").length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">No upcoming bookings</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
