import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, SendIcon, CheckIcon, Users, FileText, Bell } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TermsOfServiceDisplay from "../legal/TermsOfServiceDisplay";

export default function SystemMessaging() {
  const [activeTab, setActiveTab] = useState<string>("terms-prompt");
  const [title, setTitle] = useState<string>("Terms of Service");
  const [message, setMessage] = useState<string>("Please review our updated Terms of Service");
  const [requireAction, setRequireAction] = useState<boolean>(true);
  const [recipientType, setRecipientType] = useState<string>("all");
  const [termsVersion, setTermsVersion] = useState<string>("current");
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const { toast } = useToast();

  // Handle submission of terms prompt to users
  const handleSendTermsPrompt = async () => {
    setIsSending(true);
    try {
      const response = await apiRequest({
        url: "/api/admin/system-message",
        method: "POST",
        data: {
          type: "terms-prompt",
          title,
          message,
          requireAction,
          recipientType,
          termsVersion
        }
      });

      toast({
        title: "Terms prompt sent",
        description: "The terms of service prompt has been sent to the selected users.",
        variant: "default",
      });

      // Reset confirmation state
      setIsConfirming(false);
    } catch (error) {
      console.error("Failed to send terms prompt:", error);
      toast({
        title: "Failed to send terms prompt",
        description: "There was an error sending the terms prompt. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle sending system notification
  const handleSendNotification = async () => {
    setIsSending(true);
    try {
      const response = await apiRequest({
        url: "/api/admin/system-message",
        method: "POST",
        data: {
          type: "notification",
          title,
          message,
          recipientType
        }
      });

      toast({
        title: "Notification sent",
        description: "System notification has been sent to the selected users.",
        variant: "default",
      });

      // Reset confirmation state
      setIsConfirming(false);
    } catch (error) {
      console.error("Failed to send notification:", error);
      toast({
        title: "Failed to send notification",
        description: "There was an error sending the notification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const recipientOptions = [
    { value: "all", label: "All Users" },
    { value: "active", label: "Active Users Only" },
    { value: "notAccepted", label: "Users Who Haven't Accepted Latest Terms" },
    { value: "artists", label: "Artists" },
    { value: "enthusiasts", label: "Enthusiasts" },
    { value: "schools", label: "Schools" },
    { value: "municipalities", label: "Municipalities" }
  ];

  const handleConfirm = () => {
    setIsConfirming(true);
  };

  const handleCancel = () => {
    setIsConfirming(false);
  };

  const handleSubmit = () => {
    if (activeTab === "terms-prompt") {
      handleSendTermsPrompt();
    } else {
      handleSendNotification();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold">System Messaging</h2>
          <p className="text-muted-foreground mt-1">
            Send terms of service prompts or system notifications to users
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="terms-prompt" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Terms of Service Prompt
          </TabsTrigger>
          <TabsTrigger value="notification" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            System Notification
          </TabsTrigger>
        </TabsList>

        <TabsContent value="terms-prompt" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Send Terms of Service Prompt</CardTitle>
              <CardDescription>
                This will display a modal to users requiring them to accept the terms of service
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Terms of Service Update"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message">Message to Users</Label>
                    <Textarea
                      id="message"
                      placeholder="Please review our updated terms of service..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms-version">Terms Version</Label>
                  <Select 
                    value={termsVersion} 
                    onValueChange={setTermsVersion}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select terms version" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="current">Current Version</SelectItem>
                        <SelectItem value="draft">Latest Draft (if available)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipients">Recipients</Label>
                  <Select 
                    value={recipientType} 
                    onValueChange={setRecipientType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {recipientOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="require-action"
                    checked={requireAction}
                    onCheckedChange={setRequireAction}
                  />
                  <Label htmlFor="require-action">
                    Require user action (users must accept to continue)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="preview-mode"
                    checked={previewMode}
                    onCheckedChange={setPreviewMode}
                  />
                  <Label htmlFor="preview-mode">
                    Preview Terms Display
                  </Label>
                </div>
              </div>

              {previewMode && (
                <div className="mt-6 border rounded-md p-4">
                  <h3 className="text-lg font-medium mb-4">Preview</h3>
                  <TermsOfServiceDisplay previewMode={true} termsVersion={termsVersion} />
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-between">
              {isConfirming ? (
                <Alert variant="destructive" className="w-full">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Confirm Action</AlertTitle>
                  <AlertDescription>
                    This will immediately prompt users with the terms of service. Are you sure?
                  </AlertDescription>
                  <div className="flex gap-2 mt-4">
                    <Button variant="destructive" onClick={handleSubmit} disabled={isSending}>
                      {isSending ? "Sending..." : "Yes, Send Now"}
                    </Button>
                    <Button variant="outline" onClick={handleCancel} disabled={isSending}>
                      Cancel
                    </Button>
                  </div>
                </Alert>
              ) : (
                <Button onClick={handleConfirm} className="ml-auto">
                  <SendIcon className="mr-2 h-4 w-4" /> Send Terms Prompt
                </Button>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="notification" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Send System Notification</CardTitle>
              <CardDescription>
                This will send a notification to users without requiring action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="notif-title">Title</Label>
                    <Input
                      id="notif-title"
                      placeholder="System Notification"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notif-message">Message</Label>
                    <Textarea
                      id="notif-message"
                      placeholder="Your notification message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notif-recipients">Recipients</Label>
                  <Select 
                    value={recipientType} 
                    onValueChange={setRecipientType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select recipients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {recipientOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-6 flex justify-between">
              {isConfirming ? (
                <Alert variant="destructive" className="w-full">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Confirm Action</AlertTitle>
                  <AlertDescription>
                    This will send notifications to {recipientType === 'all' ? 'all users' : 'selected users'}. Continue?
                  </AlertDescription>
                  <div className="flex gap-2 mt-4">
                    <Button variant="destructive" onClick={handleSubmit} disabled={isSending}>
                      {isSending ? "Sending..." : "Yes, Send Now"}
                    </Button>
                    <Button variant="outline" onClick={handleCancel} disabled={isSending}>
                      Cancel
                    </Button>
                  </div>
                </Alert>
              ) : (
                <Button onClick={handleConfirm} className="ml-auto">
                  <SendIcon className="mr-2 h-4 w-4" /> Send Notification
                </Button>
              )}
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}