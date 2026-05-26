import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  UserPlus, 
  Settings, 
  Trash2, 
  Users, 
  Loader2,
  AlertTriangle,
  Search,
  User,
  UserCircle,
  Gavel
} from "lucide-react";
import { JudgeManagement } from "./JudgeManagement";
import { getSportConfig } from "@/lib/competitionSports";

interface Registration {
  id: number;
  categoryId: number;
  userId: number | null;
  status: string;
  paymentStatus: string;
  source: string;
  displayName: string | null;
  contactEmail: string | null;
  notes: string | null;
  user?: {
    id: number;
    username: string;
    displayName: string | null;
    profilePicture: string | null;
  } | null;
}

interface Category {
  id: number;
  name: string;
  competitionSport?: string | null;
  battleFormat?: string;
  roundsToWin?: number;
  judgingMethod?: string;
  battleRules?: string;
  allowSelfRegistration?: boolean;
  judgeCount?: number;
  useJudgeVoting?: boolean;
}

interface User {
  id: number;
  username: string;
  displayName: string | null;
  email: string;
  profilePicture: string | null;
}

interface BattleAdminPanelProps {
  eventId: number;
  categoryId: number;
  category?: Category;
}

const addExternalDancerFormSchema = z.object({
  displayName: z.string().min(1, "Dancer name is required").max(100),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

const battleRulesFormSchema = z.object({
  battleFormat: z.enum(["1v1", "2v2", "3v3", "7togo"]),
  roundsToWin: z.string(),
  judgingMethod: z.enum(["points", "vote", "knockout"]),
  battleRules: z.string().max(2000).optional(),
});

type AddExternalDancerForm = z.infer<typeof addExternalDancerFormSchema>;
type BattleRulesForm = z.infer<typeof battleRulesFormSchema>;

export function BattleAdminPanel({ eventId, categoryId, category }: BattleAdminPanelProps) {
  const { toast } = useToast();
  const [showAddDancerDialog, setShowAddDancerDialog] = useState(false);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [addMode, setAddMode] = useState<"external" | "platform">("external");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const addExternalDancerForm = useForm<AddExternalDancerForm>({
    resolver: zodResolver(addExternalDancerFormSchema),
    defaultValues: {
      displayName: "",
      contactEmail: "",
      notes: "",
    },
  });

  const rulesForm = useForm<BattleRulesForm>({
    resolver: zodResolver(battleRulesFormSchema),
    defaultValues: {
      battleFormat: "1v1",
      roundsToWin: "2", // Default to Best of 3 (roundsToWin=2)
      judgingMethod: "vote",
      battleRules: "",
    },
  });

  const { data: categoryData } = useQuery<Category>({
    queryKey: [`/api/events/${eventId}/categories/${categoryId}`],
    enabled: !!categoryId,
  });

  const sportConfig = getSportConfig(categoryData?.competitionSport);
  const participantLabel = sportConfig.participantLabel;
  const ParticipantLabel = participantLabel.charAt(0).toUpperCase() + participantLabel.slice(1);
  const participantLabelPlural = sportConfig.participantLabelPlural;
  const ParticipantLabelPlural = participantLabelPlural.charAt(0).toUpperCase() + participantLabelPlural.slice(1);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: addMode === "platform" && showAddDancerDialog,
  });

  useEffect(() => {
    if (categoryData) {
      rulesForm.reset({
        battleFormat: (categoryData.battleFormat as "1v1" | "2v2" | "3v3" | "7togo") || "1v1",
        roundsToWin: String(categoryData.roundsToWin || 2), // Default Best of 3 (roundsToWin=2)
        judgingMethod: (categoryData.judgingMethod as "points" | "vote" | "knockout") || "vote",
        battleRules: categoryData.battleRules || "",
      });
    }
  }, [categoryData, rulesForm]);

  const { data: registrations = [], isLoading } = useQuery<Registration[]>({
    queryKey: [`/api/events/${eventId}/categories/${categoryId}/registrations`],
  });

  const filteredUsers = allUsers.filter(user => {
    if (!userSearchQuery) return true;
    const searchLower = userSearchQuery.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchLower) ||
      (user.displayName?.toLowerCase().includes(searchLower)) ||
      user.email.toLowerCase().includes(searchLower)
    );
  }).filter(user => {
    return !registrations.some(reg => reg.userId === user.id);
  });

  const addExternalDancerMutation = useMutation({
    mutationFn: async (data: AddExternalDancerForm) => {
      return apiRequest(`/api/events/${eventId}/categories/${categoryId}/admin-registrations`, "POST", {
        displayName: data.displayName,
        contactEmail: data.contactEmail || undefined,
        notes: data.notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/registrations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/registrations`] });
      toast({ title: `External ${participantLabel} added successfully` });
      setShowAddDancerDialog(false);
      addExternalDancerForm.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: `Failed to add ${participantLabel}`, 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const addPlatformUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest(`/api/events/${eventId}/categories/${categoryId}/admin-registrations`, "POST", {
        targetUserId: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/registrations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/registrations`] });
      toast({ title: "Platform user added successfully" });
      setShowAddDancerDialog(false);
      setSelectedUserId(null);
      setUserSearchQuery("");
    },
    onError: (error: any) => {
      toast({ 
        title: `Failed to add ${participantLabel}`, 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateRulesMutation = useMutation({
    mutationFn: async (rules: BattleRulesForm) => {
      return apiRequest(`/api/events/${eventId}/categories/${categoryId}/rules`, "PATCH", {
        battleFormat: rules.battleFormat,
        roundsToWin: parseInt(rules.roundsToWin),
        judgingMethod: rules.judgingMethod,
        battleRules: rules.battleRules || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}`] });
      toast({ title: "Battle rules updated" });
      setShowRulesDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update rules", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const removeDancerMutation = useMutation({
    mutationFn: async (registrationId: number) => {
      return apiRequest(`/api/events/${eventId}/categories/${categoryId}/registrations/${registrationId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/registrations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/registrations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories/${categoryId}/matchups`] });
      toast({ title: `${ParticipantLabel} removed` });
      setShowDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast({ 
        title: `Failed to remove ${participantLabel}`, 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const getDancerDisplayName = (reg: Registration) => {
    if (reg.user) {
      return reg.user.displayName || reg.user.username;
    }
    return reg.displayName || `Unknown ${ParticipantLabel}`;
  };

  const handleAddExternalDancer = (data: AddExternalDancerForm) => {
    addExternalDancerMutation.mutate(data);
  };

  const handleAddPlatformUser = () => {
    if (selectedUserId) {
      addPlatformUserMutation.mutate(selectedUserId);
    }
  };

  const handleUpdateRules = (data: BattleRulesForm) => {
    updateRulesMutation.mutate(data);
  };

  const handleDialogClose = () => {
    setShowAddDancerDialog(false);
    setAddMode("external");
    setSelectedUserId(null);
    setUserSearchQuery("");
    addExternalDancerForm.reset();
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Settings className="h-5 w-5 shrink-0" />
              <span>{sportConfig.emoji}</span> Competition Admin Panel
            </CardTitle>
            <CardDescription className="mt-1 text-xs sm:text-sm">
              Manage {participantLabelPlural} and competition settings
            </CardDescription>
          </div>
          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setShowRulesDialog(true)}
              data-testid="button-edit-battle-rules"
              className="text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 shrink-0" />
              <span className="hidden xs:inline">Rules</span>
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowAddDancerDialog(true)}
              data-testid="button-add-dancer"
              className="text-xs sm:text-sm flex-1 sm:flex-none"
            >
              <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 shrink-0" />
              <span className="hidden xs:inline">Add</span> <span className="xs:hidden">+</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center gap-2" data-testid="text-dancer-count">
              <Users className="h-4 w-4" />
              Registered {ParticipantLabelPlural} ({registrations.length})
            </h4>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-6" data-testid="loading-dancers">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground" data-testid="text-no-dancers">
              No {participantLabelPlural} registered yet. Add {participantLabelPlural} manually or wait for registrations.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
              <div className="min-w-full sm:min-w-0">
                <Table data-testid="table-registered-dancers">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">{ParticipantLabel}</TableHead>
                      <TableHead className="whitespace-nowrap">Source</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((reg) => (
                      <TableRow key={reg.id} data-testid={`row-dancer-${reg.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-0">
                            {reg.userId ? (
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="font-medium truncate block" data-testid={`text-dancer-name-${reg.id}`}>
                                {getDancerDisplayName(reg)}
                              </span>
                              {reg.contactEmail && (
                                <span className="text-xs text-muted-foreground block truncate" data-testid={`text-dancer-email-${reg.id}`}>
                                  {reg.contactEmail}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge 
                            variant={reg.source === 'ADMIN' ? 'secondary' : 'default'} 
                            className="text-xs"
                            data-testid={`badge-source-${reg.id}`}
                          >
                            {reg.source === 'ADMIN' ? 'Admin Added' : 'Self'}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge 
                            variant={reg.status === 'CONFIRMED' ? 'default' : 'outline'} 
                            className="text-xs"
                            data-testid={`badge-status-${reg.id}`}
                          >
                            {reg.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive shrink-0"
                            onClick={() => setShowDeleteConfirm(reg.id)}
                            data-testid={`button-remove-dancer-${reg.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t">
          <JudgeManagement 
            eventId={eventId} 
            categoryId={categoryId} 
            category={categoryData}
            canManage={true}
          />
        </div>
      </CardContent>

      <Dialog open={showAddDancerDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-add-dancer">Add {ParticipantLabel}</DialogTitle>
            <DialogDescription data-testid="dialog-description-add-dancer">
              Add a {participantLabel} to this competition category.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-4">
            <RadioGroup 
              value={addMode} 
              onValueChange={(value) => setAddMode(value as "external" | "platform")}
              className="flex gap-4"
              data-testid="radiogroup-add-mode"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="external" id="external" data-testid="radio-external" />
                <Label htmlFor="external">External {ParticipantLabel}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="platform" id="platform" data-testid="radio-platform" />
                <Label htmlFor="platform">Platform User</Label>
              </div>
            </RadioGroup>
          </div>

          {addMode === "external" ? (
            <Form {...addExternalDancerForm}>
              <form onSubmit={addExternalDancerForm.handleSubmit(handleAddExternalDancer)} className="space-y-4">
                <FormField
                  control={addExternalDancerForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{ParticipantLabel} Name *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={`Enter ${participantLabel}'s name or alias`}
                          data-testid="input-external-dancer-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addExternalDancerForm.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder={`${participantLabel}@email.com`}
                          data-testid="input-external-dancer-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addExternalDancerForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={`Any notes about this ${participantLabel}...`}
                          rows={2}
                          data-testid="input-external-dancer-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleDialogClose}
                    data-testid="button-cancel-add-dancer"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={addExternalDancerMutation.isPending}
                    data-testid="button-confirm-add-external-dancer"
                  >
                    {addExternalDancerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add External {ParticipantLabel}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-platform-user"
                />
              </div>
              
              <div className="max-h-48 overflow-y-auto border rounded-md" data-testid="list-platform-users">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground" data-testid="text-no-users-found">
                    {userSearchQuery ? "No users found" : "Type to search users"}
                  </div>
                ) : (
                  filteredUsers.slice(0, 10).map((user) => (
                    <div
                      key={user.id}
                      className={`p-3 border-b last:border-b-0 cursor-pointer hover-elevate ${
                        selectedUserId === user.id ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => setSelectedUserId(user.id)}
                      data-testid={`item-platform-user-${user.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{user.displayName || user.username}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleDialogClose}
                  data-testid="button-cancel-add-platform-user"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddPlatformUser}
                  disabled={!selectedUserId || addPlatformUserMutation.isPending}
                  data-testid="button-confirm-add-platform-user"
                >
                  {addPlatformUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Platform User
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-rules">Battle Rules & Settings</DialogTitle>
            <DialogDescription data-testid="dialog-description-rules">
              Configure how battles are conducted in this category.
            </DialogDescription>
          </DialogHeader>
          <Form {...rulesForm}>
            <form onSubmit={rulesForm.handleSubmit(handleUpdateRules)} className="space-y-4">
              <FormField
                control={rulesForm.control}
                name="battleFormat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Battle Format</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-battle-format">
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1v1">1 vs 1</SelectItem>
                        <SelectItem value="2v2">2 vs 2 (Crew)</SelectItem>
                        <SelectItem value="3v3">3 vs 3 (Team)</SelectItem>
                        <SelectItem value="7togo">7 to Smoke</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={rulesForm.control}
                name="roundsToWin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rounds to Win</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-rounds-to-win">
                          <SelectValue placeholder="Select rounds" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">Best of 1</SelectItem>
                        <SelectItem value="2">Best of 3</SelectItem>
                        <SelectItem value="3">Best of 5</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={rulesForm.control}
                name="judgingMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Judging Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-judging-method">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="points">Point System</SelectItem>
                        <SelectItem value="vote">Judge Voting</SelectItem>
                        <SelectItem value="knockout">Knockout Decision</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={rulesForm.control}
                name="battleRules"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Rules</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Enter any additional rules or guidelines..."
                        rows={3}
                        data-testid="input-battle-rules"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowRulesDialog(false)}
                  data-testid="button-cancel-rules"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateRulesMutation.isPending}
                  data-testid="button-save-rules"
                >
                  {updateRulesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Rules
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="dialog-title-remove-dancer">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remove {ParticipantLabel}
            </DialogTitle>
            <DialogDescription data-testid="dialog-description-remove-dancer">
              Are you sure you want to remove this {participantLabel}? They will be removed from any matchups they are currently in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteConfirm(null)}
              data-testid="button-cancel-remove-dancer"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => showDeleteConfirm && removeDancerMutation.mutate(showDeleteConfirm)}
              disabled={removeDancerMutation.isPending}
              data-testid="button-confirm-remove-dancer"
            >
              {removeDancerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove {ParticipantLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
