import { useEffect, useRef, useState } from "react";
import { type ChatSuggestion, getSurveyChatWelcome, sendSurveyChat } from "../api/client";

export type AskQuestionPayload = {
  questionId: string;
  questionLabel: string;
};

type HistoryEntry = { role: "user" | "assistant"; content: string };

type Message = {
  id: number;
  role: "user" | "bot";
  text: string;
  /** Set on bot messages that have clickable suggestion tiles */
  suggestions?: ChatSuggestion[];
  /** Tracks which question this suggestion set belongs to */
  questionId?: string;
  pending?: boolean;
};

interface Props {
  token: string;
  pendingQuestion: AskQuestionPayload | null;
  onClearPendingQuestion: () => void;
  onSelectSuggestion: (questionId: string, value: unknown) => void;
  isOpen: boolean;
  onToggle: () => void;
}

let _id = 0;
const uid = () => ++_id;

export function SurveyChat({
  token,
  pendingQuestion,
  onClearPendingQuestion,
  onSelectSuggestion,
  isOpen,
  onToggle,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch welcome message once on mount
  useEffect(() => {
    getSurveyChatWelcome(token)
      .then((r) => {
        setMessages([{ id: uid(), role: "bot", text: r.reply }]);
      })
      .catch(() => {
        setMessages([
          {
            id: uid(),
            role: "bot",
            text: 'Hi! I\'m here to help you understand this survey. Ask me anything about the questions, or click "Ask the assistant for help" next to any question.',
          },
        ]);
      });
  }, [token]);

  // Auto-send when a per-question help request arrives from the form
  useEffect(() => {
    if (!pendingQuestion) return;
    const { questionId, questionLabel } = pendingQuestion;
    onClearPendingQuestion();

    if (!isOpen) onToggle();

    const userText = `How should I answer: "${questionLabel}"?`;
    const placeholderId = uid();

    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text: userText },
      { id: placeholderId, role: "bot", text: "", pending: true },
    ]);
    setBusy(true);

    sendSurveyChat(token, { mode: "question_help", message: userText, questionId, history })
      .then((r) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? { ...m, text: r.reply, suggestions: r.suggestions ?? [], questionId, pending: false }
              : m,
          ),
        );
        setHistory((h) => [
          ...h,
          { role: "user", content: userText },
          { role: "assistant", content: r.reply },
        ]);
      })
      .catch(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? { ...m, text: "Sorry, I couldn't load help for that question. Please try again.", pending: false }
              : m,
          ),
        );
      })
      .finally(() => setBusy(false));
  }, [pendingQuestion]);

  // Scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");

    const placeholderId = uid();
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text },
      { id: placeholderId, role: "bot", text: "", pending: true },
    ]);
    setBusy(true);

    try {
      const r = await sendSurveyChat(token, { mode: "general", message: text, history });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, text: r.reply, suggestions: r.suggestions, pending: false }
            : m,
        ),
      );
      setHistory((h) => [
        ...h,
        { role: "user", content: text },
        { role: "assistant", content: r.reply },
      ]);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === placeholderId
            ? { ...m, text: "I couldn't reach the assistant right now. Please try again.", pending: false }
            : m,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasUnread = messages.some((m) => m.role === "bot") && !isOpen;

  return (
    <>
      {/* Floating action button */}
      <button
        type="button"
        className={`sc-fab${isOpen ? " sc-fab--open" : ""}`}
        onClick={onToggle}
        aria-label={isOpen ? "Close assistant" : "Open assistant"}
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
        )}
        {hasUnread && <span className="sc-fab-dot" aria-hidden />}
      </button>

      {/* Panel */}
      <aside className={`sc-panel${isOpen ? " sc-panel--open" : ""}`} aria-label="Survey assistant">
        {/* Header */}
        <div className="sc-header">
          <span className="sc-header-avatar" aria-hidden>✦</span>
          <div className="sc-header-meta">
            <div className="sc-header-title">Survey Assistant</div>
            <div className="sc-header-sub">Ask me about any question</div>
          </div>
          <button type="button" className="sc-close-btn" onClick={onToggle} aria-label="Close assistant">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Message feed */}
        <div className="sc-feed" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((msg) => (
            <div key={msg.id} className={`sc-bubble-wrap sc-bubble-wrap--${msg.role}`}>
              {msg.role === "bot" && <span className="sc-avatar" aria-hidden>✦</span>}
              <div className="sc-bubble">
                {msg.pending ? (
                  <span className="sc-dots" aria-label="Typing">
                    <span /><span /><span />
                  </span>
                ) : (
                  <>
                    <p className="sc-bubble-text">{msg.text}</p>

                    {/* Clickable option tiles */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="sc-tiles">
                        {msg.suggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            className="sc-tile"
                            onClick={() => {
                              if (msg.questionId) onSelectSuggestion(msg.questionId, s.value);
                            }}
                          >
                            <span className="sc-tile-label">{s.label}</span>
                            <span className="sc-tile-desc">{s.description}</span>
                            {s.details && s.details.length > 0 && (
                              <ul className="sc-tile-bullets">
                                {s.details.map((d, di) => (
                                  <li key={di}>{d}</li>
                                ))}
                              </ul>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div className="sc-input-wrap">
          <input
            ref={inputRef}
            type="text"
            className="sc-input"
            placeholder="Ask about this survey…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={busy}
            maxLength={800}
            aria-label="Message to assistant"
          />
          <button
            type="button"
            className="sc-send"
            onClick={handleSend}
            disabled={busy || !input.trim()}
            aria-label="Send message"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>

        <p className="sc-notice">Cannot provide legal or case-specific advice.</p>
      </aside>
    </>
  );
}
