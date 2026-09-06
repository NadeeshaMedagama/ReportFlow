'use client';

import type { ChatMessage } from '@weekly-report/shared';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SimpleMarkdown } from '@/components/ui/simple-markdown';
import { Spinner } from '@/components/ui/loading';
import { assistantApi } from '@/lib/api/assistant';
import { errorMessage } from '@/lib/api-client';
import { useAssistantStatus } from '@/lib/hooks/use-assistant';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'Who has not submitted a report this week?',
  'What did the team work on last week?',
  'Which blockers keep coming up?',
  'Who is carrying the most hours on the Platform Migration?',
];

/**
 * Floating AI assistant for managers. The whole conversation lives in
 * component state and is sent to POST /assistant/chat on every turn.
 */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = useAssistantStatus(open);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const response = await assistantApi.chat(next);
      setMessages([...next, { role: 'assistant', content: response.reply }]);
    } catch (e) {
      setError(errorMessage(e));
      setMessages(messages); // roll back the optimistic user message
      setInput(content);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-slate-900 text-white shadow-lg transition-all hover:w-auto hover:bg-slate-800 hover:px-4"
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label="AI assistant"
        title="AI assistant"
      >
        <span aria-hidden className="text-lg">✨</span>
        <span className="hidden text-sm font-medium group-hover:inline">AI assistant</span>
      </button>

      {open && (
        <div
          id="assistant-panel"
          role="dialog"
          aria-label="AI assistant"
          className="fixed bottom-20 right-5 z-40 flex h-[min(34rem,calc(100vh-7rem))] w-[min(26rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Team assistant</p>
              <p className="text-xs text-slate-500">{status.data?.enabled ? `Answers from submitted reports · ${status.data.model}` : 'Ask about team activity'}</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setError(null); }}>Clear</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Close assistant">&times;</Button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {status.isLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : status.data && !status.data.enabled ? (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">The assistant is not configured.</p>
                <p className="mt-1 text-xs">Set <code>ANTHROPIC_API_KEY</code> in the API&apos;s <code>.env</code> and restart it to enable conversational questions and AI team summaries.</p>
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Ask anything about your team&apos;s weekly reports. Try:</p>
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => send(s)} className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((message, i) => (
                  <div key={i} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm', message.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800')}>
                      {message.role === 'assistant' ? <SimpleMarkdown text={message.content} /> : message.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-500"><Spinner size="sm" /> Looking at the reports...</div>
                )}
                {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
              </>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-slate-100 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading || !status.data?.enabled}
              aria-label="Message"
            />
            <Button type="submit" size="sm" disabled={!input.trim() || loading || !status.data?.enabled}>Send</Button>
          </form>
        </div>
      )}
    </>
  );
}
