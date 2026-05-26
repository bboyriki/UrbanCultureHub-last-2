import { ContentSuggestion } from "@/components/ai/ContentSuggestion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { BrainCircuit, Lightbulb, Sparkles, Bot, Search, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { useAI } from "@/hooks/use-ai";

export default function AIToolsPage() {
  const [activeTab, setActiveTab] = useState("content");
  const [analysisText, setAnalysisText] = useState("");
  const [analysisResult, setAnalysisResult] = useState<{
    sentiment: string;
    topics: string[];
    keywords: string[];
  } | null>(null);
  
  const { isLoading, analyzeContent: analyzeContentAI } = useAI();

  const analyzeContent = async () => {
    if (!analysisText.trim()) {
      toast({
        title: "Text Required",
        description: "Please enter some text to analyze.",
        variant: "destructive"
      });
      return;
    }

    setAnalysisResult(null);
    const result = await analyzeContentAI(analysisText);
    
    if (result) {
      setAnalysisResult(result);
      toast({
        title: "Analysis Complete",
        description: "Your content has been analyzed.",
      });
    }
  };

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return '😃';
      case 'negative':
        return '😞';
      case 'neutral':
        return '😐';
      default:
        return '';
    }
  };

  return (
    <div className="container py-10">
      <div className="flex items-center mb-8">
        <BrainCircuit className="mr-2 h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">AI Tools</h1>
      </div>
      
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Enhance your urban culture experience with our AI-powered tools. 
        Generate creative content, analyze text, and get personalized recommendations.
      </p>
      
      <div className="bg-muted p-4 rounded-lg mb-8 max-w-2xl">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          AI Service Status
        </h2>
        <p className="text-sm text-muted-foreground">
          These AI features require an OpenAI API key to function. If you encounter a service
          unavailable message, please contact the administrator to configure the API key.
        </p>
      </div>

      <Tabs defaultValue="content" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-8">
          <TabsTrigger value="content" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>Content Generator</span>
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>Content Analysis</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="content" className="mt-6">
          <div className="grid md:grid-cols-1 lg:grid-cols-1 gap-8">
            <ContentSuggestion />
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Content Analysis
                </CardTitle>
                <CardDescription>
                  Analyze text for sentiment, topics, and keywords
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Enter text to analyze..."
                  value={analysisText}
                  onChange={(e) => setAnalysisText(e.target.value)}
                  className="min-h-[200px]"
                />
                <Button
                  onClick={analyzeContent}
                  disabled={isLoading || !analysisText.trim()}
                  className="w-full"
                >
                  {isLoading ? 'Analyzing...' : 'Analyze Content'}
                </Button>
              </CardContent>
            </Card>

            <Card className={`${!analysisResult ? 'hidden md:block opacity-50' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Analysis Results
                </CardTitle>
                <CardDescription>
                  Insights extracted from your content
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisResult ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-2 flex items-center">
                        Sentiment {getSentimentEmoji(analysisResult.sentiment)}
                      </h3>
                      <div className="text-muted-foreground">
                        {analysisResult.sentiment}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-2">Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.topics.map((topic, index) => (
                          <span key={index} className="px-2 py-1 bg-secondary rounded-md text-sm">
                            {topic}
                          </span>
                        ))}
                        {analysisResult.topics.length === 0 && (
                          <span className="text-muted-foreground">No topics detected</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-2">Keywords</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.keywords.map((keyword, index) => (
                          <span key={index} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                            {keyword}
                          </span>
                        ))}
                        {analysisResult.keywords.length === 0 && (
                          <span className="text-muted-foreground">No keywords detected</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquareText className="mx-auto h-12 w-12 mb-4 opacity-20" />
                    <p>Analysis results will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}