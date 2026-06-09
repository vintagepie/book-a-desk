import { useListMeetingRooms } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Users, Monitor, Building2 } from "lucide-react";

export default function MeetingRooms() {
  const [, setLocation] = useLocation();
  const { data: rooms, isLoading } = useListMeetingRooms();

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Meeting Rooms</h1>
        <Button onClick={() => setLocation("/meeting-rooms/book")}>Book a Room</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rooms?.map((room) => (
          <Card key={room.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{room.name}</CardTitle>
                <Badge variant={room.status === "available" ? "default" : "secondary"}>
                  {room.status}
                </Badge>
              </div>
              {room.description && (
                <p className="text-sm text-muted-foreground">{room.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>Capacity: <strong className="text-foreground">{room.capacity} people</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span>Floor: <strong className="text-foreground">{room.floor}</strong></span>
                </div>
                {room.facilities && (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Monitor className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{room.facilities}</span>
                  </div>
                )}
              </div>
              {room.status === "available" && (
                <Button
                  className="w-full"
                  onClick={() => setLocation(`/meeting-rooms/book?roomId=${room.id}`)}
                >
                  Book Room
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
