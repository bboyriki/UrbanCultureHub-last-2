import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Users, Trophy, Gavel, Star, Shield } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SPORT_CONFIGS, getSportConfig, isDanceSport } from "@/lib/competitionSports";
import { cn } from "@/lib/utils";

// ─── Sport-family helpers ────────────────────────────────────────────────────
function isTableTennisSport(sport: string) { return sport === 'TABLE_TENNIS' || sport === 'TABLE_TENNIS_DOUBLES'; }
function isWinnerPickSport(sport: string) {
  const cfg = SPORT_CONFIGS[sport];
  return cfg?.format === 'winner_pick';
}
function isScoreEntrySport(sport: string) {
  const cfg = SPORT_CONFIGS[sport];
  return cfg?.format === 'score_entry';
}

// Dance-style normaliser (for the hidden `style` DB column)
const DANCE_STYLE_SPORTS = ["BREAKING", "POPPING", "LOCKING", "HIPHOP", "ALL_STYLES", "WAACKING", "VOGUING"];
function deriveStyle(sport: string): string {
  if (DANCE_STYLE_SPORTS.includes(sport)) return sport;
  if (isDanceSport(sport)) return "ALL_STYLES";
  return "ALL_STYLES";
}

// ─── Form schema ─────────────────────────────────────────────────────────────
const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  competitionSport: z.string().min(1),
  battleRules: z.string().optional(),
  registrationMode: z.enum(["PAID", "RESERVATION_ONLY"]),
  registrationFee: z.number().min(0).optional(),
  maxDancers: z.number().int().min(1).optional(),
  // Dance-specific
  participantFormat: z.string().optional(),
  judgeCount: z.number().int().min(1).max(21).optional(),
  judgingMethod: z.string().optional(),
  battleFormat: z.string().optional(),
  // Table tennis / sets-based
  roundsToWin: z.number().int().min(1).max(7).optional(),
});
type CategoryFormData = z.infer<typeof categoryFormSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────
interface EventCategory {
  id: number;
  eventId: number;
  name: string;
  style: string;
  competitionSport: string | null;
  participantFormat: string | null;
  description: string | null;
  battleRules: string | null;
  registrationMode: "PAID" | "RESERVATION_ONLY";
  registrationFee: number | null;
  maxDancers: number | null;
  judgeCount: number | null;
  judgingMethod: string | null;
  battleFormat: string | null;
  roundsToWin: number | null;
  createdAt: string;
  updatedAt: string;
}

interface EventCategoryManagerProps {
  eventId: number;
  isOrganizer: boolean;
}

// ─── Participant-format options by sport ─────────────────────────────────────
function getParticipantFormats(sport: string): { value: string; label: string }[] {
  if (isTableTennisSport(sport)) {
    return [
      { value: "SINGLES", label: "Singles (1v1)" },
      { value: "DOUBLES", label: "Doubles (2v2)" },
    ];
  }
  if (isDanceSport(sport) || sport === "FREESTYLE_FOOTBALL" || sport === "ARM_WRESTLING") {
    return [
      { value: "SOLO", label: "Solo Showcase" },
      { value: "1V1", label: "1v1 Battle" },
      { value: "2V2", label: "2v2 Battle" },
      { value: "3V3", label: "3v3 Battle" },
      { value: "CREW", label: "Crew Battle (4+)" },
    ];
  }
  if (sport === "BASKETBALL_3V3") {
    return [{ value: "3V3", label: "3v3 Team" }];
  }
  if (sport === "PADEL") {
    return [{ value: "DOUBLES", label: "Doubles (2v2)" }];
  }
  return [
    { value: "1V1", label: "Head-to-Head" },
    { value: "TEAM", label: "Team" },
    { value: "SOLO", label: "Individual" },
  ];
}

// ─── Default values per sport ─────────────────────────────────────────────────
function defaultsForSport(sport: string): Partial<CategoryFormData> {
  const cfg = getSportConfig(sport);
  if (isTableTennisSport(sport)) {
    return {
      participantFormat: sport === "TABLE_TENNIS_DOUBLES" ? "DOUBLES" : "SINGLES",
      judgeCount: 1,
      judgingMethod: "POINTS",
      battleFormat: "SINGLE_ELIMINATION",
      roundsToWin: 2, // best of 3 sets
    };
  }
  if (isDanceSport(sport) || sport === "FREESTYLE_FOOTBALL" || sport === "ARM_WRESTLING" || sport === "BOXING") {
    return {
      participantFormat: "1V1",
      judgeCount: 3,
      judgingMethod: "VOTE",
      battleFormat: "SINGLE_ELIMINATION",
      roundsToWin: 2,
    };
  }
  if (sport === "BASKETBALL_3V3") {
    return { participantFormat: "3V3", judgeCount: 1, judgingMethod: "POINTS", battleFormat: "ROUND_ROBIN" };
  }
  if (sport === "PADEL") {
    return { participantFormat: "DOUBLES", judgeCount: 1, judgingMethod: "POINTS", battleFormat: "SINGLE_ELIMINATION", roundsToWin: 2 };
  }
  return { participantFormat: "1V1", judgeCount: 1, judgingMethod: "WINNER_PICK", battleFormat: "SINGLE_ELIMINATION" };
}

