import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { 
  Users, LayoutGrid, CalendarDays, CheckCircle2, UserCheck, Wrench, BadgeCheck, 
  PanelTop, Gauge, FileText, Download, TrendingUp, TrendingDown, Clock, Activity, MapPin
} from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";

// Icon mapping
const iconMap: Record<string, React.FC<any>> = {
  "users": Users,
  "layout-grid": LayoutGrid,
  "calendar-days": CalendarDays,
  "circle-check-big": CheckCircle2,
  "user-check": UserCheck,
  "wrench": Wrench,
  "badge-check": BadgeCheck,
  "panel-top": PanelTop,
  "gauge": Gauge,
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function AdminDashboard() {
  const { data: dashboardData, isLoading, error } = useGetAdminDashboard();

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading admin dashboard...</div>;
  }

  if (error || !dashboardData) {
    return <div className="p-4 bg-destructive/10 text-destructive rounded-md">Error loading admin dashboard.</div>;
  }

  const { cards, deskUtilizationTrend, departmentAttendance, meetingRoomUtilization, weeklyBookingTrend, recentActivity, smartInsights, reports } = dashboardData as any;

  // CSV export utility
  const downloadCSV = (data: any[], filename: string) => {
    import("papaparse").then((Papa) => {
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const handleExportReports = () => {
    if (reports?.deskUtilization) {
      downloadCSV(reports.deskUtilization, `desk_utilization_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Office Administration</h1>
          <p className="text-muted-foreground mt-1 text-sm">Comprehensive overview of office utilization, attendance, and maintenance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportReports}>
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards?.map((card: any) => {
          const Icon = iconMap[card.icon] || Activity;
          const TrendIcon = card.trend?.direction === "up" ? TrendingUp : card.trend?.direction === "down" ? TrendingDown : null;
          
          return (
            <Card key={card.key} className="overflow-hidden transition-all hover:shadow-md border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</span>
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold">{card.value}{card.suffix}</div>
                  {TrendIcon && card.trend?.percentage !== 0 && (
                    <div className={`flex items-center text-xs font-medium ${card.trend.direction === "up" ? (card.trend.isPositive ? "text-green-600" : "text-destructive") : (!card.trend.isPositive ? "text-green-600" : "text-destructive")}`}>
                      <TrendIcon className="w-3 h-3 mr-0.5" />
                      {Math.abs(card.trend.percentage)}%
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Smart Insights */}
          <Card className="border-border/50 shadow-sm bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <BadgeCheck className="w-5 h-5 mr-2 text-primary" />
                Smart Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {smartInsights?.slice(0, 4).map((insight: any) => (
                  <div key={insight.key} className="flex gap-3 bg-background/60 p-3 rounded-lg border border-border/50">
                    <div className="shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{insight.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Desk Utilization Trend */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Desk Utilization Trend (30 Days)</CardTitle>
              <CardDescription>Daily occupancy percentage across all office zones.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={deskUtilizationTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888833" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), "MMM d")}
                      stroke="#88888888" fontSize={12} tickLine={false} axisLine={false} 
                    />
                    <YAxis 
                      tickFormatter={(val) => `${val}%`}
                      stroke="#88888888" fontSize={12} tickLine={false} axisLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelFormatter={(val) => format(new Date(val), "MMMM d, yyyy")}
                    />
                    <Line type="monotone" dataKey="occupancyRate" name="Occupancy (%)" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Department Attendance and Weekly Trend */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Department Attendance</CardTitle>
                <CardDescription>Employees present today by department.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentAttendance?.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#88888833" />
                      <XAxis type="number" stroke="#88888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="department" type="category" stroke="#88888888" fontSize={12} tickLine={false} axisLine={false} width={80} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="presentEmployees" name="Present" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Weekly Bookings</CardTitle>
                <CardDescription>Desk and meeting room bookings (7 days).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyBookingTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888833" />
                      <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), "E")} stroke="#88888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#88888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="deskBookings" name="Desks" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="meetingRoomBookings" name="Rooms" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          {/* Room Utilization Donut */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Room Utilization</CardTitle>
              <CardDescription>Meeting room usage distribution.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center">
              <div className="h-[220px] w-full flex items-center justify-center">
                {meetingRoomUtilization?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={meetingRoomUtilization.slice(0, 5)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="bookedHours"
                        nameKey="roomName"
                        stroke="none"
                      >
                        {meetingRoomUtilization.slice(0, 5).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${value} hrs`, 'Booked Hours']}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                      />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted-foreground text-sm">No meeting room data available.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="border-border/50 shadow-sm flex flex-col h-[520px]">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Recent Activity</span>
                <Clock className="w-4 h-4 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <div className="divide-y divide-border/40">
                {recentActivity?.map((activity: any, idx: number) => {
                  const ActivityIcon = 
                    activity.activityType === 'desk_booking' ? LayoutGrid : 
                    activity.activityType === 'meeting_room' ? CalendarDays : 
                    Wrench;
                  
                  return (
                    <div key={idx} className="p-4 hover:bg-muted/30 transition-colors flex gap-4">
                      <div className="mt-1 shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          activity.status === 'cancelled' ? 'bg-destructive/10 text-destructive' :
                          activity.activityType === 'maintenance' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-primary/10 text-primary'
                        }`}>
                          <ActivityIcon className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold truncate">{activity.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0 bg-muted/50 px-2 py-0.5 rounded-full">
                            {format(new Date(activity.activityAt), "MMM d, h:mm a")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{activity.summary}</p>
                        
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center text-[10px] text-muted-foreground font-medium">
                            <Users className="w-3 h-3 mr-1" />
                            <span className="truncate max-w-[100px]">{activity.actorName}</span>
                          </div>
                          {activity.subjectName && (
                            <div className="flex items-center text-[10px] text-muted-foreground font-medium">
                              <MapPin className="w-3 h-3 mr-1" />
                              <span className="truncate max-w-[100px]">{activity.subjectName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!recentActivity || recentActivity.length === 0) && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No recent activity.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
