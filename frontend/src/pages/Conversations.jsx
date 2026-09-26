import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { ArrowLeft, Bot, Hand, Headset, MessagesSquare, Ticket, Trash2 } from "lucide-react";
import { ChatMessage } from "../components/ChatMessage";
import { Composer } from "../components/Composer";
import { Button, EmptyState, Segmented, Skeleton } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { timeAgo } from "../lib/format";
import { useSessions } from "../lib/queries";
import { fromServer } from "../lib/useChat";

function ConversationRow({ session, active, onClick }) {
  const needsPerson = session.escalated && session.mode !== "human";

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "relative w-full border-b border-line px-4 py-3.5 text-start transition-colors",
        active ? "bg-brand-soft/60" : "hover:bg-surface-2/60"
      )}
    >
      {active && <span className="absolute inset-y-0 start-0 w-1 bg-brand" />}
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{session.title}</span>
        <span className="shrink-0 text-xs text-muted">{timeAgo(session.updated_at)}</span>
      </div>
      <p className="mt-0.5 line-clamp-1 text-sm text-muted">{session.last_message.replace(/[*_`#>]/g, "")}</p>
      <div className="mt-2 text-xs font-medium">
        {session.mode === "human" ? (
          <span className="inline-flex items-center gap-1 text-info">
            <Headset className="size-3.5" /> {session.assigned_to || "Your team"} is replying
          </span>
        ) : needsPerson ? (
          <span className="inline-flex items-center gap-1 text-warn">
            <Ticket className="size-3.5" /> Passed to your team
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-brand-ink">
            <Bot className="size-3.5" /> AI is replying
          </span>
        )}
      </div>
    </button>
  );
}

export default function Conversations() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState("all");
  const [reply, setReply] = useState("");
  const scrollRef = useRef(null);

  const activeId = params.get("id");
  const sessions = useSessions(view === "team" ? "escalated" : "all");

  const detail = useQuery({
    queryKey: ["session", activeId],
    queryFn: () => api(`/sessions/${encodeURIComponent(activeId)}`),
    enabled: Boolean(activeId),
    refetchInterval: 4_000,
  });

  const messages = useMemo(() => (detail.data?.messages || []).map(fromServer), [detail.data]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight });
  }, [messages.length, activeId]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["session", activeId] });
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
  };

  const modeMutation = useMutation({
    mutationFn: (action) => api(`/sessions/${encodeURIComponent(activeId)}/${action}`, { method: "POST" }),
    onSuccess: (_, action) => {
      toast.success(action === "takeover" ? "You are now replying to this customer" : "The AI will reply again");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const replyMutation = useMutation({
    mutationFn: (text) => api(`/sessions/${encodeURIComponent(activeId)}/reply`, { method: "POST", body: { text } }),
    onSuccess: () => {
      setReply("");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/sessions/${encodeURIComponent(activeId)}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Conversation deleted");
      setParams({});
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const session = detail.data;
  const isHuman = session?.mode === "human";

  return (
    <div className="flex h-full">
      <aside className={clsx("w-full shrink-0 flex-col border-e border-line bg-surface md:flex md:w-80", activeId ? "hidden" : "flex")}>
        <div className="border-b border-line p-3">
          <p className="mb-3 px-1 text-sm text-muted">Every chat customers have with your AI shows up here. Your own Test Chat messages are not included.</p>
          <Segmented
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All chats" },
              { value: "team", label: "Passed to team" },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.isLoading &&
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="border-b border-line p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            ))}
          {sessions.data?.length === 0 && <EmptyState icon={MessagesSquare} title="No chats yet" description="When customers chat with your AI, they appear here." />}
          {sessions.data?.map((item) => (
            <ConversationRow key={item.id} session={item} active={item.id === activeId} onClick={() => setParams({ id: item.id })} />
          ))}
        </div>
      </aside>

      <section className={clsx("min-w-0 flex-1 flex-col", activeId ? "flex" : "hidden md:flex")}>
        {!activeId ? (
          <div className="grid flex-1 place-items-center">
            <EmptyState
              icon={MessagesSquare}
              title="Pick a chat to read it"
              description="You can read what the AI said, and take over to reply yourself at any time."
            />
          </div>
        ) : (
          <>
            <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2">
              <Button variant="ghost" size="sm" icon={ArrowLeft} className="md:hidden" onClick={() => setParams({})} aria-label="Back" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{session?.title || "…"}</div>
                {session?.tickets?.length > 0 && (
                  <div className="text-xs text-muted">
                    Ticket:{" "}
                    {session.tickets.map((ticket) => (
                      <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="me-2 font-medium text-brand hover:underline">
                        {ticket.number}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {isAdmin && session && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  title="Delete conversation"
                  aria-label="Delete conversation"
                  loading={deleteMutation.isPending}
                  onClick={() => window.confirm("Delete this conversation for good?") && deleteMutation.mutate()}
                />
              )}
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
                {detail.isError ? (
                  <EmptyState
                    icon={MessagesSquare}
                    title="This chat is no longer available"
                    description="It may have been deleted by the customer or removed after the privacy retention period."
                  />
                ) : detail.isLoading ? (
                  <>
                    <Skeleton className="ms-auto h-10 w-1/2" />
                    <Skeleton className="h-20 w-3/4" />
                  </>
                ) : (
                  messages.map((message) => <ChatMessage key={message.key} message={message} />)
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-line bg-page px-4 pt-3 pb-4">
              <div className="mx-auto max-w-3xl">
                {session && !isHuman ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <Bot className="size-5 text-brand" />
                      <div>
                        <div className="font-medium">The AI is replying to this customer</div>
                        <div className="text-sm text-muted">Take over if you want to answer yourself.</div>
                      </div>
                    </div>
                    <Button variant="primary" icon={Hand} loading={modeMutation.isPending} onClick={() => modeMutation.mutate("takeover")}>
                      Take over
                    </Button>
                  </div>
                ) : (
                  session && (
                    <>
                      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-1.5 text-info">
                          <Headset className="size-4" /> You are replying. The AI is paused.
                        </span>
                        <Button size="sm" variant="ghost" icon={Bot} loading={modeMutation.isPending} onClick={() => modeMutation.mutate("release")}>
                          Let the AI reply again
                        </Button>
                      </div>
                      <Composer
                        value={reply}
                        onChange={setReply}
                        onSend={(text) => replyMutation.mutate(text)}
                        busy={replyMutation.isPending}
                        autoFocus
                        placeholder="Write your reply to the customer…"
                        footer="The customer sees your reply in their chat within a few seconds."
                      />
                    </>
                  )
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
