import { useState, useMemo } from "react";
import {
  useListDesks,
  useListDeskBookings,
  useCreateDeskBooking,
  useCancelDeskBooking,
  useListMeetingRooms,
  useListMeetingRoomBookings,
  getListDeskBookingsQueryKey,
  getListMeetingRoomBookingsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Search, X, Monitor, Wrench, Users, ChevronDown } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type DeskDisplayStatus = "available" | "booked" | "occupied" | "maintenance";

interface EnrichedDesk {
  id: number;
  name: string;
  zone: string;
  amenities?: string | null;
  qrCode?: string | null;
  status: string;
  displayStatus: DeskDisplayStatus;
  bookedByName?: string | null;
  bookingId?: number;
  isMyBooking?: boolean;
}

// ─── Status config ──────────────────────────────────────────────────────────

const STATUS: Record<DeskDisplayStatus, { bg: string; border: string; text: string; dot: string; label: string }> = {
  available:   { bg: "bg-emerald-100 hover:bg-emerald-200",  border: "border-emerald-400", text: "text-emerald-900", dot: "bg-emerald-500",  label: "Available"    },
  booked:      { bg: "bg-red-100",                            border: "border-red-400",     text: "text-red-900",     dot: "bg-red-500",      label: "Booked"       },
  occupied:    { bg: "bg-orange-100",                         border: "border-orange-400",  text: "text-orange-900",  dot: "bg-orange-500",   label: "Occupied"     },
  maintenance: { bg: "bg-gray-100",                           border: "border-gray-400",    text: "text-gray-600",    dot: "bg-gray-400",     label: "Maintenance"  },
};

// ─── Desk cell ──────────────────────────────────────────────────────────────

function DeskCell({
  desk,
  selected,
  dimmed,
  facingDown,
  onClick,
}: {
  desk: EnrichedDesk;
  selected: boolean;
  dimmed: boolean;
  facingDown: boolean;
  onClick: () => void;
}) {
  const st = STATUS[desk.displayStatus];
  const num = desk.name.replace("W", "");

  return (
    <button
      onClick={onClick}
      title={`${desk.name}${desk.bookedByName ? " — " + desk.bookedByName : ""}`}
      className={`
        relative flex flex-col items-center justify-center gap-0.5
        rounded border-2 cursor-pointer select-none transition-all duration-100
        w-10 h-10
        ${st.bg} ${st.border} ${st.text}
        ${selected ? "ring-2 ring-primary ring-offset-1 scale-110 shadow-lg z-10" : "hover:scale-105 hover:shadow-md"}
        ${dimmed ? "opacity-30" : ""}
      `}
    >
      {/* Orientation notch */}
      <div className={`absolute w-4 h-0.5 bg-current opacity-40 rounded-full ${facingDown ? "bottom-0.5" : "top-0.5"}`} />
      <span className="text-[9px] font-bold leading-none mt-1">{num}</span>
      {desk.bookedByName && (
        <span className="text-[7px] leading-none truncate max-w-[32px] opacity-80">
          {desk.bookedByName.split(" ")[0]}
        </span>
      )}
    </button>
  );
}

// ─── Empty placeholder ──────────────────────────────────────────────────────

function EmptyCell() {
  return <div className="w-10 h-10 rounded border border-dashed border-gray-200 bg-gray-50/50 opacity-40" />;
}

// ─── Aisle ──────────────────────────────────────────────────────────────────

