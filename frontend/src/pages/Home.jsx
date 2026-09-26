import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { AlertTriangle, ArrowRight, Bot, Check, MessageCircle, Smile, Ticket, Upload, Code2, PartyPopper } from "lucide-react";
import { Button, Card, EmptyState, Skeleton } from "../components/ui";
import { UrgentBadge } from "../components/badges";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDay, timeAgo } from "../lib/format";
import { useDocuments, useTickets } from "../lib/queries";
import { readFlag } from "../lib/flags";

function Stat({ icon: Icon, label, value, help, loading }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon className="size-5" />
        </div>
        <span className="font-medium text-ink-2">{label}</span>
      </div>
      {loading ? <Skeleton className="mt-4 h-9 w-20" /> : <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>}
      <p className="mt-1 text-[13px] text-muted">{help}</p>
    </Card>
  );
}

function GettingStarted() {
  const documents = useDocuments();

  const steps = [
    {
      done: readFlag("tried_chat"),
      icon: MessageCircle,
      title: "Try the AI yourself",
      text: "Ask a question the way a customer would.",
      to: "/chat",
      action: "Open Test Chat",
    },
    {
      done: (documents.data || []).length > 0,
      icon: Upload,
      title: "Add your help documents",
      text: "Upload your refund, shipping or FAQ pages so the AI answers correctly.",
      to: "/docs",
      action: "Upload documents",
    },
    {
      done: readFlag("copied_widget"),
      icon: Code2,
      title: "Put the chat on your website",
      text: "Copy one line of code into your site.",
      to: "/settings?tab=chat",
      action: "Get the code",
    },
  ];

  const completed = steps.filter((step) => step.done).length;

  if (completed === steps.length) return null;

  return (
    <Card className="mb-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Getting started</h2>
          <p className="text-sm text-muted">Three quick steps to get the most out of SupportPilot.</p>
        </div>
        <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-ink">
          {completed} of {steps.length} done
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className={clsx("flex flex-col rounded-xl border p-4", step.done ? "border-good/30 bg-good-soft/50" : "border-line")}>
            <div className="flex items-center gap-3">
              <span
                className={clsx(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
                  step.done ? "bg-good text-white" : "bg-surface-2 text-ink-2"
                )}
              >
                {step.done ? <Check className="size-4" strokeWidth={3} /> : index + 1}
              </span>
              <span className="font-medium">{step.title}</span>
            </div>
            <p className="mt-2 flex-1 text-sm text-muted">{step.text}</p>
            {!step.done && (
              <Link to={step.to} className="mt-3">
                <Button size="sm" variant="soft" className="w-full">
                  {step.action}
                </Button>
              </Link>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function WeekChart({ series }) {
  const max = Math.max(1, ...series.map((day) => day.conversations));

  return (
    <div className="flex h-44 items-end gap-2 sm:gap-4">
      {series.map((day) => (
        <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${day.conversations} chats on ${formatDay(day.date)}`}>
          <span className="text-xs font-medium text-ink-2 tabular">{day.conversations}</span>
          <div
            className="w-full max-w-12 rounded-t-lg bg-brand transition-all duration-500"
            style={{ height: `${Math.max(4, (day.conversations / max) * 100)}%` }}
          />
          <span className="text-xs text-muted">{formatDay(day.date)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const tickets = useTickets();

  const analytics = useQuery({
    queryKey: ["analytics", 7],
    queryFn: () => api("/analytics/overview?days=7"),
    refetchInterval: 30_000,
  });

  const k = analytics.data?.kpis || {};
  const loading = analytics.isLoading;

  const attention = (tickets.data || []).filter((ticket) => ticket.status !== "Resolved").slice(0, 5);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back, {user?.name?.split(" ")[0]}</h2>
        <p className="mt-1 text-muted">Here is a quick look at your customer support this week.</p>
      </div>

      {user?.demo_password && (
        <Link
          to="/settings"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 text-warn transition-colors hover:border-warn/60"
        >
          <AlertTriangle className="size-5 shrink-0" />
          <span className="flex-1">
            <span className="font-semibold">Please change the demo password.</span> It's shown on the login page, so anyone could sign in.
          </span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <GettingStarted />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={MessageCircle} label="Chats" value={k.conversations ?? "—"} help="Customer chats in the last 7 days" loading={loading} />
        <Stat
          icon={Bot}
          label="Solved by AI"
          value={k.ai_resolution_rate != null ? `${Math.round(k.ai_resolution_rate)}%` : "—"}
          help="Chats that didn't need your team"
          loading={loading}
        />
        <Stat icon={Ticket} label="Open tickets" value={k.open_tickets ?? "—"} help="Issues waiting for your team" loading={loading} />
        <Stat
          icon={Smile}
          label="Happy customers"
          value={k.csat != null ? `${Math.round(k.csat)}%` : "—"}
          help="Answers rated helpful by customers"
          loading={loading}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="p-5 sm:p-6 lg:col-span-3">
          <h3 className="font-semibold">Chats per day</h3>
          <p className="mb-6 text-sm text-muted">Last 7 days</p>
          {loading ? <Skeleton className="h-44" /> : <WeekChart series={analytics.data?.series || []} />}
        </Card>

        <Card className="p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Needs your attention</h3>
              <p className="text-sm text-muted">Tickets that are not resolved yet</p>
            </div>
          </div>

          <div className="mt-4">
            {tickets.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : attention.length === 0 ? (
              <EmptyState icon={PartyPopper} title="You're all caught up" description="There are no open tickets right now." className="py-6" />
            ) : (
              <div className="divide-y divide-line">
                {attention.map((ticket) => (
                  <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{ticket.title}</div>
                      <div className="text-xs text-muted">{timeAgo(ticket.created_at)}</div>
                    </div>
                    <UrgentBadge priority={ticket.priority} />
                    <ArrowRight className="size-4 text-muted" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link to="/tickets" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            See all tickets <ArrowRight className="size-4" />
          </Link>
        </Card>
      </div>
    </>
  );
}
