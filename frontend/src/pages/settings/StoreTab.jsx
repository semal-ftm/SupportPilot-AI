import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, PlugZap, Save } from "lucide-react";
import clsx from "clsx";
import { Button, Input, Label } from "../../components/ui";
import { api } from "../../lib/api";
import { Hint, Section, TestResult } from "./shared";

const PROVIDERS = [
  { value: "demo", name: "Demo orders", text: "8 made-up orders for trying things out" },
  { value: "shopify", name: "Shopify", text: "Connect your Shopify store" },
];

const GUIDES = {
  shopify: [
    "In your Shopify admin, go to Settings → Apps and sales channels → Develop apps.",
    "Create an app, then under Configuration give it the read_orders permission (and read_customers).",
    "Install the app and copy the Admin API access token (it starts with shpat_).",
  ],
};

export default function StoreTab({ settings }) {
  const queryClient = useQueryClient();
  const saved = settings.store;
  const [form, setForm] = useState({ provider: saved.provider, shop_domain: saved.shop_domain, api_token: "" });
  const [result, setResult] = useState(null);

  const test = useMutation({
    mutationFn: () => api("/settings/store/test", { method: "POST", body: form }),
    onSuccess: (data) =>
      setResult({
        success: data.success,
        message: data.success ? `${data.message} Found ${data.orders_found} recent order(s).` : data.message,
      }),
    onError: (error) => setResult({ success: false, message: error.message }),
  });

  const save = useMutation({
    mutationFn: () => api("/settings/store", { method: "PUT", body: form }),
    onSuccess: () => {
      toast.success(form.provider === "demo" ? "Using demo orders" : "Store connected. The AI now looks up your real orders.");
      setResult(null);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-source"] });
    },
    onError: (error) => setResult({ success: false, message: error.message }),
  });

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const choose = (provider) => {
    setResult(null);
    setForm((current) => ({ ...current, provider }));
  };

  const sameProvider = form.provider === saved.provider;
  const tokenSaved = sameProvider && saved.has_api_token;
  const missing = form.provider !== "demo" && ((!form.api_token && !tokenSaved) || !form.shop_domain.trim());

  return (
    <Section title="Your store" description="Where the AI looks up orders when customers ask about them.">
      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.value}
            type="button"
            onClick={() => choose(provider.value)}
            className={clsx(
              "rounded-xl border p-4 text-start transition-colors",
              form.provider === provider.value ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong"
            )}
          >
            <div className="font-medium">{provider.name}</div>
            <div className="mt-0.5 text-xs text-muted">{provider.text}</div>
            {saved.provider === provider.value && <div className="mt-2 text-xs font-medium text-good">● In use</div>}
          </button>
        ))}
      </div>

      {form.provider !== "demo" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label>Store address</Label>
              <Input value={form.shop_domain} onChange={set("shop_domain")} placeholder="your-store.myshopify.com" />
            </div>
            <div>
              <Label>Access token</Label>
              <Input
                type="password"
                autoComplete="off"
                value={form.api_token}
                onChange={set("api_token")}
                placeholder={tokenSaved ? "Saved. Leave empty to keep it" : "Paste the token here"}
              />
            </div>
            <Hint>Tokens are stored on your server and are never shown again after saving.</Hint>
          </div>

          <div className="rounded-xl bg-surface-2/70 p-4 text-sm">
            <div className="mb-2 font-medium">Where do I find this?</div>
            <ol className="list-decimal space-y-1.5 ps-5 text-ink-2">
              {GUIDES[form.provider].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-line p-3 text-sm text-ink-2">
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        {form.provider === "demo"
          ? "Demo orders can be cancelled and refunded by the AI so you can see how it works."
          : "SupportPilot only reads orders from your store. When a customer asks to cancel or refund, the AI checks their email and creates a ticket, and your team completes it in your store's admin."}
      </div>

      <TestResult result={result} />

      <div className="mt-5 flex flex-wrap gap-2">
        {form.provider !== "demo" && (
          <Button icon={PlugZap} loading={test.isPending} disabled={missing} onClick={() => test.mutate()}>
            Test connection
          </Button>
        )}
        <Button variant="primary" icon={Save} loading={save.isPending} disabled={missing} onClick={() => save.mutate()}>
          {form.provider === "demo" ? "Use demo orders" : "Save and connect"}
        </Button>
      </div>
    </Section>
  );
}
