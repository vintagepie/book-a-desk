import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, LayoutDashboard, Monitor, CalendarDays, BookOpen, CalendarCheck, QrCode, Users, Wrench, BarChart3, Building2, Map, UserCheck } from "lucide-react";
import { useListNotifications } from "@workspace/api-client-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["employee", "team_lead", "admin"] },
  { href: "/desks", label: "Browse Desks", icon: Monitor, roles: ["employee", "team_lead", "admin"] },
  { href: "/floor-map", label: "Floor Map", icon: Map, roles: ["employee", "team_lead", "admin"] },
  { href: "/presence", label: "Who's In Today", icon: UserCheck, roles: ["employee", "team_lead", "admin"] },
  { href: "/my-bookings", label: "My Desk Bookings", icon: BookOpen, roles: ["employee", "team_lead", "admin"] },
  { href: "/check-in", label: "Check In", icon: QrCode, roles: ["employee", "team_lead", "admin"] },
  { href: "/meeting-rooms", label: "Meeting Rooms", icon: Building2, roles: ["team_lead", "admin"] },
  { href: "/my-meetings", label: "My Meetings", icon: CalendarCheck, roles: ["team_lead", "admin"] },
  { href: "/notifications", label: "Notifications", icon: Bell, roles: ["employee", "team_lead", "admin"] },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin/desks", label: "Manage Desks", icon: Monitor, roles: ["admin"] },
  { href: "/admin/meeting-rooms", label: "Room Overview", icon: CalendarDays, roles: ["admin", "team_lead"] },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["admin"] },
  { href: "/admin/maintenance", label: "Maintenance", icon: Wrench, roles: ["admin"] },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, roles: ["admin"] },
];

function NavLink({ item, location }: { item: NavItem; location: string }) {
  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { data: notifications } = useListNotifications();

  if (!user) return <>{children}</>;

  const unread = notifications?.filter((n: any) => !n.isRead).length ?? 0;
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const visibleAdmin = ADMIN_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-5 border-b border-sidebar-border">
          <div className="font-bold text-lg text-sidebar-foreground">Book a Seat</div>
          <div className="text-xs text-sidebar-foreground/60 mt-0.5">Workspace Management</div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">
          {visibleNav.map((item) => (
            item.href === "/notifications" ? (
              <div key={item.href} className="relative">
                <NavLink item={item} location={location} />
                {unread > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </div>
            ) : (
              <NavLink key={item.href} item={item} location={location} />
            )
          ))}

          {visibleAdmin.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Administration
                </span>
              </div>
              {visibleAdmin.map((item) => (
                <NavLink key={item.href} item={item} location={location} />
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-sidebar-accent-foreground shrink-0">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{user.name}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate capitalize">{user.role?.replace("_", " ")}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full text-xs text-sidebar-foreground/60 hover:text-destructive transition-colors text-left"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
