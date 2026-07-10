"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, ArrowUp, KeyRound, Loader2, MessageCircle, Check, X, ShieldCheck } from "lucide-react";

type PendingAction =
  | { type: "send_whatsapp"; client_name: string; message: string; label: string }
  | { type: "create_task"; title: string; client_name?: string; due_in_days?: number; priority?: string; label: string };
type ActionState = { action: PendingAction; state: "pending" | "running" | "done" | "cancelled"; result?: string };
type Msg = { role: "user" | "assistant"; content: string; action?: ActionState };

const SUGGESTIONS = [
  "What needs my attention today?",
  "Which clients have no health cover?",
  "Draft and send a renewal reminder to my most overdue client",
  "Remind me to call my newest lead tomorrow",
];

export function AssistantChat({ available }: { available: boolean }) {
  const [ok, setOk] = useState(available);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // re-check in case the key was added after page load
  useEffect(() => {
    if (!available) {
      fetch("/api/ai/status").then((r) => r.json()).then((d) => setOk(!!d.available)).catch(() => {});
    }
  }, [available]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    // history of plain text turns to send to the API (exclude the placeholder)
    const history = [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: q }];
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Request failed");
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: d.text || (d.pendingAction ? "Here's what I'll do — confirm below:" : ""),
          action: d.pendingAction ? { action: d.pendingAction, state: "pending" } : undefined,
        };
        return copy;
      });
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "⚠️ " + (err instanceof Error ? err.message : "Something went wrong.") };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  const setAction = (idx: number, patch: Partial<ActionState>) =>
    setMessages((m) => m.map((msg, i) => (i === idx && msg.action ? { ...msg, action: { ...msg.action, ...patch } } : msg)));

  const confirmAction = async (idx: number) => {
    const a = messages[idx]?.action;
    if (!a || a.state !== "pending") return;
    setAction(idx, { state: "running" });
    try {
      const res = await fetch("/api/ai/act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a.action) });
      const d = await res.json();
      setAction(idx, { state: d.ok ? "done" : "pending", result: d.message });
    } catch {
      setAction(idx, { state: "pending", result: "Network error — try again." });
    }
  };
  const cancelAction = (idx: number) => setAction(idx, { state: "cancelled" });

  if (!ok) return <SetupCard />;

  const empty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-3xl flex-col">
      <div className="flex items-center gap-2.5 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--accent)" }}>
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-ink">AI Assistant</h1>
          <p className="text-[11px] text-ink-3">Asks your live book · runs on your own Claude key · no Aadhaar/PAN is ever sent</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--accent-50)" }}>
              <MessageCircle size={22} className="text-accent" />
            </div>
            <p className="text-sm font-medium text-ink">Ask anything about your book</p>
            <p className="mt-1 max-w-sm text-xs text-ink-3">I can see your book and can draft &amp; send WhatsApp messages or create reminders — you confirm before anything happens.</p>
            <div className="mt-5 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border p-3 text-left text-xs text-ink-2 transition hover:bg-surface-2 hover:text-ink"
                  style={{ borderColor: "var(--border)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} msg={m} streaming={busy && i === messages.length - 1} onConfirm={() => confirmAction(i)} onCancel={() => cancelAction(i)} />)
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-3 flex items-end gap-2 rounded-2xl border bg-surface p-2"
        style={{ borderColor: "var(--border-2)" }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={1}
          placeholder="Ask about renewals, leads, a client… or “draft a message for…”"
          className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-ink-4"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white transition disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
        </button>
      </form>
      <p className="pt-2 text-center text-[10px] text-ink-4">Claude can be wrong — double-check figures before acting.</p>
    </div>
  );
}

function Bubble({ msg, streaming, onConfirm, onCancel }: { msg: Msg; streaming: boolean; onConfirm: () => void; onCancel: () => void }) {
  const me = msg.role === "user";
  return (
    <div className={`flex flex-col ${me ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${me ? "text-white" : "text-ink-2"}`}
        style={me ? { background: "var(--accent)" } : { background: "var(--surface-2)" }}
      >
        {msg.content || (streaming ? <Loader2 size={14} className="animate-spin text-ink-3" /> : "")}
      </div>
      {msg.action && <ActionCard a={msg.action} onConfirm={onConfirm} onCancel={onCancel} />}
    </div>
  );
}

function ActionCard({ a, onConfirm, onCancel }: { a: ActionState; onConfirm: () => void; onCancel: () => void }) {
  const act = a.action;
  return (
    <div className="mt-1.5 w-[85%] rounded-2xl border p-3" style={{ borderColor: "var(--accent-100)", background: "var(--accent-50)" }}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--accent-700)" }}>
        <ShieldCheck size={13} /> {act.label} — needs your confirmation
      </div>
      {act.type === "send_whatsapp" && (
        <div className="mt-2 whitespace-pre-wrap rounded-xl bg-surface px-3 py-2 text-xs text-ink-2" style={{ border: "0.5px solid var(--border-2)" }}>{act.message}</div>
      )}
      {act.type === "create_task" && (
        <div className="mt-2 text-xs text-ink-2">Task: <b className="text-ink">{act.title}</b>{act.client_name ? ` · ${act.client_name}` : ""}{typeof act.due_in_days === "number" ? ` · due in ${act.due_in_days}d` : ""}</div>
      )}

      {a.state === "done" ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--emerald-700)" }}><Check size={13} /> {a.result}</div>
      ) : a.state === "cancelled" ? (
        <div className="mt-2 text-xs text-ink-4">Cancelled — nothing was sent.</div>
      ) : (
        <div className="mt-2.5 flex items-center gap-2">
          <button onClick={onConfirm} disabled={a.state === "running"} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--accent)" }}>
            {a.state === "running" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {act.type === "send_whatsapp" ? "Confirm & send" : "Confirm & create"}
          </button>
          <button onClick={onCancel} disabled={a.state === "running"} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2"><X size={13} /> Cancel</button>
          {a.result && a.state === "pending" && <span className="text-[11px]" style={{ color: "var(--red-700)" }}>{a.result}</span>}
        </div>
      )}
    </div>
  );
}

function SetupCard() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-2.5 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--accent)" }}>
          <Sparkles size={16} className="text-white" />
        </div>
        <h1 className="text-base font-semibold text-ink">AI Assistant</h1>
      </div>
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--amber-50)" }}>
            <KeyRound size={17} style={{ color: "var(--amber-700)" }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Add your Claude key to turn this on</h2>
            <p className="mt-1 text-xs text-ink-3">
              The assistant, AI briefing and message drafting all run on <b>your own</b> Anthropic key. Nothing
              turns on until you add it, and your Aadhaar/PAN are never sent.
            </p>
            <ol className="mt-3 space-y-2 text-xs text-ink-2">
              <li>1. Get a key at <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-accent underline">console.anthropic.com</a> (Settings → API Keys).</li>
              <li>2. Open the file <code className="rounded bg-surface-3 px-1.5 py-0.5">.env</code> in the project folder.</li>
              <li>3. Put your key between the quotes:
                <pre className="mt-1.5 overflow-x-auto rounded-lg p-2.5 text-[11px]" style={{ background: "var(--surface-3)" }}>ANTHROPIC_API_KEY=&quot;sk-ant-…&quot;</pre>
              </li>
              <li>4. Stop the app (Ctrl+C in the terminal) and run <code className="rounded bg-surface-3 px-1.5 py-0.5">npm run dev</code> again.</li>
            </ol>
          </div>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-center text-[11px] text-ink-4">
        <Send size={11} /> Everything else in the CRM works without a key — only the AI features need it.
      </p>
    </div>
  );
}
