import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Save, Sparkles, FileText, Briefcase, Layout, Brain, Plus, Trash2,
  Wand2, Target, Star, Eye, EyeOff, Copy, Download, ExternalLink, Lightbulb, Zap, Rocket,
  Mic, MicOff, Volume2, TrendingUp, Award, ChevronDown, ChevronUp, Gauge, PenLine, Maximize2,
  MessageSquare, BookOpen, Mail, User, ScanSearch, DollarSign, GraduationCap, FileCheck,
  ClipboardList, CheckCircle2, Circle, Pencil, RotateCcw, Shield, BarChart2, Check, XCircle,
  ArrowRight, Users, BriefcaseBusiness,
} from "lucide-react";
import { cn } from "@/lib/utils";

const arr = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);

export default function CareerSuite() {
  const [tab, setTab] = useState("identity");
  return (
    <div className="container max-w-6xl mx-auto p-4 space-y-4" data-testid="page-career">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Briefcase className="w-6 h-6 text-violet-400" /> Career Suite</h1>
          <p className="text-sm text-muted-foreground">Your AI-powered identity, CV, portfolio & job-fit engine — all driven by Claude.</p>
        </div>
        <Badge variant="outline" className="text-[10px]"><Sparkles className="w-3 h-3 mr-1 text-violet-400" />Powered by Claude</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto w-full max-w-4xl bg-transparent p-0">
          {[
            { v: "identity", icon: Brain, label: "Identity" },
            { v: "cvs", icon: FileText, label: "CVs" },
            { v: "portfolio", icon: Layout, label: "Portfolio" },
            { v: "match", icon: Target, label: "Job Match" },
            { v: "tools", icon: Sparkles, label: "Power Tools" },
            { v: "insights", icon: Lightbulb, label: "Insights" },
          ].map(({ v, icon: Icon, label }) => (
            <TabsTrigger key={v} value={v} className="flex-shrink-0 data-[state=active]:bg-violet-600 data-[state=active]:text-white rounded-lg border border-border px-3 py-1.5 text-xs font-medium">
              <Icon className="w-3.5 h-3.5 mr-1" />{label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="identity" className="mt-4"><IdentityTab /></TabsContent>
        <TabsContent value="cvs" className="mt-4"><CvsTab /></TabsContent>
        <TabsContent value="portfolio" className="mt-4"><PortfolioTab /></TabsContent>
        <TabsContent value="match" className="mt-4"><MatchTab /></TabsContent>
        <TabsContent value="tools" className="mt-4"><ToolsTab /></TabsContent>
        <TabsContent value="insights" className="mt-4"><InsightsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ════════════════════════════ IDENTITY ════════════════════════════
function IdentityTab() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/career/profile"] });
  const profile = data;
  const [draft, setDraft] = useState<any>(null);
  useEffect(() => { if (data) setDraft(JSON.parse(JSON.stringify(data))); }, [data]);

  const save = useMutation({
    mutationFn: (b: any) => apiRequest("/api/admin/career/profile", "PATCH", b).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/career/profile"] }); toast({ title: "Saved" }); },
  });
  const enrich = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/profile/enrich", "POST").then(r => r.json()),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/profile"] });
      toast({ title: "Claude enriched your profile",
        description: `Hidden assets: ${(d.hiddenAssets || []).slice(0, 2).join("; ") || "—"}` });
    },
  });

  if (isLoading || !draft) return <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  const u = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));

  const ventures = draft.ventures || [];
  const experience = draft.experience || [];
  const education = draft.education || [];
  const skills = draft.skills || [];
  const languages = draft.languages || [];
  const achievements = draft.achievements || [];

  return (
    <div className="space-y-4">
      <ImportRealCvCard />
      <MegaStartCard />
      <MagicStartCard onDone={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/career/profile"] })} />
      <BrainFeedCard />

      <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
        <CardContent className="pt-4 flex items-center justify-between gap-4">
          <div className="text-xs">
            <div className="font-semibold flex items-center gap-1"><Wand2 className="w-3.5 h-3.5 text-violet-400" /> Save & enrich</div>
            <p className="text-muted-foreground">Save your edits, then hit Enrich — Claude reads everything and writes your positioning, strengths & target roles.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => save.mutate(draft)} disabled={save.isPending} data-testid="btn-save-profile">
              {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Save
            </Button>
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={() => enrich.mutate()} disabled={enrich.isPending} data-testid="btn-enrich">
              {enrich.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />} Enrich with Claude
            </Button>
          </div>
        </CardContent>
      </Card>

      <PhotoUploaderCard profile={profile} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Basics</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Full name</Label><Input value={draft.fullName || ""} onChange={e => u("fullName", e.target.value)} /></div>
          <div><Label className="text-xs">Headline</Label><Input value={draft.headline || ""} onChange={e => u("headline", e.target.value)} placeholder="e.g. Founder of Stichting Coffee & Dance · Marketing & AI builder" /></div>
          <div><Label className="text-xs">Location</Label><Input value={draft.location || ""} onChange={e => u("location", e.target.value)} /></div>
          <div><Label className="text-xs">Email</Label><Input value={draft.email || ""} onChange={e => u("email", e.target.value)} /></div>
          <div><Label className="text-xs">Phone</Label><Input value={draft.phone || ""} onChange={e => u("phone", e.target.value)} /></div>
          <div><Label className="text-xs">Website</Label><Input value={draft.website || ""} onChange={e => u("website", e.target.value)} /></div>
          <div className="col-span-2"><Label className="text-xs">Socials (LinkedIn, Instagram, TikTok…)</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input placeholder="LinkedIn URL" value={draft.socials?.linkedin || ""} onChange={e => u("socials", { ...(draft.socials||{}), linkedin: e.target.value })} />
              <Input placeholder="Instagram handle" value={draft.socials?.instagram || ""} onChange={e => u("socials", { ...(draft.socials||{}), instagram: e.target.value })} />
              <Input placeholder="TikTok handle" value={draft.socials?.tiktok || ""} onChange={e => u("socials", { ...(draft.socials||{}), tiktok: e.target.value })} />
              <Input placeholder="Other (e.g. GitHub)" value={draft.socials?.other || ""} onChange={e => u("socials", { ...(draft.socials||{}), other: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Your story (Claude reads this carefully)</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={6} value={draft.story || ""} onChange={e => u("story", e.target.value)} data-testid="textarea-story"
            placeholder="Tell your story — origin, turning points, mission. Mention Stichting Coffee & Dance, Dance Healthy, Back to the Street, your work in dance/sports/culture, AI, marketing. Don't worry about polish — Claude can refine it." />
          <VoiceInputButton fieldHint="story"
            onAppend={text => u("story", (draft.story || "").trimEnd() + (draft.story ? "\n\n" : "") + text)} />
        </CardContent>
      </Card>

      <RepeaterCard title="Ventures & pillars" items={ventures} onChange={(v: any) => u("ventures", v)} testId="ventures"
        fields={[{ k: "name", label: "Name" }, { k: "role", label: "Role" }, { k: "period", label: "Period" }]}
        textareas={[{ k: "summary", label: "Summary" }, { k: "impact", label: "Impact / outcomes" }]} />

      <RepeaterCard title="Experience" items={experience} onChange={(v: any) => u("experience", v)} testId="experience"
        fields={[{ k: "title", label: "Title" }, { k: "org", label: "Organization" }, { k: "period", label: "Period" }]}
        textareas={[{ k: "summary", label: "Summary" }]}
        listFields={[{ k: "achievements", label: "Achievements (one per line)" }]} />

      <RepeaterCard title="Education" items={education} onChange={(v: any) => u("education", v)} testId="education"
        fields={[{ k: "degree", label: "Degree" }, { k: "institution", label: "Institution" }, { k: "period", label: "Period" }]} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Skills, languages, achievements</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Skills (comma-sep)</Label>
            <Input value={skills.map((s: any) => s.name).join(", ")}
              onChange={e => u("skills", arr(e.target.value).map(name => ({ name })))} />
          </div>
          <div><Label className="text-xs">Languages (e.g. Dutch:Native, English:C2)</Label>
            <Input value={languages.map((l: any) => `${l.name}:${l.level || ""}`).join(", ")}
              onChange={e => u("languages", arr(e.target.value).map(s => { const [name, level] = s.split(":").map(x=>x.trim()); return { name, level }; }))} />
          </div>
          <div><Label className="text-xs">Achievements (one per line)</Label>
            <Textarea rows={3} value={achievements.map((a: any) => typeof a === "string" ? a : a.title).join("\n")}
              onChange={e => u("achievements", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Raw brain-dump notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={6} value={draft.rawNotes || ""} onChange={e => u("rawNotes", e.target.value)}
            placeholder="Dump anything: random wins, weird talents, things that didn't fit elsewhere. Claude will mine this for hidden gems on Enrich." />
          <VoiceInputButton fieldHint="notes"
            onAppend={text => u("rawNotes", (draft.rawNotes || "").trimEnd() + (draft.rawNotes ? "\n\n" : "") + text)} />
        </CardContent>
      </Card>

      {draft.positioning && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" /> Claude's positioning of you</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="italic">"{draft.positioning}"</p>
            <div><div className="text-xs font-semibold text-muted-foreground mb-1">Strengths</div>
              <div className="flex flex-wrap gap-1">{(draft.strengths || []).map((s: string) => <Badge key={s} className="bg-emerald-500/20 text-emerald-300">{s}</Badge>)}</div>
            </div>
            <div><div className="text-xs font-semibold text-muted-foreground mb-1">Unique value props</div>
              <ul className="list-disc pl-5 space-y-0.5">{(draft.uniqueValueProps || []).map((s: string) => <li key={s}>{s}</li>)}</ul>
            </div>
            <div><div className="text-xs font-semibold text-muted-foreground mb-1">Target roles</div>
              <div className="flex flex-wrap gap-1">{(draft.targetRoles || []).map((s: string) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">{draft.publicEnabled ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4" />} Public portfolio link</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="col-span-2"><Label className="text-xs">Public slug (yourapp.com/p/&lt;slug&gt;)</Label>
              <Input value={draft.publicSlug || ""} onChange={e => u("publicSlug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="moestafa" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!draft.publicEnabled} onChange={e => u("publicEnabled", e.target.checked)} />
              Public on
            </label>
          </div>
          {draft.publicEnabled && draft.publicSlug && (
            <a href={`/p/${draft.publicSlug}`} target="_blank" rel="noreferrer" className="text-xs text-violet-400 underline flex items-center gap-1">
              View public portfolio <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </CardContent>
      </Card>

      <QuickCvCard />
      <CvScorerCard />
    </div>
  );
}

const RIKI_BRIEF = `I want you to build a complete professional profile about me, including a CV, portfolio, and personal story.

Who I am: My name is Riki Almouti. I am a creative entrepreneur, event organizer, and AI-driven builder, with a strong background in dance, culture, sports, and community development. I came to the Netherlands around 10 years ago and built everything from scratch. I started as a professional dancer, but after serious injuries and multiple surgeries I shifted into building, organizing and creating impact through culture and community.

What I built: I am the founder and chairman of Stichting Coffee & Dance. Through this foundation I organize large cultural events like Back to the Street, work with municipalities and communities, create spaces for youth and adults to develop physically/mentally/socially, and connect dance, art and culture into real-world impact. I also run Dance Healthy, combining movement, events and organization. I organize battles, workshops, community events, creative sessions, cultural programs.

AI & tech: I'm an AI specialist and builder. I work with ChatGPT, Claude, video AI tools, automation tools, content generation tools — for content creation, automation, workflows, app building, business optimization. I built my own app: Urban Culture Hub — map with 30k+ spots, AI Finder, events system, community feed, booking system, ticket system, admin dashboard, AI integrations across the platform.

Strengths: creative thinking, building systems from zero, connecting culture/tech/community, leadership and organization, event production, AI integration and automation, problem-solving, adapting and evolving. I combine creativity + technology + real-world execution.

What makes me different: I don't just work — I build. I don't just create — I connect systems. I mix culture, tech and impact. I turned injury into opportunity. I built platforms, events and communities from nothing.

Position me for: creative roles, tech roles, AI roles, event/cultural leadership roles. Make it modern, premium, structured, strong, impressive for recruiters.`;

function ImportRealCvCard() {
  const { toast } = useToast();
  const imp = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/career/import-real-cv", "POST", {});
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "failed"); return j;
    },
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/admin-context"] });
      toast({ title: "Real CV imported", description: `Career suite filled · ${d.founderSectionsWritten} founder sections written · Urban AI now knows the real you across the whole platform.` });
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });
  return (
    <Card className="border-2 border-emerald-500/60 bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-sky-500/10 shadow-lg shadow-emerald-500/10">
      <CardContent className="pt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-base flex items-center gap-2"><Sparkles className="w-5 h-5 text-emerald-400" /> Import my real CV (deterministic)</div>
          <p className="text-xs text-muted-foreground mt-1">Loads your actual CV data — Dance Healthy, Coffee &amp; Dance, Ser.vi, full education, AI tooling, languages, hobbies, contact — into the Career Suite <em>and</em> teaches Urban AI to speak about the real you platform-wide for every user.</p>
        </div>
        <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold shrink-0" onClick={() => imp.mutate()} disabled={imp.isPending} data-testid="btn-import-real-cv">
          {imp.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Importing…</> : <><Sparkles className="w-4 h-4 mr-1" />Import real CV</>}
        </Button>
      </CardContent>
    </Card>
  );
}

function MegaStartCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(RIKI_BRIEF);
  const [stage, setStage] = useState<string>("");
  const mega = useMutation({
    mutationFn: async () => {
      setStage("Claude is reading your brief & writing your full profile…");
      const r = await apiRequest("/api/admin/career/mega-start", "POST", { prompt, language: "en", audience: "creative" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "failed");
      return j;
    },
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] });
      setStage(""); setOpen(false);
      toast({ title: "Done!", description: `Profile filled · ${d.cvs?.length || 0} CVs created · portfolio ready · public link: ${d.publicUrl}` });
    },
    onError: (e: any) => { setStage(""); toast({ title: "Mega Start failed", description: e.message, variant: "destructive" }); },
  });
  return (
    <Card className="border-2 border-amber-500/60 bg-gradient-to-br from-amber-500/15 via-pink-500/10 to-violet-500/10 shadow-lg shadow-amber-500/10">
      <CardContent className="pt-4 space-y-3">
        {!open ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-base flex items-center gap-2"><Rocket className="w-5 h-5 text-amber-400" /> Mega Start — full pipeline in one click</div>
              <p className="text-xs text-muted-foreground mt-1">One prompt → Claude writes your full profile, generates 8 industry CVs, builds your portfolio, and turns on your public page. ~60-90 seconds total.</p>
            </div>
            <Button size="lg" className="bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 text-black font-bold shrink-0" onClick={() => setOpen(true)} data-testid="btn-mega-open">
              <Zap className="w-4 h-4 mr-1" /> Mega Start
            </Button>
          </div>
        ) : (
          <>
            <div className="text-sm font-bold flex items-center gap-2"><Rocket className="w-4 h-4 text-amber-400" /> Tell Claude everything about you</div>
            <p className="text-[11px] text-muted-foreground">Pre-filled with your brief — edit if you want, then hit Generate. This will run profile + 8 CVs + portfolio.</p>
            <Textarea rows={12} value={prompt} onChange={e => setPrompt(e.target.value)} className="text-xs font-mono" data-testid="textarea-mega" />
            {stage && <div className="text-xs text-amber-300 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {stage}</div>}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={mega.isPending}>Cancel</Button>
              <Button size="lg" className="flex-1 bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 text-black font-bold" onClick={() => mega.mutate()} disabled={mega.isPending || prompt.length < 50} data-testid="btn-mega-go">
                {mega.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Building everything…</> : <><Rocket className="w-4 h-4 mr-1" />Generate full profile + 8 CVs + portfolio</>}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("file read failed"));
    r.readAsDataURL(file);
  });
}

async function compressImage(file: File, maxPx = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round((height / width) * maxPx); width = maxPx; }
        else { width = Math.round((width / height) * maxPx); height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      readFileAsDataUrl(file).then(resolve).catch(() => resolve(""));
    };
    img.src = objectUrl;
  });
}

function PhotoUploaderCard({ profile }: any) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const upload = async (file: File, kind: "avatar" | "cover") => {
    setUploading(kind);
    try {
      const maxPx = kind === "cover" ? 1600 : 800;
      const dataUrl = await compressImage(file, maxPx, 0.85);
      if (!dataUrl) throw new Error("Could not read image file");
      const r = await apiRequest("/api/admin/career/profile/photo", "POST", { dataUrl, kind });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/profile"] });
      toast({ title: `${kind === "cover" ? "Cover" : "Photo"} uploaded` });
    } catch (e: any) { toast({ title: "Upload failed", description: e.message, variant: "destructive" }); }
    setUploading(null);
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /> Photo & cover</CardTitle></CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-violet-500/40 bg-black/20 flex items-center justify-center">
              {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="profile" className="w-full h-full object-cover" /> : <span className="text-3xl text-muted-foreground">?</span>}
            </div>
            <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-violet-600 hover:bg-violet-700 cursor-pointer flex items-center justify-center" data-testid="btn-upload-avatar">
              {uploading === "avatar" ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Plus className="w-4 h-4 text-white" />}
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0], "avatar")} />
            </label>
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold mb-1">Profile photo</div>
            <p className="text-[11px] text-muted-foreground mb-2">Used in CVs and your public portfolio. Square images work best.</p>
            <div className="flex gap-2">
              <label className="text-xs px-3 py-1.5 rounded border border-white/10 hover-elevate cursor-pointer" data-testid="btn-upload-cover">
                {uploading === "cover" ? <><Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />Uploading…</> : <>+ Cover image (portfolio banner)</>}
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0], "cover")} />
              </label>
            </div>
            {profile?.coverUrl && (
              <div className="mt-2 h-16 rounded overflow-hidden border border-white/10"><img src={profile.coverUrl} alt="cover" className="w-full h-full object-cover" /></div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BrainFeedCard() {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const { data: ctx } = useQuery<any>({ queryKey: ["/api/admin/career/admin-context"] });
  const sync = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/profile/sync-from-admin", "POST", {}).then(r => r.json()),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/profile"] });
      const s = d.sourcesUsed || {};
      toast({ title: "Synced from Admin AI", description: `Marketing Brain: ${s.marketingBrain ? "✓" : "—"} · Founder: ${s.founderSections} · Training: ${s.trainingEntries} · IG: ${s.instagramPersona ? "✓" : "—"}` });
    },
    onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });
  const s = ctx?.sources || {};
  const total = (s.marketingBrain ? 1 : 0) + (s.instagramPersona ? 1 : 0) + (s.founderProfileSections || 0) + (s.trainingEntries || 0);

  return (
    <Card className="border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-cyan-400" /> Admin AI Brain Feed
          <Badge variant="outline" className="text-[10px] ml-auto">{total} sources connected</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          <div className={`border rounded p-2 ${s.marketingBrain ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/5 opacity-50"}`}>
            <div className="font-semibold">Marketing Brain</div>
            <div className="text-muted-foreground">{s.marketingBrain ? "Connected" : "Empty"}</div>
          </div>
          <div className={`border rounded p-2 ${s.founderProfileSections ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/5 opacity-50"}`}>
            <div className="font-semibold">Founder Profile</div>
            <div className="text-muted-foreground">{s.founderProfileSections || 0} sections</div>
          </div>
          <div className={`border rounded p-2 ${s.trainingEntries ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/5 opacity-50"}`}>
            <div className="font-semibold">AI Training</div>
            <div className="text-muted-foreground">{s.trainingEntries || 0} entries</div>
          </div>
          <div className={`border rounded p-2 ${s.instagramPersona ? "border-emerald-500/40 bg-emerald-500/5" : "border-white/5 opacity-50"}`}>
            <div className="font-semibold">IG Persona</div>
            <div className="text-muted-foreground">{s.instagramPersona ? "Connected" : "Empty"}</div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          All Career Suite AI calls now read from these sources too — Claude knows your product, brand voice, founder story, and personal training notes.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPreview(!showPreview)} data-testid="btn-preview-brain">
            {showPreview ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
            {showPreview ? "Hide" : "Preview"} what AI sees
          </Button>
          <Button size="sm" className="flex-1 bg-cyan-600 hover:bg-cyan-700" onClick={() => sync.mutate()} disabled={sync.isPending || total === 0} data-testid="btn-sync-admin">
            {sync.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Syncing…</> : <><Sparkles className="w-3.5 h-3.5 mr-1" />Sync into profile</>}
          </Button>
        </div>
        {showPreview && ctx?.preview && (
          <pre className="text-[10px] bg-black/40 border border-white/10 rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono">{ctx.preview}</pre>
        )}
      </CardContent>
    </Card>
  );
}

