import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Linkedin, Link2, Send, CheckCircle, XCircle, Clock, AlertTriangle,
  UserPlus, Building2, Search, ExternalLink, Unlink, RefreshCw,
  FileText, Globe, Mail, MapPin, Loader2, Tags, Zap, ListPlus,
  BarChart2, Sparkles, TrendingUp, TrendingDown, Users, Megaphone,
  Pencil, Calendar, Trophy, Handshake, Star, UserCheck, ArrowRight, ImageIcon,
  Brain, ThumbsUp, ThumbsDown, BookmarkPlus, Trash2, Bot, Lightbulb, Save,
  X as XIcon, Hash, ShieldAlert, Heart, Wand2, Copy as CopyIcon,
  Mic, MicOff, Eye, Edit3, CheckCheck, Database, Network,
  Briefcase, Filter, Target, History as HistoryIcon, MessageSquare, AlertCircle, CalendarDays,
} from "lucide-react";
import { SiLinkedin } from "react-icons/si";
import { format } from "date-fns";

interface LinkedInStatus {
  configured: boolean;
  connected: boolean;
  profileName?: string;
  profilePictureUrl?: string;
  email?: string;
  connectedAt?: string;
}

interface LinkedInPostRecord {
  id: number;
  content: string;
  postType: string;
  linkUrl?: string;
  linkTitle?: string;
  status: string;
  publishedAt?: string;
  createdAt: string;
}

interface LeadImportForm {
  organization: string;
  contactName: string;
  email: string;
  linkedinUrl: string;
  city: string;
  notes: string;
  type: string;
}

const LEAD_TYPES = [
  { value: "municipality", label: "Municipality / Government", icon: "🏛️", color: "text-blue-600", keywords: ["cultuurbeleid gemeente", "evenementencoördinator gemeente", "kunst cultuur gemeente"] },
  { value: "venue", label: "Venue / Location", icon: "🎪", color: "text-purple-600", keywords: ["theaterdirecteur", "evenementenlocatie manager", "poppodium directeur"] },
  { value: "cultural_org", label: "Cultural Organization", icon: "🎭", color: "text-orange-600", keywords: ["culturele organisatie directeur", "dansgezelschap manager", "urban culture organisatie"] },
  { value: "media", label: "Media / Press", icon: "📰", color: "text-green-600", keywords: ["entertainmentjournalist", "cultuurredacteur", "urban music journalist"] },
  { value: "sponsor", label: "Sponsor / Brand", icon: "💼", color: "text-yellow-600", keywords: ["sponsormanager sport cultuur", "brand partnership manager", "CSR manager cultureel"] },
];

