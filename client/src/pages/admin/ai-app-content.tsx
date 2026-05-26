import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, RotateCcw, Sparkles, ArrowUp, ArrowDown, Eye, EyeOff,
  MessageSquare, User2, Languages, Wand2,
} from "lucide-react";

// ─── Defaults — kept in sync with client/src/pages/ai-assistant.tsx ──────────
type Lang = "en" | "nl" | "ar" | "tr" | "de" | "fr";
const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English",    flag: "🇬🇧" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "ar", label: "العربية",    flag: "🇸🇾" },
  { code: "tr", label: "Türkçe",     flag: "🇹🇷" },
  { code: "de", label: "Deutsch",    flag: "🇩🇪" },
  { code: "fr", label: "Français",   flag: "🇫🇷" },
];

const UI_KEYS: { key: string; label: string; multi?: boolean }[] = [
  { key: "title",       label: "Hero title" },
  { key: "subtitle",    label: "Hero subtitle", multi: true },
  { key: "rikiCard",    label: "Creator card — name" },
  { key: "rikiSub",     label: "Creator card — subtitle", multi: true },
  { key: "tools",       label: "Tools section title" },
  { key: "toolsSub",    label: "Tools section subtitle", multi: true },
  { key: "or",          label: 'Divider text ("Or ask me anything")' },
  { key: "placeholder", label: "Input placeholder" },
  { key: "hint",        label: "Input hint line" },
  { key: "clear",       label: "New-chat button label" },
  { key: "noAccess",    label: "Logged-out message", multi: true },
  { key: "typing",      label: "Typing indicator" },
];

const UI_DEFAULTS: Record<Lang, Record<string, string>> = {
  en: { title:"Urban AI", subtitle:"Your guide to urban culture in the Netherlands", tools:"Quick Tools", toolsSub:"Tap a topic to start a focused conversation", or:"Or ask me anything", placeholder:"Ask about spots, events, dance, music, Riki…", hint:"Enter to send · Shift+Enter for new line", clear:"New chat", noAccess:"Log in to use Urban AI.", rikiCard:"Created by Riki Almouti", rikiSub:"Founder of Urban Culture Hub, BTTS & Coffee & Dance", typing:"Urban AI is thinking…" },
  nl: { title:"Urban AI", subtitle:"Jouw gids voor urbane cultuur in Nederland", tools:"Snelle tools", toolsSub:"Tik een onderwerp aan voor een gerichte chat", or:"Of stel me een vraag", placeholder:"Vraag over spots, events, dans, muziek, Riki…", hint:"Enter om te sturen · Shift+Enter voor nieuwe regel", clear:"Nieuwe chat", noAccess:"Log in om Urban AI te gebruiken.", rikiCard:"Gemaakt door Riki Almouti", rikiSub:"Oprichter van Urban Culture Hub, BTTS & Coffee & Dance", typing:"Urban AI denkt na…" },
  ar: { title:"Urban AI", subtitle:"دليلك للثقافة الحضرية في هولندا", tools:"أدوات سريعة", toolsSub:"اضغط على موضوع لبدء محادثة مركّزة", or:"أو اسألني أي شيء", placeholder:"اسأل عن الأماكن، الفعاليات، الرقص، الموسيقى، ريكي…", hint:"اضغط Enter للإرسال · Shift+Enter لسطر جديد", clear:"محادثة جديدة", noAccess:"سجّل الدخول لاستخدام Urban AI.", rikiCard:"أنشأه ريكي الموتي", rikiSub:"مؤسس Urban Culture Hub و BTTS و Coffee & Dance", typing:"Urban AI يفكر…" },
  tr: { title:"Urban AI", subtitle:"Hollanda'daki kentsel kültür rehberin", tools:"Hızlı araçlar", toolsSub:"Odaklı bir sohbet başlatmak için bir konuya dokun", or:"Ya da bana her şeyi sor", placeholder:"Mekanlar, etkinlikler, dans, müzik, Riki hakkında sor…", hint:"Göndermek için Enter · Yeni satır için Shift+Enter", clear:"Yeni sohbet", noAccess:"Urban AI'yı kullanmak için giriş yap.", rikiCard:"Riki Almouti tarafından oluşturuldu", rikiSub:"Urban Culture Hub, BTTS ve Coffee & Dance'in kurucusu", typing:"Urban AI düşünüyor…" },
  de: { title:"Urban AI", subtitle:"Dein Guide für Urban Culture in den Niederlanden", tools:"Schnell-Tools", toolsSub:"Tippe ein Thema an für ein fokussiertes Gespräch", or:"Oder frag mich alles", placeholder:"Frag nach Spots, Events, Tanz, Musik, Riki…", hint:"Enter zum Senden · Shift+Enter für neue Zeile", clear:"Neuer Chat", noAccess:"Melde dich an, um Urban AI zu nutzen.", rikiCard:"Erstellt von Riki Almouti", rikiSub:"Gründer von Urban Culture Hub, BTTS & Coffee & Dance", typing:"Urban AI denkt nach…" },
  fr: { title:"Urban AI", subtitle:"Ton guide de la culture urbaine aux Pays-Bas", tools:"Outils rapides", toolsSub:"Appuie sur un sujet pour démarrer une conversation ciblée", or:"Ou pose-moi n'importe quelle question", placeholder:"Demande à propos des spots, événements, danse, musique, Riki…", hint:"Entrée pour envoyer · Shift+Entrée pour une nouvelle ligne", clear:"Nouvelle conversation", noAccess:"Connecte-toi pour utiliser Urban AI.", rikiCard:"Créé par Riki Almouti", rikiSub:"Fondateur d'Urban Culture Hub, BTTS & Coffee & Dance", typing:"Urban AI réfléchit…" },
};

