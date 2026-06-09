import { useListUsers, useUpdateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { format } from "date-fns";

const ROLES = ["employee", "team_lead", "admin"] as const;
const ROLE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  team_lead: "secondary",
  employee: "outline",
};

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useListUsers();
  const updateMutation = useUpdateUser();
  const queryClient = useQueryClient();

  const handleRoleChange = (id: number, role: string) => {
    updateMutation.mutate({ id, data: { role: role as any } }, {
      onSuccess: () => {
        toast.success("User role updated");
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err: any) => toast.error(err.data?.error || err.message),
    });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  const filtered = users?.filter((u) =>
    [u.name, u.email, u.department].some((v) => v?.toLowerCase().includes(search.toLowerCase()))
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Users</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} users</span>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          className="max-w-sm"
          placeholder="Search by name, email, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-md bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-semibold">Name</th>
              <th className="text-left p-3 font-semibold">Email</th>
              <th className="text-left p-3 font-semibold">Department</th>
              <th className="text-left p-3 font-semibold">Role</th>
              <th className="text-left p-3 font-semibold">Joined</th>
              <th className="text-left p-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <div className="font-medium">{user.name}</div>
                </td>
                <td className="p-3 text-muted-foreground">{user.email}</td>
                <td className="p-3 text-muted-foreground">{user.department ?? "—"}</td>
                <td className="p-3">
                  <Badge variant={ROLE_BADGE[user.role] ?? "outline"}>{user.role}</Badge>
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </td>
                <td className="p-3">
                  <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v)}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
