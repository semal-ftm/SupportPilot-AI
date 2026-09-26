import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Bell, MessageSquare, ShieldCheck, Store, UserRound, Users } from "lucide-react";
import { EmptyState, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import AccountTab from "./settings/AccountTab";
import ChatWindowTab from "./settings/ChatWindowTab";
import EmailTab from "./settings/EmailTab";
import PrivacyTab from "./settings/PrivacyTab";
import StoreTab from "./settings/StoreTab";
import TeamTab from "./settings/TeamTab";

const TABS = [
  { value: "account", label: "My account", icon: UserRound },
  { value: "team", label: "Team", icon: Users, admin: true },
  { value: "chat", label: "Chat window", icon: MessageSquare, admin: true },
  { value: "store", label: "Store", icon: Store, admin: true },
  { value: "alerts", label: "Email alerts", icon: Bell, admin: true },
  { value: "privacy", label: "Privacy", icon: ShieldCheck },
];

const NEEDS_SETTINGS = { chat: ChatWindowTab, store: StoreTab, alerts: EmailTab };

export default function Settings() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();

  const tabs = TABS.filter((tab) => !tab.admin || isAdmin);
  const current = tabs.find((tab) => tab.value === params.get("tab"))?.value || "account";

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api("/settings"),
    enabled: isAdmin,
  });

  const SettingsTab = NEEDS_SETTINGS[current];

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings sections">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setParams({ tab: tab.value })}
            className={clsx(
              "flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors",
              current === tab.value ? "bg-surface text-ink shadow-card" : "text-muted hover:bg-surface-2 hover:text-ink"
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {current === "account" && <AccountTab />}
        {current === "team" && <TeamTab />}
        {current === "privacy" && <PrivacyTab />}
        {SettingsTab &&
          (settings.isLoading ? (
            <Skeleton className="h-96" />
          ) : settings.isError ? (
            <EmptyState title="Couldn't load settings" description={settings.error.message} />
          ) : (
            // Remount after each save so the form starts from what was saved
            <SettingsTab key={settings.dataUpdatedAt} settings={settings.data} />
          ))}
      </div>
    </div>
  );
}
