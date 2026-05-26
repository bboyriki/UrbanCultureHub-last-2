import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Paintbrush, Plus, Type, Image, Trash2, Info } from "lucide-react";
import CultureSectionInfo from "@/components/culture/CultureSectionInfo";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

const COLORS = ["#ff6b6b","#ffd93d","#6bcb77","#4d96ff","#c77dff","#ff9f1c","#ffffff","#ff4d6d","#00b4d8","#06d6a0"];
const STICKER_EMOJIS = ["🔥","⚡","💯","🎵","🎨","👊","🌀","💎","🚀","✨","🎯","👑","🕺","🎤","🎧","💪","🦁","🌊","⭐","🎭"];

export default function GraffitiWallPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addType, setAddType] = useState<"sticker"|"text"|"image">("sticker");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState("🔥");
  const [textContent, setText] = useState("");
  const [color, setColor] = useState("#ff6b6b");
  const [imageUrl, setImageUrl] = useState("");

  const { data: tags, isLoading } = useQuery<any[]>({ queryKey: ["/api/graffiti"] });

  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/graffiti", "POST", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/graffiti"] }); setDialogOpen(false); toast({ title: "Tag added! +5 Cred 🎨" }); },
    onError: () => toast({ title: "Failed to add tag", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/graffiti/${id}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/graffiti"] }),
  });

  const handleAdd = () => {
    const payload: any = {
      type: addType,
      posX: Math.random() * 80 + 5,
      posY: Math.random() * 70 + 5,
      rotation: (Math.random() - 0.5) * 30,
      scale: 0.8 + Math.random() * 0.6,
      color,
    };
    if (addType === "sticker") payload.text = selectedEmoji;
    else if (addType === "text") payload.text = textContent;
    else payload.imageUrl = imageUrl;
    addMutation.mutate(payload);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2"><Paintbrush className="w-6 h-6 text-cyan-400" /> Graffiti Wall</h1>
          <div className="mt-2"><CultureSectionInfo section="graffiti" /></div>
          <p className="text-muted-foreground text-sm">A collaborative canvas. Add your tag. Leave your mark.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Info className="w-3 h-3" />{tags?.length ?? 0} tags</div>
          {user && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="btn-add-tag"><Plus className="w-4 h-4 mr-1" /> Add Tag</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add to the Wall</DialogTitle>
                  <DialogDescription className="sr-only">Add a sticker, text tag, or image to the community graffiti wall.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    {(["sticker","text","image"] as const).map(t => (
                      <Button key={t} size="sm" variant={addType === t ? "default" : "outline"} onClick={() => setAddType(t)} className="capitalize">{t}</Button>
                    ))}
                  </div>
                  {addType === "sticker" && (
                    <div className="space-y-2">
                      <Label>Pick an emoji</Label>
                      <div className="grid grid-cols-10 gap-1">
                        {STICKER_EMOJIS.map(e => (
                          <button key={e} onClick={() => setSelectedEmoji(e)}
                            className={`text-2xl p-1 rounded transition-all ${selectedEmoji === e ? "bg-primary/20 scale-125" : "hover:bg-muted"}`}
                            data-testid={`emoji-${e}`}>{e}</button>
                        ))}
                      </div>
                      <div className="text-center text-4xl py-2">{selectedEmoji}</div>
                    </div>
                  )}
                  {addType === "text" && (
                    <div className="space-y-2">
                      <Label>Your text / tag</Label>
                      <Input value={textContent} onChange={e => setText(e.target.value)} placeholder="Write your tag..." maxLength={30} data-testid="input-graffiti-text" />
                    </div>
                  )}
                  {addType === "image" && (
                    <div className="space-y-2">
                      <Label>Image URL</Label>
                      <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." data-testid="input-graffiti-image" />
                    </div>
                  )}
                  {addType === "text" && (
                    <div className="space-y-2">
                      <Label>Color</Label>
                      <div className="flex gap-2 flex-wrap">
                        {COLORS.map(c => (
                          <button key={c} onClick={() => setColor(c)}
                            style={{ background: c }}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-white scale-125" : "border-transparent"}`} />
                        ))}
                      </div>
                    </div>
                  )}
                  <Button className="w-full" onClick={handleAdd} disabled={addMutation.isPending || (addType === "text" && !textContent) || (addType === "image" && !imageUrl)} data-testid="btn-submit-tag">
                    {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Paintbrush className="w-4 h-4 mr-2" />} Drop Tag
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* The Wall */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : (
        <div className="relative w-full bg-gradient-to-br from-gray-900 via-slate-900 to-black rounded-2xl overflow-hidden border border-border/30" style={{ minHeight: "600px" }}>
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

          {!tags?.length && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <Paintbrush className="w-16 h-16 opacity-20 mb-4" />
              <p className="text-lg font-medium opacity-40">The wall is empty.</p>
              <p className="text-sm opacity-30">Add your tag and start the movement.</p>
            </div>
          )}

          {tags?.map((tag: any) => {
            const isOwn = tag.user_id === user?.id;
            return (
              <div
                key={tag.id}
                data-testid={`graffiti-tag-${tag.id}`}
                className="absolute group cursor-default select-none"
                style={{ left: `${tag.pos_x}%`, top: `${tag.pos_y}%`, transform: `rotate(${tag.rotation}deg) scale(${tag.scale})`, transformOrigin: "center" }}
              >
                {tag.type === "sticker" && <div className="text-4xl drop-shadow-lg">{tag.text}</div>}
                {tag.type === "text" && (
                  <div className="font-black text-lg drop-shadow-lg" style={{ color: tag.color || "#fff", textShadow: "0 0 10px currentColor, 0 2px 4px rgba(0,0,0,0.8)" }}>
                    {tag.text}
                  </div>
                )}
                {tag.type === "image" && tag.image_url && (
                  <img src={tag.image_url} alt="" className="w-20 h-20 object-cover rounded shadow-lg" />
                )}
                {isOwn && (
                  <button
                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    onClick={() => deleteMutation.mutate(tag.id)}
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Tags */}
      {(tags?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground">Recent Tags</h2>
          <div className="flex gap-2 flex-wrap">
            {tags?.slice(-10).reverse().map((tag: any) => (
              <div key={tag.id} className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-full text-sm">
                {tag.type === "sticker" ? <span>{tag.text}</span> : tag.type === "text" ? <span style={{ color: tag.color }}>"{tag.text}"</span> : <Image className="w-3 h-3" />}
                <span className="text-muted-foreground text-xs">by {tag.display_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
