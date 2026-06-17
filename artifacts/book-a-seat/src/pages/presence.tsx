import { useState, useMemo } from "react";
import { useListDeskBookings, useListMeetingRoomBookings } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Users, MapPin, CheckCircle2, Clock,
  Building2, ChevronRight, X, CalendarCheck,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PersonEntry {
  userId: number;
  name: string;
  department?: string | null;
  deskName: string;
  deskZone: string;
  status: "confirmed" | "checked_in";
  isMe: boolean;
}

interface MeetingEntry {
  userId: number;
  name: string;
  roomName: string;
  title: string;
  startTime: string;
  endTime: string;
}

// ─── Dept colour map ─────────────────────────────────────────────────────────

const DEPT_COLORS: Record<string, string> = {
  Engineering:  "bg-blue-100 text-blue-800 border-blue-200",
  Marketing:    "bg-pink-100 text-pink-800 border-pink-200",
  Design:       "bg-purple-100 text-purple-800 border-purple-200",
  Sales:        "bg-amber-100 text-amber-800 border-amber-200",
  IT:           "bg-cyan-100 text-cyan-800 border-cyan-200",
  Default:      "bg-gray-100 text-gray-700 border-gray-200",
};

function deptColor(dept?: string | null) {
  return DEPT_COLORS[dept ?? ""] ?? DEPT_COLORS.Default;
}

// ─── Avatar initials ─────────────────────────────────────────────────────────

function Avatar({ name, isMe }: { name: string; isMe: boolean }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
      isMe ? "bg-primary text-primary-foreground ring-2 ring-primary/30" : "bg-muted text-muted-foreground"
    }`}>
      {initials}
    </div>
  );
}

// ─── Presence card ───────────────────────────────────────────────────────────

function PersonCard({ p }: { p: PersonEntry }) {
  const checkedIn = p.status === "checked_in";
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border bg-card transition-all hover:shadow-sm ${
      p.isMe ? "border-primary/30 bg-primary/5" : "border-border"
    }`}>
      <Avatar name={p.name} isMe={p.isMe} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-sm truncate">{p.name}</span>
          {p.isMe && <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary text-primary">You</Badge>}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {p.department && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${deptColor(p.department)}`}>
              {p.department}
            </span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" />
            {p.deskName}
            <span className="opacity-60">· {p.deskZone}</span>
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {checkedIn ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Checked in
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" /> Booked
          </span>
        )}
        <Link href={`/floor-map`}>
          <button className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
            View on map <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
    </div>
  );
}

// ─── Mini floor heatmap ───────────────────────────────────────────────────────

const ROWS = [
  { label: "R1", desks: [1,2,3,4,5,6,7,8] },
  { label: "R2a", desks: [9,10,11,12,13,14,15,16] },
  { label: "R2b", desks: [17,18,19,20,21,22,23,24] },
  { label: "R3a", desks: [25,26,27,28,29,30,31,32] },
  { label: "R3b", desks: [33,34,35,36,37,38,39,40] },
  { label: "R4a", desks: [41,42,43,44,45,46,47,48] },
  { label: "R4b", desks: [49,50,51,52,53,54,55,56] },
  { label: "R5", desks: [57,58,59,60,61,62,63,64] },
  { label: "Mid", desks: [65,66,67,68,69,70] },
];

