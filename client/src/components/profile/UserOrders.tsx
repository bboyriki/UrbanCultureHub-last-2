import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Card,
  CardContent
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/contexts/TranslationContext';
import { format, parseISO } from 'date-fns';
import {
  ExternalLink,
  Package,
  Truck,
  Clock,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserOrdersProps {
  userId?: number;
  limit?: number;
  status?: string;
}

function formatCurrency(amount: string | number) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(numAmount);
}

const UserOrders = ({ userId, limit, status }: UserOrdersProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // Fetch user orders
  const {
    data: orders,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: [`/api/users/${userId}/orders`, status],
    queryFn: async () => {
      let url = `/api/users/${userId}/orders`;
      if (status && status !== 'all') {
        url += `?status=${status}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!userId
  });
  
  // Function to get status icon
  const getStatusIcon = (orderStatus: string) => {
    switch (orderStatus) {
      case 'processing':
        return <Package className="h-4 w-4" />;
      case 'shipped':
        return <Truck className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'delivered':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
      case 'rejected':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };
  
  // Function to get status color
  const getStatusColor = (orderStatus: string) => {
    switch (orderStatus) {
      case 'processing':
        return "bg-blue-100 text-blue-800 border-blue-200";
      case 'shipped':
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case 'pending':
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'delivered':
      case 'completed':
        return "bg-green-100 text-green-800 border-green-200";
      case 'cancelled':
      case 'rejected':
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-500">
        <p className="mb-2">Error loading orders</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
        >
          {t('common.tryAgain')}
        </Button>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
            {t('orders.noOrders')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('orders.noOrdersDescription')}
          </p>
          <Button asChild>
            <Link href="/marketplace">
              {t('orders.startShopping')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // If limit is provided, only show that many orders
  const displayedOrders = limit ? orders.slice(0, limit) : orders;

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('orders.order')}</TableHead>
            <TableHead>{t('orders.date')}</TableHead>
            <TableHead>{t('orders.status')}</TableHead>
            <TableHead className="text-right">{t('orders.total')}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayedOrders.map((order: any) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium">
                #{order.id}
              </TableCell>
              <TableCell>
                {order.createdAt ? format(parseISO(order.createdAt), 'MMM d, yyyy') : 'Unknown'}
              </TableCell>
              <TableCell>
                <Badge className={`${getStatusColor(order.status)} px-2 py-1 text-xs`}>
                  {getStatusIcon(order.status)}
                  <span className="ml-1">{order.status.toUpperCase()}</span>
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(order.totalAmount)}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/orders/${order.id}`}>
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">View Order</span>
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {limit && orders.length > limit && (
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/orders">
              {t('orders.viewAllOrders')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default UserOrders;