import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import DOMPurify from 'dompurify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Megaphone, Send, Users, Mail, Target, Clock, CheckCircle, XCircle,
  Loader2, Plus, Eye, Trash2, Edit3, Copy, Sparkles, RefreshCw,
  BarChart3, Calendar, AlertTriangle, ChevronRight, TrendingUp,
  Instagram, Linkedin, Globe, QrCode, Link2, Share2, ArrowLeft,
  Bot, Zap, Rocket, ExternalLink, Check, Smartphone, Monitor,
  Download, ChevronDown,
} from 'lucide-react';
import { SiInstagram, SiWhatsapp, SiTiktok } from 'react-icons/si';
import { FaLinkedin } from "react-icons/fa";

const APP_URL = 'https://urbanculturehub.nl';
const IOS_URL = 'https://apps.apple.com/nl/app/urban-culture-hub/id6743952291?l=en-GB';
const APP_NAME = 'Urban Culture Hub';

type Campaign = {
  id: number;
  name: string;
  subject: string;
  content: string;
  targetAudience: string;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  openCount: number;
  clickCount: number;
  createdAt: string;
  imageUrl?: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
  sent:      { label: 'Sent',      color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'All Users', artists: 'Artists', enthusiasts: 'Enthusiasts',
  active: 'Active (30d)', inactive: 'Inactive (30d+)', new: 'New (7d)', verified: 'Verified',
};

const TEMPLATES = [
  { id: 'welcome', category: 'Onboarding', name: 'Welcome to the Culture', subject: 'Welkom bij Urban Culture Connect!', content: `<h2>Welkom bij de beweging! 🎤</h2>\n<p>Je bent net onderdeel geworden van de meest levendige urban culture community online.</p>\n<ul>\n<li>Ontdek lokale spots en evenementen bij jou in de buurt</li>\n<li>Verbind met artiesten, dansers en creators</li>\n<li>Laat je talent zien en bouw je profiel op</li>\n</ul>\n<p><strong>Stay connected, stay creative.</strong></p>`, audience: 'all' },
  { id: 'battle', category: 'Events', name: 'Battle Announcement', subject: 'Nieuw Battle Alert - Mis dit niet! 🔥', content: `<h2>Er komt een nieuw battle aan!</h2>\n<p>Maak je klaar om te witnessen of mee te doen aan één van de heetste battles van het seizoen!</p>\n<ul>\n<li>Top dancers uit de community</li>\n<li>Live muziek en vibes</li>\n<li>Prijzen en erkenning</li>\n</ul>`, audience: 'all' },
  { id: 'artist', category: 'Community', name: 'Artist Spotlight', subject: 'Artist Spotlight — We vieren onze community 🎨', content: `<h2>We zetten onze artiesten in het spotlight</h2>\n<p>Elke week schijnen we licht op het ongelofelijke talent in onze community.</p>\n<p><strong>Jouw verhaal kan de volgende zijn!</strong></p>`, audience: 'artists' },
  { id: 'reengagement', category: 'Re-engagement', name: 'We Miss You', subject: 'De culture mist jou — Kom terug! 💙', content: `<h2>Hey, we zagen dat je er even niet bij was</h2>\n<p>De urban culture community is gegroeid en we willen je graag terug!</p>`, audience: 'inactive' },
  { id: 'newsletter', category: 'Newsletter', name: 'Monthly Culture Digest', subject: 'Jouw Maandelijkse Urban Culture Digest 📋', content: `<h2>Deze maand in Urban Culture</h2>\n<p>Hier is je maandelijkse overzicht van alles wat er in de community speelt!</p>`, audience: 'all' },
  { id: 'premium', category: 'Membership', name: 'Go Premium', subject: 'Upgrade je experience — Ga Premium 👑', content: `<h2>Stap omhoog met Premium</h2>\n<p>Unlock het volgende level van de Urban Culture experience!</p>`, audience: 'all' },
];

const PROMO_COPY = [
  {
    platform: 'Instagram Caption',
    icon: SiInstagram,
    color: 'from-pink-500 to-purple-600',
    copy: `🔥 De urban culture community is HERE\n\nAl jouw favoriete B-boys, DJs, dancers & artiesten op 1 platform. Ontdek battles, boek talent, sluit je aan bij de beweging.\n\n👉 Join ons op urbanculturehub.nl\n\n#urbanculture #bboys #breakdancing #hiphop #dancecommunity #urbanart`,
  },
  {
    platform: 'LinkedIn Post',
    icon: FaLinkedin,
    color: 'from-blue-600 to-blue-800',
    copy: `Proud to introduce Urban Culture Hub — the platform connecting breakdancers, DJs, graffiti artists, and urban culture creators across the Netherlands.\n\nWe're building a community where talent meets opportunity. Whether you're an artist looking to get booked or an event organizer seeking performers, Urban Culture Hub is your go-to platform.\n\n🌐 urbanculturehub.nl\n\n#UrbanCulture #HipHop #Community #NetherlandsStartup`,
  },
  {
    platform: 'WhatsApp Message',
    icon: SiWhatsapp,
    color: 'from-green-500 to-green-600',
    copy: `Hey! Heb je Urban Culture Hub al gezien? 🔥\n\nHet is HÉT platform voor de urban culture community — battles, artiesten, events en meer.\n\nCheck het hier: urbanculturehub.nl\n\nDownload ook de iOS app: apps.apple.com/nl/app/urban-culture-hub/id6743952291`,
  },
  {
    platform: 'TikTok Bio',
    icon: SiTiktok,
    color: 'from-gray-900 to-gray-700',
    copy: `Urban Culture Hub 🔥\nHét platform voor de b-boy/b-girl community 💪\nBattles · Events · Artiesten\n🌐 urbanculturehub.nl`,
  },
];

const campaignSchema = z.object({
  name: z.string().min(3, 'Min. 3 tekens'),
  subject: z.string().min(5, 'Min. 5 tekens'),
  content: z.string().min(20, 'Min. 20 tekens'),
  targetAudience: z.string().min(1, 'Verplicht'),
  scheduleType: z.enum(['now', 'scheduled']),
  scheduledAt: z.string().optional(),
  imageUrl: z.string().optional(),
});
type CampaignForm = z.infer<typeof campaignSchema>;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function MiniProgress({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copy} data-testid="button-copy">
      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : (label || 'Copy')}
    </Button>
  );
}

