import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Phone,
  UserPlus,
  X,
  Radio,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Send,
  Shield,
} from "lucide-react";

interface TrustedContact {
  id: number;
  contactUserId: number;
  displayName: string;
  profilePicture?: string;
  role: string;
  status: string;
}

interface SafetyBroadcast {
  id: number;
  message: string;
  city?: string;
  broadcastScope: string;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

interface SafetyPanelProps {
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
}

export default function SafetyPanel({ userLocation, onClose }: SafetyPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [searchUserId, setSearchUserId] = useState("");
  const [showBroadcastConfirm, setShowBroadcastConfirm] = useState(false);
  const [contactToRemove, setContactToRemove] = useState<number | null>(null);

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<TrustedContact[]>({
    queryKey: ["/api/safety/contacts"],
    enabled: !!user,
  });

  const { data: broadcasts = [], isLoading: broadcastsLoading } = useQuery<SafetyBroadcast[]>({
    queryKey: ["/api/safety/broadcasts"],
    enabled: !!user,
  });

  const addContactMutation = useMutation({
    mutationFn: (contactUserId: number) =>
      apiRequest("/api/safety/contacts", "POST", { contactUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safety/contacts"] });
      setSearchUserId("");
      toast({ title: "Trusted contact added", description: "They will need to confirm the request." });
    },
    onError: () => {
      toast({ title: "Failed to add contact", variant: "destructive" });
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: (contactId: number) => apiRequest(`/api/safety/contacts/${contactId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safety/contacts"] });
      toast({ title: "Contact removed" });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/safety/broadcast", "POST", {
        message: broadcastMessage || "I need help",
        lat: userLocation?.lat,
        lng: userLocation?.lng,
        broadcastScope: "trusted_contacts",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safety/broadcasts"] });
      setBroadcastMessage("");
      setShowBroadcastConfirm(false);
      toast({
        title: "Safety broadcast sent",
        description: "Your trusted contacts have been notified.",
      });
    },
    onError: () => {
      toast({ title: "Failed to send broadcast", variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (broadcastId: number) =>
      apiRequest(`/api/safety/broadcasts/${broadcastId}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/safety/broadcasts"] });
      toast({ title: "Broadcast cancelled" });
    },
  });

  const handleAddContact = () => {
    const id = parseInt(searchUserId.trim());
    if (!id || isNaN(id)) {
      toast({ title: "Enter a valid user ID", variant: "destructive" });
      return;
    }
    addContactMutation.mutate(id);
  };

  return (
    <Sheet open={true} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-safety-panel">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Safety Panel
          </SheetTitle>
          <SheetDescription>
            Manage your trusted contacts and safety broadcasts.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <Phone className="w-6 h-6 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-red-700">Emergency: Call 112</p>
                <p className="text-sm text-red-600 mt-1">
                  If you are in immediate danger, call emergency services. This app is not an emergency service.
                </p>
                <a
                  href="tel:112"
                  className="mt-3 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg text-sm"
                  data-testid="link-emergency-112"
                >
                  <Phone className="w-4 h-4" />
                  Call 112 Now
                </a>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-orange-500" />
                Notify Trusted Contacts
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              This is <strong>not an emergency service</strong>. Use this to let your trusted contacts know your situation. Always call 112 first if you are in immediate danger.
            </p>
            {broadcasts.filter((b) => b.isActive).length > 0 ? (
              <div className="space-y-2">
                {broadcasts
                  .filter((b) => b.isActive)
                  .map((broadcast) => (
                    <div
                      key={broadcast.id}
                      className="flex items-start justify-between gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200"
                      data-testid={`card-broadcast-${broadcast.id}`}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">Active broadcast</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{broadcast.message}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(broadcast.expiresAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deactivateMutation.mutate(broadcast.id)}
                        disabled={deactivateMutation.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`button-cancel-broadcast-${broadcast.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  placeholder="Optional message (e.g. 'I'm at the skate park, feeling unsafe')"
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="text-sm resize-none"
                  rows={2}
                  data-testid="textarea-broadcast-message"
                />
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setShowBroadcastConfirm(true)}
                  disabled={contacts.length === 0 || broadcastMutation.isPending}
                  data-testid="button-send-broadcast"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Notify my trusted contacts
                </Button>
                {contacts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Add trusted contacts below to use this feature
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Trusted Contacts ({contacts.length})
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="User ID number"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                type="number"
                className="text-sm"
                data-testid="input-trusted-contact-id"
              />
              <Button
                size="sm"
                onClick={handleAddContact}
                disabled={addContactMutation.isPending}
                data-testid="button-add-trusted-contact"
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the user ID of someone you trust. You can find user IDs on their profile page.
            </p>
            {contactsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : contacts.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No trusted contacts yet. Add people you trust to enable safety broadcasts.
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    data-testid={`card-contact-${contact.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={contact.profilePicture || ""} />
                        <AvatarFallback className="text-xs">
                          {contact.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium" data-testid={`text-contact-name-${contact.id}`}>
                          {contact.displayName}
                        </p>
                        <Badge
                          variant={contact.status === "confirmed" ? "default" : "secondary"}
                          className="text-xs mt-0.5"
                          data-testid={`badge-contact-status-${contact.id}`}
                        >
                          {contact.status === "confirmed" ? "Confirmed" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setContactToRemove(contact.id)}
                      className="text-muted-foreground hover:text-red-600"
                      data-testid={`button-remove-contact-${contact.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>

      <AlertDialog open={showBroadcastConfirm} onOpenChange={setShowBroadcastConfirm}>
        <AlertDialogContent data-testid="dialog-broadcast-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Send safety notification?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will notify your {contacts.filter((c) => c.status === "confirmed").length} confirmed trusted contact(s) that you need assistance. Remember: call 112 if you are in immediate danger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-broadcast-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => broadcastMutation.mutate()}
              disabled={broadcastMutation.isPending}
              data-testid="button-broadcast-confirm"
            >
              <Send className="w-4 h-4 mr-2" />
              Send notification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={contactToRemove !== null} onOpenChange={(v) => !v && setContactToRemove(null)}>
        <AlertDialogContent data-testid="dialog-remove-contact">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove trusted contact?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer receive your safety broadcasts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (contactToRemove) {
                  removeContactMutation.mutate(contactToRemove);
                  setContactToRemove(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-remove-contact"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
