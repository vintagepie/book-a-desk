import { useListMeetingRoomBookings, useCancelMeetingRoomBooking, getListMeetingRoomBookingsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Clock, Users } from "lucide-react";
import { useLocation } from "wouter";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  cancelled: "destructive",
  completed: "secondary",
};

export default function MyMeetings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: bookings, isLoading } = useListMeetingRoomBookings({ userId: user?.id });
  const cancelMutation = useCancelMeetingRoomBooking();

  const handleCancel = (id: number) => {
    cancelMutation.mutate({ id }, {
      onSuccess: () => {
        toast.success("Meeting booking cancelled");
        queryClient.invalidateQueries({ queryKey: getListMeetingRoomBookingsQueryKey() });
      },
      onError: (err: any) => {
        toast.error("Failed to cancel: " + (err.data?.error || err.message));
      },
    });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const items = bookings?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">My Meetings</h1>
        <Button onClick={() => setLocation("/meeting-rooms/book")}>Book a Room</Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 border rounded-md border-dashed text-muted-foreground">
          No meeting bookings found. Book a room to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((booking: any) => (
            <Card key={booking.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{booking.title}</CardTitle>
                  <Badge variant={STATUS_COLORS[booking.status] ?? "secondary"}>
                    {booking.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(booking.startTime), "EEEE, MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{format(new Date(booking.startTime), "h:mm a")} – {format(new Date(booking.endTime), "h:mm a")}</span>
                  </div>
                  {booking.room && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{booking.room.name} (Floor: {booking.room.floor})</span>
                    </div>
                  )}
                  {booking.description && (
                    <p className="mt-2 text-foreground">{booking.description}</p>
                  )}
                  {booking.attendees && (
                    <p className="mt-1">Attendees: {booking.attendees}</p>
                  )}
                </div>
                {booking.status === "confirmed" && new Date(booking.startTime) > new Date() && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancel(booking.id)}
                    disabled={cancelMutation.isPending}
                  >
                    Cancel Meeting
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