// ─── Component ────────────────────────────────────────────────────────────────
export function EventCategoryManager({ eventId, isOrganizer }: EventCategoryManagerProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null);

  const { data: categories = [], isLoading } = useQuery<EventCategory[]>({
    queryKey: [`/api/events/${eventId}/categories`],
  });

  const { data: registrations = [] } = useQuery<any[]>({
    queryKey: [`/api/events/${eventId}/registrations`],
    enabled: categories.length > 0,
  });

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      competitionSport: "BREAKING",
      battleRules: "",
      registrationMode: "RESERVATION_ONLY",
      registrationFee: 0,
      maxDancers: undefined,
      participantFormat: "1V1",
      judgeCount: 3,
      judgingMethod: "VOTE",
      battleFormat: "SINGLE_ELIMINATION",
      roundsToWin: 2,
    },
  });

  const selectedSport = form.watch("competitionSport") || "BREAKING";
  const registrationMode = form.watch("registrationMode");
  const sportConfig = getSportConfig(selectedSport);
  const isTableTennis = isTableTennisSport(selectedSport);
  const isDance = isDanceSport(selectedSport) || selectedSport === "FREESTYLE_FOOTBALL" || selectedSport === "BOXING" || selectedSport === "ARM_WRESTLING";
  const isSetsFormat = SPORT_CONFIGS[selectedSport]?.format === "sets";
  const isWinnerPick = isWinnerPickSport(selectedSport);
  const participantFormats = getParticipantFormats(selectedSport);

  // When sport changes, reset sport-specific defaults
  useEffect(() => {
    const defaults = defaultsForSport(selectedSport);
    Object.entries(defaults).forEach(([key, value]) => {
      form.setValue(key as keyof CategoryFormData, value as any);
    });
  }, [selectedSport]);

  const buildPayload = (data: CategoryFormData) => ({
    ...data,
    style: deriveStyle(data.competitionSport),
    participantLabel: sportConfig.participantLabel,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CategoryFormData) =>
      apiRequest(`/api/events/${eventId}/categories`, "POST", buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories`] });
      toast({ title: "Category created successfully" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      const msg = err?.message || "Please check all required fields";
      toast({ title: "Failed to create category", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CategoryFormData }) =>
      apiRequest(`/api/events/${eventId}/categories/${id}`, "PUT", buildPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories`] });
      toast({ title: "Category updated successfully" });
      setIsDialogOpen(false);
      setEditingCategory(null);
      form.reset();
    },
    onError: () => toast({ title: "Failed to update category", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/events/${eventId}/categories/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/categories`] });
      toast({ title: "Category deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete category", description: error.message || "This category may have existing registrations", variant: "destructive" });
    },
  });

  const onSubmit = (data: CategoryFormData) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (category: EventCategory) => {
    setEditingCategory(category);
    const sport = category.competitionSport || "BREAKING";
    form.reset({
      name: category.name,
      competitionSport: sport,
      battleRules: category.battleRules || "",
      registrationMode: category.registrationMode,
      registrationFee: category.registrationFee || 0,
      maxDancers: category.maxDancers || undefined,
      participantFormat: category.participantFormat || defaultsForSport(sport).participantFormat,
      judgeCount: category.judgeCount ?? defaultsForSport(sport).judgeCount,
      judgingMethod: category.judgingMethod || defaultsForSport(sport).judgingMethod,
      battleFormat: category.battleFormat || "SINGLE_ELIMINATION",
      roundsToWin: category.roundsToWin ?? 2,
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    form.reset();
  };

  const getRegistrationCount = (categoryId: number) =>
    registrations.filter((r: any) => r.categoryId === categoryId).length;

  if (!isOrganizer) return null;

  // ─── Sport family grouping for the select dropdown ──────────────────────────
  const sportsByFamily = Object.values(SPORT_CONFIGS).reduce((acc, s) => {
    if (!acc[s.family]) acc[s.family] = [];
    acc[s.family].push(s);
    return acc;
  }, {} as Record<string, typeof SPORT_CONFIGS[string][]>);

  const familyLabels: Record<string, string> = {
    dance: "💃 Dance & Street",
    racket: "🏓 Racket Sports",
    sport: "⚽ Team Sports",
    combat: "🥊 Combat Sports",
    mind: "♟️ Mind Sports",
    other: "🏅 Other",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Competition Categories</h3>
          <p className="text-sm text-muted-foreground">Manage registration categories for this event</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-add-category"
              onClick={() => {
                setEditingCategory(null);
                form.reset({
                  name: "", competitionSport: "BREAKING", battleRules: "",
                  registrationMode: "RESERVATION_ONLY", registrationFee: 0,
                  maxDancers: undefined, participantFormat: "1V1",
                  judgeCount: 3, judgingMethod: "VOTE", battleFormat: "SINGLE_ELIMINATION", roundsToWin: 2,
                });
                setIsDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Category
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Edit Category" : "Create Competition Category"}</DialogTitle>
              <DialogDescription>Configure a competition category with sport-specific rules and judging</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                {/* ── Category Name ── */}
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Solo Breaking, 1v1 Open, Singles U18" {...field} data-testid="input-category-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ── Competition Sport ── */}
                <FormField control={form.control} name="competitionSport" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Competition Sport</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "BREAKING"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-competition-sport">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(sportsByFamily).map(([family, sports]) => (
                          <div key={family}>
                            <div className="px-2 py-1 text-xs font-bold text-muted-foreground uppercase tracking-wide border-b mb-1 mt-2">
                              {familyLabels[family] || family}
                            </div>
                            {sports.map(s => (
                              <SelectItem key={s.key} value={s.key}>
                                {s.emoji} {s.label}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">{sportConfig.description}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ── Participant Format ── */}
                <FormField control={form.control} name="participantFormat" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participant Format</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "1V1"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-participant-format">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {participantFormats.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ── Dance/Combat/Freestyle: Judge Panel ── */}
                {(isDance) && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Gavel className="w-4 h-4" /> Judge Panel Settings
                    </div>

                    <FormField control={form.control} name="judgeCount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Judges</FormLabel>
                        <Select
                          onValueChange={v => field.onChange(parseInt(v))}
                          value={String(field.value ?? 3)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-judge-count">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1 Judge</SelectItem>
                            <SelectItem value="3">3 Judges (standard)</SelectItem>
                            <SelectItem value="5">5 Judges</SelectItem>
                            <SelectItem value="7">7 Judges</SelectItem>
                            <SelectItem value="9">9 Judges</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">Odd numbers give a clean majority vote</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="judgingMethod" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Judging Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "VOTE"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-judging-method">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="VOTE">Majority Vote — each judge picks a winner</SelectItem>
                            <SelectItem value="CRITERIA">Criteria Scoring — judges score on multiple criteria</SelectItem>
                            <SelectItem value="KNOCKOUT">Knockout — judges eliminate from round</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="roundsToWin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rounds per Battle (Best of…)</FormLabel>
                        <Select
                          onValueChange={v => field.onChange(parseInt(v))}
                          value={String(field.value ?? 2)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-rounds-to-win">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1 Round (sudden death)</SelectItem>
                            <SelectItem value="2">Best of 3 (win 2)</SelectItem>
                            <SelectItem value="3">Best of 5 (win 3)</SelectItem>
                            <SelectItem value="4">Best of 7 (win 4)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                {/* ── Table Tennis: scoring setup ── */}
                {isTableTennis && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Shield className="w-4 h-4" /> Table Tennis Scoring
                    </div>

                    <FormField control={form.control} name="roundsToWin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sets to Win (Best of…)</FormLabel>
                        <Select
                          onValueChange={v => field.onChange(parseInt(v))}
                          value={String(field.value ?? 2)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-sets-to-win">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="2">Best of 3 (win 2 sets)</SelectItem>
                            <SelectItem value="3">Best of 5 (win 3 sets)</SelectItem>
                            <SelectItem value="4">Best of 7 (win 4 sets)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormItem>
                      <FormLabel>Referee / Umpire</FormLabel>
                      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                        <Shield className="w-4 h-4 text-green-500 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">1 Umpire (fixed)</p>
                          <p className="text-xs text-muted-foreground">Table tennis matches are scored in real-time by a single umpire via the Judge Panel. First to 11 pts/game, must win by 2.</p>
                        </div>
                      </div>
                    </FormItem>
                  </div>
                )}

                {/* ── Sets-based sports (Padel) ── */}
                {isSetsFormat && !isTableTennis && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Star className="w-4 h-4" /> Sets Scoring
                    </div>
                    <FormField control={form.control} name="roundsToWin" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sets to Win</FormLabel>
                        <Select
                          onValueChange={v => field.onChange(parseInt(v))}
                          value={String(field.value ?? 2)}
                        >
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="2">Best of 3</SelectItem>
                            <SelectItem value="3">Best of 5</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                {/* ── Bracket format (all sports) ── */}
                <FormField control={form.control} name="battleFormat" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bracket Format</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "SINGLE_ELIMINATION"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-battle-format">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="SINGLE_ELIMINATION">Single Elimination</SelectItem>
                        <SelectItem value="DOUBLE_ELIMINATION">Double Elimination</SelectItem>
                        <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ── Registration ── */}
                <FormField control={form.control} name="registrationMode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-registration-mode">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RESERVATION_ONLY">Free Registration</SelectItem>
                        <SelectItem value="PAID">Paid Registration</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {registrationMode === "PAID" && (
                  <FormField control={form.control} name="registrationFee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Registration Fee (€)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00"
                          {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          data-testid="input-registration-fee"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="maxDancers" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max {sportConfig.participantLabelPlural} (Optional)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="Unlimited"
                        {...field}
                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        data-testid="input-max-participants"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Leave empty for unlimited registrations</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* ── Custom Rules ── */}
                <FormField control={form.control} name="battleRules" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Rules / Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={
                          isTableTennis
                            ? "e.g., Each game is first to 11 (deuce at 10-10). Service alternates every 2 points."
                            : isDance
                              ? "e.g., 1 minute per round. No contact. Music provided by DJ."
                              : "Category details, eligibility, rules..."
                        }
                        className="min-h-[80px]"
                        {...field}
                        data-testid="input-category-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={handleDialogClose} data-testid="button-cancel-category">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-category">
                    {editingCategory ? "Update" : "Create"} Category
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Category Cards ── */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading categories...</p>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No competition categories yet</p>
            <p className="text-sm text-muted-foreground">Create your first category to start accepting registrations</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map(category => {
            const regCount = getRegistrationCount(category.id);
            const isFull = category.maxDancers && regCount >= category.maxDancers;
            const sportCfg = getSportConfig(category.competitionSport);
            const isTT = isTableTennisSport(category.competitionSport || "");
            const isDanceC = isDanceSport(category.competitionSport);

            return (
              <Card key={category.id} data-testid={`card-category-${category.id}`}
                className={cn("border-t-[3px]", `border-t-[var(--sport-accent,hsl(var(--primary)))]`)}
                style={{ "--sport-accent": `hsl(var(--primary))` } as any}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{category.name}</CardTitle>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                          {sportCfg.emoji} {sportCfg.label}
                        </Badge>
                        {category.participantFormat && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {category.participantFormat.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(category)} data-testid={`button-edit-category-${category.id}`}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-delete-category-${category.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{category.name}".
                              {regCount > 0 && ` ${regCount} ${regCount === 1 ? sportCfg.participantLabel : sportCfg.participantLabelPlural} are registered.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(category.id)} className="bg-destructive hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <CardDescription className="mb-3 text-xs">
                    {category.registrationMode === "PAID"
                      ? `€${(category.registrationFee || 0).toFixed(2)} entry fee`
                      : "Free entry"}
                  </CardDescription>

                  {/* Sport-specific details */}
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {isTT && (
                      <span>🏓 First to 11 pts/game · Best of {(category.roundsToWin ?? 2) * 2 - 1} sets · {category.judgeCount ?? 1} umpire</span>
                    )}
                    {isDanceC && category.judgeCount != null && (
                      <span className="flex items-center gap-1"><Gavel className="w-3 h-3" /> {category.judgeCount} judge{category.judgeCount !== 1 ? "s" : ""} · {(category.judgingMethod || "VOTE").toLowerCase()} · Best of {(category.roundsToWin ?? 2) * 2 - 1} rounds</span>
                    )}
                    {category.battleRules && (
                      <span className="line-clamp-2 mt-1 italic">"{category.battleRules}"</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {regCount}
                        {category.maxDancers && ` / ${category.maxDancers}`}
                        {" "}{sportCfg.participantLabelPlural}
                      </span>
                    </div>
                    {isFull && <span className="text-destructive font-semibold text-xs">FULL</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
