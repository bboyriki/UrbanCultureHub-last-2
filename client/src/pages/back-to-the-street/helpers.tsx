import { useState } from "react";
import { Trophy, Disc3, Mic2, Star, Zap, Users, X, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const FIRE      = "from-orange-500 via-red-500 to-yellow-400";
export const FIRE_TEXT = "from-orange-400 via-red-400 to-yellow-300";

export function typeIcon(type: string) {
  switch (type) {
    case "battle":      return <Trophy className="w-4 h-4 text-orange-400" />;
    case "dj":          return <Disc3  className="w-4 h-4 text-blue-400"   />;
    case "performance": return <Mic2   className="w-4 h-4 text-pink-400"   />;
    case "special":     return <Star   className="w-4 h-4 text-yellow-400" />;
    default:            return <Zap    className="w-4 h-4 text-white/50"   />;
  }
}

export function typeBadge(type: string) {
  const m: Record<string,string> = { battle:"bg-orange-500/20 text-orange-300 border-orange-500/30", dj:"bg-blue-500/20 text-blue-300 border-blue-500/30", performance:"bg-pink-500/20 text-pink-300 border-pink-500/30", special:"bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
  return m[type] ?? "bg-white/10 text-white/50 border-white/10";
}

export function categoryIcon(cat: string) {
  const m: Record<string,React.ReactNode> = { organizer:<Star className="w-4 h-4"/>, dj:<Disc3 className="w-4 h-4"/>, judge:<Trophy className="w-4 h-4"/>, performer:<Mic2 className="w-4 h-4"/>, crew:<Users className="w-4 h-4"/>, host:<Mic2 className="w-4 h-4"/> };
  return m[cat] ?? <Users className="w-4 h-4" />;
}

export function categoryColor(cat: string) {
  const m: Record<string,string> = { organizer:"text-yellow-400 bg-yellow-500/10 border-yellow-500/20", dj:"text-blue-400 bg-blue-500/10 border-blue-500/20", judge:"text-orange-400 bg-orange-500/10 border-orange-500/20", performer:"text-pink-400 bg-pink-500/10 border-pink-500/20", crew:"text-green-400 bg-green-500/10 border-green-500/20", host:"text-purple-400 bg-purple-500/10 border-purple-500/20" };
  return m[cat] ?? "text-white/60 bg-white/5 border-white/10";
}

export function initials(name: string) { return name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(); }

export function statusColor(s: string) {
  if (s==="completed") return "text-green-300 border-green-500/30 bg-green-500/10";
  if (s==="live")      return "text-yellow-300 border-yellow-500/30 bg-yellow-500/10 animate-pulse";
  return "text-white/30 border-white/10";
}

export function BioExpandable({ bio, lines = 2, className = "" }: { bio: string; lines?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const clamp = lines === 1 ? "line-clamp-1" : lines === 3 ? "line-clamp-3" : "line-clamp-2";
  if (!bio) return null;
  const isLong = bio.length > 100;
  return (
    <>
      <p className={`${clamp} ${className}`}>{bio}</p>
      {isLong && (
        <button
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          className="text-[10px] text-orange-400/60 hover:text-orange-300 mt-0.5 transition-colors"
        >
          Read more
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-[#111118] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"><X className="w-4 h-4"/></button>
            <p className="text-white/75 text-sm leading-relaxed">{bio}</p>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteConfirm({ open, label, onConfirm, onCancel, isPending }: { open:boolean; label:string; onConfirm:()=>void; onCancel:()=>void; isPending?:boolean }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="bg-[#0d1117] border-white/10 text-white max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-400"><AlertTriangle className="w-5 h-5"/>Delete?</DialogTitle></DialogHeader>
        <p className="text-white/60 text-sm">Delete <span className="text-white font-semibold">"{label}"</span>? This cannot be undone.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} className="border-white/10 text-white hover:bg-white/5">Cancel</Button>
          <Button onClick={onConfirm} disabled={isPending} className="bg-red-500 hover:bg-red-600 text-white border-0">{isPending ? "Deleting…" : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
