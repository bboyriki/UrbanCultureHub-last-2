import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Ticket, DollarSign, Check, X, Swords, Users, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface UserTicketsProps {
  userId: number;
}

const UserTickets = ({ userId }: UserTicketsProps) => {
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [_, setLocation] = useLocation();

  const {
    data: tickets,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [`/api/users/${userId}/tickets`],
    enabled: !!userId,
    refetchInterval: 30000,
    retry: 3,
    staleTime: 20000,
  });

  const { data: bttsSpots = [] } = useQuery<any[]>({
    queryKey: ['/api/btts/my-spots'],
    enabled: !!userId,
    staleTime: 20000,
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  const confirmedBtts = (bttsSpots as any[]).filter((s: any) => s.status === 'confirmed');

  const hasAnyTickets = (tickets && tickets.length > 0) || confirmedBtts.length > 0;

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Loading your tickets...</p>
      </div>
    );
  }

  if (error && confirmedBtts.length === 0) {
    return (
      <div className="text-center py-8 text-red-500">
        <p>Error loading tickets. Please try again later.</p>
      </div>
    );
  }

  if (!hasAnyTickets) {
    return (
      <div className="text-center py-8">
        <Ticket className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">No tickets yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Purchase tickets to events to see them here</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => setLocation("/events")}>Browse Events</Button>
          <Button variant="outline" onClick={() => setLocation("/back-to-the-street")} className="gap-2">
            <Swords className="w-4 h-4 text-orange-500"/>
            Back to the Street
          </Button>
        </div>
      </div>
    );
  }

  const showTicketDetails = (ticket: any) => {
    setSelectedTicket(ticket);
  };

  return (
    <div className="space-y-6">

      {/* ── BTTS Tickets ── */}
      {confirmedBtts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Swords className="w-3 h-3 text-orange-400"/>
              </div>
              <h3 className="text-sm font-bold text-white">Back to the Street Tickets</h3>
            </div>
            <button onClick={() => setLocation('/back-to-the-street')} className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 font-medium">
              View Event <ExternalLink className="w-3 h-3"/>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {confirmedBtts.map((s: any) => {
              const isSpot = s.ticket?.type === 'spot';
              const isGuest = s.ticket?.type === 'guest';
              const accentColor = isSpot ? 'border-orange-500/30 bg-orange-500/5' : isGuest ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-blue-500/25 bg-blue-500/5';
              const accentText = isSpot ? 'text-orange-400' : isGuest ? 'text-emerald-400' : 'text-blue-400';
              const Icon = isSpot ? Swords : isGuest ? Users : Ticket;
              const label = isSpot ? `Battle Spot #${s.spotNumber}` : isGuest ? 'Guest Pass' : 'General Entry';
              // Build QR URL from purchaseId (same as in email)
              const qrPayload = JSON.stringify({ type: 'btts_ticket', purchaseId: s.id });
              const qrUrl = s.qrCode || `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrPayload)}&size=200x200&margin=2&format=png`;

              return (
                <div key={s.id} className={`rounded-2xl border overflow-hidden ${accentColor}`} data-testid={`btts-ticket-profile-${s.id}`}>
                  <div className="h-0.5 w-full" style={{background: isSpot ? 'linear-gradient(to right, #f97316, #ef4444)' : isGuest ? 'linear-gradient(to right, #10b981, #14b8a6)' : 'linear-gradient(to right, #3b82f6, #7c3aed)'}}/>
                  <div className="flex items-start gap-4 p-4">
                    {/* QR code */}
                    <div className="shrink-0">
                      <div className="bg-white rounded-xl p-2 shadow-md" style={{boxShadow: isSpot ? '0 0 0 2px rgba(249,115,22,0.3)' : isGuest ? '0 0 0 2px rgba(16,185,129,0.3)' : '0 0 0 2px rgba(59,130,246,0.3)'}}>
                        <img src={qrUrl} alt="Ticket QR" width={80} height={80} className="block rounded" data-testid={`btts-qr-profile-${s.id}`}/>
                      </div>
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-black text-sm">{s.ticket?.name || 'BTTS Ticket'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${accentColor} ${accentText}`}>✓ Confirmed</span>
                      </div>
                      <p className={`text-xs font-semibold ${accentText}`}>{label}</p>
                      <p className="text-white/40 text-[11px] mt-1">Back to the Street · Ticket #{s.id}</p>
                      {s.amountPaid && Number(s.amountPaid) > 0 && (
                        <p className="text-white/30 text-[10px]">Paid €{Number(s.amountPaid).toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-white/5 px-4 py-2 flex items-center justify-between">
                    <p className="text-white/25 text-[10px]">Show QR at the door</p>
                    <button onClick={() => setLocation('/back-to-the-street')} className={`text-[10px] font-bold ${accentText} hover:underline`}>View on event page →</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Regular event tickets ── */}
      {tickets && tickets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.map((ticket: any) => (
            <Card
              key={ticket.id}
              className="overflow-hidden hover:shadow-md transition-shadow duration-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{ticket.event?.title || "Event"}</CardTitle>
                    <CardDescription>Ticket #{ticket.id}</CardDescription>
                  </div>
                  <Badge variant={ticket.isUsed ? "secondary" : "default"}>
                    {ticket.isUsed ? "Used" : "Valid"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {ticket.event?.date
                        ? format(new Date(ticket.event.date), "MMM d, yyyy 'at' h:mm a")
                        : "Date TBA"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.event?.location || "Location TBA"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>${(ticket.purchaseAmount / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.ticketQuantity} {ticket.ticketQuantity === 1 ? "ticket" : "tickets"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ticket.emailSent ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                    <span>
                      {ticket.emailSent
                        ? "Confirmation email sent"
                        : "Email delivery failed"}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => showTicketDetails(ticket)}
                  >
                    Quick View
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => setLocation(`/tickets/${ticket.id}`)}
                  >
                    Full Details
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">{selectedTicket.event?.title || "Event Ticket"}</h3>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg inline-block">
                  {selectedTicket.qrCode ? (
                    <img
                      src={selectedTicket.qrCode}
                      alt="Ticket QR Code"
                      className="max-w-[200px] mx-auto"
                    />
                  ) : (
                    <div className="h-[200px] w-[200px] flex items-center justify-center bg-gray-200 dark:bg-gray-600 rounded">
                      <span className="text-gray-500 dark:text-gray-400">QR Code Not Available</span>
                    </div>
                  )}
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Ticket #{selectedTicket.id}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Event Date:</span>
                  <span>
                    {selectedTicket.event?.date
                      ? format(new Date(selectedTicket.event.date), "MMM d, yyyy 'at' h:mm a")
                      : "Date TBA"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Location:</span>
                  <span>{selectedTicket.event?.location || "Location TBA"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Purchased:</span>
                  <span>
                    {selectedTicket.createdAt
                      ? formatDistanceToNow(new Date(selectedTicket.createdAt), { addSuffix: true })
                      : "Recently"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                  <span>{selectedTicket.ticketQuantity} {selectedTicket.ticketQuantity === 1 ? "ticket" : "tickets"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                  <span>${(selectedTicket.purchaseAmount / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <Badge variant={selectedTicket.isUsed ? "secondary" : "default"}>
                    {selectedTicket.isUsed ? "Used" : "Valid"}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                <p>Present this QR code at the event entrance for admission.</p>
                <p className="mt-1">This ticket is uniquely assigned to you and cannot be transferred.</p>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTicket(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserTickets;
