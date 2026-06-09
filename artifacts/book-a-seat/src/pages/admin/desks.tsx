import { useListDesks, useMarkDeskMaintenance, useRestoreDesk, getListDesksQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Wrench, CheckCircle, Search } from "lucide-react";

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  available: "default",
  booked: "secondary",
  maintenance: "destructive",
};

export default function AdminDesks() {
  const [search, setSearch] = useState("");
  const [reasonMap, setReasonMap] = useState<Record<number, string>>({});
  const { data: desks, isLoading } = useListDesks();
  const maintenanceMutation = useMarkDeskMaintenance();
  const restoreMutation = useRestoreDesk();
  const queryClient = useQueryClient();

  const handleMaintenance = (id: number) => {
    const reason = reasonMap[id] || "Maintenance required";
    maintenanceMutation.mutate({ id, data: { reason } }, {
      onSuccess: () => {
        toast.success("Desk marked for maintenance");
        queryClient.invalidateQueries({ queryKey: getListDesksQueryKey() });
        setReasonMap((m) => { const n = { ...m }; delete n[id]; return n; });
      },
      onError: (err: any) => toast.error(err.data?.error || err.message),
    });
  };

  const handleRestore = (id: number) => {
    restoreMutation.mutate({ id }, {
      onSuccess: () => {
        toast.success("Desk restored to available");
        queryClient.invalidateQueries({ queryKey: getListDesksQueryKey() });
      },
      onError: (err: any) => toast.error(err.data?.error || err.message),
    });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const filtered = desks?.filter((d) =>
    [d.name, d.floor, d.zone].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Desks</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} desks</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          className="max-w-sm"
          placeholder="Search by name, floor, or zone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((desk) => (
          <Card key={desk.id}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">{desk.name}</CardTitle>
                <Badge variant={STATUS_BADGE[desk.status] ?? "secondary"}>{desk.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1 mb-4">
                <p>Floor: {desk.floor}</p>
                {desk.zone && <p>Zone: {desk.zone}</p>}
                {desk.amenities && <p className="line-clamp-2">Amenities: {desk.amenities}</p>}
                {desk.qrCode && <p className="font-mono text-xs">QR: {desk.qrCode}</p>}
              </div>

              {desk.status === "maintenance" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleRestore(desk.id)}
                  disabled={restoreMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Restore to Available
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Maintenance reason..."
                    value={reasonMap[desk.id] ?? ""}
                    onChange={(e) => setReasonMap((m) => ({ ...m, [desk.id]: e.target.value }))}
                    className="text-sm"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => handleMaintenance(desk.id)}
                    disabled={maintenanceMutation.isPending}
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    Mark Maintenance
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
