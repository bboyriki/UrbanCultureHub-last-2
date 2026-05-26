import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  RefreshCw,
  ExternalLink,
  Calendar,
  MapPin,
  Link2,
  Music,
  Image,
  Tag,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";

interface Issue {
  field: string;
  type: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

interface LinkCheck {
  reachable: boolean;
  httpStatus: number | null;
  ms: number;
  error?: string;
}

interface EventValidation {
  id: number;
  title: string;
  date: string;
  location: string;
  city: string;
  source: string;
  musicGenre: string;
  externalTicketLink: string | null;
  status: "valid" | "warning" | "error";
  issues: Issue[];
  linkCheck: LinkCheck | null;
}

const FIELD_ICONS: Record<string, any> = {
  externalTicketLink: Link2,
  date: Calendar,
  location: MapPin,
  city: MapPin,
  image: Image,
  musicGenre: Music,
  category: Tag,
  title: Tag,
  description: Tag,
  price: Tag,
};

const STATUS_COLORS = {
  valid: "text-green-600 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800 dark:text-green-400",
  warning: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400",
  error: "text-red-600 bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800 dark:text-red-400",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "valid") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function IssueIcon({ type }: { type: string }) {
  if (type === "error") return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />;
  if (type === "warning") return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />;
  return <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />;
}

function EditableField({
  eventId,
  field,
  currentValue,
  placeholder,
  onSaved,
}: {
  eventId: number;
  field: string;
  currentValue: string | null;
  placeholder: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue ?? "");
  const { toast } = useToast();
  const qc = useQueryClient();

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest(`/api/admin/events/${eventId}/fields`, "PATCH", { [field]: value }),
    onSuccess: () => {
      toast({ title: "Opgeslagen", description: "Veld bijgewerkt" });
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["/api/admin/events/validate"] });
      onSaved();
    },
    onError: (err: any) => toast({ title: "Fout", description: err.message, variant: "destructive" }),
  });

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 underline-offset-2 hover:underline"
        data-testid={`edit-field-${eventId}-${field}`}
      >
        <Pencil className="w-3 h-3" />
        {currentValue ? "Wijzigen" : "Toevoegen"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-xs"
        autoFocus
        data-testid={`input-field-${eventId}-${field}`}
        onKeyDown={(e) => {
          if (e.key === "Enter") saveMut.mutate();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        onClick={() => saveMut.mutate()}
        disabled={saveMut.isPending}
        className="p-1 rounded hover:bg-green-100 text-green-600"
        data-testid={`save-field-${eventId}-${field}`}
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={() => setEditing(false)}
        className="p-1 rounded hover:bg-gray-100 text-gray-500"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function EventCard({ evt, onSaved }: { evt: EventValidation; onSaved: () => void }) {
  const [expanded, setExpanded] = useState(evt.status === "error");
  const errors = evt.issues.filter((i) => i.type === "error");
  const warnings = evt.issues.filter((i) => i.type === "warning");
  const infos = evt.issues.filter((i) => i.type === "info");

  return (
    <div
      className={`rounded-lg border p-3 ${STATUS_COLORS[evt.status]} transition-all`}
      data-testid={`event-card-${evt.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon status={evt.status} />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">{evt.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {evt.date && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(evt.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
              {evt.city && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {evt.city}
                </span>
              )}
              {evt.musicGenre && (
                <Badge variant="outline" className="text-xs h-4 px-1">{evt.musicGenre}</Badge>
              )}
              {evt.source && evt.source !== "manual" && (
                <Badge className="text-xs h-4 px-1 bg-purple-100 text-purple-700 border-purple-200">{evt.source}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {errors.length > 0 && (
            <span className="text-xs font-semibold text-red-600 bg-red-100 rounded px-1">{errors.length} fout{errors.length > 1 ? "en" : ""}</span>
          )}
          {warnings.length > 0 && (
            <span className="text-xs font-semibold text-amber-600 bg-amber-100 rounded px-1">{warnings.length} waarsch.</span>
          )}
          {evt.externalTicketLink && (
            <a
              href={evt.externalTicketLink}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded hover:bg-white/50"
              title={evt.externalTicketLink}
              data-testid={`link-event-${evt.id}`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            </a>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-white/50"
            data-testid={`expand-event-${evt.id}`}
          >
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </div>

      {expanded && evt.issues.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-current/10 pt-2">
          {[...errors, ...warnings, ...infos].map((issue, idx) => {
            const Icon = FIELD_ICONS[issue.field] ?? Tag;
            const isLinkField = issue.field === "externalTicketLink";
            return (
              <div key={idx} className="flex gap-2">
                <IssueIcon type={issue.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Icon className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{issue.message}</span>
                  </div>
                  {issue.suggestion && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">{issue.suggestion}</p>
                  )}
                  {isLinkField && (
                    <EditableField
                      eventId={evt.id}
                      field="externalTicketLink"
                      currentValue={evt.externalTicketLink}
                      placeholder="https://..."
                      onSaved={onSaved}
                    />
                  )}
                  {issue.field === "date" && issue.type === "warning" && (
                    <EditableField
                      eventId={evt.id}
                      field="date"
                      currentValue={evt.date ? evt.date.slice(0, 16) : ""}
                      placeholder="2026-06-15T20:00"
                      onSaved={onSaved}
                    />
                  )}
                  {issue.field === "musicGenre" && (
                    <EditableField
                      eventId={evt.id}
                      field="musicGenre"
                      currentValue={evt.musicGenre}
                      placeholder="Electronic, Hip-Hop, Afrobeats..."
                      onSaved={onSaved}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {evt.linkCheck && (
            <div className="flex items-center gap-2 text-xs text-gray-500 border-t border-current/10 pt-2 mt-2">
              <Link2 className="w-3 h-3" />
              Link check:&nbsp;
              {evt.linkCheck.reachable ? (
                <span className="text-green-600 font-medium">✅ Bereikbaar (HTTP {evt.linkCheck.httpStatus}, {evt.linkCheck.ms}ms)</span>
              ) : (
                <span className="text-red-600 font-medium">
                  ❌ Niet bereikbaar{evt.linkCheck.httpStatus ? ` — HTTP ${evt.linkCheck.httpStatus}` : evt.linkCheck.error === "timeout" ? " — timeout" : evt.linkCheck.error ? ` — ${evt.linkCheck.error}` : ""}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminEventValidator() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "valid">("all");

  const { data, isLoading, isFetching, refetch } = useQuery<EventValidation[]>({
    queryKey: ["/api/admin/events/validate"],
    staleTime: 60000,
    gcTime: 120000,
    refetchOnWindowFocus: false,
  });

  const events = data ?? [];
  const filtered = filter === "all" ? events : events.filter((e) => e.status === filter);

  const totals = {
    error: events.filter((e) => e.status === "error").length,
    warning: events.filter((e) => e.status === "warning").length,
    valid: events.filter((e) => e.status === "valid").length,
  };

  const handleRefresh = () => {
    qc.removeQueries({ queryKey: ["/api/admin/events/validate"] });
    refetch();
    toast({ title: "Validatie gestart", description: "Alle evenementen worden opnieuw gecontroleerd…" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Evenement Kwaliteitscheck</h2>
          <p className="text-sm text-gray-500">Controleert links, datums en ontbrekende velden in realtime</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading || isFetching}
          size="sm"
          className="gap-2"
          data-testid="button-revalidate"
        >
          <RefreshCw className={`w-4 h-4 ${(isLoading || isFetching) ? "animate-spin" : ""}`} />
          {isLoading || isFetching ? "Controleren…" : "Opnieuw controleren"}
        </Button>
      </div>

      {(isLoading || isFetching) && (
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          Bezig met valideren van alle evenementen inclusief URL-checks… dit duurt 10–30 seconden.
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card
              className={`cursor-pointer border-2 transition-all ${filter === "error" ? "border-red-400" : "border-transparent"}`}
              onClick={() => setFilter(filter === "error" ? "all" : "error")}
              data-testid="filter-error"
            >
              <CardContent className="p-3 flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{totals.error}</p>
                  <p className="text-xs text-gray-500">Met fouten</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer border-2 transition-all ${filter === "warning" ? "border-amber-400" : "border-transparent"}`}
              onClick={() => setFilter(filter === "warning" ? "all" : "warning")}
              data-testid="filter-warning"
            >
              <CardContent className="p-3 flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">{totals.warning}</p>
                  <p className="text-xs text-gray-500">Waarschuwingen</p>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer border-2 transition-all ${filter === "valid" ? "border-green-400" : "border-transparent"}`}
              onClick={() => setFilter(filter === "valid" ? "all" : "valid")}
              data-testid="filter-valid"
            >
              <CardContent className="p-3 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{totals.valid}</p>
                  <p className="text-xs text-gray-500">Geldig</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Filter className="w-4 h-4" />
            <span>{filtered.length} van {events.length} evenementen</span>
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="text-blue-600 hover:underline text-xs">
                Alles tonen
              </button>
            )}
          </div>

          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Geen evenementen in deze categorie
              </div>
            )}
            {filtered.map((evt) => (
              <EventCard key={evt.id} evt={evt} onSaved={() => refetch()} />
            ))}
          </div>
        </>
      )}

      {!data && !isLoading && (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Klik op "Opnieuw controleren" om de validatie te starten</p>
        </div>
      )}
    </div>
  );
}
