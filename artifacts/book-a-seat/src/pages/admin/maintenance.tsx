import { useListMaintenanceLogs, useListDesks, useRestoreDesk, getListDesksQueryKey, getListMaintenanceLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Wrench, CheckCircle, AlertTriangle } from "lucide-react";

export default function AdminMaintenance() {
  const { data: logs, isLoading: logsLoading } = useListMaintenanceLogs();
  const { data: desks, isLoading: desksLoading } = useListDesks({ status: "maintenance" });
  const restoreMutation = useRestoreDesk();
  const queryClient = useQueryClient();

  const handleRestore = (id: number) => {
    restoreMutation.mutate({ id }, {
      onSuccess: () => {
        toast.success("Desk restored to available");
        queryClient.invalidateQueries({ queryKey: getListDesksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListMaintenanceLogsQueryKey() });
      },
      onError: (err: any) => toast.error(err.data?.error || err.message),
    });
  };

  if (logsLoading || desksLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Maintenance Management</h1>

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          Desks Under Maintenance ({desks?.length ?? 0})
        </h2>
        {desks?.length === 0 ? (
          <div className="text-center py-8 border rounded-md border-dashed text-muted-foreground text-sm">
            No desks currently under maintenance
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {desks?.map((desk) => (
              <Card key={desk.id} className="border-destructive/30">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{desk.name}</CardTitle>
                    <Badge variant="destructive">maintenance</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-1 mb-3">
                    <p>Floor: {desk.floor}</p>
                    {desk.zone && <p>Zone: {desk.zone}</p>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleRestore(desk.id)}
                    disabled={restoreMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Resolved
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Maintenance Log
        </h2>
        <div className="border rounded-md bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-semibold">Desk</th>
                <th className="text-left p-3 font-semibold">Action</th>
                <th className="text-left p-3 font-semibold">Reason</th>
                <th className="text-left p-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((log: any) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{log.desk?.name ?? log.deskId}</td>
                  <td className="p-3">
                    <Badge variant={log.action === "marked_maintenance" ? "destructive" : "default"} className="text-xs capitalize">
                      {log.action.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground max-w-xs truncate">{log.reason ?? "—"}</td>
                  <td className="p-3 text-muted-foreground text-xs">{format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}</td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">No maintenance logs</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