export default function AdminMarketingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('campaigns');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [viewCampaign, setViewCampaign] = useState<Campaign | null>(null);
  const [sendConfirm, setSendConfirm] = useState<Campaign | null>(null);
  const [forceSend, setForceSend] = useState(true);
  const [recipientPreview, setRecipientPreview] = useState<{ eligible: number; total: number } | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [subjectGenerating, setSubjectGenerating] = useState(false);
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const [expandedPromo, setExpandedPromo] = useState<string | null>(null);

  // Social blast state
  const [socialText, setSocialText] = useState('');
  const [socialPlatforms, setSocialPlatforms] = useState<{ linkedin: boolean; instagram: boolean }>({ linkedin: true, instagram: false });
  const [socialPosting, setSocialPosting] = useState(false);
  const [socialGenerating, setSocialGenerating] = useState(false);
  const [igImageUrl, setIgImageUrl] = useState('');

  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { name: '', subject: '', content: '', targetAudience: 'all', scheduleType: 'now', scheduledAt: '', imageUrl: '' },
  });

  const isAdmin = ['admin', 'super_admin'].includes(user?.role ?? '');

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/admin/marketing/campaigns'],
    enabled: isAdmin,
    queryFn: async () => {
      const r = await fetch('/api/admin/marketing/campaigns', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load campaigns');
      return r.json();
    },
  });

  const { data: stats } = useQuery<{ totalCampaigns: number; sentCampaigns: number; totalRecipients: number; avgOpenRate: number; avgClickRate: number }>({
    queryKey: ['/api/admin/marketing/stats'],
    enabled: isAdmin,
    queryFn: async () => { const r = await fetch('/api/admin/marketing/stats', { credentials: 'include' }); return r.json(); },
  });

  const { data: userCounts } = useQuery<Record<string, number>>({
    queryKey: ['/api/admin/marketing/user-counts'],
    enabled: isAdmin,
    queryFn: async () => { const r = await fetch('/api/admin/marketing/user-counts', { credentials: 'include' }); return r.json(); },
  });

  const { data: linkedinStatus } = useQuery<{ connected: boolean; profileName?: string }>({
    queryKey: ['/api/admin/linkedin/status'],
    enabled: isAdmin,
    queryFn: async () => { const r = await fetch('/api/admin/linkedin/status', { credentials: 'include' }); return r.json(); },
  });

  const { data: igStatus } = useQuery<{ connected: boolean; username?: string }>({
    queryKey: ['/api/instagram/status'],
    enabled: isAdmin,
    queryFn: async () => { const r = await fetch('/api/instagram/status', { credentials: 'include' }); if (!r.ok) return { connected: false }; return r.json(); },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CampaignForm) => {
      const r = await fetch('/api/admin/marketing/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Failed to create');
      return d;
    },
    onSuccess: async (campaign, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/stats'] });
      if (vars.scheduleType === 'now') {
        await sendMutation.mutateAsync({ id: campaign.id, force: true });
      } else {
        toast({ title: 'Campaign created' });
        resetModal();
      }
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CampaignForm> }) => {
      const r = await fetch(`/api/admin/marketing/campaigns/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Failed to update');
      return d;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/campaigns'] }); toast({ title: 'Campaign updated' }); resetModal(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, force }: { id: number; force: boolean }) => {
      const r = await fetch(`/api/admin/marketing/campaigns/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ forceSend: force }), credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Failed to send');
      return d;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/stats'] });
      toast({ title: `Campaign sent! ${data.successCount || 0} emails delivered` });
      setSendConfirm(null); setRecipientPreview(null); resetModal();
    },
    onError: (e: any) => { toast({ title: 'Send failed', description: e.message, variant: 'destructive' }); setSendConfirm(null); },
  });

  const sendTestMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/marketing/campaigns/${id}/send-test`, { method: 'POST', credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || 'Failed');
      return d;
    },
    onSuccess: (data) => toast({ title: 'Test email sent!', description: data.message }),
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/admin/marketing/campaigns/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/campaigns'] }); toast({ title: 'Campaign deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const resetModal = () => {
    setShowModal(false); setEditingId(null); setPreviewHtml(''); setShowPreview(false);
    setAiPrompt(''); setSubjectSuggestions([]);
    form.reset({ name: '', subject: '', content: '', targetAudience: 'all', scheduleType: 'now', scheduledAt: '', imageUrl: '' });
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c.id);
    form.reset({ name: c.name, subject: c.subject, content: c.content, targetAudience: c.targetAudience, scheduleType: 'now', scheduledAt: c.scheduledAt || '', imageUrl: c.imageUrl || '' });
    setShowModal(true);
  };

  const openDuplicate = (c: Campaign) => {
    setEditingId(null);
    form.reset({ name: `${c.name} (copy)`, subject: c.subject, content: c.content, targetAudience: c.targetAudience, scheduleType: 'now', scheduledAt: '', imageUrl: c.imageUrl || '' });
    setShowModal(true);
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    form.reset({ name: t.name, subject: t.subject, content: t.content, targetAudience: t.audience, scheduleType: 'now', scheduledAt: '', imageUrl: '' });
    setShowModal(true); setActiveTab('campaigns');
    toast({ title: 'Template applied' });
  };

  const onSubmit = (data: CampaignForm) => {
    if (editingId) updateMutation.mutate({ id: editingId, data });
    else createMutation.mutate(data);
  };

  const openSendConfirm = async (campaign: Campaign) => {
    setSendConfirm(campaign); setForceSend(true); setRecipientPreview(null);
    try {
      const r = await fetch(`/api/admin/marketing/campaigns/${campaign.id}/recipient-count`, { credentials: 'include' });
      if (r.ok) setRecipientPreview(await r.json());
    } catch {}
  };

  const generateAiContent = async () => {
    const name = form.getValues('name'); const audience = form.getValues('targetAudience');
    setAiGenerating(true);
    try {
      const r = await fetch('/api/admin/marketing/ai-assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt || undefined, campaignName: name, targetAudience: audience }), credentials: 'include' });
      const d = await r.json(); if (!r.ok) throw new Error(d.message);
      form.setValue('content', d.text); setPreviewHtml(d.text);
      toast({ title: 'AI content generated' });
    } catch (e: any) { toast({ title: 'AI error', description: e.message, variant: 'destructive' }); }
    finally { setAiGenerating(false); }
  };

  const generateSubjectLines = async () => {
    const name = form.getValues('name'); const audience = form.getValues('targetAudience');
    if (!name) { toast({ title: 'Enter a campaign name first' }); return; }
    setSubjectGenerating(true);
    try {
      const r = await fetch('/api/admin/marketing/ai-assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaignName: name, targetAudience: audience, type: 'subject' }), credentials: 'include' });
      const d = await r.json(); if (!r.ok) throw new Error(d.message);
      const lines = d.text.split('\n').filter((l: string) => l.trim() && /^\d/.test(l.trim())).map((l: string) => l.replace(/^\d+\.\s*/, '').trim());
      setSubjectSuggestions(lines.slice(0, 5));
    } catch (e: any) { toast({ title: 'AI error', description: e.message, variant: 'destructive' }); }
    finally { setSubjectGenerating(false); }
  };

  const generateSocialPost = async () => {
    setSocialGenerating(true);
    try {
      const r = await fetch('/api/admin/linkedin/generate-post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'Urban Culture Hub app promotion', tone: 'energetic', style: 'community' }), credentials: 'include' });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Generation failed');
      setSocialText(d.content || d.post || d.text || '');
      toast({ title: 'Social post generated!' });
    } catch (e: any) { toast({ title: 'Generation failed', description: e.message, variant: 'destructive' }); }
    finally { setSocialGenerating(false); }
  };

  const postToSocial = async () => {
    if (!socialText.trim()) { toast({ title: 'Write something first' }); return; }
    setSocialPosting(true);
    const results: string[] = [];
    try {
      if (socialPlatforms.linkedin && linkedinStatus?.connected) {
        const r = await fetch('/api/admin/linkedin/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: socialText }), credentials: 'include' });
        const d = await r.json();
        if (r.ok) results.push('LinkedIn'); else throw new Error(d.error || 'LinkedIn post failed');
      }
      if (socialPlatforms.instagram && igStatus?.connected) {
        if (!igImageUrl.trim()) { toast({ title: 'Instagram requires an image URL', variant: 'destructive' }); setSocialPosting(false); return; }
        const cr = await fetch('/api/instagram/media/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: igImageUrl, caption: socialText }), credentials: 'include' });
        const cd = await cr.json(); if (!cr.ok) throw new Error(cd.error || 'Instagram create failed');
        const pr = await fetch('/api/instagram/media/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creationId: cd.id }), credentials: 'include' });
        const pd = await pr.json(); if (!pr.ok) throw new Error(pd.error || 'Instagram publish failed');
        results.push('Instagram');
      }
      if (results.length > 0) {
        toast({ title: `Posted to ${results.join(' & ')}! 🚀` });
        setSocialText(''); setIgImageUrl('');
      } else {
        toast({ title: 'No platforms selected or connected', variant: 'destructive' });
      }
    } catch (e: any) { toast({ title: 'Post failed', description: e.message, variant: 'destructive' }); }
    finally { setSocialPosting(false); }
  };

  const enrichedSegments = useMemo(() => [
    { id: 'all', label: 'All Users', count: userCounts?.all || 0 },
    { id: 'artists', label: 'Artists', count: userCounts?.artists || 0 },
    { id: 'enthusiasts', label: 'Enthusiasts', count: userCounts?.enthusiasts || 0 },
    { id: 'active', label: 'Active (30d)', count: userCounts?.active || 0 },
    { id: 'inactive', label: 'Inactive (30d+)', count: userCounts?.inactive || 0 },
    { id: 'new', label: 'New (7d)', count: userCounts?.new || 0 },
    { id: 'verified', label: 'Verified', count: userCounts?.verified || 0 },
  ], [userCounts]);

  const audienceCount = useMemo(() => {
    const seg = form.watch('targetAudience');
    return enrichedSegments.find(s => s.id === seg)?.count || 0;
  }, [enrichedSegments, form.watch('targetAudience')]);

  if (!isAdmin) {
    return (
      <div className="container max-w-6xl py-8">
        <Card><CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <XCircle className="h-16 w-16 text-destructive mb-4" />
          <h3 className="text-xl font-semibold mb-2">Access Denied</h3>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-6 space-y-5">
      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,107,0,0.18),transparent_60%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white/60 hover:text-white hover:bg-white/10" onClick={() => navigate('/admin')} data-testid="button-back-admin">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Rocket className="h-5 w-5 text-orange-400" />
                <h1 className="text-xl font-bold">Marketing Hub</h1>
                <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-[10px]">PRO</Badge>
              </div>
              <p className="text-white/50 text-xs">Email campaigns · Social blast · App promotion</p>
            </div>
          </div>
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white border-0" onClick={() => { resetModal(); setShowModal(true); }} data-testid="button-new-campaign">
            <Plus className="w-4 h-4 mr-1.5" /> New Campaign
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: 'Campaigns', value: stats?.totalCampaigns || 0, icon: Megaphone, color: 'text-orange-400' },
            { label: 'Sent', value: stats?.sentCampaigns || 0, icon: CheckCircle, color: 'text-green-400' },
            { label: 'Reached', value: stats?.totalRecipients || 0, icon: Users, color: 'text-blue-400' },
            { label: 'Open Rate', value: `${(stats?.avgOpenRate || 0).toFixed(1)}%`, icon: Mail, color: 'text-purple-400' },
            { label: 'Click Rate', value: `${(stats?.avgClickRate || 0).toFixed(1)}%`, icon: Target, color: 'text-pink-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3 flex items-center gap-2.5">
              <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
              <div>
                <p className="text-base font-bold leading-none">{s.value}</p>
                <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9 bg-muted/60">
          <TabsTrigger value="campaigns" className="text-xs gap-1.5" data-testid="tab-campaigns">
            <Megaphone className="w-3.5 h-3.5" /> Email Campaigns
          </TabsTrigger>
          <TabsTrigger value="social" className="text-xs gap-1.5" data-testid="tab-social">
            <Share2 className="w-3.5 h-3.5" /> Social Blast
          </TabsTrigger>
          <TabsTrigger value="promote" className="text-xs gap-1.5" data-testid="tab-promote">
            <Rocket className="w-3.5 h-3.5" /> Promote App
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs gap-1.5" data-testid="tab-templates">
            <Bot className="w-3.5 h-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="audience" className="text-xs gap-1.5" data-testid="tab-audience">
            <Users className="w-3.5 h-3.5" /> Audience
          </TabsTrigger>
        </TabsList>

        {/* ── EMAIL CAMPAIGNS TAB ── */}
        <TabsContent value="campaigns" className="mt-3 space-y-2">
          {isLoading ? (
            <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /><p className="text-xs text-muted-foreground mt-2">Loading campaigns…</p></div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border/60">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="w-7 h-7 text-primary/50" />
              </div>
              <p className="font-semibold mb-1">No campaigns yet</p>
              <p className="text-xs text-muted-foreground mb-4">Create your first email campaign or use a template</p>
              <Button size="sm" onClick={() => { resetModal(); setShowModal(true); }}><Plus className="w-4 h-4 mr-1.5" /> New Campaign</Button>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border/60 overflow-hidden">
              {campaigns.map((c) => (
                <div key={c.id} className="px-4 py-3.5 border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors" data-testid={`campaign-row-${c.id}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{c.name}</span>
                        <StatusBadge status={c.status} />
                        <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{AUDIENCE_LABELS[c.targetAudience] || c.targetAudience}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-md">Subject: {c.subject}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                        {c.sentAt ? (
                          <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> Sent {new Date(c.sentAt).toLocaleDateString('nl-NL')}</span>
                        ) : c.scheduledAt ? (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-500" /> Scheduled {new Date(c.scheduledAt).toLocaleDateString('nl-NL')}</span>
                        ) : (
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Created {new Date(c.createdAt).toLocaleDateString('nl-NL')}</span>
                        )}
                        {c.recipientCount > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.recipientCount} recipients</span>}
                      </div>
                      {c.status === 'sent' && c.recipientCount > 0 && (
                        <div className="mt-2 space-y-1 max-w-xs">
                          <div className="text-[10px] text-muted-foreground">Opens: {c.openCount}</div>
                          <MiniProgress value={c.openCount} max={c.recipientCount} color="bg-indigo-400" />
                          <div className="text-[10px] text-muted-foreground">Clicks: {c.clickCount}</div>
                          <MiniProgress value={c.clickCount} max={c.recipientCount} color="bg-purple-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setViewCampaign(c)} title="View"><Eye className="w-3.5 h-3.5" /></Button>
                      {(c.status === 'draft' || c.status === 'scheduled') && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(c)} title="Edit"><Edit3 className="w-3.5 h-3.5" /></Button>
                      )}
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={() => sendTestMutation.mutate(c.id)} disabled={sendTestMutation.isPending} data-testid={`button-test-${c.id}`}>
                        {sendTestMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Mail className="w-3 h-3 mr-1" /> Test</>}
                      </Button>
                      {(c.status === 'draft' || c.status === 'scheduled') && (
                        <Button size="sm" className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => openSendConfirm(c)} disabled={sendMutation.isPending} data-testid={`button-send-${c.id}`}>
                          {sendMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3 h-3 mr-1" /> Send</>}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDuplicate(c)} title="Duplicate"><Copy className="w-3.5 h-3.5" /></Button>
                      {c.status !== 'sent' && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(c.id)} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── SOCIAL BLAST TAB ── */}
        <TabsContent value="social" className="mt-3 space-y-4">
          {/* Platform status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`rounded-xl border p-4 flex items-center justify-between ${linkedinStatus?.connected ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${linkedinStatus?.connected ? 'bg-blue-600' : 'bg-muted'}`}>
                  <FaLinkedin className={`w-4 h-4 ${linkedinStatus?.connected ? 'text-white' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-medium text-sm">LinkedIn</p>
                  <p className="text-xs text-muted-foreground">{linkedinStatus?.connected ? linkedinStatus.profileName || 'Connected' : 'Not connected'}</p>
                </div>
              </div>
              {linkedinStatus?.connected ? (
                <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-blue-700">
                    <input type="checkbox" checked={socialPlatforms.linkedin} onChange={e => setSocialPlatforms(p => ({ ...p, linkedin: e.target.checked }))} className="w-3.5 h-3.5 accent-blue-600" data-testid="checkbox-linkedin" />
                    Include
                  </label>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => navigate('/admin/linkedin')} data-testid="button-connect-linkedin">Connect</Button>
              )}
            </div>

            <div className={`rounded-xl border p-4 flex items-center justify-between ${igStatus?.connected ? 'border-pink-200 bg-pink-50 dark:bg-pink-950/20 dark:border-pink-900' : 'border-border bg-muted/30'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${igStatus?.connected ? 'bg-gradient-to-br from-pink-500 to-purple-600' : 'bg-muted'}`}>
                  <SiInstagram className={`w-4 h-4 ${igStatus?.connected ? 'text-white' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="font-medium text-sm">Instagram</p>
                  <p className="text-xs text-muted-foreground">{igStatus?.connected ? `@${igStatus.username || 'connected'}` : 'Not connected'}</p>
                </div>
              </div>
              {igStatus?.connected ? (
                <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-pink-700">
                    <input type="checkbox" checked={socialPlatforms.instagram} onChange={e => setSocialPlatforms(p => ({ ...p, instagram: e.target.checked }))} className="w-3.5 h-3.5 accent-pink-600" data-testid="checkbox-instagram" />
                    Include
                  </label>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => navigate('/admin/instagram')} data-testid="button-connect-instagram">Connect</Button>
              )}
            </div>
          </div>

          {/* Post Composer */}
          <div className="bg-card rounded-xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                <h3 className="font-semibold text-sm">Social Post Composer</h3>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-purple-600 border-purple-200 hover:bg-purple-50" onClick={generateSocialPost} disabled={socialGenerating} data-testid="button-generate-social">
                {socialGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI Generate
              </Button>
            </div>

            <Textarea
              placeholder="Write your post here — or click AI Generate to create one automatically. Include hashtags, emojis and your app link for best reach!"
              className="min-h-[140px] text-sm resize-none"
              value={socialText}
              onChange={e => setSocialText(e.target.value)}
              data-testid="textarea-social-post"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{socialText.length} characters</span>
              {socialText.length > 0 && (
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setSocialText(socialText + '\n\n🌐 urbanculturehub.nl'); }}>
                  + App link
                </Button>
              )}
            </div>

            {/* Instagram image URL (only shown when Instagram selected) */}
            {socialPlatforms.instagram && igStatus?.connected && (
              <div className="p-3 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900 space-y-2">
                <p className="text-xs font-medium text-pink-800 dark:text-pink-300 flex items-center gap-1">
                  <SiInstagram className="w-3 h-3" /> Instagram requires an image
                </p>
                <Input
                  placeholder="Image URL (e.g. https://yourcdn.com/image.jpg)"
                  value={igImageUrl}
                  onChange={e => setIgImageUrl(e.target.value)}
                  className="text-xs h-8"
                  data-testid="input-ig-image-url"
                />
              </div>
            )}

            <Button
              className="w-full bg-gradient-to-r from-orange-500 to-pink-600 hover:from-orange-600 hover:to-pink-700 text-white border-0"
              onClick={postToSocial}
              disabled={socialPosting || !socialText.trim() || (!socialPlatforms.linkedin && !socialPlatforms.instagram)}
              data-testid="button-blast-social"
            >
              {socialPosting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Posting…</> : <><Rocket className="w-4 h-4 mr-2" /> Blast to Social Media</>}
            </Button>
          </div>
        </TabsContent>

        {/* ── PROMOTE APP TAB ── */}
        <TabsContent value="promote" className="mt-3 space-y-4">
          {/* App Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-card rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-orange-500" />
                <h3 className="font-semibold text-sm">Website</h3>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <span className="text-xs text-muted-foreground flex-1 truncate">{APP_URL}</span>
                <CopyButton text={APP_URL} />
              </div>
              <div className="flex justify-center p-4 bg-white rounded-xl border border-border/40">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(APP_URL)}&bgcolor=ffffff&color=111111&margin=10`}
                  alt="QR Code Website"
                  className="w-40 h-40"
                  data-testid="img-qr-website"
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Scan to visit urbanculturehub.nl</p>
              <a href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(APP_URL)}&bgcolor=ffffff&color=111111&margin=20`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1.5" data-testid="button-download-qr-website">
                  <Download className="w-3 h-3" /> Download QR
                </Button>
              </a>
            </div>

            <div className="bg-card rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-sm">iOS App</h3>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <span className="text-xs text-muted-foreground flex-1 truncate">App Store</span>
                <CopyButton text={IOS_URL} />
              </div>
              <div className="flex justify-center p-4 bg-white rounded-xl border border-border/40">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(IOS_URL)}&bgcolor=ffffff&color=111111&margin=10`}
                  alt="QR Code App Store"
                  className="w-40 h-40"
                  data-testid="img-qr-ios"
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Scan to download on iOS</p>
              <a href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(IOS_URL)}&bgcolor=ffffff&color=111111&margin=20`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1.5" data-testid="button-download-qr-ios">
                  <Download className="w-3 h-3" /> Download QR
                </Button>
              </a>
            </div>
          </div>

          {/* Quick Share */}
          <div className="bg-card rounded-xl border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Share2 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Quick Share</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent('Check out Urban Culture Hub! 🔥 ' + APP_URL)}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="w-full h-9 text-xs gap-2 border-green-200 text-green-700 hover:bg-green-50" data-testid="button-share-whatsapp">
                  <SiWhatsapp className="w-3.5 h-3.5" /> WhatsApp
                </Button>
              </a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(APP_URL)}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="w-full h-9 text-xs gap-2 border-blue-200 text-blue-700 hover:bg-blue-50" data-testid="button-share-linkedin">
                  <FaLinkedin className="w-3.5 h-3.5" /> LinkedIn
                </Button>
              </a>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Join the urban culture movement! 🔥 ' + APP_URL + ' #breakdancing #urbanculture #hiphop')}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="w-full h-9 text-xs gap-2 hover:bg-muted" data-testid="button-share-twitter">
                  <span className="font-bold text-sm">𝕏</span> Twitter / X
                </Button>
              </a>
              <a href={`mailto:?subject=Check out Urban Culture Hub&body=Hey! Check out this urban culture community platform: ${APP_URL}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="w-full h-9 text-xs gap-2 hover:bg-muted" data-testid="button-share-email">
                  <Mail className="w-3.5 h-3.5" /> Email
                </Button>
              </a>
            </div>
          </div>

          {/* Promo Copy Kit */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Promo Copy Kit</h3>
              <span className="text-xs text-muted-foreground">— ready-to-use captions for every platform</span>
            </div>
            {PROMO_COPY.map(item => (
              <div key={item.platform} className="bg-card rounded-xl border border-border/60 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedPromo(expandedPromo === item.platform ? null : item.platform)}
                  data-testid={`promo-toggle-${item.platform.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center`}>
                      <item.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-medium text-sm">{item.platform}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={item.copy} label="Copy" />
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedPromo === item.platform ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {expandedPromo === item.platform && (
                  <div className="px-4 pb-4">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed bg-muted/50 rounded-lg p-3 border border-border/40">
                      {item.copy}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── TEMPLATES TAB ── */}
        <TabsContent value="templates" className="mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TEMPLATES.map(t => (
              <div key={t.id} className="bg-card rounded-xl border border-border/60 p-4 hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer group" onClick={() => applyTemplate(t)} data-testid={`template-${t.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t.category}</span>
                  <span className="text-[10px] text-muted-foreground">{AUDIENCE_LABELS[t.audience]}</span>
                </div>
                <h4 className="font-semibold text-sm mb-1">{t.name}</h4>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{t.subject}</p>
                <Button size="sm" variant="outline" className="w-full h-7 text-xs group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
                  Use Template <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── AUDIENCE TAB ── */}
        <TabsContent value="audience" className="mt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {enrichedSegments.map(s => (
              <div key={s.id} className="bg-card rounded-xl border border-border/60 p-4" data-testid={`segment-${s.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{s.label}</span>
                  <span className="text-2xl font-bold text-primary">{s.count}</span>
                </div>
                <MiniProgress value={s.count} max={userCounts?.all || 1} color="bg-primary/60" />
                <p className="text-[11px] text-muted-foreground mt-2">
                  {userCounts?.all ? `${((s.count / userCounts.all) * 100).toFixed(1)}% of total users` : '—'}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── CREATE / EDIT MODAL ── */}
      <Dialog open={showModal} onOpenChange={v => { if (!v) resetModal(); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl mx-auto rounded-xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
            <DialogDescription className="sr-only">Campaign editor with AI assistance</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Campaign Name</FormLabel>
                    <FormControl><Input placeholder="November Newsletter" {...field} className="h-8 text-sm" data-testid="input-campaign-name" /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="targetAudience" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Target Audience</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-8 text-sm" data-testid="select-audience"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {enrichedSegments.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.label} <span className="text-muted-foreground ml-1">({s.count})</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs">Email Subject</FormLabel>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] text-purple-600 px-2" onClick={generateSubjectLines} disabled={subjectGenerating}>
                      {subjectGenerating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />} AI Suggestions
                    </Button>
                  </div>
                  <FormControl><Input placeholder="Exciting updates from the community!" {...field} className="h-8 text-sm" data-testid="input-subject" /></FormControl>
                  {subjectSuggestions.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {subjectSuggestions.map((s, i) => (
                        <button key={i} type="button" onClick={() => { form.setValue('subject', s); setSubjectSuggestions([]); }}
                          className="w-full text-left text-xs px-2 py-1.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-100 transition-colors">{s}</button>
                      ))}
                    </div>
                  )}
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-700">AI Content Generator</span>
                  <span className="text-[10px] text-purple-400 ml-auto">Writes in Dutch by default</span>
                </div>
                <div className="flex gap-2">
                  <Input placeholder='e.g. "re-engagement email for B-boys and dancers"' value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && generateAiContent()} className="text-xs h-8 flex-1 bg-white" />
                  <Button type="button" size="sm" className="h-8 bg-purple-600 hover:bg-purple-700 shrink-0" onClick={generateAiContent} disabled={aiGenerating} data-testid="button-ai-generate">
                    {aiGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-xs">Email Content (HTML supported)</FormLabel>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => { setPreviewHtml(field.value); setShowPreview(p => !p); }}>
                      <Eye className="w-3 h-3 mr-1" /> {showPreview ? 'Hide' : 'Preview'}
                    </Button>
                  </div>
                  {showPreview ? (
                    <div className="border rounded-lg p-4 min-h-[200px] max-h-[300px] overflow-y-auto bg-white text-sm" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml || field.value) }} />
                  ) : (
                    <FormControl>
                      <Textarea placeholder="Write your email content here, or generate with AI above…" className="min-h-[180px] text-sm font-mono resize-none" {...field} onChange={e => { field.onChange(e); setPreviewHtml(e.target.value); }} data-testid="input-content" />
                    </FormControl>
                  )}
                  <FormMessage className="text-xs" />
                </FormItem>
              )} />

              {!editingId && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="scheduleType" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Send Time</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="now">Send Immediately</SelectItem>
                          <SelectItem value="scheduled">Schedule for Later</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  {form.watch('scheduleType') === 'scheduled' && (
                    <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Scheduled Date &amp; Time</FormLabel>
                        <FormControl><Input type="datetime-local" {...field} className="h-8 text-sm" /></FormControl>
                      </FormItem>
                    )} />
                  )}
                </div>
              )}

              {!editingId && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-xs border ${form.watch('scheduleType') === 'now' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                  {form.watch('scheduleType') === 'now' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <Clock className="w-3.5 h-3.5 shrink-0" />}
                  {form.watch('scheduleType') === 'now'
                    ? `This will immediately send to ~${audienceCount} users with email marketing enabled.`
                    : `Will be scheduled and sent to ~${audienceCount} users at the selected time.`}
                </div>
              )}

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={resetModal}>Cancel</Button>
                <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending || sendMutation.isPending} data-testid="button-submit-campaign">
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving…</>
                  ) : editingId ? 'Save Changes' : form.watch('scheduleType') === 'now' ? (
                    <><Send className="w-3.5 h-3.5 mr-1.5" /> Create &amp; Send</>
                  ) : (
                    <><Calendar className="w-3.5 h-3.5 mr-1.5" /> Schedule Campaign</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── SEND CONFIRM DIALOG ── */}
      <Dialog open={!!sendConfirm} onOpenChange={v => { if (!v) { setSendConfirm(null); setRecipientPreview(null); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-blue-500" /> Confirm Send</DialogTitle>
            <DialogDescription className="sr-only">Send campaign confirmation</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>You are about to send <strong>"{sendConfirm?.name}"</strong>.</p>
            <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${recipientPreview === null ? 'bg-gray-50 border-gray-200 text-gray-600' : forceSend ? 'bg-green-50 border-green-200 text-green-800' : recipientPreview.eligible === 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
              {recipientPreview === null ? (
                <><Loader2 className="w-4 h-4 shrink-0 animate-spin mt-0.5" /><span>Checking recipient count…</span></>
              ) : (
                <><Mail className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{forceSend ? <><strong>{recipientPreview.total} recipient{recipientPreview.total !== 1 ? 's' : ''}</strong> will receive this email (preference override active).</> : recipientPreview.eligible === 0 ? <><strong>0 recipients</strong> — all users have marketing emails off. Enable override below.</> : <><strong>{recipientPreview.eligible} of {recipientPreview.total}</strong> users have marketing emails enabled.</>}</span>
                </>
              )}
            </div>
            {recipientPreview && recipientPreview.total > recipientPreview.eligible && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">
                <input type="checkbox" checked={forceSend} onChange={e => setForceSend(e.target.checked)} className="w-4 h-4 accent-amber-500" data-testid="checkbox-force-send" />
                <span><strong>Override preferences</strong> — also send to opted-out users ({recipientPreview.total - recipientPreview.eligible} extra)</span>
              </label>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSendConfirm(null); setRecipientPreview(null); }}>Cancel</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => sendConfirm && sendMutation.mutate({ id: sendConfirm.id, force: forceSend })} disabled={sendMutation.isPending || recipientPreview === null}>
              {sendMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Sending…</> : <><Send className="w-3.5 h-3.5 mr-1.5" /> Send Now</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── VIEW CAMPAIGN DIALOG ── */}
      <Dialog open={!!viewCampaign} onOpenChange={v => { if (!v) setViewCampaign(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl mx-auto rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> {viewCampaign?.name}</DialogTitle>
            <DialogDescription className="sr-only">Campaign details</DialogDescription>
          </DialogHeader>
          {viewCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1.5">
                  <p><span className="text-muted-foreground">Status:</span> <StatusBadge status={viewCampaign.status} /></p>
                  <p><span className="text-muted-foreground">Audience:</span> <strong>{AUDIENCE_LABELS[viewCampaign.targetAudience] || viewCampaign.targetAudience}</strong></p>
                  {viewCampaign.sentAt && <p><span className="text-muted-foreground">Sent:</span> <strong>{new Date(viewCampaign.sentAt).toLocaleString('nl-NL')}</strong></p>}
                </div>
                {viewCampaign.status === 'sent' && (
                  <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-2">
                    <p className="font-medium">Performance</p>
                    <p><span className="text-muted-foreground">Recipients:</span> <strong>{viewCampaign.recipientCount}</strong></p>
                    <div><div className="text-muted-foreground mb-1">Open rate</div><MiniProgress value={viewCampaign.openCount} max={viewCampaign.recipientCount} color="bg-indigo-400" /></div>
                    <div><div className="text-muted-foreground mb-1">Click rate</div><MiniProgress value={viewCampaign.clickCount} max={viewCampaign.recipientCount} color="bg-purple-400" /></div>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-medium mb-1 text-muted-foreground">Subject</p>
                <p className="text-sm font-medium">{viewCampaign.subject}</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-2 text-muted-foreground">Email Preview</p>
                <div className="border rounded-xl p-4 bg-white text-sm max-h-[300px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewCampaign.content) }} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
