import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useListDeskBookings, useCheckInDesk, getListDeskBookingsQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";

export default function CheckIn() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: bookingsData, isLoading } = useListDeskBookings({ userId: user?.id, date: today, status: "confirmed" });
  
  const [code, setCode] = useState("");
  const checkInMutation = useCheckInDesk();
  const queryClient = useQueryClient();

  const todayBooking = bookingsData?.data?.[0];

  const handleCheckIn = () => {
    if (!todayBooking) return;
    if (!code) {
      toast.error("Please enter the QR code");
      return;
    }

    checkInMutation.mutate({ id: todayBooking.deskId, data: { qrCode: code } }, {
      onSuccess: () => {
        toast.success("Checked in successfully!");
        queryClient.invalidateQueries({ queryKey: getListDeskBookingsQueryKey() });
        setCode("");
      },
      onError: (err: any) => {
        toast.error(err.message || "Invalid QR code or check-in failed");
      }
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="max-w-md mx-auto space-y-6 pt-10">
      <h1 className="text-3xl font-bold text-center">Desk Check-In</h1>
      
      {!todayBooking ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            You don't have a confirmed desk booking for today.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl">Your Desk for Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-primary">{todayBooking.desk?.name}</div>
              <div className="text-sm text-muted-foreground">
                Floor {todayBooking.desk?.floor} {todayBooking.desk?.zone ? `• Zone ${todayBooking.desk?.zone}` : ''}
              </div>
            </div>
            
            <div className="border-t pt-6 space-y-4">
              <div className="text-center font-medium">Scan QR Code at Desk</div>
              <div className="p-8 border-2 border-dashed rounded-xl flex items-center justify-center bg-muted/50 font-mono text-2xl font-bold tracking-widest">
                {todayBooking.desk?.qrCode}
              </div>
              <div className="text-sm text-center text-muted-foreground">
                (Simulated: type the code above to check in)
              </div>
            </div>

            <div className="space-y-2">
              <Input 
                placeholder="Enter desk code" 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                className="text-center font-mono text-lg uppercase"
              />
              <Button 
                className="w-full" 
                onClick={handleCheckIn}
                disabled={checkInMutation.isPending}
              >
                {checkInMutation.isPending ? "Checking in..." : "Check In"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}