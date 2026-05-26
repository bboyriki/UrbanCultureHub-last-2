import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, X, AlertTriangle, Loader2, RotateCcw, Search, QrCode, Swords } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TicketDetails {
  ticket: {
    id: number;
    eventId: number;
    userId: number;
    purchaseAmount: number;
    paymentIntentId: string;
    qrCode: string;
    isUsed: boolean;
    createdAt: string;
  };
  event: {
    id: number;
    title: string;
    date: string;
    location: string;
  };
  user: {
    id: number;
    displayName: string;
    email: string;
  };
}

interface ValidationResult {
  valid: boolean;
  message: string;
  details?: TicketDetails;
  alreadyUsed?: boolean;
  ticketId?: number;
  ticketNumber?: string;
  scanCount?: number;
  lastScanned?: string;
  firstCheckedIn?: string;
  scanHistory?: Array<{
    timestamp: string;
    location?: string;
    operatorType?: string;
    deviceInfo?: any;
  }>;
  ticketType?: string;
  ticketInfo?: {
    type?: string;
    eventTitle?: string;
    eventDate?: string;
    purchaseAmount?: number;
    ticketQuantity?: number;
    ticketName?: string;
    holderName?: string;
    holderEmail?: string;
    purchaseId?: number;
    spotNumber?: number;
    amountPaid?: string;
    battleFormat?: string;
    user?: {
      displayName?: string;
      email?: string;
    }
  };
  debug?: {
    qrFormat?: string;
    parseAttempted?: boolean;
    parseResult?: string;
    lookupMethod?: string;
    extractedId?: number;
    parseError?: string;
    [key: string]: any;
  };
}

const TicketScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [manualId, setManualId] = useState("");
  const [isManualLooking, setIsManualLooking] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanner = async () => {
    try {
      setIsScanning(true);
      setValidationResult(null);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current = null;
      }
      setTimeout(async () => {
        try {
          scannerRef.current = new Html5Qrcode("qr-reader");
          await scannerRef.current.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            () => {}
          );
        } catch {
          toast({ title: "Camera Error", description: "Failed to access camera. Check permissions.", variant: "destructive" });
          setIsScanning(false);
        }
      }, 100);
    } catch {
      toast({ title: "Scanner Error", description: "Failed to start QR scanner.", variant: "destructive" });
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try { await scannerRef.current.stop(); } catch {}
      setIsScanning(false);
    }
  };

  const getScannerInfo = () => ({
    deviceInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
    },
    scanTime: new Date().toISOString(),
    scannerType: "web-admin-scanner",
    operatorType: "admin",
  });

  const validate = async (qrCode: string) => {
    setIsProcessing(true);
    try {
      const response = await apiRequest("/api/tickets/validate", "POST", {
        qrCode,
        scannerInfo: getScannerInfo(),
      });
      const result = await response.json();
      setValidationResult(result);

      if (result.valid) {
        toast({ title: "✅ Checked In", description: result.message });
      } else if (result.alreadyUsed) {
        toast({ title: "⚠️ Already Scanned", description: result.message, variant: "destructive" });
      } else {
        toast({ title: "❌ Invalid Ticket", description: result.message || "QR code not recognized.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Validation Error", description: "Failed to validate ticket. Try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    await stopScanner();
    await validate(decodedText);
  };

  const handleManualLookup = async () => {
    const id = parseInt(manualId.trim(), 10);
    if (!id) return;
    setIsManualLooking(true);
    try {
      const res = await apiRequest(`/api/btts/ticket-purchases/${id}/lookup`, "GET");
      if (!res.ok) {
        toast({ title: "Not Found", description: `No BTTS purchase #${id} found.`, variant: "destructive" });
        return;
      }
      const { purchase, ticket } = await res.json();
      setValidationResult({
        valid: purchase.status === "confirmed" && !purchase.checkedIn,
        alreadyUsed: !!purchase.checkedIn,
        message: purchase.checkedIn
          ? `Already checked in (${purchase.scanCount ?? 0} scan(s))`
          : purchase.status === "confirmed"
            ? "Ticket is confirmed and ready for check-in"
            : `Ticket status: ${purchase.status}`,
        ticketType: "btts_ticket",
        scanCount: purchase.scanCount ?? 0,
        lastScanned: purchase.checkedIn ? purchase.checkedInAt : undefined,
        firstCheckedIn: purchase.checkedInAt ?? undefined,
        ticketInfo: {
          type: ticket?.type ?? "entry",
          ticketName: ticket?.name ?? "BTTS Ticket",
          holderName: purchase.guestName ?? undefined,
          holderEmail: purchase.guestEmail ?? undefined,
          purchaseId: purchase.id,
          spotNumber: purchase.spotNumber ?? undefined,
          amountPaid: purchase.amountPaid ?? "0",
          battleFormat: ticket?.battleFormat ?? undefined,
        },
      });
    } catch {
      toast({ title: "Error", description: "Failed to look up ticket.", variant: "destructive" });
    } finally {
      setIsManualLooking(false);
    }
  };

  const handleResetCheckin = async () => {
    const purchaseId = validationResult?.ticketInfo?.purchaseId;
    if (!purchaseId) return;
    setIsResetting(true);
    try {
      const res = await apiRequest(`/api/btts/ticket-purchases/${purchaseId}/reset-checkin`, "POST");
      if (!res.ok) {
        toast({ title: "Error", description: "Could not reset check-in.", variant: "destructive" });
        return;
      }
      toast({ title: "Check-In Reset", description: `Purchase #${purchaseId} has been reset.` });
      setValidationResult(prev => prev ? {
        ...prev,
        valid: true,
        alreadyUsed: false,
        scanCount: 0,
        lastScanned: undefined,
        firstCheckedIn: undefined,
        message: "Check-in has been reset — ticket is ready to scan again",
      } : null);
    } catch {
      toast({ title: "Error", description: "Failed to reset check-in.", variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const resetScanner = () => {
    setValidationResult(null);
    setManualId("");
    startScanner();
  };

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("en-NL", { dateStyle: "medium", timeStyle: "short" }) : "—";

  const isBtts = validationResult?.ticketType === "btts_ticket";

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">

      {/* Manual look-up row */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Manual Ticket Look-Up
          </CardTitle>
          <CardDescription>Enter a BTTS purchase ID to look up without scanning</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              data-testid="input-manual-purchase-id"
              placeholder="Purchase ID (e.g. 42)"
              value={manualId}
              onChange={e => setManualId(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleManualLookup()}
              type="number"
              min={1}
              className="max-w-xs"
            />
            <Button
              data-testid="button-manual-lookup"
              onClick={handleManualLookup}
              disabled={!manualId || isManualLooking}
              variant="outline"
            >
              {isManualLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look Up"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Camera scanner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Scanner
          </CardTitle>
          <CardDescription>Scan event ticket QR codes to check in attendees</CardDescription>
        </CardHeader>
        <CardContent>

          {!isScanning && !validationResult && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-center">
                <h3 className="font-medium text-lg">Ready to Scan</h3>
                <p className="text-muted-foreground text-sm">Supports BTTS battle spot tickets and regular event tickets</p>
              </div>
              <Button data-testid="button-start-scanning" onClick={startScanner} className="w-full md:w-auto">
                Start Scanning
              </Button>
            </div>
          )}

          {isScanning && !validationResult && (
            <div className="flex flex-col items-center space-y-4">
              <div id="qr-reader" ref={scannerContainerRef} className="w-full max-w-sm" />
              <p className="text-sm text-center text-muted-foreground">Position the QR code within the frame</p>
              <Button data-testid="button-cancel-scanning" variant="outline" onClick={stopScanner}>Cancel</Button>
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Validating ticket…</p>
            </div>
          )}

          {validationResult && !isProcessing && (
            <div className="space-y-4">
              {/* Status banner */}
              {validationResult.valid ? (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <AlertTitle className="text-green-700 dark:text-green-300">Checked In ✓</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    {validationResult.message}
                  </AlertDescription>
                </Alert>
              ) : validationResult.alreadyUsed ? (
                <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <AlertTitle className="text-amber-700 dark:text-amber-300">Already Checked In</AlertTitle>
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    {validationResult.message}
                    {validationResult.firstCheckedIn && (
                      <span className="block text-xs mt-1 opacity-80">
                        First check-in: {fmt(validationResult.firstCheckedIn)}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-500 bg-red-50 dark:bg-red-950">
                  <X className="h-5 w-5 text-red-600" />
                  <AlertTitle className="text-red-700 dark:text-red-300">Invalid Ticket</AlertTitle>
                  <AlertDescription className="text-red-700 dark:text-red-400">
                    {validationResult.message}
                  </AlertDescription>
                </Alert>
              )}

              {/* Ticket details panel */}
              {validationResult.ticketInfo && (
                <div className="border rounded-lg p-4 space-y-4">
                  {isBtts ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Swords className="h-5 w-5 text-orange-500" />
                        <h3 className="font-semibold text-lg">BTTS Ticket</h3>
                        <Badge variant="outline" className="ml-auto">
                          {validationResult.ticketInfo.type === "spot" ? "Battle Spot" : "Entry"}
                        </Badge>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Ticket</p>
                          <p className="font-medium">{validationResult.ticketInfo.ticketName}</p>
                          {validationResult.ticketInfo.spotNumber && (
                            <p className="text-orange-600 font-semibold">Spot #{validationResult.ticketInfo.spotNumber}</p>
                          )}
                          {validationResult.ticketInfo.battleFormat && (
                            <p className="text-muted-foreground">{validationResult.ticketInfo.battleFormat}</p>
                          )}
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Holder</p>
                          <p className="font-medium">{validationResult.ticketInfo.holderName || "—"}</p>
                          {validationResult.ticketInfo.holderEmail && (
                            <p className="text-muted-foreground text-xs break-all">{validationResult.ticketInfo.holderEmail}</p>
                          )}
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Amount Paid</p>
                          <p className="font-medium">
                            {Number(validationResult.ticketInfo.amountPaid ?? 0) > 0
                              ? `€${Number(validationResult.ticketInfo.amountPaid).toFixed(2)}`
                              : "Free"}
                          </p>
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Check-In Status</p>
                          <div className="flex items-center gap-2">
                            {validationResult.alreadyUsed || (validationResult.valid && (validationResult.scanCount ?? 0) > 0) ? (
                              <Badge className="bg-green-100 text-green-800 border-green-300">Checked In</Badge>
                            ) : (
                              <Badge variant="outline">Not Yet Scanned</Badge>
                            )}
                            {(validationResult.scanCount ?? 0) > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ×{validationResult.scanCount}
                              </span>
                            )}
                          </div>
                          {validationResult.lastScanned && (
                            <p className="text-xs mt-1 text-muted-foreground">
                              Last: {fmt(validationResult.lastScanned)}
                            </p>
                          )}
                        </div>
                      </div>

                      {validationResult.ticketInfo.purchaseId && (
                        <p className="text-xs text-muted-foreground">Purchase ID: #{validationResult.ticketInfo.purchaseId}</p>
                      )}
                    </>
                  ) : (
                    /* Regular ticket details */
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Ticket Details</h3>
                      <Separator />
                      {validationResult.details && (
                        <>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Event</p>
                            <p className="font-medium">{validationResult.details.event.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {fmt(validationResult.details.event.date)} · {validationResult.details.event.location}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Attendee</p>
                            <p className="font-medium">{validationResult.details.user.displayName}</p>
                            <p className="text-sm text-muted-foreground">{validationResult.details.user.email}</p>
                          </div>
                        </>
                      )}
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Status</p>
                        <div className="flex items-center gap-2">
                          {validationResult.valid
                            ? <Badge className="bg-green-100 text-green-800 border-green-300">Valid</Badge>
                            : <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                                {validationResult.alreadyUsed ? "Already Used" : "Invalid"}
                              </Badge>}
                          {(validationResult.scanCount ?? 0) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Scanned {validationResult.scanCount}×
                            </span>
                          )}
                        </div>
                        {validationResult.lastScanned && (
                          <p className="text-xs mt-1 text-muted-foreground">Last: {fmt(validationResult.lastScanned)}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Admin actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button data-testid="button-scan-another" onClick={resetScanner} className="flex-1">
                  Scan Another
                </Button>
                {isBtts && validationResult.ticketInfo?.purchaseId && (
                  <Button
                    data-testid="button-reset-checkin"
                    variant="outline"
                    onClick={handleResetCheckin}
                    disabled={isResetting}
                    className="flex-1"
                  >
                    {isResetting
                      ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      : <RotateCcw className="h-4 w-4 mr-2" />}
                    Reset Check-In
                  </Button>
                )}
              </div>

              {/* Debug accordion */}
              {validationResult.debug && (
                <div className="border border-dashed rounded p-3 bg-muted/30">
                  <details>
                    <summary className="text-xs font-medium text-muted-foreground cursor-pointer">
                      Debug Info (Admin)
                    </summary>
                    <pre className="mt-2 text-xs overflow-auto max-h-40 bg-background rounded p-2">
                      {JSON.stringify(validationResult.debug, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </CardContent>

        {!validationResult && !isScanning && !isProcessing && (
          <CardFooter className="text-xs text-muted-foreground justify-center">
            Supports BTTS spot tickets and regular event tickets
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default TicketScanner;
