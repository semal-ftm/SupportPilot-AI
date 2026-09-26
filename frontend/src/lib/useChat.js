import { useCallback, useEffect, useRef, useState } from "react";
import { api, streamChat } from "./api";

let counter = 0;
const nextKey = () => `m${Date.now()}-${counter++}`;

export function fromServer(message) {
  return {
    key: `s${message.id}`,
    id: message.id,
    role: message.role,
    text: message.text,
    tools: message.tools || [],
    sources: message.sources || [],
    redactions: message.redactions || [],
    // Stored text is already masked, so it is exactly what the AI saw
    maskedText: message.redactions?.length ? message.text : undefined,
    sentiment: message.sentiment,
    author: message.author,
    latency: message.latency_ms,
    rating: message.rating ?? null,
    createdAt: message.created_at,
  };
}

/**
 * Chat state shared by the staff AI console and the customer widget.
 * `staff` loads history through the authenticated inbox API; otherwise the
 * public session endpoint is used. `poll` keeps checking for replies from
 * a human agent after a takeover.
 */
export function useChat({ channel = "widget", staff = false, poll = false, onSessionCreated } = {}) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [mode, setMode] = useState("ai");
  const [assignedTo, setAssignedTo] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const abortRef = useRef(null);
  const sessionRef = useRef(null);
  const messagesRef = useRef(messages);
  const onSessionRef = useRef(onSessionCreated);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    onSessionRef.current = onSessionCreated;
  }, [onSessionCreated]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = useCallback((key, update) => {
    setMessages((current) =>
      current.map((message) =>
        message.key === key
          ? { ...message, ...(typeof update === "function" ? update(message) : update) }
          : message
      )
    );
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    sessionRef.current = null;
    setSessionId(null);
    setMessages([]);
    setMode("ai");
    setAssignedTo(null);
    setStreaming(false);
  }, []);

  const load = useCallback(
    async (id) => {
      abortRef.current?.abort();
      sessionRef.current = id;
      setSessionId(id);
      setStreaming(false);
      setLoadingHistory(true);

      try {
        const data = staff
          ? await api(`/sessions/${encodeURIComponent(id)}`)
          : await api(`/public/sessions/${encodeURIComponent(id)}/messages`, { auth: false });

        if (sessionRef.current !== id) return;

        setMessages(data.messages.map(fromServer));
        setMode(data.mode || "ai");
        setAssignedTo(data.assigned_to || null);
      } catch {
        if (sessionRef.current === id) setMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    },
    [staff]
  );

  const send = useCallback(
    async (rawText) => {
      const text = rawText.trim();
      if (!text || streaming) return;

      const userKey = nextKey();
      const botKey = nextKey();
      const startedAt = Date.now();

      setMessages((current) => [
        ...current,
        { key: userKey, role: "user", text, tools: [], sources: [], redactions: [], createdAt: new Date().toISOString() },
        { key: botKey, role: "assistant", text: "", tools: [], sources: [], streaming: true, createdAt: new Date().toISOString() },
      ]);

      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamChat({
          message: text,
          sessionId: sessionRef.current,
          channel,
          signal: controller.signal,
          onEvent: (event) => {
            switch (event.type) {
              case "meta":
                if (!sessionRef.current) {
                  sessionRef.current = event.session_id;
                  setSessionId(event.session_id);
                  onSessionRef.current?.(event.session_id);
                }
                setMode(event.mode);
                patch(userKey, {
                  id: event.user_message_id,
                  redactions: event.redactions,
                  maskedText: event.masked_text,
                  sentiment: event.sentiment,
                });
                break;

              case "tool_start":
                patch(botKey, (message) => ({
                  tools: [...message.tools, { ...event, running: true }],
                }));
                break;

              case "tool_end":
                patch(botKey, (message) => ({
                  tools: message.tools.map((tool) => (tool.id === event.id ? { ...event, running: false } : tool)),
                }));
                break;

              case "sources":
                patch(botKey, { sources: event.sources });
                break;

              case "token":
                patch(botKey, (message) => ({ text: message.text + event.text }));
                break;

              case "done":
                patch(botKey, {
                  id: event.message_id,
                  text: event.text,
                  tools: event.tools,
                  sources: event.sources,
                  latency: event.latency_ms,
                  streaming: false,
                });
                break;

              case "handoff":
                setMode("human");
                // Show the notice once; after that the team member's replies speak for themselves
                if (messagesRef.current.some((message) => message.handoff)) {
                  setMessages((current) => current.filter((message) => message.key !== botKey));
                } else {
                  patch(botKey, { role: "system", text: event.text, streaming: false, handoff: true });
                }
                break;

              case "error":
                patch(botKey, { text: event.message, error: true, streaming: false });
                break;

              default:
                break;
            }
          },
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          patch(botKey, { text: error.message, error: true, streaming: false });
        }
      } finally {
        patch(botKey, (message) => ({
          streaming: false,
          latency: message.latency ?? Date.now() - startedAt,
        }));
        setStreaming(false);
      }
    },
    [channel, patch, streaming]
  );

  const rate = useCallback(
    async (message, rating) => {
      if (!message.id || !sessionRef.current) return;
      const next = message.rating === rating ? 0 : rating;
      patch(message.key, { rating: next || null });
      try {
        await api("/feedback", {
          method: "POST",
          auth: false,
          body: { message_id: message.id, session_id: sessionRef.current, rating: next },
        });
      } catch {
        patch(message.key, { rating: message.rating });
      }
    },
    [patch]
  );

  // Pick up replies written by a human agent after a takeover
  useEffect(() => {
    if (!poll || !sessionId) return;

    const timer = setInterval(async () => {
      if (streaming) return;

      const known = messagesRef.current;
      const lastId = Math.max(0, ...known.map((message) => message.id || 0));

      try {
        const data = await api(`/public/sessions/${encodeURIComponent(sessionId)}/messages?after=${lastId}`, {
          auth: false,
        });

        setMode(data.mode);
        setAssignedTo(data.assigned_to || null);

        const ids = new Set(known.map((message) => message.id).filter(Boolean));
        const incoming = data.messages
          .filter((message) => !ids.has(message.id) && ["agent", "system"].includes(message.role))
          .map(fromServer);

        if (incoming.length) setMessages((current) => [...current, ...incoming]);
      } catch {
        // Temporary network issue: try again on the next tick
      }
    }, 3500);

    return () => clearInterval(timer);
  }, [poll, sessionId, streaming]);

  return {
    messages,
    sessionId,
    mode,
    assignedTo,
    streaming,
    loadingHistory,
    send,
    load,
    reset,
    rate,
  };
}
