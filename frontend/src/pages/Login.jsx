import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "../components/Logo";
import { Button, Input, Label } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@supportpilot.dev", password: "admin123" },
  { label: "Support agent", email: "agent@supportpilot.dev", password: "agent123" },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Demo buttons disappear once the demo passwords have been changed
  const info = useQuery({
    queryKey: ["login-info"],
    queryFn: () => api("/public/login-info", { auth: false }),
    retry: false,
  });

  if (user) return <Navigate to={location.state?.from || "/"} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate(location.state?.from || "/", { replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-brand-soft to-page px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-14" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign in to SupportPilot</h1>
          <p className="mt-1 text-muted">Your AI assistant for customer support</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input icon={Mail} type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
            </div>
            <div>
              <Label>Password</Label>
              <Input icon={Lock} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" />
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
              Sign in <ArrowRight className="size-4" />
            </Button>
          </form>

          {info.data?.demo_accounts && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm text-muted">Just trying it out? Use a demo account:</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.label}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Want to see the customer side?{" "}
          <a href="/widget" target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
            Open the chat window
          </a>
        </p>
      </div>
    </div>
  );
}
