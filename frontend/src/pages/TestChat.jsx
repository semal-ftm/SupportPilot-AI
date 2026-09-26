import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenText, CreditCard, PackageSearch, RotateCcw, ShieldCheck } from "lucide-react";
import { ChatMessage } from "../components/ChatMessage";
import { Composer } from "../components/Composer";
import { LogoMark } from "../components/Logo";
import { Button } from "../components/ui";
import { useChat } from "../lib/useChat";
import { setFlag } from "../lib/flags";

const EXAMPLES = [
  { icon: PackageSearch, title: "Track an order", text: "Where is order ORD-1001?" },
  { icon: BookOpenText, title: "Ask about returns", text: "Can I return a product after 20 days?" },
  { icon: CreditCard, title: "Report a problem", text: "I was charged twice for order ORD-1002." },
  { icon: ShieldCheck, title: "See privacy in action", text: "Please cancel ORD-1006, my email is lina@example.com" },
];

export default function TestChat() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(() => params.get("prompt") || "");
  const scrollRef = useRef(null);

  const chat = useChat({
    channel: "console",
    staff: true,
    onSessionCreated: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });

  useEffect(() => {
    if (params.get("prompt")) setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [chat.messages]);

  const send = (text) => {
    setInput("");
    setFlag("tried_chat");
    chat.send(text);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {chat.messages.length === 0 ? (
            <div className="flex flex-col items-center pt-[6vh] text-center">
              <LogoMark className="size-14" />
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">Try your AI assistant</h2>
              <p className="mt-2 max-w-md text-muted">
                Chat here exactly like a customer would. Nothing you do here is seen by customers. Pick an example or type your own question.
              </p>
              <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example.title}
                    type="button"
                    onClick={() => send(example.text)}
                    className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 text-start shadow-card transition-all hover:-translate-y-0.5 hover:border-brand/40"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <example.icon className="size-4" />
                    </span>
                    <span>
                      <span className="block font-medium text-ink">{example.title}</span>
                      <span className="mt-0.5 block text-sm text-muted">“{example.text}”</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {chat.messages.map((message) => (
                <ChatMessage key={message.key} message={message} onRate={chat.rate} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-page px-4 pt-3 pb-4">
        <div className="mx-auto max-w-3xl">
          {chat.messages.length > 0 && (
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="ghost" icon={RotateCcw} onClick={chat.reset} disabled={chat.streaming}>
                Start a new chat
              </Button>
            </div>
          )}
          <Composer
            value={input}
            onChange={setInput}
            onSend={send}
            busy={chat.streaming}
            autoFocus
            placeholder="Type a message…"
            footer="Personal details like emails and card numbers are hidden from the AI automatically."
          />
        </div>
      </div>
    </div>
  );
}