interface ToolDef {
  id: string;
  label: Record<Lang, string>;
  description: Record<Lang, string>;
  starter: Record<Lang, string>;
}

const TOOL_DEFAULTS: ToolDef[] = [
  { id:"spots",       label:{en:"Spots & Streets",nl:"Spots & Straten",ar:"الأماكن والشوارع",tr:"Mekanlar & Sokaklar",de:"Spots & Straßen",fr:"Spots & Rues"}, description:{en:"Graffiti walls, skateparks, BMX, dance spots",nl:"Graffiti walls, skateparks, BMX, dansplekken",ar:"جدران الغرافيتي، الحدائق، BMX، مواضع الرقص",tr:"Grafiti duvarları, kaykay parkları, BMX, dans alanları",de:"Graffiti-Wände, Skateparks, BMX, Tanzspots",fr:"Murs graffiti, skateparks, BMX, lieux de danse"}, starter:{en:"What are the best urban culture spots in Amsterdam?",nl:"Wat zijn de beste urbane cultuurspots in Amsterdam?",ar:"ما هي أفضل أماكن الثقافة الحضرية في أمستردام؟",tr:"Amsterdam'daki en iyi kentsel kültür mekanları nelerdir?",de:"Was sind die besten Urban-Culture-Spots in Amsterdam?",fr:"Quels sont les meilleurs spots de culture urbaine à Amsterdam?"} },
  { id:"events",      label:{en:"Events & Battles",nl:"Events & Battles",ar:"الفعاليات والمعارك",tr:"Etkinlikler & Yarışmalar",de:"Events & Battles",fr:"Événements & Battles"}, description:{en:"Bboy battles, jams, festivals, nightlife",nl:"Bboy battles, jams, festivals, nachtleven",ar:"معارك البريك دانس، حفلات، مهرجانات",tr:"Bboy yarışmaları, jamler, festivaller, gece hayatı",de:"Bboy-Battles, Jams, Festivals, Nachtleben",fr:"Battles bboy, jams, festivals, vie nocturne"}, starter:{en:"Tell me about upcoming bboy battles and urban culture events in the Netherlands",nl:"Vertel me over aankomende bboy battles en urbane cultuur events in Nederland",ar:"أخبرني عن معارك البريك دانس وفعاليات الثقافة الحضرية القادمة في هولندا",tr:"Hollanda'daki yaklaşan bboy yarışmaları ve kentsel kültür etkinlikleri hakkında bilgi ver",de:"Erzähl mir von bevorstehenden Bboy-Battles und Urban-Culture-Events in den Niederlanden",fr:"Parle-moi des prochains battles bboy et événements de culture urbaine aux Pays-Bas"} },
  { id:"restaurants", label:{en:"Restaurants & Cafés",nl:"Restaurants & Cafés",ar:"المطاعم والمقاهي",tr:"Restoranlar & Kafeler",de:"Restaurants & Cafés",fr:"Restaurants & Cafés"}, description:{en:"Food spots loved by the urban scene",nl:"Etensspots geliefd bij de urbane scene",ar:"أماكن الطعام المحبوبة في المشهد الحضري",tr:"Kentsel sahne tarafından sevilen yemek mekanları",de:"Foodspots, die die Urban Scene liebt",fr:"Spots food aimés par la scène urbaine"}, starter:{en:"What are the best restaurants and cafés popular with the urban culture scene in Amsterdam and Rotterdam?",nl:"Wat zijn de beste restaurants en cafés populair bij de urbane cultuurscene in Amsterdam en Rotterdam?",ar:"ما هي أفضل المطاعم والمقاهي المشهورة في مشهد الثقافة الحضرية في أمستردام وروتردام؟",tr:"Amsterdam ve Rotterdam'daki kentsel kültür sahnesiyle popüler en iyi restoran ve kafeler nelerdir?",de:"Was sind die besten Restaurants und Cafés, die in der Urban-Culture-Szene in Amsterdam und Rotterdam beliebt sind?",fr:"Quels sont les meilleurs restaurants et cafés populaires dans la scène de culture urbaine à Amsterdam et Rotterdam?"} },
  { id:"museums",     label:{en:"Museums & Culture",nl:"Musea & Cultuur",ar:"المتاحف والثقافة",tr:"Müzeler & Kültür",de:"Museen & Kultur",fr:"Musées & Culture"}, description:{en:"STRAAT Museum, galleries, cultural hubs",nl:"STRAAT Museum, galerijen, culturele hubs",ar:"متحف ستيرات، الغاليريات، المراكز الثقافية",tr:"STRAAT Müzesi, galeriler, kültür merkezleri",de:"STRAAT Museum, Galerien, Kulturzentren",fr:"STRAAT Museum, galeries, centres culturels"}, starter:{en:"Tell me about STRAAT Museum and the best cultural spaces for urban art in the Netherlands",nl:"Vertel me over het STRAAT Museum en de beste culturele ruimtes voor urbane kunst in Nederland",ar:"أخبرني عن متحف ستيرات وأفضل الأماكن الثقافية للفن الحضري في هولندا",tr:"STRAAT Müzesi ve Hollanda'daki kentsel sanat için en iyi kültürel mekânlar hakkında bilgi ver",de:"Erzähl mir vom STRAAT Museum und den besten Kulturräumen für Urban Art in den Niederlanden",fr:"Parle-moi du STRAAT Museum et des meilleurs espaces culturels pour l'art urbain aux Pays-Bas"} },
  { id:"dance",       label:{en:"Dance & Breaking",nl:"Dans & Breaking",ar:"الرقص والبريك دانس",tr:"Dans & Breaking",de:"Tanz & Breaking",fr:"Danse & Breaking"}, description:{en:"Bboys/bgirls, hip-hop, BTTS, Coffee & Dance",nl:"Bboys/bgirls, hip-hop, BTTS, Coffee & Dance",ar:"البريك دانس، هيب هوب، BTTS، كوفي آند دانس",tr:"Bboys/bgirls, hip-hop, BTTS, Coffee & Dance",de:"Bboys/Bgirls, Hip-Hop, BTTS, Coffee & Dance",fr:"Bboys/bgirls, hip-hop, BTTS, Coffee & Dance"}, starter:{en:"Tell me about the breaking and hip-hop dance scene in the Netherlands — studios, battles, and tips for dancers",nl:"Vertel me over de breaking en hip-hop dansscene in Nederland — studio's, battles en tips voor dansers",ar:"أخبرني عن مشهد البريك دانس ورقصة الهيب هوب في هولندا - الاستوديوهات والمعارك ونصائح للراقصين",tr:"Hollanda'daki breaking ve hip-hop dans sahnesini anlat - stüdyolar, yarışmalar ve dansçılar için ipuçları",de:"Erzähl mir von der Breaking- und Hip-Hop-Tanzszene in den Niederlanden — Studios, Battles und Tipps",fr:"Parle-moi de la scène breaking et hip-hop aux Pays-Bas — studios, battles et conseils pour les danseurs"} },
  { id:"music",       label:{en:"Music & DJs",nl:"Muziek & DJ's",ar:"الموسيقى والديجيهات",tr:"Müzik & DJ'ler",de:"Musik & DJs",fr:"Musique & DJs"}, description:{en:"DJ nights, open mics, rap, producers",nl:"DJ nights, open mics, rap, producers",ar:"ليالي الديجيه، المفتوحة للجميع، الراب، المنتجون",tr:"DJ geceleri, açık mikler, rap, yapımcılar",de:"DJ-Nächte, Open Mics, Rap, Produzenten",fr:"Soirées DJ, open mics, rap, producteurs"}, starter:{en:"Where can I find DJ nights, open mics, and rap/hip-hop music venues in the Netherlands?",nl:"Waar kan ik DJ nights, open mics en rap/hip-hop muzieklocaties vinden in Nederland?",ar:"أين يمكنني العثور على ليالي الديجيه والبث المفتوح وأماكن موسيقى الراب/الهيب هوب في هولندا؟",tr:"Hollanda'da DJ geceleri, açık mikler ve rap/hip-hop müzik mekanlarını nerede bulabilirim?",de:"Wo finde ich DJ-Nächte, Open Mics und Rap/Hip-Hop-Musikorte in den Niederlanden?",fr:"Où trouver des soirées DJ, des open mics et des lieux de rap/hip-hop aux Pays-Bas?"} },
  { id:"reels",       label:{en:"Reels & Content",nl:"Reels & Content",ar:"الريلز والمحتوى",tr:"Reels & İçerik",de:"Reels & Content",fr:"Reels & Contenu"}, description:{en:"Post reels, write captions, community posts",nl:"Post reels, schrijf captions, community posts",ar:"نشر الريلز، كتابة التعليقات، منشورات المجتمع",tr:"Reels yayınla, açıklamalar yaz, topluluk gönderileri",de:"Reels posten, Captions schreiben, Community Posts",fr:"Poster des reels, écrire des captions, posts communautaires"}, starter:{en:"Help me write an engaging caption and hashtags for my breaking/hip-hop reel on Urban Culture Hub",nl:"Help me een boeiende caption en hashtags te schrijven voor mijn breaking/hip-hop reel op Urban Culture Hub",ar:"ساعدني في كتابة تعليق وهاشتاقات جذابة لريلز البريك دانس/الهيب هوب الخاص بي على Urban Culture Hub",tr:"Urban Culture Hub'daki breaking/hip-hop reelim için ilgi çekici bir açıklama ve hashtag'ler yazmama yardım et",de:"Hilf mir, eine ansprechende Caption und Hashtags für mein Breaking/Hip-Hop-Reel auf Urban Culture Hub zu schreiben",fr:"Aide-moi à écrire une légende et des hashtags engageants pour mon reel breaking/hip-hop sur Urban Culture Hub"} },
  { id:"platform",    label:{en:"Platform Help",nl:"Platform Hulp",ar:"مساعدة المنصة",tr:"Platform Yardımı",de:"Plattform-Hilfe",fr:"Aide Plateforme"}, description:{en:"How to use Urban Culture Hub features",nl:"Hoe gebruik je Urban Culture Hub functies",ar:"كيفية استخدام ميزات Urban Culture Hub",tr:"Urban Culture Hub özelliklerini nasıl kullanırsın",de:"Wie man Urban Culture Hub-Funktionen nutzt",fr:"Comment utiliser les fonctionnalités d'Urban Culture Hub"}, starter:{en:"How do I add a spot, post a reel, and buy BTTS tickets on Urban Culture Hub?",nl:"Hoe voeg ik een spot toe, post ik een reel en koop ik BTTS-tickets op Urban Culture Hub?",ar:"كيف أضيف مكانًا وأنشر ريلز وأشتري تذاكر BTTS على Urban Culture Hub؟",tr:"Urban Culture Hub'da nasıl mekan eklerim, reel yayınlarım ve BTTS bileti satın alırım?",de:"Wie füge ich einen Spot hinzu, poste ich ein Reel und kaufe BTTS-Tickets auf Urban Culture Hub?",fr:"Comment ajouter un spot, poster un reel et acheter des billets BTTS sur Urban Culture Hub?"} },
  { id:"riki",        label:{en:"Riki's Story",nl:"Riki's Verhaal",ar:"قصة ريكي",tr:"Riki'nin Hikayesi",de:"Rikis Geschichte",fr:"L'histoire de Riki"}, description:{en:"Founder's story, BTTS & Coffee & Dance",nl:"Oprichtersverhaal, BTTS & Coffee & Dance",ar:"قصة المؤسس، BTTS وكوفي آند دانس",tr:"Kurucu hikayesi, BTTS ve Coffee & Dance",de:"Geschichte des Gründers, BTTS & Coffee & Dance",fr:"Histoire du fondateur, BTTS & Coffee & Dance"}, starter:{en:"Tell me about Riki Almouti — the founder of Urban Culture Hub. What is his story, his background, and what is Back to the Street (BTTS)?",nl:"Vertel me over Riki Almouti — de oprichter van Urban Culture Hub. Wat is zijn verhaal en achtergrond en wat is Back to the Street (BTTS)?",ar:"أخبرني عن ريكي الموتي — مؤسس Urban Culture Hub. ما هي قصته وخلفيته وما هي Back to the Street (BTTS)؟",tr:"Urban Culture Hub'ın kurucusu Riki Almouti hakkında bilgi ver. Hikayesi ve geçmişi nedir, Back to the Street (BTTS) nedir?",de:"Erzähl mir von Riki Almouti — dem Gründer von Urban Culture Hub. Was ist seine Geschichte und was ist Back to the Street (BTTS)?",fr:"Parle-moi de Riki Almouti — le fondateur d'Urban Culture Hub. Quelle est son histoire et qu'est-ce que Back to the Street (BTTS)?"} },
];

