import { useState } from "react";
import { useListDesks, useCreateDeskBooking, getListDeskBookingsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";

export default function BookDesk() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const dateStr = date ? format(date, "yyyy-MM-dd") : undefined;
  const { data: desks, isLoading } = useListDesks({ date: dateStr, status: "available" });
  const bookMutation = useCreateDeskBooking();

  const handleBook = (deskId: number) => {
    if (!dateStr) return;
    bookMutation.mutate({ data: { deskId, date: dateStr } }, {
      onSuccess: () => {
        toast.success("Desk booked successfully");
        queryClient.invalidateQueries({ queryKey: getListDeskBookingsQueryKey() });
        setLocation("/my-bookings");
      },
      onError: (err: any) => {
        toast.error("Failed to book desk: " + (err.message || "Unknown error"));
      }
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Book a Desk</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Select Date</CardTitle>
            </CardHeader>
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
        <div className="md:col-span-3">
          {isLoading ? (
            <div>Loading available desks...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {desks?.map((desk) => (
                <Card key={desk.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{desk.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1 mb-4">
                      <p><span className="font-medium text-muted-foreground">Floor:</span> {desk.floor}</p>
                      {desk.zone && <p><span className="font-medium text-muted-foreground">Zone:</span> {desk.zone}</p>}
                      {desk.amenities && <p><span className="font-medium text-muted-foreground">Amenities:</span> {desk.amenities}</p>}
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => handleBook(desk.id)}
                      disabled={bookMutation.isPending}
                    >
                      Book Desk
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {desks?.length === 0 && (
                <div className="col-span-full p-8 text-center border rounded-md text-muted-foreground">
                  No desks available for the selected date.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}