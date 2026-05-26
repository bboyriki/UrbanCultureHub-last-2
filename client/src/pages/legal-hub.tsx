import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Shield, FileCheck, Settings, Download,
  ExternalLink, CheckCircle, XCircle, Scale, Cookie,
  AlertTriangle, Mail, Globe, Phone, Lock, Bot, Instagram
} from "lucide-react";
import UserLegalConsents from "@/components/legal/UserLegalConsents";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

function ConsentPill({ label, accepted }: { label: string; accepted: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors
      ${accepted
        ? "border-green-500/30 bg-green-500/5 dark:bg-green-500/10"
        : "border-destructive/30 bg-destructive/5 dark:bg-destructive/10"}`}
    >
      <span className="text-sm font-medium">{label}</span>
      {accepted ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
          <CheckCircle className="h-3.5 w-3.5" /> Accepted
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
          <XCircle className="h-3.5 w-3.5" /> Pending
        </span>
      )}
    </div>
  );
}

const DOCS = [
  {
    icon: FileText,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    title: "Terms of Service",
    titleNl: "Algemene Voorwaarden",
    version: "v2026.2",
    desc: "Rules, rights, and obligations for using the Urban Culture platform — Dutch law & EU compliant.",
    descNl: "Regels, rechten en verplichtingen voor het gebruik van het Urban Culture-platform — conform Nederlands recht & EU.",
    bullets: ["Eligibility 16+ · Leeftijdsvereiste", "AI features & Reels policy", "Marketplace & Instagram rules", "Apple/Google App Store compliance"],
    href: "/terms-of-service",
    cta: "View & Accept",
    ctaNl: "Bekijk & Accepteer",
    download: "terms-of-service" as const,
  },
  {
    icon: Shield,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    title: "Privacy Policy",
    titleNl: "Privacybeleid",
    version: "v2026.2",
    desc: "AVG/GDPR-compliant. How we collect, process, and protect your personal data.",
    descNl: "AVG/GDPR-conform. Hoe wij uw persoonsgegevens verzamelen, verwerken en beschermen.",
    bullets: ["AI & Instagram data handling", "Reels & video data", "Your AVG Art. 15–22 rights", "Sub-processors & data retention"],
    href: "/privacy-policy",
    cta: "View & Accept",
    ctaNl: "Bekijk & Accepteer",
    download: "privacy-policy" as const,
  },
  {
    icon: FileCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    title: "Data Deletion",
    titleNl: "Gegevensverwijdering",
    version: "AVG Art. 17",
    desc: "Exercise your right to erasure. Submit a deletion request — processed within 30 days.",
    descNl: "Gebruik uw recht op vergetelheid. Dien een verwijderingsverzoek in — verwerkt binnen 30 dagen.",
    bullets: ["Full account deletion", "Partial data removal", "Legal retention exceptions", "Request tracking & confirmation"],
    href: "/data-deletion",
    cta: "Manage My Data",
    ctaNl: "Beheer Mijn Gegevens",
    download: null,
  },
  {
    icon: Cookie,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    title: "Cookie Policy",
    titleNl: "Cookiebeleid",
    version: "v2026.2",
    desc: "Essential cookies for security and optional analytics cookies — with your consent only.",
    descNl: "Essentiële cookies voor beveiliging en optionele analytische cookies — alleen met uw toestemming.",
    bullets: ["Essential cookies only by default", "Analytics cookies need consent", "No third-party ad tracking", "Withdraw consent anytime"],
    href: "/privacy-policy#s12",
    cta: "Read Cookie Policy",
    ctaNl: "Lees Cookiebeleid",
    download: null,
  },
];


const COMPLIANCE_HIGHLIGHTS = [
  { icon: Shield, label: "AVG / GDPR", sub: "EU & Dutch law" },
  { icon: Lock, label: "TLS + AES-256", sub: "Encrypted in transit & at rest" },
  { icon: Scale, label: "Rechtbank N-H", sub: "Dutch jurisdiction" },
  { icon: AlertTriangle, label: "72h breach notice", sub: "AP notification" },
  { icon: Bot, label: "AI data safe", sub: "No personal data in prompts" },
  { icon: Instagram, label: "Instagram API", sub: "Minimum permissions only" },
  { icon: Globe, label: "SCCs in place", sub: "Int'l data transfers" },
  { icon: CheckCircle, label: "App Store", sub: "Apple & Google compliant" },
];

export default function LegalHubPage() {
  const [lang, setLang] = useState<"en" | "nl">("en");
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: consent } = useQuery({
    queryKey: ["/api/legal/user-consent"],
    enabled: !!user,
    retry: false,
  });
  const c = consent as any;

  const downloadPDF = (type: "terms-of-service" | "privacy-policy") => {
    window.open(`/api/legal/${type}/pdf?language=${lang}`, "_blank");
    toast({
      title: lang === "nl" ? "Download gestart" : "Download started",
      description: lang === "nl"
        ? `De ${type === "terms-of-service" ? "Algemene Voorwaarden" : "Privacybeleid"} PDF wordt gedownload.`
        : `The ${type === "terms-of-service" ? "Terms of Service" : "Privacy Policy"} PDF is downloading.`,
    });
  };

  return (
    <div className="pb-10">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl mb-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-600/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent" />
        <div className="relative px-6 py-12 sm:px-10 sm:py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            {lang === "nl" ? "Juridisch Centrum" : "Legal Center"}
          </h1>
          <p className="text-slate-300 max-w-xl mx-auto text-sm sm:text-base leading-relaxed mb-6">
            {lang === "nl"
              ? "Alle juridische documenten, privacyrechten en databeheertools op één plek. Urban Culture voldoet volledig aan het Nederlands recht (BW) en de EU AVG/GDPR."
              : "All legal documents, privacy rights, and data management tools in one place. Urban Culture is fully compliant with Dutch law (BW), EU GDPR (AVG), and Apple App Store guidelines."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20">🇳🇱 Netherlands 2026</Badge>
            <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20">AVG / GDPR v2026.2</Badge>
            <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20">🍎 App Store Approved</Badge>
            <Badge className="bg-white/10 text-white border-white/20 hover:bg-white/20">🤖 AI Compliant</Badge>
          </div>
          <Tabs value={lang} onValueChange={v => setLang(v as "en" | "nl")} className="inline-flex">
            <TabsList className="bg-white/10 border border-white/20">
              <TabsTrigger value="en" className="text-white data-[state=active]:bg-white data-[state=active]:text-slate-900">🇬🇧 English</TabsTrigger>
              <TabsTrigger value="nl" className="text-white data-[state=active]:bg-white data-[state=active]:text-slate-900">🇳🇱 Nederlands</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ── Compliance highlights strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-10">
        {COMPLIANCE_HIGHLIGHTS.map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex flex-col items-center text-center p-3 rounded-xl bg-muted/50 border border-border/50 gap-1.5">
            <Icon className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold leading-tight">{label}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">{sub}</span>
          </div>
        ))}
      </div>

      {/* ── User consent status ── */}
      {user && c && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            {lang === "nl" ? "Uw acceptatiestatus" : "Your Agreement Status"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <ConsentPill label={lang === "nl" ? "Algemene Voorwaarden" : "Terms of Service"} accepted={!!c?.termsAccepted} />
            <ConsentPill label={lang === "nl" ? "Privacybeleid" : "Privacy Policy"} accepted={!!c?.privacyAccepted} />
          </div>
          <UserLegalConsents />
          <Separator className="mt-8" />
        </div>
      )}

      {/* ── Legal documents ── */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        {lang === "nl" ? "Juridische documenten" : "Legal Documents"}
      </h2>
      <div className="grid gap-5 md:grid-cols-2 mb-10">
        {DOCS.map(({ icon: Icon, color, bg, title, titleNl, version, desc, descNl, bullets, href, cta, ctaNl, download }) => (
          <Card key={title} className="group hover:shadow-lg transition-all duration-300 border-border/60 hover:border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className={`p-1.5 rounded-lg ${bg}`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </span>
                  <span className="text-base">{lang === "nl" ? titleNl : title}</span>
                </span>
                <Badge variant="outline" className="text-[10px] font-normal shrink-0">{version}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground pt-1">{lang === "nl" ? descNl : desc}</p>
            </CardHeader>
            <CardContent className="pb-3">
              <ul className="space-y-1.5">
                {bullets.map(b => (
                  <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`w-1 h-1 rounded-full ${color.replace("text-", "bg-")} shrink-0`} />
                    {b}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="flex justify-between pt-2 border-t border-border/40">
              <Button variant="default" size="sm" asChild className="gap-1.5">
                <Link href={href}>
                  <ExternalLink className="w-3.5 h-3.5" /> {lang === "nl" ? ctaNl : cta}
                </Link>
              </Button>
              {download && (
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5"
                  onClick={() => downloadPDF(download)}>
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* ── Settings quick-link ── */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-5 mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 mt-0.5">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">
              {lang === "nl" ? "Cookie- en privacyinstellingen" : "Cookie & Privacy Settings"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "nl"
                ? "Beheer locatiedeling, analytische cookies en marketingvoorkeuren. Trek toestemming op elk moment in."
                : "Control location sharing, analytics cookies, and marketing preferences. Withdraw consent any time."}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/settings">
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            {lang === "nl" ? "Instellingen openen" : "Open Settings"}
          </Link>
        </Button>
      </div>

      <Separator className="mb-10" />

      {/* ── Contact & AP ── */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Mail className="h-5 w-5 text-primary" />
        {lang === "nl" ? "Contact & Autoriteiten" : "Contact & Authorities"}
      </h2>
      <div className="grid gap-5 md:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10"><Mail className="w-4 h-4 text-primary" /></span>
              {lang === "nl" ? "Verwerkingsverantwoordelijke" : "Data Controller"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">Urban Culture</p>
            <p>Herenstraat 32, Zaandam, {lang === "nl" ? "Nederland" : "Netherlands"}</p>
            <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> riki@dancehealthy.net</p>
            <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> +31 6 841 86452</p>
          </CardContent>
          <CardFooter className="border-t border-border/40 pt-3">
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:riki@dancehealthy.net">
                <Mail className="w-3.5 h-3.5 mr-1.5" />
                {lang === "nl" ? "Stuur e-mail" : "Email Us"}
              </a>
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10"><Scale className="w-4 h-4 text-amber-500" /></span>
              {lang === "nl" ? "Toezichthoudende autoriteit (AP)" : "Supervisory Authority (AP)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground">Autoriteit Persoonsgegevens</p>
            <p>Postbus 93374, 2509 AJ Den Haag</p>
            <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> www.autoriteitpersoonsgegevens.nl</p>
            <p className="text-xs text-muted-foreground italic mt-2">
              {lang === "nl"
                ? "U heeft het recht een klacht in te dienen bij de AP als u denkt dat uw gegevensbeschermingsrechten zijn geschonden."
                : "You have the right to lodge a complaint with the AP if you believe your data rights have been violated."}
            </p>
          </CardContent>
          <CardFooter className="border-t border-border/40 pt-3">
            <Button variant="outline" size="sm" asChild>
              <a href="https://www.autoriteitpersoonsgegevens.nl" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                {lang === "nl" ? "Bezoek AP" : "Visit AP"}
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
