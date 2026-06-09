import { useAuth } from "@/contexts/AuthContext";
import { useGetDashboardSummary, useListDeskBookings, useListMeetingRoomBookings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format, isToday, isTomorrow } from "date-fns";
import { Monitor, Building2, Bell, CalendarCheck, QrCode, TrendingUp } from "lucide-react";

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "MMM d");
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmed: "default",
  checked_in: "secondary",
  cancelled: "destructive",
  expired: "outline",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: myBookingsData } = useListDeskBookings({ userId: user?.id, limit: 5 });
  const { data: myMeetingsData } = useListMeetingRoomBookings({ userId: user?.id, limit: 5 });

  const myBookings = myBookingsData?.data ?? [];
  const myMeetings = myMeetingsData?.data ?? [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{greeting()}, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground mt-1">Here's your workspace overview for today.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Desks</span>
              <Monitor className="w-4 h-4 text-primary" />
            </div>
            <div className="text-3xl font-bold">{summaryLoading ? "—" : (summary?.availableDesksToday ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">today</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Bookings</span>
              <CalendarCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="text-3xl font-bold">{myBookings.filter((b: any) => b.status === "confirmed" || b.status === "checked_in").length}</div>
            <p className="text-xs text-muted-foreground mt-1">upcoming</p>
          </CardContent>
        </Card>

        {(user?.role === "team_lead" || user?.role === "admin") && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Meetings</span>
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="text-3xl font-bold">{myMeetings.filter((m: any) => m.status === "confirmed").length}</div>
              <p className="text-xs text-muted-foreground mt-1">upcoming</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notifications</span>
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <div className="text-3xl font-bold">{summaryLoading ? "—" : (summary?.unreadNotifications ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">unread</p>
          </CardContent>
        </Card>

        {user?.role === "admin" && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Desks</span>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div className="text-3xl font-bold">{summaryLoading ? "—" : (summary?.availableDesksToday ?? 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">this floor</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setLocation("/desks/book")}>
            <Monitor className="w-4 h-4 mr-2" />
            Book a Desk
          </Button>
          <Button variant="outline" onClick={() => setLocation("/check-in")}>
            <QrCode className="w-4 h-4 mr-2" />
            Check In
          </Button>
          {(user?.role === "team_lead" || user?.role === "admin") && (
            <Button variant="outline" onClick={() => setLocation("/meeting-rooms/book")}>
              <Building2 className="w-4 h-4 mr-2" />
              Book a Room
            </Button>
          )}
          {summary && (summary.unreadNotifications ?? 0) > 0 && (
            <Button variant="outline" onClick={() => setLocation("/notifications")}>
              <Bell className="w-4 h-4 mr-2" />
              View Notifications
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">{summary.unreadNotifications}</Badge>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming desk bookings */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">My Desk Bookings</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/my-bookings")} className="text-xs">
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {myBookings.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No upcoming desk bookings.
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => setLocation("/desks/book")}>Book a desk</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {myBookings.slice(0, 5).map((booking: any) => (
                  <div key={booking.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                    <div>
                      <div className="font-medium text-sm">{booking.desk?.name ?? "Desk"}</div>
                      <div className="text-xs text-muted-foreground">{booking.desk?.floor} {booking.desk?.zone ? `• ${booking.desk?.zone}` : ""}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">{formatDateLabel(booking.date)}</span>
                      <Badge variant={STATUS_BADGE[booking.status] ?? "secondary"} className="text-xs">
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming meeting room bookings (for team_lead and admin) */}
        {(user?.role === "team_lead" || user?.role === "admin") && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">My Meetings</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setLocation("/my-meetings")} className="text-xs">
                  View all
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {myMeetings.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No upcoming meetings.
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={() => setLocation("/meeting-rooms/book")}>Book a room</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {myMeetings.slice(0, 5).map((booking: any) => (
                    <div key={booking.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{booking.title}</div>
                        <div className="text-xs text-muted-foreground">{booking.room?.name}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground">{format(new Date(booking.startTime), "MMM d")}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(booking.startTime), "h:mm a")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* For employees: show notifications teaser */}
        {user?.role === "employee" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Button variant="outline" onClick={() => setLocation("/notifications")}>
                  <Bell className="w-4 h-4 mr-2" />
                  View Notifications
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
