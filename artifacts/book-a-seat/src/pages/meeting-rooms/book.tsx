import { useState } from "react";
import { useListMeetingRooms, useCreateMeetingRoomBooking, getListMeetingRoomBookingsQueryKey } from "@workspace/api-client-react";
import { useLocation, useSearch } from "wouter";
import { format, addHours, setHours, setMinutes } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

export default function BookMeetingRoom() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preSelectedId = params.get("roomId");

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedRoomId, setSelectedRoomId] = useState<string>(preSelectedId ?? "");
  const [startHour, setStartHour] = useState("9");
  const [endHour, setEndHour] = useState("10");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState("");

  const { data: rooms, isLoading } = useListMeetingRooms();
  const bookMutation = useCreateMeetingRoomBooking();

  const handleBook = () => {
    if (!date || !selectedRoomId || !title) {
      toast.error("Please fill in required fields");
      return;
    }

    const start = setMinutes(setHours(date, parseInt(startHour)), 0);
    const end = setMinutes(setHours(date, parseInt(endHour)), 0);

    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }

    bookMutation.mutate(
      {
        data: {
          roomId: parseInt(selectedRoomId),
          title,
          description: description || undefined,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          attendees: attendees || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Room booked successfully");
          queryClient.invalidateQueries({ queryKey: getListMeetingRoomBookingsQueryKey() });
          setLocation("/my-meetings");
        },
        onError: (err: any) => {
          toast.error("Failed to book room: " + (err.data?.error || err.message || "Unknown error"));
        },
      }
    );
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Book a Meeting Room</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Select Date</CardTitle></CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-3 space-y-4">
          <div className="space-y-2">
            <Label>Meeting Room *</Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms?.map((room) => (
                  <SelectItem key={room.id} value={String(room.id)}>
                    {room.name} (Cap: {room.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Select value={startHour} onValueChange={setStartHour}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {format(setHours(new Date(), h), "h:00 a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>End Time *</Label>
              <Select value={endHour} onValueChange={setEndHour}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.filter((h) => h > parseInt(startHour)).map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {format(setHours(new Date(), h), "h:00 a")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Meeting Title *</Label>
            <Input
              placeholder="e.g. Q4 Planning Session"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of the meeting..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Attendees (comma-separated emails)</Label>
            <Input
              placeholder="john@company.com, jane@company.com"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={handleBook}
              disabled={bookMutation.isPending || !title || !selectedRoomId}
            >
              {bookMutation.isPending ? "Booking..." : "Book Room"}
            </Button>
            <Button variant="outline" onClick={() => setLocation("/meeting-rooms")}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