function MagicStartCard({ onDone }: any) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const examples = [
    "I'm Riki — bboy from Amsterdam, founder of Stichting Coffee & Dance, Dance Healthy and Back to the Street. I built Urban Culture Hub solo with AI. I want to land marketing or community lead roles in culture/sport/AI.",
    "I'm a creative director with 10 years in fashion brands. Built campaigns for Nike and Adidas. Now want to move into AI-creative tooling.",
    "Ex-pro athlete pivoting into sports tech. Founded a youth coaching non-profit. Looking for product or partnerships roles.",
  ];
  const magic = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/profile/magic", "POST", { prompt }).then(r => r.json()),
    onSuccess: () => { onDone?.(); setOpen(false); setPrompt(""); toast({ title: "Profile filled by Claude", description: "Scroll down to review & tweak." }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-violet-500/5 to-transparent">
      <CardContent className="pt-4">
        {!open ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs">
              <div className="font-bold text-sm flex items-center gap-1"><Rocket className="w-4 h-4 text-amber-400" /> Magic Start — type 1-3 sentences, get a full profile</div>
              <p className="text-muted-foreground mt-0.5">Skip the form. Tell Claude who you are in plain words and it fills everything below.</p>
            </div>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold shrink-0" onClick={() => setOpen(true)} data-testid="btn-magic-open">
              <Zap className="w-3.5 h-3.5 mr-1" /> Magic Start
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs font-semibold flex items-center gap-1"><Rocket className="w-4 h-4 text-amber-400" /> Tell Claude about you</div>
            <Textarea rows={5} value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Who you are, what you've built, what you're looking for. 1-5 sentences is plenty."
              data-testid="textarea-magic" />
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground">Examples</div>
              {examples.map((e, i) => (
                <button key={i} className="text-[11px] text-left text-violet-300 hover:text-violet-200 block w-full p-1.5 rounded hover-elevate" onClick={() => setPrompt(e)}>"{e}"</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-semibold flex-1" onClick={() => magic.mutate()} disabled={magic.isPending || prompt.length < 20} data-testid="btn-magic-go">
                {magic.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Claude is filling your profile…</> : <><Zap className="w-3.5 h-3.5 mr-1" />Generate full profile</>}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════ VOICE INPUT ════════════════════════════
function VoiceInputButton({ onAppend, fieldHint = "story" }: { onAppend: (text: string) => void; fieldHint?: string }) {
  const { toast } = useToast();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [open, setOpen] = useState(false);
  const recRef = useRef<any>(null);

  const SR: any = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  const supported = !!SR;

  const startListening = () => {
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "nl-NL";
    rec.onresult = (e: any) => {
      let fin = ""; let int = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + " ";
        else int += e.results[i][0].transcript;
      }
      if (fin) setTranscript(t => t + fin);
      setInterim(int);
    };
    rec.onerror = () => { setListening(false); setInterim(""); };
    rec.onend = () => { setListening(false); setInterim(""); };
    recRef.current = rec;
    rec.start();
    setListening(true);
    setOpen(true);
  };

  const stopListening = () => {
    recRef.current?.stop();
    setListening(false);
    setInterim("");
  };

  const handlePolish = async () => {
    if (!transcript.trim()) return;
    setPolishing(true);
    try {
      const r = await apiRequest("/api/admin/career/profile/voice-polish", "POST", { transcript: transcript.trim(), fieldHint });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "polish failed");
      onAppend(d.polished);
      setTranscript(""); setOpen(false);
      toast({ title: "Polished & added", description: "Claude cleaned up your voice input." });
    } catch (e: any) { toast({ title: "Polish failed", description: e.message, variant: "destructive" }); }
    setPolishing(false);
  };

  if (!supported) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          data-testid="btn-voice-input"
          className={cn(
            "flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium",
            listening
              ? "bg-red-500/15 border-red-500/60 text-red-400 animate-pulse"
              : "border-border text-muted-foreground hover:border-violet-400 hover:text-violet-400"
          )}
        >
          {listening ? <><MicOff className="w-3 h-3" /> Stop recording</> : <><Mic className="w-3 h-3" /> Speak to fill</>}
        </button>
        {transcript && !listening && (
          <span className="text-[10px] text-muted-foreground">{transcript.trim().split(/\s+/).length} words captured</span>
        )}
      </div>

      {open && (transcript || interim || listening) && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-violet-400 uppercase">
            <Volume2 className="w-3 h-3" />
            {listening ? "Recording…" : "Captured text"}
          </div>
          <p className="text-xs min-h-[2.5rem] whitespace-pre-wrap">
            {transcript}
            {interim && <span className="text-muted-foreground italic">{interim}</span>}
          </p>
          {!listening && transcript.trim() && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1"
                onClick={() => { onAppend(transcript.trim()); setTranscript(""); setOpen(false); toast({ title: "Added to field" }); }}>
                <Plus className="w-3 h-3" /> Append as-is
              </Button>
              <Button size="sm" className="text-[11px] h-7 gap-1 bg-violet-600 hover:bg-violet-700 flex-1"
                onClick={handlePolish} disabled={polishing} data-testid="btn-voice-polish">
                {polishing ? <><Loader2 className="w-3 h-3 animate-spin" /> Polishing…</> : <><Sparkles className="w-3 h-3" /> Polish with AI & add</>}
              </Button>
              <Button size="sm" variant="ghost" className="text-[11px] h-7 text-muted-foreground"
                onClick={() => { setTranscript(""); setOpen(false); }}>Clear</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════ QUICK CV GENERATOR (identity tab) ════════════════════════════
function QuickCvCard({ onCreated }: { onCreated?: (cv: any) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ style: "modern", theme: "modern" as string, language: "en", targetRole: "" });
  const [result, setResult] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  const generate = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/cvs/generate", "POST", { ...form }).then(r => r.json()),
    onSuccess: (cv: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] });
      setResult(cv);
      toast({ title: "CV generated", description: cv.name });
      onCreated?.(cv);
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const STYLES = [
    { v: "modern", l: "Modern" }, { v: "corporate", l: "Corporate" },
    { v: "creative", l: "Creative" }, { v: "startup", l: "Startup" },
  ];
  const LANGS = [
    { v: "en", l: "🇬🇧 English" }, { v: "nl", l: "🇳🇱 Nederlands" },
    { v: "ar", l: "🇸🇦 Arabic" }, { v: "fr", l: "🇫🇷 Français" },
    { v: "de", l: "🇩🇪 Deutsch" }, { v: "es", l: "🇪🇸 Español" },
  ];
  const THEMES = [
    { id: "modern", label: "Modern Minimal" }, { id: "corporate", label: "Corporate Serif" },
    { id: "creative", label: "Editorial Magazine" }, { id: "startup", label: "Terminal Dark" },
    { id: "pro", label: "Executive Gold" }, { id: "advanced", label: "Dark Sidebar" },
    { id: "bold", label: "Gradient Bold" }, { id: "designer", label: "Asymmetric Strip" },
    { id: "editorial", label: "Magazine Spread" }, { id: "boldcreative", label: "Infographic Hero" },
  ];

  return (
    <Card className="border-violet-500/40 bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-400" /> Generate CV from this identity
          </CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">Claude reads everything above and writes a complete, recruiter-ready CV.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Writing style</Label>
              <Select value={form.style} onValueChange={v => setForm(f => ({ ...f, style: v }))}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-quick-style"><SelectValue /></SelectTrigger>
                <SelectContent>{STYLES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-quick-lang"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGS.map(l => <SelectItem key={l.v} value={l.v}>{l.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Visual theme</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {THEMES.map(t => (
                <button key={t.id} onClick={() => setForm(f => ({ ...f, theme: t.id }))}
                  data-testid={`btn-theme-${t.id}`}
                  className={cn("text-left text-[11px] px-2.5 py-1.5 rounded border transition-colors",
                    form.theme === t.id ? "border-violet-500 bg-violet-500/15 text-violet-300" : "border-border text-muted-foreground hover:border-violet-500/40")}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Target role (optional)</Label>
            <Input className="h-8 text-xs mt-0.5" placeholder="e.g. Marketing Lead, Community Manager"
              value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}
              data-testid="input-quick-role" />
          </div>

          <Button className="w-full bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => generate.mutate()} disabled={generate.isPending} data-testid="btn-quick-generate-cv">
            {generate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Claude is writing your CV…</> : <><Sparkles className="w-4 h-4" />Generate CV</>}
          </Button>

          {result && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-emerald-300">{result.name}</div>
                <div className="text-[10px] text-muted-foreground">{result.style} · {result.language}{result.targetRole ? ` · ${result.targetRole}` : ""}</div>
              </div>
              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/40 shrink-0">Created</Badge>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ════════════════════════════ CV SCORE & MASTER ════════════════════════════
function CvScorerCard() {
  const { toast } = useToast();
  const [form, setForm] = useState({ jobTitle: "", jobDescription: "", style: "modern", language: "en" });
  const [result, setResult] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  const scoreAndMaster = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/cvs/score-and-master", "POST", form).then(r => r.json()),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] });
      setResult(d);
      toast({ title: `Score: ${d.score?.fitScore}/100`, description: d.score?.verdict });
    },
    onError: (e: any) => toast({ title: "Scoring failed", description: e.message, variant: "destructive" }),
  });

  const score = result?.score;
  const cv = result?.cv;
  const scoreColor = score ? (score.fitScore >= 75 ? "text-emerald-400" : score.fitScore >= 50 ? "text-yellow-400" : "text-red-400") : "";
  const scoreBg = score ? (score.fitScore >= 75 ? "bg-emerald-500/10 border-emerald-500/30" : score.fitScore >= 50 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-red-500/10 border-red-500/30") : "";

  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="w-4 h-4 text-amber-400" /> Score & Master my CV for a job
          </CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">Paste any job description — Claude scores your fit, finds gaps, and writes you a power CV tailored to that exact role.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Job title (optional but helps)</Label>
              <Input className="h-8 text-xs mt-0.5" placeholder="e.g. Marketing Lead at Nike"
                value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                data-testid="input-score-job-title" />
            </div>
            <div>
              <Label className="text-xs">CV style</Label>
              <Select value={form.style} onValueChange={v => setForm(f => ({ ...f, style: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="startup">Startup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="nl">🇳🇱 Nederlands</SelectItem>
                  <SelectItem value="ar">🇸🇦 Arabic</SelectItem>
                  <SelectItem value="fr">🇫🇷 Français</SelectItem>
                  <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                  <SelectItem value="es">🇪🇸 Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Job description (paste the full text)</Label>
            <Textarea rows={6} className="text-xs mt-0.5"
              placeholder="Paste the job description here — the longer and more detailed, the better the match analysis…"
              value={form.jobDescription} onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))}
              data-testid="textarea-score-job-desc" />
          </div>

          <Button className="w-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-black font-bold gap-2"
            onClick={() => scoreAndMaster.mutate()}
            disabled={scoreAndMaster.isPending || form.jobDescription.trim().length < 30}
            data-testid="btn-score-and-master">
            {scoreAndMaster.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Claude is scoring & mastering your CV…</>
              : <><TrendingUp className="w-4 h-4" />Score fit + generate master CV</>}
          </Button>

          {result && score && (
            <div className="space-y-3">
              {/* Score banner */}
              <div className={cn("rounded-lg border p-3 flex items-center gap-4", scoreBg)}>
                <div className="text-center shrink-0">
                  <div className={cn("text-3xl font-black tabular-nums", scoreColor)}>{score.fitScore}</div>
                  <div className="text-[10px] text-muted-foreground">/ 100</div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{score.verdict}</p>
                  {score.applicationTip && <p className="text-[11px] text-muted-foreground mt-0.5 italic">"{score.applicationTip}"</p>}
                </div>
              </div>

              {/* Matched strengths */}
              {(score.matchedStrengths || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase mb-1 flex items-center gap-1"><Award className="w-3 h-3" /> Your match points</div>
                  <ul className="text-xs space-y-0.5 list-disc pl-5 text-muted-foreground">
                    {score.matchedStrengths.map((s: string, i: number) => <li key={i} data-testid={`text-strength-${i}`}>{s}</li>)}
                  </ul>
                </div>
              )}

              {/* Gaps */}
              {(score.gaps || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-yellow-400 uppercase mb-1">Gaps to close</div>
                  <ul className="text-xs space-y-0.5 list-disc pl-5 text-muted-foreground">
                    {score.gaps.map((g: string, i: number) => <li key={i}>{g}</li>)}
                  </ul>
                </div>
              )}

              {/* Power moves */}
              {(score.powerMoves || []).length > 0 && (
                <div className="rounded-md bg-violet-500/10 border border-violet-500/30 p-2.5">
                  <div className="text-[10px] font-semibold text-violet-300 uppercase mb-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Power moves applied to your CV</div>
                  <ul className="text-xs space-y-0.5 list-disc pl-5 text-violet-200/80">
                    {score.powerMoves.map((m: string, i: number) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}

              {/* Generated CV */}
              {cv && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-amber-300">Master CV created: {cv.name}</div>
                    <div className="text-[10px] text-muted-foreground">{cv.style} · {cv.language} — find it in the CVs tab</div>
                  </div>
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function RepeaterCard({ title, items, onChange, fields, textareas = [], listFields = [], testId }: any) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{title} ({items.length})</CardTitle>
        <Button size="sm" variant="outline" onClick={() => onChange([...items, {}])} data-testid={`btn-add-${testId}`}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((it: any, i: number) => (
          <div key={i} className="border rounded p-2 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {fields.map((f: any) => <Input key={f.k} placeholder={f.label} value={it[f.k] || ""} onChange={e => { const c = [...items]; c[i] = { ...it, [f.k]: e.target.value }; onChange(c); }} />)}
            </div>
            {textareas.map((t: any) => <Textarea key={t.k} rows={2} placeholder={t.label} value={it[t.k] || ""} onChange={e => { const c = [...items]; c[i] = { ...it, [t.k]: e.target.value }; onChange(c); }} />)}
            {listFields.map((l: any) => <Textarea key={l.k} rows={3} placeholder={l.label} value={(it[l.k] || []).join("\n")} onChange={e => { const c = [...items]; c[i] = { ...it, [l.k]: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) }; onChange(c); }} />)}
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_: any, j: number) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════ CVS ════════════════════════════
function CvsTab() {
  const { toast } = useToast();
  const { data: cvs = [] } = useQuery<any[]>({ queryKey: ["/api/admin/career/cvs"] });
  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/admin/career/templates"] });
  const [form, setForm] = useState({ style: "modern", language: "en", targetRole: "", targetJobDescription: "" });
  const [openCvId, setOpenCvId] = useState<number | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const generate = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/cvs/generate", "POST", form).then(r => r.json()),
    onSuccess: (cv: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] });
      toast({ title: "CV generated by Claude", description: cv.name });
      setOpenCvId(cv.id);
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });
  const bulkGen = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/cvs/generate-templates", "POST", { templateIds: picked, language: form.language }).then(r => r.json()),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] });
      toast({ title: `${d.created} CVs generated`, description: "One CV per template." });
      setPicked([]);
    },
    onError: (e: any) => toast({ title: "Bulk gen failed", description: e.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/career/cvs/${id}`, "DELETE").then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] }),
  });

  const togglePick = (id: string) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const open = cvs.find((c: any) => c.id === openCvId);

  return (
    <div className="space-y-4">
      <LinkedInBrainImportCard />

      <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Rocket className="w-4 h-4 text-amber-400" /> Industry templates — generate multiple CVs in one click</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {templates.map((t: any) => (
              <button key={t.id}
                className={`text-left border rounded p-2 hover-elevate ${picked.includes(t.id) ? "border-amber-500 bg-amber-500/10" : "border-white/10"}`}
                onClick={() => togglePick(t.id)} data-testid={`tpl-${t.id}`}>
                <div className="font-semibold text-sm flex items-center gap-1">
                  {picked.includes(t.id) && <span className="text-amber-400">✓</span>}{t.label}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{t.angle}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPicked(templates.map((t: any) => t.id))}>Select all</Button>
            <Button size="sm" variant="outline" onClick={() => setPicked([])}>Clear</Button>
            <Button size="sm" className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={() => bulkGen.mutate()} disabled={bulkGen.isPending || picked.length === 0} data-testid="btn-bulk-gen">
              {bulkGen.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Claude is writing {picked.length}…</> : <><Zap className="w-3.5 h-3.5 mr-1" />Generate {picked.length || ""} CV{picked.length === 1 ? "" : "s"}</>}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-violet-400" /> Generate a CV</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Style</Label>
            <Select value={form.style} onValueChange={v => setForm(f => ({ ...f, style: v }))}>
              <SelectTrigger data-testid="select-cv-style"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern (clean, confident)</SelectItem>
                <SelectItem value="corporate">Corporate (formal, metrics-led)</SelectItem>
                <SelectItem value="creative">Creative (story-led, bold)</SelectItem>
                <SelectItem value="startup">Startup (scrappy, outcome-only)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Language</Label>
            <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="nl">🇳🇱 Nederlands</SelectItem>
                <SelectItem value="ar">🇸🇦 العربية (Arabic)</SelectItem>
                <SelectItem value="fr">🇫🇷 Français</SelectItem>
                <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label className="text-xs">Target role (optional)</Label>
            <Input value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))} placeholder="e.g. Marketing Lead, Community Manager" data-testid="input-target-role" />
          </div>
          <div className="col-span-2"><Label className="text-xs">Target job description (optional — paste to tailor)</Label>
            <Textarea rows={4} value={form.targetJobDescription} onChange={e => setForm(f => ({ ...f, targetJobDescription: e.target.value }))} />
          </div>
          <Button className="col-span-2 bg-violet-600 hover:bg-violet-700" onClick={() => generate.mutate()} disabled={generate.isPending} data-testid="btn-generate-cv">
            {generate.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Claude is writing…</> : <><Sparkles className="w-4 h-4 mr-2" />Generate CV with Claude</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Saved CVs ({cvs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {cvs.length === 0 && <p className="text-xs text-muted-foreground">No CVs yet. Generate one above.</p>}
          {cvs.map((cv: any) => (
            <div key={cv.id} className={`border rounded p-3 cursor-pointer hover-elevate ${openCvId === cv.id ? "border-violet-500" : ""}`} onClick={() => setOpenCvId(openCvId === cv.id ? null : cv.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{cv.name}</div>
                  <div className="text-xs text-muted-foreground">{cv.style} · {cv.language}{cv.targetRole ? ` · ${cv.targetRole}` : ""} · {new Date(cv.updatedAt).toLocaleDateString()}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this CV?")) del.mutate(cv.id); }}>
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {open && <CvViewer cv={open} />}
    </div>
  );
}

type CvTheme = "modern" | "corporate" | "creative" | "startup" | "pro" | "advanced" | "bold" | "designer" | "editorial" | "boldcreative";
const CV_THEMES: { id: CvTheme; label: string; tag?: string }[] = [
  { id: "modern",    label: "Modern · Minimal" },
  { id: "corporate", label: "Corporate · Classic Serif" },
  { id: "creative",  label: "Creative · Editorial Magazine" },
  { id: "startup",   label: "Startup · Terminal Tech", tag: "DARK" },
  { id: "pro",       label: "Pro · Executive Gold", tag: "PRO" },
  { id: "advanced",  label: "Advanced · Dark Sidebar", tag: "PRO" },
  { id: "bold",      label: "Bold · Gradient Display", tag: "NEW" },
  { id: "designer",  label: "Designer · Asymmetric Strip", tag: "NEW" },
  { id: "editorial",    label: "Editorial · Magazine Spread", tag: "PREMIUM" },
  { id: "boldcreative", label: "Bold Creative · Infographic Hero", tag: "PREMIUM" },
];

function CvViewer({ cv }: any) {
  const { toast } = useToast();
  const { data: profile } = useQuery<any>({ queryKey: ["/api/admin/career/profile"] });
  const c = cv.content || {};
  const [theme, setTheme] = useState<CvTheme>(((cv.theme || cv.style as CvTheme) || "modern"));
  const [inlineEditActive, setInlineEditActive] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(700);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [tailorJob, setTailorJob] = useState({ jobTitle: "", jobDescription: "" });

  // Listen for height reports from the iframe content
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "cvHeight" && typeof e.data.height === "number") {
        setIframeHeight(Math.max(500, e.data.height + 40));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Inject / remove contentEditable mode directly into the iframe DOM
  useEffect(() => {
    if (!inlineEditActive) return;
    const tryInject = () => {
      const iDoc = iframeRef.current?.contentDocument;
      if (!iDoc || !iDoc.body) return false;
      iDoc.body.contentEditable = "true";
      iDoc.body.spellcheck = false;
      if (!iDoc.getElementById("__edit_hint")) {
        const hint = iDoc.createElement("div");
        hint.id = "__edit_hint";
        hint.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9999;background:#7c3aed;color:#fff;font-family:system-ui,sans-serif;font-size:11px;padding:6px 14px;text-align:center;letter-spacing:0.2px;box-shadow:0 2px 8px rgba(0,0,0,.3)";
        hint.textContent = "✏️  Click any text to edit it directly";
        iDoc.body.insertBefore(hint, iDoc.body.firstChild);
      }
      if (!iDoc.getElementById("__edit_style")) {
        const style = iDoc.createElement("style");
        style.id = "__edit_style";
        style.textContent = [
          "body{cursor:text!important;padding-top:32px!important}",
          "*:not(#__edit_hint):hover{outline:1.5px dashed rgba(124,58,237,.5)!important;outline-offset:2px;border-radius:2px}",
          "*:focus{outline:2px solid #7c3aed!important;outline-offset:2px;border-radius:2px;background:rgba(124,58,237,.04)!important}",
          "::selection{background:rgba(124,58,237,.25)}",
        ].join("");
        iDoc.head.appendChild(style);
      }
      return true;
    };
    if (!tryInject()) {
      const el = iframeRef.current;
      el?.addEventListener("load", tryInject, { once: true });
    }
    return () => {
      const iDoc = iframeRef.current?.contentDocument;
      if (!iDoc) return;
      iDoc.getElementById("__edit_style")?.remove();
      iDoc.getElementById("__edit_hint")?.remove();
      if (iDoc.body) {
        iDoc.body.contentEditable = "false";
        iDoc.body.removeAttribute("spellcheck");
        iDoc.body.style.paddingTop = "";
      }
    };
  }, [inlineEditActive]);

  const startInlineEdit = () => setInlineEditActive(true);
  const cancelInlineEdit = () => setInlineEditActive(false);

  const saveInlineEdits = useMutation({
    mutationFn: () => {
      const rawHtml = getExportHtml();
      return apiRequest(`/api/admin/career/cvs/${cv.id}`, "PATCH", {
        content: { ...c, rawHtml },
      }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] });
      setInlineEditActive(false);
      toast({ title: "CV saved ✓", description: "Your inline edits have been saved." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
  const tailor = useMutation({
    mutationFn: () => apiRequest(`/api/admin/career/cvs/${cv.id}/tailor`, "POST", tailorJob).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] }); toast({ title: "Tailored CV created" }); },
  });
  const translate = useMutation({
    mutationFn: (language: string) => apiRequest(`/api/admin/career/cvs/${cv.id}/translate`, "POST", { language }).then(r => r.json()),
    onSuccess: (_d, lang) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] });
      const names: Record<string, string> = { nl: "Dutch", en: "English", ar: "Arabic", fr: "French", de: "German", es: "Spanish" };
      toast({ title: `CV translated to ${names[lang] || lang}`, description: "All bullets and summaries rewritten by AI in native voice." });
    },
    onError: (e: any) => toast({ title: "Translate failed", description: e.message, variant: "destructive" }),
  });

  const buildHtml = (th: CvTheme = theme, _editable = false) => {
    const c = cv.content || {};
    const _p: any = profile || {};
    const head = `${_p.fullName || cv.name}`;
    const contact = [_p.location, _p.email, _p.phone, _p.website].filter(Boolean);
    const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;700;900&family=JetBrains+Mono:wght@400;500;700&family=Bebas+Neue&family=DM+Serif+Display&family=Space+Grotesk:wght@400;500;700&family=Cairo:wght@300;400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">`;
    // ── Translation post-processor — translates section labels to cv.language ──
    const lang = (cv.language || "en").toLowerCase();
    const isRTL = lang === "ar";
    // Inject Arabic font stack + RTL direction into the rendered HTML when needed.
    const rtlPostProcess = (html: string): string => {
      if (!isRTL) return html;
      let out = html;
      // Force <html dir="rtl" lang="ar"> on the document root
      out = out.replace(/<html(?:\s+[^>]*)?>/i, `<html dir="rtl" lang="ar">`);
      // Add a global Arabic font override + RTL adjustments after the <style> opener
      const rtlStyles = `body,html{direction:rtl !important;text-align:right !important;font-family:'Tajawal','Cairo','Noto Naskh Arabic','Inter',sans-serif !important}h1,h2,h3,h4,h5,h6,p,div,span,li,td,th{font-family:'Tajawal','Cairo','Noto Naskh Arabic','Inter',sans-serif !important;letter-spacing:0 !important}ul{padding-right:18px !important;padding-left:0 !important}li::marker{unicode-bidi:isolate}.contact span:before{margin-left:6px;margin-right:0}.row{flex-direction:row-reverse}.tag{margin:2px 0 2px 4px}`;
      out = out.replace(/<style>/, `<style>${rtlStyles}`);
      return out;
    };
    const translateUi = (html: string): string => {
      const dicts: Record<string, Record<string, string>> = {
        nl: {
          "Professional Experience": "Werkervaring",
          "Entrepreneurial Ventures": "Ondernemingen",
          "Areas of Expertise": "Vakgebieden",
          "Notable Achievements": "Belangrijke Prestaties",
          "Honors &amp; Press": "Onderscheidingen &amp; Pers",
          "The Career Chronicles": "Carrière Verhaal",
          "Ventures &amp; Studios": "Ondernemingen &amp; Studio's",
          "The Craft": "Vakmanschap",
          "Tongues Spoken": "Talen",
          "Distinguished Acts": "Bijzondere Prestaties",
          "Acclaim &amp; Press": "Lof &amp; Pers",
          "Ventures Founded": "Opgerichte Ondernemingen",
          "Press &amp; Awards": "Pers &amp; Onderscheidingen",
          "Schooling": "Opleiding",
          "Experience": "Ervaring",
          "experience": "ervaring",
          "Ventures": "Ondernemingen",
          "ventures": "ondernemingen",
          "Education": "Opleiding",
          "education": "opleiding",
          "Skills": "Vaardigheden",
          "Stack": "Stack",
          "stack": "stack",
          "Expertise": "Expertise",
          "Languages": "Talen",
          "languages": "talen",
          "Achievements": "Prestaties",
          "achievements": "prestaties",
          "Press": "Pers",
          "press": "pers",
          "Profile": "Profiel",
          "Interests": "Interesses",
          "Vol. I &middot; The Portfolio": "Editie I &middot; Het Portfolio",
          "Vol. I · The Portfolio": "Editie I · Het Portfolio",
          "whoami": "wieikben",
          "cat ./profile.txt": "cat ./profiel.txt",
          "Builder": "Bouwer",
        },
        fr: {
          "Professional Experience": "Expérience Professionnelle",
          "Entrepreneurial Ventures": "Entreprises",
          "Areas of Expertise": "Domaines d'Expertise",
          "Notable Achievements": "Réalisations Notables",
          "Honors &amp; Press": "Distinctions &amp; Presse",
          "The Career Chronicles": "Chroniques de Carrière",
          "Ventures &amp; Studios": "Entreprises &amp; Studios",
          "The Craft": "L'Artisanat",
          "Tongues Spoken": "Langues Parlées",
          "Distinguished Acts": "Distinctions",
          "Acclaim &amp; Press": "Acclamations &amp; Presse",
          "Ventures Founded": "Entreprises Fondées",
          "Press &amp; Awards": "Presse &amp; Récompenses",
          "Schooling": "Formation",
          "Experience": "Expérience",
          "experience": "expérience",
          "Ventures": "Entreprises",
          "ventures": "entreprises",
          "Education": "Éducation",
          "education": "éducation",
          "Skills": "Compétences",
          "Stack": "Stack",
          "stack": "stack",
          "Expertise": "Expertise",
          "Languages": "Langues",
          "languages": "langues",
          "Achievements": "Réalisations",
          "achievements": "réalisations",
          "Press": "Presse",
          "press": "presse",
          "Profile": "Profil",
          "Interests": "Intérêts",
        },
        de: {
          "Professional Experience": "Berufserfahrung",
          "Entrepreneurial Ventures": "Unternehmungen",
          "Areas of Expertise": "Fachgebiete",
          "Notable Achievements": "Bemerkenswerte Erfolge",
          "Honors &amp; Press": "Auszeichnungen &amp; Presse",
          "The Career Chronicles": "Karriere-Chronik",
          "Ventures &amp; Studios": "Unternehmungen &amp; Studios",
          "The Craft": "Das Handwerk",
          "Tongues Spoken": "Gesprochene Sprachen",
          "Distinguished Acts": "Auszeichnungen",
          "Acclaim &amp; Press": "Anerkennung &amp; Presse",
          "Ventures Founded": "Gegründete Unternehmungen",
          "Press &amp; Awards": "Presse &amp; Auszeichnungen",
          "Schooling": "Ausbildung",
          "Experience": "Erfahrung",
          "experience": "erfahrung",
          "Ventures": "Unternehmungen",
          "ventures": "unternehmungen",
          "Education": "Ausbildung",
          "education": "ausbildung",
          "Skills": "Fähigkeiten",
          "Stack": "Stack",
          "stack": "stack",
          "Expertise": "Expertise",
          "Languages": "Sprachen",
          "languages": "sprachen",
          "Achievements": "Erfolge",
          "achievements": "erfolge",
          "Press": "Presse",
          "press": "presse",
          "Profile": "Profil",
          "Interests": "Interessen",
        },
        ar: {
          "Professional Experience": "الخبرة المهنية",
          "Entrepreneurial Ventures": "المشاريع الريادية",
          "Areas of Expertise": "مجالات الخبرة",
          "Notable Achievements": "أبرز الإنجازات",
          "Honors &amp; Press": "التكريمات والصحافة",
          "The Career Chronicles": "سجلّ المسيرة",
          "Ventures &amp; Studios": "المشاريع والاستوديوهات",
          "The Craft": "الحرفة",
          "Tongues Spoken": "اللغات المتحدَّث بها",
          "Distinguished Acts": "إنجازات بارزة",
          "Acclaim &amp; Press": "إشادات وصحافة",
          "Ventures Founded": "مشاريع تأسست",
          "Press &amp; Awards": "الصحافة والجوائز",
          "Schooling": "التعليم",
          "Experience": "الخبرة",
          "experience": "الخبرة",
          "Ventures": "المشاريع",
          "ventures": "المشاريع",
          "Education": "التعليم",
          "education": "التعليم",
          "Skills": "المهارات",
          "Stack": "المنظومة التقنية",
          "stack": "المنظومة التقنية",
          "Expertise": "الخبرات",
          "Languages": "اللغات",
          "languages": "اللغات",
          "Achievements": "الإنجازات",
          "achievements": "الإنجازات",
          "Press": "الصحافة",
          "press": "الصحافة",
          "Profile": "النبذة",
          "Interests": "الاهتمامات",
          "Vol. I &middot; The Portfolio": "المجلد الأول · ملف الأعمال",
          "Vol. I · The Portfolio": "المجلد الأول · ملف الأعمال",
          "whoami": "من_أنا",
          "cat ./profile.txt": "cat ./الملف.txt",
          "Builder": "صانع",
        },
        es: {
          "Professional Experience": "Experiencia Profesional",
          "Entrepreneurial Ventures": "Emprendimientos",
          "Areas of Expertise": "Áreas de Especialización",
          "Notable Achievements": "Logros Destacados",
          "Honors &amp; Press": "Distinciones &amp; Prensa",
          "The Career Chronicles": "Crónicas de Carrera",
          "Ventures &amp; Studios": "Emprendimientos &amp; Estudios",
          "The Craft": "El Oficio",
          "Tongues Spoken": "Idiomas Hablados",
          "Distinguished Acts": "Logros Distinguidos",
          "Acclaim &amp; Press": "Reconocimientos &amp; Prensa",
          "Ventures Founded": "Emprendimientos Fundados",
          "Press &amp; Awards": "Prensa &amp; Premios",
          "Schooling": "Formación",
          "Experience": "Experiencia",
          "experience": "experiencia",
          "Ventures": "Emprendimientos",
          "ventures": "emprendimientos",
          "Education": "Educación",
          "education": "educación",
          "Skills": "Habilidades",
          "Stack": "Stack",
          "stack": "stack",
          "Expertise": "Experiencia",
          "Languages": "Idiomas",
          "languages": "idiomas",
          "Achievements": "Logros",
          "achievements": "logros",
          "Press": "Prensa",
          "press": "prensa",
          "Profile": "Perfil",
          "Interests": "Intereses",
        },
      };
      const dict = dicts[lang];
      if (!dict) return html;
      // Sort keys longest-first to avoid partial matches (e.g. "Experience" replacing inside "Professional Experience")
      const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
      let out = html;
      for (const k of keys) {
        // Match between > and < (heading text content) OR after specific markers
        const escK = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`>${escK}<`, "g"), `>${dict[k]}<`);
        out = out.replace(new RegExp(`>${escK} `, "g"), `>${dict[k]} `);
        out = out.replace(new RegExp(`>${escK}&`, "g"), `>${dict[k]}&`);
        out = out.replace(new RegExp(`<span>${escK}<`, "g"), `<span>${dict[k]}<`);
      }
      return out;
    };

    // Inject height reporter so parent can resize iframe (works on iOS WKWebView)
    const HEIGHT_REPORTER = `<script>(function(){function r(){try{window.parent.postMessage({type:'cvHeight',height:document.body.scrollHeight},'*')}catch(e){}}window.addEventListener('load',r);new MutationObserver(r).observe(document.body,{childList:true,subtree:true,attributes:true});setTimeout(r,600);setTimeout(r,1500);}());<\/script>`;

    // Inject height reporter into every render (allows auto-resize on iOS)
    const addEditMode = (html: string) => html.replace('</body>', HEIGHT_REPORTER + '</body>');

    // Short-circuit: if this CV has been inline-edited, serve the saved HTML directly
    if ((c as any).rawHtml) {
      const saved = (c as any).rawHtml as string;
      return saved.includes("cvHeight") ? saved : addEditMode(saved);
    }

    const expBullets = (e: any) => (e.bullets || []).map((b: string) => `<li>${b}</li>`).join("");
    const venList = (open: string, close: string) => (c.ventures || []).map((v: any) =>
      `${open}<strong>${v.name}</strong> · <em>${v.role || ""}</em> · ${v.period || ""}<br><span>${v.summary || ""}</span>${(v.highlights || []).length ? `<ul>${v.highlights.map((h: string) => `<li>${h}</li>`).join("")}</ul>` : ""}${close}`
    ).join("");

    // ════════════════════════════════════════════════════════════════════════
    // 1. ADVANCED — dark navy sidebar + white main, red accent (premium consultant)
    // ════════════════════════════════════════════════════════════════════════
    if (th === "advanced") {
      return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Inter',-apple-system,sans-serif;background:#fff;color:#1f2937;margin:0;line-height:1.55;font-size:10.5pt}
.wrap{display:grid;grid-template-columns:240px 1fr;min-height:100vh}
.side{background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);color:#f1f5f9;padding:36px 24px;position:relative}
.side:before{content:"";position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#dc2626,#f59e0b,#dc2626)}
.avatar{width:140px;height:140px;border-radius:50%;object-fit:cover;border:4px solid #dc2626;display:block;margin:0 auto 18px;box-shadow:0 8px 24px rgba(220,38,38,.4)}
.side h1{font-size:19pt;margin:0 0 6px;color:#fff;letter-spacing:.3px;text-align:center;font-weight:800}
.side .role{font-size:9.5pt;color:#fca5a5;text-align:center;text-transform:uppercase;letter-spacing:1.8px;margin-bottom:24px;font-weight:600}
.side h3{font-size:9.5pt;color:#fca5a5;text-transform:uppercase;letter-spacing:2px;margin:22px 0 10px;padding-bottom:6px;border-bottom:2px solid #dc2626;font-weight:700}
.side .item{font-size:9.5pt;margin:6px 0;color:#e2e8f0;line-height:1.5;display:flex;gap:8px;align-items:flex-start}
.side .item .ic{color:#dc2626;flex:0 0 14px;font-weight:700}
.tag{display:inline-block;background:rgba(220,38,38,.18);color:#fecaca;padding:3px 9px;border-radius:3px;font-size:8.5pt;margin:2px 3px 2px 0;font-weight:500;border:1px solid rgba(220,38,38,.3)}
.cat{font-weight:700;color:#fff;font-size:9pt;text-transform:uppercase;letter-spacing:1px;margin:10px 0 4px}
.main{padding:42px 40px;background:#fff}
.main h2{color:#0f172a;font-size:13pt;text-transform:uppercase;letter-spacing:3px;margin:24px 0 12px;font-weight:800;position:relative;padding-left:18px}
.main h2:before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:8px;height:8px;background:#dc2626;border-radius:50%}
.main h2:after{content:"";display:block;height:2px;background:linear-gradient(90deg,#dc2626 0%,transparent 100%);margin-top:6px}
.main h2:first-child{margin-top:0}
.summary{font-size:11.5pt;color:#374151;margin:0 0 18px;padding:14px 18px;background:linear-gradient(135deg,#fef2f2 0%,#fff 100%);border-left:4px solid #dc2626;border-radius:0 6px 6px 0;line-height:1.65}
.row{display:flex;justify-content:space-between;gap:14px;align-items:baseline;margin-top:12px}
.role-t{font-weight:700;color:#0f172a;font-size:11.5pt}
.org{color:#dc2626;font-weight:600;font-style:italic}
.period{color:#fff;background:#0f172a;font-size:8.5pt;font-weight:700;white-space:nowrap;padding:3px 10px;border-radius:3px;letter-spacing:.5px}
.main ul{margin:6px 0 12px;padding-left:20px}
.main li{margin:3px 0;font-size:10.5pt}
.main li::marker{color:#dc2626}
</style></head><body>
<div class="wrap">
  <aside class="side">
    ${_p.avatarUrl ? `<img class="avatar" src="${_p.avatarUrl}" />` : ""}
    <h1>${head}</h1>
    ${_p.headline ? `<div class="role">${_p.headline}</div>` : ""}
    <h3>Contact</h3>
    ${_p.email ? `<div class="item"><span class="ic">✉</span><span>${_p.email}</span></div>` : ""}
    ${_p.phone ? `<div class="item"><span class="ic">☏</span><span>${_p.phone}</span></div>` : ""}
    ${_p.location ? `<div class="item"><span class="ic">⌂</span><span>${_p.location}</span></div>` : ""}
    ${_p.website ? `<div class="item"><span class="ic">⌘</span><span>${_p.website}</span></div>` : ""}
    ${(c.skills||[]).length ? `<h3>Expertise</h3>${(c.skills||[]).map((s:any)=>`<div class="cat">${s.category||""}</div>${(s.items||[]).map((i:string)=>`<span class="tag">${i}</span>`).join("")}`).join("")}` : ""}
    ${(c.languages||[]).length ? `<h3>Languages</h3>${(c.languages||[]).map((l:any)=>`<div class="item"><span>${l.name}</span><span style="color:#fca5a5;margin-left:auto">${l.level||""}</span></div>`).join("")}` : ""}
    ${(c.interests||[]).length ? `<h3>Interests</h3><div>${(c.interests||[]).map((i:string)=>`<span class="tag">${i}</span>`).join("")}</div>` : ""}
  </aside>
  <main class="main">
    ${c.summary ? `<p class="summary">${c.summary}</p>` : ""}
    ${(c.experience||[]).length ? `<h2>Professional Experience</h2>${c.experience.map((e:any)=>`
      <div class="row"><span><span class="role-t">${e.title}</span> · <span class="org">${e.org||""}</span></span><span class="period">${e.period||""}</span></div>
      <ul>${expBullets(e)}</ul>`).join("")}` : ""}
    ${(c.ventures||[]).length ? `<h2>Ventures Founded</h2>${c.ventures.map((v:any)=>`
      <div class="row"><span><span class="role-t">${v.name}</span> · <span class="org">${v.role||""}</span></span><span class="period">${v.period||""}</span></div>
      <p style="margin:5px 0">${v.summary||""}</p>${(v.highlights||[]).length?`<ul>${v.highlights.map((h:string)=>`<li>${h}</li>`).join("")}</ul>`:""}`).join("")}` : ""}
    ${(c.education||[]).length ? `<h2>Education</h2>${c.education.map((e:any)=>`<div class="row"><span><span class="role-t">${e.degree}</span> — <span class="org">${e.institution||""}</span></span><span class="period">${e.period||""}</span></div>`).join("")}` : ""}
    ${(c.achievements||[]).length ? `<h2>Achievements</h2><ul>${c.achievements.map((a:string)=>`<li>${a}</li>`).join("")}</ul>` : ""}
    ${(c.pressAndAwards||[]).length ? `<h2>Press & Awards</h2><ul>${c.pressAndAwards.map((a:any)=>`<li><strong>${a.title}</strong> — <em style="color:#dc2626">${a.source||""}</em> <span style="color:#6b7280">(${a.year||""})</span></li>`).join("")}</ul>` : ""}
  </main>
</div>
</body></html>`)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. PRO — Executive Cormorant serif, gold #c8a45c, magazine centered
    // ════════════════════════════════════════════════════════════════════════
    if (th === "pro") {
      return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Cormorant Garamond',Georgia,serif;background:#fafaf7;color:#1f1f1f;margin:0;padding:0;line-height:1.65;font-size:12pt}
.page{max-width:880px;margin:0 auto;padding:60px 80px;background:#fafaf7;position:relative}
.page:before{content:"";position:absolute;top:30px;left:30px;right:30px;bottom:30px;border:1px solid #c8a45c40;pointer-events:none}
.hdr{text-align:center;padding-bottom:28px;margin-bottom:32px;position:relative}
.avatar{width:120px;height:120px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 18px;border:1px solid #c8a45c;padding:5px;background:#fff;box-shadow:0 4px 16px rgba(200,164,92,.25)}
h1{margin:0;font-size:42pt;color:#0a0a0a;letter-spacing:6px;font-weight:500;text-transform:uppercase;font-family:'DM Serif Display','Cormorant Garamond',serif}
.tag-line{display:flex;align-items:center;justify-content:center;gap:14px;margin:14px 0}
.tag-line .dot{width:6px;height:6px;background:#c8a45c;border-radius:50%}
.tag-line .ln{height:1px;width:50px;background:#c8a45c}
.sub{color:#7a7367;font-size:13pt;font-style:italic;letter-spacing:.5px;font-weight:500}
.contact{color:#7a7367;font-size:9.5pt;margin-top:10px;letter-spacing:2.5px;text-transform:uppercase;font-family:'Inter',sans-serif;font-weight:500}
h2{color:#0a0a0a;font-size:13pt;text-transform:uppercase;letter-spacing:6px;margin:34px 0 16px;text-align:center;font-weight:600;font-family:'Inter',sans-serif;position:relative;padding:8px 0}
h2:before,h2:after{content:"";display:inline-block;width:40px;height:1px;background:#c8a45c;vertical-align:middle;margin:0 18px}
h2 span{position:relative}
h2 span:after{content:"◆";position:absolute;left:50%;transform:translateX(-50%);bottom:-22px;color:#c8a45c;font-size:10pt}
.summary{font-size:14pt;color:#1f1f1f;margin:0 auto 16px;font-style:italic;text-align:center;max-width:680px;line-height:1.75;font-weight:400}
.summary:first-letter{font-size:42pt;float:left;line-height:.85;margin:6px 8px 0 0;color:#c8a45c;font-family:'DM Serif Display',serif;font-style:normal}
.row{display:flex;justify-content:space-between;gap:16px;align-items:baseline;margin-top:18px}
.role-t{font-weight:600;color:#0a0a0a;font-size:13pt;letter-spacing:.5px}
.org{color:#c8a45c;font-style:italic;font-weight:500}
.period{color:#7a7367;font-size:9.5pt;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;font-family:'Inter',sans-serif;font-weight:500}
ul{margin:6px 0 10px;padding-left:24px;font-family:'Inter',sans-serif;font-size:10.5pt;line-height:1.6}
li{margin:4px 0}
li::marker{color:#c8a45c}
.skill-block{margin:14px 0;text-align:center}
.skill-cat{font-weight:700;color:#0a0a0a;text-transform:uppercase;letter-spacing:2.5px;font-size:10pt;margin-bottom:6px;font-family:'Inter',sans-serif}
.tag{display:inline-block;color:#1f1f1f;padding:3px 0;font-size:11.5pt;margin:0 16px;border-bottom:1px solid #c8a45c66;font-style:italic}
@media print{.page{padding:50px 60px}}
</style></head><body>
<div class="page">
  <div class="hdr">
    ${_p.avatarUrl ? `<img class="avatar" src="${_p.avatarUrl}" />` : ""}
    <h1>${head}</h1>
    <div class="tag-line"><span class="ln"></span><span class="dot"></span><span class="ln"></span></div>
    ${_p.headline ? `<div class="sub">${_p.headline}</div>` : ""}
    <div class="contact">${contact.join(" · ")}</div>
  </div>
  ${c.summary ? `<p class="summary">${c.summary}</p>` : ""}
  ${(c.experience||[]).length ? `<h2><span>Experience</span></h2>${c.experience.map((e:any)=>`
    <div class="row"><span><span class="role-t">${e.title}</span> · <span class="org">${e.org||""}</span></span><span class="period">${e.period||""}</span></div>
    <ul>${expBullets(e)}</ul>`).join("")}` : ""}
  ${(c.ventures||[]).length ? `<h2><span>Ventures</span></h2>${c.ventures.map((v:any)=>`
    <div class="row"><span><span class="role-t">${v.name}</span> · <span class="org">${v.role||""}</span></span><span class="period">${v.period||""}</span></div>
    <p style="font-style:italic;margin:6px 0">${v.summary||""}</p>${(v.highlights||[]).length?`<ul>${v.highlights.map((h:string)=>`<li>${h}</li>`).join("")}</ul>`:""}`).join("")}` : ""}
  ${(c.education||[]).length ? `<h2><span>Education</span></h2>${c.education.map((e:any)=>`<div class="row"><span><span class="role-t">${e.degree}</span> — <span class="org">${e.institution||""}</span></span><span class="period">${e.period||""}</span></div>`).join("")}` : ""}
  ${(c.skills||[]).length ? `<h2><span>Expertise</span></h2>${c.skills.map((s:any)=>`<div class="skill-block"><div class="skill-cat">${s.category||""}</div>${(s.items||[]).map((i:string)=>`<span class="tag">${i}</span>`).join("")}</div>`).join("")}` : ""}
  ${(c.languages||[]).length ? `<h2><span>Languages</span></h2><p style="text-align:center;font-style:italic">${c.languages.map((l:any)=>`<strong>${l.name}</strong> <span style="color:#7a7367">— ${l.level||""}</span>`).join(" &nbsp;◆&nbsp; ")}</p>` : ""}
  ${(c.achievements||[]).length ? `<h2><span>Achievements</span></h2><ul style="max-width:720px;margin:0 auto">${c.achievements.map((a:string)=>`<li>${a}</li>`).join("")}</ul>` : ""}
  ${(c.pressAndAwards||[]).length ? `<h2><span>Press &amp; Awards</span></h2><ul style="max-width:720px;margin:0 auto">${c.pressAndAwards.map((a:any)=>`<li><strong>${a.title}</strong> — <em style="color:#c8a45c">${a.source||""}</em> <span style="color:#7a7367">(${a.year||""})</span></li>`).join("")}</ul>` : ""}
</div>
</body></html>`)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. BOLD — Massive gradient display name, magenta→cyan, art-director
    // ════════════════════════════════════════════════════════════════════════
    if (th === "bold") {
      return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Space Grotesk','Inter',sans-serif;background:#0a0a0a;color:#fff;margin:0;padding:0;line-height:1.55;font-size:10.5pt}
.page{max-width:900px;margin:0 auto;padding:48px 56px;background:#0a0a0a;min-height:100vh;position:relative;overflow:hidden}
.page:before{content:"";position:absolute;top:-200px;right:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(236,72,153,.3) 0%,transparent 70%);pointer-events:none}
.page:after{content:"";position:absolute;bottom:-200px;left:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(34,211,238,.25) 0%,transparent 70%);pointer-events:none}
.hdr{position:relative;z-index:1;padding:40px 0 30px;border-bottom:1px solid rgba(255,255,255,.1)}
.avatar{width:120px;height:120px;border-radius:14px;object-fit:cover;float:right;margin-left:24px;border:3px solid transparent;background:linear-gradient(#0a0a0a,#0a0a0a) padding-box,linear-gradient(135deg,#ec4899,#22d3ee) border-box;box-shadow:0 12px 40px rgba(236,72,153,.4)}
h1{margin:0;font-size:60pt;font-weight:900;line-height:.9;letter-spacing:-3px;background:linear-gradient(135deg,#ec4899 0%,#a855f7 50%,#22d3ee 100%);-webkit-background-clip:text;background-clip:text;color:transparent;font-family:'Space Grotesk',sans-serif;text-transform:uppercase}
.sub{color:#fff;font-size:16pt;margin-top:12px;font-weight:500;letter-spacing:.5px}
.tag-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.contact-tag{display:inline-block;background:rgba(255,255,255,.08);color:#e5e7eb;padding:5px 12px;border-radius:20px;font-size:9pt;font-weight:500;border:1px solid rgba(255,255,255,.1)}
h2{color:#fff;font-size:11pt;text-transform:uppercase;letter-spacing:4px;margin:32px 0 14px;font-weight:800;position:relative;padding-left:24px;z-index:1}
h2:before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:14px;height:14px;border-radius:3px;background:linear-gradient(135deg,#ec4899,#22d3ee)}
.summary{position:relative;z-index:1;font-size:13pt;color:#f3f4f6;margin:24px 0 16px;line-height:1.6;padding:18px 22px;background:linear-gradient(135deg,rgba(236,72,153,.1) 0%,rgba(34,211,238,.08) 100%);border-radius:14px;border:1px solid rgba(255,255,255,.08);font-weight:400}
.card{position:relative;z-index:1;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px 20px;margin:10px 0;transition:all .3s}
.card:hover{border-color:#ec4899}
.row{display:flex;justify-content:space-between;gap:16px;align-items:baseline;margin-bottom:6px}
.role-t{font-weight:800;color:#fff;font-size:13pt;letter-spacing:-.2px}
.org{background:linear-gradient(135deg,#ec4899,#22d3ee);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700;font-size:11pt}
.period{color:#9ca3af;font-size:9.5pt;font-weight:600;white-space:nowrap;font-family:'JetBrains Mono',monospace;background:rgba(255,255,255,.06);padding:3px 9px;border-radius:6px}
ul{margin:6px 0 0;padding-left:18px;color:#d1d5db}
li{margin:3px 0;font-size:10.5pt}
li::marker{color:#ec4899}
.tag{display:inline-block;background:linear-gradient(135deg,rgba(236,72,153,.2),rgba(34,211,238,.2));color:#fff;padding:4px 11px;border-radius:8px;font-size:9.5pt;margin:3px 4px 3px 0;font-weight:600;border:1px solid rgba(236,72,153,.3)}
.cat{color:#22d3ee;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;font-size:9.5pt;margin:10px 0 4px}
</style></head><body>
<div class="page">
  <div class="hdr">
    ${_p.avatarUrl ? `<img class="avatar" src="${_p.avatarUrl}" />` : ""}
    <h1>${head}</h1>
    ${_p.headline ? `<div class="sub">${_p.headline}</div>` : ""}
    <div class="tag-row" style="clear:both;padding-top:14px">${contact.map(x=>`<span class="contact-tag">${x}</span>`).join("")}</div>
  </div>
  ${c.summary ? `<p class="summary">${c.summary}</p>` : ""}
  ${(c.experience||[]).length ? `<h2>Experience</h2>${c.experience.map((e:any)=>`
    <div class="card"><div class="row"><span><span class="role-t">${e.title}</span> · <span class="org">${e.org||""}</span></span><span class="period">${e.period||""}</span></div>
    <ul>${expBullets(e)}</ul></div>`).join("")}` : ""}
  ${(c.ventures||[]).length ? `<h2>Ventures</h2>${c.ventures.map((v:any)=>`
    <div class="card"><div class="row"><span><span class="role-t">${v.name}</span> · <span class="org">${v.role||""}</span></span><span class="period">${v.period||""}</span></div>
    <p style="margin:6px 0;color:#d1d5db">${v.summary||""}</p>${(v.highlights||[]).length?`<ul>${v.highlights.map((h:string)=>`<li>${h}</li>`).join("")}</ul>`:""}</div>`).join("")}` : ""}
  ${(c.skills||[]).length ? `<h2>Skills</h2>${c.skills.map((s:any)=>`<div class="cat">${s.category||""}</div>${(s.items||[]).map((i:string)=>`<span class="tag">${i}</span>`).join("")}`).join("")}` : ""}
  ${(c.education||[]).length ? `<h2>Education</h2>${c.education.map((e:any)=>`<div class="card"><div class="row"><span><span class="role-t">${e.degree}</span> — <span class="org">${e.institution||""}</span></span><span class="period">${e.period||""}</span></div></div>`).join("")}` : ""}
  ${(c.languages||[]).length ? `<h2>Languages</h2><div>${c.languages.map((l:any)=>`<span class="tag">${l.name} · ${l.level||""}</span>`).join("")}</div>` : ""}
  ${(c.achievements||[]).length ? `<h2>Achievements</h2><ul>${c.achievements.map((a:string)=>`<li>${a}</li>`).join("")}</ul>` : ""}
  ${(c.pressAndAwards||[]).length ? `<h2>Press &amp; Awards</h2><ul>${c.pressAndAwards.map((a:any)=>`<li><strong style="color:#fff">${a.title}</strong> — <em style="color:#22d3ee">${a.source||""}</em> <span style="color:#9ca3af">(${a.year||""})</span></li>`).join("")}</ul>` : ""}
</div>
</body></html>`)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. DESIGNER — Asymmetric vertical color strip, oversized typography
    // ════════════════════════════════════════════════════════════════════════
    if (th === "designer") {
      return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Inter',sans-serif;background:#fff;color:#111;margin:0;padding:0;line-height:1.55;font-size:10.5pt}
.page{display:grid;grid-template-columns:80px 1fr;min-height:100vh}
.strip{background:linear-gradient(180deg,#f97316 0%,#ef4444 50%,#ec4899 100%);position:relative;writing-mode:vertical-rl;color:#fff;padding:30px 0;text-align:center}
.strip .name-vert{font-family:'Bebas Neue',sans-serif;font-size:40pt;letter-spacing:6px;margin:0 auto;text-transform:uppercase;text-orientation:mixed;writing-mode:vertical-rl;line-height:1}
.strip .label{font-size:8pt;letter-spacing:4px;text-transform:uppercase;font-weight:700;margin-top:auto;writing-mode:vertical-rl;text-orientation:mixed;opacity:.85}
.main{padding:40px 50px 50px;background:#fff}
.hdr{display:flex;gap:24px;align-items:flex-end;border-bottom:6px solid #111;padding-bottom:22px;margin-bottom:28px}
.avatar{width:120px;height:120px;border-radius:0;object-fit:cover;flex:0 0 120px;border:6px solid #111;filter:grayscale(.2) contrast(1.05)}
.hdr-text{flex:1}
h1{margin:0;font-family:'Bebas Neue',sans-serif;font-size:54pt;color:#111;letter-spacing:-1px;line-height:.95;text-transform:uppercase}
.sub{color:#f97316;font-size:13pt;margin-top:6px;font-weight:700;text-transform:uppercase;letter-spacing:2px}
.contact{color:#666;font-size:9.5pt;margin-top:10px;font-family:'JetBrains Mono',monospace}
h2{font-family:'Bebas Neue',sans-serif;font-size:22pt;color:#111;letter-spacing:1px;margin:30px 0 12px;text-transform:uppercase;display:flex;align-items:center;gap:14px}
h2:before{content:"";display:inline-block;width:30px;height:6px;background:linear-gradient(90deg,#f97316,#ec4899);flex-shrink:0}
.summary{font-size:14pt;color:#111;margin:0 0 18px;line-height:1.55;font-weight:500;padding-left:20px;border-left:6px solid #f97316}
.row{display:flex;justify-content:space-between;gap:16px;align-items:baseline;margin-top:14px;padding-top:14px;border-top:1px dashed #ddd}
.row:first-of-type{border-top:none;padding-top:0}
.role-t{font-weight:800;color:#111;font-size:13pt;text-transform:uppercase;letter-spacing:.3px}
.org{color:#ef4444;font-weight:700;font-size:11.5pt;text-transform:uppercase;letter-spacing:.5px}
.period{color:#fff;background:#111;font-size:8.5pt;font-weight:700;white-space:nowrap;padding:4px 11px;letter-spacing:1.5px;font-family:'JetBrains Mono',monospace}
ul{margin:6px 0 4px;padding-left:0;list-style:none}
li{margin:4px 0;padding-left:22px;position:relative;font-size:10.5pt}
li:before{content:"▸";position:absolute;left:0;color:#f97316;font-weight:700}
.tag{display:inline-block;background:#111;color:#fff;padding:4px 10px;font-size:9pt;margin:3px 4px 3px 0;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.tag.alt{background:#f97316}
.tag.alt2{background:#ec4899}
.cat{font-family:'Bebas Neue',sans-serif;color:#111;font-size:14pt;text-transform:uppercase;letter-spacing:2px;margin:14px 0 6px;border-bottom:2px solid #111;padding-bottom:3px}
</style></head><body>
<div class="page">
  <aside class="strip">
    <div class="name-vert">${(_p.fullName || cv.name).split(" ").slice(-1)[0] || ""}</div>
  </aside>
  <main class="main">
    <div class="hdr">
      ${_p.avatarUrl ? `<img class="avatar" src="${_p.avatarUrl}" />` : ""}
      <div class="hdr-text">
        <h1>${head}</h1>
        ${_p.headline ? `<div class="sub">${_p.headline}</div>` : ""}
        <div class="contact">${contact.join("  ·  ")}</div>
      </div>
    </div>
    ${c.summary ? `<p class="summary">${c.summary}</p>` : ""}
    ${(c.experience||[]).length ? `<h2>Experience</h2>${c.experience.map((e:any)=>`
      <div class="row"><span><span class="role-t">${e.title}</span> · <span class="org">${e.org||""}</span></span><span class="period">${e.period||""}</span></div>
      <ul>${expBullets(e)}</ul>`).join("")}` : ""}
    ${(c.ventures||[]).length ? `<h2>Ventures</h2>${c.ventures.map((v:any)=>`
      <div class="row"><span><span class="role-t">${v.name}</span> · <span class="org">${v.role||""}</span></span><span class="period">${v.period||""}</span></div>
      <p style="margin:6px 0">${v.summary||""}</p>${(v.highlights||[]).length?`<ul>${v.highlights.map((h:string)=>`<li>${h}</li>`).join("")}</ul>`:""}`).join("")}` : ""}
    ${(c.skills||[]).length ? `<h2>Skills</h2>${c.skills.map((s:any,si:number)=>`<div class="cat">${s.category||""}</div>${(s.items||[]).map((i:string,ii:number)=>`<span class="tag${(ii%3===1)?' alt':(ii%3===2)?' alt2':''}">${i}</span>`).join("")}`).join("")}` : ""}
    ${(c.education||[]).length ? `<h2>Education</h2>${c.education.map((e:any)=>`<div class="row"><span><span class="role-t">${e.degree}</span> — <span class="org">${e.institution||""}</span></span><span class="period">${e.period||""}</span></div>`).join("")}` : ""}
    ${(c.languages||[]).length ? `<h2>Languages</h2>${c.languages.map((l:any,i:number)=>`<span class="tag${i%2?' alt':''}">${l.name} · ${l.level||""}</span>`).join("")}` : ""}
    ${(c.achievements||[]).length ? `<h2>Achievements</h2><ul>${c.achievements.map((a:string)=>`<li>${a}</li>`).join("")}</ul>` : ""}
    ${(c.pressAndAwards||[]).length ? `<h2>Press &amp; Awards</h2><ul>${c.pressAndAwards.map((a:any)=>`<li><strong>${a.title}</strong> — <em style="color:#ef4444">${a.source||""}</em> (${a.year||""})</li>`).join("")}</ul>` : ""}
  </main>
</div>
</body></html>`)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. STARTUP — Terminal/tech aesthetic, dark mode, neon green, monospace tags
    // ════════════════════════════════════════════════════════════════════════
    if (th === "startup") {
      return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Inter',sans-serif;background:#0d1117;color:#c9d1d9;margin:0;padding:0;line-height:1.6;font-size:10.5pt}
.page{max-width:880px;margin:0 auto;padding:50px 60px;min-height:100vh}
.terminal{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:18px 22px;margin-bottom:26px;font-family:'JetBrains Mono',monospace;font-size:9.5pt;color:#7ee787;position:relative;overflow:hidden}
.terminal:before{content:"● ● ●";position:absolute;top:8px;left:14px;color:#30363d;font-size:8pt;letter-spacing:6px}
.terminal-body{margin-top:18px}
.terminal .prompt{color:#58a6ff}
.terminal .cmd{color:#7ee787}
.terminal .out{color:#c9d1d9}
.hdr{display:flex;gap:26px;align-items:center;padding:24px 0 10px}
.avatar{width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid #7ee787;flex:0 0 120px;box-shadow:0 0 30px rgba(126,231,135,.3)}
.hdr-text{flex:1}
h1{margin:0;font-size:32pt;color:#fff;letter-spacing:-1px;font-weight:800;font-family:'Inter',sans-serif}
h1 .at{color:#7ee787;font-family:'JetBrains Mono',monospace;font-weight:400;font-size:24pt}
.sub{color:#7ee787;font-size:11.5pt;margin-top:4px;font-family:'JetBrains Mono',monospace}
.contact{color:#8b949e;font-size:9.5pt;margin-top:8px;font-family:'JetBrains Mono',monospace}
.contact span{margin-right:16px}
.contact span:before{content:"// ";color:#6e7681}
h2{color:#fff;font-size:13pt;margin:28px 0 12px;font-family:'JetBrains Mono',monospace;font-weight:700}
h2:before{content:"## ";color:#7ee787;font-weight:400}
.summary{font-size:11pt;color:#c9d1d9;margin:0 0 18px;padding:16px 20px;background:#161b22;border-left:3px solid #7ee787;border-radius:0 6px 6px 0;line-height:1.65}
.summary:before{content:"/* ";color:#7ee787;font-family:'JetBrains Mono',monospace;font-weight:700}
.summary:after{content:" */";color:#7ee787;font-family:'JetBrains Mono',monospace;font-weight:700}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px 20px;margin:10px 0}
.card:hover{border-color:#7ee787}
.row{display:flex;justify-content:space-between;gap:14px;align-items:baseline;margin-bottom:6px}
.role-t{font-weight:700;color:#fff;font-size:12pt}
.org{color:#58a6ff;font-weight:600;font-family:'JetBrains Mono',monospace;font-size:10.5pt}
.period{color:#7ee787;font-size:9pt;font-weight:600;white-space:nowrap;font-family:'JetBrains Mono',monospace;background:rgba(126,231,135,.1);padding:3px 9px;border-radius:4px;border:1px solid rgba(126,231,135,.25)}
ul{margin:6px 0 0;padding-left:0;list-style:none}
li{margin:4px 0;padding-left:18px;position:relative;color:#c9d1d9}
li:before{content:"▸";position:absolute;left:0;color:#7ee787;font-family:'JetBrains Mono',monospace}
.tag{display:inline-block;background:rgba(88,166,255,.12);color:#79c0ff;padding:3px 9px;border-radius:4px;font-size:9pt;margin:2px 4px 2px 0;font-weight:500;border:1px solid rgba(88,166,255,.25);font-family:'JetBrains Mono',monospace}
.tag.g{background:rgba(126,231,135,.12);color:#7ee787;border-color:rgba(126,231,135,.25)}
.cat{color:#fff;font-weight:700;font-size:10pt;margin:10px 0 4px;font-family:'JetBrains Mono',monospace}
.cat:before{content:"const ";color:#ff7b72}
.cat:after{content:" = ";color:#ff7b72}
</style></head><body>
<div class="page">
  <div class="terminal">
    <div class="terminal-body">
      <div><span class="prompt">$</span> <span class="cmd">whoami</span></div>
      <div class="out">${head} — ${_p.headline || "Builder"}</div>
      <div><span class="prompt">$</span> <span class="cmd">cat ./profile.txt</span></div>
      <div class="out">${contact.join("  |  ")}</div>
    </div>
  </div>
  <div class="hdr">
    ${_p.avatarUrl ? `<img class="avatar" src="${_p.avatarUrl}" />` : ""}
    <div class="hdr-text">
      <h1>${head} <span class="at">_</span></h1>
      ${_p.headline ? `<div class="sub">// ${_p.headline}</div>` : ""}
      <div class="contact">${contact.map(x=>`<span>${x}</span>`).join("")}</div>
    </div>
  </div>
  ${c.summary ? `<p class="summary">${c.summary}</p>` : ""}
  ${(c.experience||[]).length ? `<h2>experience</h2>${c.experience.map((e:any)=>`
    <div class="card"><div class="row"><span><span class="role-t">${e.title}</span> <span class="org">@ ${e.org||""}</span></span><span class="period">${e.period||""}</span></div>
    <ul>${expBullets(e)}</ul></div>`).join("")}` : ""}
  ${(c.ventures||[]).length ? `<h2>ventures</h2>${c.ventures.map((v:any)=>`
    <div class="card"><div class="row"><span><span class="role-t">${v.name}</span> <span class="org">@ ${v.role||""}</span></span><span class="period">${v.period||""}</span></div>
    <p style="margin:6px 0">${v.summary||""}</p>${(v.highlights||[]).length?`<ul>${v.highlights.map((h:string)=>`<li>${h}</li>`).join("")}</ul>`:""}</div>`).join("")}` : ""}
  ${(c.skills||[]).length ? `<h2>stack</h2>${c.skills.map((s:any)=>`<div class="cat">${(s.category||"").toLowerCase().replace(/\s+/g,"_")}</div>${(s.items||[]).map((i:string,ii:number)=>`<span class="tag${ii%2?' g':''}">${i}</span>`).join("")}`).join("")}` : ""}
  ${(c.education||[]).length ? `<h2>education</h2>${c.education.map((e:any)=>`<div class="card"><div class="row"><span><span class="role-t">${e.degree}</span> <span class="org">@ ${e.institution||""}</span></span><span class="period">${e.period||""}</span></div></div>`).join("")}` : ""}
  ${(c.languages||[]).length ? `<h2>languages</h2><div>${c.languages.map((l:any)=>`<span class="tag g">${l.name}::${(l.level||"").toLowerCase().replace(/\s+/g,"_")}</span>`).join("")}</div>` : ""}
  ${(c.achievements||[]).length ? `<h2>achievements</h2><ul>${c.achievements.map((a:string)=>`<li>${a}</li>`).join("")}</ul>` : ""}
  ${(c.pressAndAwards||[]).length ? `<h2>press</h2><ul>${c.pressAndAwards.map((a:any)=>`<li><strong style="color:#fff">${a.title}</strong> — <em style="color:#79c0ff">${a.source||""}</em> <span style="color:#8b949e">(${a.year||""})</span></li>`).join("")}</ul>` : ""}
</div>
</body></html>`)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. CORPORATE — Classic Times serif, deep navy, traditional formal
    // ════════════════════════════════════════════════════════════════════════
    if (th === "corporate") {
      return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Georgia,'Times New Roman',serif;background:#fff;color:#1f2937;margin:0;padding:60px 80px;max-width:880px;margin:0 auto;line-height:1.6;font-size:11pt}
.hdr{text-align:center;padding-bottom:18px;margin-bottom:24px;border-top:4px double #1e3a8a;border-bottom:4px double #1e3a8a;padding-top:22px}
.avatar{width:100px;height:100px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 14px;border:2px solid #1e3a8a}
h1{margin:0;font-size:30pt;color:#1e3a8a;letter-spacing:1px;font-weight:700;font-family:'Playfair Display',Georgia,serif}
.sub{color:#374151;font-size:13pt;font-style:italic;margin-top:6px}
.contact{color:#4b5563;font-size:10.5pt;margin-top:10px}
.contact span{margin:0 8px}
h2{color:#1e3a8a;font-size:13pt;text-transform:uppercase;letter-spacing:3px;margin:24px 0 10px;font-weight:700;border-bottom:2px solid #1e3a8a;padding-bottom:5px;font-family:Georgia,serif}
.summary{font-size:11.5pt;color:#1f2937;margin:0 0 18px;font-style:italic;text-align:justify;line-height:1.7;text-indent:24pt}
.row{display:flex;justify-content:space-between;gap:14px;align-items:baseline;margin-top:14px}
.role-t{font-weight:700;color:#111827;font-size:12pt}
.org{color:#1e3a8a;font-style:italic;font-weight:600}
.period{color:#6b7280;font-size:10pt;font-style:italic;white-space:nowrap}
ul{margin:5px 0 10px;padding-left:22px}
li{margin:3px 0;text-align:justify}
.skill-block{margin:6px 0}
.skill-cat{font-weight:700;color:#1e3a8a;display:inline;font-style:italic}
.tag{display:inline;color:#1f2937;font-size:11pt;margin-right:8px}
.tag:not(:last-child):after{content:" •";color:#1e3a8a}
@media print{body{padding:50px 60px}}
</style></head><body>
<div class="hdr">
  ${_p.avatarUrl ? `<img class="avatar" src="${_p.avatarUrl}" />` : ""}
  <h1>${head}</h1>
  ${_p.headline ? `<div class="sub">${_p.headline}</div>` : ""}
  <div class="contact">${contact.map(x=>`<span>${x}</span>`).join(" • ")}</div>
</div>
${c.summary ? `<h2>Profile</h2><p class="summary">${c.summary}</p>` : ""}
${(c.experience||[]).length ? `<h2>Professional Experience</h2>${c.experience.map((e:any)=>`
  <div class="row"><span><span class="role-t">${e.title}</span>, <span class="org">${e.org||""}</span></span><span class="period">${e.period||""}</span></div>
  <ul>${expBullets(e)}</ul>`).join("")}` : ""}
${(c.ventures||[]).length ? `<h2>Entrepreneurial Ventures</h2>${c.ventures.map((v:any)=>`
  <div class="row"><span><span class="role-t">${v.name}</span>, <span class="org">${v.role||""}</span></span><span class="period">${v.period||""}</span></div>
  <p>${v.summary||""}</p>${(v.highlights||[]).length?`<ul>${v.highlights.map((h:string)=>`<li>${h}</li>`).join("")}</ul>`:""}`).join("")}` : ""}
${(c.education||[]).length ? `<h2>Education</h2>${c.education.map((e:any)=>`<div class="row"><span><span class="role-t">${e.degree}</span>, <span class="org">${e.institution||""}</span></span><span class="period">${e.period||""}</span></div>`).join("")}` : ""}
${(c.skills||[]).length ? `<h2>Areas of Expertise</h2>${c.skills.map((s:any)=>`<div class="skill-block"><span class="skill-cat">${s.category||""}:</span> ${(s.items||[]).map((i:string)=>`<span class="tag">${i}</span>`).join("")}</div>`).join("")}` : ""}
${(c.languages||[]).length ? `<h2>Languages</h2><p>${c.languages.map((l:any)=>`<strong>${l.name}</strong> <em>(${l.level||""})</em>`).join(" • ")}</p>` : ""}
${(c.achievements||[]).length ? `<h2>Notable Achievements</h2><ul>${c.achievements.map((a:string)=>`<li>${a}</li>`).join("")}</ul>` : ""}
${(c.pressAndAwards||[]).length ? `<h2>Honors &amp; Press</h2><ul>${c.pressAndAwards.map((a:any)=>`<li><strong>${a.title}</strong>, <em>${a.source||""}</em> (${a.year||""})</li>`).join("")}</ul>` : ""}
</body></html>`)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 7. CREATIVE — Editorial magazine, drop cap, warm cream, two-column body
    // ════════════════════════════════════════════════════════════════════════
    if (th === "creative") {
      return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Playfair Display',Georgia,serif;background:#fdf6e3;color:#1c1917;margin:0;padding:0;line-height:1.65;font-size:11pt}
.page{max-width:880px;margin:0 auto;padding:0;background:#fdf6e3}
.masthead{background:#1c1917;color:#fdf6e3;padding:30px 60px 24px;border-bottom:8px solid #f59e0b;display:flex;align-items:center;gap:24px}
.avatar{width:130px;height:130px;border-radius:50%;object-fit:cover;border:5px solid #f59e0b;flex:0 0 130px;filter:sepia(.15) saturate(1.1)}
.masthead-text{flex:1}
.issue{color:#f59e0b;font-size:9pt;text-transform:uppercase;letter-spacing:5px;margin-bottom:6px;font-family:'Inter',sans-serif;font-weight:700}
h1{margin:0;font-size:48pt;color:#fdf6e3;font-family:'Playfair Display',serif;line-height:.95;font-weight:900;letter-spacing:-1.5px}
.tagline{color:#fbbf24;font-size:13pt;font-style:italic;margin-top:8px;font-family:'Playfair Display',serif}
.contact{color:#d6d3d1;font-size:9pt;margin-top:12px;font-family:'Inter',sans-serif;letter-spacing:1px;text-transform:uppercase}
.body{padding:36px 60px}
h2{color:#1c1917;font-size:11pt;text-transform:uppercase;letter-spacing:5px;margin:30px 0 12px;font-weight:800;font-family:'Inter',sans-serif;border-top:3px double #f59e0b;border-bottom:1px solid #1c1917;padding:8px 0;text-align:center;background:linear-gradient(180deg,transparent 50%,#f59e0b22 100%)}
.summary{font-size:13pt;color:#1c1917;margin:0 0 24px;line-height:1.75;column-count:2;column-gap:36px;column-rule:1px solid #f59e0b;font-family:'Playfair Display',serif}
.summary:first-letter{font-family:'DM Serif Display',serif;font-size:62pt;float:left;line-height:.85;margin:8px 10px 0 0;color:#f59e0b;font-weight:700}
.row{display:flex;justify-content:space-between;gap:16px;align-items:baseline;margin-top:18px;padding-bottom:6px;border-bottom:1px dotted #d6d3d1}
.role-t{font-weight:700;color:#1c1917;font-size:13pt;font-family:'Playfair Display',serif}
.org{color:#b45309;font-style:italic;font-weight:600}
.period{color:#78716c;font-size:9pt;font-family:'Inter',sans-serif;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;font-weight:600}
ul{margin:8px 0 12px;padding-left:0;list-style:none}
li{margin:5px 0;padding-left:24px;position:relative;font-family:'Inter',sans-serif;font-size:10.5pt;line-height:1.55}
li:before{content:"◆";position:absolute;left:0;color:#f59e0b;font-size:11pt}
.tag{display:inline-block;background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:0;font-size:9.5pt;margin:3px 4px 3px 0;font-weight:600;border:1px solid #f59e0b66;font-family:'Inter',sans-serif}
.cat{font-family:'Playfair Display',serif;color:#1c1917;font-size:13pt;font-style:italic;font-weight:700;margin:14px 0 6px}
.cat:before{content:"§ ";color:#f59e0b}
.cols-2{column-count:2;column-gap:30px}
@media print{.body{padding:30px 50px}.masthead{padding:24px 50px 20px}}
</style></head><body>
<div class="page">
  <header class="masthead">
    ${_p.avatarUrl ? `<img class="avatar" src="${_p.avatarUrl}" />` : ""}
    <div class="masthead-text">
      <div class="issue">— Vol. I · The Portfolio —</div>
      <h1>${head}</h1>
      ${_p.headline ? `<div class="tagline">"${_p.headline}"</div>` : ""}
      <div class="contact">${contact.join(" · ")}</div>
    </div>
  </header>
  <div class="body">
    ${c.summary ? `<p class="summary">${c.summary}</p>` : ""}
    ${(c.experience||[]).length ? `<h2>The Career Chronicles</h2>${c.experience.map((e:any)=>`
      <div class="row"><span><span class="role-t">${e.title}</span> · <span class="org">${e.org||""}</span></span><span class="period">${e.period||""}</span></div>
      <ul>${expBullets(e)}</ul>`).join("")}` : ""}
    ${(c.ventures||[]).length ? `<h2>Ventures &amp; Studios</h2>${c.ventures.map((v:any)=>`
      <div class="row"><span><span class="role-t">${v.name}</span> · <span class="org">${v.role||""}</span></span><span class="period">${v.period||""}</span></div>
      <p style="font-style:italic;font-family:'Playfair Display',serif">${v.summary||""}</p>${(v.highlights||[]).length?`<ul>${v.highlights.map((h:string)=>`<li>${h}</li>`).join("")}</ul>`:""}`).join("")}` : ""}
    ${(c.skills||[]).length ? `<h2>The Craft</h2><div class="cols-2">${c.skills.map((s:any)=>`<div class="cat">${s.category||""}</div>${(s.items||[]).map((i:string)=>`<span class="tag">${i}</span>`).join("")}`).join("")}</div>` : ""}
    ${(c.education||[]).length ? `<h2>Schooling</h2>${c.education.map((e:any)=>`<div class="row"><span><span class="role-t">${e.degree}</span> — <span class="org">${e.institution||""}</span></span><span class="period">${e.period||""}</span></div>`).join("")}` : ""}
    ${(c.languages||[]).length ? `<h2>Tongues Spoken</h2><p style="text-align:center;font-style:italic;font-size:13pt">${c.languages.map((l:any)=>`<strong>${l.name}</strong> <em style="color:#78716c">(${l.level||""})</em>`).join(" &nbsp;◆&nbsp; ")}</p>` : ""}
    ${(c.achievements||[]).length ? `<h2>Distinguished Acts</h2><ul class="cols-2">${c.achievements.map((a:string)=>`<li>${a}</li>`).join("")}</ul>` : ""}
    ${(c.pressAndAwards||[]).length ? `<h2>Acclaim &amp; Press</h2><ul>${c.pressAndAwards.map((a:any)=>`<li><strong>${a.title}</strong> — <em style="color:#b45309">${a.source||""}</em> <span style="color:#78716c">(${a.year||""})</span></li>`).join("")}</ul>` : ""}
  </div>
</div>
</body></html>`)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 9. EDITORIAL — Premium magazine spread, oversized serif headline, color-blocked sections
    // ════════════════════════════════════════════════════════════════════════
    if (th === "editorial") {
      return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Inter',sans-serif;background:#faf7f2;color:#1a1a1a;margin:0;line-height:1.6;font-size:10.5pt}
.page{width:210mm;min-height:297mm;margin:0 auto;background:#faf7f2;position:relative}
.masthead{background:#1a1a1a;color:#faf7f2;padding:24mm 18mm 18mm 18mm;position:relative;overflow:hidden}
.masthead::before{content:"";position:absolute;top:8mm;left:18mm;right:18mm;height:1px;background:#c8a45c;opacity:.6}
.issue{font-family:'JetBrains Mono',monospace;font-size:8pt;letter-spacing:4pt;color:#c8a45c;text-transform:uppercase;margin-bottom:8mm}
.name{font-family:'Playfair Display',serif;font-size:54pt;font-weight:900;line-height:.95;letter-spacing:-2pt;margin:0 0 6mm 0}
.headline{font-family:'Cormorant Garamond',serif;font-size:18pt;font-weight:400;font-style:italic;color:#e8dcc4;line-height:1.3;max-width:140mm;margin:0 0 8mm 0}
.contact{display:flex;flex-wrap:wrap;gap:14mm;font-family:'JetBrains Mono',monospace;font-size:8.5pt;letter-spacing:1pt;color:#c8a45c;text-transform:uppercase}
.body{padding:14mm 18mm 18mm 18mm}
.lead{font-family:'Cormorant Garamond',serif;font-size:16pt;line-height:1.55;color:#2a2a2a;border-left:4px solid #c8a45c;padding-left:12mm;margin:0 0 14mm 0;font-style:italic}
.lead::first-letter{font-family:'Playfair Display',serif;font-size:42pt;font-weight:900;float:left;line-height:.85;margin:2mm 4mm 0 0;color:#1a1a1a}
h2{font-family:'JetBrains Mono',monospace;font-size:9pt;font-weight:700;letter-spacing:5pt;text-transform:uppercase;color:#1a1a1a;margin:14mm 0 6mm 0;padding-bottom:3mm;border-bottom:2px solid #1a1a1a;display:flex;align-items:baseline;gap:6mm}
h2::after{content:"";flex:1;height:1px;background:#c8a45c;margin-left:auto}
.exp{display:grid;grid-template-columns:48mm 1fr;gap:8mm;margin-bottom:9mm;padding-bottom:9mm;border-bottom:1px solid #e0d8c8}
.exp:last-child{border-bottom:0}
.exp .meta{font-family:'JetBrains Mono',monospace;font-size:8pt;letter-spacing:1.5pt;color:#8b7d5e;text-transform:uppercase;line-height:1.6}
.exp .meta strong{display:block;color:#1a1a1a;font-size:9pt;letter-spacing:2pt;margin-bottom:2mm}
.exp .role{font-family:'Playfair Display',serif;font-size:18pt;font-weight:700;color:#1a1a1a;margin:0 0 1mm 0;line-height:1.15}
.exp .org{font-family:'Cormorant Garamond',serif;font-size:13pt;font-style:italic;color:#c8a45c;margin:0 0 4mm 0}
.exp ul{margin:3mm 0 0 0;padding-left:5mm}
.exp li{margin-bottom:2mm;line-height:1.55}
.skills-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6mm 12mm}
.skill-cat{font-family:'JetBrains Mono',monospace;font-size:8pt;letter-spacing:2pt;color:#8b7d5e;text-transform:uppercase;margin-bottom:2mm}
.skill-items{font-size:10pt;line-height:1.7}
.tag{display:inline-block;background:#1a1a1a;color:#faf7f2;padding:1mm 3mm;margin:1mm 1mm 1mm 0;font-family:'JetBrains Mono',monospace;font-size:7.5pt;letter-spacing:1pt;text-transform:uppercase}
.langs{display:flex;flex-wrap:wrap;gap:8mm;font-family:'Cormorant Garamond',serif;font-size:14pt;font-style:italic}
.langs strong{font-style:normal;color:#c8a45c;font-weight:700}
.foot{position:absolute;bottom:8mm;left:18mm;right:18mm;font-family:'JetBrains Mono',monospace;font-size:7pt;letter-spacing:3pt;color:#8b7d5e;text-transform:uppercase;display:flex;justify-content:space-between;border-top:1px solid #c8a45c;padding-top:4mm}
</style></head><body>
<div class="page">
  <div class="masthead">
    <div class="issue">Vol. I &middot; The Portfolio &middot; ${new Date().getFullYear()}</div>
    <h1 class="name">${head}</h1>
    ${_p.headline ? `<p class="headline">${_p.headline}</p>` : ""}
    <div class="contact">${contact.map(c=>`<span>${c}</span>`).join("")}</div>
  </div>
  <div class="body">
    ${c.summary ? `<p class="lead">${c.summary}</p>` : ""}
    ${(c.experience||[]).length ? `<h2>Professional Experience</h2>${c.experience.map((e:any)=>`<div class="exp"><div class="meta"><strong>${e.period||""}</strong>${e.location||""}</div><div><h3 class="role">${e.title||""}</h3><div class="org">${e.org||""}</div><ul>${(e.bullets||[]).map((b:string)=>`<li>${b}</li>`).join("")}</ul></div></div>`).join("")}` : ""}
    ${(c.ventures||[]).length ? `<h2>Entrepreneurial Ventures</h2>${c.ventures.map((v:any)=>`<div class="exp"><div class="meta"><strong>${v.period||""}</strong>${v.role||""}</div><div><h3 class="role">${v.name||""}</h3>${v.summary?`<p style="margin:0 0 3mm 0;font-style:italic;color:#5a5a5a">${v.summary}</p>`:""}<ul>${(v.highlights||[]).map((h:string)=>`<li>${h}</li>`).join("")}</ul></div></div>`).join("")}` : ""}
    ${(c.skills||[]).length ? `<h2>Areas of Expertise</h2><div class="skills-grid">${c.skills.map((s:any)=>`<div><div class="skill-cat">${s.category}</div><div class="skill-items">${(s.items||[]).join(" · ")}</div></div>`).join("")}</div>` : ""}
    ${(c.education||[]).length ? `<h2>Education</h2>${c.education.map((e:any)=>`<div class="exp"><div class="meta"><strong>${e.period||""}</strong>${e.institution||""}</div><div><h3 class="role">${e.degree||""}</h3>${e.notes?`<p style="margin:0;color:#5a5a5a">${e.notes}</p>`:""}</div></div>`).join("")}` : ""}
    ${(c.languages||[]).length ? `<h2>Languages</h2><div class="langs">${c.languages.map((l:any)=>`<span><strong>${l.name}</strong> ${l.level||""}</span>`).join("")}</div>` : ""}
    ${(c.achievements||[]).length ? `<h2>Notable Achievements</h2><ul style="columns:2;column-gap:14mm">${c.achievements.map((a:string)=>`<li style="margin-bottom:2mm">${a}</li>`).join("")}</ul>` : ""}
    ${(c.pressAndAwards||[]).length ? `<h2>Honors &amp; Press</h2><ul>${c.pressAndAwards.map((a:any)=>`<li><strong>${a.title}</strong> — <em style="color:#c8a45c">${a.source||""}</em> <span style="color:#8b7d5e">(${a.year||""})</span></li>`).join("")}</ul>` : ""}
  </div>
  <div class="foot"><span>${head}</span><span>Page 01</span></div>
</div>
</body></html>`)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 10. BOLD CREATIVE — Vibrant infographic hero, oversized metrics, color blocks
    // ════════════════════════════════════════════════════════════════════════
    if (th === "boldcreative") {
      return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Space Grotesk','Inter',sans-serif;background:#fff;color:#0a0a0a;margin:0;line-height:1.5;font-size:10pt}
.page{width:210mm;min-height:297mm;margin:0 auto;background:#fff}
.hero{background:linear-gradient(135deg,#ff5722 0%,#ff9800 50%,#ffc107 100%);padding:18mm 16mm;color:#0a0a0a;position:relative;overflow:hidden}
.hero::before{content:"";position:absolute;top:-30mm;right:-30mm;width:80mm;height:80mm;background:#0a0a0a;border-radius:50%;opacity:.08}
.hero::after{content:"";position:absolute;bottom:-20mm;left:40mm;width:60mm;height:60mm;background:#fff;border-radius:50%;opacity:.15}
.label{font-family:'JetBrains Mono',monospace;font-size:7.5pt;letter-spacing:3pt;text-transform:uppercase;background:#0a0a0a;color:#ffc107;display:inline-block;padding:2mm 4mm;margin-bottom:6mm}
.name{font-family:'Bebas Neue',sans-serif;font-size:64pt;font-weight:400;line-height:.92;letter-spacing:-1pt;margin:0 0 4mm 0;color:#0a0a0a;position:relative;z-index:1}
.tag{font-family:'Space Grotesk',sans-serif;font-size:14pt;font-weight:500;line-height:1.35;max-width:130mm;margin:0 0 8mm 0;color:#1a1a1a;position:relative;z-index:1}
.contact{display:flex;flex-wrap:wrap;gap:8mm;font-family:'JetBrains Mono',monospace;font-size:8pt;letter-spacing:1pt;color:#0a0a0a;font-weight:600;position:relative;z-index:1}
.contact span::before{content:"●";color:#0a0a0a;margin-right:3mm}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:0;background:#0a0a0a;color:#fff;padding:0}
.metric{padding:8mm 6mm;border-right:1px solid #2a2a2a;text-align:center}
.metric:last-child{border-right:0}
.metric .num{font-family:'Bebas Neue',sans-serif;font-size:36pt;line-height:1;color:#ffc107;margin-bottom:2mm}
.metric .lbl{font-family:'JetBrains Mono',monospace;font-size:7pt;letter-spacing:2pt;text-transform:uppercase;color:#999}
.body{padding:14mm 16mm 16mm 16mm}
h2{font-family:'Bebas Neue',sans-serif;font-size:24pt;font-weight:400;letter-spacing:1pt;color:#0a0a0a;margin:12mm 0 5mm 0;padding-bottom:2mm;display:inline-block;border-bottom:5px solid #ff5722}
h2:first-of-type{margin-top:0}
.exp{margin-bottom:8mm;padding:6mm;background:#fafafa;border-left:5px solid #ff5722;page-break-inside:avoid}
.exp .row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1mm;flex-wrap:wrap;gap:3mm}
.exp .role{font-family:'Space Grotesk',sans-serif;font-size:15pt;font-weight:700;color:#0a0a0a;margin:0}
.exp .period{font-family:'JetBrains Mono',monospace;font-size:8pt;background:#0a0a0a;color:#ffc107;padding:1mm 3mm;letter-spacing:1pt;font-weight:600}
.exp .org{font-family:'Space Grotesk',sans-serif;font-size:11pt;color:#ff5722;font-weight:600;margin:0 0 4mm 0}
.exp ul{margin:3mm 0 0 0;padding-left:5mm}
.exp li{margin-bottom:2mm;line-height:1.55}
.exp li::marker{color:#ff5722;font-weight:900}
.skills-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
.skill{background:#0a0a0a;color:#fff;padding:5mm;border-top:4px solid #ff5722}
.skill .cat{font-family:'JetBrains Mono',monospace;font-size:7pt;letter-spacing:2pt;text-transform:uppercase;color:#ffc107;margin-bottom:3mm}
.skill .items{font-family:'Space Grotesk',sans-serif;font-size:9.5pt;line-height:1.55;color:#fff}
.langs{display:flex;flex-wrap:wrap;gap:3mm}
.langs span{background:linear-gradient(135deg,#ff5722,#ffc107);color:#0a0a0a;padding:3mm 5mm;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:10pt}
.langs span em{font-style:normal;font-weight:400;opacity:.75;margin-left:2mm;font-size:8.5pt}
.achievement{padding:4mm 5mm;background:#fff8e1;border-left:4px solid #ffc107;margin-bottom:3mm;font-size:10pt;line-height:1.55}
.press{padding:4mm 5mm;background:#0a0a0a;color:#fff;margin-bottom:2mm;font-size:9.5pt;border-left:4px solid #ff5722}
.press strong{color:#ffc107}
.press em{font-style:normal;color:#999;font-family:'JetBrains Mono',monospace;font-size:8pt;letter-spacing:1pt}
</style></head><body>
<div class="page">
  <div class="hero">
    <div class="label">Builder · ${new Date().getFullYear()}</div>
    <h1 class="name">${head}</h1>
    ${_p.headline ? `<p class="tag">${_p.headline}</p>` : ""}
    <div class="contact">${contact.map(c=>`<span>${c}</span>`).join("")}</div>
  </div>
  ${(c.experience||[]).length || (c.ventures||[]).length ? `<div class="metrics">
    <div class="metric"><div class="num">${(c.ventures||[]).length || "—"}</div><div class="lbl">Ventures</div></div>
    <div class="metric"><div class="num">${(c.experience||[]).length || "—"}</div><div class="lbl">Roles</div></div>
    <div class="metric"><div class="num">${(c.skills||[]).reduce((a:number,s:any)=>a+(s.items?.length||0),0) || "—"}</div><div class="lbl">Skills</div></div>
    <div class="metric"><div class="num">${(c.languages||[]).length || "—"}</div><div class="lbl">Languages</div></div>
  </div>` : ""}
  <div class="body">
    ${c.summary ? `<h2>Profile</h2><p style="font-size:11pt;line-height:1.7;margin:0 0 4mm 0">${c.summary}</p>` : ""}
    ${(c.experience||[]).length ? `<h2>Experience</h2>${c.experience.map((e:any)=>`<div class="exp"><div class="row"><h3 class="role">${e.title||""}</h3><span class="period">${e.period||""}</span></div><p class="org">${e.org||""}${e.location?` &nbsp;·&nbsp; ${e.location}`:""}</p><ul>${(e.bullets||[]).map((b:string)=>`<li>${b}</li>`).join("")}</ul></div>`).join("")}` : ""}
    ${(c.ventures||[]).length ? `<h2>Ventures Founded</h2>${c.ventures.map((v:any)=>`<div class="exp"><div class="row"><h3 class="role">${v.name||""}</h3><span class="period">${v.period||""}</span></div><p class="org">${v.role||""}</p>${v.summary?`<p style="margin:0 0 3mm 0;color:#5a5a5a;font-style:italic">${v.summary}</p>`:""}<ul>${(v.highlights||[]).map((h:string)=>`<li>${h}</li>`).join("")}</ul></div>`).join("")}` : ""}
    ${(c.skills||[]).length ? `<h2>Stack</h2><div class="skills-grid">${c.skills.map((s:any)=>`<div class="skill"><div class="cat">${s.category}</div><div class="items">${(s.items||[]).join(" · ")}</div></div>`).join("")}</div>` : ""}
    ${(c.education||[]).length ? `<h2>Education</h2>${c.education.map((e:any)=>`<div class="exp"><div class="row"><h3 class="role">${e.degree||""}</h3><span class="period">${e.period||""}</span></div><p class="org">${e.institution||""}</p>${e.notes?`<p style="margin:0;color:#5a5a5a">${e.notes}</p>`:""}</div>`).join("")}` : ""}
    ${(c.languages||[]).length ? `<h2>Languages</h2><div class="langs">${c.languages.map((l:any)=>`<span>${l.name}<em>${l.level||""}</em></span>`).join("")}</div>` : ""}
    ${(c.achievements||[]).length ? `<h2>Achievements</h2>${c.achievements.map((a:string)=>`<div class="achievement">${a}</div>`).join("")}` : ""}
    ${(c.pressAndAwards||[]).length ? `<h2>Press &amp; Awards</h2>${c.pressAndAwards.map((a:any)=>`<div class="press"><strong>${a.title}</strong> — ${a.source||""} <em>(${a.year||""})</em></div>`).join("")}` : ""}
  </div>
</div>
</body></html>`)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 8. MODERN — Ultra-minimal Inter, big bold name, color-block H2 (default)
    // ════════════════════════════════════════════════════════════════════════
    return addEditMode(rtlPostProcess(translateUi(`<!doctype html><html><head><meta charset="utf-8"><title>${cv.name}</title>${FONTS}
<style>
@page{margin:0;size:A4}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Inter',-apple-system,sans-serif;background:#fff;color:#0a0a0a;margin:0;padding:0;line-height:1.6;font-size:10.5pt;font-weight:400}
.page{max-width:880px;margin:0 auto;padding:64px 72px;background:#fff}
.hdr{display:flex;gap:28px;align-items:center;margin-bottom:36px;padding-bottom:32px;border-bottom:1px solid #e5e5e5;position:relative}
.hdr:after{content:"";position:absolute;bottom:-1px;left:0;width:80px;height:4px;background:#7c3aed;border-radius:2px}
.avatar{width:110px;height:110px;border-radius:50%;object-fit:cover;flex:0 0 110px;border:3px solid #f3f4f6}
.hdr-text{flex:1}
h1{margin:0;font-size:40pt;color:#0a0a0a;letter-spacing:-2px;font-weight:800;line-height:1}
.sub{color:#7c3aed;font-size:13pt;margin-top:8px;font-weight:600}
.contact{color:#666;font-size:9.5pt;margin-top:12px;display:flex;flex-wrap:wrap;gap:18px}
.contact span{display:flex;align-items:center;gap:6px}
.contact span:before{content:"";width:5px;height:5px;background:#7c3aed;border-radius:50%}
h2{display:inline-block;color:#fff;background:#0a0a0a;font-size:11pt;text-transform:uppercase;letter-spacing:3px;margin:32px 0 14px;font-weight:700;padding:6px 14px;border-radius:4px}
h2.accent{background:#7c3aed}
.summary{font-size:13pt;color:#0a0a0a;margin:0 0 12px;line-height:1.65;font-weight:400;max-width:720px}
.row{display:flex;justify-content:space-between;gap:18px;align-items:baseline;margin-top:18px}
.role-t{font-weight:700;color:#0a0a0a;font-size:12pt}
.org{color:#7c3aed;font-weight:600}
.period{color:#9ca3af;font-size:9.5pt;font-weight:500;white-space:nowrap;letter-spacing:.5px}
ul{margin:6px 0 0;padding-left:18px;color:#374151}
li{margin:3px 0;font-size:10.5pt;line-height:1.55}
li::marker{color:#7c3aed}
.tag{display:inline-block;background:#f3f0ff;color:#7c3aed;padding:4px 11px;border-radius:6px;font-size:9.5pt;margin:3px 4px 3px 0;font-weight:600}
.cat{color:#0a0a0a;font-weight:700;font-size:10pt;text-transform:uppercase;letter-spacing:1.5px;margin:12px 0 6px}
.divider{height:1px;background:linear-gradient(90deg,#7c3aed,transparent);margin:20px 0;border:none}
@media print{.page{padding:50px 56px}}
</style></head><body>
<div class="page">
  <div class="hdr">
    ${_p.avatarUrl ? `<img class="avatar" src="${_p.avatarUrl}" />` : ""}
    <div class="hdr-text">
      <h1>${head}</h1>
      ${_p.headline ? `<div class="sub">${_p.headline}</div>` : ""}
      <div class="contact">${contact.map(x=>`<span>${x}</span>`).join("")}</div>
    </div>
  </div>
  ${c.summary ? `<p class="summary">${c.summary}</p>` : ""}
  ${(c.experience||[]).length ? `<h2>Experience</h2>${c.experience.map((e:any)=>`
    <div class="row"><span><span class="role-t">${e.title}</span> · <span class="org">${e.org||""}</span></span><span class="period">${e.period||""}</span></div>
    <ul>${expBullets(e)}</ul>`).join("")}` : ""}
  ${(c.ventures||[]).length ? `<h2 class="accent">Ventures</h2>${c.ventures.map((v:any)=>`
    <div class="row"><span><span class="role-t">${v.name}</span> · <span class="org">${v.role||""}</span></span><span class="period">${v.period||""}</span></div>
    <p style="margin:6px 0;color:#374151">${v.summary||""}</p>${(v.highlights||[]).length?`<ul>${v.highlights.map((h:string)=>`<li>${h}</li>`).join("")}</ul>`:""}`).join("")}` : ""}
  ${(c.skills||[]).length ? `<h2>Skills</h2>${c.skills.map((s:any)=>`<div class="cat">${s.category||""}</div>${(s.items||[]).map((i:string)=>`<span class="tag">${i}</span>`).join("")}`).join("")}` : ""}
  ${(c.education||[]).length ? `<h2 class="accent">Education</h2>${c.education.map((e:any)=>`<div class="row"><span><span class="role-t">${e.degree}</span> — <span class="org">${e.institution||""}</span></span><span class="period">${e.period||""}</span></div>`).join("")}` : ""}
  ${(c.languages||[]).length ? `<h2>Languages</h2><div>${c.languages.map((l:any)=>`<span class="tag">${l.name} · ${l.level||""}</span>`).join("")}</div>` : ""}
  ${(c.achievements||[]).length ? `<h2>Achievements</h2><ul>${c.achievements.map((a:string)=>`<li>${a}</li>`).join("")}</ul>` : ""}
  ${(c.pressAndAwards||[]).length ? `<h2 class="accent">Press &amp; Awards</h2><ul>${c.pressAndAwards.map((a:any)=>`<li><strong>${a.title}</strong> — <em style="color:#7c3aed">${a.source||""}</em> <span style="color:#9ca3af">(${a.year||""})</span></li>`).join("")}</ul>` : ""}
  ${(c.interests||[]).length ? `<h2>Interests</h2><div>${c.interests.map((i:string)=>`<span class="tag">${i}</span>`).join("")}</div>` : ""}
</div>
</body></html>`)));
  };
  const safeName = () => `${(profile?.fullName || cv.name).replace(/\s+/g, "_")}_${cv.name.replace(/\s+/g, "_")}_${theme}`;

  // Capture iframe HTML for export/save — strips all inline-edit UI artifacts.
  const getExportHtml = (th: CvTheme = theme) => {
    const iframe = iframeRef.current;
    if (iframe?.contentDocument?.documentElement) {
      const clone = iframe.contentDocument.documentElement.cloneNode(true) as HTMLElement;
      clone.querySelector('#__edit_style')?.remove();
      clone.querySelector('#__edit_hint')?.remove();
      const body = clone.querySelector('body');
      if (body) {
        body.removeAttribute('contenteditable');
        body.removeAttribute('spellcheck');
        body.style.paddingTop = '';
      }
      return '<!doctype html>' + clone.outerHTML;
    }
    return buildHtml(th, false);
  };

  // ── Shared save helper ───────────────────────────────────────────────────
  // On iOS WKWebView: navigator.share({ files }) → native Share Sheet → "Save to Files"
  // On desktop: blob URL download fallback
  const shareOrDownload = async (filename: string, content: string, mimeType: string): Promise<"shared" | "cancelled" | "fallback"> => {
    try {
      const file = new File([content], filename, { type: mimeType });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return "shared";
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return "cancelled"; // user dismissed share sheet
    }
    // Desktop / browsers without share-files support
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Last resort: base64 data URI
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const a = document.createElement("a");
      a.href = `data:${mimeType};base64,${b64}`; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    return "fallback";
  };

  const exportHtml = async () => {
    const html = getExportHtml();
    const filename = `${cv.name.replace(/\s+/g, "_")}.html`;
    const result = await shareOrDownload(filename, html, "text/html");
    if (result === "shared") toast({ title: "Ready to save", description: "Tap 'Save to Files' in the share sheet." });
  };

  // Full-screen preview — React overlay instead of window.open (blocked in iOS WKWebView)
  const previewHtml = () => setShowFullscreen(true);

  const downloadPdf = () => {
    const html = getExportHtml();
    const name  = safeName();
    const printHtml = html +
      `<script>` +
      `document.title=${JSON.stringify(name)};` +
      `window.onload=function(){` +
        `document.title=${JSON.stringify(name)};` +
        `setTimeout(function(){window.print();},600);` +
      `};` +
      `<\/script>`;

    // iOS only: use native Share Sheet (navigator.share)
    // Skip on desktop/Windows — navigator.canShare returns true there too but opens OS share UI
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      try {
        const file = new File([html], name + ".html", { type: "text/html" });
        if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: cv.name + " — CV" })
            .then(() => toast({ title: "Shared!", description: "Save to Files → open in Safari → Print → Save as PDF." }))
            .catch((e: any) => { if (e?.name !== "AbortError") console.warn("share error", e); });
          return;
        }
      } catch { /* share not supported */ }
    }

    // Desktop & Android: open a new window and trigger the browser print dialog
    // window.open() must be called synchronously (no await before it) to avoid popup blocker
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(printHtml);
      w.document.close();
      toast({ title: "Print dialog opening…", description: "Set destination to 'Save as PDF', then click Save." });
      return;
    }

    // Popup was blocked — fall back to downloading the HTML file
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = name + ".html";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "HTML downloaded", description: "Open the file in Chrome/Edge → Ctrl+P → Save as PDF." });
    } catch {
      toast({ title: "Blocked", description: "Allow pop-ups for this site and try again.", variant: "destructive" });
    }
  };

  return (
    <>
      {/* ── Floating save bar — fixed at bottom of screen during inline edit ── */}
      {inlineEditActive && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-between gap-3 px-4 py-3 bg-violet-950/95 backdrop-blur-sm border-t border-violet-500/40 shadow-2xl" data-testid="bar-inline-edit">
          <span className="text-xs text-violet-200 font-medium hidden sm:block">✏️ Click any text in the CV to edit it</span>
          <span className="text-xs text-violet-300 sm:hidden">✏️ Tap text to edit</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="h-8 text-xs px-3 border-violet-500/40 text-violet-200 hover:bg-violet-800/50" onClick={cancelInlineEdit} data-testid="btn-float-cancel">
              Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs px-4 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg" onClick={() => saveInlineEdits.mutate()} disabled={saveInlineEdits.isPending} data-testid="btn-float-save">
              {saveInlineEdits.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : <><Save className="w-3.5 h-3.5 mr-1.5" />Save changes</>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Fullscreen CV overlay (replaces window.open — works on iOS) ── */}
      {showFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between px-3 py-2 bg-black/90 border-b border-white/10 shrink-0">
            <span className="text-xs font-semibold text-white truncate max-w-[60%]">{cv.name}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={downloadPdf} data-testid="btn-fs-pdf">
                <Download className="w-3 h-3 mr-1" />PDF
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportHtml} data-testid="btn-fs-html">
                <Download className="w-3 h-3 mr-1" />HTML
              </Button>
              <Button size="sm" className="h-7 text-xs bg-red-600 hover:bg-red-700" onClick={() => setShowFullscreen(false)} data-testid="btn-fs-close">
                ✕ Close
              </Button>
            </div>
          </div>
          <iframe
            srcDoc={buildHtml(theme, false)}
            className="flex-1 w-full bg-white"
            style={{ border: "none" }}
            title="CV Fullscreen"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      )}

    <Card className="border-violet-500/30">
      <CardHeader className="pb-2">
        {/* ── Toolbar row 1: name + pickers ── */}
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{cv.name}</CardTitle>
            {cv.aiNotes && (
              <p className="text-[10px] text-violet-300/70 italic mt-0.5 line-clamp-1" title={cv.aiNotes}>
                💡 {cv.aiNotes}
              </p>
            )}
          </div>
          <div className="flex gap-1.5 items-center flex-wrap">
            <select
              value={theme}
              disabled={inlineEditActive}
              onChange={e => {
                const newTheme = e.target.value as CvTheme;
                if ((c as any).rawHtml) {
                  if (!confirm("Switching theme will discard your inline edits. Continue?")) return;
                  apiRequest(`/api/admin/career/cvs/${cv.id}`, "PATCH", {
                    content: { ...c, rawHtml: null }, style: newTheme,
                  }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] }));
                }
                setTheme(newTheme);
              }}
              className="text-xs bg-background border border-input rounded px-2 py-1.5 h-8 max-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="select-cv-theme"
            >
              {CV_THEMES.map(t => <option key={t.id} value={t.id}>{t.label}{t.tag ? " ★" : ""}</option>)}
            </select>
            <select
              value={cv.language || "en"}
              disabled={translate.isPending}
              onChange={e => {
                const newLang = e.target.value;
                if (newLang === (cv.language || "en")) return;
                const names: Record<string, string> = { nl: "Dutch", en: "English", ar: "Arabic", fr: "French", de: "German", es: "Spanish" };
                if (confirm(`Translate to ${names[newLang]}? AI rewrites all content (~20s)`)) translate.mutate(newLang);
              }}
              className="text-xs bg-background border border-input rounded px-2 py-1.5 h-8 w-16"
              data-testid="select-cv-language"
            >
              <option value="en">🇬🇧</option>
              <option value="nl">🇳🇱</option>
              <option value="ar">🇸🇦</option>
              <option value="fr">🇫🇷</option>
              <option value="de">🇩🇪</option>
              <option value="es">🇪🇸</option>
            </select>
            {translate.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {/* ── Toolbar row 2: action buttons (compact for mobile) ── */}
        <div className="flex gap-1 items-center flex-wrap pt-1">
          {inlineEditActive ? (
            <>
              <Button size="sm" className="h-7 text-xs px-3 bg-green-600 hover:bg-green-700 text-white font-semibold" onClick={() => saveInlineEdits.mutate()} disabled={saveInlineEdits.isPending} data-testid="btn-cv-save-edits">
                {saveInlineEdits.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}Save
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-muted-foreground" onClick={cancelInlineEdit} data-testid="btn-cv-cancel-edit">
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={startInlineEdit} className="h-7 text-xs px-2 border-violet-500/40 text-violet-300 hover:bg-violet-500/10" data-testid="btn-cv-edit-mode">
                <PenLine className="w-3 h-3 mr-1" />Edit CV
              </Button>
              {(c as any).rawHtml && (
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-muted-foreground hover:text-red-400" title="Discard inline edits and restore AI version" data-testid="btn-cv-reset-raw"
                  onClick={() => {
                    if (!confirm("Discard your inline edits and restore the AI-generated version?")) return;
                    apiRequest(`/api/admin/career/cvs/${cv.id}`, "PATCH", { content: { ...c, rawHtml: null } })
                      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] }));
                  }}>
                  Reset
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={previewHtml} data-testid="btn-cv-preview">
                <Maximize2 className="w-3 h-3 mr-1" />Full screen
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={exportHtml} data-testid="btn-cv-html">
                <Download className="w-3 h-3 mr-1" />HTML
              </Button>
              <Button size="sm" className="h-7 text-xs px-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-semibold" onClick={downloadPdf} data-testid="btn-cv-pdf">
                <Download className="w-3 h-3 mr-1" />PDF
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-0">
        {/* ── Live CV preview ── */}
        <div className="relative overflow-x-auto" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <iframe
            key={`${cv.id}_${theme}`}
            ref={iframeRef}
            srcDoc={buildHtml(theme)}
            className="w-full block bg-white"
            style={{ height: `${iframeHeight}px`, minHeight: "500px", border: "none", transition: "height 0.2s ease" }}
            title="CV Preview"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>

        {/* ── Tailor section ── */}
        <div className="px-4 pt-3 pb-4 space-y-2 border-t border-white/7">
          <div className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
            <Target className="w-3.5 h-3.5" /> Tailor to a specific job (saves as new CV)
          </div>
          <Input placeholder="Job title" value={tailorJob.jobTitle} onChange={e => setTailorJob(f => ({ ...f, jobTitle: e.target.value }))} className="h-8 text-xs" />
          <Textarea rows={3} placeholder="Paste full job description here…" value={tailorJob.jobDescription} onChange={e => setTailorJob(f => ({ ...f, jobDescription: e.target.value }))} className="text-xs" />
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700" onClick={() => tailor.mutate()} disabled={tailor.isPending || !tailorJob.jobDescription}>
            {tailor.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}Tailor with AI → new CV
          </Button>
        </div>
      </CardContent>
    </Card>
    </>
  );
}

// ════════════════════════════ PORTFOLIO ════════════════════════════
function PortfolioTab() {
  const { toast } = useToast();
  const { data: projects = [] } = useQuery<any[]>({ queryKey: ["/api/admin/career/projects"] });
  const [audience, setAudience] = useState("creative");
  const [built, setBuilt] = useState<any>(null);

  const build = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/portfolio/build", "POST", { audience }).then(r => r.json()),
    onSuccess: (d: any) => { setBuilt(d.portfolio); toast({ title: "Portfolio built" }); },
  });
  const addProject = useMutation({
    mutationFn: (b: any) => apiRequest("/api/admin/career/projects", "POST", b).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/career/projects"] }),
  });
  const updateProject = useMutation({
    mutationFn: ({ id, ...b }: any) => apiRequest(`/api/admin/career/projects/${id}`, "PATCH", b).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/career/projects"] }),
  });
  const delProject = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/career/projects/${id}`, "DELETE").then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/career/projects"] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Projects ({projects.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => addProject.mutate({ title: "New project", category: "venture" })}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add project
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {projects.map((p: any) => (
            <div key={p.id} className="border rounded p-2 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Title" value={p.title} onBlur={e => updateProject.mutate({ id: p.id, title: e.target.value })} defaultValue={p.title} />
                <Input placeholder="Category" value={p.category || ""} onBlur={e => updateProject.mutate({ id: p.id, category: e.target.value })} defaultValue={p.category || ""} />
                <Input placeholder="Period" defaultValue={p.period || ""} onBlur={e => updateProject.mutate({ id: p.id, period: e.target.value })} />
              </div>
              <Textarea rows={2} placeholder="Summary" defaultValue={p.summary || ""} onBlur={e => updateProject.mutate({ id: p.id, summary: e.target.value })} />
              <Input placeholder="Impact / metrics" defaultValue={p.impact || ""} onBlur={e => updateProject.mutate({ id: p.id, impact: e.target.value })} />
              <div className="flex justify-between items-center">
                <label className="text-xs flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" defaultChecked={p.highlight} onChange={e => updateProject.mutate({ id: p.id, highlight: e.target.checked })} />
                  <Star className="w-3.5 h-3.5" /> Highlight
                </label>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) delProject.mutate(p.id); }}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
              </div>
            </div>
          ))}
          {projects.length === 0 && <p className="text-xs text-muted-foreground">Add projects (events, ventures, campaigns) — Claude uses them in the portfolio.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wand2 className="w-4 h-4 text-violet-400" /> Build the portfolio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Audience</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="creative">Creative (agencies, studios)</SelectItem>
                <SelectItem value="corporate">Corporate (big companies)</SelectItem>
                <SelectItem value="startup">Startup (scrappy teams)</SelectItem>
                <SelectItem value="investor">Investor (funding partners)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => build.mutate()} disabled={build.isPending} data-testid="btn-build-portfolio">
            {build.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Claude is composing…</> : <><Sparkles className="w-4 h-4 mr-2" />Build my portfolio</>}
          </Button>
        </CardContent>
      </Card>

      {built && (
        <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-base">{built.hero?.headline}</CardTitle><p className="text-sm text-muted-foreground">{built.hero?.subhead}</p></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-violet-400 font-semibold">{built.hero?.tagline}</div>
            <div className="whitespace-pre-line italic border-l-2 border-violet-500 pl-3">{built.story}</div>
            {(built.pillars || []).length > 0 && <div>
              <div className="text-xs font-semibold mb-2">Pillars</div>
              <div className="grid grid-cols-2 gap-2">{built.pillars.map((p: any, i: number) => <div key={i} className="border rounded p-2"><div className="font-semibold text-sm">{p.title}</div><p className="text-xs text-muted-foreground">{p.blurb}</p>{p.metric && <Badge className="bg-emerald-500/20 text-emerald-300 mt-1 text-[10px]">{p.metric}</Badge>}</div>)}</div>
            </div>}
            {(built.featuredProjects || []).length > 0 && <div>
              <div className="text-xs font-semibold mb-2">Featured projects</div>
              {built.featuredProjects.map((p: any, i: number) => <div key={i} className="border rounded p-2 mb-1"><div className="font-semibold text-sm">{p.title}</div><p className="text-xs">{p.narrative}</p>{p.impact && <p className="text-xs text-emerald-300">{p.impact}</p>}</div>)}
            </div>}
            {(built.skillsCloud || []).length > 0 && <div className="flex flex-wrap gap-1">{built.skillsCloud.map((s: string) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}</div>}
            {(built.soundbites || []).length > 0 && <div>
              <div className="text-xs font-semibold mb-2">Soundbites</div>
              {built.soundbites.map((s: string, i: number) => <p key={i} className="italic text-sm">"{s}"</p>)}
            </div>}
            {built.videoScript && <div className="border-t pt-2"><div className="text-xs font-semibold">🎬 Video script (60-90s)</div><p className="text-xs whitespace-pre-line mt-1">{built.videoScript}</p></div>}
            {built.callToAction && <div className="bg-violet-500/10 rounded p-2 text-xs"><strong>{built.callToAction.primary}</strong> — {built.callToAction.secondary}</div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════ JOB MATCH ════════════════════════════
function MatchTab() {
  const { toast } = useToast();
  const { data: matches = [] } = useQuery<any[]>({ queryKey: ["/api/admin/career/matches"] });
  const [form, setForm] = useState({ jobTitle: "", company: "", location: "", jobUrl: "", jobDescription: "" });

  const analyze = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/match", "POST", form).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/career/matches"] }); toast({ title: "Analyzed" }); setForm({ jobTitle: "", company: "", location: "", jobUrl: "", jobDescription: "" }); },
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: any) => apiRequest(`/api/admin/career/matches/${id}`, "PATCH", { status }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/career/matches"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/career/matches/${id}`, "DELETE").then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/career/matches"] }),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-violet-400" /> Score a job</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Input placeholder="Job title" value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} />
          <Input placeholder="Company" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
          <Input placeholder="Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <Input placeholder="Job URL (optional)" value={form.jobUrl} onChange={e => setForm(f => ({ ...f, jobUrl: e.target.value }))} />
          <Textarea rows={5} className="col-span-2" placeholder="Paste the full job description here…" value={form.jobDescription} onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))} data-testid="textarea-job-desc" />
          <Button className="col-span-2 bg-violet-600 hover:bg-violet-700" onClick={() => analyze.mutate()} disabled={analyze.isPending || !form.jobDescription} data-testid="btn-analyze-job">
            {analyze.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</> : <><Sparkles className="w-4 h-4 mr-2" />Analyze fit & draft cover letter</>}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {matches.map((m: any) => (
          <Card key={m.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">{m.jobTitle} <span className="text-muted-foreground">@ {m.company}</span></CardTitle>
                <p className="text-xs text-muted-foreground">{m.location} · {new Date(m.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] ${m.fitScore >= 75 ? "bg-emerald-500/20 text-emerald-300" : m.fitScore >= 50 ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300"}`}>{m.fitScore}/100</Badge>
                <Select value={m.status} onValueChange={status => updateStatus.mutate({ id: m.id, status })}>
                  <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["saved", "applied", "interviewing", "offer", "rejected"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete?")) del.mutate(m.id); }}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-semibold">{m.fitAnalysis?.verdict}</p>
              {(m.fitAnalysis?.strengths || []).length > 0 && <div><div className="text-xs font-semibold text-emerald-400">Why you fit</div><ul className="list-disc pl-5 text-xs">{m.fitAnalysis.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
              {(m.fitAnalysis?.gaps || []).length > 0 && <div><div className="text-xs font-semibold text-yellow-400">Gaps</div><ul className="list-disc pl-5 text-xs">{m.fitAnalysis.gaps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
              {(m.fitAnalysis?.rewriteSuggestions || []).length > 0 && <div><div className="text-xs font-semibold text-violet-400">CV rewrite tips</div><ul className="list-disc pl-5 text-xs">{m.fitAnalysis.rewriteSuggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
              {(m.fitAnalysis?.cvHighlights || []).length > 0 && <div className="rounded-md bg-emerald-500/5 border border-emerald-500/30 p-2"><div className="text-xs font-semibold text-emerald-300 mb-1">↑ Lead with these (highlight on CV)</div><ul className="list-disc pl-5 text-xs space-y-0.5">{m.fitAnalysis.cvHighlights.map((s: string, i: number) => <li key={i} data-testid={`text-cv-highlight-${i}`}>{s}</li>)}</ul></div>}
              {(m.fitAnalysis?.cvDeprioritize || []).length > 0 && <div className="rounded-md bg-red-500/5 border border-red-500/30 p-2"><div className="text-xs font-semibold text-red-300 mb-1">↓ Drop or soften (de-emphasize)</div><ul className="list-disc pl-5 text-xs space-y-0.5">{m.fitAnalysis.cvDeprioritize.map((s: string, i: number) => <li key={i} data-testid={`text-cv-deprioritize-${i}`}>{s}</li>)}</ul></div>}
              {(m.fitAnalysis?.portfolioFocus || []).length > 0 && <div><div className="text-xs font-semibold text-cyan-400">Portfolio focus for this role</div><ul className="list-disc pl-5 text-xs">{m.fitAnalysis.portfolioFocus.map((s: string, i: number) => <li key={i} data-testid={`text-portfolio-focus-${i}`}>{s}</li>)}</ul></div>}
              {(m.fitAnalysis?.interviewTalkingPoints || []).length > 0 && <div><div className="text-xs font-semibold text-amber-400">Interview stories ready to tell</div><ul className="list-disc pl-5 text-xs">{m.fitAnalysis.interviewTalkingPoints.map((s: string, i: number) => <li key={i} data-testid={`text-interview-point-${i}`}>{s}</li>)}</ul></div>}
              {m.fitAnalysis?.salaryNote && <div className="text-xs"><span className="font-semibold text-fuchsia-400">Salary positioning: </span><span className="text-muted-foreground" data-testid="text-salary-note">{m.fitAnalysis.salaryNote}</span></div>}
              {m.fitAnalysis?.applicationSubject && <div className="text-xs flex items-center gap-2 border-t pt-2"><span className="font-semibold">Subject line:</span> <span className="font-mono text-muted-foreground" data-testid="text-app-subject">{m.fitAnalysis.applicationSubject}</span><Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { navigator.clipboard.writeText(m.fitAnalysis.applicationSubject); toast({ title: "Copied" }); }}><Copy className="w-3 h-3" /></Button></div>}
              {m.fitAnalysis?.coverLetterDraft && <div className="border-t pt-2">
                <div className="flex justify-between items-center"><div className="text-xs font-semibold">Draft cover letter</div>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(m.fitAnalysis.coverLetterDraft); toast({ title: "Copied" }); }}><Copy className="w-3.5 h-3.5" /></Button></div>
                <p className="text-xs whitespace-pre-line mt-1 italic" data-testid={`text-cover-letter-${m.id}`}>{m.fitAnalysis.coverLetterDraft}</p>
              </div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════ LINKEDIN BRAIN IMPORT ════════════════════════════
function LinkedInBrainImportCard() {
  const { toast } = useToast();
  const [brainData, setBrainData] = useState<{ messages: any[]; timestamp: number } | null>(null);
  const [form, setForm] = useState({ jobUrl: "", jobDescription: "", generateCv: true, cvStyle: "modern", language: "en" });
  const [expanded, setExpanded] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pb_brain_export");
      if (raw) setBrainData(JSON.parse(raw));
    } catch {}
  }, []);

  const importBrain = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/import-linkedin-brain", "POST", {
      messages: brainData?.messages || [],
      jobUrl: form.jobUrl,
      jobDescription: form.jobDescription,
      generateCv: form.generateCv,
      cvStyle: form.cvStyle,
      language: form.language,
    }).then(r => r.json()),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/career/cvs"] });
      setResult(d);
      toast({ title: "LinkedIn Brain imported!", description: `Profile enriched · ${d.fieldsUpdated?.length || 0} fields updated${d.cv ? " · CV generated" : ""}` });
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  if (!brainData) return (
    <Card className="border-dashed border-violet-500/30 bg-violet-500/5">
      <CardContent className="pt-4 flex items-center gap-3">
        <MessageSquare className="w-5 h-5 text-violet-400 shrink-0" />
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">LinkedIn Brain → Career Suite</span> — Go to the LinkedIn Profile Builder, have a conversation in the AI Brain panel, then click <strong>"Export to Career Suite"</strong>. Your conversation will appear here for import.
        </div>
      </CardContent>
    </Card>
  );

  const age = Math.round((Date.now() - brainData.timestamp) / 60000);

  return (
    <Card className="border-2 border-violet-500/60 bg-gradient-to-br from-violet-500/15 via-blue-500/10 to-transparent shadow-lg shadow-violet-500/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-400" /> LinkedIn AI Brain → Import to Career Suite
            <Badge className="text-[10px] bg-violet-500/20 text-violet-300 border-0">{brainData.messages.length} messages · {age < 60 ? `${age}m ago` : `${Math.round(age/60)}h ago`}</Badge>
          </CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">Claude extracts your profile data from the LinkedIn AI Brain conversation and enriches your Career Suite. Optionally generate a tailored CV for a specific job.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="rounded-md bg-background/60 border border-violet-500/20 p-2 max-h-32 overflow-y-auto space-y-1">
            {brainData.messages.slice(0, 4).map((m, i) => (
              <div key={i} className="text-[10px]">
                <span className={cn("font-semibold", m.role === "assistant" ? "text-violet-400" : "text-muted-foreground")}>{m.role === "assistant" ? "Brain" : "You"}: </span>
                <span className="text-muted-foreground line-clamp-1">{m.content}</span>
              </div>
            ))}
            {brainData.messages.length > 4 && <div className="text-[10px] text-muted-foreground">…and {brainData.messages.length - 4} more messages</div>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Job URL (optional — for tailored CV)</Label>
              <Input className="h-8 text-xs mt-0.5" placeholder="https://linkedin.com/jobs/view/..." value={form.jobUrl} onChange={e => setForm(f => ({ ...f, jobUrl: e.target.value }))} data-testid="input-brain-job-url" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Paste job description (optional — for tailored CV)</Label>
              <Textarea rows={3} className="text-xs mt-0.5" placeholder="Paste the job description you want to target…" value={form.jobDescription} onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))} data-testid="textarea-brain-job-desc" />
            </div>
            <div>
              <Label className="text-xs">CV style</Label>
              <Select value={form.cvStyle} onValueChange={v => setForm(f => ({ ...f, cvStyle: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["modern", "corporate", "creative", "startup"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["en","🇬🇧 English"],["nl","🇳🇱 Nederlands"],["ar","🇸🇦 Arabic"],["fr","🇫🇷 Français"],["de","🇩🇪 Deutsch"],["es","🇪🇸 Español"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={form.generateCv} onChange={e => setForm(f => ({ ...f, generateCv: e.target.checked }))} />
            Also generate a CV from the imported data
          </label>

          <Button className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 font-bold gap-2"
            onClick={() => importBrain.mutate()} disabled={importBrain.isPending} data-testid="btn-brain-import">
            {importBrain.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Claude is importing…</> : <><Brain className="w-4 h-4" />Import from LinkedIn Brain</>}
          </Button>

          {result && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
              <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Profile enriched — {result.fieldsUpdated?.length || 0} fields updated</div>
              {result.cv && <div className="text-[11px] text-muted-foreground">CV created: <span className="text-emerald-300">{result.cv.name}</span> — find it below in Saved CVs</div>}
            </div>
          )}

          <button onClick={() => { localStorage.removeItem("pb_brain_export"); setBrainData(null); }} className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors">Clear brain data from storage</button>
        </CardContent>
      )}
    </Card>
  );
}

// ════════════════════════════ POWER TOOLS TAB ════════════════════════════
function ToolsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-1 mb-2">
        <div className="rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-indigo-500/5 p-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-violet-400 shrink-0" />
          <div>
            <div className="text-sm font-bold">Career Power Tools</div>
            <div className="text-[11px] text-muted-foreground">10 advanced tools — all AI-powered, all reading your real profile. Click any card to expand.</div>
          </div>
        </div>
      </div>
      <InterviewPrepCard />
      <CoverLetterStudioCard />
      <BioPackCard />
      <SkillsGapRadarCard />
      <SalaryIntelCard />
      <ReferenceLetterCard />
      <AtsScoreCard />
      <ApplicationTrackerCard />
    </div>
  );
}

// ── TOOL 1: INTERVIEW PREP ──────────────────────────────────────────────
function InterviewPrepCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ jobTitle: "", jobDescription: "", language: "en" });
  const [result, setResult] = useState<any>(null);
  const [activeQ, setActiveQ] = useState<number | null>(null);

  const gen = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/tools/interview-prep", "POST", form).then(r => r.json()),
    onSuccess: d => { setResult(d); toast({ title: "Interview prep ready", description: `${d.questions?.length || 0} questions with STAR answers` }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const typeColor: Record<string, string> = { behavioral: "text-blue-400", technical: "text-orange-400", situational: "text-violet-400", motivational: "text-emerald-400" };

  return (
    <Card className="border-blue-500/40 bg-gradient-to-br from-blue-500/10 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-blue-400" /> Interview Prep Kit</CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        </div>
        <p className="text-[11px] text-muted-foreground">Claude generates 8-10 personalized interview questions with full STAR-method answers drawn from your real background.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><Label className="text-xs">Target role</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Creative Director at Nike" value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} data-testid="input-interview-role" /></div>
            <div className="col-span-2"><Label className="text-xs">Job description (optional but strongly recommended)</Label><Textarea rows={4} className="text-xs mt-0.5" placeholder="Paste the job description for hyper-personalized questions…" value={form.jobDescription} onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))} /></div>
            <div><Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{[["en","🇬🇧 English"],["nl","🇳🇱 Nederlands"],["ar","🇸🇦 Arabic"],["fr","🇫🇷 Français"],["de","🇩🇪 Deutsch"],["es","🇪🇸 Español"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2" onClick={() => gen.mutate()} disabled={gen.isPending} data-testid="btn-interview-prep">
            {gen.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Generating prep kit…</> : <><BookOpen className="w-4 h-4" />Generate interview prep</>}
          </Button>
          {result && (
            <div className="space-y-3 mt-1">
              {result.openingStatement && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                  <div className="text-[10px] font-semibold text-blue-400 uppercase mb-1">30-second opening pitch</div>
                  <p className="text-xs italic">"{result.openingStatement}"</p>
                  <Button size="sm" variant="ghost" className="h-6 px-2 mt-1 text-[10px]" onClick={() => { navigator.clipboard.writeText(result.openingStatement); toast({ title: "Copied" }); }}><Copy className="w-3 h-3 mr-1" />Copy</Button>
                </div>
              )}
              <div className="space-y-2">
                {(result.questions || []).map((q: any, i: number) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <button className="w-full text-left p-3 flex items-start gap-2 hover:bg-muted/30 transition-colors" onClick={() => setActiveQ(activeQ === i ? null : i)} data-testid={`btn-interview-q-${i}`}>
                      <div className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{q.question}</p>
                        {q.type && <span className={cn("text-[10px] font-semibold", typeColor[q.type] || "text-muted-foreground")}>{q.type}</span>}
                      </div>
                      {activeQ === i ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />}
                    </button>
                    {activeQ === i && q.starAnswer && (
                      <div className="px-3 pb-3 space-y-2 border-t bg-muted/10">
                        {["situation", "task", "action", "result"].map(k => (
                          <div key={k}>
                            <span className="text-[10px] font-bold uppercase text-blue-400">{k.charAt(0).toUpperCase() + k.slice(1)}: </span>
                            <span className="text-xs">{q.starAnswer[k]}</span>
                          </div>
                        ))}
                        {q.tip && <div className="rounded bg-amber-500/10 border border-amber-500/20 p-2 text-[10px] text-amber-300"><span className="font-bold">Tip: </span>{q.tip}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {(result.questionsToAsk || []).length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase mb-1.5">Questions to ask them</div>
                  <ul className="space-y-1">{result.questionsToAsk.map((q: string, i: number) => <li key={i} className="text-xs flex gap-1.5"><ArrowRight className="w-3 h-3 shrink-0 mt-0.5 text-emerald-400" />{q}</li>)}</ul>
                </div>
              )}
              {(result.redFlags || []).length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="text-[10px] font-semibold text-amber-400 uppercase mb-1.5">Prepare for these</div>
                  <ul className="space-y-1">{result.redFlags.map((f: string, i: number) => <li key={i} className="text-xs flex gap-1.5"><Shield className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />{f}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── TOOL 2: COVER LETTER STUDIO ──────────────────────────────────────────
function CoverLetterStudioCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ jobTitle: "", company: "", jobDescription: "", tone: "confident", language: "en" });
  const [result, setResult] = useState<any>(null);

  const gen = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/tools/cover-letter", "POST", form).then(r => r.json()),
    onSuccess: d => { setResult(d); toast({ title: "Cover letter ready" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const TONES = [["confident","Confident"], ["warm","Warm"], ["creative","Creative"], ["formal","Formal"], ["startup","Startup"]];

  return (
    <Card className="border-rose-500/40 bg-gradient-to-br from-rose-500/10 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Mail className="w-4 h-4 text-rose-400" /> Cover Letter Studio</CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        </div>
        <p className="text-[11px] text-muted-foreground">Generates a compelling, tone-matched cover letter using real stories from your background — not a generic template.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Job title</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Head of Community" value={form.jobTitle} onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))} data-testid="input-cover-job" /></div>
            <div><Label className="text-xs">Company</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Nike Amsterdam" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
            <div className="col-span-2"><Label className="text-xs">Tone</Label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {TONES.map(([v, l]) => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, tone: v }))} data-testid={`btn-tone-${v}`}
                    className={cn("text-[11px] px-2.5 py-1 rounded border transition-colors", form.tone === v ? "border-rose-500 bg-rose-500/15 text-rose-300" : "border-border text-muted-foreground hover:border-rose-500/40")}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{[["en","🇬🇧 English"],["nl","🇳🇱 Nederlands"],["ar","🇸🇦 Arabic"],["fr","🇫🇷 Français"],["de","🇩🇪 Deutsch"],["es","🇪🇸 Español"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs">Job description <span className="text-red-400">*</span></Label><Textarea rows={5} className="text-xs mt-0.5" placeholder="Paste the full job description here…" value={form.jobDescription} onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))} data-testid="textarea-cover-job-desc" /></div>
          </div>
          <Button className="w-full bg-rose-600 hover:bg-rose-700 gap-2" onClick={() => gen.mutate()} disabled={gen.isPending || form.jobDescription.trim().length < 30} data-testid="btn-gen-cover-letter">
            {gen.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Writing cover letter…</> : <><Mail className="w-4 h-4" />Generate cover letter</>}
          </Button>
          {result && (
            <div className="space-y-3">
              {result.subject && (
                <div className="flex items-center gap-2 p-2 rounded border text-xs">
                  <span className="font-semibold text-muted-foreground shrink-0">Subject:</span>
                  <span className="font-mono text-sm flex-1">{result.subject}</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 shrink-0" onClick={() => { navigator.clipboard.writeText(result.subject); toast({ title: "Copied" }); }}><Copy className="w-3 h-3" /></Button>
                </div>
              )}
              {result.coverLetter && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[10px] font-semibold text-rose-400 uppercase">Cover Letter</div>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { navigator.clipboard.writeText(result.coverLetter); toast({ title: "Copied" }); }}><Copy className="w-3 h-3 mr-1" />Copy</Button>
                  </div>
                  <p className="text-xs whitespace-pre-line">{result.coverLetter}</p>
                  {result.postscript && <p className="text-xs mt-2 italic text-muted-foreground">{result.postscript}</p>}
                </div>
              )}
              {(result.keyHooks || []).length > 0 && (
                <div className="rounded bg-muted/30 p-2">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Angles used</div>
                  <ul className="space-y-0.5">{result.keyHooks.map((h: string, i: number) => <li key={i} className="text-[11px] flex gap-1"><Check className="w-3 h-3 shrink-0 mt-0.5 text-emerald-400" />{h}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── TOOL 3: BIO PACK ──────────────────────────────────────────────────────
function BioPackCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ language: "en", targetRole: "" });
  const [result, setResult] = useState<any>(null);
  const [copyBio, setCopyBio] = useState("");

  const gen = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/tools/bio-pack", "POST", form).then(r => r.json()),
    onSuccess: d => { setResult(d); toast({ title: "6 bios generated!" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const BIOS = [
    { k: "twitter", label: "Twitter / X", color: "text-sky-400", hint: "≤160 chars" },
    { k: "linkedin", label: "LinkedIn About opener", color: "text-blue-400", hint: "2-3 sentences" },
    { k: "speaker", label: "Speaker intro", color: "text-violet-400", hint: "3-4 sentences" },
    { k: "press", label: "Press / media bio", color: "text-amber-400", hint: "~90 words, 3rd person" },
    { k: "aboutPage", label: "Website About opener", color: "text-emerald-400", hint: "120-150 words" },
    { k: "elevator", label: "30-sec verbal pitch", color: "text-rose-400", hint: "spoken words" },
  ];

  return (
    <Card className="border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-violet-400" /> Career Bio Pack</CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        </div>
        <p className="text-[11px] text-muted-foreground">6 bios in one shot — Twitter, LinkedIn, speaker intro, press, website, elevator pitch. Each optimized for its platform.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Focus angle (optional)</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. AI founder, Event organizer" value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))} /></div>
            <div><Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{[["en","🇬🇧 English"],["nl","🇳🇱 Nederlands"],["ar","🇸🇦 Arabic"],["fr","🇫🇷 Français"],["de","🇩🇪 Deutsch"],["es","🇪🇸 Español"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full bg-violet-600 hover:bg-violet-700 gap-2" onClick={() => gen.mutate()} disabled={gen.isPending} data-testid="btn-gen-bio-pack">
            {gen.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Generating 6 bios…</> : <><User className="w-4 h-4" />Generate Bio Pack</>}
          </Button>
          {result && (
            <div className="space-y-2">
              {BIOS.map(({ k, label, color, hint }) => result[k] ? (
                <div key={k} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={cn("text-[10px] font-bold uppercase", color)}>{label}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{hint}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                      onClick={() => { navigator.clipboard.writeText(result[k]); setCopyBio(k); setTimeout(() => setCopyBio(""), 2000); toast({ title: "Copied!" }); }}>
                      {copyBio === k ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <p className="text-xs whitespace-pre-line">{result[k]}</p>
                </div>
              ) : null)}
              {result.tips && (
                <div className="rounded bg-muted/30 p-2">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Pro tips</div>
                  {(result.tips || []).map((t: string, i: number) => <p key={i} className="text-[11px] text-muted-foreground">{t}</p>)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── TOOL 4: SKILLS GAP RADAR ──────────────────────────────────────────────
function SkillsGapRadarCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ targetRole: "", targetCompany: "", language: "en" });
  const [result, setResult] = useState<any>(null);

  const gen = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/tools/skills-gap", "POST", form).then(r => r.json()),
    onSuccess: d => { setResult(d); toast({ title: `Readiness: ${d.readinessScore}/100`, description: d.readinessVerdict }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const priorityColor: Record<string, string> = { critical: "text-red-400 border-red-500/30 bg-red-500/5", important: "text-amber-400 border-amber-500/30 bg-amber-500/5", "nice-to-have": "text-muted-foreground border-border bg-transparent" };

  return (
    <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><GraduationCap className="w-4 h-4 text-emerald-400" /> Skills Gap Radar</CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        </div>
        <p className="text-[11px] text-muted-foreground">Claude analyses the gap between your current skills and your target role — with a prioritized 90-day learning plan.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><Label className="text-xs">Target role <span className="text-red-400">*</span></Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Head of AI Product, Creative Director" value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))} data-testid="input-skills-gap-role" /></div>
            <div><Label className="text-xs">Target company (optional)</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Nike, DEPT Agency" value={form.targetCompany} onChange={e => setForm(f => ({ ...f, targetCompany: e.target.value }))} /></div>
            <div><Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{[["en","🇬🇧 English"],["nl","🇳🇱 Nederlands"],["fr","🇫🇷 Français"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => gen.mutate()} disabled={gen.isPending || !form.targetRole} data-testid="btn-skills-gap">
            {gen.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing gap…</> : <><GraduationCap className="w-4 h-4" />Analyze skills gap</>}
          </Button>
          {result && (
            <div className="space-y-3">
              <div className={cn("rounded-lg border p-3 flex items-center gap-4", result.readinessScore >= 70 ? "border-emerald-500/30 bg-emerald-500/5" : result.readinessScore >= 45 ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5")}>
                <div className="text-center shrink-0">
                  <div className={cn("text-3xl font-black", result.readinessScore >= 70 ? "text-emerald-400" : result.readinessScore >= 45 ? "text-amber-400" : "text-red-400")}>{result.readinessScore}</div>
                  <div className="text-[10px] text-muted-foreground">/ 100</div>
                </div>
                <p className="text-sm">{result.readinessVerdict}</p>
              </div>

              {(result.gaps || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">Gaps to close</div>
                  <div className="space-y-2">
                    {result.gaps.map((g: any, i: number) => (
                      <div key={i} className={cn("rounded-lg border p-2.5 text-xs", priorityColor[g.priority] || priorityColor["nice-to-have"])}>
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className={cn("text-[9px] shrink-0 mt-0.5", g.priority === "critical" ? "border-red-500/40 text-red-400" : g.priority === "important" ? "border-amber-500/40 text-amber-400" : "")}>{g.priority}</Badge>
                          <div>
                            <div className="font-semibold">{g.skill}</div>
                            <div className="text-muted-foreground mt-0.5">{g.why}</div>
                            <div className="mt-1"><span className="font-medium">How: </span>{g.howToClose}</div>
                            {(g.resources || []).length > 0 && <ul className="mt-1 list-disc pl-4">{g.resources.map((r: string, j: number) => <li key={j}>{r}</li>)}</ul>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.learningPlan && (
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
                  <div className="text-[10px] font-semibold text-violet-400 uppercase mb-2">90-day learning plan</div>
                  {["30days", "60days", "90days"].map(k => (
                    <div key={k} className="mb-2">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase">{k.replace("days", " days")}</div>
                      <ul className="list-disc pl-4 mt-0.5">{(result.learningPlan[k] || []).map((a: string, i: number) => <li key={i} className="text-xs">{a}</li>)}</ul>
                    </div>
                  ))}
                </div>
              )}

              {(result.quickWins || []).length > 0 && (
                <div className="rounded bg-amber-500/10 border border-amber-500/20 p-2.5">
                  <div className="text-[10px] font-semibold text-amber-400 uppercase mb-1">Do this week</div>
                  <ul className="space-y-0.5">{result.quickWins.map((w: string, i: number) => <li key={i} className="text-xs flex gap-1.5"><Zap className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />{w}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── TOOL 5: SALARY INTELLIGENCE ──────────────────────────────────────────
function SalaryIntelCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ targetRole: "", location: "", yearsExperience: "", currentSalary: "", language: "en" });
  const [result, setResult] = useState<any>(null);

  const gen = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/tools/salary-intel", "POST", form).then(r => r.json()),
    onSuccess: d => { setResult(d); toast({ title: "Salary intelligence ready" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-yellow-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-400" /> Salary Intelligence</CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        </div>
        <p className="text-[11px] text-muted-foreground">Market salary range + exact negotiation script — anchoring, counter-offers, and when to walk away.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><Label className="text-xs">Target role <span className="text-red-400">*</span></Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Community Manager, AI Product Lead" value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))} data-testid="input-salary-role" /></div>
            <div><Label className="text-xs">Location</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Amsterdam" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div><Label className="text-xs">Years of experience</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. 8" value={form.yearsExperience} onChange={e => setForm(f => ({ ...f, yearsExperience: e.target.value }))} /></div>
            <div className="col-span-2"><Label className="text-xs">Current salary (optional)</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. €48,000" value={form.currentSalary} onChange={e => setForm(f => ({ ...f, currentSalary: e.target.value }))} /></div>
          </div>
          <Button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold gap-2" onClick={() => gen.mutate()} disabled={gen.isPending || !form.targetRole} data-testid="btn-salary-intel">
            {gen.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing market…</> : <><DollarSign className="w-4 h-4" />Get salary intelligence</>}
          </Button>
          {result && (
            <div className="space-y-3">
              {result.salaryRange && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="text-[10px] font-semibold text-amber-400 uppercase mb-2">Market range — {result.marketPosition}</div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
                    {[["low","Conservative","text-muted-foreground"],["mid","Market Mid","text-amber-400"],["high","Top of Range","text-emerald-400"]].map(([k,l,c]) => (
                      <div key={k}>
                        <div className={cn("text-base font-bold", c)}>{result.salaryRange[k]}</div>
                        <div className="text-[10px] text-muted-foreground">{l}</div>
                      </div>
                    ))}
                  </div>
                  {result.salaryRange.notes && <p className="text-[11px] text-muted-foreground italic">{result.salaryRange.notes}</p>}
                </div>
              )}
              {result.negotiationScript && (
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
                  <div className="text-[10px] font-semibold text-violet-400 uppercase">Negotiation script</div>
                  {[["openingAsk","When asked your expectations"],["anchorNumber","Anchor on this"],["counterOffer","If they come in low"],["whenToWalk","Walk-away point"]].map(([k, l]) => (
                    <div key={k}>
                      <div className="text-[10px] text-muted-foreground font-medium">{l}</div>
                      <p className="text-xs italic">"{result.negotiationScript[k]}"</p>
                    </div>
                  ))}
                </div>
              )}
              {(result.totalCompensation || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Also negotiate</div>
                  <div className="flex flex-wrap gap-1">{result.totalCompensation.map((i: string, idx: number) => <Badge key={idx} variant="outline" className="text-[10px]">{i}</Badge>)}</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── TOOL 6: REFERENCE LETTER DRAFTER ──────────────────────────────────────
function ReferenceLetterCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ refereeName: "", refereeRole: "", relationship: "", targetRole: "", language: "en" });
  const [result, setResult] = useState<any>(null);

  const gen = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/tools/reference-letter", "POST", form).then(r => r.json()),
    onSuccess: d => { setResult(d); toast({ title: "Reference letter drafted" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><FileCheck className="w-4 h-4 text-cyan-400" /> Reference Letter Drafter</CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        </div>
        <p className="text-[11px] text-muted-foreground">Generate a ready-to-send reference letter draft for your referee to customize — written in their voice, using your real background.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Referee name <span className="text-red-400">*</span></Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Ahmed Al Rashidi" value={form.refereeName} onChange={e => setForm(f => ({ ...f, refereeName: e.target.value }))} data-testid="input-referee-name" /></div>
            <div><Label className="text-xs">Referee role</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Director at Municipality Amsterdam" value={form.refereeRole} onChange={e => setForm(f => ({ ...f, refereeRole: e.target.value }))} /></div>
            <div><Label className="text-xs">Your relationship</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. managed me for 2 years" value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} /></div>
            <div><Label className="text-xs">Target role (optional)</Label><Input className="h-8 text-xs mt-0.5" placeholder="e.g. Cultural Program Director" value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))} /></div>
            <div><Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{[["en","🇬🇧 English"],["nl","🇳🇱 Nederlands"],["ar","🇸🇦 Arabic"],["fr","🇫🇷 Français"],["de","🇩🇪 Deutsch"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full bg-cyan-600 hover:bg-cyan-700 gap-2" onClick={() => gen.mutate()} disabled={gen.isPending || !form.refereeName} data-testid="btn-reference-letter">
            {gen.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Drafting letter…</> : <><FileCheck className="w-4 h-4" />Draft reference letter</>}
          </Button>
          {result && (
            <div className="space-y-3">
              {result.subject && (
                <div className="flex items-center gap-2 p-2 rounded border text-xs">
                  <span className="font-semibold text-muted-foreground">Subject:</span>
                  <span className="flex-1 font-mono">{result.subject}</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { navigator.clipboard.writeText(result.subject); toast({ title: "Copied" }); }}><Copy className="w-3 h-3" /></Button>
                </div>
              )}
              {result.letter && (
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[10px] font-semibold text-cyan-400 uppercase">Reference Letter Draft</div>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => { navigator.clipboard.writeText(result.letter); toast({ title: "Copied" }); }}><Copy className="w-3 h-3 mr-1" />Copy</Button>
                  </div>
                  <p className="text-xs whitespace-pre-line">{result.letter}</p>
                </div>
              )}
              {result.sendingInstructions && <p className="text-[11px] text-muted-foreground italic border-t pt-2">{result.sendingInstructions}</p>}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── TOOL 7: ATS SCORE OPTIMIZER ──────────────────────────────────────────
function AtsScoreCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ cvText: "", jobDescription: "" });
  const [result, setResult] = useState<any>(null);

  const gen = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/tools/ats-score", "POST", form).then(r => r.json()),
    onSuccess: d => { setResult(d); toast({ title: `ATS Score: ${d.atsScore}/100`, description: d.verdict }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const scoreColor = result ? (result.atsScore >= 75 ? "text-emerald-400" : result.atsScore >= 50 ? "text-amber-400" : "text-red-400") : "";
  const scoreBg = result ? (result.atsScore >= 75 ? "border-emerald-500/30 bg-emerald-500/5" : result.atsScore >= 50 ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5") : "";

  return (
    <Card className="border-orange-500/40 bg-gradient-to-br from-orange-500/10 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><ScanSearch className="w-4 h-4 text-orange-400" /> ATS Score Optimizer</CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        </div>
        <p className="text-[11px] text-muted-foreground">Paste your CV text + the job description — Claude scores ATS compatibility, finds missing keywords, and gives exact fixes.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Your CV text (paste the plain text) <span className="text-red-400">*</span></Label>
            <Textarea rows={6} className="text-xs mt-0.5 font-mono" placeholder="Paste your CV content here (plain text, no formatting)…" value={form.cvText} onChange={e => setForm(f => ({ ...f, cvText: e.target.value }))} data-testid="textarea-ats-cv" />
          </div>
          <div>
            <Label className="text-xs">Job description <span className="text-red-400">*</span></Label>
            <Textarea rows={5} className="text-xs mt-0.5" placeholder="Paste the job description…" value={form.jobDescription} onChange={e => setForm(f => ({ ...f, jobDescription: e.target.value }))} data-testid="textarea-ats-job" />
          </div>
          <Button className="w-full bg-orange-600 hover:bg-orange-700 gap-2" onClick={() => gen.mutate()} disabled={gen.isPending || form.cvText.trim().length < 50 || form.jobDescription.trim().length < 30} data-testid="btn-ats-score">
            {gen.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning ATS compatibility…</> : <><ScanSearch className="w-4 h-4" />Run ATS analysis</>}
          </Button>
          {result && (
            <div className="space-y-3">
              <div className={cn("rounded-lg border p-3 flex items-center gap-4", scoreBg)}>
                <div className="text-center shrink-0">
                  <div className={cn("text-3xl font-black", scoreColor)}>{result.atsScore}</div>
                  <div className="text-[10px] text-muted-foreground">ATS Score</div>
                </div>
                <div>
                  <p className="text-sm font-medium">{result.verdict}</p>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>Keywords: <span className="text-foreground font-semibold">{result.keywordDensityScore}/100</span></span>
                    <span>Readability: <span className="text-foreground font-semibold">{result.readabilityScore}/100</span></span>
                  </div>
                </div>
              </div>

              {result.optimizedHeadline && (
                <div className="rounded bg-violet-500/10 border border-violet-500/20 p-2.5">
                  <div className="text-[10px] font-semibold text-violet-400 uppercase mb-1">Optimized headline</div>
                  <p className="text-xs font-medium">{result.optimizedHeadline}</p>
                </div>
              )}

              {(result.missingKeywords || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Missing keywords</div>
                  <div className="space-y-1">
                    {result.missingKeywords.map((k: any, i: number) => (
                      <div key={i} className={cn("flex items-start gap-2 text-xs rounded p-1.5 border", k.importance === "critical" ? "border-red-500/20 bg-red-500/5" : k.importance === "important" ? "border-amber-500/20 bg-amber-500/5" : "border-border")}>
                        <Badge variant="outline" className={cn("text-[9px] shrink-0", k.importance === "critical" ? "text-red-400 border-red-500/40" : k.importance === "important" ? "text-amber-400 border-amber-500/40" : "")}>{k.importance}</Badge>
                        <div><span className="font-mono font-semibold">{k.keyword}</span> — <span className="text-muted-foreground">add to {k.whereToAdd}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(result.quickFixes || []).length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Quick fixes</div>
                  <div className="space-y-1.5">
                    {result.quickFixes.map((f: any, i: number) => (
                      <div key={i} className="text-xs border rounded p-2">
                        <div className="font-semibold">{f.issue}</div>
                        <div className="text-muted-foreground mt-0.5">Fix: {f.fix}</div>
                        <div className="text-emerald-400 text-[10px] mt-0.5">Impact: {f.impact}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── TOOL 8: APPLICATION TRACKER ──────────────────────────────────────────
const APP_TRACKER_KEY = "career_application_tracker";
type AppEntry = { id: string; company: string; role: string; jobUrl: string; status: "saved" | "applied" | "interview" | "offer" | "rejected"; date: string; notes: string };
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  saved:     { label: "Saved",     color: "text-muted-foreground", bg: "bg-muted/30" },
  applied:   { label: "Applied",   color: "text-blue-400",         bg: "bg-blue-500/10" },
  interview: { label: "Interview", color: "text-violet-400",       bg: "bg-violet-500/10" },
  offer:     { label: "Offer!",    color: "text-emerald-400",      bg: "bg-emerald-500/10" },
  rejected:  { label: "Rejected",  color: "text-red-400",          bg: "bg-red-500/10" },
};

function ApplicationTrackerCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [newApp, setNewApp] = useState<Partial<AppEntry>>({ status: "saved" });
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(APP_TRACKER_KEY); if (raw) setApps(JSON.parse(raw)); } catch {}
  }, []);

  const persist = (list: AppEntry[]) => { setApps(list); try { localStorage.setItem(APP_TRACKER_KEY, JSON.stringify(list)); } catch {} };

  const addApp = () => {
    if (!newApp.company || !newApp.role) { toast({ title: "Company & role required", variant: "destructive" }); return; }
    const entry: AppEntry = { id: Date.now().toString(), company: newApp.company!, role: newApp.role!, jobUrl: newApp.jobUrl || "", status: (newApp.status as any) || "saved", date: new Date().toISOString().slice(0, 10), notes: newApp.notes || "" };
    persist([entry, ...apps]);
    setNewApp({ status: "saved" }); setAdding(false);
    toast({ title: "Application tracked" });
  };

  const updateStatus = (id: string, status: AppEntry["status"]) => persist(apps.map(a => a.id === id ? { ...a, status } : a));
  const updateNotes = (id: string, notes: string) => persist(apps.map(a => a.id === id ? { ...a, notes } : a));
  const removeApp = (id: string) => persist(apps.filter(a => a.id !== id));

  const stats = Object.keys(STATUS_CONFIG).reduce((acc, k) => ({ ...acc, [k]: apps.filter(a => a.status === k).length }), {} as Record<string, number>);

  return (
    <Card className="border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-500/10 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-fuchsia-400" /> Application Tracker
            {apps.length > 0 && <Badge className="text-[10px] bg-fuchsia-500/20 text-fuchsia-300 border-0">{apps.length} tracked</Badge>}
          </CardTitle>
          <button onClick={() => setExpanded(v => !v)} className="text-muted-foreground hover:text-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        </div>
        <p className="text-[11px] text-muted-foreground">Track every application — status, notes, follow-ups. Stored locally in your browser.</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {apps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([k, cfg]) => stats[k] ? (
                <div key={k} className={cn("text-[10px] px-2 py-0.5 rounded font-semibold", cfg.bg, cfg.color)}>{cfg.label}: {stats[k]}</div>
              ) : null)}
            </div>
          )}

          {adding ? (
            <div className="rounded-lg border p-3 space-y-2 bg-fuchsia-500/5 border-fuchsia-500/30">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Company <span className="text-red-400">*</span></Label><Input className="h-7 text-xs mt-0.5" placeholder="e.g. Nike" value={newApp.company || ""} onChange={e => setNewApp(n => ({ ...n, company: e.target.value }))} data-testid="input-app-company" /></div>
                <div><Label className="text-xs">Role <span className="text-red-400">*</span></Label><Input className="h-7 text-xs mt-0.5" placeholder="e.g. Creative Director" value={newApp.role || ""} onChange={e => setNewApp(n => ({ ...n, role: e.target.value }))} /></div>
                <div><Label className="text-xs">Job URL</Label><Input className="h-7 text-xs mt-0.5" placeholder="https://…" value={newApp.jobUrl || ""} onChange={e => setNewApp(n => ({ ...n, jobUrl: e.target.value }))} /></div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={newApp.status} onValueChange={v => setNewApp(n => ({ ...n, status: v as any }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Notes</Label><Input className="h-7 text-xs mt-0.5" placeholder="Contact person, deadline, anything useful…" value={newApp.notes || ""} onChange={e => setNewApp(n => ({ ...n, notes: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
                <Button size="sm" className="bg-fuchsia-600 hover:bg-fuchsia-700 flex-1" onClick={addApp} data-testid="btn-add-app">Add application</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full border-fuchsia-500/40 text-fuchsia-400 hover:bg-fuchsia-500/10" onClick={() => setAdding(true)} data-testid="btn-new-app">
              <Plus className="w-3.5 h-3.5 mr-1" /> Track new application
            </Button>
          )}

          <div className="space-y-2">
            {apps.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No applications tracked yet.</p>}
            {apps.map(a => (
              <div key={a.id} className={cn("rounded-lg border p-2.5 space-y-1.5", STATUS_CONFIG[a.status]?.bg, "border-white/5")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{a.role} <span className="text-muted-foreground font-normal">@ {a.company}</span></div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{a.date}</span>
                      {a.jobUrl && <a href={a.jobUrl} target="_blank" rel="noreferrer" className="text-[10px] text-violet-400 hover:underline flex items-center gap-0.5"><ExternalLink className="w-2.5 h-2.5" />Job link</a>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Select value={a.status} onValueChange={v => updateStatus(a.id, v as any)}>
                      <SelectTrigger className={cn("h-6 text-[10px] w-24 border-0", STATUS_CONFIG[a.status]?.color)}><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeApp(a.id)}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                  </div>
                </div>
                {editId === a.id ? (
                  <div className="flex gap-2">
                    <Input className="h-6 text-xs flex-1" defaultValue={a.notes} onBlur={e => { updateNotes(a.id, e.target.value); setEditId(null); }} autoFocus />
                  </div>
                ) : (
                  <button className="text-[10px] text-left w-full text-muted-foreground hover:text-foreground transition-colors" onClick={() => setEditId(a.id)}>
                    {a.notes ? a.notes : <span className="italic opacity-50">Add notes…</span>}
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ════════════════════════════ INSIGHTS ════════════════════════════
function InsightsTab() {
  const [insights, setInsights] = useState<any>(null);
  const gen = useMutation({
    mutationFn: () => apiRequest("/api/admin/career/insights", "POST").then(r => r.json()),
    onSuccess: setInsights,
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => gen.mutate()} disabled={gen.isPending} data-testid="btn-gen-insights">
            {gen.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Claude is thinking…</> : <><Lightbulb className="w-4 h-4 mr-2" />Get strategic insights</>}
          </Button>
        </CardContent>
      </Card>
      {insights && (
        <Card>
          <CardContent className="pt-4 space-y-4 text-sm">
            <div><div className="text-xs font-semibold uppercase mb-1">Top moves</div>
              {(insights.topMoves || []).map((m: any, i: number) => (
                <div key={i} className="border rounded p-2 mb-1">
                  <div className="font-semibold">{m.action}</div>
                  <p className="text-xs">{m.why}</p>
                  <div className="flex gap-1 mt-1"><Badge variant="outline" className="text-[10px]">effort: {m.effort}</Badge><Badge variant="outline" className="text-[10px]">impact: {m.impact}</Badge></div>
                </div>
              ))}
            </div>
            <div><div className="text-xs font-semibold uppercase mb-1">Positioning critique</div><p className="italic">{insights.positioningCritique}</p></div>
            {(insights.skillGaps || []).length > 0 && <div><div className="text-xs font-semibold uppercase mb-1">Skill gaps</div><ul className="list-disc pl-5">{insights.skillGaps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
            {(insights.bestTargetCompanies || []).length > 0 && <div><div className="text-xs font-semibold uppercase mb-1">Target companies</div>{insights.bestTargetCompanies.map((c: any, i: number) => <div key={i} className="text-xs"><strong>{c.name}</strong> — {c.why}</div>)}</div>}
            {(insights.outreachIdeas || []).length > 0 && <div><div className="text-xs font-semibold uppercase mb-1">Outreach ideas</div><ul className="list-disc pl-5 text-xs">{insights.outreachIdeas.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></div>}
            {insights.longGameAdvice && <div className="border-t pt-2"><div className="text-xs font-semibold uppercase mb-1">Long-game</div><p className="italic">{insights.longGameAdvice}</p></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
