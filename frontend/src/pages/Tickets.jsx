import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  Copy,
  MessagesSquare,
  Package,
  Plus,
  Search,
  Send,
  Sparkles,
  StickyNote,
  Ticket as TicketIcon,
  UserRound,
  X,
} from "lucide-react";
import { Button, Card, Drawer, EmptyState, Input, Label, Modal, PageIntro, Segmented, Select, Skeleton, Textarea } from "../components/ui";
import { OrderStatusBadge, StatusBadge, UrgentBadge } from "../components/badges";
import { api } from "../lib/api";
import { formatCurrency, formatDateTime, timeAgo } from "../lib/format";
import { useTickets, useUsers } from "../lib/queries";

const STATUS_OPTIONS = [
  { value: "Open", label: "Open", icon: Circle, help: "New, nobody has started" },
  { value: "In Progress", label: "In progress", icon: CircleDot, help: "Someone is working on it" },
  { value: "Resolved", label: "Resolved", icon: CheckCircle2, help: "The issue is fixed" },
];

function NewTicketModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const empty = { title: "", description: "", order_number: "", urgent: false };
  const [form, setForm] = useState(empty);

  const create = useMutation({
    mutationFn: () =>
      api("/tickets", {
        method: "POST",
        body: {
          title: form.title,
          description: form.description,
          order_number: form.order_number || null,
          priority: form.urgent ? "High" : "Medium",
          category: "Other",
        },
      }),
    onSuccess: (ticket) => {
      toast.success(`Ticket ${ticket.number} created`);
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setForm(empty);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New ticket"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} disabled={form.title.length < 3 || !form.description} onClick={() => create.mutate()}>
            Create ticket
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>What is the problem?</Label>
          <Input value={form.title} onChange={set("title")} placeholder="e.g. Customer received a damaged item" autoFocus />
        </div>
        <div>
          <Label>Details</Label>
          <Textarea value={form.description} onChange={set("description")} placeholder="Add anything your team should know." />
          <p className="mt-1 text-xs text-muted">Please don't enter card numbers or ID numbers.</p>
        </div>
        <div>
          <Label>Order number (optional)</Label>
          <Input value={form.order_number} onChange={set("order_number")} placeholder="ORD-1001" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.urgent}
            onChange={(event) => setForm((current) => ({ ...current, urgent: event.target.checked }))}
            className="size-4 accent-[var(--brand)]"
          />
          This is urgent
        </label>
      </div>
    </Modal>
  );
}

