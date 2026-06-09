import { useState, useMemo } from "react";
import { useListDesks, useListDeskBookings, useCreateDeskBooking, getListDeskBookingsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X, Monitor, Wrench, Users } from "lucide-react";

// Logical positions on a per-zone grid.
// Each desk has a [col, row] position within its zone block.
const DESK_POSITIONS: Record<string, { col: number; row: number }> = {
  "A-101": { col: 0, row: 0 },
  "A-102": { col: 1, row: 0 },
  "A-103": { col: 0, row: 1 },
  "B-101": { col: 0, row: 0 },
  "B-102": { col: 1, row: 0 },
  "C-101": { col: 0, row: 0 },
  "C-102": { col: 1, row: 0 },
  "C-103": { col: 2, row: 0 },
  "D-101": { col: 0, row: 0 },
  "D-102": { col: 1, row: 0 },
};

const FLOOR_ZONES: Record<string, { zone: string; label: string; cols: number; rows: number }[]> = {
  "Floor 1": [
    { zone: "Zone A", label: "Zone A — Open Workspace", cols: 3, rows: 2 },
    { zone: "Zone B", label: "Zone B — Collaborative Hub", cols: 3, rows: 2 },
  ],
  "Floor 2": [
    { zone: "Zone C", label: "Zone C — Focus Area", cols: 3, rows: 2 },
    { zone: "Zone D", label: "Zone D — Quiet Zone", cols: 3, rows: 2 },
  ],
};

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  available: {
    bg: "bg-emerald-50 hover:bg-emerald-100",
    border: "border-emerald-300",
    text: "text-emerald-800",
    dot: "bg-emerald-400",
  },
  booked: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-800",
    dot: "bg-blue-400",
  },
  checked_in: {
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    text: "text-indigo-800",
    dot: "bg-indigo-500",
  },
  maintenance: {
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    dot: "bg-red-400",
  },
  empty: {
    bg: "bg-muted/20 border-dashed",
    border: "border-muted",
    text: "text-muted-foreground",
    dot: "bg-muted",
  },
};

type DeskStatus = "available" | "booked" | "checked_in" | "maintenance" | "empty";

interface EnrichedDesk {
  id: number;
  name: string;
  floor: string;
  zone?: string | null;
  amenities?: string | null;
  qrCode?: string | null;
  status: string;
  bookingStatus?: DeskStatus;
  bookedBy?: string | null;
}

interface DeskCellProps {
  desk?: EnrichedDesk;
  selected: boolean;
  onClick: (desk: EnrichedDesk) => void;
}

function DeskCell({ desk, selected, onClick }: DeskCellProps) {
  if (!desk) {
    return (
      <div className="aspect-square rounded-lg border-2 border-dashed border-muted/40 bg-muted/10" />
    );
  }

  const displayStatus: DeskStatus = desk.bookingStatus ?? (desk.status === "maintenance" ? "maintenance" : "available");
  const styles = STATUS_STYLES[displayStatus] ?? STATUS_STYLES.empty;

  return (
    <button
      onClick={() => onClick(desk)}
      className={`
        aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 
        transition-all duration-150 cursor-pointer relative
        ${styles.bg} ${styles.border} ${styles.text}
        ${selected ? "ring-2 ring-primary ring-offset-1 scale-105 shadow-lg" : "hover:scale-103 hover:shadow-md"}
        ${displayStatus !== "available" ? "cursor-default" : ""}
      `}
      title={`${desk.name} — ${displayStatus}`}
    >
      <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
      <span className="text-[10px] font-bold leading-none">{desk.name.split("-")[1]}</span>
      <Monitor className="w-3 h-3 opacity-60" />
    </button>
  );
}

