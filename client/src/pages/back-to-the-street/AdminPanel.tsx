import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Flame, Users, Trophy, Clock, Image, Star, Plus, Pencil, Trash2,
  ChevronRight, Zap, Activity, Shield, SquarePen, Play,
  X, Check, ArrowUp, ArrowDown,
  LayoutDashboard, Swords, UserCheck, ClipboardList,
  Ticket, CreditCard, Layers, PackageOpen, ReceiptText,
  Sparkles, Send, Loader2, RotateCcw, Megaphone, ExternalLink,
  CircleCheck
} from "lucide-react";
import { useEdit } from "./context";
import { FIRE, typeIcon, typeBadge, categoryColor, statusColor, initials, BioExpandable, DeleteConfirm } from "./helpers";

function ResetTicketsButton({ ticketCount, purchaseCount }: { ticketCount: number; purchaseCount: number }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const resetMut = useMutation({
    mutationFn: () => apiRequest("/api/btts/tickets", "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/btts/tickets"] });
      qc.invalidateQueries({ queryKey: ["/api/btts/ticket-purchases"] });
      qc.invalidateQueries({ queryKey: ["/api/btts/my-spots"] });
      toast({ title: "All tickets reset", description: "All ticket types and claims have been cleared." });
      setOpen(false);
    },
    onError: () => toast({ title: "Reset failed", variant: "destructive" }),
  });
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 transition-colors"
        data-testid="button-reset-all-tickets"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Reset All Tickets
      </button>
      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-4 h-4" /> Reset All Tickets?
            </DialogTitle>
          </DialogHeader>
          <p className="text-white/60 text-sm leading-relaxed">
            This will permanently delete <strong className="text-white">{ticketCount} ticket type{ticketCount !== 1 ? "s" : ""}</strong> and <strong className="text-white">{purchaseCount} claim{purchaseCount !== 1 ? "s" : ""}</strong>. You can create fresh ticket types afterwards.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
            <Button onClick={() => resetMut.mutate()} disabled={resetMut.isPending} className="bg-red-600 hover:bg-red-700 text-white border-0 font-bold">
              {resetMut.isPending ? "Resetting…" : "Yes, Reset All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AdminPanel({ onAdd }: { onAdd: (type:string) => void }) {
  const [activeTab, setActiveTab] = useState("overview");
  const { data: program = [] }        = useQuery<any[]>({ queryKey:["/api/btts/program"] });
  const { data: lineup  = [] }        = useQuery<any[]>({ queryKey:["/api/btts/lineup"]  });
  const { data: battles = [] }        = useQuery<any[]>({ queryKey:["/api/btts/battles"] });
  const { data: gallery = [] }        = useQuery<any[]>({ queryKey:["/api/btts/gallery"] });
  const { data: registrations = [] }  = useQuery<any[]>({ queryKey:["/api/btts/registrations"] });
  const { data: judges = [] }         = useQuery<any[]>({ queryKey:["/api/btts/judges"] });
  const { data: settingsData }        = useQuery<any>({ queryKey:["/api/btts/settings"] });
  const { openProgram, openLineup, openBattle, openGallery } = useEdit();
  const qc = useQueryClient();
  const { toast } = useToast();
  const bttsSettings = {
    registrationOpen: settingsData?.registrationOpen ?? false,
    bracketPublic:    settingsData?.bracketPublic    ?? true,
    judgeCount:       settingsData?.judgeCount       ?? 5,
    activeFormat:     settingsData?.activeFormat     ?? "1v1",
    eventDate:        settingsData?.eventDate        ?? "",
    eventYear:        settingsData?.eventYear        ?? "2026",
    eventVenue:       settingsData?.eventVenue       ?? "",
    eventCity:        settingsData?.eventCity        ?? "Netherlands",
    ticketUrl:        settingsData?.ticketUrl        ?? "",
    eventTitle:       settingsData?.eventTitle       ?? "Back to the Street",
    ctaBadge:         settingsData?.ctaBadge         ?? "Free Entry",
    ctaTitle:         settingsData?.ctaTitle         ?? "Join the Movement",
    ctaDesc:          settingsData?.ctaDesc          ?? "",
    eventDescription: settingsData?.eventDescription ?? "",
  };

  const [eventDraft, setEventDraft] = useState<null|{title:string;year:string;date:string;venue:string;city:string;ticketUrl:string}>(null);
  const [ctaDraft, setCtaDraft] = useState<null|{badge:string;title:string;desc:string}>(null);

  const saveSettingsMut = useMutation({
    mutationFn: (patch:any) => apiRequest("/api/btts/settings","PATCH",patch).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/settings"] }); toast({ title:"Settings saved" }); },
    onError: () => toast({ title:"Failed", variant:"destructive" }),
  });
  const addJudgeMut = useMutation({
    mutationFn: (data:any) => apiRequest("/api/btts/judges","POST",data).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/judges"] }); toast({ title:"Judge added" }); setJudgeForm({guestName:"",specialty:"",judgeNumber:1,category:"Breaking",avatarUrl:""}); },
    onError: () => toast({ title:"Failed", variant:"destructive" }),
  });
  const delJudgeMut = useMutation({
    mutationFn: (id:number) => apiRequest(`/api/btts/judges/${id}`,"DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/judges"] }); toast({ title:"Judge removed" }); },
    onError: () => toast({ title:"Failed", variant:"destructive" }),
  });
  const patchRegMut = useMutation({
    mutationFn: ({id,data}:{id:number;data:any}) => apiRequest(`/api/btts/registrations/${id}`,"PATCH",data).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/registrations"] }); toast({ title:"Updated" }); },
    onError: () => toast({ title:"Failed", variant:"destructive" }),
  });
  const delRegMut = useMutation({
    mutationFn: (id:number) => apiRequest(`/api/btts/registrations/${id}`,"DELETE"),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/registrations"] }); toast({ title:"Removed" }); },
    onError: () => toast({ title:"Failed", variant:"destructive" }),
  });
  const testRegMut = useMutation({
    mutationFn: (data:any) => apiRequest("/api/btts/registrations","POST",data).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["/api/btts/registrations"] }); toast({ title:"✓ Test registration submitted", description:"Check the list below — it shows as pending." }); },
    onError: (e:any) => toast({ title:"Test failed", description:e?.message ?? "Could not submit", variant:"destructive" }),
  });
  const bracketGenMut = useMutation({
    mutationFn: (data:{battleType:string;category:string;forceRegen?:boolean}) =>
      apiRequest("/api/btts/bracket/generate","POST",data).then(r=>r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey:["/api/btts/battles"] });
      if (data.generated > 0) toast({ title:`✓ Bracket updated`, description:`${data.participants ?? "?"} confirmed → ${data.size ?? "?"}-person bracket (${data.generated} slots)` });
    },
    onError: () => toast({ title:"Bracket sync failed", variant:"destructive" }),
  });

  const [judgeForm, setJudgeForm] = useState({ guestName:"", specialty:"", judgeNumber:1, category:"Breaking", avatarUrl:"" });

  const patchProg = useMutation({ mutationFn:({id,data}:{id:number;data:any})=>apiRequest(`/api/btts/program/${id}`,"PATCH",data), onSuccess:()=>qc.invalidateQueries({queryKey:["/api/btts/program"]}) });
  const patchLine = useMutation({ mutationFn:({id,data}:{id:number;data:any})=>apiRequest(`/api/btts/lineup/${id}`,"PATCH",data),  onSuccess:()=>qc.invalidateQueries({queryKey:["/api/btts/lineup"]})  });
  const patchBat  = useMutation({ mutationFn:({id,data}:{id:number;data:any})=>apiRequest(`/api/btts/battles/${id}`,"PATCH",data), onSuccess:()=>qc.invalidateQueries({queryKey:["/api/btts/battles"]}) });

  /* ── Ticket admin state ── */
  const { data: adminTickets = [] }    = useQuery<any[]>({ queryKey:["/api/btts/tickets"] });
  const { data: allPurchases = [] }    = useQuery<any[]>({ queryKey:["/api/btts/ticket-purchases"] });
  const [ticketView, setTicketView]    = useState<"types"|"purchases">("types");
  const [ticketForm, setTicketForm]    = useState({ name:"", description:"", price:0, currency:"EUR", type:"general", battleFormat:"1v1", totalSpots:0, isActive:true });
  const [editingTicket, setEditingTicket] = useState<any>(null);
  const createTicketMut = useMutation({
    mutationFn: (data:any) => apiRequest("/api/btts/tickets","POST",data).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/btts/tickets"]}); toast({title:"Ticket type created"}); setTicketForm({name:"",description:"",price:0,currency:"EUR",type:"general",battleFormat:"1v1",totalSpots:0,isActive:true}); },
    onError: () => toast({title:"Failed",variant:"destructive"}),
  });
  const updateTicketMut = useMutation({
    mutationFn: ({id,data}:{id:number;data:any}) => apiRequest(`/api/btts/tickets/${id}`,"PATCH",data).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/btts/tickets"]}); toast({title:"Ticket updated"}); setEditingTicket(null); },
    onError: () => toast({title:"Failed",variant:"destructive"}),
  });
  const deleteTicketMut = useMutation({
    mutationFn: (id:number) => apiRequest(`/api/btts/tickets/${id}`,"DELETE"),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/btts/tickets"]}); toast({title:"Ticket type deleted"}); },
    onError: () => toast({title:"Failed",variant:"destructive"}),
  });
  const patchPurchaseMut = useMutation({
    mutationFn: ({id,data}:{id:number;data:any}) => apiRequest(`/api/btts/ticket-purchases/${id}`,"PATCH",data).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/btts/ticket-purchases"]}); toast({title:"Purchase updated"}); },
    onError: () => toast({title:"Failed",variant:"destructive"}),
  });
  const deletePurchaseMut = useMutation({
    mutationFn: (id:number) => apiRequest(`/api/btts/ticket-purchases/${id}`,"DELETE"),
    onSuccess: () => { qc.invalidateQueries({queryKey:["/api/btts/ticket-purchases"]}); toast({title:"Removed"}); },
    onError: () => toast({title:"Failed",variant:"destructive"}),
  });

  const sorted = [...(program as any[])].sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0));

  const moveItem = (item:any, dir:"up"|"down") => {
    const idx = sorted.findIndex(x=>x.id===item.id);
    const swapIdx = dir==="up" ? idx-1 : idx+1;
    if (swapIdx<0||swapIdx>=sorted.length) return;
    const swap = sorted[swapIdx];
    patchProg.mutate({ id:item.id, data:{sortOrder:swap.sortOrder??swapIdx} });
    patchProg.mutate({ id:swap.id, data:{sortOrder:item.sortOrder??idx} });
  };

  const STATUS_CYCLE = ["upcoming","live","completed"];
  const ROUNDS = ["Final","Semi Final","Quarter Final","Round of 16","Prelim"];
  const battleGroups = ROUNDS.reduce<Record<string,any[]>>((acc,r)=>{ const m=(battles as any[]).filter(b=>b.round===r||b.round===r+"s"); if(m.length) acc[r]=m; return acc; },{});

  const liveBattles  = (battles as any[]).filter(b=>b.status==="live").length;
  const doneBattles  = (battles as any[]).filter(b=>b.status==="completed").length;
  const featLineup   = (lineup  as any[]).filter(m=>m.featured).length;
  const hlProg       = (program as any[]).filter(p=>p.isHighlight).length;

  const tabs = [
    { value:"overview",      label:"Overview",      icon:<LayoutDashboard className="w-3.5 h-3.5"/> },
    { value:"ai",            label:"AI Assistant",  icon:<Sparkles className="w-3.5 h-3.5"/> },
    { value:"settings",      label:"Settings",      icon:<Shield className="w-3.5 h-3.5"/> },
    { value:"tickets",       label:"Tickets",       icon:<Ticket className="w-3.5 h-3.5"/> },
    { value:"program",       label:"Program",       icon:<Clock className="w-3.5 h-3.5"/> },
    { value:"lineup",        label:"Lineup",        icon:<Users className="w-3.5 h-3.5"/> },
    { value:"battles",       label:"Battles",       icon:<Trophy className="w-3.5 h-3.5"/> },
    { value:"registrations", label:"Registrations", icon:<ClipboardList className="w-3.5 h-3.5"/> },
    { value:"judges",        label:"Judges",        icon:<UserCheck className="w-3.5 h-3.5"/> },
    { value:"gallery",       label:"Gallery",       icon:<Image className="w-3.5 h-3.5"/> },
  ];

  /* ── AI Assistant state ── */
  type AiMessage = { role:"user"|"assistant"; content:string; actions?:{tool:string;result:string}[] };
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiChatScrollRef = useRef<HTMLDivElement>(null);

  const { data: aiHealth } = useQuery<{score:number;issues:string[];suggestions:string[]}>({
    queryKey:["/api/btts/ai/health"],
    enabled: activeTab === "ai",
  });
  const { data: aiItems } = useQuery<{judges:any[];lineup:any[];battles:any[];total:number}>({
    queryKey:["/api/btts/ai/items"],
    refetchOnWindowFocus: false,
  });

  const clearAiItemsMut = useMutation({
    mutationFn: (type: string) => apiRequest(`/api/btts/ai/items?type=${type}`, "DELETE").then(r=>r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["/api/btts/judges"] });
      qc.invalidateQueries({ queryKey:["/api/btts/lineup"] });
      qc.invalidateQueries({ queryKey:["/api/btts/battles"] });
      qc.invalidateQueries({ queryKey:["/api/btts/ai/items"] });
      qc.invalidateQueries({ queryKey:["/api/btts/ai/health"] });
    },
  });

  useEffect(() => {
    if (aiChatScrollRef.current) {
      aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight;
    }
  }, [aiMessages, aiLoading]);

  const aiChatMut = useMutation({
    mutationFn: (data:{message:string;history:AiMessage[]}) =>
      apiRequest("/api/btts/ai/chat","POST",data).then(r=>r.json()),
    onSuccess: (data:any) => {
      setAiMessages(prev => [...prev, { role:"assistant", content:data.reply, actions:data.actions }]);
      if (data.actions?.length > 0) {
        qc.invalidateQueries({ queryKey:["/api/btts/settings"] });
        qc.invalidateQueries({ queryKey:["/api/btts/tickets"] });
        qc.invalidateQueries({ queryKey:["/api/btts/judges"] });
        qc.invalidateQueries({ queryKey:["/api/btts/lineup"] });
        qc.invalidateQueries({ queryKey:["/api/btts/battles"] });
        qc.invalidateQueries({ queryKey:["/api/btts/program"] });
        qc.invalidateQueries({ queryKey:["/api/btts/ai/health"] });
        qc.invalidateQueries({ queryKey:["/api/btts/ai/items"] });

        // Auto-navigate to the relevant tab when AI creates or modifies content
        const tools = data.actions.map((a:any) => a.tool as string);
        const affectsTab = (keywords: string[]) => tools.some((t:string) => keywords.some(k => t.includes(k)));
        if (affectsTab(["battle", "bracket"])) setActiveTab("battles");
        else if (affectsTab(["lineup", "lineup_member"])) setActiveTab("lineup");
        else if (affectsTab(["judge"])) setActiveTab("judges");
        else if (affectsTab(["program"])) setActiveTab("program");
        else if (affectsTab(["ticket"])) setActiveTab("tickets");
        else if (affectsTab(["settings"])) setActiveTab("settings");
      }
      setAiLoading(false);
    },
    onError: (e:any) => {
      setAiMessages(prev => [...prev, { role:"assistant", content:`Something went wrong: ${e?.message ?? "Unknown error"}` }]);
      setAiLoading(false);
    },
  });
  const sendAiMessage = (text?:string) => {
    const msg = (text ?? aiInput).trim();
    if (!msg || aiLoading) return;
    const newMsg: AiMessage = { role:"user", content:msg };
    setAiMessages(prev => [...prev, newMsg]);
    setAiInput("");
    setAiLoading(true);
    aiChatMut.mutate({ message:msg, history:aiMessages });
  };

  const AI_QUICK_ACTIONS = [
    { label:"Analyze event & tell me what's missing", icon:"🔍" },
    { label:"Add 3 world-class breaking judges with bios", icon:"⚖️" },
    { label:"Set up a full 1v1 bracket for 16 participants", icon:"🏆" },
    { label:"Add a DJ and MC to the lineup", icon:"🎧" },
    { label:"Open registration and set format to 1v1", icon:"🔓" },
    { label:"Create ticket types: 1 battle spot + 1 general entry", icon:"🎟️" },
  ];

  return (
    <section className="py-16 bg-[#060609] border-t border-white/5" id="btts-admin">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-white font-black text-lg tracking-tight">BTTS Admin Control</h2>
            <p className="text-white/35 text-xs">Click anything on the page above to edit it, or use the tabs below</p>
          </div>
          <Badge className="ml-auto bg-orange-500/15 text-orange-300 border-orange-500/25 text-[10px] px-3 py-1">ADMIN MODE</Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border border-white/10 mb-6 flex flex-wrap h-auto gap-1 p-1">
            {tabs.map(t=>(
              <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-1.5 data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300 data-[state=active]:border data-[state=active]:border-orange-500/30 text-white/40 text-xs capitalize">
                {t.icon}{t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="space-y-6">
              {/* Warning: DB is empty but public page shows placeholder content */}
              {(battles as any[]).length === 0 && (lineup as any[]).length === 0 && (program as any[]).length === 0 && (
                <div className="flex items-start gap-3 p-3 rounded-xl border border-yellow-500/25 bg-yellow-500/5">
                  <span className="text-yellow-400 text-sm shrink-0">⚠️</span>
                  <p className="text-yellow-300/80 text-xs leading-relaxed">
                    <strong className="text-yellow-300">No data saved yet.</strong> The public BTTS page is currently showing placeholder content. Use the <button className="underline text-yellow-300" onClick={()=>setActiveTab("ai")}>AI assistant</button> or the tabs below to add real battles, lineup, and program items.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:"Program Items",  count:(program as any[]).length, tab:"program",  icon:<Clock className="w-5 h-5 text-orange-400"/>, aiCount: aiItems?.total ? (program as any[]).filter((p:any)=>p.addedByAi).length : 0 },
                  { label:"Lineup Members", count:(lineup  as any[]).length, tab:"lineup",   icon:<Users className="w-5 h-5 text-yellow-400"/>, aiCount: aiItems ? (lineup as any[]).filter((m:any)=>m.addedByAi).length : 0 },
                  { label:"Battle Brackets",count:(battles as any[]).length, tab:"battles",  icon:<Trophy className="w-5 h-5 text-red-400"/>,   aiCount: aiItems ? (battles as any[]).filter((b:any)=>b.addedByAi).length : 0 },
                  { label:"Gallery Items",  count:(gallery as any[]).length, tab:"gallery",  icon:<Image className="w-5 h-5 text-blue-400"/>,   aiCount: 0 },
                ].map(s=>(
                  <button key={s.tab} onClick={()=>setActiveTab(s.tab)} className="group p-4 rounded-2xl border border-white/8 bg-white/[0.02] hover:border-orange-500/30 hover:bg-orange-500/5 transition-all text-left">
                    <div className="mb-3">{s.icon}</div>
                    <div className="text-2xl font-black text-white mb-0.5">{s.count}</div>
                    <div className="text-white/40 text-xs">{s.label}</div>
                    {s.aiCount > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-violet-400/80">
                        <Sparkles className="w-2.5 h-2.5"/>{s.aiCount} AI-added
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-orange-400/60 group-hover:text-orange-400 transition-colors">Manage <ChevronRight className="w-3 h-3"/></div>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-white/8 bg-white/[0.02] space-y-3">
                  <h4 className="text-white/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-orange-400"/>Battle Status</h4>
                  {[{label:"Live now",val:liveBattles,color:"text-yellow-300"},{label:"Completed",val:doneBattles,color:"text-green-300"},{label:"Upcoming",val:(battles as any[]).length-liveBattles-doneBattles,color:"text-white/50"}].map(r=>(
                    <div key={r.label} className="flex items-center justify-between"><span className="text-white/40 text-sm">{r.label}</span><span className={`font-bold text-sm ${r.color}`}>{r.val}</span></div>
                  ))}
                </div>
                <div className="p-4 rounded-2xl border border-white/8 bg-white/[0.02] space-y-3">
                  <h4 className="text-white/60 text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Star className="w-3.5 h-3.5 text-yellow-400"/>Highlights</h4>
                  {[{label:"Featured lineup",val:featLineup,color:"text-yellow-300"},{label:"Program highlights",val:hlProg,color:"text-orange-300"},{label:"Featured gallery",val:(gallery as any[]).filter((g:any)=>g.featured).length,color:"text-blue-300"}].map(r=>(
                    <div key={r.label} className="flex items-center justify-between"><span className="text-white/40 text-sm">{r.label}</span><span className={`font-bold text-sm ${r.color}`}>{r.val}</span></div>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 flex items-start gap-3">
                <SquarePen className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <p className="text-orange-300/80 text-xs leading-relaxed"><strong className="text-orange-300">Tip:</strong> Click on any program item, lineup card, battle bracket, or gallery photo above to edit it instantly. Or use the tabs here for bulk management.</p>
              </div>
            </div>
          </TabsContent>

          {/* AI Assistant tab */}
          <TabsContent value="ai">
            <div className="space-y-4">

              {/* Header row */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500/20 to-violet-500/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-orange-400"/>
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-black text-base tracking-tight">Event AI Assistant</h3>
                  <p className="text-white/35 text-xs">Knows breaking culture. Builds, enriches, and manages your event directly.</p>
                </div>
                {aiMessages.length > 0 && (
                  <button onClick={()=>setAiMessages([])} className="text-white/20 text-xs hover:text-white/40 transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
                    New chat
                  </button>
                )}
              </div>

              {/* Health + AI-added control row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Event Health */}
                {aiHealth && (
                  <div className="p-4 rounded-2xl border border-white/8 bg-white/[0.02] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50 text-[10px] font-bold uppercase tracking-wider">Event Health</span>
                      <span className={`text-sm font-black ${aiHealth.score>=80?"text-green-400":aiHealth.score>=50?"text-orange-400":"text-red-400"}`}>{aiHealth.score}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${aiHealth.score>=80?"bg-green-500":aiHealth.score>=50?"bg-orange-400":"bg-red-500"}`} style={{width:`${aiHealth.score}%`}}/>
                    </div>
                    <div className="space-y-1">
                      {aiHealth.issues.slice(0,3).map((issue,i)=>(
                        <button key={i} onClick={()=>sendAiMessage(`Fix this: ${issue}`)} disabled={aiLoading}
                          className="flex items-center gap-2 text-[11px] text-red-300/70 hover:text-red-300 transition-colors w-full text-left">
                          <div className="w-1 h-1 rounded-full bg-red-400 shrink-0"/>
                          {issue}
                        </button>
                      ))}
                      {aiHealth.suggestions.slice(0,2).map((s,i)=>(
                        <button key={i} onClick={()=>sendAiMessage(s)} disabled={aiLoading}
                          className="flex items-center gap-2 text-[11px] text-orange-300/60 hover:text-orange-300 transition-colors w-full text-left">
                          <div className="w-1 h-1 rounded-full bg-orange-400 shrink-0"/>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI-added content control */}
                {aiItems && aiItems.total > 0 && (
                  <div className="p-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-violet-400"/>
                      <span className="text-violet-300 text-[10px] font-bold uppercase tracking-wider">AI-Generated Content</span>
                    </div>
                    <div className="space-y-1.5">
                      {aiItems.judges.length>0&&<div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs">{aiItems.judges.length} judge{aiItems.judges.length!==1?"s":""}</span>
                        <button onClick={()=>clearAiItemsMut.mutate("judges")} disabled={clearAiItemsMut.isPending} className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors">Remove</button>
                      </div>}
                      {aiItems.lineup.length>0&&<div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs">{aiItems.lineup.length} lineup member{aiItems.lineup.length!==1?"s":""}</span>
                        <button onClick={()=>clearAiItemsMut.mutate("lineup")} disabled={clearAiItemsMut.isPending} className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors">Remove</button>
                      </div>}
                      {aiItems.battles.length>0&&<div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs">{aiItems.battles.length} battle{aiItems.battles.length!==1?"s":""}</span>
                        <button onClick={()=>clearAiItemsMut.mutate("battles")} disabled={clearAiItemsMut.isPending} className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors">Remove</button>
                      </div>}
                    </div>
                    <button onClick={()=>clearAiItemsMut.mutate("all")} disabled={clearAiItemsMut.isPending}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold hover:bg-red-500/20 transition-all"
                      data-testid="btn-clear-ai-items">
                      <Trash2 className="w-3 h-3"/>{clearAiItemsMut.isPending?"Clearing…":`Clear all AI content (${aiItems.total})`}
                    </button>
                  </div>
                )}
              </div>

              {/* Chat messages */}
              <div ref={aiChatScrollRef} className="min-h-[200px] max-h-[460px] overflow-y-auto space-y-3 scroll-smooth">
                {aiMessages.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/15 to-violet-500/15 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-6 h-6 text-orange-400"/>
                    </div>
                    <p className="text-white/40 text-sm font-medium mb-1">I know breaking culture.</p>
                    <p className="text-white/20 text-xs">Tell me what to build — I'll act directly on your event.</p>
                  </div>
                )}
                {aiMessages.map((msg, i)=>(
                  <div key={i} className={`flex ${msg.role==="user"?"justify-end":"justify-start"}`}>
                    <div className={`max-w-[88%] ${msg.role==="user"
                      ? "bg-gradient-to-br from-orange-500/20 to-red-500/15 border border-orange-500/25 rounded-2xl rounded-tr-sm text-white"
                      : "bg-white/[0.035] border border-white/8 rounded-2xl rounded-tl-sm text-white/85"
                    } px-4 py-3 text-sm leading-relaxed`}>
                      {msg.role==="assistant" && (
                        <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-white/5">
                          <div className="w-4 h-4 rounded-md bg-orange-500/25 flex items-center justify-center">
                            <Sparkles className="w-2.5 h-2.5 text-orange-400"/>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400/80">AI Assistant</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>
                      {/* Action result cards */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-3 space-y-1.5 pt-2 border-t border-white/5">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Actions taken</p>
                          {msg.actions.map((a,j)=>(
                            <div key={j} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-green-500/8 border border-green-500/15 text-xs text-green-300/80">
                              <CircleCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-400"/>
                              <span>{a.result}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {/* Loading bubble */}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.035] border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-3 h-3 text-orange-400 animate-pulse"/>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400/70">Working on it…</span>
                      </div>
                      <div className="flex gap-1">
                        {[0,1,2].map(k=><div key={k} className="w-1.5 h-1.5 rounded-full bg-orange-400/50 animate-bounce" style={{animationDelay:`${k*0.15}s`}}/>)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick action chips */}
              {aiMessages.length === 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {AI_QUICK_ACTIONS.map((action,i)=>(
                    <button key={i} onClick={()=>sendAiMessage(action.label)} disabled={aiLoading}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 text-white/45 text-xs hover:bg-orange-500/8 hover:border-orange-500/25 hover:text-orange-300 transition-all text-left"
                      data-testid={`btn-ai-quick-${i}`}>
                      <span className="text-base shrink-0">{action.icon}</span>
                      <span className="leading-snug">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Input area */}
              <div className="flex gap-2 pt-1">
                <Input
                  value={aiInput}
                  onChange={e=>setAiInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendAiMessage(); }}}
                  placeholder="e.g. 'Add Victor as a judge' or 'Build a 16-person bracket'"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 flex-1 text-sm"
                  disabled={aiLoading}
                  data-testid="input-ai-message"
                />
                <Button onClick={()=>sendAiMessage()} disabled={!aiInput.trim()||aiLoading}
                  className={`bg-gradient-to-r ${FIRE} text-white border-0 px-4 shrink-0`}
                  data-testid="btn-ai-send">
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Tickets tab */}
          <TabsContent value="tickets">
            <div className="space-y-6">
              {/* View toggle + Reset */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={()=>setTicketView("types")} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${ticketView==="types"?"bg-orange-500/20 text-orange-300 border border-orange-500/30":"bg-white/5 text-white/40 border border-white/8 hover:text-white/60"}`}>
                  <Layers className="w-3.5 h-3.5"/>Ticket Types
                </button>
                <button onClick={()=>setTicketView("purchases")} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${ticketView==="purchases"?"bg-orange-500/20 text-orange-300 border border-orange-500/30":"bg-white/5 text-white/40 border border-white/8 hover:text-white/60"}`}>
                  <ReceiptText className="w-3.5 h-3.5"/>All Claims
                  {allPurchases.length>0&&<span className="ml-1 bg-orange-500/30 text-orange-300 rounded-full px-1.5 py-0 text-[10px]">{allPurchases.length}</span>}
                </button>
                {adminTickets.length > 0 && (
                  <ResetTicketsButton ticketCount={adminTickets.length} purchaseCount={allPurchases.length} />
                )}
              </div>

              {ticketView==="types" && (
                <div className="space-y-5">
                  {/* Create / edit form */}
                  <div className="p-5 rounded-2xl border border-orange-500/20 bg-orange-500/5 space-y-4">
                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                      {editingTicket ? <><Pencil className="w-4 h-4 text-orange-400"/>Edit Ticket Type</> : <><Plus className="w-4 h-4 text-orange-400"/>Create Ticket Type</>}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-white/40 text-xs">Name *</Label>
                        <Input
                          placeholder='e.g. "1v1 Battle Spot" or "General Entry"'
                          value={editingTicket ? editingTicket.name : ticketForm.name}
                          onChange={e=>editingTicket ? setEditingTicket((f:any)=>({...f,name:e.target.value})) : setTicketForm(f=>({...f,name:e.target.value}))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                          data-testid="input-ticket-name"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-white/40 text-xs">Description</Label>
                        <Input
                          placeholder="Short description for participants"
                          value={editingTicket ? editingTicket.description??""  : ticketForm.description}
                          onChange={e=>editingTicket ? setEditingTicket((f:any)=>({...f,description:e.target.value})) : setTicketForm(f=>({...f,description:e.target.value as any}))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/40 text-xs">Type</Label>
                        <Select value={editingTicket ? editingTicket.type : ticketForm.type} onValueChange={v=>editingTicket ? setEditingTicket((f:any)=>({...f,type:v})) : setTicketForm(f=>({...f,type:v}))}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-ticket-type"><SelectValue/></SelectTrigger>
                          <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                            <SelectItem value="guest">🟢 Guest Ticket — normal visitors</SelectItem>
                            <SelectItem value="general">🔵 General Entry — standard access</SelectItem>
                            <SelectItem value="spot">🟠 Battle Spot — competitors</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/40 text-xs">Battle Format (if spot)</Label>
                        <Select value={editingTicket ? editingTicket.battleFormat??""  : ticketForm.battleFormat} onValueChange={v=>editingTicket ? setEditingTicket((f:any)=>({...f,battleFormat:v})) : setTicketForm(f=>({...f,battleFormat:v}))}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Pick format"/></SelectTrigger>
                          <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                            {["1v1","2v2","3v3","crew"].map(f=><SelectItem key={f} value={f}>{f}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/40 text-xs">Price in € (0 = free)</Label>
                        <Input
                          type="number" min={0}
                          placeholder="0"
                          value={editingTicket ? editingTicket.price : ticketForm.price}
                          onChange={e=>editingTicket ? setEditingTicket((f:any)=>({...f,price:Number(e.target.value)})) : setTicketForm(f=>({...f,price:Number(e.target.value)}))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                        />
                        <p className="text-white/25 text-[10px]">Enter whole euros — e.g. 20 = €20. Set 0 for free.</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/40 text-xs">Total Spots (0 = unlimited)</Label>
                        <Input
                          type="number" min={0}
                          placeholder="0"
                          value={editingTicket ? editingTicket.totalSpots : ticketForm.totalSpots}
                          onChange={e=>editingTicket ? setEditingTicket((f:any)=>({...f,totalSpots:Number(e.target.value)})) : setTicketForm(f=>({...f,totalSpots:Number(e.target.value)}))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/40 text-xs">Phase (optional)</Label>
                        <Select value={editingTicket ? (editingTicket.phase ?? "__none__") : ((ticketForm as any).phase ?? "__none__")} onValueChange={v=>{const val = v === "__none__" ? null : v; editingTicket ? setEditingTicket((f:any)=>({...f,phase:val})) : setTicketForm((f:any)=>({...f,phase:val}));}}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="No phase"/></SelectTrigger>
                          <SelectContent className="bg-[#0d1117] border-white/10 text-white">
                            <SelectItem value="__none__">No phase</SelectItem>
                            <SelectItem value="early_bird">🟢 Early Bird</SelectItem>
                            <SelectItem value="regular">🔵 Regular</SelectItem>
                            <SelectItem value="late">🔴 Late</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/40 text-xs">Phase Group key (ties phases together)</Label>
                        <Input
                          placeholder="e.g. guest_adult or battle_1v1"
                          value={editingTicket ? (editingTicket.phaseGroup ?? "") : ((ticketForm as any).phaseGroup ?? "")}
                          onChange={e=>{const v=e.target.value||null; editingTicket ? setEditingTicket((f:any)=>({...f,phaseGroup:v})) : setTicketForm((f:any)=>({...f,phaseGroup:v}));}}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-xs"
                        />
                        <p className="text-white/25 text-[10px]">Same key across all phases of the same group so they auto-progress.</p>
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Switch
                          checked={editingTicket ? editingTicket.isActive : ticketForm.isActive}
                          onCheckedChange={v=>editingTicket ? setEditingTicket((f:any)=>({...f,isActive:v})) : setTicketForm(f=>({...f,isActive:v}))}
                          data-testid="switch-ticket-active"
                        />
                        <Label className="text-white/50 text-xs">Active (visible to users)</Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {editingTicket ? (
                        <>
                          <Button size="sm" onClick={()=>updateTicketMut.mutate({id:editingTicket.id,data:editingTicket})} disabled={updateTicketMut.isPending} className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`} data-testid="button-save-ticket">
                            {updateTicketMut.isPending?"Saving…":"Save Changes"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={()=>setEditingTicket(null)} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={()=>createTicketMut.mutate(ticketForm)} disabled={!ticketForm.name||createTicketMut.isPending} className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`} data-testid="button-create-ticket">
                          {createTicketMut.isPending?"Creating…":"Create Ticket Type"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Ticket type list */}
                  {adminTickets.length===0 ? (
                    <div className="text-center py-10 text-white/25 border border-white/5 rounded-2xl">
                      <Ticket className="w-8 h-8 mx-auto mb-3 opacity-30"/>
                      <p className="text-sm">No ticket types yet. Create one above.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminTickets.map((t:any)=>{
                        const claimed = t.claimedCount ?? 0;
                        const total   = t.totalSpots ?? 0;
                        const pct     = total > 0 ? Math.min(100, Math.round(claimed/total*100)) : 0;
                        const isFull  = total > 0 && claimed >= total;
                        return (
                          <div key={t.id} className={`p-4 rounded-2xl border ${!t.isActive?"border-white/8 bg-white/[0.02] opacity-60":t.type==="spot"?"border-orange-500/20 bg-orange-500/5":t.type==="guest"?"border-emerald-500/20 bg-emerald-500/5":"border-blue-500/20 bg-blue-500/5"}`} data-testid={`card-ticket-${t.id}`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type==="spot"?"bg-orange-500/20":t.type==="guest"?"bg-emerald-500/15":"bg-blue-500/15"}`}>
                                {t.type==="spot" ? <Swords className="w-4 h-4 text-orange-400"/> : t.type==="guest" ? <Users className="w-4 h-4 text-emerald-400"/> : <Ticket className="w-4 h-4 text-blue-400"/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-white font-bold text-sm">{t.name}</span>
                                  <Badge className={`text-[9px] px-2 py-0 ${t.type==="spot"?"bg-orange-500/20 text-orange-300 border-orange-500/30":t.type==="guest"?"bg-emerald-500/15 text-emerald-300 border-emerald-500/30":"bg-blue-500/15 text-blue-300 border-blue-500/30"}`}>
                                    {t.type==="spot"?`${t.battleFormat??""} Spot`:t.type==="guest"?"Guest":"General"}
                                  </Badge>
                                  {!t.isActive&&<Badge className="text-[9px] px-2 py-0 bg-white/5 text-white/30 border-white/10">Inactive</Badge>}
                                  {isFull&&<Badge className="text-[9px] px-2 py-0 bg-red-500/20 text-red-300 border-red-500/30">Full</Badge>}
                                  {t.phase&&<Badge className={`text-[9px] px-2 py-0 ${t.phase==="early_bird"?"bg-green-500/20 text-green-300 border-green-500/30":t.phase==="late"?"bg-red-500/20 text-red-300 border-red-500/30":"bg-blue-500/20 text-blue-300 border-blue-500/30"}`}>{t.phase==="early_bird"?"Early Bird":t.phase==="late"?"Late":"Regular"}</Badge>}
                                  {t.phaseGroup&&<span className="text-[9px] text-white/25">group: {t.phaseGroup}</span>}
                                </div>
                                {t.description&&<p className="text-white/40 text-xs mt-0.5 truncate">{t.description}</p>}
                                <div className="flex items-center gap-4 mt-2">
                                  <span className="text-white/40 text-xs flex items-center gap-1"><CreditCard className="w-3 h-3"/>{t.price===0?"Free":`€${Number(t.price).toFixed(2)}`}</span>
                                  <span className="text-white/40 text-xs flex items-center gap-1"><Users className="w-3 h-3"/>{claimed}{total>0?`/${total}`:" claimed"}</span>
                                </div>
                                {total>0&&(
                                  <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${isFull?"bg-red-500":"bg-orange-500"}`} style={{width:`${pct}%`}}/>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={()=>updateTicketMut.mutate({id:t.id,data:{isActive:!t.isActive}})} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 text-white/30 hover:text-white/60 transition-colors" title={t.isActive?"Deactivate":"Activate"}>
                                  {t.isActive?<Check className="w-3.5 h-3.5 text-green-400"/>:<X className="w-3.5 h-3.5"/>}
                                </button>
                                <button onClick={()=>setEditingTicket({...t})} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 text-white/30 hover:text-orange-400 transition-colors" title="Edit">
                                  <Pencil className="w-3.5 h-3.5"/>
                                </button>
                                <button onClick={()=>{if(confirm("Delete this ticket type and all claims?"))deleteTicketMut.mutate(t.id)}} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors" title="Delete">
                                  <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {ticketView==="purchases" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm">All Claims & Purchases</h3>
                    <span className="text-white/30 text-xs">{allPurchases.length} total</span>
                  </div>
                  {allPurchases.length===0 ? (
                    <div className="text-center py-10 text-white/25 border border-white/5 rounded-2xl">
                      <PackageOpen className="w-8 h-8 mx-auto mb-3 opacity-30"/>
                      <p className="text-sm">No claims yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-white/30 text-xs border-b border-white/10">
                          <th className="text-left py-2 pr-3">#</th>
                          <th className="text-left py-2 pr-3">Name</th>
                          <th className="text-left py-2 pr-3">Ticket</th>
                          <th className="text-left py-2 pr-3">Type</th>
                          <th className="text-left py-2 pr-3">Status</th>
                          <th className="text-left py-2 pr-3">Reg</th>
                          <th className="text-left py-2"/>
                        </tr></thead>
                        <tbody>
                          {allPurchases.map((p:any)=>(
                            <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`row-purchase-${p.id}`}>
                              <td className="py-2 pr-3 text-orange-400 font-mono font-bold text-xs">#{p.spotNumber??p.id}</td>
                              <td className="py-2 pr-3 text-white font-medium">{p.guestName??`User ${p.userId??"-"}`}</td>
                              <td className="py-2 pr-3 text-white/50 text-xs">{p.ticket?.name??"-"}</td>
                              <td className="py-2 pr-3">
                                <Badge className={`text-[9px] px-2 py-0 ${p.ticket?.type==="spot"?"bg-orange-500/20 text-orange-300 border-orange-500/30":p.ticket?.type==="guest"?"bg-emerald-500/15 text-emerald-300 border-emerald-500/30":"bg-blue-500/15 text-blue-300 border-blue-500/30"}`}>
                                  {p.ticket?.type==="spot"?`${p.ticket?.battleFormat??""} spot`:p.ticket?.type==="guest"?"guest":"general"}
                                </Badge>
                              </td>
                              <td className="py-2 pr-3">
                                <select value={p.status} onChange={e=>patchPurchaseMut.mutate({id:p.id,data:{status:e.target.value}})}
                                  className="bg-transparent border border-white/10 rounded px-2 py-0.5 text-xs text-white/70">
                                  {["confirmed","cancelled","waitlist"].map(s=><option key={s} value={s} className="bg-[#0d1117]">{s}</option>)}
                                </select>
                              </td>
                              <td className="py-2 pr-3 text-white/30 text-xs">{p.registrationId?`Reg #${p.registrationId}`:"-"}</td>
                              <td className="py-2">
                                <button onClick={()=>{if(confirm("Remove this claim?"))deletePurchaseMut.mutate(p.id)}} className="text-white/20 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Program tab */}
          <TabsContent value="program">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><h3 className="text-white font-bold">Program Schedule</h3><p className="text-white/40 text-xs">{sorted.length} items</p></div>
                <Button size="sm" onClick={()=>onAdd("program")} className={`bg-gradient-to-r ${FIRE} text-white border-0 gap-1.5 font-bold`}><Plus className="w-3.5 h-3.5"/>Add Item</Button>
              </div>
              <div className="space-y-2">
                {sorted.map((item:any,idx:number)=>(
                  <div key={item.id} className={`flex items-stretch gap-0 rounded-xl border overflow-hidden ${item.isHighlight?"border-orange-500/40 bg-orange-500/8":"border-white/8 bg-white/[0.02]"}`}>
                    <div className="flex flex-col border-r border-white/5">
                      <button onClick={()=>moveItem(item,"up")}   disabled={idx===0}              className="flex-1 px-2 flex items-center justify-center text-white/20 hover:text-white/60 disabled:opacity-20 transition-colors"><ArrowUp className="w-3 h-3"/></button>
                      <button onClick={()=>moveItem(item,"down")} disabled={idx===sorted.length-1} className="flex-1 px-2 flex items-center justify-center text-white/20 hover:text-white/60 disabled:opacity-20 transition-colors"><ArrowDown className="w-3 h-3"/></button>
                    </div>
                    <div className="w-16 shrink-0 flex flex-col items-center justify-center px-2 border-r border-white/5">
                      <span className="text-[10px] font-mono font-bold text-orange-400">{item.time}</span>
                      {item.endTime&&<span className="text-[9px] font-mono text-white/25">{item.endTime}</span>}
                    </div>
                    <div className="flex items-center px-3 border-r border-white/5">{typeIcon(item.type)}</div>
                    <div className="flex-1 py-3 px-3 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">{item.title}</span>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${typeBadge(item.type)}`}>{item.type}</Badge>
                        {item.isHighlight&&<Badge className="text-[9px] px-1.5 py-0 bg-orange-500/20 text-orange-300 border-orange-500/30">★ HIGHLIGHT</Badge>}
                      </div>
                      {item.artist&&<p className="text-white/40 text-xs mt-0.5">{item.artist}</p>}
                      {item.stage&&<p className="text-white/25 text-[10px]">{item.stage}</p>}
                    </div>
                    <div className="flex items-center gap-1 px-3">
                      <button onClick={()=>patchProg.mutate({id:item.id,data:{isHighlight:!item.isHighlight}})} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${item.isHighlight?"bg-orange-500/30 text-orange-300":"text-white/20 hover:text-orange-400 hover:bg-orange-500/10"}`}><Star className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>openProgram(item)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                ))}
                {sorted.length===0&&<p className="text-white/25 text-sm text-center py-8">No program items — add your first.</p>}
              </div>
            </div>
          </TabsContent>

          {/* Lineup tab */}
          <TabsContent value="lineup">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><h3 className="text-white font-bold">Lineup Members</h3><p className="text-white/40 text-xs">{(lineup as any[]).length} members</p></div>
                <Button size="sm" onClick={()=>onAdd("lineup")} className={`bg-gradient-to-r ${FIRE} text-white border-0 gap-1.5 font-bold`}><Plus className="w-3.5 h-3.5"/>Add Member</Button>
              </div>
              <div className="space-y-2">
                {[...(lineup as any[])].sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)).map((m:any)=>(
                  <div key={m.id} className={`flex items-center gap-3 p-3 rounded-xl border ${m.featured?"border-yellow-500/30 bg-yellow-500/5":m.addedByAi?"border-violet-500/20 bg-violet-500/[0.03]":"border-white/8 bg-white/[0.02]"}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 overflow-hidden ${categoryColor(m.category)}`}>
                      {m.imageUrl?<img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover"/>:initials(m.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-sm font-semibold">{m.name}</span>
                        {m.featured&&<Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/20 text-yellow-300 border-yellow-500/30">★ FEATURED</Badge>}
                        {m.addedByAi&&<Badge className="text-[8px] px-1.5 py-0 bg-violet-500/20 text-violet-300 border-violet-500/30 gap-0.5"><Sparkles className="w-2 h-2"/>AI</Badge>}
                      </div>
                      <p className="text-white/40 text-xs">{m.role} · {m.category}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={()=>patchLine.mutate({id:m.id,data:{featured:!m.featured}})} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${m.featured?"bg-yellow-500/25 text-yellow-300":"text-white/20 hover:text-yellow-400 hover:bg-yellow-500/10"}`}><Star className="w-3.5 h-3.5"/></button>
                      <button onClick={()=>openLineup(m)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                    </div>
                  </div>
                ))}
                {(lineup as any[]).length===0&&<p className="text-white/25 text-sm text-center py-8">No lineup members yet.</p>}
              </div>
            </div>
          </TabsContent>

          {/* Battles tab */}
          <TabsContent value="battles">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><h3 className="text-white font-bold">Battle Brackets</h3><p className="text-white/40 text-xs">{(battles as any[]).length} battles</p></div>
                <Button size="sm" onClick={()=>onAdd("battles")} className={`bg-gradient-to-r ${FIRE} text-white border-0 gap-1.5 font-bold`}><Plus className="w-3.5 h-3.5"/>Add Battle</Button>
              </div>
              {Object.entries(battleGroups).map(([round,bts])=>(
                <div key={round}>
                  <h4 className="text-xs font-bold tracking-widest uppercase text-orange-400 mb-2">{round}</h4>
                  <div className="space-y-2">
                    {(bts as any[]).map((b:any)=>(
                      <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border ${b.status==="completed"?"border-green-500/25 bg-green-500/5":b.status==="live"?"border-yellow-500/30 bg-yellow-500/5":b.addedByAi?"border-violet-500/20 bg-violet-500/[0.03]":"border-white/8 bg-white/[0.02]"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                            <span className="text-white/80">{b.participant1??"TBA"}</span><span className="text-white/25 font-bold">VS</span><span className="text-white/80">{b.participant2??"TBA"}</span>
                            {b.addedByAi&&<Badge className="text-[7px] px-1 py-0 bg-violet-500/20 text-violet-300 border-violet-500/30 gap-0.5 font-bold"><Sparkles className="w-2 h-2"/>AI</Badge>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                            {b.winner&&<span className="text-green-300 font-semibold">🏆 {b.winner}</span>}
                            {b.scheduledTime&&<span className="text-white/25 font-mono">{b.scheduledTime}</span>}
                          </div>
                        </div>
                        <button onClick={()=>patchBat.mutate({id:b.id,data:{status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(b.status)+1)%3]}})} className={`text-[9px] px-2 py-1 rounded-lg border font-bold transition-colors ${statusColor(b.status)}`}>{b.status}</button>
                        <button onClick={()=>openBattle(b)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(battles as any[]).length===0&&<p className="text-white/25 text-sm text-center py-8">No battles yet.</p>}
            </div>
          </TabsContent>

          {/* Settings tab — Event Control Center */}
          <TabsContent value="settings">
            <div className="space-y-5 max-w-2xl">

              {/* ── Event Identity ── */}
              <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-950/20 to-transparent overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400"/>
                    <span className="text-white font-bold text-sm">Event Identity</span>
                  </div>
                  {!eventDraft ? (
                    <button onClick={()=>setEventDraft({ title:bttsSettings.eventTitle, year:bttsSettings.eventYear, date:bttsSettings.eventDate, venue:bttsSettings.eventVenue, city:bttsSettings.eventCity, ticketUrl:bttsSettings.ticketUrl })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-bold hover:bg-orange-500/25 transition-all">
                      <Pencil className="w-3 h-3"/>Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={()=>setEventDraft(null)} className="px-3 py-1.5 rounded-xl border border-white/10 text-white/40 text-xs font-bold hover:bg-white/5 transition-all">Cancel</button>
                      <button onClick={()=>{
                        saveSettingsMut.mutate({ eventTitle:eventDraft.title, eventYear:eventDraft.year, eventDate:eventDraft.date, eventVenue:eventDraft.venue, eventCity:eventDraft.city, ticketUrl:eventDraft.ticketUrl });
                        setEventDraft(null);
                      }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-all">
                        <Check className="w-3 h-3"/>Save
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  {!eventDraft ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label:"Event Title",  val:bttsSettings.eventTitle || "—" },
                        { label:"Year",         val:bttsSettings.eventYear  || "—" },
                        { label:"Date",         val:bttsSettings.eventDate  || "Not set" },
                        { label:"Venue",        val:bttsSettings.eventVenue || "Not set" },
                        { label:"City / Region",val:bttsSettings.eventCity  || "—" },
                        { label:"Ticket URL",   val:bttsSettings.ticketUrl  ? "Set ✓" : "Not set" },
                      ].map(f=>(
                        <div key={f.label}>
                          <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-0.5">{f.label}</p>
                          <p className="text-white/80 text-sm font-semibold truncate">{f.val}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label:"Event Title",   key:"title",     placeholder:"Back to the Street" },
                        { label:"Event Year",    key:"year",      placeholder:"2026" },
                        { label:"Event Date",    key:"date",      placeholder:"e.g. 15 November 2026" },
                        { label:"Venue Name",    key:"venue",     placeholder:"e.g. Cultureel Centrum" },
                        { label:"City / Region", key:"city",      placeholder:"e.g. Amsterdam" },
                        { label:"Ticket URL",    key:"ticketUrl", placeholder:"https://ticketmaster.com/…" },
                      ].map(f=>(
                        <div key={f.key}>
                          <Label className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-1 block">{f.label}</Label>
                          <Input
                            value={(eventDraft as any)[f.key]}
                            onChange={e=>setEventDraft(d=>d?({...d,[f.key]:e.target.value}):d)}
                            placeholder={f.placeholder}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-sm h-9"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Battle Control ── */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
                  <Swords className="w-4 h-4 text-orange-400"/>
                  <span className="text-white font-bold text-sm">Battle Control</span>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { key:"registrationOpen", label:"Registration Open",         desc:"Allow the public to submit battle registrations.", val:bttsSettings.registrationOpen, color:"from-orange-500 to-red-500" },
                    { key:"bracketPublic",    label:"Bracket Publicly Visible",   desc:"Show the live bracket to all visitors.",           val:bttsSettings.bracketPublic,    color:"from-orange-500 to-red-500" },
                  ].map(s=>(
                    <div key={s.key} className="flex items-center justify-between p-3 rounded-xl border border-white/6 bg-white/[0.02]">
                      <div>
                        <p className="text-white text-sm font-semibold">{s.label}</p>
                        <p className="text-white/35 text-xs mt-0.5">{s.desc}</p>
                      </div>
                      <button onClick={()=>saveSettingsMut.mutate({[s.key]:!s.val})}
                        className={`relative w-12 h-6 rounded-full flex-shrink-0 transition-colors duration-300 ${s.val?`bg-gradient-to-r ${s.color}`:"bg-white/10"}`}>
                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${s.val?"translate-x-6":"translate-x-0"}`}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Battle Format + Judge Panel ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Swords className="w-3.5 h-3.5 text-orange-400"/>
                    <span className="text-white text-sm font-bold">Active Format</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["1v1","2v2","3v3","crew","7smoke"].map(f=>(
                      <button key={f} onClick={()=>saveSettingsMut.mutate({activeFormat:f})}
                        className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all ${bttsSettings.activeFormat===f?"bg-orange-500/20 border-orange-500/40 text-orange-300":"border-white/10 text-white/40 hover:border-white/20"}`}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-3.5 h-3.5 text-orange-400"/>
                    <span className="text-white text-sm font-bold">Judge Panel Size</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[3,5,7,9].map(n=>(
                      <button key={n} onClick={()=>saveSettingsMut.mutate({judgeCount:n})}
                        className={`w-10 h-10 rounded-xl text-sm font-bold border transition-all ${bttsSettings.judgeCount===n?"bg-orange-500/30 border-orange-500/60 text-orange-300":"border-white/10 text-white/40 hover:border-white/20"}`}>{n}</button>
                    ))}
                    <span className="text-white/25 text-xs ml-1">judges</span>
                  </div>
                </div>
              </div>

              {/* ── Ticket Info banner ── */}
              {bttsSettings.ticketUrl && (
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-green-500/20 bg-green-500/5">
                  <Check className="w-4 h-4 text-green-400 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-sm font-semibold">Ticket link is set</p>
                    <p className="text-white/30 text-xs truncate">{bttsSettings.ticketUrl}</p>
                  </div>
                  <a href={bttsSettings.ticketUrl} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 transition-colors"><ExternalLink className="w-4 h-4"/></a>
                </div>
              )}

              {/* ── CTA Section Editor ── */}
              <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-950/20 to-transparent overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-orange-400" />
                    <h3 className="text-white font-semibold text-sm">CTA Section</h3>
                    <span className="text-[10px] text-white/30">shown at the bottom of the page</span>
                  </div>
                  {!ctaDraft && (
                    <button
                      onClick={() => setCtaDraft({ badge: bttsSettings.ctaBadge, title: bttsSettings.ctaTitle, desc: bttsSettings.ctaDesc })}
                      className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 transition-all"
                    >Edit</button>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  {ctaDraft ? (
                    <>
                      <div>
                        <label className="block text-white/50 text-[11px] font-semibold mb-1.5 uppercase tracking-wide">Badge Label <span className="normal-case text-white/25">(e.g. "Free Entry", "Paid Event")</span></label>
                        <input
                          value={ctaDraft.badge}
                          onChange={e => setCtaDraft(d => d && ({...d, badge: e.target.value}))}
                          placeholder="Free Entry"
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50"
                          data-testid="input-cta-badge"
                        />
                        <p className="text-[10px] text-white/25 mt-1">This badge appears in the hero info pills AND the CTA section</p>
                      </div>
                      <div>
                        <label className="block text-white/50 text-[11px] font-semibold mb-1.5 uppercase tracking-wide">CTA Headline</label>
                        <input
                          value={ctaDraft.title}
                          onChange={e => setCtaDraft(d => d && ({...d, title: e.target.value}))}
                          placeholder="Join the Movement"
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50"
                          data-testid="input-cta-title"
                        />
                      </div>
                      <div>
                        <label className="block text-white/50 text-[11px] font-semibold mb-1.5 uppercase tracking-wide">CTA Description</label>
                        <textarea
                          value={ctaDraft.desc}
                          onChange={e => setCtaDraft(d => d && ({...d, desc: e.target.value}))}
                          placeholder="Back to the Street is free. No tickets, no barriers — just show up and feel the energy."
                          rows={3}
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50 resize-none"
                          data-testid="input-cta-desc"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            saveSettingsMut.mutate({ ctaBadge: ctaDraft.badge, ctaTitle: ctaDraft.title, ctaDesc: ctaDraft.desc });
                            setCtaDraft(null);
                          }}
                          disabled={saveSettingsMut.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-all disabled:opacity-50"
                          data-testid="button-save-cta"
                        >
                          <Check className="w-3.5 h-3.5" />{saveSettingsMut.isPending ? "Saving…" : "Save CTA"}
                        </button>
                        <button onClick={() => setCtaDraft(null)} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-xs transition-all">Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-0.5 rounded-full border border-orange-500/40 bg-orange-500/10 text-orange-300 text-[11px] font-bold uppercase tracking-wider">{bttsSettings.ctaBadge || "Free Entry"}</span>
                        <span className="text-white/25 text-[10px]">badge · shown in hero & CTA</span>
                      </div>
                      <p className="text-white/80 text-sm font-semibold">{bttsSettings.ctaTitle || "Join the Movement"}</p>
                      <p className="text-white/40 text-xs leading-relaxed">{bttsSettings.ctaDesc || "Back to the Street is free…"}</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </TabsContent>

          {/* Registrations tab */}
          <TabsContent value="registrations">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-white font-bold">Battle Registrations</h3>
                  <p className="text-white/40 text-xs">{(registrations as any[]).length} submitted</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Admin test button */}
                  <button
                    onClick={()=>testRegMut.mutate({guestName:"Test Dancer",crewName:"Test Crew",battleType:"1v1",category:"Breaking",notes:"[Admin test registration — delete after testing]"})}
                    disabled={testRegMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/40 bg-violet-500/10 text-violet-300 text-xs font-bold hover:bg-violet-500/20 hover:border-violet-500/60 transition-all disabled:opacity-50"
                    data-testid="button-admin-test-register-tab"
                  >
                    <Zap className="w-3 h-3"/>{testRegMut.isPending?"Submitting…":"Test Register"}
                  </button>
                  <span className="text-white/30 text-xs">Registration {bttsSettings.registrationOpen?"open":"closed"}</span>
                  <button onClick={()=>saveSettingsMut.mutate({registrationOpen:!bttsSettings.registrationOpen})}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${bttsSettings.registrationOpen?"bg-gradient-to-r from-orange-500 to-red-500":"bg-white/10"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${bttsSettings.registrationOpen?"translate-x-5":"translate-x-0"}`}/>
                  </button>
                </div>
              </div>
              {(registrations as any[]).length===0 ? (
                <div className="text-center py-12 text-white/25 border border-white/5 rounded-2xl">
                  <ClipboardList className="w-8 h-8 mx-auto mb-3 opacity-30"/>
                  <p className="text-sm">No registrations yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-white/30 text-xs border-b border-white/10">
                      <th className="text-left py-2 pr-4">Name</th>
                      <th className="text-left py-2 pr-4">Crew</th>
                      <th className="text-left py-2 pr-4">Type</th>
                      <th className="text-left py-2 pr-4">Category</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Paid</th>
                      <th className="text-left py-2"/>
                    </tr></thead>
                    <tbody>
                      {(registrations as any[]).map((r:any)=>(
                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 text-white font-medium">{r.guestName??`User ${r.userId}`}</td>
                          <td className="py-2 pr-4 text-white/50">{r.crewName??"-"}</td>
                          <td className="py-2 pr-4 text-white/50">{r.battleType}</td>
                          <td className="py-2 pr-4 text-white/50">{r.category}</td>
                          <td className="py-2 pr-4">
                            <select
                              value={r.status}
                              onChange={e => {
                                const newStatus = e.target.value;
                                patchRegMut.mutate({id:r.id, data:{status:newStatus}}, {
                                  onSuccess: () => {
                                    if (newStatus === "confirmed") {
                                      // Auto-place into bracket when confirmed
                                      bracketGenMut.mutate({battleType: r.battleType ?? "1v1", category: r.category ?? "Breaking"});
                                    }
                                  }
                                });
                              }}
                              className="bg-transparent border border-white/10 rounded px-2 py-0.5 text-xs text-white/70">
                              {["pending","confirmed","rejected","waitlist"].map(s=><option key={s} value={s} className="bg-[#0d1117]">{s}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-4">
                            <button onClick={()=>patchRegMut.mutate({id:r.id,data:{paid:!r.paid}})}
                              className={`text-xs font-bold px-2 py-0.5 rounded border ${r.paid?"text-green-300 border-green-500/30 bg-green-500/10":"text-white/30 border-white/10"}`}>
                              {r.paid?"Paid":"Unpaid"}
                            </button>
                          </td>
                          <td className="py-2">
                            <button onClick={()=>delRegMut.mutate(r.id)} className="text-red-400/50 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5"/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Judges tab */}
          <TabsContent value="judges">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold">Judging Panel</h3>
                <span className="text-white/35 text-xs">{(judges as any[]).length} judge{(judges as any[]).length!==1?"s":""} assigned</span>
              </div>

              {/* Add judge form */}
              <div className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 space-y-3">
                <p className="text-orange-300/80 text-xs font-bold uppercase tracking-widest">Add Judge</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-white/40 text-xs">Name *</Label>
                    <Input placeholder="Judge name" value={judgeForm.guestName} onChange={e=>setJudgeForm(f=>({...f,guestName:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-sm"/>
                  </div>
                  <div className="space-y-1"><Label className="text-white/40 text-xs">Specialty</Label>
                    <Input placeholder="e.g. Breaking, Popping" value={judgeForm.specialty} onChange={e=>setJudgeForm(f=>({...f,specialty:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-sm"/>
                  </div>
                  <div className="space-y-1"><Label className="text-white/40 text-xs">Judge #</Label>
                    <Input type="number" min={1} value={judgeForm.judgeNumber} onChange={e=>setJudgeForm(f=>({...f,judgeNumber:Number(e.target.value)}))} className="bg-white/5 border-white/10 text-white text-sm"/>
                  </div>
                  <div className="space-y-1"><Label className="text-white/40 text-xs">Photo URL (optional)</Label>
                    <Input placeholder="https://…" value={judgeForm.avatarUrl} onChange={e=>setJudgeForm(f=>({...f,avatarUrl:e.target.value}))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-sm"/>
                  </div>
                </div>
                <Button size="sm" onClick={()=>addJudgeMut.mutate(judgeForm)} disabled={!judgeForm.guestName||addJudgeMut.isPending} className={`bg-gradient-to-r ${FIRE} text-white border-0 font-bold`}>
                  <Plus className="w-3.5 h-3.5 mr-1.5"/>{addJudgeMut.isPending?"Adding…":"Add Judge"}
                </Button>
              </div>

              {/* Existing judges list */}
              {(judges as any[]).length===0 ? (
                <p className="text-white/25 text-sm text-center py-8">No judges assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {(judges as any[]).map((j:any)=>(
                    <div key={j.id} className={`flex items-center gap-4 p-3 rounded-xl border ${j.addedByAi?"border-violet-500/20 bg-violet-500/[0.03]":"border-white/8 bg-white/[0.02]"}`}>
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                        {j.avatarUrl?<img src={j.avatarUrl} alt="" className="w-full h-full object-cover"/>:<Trophy className="w-4 h-4 text-orange-400/60"/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-semibold">{j.guestName??`Judge ${j.judgeNumber}`}</p>
                          {j.addedByAi&&<Badge className="text-[8px] px-1.5 py-0 bg-violet-500/20 text-violet-300 border-violet-500/30 gap-0.5"><Sparkles className="w-2 h-2"/>AI</Badge>}
                        </div>
                        <p className="text-white/40 text-xs">{j.specialty||"Breaking"} · Judge #{j.judgeNumber}</p>
                        {j.bio&&<BioExpandable bio={j.bio} lines={1} className="text-white/25 text-[11px] mt-0.5"/>}
                      </div>
                      <button onClick={()=>delJudgeMut.mutate(j.id)} className="text-red-400/40 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Gallery tab */}
          <TabsContent value="gallery">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><h3 className="text-white font-bold">Gallery Media</h3><p className="text-white/40 text-xs">{(gallery as any[]).length} items</p></div>
                <Button size="sm" onClick={()=>onAdd("gallery")} className={`bg-gradient-to-r ${FIRE} text-white border-0 gap-1.5 font-bold`}><Plus className="w-3.5 h-3.5"/>Add Media</Button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {(gallery as any[]).map((item:any)=>(
                  <div key={item.id} className="relative group aspect-square rounded-xl border border-white/10 overflow-hidden bg-white/5 cursor-pointer" onClick={()=>openGallery(item)}>
                    {item.mediaType==="video"?<div className="w-full h-full flex items-center justify-center"><Play className="w-7 h-7 text-white/30"/></div>:<img src={item.url} alt={item.caption??""} className="w-full h-full object-cover"/>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><Pencil className="w-4 h-4 text-white"/></div>
                  </div>
                ))}
              </div>
              {(gallery as any[]).length===0&&<p className="text-white/25 text-sm text-center py-8">No gallery items yet.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

export function FloatingAdminBar({ onAdd }: { onAdd:(type:string)=>void }) {
  const { data: program=[] } = useQuery<any[]>({ queryKey:["/api/btts/program"] });
  const { data: lineup=[]  } = useQuery<any[]>({ queryKey:["/api/btts/lineup"]  });
  const { data: battles=[] } = useQuery<any[]>({ queryKey:["/api/btts/battles"] });
  const { data: gallery=[] } = useQuery<any[]>({ queryKey:["/api/btts/gallery"] });
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2" style={{ pointerEvents:"none" }}>
      <div className="flex items-center gap-2" style={{ pointerEvents:"auto" }}>
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#0d1117]/95 border border-orange-500/30 backdrop-blur-xl shadow-[0_8px_32px_#f9731630]">
            {/* Quick-add buttons */}
            {[
              { label:"+ Program", type:"program", count:(program as any[]).length },
              { label:"+ Lineup",  type:"lineup",  count:(lineup  as any[]).length },
              { label:"+ Battle",  type:"battles", count:(battles as any[]).length },
              { label:"+ Gallery", type:"gallery", count:(gallery as any[]).length },
            ].map(a=>(
              <button key={a.type} onClick={()=>onAdd(a.type)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/30 text-white/60 hover:text-orange-300 text-xs font-semibold transition-all">
                <span>{a.label}</span>
                <span className="text-[9px] text-white/30 font-mono">{a.count}</span>
              </button>
            ))}
            <div className="h-4 w-px bg-white/10 mx-1" />
            <button onClick={()=>document.getElementById("btts-admin")?.scrollIntoView({behavior:"smooth"})}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-bold transition-all">
              <Shield className="w-3 h-3"/>Admin Panel
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <button onClick={()=>setCollapsed(c=>!c)}
          className="w-9 h-9 rounded-xl bg-[#0d1117]/95 border border-orange-500/30 backdrop-blur-xl shadow-lg flex items-center justify-center text-orange-400 hover:bg-orange-500/15 transition-all"
          title={collapsed?"Expand admin bar":"Collapse admin bar"}>
          {collapsed ? <SquarePen className="w-4 h-4 btts-flame-icon"/> : <X className="w-3.5 h-3.5"/>}
        </button>
      </div>

      {!collapsed && (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#0d1117]/80 border border-orange-500/20 backdrop-blur-sm" style={{ pointerEvents:"none" }}>
          <SquarePen className="w-3 h-3 text-orange-400/70" />
          <span className="text-[10px] text-orange-400/70 font-semibold">Click anything to edit</span>
        </div>
      )}
    </div>
  );
}
