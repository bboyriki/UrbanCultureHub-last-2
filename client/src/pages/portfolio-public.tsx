import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Loader2, Briefcase, Globe, Mail, ExternalLink } from "lucide-react";

export default function PortfolioPublic() {
  const [, params] = useRoute<{ slug: string }>("/p/:slug");
  const slug = params?.slug;
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/career/public", slug],
    queryFn: () => fetch(`/api/career/public/${slug}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    enabled: !!slug,
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center text-center"><div><p className="text-xl font-semibold">Portfolio not found</p><p className="text-sm text-muted-foreground">This portfolio doesn't exist or isn't public.</p></div></div>;

  const p = data.profile;
  const projects = data.projects || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-950 via-slate-950 to-black text-white" data-testid="page-portfolio-public">
      {/* Hero */}
      <div className="relative">
        {p.coverUrl && <div className="h-64 bg-cover bg-center opacity-50" style={{ backgroundImage: `url(${p.coverUrl})` }} />}
        <div className="container max-w-4xl mx-auto p-8">
          <div className="flex items-start gap-6">
            {p.avatarUrl && <img src={p.avatarUrl} alt={p.fullName} className="w-24 h-24 rounded-full object-cover border-2 border-violet-500" />}
            <div className="flex-1">
              <h1 className="text-4xl font-bold">{p.fullName}</h1>
              <p className="text-lg text-violet-300 mt-1">{p.headline}</p>
              {p.location && <p className="text-sm text-slate-400 mt-1">📍 {p.location}</p>}
              <div className="flex gap-3 mt-3">
                {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="text-xs text-violet-300 hover:underline flex items-center gap-1"><Globe className="w-3 h-3" />Website</a>}
                {p.socials?.linkedin && <a href={p.socials.linkedin} target="_blank" rel="noreferrer" className="text-xs text-violet-300 hover:underline flex items-center gap-1">LinkedIn</a>}
                {p.socials?.instagram && <a href={`https://instagram.com/${p.socials.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="text-xs text-violet-300 hover:underline">Instagram</a>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto p-8 space-y-12">
        {p.positioning && <section>
          <h2 className="text-xl font-semibold mb-3 text-violet-300">About</h2>
          <p className="text-lg leading-relaxed italic">"{p.positioning}"</p>
        </section>}

        {p.story && <section>
          <h2 className="text-xl font-semibold mb-3 text-violet-300">Story</h2>
          <p className="whitespace-pre-line leading-relaxed">{p.story}</p>
        </section>}

        {(p.uniqueValueProps || []).length > 0 && <section>
          <h2 className="text-xl font-semibold mb-3 text-violet-300">What makes me different</h2>
          <ul className="space-y-2">{p.uniqueValueProps.map((u: string, i: number) => <li key={i} className="flex gap-2"><span className="text-violet-500">→</span>{u}</li>)}</ul>
        </section>}

        {(p.ventures || []).length > 0 && <section>
          <h2 className="text-xl font-semibold mb-3 text-violet-300">Ventures</h2>
          <div className="grid md:grid-cols-2 gap-4">{(p.ventures).map((v: any, i: number) => (
            <div key={i} className="border border-violet-500/30 rounded-lg p-4 bg-white/5">
              <div className="font-semibold text-lg">{v.name}</div>
              <div className="text-sm text-violet-300">{v.role} · {v.period}</div>
              <p className="text-sm mt-2">{v.summary}</p>
              {v.impact && <p className="text-xs text-emerald-300 mt-2">📈 {v.impact}</p>}
            </div>
          ))}</div>
        </section>}

        {projects.length > 0 && <section>
          <h2 className="text-xl font-semibold mb-3 text-violet-300">Projects</h2>
          <div className="grid md:grid-cols-2 gap-4">{projects.map((pr: any) => (
            <div key={pr.id} className={`border rounded-lg p-4 ${pr.highlight ? "border-violet-500 bg-violet-500/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-violet-400" /><div className="font-semibold">{pr.title}</div></div>
              {pr.period && <div className="text-xs text-slate-400">{pr.period}</div>}
              {pr.summary && <p className="text-sm mt-2">{pr.summary}</p>}
              {pr.impact && <p className="text-xs text-emerald-300 mt-2">{pr.impact}</p>}
            </div>
          ))}</div>
        </section>}

        {(p.strengths || []).length > 0 && <section>
          <h2 className="text-xl font-semibold mb-3 text-violet-300">Strengths</h2>
          <div className="flex flex-wrap gap-2">{p.strengths.map((s: string) => <span key={s} className="px-3 py-1 rounded-full bg-violet-500/20 text-violet-200 text-sm">{s}</span>)}</div>
        </section>}

        {(p.skills || []).length > 0 && <section>
          <h2 className="text-xl font-semibold mb-3 text-violet-300">Skills</h2>
          <div className="flex flex-wrap gap-2">{p.skills.map((s: any) => <span key={s.name} className="px-3 py-1 rounded-full bg-white/10 text-sm">{s.name}</span>)}</div>
        </section>}

        {(p.languages || []).length > 0 && <section>
          <h2 className="text-xl font-semibold mb-3 text-violet-300">Languages</h2>
          <p>{p.languages.map((l: any) => `${l.name}${l.level ? ` (${l.level})` : ""}`).join(" · ")}</p>
        </section>}

        {(p.achievements || []).length > 0 && <section>
          <h2 className="text-xl font-semibold mb-3 text-violet-300">Achievements</h2>
          <ul className="space-y-1">{p.achievements.map((a: any, i: number) => <li key={i}>🏆 {typeof a === "string" ? a : a.title}</li>)}</ul>
        </section>}

        <section className="border-t border-violet-500/30 pt-8 text-center">
          <p className="text-sm text-slate-400 mb-2">Want to work together?</p>
          {p.website && <a href={`mailto:${p.email || ""}`} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-violet-600 hover:bg-violet-700 transition"><Mail className="w-4 h-4" />Get in touch</a>}
        </section>
      </div>
    </div>
  );
}