// ─── Page state shape ─────────────────────────────────────────────────────────
interface ToolState extends ToolDef {
  hidden: boolean;
  order: number;
}

interface PageState {
  ui: Record<Lang, Record<string, string>>;
  tools: ToolState[];
}

function buildInitialState(remote: any): PageState {
  const ui: Record<Lang, Record<string, string>> = {} as any;
  for (const { code } of LANGS) {
    ui[code] = { ...UI_DEFAULTS[code], ...(remote?.ui?.[code] || {}) };
  }
  const remoteTools = Array.isArray(remote?.tools) ? remote.tools : [];
  const tools: ToolState[] = TOOL_DEFAULTS.map((d, i) => {
    const r = remoteTools.find((x: any) => x?.id === d.id);
    const mergedLang = (key: keyof ToolDef) => {
      const out: Record<Lang, string> = { ...d[key] } as any;
      const overrides = r?.[key];
      if (overrides && typeof overrides === "object") {
        for (const c of LANGS) if (typeof overrides[c.code] === "string") out[c.code] = overrides[c.code];
      }
      return out;
    };
    return {
      id: d.id,
      label: mergedLang("label"),
      description: mergedLang("description"),
      starter: mergedLang("starter"),
      hidden: !!r?.hidden,
      order: typeof r?.order === "number" ? r.order : i,
    };
  }).sort((a, b) => a.order - b.order);
  return { ui, tools };
}

