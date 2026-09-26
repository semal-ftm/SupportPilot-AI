import { useState } from "react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Headset,
  Loader2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { LogoMark } from "./Logo";
import { Avatar } from "./ui";
import { toolArgument, toolMeta } from "./toolMeta";

export function Markdown({ children }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function ToolStep({ tool }) {
  const meta = toolMeta(tool.name);
  const argument = toolArgument(tool);

  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-2">
      {tool.running ? (
        <Loader2 className="size-4 animate-spin text-brand" />
      ) : tool.ok === false ? (
        <XCircle className="size-4 text-warn" />
      ) : (
        <Check className="size-4 text-good" />
      )}
      <span>
        {meta.label}
        {argument && <span className="text-muted"> ({argument})</span>}
      </span>
      {!tool.running && tool.ok === false && tool.summary && <span className="text-muted">· {tool.summary}</span>}
    </div>
  );
}

/** Tool steps and sources, folded away behind one small toggle. */
function AgentDetails({ message }) {
  const [open, setOpen] = useState(false);
  const tools = message.tools || [];
  const sources = message.sources || [];
  const running = tools.find((tool) => tool.running);

  if (!tools.length && !sources.length) return null;

  if (running) {
    return (
      <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-brand-soft px-3 py-1.5 text-[13px] text-brand-ink">
        <Loader2 className="size-3.5 animate-spin" />
        {toolMeta(running.name).doing}…
      </div>
    );
  }

  const files = [...new Set(sources.map((source) => source.filename))];

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded-md py-0.5 text-[12.5px] font-medium text-muted hover:text-ink"
      >
        What the AI did
        <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="animate-in mt-1.5 space-y-1.5 rounded-xl border border-line bg-surface-2/60 p-3">
          {tools.map((tool) => (
            <ToolStep key={tool.id || tool.name} tool={tool} />
          ))}
          {files.length > 0 && (
            <div className="flex items-start gap-2 pt-1 text-[13px] text-ink-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>
                Answer based on: <span className="font-medium">{files.join(", ")}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PrivacyChip({ redactions }) {
  if (!redactions?.length) return null;

  return (
    <div className="mt-1 flex justify-end">
      <span
        className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11.5px] font-medium text-good"
        title="Personal details like emails, phone or card numbers were hidden before the message reached the AI."
      >
        <ShieldCheck className="size-3" />
        Personal info hidden from AI
      </span>
    </div>
  );
}

export function ChatMessage({ message, onRate, variant = "console" }) {
  const [copied, setCopied] = useState(false);

  if (message.role === "system") {
    return (
      <div className="animate-in flex justify-center py-1">
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
            message.handoff ? "border-brand/30 bg-brand-soft text-brand-ink" : "border-line bg-surface-2 text-muted"
          )}
        >
          <Headset className="size-3.5" />
          {message.text}
        </span>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="animate-in flex flex-col items-end">
        <div
          className={clsx(
            "max-w-[85%] rounded-2xl rounded-ee-md px-4 py-2.5 leading-relaxed whitespace-pre-wrap text-white shadow-card",
            variant === "widget" ? "brand-gradient" : "bg-brand"
          )}
        >
          {message.text}
        </div>
        <PrivacyChip redactions={message.redactions} />
      </div>
    );
  }

  const isAgent = message.role === "agent";
  const running = message.streaming;
  const showTyping = running && !message.text && !message.tools?.some((tool) => tool.running);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; nothing else to do
    }
  };

  return (
    <div className="animate-in group flex gap-3">
      {isAgent ? <Avatar name={message.author || "Agent"} className="mt-0.5 size-8 text-xs" /> : <LogoMark className="mt-0.5 size-8" />}

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2 text-xs">
          <span className="font-semibold text-ink">{isAgent ? message.author || "Support team" : variant === "widget" ? "Assistant" : "SupportPilot AI"}</span>
          {isAgent && <span className="rounded bg-info-soft px-1.5 py-px text-[10px] font-medium text-info">Team member</span>}
        </div>

        {running && <AgentDetails message={message} />}

        {showTyping && (
          <div className="typing inline-flex gap-1 rounded-2xl bg-surface-2 px-4 py-3">
            <span className="size-1.5 rounded-full bg-muted" />
            <span className="size-1.5 rounded-full bg-muted" />
            <span className="size-1.5 rounded-full bg-muted" />
          </div>
        )}

        {message.text && (
          <div
            className={clsx(
              "max-w-2xl text-ink-2",
              message.error && "flex items-start gap-2 rounded-xl border border-bad/20 bg-bad-soft px-3 py-2 text-bad",
              running && "caret"
            )}
          >
            {message.error && <AlertCircle className="mt-0.5 size-4 shrink-0" />}
            <Markdown>{message.text}</Markdown>
          </div>
        )}

        {!running && !message.error && message.text && (
          <>
            {variant === "console" && <AgentDetails message={message} />}
            <div className="mt-1 flex items-center gap-0.5 text-muted opacity-70 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={copy} className="rounded-md p-1.5 hover:bg-surface-2 hover:text-ink" title="Copy">
                {copied ? <Check className="size-3.5 text-good" /> : <Copy className="size-3.5" />}
              </button>
              {onRate && message.id && !isAgent && (
                <>
                  <button
                    type="button"
                    onClick={() => onRate(message, 1)}
                    className={clsx("rounded-md p-1.5 hover:bg-surface-2", message.rating === 1 ? "text-good" : "hover:text-ink")}
                    title="Helpful"
                    aria-pressed={message.rating === 1}
                  >
                    <ThumbsUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRate(message, -1)}
                    className={clsx("rounded-md p-1.5 hover:bg-surface-2", message.rating === -1 ? "text-bad" : "hover:text-ink")}
                    title="Not helpful"
                    aria-pressed={message.rating === -1}
                  >
                    <ThumbsDown className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
