"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import Image from "next/image";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function DonnaChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/donna-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.reply || "Sorry, I couldn't process that. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 md:bottom-24 md:right-8 z-50 w-[calc(100vw-2rem)] max-w-sm">
          <div
            className="rounded-2xl border border-purple-500/30 overflow-hidden shadow-2xl"
            style={{
              background:
                "linear-gradient(180deg, rgba(15,10,40,0.98) 0%, rgba(10,14,26,0.98) 100%)",
              boxShadow:
                "0 0 40px 8px rgba(168,85,247,0.15), 0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20 bg-purple-900/20">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-purple-400/50 flex-shrink-0">
                  {!imageError ? (
                    <Image
                      src="/images/donna/donna-avatar.png"
                      alt="Donna"
                      width={32}
                      height={32}
                      className="object-cover w-full h-full"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-purple-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">D</span>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">
                    Ask Donna
                  </h3>
                  <p className="text-purple-300 text-xs">
                    Your financial assistant
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white transition-colors p-1"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-purple-400/30 mb-3">
                    {!imageError ? (
                      <Image
                        src="/images/donna/donna-avatar.png"
                        alt="Donna"
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                        onError={() => setImageError(true)}
                      />
                    ) : (
                      <div className="w-full h-full bg-purple-600 flex items-center justify-center">
                        <span className="text-white text-lg font-bold">D</span>
                      </div>
                    )}
                  </div>
                  <p className="text-white/80 text-sm font-medium mb-1">
                    Hi! I&apos;m Donna
                  </p>
                  <p className="text-white/50 text-xs">
                    Ask me anything about your business finances
                  </p>
                  <div className="mt-4 space-y-2 w-full">
                    {[
                      "How's my cash flow this month?",
                      "What bills are pending?",
                      "How's my profit looking?",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => sendMessage(suggestion)}
                        className="w-full text-left text-xs text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 hover:bg-purple-500/20 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-purple-600/40 text-white border border-purple-500/30"
                        : "bg-white/5 text-white/90 border border-white/10"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                      <div
                        className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <div
                        className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-purple-500/20 bg-purple-900/10">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Donna anything..."
                  className="flex-1 bg-white/5 border border-purple-500/20 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-400/30 transition-colors"
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Send message"
                >
                  {loading ? (
                    <Loader2 size={16} className="text-white animate-spin" />
                  ) : (
                    <Send size={16} className="text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg"
        style={{
          background: isOpen
            ? "linear-gradient(135deg, #6b21a8, #4c1d95)"
            : "linear-gradient(135deg, #a855f7, #7c3aed, #6d28d9)",
          boxShadow: isOpen
            ? "0 4px 15px rgba(107,33,168,0.4)"
            : "0 4px 25px rgba(168,85,247,0.5), 0 0 40px rgba(168,85,247,0.2)",
        }}
        aria-label={isOpen ? "Close chat" : "Open chat with Donna"}
      >
        {isOpen ? (
          <X size={24} className="text-white" />
        ) : (
          <MessageCircle size={24} className="text-white" />
        )}
      </button>
    </>
  );
}
