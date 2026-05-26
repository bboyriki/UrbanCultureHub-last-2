import { useState } from "react";
import { useAI } from "@/hooks/use-ai";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Copy, CheckCircle2 } from "lucide-react";

type ContentType = "event" | "post" | "service";

export function ContentSuggestion() {
  const [contentType, setContentType] = useState<ContentType>("post");
  const [keywords, setKeywords] = useState("");
  const [style, setStyle] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  
  const { isLoading, generateContentSuggestion } = useAI();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!keywords.trim()) {
      toast({
        title: "Keywords Required",
        description: "Please enter at least one keyword.",
        variant: "destructive"
      });
      return;
    }
    
    setSuggestion("");
    const keywordsList = keywords.split(',').map(k => k.trim()).filter(Boolean);
    
    try {
      const result = await generateContentSuggestion({
        contentType,
        keywords: keywordsList,
        style: style.trim() || undefined
      });
      
      setSuggestion(result);
    } catch (error) {
      // Error is already handled in the hook
      console.error("Content suggestion failed:", error);
    }
  };
  
  const copyToClipboard = () => {
    if (suggestion) {
      navigator.clipboard.writeText(suggestion);
      setIsCopied(true);
      toast({
        title: "Copied to Clipboard",
        description: "Content suggestion copied to clipboard",
      });
      
      // Reset copy state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }
  };
  
  const contentTypeLabels = {
    post: "Social Media Post",
    event: "Event Description",
    service: "Service Description"
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Content Generator
        </CardTitle>
        <CardDescription>
          Generate creative content for posts, events, or services
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contentType">Content Type</Label>
                <Select 
                  value={contentType} 
                  onValueChange={(value) => setContentType(value as ContentType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="post">{contentTypeLabels.post}</SelectItem>
                      <SelectItem value="event">{contentTypeLabels.event}</SelectItem>
                      <SelectItem value="service">{contentTypeLabels.service}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="keywords">Keywords (comma separated)</Label>
                <Input
                  id="keywords"
                  placeholder="e.g. graffiti, workshop, urban"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="style">Style (optional)</Label>
                <Input
                  id="style"
                  placeholder="e.g. professional, casual, enthusiastic"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={isLoading || !keywords.trim()} 
                className="w-full"
              >
                {isLoading ? 'Generating...' : 'Generate Content'}
              </Button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="suggestion">Generated Suggestion</Label>
                {suggestion && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={copyToClipboard}
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  >
                    {isCopied ? (
                      <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    {isCopied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </div>
              <Textarea
                id="suggestion"
                placeholder={isLoading ? "Generating suggestion..." : "Your generated content will appear here"}
                value={suggestion}
                readOnly
                className="min-h-[200px] resize-none"
              />
              {suggestion && (
                <p className="text-xs text-muted-foreground mt-2">
                  Feel free to edit the generated content to better match your needs.
                </p>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}