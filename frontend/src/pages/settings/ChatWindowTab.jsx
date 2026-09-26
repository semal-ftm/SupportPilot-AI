import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Save } from "lucide-react";
import clsx from "clsx";
import { Button, Input, Label, Textarea } from "../../components/ui";
import { LogoMark } from "../../components/Logo";
import { api } from "../../lib/api";
import { setFlag } from "../../lib/flags";
import { Hint, Section } from "./shared";

const COLORS = ["#0f9d58", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0f172a"];

function Preview({ branding }) {
  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-line bg-page shadow-pop">
      <div className="px-4 py-3 text-white" style={{ background: `linear-gradient(135deg, ${branding.color}, color-mix(in oklab, ${branding.color} 70%, black))` }}>
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-8" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">{branding.company_name || "Customer Support"}</div>
            <div className="text-[11px] text-white/85">We usually reply right away</div>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-2xl rounded-ss-md bg-surface px-3 py-2 text-[13px] text-ink-2 shadow-card">{branding.welcome_message}</div>
        <div className="flex justify-end">
          <div className="rounded-2xl rounded-ee-md px-3 py-2 text-[13px] text-white" style={{ background: branding.color }}>
            Where is my order?
          </div>
        </div>
      </div>
      <div className="border-t border-line bg-surface px-3 py-2.5 text-xs text-muted">Type your message…</div>
    </div>
  );
}

function WebsiteCode({ color }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script src="${window.location.origin}/widget.js" data-color="${color}" defer></script>`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setFlag("copied_widget");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Please select the code and copy it manually.");
    }
  };

  return (
    <Section
      title="Add the chat to your website"
      description="Paste this one line into your website, just before the closing </body> tag. A chat button will appear in the corner."
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <code className="flex-1 overflow-x-auto rounded-xl border border-line bg-surface-2 px-4 py-3 font-mono text-[13px] whitespace-nowrap">{snippet}</code>
        <Button variant="primary" icon={copied ? Check : Copy} onClick={copy} className="h-auto py-3">
          {copied ? "Copied!" : "Copy code"}
        </Button>
      </div>
      <a href="/widget" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ExternalLink className="size-4" /> See what customers will see
      </a>
    </Section>
  );
}

export default function ChatWindowTab({ settings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(settings.branding);

  const save = useMutation({
    mutationFn: () => api("/settings/branding", { method: "PUT", body: form }),
    onSuccess: () => {
      toast.success("Chat window updated. Customers see the new look right away.");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const validColor = /^#[0-9a-fA-F]{6}$/.test(form.color);

  return (
    <div className="space-y-6">
      <Section title="How the chat window looks" description="Customers see this on your website.">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label>Company name</Label>
              <Input value={form.company_name} onChange={set("company_name")} maxLength={60} placeholder="e.g. Noura's Boutique" />
              <Hint>Shown at the top of the chat. The AI also uses it when talking to customers.</Hint>
            </div>
            <div>
              <Label>Colour</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, color }))}
                    className={clsx(
                      "grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-surface transition",
                      form.color.toLowerCase() === color && "ring-2 ring-ink"
                    )}
                    style={{ background: color }}
                    aria-label={`Use colour ${color}`}
                  >
                    {form.color.toLowerCase() === color && <Check className="size-4 text-white" />}
                  </button>
                ))}
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="color"
                    value={validColor ? form.color : "#0f9d58"}
                    onChange={set("color")}
                    className="size-9 cursor-pointer rounded-full border border-line bg-transparent"
                    aria-label="Pick any colour"
                  />
                  Any colour
                </label>
              </div>
            </div>
            <div>
              <Label>Welcome message</Label>
              <Textarea value={form.welcome_message} onChange={set("welcome_message")} maxLength={400} />
              <Hint>The first message customers see when they open the chat.</Hint>
            </div>
            <Button
              variant="primary"
              icon={Save}
              loading={save.isPending}
              disabled={!validColor || !form.company_name.trim() || !form.welcome_message.trim()}
              onClick={() => save.mutate()}
            >
              Save changes
            </Button>
          </div>

          <div>
            <div className="mb-3 text-sm font-medium text-muted">Preview</div>
            <Preview branding={form} />
          </div>
        </div>
      </Section>

      <WebsiteCode color={settings.branding.color} />
    </div>
  );
}
