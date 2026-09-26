import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { toast } from "sonner";
import { Headset, Lock, MoreVertical, RotateCcw, ShieldCheck, Trash2, X } from "lucide-react";
import { ChatMessage } from "../components/ChatMessage";
import { Composer } from "../components/Composer";
import { LogoMark } from "../components/Logo";
import { api } from "../lib/api";
import { useChat } from "../lib/useChat";

const STORAGE_KEY = "sp_widget_session";

const DEFAULT_BRANDING = {
  company_name: "Customer Support",
  color: "#0f9d58",
  welcome_message: "Hi there! I can help you track an order, answer questions about our policies, or connect you with our team. How can I help?",
};

/** CSS variables that recolour the whole chat window with the company colour. */
function brandStyle(color) {
  return {
    "--widget-a": color,
    "--widget-b": `color-mix(in oklab, ${color} 70%, black)`,
    "--brand": color,
    "--brand-2": `color-mix(in oklab, ${color} 85%, black)`,
    "--brand-ink": `color-mix(in oklab, ${color} 75%, var(--ink))`,
    "--brand-soft": `color-mix(in oklab, ${color} 12%, var(--surface))`,
  };
}
const SUGGESTIONS = ["Track my order", "What is your return policy?", "Talk to a person"];

function readSession() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveSession(id) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Conversation just won't survive a reload
  }
}

function ChatCard({ embedded, branding }) {
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef(null);

  const chat = useChat({ channel: "widget", poll: true, onSessionCreated: saveSession });
  const { load } = chat;

  useEffect(() => {
    const saved = readSession();
    if (saved) load(saved);
  }, [load]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [chat.messages]);

  const send = (text) => {
    setInput("");
    chat.send(text);
  };

  const restart = () => {
    setMenuOpen(false);
    saveSession(null);
    chat.reset();
  };

  const erase = async () => {
    setMenuOpen(false);
    if (!chat.sessionId || !window.confirm("Delete this chat and all its messages for good?")) return;
    try {
      await api(`/public/sessions/${encodeURIComponent(chat.sessionId)}`, { method: "DELETE", auth: false });
      toast.success("Your chat was deleted");
      restart();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const human = chat.mode === "human";

  return (
    <div
      style={brandStyle(branding.color)}
      className={clsx(
        "flex flex-col overflow-hidden bg-page",
        embedded ? "h-full" : "h-[680px] max-h-[calc(100vh-48px)] w-full max-w-[400px] rounded-3xl border border-line shadow-pop"
      )}
    >
      <header className="brand-gradient shrink-0 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-semibold">{branding.company_name}</div>
            <div className="flex items-center gap-1.5 text-xs text-white/85">
              <span className="size-1.5 rounded-full bg-emerald-200" />
              {human ? `You're chatting with ${chat.assignedTo || "our team"}` : "We usually reply right away"}
            </div>
          </div>
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((value) => !value)} className="rounded-lg p-2 hover:bg-white/15" aria-label="More options">
              <MoreVertical className="size-4" />
            </button>
            {menuOpen && (
              <div className="animate-in absolute end-0 top-10 z-10 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 text-sm text-ink shadow-pop">
                <button type="button" onClick={restart} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start hover:bg-surface-2">
                  <RotateCcw className="size-4 text-muted" /> Start a new chat
                </button>
                <button
                  type="button"
                  onClick={erase}
                  disabled={!chat.sessionId}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start text-bad hover:bg-surface-2 disabled:opacity-40"
                >
                  <Trash2 className="size-4" /> Delete my chat
                </button>
              </div>
            )}
          </div>
          {embedded && (
            <button type="button" onClick={() => window.parent.postMessage("supportpilot:close", "*")} className="rounded-lg p-2 hover:bg-white/15" aria-label="Close">
              <X className="size-4" />
            </button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-5">
          <ChatMessage
            variant="widget"
            message={{ key: "welcome", role: "assistant", text: branding.welcome_message, tools: [], sources: [] }}
          />

          {chat.messages.length === 0 && (
            <div className="flex flex-wrap gap-2 ps-11">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-full border border-brand/30 bg-surface px-3 py-1.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-soft"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {chat.messages.map((message) => (
            <ChatMessage key={message.key} message={message} variant="widget" onRate={chat.rate} />
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-surface px-3 pt-3 pb-2">
        {human && (
          <div className="mb-2 flex items-center gap-1.5 px-1 text-xs text-info">
            <Headset className="size-3.5" /> A team member is helping you
          </div>
        )}
        <Composer value={input} onChange={setInput} onSend={send} busy={chat.streaming} placeholder="Type your message…" />
        <div className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted" title="Emails, phone and card numbers are hidden before our AI reads your message.">
          <Lock className="size-3" /> Your personal details are kept private
        </div>
      </div>
    </div>
  );
}

export default function Widget() {
  const [params] = useSearchParams();
  const embedded = params.get("embed") === "1";

  const query = useQuery({
    queryKey: ["branding"],
    queryFn: () => api("/public/branding", { auth: false }),
    staleTime: 60_000,
  });
  const branding = { ...DEFAULT_BRANDING, ...query.data };

  // Tell the website's chat button to use the same colour
  useEffect(() => {
    if (embedded && query.data?.color) {
      window.parent.postMessage({ type: "supportpilot:branding", color: query.data.color }, "*");
    }
  }, [embedded, query.data]);

  if (embedded) {
    return (
      <div className="h-full">
        <ChatCard embedded branding={branding} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-brand-soft to-page px-4 py-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">This is what your customers see</h1>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-muted">
          <ShieldCheck className="size-4 text-good" /> Try asking about order ORD-1001
        </p>
      </div>
      <ChatCard branding={branding} />
    </div>
  );
}
