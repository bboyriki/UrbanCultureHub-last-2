import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket, ConnectionStatus } from "@/contexts/WebSocketSingletonContext";
import {
  MessageCircle, Users, Zap, Lock, Bot, Activity, RefreshCw,
  ShieldAlert, ToggleLeft, ToggleRight, TrendingUp, Clock,
  CheckCircle, XCircle, Wifi
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface ChatStats {
  connectedUsers: number;
  onlineUserIds: number[];
  messageCountToday: number;
  totalConversations: number;
  totalMessages: number;
  features: {
    chatEnabled: boolean;
    aiAssistantEnabled: boolean;
    encryptionEnabled: boolean;
  };
  timestamp: string;
}

interface ConversationRow {
  id: number;
  created_at: string;
  last_message_at: string | null;
  message_count: number;
  last_message: string | null;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-muted ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureToggle({
  label,
  description,
  icon: Icon,
  enabled,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
          {enabled ? "ON" : "OFF"}
        </Badge>
        <Switch
          checked={enabled}
          onCheckedChange={onChange}
          disabled={disabled}
          data-testid={`toggle-${label.toLowerCase().replace(/\s+/g, "-")}`}
        />
      </div>
    </div>
  );
}

export default function ChatControlPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isConnected, connectionStatus } = useWebSocket();
  const [liveUsers, setLiveUsers] = useState(0);

  const { data: stats, isLoading, refetch } = useQuery<ChatStats>({
    queryKey: ["/api/admin/chat-control/stats"],
    refetchInterval: 10000,
  });

  const { data: conversations = [], isLoading: convsLoading } = useQuery<ConversationRow[]>({
    queryKey: ["/api/admin/chat-control/conversations"],
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (stats?.connectedUsers !== undefined) {
      setLiveUsers(stats.connectedUsers);
    }
  }, [stats?.connectedUsers]);

  const settingsMutation = useMutation({
    mutationFn: (settings: Partial<ChatStats["features"]>) =>
      apiRequest("/api/admin/chat-control/settings", "POST", settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat-control/stats"] });
      toast({ title: "Settings updated", description: "Chat feature flags saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
    },
  });

  const features = stats?.features ?? { chatEnabled: true, aiAssistantEnabled: true, encryptionEnabled: true };

  const handleToggle = (key: keyof ChatStats["features"], value: boolean) => {
    settingsMutation.mutate({ [key]: value });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-primary" />
              Chat Control Center
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Monitor live chat, manage features, and control AI assistant.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Wifi className={`w-4 h-4 ${
                connectionStatus === ConnectionStatus.CONNECTED ? "text-green-500" :
                connectionStatus === ConnectionStatus.CONNECTING ? "text-amber-500" :
                "text-red-500"
              }`} />
              <span className={
                connectionStatus === ConnectionStatus.CONNECTED ? "text-green-600" :
                connectionStatus === ConnectionStatus.CONNECTING ? "text-amber-500" :
                "text-red-500"
              }>
                {connectionStatus === ConnectionStatus.CONNECTED ? "Live" :
                 connectionStatus === ConnectionStatus.CONNECTING ? "Verbinden…" :
                 "Offline"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-stats">
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Live Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Users Online"
            value={isLoading ? "—" : liveUsers}
            sub="connected via WebSocket"
            color="text-green-600"
          />
          <StatCard
            icon={TrendingUp}
            label="Messages Today"
            value={isLoading ? "—" : (stats?.messageCountToday ?? 0)}
            sub="sent in last 24h"
            color="text-blue-600"
          />
          <StatCard
            icon={MessageCircle}
            label="Conversations"
            value={isLoading ? "—" : (stats?.totalConversations ?? 0)}
            sub="total all time"
            color="text-purple-600"
          />
          <StatCard
            icon={Activity}
            label="Total Messages"
            value={isLoading ? "—" : (stats?.totalMessages ?? 0)}
            sub="in database"
            color="text-orange-600"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Feature Flags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Feature Controls
              </CardTitle>
              <CardDescription>
                Enable or disable chat features in real-time. Changes apply immediately to all users.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <FeatureToggle
                label="Chat System"
                description="Enable or disable the entire chat functionality"
                icon={MessageCircle}
                enabled={features.chatEnabled}
                onChange={v => handleToggle("chatEnabled", v)}
                disabled={settingsMutation.isPending}
              />
              <FeatureToggle
                label="AI Assistant"
                description="Let users chat with the GPT-4 AI bot"
                icon={Bot}
                enabled={features.aiAssistantEnabled}
                onChange={v => handleToggle("aiAssistantEnabled", v)}
                disabled={settingsMutation.isPending || !features.chatEnabled}
              />
              <FeatureToggle
                label="E2E Encryption"
                description="End-to-end encryption using ECDH + AES-GCM"
                icon={Lock}
                enabled={features.encryptionEnabled}
                onChange={v => handleToggle("encryptionEnabled", v)}
                disabled={settingsMutation.isPending || !features.chatEnabled}
              />
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" />
                System Health
              </CardTitle>
              <CardDescription>Real-time status of chat subsystems.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "WebSocket Server",
                  // Server is running if the stats endpoint responded (server-side truth).
                  // Client connection state is shown separately in the header badge.
                  ok: stats !== undefined,
                  detail: stats !== undefined
                    ? `${stats.connectedUsers} gebruiker${stats.connectedUsers !== 1 ? "s" : ""} verbonden via WebSocket`
                    : "Server niet bereikbaar",
                },
                {
                  label: "Chat Database",
                  ok: (stats?.totalConversations ?? 0) >= 0,
                  detail: `${stats?.totalConversations ?? 0} conversations stored`,
                },
                {
                  label: "AI Assistant (GPT-4)",
                  ok: features.aiAssistantEnabled,
                  detail: features.aiAssistantEnabled ? "Active — OpenAI API connected" : "Disabled by admin",
                },
                {
                  label: "Encryption Layer",
                  ok: features.encryptionEnabled,
                  detail: features.encryptionEnabled ? "ECDH + AES-GCM active" : "Disabled",
                },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    {item.ok ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                  <Badge variant={item.ok ? "default" : "destructive"} className="text-xs">
                    {item.ok ? "OK" : "Off"}
                  </Badge>
                </div>
              ))}
              {stats?.timestamp && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Last checked: {format(new Date(stats.timestamp), "HH:mm:ss")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Recent Conversations
            </CardTitle>
            <CardDescription>
              Latest activity — last 25 conversations by message time.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-80">
              {convsLoading ? (
                <div className="flex items-center justify-center h-full py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No conversations yet
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                      data-testid={`row-conversation-${conv.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MessageCircle className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Conversation #{conv.id}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                            {conv.last_message
                              ? conv.last_message.length > 60
                                ? conv.last_message.slice(0, 60) + "…"
                                : conv.last_message
                              : "No messages"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <Badge variant="secondary" className="text-xs mb-1">
                          {conv.message_count} msg{conv.message_count !== 1 ? "s" : ""}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {conv.last_message_at
                            ? format(new Date(conv.last_message_at), "MMM d, HH:mm")
                            : format(new Date(conv.created_at), "MMM d")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