function DeskDetailPanel({
  desk,
  dateStr,
  onClose,
  onBook,
  isBooking,
}: {
  desk: EnrichedDesk;
  dateStr: string;
  onClose: () => void;
  onBook: (deskId: number) => void;
  isBooking: boolean;
}) {
  const displayStatus: DeskStatus = desk.bookingStatus ?? (desk.status === "maintenance" ? "maintenance" : "available");
  const styles = STATUS_STYLES[displayStatus];

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{desk.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{desk.floor} · {desk.zone}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${styles.dot}`} />
          <Badge
            variant={displayStatus === "available" ? "default" : displayStatus === "maintenance" ? "destructive" : "secondary"}
            className="capitalize"
          >
            {displayStatus === "booked" ? "Booked" : displayStatus === "checked_in" ? "Checked In" : displayStatus}
          </Badge>
        </div>

        {desk.amenities && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Amenities</p>
            <p className="text-sm">{desk.amenities}</p>
          </div>
        )}

        {desk.qrCode && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">QR Code</p>
            <p className="text-sm font-mono">{desk.qrCode}</p>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Selected Date</p>
          <p className="text-sm">{format(new Date(dateStr), "EEEE, MMMM d, yyyy")}</p>
        </div>

        {displayStatus === "available" ? (
          <Button className="w-full" onClick={() => onBook(desk.id)} disabled={isBooking}>
            {isBooking ? "Booking..." : "Book This Desk"}
          </Button>
        ) : displayStatus === "maintenance" ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
            <Wrench className="w-4 h-4 shrink-0" />
            This desk is under maintenance
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <Users className="w-4 h-4 shrink-0" />
            This desk is already booked for the selected date
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FloorMap() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedFloor, setSelectedFloor] = useState<string>("Floor 1");
  const [selectedDesk, setSelectedDesk] = useState<EnrichedDesk | null>(null);
  const [calOpen, setCalOpen] = useState(false);

  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: allDesks, isLoading: desksLoading } = useListDesks();
  const { data: bookingsData, isLoading: bookingsLoading } = useListDeskBookings({ date: dateStr });
  const bookMutation = useCreateDeskBooking();

  const bookingsByDeskId = useMemo(() => {
    const map: Record<number, string> = {};
    for (const b of bookingsData?.data ?? []) {
      if (b.status === "confirmed") map[b.deskId] = "booked";
      else if (b.status === "checked_in") map[b.deskId] = "checked_in";
    }
    return map;
  }, [bookingsData]);

  const enrichedDesks = useMemo((): EnrichedDesk[] => {
    return (allDesks ?? []).map((d) => ({
      ...d,
      bookingStatus: d.status === "maintenance"
        ? "maintenance"
        : (bookingsByDeskId[d.id] as DeskStatus | undefined) ?? "available",
    }));
  }, [allDesks, bookingsByDeskId]);

  const floorDesks = useMemo(() => {
    return enrichedDesks.filter((d) => d.floor === selectedFloor);
  }, [enrichedDesks, selectedFloor]);

  const floorZones = FLOOR_ZONES[selectedFloor] ?? [];

  const statusCounts = useMemo(() => {
    const counts = { available: 0, booked: 0, checked_in: 0, maintenance: 0 };
    for (const d of floorDesks) {
      const s = d.bookingStatus ?? "available";
      if (s in counts) counts[s as keyof typeof counts]++;
    }
    return counts;
  }, [floorDesks]);

  const handleBook = (deskId: number) => {
    bookMutation.mutate(
      { data: { deskId, date: dateStr } },
      {
        onSuccess: () => {
          toast.success("Desk booked! Check your bookings to confirm.");
          queryClient.invalidateQueries({ queryKey: getListDeskBookingsQueryKey() });
          setSelectedDesk(null);
          setLocation("/my-bookings");
        },
        onError: (err: any) => {
          toast.error("Booking failed: " + (err.data?.error || err.message));
        },
      }
    );
  };

  const handleDeskClick = (desk: EnrichedDesk) => {
    setSelectedDesk((prev) => (prev?.id === desk.id ? null : desk));
  };

  const isLoading = desksLoading || bookingsLoading;

  const floors = Object.keys(FLOOR_ZONES);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Floor Map</h1>
          <p className="text-muted-foreground mt-1 text-sm">Click a desk to see details and book</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Date picker */}
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(selectedDate, "MMM d, yyyy")}
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
      </div>

      {/* Floor tabs */}
      <div className="flex gap-2">
        {floors.map((floor) => (
          <button
            key={floor}
            onClick={() => { setSelectedFloor(floor); setSelectedDesk(null); }}
            className={`px-5 py-2 rounded-full text-sm font-medium border transition-colors ${
              selectedFloor === floor
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-muted"
            }`}
          >
            {floor}
          </button>
        ))}
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {([
          ["available", "Available", statusCounts.available],
          ["booked", "Booked", statusCounts.booked],
          ["checked_in", "Checked In", statusCounts.checked_in],
          ["maintenance", "Maintenance", statusCounts.maintenance],
        ] as [string, string, number][]).map(([status, label, count]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${STATUS_STYLES[status]?.dot}`} />
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold text-foreground">{count}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading floor plan...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Floor plan */}
          <div className="lg:col-span-2 space-y-8">
            {/* Floor outline */}
            <div className="relative border-2 border-border rounded-2xl p-6 bg-card shadow-sm overflow-hidden">
              {/* Floor label watermark */}
              <div className="absolute top-3 right-4 text-xs font-semibold text-muted-foreground/40 uppercase tracking-widest">
                {selectedFloor}
              </div>

              {/* Walkway indicator */}
              <div className="absolute left-1/2 top-6 bottom-6 w-px bg-muted-foreground/10 -translate-x-1/2" />

              <div className="grid grid-cols-2 gap-10">
                {floorZones.map(({ zone, label, cols, rows }) => {
                  const zoneDesks = floorDesks.filter((d) => d.zone === zone);

                  // Build grid: place desks by their known positions, leave blanks for gaps
                  const grid: (EnrichedDesk | undefined)[][] = Array.from({ length: rows }, () =>
                    Array.from({ length: cols }, () => undefined)
                  );

                  for (const desk of zoneDesks) {
                    const pos = DESK_POSITIONS[desk.name];
                    if (pos && pos.row < rows && pos.col < cols) {
                      grid[pos.row][pos.col] = desk;
                    } else {
                      // Fallback: first empty slot
                      outer: for (let r = 0; r < rows; r++) {
                        for (let c = 0; c < cols; c++) {
                          if (!grid[r][c]) {
                            grid[r][c] = desk;
                            break outer;
                          }
                        }
                      }
                    }
                  }

                  return (
                    <div key={zone} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div
                        className="grid gap-3 p-4 bg-muted/20 rounded-xl border border-border/50"
                        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                      >
                        {grid.flatMap((row, ri) =>
                          row.map((desk, ci) => (
                            <DeskCell
                              key={desk ? desk.id : `empty-${ri}-${ci}`}
                              desk={desk}
                              selected={selectedDesk?.id === desk?.id}
                              onClick={handleDeskClick}
                            />
                          ))
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        {zoneDesks.filter((d) => d.bookingStatus === "available").length} of {zoneDesks.length} desks available
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Facilities legend at bottom */}
              <div className="mt-6 pt-4 border-t border-border/40 flex gap-6 justify-center">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-8 h-2 bg-muted rounded" />
                  Walkway
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-4 h-4 rounded border-2 border-border" />
                  Desk
                </div>
              </div>
            </div>

            {/* Date context */}
            <div className="text-xs text-center text-muted-foreground">
              Showing availability for <strong>{format(selectedDate, "EEEE, MMMM d, yyyy")}</strong>
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-1">
            {selectedDesk ? (
              <DeskDetailPanel
                desk={selectedDesk}
                dateStr={dateStr}
                onClose={() => setSelectedDesk(null)}
                onBook={handleBook}
                isBooking={bookMutation.isPending}
              />
            ) : (
              <Card className="border-dashed">
                <CardContent className="pt-8 pb-8 flex flex-col items-center justify-center text-center gap-3">
                  <Monitor className="w-10 h-10 text-muted-foreground/40" />
                  <div>
                    <p className="font-medium text-muted-foreground">Select a desk</p>
                    <p className="text-sm text-muted-foreground/60 mt-1">Click any desk on the floor plan to view details and book it</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick stats card */}
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {selectedFloor} Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { label: "Total Desks", value: floorDesks.length, color: "text-foreground" },
                    { label: "Available", value: statusCounts.available, color: "text-emerald-600" },
                    { label: "Booked", value: statusCounts.booked + statusCounts.checked_in, color: "text-blue-600" },
                    { label: "Maintenance", value: statusCounts.maintenance, color: "text-red-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Occupancy</span>
                      <span className="font-bold">
                        {floorDesks.length > 0
                          ? Math.round(((statusCounts.booked + statusCounts.checked_in) / floorDesks.length) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{
                          width: `${floorDesks.length > 0
                            ? ((statusCounts.booked + statusCounts.checked_in) / floorDesks.length) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
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
