import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Desks from "@/pages/desks";
import BookDesk from "@/pages/desks/book";
import MeetingRooms from "@/pages/meeting-rooms";
import BookMeetingRoom from "@/pages/meeting-rooms/book";
import MyBookings from "@/pages/my-bookings";
import MyMeetings from "@/pages/my-meetings";
import FloorMap from "@/pages/floor-map";
import Presence from "@/pages/presence";
import CheckIn from "@/pages/check-in";
import Notifications from "@/pages/notifications";
import AdminDesks from "@/pages/admin/desks";
import AdminMeetingRooms from "@/pages/admin/meeting-rooms";
import AdminUsers from "@/pages/admin/users";
import AdminMaintenance from "@/pages/admin/maintenance";
import AnalyticsPage from "@/pages/admin/analytics";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && location !== "/login") {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, location, setLocation]);

  if (isLoading) return null;
  if (!isAuthenticated) return null;
  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <p className="text-lg font-semibold">Access Denied</p>
        <p className="text-sm">You don't have permission to view this page.</p>
      </div>
    );
  }

  return <Component />;
}

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, [to, setLocation]);
  return null;
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/desks">
          <ProtectedRoute component={Desks} />
        </Route>
        <Route path="/desks/book">
          <ProtectedRoute component={BookDesk} />
        </Route>
        <Route path="/floor-map">
          <ProtectedRoute component={FloorMap} />
        </Route>
        <Route path="/presence">
          <ProtectedRoute component={Presence} />
        </Route>
        <Route path="/meeting-rooms">
          <ProtectedRoute component={MeetingRooms} />
        </Route>
        <Route path="/meeting-rooms/book">
          <ProtectedRoute component={BookMeetingRoom} />
        </Route>
        <Route path="/my-bookings">
          <ProtectedRoute component={MyBookings} />
        </Route>
        <Route path="/my-meetings">
          <ProtectedRoute component={MyMeetings} />
        </Route>
        <Route path="/check-in">
          <ProtectedRoute component={CheckIn} />
        </Route>
        <Route path="/notifications">
          <ProtectedRoute component={Notifications} />
        </Route>
        <Route path="/admin/desks">
          <ProtectedRoute component={AdminDesks} roles={["admin"]} />
        </Route>
        <Route path="/admin/meeting-rooms">
          <ProtectedRoute component={AdminMeetingRooms} roles={["admin", "team_lead"]} />
        </Route>
        <Route path="/admin/users">
          <ProtectedRoute component={AdminUsers} roles={["admin"]} />
        </Route>
        <Route path="/admin/maintenance">
          <ProtectedRoute component={AdminMaintenance} roles={["admin"]} />
        </Route>
        <Route path="/admin/analytics">
          <ProtectedRoute component={AnalyticsPage} roles={["admin"]} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
