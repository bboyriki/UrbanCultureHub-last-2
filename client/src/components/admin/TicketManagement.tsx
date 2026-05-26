import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Ticket, Event, User } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Filter, Search, Trash, Printer, X, Check, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Extended ticket with additional data from related entities
interface ExtendedTicket extends Ticket {
  eventName?: string;
  userName?: string;
  event?: Event;
  user?: User;
  expirationDate?: Date;
  isValid?: boolean;
  createdAt: Date;
}

export default function TicketManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    action: () => {},
  });

  // Fetch all tickets
  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['/api/admin/tickets', user?.id],
    queryFn: async () => {
      if (!user?.id || user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      const response = await apiRequest(`/api/admin/tickets?adminId=${user.id}`, 'GET');
      const data: ExtendedTicket[] = await response.json();
      return data;
    },
    enabled: !!user?.id && user.role === 'admin'
  });

  // Delete a single ticket
  const deleteMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      if (!user?.id) {
        throw new Error('Admin authentication required');
      }
      return await apiRequest(`/api/admin/tickets/${ticketId}?adminId=${user.id}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: 'Ticket Deleted',
        description: 'The ticket has been successfully deleted',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tickets', user?.id] });
      setSelectedTickets(new Set());
    },
    onError: (error) => {
      console.error('Error deleting ticket:', error);
      toast({
        title: 'Error',
        description: 'There was an error deleting the ticket',
        variant: 'destructive',
      });
    }
  });

  // Bulk delete tickets
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ticketIds: number[]) => {
      if (!user?.id) {
        throw new Error('Admin authentication required');
      }
      return await apiRequest('/api/admin/tickets/bulk-delete', 'POST', { 
        ticketIds,
        adminId: user.id
      });
    },
    onSuccess: () => {
      toast({
        title: 'Tickets Deleted',
        description: `${selectedTickets.size} tickets have been successfully deleted`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tickets', user?.id] });
      setSelectedTickets(new Set());
    },
    onError: (error) => {
      console.error('Error deleting tickets:', error);
      toast({
        title: 'Error',
        description: 'There was an error deleting the tickets',
        variant: 'destructive',
      });
    }
  });

  // Format and display expiration date with coloring based on expiration
  const formatExpirationDate = (expDate: string) => {
    try {
      const expirationDate = new Date(expDate);
      const today = new Date();
      const isExpired = expirationDate < today;
      
      return (
        <span className={isExpired ? 'text-red-500' : ''}>
          {formatDate(expDate)}
          {isExpired && <span className="ml-2">(Expired)</span>}
        </span>
      );
    } catch (error) {
      return <span className="text-gray-500">Invalid Date</span>;
    }
  };

  // Toggle select all tickets
  const toggleSelectAll = () => {
    if (selectedTickets.size === (filteredTickets?.length || 0)) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(filteredTickets?.map(ticket => ticket.id) || []));
    }
  };

  // Toggle selecting a single ticket
  const toggleSelectTicket = (id: number) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTickets(newSelected);
  };

  // Handle single ticket deletion
  const handleDeleteTicket = (ticket: ExtendedTicket) => {
    setConfirmDialog({
      open: true,
      title: 'Confirm Ticket Deletion',
      description: `Are you sure you want to delete ticket #${ticket.id} for ${ticket.eventName || 'Unknown Event'}?`,
      action: () => {
        deleteMutation.mutate(ticket.id);
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };

  // Handle bulk deletion
  const handleBulkDelete = () => {
    setConfirmDialog({
      open: true,
      title: 'Confirm Bulk Deletion',
      description: `Are you sure you want to delete ${selectedTickets.size} tickets? This action cannot be undone.`,
      action: () => {
        bulkDeleteMutation.mutate(Array.from(selectedTickets));
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };
  
  // Handle deletion of all tickets
  const handleDeleteAllTickets = () => {
    if (!tickets || tickets.length === 0) return;
    
    setConfirmDialog({
      open: true,
      title: 'Delete All Tickets',
      description: `Are you sure you want to delete all ${tickets.length} tickets? This action cannot be undone.`,
      action: () => {
        const ticketIds = tickets.map(ticket => ticket.id);
        bulkDeleteMutation.mutate(ticketIds);
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };

  // Filter tickets based on search query and status filter
  const filteredTickets = React.useMemo(() => {
    if (!tickets) return [];
    
    return tickets.filter((ticket: ExtendedTicket) => {
      const matchesSearch = searchQuery === '' || 
        (ticket.eventName && ticket.eventName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ticket.qrCode && ticket.qrCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ticket.id.toString().includes(searchQuery);
      
      const matchesFilter = filterStatus === 'all' || 
        (filterStatus === 'valid' && ticket.isValid) ||
        (filterStatus === 'used' && ticket.isUsed) ||
        (filterStatus === 'expired' && ticket.expirationDate && new Date(ticket.expirationDate) < new Date());
      
      return matchesSearch && matchesFilter;
    });
  }, [tickets, searchQuery, filterStatus]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Tickets</CardTitle>
          <CardDescription>
            There was a problem loading the tickets data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/tickets', user?.id] })}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Ticket Management</h2>
        <div className="flex items-center space-x-2">
          {selectedTickets.size > 0 ? (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash className="h-4 w-4 mr-2" />
              )}
              Delete Selected ({selectedTickets.size})
            </Button>
          ) : (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => handleDeleteAllTickets()}
              disabled={bulkDeleteMutation.isPending || (tickets?.length || 0) === 0}
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash className="h-4 w-4 mr-2" />
              )}
              Delete All Tickets
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 items-center">
        <div className="relative w-full md:w-1/3">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select 
            value={filterStatus} 
            onValueChange={setFilterStatus}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="valid">Valid</SelectItem>
              <SelectItem value="used">Used</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={selectedTickets.size === filteredTickets.length && filteredTickets.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No tickets found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets.map((ticket: ExtendedTicket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedTickets.has(ticket.id)}
                          onCheckedChange={() => toggleSelectTicket(ticket.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">#{ticket.id}</TableCell>
                      <TableCell>{ticket.eventName || 'Unknown Event'}</TableCell>
                      <TableCell>{ticket.userName || 'Anonymous'}</TableCell>
                      <TableCell>{ticket.createdAt ? formatDate(ticket.createdAt.toString()) : 'Unknown'}</TableCell>
                      <TableCell>{ticket.expirationDate ? formatExpirationDate(ticket.expirationDate.toString()) : 'No Expiration'}</TableCell>
                      <TableCell>
                        {ticket.isUsed ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Used</Badge>
                        ) : ticket.isValid ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Valid</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Invalid</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteTicket(ticket)}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDialog.action}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}