export default function AiAppContentPage() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/ai-app-content"] });
  const [state, setState] = useState<PageState | null>(null);
  const [activeLang, setActiveLang] = useState<Lang>("en");

  useEffect(() => {
    if (data !== undefined) setState(buildInitialState(data));
  }, [data]);

  const save = useMutation({
    mutationFn: async (payload: PageState) => apiRequest("/api/admin/ai-app-content", "PUT", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-app-content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-app-content"] });
      toast({ title: "Saved", description: "AI page content updated. Users will see changes on their next visit." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message || "Could not save", variant: "destructive" }),
  });

  const reset = useMutation({
    mutationFn: async () => apiRequest("/api/admin/ai-app-content", "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-app-content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-app-content"] });
      setState(buildInitialState({}));
      toast({ title: "Reset to defaults", description: "All overrides cleared." });
    },
  });

  const dirty = useMemo(() => {
    if (!state) return false;
    const baseline = buildInitialState(data || {});
    return JSON.stringify(baseline) !== JSON.stringify(state);
  }, [state, data]);

  if (isLoading || !state) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const updateUi = (lang: Lang, key: string, val: string) => {
    setState(s => s && ({ ...s, ui: { ...s.ui, [lang]: { ...s.ui[lang], [key]: val } } }));
  };
  const updateTool = (idx: number, patch: Partial<ToolState>) => {
    setState(s => s && ({ ...s, tools: s.tools.map((t, i) => i === idx ? { ...t, ...patch } : t) }));
  };
  const updateToolLang = (idx: number, field: "label" | "description" | "starter", lang: Lang, val: string) => {
    setState(s => s && ({
      ...s,
      tools: s.tools.map((t, i) => i === idx ? { ...t, [field]: { ...t[field], [lang]: val } } : t),
    }));
  };
  const moveTool = (idx: number, dir: -1 | 1) => {
    setState(s => {
      if (!s) return s;
      const j = idx + dir;
      if (j < 0 || j >= s.tools.length) return s;
      const tools = [...s.tools];
      [tools[idx], tools[j]] = [tools[j], tools[idx]];
      return { ...s, tools: tools.map((t, i) => ({ ...t, order: i })) };
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="page-ai-app-content">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" /> AI Main App Content
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">
            Edit everything users see on the public Urban AI page (<code className="text-xs">/ai-assistant</code>) — hero copy, the
            "Created by Riki Almouti" card, the Quick Tools grid, the input placeholder, and per-language translations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            data-testid="button-reset-defaults"
          >
            {reset.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            Reset to defaults
          </Button>
          <Button
            onClick={() => state && save.mutate(state)}
            disabled={!dirty || save.isPending}
            data-testid="button-save-content"
          >
            {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save changes {dirty && <Badge variant="secondary" className="ml-2">unsaved</Badge>}
          </Button>
        </div>
      </div>

      {/* Language switcher */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Languages className="w-4 h-4" /> Editing language</CardTitle>
          <CardDescription>Pick a language to edit its copy. All 6 are saved together.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {LANGS.map(l => (
            <Button
              key={l.code}
              variant={activeLang === l.code ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveLang(l.code)}
              data-testid={`lang-tab-${l.code}`}
            >
              <span className="mr-1.5">{l.flag}</span> {l.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Tabs defaultValue="ui">
        <TabsList>
          <TabsTrigger value="ui" data-testid="tab-ui"><MessageSquare className="w-4 h-4 mr-1.5" /> Hero & UI strings</TabsTrigger>
          <TabsTrigger value="creator" data-testid="tab-creator"><User2 className="w-4 h-4 mr-1.5" /> Creator card</TabsTrigger>
          <TabsTrigger value="tools" data-testid="tab-tools"><Wand2 className="w-4 h-4 mr-1.5" /> Quick Tools</TabsTrigger>
        </TabsList>

        {/* ── UI strings tab ── */}
        <TabsContent value="ui" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page copy ({LANGS.find(l => l.code === activeLang)?.label})</CardTitle>
              <CardDescription>Hero, tools section, input bar and status messages.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {UI_KEYS.filter(k => k.key !== "rikiCard" && k.key !== "rikiSub").map(({ key, label, multi }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
                  {multi ? (
                    <Textarea
                      value={state.ui[activeLang]?.[key] ?? ""}
                      onChange={(e) => updateUi(activeLang, key, e.target.value)}
                      rows={2}
                      dir={activeLang === "ar" ? "rtl" : "ltr"}
                      data-testid={`input-ui-${key}-${activeLang}`}
                    />
                  ) : (
                    <Input
                      value={state.ui[activeLang]?.[key] ?? ""}
                      onChange={(e) => updateUi(activeLang, key, e.target.value)}
                      dir={activeLang === "ar" ? "rtl" : "ltr"}
                      data-testid={`input-ui-${key}-${activeLang}`}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Creator card tab ── */}
        <TabsContent value="creator" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Creator card ({LANGS.find(l => l.code === activeLang)?.label})</CardTitle>
              <CardDescription>The amber "Created by Riki Almouti" card right under the hero.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name / title line</Label>
                <Input
                  value={state.ui[activeLang]?.rikiCard ?? ""}
                  onChange={(e) => updateUi(activeLang, "rikiCard", e.target.value)}
                  dir={activeLang === "ar" ? "rtl" : "ltr"}
                  data-testid={`input-creator-name-${activeLang}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Subtitle</Label>
                <Textarea
                  value={state.ui[activeLang]?.rikiSub ?? ""}
                  onChange={(e) => updateUi(activeLang, "rikiSub", e.target.value)}
                  rows={2}
                  dir={activeLang === "ar" ? "rtl" : "ltr"}
                  data-testid={`input-creator-sub-${activeLang}`}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: tapping the card on the public page sends the "Riki's Story" starter prompt — edit that prompt in the Quick Tools tab.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tools tab ── */}
        <TabsContent value="tools" className="space-y-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Tools — {state.tools.length} topics</CardTitle>
              <CardDescription>
                Reorder, hide, or rename each topic card. Editing language: <strong>{LANGS.find(l => l.code === activeLang)?.label}</strong>.
                The "Riki's Story" tool is what powers the creator card click.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.tools.map((tool, idx) => (
                <div
                  key={tool.id}
                  className={`rounded-lg border p-4 space-y-3 ${tool.hidden ? "opacity-60 bg-muted/30" : "bg-card"}`}
                  data-testid={`tool-row-${tool.id}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">{tool.id}</Badge>
                      <span className="font-semibold">{tool.label[activeLang] || tool.label.en}</span>
                      {tool.hidden && <Badge variant="secondary"><EyeOff className="w-3 h-3 mr-1" />Hidden</Badge>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => moveTool(idx, -1)} disabled={idx === 0} data-testid={`btn-tool-up-${tool.id}`}>
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => moveTool(idx, 1)} disabled={idx === state.tools.length - 1} data-testid={`btn-tool-down-${tool.id}`}>
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                      <Separator orientation="vertical" className="mx-1 h-6" />
                      <div className="flex items-center gap-2 pl-1">
                        {tool.hidden ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                        <Switch
                          checked={!tool.hidden}
                          onCheckedChange={(v) => updateTool(idx, { hidden: !v })}
                          data-testid={`switch-tool-${tool.id}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Card label</Label>
                      <Input
                        value={tool.label[activeLang] ?? ""}
                        onChange={(e) => updateToolLang(idx, "label", activeLang, e.target.value)}
                        dir={activeLang === "ar" ? "rtl" : "ltr"}
                        data-testid={`input-tool-label-${tool.id}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Card description</Label>
                      <Input
                        value={tool.description[activeLang] ?? ""}
                        onChange={(e) => updateToolLang(idx, "description", activeLang, e.target.value)}
                        dir={activeLang === "ar" ? "rtl" : "ltr"}
                        data-testid={`input-tool-desc-${tool.id}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Starter prompt sent to AI when tapped</Label>
                    <Textarea
                      value={tool.starter[activeLang] ?? ""}
                      onChange={(e) => updateToolLang(idx, "starter", activeLang, e.target.value)}
                      rows={2}
                      dir={activeLang === "ar" ? "rtl" : "ltr"}
                      data-testid={`input-tool-starter-${tool.id}`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky save bar on mobile */}
      {dirty && (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <div className="bg-background border rounded-full shadow-lg px-3 py-1.5 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
            <Button size="sm" onClick={() => state && save.mutate(state)} disabled={save.isPending} data-testid="button-save-sticky">
              {save.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
