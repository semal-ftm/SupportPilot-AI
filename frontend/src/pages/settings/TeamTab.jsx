import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, UserMinus, UserPlus, UserRoundCheck } from "lucide-react";
import clsx from "clsx";
import { Avatar, Button, Input, Label, Modal, Select, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Hint, Section } from "./shared";

const ROLE_HELP = {
  agent: "Can answer chats and handle tickets.",
  admin: "Everything an agent can do, plus settings, team and documents.",
};

function AddMemberModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const empty = { name: "", email: "", role: "agent", password: "" };
  const [form, setForm] = useState(empty);

  const add = useMutation({
    mutationFn: () => api("/team", { method: "POST", body: form }),
    onSuccess: (member) => {
      toast.success(`${member.name} was added. Share their email and password with them.`);
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setForm(empty);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const ready = form.name.trim().length >= 2 && form.email.includes("@") && form.password.length >= 8;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a team member"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={UserPlus} loading={add.isPending} disabled={!ready} onClick={() => add.mutate()}>
            Add member
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={set("name")} placeholder="e.g. Sara Ahmed" autoFocus />
        </div>
        <div>
          <Label>Work email</Label>
          <Input type="email" value={form.email} onChange={set("email")} placeholder="sara@yourcompany.com" />
        </div>
        <div>
          <Label>What can they do?</Label>
          <Select value={form.role} onChange={set("role")}>
            <option value="agent">Support agent</option>
            <option value="admin">Admin</option>
          </Select>
          <Hint>{ROLE_HELP[form.role]}</Hint>
        </div>
        <div>
          <Label>Temporary password</Label>
          <Input type="text" value={form.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="off" />
          <Hint>Give this to them privately. They can change it in Settings after signing in.</Hint>
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ member, onClose }) {
  const [password, setPassword] = useState("");

  const reset = useMutation({
    mutationFn: () => api(`/team/${member.id}`, { method: "PATCH", body: { password } }),
    onSuccess: () => {
      toast.success(`New password set for ${member.name}`);
      setPassword("");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Modal
      open={Boolean(member)}
      onClose={onClose}
      title={`Reset password for ${member?.name || ""}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={reset.isPending} disabled={password.length < 8} onClick={() => reset.mutate()}>
            Set password
          </Button>
        </>
      }
    >
      <Label>New temporary password</Label>
      <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete="off" autoFocus />
      <Hint>Use this if they forgot their password. Tell them the new one privately.</Hint>
    </Modal>
  );
}

export default function TeamTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState(null);

  const team = useQuery({ queryKey: ["team"], queryFn: () => api("/team") });

  const update = useMutation({
    mutationFn: ({ id, body }) => api(`/team/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      toast.success("Team updated");
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const members = team.data || [];
  const active = members.filter((member) => member.active);
  const removed = members.filter((member) => !member.active);

  return (
    <Section
      title="Team members"
      description="Everyone who can sign in to this dashboard. Customers never need an account."
    >
      <div className="mb-4">
        <Button variant="primary" icon={UserPlus} onClick={() => setAdding(true)}>
          Add a team member
        </Button>
      </div>

      {team.isLoading && <Skeleton className="h-32" />}

      <div className="divide-y divide-line rounded-xl border border-line">
        {active.map((member) => (
          <div key={member.id} className="flex flex-wrap items-center gap-3 p-4">
            <Avatar name={member.name} tone={member.role === "admin" ? "brand" : "neutral"} className="size-10 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {member.name}
                {member.id === user?.id && <span className="ms-2 text-xs font-normal text-muted">(you)</span>}
              </div>
              <div className="truncate text-sm text-muted">{member.email}</div>
            </div>
            <Select
              value={member.role}
              disabled={member.id === user?.id}
              onChange={(event) => update.mutate({ id: member.id, body: { role: event.target.value } })}
              className="w-40"
              aria-label={`Role for ${member.name}`}
            >
              <option value="agent">Support agent</option>
              <option value="admin">Admin</option>
            </Select>
            {member.id !== user?.id && (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setResetting(member)} title="Reset password">
                  Reset password
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={UserMinus}
                  className="text-bad"
                  onClick={() =>
                    window.confirm(`Remove ${member.name}? They won't be able to sign in any more.`) &&
                    update.mutate({ id: member.id, body: { active: false } })
                  }
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {removed.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-sm font-medium text-muted">Removed members</div>
          <div className="divide-y divide-line rounded-xl border border-dashed border-line">
            {removed.map((member) => (
              <div key={member.id} className={clsx("flex items-center gap-3 p-4 text-muted")}>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{member.name}</div>
                  <div className="truncate text-sm">{member.email}</div>
                </div>
                <Button size="sm" icon={UserRoundCheck} onClick={() => update.mutate({ id: member.id, body: { active: true } })}>
                  Give access again
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddMemberModal open={adding} onClose={() => setAdding(false)} />
      <ResetPasswordModal member={resetting} onClose={() => setResetting(null)} />
    </Section>
  );
}
