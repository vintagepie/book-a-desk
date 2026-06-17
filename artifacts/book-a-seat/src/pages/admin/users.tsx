import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import {
  Search, UserPlus, ShieldCheck, ShieldOff, KeyRound,
  Trash2, Users, UserCheck, UserX, Crown,
} from "lucide-react";

const ROLES = ["employee", "team_lead", "admin"] as const;
const DEPTS = ["Engineering", "Marketing", "Design", "Sales", "IT", "HR", "Finance", "Operations"];

const ROLE_META: Record<string, { label: string; badge: "default" | "secondary" | "outline"; icon: React.ReactNode }> = {
  admin:     { label: "Admin",     badge: "default",   icon: <Crown className="w-3 h-3" /> },
  team_lead: { label: "Team Lead", badge: "secondary", icon: <ShieldCheck className="w-3 h-3" /> },
  employee:  { label: "Employee",  badge: "outline",   icon: <UserCheck className="w-3 h-3" /> },
};

// ─── Register dialog ─────────────────────────────────────────────────────────

function RegisterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "employee" as string, department: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const createMutation = useCreateUser();
  const queryClient = useQueryClient();

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }

    createMutation.mutate(
      { data: { email: form.email, name: form.name, role: form.role as any, password: form.password, department: form.department || undefined } },
      {
        onSuccess: (user) => {
          toast.success(`${user.name} registered successfully`);
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setForm({ name: "", email: "", role: "employee", department: "", password: "", confirmPassword: "" });
          onClose();
        },
        onError: (err: any) => {
          const msg = err.data?.error || err.message;
          if (msg?.includes("already exists")) setError("This email is already registered");
          else setError(msg || "Failed to register user");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> Register New User</DialogTitle>
          <DialogDescription>Add a new employee or team lead to the workspace. They will use this email and password to sign in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Full Name *</Label>
              <Input placeholder="Jane Smith" value={form.name} onChange={(e) => set("name")(e.target.value)} required />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email Address *</Label>
              <Input type="email" placeholder="jane@company.com" value={form.email} onChange={(e) => set("email")(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={set("role")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.department} onValueChange={set("department")}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Initial Password *</Label>
              <Input type="password" placeholder="Min 6 chars" value={form.password} onChange={(e) => set("password")(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password *</Label>
              <Input type="password" placeholder="Re-enter" value={form.confirmPassword} onChange={(e) => set("confirmPassword")(e.target.value)} required />
            </div>
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Registering…" : "Register User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reset password dialog ────────────────────────────────────────────────────

function ResetPasswordDialog({ user, open, onClose }: { user: { id: number; name: string } | null; open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const updateMutation = useUpdateUser();
  const queryClient = useQueryClient();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (!user) return;

    updateMutation.mutate(
      { id: user.id, data: { password } },
      {
        onSuccess: () => {
          toast.success(`Password reset for ${user.name}`);
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          setPassword(""); setConfirm(""); onClose();
        },
        onError: (err: any) => setError(err.data?.error || err.message || "Failed to reset password"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPassword(""); setConfirm(""); setError(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-500" /> Reset Password</DialogTitle>
          <DialogDescription>Set a new password for <strong>{user?.name}</strong>. They will need to use this password to sign in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" placeholder="Min 6 chars" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input type="password" placeholder="Re-enter" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete confirm dialog ────────────────────────────────────────────────────

function DeleteDialog({ user, open, onClose }: { user: { id: number; name: string } | null; open: boolean; onClose: () => void }) {
  const deleteMutation = useDeleteUser();
  const queryClient = useQueryClient();

  const handleDelete = () => {
    if (!user) return;
    deleteMutation.mutate(
      { id: user.id },
      {
        onSuccess: () => {
          toast.success(`${user.name} removed from the system`);
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          onClose();
        },
        onError: (err: any) => toast.error(err.data?.error || err.message || "Failed to delete user"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="w-5 h-5" /> Remove User</DialogTitle>
          <DialogDescription>
            This will permanently remove <strong>{user?.name}</strong> from the system. They will no longer be able to sign in. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Removing…" : "Remove User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type UserRow = { id: number; name: string; email: string; role: string; department?: string | null; isActive?: boolean | null; createdAt: string };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [registerOpen, setRegisterOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const { data: users, isLoading } = useListUsers();
  const updateMutation = useUpdateUser();
  const queryClient = useQueryClient();

  const handleRoleChange = (id: number, role: string) => {
    updateMutation.mutate({ id, data: { role: role as any } }, {
      onSuccess: () => {
        toast.success("Role updated");
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err: any) => toast.error(err.data?.error || err.message),
    });
  };

  const toggleActive = (u: UserRow) => {
    const next = !u.isActive;
    updateMutation.mutate({ id: u.id, data: { isActive: next } }, {
      onSuccess: () => {
        toast.success(next ? `${u.name} reactivated` : `${u.name} deactivated`);
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: (err: any) => toast.error(err.data?.error || err.message),
    });
  };

  const filtered = (users ?? []).filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q || [u.name, u.email, u.department].some((v) => v?.toLowerCase().includes(q));
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? u.isActive !== false : u.isActive === false);
    return matchSearch && matchRole && matchStatus;
  });

  // Stats
  const total = users?.length ?? 0;
  const active = users?.filter((u) => u.isActive !== false).length ?? 0;
  const inactive = total - active;
  const admins = users?.filter((u) => u.role === "admin").length ?? 0;

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading users…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">Register employees and team leads to grant access</p>
        </div>
        <Button onClick={() => setRegisterOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> Register User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Users className="w-5 h-5 text-muted-foreground" />, val: total, label: "Total users" },
          { icon: <UserCheck className="w-5 h-5 text-emerald-500" />, val: active, label: "Active" },
          { icon: <UserX className="w-5 h-5 text-red-400" />, val: inactive, label: "Deactivated" },
          { icon: <Crown className="w-5 h-5 text-primary" />, val: admins, label: "Admins" },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              {s.icon}
              <div>
                <p className="text-xl font-bold">{s.val}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 w-52 text-sm" placeholder="Search name, email, dept…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">User</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Department</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Role</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Registered</th>
                <th className="text-right p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isMe = u.id === me?.id;
                const isInactive = u.isActive === false;
                const meta = ROLE_META[u.role] ?? ROLE_META.employee;
                return (
                  <tr key={u.id} className={`border-b last:border-0 transition-colors ${isInactive ? "bg-muted/30 opacity-60" : "hover:bg-muted/20"}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isInactive ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium">{u.name}</span>
                          {isMe && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">You</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{u.email}</td>
                    <td className="p-3 text-muted-foreground text-xs">{u.department ?? <span className="italic opacity-50">—</span>}</td>
                    <td className="p-3">
                      {isMe || u.role === "admin" ? (
                        <Badge variant={meta.badge} className="gap-1 text-xs">
                          {meta.icon} {meta.label}
                        </Badge>
                      ) : (
                        <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                          <SelectTrigger className="h-7 w-32 text-xs border-0 bg-transparent p-0 focus:ring-0 shadow-none">
                            <Badge variant={meta.badge} className="gap-1 text-xs cursor-pointer">
                              {meta.icon} {meta.label}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => <SelectItem key={r} value={r} className="text-xs">{ROLE_META[r].label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="p-3">
                      {isInactive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
                          <UserX className="w-3 h-3" /> Deactivated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                          <UserCheck className="w-3 h-3" /> Active
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setResetTarget(u)}
                          title="Reset password"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                        </Button>
                        {!isMe && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={() => toggleActive(u)}
                              title={isInactive ? "Reactivate" : "Deactivate"}
                            >
                              {isInactive
                                ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                : <ShieldOff className="w-3.5 h-3.5 text-orange-500" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(u)}
                              title="Remove user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    No users match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access policy note */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm">
        <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-800">Invite-only access</p>
          <p className="text-amber-700 text-xs mt-0.5">
            Only users registered here can sign in. Deactivate an account to immediately revoke access without deleting the user's booking history.
          </p>
        </div>
      </div>

      {/* Dialogs */}
      <RegisterDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />
      <ResetPasswordDialog user={resetTarget} open={!!resetTarget} onClose={() => setResetTarget(null)} />
      <DeleteDialog user={deleteTarget} open={!!deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
