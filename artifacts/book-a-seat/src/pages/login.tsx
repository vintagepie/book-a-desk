import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Monitor } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@company.com", password: "admin123", description: "Full access" },
  { label: "Team Lead", email: "lead@company.com", password: "lead123", description: "Meetings + admin" },
  { label: "Employee", email: "jane@company.com", password: "pass123", description: "Desk booking" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();

  if (isAuthenticated) {
    setLocation("/dashboard");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data) => {
          login(data.token);
          toast.success("Signed in successfully");
          setLocation("/dashboard");
        },
        onError: () => {
          toast.error("Invalid email or password");
        },
      }
    );
  };

  const fillDemo = (acc: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-2">
            <Monitor className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">Book a Seat</h1>
          <p className="text-sm text-muted-foreground">Workspace & Meeting Room Management</p>
        </div>

        {/* Login card */}
        <div className="border rounded-xl bg-card shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="border rounded-xl bg-card shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
            Demo Accounts — click to fill
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc)}
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-border hover:bg-muted/60 hover:border-primary/40 transition-colors text-left"
              >
                <span className="text-xs font-semibold text-foreground">{acc.label}</span>
                <span className="text-[10px] text-muted-foreground">{acc.description}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-center text-muted-foreground/70">
            Click a role above, then press Sign In
          </p>
        </div>
      </div>
    </div>
  );
}
