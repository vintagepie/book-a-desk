import { useGetAnalyticsOverview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalyticsOverviewPage() {
  const { data: stats, isLoading } = useGetAnalyticsOverview();

  if (isLoading) return <div>Loading analytics...</div>;
  if (!stats) return <div>No data available</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics Overview</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Desks</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.totalDesks}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Rooms</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.totalRooms}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.totalUsers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.maintenanceDesks}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Today's Desk Bookings</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.todayDeskBookings}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Today's Room Bookings</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.todayRoomBookings}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Occupancy Rate</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{Math.round(stats.occupancyRate)}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Check-in Rate</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{Math.round(stats.checkInRate)}%</div></CardContent>
        </Card>
      </div>
      
      {/* Tables and charts would go here */}
      <div className="h-64 border rounded flex items-center justify-center text-muted-foreground">
        Analytics Charts Placeholder
      </div>
    </div>
  );
}