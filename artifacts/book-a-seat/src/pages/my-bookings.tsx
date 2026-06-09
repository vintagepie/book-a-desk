import { useListDeskBookings } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

export default function MyBookings() {
  const { user } = useAuth();
  const { data: bookings, isLoading } = useListDeskBookings({ userId: user?.id });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Bookings</h1>
      <div className="bg-card border rounded-md shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Desk</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings?.data.map((booking: any) => (
              <tr key={booking.id} className="border-b last:border-0">
                <td className="p-4">{new Date(booking.date).toLocaleDateString()}</td>
                <td className="p-4">{booking.desk?.name}</td>
                <td className="p-4">{booking.status}</td>
              </tr>
            ))}
            {bookings?.data.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-muted-foreground">No bookings found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}