function MiniHeatmap({ presentDesks, checkedInDesks }: { presentDesks: Set<string>; checkedInDesks: Set<string> }) {
  return (
    <div className="space-y-1">
      {ROWS.map((row) => (
        <div key={row.label} className="flex items-center gap-1">
          <span className="text-[8px] text-gray-400 w-6 shrink-0 text-right">{row.label}</span>
          <div className="flex gap-0.5">
            {row.desks.map((n) => {
              const name = `W${String(n).padStart(3,"0")}`;
              const isCheckedIn = checkedInDesks.has(name);
              const isBooked = presentDesks.has(name);
              return (
                <div
                  key={n}
                  title={name}
                  className={`w-3 h-3 rounded-sm border ${
                    isCheckedIn
                      ? "bg-emerald-500 border-emerald-600"
                      : isBooked
                      ? "bg-blue-400 border-blue-500"
                      : "bg-gray-100 border-gray-200"
                  }`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-3 mt-2 pt-2 border-t">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-600" /> Checked in
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-400 border border-blue-500" /> Booked
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-sm bg-gray-100 border border-gray-200" /> Free
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Presence() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "checked_in">("all");

  const { data: bookingsData, isLoading } = useListDeskBookings({ date: today });
  const { data: roomBookingsData } = useListMeetingRoomBookings({ date: today });

  // ── Desk presence ──────────────────────────────────────────────────────────
  const people = useMemo((): PersonEntry[] => {
    const seen = new Set<number>();
    const list: PersonEntry[] = [];
    for (const b of bookingsData?.data ?? []) {
      if (b.status !== "confirmed" && b.status !== "checked_in") continue;
      if (seen.has(b.userId)) continue;
      seen.add(b.userId);
      const u = (b as any).user;
      const d = (b as any).desk;
      list.push({
        userId: b.userId,
        name: u?.name ?? `User ${b.userId}`,
        department: u?.department,
        deskName: d?.name ?? `Desk ${b.deskId}`,
        deskZone: d?.zone ?? "",
        status: b.status as "confirmed" | "checked_in",
        isMe: b.userId === user?.id,
      });
    }
    // Sort: me first, then checked-in, then booked
    list.sort((a, b) => {
      if (a.isMe) return -1;
      if (b.isMe) return 1;
      if (a.status === "checked_in" && b.status !== "checked_in") return -1;
      if (b.status === "checked_in" && a.status !== "checked_in") return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [bookingsData, user?.id]);

  // ── Meeting presence ───────────────────────────────────────────────────────
  const meetings = useMemo((): MeetingEntry[] => {
    return (roomBookingsData?.data ?? [])
      .filter((b) => b.status === "confirmed")
      .map((b) => ({
        userId: b.userId,
        name: (b as any).user?.name ?? `User ${b.userId}`,
        roomName: (b as any).room?.name ?? "Room",
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
      }));
  }, [roomBookingsData]);

  // ── Heatmap sets ──────────────────────────────────────────────────────────
  const presentDesks = useMemo(() => new Set(people.map((p) => p.deskName)), [people]);
  const checkedInDesks = useMemo(() => new Set(people.filter((p) => p.status === "checked_in").map((p) => p.deskName)), [people]);

  // ── Departments ────────────────────────────────────────────────────────────
  const departments = useMemo(() => {
    const s = new Set(people.map((p) => p.department ?? "Unknown"));
    return ["All", ...Array.from(s).sort()];
  }, [people]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      if (deptFilter !== "All" && (p.department ?? "Unknown") !== deptFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.deskName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [people, deptFilter, statusFilter, search]);

  // ── Counts ────────────────────────────────────────────────────────────────
  const checkedInCount = people.filter((p) => p.status === "checked_in").length;
  const bookedCount = people.filter((p) => p.status === "confirmed").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Team Presence</h1>
          <p className="text-sm text-muted-foreground">
            Who's in the office today · {format(new Date(), "EEEE, MMMM d")}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/floor-map">
            <MapPin className="w-4 h-4 mr-1.5" /> Floor Map
          </Link>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-4 pb-4 flex gap-3 items-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-emerald-800">{checkedInCount}</p>
              <p className="text-xs text-emerald-700">Checked in</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4 flex gap-3 items-center">
            <Clock className="w-8 h-8 text-blue-400 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-blue-800">{bookedCount}</p>
              <p className="text-xs text-blue-700">Expected today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex gap-3 items-center">
            <Users className="w-8 h-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold">{people.length}</p>
              <p className="text-xs text-muted-foreground">Total in office</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex gap-3 items-center">
            <Building2 className="w-8 h-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold">{meetings.length}</p>
              <p className="text-xs text-muted-foreground">Meetings today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4 items-start">
        {/* ── People list ── */}
        <div className="flex-1 space-y-3">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 w-44 text-sm"
                placeholder="Name or desk…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Status toggle */}
            <div className="flex gap-1">
              {(["all", "checked_in", "confirmed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    statusFilter === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {s === "all" ? "All" : s === "checked_in" ? "Checked in" : "Expected"}
                </button>
              ))}
            </div>

            {/* Dept chips */}
            <div className="flex gap-1 flex-wrap">
              {departments.map((d) => (
                <button
                  key={d}
                  onClick={() => setDeptFilter(d)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    deptFilter === d
                      ? "bg-primary text-primary-foreground border-primary"
                      : `${deptColor(d === "All" ? null : d)} hover:opacity-80`
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Loading presence data…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Users className="w-10 h-10 opacity-20" />
              <p className="text-sm">
                {people.length === 0 ? "No one has booked a desk for today yet." : "No results match your filters."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => (
                <PersonCard key={p.userId} p={p} />
              ))}
            </div>
          )}

          {/* Meetings section */}
          {meetings.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <CalendarCheck className="w-4 h-4" /> Today's Meetings
              </h3>
              {meetings.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-purple-50 border-purple-200">
                  <Building2 className="w-5 h-5 text-purple-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.roomName} · {m.name} · {format(new Date(m.startTime), "h:mm a")}–{format(new Date(m.endTime), "h:mm a")}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-purple-300 text-purple-700">
                    {m.roomName}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar: mini heatmap ── */}
        <div className="w-52 shrink-0 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Floor Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MiniHeatmap presentDesks={presentDesks} checkedInDesks={checkedInDesks} />
            </CardContent>
          </Card>

          {/* Dept breakdown */}
          {departments.filter((d) => d !== "All").length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  By Department
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {departments
                  .filter((d) => d !== "All")
                  .map((dept) => {
                    const count = people.filter((p) => (p.department ?? "Unknown") === dept).length;
                    return (
                      <div key={dept} className="flex items-center justify-between">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${deptColor(dept)}`}>
                          {dept}
                        </span>
                        <span className="text-xs font-bold">{count}</span>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
