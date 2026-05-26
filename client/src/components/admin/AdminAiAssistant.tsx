import { useState, useRef, useEffect } from 'react';
import { useAdminAiAssistant } from '@/hooks/use-admin-ai-assistant';
import { FileExplorer } from '@/components/admin/FileExplorer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  AlertCircle,
  Bot,
  ChevronRight,
  Code,
  Copy,
  DollarSign,
  FolderTree,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  Square,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import type { TokenUsage } from '@/hooks/use-admin-ai-assistant';

const QUICK_PROMPTS = [
  "Explain how the authentication system works end-to-end",
  "Review the security configuration and suggest improvements",
  "How does the Stripe payment flow work?",
  "Explain the WebSocket real-time notification system",
  "What admin API endpoints are available and what do they do?",
  "Review the proximity/nearby users feature implementation",
];

function formatTokenCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function SpendingCounter({ usage }: { usage: TokenUsage }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col gap-1 cursor-default select-none">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[10px] font-semibold text-foreground">
                ${usage.estimatedCostUsd < 0.001 && usage.estimatedCostUsd > 0
                  ? '<$0.001'
                  : `$${usage.estimatedCostUsd.toFixed(4)}`}
              </span>
              <span className="text-[10px] text-muted-foreground">est. cost</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Zap className="h-2.5 w-2.5" />
                {formatTokenCount(usage.inputTokens)} in
              </span>
              <span>·</span>
              <span>{formatTokenCount(usage.outputTokens)} out</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          <p className="font-medium mb-1">Token Usage (All Sessions)</p>
          <p>Input: {usage.inputTokens.toLocaleString()} tokens</p>
          <p>Output: {usage.outputTokens.toLocaleString()} tokens</p>
          <p className="mt-1 text-muted-foreground">claude-sonnet-4-6: $3/1M in · $15/1M out</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const copy = () => {
    navigator.clipboard.writeText(children).then(() =>
      toast({ title: "Copied", description: "Code copied to clipboard", duration: 1500 })
    );
  };
  return (
    <div className="relative group my-2 rounded-md overflow-hidden border border-border text-left">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{language || 'code'}</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={copy}>
          <Copy className="h-3 w-3 mr-1" />Copy
        </Button>
      </div>
      <SyntaxHighlighter
        style={oneLight}
        language={language || 'text'}
        PreTag="div"
        showLineNumbers
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.78rem', maxHeight: '400px', overflowY: 'auto' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function MessageBubble({ role, content }: { role: 'user' | 'agent'; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-2.5 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium mt-0.5 ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
      }`}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-[10px] font-medium text-muted-foreground px-1">
          {isUser ? 'You' : 'Agent'}
        </span>
        <div className={`rounded-2xl overflow-hidden ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted border border-border/60 rounded-tl-sm'
        }`}>
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3">
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
            ) : (
              <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-1 prose-ul:my-1 prose-li:my-0.5">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeStr = String(children).replace(/\n$/, '');
                      if (match) return <CodeBlock language={match[1]}>{codeStr}</CodeBlock>;
                      return <code className="bg-background px-1 py-0.5 rounded text-xs font-mono border border-border/50" {...props}>{children}</code>;
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  totalUsage,
}: {
  sessions: any[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  totalUsage: TokenUsage;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chats</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNew} data-testid="button-new-session" title="New chat">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-4 text-center">No chats yet.<br/>Start a new chat above.</p>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/40 hover:bg-accent transition-colors ${activeSessionId === s.id ? 'bg-accent' : ''}`}
            data-testid={`button-session-${s.id}`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs truncate flex-1 text-foreground">{s.title || 'Chat'}</span>
            <Button
              variant="ghost" size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={e => { e.stopPropagation(); onDelete(s.id); }}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </ScrollArea>
      <div className="p-3 border-t border-border shrink-0 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Bot className="h-3 w-3 text-white" />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">claude-sonnet-4-6</span>
        </div>
        <SpendingCounter usage={totalUsage} />
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
          <ShieldAlert className="h-2.5 w-2.5" />Admin Only
        </Badge>
      </div>
    </div>
  );
}

