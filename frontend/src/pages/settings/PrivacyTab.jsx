import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Eraser, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { Button, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { timeAgo } from "../../lib/format";
import { Section } from "./shared";

const ACTION_LABELS = {
  login: "signed in",
  customer_pii_revealed: "viewed a customer's full details",
  conversation_deleted: "deleted a conversation",
  conversation_erased: "deleted their own conversation",
  document_uploaded: "uploaded a document",
  document_deleted: "removed a document",
  manual_purge: "deleted old conversations",
  retention_purge: "deleted old conversations automatically",
  seed_demo: "added demo data",
  password_changed: "changed their password",
  team_member_added: "added a team member",
  team_member_updated: "changed a team member",
  settings_changed: "changed settings",
};

function PrivacyLog() {
  const [open, setOpen] = useState(false);
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => api("/privacy/audit?limit=30"), enabled: open });

  return (
    <div className="mt-5 border-t border-line pt-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
        Privacy log (who did what)
        <ChevronDown className={clsx("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {audit.isLoading && <Skeleton className="h-24" />}
          {audit.data?.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
              <span>
                <span className="font-medium">{row.actor === "system" ? "System" : row.actor}</span>{" "}
                <span className="text-ink-2">{ACTION_LABELS[row.action] || row.action}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{timeAgo(row.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PrivacyTab() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["privacy"], queryFn: () => api("/privacy/overview") });
  const settings = overview.data?.settings;

  const purge = useMutation({
    mutationFn: () => api("/privacy/purge", { method: "POST", body: { older_than_days: settings.retention_days } }),
    onSuccess: (data) => {
      toast.success(data.removed ? `${data.removed} old conversation(s) deleted` : "There were no old conversations to delete");
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error.message),
  });

  const items = settings
    ? [
        { on: settings.pii_masking, text: "Emails, phone numbers, card numbers, bank accounts and ID numbers are hidden before the AI sees a message." },
        { on: settings.document_redaction, text: "Personal details are removed from uploaded help documents." },
        { on: true, text: `Chats are deleted automatically after ${settings.retention_days} days without activity.` },
        { on: true, text: "Customers can delete their own chat at any time from the chat window." },
      ]
    : [];

  return (
    <Section title="Privacy" description="How SupportPilot protects your customers' personal information.">
      {overview.isLoading ? (
        <Skeleton className="h-28" />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.text} className="flex items-start gap-3">
              <ShieldCheck className={clsx("mt-0.5 size-5 shrink-0", item.on ? "text-good" : "text-muted")} />
              <span className="text-ink-2">
                {item.text}
                {!item.on && <span className="ms-1 font-medium text-warn">(turned off)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && settings && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2/60 p-4">
            <div>
              <div className="font-medium">Delete old chats now</div>
              <div className="text-sm text-muted">Removes chats with no activity for {settings.retention_days} days. This happens automatically too.</div>
            </div>
            <Button
              variant="danger"
              icon={Eraser}
              loading={purge.isPending}
              onClick={() => window.confirm(`Delete all chats older than ${settings.retention_days} days? This can't be undone.`) && purge.mutate()}
            >
              Delete old chats
            </Button>
          </div>
          <PrivacyLog />
        </>
      )}

      <p className="mt-5 text-xs text-muted">
        This describes built-in safeguards and is not legal advice. Before using real customer data, check your setup with your compliance or legal team.
      </p>
    </Section>
  );
}
