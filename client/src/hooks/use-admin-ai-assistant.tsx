import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AdminAiMessage {
  role: 'user' | 'agent';
  content: string;
  filePath?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AdminAiSession {
  id: string;
  messages: AdminAiMessage[];
  lastUpdated: Date;
  title: string;
  tokenUsage: TokenUsage;
}

const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

function calcCost(input: number, output: number) {
  return (input / 1_000_000) * INPUT_COST_PER_M + (output / 1_000_000) * OUTPUT_COST_PER_M;
}

export function useAdminAiAssistant() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [sessions, setSessions] = useState<AdminAiSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  const totalUsage: TokenUsage = sessions.reduce(
    (acc, s) => ({
      inputTokens: acc.inputTokens + s.tokenUsage.inputTokens,
      outputTokens: acc.outputTokens + s.tokenUsage.outputTokens,
      estimatedCostUsd: acc.estimatedCostUsd + s.tokenUsage.estimatedCostUsd,
    }),
    { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
  );

  const newSession = useCallback(() => {
    const id = `session-${Date.now()}`;
    const session: AdminAiSession = {
      id,
      messages: [],
      lastUpdated: new Date(),
      title: 'New Chat',
      tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    };
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(id);
    setStreamingText('');
    setCurrentMessage('');
    setCodeSnippet('');
    return session;
  }, []);

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setStreamingText('');
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    setActiveSessionId(prev => prev === id ? null : prev);
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingText('');
  }, []);

  const sendMessage = useCallback(async (content: string, filePath?: string) => {
    if (!isAdmin || !content.trim()) return;

    let session = activeSession;
    if (!session) {
      const id = `session-${Date.now()}`;
      session = {
        id,
        messages: [],
        lastUpdated: new Date(),
        title: content.slice(0, 40),
        tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      };
      setSessions(prev => [session!, ...prev]);
      setActiveSessionId(id);
    }

    const userMsg: AdminAiMessage = { role: 'user', content, filePath };
    const updatedMsgs = [...session.messages, userMsg];

    setSessions(prev => prev.map(s =>
      s.id === session!.id
        ? { ...s, messages: updatedMsgs, lastUpdated: new Date(), title: s.messages.length === 0 ? content.slice(0, 40) : s.title }
        : s
    ));
    setCurrentMessage('');
    setStreamingText('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let sseError: string | null = null;
    let lastUsage: { inputTokens: number; outputTokens: number } | null = null;

    try {
      const apiMessages = updatedMsgs.map(m => ({ role: m.role === 'agent' ? 'assistant' : m.role, content: m.content }));

      const response = await fetch('/api/admin/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, sessionId: session.id }),
        signal: controller.signal,
        credentials: 'include',
      });

      if (!response.ok) {
        let msg = `Request failed (${response.status})`;
        try {
          const errBody = await response.json();
          msg = errBody.message || msg;
        } catch {}
        throw new Error(msg);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
            if (event.type === 'text') {
              fullText += event.text;
              setStreamingText(fullText);
            } else if (event.type === 'usage') {
              lastUsage = { inputTokens: event.inputTokens ?? 0, outputTokens: event.outputTokens ?? 0 };
            } else if (event.type === 'error') {
              sseError = event.text || 'AI returned an error';
            } else if (event.type === 'done') {
              break;
            }
          } catch {
            // skip malformed SSE line
          }
        }

        if (sseError) break;
      }

      if (sseError) throw new Error(sseError);

      const agentMsg: AdminAiMessage = {
        role: 'agent',
        content: fullText,
        inputTokens: lastUsage?.inputTokens,
        outputTokens: lastUsage?.outputTokens,
      };

      setSessions(prev => prev.map(s => {
        if (s.id !== session!.id) return s;
        const newInput = (s.tokenUsage.inputTokens) + (lastUsage?.inputTokens ?? 0);
        const newOutput = (s.tokenUsage.outputTokens) + (lastUsage?.outputTokens ?? 0);
        return {
          ...s,
          messages: [...updatedMsgs, agentMsg],
          lastUpdated: new Date(),
          tokenUsage: {
            inputTokens: newInput,
            outputTokens: newOutput,
            estimatedCostUsd: calcCost(newInput, newOutput),
          },
        };
      }));
      setStreamingText('');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStreamingText('');
        return;
      }
      const msg = err?.message || 'Failed to get a response from Claude. Please try again.';
      console.error('Admin AI error:', msg, err);
      toast({ variant: 'destructive', title: 'AI Error', description: msg });
      setSessions(prev => prev.map(s =>
        s.id === session!.id
          ? { ...s, messages: [...updatedMsgs, { role: 'agent', content: `Error: ${msg}` }] }
          : s
      ));
      setStreamingText('');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isAdmin, activeSession, toast]);

  return {
    isAdmin,
    sessions,
    activeSession,
    streamingText,
    isStreaming,
    currentMessage,
    setCurrentMessage,
    codeSnippet,
    setCodeSnippet,
    sendMessage,
    newSession,
    selectSession,
    deleteSession,
    stopStreaming,
    totalUsage,
  };
}
