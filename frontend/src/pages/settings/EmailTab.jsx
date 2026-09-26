import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Info, Save, Send } from "lucide-react";
import clsx from "clsx";
import { Button, Input, Label } from "../../components/ui";
import { api } from "../../lib/api";
import { Hint, Section, TestResult } from "./shared";

const PRESETS = [
  { label: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 587, note: "Use an App Password, not your normal password (Google Account → Security → App passwords)." },
  { label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587, note: "Your admin may need to allow SMTP sign-in for this mailbox." },
  { label: "Other", host: "", port: 587, note: "Ask your email provider for their SMTP server details." },
];

function toForm(email) {
  return {
    enabled: email.enabled,
    recipients: email.recipients,
    smtp_host: email.smtp_host,
    smtp_port: email.smtp_port,
    smtp_user: email.smtp_user,
    smtp_password: "",
    from_address: email.from_address,
    use_tls: email.use_tls,
  };
}

export default function EmailTab({ settings }) {
  const queryClient = useQueryClient();
  const saved = settings.email;
  const [form, setForm] = useState(() => toForm(saved));
  const [result, setResult] = useState(null);
  const [advanced, setAdvanced] = useState(false);

  const preset = PRESETS.find((item) => item.host && item.host === form.smtp_host) || (form.smtp_host ? PRESETS[2] : null);

  const test = useMutation({
    mutationFn: () => api("/settings/email/test", { method: "POST", body: form }),
    onSuccess: setResult,
    onError: (error) => setResult({ success: false, message: error.message }),
  });

  const save = useMutation({
    mutationFn: () => api("/settings/email", { method: "PUT", body: form }),
    onSuccess: (data) => {
      toast.success(data.enabled ? "Email alerts are on" : "Email settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const canTest = form.smtp_host && form.recipients && (form.smtp_password || saved.has_smtp_password || !form.smtp_user);

  return (
    <Section title="Email alerts" description="Get an email as soon as an urgent ticket is created, so nobody has to watch the dashboard.">
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line p-4">
        <span>
          <span className="block font-medium">Send an email for urgent tickets</span>
          <span className="text-sm text-muted">Includes the ticket number, the issue and a link. Customer details are never emailed.</span>
        </span>
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          className="size-5 shrink-0 accent-[var(--brand)]"
        />
      </label>

      <div className="mt-5 space-y-4">
        <div>
          <Label>Send alerts to</Label>
          <Input value={form.recipients} onChange={set("recipients")} placeholder="support@yourcompany.com, manager@yourcompany.com" />
          <Hint>Separate several addresses with commas.</Hint>
        </div>

        <div>
          <Label>Your email provider</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setForm((current) => ({ ...current, smtp_host: item.host, smtp_port: item.port, use_tls: true }))}
                className={clsx(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  preset?.label === item.label ? "border-brand bg-brand-soft text-brand-ink" : "border-line hover:border-line-strong"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {preset && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
              <Info className="mt-px size-3.5 shrink-0" /> {preset.note}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Email address that sends the alerts</Label>
            <Input value={form.smtp_user} onChange={set("smtp_user")} placeholder="alerts@yourcompany.com" autoComplete="off" />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={form.smtp_password}
              onChange={set("smtp_password")}
              placeholder={saved.has_smtp_password ? "Saved. Leave empty to keep it" : "Email or app password"}
              autoComplete="new-password"
            />
          </div>
        </div>

        <button type="button" onClick={() => setAdvanced((value) => !value)} className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
          Server details
          <ChevronDown className={clsx("size-4 transition-transform", advanced && "rotate-180")} />
        </button>

        {advanced && (
          <div className="animate-in grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>SMTP server</Label>
              <Input value={form.smtp_host} onChange={set("smtp_host")} placeholder="smtp.example.com" />
            </div>
            <div>
              <Label>Port</Label>
              <Input type="number" value={form.smtp_port} onChange={(event) => setForm((current) => ({ ...current, smtp_port: Number(event.target.value) || 587 }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>"From" address (optional)</Label>
              <Input value={form.from_address} onChange={set("from_address")} placeholder="Same as the sending address" />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.use_tls}
                onChange={(event) => setForm((current) => ({ ...current, use_tls: event.target.checked }))}
                className="size-4 accent-[var(--brand)]"
              />
              Use secure connection
            </label>
          </div>
        )}
      </div>

      <TestResult result={result} />

      <div className="mt-5 flex flex-wrap gap-2">
        <Button icon={Send} loading={test.isPending} disabled={!canTest} onClick={() => test.mutate()}>
          Send a test email
        </Button>
        <Button variant="primary" icon={Save} loading={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </div>
    </Section>
  );
}