function extractLinkedInHandle(url: string): string {
  try {
    const match = url.match(/linkedin\.com\/(in|company)\/([^/?#]+)/i);
    return match ? match[2] : "";
  } catch {
    return "";
  }
}

const ACCOUNT_SLOTS = [
  { slot: "primary", label: "Account 1 — Main", labelShort: "Account 1" },
  { slot: "core_navigator", label: "Account 2 — Core Navigator Plan One", labelShort: "Account 2" },
];

export default function AdminLinkedIn() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeSlot, setActiveSlot] = useState<"primary" | "core_navigator">("primary");
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testingSlot, setTestingSlot] = useState<string | null>(null);

  const [postContent, setPostContent] = useState("");
  const [postLinkUrl, setPostLinkUrl] = useState("");
  const [postLinkTitle, setPostLinkTitle] = useState("");
  const [includeLink, setIncludeLink] = useState(false);
  const [leadForm, setLeadForm] = useState<LeadImportForm>({
    organization: "", contactName: "", email: "", linkedinUrl: "", city: "", notes: "", type: "municipality",
  });
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [searchType, setSearchType] = useState("municipality");

  // ── AI Lead Discovery v2 state ────────────────────────────────────────────
  const [v2LeadKind, setV2LeadKind] = useState<"person" | "company" | "both">("both");
  const [v2Query, setV2Query] = useState("");
  const [v2Industries, setV2Industries] = useState<string[]>([]);
  const [v2Roles, setV2Roles] = useState<string[]>([]);
  const [v2Cities, setV2Cities] = useState<string[]>([]);
  const [v2Countries, setV2Countries] = useState<string[]>(["Netherlands"]);
  const [v2Seniority, setV2Seniority] = useState<string>("any");
  const [v2Intent, setV2Intent] = useState<string>("networking");
  const [v2Count, setV2Count] = useState(20);
  const [v2UseMyContext, setV2UseMyContext] = useState(true);
  const [v2Results, setV2Results] = useState<any[]>([]);
  const [v2Meta, setV2Meta] = useState<{ requested: number; returned: number; shortfall: number; note: string | null } | null>(null);
  const [v2ImportedKeys, setV2ImportedKeys] = useState<Set<string>>(new Set());
  const [v2SavedKeys, setV2SavedKeys] = useState<Set<string>>(new Set());
  const [discoveryView, setDiscoveryView] = useState<"v2" | "legacy">("v2");
  const [bulkText, setBulkText] = useState("");
  const [bulkType, setBulkType] = useState("municipality");
  const [leadsMode, setLeadsMode] = useState<"connect" | "search" | "add" | "bulk">("connect");
  const [connectName, setConnectName] = useState("");
  const [connectOrg, setConnectOrg] = useState("");
  const [connectHistory, setConnectHistory] = useState<{name: string; org: string; url: string; at: string}[]>([]);
  const [connectQueueActive, setConnectQueueActive] = useState(false);
  const [connectQueueIndex, setConnectQueueIndex] = useState(0);
  const [connectQueueDone, setConnectQueueDone] = useState<Set<number>>(new Set());
  const [connectQueueSkipped, setConnectQueueSkipped] = useState<Set<number>>(new Set());
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());
  const [aiFilteredCount, setAiFilteredCount] = useState(0);

  const { data: existingLeads = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/outreach/leads"],
  });
  const [aiTopic, setAiTopic] = useState("");
  const [aiTemplate, setAiTemplate] = useState("general");
  const [aiTone, setAiTone] = useState("engaging");
  const [showAiWriter, setShowAiWriter] = useState(false);

  // Auto-Post state
  const [autoPostEnabled, setAutoPostEnabled] = useState(false);
  const [autoPostTime, setAutoPostTime] = useState("09:00");
  const [autoPostTimezone, setAutoPostTimezone] = useState("Europe/Amsterdam");
  const [autoPostTopics, setAutoPostTopics] = useState<string[]>([]);
  const [autoPostTopicInput, setAutoPostTopicInput] = useState("");
  const [autoPostTone, setAutoPostTone] = useState("engaging");
  const [autoPostTemplate, setAutoPostTemplate] = useState("auto");
  const [autoPostHashtags, setAutoPostHashtags] = useState(true);
  const [autoPostCta, setAutoPostCta] = useState(true);
  const [autoPostLanguage, setAutoPostLanguage] = useState("en");
  const [autoPostTargetAudience, setAutoPostTargetAudience] = useState("general");
  const [autoPostCustomContext, setAutoPostCustomContext] = useState("");
  const [autoPostIncludeImage, setAutoPostIncludeImage] = useState(false);
  const [autoPostRequiresApproval, setAutoPostRequiresApproval] = useState(false);
  const [autoPostSaving, setAutoPostSaving] = useState(false);
  // Voice-to-topic (English Web Speech API) for AI Writer
  const [voiceListening, setVoiceListening] = useState(false);
  const voiceRecognitionRef = useRef<any>(null);
  const voiceListeningActiveRef = useRef(false);
  // Pending post inline editing state (review-and-approve flow)
  const [editingPendingId, setEditingPendingId] = useState<number | null>(null);
  const [editingPendingContent, setEditingPendingContent] = useState("");
  const [autoPostTesting, setAutoPostTesting] = useState(false);
  const [autoPostTestResult, setAutoPostTestResult] = useState<{ success?: boolean; content?: string; postType?: string; imageUrl?: string; error?: string } | null>(null);

  // ── AI Brain (brand intel + examples + agent mode) state ──
  const [brainHydrated, setBrainHydrated] = useState(false);
  const [brandStory, setBrandStory] = useState("");
  const [voiceRules, setVoiceRules] = useState<string[]>([]);
  const [doNotSay, setDoNotSay] = useState<string[]>([]);
  const [topicsLove, setTopicsLove] = useState<string[]>([]);
  const [topicsAvoid, setTopicsAvoid] = useState<string[]>([]);
  const [signaturePhrases, setSignaturePhrases] = useState<string[]>([]);
  const [audienceNotes, setAudienceNotes] = useState("");
  const [preferredHashtags, setPreferredHashtags] = useState<string[]>([]);
  const [intelInputs, setIntelInputs] = useState({ vr: "", dns: "", tl: "", ta: "", sp: "", ph: "" });
  const [newExample, setNewExample] = useState({ content: "", kind: "gold" as "gold" | "edited" | "avoid", reason: "" });
  const [agentMode, setAgentMode] = useState(false);
  const [agentResult, setAgentResult] = useState<any>(null);
  const [editedDraft, setEditedDraft] = useState<string>(""); // tracks user-edited version of latest AI draft for "save edit as example"
  const [feedbackNotes, setFeedbackNotes] = useState<Record<number, string>>({});

  // Profile Optimizer state
  const [optimizerHeadline, setOptimizerHeadline] = useState("");
  const [optimizerAbout, setOptimizerAbout] = useState("");
  const [optimizerGoal, setOptimizerGoal] = useState("");
  const [optimizerAudience, setOptimizerAudience] = useState("");
  const [optimizerResult, setOptimizerResult] = useState<any>(null);
  const [optimizerLoading, setOptimizerLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ── Profile Builder state ────────────────────────────────────────────────
  const [pbName, setPbName] = useState("Riki Almouti");
  const [pbRole, setPbRole] = useState("Founder & CEO — Urban Culture Hub");
  const [pbIndustry, setPbIndustry] = useState("Urban culture, breakdance, street sports, events, Netherlands");
  const [pbAudience, setPbAudience] = useState("Municipalities, sponsors, cultural organizations");
  const [pbGoals, setPbGoals] = useState("Attract sponsors, grow platform, find partners, build thought leadership");
  const [pbLanguage, setPbLanguage] = useState("en");

  // Per-section content + enhance results
  type PbSection = { content: string; enhanced: string; enhancing: boolean; copied: boolean };
  const makePbSec = (): PbSection => ({ content: "", enhanced: "", enhancing: false, copied: false });
  const [pbHeadline, setPbHeadline] = useState<PbSection>(makePbSec());
  const [pbAbout, setPbAbout] = useState<PbSection>(makePbSec());
  const [pbSkills, setPbSkills] = useState<PbSection>(makePbSec());
  const [pbCerts, setPbCerts] = useState<PbSection>(makePbSec());
  const [pbVolunteer, setPbVolunteer] = useState<PbSection>(makePbSec());
  const [pbProjects, setPbProjects] = useState<PbSection>(makePbSec());
  const [pbPublications, setPbPublications] = useState<PbSection>(makePbSec());
  const [pbHonors, setPbHonors] = useState<PbSection>(makePbSec());
  const [pbLangs, setPbLangs] = useState<PbSection>(makePbSec());
  const [pbContactInfo, setPbContactInfo] = useState<PbSection>(makePbSec());
  const [pbFeatured, setPbFeatured] = useState<PbSection>(makePbSec());
  const [pbCreatorTopics, setPbCreatorTopics] = useState<PbSection>(makePbSec());
  // New sections
  const [pbMission, setPbMission] = useState<PbSection>(makePbSec());
  const [pbOpenTo, setPbOpenTo] = useState<PbSection>(makePbSec());
  const [pbServices, setPbServices] = useState<PbSection>(makePbSec());
  const [pbCauses, setPbCauses] = useState<PbSection>(makePbSec());
  const [pbRecommendations, setPbRecommendations] = useState<PbSection>(makePbSec());
  const [pbExperiences, setPbExperiences] = useState<Array<{title: string; company: string; duration: string; location: string; description: string; enhanced: string; enhancing: boolean; copied: boolean}>>([
    { title: "", company: "", duration: "", location: "", description: "", enhanced: "", enhancing: false, copied: false }
  ]);
  const [pbEducation, setPbEducation] = useState<Array<{degree: string; field: string; institution: string; dates: string; description: string; enhanced: string; enhancing: boolean; copied: boolean}>>([
    { degree: "", field: "", institution: "", dates: "", description: "", enhanced: "", enhancing: false, copied: false }
  ]);
  // Build-all result
  const [pbBuildResult, setPbBuildResult] = useState<any>(null);
  const [pbBuildLoading, setPbBuildLoading] = useState(false);
  const [pbBuildCopied, setPbBuildCopied] = useState<string | null>(null);
  // Context card enhance/autofill
  const [pbContextEnhanced, setPbContextEnhanced] = useState<{role: string; industry: string; audience: string; goals: string} | null>(null);
  const [pbContextEnhancing, setPbContextEnhancing] = useState(false);
  const [pbAutoFilling, setPbAutoFilling] = useState(false);
  // AI Brain
  const [pbBrainOpen, setPbBrainOpen] = useState(false);
  const [pbBrainMessages, setPbBrainMessages] = useState<Array<{role: string; content: string}>>([]);
  const [pbBrainInput, setPbBrainInput] = useState("");
  const [pbBrainLoading, setPbBrainLoading] = useState(false);
  const [pbBrainApplying, setPbBrainApplying] = useState(false);
  const pbBrainScrollRef = useRef<HTMLDivElement>(null);
  // Microphone
  const [activeMic, setActiveMic] = useState<string | null>(null);
  const pbMicRef = useRef<any>(null);
  const pbMicActiveKeyRef = useRef<string | null>(null);

  function startMic(key: string, onResult: (text: string) => void) {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast({ title: "Microphone not supported", description: "Use Chrome or Edge for voice input.", variant: "destructive" }); return; }

    // If already listening on this key → stop
    if (pbMicActiveKeyRef.current === key) {
      pbMicActiveKeyRef.current = null;
      pbMicRef.current?.stop();
      setActiveMic(null);
      return;
    }

    // Stop any previously active mic
    pbMicActiveKeyRef.current = null;
    pbMicRef.current?.stop();

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = pbLanguage === "nl" ? "nl-NL" : "en-US";

    let finalTranscript = "";

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript + " ";
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      onResult((finalTranscript + interim).trimStart());
    };

    rec.onerror = (e: any) => {
      if (e.error === "no-speech") return; // ignore silence gaps, keep going
      pbMicActiveKeyRef.current = null;
      setActiveMic(null);
    };

    rec.onend = () => {
      // If we're still supposed to be listening, restart immediately
      if (pbMicActiveKeyRef.current === key) {
        try { rec.start(); } catch {}
      } else {
        setActiveMic(null);
      }
    };

    rec.start();
    pbMicRef.current = rec;
    pbMicActiveKeyRef.current = key;
    setActiveMic(key);
  }

  async function enhanceSection(
    section: string,
    label: string,
    currentContent: string,
    setter: (fn: (prev: PbSection) => PbSection) => void,
    preserveMode = false
  ) {
    setter(p => ({ ...p, enhancing: true }));
    try {
      const r = await apiRequest("/api/admin/linkedin/profile-enhance", "POST", {
        section, sectionLabel: label, currentContent, preserveMode,
        role: pbRole, industry: pbIndustry, targetAudience: pbAudience,
        goals: pbGoals, language: pbLanguage,
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setter(p => ({ ...p, enhanced: data.enhanced || "", corrections: data.corrections || [], explanation: data.explanation || "", alternatives: data.alternatives || [], tips: data.tips || [], enhancing: false }));
    } catch (e: any) {
      toast({ title: "Enhance failed", description: e.message, variant: "destructive" });
      setter(p => ({ ...p, enhancing: false }));
    }
  }

  async function enhanceExpSection(idx: number, section: string, label: string, content: string, preserveMode = false) {
    setPbExperiences(p => p.map((x, i) => i === idx ? { ...x, enhancing: true } : x));
    try {
      const r = await apiRequest("/api/admin/linkedin/profile-enhance", "POST", {
        section, sectionLabel: label, currentContent: content, preserveMode,
        role: pbRole, industry: pbIndustry, targetAudience: pbAudience,
        goals: pbGoals, language: pbLanguage,
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setPbExperiences(p => p.map((x, i) => i === idx ? { ...x, enhanced: data.enhanced || "", corrections: data.corrections || [], explanation: data.explanation || "", alternatives: data.alternatives || [], tips: data.tips || [], enhancing: false } : x));
    } catch (e: any) {
      toast({ title: "Enhance failed", description: e.message, variant: "destructive" });
      setPbExperiences(p => p.map((x, i) => i === idx ? { ...x, enhancing: false } : x));
    }
  }

  async function enhanceEduSection(idx: number, content: string, preserveMode = false) {
    setPbEducation(p => p.map((x, i) => i === idx ? { ...x, enhancing: true } : x));
    try {
      const r = await apiRequest("/api/admin/linkedin/profile-enhance", "POST", {
        section: "education_description", sectionLabel: "Education Description", currentContent: content, preserveMode,
        role: pbRole, industry: pbIndustry, targetAudience: pbAudience,
        goals: pbGoals, language: pbLanguage,
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setPbEducation(p => p.map((x, i) => i === idx ? { ...x, enhanced: data.enhanced || "", corrections: data.corrections || [], explanation: data.explanation || "", alternatives: data.alternatives || [], tips: data.tips || [], enhancing: false } : x));
    } catch (e: any) {
      toast({ title: "Enhance failed", description: e.message, variant: "destructive" });
      setPbEducation(p => p.map((x, i) => i === idx ? { ...x, enhancing: false } : x));
    }
  }

  async function sendBrainMessage(overrideInput?: string) {
    const text = (overrideInput ?? pbBrainInput).trim();
    if (!text || pbBrainLoading) return;
    const newMsg = { role: "user", content: text };
    const updatedMessages = [...pbBrainMessages, newMsg];
    setPbBrainMessages(updatedMessages);
    setPbBrainInput("");
    setPbBrainLoading(true);
    setTimeout(() => { pbBrainScrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, 50);
    try {
      const r = await apiRequest("/api/admin/linkedin/profile-brain", "POST", {
        messages: updatedMessages,
        command: "chat",
        context: { name: pbName, role: pbRole, industry: pbIndustry, audience: pbAudience, goals: pbGoals },
        language: pbLanguage,
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setPbBrainMessages(m => [...m, { role: "assistant", content: data.reply }]);
      setTimeout(() => { pbBrainScrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, 50);
    } catch (e: any) {
      toast({ title: "AI Brain error", description: e.message, variant: "destructive" });
    } finally {
      setPbBrainLoading(false);
    }
  }

  async function applyBrainToProfile() {
    if (pbBrainMessages.length === 0) return;
    setPbBrainApplying(true);
    try {
      const r = await apiRequest("/api/admin/linkedin/profile-brain", "POST", {
        messages: pbBrainMessages,
        command: "apply",
        context: { name: pbName, role: pbRole, industry: pbIndustry, audience: pbAudience, goals: pbGoals },
        language: pbLanguage,
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      if (data.headline) setPbHeadline(p => ({ ...p, content: data.headline }));
      if (data.about) setPbAbout(p => ({ ...p, content: data.about }));
      if (data.skills) setPbSkills(p => ({ ...p, content: data.skills }));
      if (data.mission) setPbMission(p => ({ ...p, content: data.mission }));
      if (data.openTo) setPbOpenTo(p => ({ ...p, content: data.openTo }));
      if (data.services) setPbServices(p => ({ ...p, content: data.services }));
      if (data.causes) setPbCauses(p => ({ ...p, content: data.causes }));
      if (data.certifications) setPbCerts(p => ({ ...p, content: data.certifications }));
      if (data.volunteer) setPbVolunteer(p => ({ ...p, content: data.volunteer }));
      if (data.projects) setPbProjects(p => ({ ...p, content: data.projects }));
      if (data.honors) setPbHonors(p => ({ ...p, content: data.honors }));
      if (data.languages) setPbLangs(p => ({ ...p, content: data.languages }));
      if (Array.isArray(data.experiences) && data.experiences.length > 0) {
        setPbExperiences(data.experiences.map((e: any) => ({ title: e.title || "", company: e.company || "", duration: e.duration || "", location: e.location || "", description: e.description || "", enhanced: "", enhancing: false, copied: false })));
      }
      if (Array.isArray(data.education) && data.education.length > 0) {
        setPbEducation(data.education.map((e: any) => ({ degree: e.degree || "", field: e.field || "", institution: e.institution || "", dates: e.dates || "", description: e.description || "", enhanced: "", enhancing: false, copied: false })));
      }
      toast({ title: "Profile filled from AI Brain!", description: "All sections have been updated. Review and adjust anything." });
    } catch (e: any) {
      toast({ title: "Apply failed", description: e.message, variant: "destructive" });
    } finally {
      setPbBrainApplying(false);
    }
  }

  // ── Connection Message Generator state ────────────────────────────────────
  const [cmName, setCmName] = useState("");
  const [cmRole, setCmRole] = useState("");
  const [cmOrg, setCmOrg] = useState("");
  const [cmIndustry, setCmIndustry] = useState("");
  const [cmCity, setCmCity] = useState("");
  const [cmPurpose, setCmPurpose] = useState("networking / potential collaboration");
  const [cmTone, setCmTone] = useState("warm");
  const [cmLanguage, setCmLanguage] = useState("en");
  const [cmLoading, setCmLoading] = useState(false);
  const [cmMessages, setCmMessages] = useState<Array<{label: string; text: string}>>([]);
  const [cmCopied, setCmCopied] = useState<string | null>(null);

  // ── Hashtag Intelligence state ────────────────────────────────────────────
  const [htTopic, setHtTopic] = useState("");
  const [htAudience, setHtAudience] = useState("municipalities, sponsors, cultural organizations");
  const [htLanguage, setHtLanguage] = useState("en");
  const [htLoading, setHtLoading] = useState(false);
  const [htResult, setHtResult] = useState<any>(null);
  const [htCopied, setHtCopied] = useState<string | null>(null);

  // ── Content Planner state ─────────────────────────────────────────────────
  const [cpWeeks, setCpWeeks] = useState(2);
  const [cpFocus, setCpFocus] = useState("");
  const [cpLanguage, setCpLanguage] = useState("en");
  const [cpPostsPerWeek, setCpPostsPerWeek] = useState(5);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpResult, setCpResult] = useState<any>(null);

  // Check URL for OAuth result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("linkedinSuccess")) {
      const connectedSlot = params.get("slot") || "primary";
      if (connectedSlot === "core_navigator") setActiveSlot("core_navigator");
      toast({ title: "LinkedIn Connected!", description: "Your LinkedIn account is now linked." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/accounts"] });
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("linkedinError")) {
      toast({ title: "LinkedIn Error", description: decodeURIComponent(params.get("linkedinError") || ""), variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: accounts } = useQuery<{ configured: boolean; accounts: Array<{ slot: string; label: string; connected: boolean; profileName?: string; profilePictureUrl?: string; email?: string; connectedAt?: string }> }>({
    queryKey: ["/api/admin/linkedin/accounts"],
    queryFn: async () => { const r = await apiRequest("/api/admin/linkedin/accounts", "GET"); return r.json(); },
    refetchInterval: 30_000,
  });

  const { data: status, isLoading: statusLoading } = useQuery<LinkedInStatus>({
    queryKey: ["/api/admin/linkedin/status", activeSlot],
    queryFn: async () => {
      const r = await apiRequest(`/api/admin/linkedin/status?slot=${activeSlot}`, "GET");
      return r.json();
    },
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<LinkedInPostRecord[]>({
    queryKey: ["/api/admin/linkedin/posts"],
    queryFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/posts", "GET");
      return r.json();
    },
    enabled: status?.connected,
  });

  const { data: autoPostSettings, refetch: refetchAutoPostSettings } = useQuery<any>({
    queryKey: ["/api/admin/linkedin/auto-post/settings"],
    queryFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/auto-post/settings", "GET");
      return r.json();
    },
    enabled: status?.connected,
  });

  // Live scheduler diagnostics — shows WHY the auto-poster did/didn't fire on the last tick.
  const { data: schedulerStatus } = useQuery<{
    running: boolean;
    lastCheck: string | null;
    lastError: { at: string; message: string } | null;
    perUserStatus: Array<{ adminUserId: number; lastCheckedAt: string; nowInTz: string; targetTime: string; action: "fired" | "queued_for_approval" | "skipped" | "error"; reason: string }>;
  }>({
    queryKey: ["/api/admin/linkedin/auto-post/scheduler-status"],
    queryFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/auto-post/scheduler-status", "GET");
      return r.json();
    },
    enabled: status?.connected,
    refetchInterval: 30_000,
  });
  const myAutoPostStatus = schedulerStatus?.perUserStatus?.[0] ?? null;

  // Sync auto-post settings into form state when loaded
  useEffect(() => {
    if (!autoPostSettings) return;
    setAutoPostEnabled(autoPostSettings.enabled ?? false);
    setAutoPostTime(autoPostSettings.postTime ?? "09:00");
    setAutoPostTimezone(autoPostSettings.timezone ?? "Europe/Amsterdam");
    setAutoPostTopics(autoPostSettings.topics ?? []);
    setAutoPostTone(autoPostSettings.tone ?? "engaging");
    setAutoPostTemplate(autoPostSettings.template ?? "auto");
    setAutoPostHashtags(autoPostSettings.includeHashtags ?? true);
    setAutoPostCta(autoPostSettings.includeCta ?? true);
    setAutoPostLanguage(autoPostSettings.language ?? "en");
    setAutoPostTargetAudience((autoPostSettings as any).targetAudience ?? "general");
    setAutoPostCustomContext((autoPostSettings as any).customContext ?? "");
    setAutoPostIncludeImage((autoPostSettings as any).includeImage ?? false);
    setAutoPostRequiresApproval((autoPostSettings as any).requiresApproval ?? false);
  }, [autoPostSettings]);

  async function handleSaveAutoPost() {
    setAutoPostSaving(true);
    try {
      const r = await apiRequest("/api/admin/linkedin/auto-post/settings", "POST", {
        enabled: autoPostEnabled,
        postTime: autoPostTime,
        timezone: autoPostTimezone,
        topics: autoPostTopics,
        tone: autoPostTone,
        template: autoPostTemplate,
        includeHashtags: autoPostHashtags,
        includeCta: autoPostCta,
        language: autoPostLanguage,
        targetAudience: autoPostTargetAudience,
        customContext: autoPostCustomContext,
        includeImage: autoPostIncludeImage,
        requiresApproval: autoPostRequiresApproval,
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      await refetchAutoPostSettings();
      toast({ title: autoPostEnabled ? "Auto-post enabled!" : "Settings saved", description: autoPostEnabled ? `LinkedIn will post daily at ${autoPostTime} (${autoPostTimezone})` : "Auto-post is now disabled." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setAutoPostSaving(false);
    }
  }

  // ── Voice → Topic (Web Speech API, English only) ──
  function startVoiceCapture() {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({
        title: "Voice not supported",
        description: "Your browser doesn't support voice input. Try Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }

    // If already listening → stop
    if (voiceListeningActiveRef.current) {
      voiceListeningActiveRef.current = false;
      try { voiceRecognitionRef.current?.stop(); } catch {}
      setVoiceListening(false);
      return;
    }

    try {
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;

      let finalText = "";

      rec.onstart = () => {
        voiceListeningActiveRef.current = true;
        setVoiceListening(true);
      };

      rec.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += t + " ";
          else interim += t;
        }
        setAiTopic((finalText + interim).trimStart());
      };

      rec.onerror = (e: any) => {
        if (e.error === "no-speech") return; // silence gap — keep going
        voiceListeningActiveRef.current = false;
        setVoiceListening(false);
        toast({
          title: "Voice error",
          description: e?.error === "not-allowed"
            ? "Mic permission denied. Allow microphone access in your browser."
            : (e?.error || "Voice capture failed"),
          variant: "destructive",
        });
      };

      rec.onend = () => {
        // Restart automatically if still supposed to be listening
        if (voiceListeningActiveRef.current) {
          try { rec.start(); } catch {}
        } else {
          setVoiceListening(false);
        }
      };

      voiceRecognitionRef.current = rec;
      rec.start();
    } catch (err: any) {
      voiceListeningActiveRef.current = false;
      setVoiceListening(false);
      toast({ title: "Voice error", description: err.message, variant: "destructive" });
    }
  }

  async function handleTestAutoPost() {
    setAutoPostTesting(true);
    setAutoPostTestResult(null);
    try {
      const r = await apiRequest("/api/admin/linkedin/auto-post/trigger", "POST", {});
      const data = await r.json();
      setAutoPostTestResult(data);
      if (data.success) {
        toast({ title: "Test post published!", description: "A post was just published to your LinkedIn." });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/posts"] });
      } else {
        toast({ title: "Test failed", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setAutoPostTesting(false);
    }
  }

  const [polling, setPolling] = useState(false);

  // Poll status every 2s after OAuth popup opens until connected
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/status", activeSlot] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/accounts"] });
      const cached = queryClient.getQueryData<LinkedInStatus>(["/api/admin/linkedin/status", activeSlot]);
      if (cached?.connected) {
        setPolling(false);
        clearInterval(interval);
        toast({ title: "LinkedIn Connected!", description: "Your LinkedIn account is now linked." });
      }
    }, 2000);
    const timeout = setTimeout(() => { setPolling(false); clearInterval(interval); }, 180000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [polling, activeSlot]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`/api/admin/linkedin/auth-url?slot=${activeSlot}`, "GET");
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      window.open(data.url, "_blank", "noopener,noreferrer");
      setPolling(true);
    },
    onError: (err: any) => {
      toast({ title: "Cannot connect", description: err.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/disconnect", "DELETE", { slot: activeSlot });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/status", activeSlot] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/accounts"] });
      toast({ title: "Disconnected", description: "LinkedIn account unlinked." });
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/post", "POST", {
        content: postContent,
        slot: activeSlot,
        ...(includeLink && postLinkUrl ? { linkUrl: postLinkUrl, linkTitle: postLinkTitle || postLinkUrl } : {}),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Posted to LinkedIn!", description: "Your post is now live." });
      setPostContent("");
      setPostLinkUrl("");
      setPostLinkTitle("");
      setIncludeLink(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/posts"] });
    },
    onError: (err: any) => {
      toast({ title: "Post failed", description: err.message, variant: "destructive" });
    },
  });

  const testConnection = async (slot: string) => {
    setTestingSlot(slot);
    try {
      const r = await apiRequest(`/api/admin/linkedin/test-connection?slot=${slot}`, "GET");
      const data = await r.json();
      setTestResults(prev => ({ ...prev, [slot]: data }));
      if (data.ok) {
        toast({ title: `Account ${slot === "primary" ? "1" : "2"} — All checks passed`, description: `Connected as: ${data.profileName}` });
      } else {
        const failed = data.checks?.find((c: any) => c.ok === false);
        toast({ title: `Account ${slot === "primary" ? "1" : "2"} — Issue found`, description: failed?.detail || data.error || "Check failed", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setTestingSlot(null);
    }
  };

  const importLeadMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/import-lead", "POST", leadForm);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      const typeLabel = LEAD_TYPES.find(t => t.value === leadForm.type)?.label || leadForm.type;
      toast({ title: "Lead imported!", description: `${leadForm.organization} added as ${typeLabel}.` });
      setLeadForm({ organization: "", contactName: "", email: "", linkedinUrl: "", city: "", notes: "", type: leadForm.type });
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async () => {
      const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
      const leads = lines.map(line => {
        const parts = line.split("|").map(p => p.trim());
        const linkedinUrl = parts.find(p => p.includes("linkedin.com")) || "";
        const handle = extractLinkedInHandle(linkedinUrl);
        const organization = parts.find(p => !p.includes("linkedin.com") && !p.includes("@") && p.length > 0) || handle || "Unknown";
        const email = parts.find(p => p.includes("@")) || "";
        return { organization, linkedinUrl, email, type: bulkType };
      });
      const r = await apiRequest("/api/admin/linkedin/bulk-import", "POST", { leads });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: `${data.imported} leads imported!`, description: data.errors?.length ? `${data.errors.length} failed.` : "All imported successfully." });
      setBulkText("");
    },
    onError: (err: any) => {
      toast({ title: "Bulk import failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: analytics } = useQuery<{
    leads: { total: number; thisMonth: number; lastMonth: number; byType: Record<string,number>; byStatus: Record<string,number>; linkedinImported: number; emailedLeads: number };
    posts: { total: number; thisMonth: number; lastMonth: number; published: number; failed: number; byStatus: Record<string,number> };
  }>({
    queryKey: ["/api/admin/linkedin/analytics"],
    queryFn: async () => { const r = await apiRequest("/api/admin/linkedin/analytics", "GET"); return r.json(); },
    enabled: status?.connected,
    staleTime: 60_000,
  });

  const generatePostMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/generate-post", "POST", { topic: aiTopic, template: aiTemplate, tone: aiTone });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data.post as string;
    },
    onSuccess: (post) => {
      setPostContent(post);
      setEditedDraft(post);
      setShowAiWriter(false);
      setAiTopic("");
      setAgentResult(null);
      toast({ title: "Post generated!", description: "Review it below and post when ready." });
    },
    onError: (err: any) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  // ── AI BRAIN: brand intel + examples + agent mode + feedback ──
  const { data: brandIntel } = useQuery<any>({
    queryKey: ["/api/admin/linkedin/brand-intel"],
    queryFn: async () => (await apiRequest("/api/admin/linkedin/brand-intel", "GET")).json(),
    enabled: status?.connected,
  });
  const { data: examples = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/linkedin/examples"],
    queryFn: async () => (await apiRequest("/api/admin/linkedin/examples", "GET")).json(),
    enabled: status?.connected,
  });
  // Live platform facts (events / spots / users / crews) — what the AI knows about the platform
  const { data: platformFacts } = useQuery<any>({
    queryKey: ["/api/admin/linkedin/platform-facts"],
    queryFn: async () => (await apiRequest("/api/admin/linkedin/platform-facts", "GET")).json(),
    enabled: status?.connected,
    staleTime: 5 * 60 * 1000,
  });
  // Pending posts awaiting approval (review-and-approve flow)
  const { data: pendingPosts = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/linkedin/pending-posts"],
    queryFn: async () => (await apiRequest("/api/admin/linkedin/pending-posts", "GET")).json(),
    enabled: status?.connected,
    refetchInterval: 60 * 1000,
  });

  const approvePending = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/admin/linkedin/pending-posts/${id}/approve`, "POST", {});
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Published to LinkedIn", description: "Your post is now live." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/pending-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/posts"] });
      setEditingPendingId(null);
    },
    onError: (e: any) => toast({ title: "Publish failed", description: e.message, variant: "destructive" }),
  });

  const rejectPending = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/admin/linkedin/pending-posts/${id}`, "DELETE");
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Post rejected", description: "Draft discarded." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/pending-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/posts"] });
      setEditingPendingId(null);
    },
    onError: (e: any) => toast({ title: "Reject failed", description: e.message, variant: "destructive" }),
  });

  const updatePending = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const r = await apiRequest(`/api/admin/linkedin/pending-posts/${id}`, "PATCH", { content });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Edits saved", description: "Click 'Approve & Publish' when ready." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/pending-posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/posts"] });
      setEditingPendingId(null);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });
  // Hydrate Brain form ONCE from server — refetches/invalidations must NOT clobber unsaved edits.
  useEffect(() => {
    if (!brandIntel || brainHydrated) return;
    setBrandStory(brandIntel.brandStory ?? "");
    setVoiceRules(brandIntel.voiceRules ?? []);
    setDoNotSay(brandIntel.doNotSay ?? []);
    setTopicsLove(brandIntel.topicsLove ?? []);
    setTopicsAvoid(brandIntel.topicsAvoid ?? []);
    setSignaturePhrases(brandIntel.signaturePhrases ?? []);
    setAudienceNotes(brandIntel.audienceNotes ?? "");
    setPreferredHashtags(brandIntel.preferredHashtags ?? []);
    setBrainHydrated(true);
  }, [brandIntel, brainHydrated]);

  const saveBrandIntel = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/brand-intel", "PUT", {
        brandStory, voiceRules, doNotSay, topicsLove, topicsAvoid, signaturePhrases, audienceNotes, preferredHashtags,
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/brand-intel"] });
      toast({ title: "Brain updated", description: "AI will use the new instructions on the next post." });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const addExample = useMutation({
    mutationFn: async (payload: { content: string; kind: string; reason?: string; sourcePostId?: number }) => {
      const r = await apiRequest("/api/admin/linkedin/examples", "POST", payload);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/examples"] });
      setNewExample({ content: "", kind: "gold", reason: "" });
      toast({ title: "Example saved", description: "AI will study this for future posts." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const removeExample = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/admin/linkedin/examples/${id}`, "DELETE");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/examples"] });
      toast({ title: "Example removed" });
    },
  });

  const sendFeedback = useMutation({
    mutationFn: async ({ id, rating, notes }: { id: number; rating: "up" | "down" | "neutral"; notes?: string }) => {
      const r = await apiRequest(`/api/admin/linkedin/posts/${id}/feedback`, "POST", { rating, notes });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/examples"] });
      toast({
        title: vars.rating === "up" ? "Thanks — saved as a gold example" : vars.rating === "down" ? "Got it — AI will avoid this style" : "Feedback saved",
      });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const agentGenerate = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/agent-generate", "POST", {
        topic: aiTopic, template: aiTemplate, tone: aiTone, language: autoPostLanguage || "en",
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setAgentResult(data);
      const recIdx = typeof data.recommendation === "number" ? data.recommendation : 0;
      const rec = data.variants?.[recIdx]?.content || data.variants?.[0]?.content || "";
      if (rec) {
        setPostContent(rec);
        setEditedDraft(rec);
      }
      toast({ title: "Agent finished", description: `Drafted ${data.variants?.length || 0} variants. Recommended: variant ${recIdx + 1}.` });
    },
    onError: (e: any) => toast({ title: "Agent failed", description: e.message, variant: "destructive" }),
  });

  // Helper: small chip-list editor used by Brain UI
  const ChipList = ({ items, onChange, placeholder, dataTestId, color = "blue" }: { items: string[]; onChange: (next: string[]) => void; placeholder: string; dataTestId: string; color?: "blue" | "red" | "green" | "violet" }) => {
    const [draft, setDraft] = useState("");
    const palette: Record<string, string> = {
      blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      red: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
      green: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
      violet: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
    };
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={i} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${palette[color]}`}>
              {it}
              <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="opacity-60 hover:opacity-100" data-testid={`${dataTestId}-remove-${i}`}>
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          {items.length === 0 && <span className="text-xs text-muted-foreground italic">none yet</span>}
        </div>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                onChange([...items, draft.trim()]);
                setDraft("");
              }
            }}
            placeholder={placeholder}
            className="text-xs h-8"
            data-testid={`${dataTestId}-input`}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => { if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(""); } }}
            data-testid={`${dataTestId}-add`}
          >
            <ListPlus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  const aiDiscoverMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("/api/admin/linkedin/ai-discover", "POST", {
        keyword: searchKeyword,
        city: searchCity || undefined,
        type: searchType,
        count: 30,
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return data.leads as any[];
    },
    onSuccess: (leads) => {
      const normalize = (s: string) => s?.toLowerCase().replace(/[^a-z0-9]/g, "").trim() ?? "";
      const existingOrgs = new Set(existingLeads.map((l: any) => normalize(l.organization)));
      const existingLinkedinUrls = new Set(
        existingLeads.filter((l: any) => l.linkedinUrl).map((l: any) => l.linkedinUrl.trim().toLowerCase())
      );
      const filtered = leads.filter(lead => {
        const orgMatch = normalize(lead.organization) && existingOrgs.has(normalize(lead.organization));
        const urlMatch = lead.linkedinUrl && existingLinkedinUrls.has(lead.linkedinUrl.trim().toLowerCase());
        return !orgMatch && !urlMatch;
      });
      setAiFilteredCount(leads.length - filtered.length);
      setAiResults(filtered);
      setImportedIds(new Set());
      if (filtered.length === 0 && leads.length > 0) {
        toast({ title: "All leads already in CRM", description: `All ${leads.length} discovered leads are already in your Outreach CRM. Try different keywords.` });
      } else if (filtered.length === 0) {
        toast({ title: "No results", description: "Try different keywords or a broader category.", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Discovery failed", description: err.message, variant: "destructive" });
    },
  });

  const importAiLeadMutation = useMutation({
    mutationFn: async (lead: any) => {
      const r = await apiRequest("/api/admin/linkedin/import-lead", "POST", {
        organization: lead.organization,
        contactName: lead.contactName || "",
        email: lead.email || "",
        linkedinUrl: lead.linkedinUrl || "",
        city: lead.city || "",
        notes: lead.notes || "",
        type: lead.type || searchType,
      });
      const data = await r.json();
      if (r.status === 409) return { data, lead, duplicate: true };
      if (data.error) throw new Error(data.error);
      return { data, lead, duplicate: false };
    },
    onSuccess: ({ lead, duplicate }) => {
      const idx = aiResults.indexOf(lead);
      if (idx !== -1) setImportedIds(prev => new Set([...prev, idx]));
      if (duplicate) {
        toast({ title: "Already in CRM", description: `${lead.organization} is already in your Outreach CRM.` });
      } else {
        toast({ title: "Lead added!", description: `${lead.organization} added to Outreach.` });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
      }
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  // ── v2: rich AI lead discovery ─────────────────────────────────────────────
  const v2DiscoverMutation = useMutation({
    mutationFn: async (override?: any) => {
      const payload = override || {
        leadKind: v2LeadKind,
        query: v2Query,
        industries: v2Industries,
        roles: v2Roles,
        cities: v2Cities,
        countries: v2Countries,
        seniority: v2Seniority,
        intent: v2Intent,
        count: v2Count,
        useMyContext: v2UseMyContext,
        saveSearch: true,
      };
      const r = await apiRequest("/api/admin/linkedin/discover-leads-v2", "POST", payload);
      const data = await r.json();
      if (r.status === 429) throw new Error(data.error || "Too many runs — please wait a moment and try again.");
      if (data.error) throw new Error(data.error);
      return { leads: data.leads as any[], meta: data.meta || null };
    },
    onSuccess: ({ leads, meta }) => {
      setV2Results(leads);
      setV2Meta(meta);
      setV2ImportedKeys(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/discovery-searches"] });
      if (leads.length === 0) {
        toast({ title: "No leads", description: "Try broadening your filters.", variant: "destructive" });
      } else if (meta && meta.shortfall > 0) {
        toast({
          title: `${leads.length} of ${meta.requested} leads found`,
          description: "AI couldn't find more high-confidence matches without inventing data — broaden your filters or lower the count.",
        });
      } else {
        toast({ title: `${leads.length} leads found`, description: "All real, deduplicated, sorted by AI relevance score." });
      }
    },
    onError: (err: any) => {
      toast({ title: "Discovery failed", description: err.message, variant: "destructive" });
    },
  });

  const v2KeyOf = (lead: any) => `${(lead.organization || "").toLowerCase()}|${(lead.linkedinUrl || "").toLowerCase()}|${(lead.name || "").toLowerCase()}`;

  const v2ImportMutation = useMutation({
    mutationFn: async (lead: any) => {
      const r = await apiRequest("/api/admin/linkedin/import-lead", "POST", {
        organization: lead.organization,
        contactName: lead.name || lead.role || "",
        linkedinUrl: lead.linkedinUrl || "",
        city: lead.city || "",
        notes: lead.whyRelevant || "",
        leadKind: lead.leadKind,
        role: lead.role || null,
        industry: lead.industry || null,
        country: lead.country || null,
        seniority: lead.seniority || null,
        whyRelevant: lead.whyRelevant || null,
        howToConnect: lead.howToConnect || null,
        suggestedOpener: lead.suggestedOpener || null,
        tags: lead.tags || [],
        score: lead.score ?? null,
        aiConfidence: lead.aiConfidence ?? null,
        discoveryQuery: v2Query || null,
        type: lead.industry || lead.leadKind,
      });
      const data = await r.json();
      if (r.status === 409) return { lead, duplicate: true };
      if (data.error) throw new Error(data.error);
      return { lead, duplicate: false, savedLead: data.lead };
    },
    onSuccess: ({ lead, duplicate, savedLead }) => {
      setV2ImportedKeys(prev => new Set([...prev, v2KeyOf(lead)]));
      if (duplicate) {
        toast({ title: "Already in CRM", description: `${lead.organization} is already saved.` });
      } else {
        toast({ title: "Lead saved!", description: `${lead.organization} added to Outreach CRM.` });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
        // Auto-store the new id so the user can save-to-brain in one more click
        if (savedLead?.id) {
          (lead as any)._savedId = savedLead.id;
          setV2Results(prev => [...prev]);
        }
      }
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const v2SaveToBrainMutation = useMutation({
    mutationFn: async ({ leadId, saved }: { leadId: number; saved: boolean }) => {
      const r = await apiRequest(`/api/admin/linkedin/lead/${leadId}/save-to-brain`, "PATCH", { saved });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      return { leadId, saved };
    },
    onSuccess: ({ saved }) => {
      toast({ title: saved ? "Saved to brain" : "Removed from brain" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/outreach/leads"] });
    },
  });

  const { data: discoverySearches = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/linkedin/discovery-searches"],
    select: (d: any) => Array.isArray(d) ? d : (d?.searches || []),
  });

  const deleteSearchMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/admin/linkedin/discovery-searches/${id}`, "DELETE");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/linkedin/discovery-searches"] }),
  });

  const rerunSearch = (search: any) => {
    const q = search?.query || {};
    const payload = {
      leadKind: q.leadKind || "both",
      query: q.query || "",
      industries: q.industries || [],
      roles: q.roles || [],
      cities: q.cities || [],
      countries: q.countries || ["Netherlands"],
      seniority: q.seniority || "any",
      intent: q.intent || "networking",
      count: q.count || 20,
      useMyContext: q.useMyContext !== false,
      saveSearch: false,
    };
    // Mirror into form state so the user can tweak after
    setV2LeadKind(payload.leadKind as any);
    setV2Query(payload.query);
    setV2Industries(payload.industries);
    setV2Roles(payload.roles);
    setV2Cities(payload.cities);
    setV2Countries(payload.countries);
    setV2Seniority(payload.seniority);
    setV2Intent(payload.intent);
    setV2Count(payload.count);
    setV2UseMyContext(payload.useMyContext);
    // Run with the explicit payload (no race on state flush)
    v2DiscoverMutation.mutate(payload as any);
  };

  const charCount = postContent.length;
  const maxChars = 3000;

  async function handleOptimizeProfile() {
    setOptimizerLoading(true);
    setOptimizerResult(null);
    try {
      const r = await apiRequest("/api/admin/linkedin/optimize-profile", "POST", {
        headline: optimizerHeadline,
        about: optimizerAbout,
        goal: optimizerGoal,
        targetAudience: optimizerAudience,
        name: status?.profileName || "",
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setOptimizerResult(data);
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setOptimizerLoading(false);
    }
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }

  function scoreColor(score: number) {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-500";
  }

  function scoreRingColor(score: number) {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#eab308";
    return "#ef4444";
  }

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0A66C2] flex items-center justify-center">
          <SiLinkedin className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">LinkedIn</h2>
          <p className="text-sm text-muted-foreground">Import leads & post content to LinkedIn</p>
        </div>
      </div>

      {/* Account Switcher */}
      <div className="grid grid-cols-2 gap-3" data-testid="linkedin-account-switcher">
        {ACCOUNT_SLOTS.map(({ slot }) => {
          const acct = accounts?.accounts?.find(a => a.slot === slot);
          const isActive = activeSlot === slot;
          const testResult = testResults[slot];
          const isTesting = testingSlot === slot;
          return (
            <div
              key={slot}
              className={[
                "relative rounded-xl border-2 p-4 text-left transition-all",
                isActive
                  ? "border-[#0A66C2] bg-[#0A66C2]/5 shadow-sm"
                  : "border-border hover:border-[#0A66C2]/40 hover:bg-muted/30",
              ].join(" ")}
            >
              <button
                data-testid={`button-account-slot-${slot}`}
                onClick={() => setActiveSlot(slot as "primary" | "core_navigator")}
                className="w-full text-left"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={["w-2 h-2 rounded-full shrink-0", acct?.connected ? "bg-green-500" : "bg-muted-foreground/40"].join(" ")} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {slot === "primary" ? "Account 1" : "Account 2"}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-[10px] font-bold text-[#0A66C2] uppercase tracking-wide">Active</span>
                  )}
                </div>
                {acct?.connected ? (
                  <div>
                    <p className="text-sm font-semibold truncate leading-tight">{acct.profileName || "Connected"}</p>
                    {acct.email && <p className="text-xs text-muted-foreground truncate mt-0.5">{acct.email}</p>}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground/70 leading-tight">
                      {slot === "primary" ? "Main Account" : "Core Navigator Plan One"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Not connected</p>
                  </div>
                )}
              </button>

              {/* Test Connection button — only for connected accounts */}
              {acct?.connected && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <button
                    data-testid={`button-test-connection-${slot}`}
                    onClick={(e) => { e.stopPropagation(); testConnection(slot); }}
                    disabled={isTesting}
                    className="text-[11px] text-[#0A66C2] hover:underline disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isTesting ? "Testing…" : "Test connection"}
                  </button>

                  {/* Inline diagnostic results */}
                  {testResult && (
                    <div className="mt-1.5 space-y-1">
                      {testResult.checks?.map((c: any, i: number) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className={["text-[10px] mt-0.5", c.ok === true ? "text-green-500" : c.ok === false ? "text-red-500" : "text-amber-500"].join(" ")}>
                            {c.ok === true ? "✓" : c.ok === false ? "✗" : "?"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium leading-tight">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground leading-tight break-words">{c.detail}</p>
                          </div>
                        </div>
                      ))}
                      {testResult.error && (
                        <p className="text-[10px] text-red-500">{testResult.error}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Connection Card */}
      <Card className={status?.connected ? "border-[#0A66C2]/30 bg-[#0A66C2]/5" : "border-border"}>
        <CardContent className="pt-5">
          {!status?.configured ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">LinkedIn credentials not configured</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add <code className="bg-muted px-1 rounded text-xs">LINKEDIN_CLIENT_ID</code> and{" "}
                  <code className="bg-muted px-1 rounded text-xs">LINKEDIN_CLIENT_SECRET</code> to connect LinkedIn.
                </p>
              </div>
              <SetupInstructions />
            </div>
          ) : status?.connected ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Avatar className="h-12 w-12 border-2 border-[#0A66C2]/30 shrink-0">
                <AvatarImage src={status.profilePictureUrl} />
                <AvatarFallback className="bg-[#0A66C2] text-white text-sm font-bold">
                  {status.profileName?.charAt(0) || "L"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">{status.profileName}</p>
                  <Badge className="bg-[#0A66C2] text-white text-[10px] px-1.5 py-0 h-4 shrink-0">Connected</Badge>
                </div>
                {status.email && <p className="text-xs text-muted-foreground mt-0.5">{status.email}</p>}
                {status.connectedAt && (
                  <p className="text-xs text-muted-foreground">
                    Connected {format(new Date(status.connectedAt), "d MMM yyyy")}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-linkedin-disconnect"
                className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
              >
                <Unlink className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-3 rounded-full bg-[#0A66C2]/10">
                <SiLinkedin className="h-5 w-5 text-[#0A66C2]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Connect your LinkedIn account</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Link your LinkedIn to post content and import leads directly.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending || polling}
                  data-testid="button-linkedin-connect"
                  className="bg-[#0A66C2] hover:bg-[#004182] text-white shrink-0"
                >
                  {(connectMutation.isPending || polling) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <SiLinkedin className="h-4 w-4 mr-2" />
                  )}
                  {polling ? "Waiting…" : "Connect LinkedIn"}
                </Button>
                {polling && (
                  <p className="text-xs text-muted-foreground">
                    Complete login in the new tab
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main tabs — only shown when connected */}
      {status?.connected && (
        <Tabs defaultValue="optimizer">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
            <TabsTrigger value="optimizer" data-testid="tab-linkedin-optimizer">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Profile Optimizer
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-linkedin-analytics">
              <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="post" data-testid="tab-linkedin-post">
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Post Content
            </TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-linkedin-leads">
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Find Leads
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-linkedin-history">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              Post History
            </TabsTrigger>
            <TabsTrigger value="autopost" data-testid="tab-linkedin-autopost">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Auto-Post
              {autoPostEnabled && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
            </TabsTrigger>
            <TabsTrigger value="brain" data-testid="tab-linkedin-brain" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-pink-600 data-[state=active]:text-white">
              <Brain className="h-3.5 w-3.5 mr-1.5" />
              AI Brain
            </TabsTrigger>
            <TabsTrigger value="connection-messages" data-testid="tab-linkedin-connection-messages">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Connection Messages
            </TabsTrigger>
            <TabsTrigger value="hashtags" data-testid="tab-linkedin-hashtags">
              <Hash className="h-3.5 w-3.5 mr-1.5" />
              Hashtag Intel
            </TabsTrigger>
            <TabsTrigger value="content-planner" data-testid="tab-linkedin-content-planner">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
              Content Planner
            </TabsTrigger>
            <TabsTrigger value="profile-builder" data-testid="tab-linkedin-profile-builder" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0A66C2] data-[state=active]:to-cyan-600 data-[state=active]:text-white">
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Profile Builder
            </TabsTrigger>
          </TabsList>

          {/* ── Profile Optimizer Tab ─────────────────────────────────────── */}
          <TabsContent value="optimizer" className="mt-4 space-y-4">
            {/* Input Form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#0A66C2]" />
                  AI Profile Optimizer
                </CardTitle>
                <CardDescription>
                  Paste your current LinkedIn headline and bio below. AI will score your profile, suggest enhancements, and give you organic reach tips — all ready to copy directly into LinkedIn.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="opt-headline">Current Headline</Label>
                    <Input
                      id="opt-headline"
                      data-testid="input-optimizer-headline"
                      placeholder="e.g. Founder @ Urban Culture Hub | Amsterdam"
                      value={optimizerHeadline}
                      onChange={e => setOptimizerHeadline(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="opt-goal">Your Goal</Label>
                    <Input
                      id="opt-goal"
                      data-testid="input-optimizer-goal"
                      placeholder="e.g. Attract sponsors, grow community, find partners"
                      value={optimizerGoal}
                      onChange={e => setOptimizerGoal(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="opt-audience">Target Audience</Label>
                  <Input
                    id="opt-audience"
                    data-testid="input-optimizer-audience"
                    placeholder="e.g. Urban sports enthusiasts, venue owners, artists, sponsors in Amsterdam"
                    value={optimizerAudience}
                    onChange={e => setOptimizerAudience(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="opt-about">Current About / Bio</Label>
                  <Textarea
                    id="opt-about"
                    data-testid="input-optimizer-about"
                    placeholder="Paste your current LinkedIn About section here..."
                    value={optimizerAbout}
                    onChange={e => setOptimizerAbout(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                </div>
                <Button
                  data-testid="button-optimizer-analyze"
                  onClick={handleOptimizeProfile}
                  disabled={optimizerLoading || (!optimizerHeadline && !optimizerAbout)}
                  className="w-full bg-[#0A66C2] hover:bg-[#0A66C2]/90"
                >
                  {optimizerLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing Profile...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Analyze & Optimize Profile</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            {optimizerResult && (
              <div className="space-y-4">
                {/* Score Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Overall Score */}
                  <Card className="col-span-2 sm:col-span-1">
                    <CardContent className="pt-4 flex flex-col items-center justify-center gap-1 text-center">
                      <div className="relative w-20 h-20">
                        <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                          <circle
                            cx="18" cy="18" r="15.9" fill="none"
                            stroke={scoreRingColor(optimizerResult.score)}
                            strokeWidth="2.5"
                            strokeDasharray={`${optimizerResult.score} 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-xl font-bold ${scoreColor(optimizerResult.score)}`}>{optimizerResult.score}</span>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">Profile Score</p>
                    </CardContent>
                  </Card>
                  {/* Score Breakdown */}
                  {optimizerResult.scoreBreakdown && Object.entries(optimizerResult.scoreBreakdown).map(([key, val]: [string, any]) => (
                    <Card key={key}>
                      <CardContent className="pt-4 text-center">
                        <p className={`text-2xl font-bold ${scoreColor((val / (key === 'headline' || key === 'about' ? 25 : key === 'keywords' ? 20 : 15)) * 100)}`}>{val}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-1">{key}</p>
                        <p className="text-[10px] text-muted-foreground">/ {key === 'headline' || key === 'about' ? 25 : key === 'keywords' ? 20 : 15}</p>
                      </CardContent>
                    </Card>
                  ))}
                  {/* Organic Reach */}
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp className={`h-4 w-4 ${scoreColor(optimizerResult.organicReachScore)}`} />
                        <p className={`text-2xl font-bold ${scoreColor(optimizerResult.organicReachScore)}`}>{optimizerResult.organicReachScore}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Organic Reach Score</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Action Guide */}
                <Card className="border-[#0A66C2]/30 bg-[#0A66C2]/5">
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-[#0A66C2] mb-2">How to apply changes in 2 clicks</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { step: "1", label: "Copy the content below" },
                        { step: "→", label: "" },
                        { step: "2", label: "Click \"Edit on LinkedIn\"" },
                        { step: "→", label: "" },
                        { step: "3", label: "Paste & Save on LinkedIn" },
                      ].map((s, i) =>
                        s.label ? (
                          <div key={i} className="flex items-center gap-1.5 bg-white dark:bg-[#0A66C2]/10 rounded-md px-2.5 py-1 border border-[#0A66C2]/20">
                            <span className="text-[10px] font-bold text-[#0A66C2] bg-[#0A66C2]/10 rounded-full w-4 h-4 flex items-center justify-center">{s.step}</span>
                            <span className="text-xs text-foreground">{s.label}</span>
                          </div>
                        ) : (
                          <ArrowRight key={i} className="h-3 w-3 text-[#0A66C2]/50 shrink-0" />
                        )
                      )}
                    </div>
                    <Button
                      data-testid="button-open-linkedin-profile"
                      size="sm"
                      className="mt-3 bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white w-full sm:w-auto"
                      onClick={() => window.open("https://www.linkedin.com/in/me/", "_blank", "noopener,noreferrer")}
                    >
                      <SiLinkedin className="h-3.5 w-3.5 mr-1.5" />
                      Open My LinkedIn Profile
                      <ExternalLink className="h-3 w-3 ml-1.5" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Enhanced Headline */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Enhanced Headline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <p className="text-sm font-medium text-green-900 dark:text-green-100">{optimizerResult.enhancedHeadline}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        data-testid="button-copy-headline"
                        size="sm" variant="outline"
                        onClick={() => copyToClipboard(optimizerResult.enhancedHeadline, "headline")}
                      >
                        {copiedField === "headline" ? <><CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-600" /> Copied!</> : <><FileText className="h-3.5 w-3.5 mr-1.5" /> Copy</>}
                      </Button>
                      <Button
                        data-testid="button-edit-headline-linkedin"
                        size="sm"
                        className="bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white"
                        onClick={() => {
                          copyToClipboard(optimizerResult.enhancedHeadline, "headline");
                          window.open("https://www.linkedin.com/in/me/edit/intro/", "_blank", "noopener,noreferrer");
                        }}
                      >
                        <SiLinkedin className="h-3.5 w-3.5 mr-1.5" />
                        Edit on LinkedIn
                        <ExternalLink className="h-3 w-3 ml-1.5" />
                      </Button>
                    </div>
                    {optimizerResult.alternativeHeadlines?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Alternative options:</p>
                        {optimizerResult.alternativeHeadlines.map((h: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded border border-border hover:bg-muted/50">
                            <p className="text-xs flex-1">{h}</p>
                            <div className="flex gap-1.5 shrink-0">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => copyToClipboard(h, `alt-${i}`)}>
                                {copiedField === `alt-${i}` ? <CheckCircle className="h-3 w-3 text-green-600" /> : <FileText className="h-3 w-3" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-[#0A66C2]" onClick={() => { copyToClipboard(h, `alt-${i}`); window.open("https://www.linkedin.com/in/me/edit/intro/", "_blank", "noopener,noreferrer"); }}>
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Enhanced About */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#0A66C2]" />
                      Enhanced About / Bio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 max-h-60 overflow-y-auto">
                      <p className="text-sm whitespace-pre-wrap text-blue-900 dark:text-blue-100">{optimizerResult.enhancedAbout}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        data-testid="button-copy-about"
                        size="sm" variant="outline"
                        onClick={() => copyToClipboard(optimizerResult.enhancedAbout, "about")}
                      >
                        {copiedField === "about" ? <><CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-600" /> Copied!</> : <><FileText className="h-3.5 w-3.5 mr-1.5" /> Copy Bio</>}
                      </Button>
                      <Button
                        data-testid="button-edit-about-linkedin"
                        size="sm"
                        className="bg-[#0A66C2] hover:bg-[#0A66C2]/90 text-white"
                        onClick={() => {
                          copyToClipboard(optimizerResult.enhancedAbout, "about");
                          window.open("https://www.linkedin.com/in/me/edit/about-section/", "_blank", "noopener,noreferrer");
                        }}
                      >
                        <SiLinkedin className="h-3.5 w-3.5 mr-1.5" />
                        Edit on LinkedIn
                        <ExternalLink className="h-3 w-3 ml-1.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Keywords to Add */}
                {optimizerResult.keywordsToAdd?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Tags className="h-4 w-4 text-purple-600" />
                        Keywords to Add to Your Profile
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {optimizerResult.keywordsToAdd.map((kw: string, i: number) => (
                          <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-primary/10" onClick={() => copyToClipboard(kw, `kw-${i}`)}>
                            {copiedField === `kw-${i}` ? "Copied!" : kw}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 mt-3">
                        <p className="text-xs text-muted-foreground flex-1">Click any keyword to copy it, then add to your skills section on LinkedIn.</p>
                        <Button
                          data-testid="button-edit-skills-linkedin"
                          size="sm" variant="outline"
                          className="text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/5 shrink-0"
                          onClick={() => window.open("https://www.linkedin.com/in/me/edit/skills/", "_blank", "noopener,noreferrer")}
                        >
                          <SiLinkedin className="h-3.5 w-3.5 mr-1.5" />
                          Edit Skills on LinkedIn
                          <ExternalLink className="h-3 w-3 ml-1.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recommendations */}
                {optimizerResult.recommendations?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="h-4 w-4 text-orange-500" />
                        Improvement Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {optimizerResult.recommendations.map((rec: any, i: number) => (
                        <div key={i} className={`p-3 rounded-lg border-l-4 ${rec.priority === 'high' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : rec.priority === 'medium' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'}`}>
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 mt-0.5 ${rec.priority === 'high' ? 'border-red-400 text-red-600' : rec.priority === 'medium' ? 'border-yellow-400 text-yellow-600' : 'border-blue-400 text-blue-600'}`}>
                              {rec.priority}
                            </Badge>
                            <div>
                              <p className="text-sm font-semibold">{rec.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{rec.detail}</p>
                              {rec.impact && <p className="text-xs text-green-700 dark:text-green-400 mt-1 font-medium">Impact: {rec.impact}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Organic Reach Tips */}
                {optimizerResult.organicReachTips?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        Organic Reach Tips
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {optimizerResult.organicReachTips.map((tip: string, i: number) => (
                        <div key={i} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50">
                          <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-green-700">{i + 1}</span>
                          </div>
                          <p className="text-sm">{tip}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Content Strategy */}
                {optimizerResult.contentStrategy && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-[#0A66C2]" />
                        Content Strategy
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Posting Frequency</p>
                          <p className="text-sm">{optimizerResult.contentStrategy.postingFrequency}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Best Times to Post</p>
                          <p className="text-sm">{optimizerResult.contentStrategy.bestTimes}</p>
                        </div>
                      </div>
                      {optimizerResult.contentStrategy.bestPostTypes?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Best Post Types</p>
                          <div className="flex flex-wrap gap-2">
                            {optimizerResult.contentStrategy.bestPostTypes.map((t: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {optimizerResult.contentStrategy.contentPillars?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">Content Pillars</p>
                          <div className="flex flex-wrap gap-2">
                            {optimizerResult.contentStrategy.contentPillars.map((p: string, i: number) => (
                              <Badge key={i} className="bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/20 text-xs">{p}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Analytics Tab ─────────────────────────────────────────────── */}
          <TabsContent value="analytics" className="mt-4 space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Leads", value: analytics?.leads.total ?? "—", sub: `+${analytics?.leads.thisMonth ?? 0} this month`, icon: <Users className="h-4 w-4" />, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                { label: "Posts Published", value: analytics?.posts.published ?? "—", sub: `+${analytics?.posts.thisMonth ?? 0} this month`, icon: <Send className="h-4 w-4" />, color: "text-[#0A66C2]", bg: "bg-[#0A66C2]/5" },
                { label: "LinkedIn Imported", value: analytics?.leads.linkedinImported ?? "—", sub: "leads via LinkedIn", icon: <SiLinkedin className="h-4 w-4" />, color: "text-[#0A66C2]", bg: "bg-[#0A66C2]/5" },
                { label: "Leads Emailed", value: analytics?.leads.emailedLeads ?? "—", sub: "contacted so far", icon: <Mail className="h-4 w-4" />, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
              ].map((s, i) => (
                <Card key={i} className="border-border/60">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center ${s.color} mb-2`}>
                      {s.icon}
                    </div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs font-medium text-foreground mt-0.5">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Leads by Category */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Tags className="h-4 w-4 text-[#0A66C2]" /> Leads by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.leads.byType && Object.keys(analytics.leads.byType).length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={Object.entries(analytics.leads.byType).map(([k, v]) => ({
                              name: LEAD_TYPES.find(t => t.value === k)?.label.split(" / ")[0] || k,
                              value: v,
                              icon: LEAD_TYPES.find(t => t.value === k)?.icon || "",
                            }))}
                            cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                            paddingAngle={3} dataKey="value"
                          >
                            {Object.keys(analytics.leads.byType).map((_, idx) => (
                              <Cell key={idx} fill={["#0A66C2","#7c3aed","#ea580c","#16a34a","#ca8a04"][idx % 5]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => [`${v} leads`, ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
                        {Object.entries(analytics.leads.byType).map(([k, v], idx) => {
                          const t = LEAD_TYPES.find(lt => lt.value === k);
                          return (
                            <div key={k} className="flex items-center gap-1 text-xs">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ background: ["#0A66C2","#7c3aed","#ea580c","#16a34a","#ca8a04"][idx % 5] }} />
                              {t?.icon} {t?.label.split(" / ")[0] || k} <span className="font-semibold">({v})</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No lead data yet</div>
                  )}
                </CardContent>
              </Card>

              {/* Leads by Status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#0A66C2]" /> Lead Pipeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.leads.byStatus && Object.keys(analytics.leads.byStatus).length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={Object.entries(analytics.leads.byStatus).map(([k, v]) => ({ status: k.replace("_", " "), count: v }))} layout="vertical" margin={{ left: 8, right: 8 }}>
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="status" tick={{ fontSize: 10 }} width={70} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0A66C2" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No lead data yet</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Posts summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-[#0A66C2]" /> Posts Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: "Published", value: analytics?.posts.published ?? 0, color: "text-green-600" },
                    { label: "Failed", value: analytics?.posts.failed ?? 0, color: "text-red-600" },
                    { label: "This Month", value: analytics?.posts.thisMonth ?? 0, color: "text-[#0A66C2]" },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-muted/40">
                      <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                {(analytics?.leads.thisMonth ?? 0) > (analytics?.leads.lastMonth ?? 0) ? (
                  <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/10 text-xs text-green-700">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                    Lead growth is up this month vs last month ({analytics?.leads.lastMonth ?? 0} → {analytics?.leads.thisMonth ?? 0})
                  </div>
                ) : (analytics?.leads.thisMonth ?? 0) < (analytics?.leads.lastMonth ?? 0) ? (
                  <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-700">
                    <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                    Fewer leads added this month vs last ({analytics?.leads.lastMonth ?? 0} → {analytics?.leads.thisMonth ?? 0}). Try a new AI search.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Post Content Tab ──────────────────────────────────────────── */}
          <TabsContent value="post" className="mt-4 space-y-4">
            {/* ── PENDING APPROVAL QUEUE ── */}
            {pendingPosts.length > 0 && (
              <Card className="border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-amber-600" />
                    Awaiting Your Approval
                    <Badge variant="secondary" className="bg-amber-600 text-white ml-1">{pendingPosts.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    The auto-poster drafted these but did not publish. Review, edit if you want, then approve.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingPosts.map((p: any) => {
                    const isEditing = editingPendingId === p.id;
                    return (
                      <div key={p.id} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-background p-3 space-y-2" data-testid={`pending-post-${p.id}`}>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{p.postType || "post"}</Badge>
                          <span>Drafted {format(new Date(p.createdAt), "d MMM HH:mm")}</span>
                          {p.imageUrl && <Badge variant="outline" className="text-[10px] gap-1"><ImageIcon className="h-2.5 w-2.5" />image</Badge>}
                        </div>
                        {p.imageUrl && (
                          <img src={p.imageUrl} alt="" className="rounded-md w-full max-h-64 object-cover" />
                        )}
                        {isEditing ? (
                          <Textarea
                            value={editingPendingContent}
                            onChange={(e) => setEditingPendingContent(e.target.value)}
                            className="min-h-[180px] text-sm"
                            data-testid={`textarea-edit-pending-${p.id}`}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid={`text-pending-content-${p.id}`}>{p.content}</p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => updatePending.mutate({ id: p.id, content: editingPendingContent })}
                                disabled={updatePending.isPending || !editingPendingContent.trim()}
                                className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                                data-testid={`btn-save-edit-pending-${p.id}`}
                              >
                                {updatePending.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                Save edits
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingPendingId(null)}>Cancel</Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => approvePending.mutate(p.id)}
                                disabled={approvePending.isPending}
                                className="bg-green-600 hover:bg-green-700 text-white"
                                data-testid={`btn-approve-pending-${p.id}`}
                              >
                                {approvePending.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCheck className="h-3 w-3 mr-1" />}
                                Approve & Publish
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingPendingId(p.id); setEditingPendingContent(p.content); }}
                                data-testid={`btn-edit-pending-${p.id}`}
                              >
                                <Edit3 className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { if (confirm("Discard this draft?")) rejectPending.mutate(p.id); }}
                                disabled={rejectPending.isPending}
                                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                                data-testid={`btn-reject-pending-${p.id}`}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="h-4 w-4 text-[#0A66C2]" />
                  Compose LinkedIn Post
                </CardTitle>
                <CardDescription>
                  Share updates about Urban Culture Hub, events, or community news.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI Writer */}
                <div className="rounded-xl border border-[#0A66C2]/20 bg-[#0A66C2]/5 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#0A66C2] hover:bg-[#0A66C2]/10 transition-colors"
                    onClick={() => setShowAiWriter(!showAiWriter)}
                    data-testid="btn-toggle-ai-writer"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Write with AI
                    </span>
                    <span className="text-[10px] font-normal text-[#0A66C2]/70">{showAiWriter ? "close" : "generate a post from a topic"}</span>
                  </button>
                  {showAiWriter && (
                    <div className="px-4 pb-4 space-y-3 border-t border-[#0A66C2]/10">
                      {/* Templates */}
                      <div className="pt-3">
                        <Label className="text-xs font-medium mb-2 block">Template</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "general", label: "General Update", icon: <Megaphone className="h-3 w-3" /> },
                            { id: "event", label: "Event Announcement", icon: <Calendar className="h-3 w-3" /> },
                            { id: "battle", label: "Battle / Results", icon: <Trophy className="h-3 w-3" /> },
                            { id: "partnership", label: "Partnership", icon: <Handshake className="h-3 w-3" /> },
                            { id: "community", label: "Community Spotlight", icon: <Star className="h-3 w-3" /> },
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => setAiTemplate(t.id)}
                              data-testid={`btn-post-template-${t.id}`}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                aiTemplate === t.id
                                  ? "border-[#0A66C2] bg-[#0A66C2] text-white"
                                  : "border-border hover:border-[#0A66C2]/50 text-muted-foreground"
                              }`}
                            >
                              {t.icon}{t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tone */}
                      <div className="flex items-center gap-3">
                        <Label className="text-xs font-medium shrink-0">Tone</Label>
                        <div className="flex gap-2">
                          {["engaging", "professional", "casual", "inspiring"].map(t => (
                            <button
                              key={t}
                              onClick={() => setAiTone(t)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
                                aiTone === t ? "border-[#0A66C2] bg-[#0A66C2] text-white" : "border-border text-muted-foreground hover:border-[#0A66C2]/50"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Agent Mode toggle (uses your trained AI Brain) */}
                      <div className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${agentMode ? "border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30" : "border-border bg-muted/30"}`}>
                        <div className="flex items-center gap-2">
                          <Bot className={`h-4 w-4 ${agentMode ? "text-violet-600" : "text-muted-foreground"}`} />
                          <div>
                            <p className="text-xs font-semibold">Agent Mode</p>
                            <p className="text-[10px] text-muted-foreground">{agentMode ? "Drafts 3 variants + critiques + recommends" : "Single-shot generation"}</p>
                          </div>
                        </div>
                        <Switch checked={agentMode} onCheckedChange={setAgentMode} data-testid="switch-agent-writer" />
                      </div>

                      {/* Topic */}
                      <div>
                        <Label className="text-xs font-medium flex items-center justify-between">
                          <span>Topic / Details</span>
                          {(brandIntel?.version || 0) > 0 && (
                            <span className="text-[10px] text-violet-600 font-normal inline-flex items-center gap-1">
                              <Brain className="h-2.5 w-2.5" /> using AI Brain v{brandIntel.version}
                            </span>
                          )}
                        </Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            placeholder='e.g. "IMPACT+ battle on April 5 at Melkweg Amsterdam, 32 crews competing"'
                            value={aiTopic}
                            onChange={e => setAiTopic(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && aiTopic.trim()) {
                                agentMode ? agentGenerate.mutate() : generatePostMutation.mutate();
                              }
                            }}
                            className="text-sm"
                            data-testid="input-ai-post-topic"
                          />
                          <Button
                            type="button"
                            onClick={startVoiceCapture}
                            variant="outline"
                            size="icon"
                            title={voiceListening ? "Stop listening" : "Speak in English"}
                            className={`shrink-0 ${voiceListening ? "border-red-500 text-red-600 animate-pulse" : "border-[#0A66C2]/40 text-[#0A66C2] hover:bg-[#0A66C2]/10"}`}
                            data-testid="btn-voice-mic"
                          >
                            {voiceListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          </Button>
                          <Button
                            onClick={() => agentMode ? agentGenerate.mutate() : generatePostMutation.mutate()}
                            disabled={!aiTopic.trim() || generatePostMutation.isPending || agentGenerate.isPending}
                            className={agentMode
                              ? "bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white shrink-0"
                              : "bg-[#0A66C2] hover:bg-[#004182] text-white shrink-0"}
                            data-testid="btn-generate-post"
                          >
                            {(generatePostMutation.isPending || agentGenerate.isPending)
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : agentMode ? <Bot className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                          </Button>
                        </div>
                        {voiceListening && (
                          <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse"></span>
                            Listening (English) — speak your topic, click mic again to stop
                          </p>
                        )}
                      </div>

                      {/* Agent variants result */}
                      {agentResult && agentResult.variants && (
                        <div className="space-y-2 mt-2">
                          {agentResult.research && (
                            <div className="text-[11px] p-2 rounded border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
                              <strong className="text-violet-700 dark:text-violet-300">Research:</strong> {agentResult.research}
                              {agentResult.plan && <><br /><strong className="text-violet-700 dark:text-violet-300">Plan:</strong> {agentResult.plan}</>}
                            </div>
                          )}
                          <div className="grid gap-2">
                            {agentResult.variants.map((v: any, i: number) => {
                              const critique = agentResult.critique?.find?.((c: any) => c.variant === i);
                              const isRec = agentResult.recommendation === i;
                              return (
                                <div
                                  key={i}
                                  data-testid={`agent-variant-${i}`}
                                  className={`p-2.5 rounded-lg border text-xs transition-all ${
                                    isRec ? "border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/30 ring-2 ring-violet-200 dark:ring-violet-800"
                                      : "border-border bg-muted/20"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                                        Variant {i + 1} · {v.label || "draft"}
                                      </Badge>
                                      {isRec && <Badge className="bg-violet-600 text-white text-[9px] h-4 px-1">RECOMMENDED</Badge>}
                                      {critique?.score != null && (
                                        <span className="text-[10px] text-muted-foreground">score {critique.score}/10</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => { setPostContent(v.content); setEditedDraft(v.content); toast({ title: `Variant ${i + 1} loaded` }); }}
                                        className="text-[10px] px-2 py-0.5 rounded bg-[#0A66C2] text-white hover:bg-[#004182]"
                                        data-testid={`btn-use-variant-${i}`}
                                      >
                                        Use this
                                      </button>
                                      <button
                                        onClick={() => { navigator.clipboard.writeText(v.content); toast({ title: "Copied" }); }}
                                        className="text-muted-foreground hover:text-foreground"
                                        title="Copy"
                                      >
                                        <CopyIcon className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                  {v.approach && <p className="text-[10px] italic text-muted-foreground mb-1">→ {v.approach}</p>}
                                  <p className="whitespace-pre-line line-clamp-4 leading-relaxed">{v.content}</p>
                                  {critique && (critique.strengths || critique.weaknesses) && (
                                    <details className="mt-1.5">
                                      <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">show critique</summary>
                                      <div className="mt-1 text-[10px] space-y-0.5 text-muted-foreground">
                                        {critique.strengths && <p><span className="text-green-600">+ </span>{critique.strengths}</p>}
                                        {critique.weaknesses && <p><span className="text-red-600">− </span>{critique.weaknesses}</p>}
                                      </div>
                                    </details>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {agentResult.reasoning && (
                            <p className="text-[10px] italic text-muted-foreground pt-1">
                              <strong>Why recommend variant {(agentResult.recommendation ?? 0) + 1}:</strong> {agentResult.reasoning}
                            </p>
                          )}
                          {agentResult.meta && (
                            <p className="text-[9px] text-muted-foreground/70 text-right">
                              brain v{agentResult.meta.intelVersion} · {agentResult.meta.goldExamplesUsed} gold examples · {agentResult.meta.recentPostsConsidered} recent posts considered
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Preview bar */}
                <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border/60">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={status.profilePictureUrl} />
                    <AvatarFallback className="bg-[#0A66C2] text-white text-xs font-bold">
                      {status.profileName?.charAt(0) || "L"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-semibold leading-tight">{status.profileName}</p>
                    <p className="text-[10px] text-muted-foreground">Posting to LinkedIn · Public</p>
                  </div>
                </div>

                {/* Text area */}
                <div className="space-y-1">
                  <Textarea
                    placeholder="What do you want to share? Tell your network about Urban Culture Hub, upcoming events, or community updates..."
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="min-h-[140px] resize-none text-sm"
                    maxLength={maxChars}
                    data-testid="input-linkedin-post-content"
                  />
                  <p className={`text-xs text-right ${charCount > maxChars * 0.9 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {charCount} / {maxChars}
                  </p>
                </div>

                {/* Link option */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIncludeLink(!includeLink)}
                    className="flex items-center gap-2 text-sm text-[#0A66C2] hover:text-[#004182] font-medium transition-colors"
                    data-testid="button-toggle-link"
                  >
                    <Link2 className="h-4 w-4" />
                    {includeLink ? "Remove link" : "Add a link"}
                  </button>

                  {includeLink && (
                    <div className="space-y-2 pl-4 border-l-2 border-[#0A66C2]/30">
                      <div>
                        <Label className="text-xs">URL</Label>
                        <Input
                          placeholder="https://urbanculturehub.nl/..."
                          value={postLinkUrl}
                          onChange={(e) => setPostLinkUrl(e.target.value)}
                          className="text-sm mt-1"
                          data-testid="input-linkedin-link-url"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Link title (optional)</Label>
                        <Input
                          placeholder="Urban Culture Hub – Event"
                          value={postLinkTitle}
                          onChange={(e) => setPostLinkTitle(e.target.value)}
                          className="text-sm mt-1"
                          data-testid="input-linkedin-link-title"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={() => postMutation.mutate()}
                    disabled={!postContent.trim() || postMutation.isPending}
                    className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                    data-testid="button-linkedin-post-submit"
                  >
                    {postMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Post to LinkedIn
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Import Lead Tab ───────────────────────────────────────────── */}
          <TabsContent value="leads" className="mt-4 space-y-4">

            {/* Mode switcher */}
            <div className="flex gap-2 flex-wrap">
              {[
                { id: "connect" as const, label: "Connect on LinkedIn", icon: <UserCheck className="h-3.5 w-3.5" /> },
                { id: "search" as const, label: "Find Leads with AI", icon: <Zap className="h-3.5 w-3.5" /> },
                { id: "add" as const, label: "Add Single Lead", icon: <UserPlus className="h-3.5 w-3.5" /> },
                { id: "bulk" as const, label: "Bulk Import", icon: <ListPlus className="h-3.5 w-3.5" /> },
              ].map(m => (
                <Button
                  key={m.id}
                  size="sm"
                  variant={leadsMode === m.id ? "default" : "outline"}
                  className={leadsMode === m.id ? "bg-[#0A66C2] hover:bg-[#004182] text-white" : ""}
                  onClick={() => setLeadsMode(m.id)}
                  data-testid={`btn-leads-mode-${m.id}`}
                >
                  {m.icon}
                  <span className="ml-1.5">{m.label}</span>
                </Button>
              ))}
            </div>

            {/* ── Connect on LinkedIn ────────────────────────────── */}
            {leadsMode === "connect" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <SiLinkedin className="h-4 w-4 text-[#0A66C2]" />
                    Connect on LinkedIn
                  </CardTitle>
                  <CardDescription>
                    Search for a person by name or organisation and open their LinkedIn profile to send a connection request — all in one click.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">

                  {/* Search form */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Person's Name</Label>
                      <Input
                        placeholder="e.g. Jan de Vries"
                        value={connectName}
                        onChange={e => setConnectName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && (connectName.trim() || connectOrg.trim())) {
                            const q = [connectName, connectOrg].filter(Boolean).join(" ");
                            const url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
                            window.open(url, "_blank");
                            setConnectHistory(h => [{ name: connectName, org: connectOrg, url, at: new Date().toLocaleTimeString() }, ...h.slice(0, 19)]);
                          }
                        }}
                        data-testid="input-connect-name"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1 block">Organisation (optional)</Label>
                      <Input
                        placeholder="e.g. Gemeente Amsterdam"
                        value={connectOrg}
                        onChange={e => setConnectOrg(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && (connectName.trim() || connectOrg.trim())) {
                            const q = [connectName, connectOrg].filter(Boolean).join(" ");
                            const url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
                            window.open(url, "_blank");
                            setConnectHistory(h => [{ name: connectName, org: connectOrg, url, at: new Date().toLocaleTimeString() }, ...h.slice(0, 19)]);
                          }
                        }}
                        data-testid="input-connect-org"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      className="bg-[#0A66C2] hover:bg-[#004182] text-white flex-1 sm:flex-none"
                      disabled={!connectName.trim() && !connectOrg.trim()}
                      onClick={() => {
                        const q = [connectName, connectOrg].filter(Boolean).join(" ");
                        const url = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
                        window.open(url, "_blank");
                        setConnectHistory(h => [{ name: connectName, org: connectOrg, url, at: new Date().toLocaleTimeString() }, ...h.slice(0, 19)]);
                      }}
                      data-testid="btn-search-connect-linkedin"
                    >
                      <SiLinkedin className="h-4 w-4 mr-2" />
                      Search &amp; Connect on LinkedIn
                    </Button>
                    {(connectName || connectOrg) && (
                      <Button variant="outline" onClick={() => { setConnectName(""); setConnectOrg(""); }}>
                        Clear
                      </Button>
                    )}
                  </div>

                  {/* How it works note */}
                  <div className="flex gap-2 p-3 rounded-xl bg-[#0A66C2]/5 border border-[#0A66C2]/20">
                    <SiLinkedin className="h-4 w-4 text-[#0A66C2] mt-0.5 shrink-0" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">How it works</p>
                      <p>Click the button above — LinkedIn opens in a new tab with search results for that person. Find them in the list and click <strong>Connect</strong> on their profile to send a connection request.</p>
                      <p>To add them to your <strong>Outreach CRM</strong> at the same time, use the <em>Find Leads with AI</em> tab or <em>Add Single Lead</em> — those are separate actions.</p>
                    </div>
                  </div>

                  {/* History */}
                  {connectHistory.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent searches this session</p>
                      {connectHistory.map((h, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/20">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{h.name || h.org}</p>
                            {h.name && h.org && <p className="text-xs text-muted-foreground truncate">{h.org}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground">{h.at}</span>
                            <a href={h.url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[#0A66C2] border border-[#0A66C2]/30 hover:bg-[#0A66C2]/10 transition-colors">
                              <SiLinkedin className="h-3 w-3" /> Open
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── AI Lead Discovery ────────────────────────────── */}
            {leadsMode === "search" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-[#0A66C2]" />
                    AI Lead Discovery
                    <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white">v2</span>
                  </CardTitle>
                  <CardDescription>
                    Find real people, decision-makers, founders, and companies — AI tailors results to your projects, scores each lead, and writes a personalized opener.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Top: lead kind segmented control + intent + count */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Users className="h-3 w-3" /> Looking for</Label>
                        <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg">
                          {([
                            { v: "person", label: "People", icon: <UserCheck className="h-3 w-3" /> },
                            { v: "company", label: "Companies", icon: <Briefcase className="h-3 w-3" /> },
                            { v: "both", label: "Both", icon: <Sparkles className="h-3 w-3" /> },
                          ] as const).map(opt => (
                            <button
                              key={opt.v}
                              type="button"
                              onClick={() => setV2LeadKind(opt.v as any)}
                              data-testid={`btn-v2-kind-${opt.v}`}
                              className={`flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                                v2LeadKind === opt.v
                                  ? "bg-white dark:bg-card shadow text-[#0A66C2]"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {opt.icon}
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Target className="h-3 w-3" /> Intent</Label>
                        <Select value={v2Intent} onValueChange={setV2Intent}>
                          <SelectTrigger className="h-9 text-sm" data-testid="select-v2-intent"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="networking">Networking — grow my network</SelectItem>
                            <SelectItem value="collaboration">Collaboration — joint projects, content swaps</SelectItem>
                            <SelectItem value="partnership">Partnership — long-term B2B</SelectItem>
                            <SelectItem value="sponsorship">Sponsorship — fund events / projects</SelectItem>
                            <SelectItem value="investment">Investment — investors, VCs, grants</SelectItem>
                            <SelectItem value="hiring">Hiring — recruit talent</SelectItem>
                            <SelectItem value="mentorship">Mentorship — advisors, openers of doors</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><BarChart2 className="h-3 w-3" /> How many</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={5}
                            max={40}
                            step={5}
                            value={v2Count}
                            onChange={e => setV2Count(Number(e.target.value))}
                            className="flex-1 accent-[#0A66C2]"
                            data-testid="input-v2-count"
                          />
                          <span className="text-sm font-semibold w-8 text-right">{v2Count}</span>
                        </div>
                      </div>
                    </div>

                    {/* Free-text query */}
                    <div>
                      <Label className="text-xs font-medium flex items-center gap-1.5"><Search className="h-3 w-3" /> Describe what you're looking for (optional but powerful)</Label>
                      <Input
                        placeholder='e.g. "AI startup founders building creator tools" or "cultural-sector decision makers in Rotterdam"'
                        value={v2Query}
                        onChange={e => setV2Query(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !v2DiscoverMutation.isPending) v2DiscoverMutation.mutate(); }}
                        className="mt-1 text-sm"
                        data-testid="input-v2-query"
                      />
                    </div>

                    {/* Industries chips */}
                    <div>
                      <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Filter className="h-3 w-3" /> Industries</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {["AI","Tech","Startups","SaaS","Marketing","Music","Dance","Cultural sector","Municipality","Sports","Media","Investment","Education","Hospitality","Events","E-commerce","Design","Community"].map(ind => {
                          const active = v2Industries.includes(ind);
                          return (
                            <button
                              key={ind}
                              type="button"
                              onClick={() => setV2Industries(prev => active ? prev.filter(x => x !== ind) : [...prev, ind])}
                              data-testid={`chip-v2-industry-${ind.toLowerCase().replace(/\s+/g, "-")}`}
                              className={`text-[11px] font-medium px-2 py-1 rounded-full border transition-all ${
                                active
                                  ? "border-[#0A66C2] bg-[#0A66C2] text-white"
                                  : "border-border hover:border-[#0A66C2]/40 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {ind}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Roles chips (people-focused) */}
                    {v2LeadKind !== "company" && (
                      <div>
                        <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> Roles</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {["Founder","CEO","CTO","Developer","Product Manager","Marketer","Designer","Investor","Director","Coordinator","Curator","Journalist","Event Organizer","Community Manager","Partnerships Lead","Head of Innovation"].map(rl => {
                            const active = v2Roles.includes(rl);
                            return (
                              <button
                                key={rl}
                                type="button"
                                onClick={() => setV2Roles(prev => active ? prev.filter(x => x !== rl) : [...prev, rl])}
                                data-testid={`chip-v2-role-${rl.toLowerCase().replace(/\s+/g, "-")}`}
                                className={`text-[11px] font-medium px-2 py-1 rounded-full border transition-all ${
                                  active
                                    ? "border-purple-500 bg-purple-500 text-white"
                                    : "border-border hover:border-purple-500/40 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {rl}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Seniority + Cities + Countries */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {v2LeadKind !== "company" && (
                        <div>
                          <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> Seniority</Label>
                          <Select value={v2Seniority} onValueChange={setV2Seniority}>
                            <SelectTrigger className="h-9 text-sm" data-testid="select-v2-seniority"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any</SelectItem>
                              <SelectItem value="junior">Junior</SelectItem>
                              <SelectItem value="mid">Mid</SelectItem>
                              <SelectItem value="senior">Senior</SelectItem>
                              <SelectItem value="decision_maker">Decision-maker</SelectItem>
                              <SelectItem value="c_level">C-level</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Cities (Enter to add)</Label>
                        <Input
                          placeholder="Amsterdam, Rotterdam…"
                          className="h-9 text-sm"
                          data-testid="input-v2-cities"
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              const v = (e.target as HTMLInputElement).value.trim();
                              if (v && !v2Cities.includes(v)) setV2Cities(prev => [...prev, v]);
                              (e.target as HTMLInputElement).value = "";
                              e.preventDefault();
                            }
                          }}
                        />
                        {v2Cities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {v2Cities.map(c => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-[#0A66C2]/10 text-[#0A66C2] flex items-center gap-1">
                                {c}
                                <button onClick={() => setV2Cities(prev => prev.filter(x => x !== c))}><XIcon className="h-2.5 w-2.5" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-medium mb-1.5 flex items-center gap-1.5"><Globe className="h-3 w-3" /> Countries</Label>
                        <Input
                          placeholder="Netherlands, Germany…"
                          className="h-9 text-sm"
                          data-testid="input-v2-countries"
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              const v = (e.target as HTMLInputElement).value.trim();
                              if (v && !v2Countries.includes(v)) setV2Countries(prev => [...prev, v]);
                              (e.target as HTMLInputElement).value = "";
                              e.preventDefault();
                            }
                          }}
                        />
                        {v2Countries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {v2Countries.map(c => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                {c}
                                <button onClick={() => setV2Countries(prev => prev.filter(x => x !== c))}><XIcon className="h-2.5 w-2.5" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Use my context toggle */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-gradient-to-r from-purple-50/40 to-pink-50/40 dark:from-purple-900/10 dark:to-pink-900/10">
                      <Brain className="h-5 w-5 text-purple-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Use my AI brain context</p>
                        <p className="text-[11px] text-muted-foreground">Inject your brand story, audience notes, and live platform context so leads are tailored to your projects.</p>
                      </div>
                      <Switch checked={v2UseMyContext} onCheckedChange={setV2UseMyContext} data-testid="switch-v2-context" />
                    </div>

                    {/* Search button */}
                    <Button
                      className="bg-gradient-to-r from-[#0A66C2] to-purple-600 hover:from-[#004182] hover:to-purple-700 text-white w-full"
                      onClick={() => v2DiscoverMutation.mutate()}
                      disabled={v2DiscoverMutation.isPending}
                      data-testid="btn-v2-discover"
                    >
                      {v2DiscoverMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Finding leads…</>
                      ) : (
                        <><Sparkles className="h-4 w-4 mr-2" />Find leads with AI</>
                      )}
                    </Button>

                    {/* Search history */}
                    {discoverySearches.length > 0 && (
                      <div className="border-t pt-3">
                        <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"><HistoryIcon className="h-3 w-3" /> Recent searches</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {discoverySearches.slice(0, 8).map((s: any) => (
                            <div key={s.id} className="group flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-[#0A66C2]/10 transition-colors">
                              <button
                                onClick={() => rerunSearch(s)}
                                className="flex items-center gap-1 text-muted-foreground hover:text-[#0A66C2]"
                                data-testid={`btn-rerun-search-${s.id}`}
                                title={`${s.resultCount} leads · ${new Date(s.createdAt).toLocaleDateString()}`}
                              >
                                <RefreshCw className="h-2.5 w-2.5" />
                                <span className="max-w-[160px] truncate">{s.label || "(unlabeled)"}</span>
                                <span className="text-[9px] text-muted-foreground/70">· {s.resultCount}</span>
                              </button>
                              <button
                                onClick={() => deleteSearchMutation.mutate(s.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
                                title="Delete this search"
                              >
                                <XIcon className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Loading skeleton */}
                    {v2DiscoverMutation.isPending && (
                      <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="h-32 rounded-xl border bg-muted/40 animate-pulse" />
                        ))}
                      </div>
                    )}

                    {/* Results */}
                    {!v2DiscoverMutation.isPending && v2Results.length > 0 && (
                      <div className="space-y-2 pt-2">
                        {/* Shortfall banner — when AI couldn't find as many real leads as requested */}
                        {v2Meta && v2Meta.shortfall > 0 && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 flex items-start gap-2" data-testid="banner-v2-shortfall">
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs">
                              <p className="font-semibold text-amber-900 dark:text-amber-200">Returned {v2Meta.returned} of {v2Meta.requested} requested.</p>
                              <p className="text-amber-700 dark:text-amber-300/90 mt-0.5">{v2Meta.note || "These are the highest-confidence real leads matching your filters. Broaden industries / roles / countries to get more."}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">
                              {v2Results.length} {v2Meta && v2Meta.requested !== v2Results.length ? `of ${v2Meta.requested} requested` : "leads"} · deduplicated · sorted by AI relevance score
                            </p>
                            <p className="text-[10px] text-muted-foreground/70">Real organizations only. LinkedIn links open verified search pages so you always land on a real result.</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => {
                              const queueable = v2Results.filter(l => !v2ImportedKeys.has(v2KeyOf(l)));
                              queueable.forEach(l => v2ImportMutation.mutate(l));
                            }}
                            disabled={v2ImportMutation.isPending || v2Results.every(l => v2ImportedKeys.has(v2KeyOf(l)))}
                            data-testid="btn-v2-import-all"
                          >
                            <ListPlus className="h-3 w-3 mr-1" />
                            Save all to CRM
                          </Button>
                        </div>

                        {v2Results.map((lead: any, idx: number) => {
                          const key = v2KeyOf(lead);
                          const isImported = v2ImportedKeys.has(key);
                          const score = lead.score ?? 0;
                          const scoreColor = score >= 80 ? "text-green-600 bg-green-50 border-green-200" : score >= 60 ? "text-blue-600 bg-blue-50 border-blue-200" : score >= 40 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-muted-foreground bg-muted border-border";
                          const kindLabel = lead.leadKind === "person" ? "Person" : lead.leadKind === "company" ? "Company" : "Org";
                          const kindIcon = lead.leadKind === "person" ? <UserCheck className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />;
                          const howConnectLabels: Record<string, { label: string; cls: string }> = {
                            connect_request: { label: "Send connection request", cls: "text-[#0A66C2] bg-[#0A66C2]/10 border-[#0A66C2]/30" },
                            warm_intro: { label: "Ask for warm intro", cls: "text-purple-600 bg-purple-50 border-purple-200" },
                            comment_then_dm: { label: "Comment first, then DM", cls: "text-amber-600 bg-amber-50 border-amber-200" },
                            cold_dm: { label: "Cold DM", cls: "text-pink-600 bg-pink-50 border-pink-200" },
                            email_first: { label: "Email first", cls: "text-blue-600 bg-blue-50 border-blue-200" },
                            event_meetup: { label: "Meet at an event", cls: "text-green-600 bg-green-50 border-green-200" },
                            content_engagement: { label: "Engage with their content", cls: "text-orange-600 bg-orange-50 border-orange-200" },
                          };
                          const howConnect = howConnectLabels[lead.howToConnect] || { label: lead.howToConnect, cls: "text-muted-foreground bg-muted border-border" };

                          return (
                            <div
                              key={`v2-${idx}`}
                              data-testid={`v2-lead-card-${idx}`}
                              className={`p-3 rounded-xl border transition-all ${
                                isImported ? "border-green-200 bg-green-50/40 dark:bg-green-900/10 opacity-80" : "border-border bg-card hover:border-[#0A66C2]/30"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  {/* Top row: kind, name/role @ org, score */}
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 bg-muted text-muted-foreground">{kindIcon} {kindLabel}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${scoreColor}`} title="AI relevance score 0–100">{score}</span>
                                    {lead.aiConfidence != null && lead.aiConfidence < 60 && (
                                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded" title="AI is not certain this exact person/company exists — verify before reaching out.">low confidence</span>
                                    )}
                                    {lead.industry && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">{lead.industry}</span>}
                                    {lead.seniority && lead.seniority !== "any" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{String(lead.seniority).replace(/_/g, " ")}</span>}
                                  </div>
                                  {/* Name / role / org */}
                                  <p className="font-semibold text-sm truncate" data-testid={`text-v2-lead-name-${idx}`}>
                                    {lead.name || lead.role || lead.organization}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {lead.role && lead.name ? `${lead.role} · ` : ""}
                                    {lead.organization}
                                    {(lead.city || lead.country) && `  ·  ${[lead.city, lead.country].filter(Boolean).join(", ")}`}
                                  </p>
                                  {/* Tags */}
                                  {Array.isArray(lead.tags) && lead.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {lead.tags.map((t: string) => (
                                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{t}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Why relevant */}
                              {lead.whyRelevant && (
                                <div className="mt-2 px-2.5 py-1.5 rounded bg-blue-50/60 dark:bg-blue-900/10 border-l-2 border-blue-400 text-xs text-blue-900 dark:text-blue-200">
                                  <span className="font-semibold">Why relevant: </span>{lead.whyRelevant}
                                </div>
                              )}

                              {/* How to connect + Suggested opener */}
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-2">
                                <span className={`self-start text-[10px] font-medium px-2 py-1 rounded border whitespace-nowrap ${howConnect.cls}`}>{howConnect.label}</span>
                                {lead.suggestedOpener && (
                                  <div className="text-xs px-2 py-1.5 rounded bg-muted/60 border border-border italic text-foreground/90">
                                    "{lead.suggestedOpener}"
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(lead.suggestedOpener); toast({ title: "Opener copied" }); }}
                                      className="ml-1.5 text-muted-foreground hover:text-[#0A66C2] inline-flex items-center align-middle"
                                      title="Copy opener"
                                      data-testid={`btn-v2-copy-opener-${idx}`}
                                    >
                                      <CopyIcon className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                <Button
                                  size="sm"
                                  className={`h-7 text-xs ${isImported ? "bg-green-600 hover:bg-green-700" : "bg-[#0A66C2] hover:bg-[#004182]"} text-white`}
                                  onClick={() => v2ImportMutation.mutate(lead)}
                                  disabled={isImported || v2ImportMutation.isPending}
                                  data-testid={`btn-v2-save-${idx}`}
                                >
                                  {isImported ? <><CheckCircle className="h-3 w-3 mr-1" /> Saved</> : <><BookmarkPlus className="h-3 w-3 mr-1" /> Save to CRM</>}
                                </Button>
                                {lead.linkedinUrl && (
                                  <a
                                    href={lead.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-[#0A66C2]/5 hover:border-[#0A66C2]/40 text-[#0A66C2]"
                                    data-testid={`link-v2-linkedin-${idx}`}
                                  >
                                    <SiLinkedin className="h-3 w-3" /> Open on LinkedIn
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                {(lead as any)._savedId && (
                                  <button
                                    onClick={() => v2SaveToBrainMutation.mutate({ leadId: (lead as any)._savedId, saved: true })}
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-pink-200 text-pink-600 hover:bg-pink-50"
                                    data-testid={`btn-v2-save-brain-${idx}`}
                                    title="Mark as a favorite the AI should remember"
                                  >
                                    <Heart className="h-3 w-3" /> Save to brain
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty state */}
                    {!v2DiscoverMutation.isPending && v2Results.length === 0 && !v2DiscoverMutation.isError && (
                      <div className="text-center py-8 px-4 border border-dashed rounded-xl text-muted-foreground">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-foreground">Ready to find real opportunities</p>
                        <p className="text-xs mt-1">Pick filters above and tap <strong>Find leads with AI</strong>. Results include real people, decision-makers, and companies — each scored and explained.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            {/* ── Add Single Lead ─────────────────────────────── */}
            {leadsMode === "add" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-[#0A66C2]" />
                    Add LinkedIn Contact as Lead
                  </CardTitle>
                  <CardDescription>
                    Paste a profile URL and fill in details — then choose which category to file them under.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Category */}
                  <div>
                    <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">
                      <Tags className="h-3.5 w-3.5" />
                      Category <span className="text-red-500">*</span>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {LEAD_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => setLeadForm({ ...leadForm, type: t.value })}
                          data-testid={`btn-lead-type-${t.value}`}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all ${
                            leadForm.type === t.value
                              ? "border-[#0A66C2] bg-[#0A66C2]/5 ring-1 ring-[#0A66C2]/30"
                              : "border-border hover:border-[#0A66C2]/40 hover:bg-muted/40"
                          }`}
                        >
                          <span className="text-lg">{t.icon}</span>
                          <span className={`text-[10px] font-medium leading-tight ${leadForm.type === t.value ? "text-[#0A66C2]" : "text-muted-foreground"}`}>
                            {t.label.split(" / ")[0]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* LinkedIn URL — first so handle can be shown */}
                    <div className="sm:col-span-2">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <SiLinkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                        LinkedIn Profile URL
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          placeholder="https://linkedin.com/in/jandevries or /company/gemeente-amsterdam"
                          value={leadForm.linkedinUrl}
                          onChange={(e) => setLeadForm({ ...leadForm, linkedinUrl: e.target.value })}
                          className="text-sm flex-1"
                          data-testid="input-lead-linkedin-url"
                        />
                        {leadForm.linkedinUrl && extractLinkedInHandle(leadForm.linkedinUrl) && (
                          <a
                            href={leadForm.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-md border border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/5 text-xs"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </a>
                        )}
                      </div>
                      {extractLinkedInHandle(leadForm.linkedinUrl) && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Handle: <span className="font-mono text-foreground">/{extractLinkedInHandle(leadForm.linkedinUrl)}</span>
                        </p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        Organization <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        placeholder="e.g. Gemeente Amsterdam"
                        value={leadForm.organization}
                        onChange={(e) => setLeadForm({ ...leadForm, organization: e.target.value })}
                        className="mt-1 text-sm"
                        data-testid="input-lead-organization"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-medium">Contact Name</Label>
                      <Input
                        placeholder="e.g. Jan de Vries"
                        value={leadForm.contactName}
                        onChange={(e) => setLeadForm({ ...leadForm, contactName: e.target.value })}
                        className="mt-1 text-sm"
                        data-testid="input-lead-contact-name"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </Label>
                      <Input
                        type="email"
                        placeholder="contact@gemeente.nl"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                        className="mt-1 text-sm"
                        data-testid="input-lead-email"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        City
                      </Label>
                      <Input
                        placeholder="e.g. Amsterdam"
                        value={leadForm.city}
                        onChange={(e) => setLeadForm({ ...leadForm, city: e.target.value })}
                        className="mt-1 text-sm"
                        data-testid="input-lead-city"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Label className="text-xs font-medium">Notes</Label>
                      <Textarea
                        placeholder="Context from LinkedIn, what they do, mutual connections..."
                        value={leadForm.notes}
                        onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                        className="mt-1 text-sm min-h-[70px] resize-none"
                        data-testid="input-lead-notes"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{LEAD_TYPES.find(t => t.value === leadForm.type)?.icon}</span>
                      <p className="text-xs text-muted-foreground">
                        Will be saved as <span className="font-medium text-foreground">{LEAD_TYPES.find(t => t.value === leadForm.type)?.label}</span>
                      </p>
                    </div>
                    <Button
                      onClick={() => importLeadMutation.mutate()}
                      disabled={!leadForm.organization.trim() || importLeadMutation.isPending}
                      className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                      data-testid="button-import-lead"
                    >
                      {importLeadMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      Add to Outreach
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Bulk Import ──────────────────────────────────── */}
            {leadsMode === "bulk" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ListPlus className="h-4 w-4 text-[#0A66C2]" />
                    Bulk Import from LinkedIn
                  </CardTitle>
                  <CardDescription>
                    Paste multiple entries — one per line. Each line can contain a LinkedIn URL, organization name, and email separated by <code className="bg-muted px-1 rounded text-[10px]">|</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs font-medium flex items-center gap-1.5 mb-1">
                      <Tags className="h-3.5 w-3.5" />
                      Category for all entries
                    </Label>
                    <Select value={bulkType} onValueChange={setBulkType}>
                      <SelectTrigger className="text-sm" data-testid="select-bulk-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <span className="flex items-center gap-2">
                              <span>{t.icon}</span>
                              <span>{t.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-medium mb-1 block">Paste entries (one per line)</Label>
                    <Textarea
                      placeholder={`Gemeente Amsterdam | Jan de Vries | https://linkedin.com/in/jandevries | jan@amsterdam.nl\nhttps://linkedin.com/company/gemeente-rotterdam\nStichting Cultuur Rotterdam | info@cultuurrotterdam.nl`}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      className="text-sm font-mono min-h-[160px] resize-none"
                      data-testid="input-bulk-leads"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {bulkText.split("\n").filter(l => l.trim()).length} entries detected
                    </p>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg border border-border text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Format guide:</p>
                    <p><code className="bg-muted px-1 rounded">Org Name | linkedin.com/in/handle | email@domain.com</code></p>
                    <p>Fields are auto-detected — LinkedIn URLs, email addresses, and org names are matched automatically. All fields optional except organization (falls back to LinkedIn handle).</p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => bulkImportMutation.mutate()}
                      disabled={!bulkText.trim() || bulkImportMutation.isPending}
                      className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                      data-testid="button-bulk-import"
                    >
                      {bulkImportMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Import All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Post History Tab ──────────────────────────────────────────── */}
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#0A66C2]" />
                  Post History
                </CardTitle>
                <CardDescription>All LinkedIn posts you have published from this dashboard.</CardDescription>
              </CardHeader>
              <CardContent>
                {postsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No posts yet. Compose your first post above.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        data-testid={`linkedin-post-${post.id}`}
                        className="p-4 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={post.status} />
                            {post.postType === "link" && (
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                <Link2 className="h-2.5 w-2.5 mr-1" />
                                With Link
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {post.publishedAt
                                ? format(new Date(post.publishedAt), "d MMM yyyy, HH:mm")
                                : format(new Date(post.createdAt), "d MMM yyyy")}
                            </span>
                            {post.linkedinPostId && (
                              <a
                                href={`https://www.linkedin.com/feed/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#0A66C2] hover:text-[#004182]"
                                title="View on LinkedIn"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-foreground/80 line-clamp-3 leading-relaxed">{post.content}</p>
                        {post.linkUrl && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#0A66C2]">
                            <Globe className="h-3 w-3 shrink-0" />
                            <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                              {post.linkTitle || post.linkUrl}
                            </a>
                          </div>
                        )}
                        {/* AI Brain feedback row */}
                        {post.status === "published" && (
                          <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                <Brain className="h-2.5 w-2.5" />
                                Train AI:
                              </span>
                              <button
                                onClick={() => sendFeedback.mutate({ id: post.id, rating: "up" })}
                                disabled={sendFeedback.isPending}
                                title="This post nailed it — save as gold example"
                                className={`p-1 rounded hover:bg-green-100 dark:hover:bg-green-950/40 transition-colors ${(post as any).feedback?.rating === "up" ? "bg-green-100 dark:bg-green-950/40 text-green-600" : "text-muted-foreground"}`}
                                data-testid={`btn-feedback-up-${post.id}`}
                              >
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => sendFeedback.mutate({ id: post.id, rating: "down" })}
                                disabled={sendFeedback.isPending}
                                title="Off-brand — AI should not write like this"
                                className={`p-1 rounded hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors ${(post as any).feedback?.rating === "down" ? "bg-red-100 dark:bg-red-950/40 text-red-600" : "text-muted-foreground"}`}
                                data-testid={`btn-feedback-down-${post.id}`}
                              >
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => addExample.mutate({ content: post.content, kind: "gold", reason: "Saved from history", sourcePostId: post.id })}
                                disabled={addExample.isPending}
                                title="Save to gold example library"
                                className="p-1 rounded hover:bg-violet-100 dark:hover:bg-violet-950/40 text-muted-foreground hover:text-violet-600 transition-colors"
                                data-testid={`btn-save-example-${post.id}`}
                              >
                                <BookmarkPlus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {(post as any).feedback && (
                              <span className="text-[10px] italic text-muted-foreground">
                                {(post as any).feedback.rating === "up" ? "★ marked as gold" : (post as any).feedback.rating === "down" ? "✕ flagged off-brand" : "noted"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Auto-Post Tab ──────────────────────────────────────────────── */}
          <TabsContent value="autopost" className="mt-4 space-y-4">

            {/* AI Identity Card */}
            <Card className="border-[#0A66C2]/20 bg-[#0A66C2]/5 dark:bg-[#0A66C2]/10">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-white font-bold text-sm">RA</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">Riki Almouti</p>
                      <Badge className="bg-[#0A66C2] hover:bg-[#0A66C2] text-white text-[10px] px-1.5 py-0">AI Voice Active</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">App Developer & Founder · Urban Culture Hub · urbanculturehub.nl</p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      The AI writes as you — a founder who built a platform connecting sports, culture, and urban lifestyle across the Netherlands. Every post promotes the app, attracts partners, and builds your authority.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["App promotion", "Sponsor pitch", "Investor signal", "Municipality outreach", "Founder story", "Community impact"].map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-[#0A66C2]/10 text-[#0A66C2] dark:text-blue-300 border border-[#0A66C2]/20">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status Banner */}
            <Card className={autoPostEnabled ? "border-green-500/30 bg-green-50 dark:bg-green-900/20" : "border-border"}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${autoPostEnabled ? "bg-green-100 dark:bg-green-900/40" : "bg-muted"}`}>
                      <Zap className={`h-4 w-4 ${autoPostEnabled ? "text-green-600" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{autoPostEnabled ? "Auto-posting is ON" : "Auto-posting is OFF"}</p>
                      <p className="text-xs text-muted-foreground">
                        {autoPostEnabled
                          ? `Posts daily at ${autoPostTime} · ${autoPostTimezone}`
                          : "Enable to post to LinkedIn automatically every day"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    data-testid="switch-autopost-enabled"
                    checked={autoPostEnabled}
                    onCheckedChange={setAutoPostEnabled}
                  />
                </div>
                {/* AI Models banner */}
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Powered by:</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700">
                    ✦ Claude Opus 4.6
                  </span>
                  <span className="text-[10px] text-muted-foreground">content writing</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                    ✦ GPT Image 1
                  </span>
                  <span className="text-[10px] text-muted-foreground">image generation</span>
                </div>
                {autoPostSettings?.lastPostedAt && (
                  <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    Last posted: {format(new Date(autoPostSettings.lastPostedAt), "d MMM yyyy 'at' HH:mm")}
                    {autoPostSettings.postCount > 0 && <span>· {autoPostSettings.postCount} total posts</span>}
                  </div>
                )}
                {autoPostSettings?.nextPostAt && autoPostEnabled && (
                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Next post: {format(new Date(autoPostSettings.nextPostAt), "d MMM yyyy 'at' HH:mm")}
                  </div>
                )}
                {autoPostEnabled && myAutoPostStatus && (
                  <div
                    data-testid="text-autopost-scheduler-status"
                    className={`mt-2 text-xs rounded-md px-2.5 py-1.5 border ${
                      myAutoPostStatus.action === "fired"
                        ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800"
                        : myAutoPostStatus.action === "queued_for_approval"
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                        : myAutoPostStatus.action === "error"
                        ? "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800"
                        : "bg-muted/50 text-muted-foreground border-border/50"
                    }`}
                  >
                    <div className="font-medium">
                      Scheduler: {myAutoPostStatus.action === "fired" ? "Posted" : myAutoPostStatus.action === "queued_for_approval" ? "Awaiting approval" : myAutoPostStatus.action === "error" ? "Error" : "Idle"}
                    </div>
                    <div className="opacity-80">{myAutoPostStatus.reason}</div>
                    <div className="opacity-60 mt-0.5">
                      Last check: {format(new Date(myAutoPostStatus.lastCheckedAt), "d MMM HH:mm")} · Now in your tz: {myAutoPostStatus.nowInTz} · Target: {myAutoPostStatus.targetTime}
                    </div>
                  </div>
                )}
                {autoPostEnabled && !myAutoPostStatus && schedulerStatus && (
                  <div className="mt-2 text-xs text-muted-foreground rounded-md px-2.5 py-1.5 border border-border/50 bg-muted/30">
                    Scheduler is running. Next check in &lt; 60 seconds.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings Form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#0A66C2]" />
                  Schedule & Content Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Timing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-time">Post Time</Label>
                    <Input
                      id="ap-time"
                      data-testid="input-autopost-time"
                      type="time"
                      value={autoPostTime}
                      onChange={e => setAutoPostTime(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">One post per day at this time</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ap-tz">Timezone</Label>
                    <Select value={autoPostTimezone} onValueChange={setAutoPostTimezone}>
                      <SelectTrigger id="ap-tz" data-testid="select-autopost-timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Amsterdam">Amsterdam (CET/CEST)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                        <SelectItem value="Europe/Paris">Paris (CET/CEST)</SelectItem>
                        <SelectItem value="Europe/Berlin">Berlin (CET/CEST)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Target Audience */}
                <div className="space-y-1.5">
                  <Label>Target Audience</Label>
                  <Select value={autoPostTargetAudience} onValueChange={setAutoPostTargetAudience}>
                    <SelectTrigger data-testid="select-autopost-audience">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General LinkedIn audience</SelectItem>
                      <SelectItem value="sponsors">Brand sponsors & marketing directors</SelectItem>
                      <SelectItem value="investors">Investors & startup scouts</SelectItem>
                      <SelectItem value="municipalities">Municipalities & public sector</SelectItem>
                      <SelectItem value="media">Journalists & media partners</SelectItem>
                      <SelectItem value="sports_orgs">Sports federations & venue operators</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">The AI adapts language and angle to speak directly to this audience.</p>
                </div>

                {/* Content Strategy */}
                <div className="space-y-1.5">
                  <Label>Content Strategy</Label>
                  <Select value={autoPostTemplate} onValueChange={setAutoPostTemplate}>
                    <SelectTrigger data-testid="select-autopost-template">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto — rotate all 6 post types (recommended)</SelectItem>
                      <SelectItem value="app_pitch">App Power Pitch</SelectItem>
                      <SelectItem value="sponsor_pitch">Sponsor & Partner Pitch</SelectItem>
                      <SelectItem value="municipality">Municipality & Public Sector</SelectItem>
                      <SelectItem value="founder_story">Founder Story</SelectItem>
                      <SelectItem value="investor_signal">Investor & Growth Signal</SelectItem>
                      <SelectItem value="community_impact">Community & Social Impact</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Auto cycles: App pitch → Sponsor → Municipality → Story → Investor → Community</p>
                </div>

                {/* Language & Tone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Tone</Label>
                    <Select value={autoPostTone} onValueChange={setAutoPostTone}>
                      <SelectTrigger data-testid="select-autopost-tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="engaging">Engaging — draws people in</SelectItem>
                        <SelectItem value="professional">Professional — credible & authoritative</SelectItem>
                        <SelectItem value="sales">Sales — confident founder selling</SelectItem>
                        <SelectItem value="inspiring">Inspiring — visionary & motivating</SelectItem>
                        <SelectItem value="casual">Casual — human & approachable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Language</Label>
                    <Select value={autoPostLanguage} onValueChange={setAutoPostLanguage}>
                      <SelectTrigger data-testid="select-autopost-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="nl">Dutch (Nederlands)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Topics / Focus Keywords */}
                <div className="space-y-2">
                  <Label>Custom Focus Topics</Label>
                  <div className="flex gap-2">
                    <Input
                      data-testid="input-autopost-topic"
                      placeholder="e.g. padel courts, basketball, youth activation..."
                      value={autoPostTopicInput}
                      onChange={e => setAutoPostTopicInput(e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === "Enter" || e.key === ",") && autoPostTopicInput.trim()) {
                          e.preventDefault();
                          if (!autoPostTopics.includes(autoPostTopicInput.trim())) {
                            setAutoPostTopics(prev => [...prev, autoPostTopicInput.trim()]);
                          }
                          setAutoPostTopicInput("");
                        }
                      }}
                    />
                    <Button
                      size="sm" variant="outline"
                      onClick={() => {
                        if (autoPostTopicInput.trim() && !autoPostTopics.includes(autoPostTopicInput.trim())) {
                          setAutoPostTopics(prev => [...prev, autoPostTopicInput.trim()]);
                          setAutoPostTopicInput("");
                        }
                      }}
                    >Add</Button>
                  </div>
                  {/* Preset topic pills */}
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground font-medium">Quick add:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "padel", "basketball", "dance", "fitness", "bouldering",
                        "Amsterdam", "Netherlands", "sports venues", "urban lifestyle",
                        "youth programs", "cultural events", "app features", "booking system",
                        "AI assistant", "venue owners", "sponsorship", "partnership", "municipalities"
                      ].filter(p => !autoPostTopics.includes(p)).map(preset => (
                        <button
                          key={preset}
                          type="button"
                          data-testid={`preset-topic-${preset}`}
                          onClick={() => setAutoPostTopics(prev => [...prev, preset])}
                          className="text-[11px] px-2 py-0.5 rounded border border-dashed border-border hover:border-[#0A66C2] hover:text-[#0A66C2] hover:bg-[#0A66C2]/5 text-muted-foreground transition-colors cursor-pointer"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  {autoPostTopics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {autoPostTopics.map((t, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 cursor-pointer pr-1" onClick={() => setAutoPostTopics(prev => prev.filter((_, idx) => idx !== i))}>
                          {t} <span className="opacity-60 text-xs">✕</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Click presets to add or type your own. Leave empty for full AI variety.</p>
                </div>

                {/* Custom Context */}
                <div className="space-y-1.5">
                  <Label>Additional Context for AI</Label>
                  <textarea
                    data-testid="textarea-autopost-context"
                    value={autoPostCustomContext}
                    onChange={e => setAutoPostCustomContext(e.target.value)}
                    placeholder="e.g. We just launched a new padel feature. We're looking for a sponsor for our summer event series. We reached 1,000 registered venues this week..."
                    rows={3}
                    className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">Add specific news, milestones, or angles you want included. The AI weaves this into the post naturally.</p>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  {/* AI Image — most prominent toggle */}
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${autoPostIncludeImage ? "border-purple-400/40 bg-purple-50 dark:bg-purple-900/20" : "border-border"}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${autoPostIncludeImage ? "bg-purple-100 dark:bg-purple-900/40" : "bg-muted"}`}>
                        <ImageIcon className={`h-4 w-4 ${autoPostIncludeImage ? "text-purple-600" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">Generate AI Image with Each Post</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700">GPT Image 1</span>
                        </div>
                        <p className="text-xs text-muted-foreground">OpenAI GPT Image 1 (newest model) generates a matching image → uploaded to LinkedIn. Adds ~30s per post.</p>
                        {autoPostIncludeImage && (
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5 font-medium">Active — each post will include a custom AI-generated image</p>
                        )}
                      </div>
                    </div>
                    <Switch
                      data-testid="switch-autopost-image"
                      checked={autoPostIncludeImage}
                      onCheckedChange={setAutoPostIncludeImage}
                    />
                  </div>

                  {/* Approval gate — high-trust workflow toggle */}
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${autoPostRequiresApproval ? "border-amber-400/50 bg-amber-50 dark:bg-amber-900/20" : "border-border"}`}>
                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${autoPostRequiresApproval ? "bg-amber-100 dark:bg-amber-900/40" : "bg-muted"}`}>
                        <Eye className={`h-4 w-4 ${autoPostRequiresApproval ? "text-amber-600" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Require my approval before publishing</p>
                        <p className="text-xs text-muted-foreground">
                          {autoPostRequiresApproval
                            ? "Drafts will appear in 'Awaiting Your Approval' on the Post tab. Nothing goes live without your OK."
                            : "OFF — posts publish immediately at the scheduled time."}
                        </p>
                      </div>
                    </div>
                    <Switch
                      data-testid="switch-autopost-requires-approval"
                      checked={autoPostRequiresApproval}
                      onCheckedChange={setAutoPostRequiresApproval}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Include Hashtags</p>
                      <p className="text-xs text-muted-foreground">AI adds 4–5 relevant hashtags</p>
                    </div>
                    <Switch
                      data-testid="switch-autopost-hashtags"
                      checked={autoPostHashtags}
                      onCheckedChange={setAutoPostHashtags}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Include Call-to-Action</p>
                      <p className="text-xs text-muted-foreground">End each post with a link to urbanculturehub.nl</p>
                    </div>
                    <Switch
                      data-testid="switch-autopost-cta"
                      checked={autoPostCta}
                      onCheckedChange={setAutoPostCta}
                    />
                  </div>
                </div>

                {/* Save Button */}
                <Button
                  data-testid="button-autopost-save"
                  className="w-full bg-[#0A66C2] hover:bg-[#0A66C2]/90"
                  onClick={handleSaveAutoPost}
                  disabled={autoPostSaving}
                >
                  {autoPostSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><CheckCircle className="h-4 w-4 mr-2" /> Save Settings</>}
                </Button>
              </CardContent>
            </Card>

            {/* Test / Manual Trigger */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="h-4 w-4 text-[#0A66C2]" />
                  Test Auto-Post Now
                </CardTitle>
                <CardDescription>Generate and publish an AI post to LinkedIn right now using your current settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  data-testid="button-autopost-test"
                  variant="outline"
                  className="w-full border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/5"
                  onClick={handleTestAutoPost}
                  disabled={autoPostTesting}
                >
                  {autoPostTesting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating & posting...</> : <><Zap className="h-4 w-4 mr-2" /> Post to LinkedIn Now</>}
                </Button>
                {autoPostTestResult && (
                  <div className={`rounded-lg border text-sm overflow-hidden ${autoPostTestResult.success ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}`}>
                    {autoPostTestResult.success ? (
                      <>
                        {/* AI Generated Image Preview */}
                        {autoPostTestResult.imageUrl && (
                          <div className="relative w-full bg-muted">
                            <img
                              src={autoPostTestResult.imageUrl}
                              alt="AI generated post image"
                              className="w-full object-cover max-h-64 rounded-t-lg"
                            />
                            <div className="absolute top-2 left-2">
                              <Badge className="bg-purple-600 text-white text-[10px] flex items-center gap-1">
                                <ImageIcon className="h-2.5 w-2.5" /> DALL-E 3
                              </Badge>
                            </div>
                          </div>
                        )}
                        <div className="p-3 bg-green-50 dark:bg-green-900/20">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-green-800 dark:text-green-200 flex items-center gap-1.5">
                              <CheckCircle className="h-4 w-4" /> Posted successfully!
                            </p>
                            {autoPostTestResult.postType && (
                              <Badge variant="secondary" className="text-xs capitalize">
                                {autoPostTestResult.postType.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs whitespace-pre-wrap text-green-900 dark:text-green-100 leading-relaxed">{autoPostTestResult.content}</p>
                        </div>
                      </>
                    ) : (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20">
                        <p className="text-red-700 dark:text-red-300 flex items-center gap-1.5"><XCircle className="h-4 w-4" /> {autoPostTestResult.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Last Post Preview */}
            {autoPostSettings?.lastPostContent && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Last Auto-Post
                    {autoPostSettings.lastPostedAt && (
                      <span className="text-xs text-muted-foreground font-normal ml-auto">{format(new Date(autoPostSettings.lastPostedAt), "d MMM yyyy HH:mm")}</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm whitespace-pre-wrap">{autoPostSettings.lastPostContent}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── AI BRAIN Tab — train the agent on your voice ─────────────── */}
          <TabsContent value="brain" className="mt-4 space-y-4">
            {/* ── PLATFORM FACTS — what the AI knows about your live platform ── */}
            <Card className="border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/60 to-cyan-50/60 dark:from-emerald-950/30 dark:to-cyan-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-emerald-600" />
                  Live Platform Facts (auto-refreshed)
                </CardTitle>
                <CardDescription className="text-xs">
                  These exact numbers are injected into every AI prompt. The AI is instructed to <strong>never invent stats</strong> — it can only use what's listed here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!platformFacts ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading live facts…</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(platformFacts.stats || []).map((s: any) => (
                      <div key={s.label} className="rounded-lg bg-background border border-emerald-100 dark:border-emerald-900 p-2.5" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, '-')}`}>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{s.value}</p>
                        {s.detail && <p className="text-[10px] text-muted-foreground truncate">{s.detail}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {platformFacts?.lastUpdated && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Updated {format(new Date(platformFacts.lastUpdated), "d MMM HH:mm")} · cached 10 min
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── FEATURE GRAPH — what the AI knows about every platform feature ── */}
            {platformFacts?.features?.length > 0 && (
              <Card className="border-cyan-200 dark:border-cyan-900/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Network className="h-4 w-4 text-cyan-600" />
                    Platform Feature Graph the AI Knows ({platformFacts.features.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Every feature below is in the AI's prompt — including how it works, who uses it, and which other features it connects to. The AI rotates through these so posts cover different angles instead of repeating the same topic.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1" data-testid="list-feature-graph">
                    {platformFacts.features.map((feat: any) => (
                      <div
                        key={feat.id}
                        className="rounded-lg border border-cyan-100 dark:border-cyan-900 bg-background p-2.5"
                        data-testid={`feature-${feat.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-xs font-bold text-cyan-700 dark:text-cyan-400">{feat.name}</p>
                          <Badge variant="secondary" className="text-[9px] shrink-0">
                            {feat.anglesCount} angles
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-snug mb-1.5">{feat.description}</p>
                        {feat.whoUsesIt?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            <span className="font-medium">Used by:</span> {feat.whoUsesIt.join(", ")}
                          </p>
                        )}
                        {feat.connectsTo?.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            <span className="font-medium">Connects to:</span> {feat.connectsTo.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {platformFacts?.recents && (platformFacts.recents.events?.length > 0 || platformFacts.recents.venues?.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-cyan-100 dark:border-cyan-900 space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Live material the AI can mention</p>
                      {platformFacts.recents.events?.length > 0 && (
                        <p className="text-[11px]" data-testid="text-recent-events">
                          <span className="font-semibold">Upcoming events:</span>{" "}
                          <span className="text-muted-foreground">{platformFacts.recents.events.map((e: string) => `"${e}"`).join(", ")}</span>
                        </p>
                      )}
                      {platformFacts.recents.venues?.length > 0 && (
                        <p className="text-[11px]" data-testid="text-recent-venues">
                          <span className="font-semibold">Recent venues:</span>{" "}
                          <span className="text-muted-foreground">{platformFacts.recents.venues.map((v: string) => `"${v}"`).join(", ")}</span>
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Header strip */}
            <Card className="border-violet-200 dark:border-violet-900/50 bg-gradient-to-r from-violet-50 via-pink-50 to-violet-50 dark:from-violet-950/40 dark:via-pink-950/30 dark:to-violet-950/40">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 p-2.5 shrink-0">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold mb-1">AI Brain — train your LinkedIn ghostwriter</h3>
                    <p className="text-xs text-muted-foreground">
                      Everything you save here gets injected into <strong>every</strong> AI prompt — your daily auto-post, the AI Writer, and Agent Mode. The more you teach it, the more it sounds like you.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-3 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Sparkles className="h-3 w-3 text-violet-600" /> Brain version <strong className="text-foreground">v{brandIntel?.version ?? 0}</strong></span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><BookmarkPlus className="h-3 w-3 text-green-600" /> <strong className="text-foreground">{examples.filter(e => e.kind === "gold").length}</strong> gold examples</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><ShieldAlert className="h-3 w-3 text-red-600" /> <strong className="text-foreground">{examples.filter(e => e.kind === "avoid").length}</strong> avoid examples</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground"><Pencil className="h-3 w-3 text-blue-600" /> <strong className="text-foreground">{examples.filter(e => e.kind === "edited").length}</strong> edits</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Brand Story */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-violet-600" /> Brand Story</CardTitle>
                <CardDescription className="text-xs">Who you are, what you're building, why it matters. The AI uses this as the highest-priority context.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={brandStory}
                  onChange={(e) => setBrandStory(e.target.value)}
                  placeholder={`Example: I'm Riki Almouti, founder of Urban Culture Hub. We're building the first true infrastructure platform for urban sports, dance, and street culture in the Netherlands. After 10 years organizing battles like Back to the Street and TurboVision, I'm now obsessed with one question: how do we get municipalities, brands, and venues to take this culture seriously and fund it like they fund traditional sports?`}
                  rows={6}
                  className="text-sm font-mono leading-relaxed"
                  data-testid="textarea-brand-story"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">{brandStory.length}/4000</span>
                </div>
              </CardContent>
            </Card>

            {/* Voice Rules + Do Not Say */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-green-200 dark:border-green-900/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Heart className="h-4 w-4 text-green-600" /> Voice Rules</CardTitle>
                  <CardDescription className="text-xs">Short rules the AI must obey every post.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChipList items={voiceRules} onChange={setVoiceRules} placeholder='e.g. "always include one concrete number"' dataTestId="chip-voice-rules" color="green" />
                </CardContent>
              </Card>
              <Card className="border-red-200 dark:border-red-900/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-600" /> Do Not Say</CardTitle>
                  <CardDescription className="text-xs">Hard NO list — words, phrases, vibes the AI must avoid.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChipList items={doNotSay} onChange={setDoNotSay} placeholder='e.g. "leverage", "synergy", "humble brag"' dataTestId="chip-donot-say" color="red" />
                </CardContent>
              </Card>
            </div>

            {/* Topics + Signature Phrases */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Heart className="h-4 w-4 text-pink-600" /> Topics We Lean Into</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ChipList items={topicsLove} onChange={setTopicsLove} placeholder='e.g. "founder grind", "Dutch municipality"' dataTestId="chip-topics-love" color="violet" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><XIcon className="h-4 w-4 text-orange-600" /> Topics We Avoid</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChipList items={topicsAvoid} onChange={setTopicsAvoid} placeholder='e.g. "graffiti", "politics"' dataTestId="chip-topics-avoid" color="red" />
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-yellow-600" /> Signature Phrases</CardTitle>
                  <CardDescription className="text-xs">Lines you actually say. AI may sprinkle these in naturally.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChipList items={signaturePhrases} onChange={setSignaturePhrases} placeholder='e.g. "real builders, real culture"' dataTestId="chip-signature" color="blue" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Hash className="h-4 w-4 text-blue-600" /> Preferred Hashtags</CardTitle>
                  <CardDescription className="text-xs">Bank of hashtags the AI will rotate from.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChipList items={preferredHashtags} onChange={setPreferredHashtags} placeholder="#UrbanCulture, #Bboy, #Amsterdam" dataTestId="chip-hashtags" color="blue" />
                </CardContent>
              </Card>
            </div>

            {/* Audience notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-violet-600" /> Audience Notes</CardTitle>
                <CardDescription className="text-xs">Who's reading? What do they care about? What turns them off?</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={audienceNotes}
                  onChange={(e) => setAudienceNotes(e.target.value)}
                  placeholder="e.g. Mostly Dutch municipality program managers, sports fund decision makers, brand activation leads at Nike/Red Bull. They like data, real outcomes, and proof of community impact. They tune out from anything that sounds like an agency pitch."
                  rows={4}
                  className="text-sm"
                  data-testid="textarea-audience-notes"
                />
              </CardContent>
            </Card>

            {/* Save bar */}
            <div className="flex items-center justify-end gap-2 sticky bottom-0 z-10 py-3 bg-background/95 backdrop-blur border-t border-border/40">
              <span className="text-xs text-muted-foreground">Changes apply to the next post the AI writes.</span>
              <Button
                onClick={() => saveBrandIntel.mutate()}
                disabled={saveBrandIntel.isPending}
                className="bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 text-white font-bold"
                data-testid="btn-save-brand-intel"
              >
                {saveBrandIntel.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Brain
              </Button>
            </div>

            {/* Examples library */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><BookmarkPlus className="h-4 w-4 text-violet-600" /> Example Library</CardTitle>
                <CardDescription className="text-xs">
                  Paste posts you love (gold) or want the AI to <strong>never</strong> write like (avoid). The AI uses these as live training examples.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add new example */}
                <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    {(["gold", "edited", "avoid"] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setNewExample(s => ({ ...s, kind: k }))}
                        data-testid={`btn-example-kind-${k}`}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-all ${
                          newExample.kind === k
                            ? k === "gold" ? "bg-green-600 border-green-600 text-white"
                              : k === "avoid" ? "bg-red-600 border-red-600 text-white"
                              : "bg-blue-600 border-blue-600 text-white"
                            : "border-border text-muted-foreground hover:border-violet-400"
                        }`}
                      >
                        {k === "gold" ? "★ Gold" : k === "avoid" ? "✕ Avoid" : "✎ Edited"}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Paste the example post here…"
                    rows={4}
                    value={newExample.content}
                    onChange={(e) => setNewExample(s => ({ ...s, content: e.target.value }))}
                    className="text-xs"
                    data-testid="textarea-new-example"
                  />
                  <Input
                    placeholder='Why? (optional, e.g. "perfect founder voice — direct, real numbers")'
                    value={newExample.reason}
                    onChange={(e) => setNewExample(s => ({ ...s, reason: e.target.value }))}
                    className="text-xs"
                    data-testid="input-example-reason"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => addExample.mutate({ content: newExample.content, kind: newExample.kind, reason: newExample.reason })}
                      disabled={!newExample.content.trim() || addExample.isPending}
                      data-testid="btn-add-example"
                    >
                      <ListPlus className="h-3.5 w-3.5 mr-1" />
                      Add to library
                    </Button>
                  </div>
                </div>

                {/* List */}
                {examples.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground py-4 italic">No examples yet — add a few golden posts to see the AI quality jump immediately.</p>
                ) : (
                  <div className="space-y-2">
                    {examples.map((ex) => (
                      <div
                        key={ex.id}
                        data-testid={`example-${ex.id}`}
                        className={`rounded-lg border p-3 text-xs ${
                          ex.kind === "gold" ? "border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20"
                            : ex.kind === "avoid" ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20"
                            : "border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 capitalize ${
                            ex.kind === "gold" ? "text-green-700 dark:text-green-300 border-green-400"
                              : ex.kind === "avoid" ? "text-red-700 dark:text-red-300 border-red-400"
                              : "text-blue-700 dark:text-blue-300 border-blue-400"
                          }`}>
                            {ex.kind === "gold" ? "★ Gold" : ex.kind === "avoid" ? "✕ Avoid" : "✎ Edited"}
                          </Badge>
                          <div className="flex items-center gap-2">
                            {ex.usageCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">used {ex.usageCount}×</span>
                            )}
                            <button
                              onClick={() => removeExample.mutate(ex.id)}
                              className="text-muted-foreground hover:text-red-600"
                              data-testid={`btn-remove-example-${ex.id}`}
                              title="Remove from library"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {ex.reason && <p className="text-[11px] italic text-muted-foreground mb-1">{ex.reason}</p>}
                        <p className="line-clamp-3 leading-relaxed">{ex.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent Mode panel */}
            <Card className="border-violet-200 dark:border-violet-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-violet-600" /> Agent Mode (preview)</CardTitle>
                <CardDescription className="text-xs">
                  When you turn on Agent Mode in the AI Writer, the AI runs a full loop: research → plan → draft 3 distinct variants → critique → recommend the winner. It uses everything in this Brain.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${agentMode ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground"}`}>
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Agent Mode</p>
                      <p className="text-[11px] text-muted-foreground">{agentMode ? "ON — AI Writer will return 3 variants + critique" : "OFF — single-shot generation"}</p>
                    </div>
                  </div>
                  <Switch checked={agentMode} onCheckedChange={setAgentMode} data-testid="switch-agent-mode" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Profile Builder & Enhancer Tab (full all-sections) ───────────── */}
          <TabsContent value="profile-builder" className="mt-4 space-y-4">

            {/* Helper: section card with mic + enhance */}
            {(() => {
              function SecCard({ id, label, charLimit, rows = 3, isInput = false, sec, setSec, micKey }: {
                id: string; label: string; charLimit?: number; rows?: number; isInput?: boolean;
                sec: any; setSec: any; micKey: string;
              }) {
                return (
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">{label}</Label>
                      <div className="flex items-center gap-1.5">
                        {charLimit && <span className="text-[11px] font-mono text-muted-foreground">{sec.content.length}/{charLimit}</span>}
                        <button
                          data-testid={`mic-${id}`}
                          onClick={() => {
                            const base = sec.content;
                            startMic(micKey, (t: string) => setSec((p: any) => ({ ...p, content: (base + " " + t).trimStart() })));
                          }}
                          title={activeMic === micKey ? "Stop recording" : "Speak to fill"}
                          className={["p-1.5 rounded-lg border transition-all", activeMic === micKey ? "bg-red-50 border-red-300 text-red-600 dark:bg-red-900/30" : "border-border text-muted-foreground hover:text-foreground"].join(" ")}
                        >
                          {activeMic === micKey ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        </button>
                        <div className="flex items-center rounded-lg border border-[#0A66C2]/30 overflow-hidden">
                          <button
                            data-testid={`polish-${id}`}
                            disabled={sec.enhancing}
                            onClick={() => enhanceSection(id.replace(/-/g, "_"), label, sec.content, setSec, true)}
                            title="Polish: keep your content, only fix grammar & phrasing"
                            className="flex items-center gap-1 px-2 py-1 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50 transition-all border-r border-[#0A66C2]/20"
                          >
                            {sec.enhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
                            Polish
                          </button>
                          <button
                            data-testid={`rewrite-${id}`}
                            disabled={sec.enhancing}
                            onClick={() => enhanceSection(id.replace(/-/g, "_"), label, sec.content, setSec, false)}
                            title="Rewrite: Claude rewrites from scratch with full LinkedIn optimization"
                            className="flex items-center gap-1 px-2 py-1 text-[#0A66C2] text-xs font-medium hover:bg-[#0A66C2]/5 disabled:opacity-50 transition-all"
                          >
                            {sec.enhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Rewrite
                          </button>
                        </div>
                      </div>
                    </div>
                    {isInput
                      ? <Input data-testid={`input-${id}`} value={sec.content} onChange={e => setSec((p: any) => ({ ...p, content: e.target.value }))} placeholder={`Your ${label.toLowerCase()}, or leave blank to generate…`} className="text-sm" />
                      : <Textarea data-testid={`textarea-${id}`} value={sec.content} onChange={e => setSec((p: any) => ({ ...p, content: e.target.value }))} placeholder={`Your ${label.toLowerCase()}, or leave blank to generate…`} rows={rows} className="text-sm resize-none" />
                    }
                    {sec.enhanced && (
                      <div className="rounded-xl border border-[#0A66C2]/25 bg-[#0A66C2]/4 divide-y divide-[#0A66C2]/10 overflow-hidden">
                        {/* Corrections */}
                        {sec.corrections?.length > 0 && (
                          <div className="p-3 space-y-1.5">
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
                              <span>⚠</span> What Claude fixed
                            </p>
                            <ul className="space-y-1">
                              {sec.corrections.map((c: string, i: number) => (
                                <li key={i} className="text-[12px] text-amber-800 dark:text-amber-300 flex gap-1.5 leading-snug">
                                  <span className="mt-0.5 shrink-0">•</span><span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Enhanced text */}
                        <div className="p-3 space-y-2">
                          <p className="text-[10px] font-bold text-[#0A66C2] uppercase tracking-widest">Optimized version</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{sec.enhanced}</p>
                          <div className="flex flex-wrap gap-3 pt-1">
                            <button onClick={() => { navigator.clipboard.writeText(sec.enhanced); setSec((p: any) => ({ ...p, copied: true })); setTimeout(() => setSec((p: any) => ({ ...p, copied: false })), 1500); }} className="text-xs text-[#0A66C2] flex items-center gap-1 hover:underline font-medium">
                              {sec.copied ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy
                            </button>
                            <button onClick={() => setSec((p: any) => ({ ...p, content: p.enhanced, enhanced: "", corrections: [], explanation: "", alternatives: [], tips: [] }))} className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-foreground flex items-center gap-1 hover:underline font-medium">
                              <ArrowRight className="h-3 w-3" /> Use this
                            </button>
                            <button onClick={() => setSec((p: any) => ({ ...p, enhanced: "", corrections: [], explanation: "", alternatives: [], tips: [] }))} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 hover:underline ml-auto">
                              Dismiss
                            </button>
                          </div>
                        </div>
                        {/* Explanation */}
                        {sec.explanation && (
                          <div className="px-3 py-2.5 bg-[#0A66C2]/3">
                            <p className="text-[10px] font-bold text-[#0A66C2] uppercase tracking-widest mb-1">Why these changes</p>
                            <p className="text-[12px] text-muted-foreground leading-snug">{sec.explanation}</p>
                          </div>
                        )}
                        {/* Alternatives */}
                        {sec.alternatives?.length > 0 && (
                          <div className="p-3 space-y-2">
                            <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Alternative angles</p>
                            {sec.alternatives.map((alt: string, i: number) => (
                              <div key={i} className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-2.5 space-y-1.5">
                                <p className="text-[12px] leading-snug">{alt}</p>
                                <div className="flex gap-3">
                                  <button onClick={() => { navigator.clipboard.writeText(alt); }} className="text-[11px] text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline">
                                    <CopyIcon className="h-3 w-3" /> Copy
                                  </button>
                                  <button onClick={() => setSec((p: any) => ({ ...p, content: alt, enhanced: "", corrections: [], explanation: "", alternatives: [], tips: [] }))} className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline">
                                    <ArrowRight className="h-3 w-3" /> Use this
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Tips */}
                        {sec.tips?.length > 0 && (
                          <div className="px-3 py-2.5 bg-emerald-50/60 dark:bg-emerald-950/20">
                            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1.5">LinkedIn tips for this section</p>
                            <ul className="space-y-1">
                              {sec.tips.map((tip: string, i: number) => (
                                <li key={i} className="text-[12px] text-emerald-800 dark:text-emerald-300 flex gap-1.5 leading-snug">
                                  <span className="mt-0.5 shrink-0">✓</span><span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-4">

                  {/* ── AI Brain Panel ────────────────────────────────────── */}
                  <Card className="border-violet-200 dark:border-violet-800/50">
                    <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setPbBrainOpen(o => !o)}>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                          AI Profile Brain
                          <Badge variant="outline" className="ml-1 text-[11px] border-violet-400 text-violet-600 dark:text-violet-400">New</Badge>
                          {pbBrainMessages.length > 0 && (
                            <span className="text-[11px] text-muted-foreground font-normal">· {pbBrainMessages.length} messages</span>
                          )}
                        </CardTitle>
                        <button className="p-1 rounded hover:bg-muted transition-colors">
                          {pbBrainOpen
                            ? <XIcon className="h-4 w-4 text-muted-foreground" />
                            : <MessageSquare className="h-4 w-4 text-violet-500" />
                          }
                        </button>
                      </div>
                      {!pbBrainOpen && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Talk to Claude about your career — it listens, transcribes, and fills your entire profile when you're ready.
                        </p>
                      )}
                    </CardHeader>

                    {pbBrainOpen && (
                      <CardContent className="pt-0 space-y-3">
                        {/* Chat messages */}
                        <div
                          ref={pbBrainScrollRef}
                          className="h-64 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-3 space-y-3"
                        >
                          {pbBrainMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-4">
                              <Brain className="h-8 w-8 text-violet-400 opacity-50" />
                              <p className="text-sm text-muted-foreground max-w-xs">
                                Tell me about your career, experience, and what you do. I'll ask follow-up questions and fill your entire LinkedIn profile when you're ready.
                              </p>
                              <p className="text-[11px] text-muted-foreground opacity-70">Speak with the mic or type below</p>
                            </div>
                          ) : (
                            pbBrainMessages.map((msg, i) => (
                              <div key={i} className={["flex gap-2", msg.role === "user" ? "justify-end" : "justify-start"].join(" ")}>
                                {msg.role === "assistant" && (
                                  <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
                                    <Brain className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                                  </div>
                                )}
                                <div className={["rounded-2xl px-3 py-2 text-sm max-w-[85%] leading-snug", msg.role === "user" ? "bg-[#0A66C2] text-white rounded-tr-sm" : "bg-white dark:bg-card border border-border/60 rounded-tl-sm"].join(" ")}>
                                  {msg.content}
                                </div>
                                {msg.role === "user" && (
                                  <div className="h-6 w-6 rounded-full bg-[#0A66C2]/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-[10px] font-bold text-[#0A66C2]">Me</span>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                          {pbBrainLoading && (
                            <div className="flex gap-2 justify-start">
                              <div className="h-6 w-6 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                                <Brain className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                              </div>
                              <div className="rounded-2xl rounded-tl-sm px-3 py-2 bg-white dark:bg-card border border-border/60">
                                <div className="flex gap-1 items-center h-4">
                                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Input row */}
                        <div className="flex gap-2">
                          <button
                            data-testid="button-brain-mic"
                            onClick={() => {
                              const base = pbBrainInput;
                              startMic("pb-brain", (t: string) => setPbBrainInput((base + " " + t).trimStart()));
                            }}
                            title={activeMic === "pb-brain" ? "Stop recording" : "Speak — transcribes in real-time"}
                            className={["p-2 rounded-xl border transition-all shrink-0", activeMic === "pb-brain" ? "bg-red-50 border-red-300 text-red-600 dark:bg-red-900/30 animate-pulse" : "border-border text-muted-foreground hover:text-violet-600 hover:border-violet-300"].join(" ")}
                          >
                            {activeMic === "pb-brain" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                          </button>
                          <input
                            data-testid="input-brain-message"
                            value={pbBrainInput}
                            onChange={e => setPbBrainInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendBrainMessage(); } }}
                            placeholder={activeMic === "pb-brain" ? "Listening… speak now" : "Type or speak about your career…"}
                            className="flex-1 px-3 py-2 rounded-xl border border-border/60 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 placeholder:text-muted-foreground/60"
                          />
                          <button
                            data-testid="button-brain-send"
                            disabled={!pbBrainInput.trim() || pbBrainLoading}
                            onClick={() => sendBrainMessage()}
                            className="p-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-all shrink-0"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Apply + clear row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            data-testid="button-brain-apply"
                            disabled={pbBrainMessages.length === 0 || pbBrainApplying}
                            onClick={applyBrainToProfile}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-[#0A66C2] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-all shadow-sm"
                          >
                            {pbBrainApplying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                            {pbBrainApplying ? "Applying to profile…" : "Apply to profile"}
                          </button>
                          {pbBrainMessages.length > 0 && (
                            <>
                              <button
                                data-testid="button-brain-export-career"
                                onClick={() => {
                                  try {
                                    localStorage.setItem("pb_brain_export", JSON.stringify({ messages: pbBrainMessages, timestamp: Date.now() }));
                                    toast({ title: "Exported to Career Suite!", description: "Go to Career Suite → CVs tab → LinkedIn Brain Import to generate your CV." });
                                  } catch { toast({ title: "Export failed", variant: "destructive" }); }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/50 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/10 transition-all"
                              >
                                <Briefcase className="h-3.5 w-3.5" />
                                Export to Career Suite
                              </button>
                              <button
                                onClick={() => { setPbBrainMessages([]); setPbBrainInput(""); }}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Clear conversation
                              </button>
                            </>
                          )}
                          <p className="text-[11px] text-muted-foreground ml-auto opacity-70">
                            Claude extracts your profile info from the conversation
                          </p>
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  {/* Context Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-[#0A66C2]" />
                        Full Profile Builder
                        <Badge variant="outline" className="ml-2 text-[11px] border-violet-400 text-violet-600 dark:text-violet-400">Powered by Claude</Badge>
                      </CardTitle>
                      <CardDescription>
                        Fill in every LinkedIn section — speak or type. Hit <strong>Polish</strong> to keep your voice and fix only grammar/phrasing, or <strong>Rewrite</strong> for a full Claude optimization. Click <strong>Auto-fill from system</strong> to let Claude generate everything.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Action buttons row */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          data-testid="button-pb-autofill"
                          disabled={pbAutoFilling}
                          onClick={async () => {
                            setPbAutoFilling(true);
                            try {
                              const r = await apiRequest("/api/admin/linkedin/profile-autofill", "POST", { language: pbLanguage });
                              const data = await r.json();
                              if (data.error) throw new Error(data.error);
                              if (data.role) setPbRole(data.role);
                              if (data.industry) setPbIndustry(data.industry);
                              if (data.audience) setPbAudience(data.audience);
                              if (data.goals) setPbGoals(data.goals);
                              if (data.headline) setPbHeadline(p => ({ ...p, content: data.headline }));
                              if (data.about) setPbAbout(p => ({ ...p, content: data.about }));
                              if (data.skills) setPbSkills(p => ({ ...p, content: data.skills }));
                              if (data.mission) setPbMission(p => ({ ...p, content: data.mission }));
                              if (data.openTo) setPbOpenTo(p => ({ ...p, content: data.openTo }));
                              if (data.services) setPbServices(p => ({ ...p, content: data.services }));
                              if (data.causes) setPbCauses(p => ({ ...p, content: data.causes }));
                              toast({ title: "Profile auto-filled!", description: "Claude filled your profile based on system knowledge. Review and adjust anything." });
                            } catch (e: any) {
                              toast({ title: "Auto-fill failed", description: e.message, variant: "destructive" });
                            } finally {
                              setPbAutoFilling(false);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-[#0A66C2] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
                        >
                          {pbAutoFilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {pbAutoFilling ? "Claude is thinking…" : "Auto-fill from system knowledge"}
                        </button>
                        <button
                          data-testid="button-pb-context-enhance"
                          disabled={pbContextEnhancing}
                          onClick={async () => {
                            setPbContextEnhancing(true);
                            setPbContextEnhanced(null);
                            try {
                              const r = await apiRequest("/api/admin/linkedin/context-enhance", "POST", { name: pbName, role: pbRole, industry: pbIndustry, audience: pbAudience, goals: pbGoals, language: pbLanguage });
                              const data = await r.json();
                              if (data.error) throw new Error(data.error);
                              setPbContextEnhanced({ role: data.role || "", industry: data.industry || "", audience: data.audience || "", goals: data.goals || "" });
                            } catch (e: any) {
                              toast({ title: "Enhancement failed", description: e.message, variant: "destructive" });
                            } finally {
                              setPbContextEnhancing(false);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0A66C2]/40 text-[#0A66C2] text-xs font-semibold hover:bg-[#0A66C2]/5 disabled:opacity-50 transition-all"
                        >
                          {pbContextEnhancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          {pbContextEnhancing ? "Enhancing…" : "Enhance context with Claude"}
                        </button>
                      </div>

                      {/* Fields grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Full Name</Label>
                          <Input data-testid="input-pb-name" value={pbName} onChange={e => setPbName(e.target.value)} placeholder="e.g. Riki Almouti" className="text-sm" />
                        </div>
                        {(["role","industry","audience","goals"] as const).map(field => {
                          const vals = { role: pbRole, industry: pbIndustry, audience: pbAudience, goals: pbGoals };
                          const setters = { role: setPbRole, industry: setPbIndustry, audience: setPbAudience, goals: setPbGoals };
                          const labels = { role: "Current Role", industry: "Industry", audience: "Target Audience", goals: "Goals" };
                          const placeholders = { role: "e.g. Founder & CEO", industry: "e.g. Urban culture, events", audience: "e.g. Municipalities, sponsors", goals: "e.g. Attract sponsors, build authority" };
                          const micKey = `pb-ctx-${field}`;
                          return (
                            <div key={field} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">{labels[field]}</Label>
                                <button
                                  data-testid={`mic-ctx-${field}`}
                                  onClick={() => { const base = vals[field]; startMic(micKey, t => setters[field]((base + " " + t).trimStart())); }}
                                  title={activeMic === micKey ? "Stop recording" : "Speak to fill"}
                                  className={["p-1 rounded border transition-all", activeMic === micKey ? "bg-red-50 border-red-300 text-red-600 dark:bg-red-900/30" : "border-border text-muted-foreground hover:text-foreground"].join(" ")}
                                >
                                  {activeMic === micKey ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                                </button>
                              </div>
                              <Input
                                data-testid={`input-pb-${field}`}
                                value={vals[field]}
                                onChange={e => setters[field](e.target.value)}
                                placeholder={placeholders[field]}
                                className="text-sm"
                              />
                            </div>
                          );
                        })}
                        <div className="space-y-1">
                          <Label className="text-xs">Language</Label>
                          <Select value={pbLanguage} onValueChange={setPbLanguage}>
                            <SelectTrigger data-testid="select-pb-language" className="text-sm h-9"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="nl">Dutch (NL)</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Claude-enhanced context suggestions */}
                      {pbContextEnhanced && (
                        <div className="rounded-xl border border-[#0A66C2]/30 bg-[#0A66C2]/5 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-[#0A66C2] uppercase tracking-wide flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Claude suggestions — click any to apply</p>
                            <button onClick={() => setPbContextEnhanced(null)} className="text-muted-foreground hover:text-foreground"><XIcon className="h-3.5 w-3.5" /></button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {(["role","industry","audience","goals"] as const).filter(k => pbContextEnhanced[k]).map(k => {
                              const setters = { role: setPbRole, industry: setPbIndustry, audience: setPbAudience, goals: setPbGoals };
                              const labels = { role: "Current Role", industry: "Industry", audience: "Target Audience", goals: "Goals" };
                              return (
                                <div key={k} className="rounded-lg border border-[#0A66C2]/20 bg-card p-2.5 space-y-1 cursor-pointer hover:border-[#0A66C2]/50 transition-all" onClick={() => { setters[k](pbContextEnhanced[k]); setPbContextEnhanced(p => p ? ({ ...p, [k]: "" }) : null); }}>
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{labels[k]}</p>
                                  <p className="text-xs leading-snug">{pbContextEnhanced[k]}</p>
                                  <p className="text-[10px] text-[#0A66C2] font-medium">Click to apply →</p>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => {
                              if (pbContextEnhanced.role) setPbRole(pbContextEnhanced.role);
                              if (pbContextEnhanced.industry) setPbIndustry(pbContextEnhanced.industry);
                              if (pbContextEnhanced.audience) setPbAudience(pbContextEnhanced.audience);
                              if (pbContextEnhanced.goals) setPbGoals(pbContextEnhanced.goals);
                              setPbContextEnhanced(null);
                            }}
                            className="text-xs text-[#0A66C2] font-semibold hover:underline flex items-center gap-1"
                          >
                            <CheckCheck className="h-3.5 w-3.5" /> Apply all suggestions
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* ── HEADLINE ── */}
                  <SecCard id="headline" label="Headline" charLimit={220} isInput rows={1} sec={pbHeadline} setSec={setPbHeadline} micKey="pb-headline" />

                  {/* ── ABOUT / BIO ── */}
                  <SecCard id="about" label="About / Bio" charLimit={2600} rows={6} sec={pbAbout} setSec={setPbAbout} micKey="pb-about" />

                  {/* ── EXPERIENCE ── */}
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Work Experience</Label>
                      <Button size="sm" variant="outline" data-testid="button-pb-add-exp" className="text-xs h-7" onClick={() => setPbExperiences(p => [...p, { title: "", company: "", duration: "", location: "", description: "", enhanced: "", enhancing: false, copied: false }])}>
                        <ListPlus className="h-3 w-3 mr-1" /> Add Role
                      </Button>
                    </div>
                    {pbExperiences.map((exp, i) => (
                      <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">Role {i + 1}</span>
                          {pbExperiences.length > 1 && <button data-testid={`button-pb-remove-exp-${i}`} onClick={() => setPbExperiences(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 opacity-60 hover:opacity-100"><XIcon className="h-3.5 w-3.5" /></button>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input data-testid={`input-pb-exp-title-${i}`} value={exp.title} onChange={e => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} placeholder="Job title" className="text-sm" />
                          <Input data-testid={`input-pb-exp-company-${i}`} value={exp.company} onChange={e => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, company: e.target.value } : x))} placeholder="Company / org" className="text-sm" />
                          <Input data-testid={`input-pb-exp-duration-${i}`} value={exp.duration} onChange={e => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, duration: e.target.value } : x))} placeholder="e.g. Jan 2020 – Present" className="text-sm" />
                          <Input data-testid={`input-pb-exp-location-${i}`} value={exp.location} onChange={e => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, location: e.target.value } : x))} placeholder="Location (city, remote)" className="text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Description / achievements</Label>
                            <div className="flex gap-1.5">
                              <button data-testid={`mic-pb-exp-${i}`} onClick={() => { const base = exp.description; startMic(`pb-exp-${i}`, t => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, description: (base + " " + t).trimStart() } : x))); }} className={["p-1.5 rounded-lg border transition-all", activeMic === `pb-exp-${i}` ? "bg-red-50 border-red-300 text-red-600" : "border-border text-muted-foreground hover:text-foreground"].join(" ")}>
                                {activeMic === `pb-exp-${i}` ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                              </button>
                              <div className="flex items-center rounded-lg border border-[#0A66C2]/30 overflow-hidden">
                                <button data-testid={`polish-pb-exp-${i}`} disabled={exp.enhancing} onClick={() => enhanceExpSection(i, "experience_description", `Experience at ${exp.company || "company"}`, exp.description || `${exp.title} at ${exp.company}`, true)} title="Polish: keep your content, fix grammar/phrasing only" className="flex items-center gap-1 px-2 py-1 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50 border-r border-[#0A66C2]/20">
                                  {exp.enhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
                                  Polish
                                </button>
                                <button data-testid={`rewrite-pb-exp-${i}`} disabled={exp.enhancing} onClick={() => enhanceExpSection(i, "experience_description", `Experience at ${exp.company || "company"}`, exp.description || `${exp.title} at ${exp.company}`, false)} title="Rewrite: full Claude optimization" className="flex items-center gap-1 px-2 py-1 text-[#0A66C2] text-xs font-medium hover:bg-[#0A66C2]/5 disabled:opacity-50">
                                  {exp.enhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                  Rewrite
                                </button>
                              </div>
                            </div>
                          </div>
                          <Textarea data-testid={`textarea-pb-exp-desc-${i}`} value={exp.description} onChange={e => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Speak or type: what you did, key achievements, impact — even rough notes work" rows={3} className="text-sm resize-none" />
                          {exp.enhanced && (
                            <div className="rounded-xl border border-[#0A66C2]/25 bg-[#0A66C2]/4 divide-y divide-[#0A66C2]/10 overflow-hidden">
                              {exp.corrections?.length > 0 && (
                                <div className="p-2.5 space-y-1.5">
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">⚠ What Claude fixed</p>
                                  <ul className="space-y-1">{exp.corrections.map((c: string, ci: number) => <li key={ci} className="text-[12px] text-amber-800 dark:text-amber-300 flex gap-1.5 leading-snug"><span className="mt-0.5 shrink-0">•</span><span>{c}</span></li>)}</ul>
                                </div>
                              )}
                              <div className="p-2.5 space-y-1.5">
                                <p className="text-[10px] font-bold text-[#0A66C2] uppercase tracking-widest">Optimized version</p>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{exp.enhanced}</p>
                                <div className="flex flex-wrap gap-3 pt-1">
                                  <button onClick={() => { navigator.clipboard.writeText(exp.enhanced); setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, copied: true } : x)); setTimeout(() => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, copied: false } : x)), 1500); }} className="text-xs text-[#0A66C2] flex items-center gap-1 hover:underline font-medium">
                                    {exp.copied ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy
                                  </button>
                                  <button onClick={() => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, description: x.enhanced, enhanced: "", corrections: [], explanation: "", alternatives: [], tips: [] } : x))} className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline font-medium"><ArrowRight className="h-3 w-3" /> Use this</button>
                                  <button onClick={() => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, enhanced: "", corrections: [], explanation: "", alternatives: [], tips: [] } : x))} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 hover:underline ml-auto">Dismiss</button>
                                </div>
                              </div>
                              {exp.explanation && <div className="px-2.5 py-2 bg-[#0A66C2]/3"><p className="text-[10px] font-bold text-[#0A66C2] uppercase tracking-widest mb-1">Why these changes</p><p className="text-[12px] text-muted-foreground leading-snug">{exp.explanation}</p></div>}
                              {exp.alternatives?.length > 0 && (
                                <div className="p-2.5 space-y-2">
                                  <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Alternative angles</p>
                                  {exp.alternatives.map((alt: string, ai: number) => (
                                    <div key={ai} className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-2 space-y-1.5">
                                      <p className="text-[12px] leading-snug">{alt}</p>
                                      <div className="flex gap-3">
                                        <button onClick={() => navigator.clipboard.writeText(alt)} className="text-[11px] text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline"><CopyIcon className="h-3 w-3" /> Copy</button>
                                        <button onClick={() => setPbExperiences(p => p.map((x, idx) => idx === i ? { ...x, description: alt, enhanced: "", corrections: [], explanation: "", alternatives: [], tips: [] } : x))} className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"><ArrowRight className="h-3 w-3" /> Use this</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {exp.tips?.length > 0 && (
                                <div className="px-2.5 py-2 bg-emerald-50/60 dark:bg-emerald-950/20">
                                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1.5">LinkedIn tips</p>
                                  <ul className="space-y-1">{exp.tips.map((tip: string, ti: number) => <li key={ti} className="text-[12px] text-emerald-800 dark:text-emerald-300 flex gap-1.5 leading-snug"><span className="mt-0.5 shrink-0">✓</span><span>{tip}</span></li>)}</ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── EDUCATION ── */}
                  <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Education</Label>
                      <Button size="sm" variant="outline" data-testid="button-pb-add-edu" className="text-xs h-7" onClick={() => setPbEducation(p => [...p, { degree: "", field: "", institution: "", dates: "", description: "", enhanced: "", enhancing: false, copied: false }])}>
                        <ListPlus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {pbEducation.map((edu, i) => (
                      <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">Entry {i + 1}</span>
                          {pbEducation.length > 1 && <button data-testid={`button-pb-remove-edu-${i}`} onClick={() => setPbEducation(p => p.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 opacity-60 hover:opacity-100"><XIcon className="h-3.5 w-3.5" /></button>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input data-testid={`input-pb-edu-degree-${i}`} value={edu.degree} onChange={e => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, degree: e.target.value } : x))} placeholder="Degree (e.g. Bachelor's)" className="text-sm" />
                          <Input data-testid={`input-pb-edu-field-${i}`} value={edu.field} onChange={e => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, field: e.target.value } : x))} placeholder="Field of study" className="text-sm" />
                          <Input data-testid={`input-pb-edu-inst-${i}`} value={edu.institution} onChange={e => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, institution: e.target.value } : x))} placeholder="School / university" className="text-sm" />
                          <Input data-testid={`input-pb-edu-dates-${i}`} value={edu.dates} onChange={e => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, dates: e.target.value } : x))} placeholder="Dates e.g. 2015–2019" className="text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Description</Label>
                            <div className="flex gap-1.5">
                              <button data-testid={`mic-pb-edu-${i}`} onClick={() => { const base = edu.description; startMic(`pb-edu-${i}`, t => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, description: (base + " " + t).trimStart() } : x))); }} className={["p-1.5 rounded-lg border transition-all", activeMic === `pb-edu-${i}` ? "bg-red-50 border-red-300 text-red-600" : "border-border text-muted-foreground hover:text-foreground"].join(" ")}>
                                {activeMic === `pb-edu-${i}` ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                              </button>
                              <div className="flex items-center rounded-lg border border-[#0A66C2]/30 overflow-hidden">
                                <button data-testid={`polish-pb-edu-${i}`} disabled={edu.enhancing} onClick={() => enhanceEduSection(i, edu.description || `${edu.degree} ${edu.field} at ${edu.institution}`, true)} title="Polish: keep your content, fix grammar/phrasing only" className="flex items-center gap-1 px-2 py-1 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50 border-r border-[#0A66C2]/20">
                                  {edu.enhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
                                  Polish
                                </button>
                                <button data-testid={`rewrite-pb-edu-${i}`} disabled={edu.enhancing} onClick={() => enhanceEduSection(i, edu.description || `${edu.degree} ${edu.field} at ${edu.institution}`, false)} title="Rewrite: full Claude optimization" className="flex items-center gap-1 px-2 py-1 text-[#0A66C2] text-xs font-medium hover:bg-[#0A66C2]/5 disabled:opacity-50">
                                  {edu.enhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                  Rewrite
                                </button>
                              </div>
                            </div>
                          </div>
                          <Textarea data-testid={`textarea-pb-edu-desc-${i}`} value={edu.description} onChange={e => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} placeholder="Relevant coursework, achievements, extracurriculars…" rows={2} className="text-sm resize-none" />
                          {edu.enhanced && (
                            <div className="rounded-xl border border-[#0A66C2]/25 bg-[#0A66C2]/4 divide-y divide-[#0A66C2]/10 overflow-hidden">
                              {edu.corrections?.length > 0 && (
                                <div className="p-2.5 space-y-1.5">
                                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">⚠ What Claude fixed</p>
                                  <ul className="space-y-1">{edu.corrections.map((c: string, ci: number) => <li key={ci} className="text-[12px] text-amber-800 dark:text-amber-300 flex gap-1.5 leading-snug"><span className="mt-0.5 shrink-0">•</span><span>{c}</span></li>)}</ul>
                                </div>
                              )}
                              <div className="p-2.5 space-y-1.5">
                                <p className="text-[10px] font-bold text-[#0A66C2] uppercase tracking-widest">Optimized version</p>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{edu.enhanced}</p>
                                <div className="flex flex-wrap gap-3 pt-1">
                                  <button onClick={() => { navigator.clipboard.writeText(edu.enhanced); setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, copied: true } : x)); setTimeout(() => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, copied: false } : x)), 1500); }} className="text-xs text-[#0A66C2] flex items-center gap-1 hover:underline font-medium">
                                    {edu.copied ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy
                                  </button>
                                  <button onClick={() => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, description: x.enhanced, enhanced: "", corrections: [], explanation: "", alternatives: [], tips: [] } : x))} className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline font-medium"><ArrowRight className="h-3 w-3" /> Use this</button>
                                  <button onClick={() => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, enhanced: "", corrections: [], explanation: "", alternatives: [], tips: [] } : x))} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 hover:underline ml-auto">Dismiss</button>
                                </div>
                              </div>
                              {edu.explanation && <div className="px-2.5 py-2 bg-[#0A66C2]/3"><p className="text-[10px] font-bold text-[#0A66C2] uppercase tracking-widest mb-1">Why these changes</p><p className="text-[12px] text-muted-foreground leading-snug">{edu.explanation}</p></div>}
                              {edu.alternatives?.length > 0 && (
                                <div className="p-2.5 space-y-2">
                                  <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest">Alternative angles</p>
                                  {edu.alternatives.map((alt: string, ai: number) => (
                                    <div key={ai} className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-2 space-y-1.5">
                                      <p className="text-[12px] leading-snug">{alt}</p>
                                      <div className="flex gap-3">
                                        <button onClick={() => navigator.clipboard.writeText(alt)} className="text-[11px] text-violet-600 dark:text-violet-400 flex items-center gap-1 hover:underline"><CopyIcon className="h-3 w-3" /> Copy</button>
                                        <button onClick={() => setPbEducation(p => p.map((x, idx) => idx === i ? { ...x, description: alt, enhanced: "", corrections: [], explanation: "", alternatives: [], tips: [] } : x))} className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline"><ArrowRight className="h-3 w-3" /> Use this</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {edu.tips?.length > 0 && (
                                <div className="px-2.5 py-2 bg-emerald-50/60 dark:bg-emerald-950/20">
                                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1.5">LinkedIn tips</p>
                                  <ul className="space-y-1">{edu.tips.map((tip: string, ti: number) => <li key={ti} className="text-[12px] text-emerald-800 dark:text-emerald-300 flex gap-1.5 leading-snug"><span className="mt-0.5 shrink-0">✓</span><span>{tip}</span></li>)}</ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* ── SKILLS ── */}
                  <SecCard id="skills" label="Skills (comma-separated)" rows={2} sec={pbSkills} setSec={setPbSkills} micKey="pb-skills" />

                  {/* ── CERTIFICATIONS ── */}
                  <SecCard id="certifications" label="Certifications" rows={3} sec={pbCerts} setSec={setPbCerts} micKey="pb-certs" />

                  {/* ── VOLUNTEER ── */}
                  <SecCard id="volunteer" label="Volunteer Experience" rows={3} sec={pbVolunteer} setSec={setPbVolunteer} micKey="pb-volunteer" />

                  {/* ── PROJECTS ── */}
                  <SecCard id="projects" label="Projects" rows={3} sec={pbProjects} setSec={setPbProjects} micKey="pb-projects" />

                  {/* ── PUBLICATIONS ── */}
                  <SecCard id="publications" label="Publications" rows={3} sec={pbPublications} setSec={setPbPublications} micKey="pb-publications" />

                  {/* ── HONORS ── */}
                  <SecCard id="honors" label="Honors & Awards" rows={2} sec={pbHonors} setSec={setPbHonors} micKey="pb-honors" />

                  {/* ── LANGUAGES ── */}
                  <SecCard id="languages" label="Languages" isInput rows={1} sec={pbLangs} setSec={setPbLangs} micKey="pb-langs" />

                  {/* ── CONTACT INFO ── */}
                  <SecCard id="contact_info" label="Contact Info (phone, website, address)" isInput rows={1} sec={pbContactInfo} setSec={setPbContactInfo} micKey="pb-contact" />

                  {/* ── FEATURED SECTION ── */}
                  <SecCard id="featured" label="Featured Section" rows={2} sec={pbFeatured} setSec={setPbFeatured} micKey="pb-featured" />

                  {/* ── CREATOR TOPICS ── */}
                  <SecCard id="creator_topics" label="Creator Mode Topics (hashtags)" isInput rows={1} sec={pbCreatorTopics} setSec={setPbCreatorTopics} micKey="pb-topics" />

                  {/* ── RECOMMENDATIONS ── */}
                  <SecCard id="recommendations" label="Recommendation Request Template" rows={3} sec={pbRecommendations} setSec={setPbRecommendations} micKey="pb-recs" />

                  {/* ── PERSONAL MISSION STATEMENT ── */}
                  <SecCard id="mission" label="Personal Mission Statement" rows={2} sec={pbMission} setSec={setPbMission} micKey="pb-mission" />

                  {/* ── OPEN TO ── */}
                  <SecCard id="open_to" label="Open To (speaking, partnerships, investments…)" rows={2} sec={pbOpenTo} setSec={setPbOpenTo} micKey="pb-open-to" />

                  {/* ── SERVICES OFFERED ── */}
                  <SecCard id="services" label="Services Offered" rows={3} sec={pbServices} setSec={setPbServices} micKey="pb-services" />

                  {/* ── CAUSES & INTERESTS ── */}
                  <SecCard id="causes" label="Causes & Interests" rows={2} sec={pbCauses} setSec={setPbCauses} micKey="pb-causes" />

                  {/* ── BUILD ALL BUTTON ── */}
                  <Button
                    data-testid="button-pb-build-all"
                    size="lg"
                    disabled={pbBuildLoading}
                    onClick={async () => {
                      setPbBuildLoading(true);
                      setPbBuildResult(null);
                      try {
                        const r = await apiRequest("/api/admin/linkedin/profile-build", "POST", {
                          name: pbName, role: pbRole, industry: pbIndustry, targetAudience: pbAudience,
                          goals: pbGoals, language: pbLanguage,
                          headline: pbHeadline.content, about: pbAbout.content,
                          experiences: pbExperiences.filter(e => e.title || e.company || e.description),
                          education: pbEducation.filter(e => e.degree || e.institution),
                          skills: pbSkills.content,
                          certifications: pbCerts.content,
                          volunteer: pbVolunteer.content,
                          projects: pbProjects.content,
                          publications: pbPublications.content,
                          honors: pbHonors.content,
                          languages: pbLangs.content,
                          contactInfo: pbContactInfo.content,
                          featured: pbFeatured.content,
                          creatorTopics: pbCreatorTopics.content,
                          mission: pbMission.content,
                          openTo: pbOpenTo.content,
                          services: pbServices.content,
                          causes: pbCauses.content,
                        });
                        const data = await r.json();
                        if (data.error) throw new Error(data.error);
                        setPbBuildResult(data);
                      } catch (e: any) {
                        toast({ title: "Build failed", description: e.message, variant: "destructive" });
                      } finally {
                        setPbBuildLoading(false);
                      }
                    }}
                    className="w-full bg-gradient-to-r from-[#0A66C2] to-cyan-600 hover:from-[#004182] hover:to-cyan-700 text-white text-base py-6"
                  >
                    {pbBuildLoading
                      ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Claude is building your complete profile…</>
                      : <><Wand2 className="h-5 w-5 mr-2" />Build Complete LinkedIn Profile with Claude</>}
                  </Button>

                  {/* ── FULL PROFILE RESULT ── */}
                  {pbBuildResult && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Your Complete LinkedIn Profile
                        </CardTitle>
                        <CardDescription>Click any section to copy it directly into LinkedIn</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Headline */}
                        {pbBuildResult.headline && (
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Headline</span>
                              <span className="text-[11px] font-mono text-muted-foreground">{pbBuildResult.headline.length}/220</span>
                            </div>
                            <p className="text-sm font-semibold">{pbBuildResult.headline}</p>
                            <button onClick={() => { navigator.clipboard.writeText(pbBuildResult.headline); setPbBuildCopied("headline"); setTimeout(() => setPbBuildCopied(null), 1500); }} className="flex items-center gap-1 text-xs text-[#0A66C2] hover:underline">
                              {pbBuildCopied === "headline" ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy
                            </button>
                          </div>
                        )}
                        {/* About */}
                        {pbBuildResult.about && (
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">About / Bio</span>
                              <span className="text-[11px] font-mono text-muted-foreground">{pbBuildResult.about.length}/2600</span>
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{pbBuildResult.about}</p>
                            <button onClick={() => { navigator.clipboard.writeText(pbBuildResult.about); setPbBuildCopied("about"); setTimeout(() => setPbBuildCopied(null), 1500); }} className="flex items-center gap-1 text-xs text-[#0A66C2] hover:underline">
                              {pbBuildCopied === "about" ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy
                            </button>
                          </div>
                        )}
                        {/* Experiences */}
                        {pbBuildResult.experiences?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Experience Sections</p>
                            {pbBuildResult.experiences.map((exp: any, i: number) => (
                              <div key={i} className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
                                <div className="flex justify-between items-start">
                                  <div><p className="text-sm font-semibold">{exp.title}</p>{exp.company && <p className="text-xs text-muted-foreground">{exp.company}</p>}</div>
                                  <button onClick={() => { navigator.clipboard.writeText(`${exp.title}\n${exp.company || ""}\n\n${exp.description}`); setPbBuildCopied(`exp-${i}`); setTimeout(() => setPbBuildCopied(null), 1500); }} className="text-xs text-[#0A66C2] flex items-center gap-1 hover:underline shrink-0">
                                    {pbBuildCopied === `exp-${i}` ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy
                                  </button>
                                </div>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{exp.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Education */}
                        {pbBuildResult.education?.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Education</p>
                            {pbBuildResult.education.map((edu: any, i: number) => (
                              <div key={i} className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
                                <div className="flex justify-between">
                                  <div><p className="text-sm font-semibold">{edu.degree}</p>{edu.institution && <p className="text-xs text-muted-foreground">{edu.institution}</p>}</div>
                                  <button onClick={() => { navigator.clipboard.writeText(`${edu.degree}\n${edu.institution || ""}\n\n${edu.description || ""}`); setPbBuildCopied(`edu-${i}`); setTimeout(() => setPbBuildCopied(null), 1500); }} className="text-xs text-[#0A66C2] flex items-center gap-1 hover:underline shrink-0">
                                    {pbBuildCopied === `edu-${i}` ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy
                                  </button>
                                </div>
                                {edu.description && <p className="text-sm text-foreground/80 leading-relaxed">{edu.description}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Skills */}
                        {pbBuildResult.skills && (
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Skills</p>
                            {pbBuildResult.skills.featured?.length > 0 && <div><p className="text-[11px] font-semibold text-[#0A66C2] mb-1.5">Featured (top 3)</p><div className="flex flex-wrap gap-1.5">{pbBuildResult.skills.featured.map((s: string, i: number) => <span key={i} className="px-2.5 py-1 rounded-full bg-[#0A66C2] text-white text-xs font-medium">{s}</span>)}</div></div>}
                            {pbBuildResult.skills.core?.length > 0 && <div><p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Core skills</p><div className="flex flex-wrap gap-1.5">{pbBuildResult.skills.core.map((s: string, i: number) => <span key={i} className="px-2 py-0.5 rounded-full border border-border text-xs">{s}</span>)}</div></div>}
                            <button onClick={() => { const all = [...(pbBuildResult.skills.featured || []), ...(pbBuildResult.skills.top3 || []), ...(pbBuildResult.skills.core || [])]; navigator.clipboard.writeText(all.join(", ")); setPbBuildCopied("skills"); setTimeout(() => setPbBuildCopied(null), 1500); }} className="text-xs text-[#0A66C2] flex items-center gap-1 hover:underline">
                              {pbBuildCopied === "skills" ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy all skills
                            </button>
                          </div>
                        )}
                        {/* Other text sections */}
                        {[
                          { key: "certifications", label: "Certifications" },
                          { key: "volunteer", label: "Volunteer Experience" },
                          { key: "projects", label: "Projects" },
                          { key: "publications", label: "Publications" },
                          { key: "honors", label: "Honors & Awards" },
                          { key: "recommendationRequest", label: "Recommendation Request Template" },
                        ].map(({ key, label }) => pbBuildResult[key] ? (
                          <div key={key} className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{pbBuildResult[key]}</p>
                            <button onClick={() => { navigator.clipboard.writeText(pbBuildResult[key]); setPbBuildCopied(key); setTimeout(() => setPbBuildCopied(null), 1500); }} className="text-xs text-[#0A66C2] flex items-center gap-1 hover:underline">
                              {pbBuildCopied === key ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy
                            </button>
                          </div>
                        ) : null)}
                        {/* Languages */}
                        {pbBuildResult.languages?.length > 0 && (
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Languages</p>
                            <div className="flex flex-wrap gap-2">{pbBuildResult.languages.map((l: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{l}</Badge>)}</div>
                          </div>
                        )}
                        {/* Creator Topics */}
                        {pbBuildResult.creatorTopics?.length > 0 && (
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Creator Mode Topics</p>
                            <div className="flex flex-wrap gap-2">{pbBuildResult.creatorTopics.map((t: string, i: number) => <span key={i} className="px-2.5 py-1 rounded-full bg-muted border border-border text-xs font-mono text-[#0A66C2]">{t}</span>)}</div>
                            <button onClick={() => { navigator.clipboard.writeText(pbBuildResult.creatorTopics.join(", ")); setPbBuildCopied("topics"); setTimeout(() => setPbBuildCopied(null), 1500); }} className="text-xs text-[#0A66C2] flex items-center gap-1 hover:underline">
                              {pbBuildCopied === "topics" ? <CheckCheck className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />} Copy
                            </button>
                          </div>
                        )}
                        {/* Custom URL + CTA */}
                        {(pbBuildResult.customUrl || pbBuildResult.callToAction) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {pbBuildResult.customUrl && <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1"><p className="text-xs font-bold text-muted-foreground uppercase">Custom URL</p><p className="text-sm font-mono">linkedin.com/in/{pbBuildResult.customUrl}</p></div>}
                            {pbBuildResult.callToAction && <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1"><p className="text-xs font-bold text-muted-foreground uppercase">Call to Action</p><p className="text-sm">{pbBuildResult.callToAction}</p></div>}
                          </div>
                        )}
                        {/* Featured Items */}
                        {pbBuildResult.featuredItems?.length > 0 && (
                          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Featured Section Ideas</p>
                            {pbBuildResult.featuredItems.map((item: any, i: number) => (
                              <div key={i} className="flex items-start gap-2 py-1"><Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{item.type}</Badge><div><p className="text-xs font-medium">{item.suggestion}</p>{item.caption && <p className="text-xs text-muted-foreground italic">{item.caption}</p>}</div></div>
                            ))}
                          </div>
                        )}
                        {/* Profile Strength Tips */}
                        {pbBuildResult.profileStrengthTips?.length > 0 && (
                          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-green-800 dark:text-green-200">Profile Strength Quick Wins</p>
                            {pbBuildResult.profileStrengthTips.map((tip: string, i: number) => (
                              <p key={i} className="text-xs text-green-700 dark:text-green-300 flex items-start gap-1.5"><CheckCircle className="h-3 w-3 mt-0.5 shrink-0" />{tip}</p>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* ── ORPHAN REMOVED ── keep this comment as anchor */}

          {/* ── Connection Message Generator Tab ──────────────────────────────── */}
          <TabsContent value="connection-messages" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#0A66C2]" />
                  Connection Message Generator
                </CardTitle>
                <CardDescription>
                  Fill in the details of the person you want to connect with. AI will generate 3 personalised connection request messages under 300 characters (LinkedIn limit).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cm-name">Name</Label>
                    <Input id="cm-name" data-testid="input-cm-name" placeholder="e.g. Jan de Vries" value={cmName} onChange={e => setCmName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cm-role">Role / Title</Label>
                    <Input id="cm-role" data-testid="input-cm-role" placeholder="e.g. Events Manager" value={cmRole} onChange={e => setCmRole(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cm-org">Organization</Label>
                    <Input id="cm-org" data-testid="input-cm-org" placeholder="e.g. Municipality of Amsterdam" value={cmOrg} onChange={e => setCmOrg(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cm-industry">Industry</Label>
                    <Input id="cm-industry" data-testid="input-cm-industry" placeholder="e.g. Cultural sector" value={cmIndustry} onChange={e => setCmIndustry(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cm-city">City</Label>
                    <Input id="cm-city" data-testid="input-cm-city" placeholder="e.g. Rotterdam" value={cmCity} onChange={e => setCmCity(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cm-purpose">Purpose</Label>
                    <Input id="cm-purpose" data-testid="input-cm-purpose" placeholder="e.g. Explore sponsorship opportunities" value={cmPurpose} onChange={e => setCmPurpose(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Tone</Label>
                    <Select value={cmTone} onValueChange={setCmTone}>
                      <SelectTrigger data-testid="select-cm-tone"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warm">Warm &amp; Direct</SelectItem>
                        <SelectItem value="formal">Formal &amp; Professional</SelectItem>
                        <SelectItem value="casual">Casual &amp; Friendly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Language</Label>
                    <Select value={cmLanguage} onValueChange={setCmLanguage}>
                      <SelectTrigger data-testid="select-cm-language"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="nl">Dutch (NL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  data-testid="button-cm-generate"
                  disabled={cmLoading || (!cmName && !cmOrg)}
                  onClick={async () => {
                    setCmLoading(true);
                    setCmMessages([]);
                    try {
                      const r = await apiRequest("/api/admin/linkedin/connection-message", "POST", {
                        name: cmName, role: cmRole, organization: cmOrg, industry: cmIndustry, city: cmCity, purpose: cmPurpose, tone: cmTone, language: cmLanguage,
                      });
                      const data = await r.json();
                      if (data.error) throw new Error(data.error);
                      setCmMessages(data.messages || []);
                    } catch (e: any) {
                      toast({ title: "Error", description: e.message, variant: "destructive" });
                    } finally {
                      setCmLoading(false);
                    }
                  }}
                  className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                >
                  {cmLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Generate Messages
                </Button>

                {cmMessages.length > 0 && (
                  <div className="space-y-3 pt-2">
                    {cmMessages.map((msg, i) => (
                      <div key={i} className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-[11px]">{msg.label}</Badge>
                          <span className={`text-[11px] font-mono ${msg.text.length > 300 ? "text-red-500" : "text-muted-foreground"}`}>{msg.text.length}/300</span>
                        </div>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-cm-copy-${i}`}
                          onClick={() => {
                            navigator.clipboard.writeText(msg.text);
                            setCmCopied(String(i));
                            setTimeout(() => setCmCopied(null), 2000);
                          }}
                          className="text-xs h-7"
                        >
                          {cmCopied === String(i) ? <CheckCheck className="h-3 w-3 mr-1.5 text-green-600" /> : <CopyIcon className="h-3 w-3 mr-1.5" />}
                          {cmCopied === String(i) ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Hashtag Intelligence Tab ───────────────────────────────────────── */}
          <TabsContent value="hashtags" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4 text-[#0A66C2]" />
                  Hashtag Intelligence
                </CardTitle>
                <CardDescription>
                  Enter a topic and AI will research the best LinkedIn hashtags with reach estimates — primary, secondary, and niche tiers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ht-topic">Topic / Post theme</Label>
                    <Input id="ht-topic" data-testid="input-ht-topic" placeholder="e.g. breakdance competition Amsterdam" value={htTopic} onChange={e => setHtTopic(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ht-audience">Target Audience</Label>
                    <Input id="ht-audience" data-testid="input-ht-audience" placeholder="e.g. sponsors, municipalities" value={htAudience} onChange={e => setHtAudience(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Language</Label>
                    <Select value={htLanguage} onValueChange={setHtLanguage}>
                      <SelectTrigger data-testid="select-ht-language"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="nl">Dutch (NL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  data-testid="button-ht-research"
                  disabled={htLoading || !htTopic}
                  onClick={async () => {
                    setHtLoading(true);
                    setHtResult(null);
                    try {
                      const r = await apiRequest("/api/admin/linkedin/hashtag-research", "POST", { topic: htTopic, audience: htAudience, language: htLanguage });
                      const data = await r.json();
                      if (data.error) throw new Error(data.error);
                      setHtResult(data);
                    } catch (e: any) {
                      toast({ title: "Error", description: e.message, variant: "destructive" });
                    } finally {
                      setHtLoading(false);
                    }
                  }}
                  className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                >
                  {htLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Hash className="h-4 w-4 mr-2" />}
                  Research Hashtags
                </Button>

                {htResult && (
                  <div className="space-y-4 pt-2">
                    {[
                      { key: "primary", label: "Primary (high reach)", color: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" },
                      { key: "secondary", label: "Secondary (mid reach)", color: "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300" },
                      { key: "niche", label: "Niche (tight community)", color: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" },
                    ].map(({ key, label, color }) => (
                      htResult[key]?.length > 0 && (
                        <div key={key} className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                          <div className="space-y-1.5">
                            {htResult[key].map((h: any, i: number) => (
                              <div key={i} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${color}`}>
                                <span className="font-mono font-semibold text-sm shrink-0">{h.tag}</span>
                                <span className="text-xs opacity-75 shrink-0">~{h.followers}</span>
                                <span className="text-xs opacity-80 flex-1">{h.why}</span>
                                <button
                                  data-testid={`button-ht-copy-${key}-${i}`}
                                  onClick={() => { navigator.clipboard.writeText(h.tag); setHtCopied(`${key}-${i}`); setTimeout(() => setHtCopied(null), 1500); }}
                                  className="opacity-60 hover:opacity-100 shrink-0"
                                >
                                  {htCopied === `${key}-${i}` ? <CheckCheck className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}

                    {htResult.combinations?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommended Combinations</p>
                        {htResult.combinations.map((combo: string, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                            <p className="text-xs font-mono text-foreground/80 flex-1">{combo}</p>
                            <button
                              data-testid={`button-ht-copy-combo-${i}`}
                              onClick={() => { navigator.clipboard.writeText(combo); setHtCopied(`combo-${i}`); setTimeout(() => setHtCopied(null), 1500); }}
                              className="opacity-60 hover:opacity-100 shrink-0"
                            >
                              {htCopied === `combo-${i}` ? <CheckCheck className="h-3.5 w-3.5 text-green-600" /> : <CopyIcon className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {htResult.tips?.length > 0 && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Strategy Tips</p>
                        {htResult.tips.map((tip: string, i: number) => (
                          <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{tip}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Content Planner Tab ────────────────────────────────────────────── */}
          <TabsContent value="content-planner" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#0A66C2]" />
                  Content Planner
                </CardTitle>
                <CardDescription>
                  AI generates a full multi-week LinkedIn content calendar tailored to your brand, recent posts, and current priorities.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Weeks to Plan</Label>
                    <Select value={String(cpWeeks)} onValueChange={v => setCpWeeks(Number(v))}>
                      <SelectTrigger data-testid="select-cp-weeks"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 week</SelectItem>
                        <SelectItem value="2">2 weeks</SelectItem>
                        <SelectItem value="4">4 weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Posts per Week</Label>
                    <Select value={String(cpPostsPerWeek)} onValueChange={v => setCpPostsPerWeek(Number(v))}>
                      <SelectTrigger data-testid="select-cp-posts-per-week"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 posts/week</SelectItem>
                        <SelectItem value="5">5 posts/week</SelectItem>
                        <SelectItem value="7">7 posts/week (daily)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cp-focus">Current Focus / Priorities (optional)</Label>
                    <Textarea
                      id="cp-focus"
                      data-testid="textarea-cp-focus"
                      placeholder="e.g. Upcoming event launch in June, partnership with Rotterdam municipality, growing community to 500 members..."
                      value={cpFocus}
                      onChange={e => setCpFocus(e.target.value)}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Language</Label>
                    <Select value={cpLanguage} onValueChange={setCpLanguage}>
                      <SelectTrigger data-testid="select-cp-language"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="nl">Dutch (NL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  data-testid="button-cp-generate"
                  disabled={cpLoading}
                  onClick={async () => {
                    setCpLoading(true);
                    setCpResult(null);
                    try {
                      const r = await apiRequest("/api/admin/linkedin/content-planner", "POST", { weeks: cpWeeks, focus: cpFocus, language: cpLanguage, postsPerWeek: cpPostsPerWeek });
                      const data = await r.json();
                      if (data.error) throw new Error(data.error);
                      setCpResult(data);
                    } catch (e: any) {
                      toast({ title: "Error", description: e.message, variant: "destructive" });
                    } finally {
                      setCpLoading(false);
                    }
                  }}
                  className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                >
                  {cpLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating plan…</> : <><CalendarDays className="h-4 w-4 mr-2" />Generate Content Plan</>}
                </Button>

                {cpResult && (
                  <div className="space-y-5 pt-2">
                    {cpResult.strategy && (
                      <div className="rounded-xl bg-[#0A66C2]/5 border border-[#0A66C2]/20 p-3">
                        <p className="text-xs font-semibold text-[#0A66C2] mb-1">Strategy Overview</p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{cpResult.strategy}</p>
                        {cpResult.bestDays?.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">Best days: {cpResult.bestDays.join(" → ")}</p>
                        )}
                      </div>
                    )}

                    {cpResult.weeks?.map((week: any) => (
                      <div key={week.week} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">Week {week.week}</span>
                          {week.theme && <Badge variant="secondary" className="text-[11px]">{week.theme}</Badge>}
                        </div>
                        <div className="space-y-2">
                          {week.posts?.map((post: any, pi: number) => (
                            <div key={pi} className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-muted-foreground w-24 shrink-0">{post.day}</span>
                                <Badge variant="outline" className="text-[10px] h-4 capitalize">{post.type?.replace(/-/g, " ")}</Badge>
                                {post.contentPillar && (
                                  <Badge variant="secondary" className="text-[10px] h-4 capitalize">{post.contentPillar}</Badge>
                                )}
                                {post.estimatedEngagement && (
                                  <span className={`text-[10px] font-medium ${post.estimatedEngagement === "high" ? "text-green-600" : post.estimatedEngagement === "medium" ? "text-amber-600" : "text-muted-foreground"}`}>
                                    {post.estimatedEngagement} eng.
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-semibold leading-tight">{post.hook}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{post.angle}</p>
                              {post.hashtags?.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {post.hashtags.map((tag: string, ti: number) => (
                                    <span key={ti} className="text-[10px] text-[#0A66C2] font-mono">{tag}</span>
                                  ))}
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                data-testid={`button-cp-use-hook-${week.week}-${pi}`}
                                className="text-xs h-6 px-2 mt-1"
                                onClick={() => {
                                  setPostContent(post.hook + "\n\n" + (post.angle || ""));
                                  toast({ title: "Hook copied to Post editor", description: "Switch to 'Post Content' tab to continue." });
                                }}
                              >
                                <ArrowRight className="h-3 w-3 mr-1" /> Use in Post Editor
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      )}

      {/* Setup instructions when not configured */}
      {!status?.configured && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How to Set Up LinkedIn</CardTitle>
          </CardHeader>
          <CardContent>
            <SetupSteps />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] h-5 px-1.5 border-0">
        <CheckCircle className="h-2.5 w-2.5 mr-1" />
        Published
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] h-5 px-1.5 border-0">
        <XCircle className="h-2.5 w-2.5 mr-1" />
        Failed
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] h-5 px-1.5 border-0">
      <Clock className="h-2.5 w-2.5 mr-1" />
      Draft
    </Badge>
  );
}

function SetupInstructions() {
  return (
    <a
      href="https://www.linkedin.com/developers/apps/new"
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0"
    >
      <Button variant="outline" size="sm" data-testid="button-linkedin-setup">
        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
        Create App
      </Button>
    </a>
  );
}

function SetupSteps() {
  return (
    <ol className="space-y-3 text-sm">
      {[
        {
          step: 1,
          title: "Create a LinkedIn App",
          desc: "Go to linkedin.com/developers and create a new app. Use 'Urban Culture Hub' as the app name.",
          link: { label: "Open LinkedIn Developers", href: "https://www.linkedin.com/developers/apps/new" },
        },
        {
          step: 2,
          title: "Add the redirect URI",
          desc: (
            <>
              In your app settings → Auth → OAuth 2.0 settings, add this redirect URL:{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                https://urbanculturehub.nl/api/linkedin/callback
              </code>
            </>
          ),
        },
        {
          step: 3,
          title: "Request the right products",
          desc: 'Under Products, request access to "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect".',
        },
        {
          step: 4,
          title: "Add secrets to the app",
          desc: (
            <>
              Copy your <strong>Client ID</strong> and <strong>Client Secret</strong> from the Auth tab, then add them as{" "}
              <code className="bg-muted px-1 rounded text-xs">LINKEDIN_CLIENT_ID</code> and{" "}
              <code className="bg-muted px-1 rounded text-xs">LINKEDIN_CLIENT_SECRET</code> in your Replit Secrets.
            </>
          ),
        },
        {
          step: 5,
          title: "Connect your account",
          desc: "Refresh this page and click the Connect LinkedIn button above.",
        },
      ].map(({ step, title, desc, link }) => (
        <li key={step} className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-[#0A66C2] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {step}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">{title}</p>
            <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{desc}</p>
            {link && (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#0A66C2] hover:underline mt-1 font-medium"
              >
                <ExternalLink className="h-3 w-3" />
                {link.label}
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
