import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Monitor, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@company.com", password: "admin123", description: "Full access" },
  { label: "Team Lead", email: "lead@company.com", password: "lead123", description: "Meetings + admin" },
  { label: "Employee", email: "jane@company.com", password: "pass123", description: "Desk booking" },
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showDemo, setShowDemo] = useState(false);
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
          toast.error("Invalid email or password. Contact your admin if you need access.");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-5">

        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-2 shadow-md">
            <Monitor className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">Book a Seat</h1>
          <p className="text-sm text-muted-foreground">Workspace & Meeting Room Management</p>
        </div>

        {/* Access policy banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-primary/80 leading-relaxed">
            <span className="font-semibold text-primary">Invite-only access.</span>{" "}
            Your account must be registered by an admin before you can sign in.
          </p>
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
          <p className="text-center text-xs text-muted-foreground pt-1">
            Don't have access?{" "}
            <span className="text-primary font-medium">Contact your administrator.</span>
          </p>
        </div>

        {/* Demo accounts (collapsible) */}
        <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDemo((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40 transition-colors"
          >
            <span>Demo Accounts</span>
            {showDemo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showDemo && (
            <div className="px-4 pb-4 space-y-3 border-t">
              <p className="text-[11px] text-muted-foreground pt-3">
                Click a role to pre-fill credentials, then sign in.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => { setEmail(acc.email); setPassword(acc.password); setShowDemo(false); }}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-border hover:bg-muted/60 hover:border-primary/40 transition-colors"
                  >
                    <span className="text-xs font-semibold text-foreground">{acc.label}</span>
                    <span className="text-[10px] text-muted-foreground">{acc.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