function SuggestedReply({ ticket }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);

  const assist = useMutation({
    mutationFn: () => api(`/tickets/${ticket.id}/assist`, { method: "POST" }),
    onSuccess: (data) => {
      setSummary(data.summary || "");
      setDraft(data.suggested_reply || "");
    },
    onError: (error) => toast.error(error.message),
  });

  const send = useMutation({
    mutationFn: () => api(`/sessions/${encodeURIComponent(ticket.session_id)}/reply`, { method: "POST", body: { text: draft } }),
    onSuccess: () => {
      toast.success("Reply sent to the customer");
      queryClient.invalidateQueries({ queryKey: ["ticket", String(ticket.id)] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="rounded-2xl border border-brand/25 bg-brand-soft/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-brand" /> Need help replying?
        </div>
        <Button size="sm" variant={draft ? "ghost" : "primary"} icon={Sparkles} loading={assist.isPending} onClick={() => assist.mutate()}>
          {draft ? "Try again" : "Write a reply for me"}
        </Button>
      </div>

      {!draft && !assist.isPending && <p className="mt-2 text-sm text-muted">The AI reads the chat and writes a reply you can edit.</p>}

      {assist.isPending && (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      )}

      {draft && !assist.isPending && (
        <div className="animate-in mt-3 space-y-3">
          {summary && <p className="text-sm text-ink-2">{summary}</p>}
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-32 bg-surface" />
          <div className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Please read and check this reply before sending. The AI can make mistakes.
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              icon={copied ? Check : Copy}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(draft);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  // Clipboard blocked
                }
              }}
            >
              Copy
            </Button>
            {ticket.session_id && ticket.messages?.length > 0 && (
              <Button size="sm" variant="primary" icon={Send} loading={send.isPending} disabled={!draft.trim()} onClick={() => send.mutate()}>
                Send to customer
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TicketDetails({ ticketId, onClose }) {
  const queryClient = useQueryClient();
  const users = useUsers();
  const [note, setNote] = useState("");

  const ticket = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => api(`/tickets/${ticketId}`),
    enabled: Boolean(ticketId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  const update = useMutation({
    mutationFn: (body) => api(`/tickets/${ticketId}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.success("Ticket updated");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const addNote = useMutation({
    mutationFn: () => api(`/tickets/${ticketId}/notes`, { method: "POST", body: { body: note } }),
    onSuccess: () => {
      setNote("");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const data = ticket.data;
  const notes = (data?.events || []).filter((event) => event.kind === "note").reverse();

  return (
    <Drawer open={Boolean(ticketId)} onClose={onClose}>
      <div className="flex items-start gap-3 border-b border-line px-6 py-5">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">
            {data?.number} {data && `· opened ${timeAgo(data.created_at)}`}
          </div>
          <h2 className="mt-1 text-xl leading-snug font-semibold">{data?.title || "…"}</h2>
          {data && (
            <div className="mt-2 flex gap-2">
              <StatusBadge status={data.status} />
              <UrgentBadge priority={data.priority} />
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Close" />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {ticket.isLoading && <Skeleton className="h-40" />}

        {data && (
          <>
            <div>
              <Label>Status</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => data.status !== option.value && update.mutate({ status: option.value })}
                    className={clsx(
                      "rounded-xl border p-3 text-start transition-colors",
                      data.status === option.value ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong"
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <option.icon className={clsx("size-4", data.status === option.value ? "text-brand" : "text-muted")} />
                      {option.label}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{option.help}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Assigned to</Label>
                <Select
                  value={data.assignee_id || ""}
                  onChange={(event) =>
                    update.mutate(event.target.value ? { assignee_id: Number(event.target.value) } : { unassign: true })
                  }
                >
                  <option value="">Nobody yet</option>
                  {(users.data || []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Urgent?</Label>
                <Select value={data.priority === "High" ? "yes" : "no"} onChange={(event) => update.mutate({ priority: event.target.value === "yes" ? "High" : "Medium" })}>
                  <option value="no">No</option>
                  <option value="yes">Yes, handle first</option>
                </Select>
              </div>
            </div>

            <div>
              <Label>What happened</Label>
              <p className="leading-relaxed whitespace-pre-wrap text-ink-2">{data.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <div className="mb-2 flex items-center gap-1.5 text-sm text-muted">
                  <UserRound className="size-4" /> Customer
                </div>
                {data.customer ? (
                  <>
                    <div className="font-medium">{data.customer.name}</div>
                    <div className="text-sm text-muted">{data.customer.email}</div>
                    <div className="mt-1 text-xs text-muted">Partly hidden to protect privacy</div>
                  </>
                ) : (
                  <p className="text-sm text-muted">Not linked to a customer</p>
                )}
              </div>
              <div className="rounded-xl border border-line p-4">
                <div className="mb-2 flex items-center gap-1.5 text-sm text-muted">
                  <Package className="size-4" /> Order
                </div>
                {data.order ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/orders?open=${encodeURIComponent(data.order.order_number)}`} className="font-medium text-brand hover:underline">
                        {data.order.order_number}
                      </Link>
                      <OrderStatusBadge status={data.order.status} />
                    </div>
                    <div className="mt-1 text-sm text-ink-2">
                      {data.order.product} · {formatCurrency(data.order.amount, data.order.currency)}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">No order linked</p>
                )}
              </div>
            </div>

            {data.session_id && data.messages.length > 0 && (
              <Link
                to={`/conversations?id=${encodeURIComponent(data.session_id)}`}
                className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
              >
                <MessagesSquare className="size-4" /> Read the full chat with the customer <ArrowRight className="size-4" />
              </Link>
            )}

            <SuggestedReply ticket={data} />

            <div>
              <Label>Team notes</Label>
              <p className="mb-2 text-xs text-muted">Only your team can see these. Customers never do.</p>
              <div className="flex gap-2">
                <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note…" className="flex-1" />
                <Button variant="primary" icon={StickyNote} disabled={!note.trim()} loading={addNote.isPending} onClick={() => addNote.mutate()}>
                  Add
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {notes.map((event) => (
                  <div key={event.id} className="rounded-xl border border-line bg-surface-2/50 p-3">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span className="font-medium text-ink">{event.author}</span>
                      <span title={formatDateTime(event.created_at)}>{timeAgo(event.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-ink-2">{event.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

export default function Tickets() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const tickets = useTickets();
  const [tab, setTab] = useState("Open");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const result = { Open: 0, "In Progress": 0, Resolved: 0 };
    for (const ticket of tickets.data || []) result[ticket.status] = (result[ticket.status] || 0) + 1;
    return result;
  }, [tickets.data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tickets.data || [])
      .filter((ticket) => ticket.status === tab)
      .filter((ticket) => !term || `${ticket.number} ${ticket.title} ${ticket.order_number || ""}`.toLowerCase().includes(term))
      .sort((a, b) => (a.priority === "High" ? 0 : 1) - (b.priority === "High" ? 0 : 1) || b.id - a.id);
  }, [tickets.data, tab, search]);

  return (
    <>
      <PageIntro
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New ticket
          </Button>
        }
      >
        When the AI can't solve something, it creates a ticket here for your team. Open one to reply or mark it as resolved.
      </PageIntro>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label, count: counts[option.value] }))}
        />
        <Input icon={Search} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets…" className="w-full sm:ms-auto sm:w-72" />
      </div>

      <Card className="overflow-hidden">
        {tickets.isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={TicketIcon}
            title={search ? "No tickets match your search" : `No ${STATUS_OPTIONS.find((o) => o.value === tab).label.toLowerCase()} tickets`}
            description={tab === "Open" && !search ? "Nice work. Nothing is waiting for your team." : undefined}
          />
        ) : (
          <div className="divide-y divide-line">
            {visible.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className="flex w-full items-center gap-4 px-5 py-4 text-start transition-colors hover:bg-surface-2/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{ticket.title}</span>
                    <UrgentBadge priority={ticket.priority} />
                  </div>
                  <div className="mt-0.5 text-sm text-muted">
                    {ticket.number}
                    {ticket.order_number && ` · ${ticket.order_number}`} · {timeAgo(ticket.created_at)}
                    {ticket.assignee && ` · ${ticket.assignee}`}
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <NewTicketModal open={creating} onClose={() => setCreating(false)} />
      <TicketDetails ticketId={ticketId} onClose={() => navigate("/tickets")} />
    </>
  );
}