function Aisle({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-[9px] text-gray-400 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

// ─── Row renderer ──────────────────────────────────────────────────────────

function DeskRow({
  desks,
  selectedId,
  dimmedSet,
  facingDown,
  onSelect,
}: {
  desks: (EnrichedDesk | null)[];
  selectedId?: number;
  dimmedSet: Set<number>;
  facingDown: boolean;
  onSelect: (d: EnrichedDesk) => void;
}) {
  return (
    <div className="flex gap-1.5 justify-center flex-wrap">
      {desks.map((d, i) =>
        d ? (
          <DeskCell
            key={d.id}
            desk={d}
            selected={selectedId === d.id}
            dimmed={dimmedSet.size > 0 && !dimmedSet.has(d.id)}
            facingDown={facingDown}
            onClick={() => onSelect(d)}
          />
        ) : (
          <EmptyCell key={`empty-${i}`} />
        )
      )}
    </div>
  );
}

// ─── Meeting room cell ──────────────────────────────────────────────────────

function MeetingRoomCell({
  room,
  bookedToday,
  selected,
  onSelect,
}: {
  room: { id: number; name: string; capacity: number; facilities?: string | null };
  bookedToday: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        flex flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 transition-all
        w-full min-h-[64px] text-center cursor-pointer
        ${bookedToday ? "bg-blue-100 border-blue-400 text-blue-900" : "bg-purple-50 border-purple-300 text-purple-900 hover:bg-purple-100"}
        ${selected ? "ring-2 ring-primary ring-offset-1 scale-[1.02] shadow-lg" : "hover:shadow-md"}
      `}
    >
      <Users className="w-4 h-4 opacity-70" />
      <span className="text-[10px] font-bold leading-none">{room.name}</span>
      <span className="text-[8px] opacity-60">Cap: {room.capacity}</span>
    </button>
  );
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

type PanelItem =
  | { type: "desk"; desk: EnrichedDesk }
  | { type: "room"; room: { id: number; name: string; capacity: number; facilities?: string | null; description?: string | null } };

function DetailPanel({
  item,
  dateStr,
  onClose,
  onBookDesk,
  onCancelDesk,
  isBooking,
  isCancelling,
}: {
  item: PanelItem;
  dateStr: string;
  onClose: () => void;
  onBookDesk: (deskId: number) => void;
  onCancelDesk: (bookingId: number) => void;
  isBooking: boolean;
  isCancelling: boolean;
}) {
  if (item.type === "desk") {
    const { desk } = item;
    const st = STATUS[desk.displayStatus];
    return (
      <Card className="border-2">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{desk.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{desk.zone}</p>
            </div>
            <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
            <Badge variant={desk.displayStatus === "available" ? "default" : desk.displayStatus === "maintenance" ? "destructive" : "secondary"} className="capitalize text-xs">
              {st.label}
            </Badge>
          </div>

          {desk.bookedByName && (
            <div className="p-2 bg-muted rounded text-sm flex items-center gap-2">
              <Users className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span>{desk.bookedByName}</span>
            </div>
          )}

          {desk.amenities && <p className="text-xs text-muted-foreground">{desk.amenities}</p>}
          {desk.qrCode && <p className="text-xs font-mono text-muted-foreground">QR: {desk.qrCode}</p>}
          <p className="text-xs text-muted-foreground">{format(new Date(dateStr), "EEE, MMM d yyyy")}</p>

          {desk.displayStatus === "available" && (
            <Button size="sm" className="w-full" onClick={() => onBookDesk(desk.id)} disabled={isBooking}>
              {isBooking ? "Booking…" : "Book This Desk"}
            </Button>
          )}
          {desk.isMyBooking && desk.bookingId && (desk.displayStatus === "booked") && (
            <Button size="sm" variant="destructive" className="w-full" onClick={() => onCancelDesk(desk.bookingId!)} disabled={isCancelling}>
              {isCancelling ? "Cancelling…" : "Cancel My Booking"}
            </Button>
          )}
          {desk.displayStatus === "maintenance" && (
            <div className="flex items-center gap-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
              <Wrench className="w-3.5 h-3.5" /> Under maintenance
            </div>
          )}
          {desk.displayStatus === "booked" && !desk.isMyBooking && (
            <p className="text-xs text-muted-foreground text-center">This desk is already booked</p>
          )}
          {desk.displayStatus === "occupied" && (
            <p className="text-xs text-muted-foreground text-center">Employee is currently checked in</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Room panel
  const { room } = item;
  return (
    <Card className="border-2 border-purple-300">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{room.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Meeting Room</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span>Capacity: <strong>{room.capacity}</strong></span>
        </div>
        {room.facilities && <p className="text-xs text-muted-foreground">{room.facilities}</p>}
        {room.description && <p className="text-xs text-muted-foreground">{room.description}</p>}
        <Button size="sm" className="w-full" asChild>
          <a href="/meeting-rooms/book">Book This Room</a>
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function FloorMap() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | DeskDisplayStatus>("all");
  const [selectedDesk, setSelectedDesk] = useState<EnrichedDesk | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: allDesks = [], isLoading: desksLoading } = useListDesks();
  const { data: bookingsData, isLoading: bookingsLoading } = useListDeskBookings({ date: dateStr });
  const { data: rooms = [] } = useListMeetingRooms();
  const { data: roomBookingsData } = useListMeetingRoomBookings({ date: dateStr });

  const bookMutation = useCreateDeskBooking();
  const cancelMutation = useCancelDeskBooking();

  // Build booking map: deskId → {status, userName, bookingId, isMine}
  const bookingMap = useMemo(() => {
    const m: Record<number, { status: string; name: string; bookingId: number; isMyBooking: boolean }> = {};
    for (const b of bookingsData?.data ?? []) {
      if (b.status === "confirmed" || b.status === "checked_in") {
        m[b.deskId] = {
          status: b.status,
          name: (b as any).user?.name ?? "",
          bookingId: b.id,
          isMyBooking: b.userId === user?.id,
        };
      }
    }
    return m;
  }, [bookingsData, user?.id]);

  // Enrich desks
  const enriched = useMemo((): EnrichedDesk[] => {
    return allDesks.map((d) => {
      const bk = bookingMap[d.id];
      let displayStatus: DeskDisplayStatus = "available";
      if (d.status === "maintenance") displayStatus = "maintenance";
      else if (bk?.status === "checked_in") displayStatus = "occupied";
      else if (bk?.status === "confirmed") displayStatus = "booked";

      return {
        id: d.id,
        name: d.name,
        zone: d.zone ?? "",
        amenities: d.amenities,
        qrCode: d.qrCode,
        status: d.status,
        displayStatus,
        bookedByName: bk?.name || null,
        bookingId: bk?.bookingId,
        isMyBooking: bk?.isMyBooking,
      };
    });
  }, [allDesks, bookingMap]);

  // Index by name
  const deskByName = useMemo(() => {
    const m: Record<string, EnrichedDesk> = {};
    for (const d of enriched) m[d.name] = d;
    return m;
  }, [enriched]);

  // Search + filter → set of desk IDs to highlight
  const highlightSet = useMemo((): Set<number> => {
    const nameQ = search.trim().toLowerCase();
    const hasFilter = nameQ || filterStatus !== "all";
    if (!hasFilter) return new Set();
    return new Set(
      enriched
        .filter((d) => {
          const matchName = nameQ ? (d.bookedByName?.toLowerCase().includes(nameQ) || d.name.toLowerCase().includes(nameQ)) : true;
          const matchStatus = filterStatus !== "all" ? d.displayStatus === filterStatus : true;
          return matchName && matchStatus;
        })
        .map((d) => d.id)
    );
  }, [enriched, search, filterStatus]);

  const hasDimming = highlightSet.size > 0;
  const dimmedSet = hasDimming ? new Set(enriched.map((d) => d.id).filter((id) => !highlightSet.has(id))) : new Set<number>();

  // Today's room booking status
  const roomBookedTodayIds = useMemo(() => {
    const s = new Set<number>();
    for (const b of roomBookingsData?.data ?? []) {
      if (b.status === "confirmed") s.add(b.roomId);
    }
    return s;
  }, [roomBookingsData]);

  const selectedRoom = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) ?? null : null;

  function getDeskRow(nums: number[]): (EnrichedDesk | null)[] {
    return nums.map((n) => deskByName[`W${String(n).padStart(3, "0")}`] ?? null);
  }

  function handleSelectDesk(d: EnrichedDesk) {
    setSelectedRoomId(null);
    setSelectedDesk((prev) => (prev?.id === d.id ? null : d));
  }

  function handleSelectRoom(id: number) {
    setSelectedDesk(null);
    setSelectedRoomId((prev) => (prev === id ? null : id));
  }

  function handleBookDesk(deskId: number) {
    bookMutation.mutate({ data: { deskId, date: dateStr } }, {
      onSuccess: () => {
        toast.success("Desk booked successfully!");
        queryClient.invalidateQueries({ queryKey: getListDeskBookingsQueryKey() });
        setSelectedDesk(null);
      },
      onError: (err: any) => toast.error(err.data?.error || err.message),
    });
  }

  function handleCancelDesk(bookingId: number) {
    cancelMutation.mutate({ id: bookingId }, {
      onSuccess: () => {
        toast.success("Booking cancelled");
        queryClient.invalidateQueries({ queryKey: getListDeskBookingsQueryKey() });
        setSelectedDesk(null);
      },
      onError: (err: any) => toast.error(err.data?.error || err.message),
    });
  }

  const isLoading = desksLoading || bookingsLoading;

  // Status counts
  const counts = useMemo(() => {
    const c = { available: 0, booked: 0, occupied: 0, maintenance: 0 };
    for (const d of enriched) c[d.displayStatus]++;
    return c;
  }, [enriched]);

  const mr01 = rooms.find((r) => r.name === "MR-01");
  const mr02 = rooms.find((r) => r.name === "MR-02");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Office Floor Plan</h1>
          <p className="text-sm text-muted-foreground">Floor 1 — 70 workplaces · 2 meeting rooms</p>
        </div>
        {/* Date picker */}
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              {format(selectedDate, "MMM d, yyyy")}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) { setSelectedDate(d); setCalOpen(false); setSelectedDesk(null); } }}
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Search + filter toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 w-48 text-sm"
            placeholder="Search employee or desk…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-muted-foreground" /></button>}
        </div>
        <div className="flex gap-1">
          {(["all", "available", "booked", "occupied", "maintenance"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {s === "all" ? "All" : STATUS[s].label}
              {s !== "all" && <span className="ml-1 opacity-70">({counts[s]})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.entries(STATUS) as [DeskDisplayStatus, typeof STATUS[DeskDisplayStatus]][]).map(([key, v]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm border ${v.bg.split(" ")[0]} ${v.border}`} />
            <span className="text-muted-foreground">{v.label}</span>
            <span className="font-semibold">{counts[key]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-10 h-3 rounded border-2 border-purple-300 bg-purple-50" />
          <span className="text-muted-foreground">Meeting Room</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading floor plan…</div>
      ) : (
        <div className="flex gap-4">
          {/* ── Floor plan canvas ── */}
          <div className="flex-1 border-2 border-border rounded-2xl bg-white shadow-sm overflow-x-auto">
            <div className="min-w-[720px] p-6">
              {/* Floor label */}
              <div className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-300 mb-4">
                Floor 1 — Office Layout
              </div>

              {/* Main layout: left side-panel (meeting rooms) + right main rows */}
              <div className="flex gap-6">

                {/* ── Left column: meeting rooms + middle desks ── */}
                <div className="flex flex-col gap-2 shrink-0 w-28">
                  {/* Top wall label */}
                  <div className="text-[9px] text-center text-gray-300 uppercase tracking-widest mb-1">Side Panel</div>

                  {mr01 && (
                    <MeetingRoomCell
                      room={mr01}
                      bookedToday={roomBookedTodayIds.has(mr01.id)}
                      selected={selectedRoomId === mr01.id}
                      onSelect={() => handleSelectRoom(mr01.id)}
                    />
                  )}

                  <Aisle label="W065–W067" />

                  {/* Middle desks: 3 facing up */}
                  <div className="flex flex-col gap-1.5 items-center">
                    <DeskRow
                      desks={getDeskRow([65, 66, 67])}
                      selectedId={selectedDesk?.id}
                      dimmedSet={dimmedSet}
                      facingDown={false}
                      onSelect={handleSelectDesk}
                    />
                  </div>

                  <Aisle label="W068–W070" />

                  {/* Middle desks: 3 facing down */}
                  <div className="flex flex-col gap-1.5 items-center">
                    <DeskRow
                      desks={getDeskRow([68, 69, 70])}
                      selectedId={selectedDesk?.id}
                      dimmedSet={dimmedSet}
                      facingDown={true}
                      onSelect={handleSelectDesk}
                    />
                  </div>

                  <Aisle label="W068–W070" />

                  {mr02 && (
                    <MeetingRoomCell
                      room={mr02}
                      bookedToday={roomBookedTodayIds.has(mr02.id)}
                      selected={selectedRoomId === mr02.id}
                      onSelect={() => handleSelectRoom(mr02.id)}
                    />
                  )}
                </div>

                {/* ── Main rows ── */}
                <div className="flex-1 flex flex-col gap-0">

                  {/* Top wall */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-3 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest">North Wall</span>
                    </div>
                  </div>

                  {/* Row 1: W001–W008, facing wall (up) */}
                  <div className="mb-1">
                    <div className="text-[9px] text-center text-gray-400 mb-1">Row 1 (W001–W008)</div>
                    <DeskRow
                      desks={getDeskRow([1,2,3,4,5,6,7,8])}
                      selectedId={selectedDesk?.id}
                      dimmedSet={dimmedSet}
                      facingDown={false}
                      onSelect={handleSelectDesk}
                    />
                  </div>

                  <Aisle label="Walkway A" />

                  {/* Row 2: W009–W024 — 8 facing up, aisle, 8 facing down */}
                  <div className="mb-1">
                    <div className="text-[9px] text-center text-gray-400 mb-1">Row 2 (W009–W024)</div>
                    <DeskRow desks={getDeskRow([9,10,11,12,13,14,15,16])} selectedId={selectedDesk?.id} dimmedSet={dimmedSet} facingDown={false} onSelect={handleSelectDesk} />
                    <div className="my-1 mx-4 h-px bg-gray-100" />
                    <DeskRow desks={getDeskRow([17,18,19,20,21,22,23,24])} selectedId={selectedDesk?.id} dimmedSet={dimmedSet} facingDown={true} onSelect={handleSelectDesk} />
                  </div>

                  <Aisle label="Walkway B" />

                  {/* Row 3: W025–W040 */}
                  <div className="mb-1">
                    <div className="text-[9px] text-center text-gray-400 mb-1">Row 3 (W025–W040)</div>
                    <DeskRow desks={getDeskRow([25,26,27,28,29,30,31,32])} selectedId={selectedDesk?.id} dimmedSet={dimmedSet} facingDown={false} onSelect={handleSelectDesk} />
                    <div className="my-1 mx-4 h-px bg-gray-100" />
                    <DeskRow desks={getDeskRow([33,34,35,36,37,38,39,40])} selectedId={selectedDesk?.id} dimmedSet={dimmedSet} facingDown={true} onSelect={handleSelectDesk} />
                  </div>

                  <Aisle label="Walkway C" />

                  {/* Row 4: W041–W056 */}
                  <div className="mb-1">
                    <div className="text-[9px] text-center text-gray-400 mb-1">Row 4 (W041–W056)</div>
                    <DeskRow desks={getDeskRow([41,42,43,44,45,46,47,48])} selectedId={selectedDesk?.id} dimmedSet={dimmedSet} facingDown={false} onSelect={handleSelectDesk} />
                    <div className="my-1 mx-4 h-px bg-gray-100" />
                    <DeskRow desks={getDeskRow([49,50,51,52,53,54,55,56])} selectedId={selectedDesk?.id} dimmedSet={dimmedSet} facingDown={true} onSelect={handleSelectDesk} />
                  </div>

                  <Aisle label="Walkway D" />

                  {/* Row 5: W057–W064, facing wall (down) */}
                  <div className="mb-2">
                    <div className="text-[9px] text-center text-gray-400 mb-1">Row 5 (W057–W064)</div>
                    <DeskRow
                      desks={getDeskRow([57,58,59,60,61,62,63,64])}
                      selectedId={selectedDesk?.id}
                      dimmedSet={dimmedSet}
                      facingDown={true}
                      onSelect={handleSelectDesk}
                    />
                  </div>

                  {/* South wall */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-3 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest">South Wall</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Date watermark */}
              <div className="text-center text-[10px] text-gray-300 mt-4">
                Showing availability for <strong className="text-gray-400">{format(selectedDate, "EEEE, MMMM d yyyy")}</strong>
              </div>
            </div>
          </div>

          {/* ── Detail panel ── */}
          <div className="w-56 shrink-0 space-y-3">
            {(selectedDesk || selectedRoom) ? (
              <DetailPanel
                item={selectedDesk ? { type: "desk", desk: selectedDesk } : { type: "room", room: selectedRoom! }}
                dateStr={dateStr}
                onClose={() => { setSelectedDesk(null); setSelectedRoomId(null); }}
                onBookDesk={handleBookDesk}
                onCancelDesk={handleCancelDesk}
                isBooking={bookMutation.isPending}
                isCancelling={cancelMutation.isPending}
              />
            ) : (
              <Card className="border-dashed">
                <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center text-center gap-2">
                  <Monitor className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Click a desk or meeting room to view details</p>
                </CardContent>
              </Card>
            )}

            {/* Floor summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Floor Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {(Object.entries(counts) as [DeskDisplayStatus, number][]).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${STATUS[key].dot}`} />
                      <span className="text-muted-foreground">{STATUS[key].label}</span>
                    </div>
                    <span className="font-bold">{val}</span>
                  </div>
                ))}
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Occupancy</span>
                    <span className="font-bold">
                      {enriched.length > 0 ? Math.round(((counts.booked + counts.occupied) / enriched.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${enriched.length > 0 ? ((counts.booked + counts.occupied) / enriched.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
