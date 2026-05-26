import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Gavel,
  UserPlus,
  Trash2,
  Search,
  Loader2,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Info,
} from "lucide-react";
import { getSportConfig } from "@/lib/competitionSports";

interface Judge {
  id: number;
  eventId: number;
  categoryId: number;
  userId: number;
  judgeNumber: number;
  isActive: boolean;
  assignedAt: string;
  user: {
    id: number;
    username: string;
    profileImage: string | null;
    displayName: string | null;
  };
}

interface UserSearchResult {
  id: number;
  username: string;
  profileImage: string | null;
  displayName: string | null;
}

interface Category {
  id: number;
  name: string;
  judgeCount?: number;
  useJudgeVoting?: boolean;
  competitionSport?: string | null;
}

interface JudgeManagementProps {
  eventId: number;
  categoryId: number;
  category?: Category;
  canManage?: boolean;
}

export function JudgeManagement({ eventId, categoryId, category, canManage = false }: JudgeManagementProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<number | null>(null);

  // Determine sport type
  const sportConfig = getSportConfig(category?.competitionSport);
  const isTT = sportConfig.judgePanel === 'table_tennis';
  const roleLabel = isTT ? "Umpire" : "Judge";
  const roleLabelPlural = isTT ? "Umpires" : "Judges";
  const maxAllowed = isTT ? 1 : (category?.judgeCount || 3);

  const [judgeSettings, setJudgeSettings] = useState({
    judgeCount: isTT ? 1 : (category?.judgeCount || 3),
    useJudgeVoting: category?.useJudgeVoting || false
  });

  useEffect(() => {
    if (category) {
      setJudgeSettings({
        judgeCount: isTT ? 1 : (category.judgeCount || 3),
        useJudgeVoting: category.useJudgeVoting || false
      });
    }
  }, [category?.judgeCount, category?.useJudgeVoting, isTT]);

  const { data: judges = [], isLoading: judgesLoading } = useQuery<Judge[]>({
    queryKey: [`/api/events/${eventId}/categories/${categoryId}/judges`],
    enabled: !!categoryId
  });

  const { data: searchResults = [], isLoading: searchLoading } = useQuery<UserSearchResult[]>({
    queryKey: [`/api/events/${eventId}/judge-search?q=${encodeURIComponent(searchQuery)}`],
    enabled: searchQuery.length >= 2
  });

  const assignJudgeMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest(
        `/api/events/${eventId}/categories/${categoryId}/judges`,
        'POST',
        { targetUserId: userId }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/judges`] });
      toast({ title: `${roleLabel} assigned successfully` });
      setShowAddDialog(false);
      setSearchQuery("");
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ 
        title: `Failed to assign ${roleLabel.toLowerCase()}`, 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const removeJudgeMutation = useMutation({
    mutationFn: async (judgeId: number) => {
      return await apiRequest(
        `/api/events/${eventId}/categories/${categoryId}/judges/${judgeId}`,
        'DELETE'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/judges`] });
      toast({ title: `${roleLabel} removed successfully` });
      setShowRemoveConfirm(null);
    },
    onError: (error: any) => {
      toast({ 
        title: `Failed to remove ${roleLabel.toLowerCase()}`, 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { judgeCount?: number; useJudgeVoting?: boolean }) => {
      return await apiRequest(
        `/api/events/${eventId}/categories/${categoryId}/judge-settings`,
        'PATCH',
        settings
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}`] });
      toast({ title: "Settings updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update settings", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const startAllTablesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        `/api/events/${eventId}/categories/${categoryId}/start-round-tables`,
        'POST'
      );
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/live-state`] });
      toast({ title: `Round started — ${data?.tables ?? ''} tables now active` });
    },
    onError: (error: any) => {
      toast({
        title: "Could not start round",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSettingsChange = (key: string, value: any) => {
    const newSettings = { ...judgeSettings, [key]: value };
    setJudgeSettings(newSettings);
    updateSettingsMutation.mutate({ [key]: value });
  };

  const existingJudgeIds = judges.map(j => j.userId);
  const filteredSearchResults = searchResults.filter(u => !existingJudgeIds.includes(u.id));
  const isFull = judges.length >= maxAllowed;

  if (judgesLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isTT ? "border-green-500/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            {isTT ? <Shield className="h-5 w-5 text-green-500 shrink-0" /> : <Gavel className="h-5 w-5 shrink-0" />}
            <div>
              <CardTitle className="text-base sm:text-lg">{roleLabelPlural}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {judges.length} / {maxAllowed} {roleLabelPlural.toLowerCase()} assigned
                {isTT && (
                  <span className="ml-1 text-green-600 dark:text-green-400 font-medium">· Table Tennis</span>
                )}
              </CardDescription>
            </div>
          </div>
          {canManage && (
            <Button 
              size="sm" 
              onClick={() => setShowAddDialog(true)}
              disabled={isFull}
              data-testid="button-add-judge"
              className={`text-xs sm:text-sm w-full sm:w-auto ${isTT ? "bg-green-600 hover:bg-green-700" : ""}`}
            >
              <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
              Add {roleLabel}
              {isFull && <span className="ml-1 opacity-60">(Full)</span>}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* TT info box */}
        {isTT && (
          <div className="space-y-2">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-700 dark:text-green-300">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-semibold">Table Tennis — 1 Umpire</p>
                <p className="text-xs opacity-80">
                  The umpire scores points in real-time using the Judge Panel. Spectators see live scores via the Live Results view. First to 11 pts/game, must win by 2.
                </p>
              </div>
            </div>
            {canManage && (
              <Button
                size="sm"
                className="w-full bg-green-600 hover:bg-green-700 gap-2"
                onClick={() => startAllTablesMutation.mutate()}
                disabled={startAllTablesMutation.isPending}
                data-testid="button-start-all-tables"
              >
                {startAllTablesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                Start Round — All Tables Simultaneously
              </Button>
            )}
          </div>
        )}

        {/* Settings panel — hide judgeCount selector for TT (fixed at 1) */}
        {canManage && (
          <div className="flex flex-col gap-3 p-3 bg-muted/50 rounded-md">
            {!isTT && (
              <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2">
                <Label htmlFor="judgeCount" className="whitespace-nowrap text-sm">Judge count:</Label>
                <Select 
                  value={String(judgeSettings.judgeCount)} 
                  onValueChange={(v) => handleSettingsChange('judgeCount', parseInt(v))}
                >
                  <SelectTrigger className="w-full xs:w-[80px]" data-testid="select-judge-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="7">7</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch 
                id="useJudgeVoting" 
                checked={judgeSettings.useJudgeVoting}
                onCheckedChange={(v) => handleSettingsChange('useJudgeVoting', v)}
                data-testid="switch-use-judge-voting"
              />
              <Label htmlFor="useJudgeVoting" className="cursor-pointer text-sm">
                {isTT ? "Enable umpire live scoring" : "Enable live judge voting"}
              </Label>
            </div>
          </div>
        )}

        {judges.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            {isTT ? (
              <Shield className="h-10 w-10 mx-auto mb-2 opacity-40 text-green-500" />
            ) : (
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            )}
            <p>No {roleLabelPlural.toLowerCase()} assigned yet</p>
            {canManage && (
              <p className="text-sm mt-1">Click "Add {roleLabel}" to assign one</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {judges.map((judge) => (
              <div 
                key={judge.id} 
                className={`flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 xs:gap-3 p-3 rounded-md border ${
                  isTT ? "bg-green-500/5 border-green-500/20" : "bg-card border"
                }`}
                data-testid={`judge-item-${judge.id}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge variant={isTT ? "default" : "outline"} className={`shrink-0 text-xs ${isTT ? "bg-green-600" : ""}`}>
                    {isTT ? "🏓 Umpire" : `#${judge.judgeNumber}`}
                  </Badge>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={judge.user?.profileImage || undefined} />
                    <AvatarFallback className="text-xs">
                      {judge.user?.displayName?.[0] || judge.user?.username?.[0] || 'J'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-sm">
                      {judge.user?.displayName || judge.user?.username || 'Unknown'}
                    </p>
                    {judge.user?.displayName && (
                      <p className="text-xs text-muted-foreground truncate">@{judge.user?.username}</p>
                    )}
                  </div>
                </div>
                {canManage && (
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => setShowRemoveConfirm(judge.id)}
                    data-testid={`button-remove-judge-${judge.id}`}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Judge/Umpire Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-add-judge">
              {isTT ? "🏓 Assign Umpire" : "Add Judge"}
            </DialogTitle>
            <DialogDescription>
              {isTT
                ? "The umpire will score points in real-time using the Judge Panel during the match."
                : "Search for a platform user to assign as a judge for this category."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-judge"
              />
            </div>
            
            {searchQuery.length >= 2 && (
              <div className="max-h-[200px] overflow-y-auto border rounded-md">
                {searchLoading ? (
                  <div className="p-4 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </div>
                ) : filteredSearchResults.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No users found
                  </div>
                ) : (
                  filteredSearchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-muted/60 transition-colors text-left ${
                        selectedUser?.id === user.id ? 'bg-primary/10' : ''
                      }`}
                      data-testid={`user-search-result-${user.id}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.profileImage || undefined} />
                        <AvatarFallback>
                          {user.displayName?.[0] || user.username?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {user.displayName || user.username}
                        </p>
                        {user.displayName && (
                          <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                        )}
                      </div>
                      {selectedUser?.id === user.id && (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {selectedUser && (
              <div className="p-3 bg-muted rounded-md flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.profileImage || undefined} />
                  <AvatarFallback>
                    {selectedUser.displayName?.[0] || selectedUser.username?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {selectedUser.displayName || selectedUser.username}
                  </p>
                  <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                </div>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => setSelectedUser(null)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddDialog(false);
                setSearchQuery("");
                setSelectedUser(null);
              }}
              data-testid="button-cancel-add-judge"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => selectedUser && assignJudgeMutation.mutate(selectedUser.id)}
              disabled={!selectedUser || assignJudgeMutation.isPending}
              data-testid="button-confirm-add-judge"
              className={isTT ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {assignJudgeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isTT ? "Assign as Umpire" : "Add Judge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm Dialog */}
      <Dialog open={showRemoveConfirm !== null} onOpenChange={() => setShowRemoveConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="dialog-title-remove-judge">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remove {roleLabel}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this {roleLabel.toLowerCase()}? 
              {isTT
                ? " They will no longer be able to score points for this match."
                : " Their votes will remain recorded but they will no longer be able to vote on new matchups."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRemoveConfirm(null)}
              data-testid="button-cancel-remove-judge"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => showRemoveConfirm && removeJudgeMutation.mutate(showRemoveConfirm)}
              disabled={removeJudgeMutation.isPending}
              data-testid="button-confirm-remove-judge"
            >
              {removeJudgeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove {roleLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
