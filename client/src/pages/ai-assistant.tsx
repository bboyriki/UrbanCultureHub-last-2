import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Send, Loader2, RotateCcw, ChevronRight,
  MapPin, CalendarDays, Utensils, Building2, Music4,
  Disc3, Clapperboard, HelpCircle, User2, Zap,
  Globe, ArrowLeft, Languages, MessageSquare, Brain, PenLine, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AIPremiumGate } from "@/components/ui/ai-premium-gate";
import { useAIAccess } from "@/hooks/useAIAccess";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

type ChatLang = "en" | "nl" | "ar" | "tr" | "de" | "fr";

// ─── Languages ───────────────────────────────────────────────────────────────
const LANGUAGES: { code: ChatLang; label: string; flag: string }[] = [
  { code: "en", label: "English",  flag: "🇬🇧" },
  { code: "nl", label: "Nederlands", flag: "🇳🇱" },
  { code: "ar", label: "العربية",  flag: "🇸🇾" },
  { code: "tr", label: "Türkçe",   flag: "🇹🇷" },
  { code: "de", label: "Deutsch",  flag: "🇩🇪" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
];

// ─── Tool categories ──────────────────────────────────────────────────────────
interface ToolCategory {
  id: string;
  icon: React.ReactNode;
  color: string;         // tailwind bg gradient classes
  glow: string;          // tailwind ring / glow color
  label: Record<ChatLang, string>;
  description: Record<ChatLang, string>;
  starter: Record<ChatLang, string>;  // pre-filled chat message
}

const TOOLS: ToolCategory[] = [
  {
    id: "spots",
    icon: <MapPin className="w-5 h-5" />,
    color: "from-orange-500 to-amber-500",
    glow: "group-hover:shadow-orange-500/30",
    label: { en:"Spots & Streets", nl:"Spots & Straten", ar:"الأماكن والشوارع", tr:"Mekanlar & Sokaklar", de:"Spots & Straßen", fr:"Spots & Rues" },
    description: { en:"Graffiti walls, skateparks, BMX, dance spots", nl:"Graffiti walls, skateparks, BMX, dansplekken", ar:"جدران الغرافيتي، الحدائق، BMX، مواضع الرقص", tr:"Grafiti duvarları, kaykay parkları, BMX, dans alanları", de:"Graffiti-Wände, Skateparks, BMX, Tanzspots", fr:"Murs graffiti, skateparks, BMX, lieux de danse" },
    starter: { en:"What are the best urban culture spots in Amsterdam?", nl:"Wat zijn de beste urbane cultuurspots in Amsterdam?", ar:"ما هي أفضل أماكن الثقافة الحضرية في أمستردام؟", tr:"Amsterdam'daki en iyi kentsel kültür mekanları nelerdir?", de:"Was sind die besten Urban-Culture-Spots in Amsterdam?", fr:"Quels sont les meilleurs spots de culture urbaine à Amsterdam?" },
  },
  {
    id: "events",
    icon: <CalendarDays className="w-5 h-5" />,
    color: "from-violet-600 to-purple-500",
    glow: "group-hover:shadow-violet-500/30",
    label: { en:"Events & Battles", nl:"Events & Battles", ar:"الفعاليات والمعارك", tr:"Etkinlikler & Yarışmalar", de:"Events & Battles", fr:"Événements & Battles" },
    description: { en:"Bboy battles, jams, festivals, nightlife", nl:"Bboy battles, jams, festivals, nachtleven", ar:"معارك البريك دانس، حفلات، مهرجانات", tr:"Bboy yarışmaları, jamler, festivaller, gece hayatı", de:"Bboy-Battles, Jams, Festivals, Nachtleben", fr:"Battles bboy, jams, festivals, vie nocturne" },
    starter: { en:"Tell me about upcoming bboy battles and urban culture events in the Netherlands", nl:"Vertel me over aankomende bboy battles en urbane cultuur events in Nederland", ar:"أخبرني عن معارك البريك دانس وفعاليات الثقافة الحضرية القادمة في هولندا", tr:"Hollanda'daki yaklaşan bboy yarışmaları ve kentsel kültür etkinlikleri hakkında bilgi ver", de:"Erzähl mir von bevorstehenden Bboy-Battles und Urban-Culture-Events in den Niederlanden", fr:"Parle-moi des prochains battles bboy et événements de culture urbaine aux Pays-Bas" },
  },
  {
    id: "restaurants",
    icon: <Utensils className="w-5 h-5" />,
    color: "from-rose-500 to-red-500",
    glow: "group-hover:shadow-rose-500/30",
    label: { en:"Restaurants & Cafés", nl:"Restaurants & Cafés", ar:"المطاعم والمقاهي", tr:"Restoranlar & Kafeler", de:"Restaurants & Cafés", fr:"Restaurants & Cafés" },
    description: { en:"Food spots loved by the urban scene", nl:"Etensspots geliefd bij de urbane scene", ar:"أماكن الطعام المحبوبة في المشهد الحضري", tr:"Kentsel sahne tarafından sevilen yemek mekanları", de:"Foodspots, die die Urban Scene liebt", fr:"Spots food aimés par la scène urbaine" },
    starter: { en:"What are the best restaurants and cafés popular with the urban culture scene in Amsterdam and Rotterdam?", nl:"Wat zijn de beste restaurants en cafés populair bij de urbane cultuurscene in Amsterdam en Rotterdam?", ar:"ما هي أفضل المطاعم والمقاهي المشهورة في مشهد الثقافة الحضرية في أمستردام وروتردام؟", tr:"Amsterdam ve Rotterdam'daki kentsel kültür sahnesiyle popüler en iyi restoran ve kafeler nelerdir?", de:"Was sind die besten Restaurants und Cafés, die in der Urban-Culture-Szene in Amsterdam und Rotterdam beliebt sind?", fr:"Quels sont les meilleurs restaurants et cafés populaires dans la scène de culture urbaine à Amsterdam et Rotterdam?" },
  },
  {
    id: "museums",
    icon: <Building2 className="w-5 h-5" />,
    color: "from-blue-600 to-cyan-500",
    glow: "group-hover:shadow-blue-500/30",
    label: { en:"Museums & Culture", nl:"Musea & Cultuur", ar:"المتاحف والثقافة", tr:"Müzeler & Kültür", de:"Museen & Kultur", fr:"Musées & Culture" },
    description: { en:"STRAAT Museum, galleries, cultural hubs", nl:"STRAAT Museum, galerijen, culturele hubs", ar:"متحف ستيرات، الغاليريات، المراكز الثقافية", tr:"STRAAT Müzesi, galeriler, kültür merkezleri", de:"STRAAT Museum, Galerien, Kulturzentren", fr:"STRAAT Museum, galeries, centres culturels" },
    starter: { en:"Tell me about STRAAT Museum and the best cultural spaces for urban art in the Netherlands", nl:"Vertel me over het STRAAT Museum en de beste culturele ruimtes voor urbane kunst in Nederland", ar:"أخبرني عن متحف ستيرات وأفضل الأماكن الثقافية للفن الحضري في هولندا", tr:"STRAAT Müzesi ve Hollanda'daki kentsel sanat için en iyi kültürel mekânlar hakkında bilgi ver", de:"Erzähl mir vom STRAAT Museum und den besten Kulturräumen für Urban Art in den Niederlanden", fr:"Parle-moi du STRAAT Museum et des meilleurs espaces culturels pour l'art urbain aux Pays-Bas" },
  },
  {
    id: "dance",
    icon: <Music4 className="w-5 h-5" />,
    color: "from-fuchsia-500 to-pink-500",
    glow: "group-hover:shadow-fuchsia-500/30",
    label: { en:"Dance & Breaking", nl:"Dans & Breaking", ar:"الرقص والبريك دانس", tr:"Dans & Breaking", de:"Tanz & Breaking", fr:"Danse & Breaking" },
    description: { en:"Bboys/bgirls, hip-hop, BTTS, Coffee & Dance", nl:"Bboys/bgirls, hip-hop, BTTS, Coffee & Dance", ar:"البريك دانس، هيب هوب، BTTS، كوفي آند دانس", tr:"Bboys/bgirls, hip-hop, BTTS, Coffee & Dance", de:"Bboys/Bgirls, Hip-Hop, BTTS, Coffee & Dance", fr:"Bboys/bgirls, hip-hop, BTTS, Coffee & Dance" },
    starter: { en:"Tell me about the breaking and hip-hop dance scene in the Netherlands — studios, battles, and tips for dancers", nl:"Vertel me over de breaking en hip-hop dansscene in Nederland — studio's, battles en tips voor dansers", ar:"أخبرني عن مشهد البريك دانس ورقصة الهيب هوب في هولندا - الاستوديوهات والمعارك ونصائح للراقصين", tr:"Hollanda'daki breaking ve hip-hop dans sahnesini anlat - stüdyolar, yarışmalar ve dansçılar için ipuçları", de:"Erzähl mir von der Breaking- und Hip-Hop-Tanzszene in den Niederlanden — Studios, Battles und Tipps", fr:"Parle-moi de la scène breaking et hip-hop aux Pays-Bas — studios, battles et conseils pour les danseurs" },
  },
  {
    id: "music",
    icon: <Disc3 className="w-5 h-5" />,
    color: "from-green-500 to-emerald-500",
    glow: "group-hover:shadow-green-500/30",
    label: { en:"Music & DJs", nl:"Muziek & DJ's", ar:"الموسيقى والديجيهات", tr:"Müzik & DJ'ler", de:"Musik & DJs", fr:"Musique & DJs" },
    description: { en:"DJ nights, open mics, rap, producers", nl:"DJ nights, open mics, rap, producers", ar:"ليالي الديجيه، المفتوحة للجميع، الراب، المنتجون", tr:"DJ geceleri, açık mikler, rap, yapımcılar", de:"DJ-Nächte, Open Mics, Rap, Produzenten", fr:"Soirées DJ, open mics, rap, producteurs" },
    starter: { en:"Where can I find DJ nights, open mics, and rap/hip-hop music venues in the Netherlands?", nl:"Waar kan ik DJ nights, open mics en rap/hip-hop muzieklocaties vinden in Nederland?", ar:"أين يمكنني العثور على ليالي الديجيه والبث المفتوح وأماكن موسيقى الراب/الهيب هوب في هولندا؟", tr:"Hollanda'da DJ geceleri, açık mikler ve rap/hip-hop müzik mekanlarını nerede bulabilirim?", de:"Wo finde ich DJ-Nächte, Open Mics und Rap/Hip-Hop-Musikorte in den Niederlanden?", fr:"Où trouver des soirées DJ, des open mics et des lieux de rap/hip-hop aux Pays-Bas?" },
  },
  {
    id: "reels",
    icon: <Clapperboard className="w-5 h-5" />,
    color: "from-cyan-500 to-sky-500",
    glow: "group-hover:shadow-cyan-500/30",
    label: { en:"Reels & Content", nl:"Reels & Content", ar:"الريلز والمحتوى", tr:"Reels & İçerik", de:"Reels & Content", fr:"Reels & Contenu" },
    description: { en:"Post reels, write captions, community posts", nl:"Post reels, schrijf captions, community posts", ar:"نشر الريلز، كتابة التعليقات، منشورات المجتمع", tr:"Reels yayınla, açıklamalar yaz, topluluk gönderileri", de:"Reels posten, Captions schreiben, Community Posts", fr:"Poster des reels, écrire des captions, posts communautaires" },
    starter: { en:"Help me write an engaging caption and hashtags for my breaking/hip-hop reel on Urban Culture Hub", nl:"Help me een boeiende caption en hashtags te schrijven voor mijn breaking/hip-hop reel op Urban Culture Hub", ar:"ساعدني في كتابة تعليق وهاشتاقات جذابة لريلز البريك دانس/الهيب هوب الخاص بي على Urban Culture Hub", tr:"Urban Culture Hub'daki breaking/hip-hop reelim için ilgi çekici bir açıklama ve hashtag'ler yazmama yardım et", de:"Hilf mir, eine ansprechende Caption und Hashtags für mein Breaking/Hip-Hop-Reel auf Urban Culture Hub zu schreiben", fr:"Aide-moi à écrire une légende et des hashtags engageants pour mon reel breaking/hip-hop sur Urban Culture Hub" },
  },
  {
    id: "platform",
    icon: <HelpCircle className="w-5 h-5" />,
    color: "from-slate-500 to-zinc-500",
    glow: "group-hover:shadow-slate-500/30",
    label: { en:"Platform Help", nl:"Platform Hulp", ar:"مساعدة المنصة", tr:"Platform Yardımı", de:"Plattform-Hilfe", fr:"Aide Plateforme" },
    description: { en:"How to use Urban Culture Hub features", nl:"Hoe gebruik je Urban Culture Hub functies", ar:"كيفية استخدام ميزات Urban Culture Hub", tr:"Urban Culture Hub özelliklerini nasıl kullanırsın", de:"Wie man Urban Culture Hub-Funktionen nutzt", fr:"Comment utiliser les fonctionnalités d'Urban Culture Hub" },
    starter: { en:"How do I add a spot, post a reel, and buy BTTS tickets on Urban Culture Hub?", nl:"Hoe voeg ik een spot toe, post ik een reel en koop ik BTTS-tickets op Urban Culture Hub?", ar:"كيف أضيف مكانًا وأنشر ريلز وأشتري تذاكر BTTS على Urban Culture Hub؟", tr:"Urban Culture Hub'da nasıl mekan eklerim, reel yayınlarım ve BTTS bileti satın alırım?", de:"Wie füge ich einen Spot hinzu, poste ich ein Reel und kaufe BTTS-Tickets auf Urban Culture Hub?", fr:"Comment ajouter un spot, poster un reel et acheter des billets BTTS sur Urban Culture Hub?" },
  },
  {
    id: "riki",
    icon: <User2 className="w-5 h-5" />,
    color: "from-yellow-500 to-amber-400",
    glow: "group-hover:shadow-yellow-500/30",
    label: { en:"Riki's Story", nl:"Riki's Verhaal", ar:"قصة ريكي", tr:"Riki'nin Hikayesi", de:"Rikis Geschichte", fr:"L'histoire de Riki" },
    description: { en:"Founder's story, BTTS & Coffee & Dance", nl:"Oprichtersverhaal, BTTS & Coffee & Dance", ar:"قصة المؤسس، BTTS وكوفي آند دانس", tr:"Kurucu hikayesi, BTTS ve Coffee & Dance", de:"Geschichte des Gründers, BTTS & Coffee & Dance", fr:"Histoire du fondateur, BTTS & Coffee & Dance" },
    starter: { en:"Tell me about Riki Almouti — the founder of Urban Culture Hub. What is his story, his background, and what is Back to the Street (BTTS)?", nl:"Vertel me over Riki Almouti — de oprichter van Urban Culture Hub. Wat is zijn verhaal en achtergrond en wat is Back to the Street (BTTS)?", ar:"أخبرني عن ريكي الموتي — مؤسس Urban Culture Hub. ما هي قصته وخلفيته وما هي Back to the Street (BTTS)؟", tr:"Urban Culture Hub'ın kurucusu Riki Almouti hakkında bilgi ver. Hikayesi ve geçmişi nedir, Back to the Street (BTTS) nedir?", de:"Erzähl mir von Riki Almouti — dem Gründer von Urban Culture Hub. Was ist seine Geschichte und was ist Back to the Street (BTTS)?", fr:"Parle-moi de Riki Almouti — le fondateur d'Urban Culture Hub. Quelle est son histoire et qu'est-ce que Back to the Street (BTTS)?" },
  },
];

// ─── Chat bubble ──────────────────────────────────────────────────────────────
function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5 mb-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center mt-0.5 shadow-lg shadow-violet-500/20">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-gradient-to-br from-violet-600 to-purple-500 text-white rounded-tr-sm shadow-lg shadow-violet-500/20"
            : "bg-muted/60 dark:bg-zinc-800/80 text-foreground rounded-tl-sm border border-border/40"
        )}
        data-testid={`chat-bubble-${msg.id}`}
      >
        {msg.content || (!isUser && (
          <span className="flex gap-1 py-0.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Tool card ────────────────────────────────────────────────────────────────
function ToolCard({ tool, lang, onClick }: { tool: ToolCategory; lang: ChatLang; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      data-testid={`tool-card-${tool.id}`}
      className={cn(
        "group relative flex flex-col gap-2.5 p-4 rounded-2xl border border-border/50",
        "bg-card/60 hover:bg-card/90 dark:bg-zinc-900/60 dark:hover:bg-zinc-900/90",
        "transition-all duration-300 hover:-translate-y-1 text-left",
        "hover:shadow-xl hover:border-border/80",
        tool.glow,
      )}
    >
      <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg", tool.color)}>
        {tool.icon}
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground leading-tight">{tool.label[lang]}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{tool.description[lang]}</p>
      </div>
      <ChevronRight className="absolute top-4 right-4 w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}

// ─── Language picker ──────────────────────────────────────────────────────────
function LangPicker({ value, onChange }: { value: ChatLang; onChange: (l: ChatLang) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Languages className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => onChange(l.code)}
          data-testid={`lang-${l.code}`}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-all",
            value === l.code
              ? "bg-violet-600 text-white shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>{l.flag}</span>
          <span className="hidden sm:inline">{l.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── UI string sets ───────────────────────────────────────────────────────────
const UI: Record<ChatLang, Record<string, string>> = {
  en: {
    title: "Urban AI",
    subtitle: "Your guide to urban culture in the Netherlands",
    tools: "Quick Tools",
    toolsSub: "Tap a topic to start a focused conversation",
    or: "Or ask me anything",
    placeholder: "Ask about spots, events, dance, music, Riki…",
    hint: "Enter to send · Shift+Enter for new line",
    clear: "New chat",
    noAccess: "Log in to use Urban AI.",
    rikiCard: "Created by Riki Almouti",
    rikiSub: "Founder of Urban Culture Hub, BTTS & Coffee & Dance",
    typing: "Urban AI is thinking…",
  },
  nl: {
    title: "Urban AI",
    subtitle: "Jouw gids voor urbane cultuur in Nederland",
    tools: "Snelle tools",
    toolsSub: "Tik een onderwerp aan voor een gerichte chat",
    or: "Of stel me een vraag",
    placeholder: "Vraag over spots, events, dans, muziek, Riki…",
    hint: "Enter om te sturen · Shift+Enter voor nieuwe regel",
    clear: "Nieuwe chat",
    noAccess: "Log in om Urban AI te gebruiken.",
    rikiCard: "Gemaakt door Riki Almouti",
    rikiSub: "Oprichter van Urban Culture Hub, BTTS & Coffee & Dance",
    typing: "Urban AI denkt na…",
  },
  ar: {
    title: "Urban AI",
    subtitle: "دليلك للثقافة الحضرية في هولندا",
    tools: "أدوات سريعة",
    toolsSub: "اضغط على موضوع لبدء محادثة مركّزة",
    or: "أو اسألني أي شيء",
    placeholder: "اسأل عن الأماكن، الفعاليات، الرقص، الموسيقى، ريكي…",
    hint: "اضغط Enter للإرسال · Shift+Enter لسطر جديد",
    clear: "محادثة جديدة",
    noAccess: "سجّل الدخول لاستخدام Urban AI.",
    rikiCard: "أنشأه ريكي الموتي",
    rikiSub: "مؤسس Urban Culture Hub و BTTS و Coffee & Dance",
    typing: "Urban AI يفكر…",
  },
  tr: {
    title: "Urban AI",
    subtitle: "Hollanda'daki kentsel kültür rehberin",
    tools: "Hızlı araçlar",
    toolsSub: "Odaklı bir sohbet başlatmak için bir konuya dokun",
    or: "Ya da bana her şeyi sor",
    placeholder: "Mekanlar, etkinlikler, dans, müzik, Riki hakkında sor…",
    hint: "Göndermek için Enter · Yeni satır için Shift+Enter",
    clear: "Yeni sohbet",
    noAccess: "Urban AI'yı kullanmak için giriş yap.",
    rikiCard: "Riki Almouti tarafından oluşturuldu",
    rikiSub: "Urban Culture Hub, BTTS ve Coffee & Dance'in kurucusu",
    typing: "Urban AI düşünüyor…",
  },
  de: {
    title: "Urban AI",
    subtitle: "Dein Guide für Urban Culture in den Niederlanden",
    tools: "Schnell-Tools",
    toolsSub: "Tippe ein Thema an für ein fokussiertes Gespräch",
    or: "Oder frag mich alles",
    placeholder: "Frag nach Spots, Events, Tanz, Musik, Riki…",
    hint: "Enter zum Senden · Shift+Enter für neue Zeile",
    clear: "Neuer Chat",
    noAccess: "Melde dich an, um Urban AI zu nutzen.",
    rikiCard: "Erstellt von Riki Almouti",
    rikiSub: "Gründer von Urban Culture Hub, BTTS & Coffee & Dance",
    typing: "Urban AI denkt nach…",
  },
  fr: {
    title: "Urban AI",
    subtitle: "Ton guide de la culture urbaine aux Pays-Bas",
    tools: "Outils rapides",
    toolsSub: "Appuie sur un sujet pour démarrer une conversation ciblée",
    or: "Ou pose-moi n'importe quelle question",
    placeholder: "Demande à propos des spots, événements, danse, musique, Riki…",
    hint: "Entrée pour envoyer · Shift+Entrée pour une nouvelle ligne",
    clear: "Nouvelle conversation",
    noAccess: "Connecte-toi pour utiliser Urban AI.",
    rikiCard: "Créé par Riki Almouti",
    rikiSub: "Fondateur d'Urban Culture Hub, BTTS & Coffee & Dance",
    typing: "Urban AI réfléchit…",
  },
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AIAssistantPage() {
  const { user } = useAuth();
  const access = useAIAccess();
  const { toast } = useToast();
  const { language: siteLanguage } = useLanguage();

  // Map site language to chatLang — so switching site language auto-switches AI language
  const getSiteAsChatLang = (lang: string): ChatLang => {
    if (lang === "nl") return "nl";
    if (lang === "ar") return "ar";
    return "en";
  };

  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [isLoading, setIsLoading]   = useState(false);
  const [chatLang, setChatLang]     = useState<ChatLang>(() => getSiteAsChatLang(localStorage.getItem("language") || "en"));

  // Sync with site language changes
  useEffect(() => {
    setChatLang(getSiteAsChatLang(siteLanguage));
  }, [siteLanguage]);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Admin-editable overrides for hero copy + tools ──
  const { data: contentOverrides } = useQuery<any>({
    queryKey: ["/api/ai-app-content"],
    staleTime: 60_000,
  });

  // Merge defaults with overrides, per language
  const ui = useMemo(() => {
    const base = UI[chatLang];
    const ov = contentOverrides?.ui?.[chatLang];
    if (!ov || typeof ov !== "object") return base;
    const merged: Record<string, string> = { ...base };
    for (const k of Object.keys(base)) {
      if (typeof ov[k] === "string" && ov[k].length > 0) merged[k] = ov[k];
    }
    return merged as typeof base;
  }, [chatLang, contentOverrides]);

  // Merge tools defaults with overrides (label/description/starter per lang + hidden + order)
  const tools = useMemo<ToolCategory[]>(() => {
    const overrides: any[] = Array.isArray(contentOverrides?.tools) ? contentOverrides.tools : [];
    const merged = TOOLS.map((t) => {
      const o = overrides.find((x: any) => x?.id === t.id);
      if (!o) return { ...t, _hidden: false, _order: undefined as number | undefined } as any;
      const mergeLang = (orig: Record<ChatLang, string>, ov: any) => {
        if (!ov || typeof ov !== "object") return orig;
        const next: Record<string, string> = { ...orig };
        for (const k of Object.keys(orig)) if (typeof ov[k] === "string" && ov[k].length > 0) next[k] = ov[k];
        return next as Record<ChatLang, string>;
      };
      return {
        ...t,
        label: mergeLang(t.label, o.label),
        description: mergeLang(t.description, o.description),
        starter: mergeLang(t.starter, o.starter),
        _hidden: !!o.hidden,
        _order: typeof o.order === "number" ? o.order : undefined,
      } as any;
    });
    const visible = merged.filter((t: any) => !t._hidden);
    visible.sort((a: any, b: any) => {
      if (a._order != null && b._order != null) return a._order - b._order;
      if (a._order != null) return -1;
      if (b._order != null) return 1;
      return 0;
    });
    return visible as ToolCategory[];
  }, [contentOverrides]);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: "user", content: trimmed, id: Date.now().toString() };
    const newMessages      = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { role: "assistant", content: "", id: assistantId }]);

    try {
      const { auth: firebaseAuth } = await import("@/firebase/firebase");
      const token = firebaseAuth.currentUser ? await firebaseAuth.currentUser.getIdToken() : "";

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
          language: chatLang,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Error", description: data.message, variant: "destructive" });
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      const reader  = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let fullText  = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.token) {
                fullText += parsed.token;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
                );
              }
              if (parsed.error) toast({ title: "Error", description: parsed.error, variant: "destructive" });
            } catch {}
          }
        }
      }
    } catch {
      toast({ title: "Error", description: "Could not connect. Please try again.", variant: "destructive" });
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => { setMessages([]); setInput(""); };

  const startTool = (tool: ToolCategory) => sendMessage(tool.starter[chatLang]);

  // ── Not logged in ───────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-xl shadow-violet-500/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="font-bold text-lg">Urban AI</h2>
        <p className="text-muted-foreground text-sm max-w-xs">{ui.noAccess}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-116px)] max-w-2xl mx-auto relative">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-border/50">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-purple-500/8 to-fuchsia-500/10 animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />

        <div className="relative px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            {/* Logo + title */}
            <div className="flex items-center gap-3">
              {hasMessages && (
                <button
                  onClick={clearChat}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                  data-testid="button-back-home"
                >
                  <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-bold text-base bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
                    {ui.title}
                  </h1>
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-600/10 text-violet-500 border border-violet-500/20">
                    CLAUDE
                  </span>
                </div>
                {!hasMessages && (
                  <p className="text-[11px] text-muted-foreground">{ui.subtitle}</p>
                )}
              </div>
            </div>

            {/* Right side: clear button when in chat */}
            {hasMessages && (
              <Button
                variant="ghost" size="sm"
                onClick={clearChat}
                className="h-8 gap-1.5 text-xs text-muted-foreground"
                data-testid="button-clear-chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {ui.clear}
              </Button>
            )}
          </div>

          {/* Language picker — always visible in header */}
          <div className="mt-3">
            <LangPicker value={chatLang} onChange={setChatLang} />
          </div>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Premium gate */}
        {!access.hasAccess && !access.isLoading ? (
          <div className="px-4 py-6">
            <AIPremiumGate feature="Urban AI" />
          </div>

        /* ── Chat mode ──────────────────────────────────────────────────────── */
        ) : hasMessages ? (
          <div className="px-4 py-4">
            {messages.map((msg) => <ChatBubble key={msg.id} msg={msg} />)}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 animate-in fade-in-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                {ui.typing}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

        /* ── Hub home ───────────────────────────────────────────────────────── */
        ) : (
          <div className="px-4 py-5 space-y-6">

            {/* Hero glow banner */}
            <div className="relative rounded-2xl overflow-hidden p-5 bg-gradient-to-br from-violet-600/15 via-purple-500/10 to-fuchsia-500/10 border border-violet-500/20">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-purple-500/10 blur-3xl translate-y-1/2 -translate-x-1/2" />
              <div className="relative flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-xl shadow-violet-500/30 shrink-0">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-base bg-gradient-to-r from-violet-500 to-purple-400 bg-clip-text text-transparent">
                    {ui.title}
                  </h2>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{ui.subtitle}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Globe className="w-3 h-3 text-violet-500 shrink-0" />
                    <span className="text-[10px] text-violet-500 font-medium">
                      Powered by Claude · Responds in {LANGUAGES.find(l => l.code === chatLang)?.flag} {LANGUAGES.find(l => l.code === chatLang)?.label}
                    </span>
                    {(siteLanguage === "nl" || siteLanguage === "ar") && (
                      <span className="text-[9px] bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded-full">
                        follows site language
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Admin AI training shortcut ── visible only to admins ── */}
            {(user?.role === "admin" || user?.role === "super_admin") && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-2 bg-violet-500/10 border-b border-violet-500/20">
                  <Brain className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Admin — AI Control</span>
                </div>
                <div className="p-3 flex flex-col gap-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Train Urban AI with your story, expertise, and knowledge. Everything you add here shapes how the AI represents you and answers questions.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Link href="/admin/my-profile">
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 transition-colors"
                        data-testid="btn-admin-ai-training"
                      >
                        <PenLine className="w-3 h-3" />
                        Edit My Story & AI Training
                      </button>
                    </Link>
                    <Link href="/admin/ai-studio">
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-[11px] font-medium hover:bg-muted/80 transition-colors border border-border"
                        data-testid="btn-admin-ai-studio"
                      >
                        <Settings2 className="w-3 h-3" />
                        AI Studio
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Riki card */}
            <div
              className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors"
              onClick={() => {
                const riki = tools.find(t => t.id === "riki") || TOOLS.find(t => t.id === "riki")!;
                startTool(riki);
              }}
              data-testid="card-riki"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-400 flex items-center justify-center text-white text-base font-bold shadow shrink-0">
                R
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{ui.rikiCard}</p>
                <p className="text-[11px] text-muted-foreground">{ui.rikiSub}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500/60 shrink-0" />
            </div>

            {/* Tools grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold">{ui.tools}</p>
                  <p className="text-[11px] text-muted-foreground">{ui.toolsSub}</p>
                </div>
                <MessageSquare className="w-4 h-4 text-muted-foreground/40" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {tools.filter(t => t.id !== "riki").map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    lang={chatLang}
                    onClick={() => startTool(tool)}
                  />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[11px] text-muted-foreground">{ui.or}</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Spacer so input bar doesn't overlap last content */}
            <div className="h-2" />
          </div>
        )}
      </div>

      {/* ── Input bar ────────────────────────────────────────────────────────── */}
      {(access.hasAccess || access.isLoading) && (
        <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-background/95 backdrop-blur-sm">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ui.placeholder}
              rows={1}
              className="resize-none min-h-[44px] max-h-32 rounded-xl text-sm"
              disabled={isLoading}
              data-testid="input-chat-message"
              dir={chatLang === "ar" ? "rtl" : "ltr"}
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-11 w-11 rounded-xl flex-shrink-0 bg-gradient-to-br from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 shadow-lg shadow-violet-500/25"
              data-testid="button-send-message"
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">{ui.hint}</p>
        </div>
      )}
    </div>
  );
}
