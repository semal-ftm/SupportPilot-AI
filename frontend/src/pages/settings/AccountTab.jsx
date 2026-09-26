import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, KeyRound, LogOut, Moon, Sun } from "lucide-react";
import { Avatar, Button, Input, Label, Segmented } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../../lib/theme";
import { Hint, Section } from "./shared";

function ChangePassword() {
  const { refresh } = useAuth();
  const empty = { current: "", next: "", confirm: "" };
  const [form, setForm] = useState(empty);

  const change = useMutation({
    mutationFn: () =>
      api("/auth/change-password", {
        method: "POST",
        body: { current_password: form.current, new_password: form.next },
      }),
    onSuccess: () => {
      toast.success("Your password was changed");
      setForm(empty);
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const tooShort = form.next.length > 0 && form.next.length < 8;
  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;
  const ready = form.current && form.next.length >= 8 && form.next === form.confirm;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) change.mutate();
      }}
      className="grid max-w-md gap-4"
    >
      <div>
        <Label>Current password</Label>
        <Input type="password" autoComplete="current-password" value={form.current} onChange={set("current")} />
      </div>
      <div>
        <Label>New password</Label>
        <Input type="password" autoComplete="new-password" value={form.next} onChange={set("next")} />
        <Hint>{tooShort ? <span className="text-bad">Use at least 8 characters.</span> : "At least 8 characters."}</Hint>
      </div>
      <div>
        <Label>Type the new password again</Label>
        <Input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        {mismatch && <Hint><span className="text-bad">The passwords don't match.</span></Hint>}
      </div>
      <div>
        <Button type="submit" variant="primary" icon={KeyRound} loading={change.isPending} disabled={!ready}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export default function AccountTab() {
  const { user, logout } = useAuth();
  const { resolved, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      <Section title="Your account">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user?.name} tone="brand" className="size-12 text-base" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{user?.name}</div>
            <div className="text-sm text-muted">
              {user?.email} · {user?.role === "admin" ? "Admin" : "Support agent"}
            </div>
          </div>
          <Button icon={LogOut} onClick={logout}>
            Sign out
          </Button>
        </div>
      </Section>

      <Section title="Change password" description="Pick a password only you know.">
        {user?.demo_password && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            A demo account still uses the password shown on the login page. Anyone could sign in with it, so please change it.
          </div>
        )}
        <ChangePassword />
      </Section>

      <Section title="Appearance">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-2">Theme</span>
          <Segmented
            value={resolved}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
            ]}
          />
        </div>
      </Section>
    </div>
  );
}