export function AdminAiAssistant() {
  const {
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
  } = useAdminAiAssistant();

  const [activeTab, setActiveTab] = useState('chat');
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, streamingText]);

  useEffect(() => {
    if (activeTab === 'chat') textareaRef.current?.focus();
  }, [activeTab]);

  const handleSend = async () => {
    const msg = currentMessage.trim();
    if (isStreaming) return;

    if (activeTab === 'code' && codeSnippet.trim()) {
      const prompt = msg || 'Please analyze this code and suggest improvements.';
      await sendMessage(`${prompt}\n\n\`\`\`\n${codeSnippet}\n\`\`\``);
      setCodeSnippet('');
    } else if (activeTab === 'files' && selectedFile) {
      const prompt = msg || `Please analyze this file and explain what it does.`;
      const ext = selectedFile.path.split('.').pop() || 'text';
      await sendMessage(`${prompt}\n\nFile: \`${selectedFile.path}\`\n\n\`\`\`${ext}\n${selectedFile.content.slice(0, 8000)}\n\`\`\``, selectedFile.path);
      setSelectedFile(null);
    } else if (msg) {
      await sendMessage(msg);
    }
    setCurrentMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const loadFileContent = async (path: string) => {
    setFileError(null);
    setFileLoading(true);
    try {
      const res = await fetch(`/api/admin/files/content?path=${encodeURIComponent(path)}`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to load file' }));
        throw new Error(err.message);
      }
      const content = await res.text();
      setSelectedFile({ path, content });
      setActiveTab('files');
    } catch (err: any) {
      setFileError(err.message || 'Failed to load file');
    } finally {
      setFileLoading(false);
    }
  };

  const messages = activeSession?.messages || [];
  const hasMessages = messages.length > 0 || isStreaming;
  const canSend = !isStreaming && (
    (activeTab === 'chat' && currentMessage.trim().length > 0) ||
    (activeTab === 'code' && codeSnippet.trim().length > 0) ||
    (activeTab === 'files' && selectedFile !== null)
  );

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>You need admin privileges to access the AI Agent.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] sm:h-[calc(100vh-180px)] overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      {/* Mobile top bar */}
      <div className="flex sm:hidden items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 shrink-0">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <History className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Chat History</SheetTitle>
            </SheetHeader>
            <SessionList
              sessions={sessions}
              activeSessionId={activeSession?.id || null}
              onSelect={(id) => { selectSession(id); setSidebarOpen(false); }}
              onNew={() => { newSession(); setSidebarOpen(false); }}
              onDelete={deleteSession}
              totalUsage={totalUsage}
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Bot className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-medium truncate">{activeSession?.title || 'AI Agent'}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={newSession}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Main layout — sidebar + content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden sm:flex flex-col w-52 shrink-0 border-r border-border bg-muted/20">
          <SessionList
            sessions={sessions}
            activeSessionId={activeSession?.id || null}
            onSelect={selectSession}
            onNew={newSession}
            onDelete={deleteSession}
            totalUsage={totalUsage}
          />
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Tab bar */}
          <div className="px-3 sm:px-4 pt-2.5 pb-0 border-b border-border bg-background/80 backdrop-blur-sm shrink-0 flex items-center gap-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList className="h-8 bg-muted/60">
                <TabsTrigger value="chat" className="h-7 text-xs gap-1.5" data-testid="tab-chat">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Chat</span>
                </TabsTrigger>
                <TabsTrigger value="code" className="h-7 text-xs gap-1.5" data-testid="tab-code">
                  <Code className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Code</span>
                </TabsTrigger>
                <TabsTrigger value="files" className="h-7 text-xs gap-1.5" data-testid="tab-files">
                  <FolderTree className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Files</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {/* Inline spending counter (desktop, visible at top) */}
            {(totalUsage.inputTokens > 0 || totalUsage.outputTokens > 0) && (
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0 pb-1">
                <DollarSign className="h-3 w-3 text-primary" />
                <span className="font-semibold text-foreground">
                  {totalUsage.estimatedCostUsd < 0.001 && totalUsage.estimatedCostUsd > 0
                    ? '<$0.001'
                    : `$${totalUsage.estimatedCostUsd.toFixed(4)}`}
                </span>
                <span>·</span>
                <span>{formatTokenCount(totalUsage.inputTokens + totalUsage.outputTokens)} tokens</span>
              </div>
            )}
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1 px-3 sm:px-5 py-4">
            {!hasMessages && (
              <div className="flex flex-col items-center justify-center py-8 sm:py-14 text-center px-4">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
                  <Bot className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold mb-1.5">AI Code Agent</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-5 sm:mb-7 max-w-xs leading-relaxed">
                  Ask about the codebase, analyze files, or get code reviews.
                  The agent reads project files on demand.
                </p>
                <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                  {QUICK_PROMPTS.slice(0, 4).map((p, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="justify-start text-left h-auto py-2 px-3 text-xs hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      onClick={() => { setCurrentMessage(p); setActiveTab('chat'); textareaRef.current?.focus(); }}
                      data-testid={`button-quick-prompt-${i}`}
                    >
                      <ChevronRight className="h-3 w-3 mr-2 shrink-0 text-primary" />
                      <span className="truncate">{p}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}

            {isStreaming && streamingText && (
              <MessageBubble role="agent" content={streamingText} />
            )}

            {isStreaming && !streamingText && (
              <div className="flex gap-2.5 mb-4">
                <div className="shrink-0 h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground px-1">Agent</span>
                  <div className="bg-muted border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Agent is thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Input area */}
          <div className="border-t border-border bg-background/95 backdrop-blur-sm px-3 sm:px-4 py-2.5 sm:py-3 shrink-0">
            {/* Code tab */}
            {activeTab === 'code' && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Code to analyze</span>
                  {codeSnippet && (
                    <Button variant="ghost" size="sm" className="h-5 text-xs px-2" onClick={() => setCodeSnippet('')}>
                      <X className="h-3 w-3 mr-1" />Clear
                    </Button>
                  )}
                </div>
                <Textarea
                  value={codeSnippet}
                  onChange={e => setCodeSnippet(e.target.value)}
                  placeholder="Paste your code here..."
                  className="font-mono text-xs min-h-[60px] max-h-[120px] bg-muted border-border"
                  data-testid="textarea-code-snippet"
                />
              </div>
            )}

            {/* Files tab */}
            {activeTab === 'files' && (
              <div className="mb-2">
                {fileError && (
                  <Alert variant="destructive" className="mb-2 py-2">
                    <AlertDescription className="text-xs">{fileError}</AlertDescription>
                  </Alert>
                )}
                {selectedFile ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border border-border">
                    <Code className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs font-mono truncate flex-1">{selectedFile.path}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{(selectedFile.content.length / 1024).toFixed(1)}KB</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => setSelectedFile(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="border border-dashed border-border rounded-md bg-muted/30">
                    <ScrollArea className="h-36 sm:h-44">
                      <div className="p-2">
                        {fileLoading ? (
                          <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading file...
                          </div>
                        ) : (
                          <FileExplorer onSelectFile={loadFileContent} />
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {/* Message input */}
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={currentMessage}
                onChange={e => setCurrentMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  activeTab === 'code' ? "Ask about the code above... (optional)" :
                  activeTab === 'files' && selectedFile ? `Ask about ${selectedFile.path.split('/').pop()}...` :
                  activeTab === 'files' ? "Select a file, then ask..." :
                  "Ask the agent anything about the codebase..."
                }
                className="flex-1 min-h-[60px] sm:min-h-[72px] max-h-[120px] text-sm resize-none bg-muted/40 border-border/60 focus:border-primary/40"
                disabled={isStreaming}
                data-testid="textarea-message"
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                {isStreaming ? (
                  <Button variant="outline" size="icon" className="h-9 w-9 border-destructive/40 hover:bg-destructive/10" onClick={stopStreaming} data-testid="button-stop" title="Stop">
                    <Square className="h-4 w-4 text-destructive" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-9 w-9 bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 border-0"
                    onClick={handleSend}
                    disabled={!canSend}
                    data-testid="button-send"
                    title="Send (Ctrl+Enter)"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 hidden sm:block">
              Ctrl+Enter to send · Agent reads any project file automatically
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
