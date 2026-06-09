import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export default function Notifications() {
  const { data: notifications, isLoading } = useListNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const queryClient = useQueryClient();

  const handleMarkRead = (id: number) => {
    markReadMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    });
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("All notifications marked as read");
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Notifications</h1>
        {notifications && notifications.some(n => !n.isRead) && (
          <Button variant="outline" onClick={handleMarkAllRead} disabled={markAllReadMutation.isPending}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {notifications?.map((notification) => (
          <Card key={notification.id} className={notification.isRead ? "opacity-60 bg-muted/50" : "border-primary/20 bg-primary/5"}>
            <CardContent className="p-4 flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {notification.type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(notification.createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
                <p className="text-sm">{notification.message}</p>
              </div>
              {!notification.isRead && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleMarkRead(notification.id)}
                  disabled={markReadMutation.isPending}
                >
                  Mark Read
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {(!notifications || notifications.length === 0) && (
          <div className="text-center py-12 text-muted-foreground border rounded-md border-dashed">
            You're all caught up! No notifications.
          </div>
        )}
      </div>
    </div>
  );
}