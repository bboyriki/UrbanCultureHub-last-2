import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { useRoute, Link, useLocation } from 'wouter';
import { Helmet } from 'react-helmet';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  ArrowLeft,
  Package,
  Truck,
  CalendarDays,
  MapPin,
  CreditCard,
  Clock,
  CheckCircle,
  PackageOpen,
  Info,
  AlertTriangle,
  ExternalLink,
  ShoppingBag
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

type OrderItem = {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product?: {
    id: number;
    name: string;
    description?: string;
    image?: string;
    isDigital?: boolean;
    digitalContentUrl?: string;
  }
};

type Order = {
  id: number;
  buyerId: number;
  totalAmount: string;
  subtotalAmount: string;
  taxAmount: string;
  shippingAmount: string;
  status: string;
  paymentIntentId?: string;
  trackingNumber?: string;
  shippingAddress?: string;
  billingAddress?: string;
  customerNotes?: string;
  sellerNotes?: string;
  rejectionReason?: string;
  deliveredAt?: string;
  shippedAt?: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
  buyer?: {
    id: number;
    displayName: string;
    email: string;
    profilePicture?: string;
  }
};

function formatCurrency(amount: string | number) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(numAmount);
}

export default function OrderDetailsPage() {
  const [_, params] = useRoute('/orders/:id');
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  
  const orderId = params?.id;
  
  // Fetch order details
  const { 
    data: order, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery({
    queryKey: [`/api/orders/${orderId}`],
    queryFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }
      return response.json();
    },
    enabled: !!orderId,
  });
  
  // Check if the logged-in user is the buyer of this order
  const isOrderOwner = user?.id === order?.buyerId;
  
  if (!user) {
    return (
      <div className="container max-w-4xl py-8">
        <Alert className="mb-4" variant="destructive">
          <AlertTitle>{t('auth.restrictedArea')}</AlertTitle>
          <AlertDescription>
            {t('auth.loginToView')}
          </AlertDescription>
        </Alert>
        <Button onClick={() => setLocation('/auth')}>
          {t('auth.login')}
        </Button>
      </div>
    );
  }
  
  if (isLoading) {
    return <OrderDetailsSkeleton />;
  }
  
  if (isError) {
    return (
      <div className="container max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load order details'}
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex space-x-4">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Orders
            </Link>
          </Button>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }
  
  if (!order) {
    return (
      <div className="container max-w-4xl py-8">
        <Alert>
          <AlertTitle>Order Not Found</AlertTitle>
          <AlertDescription>
            The order you're looking for doesn't exist or you don't have permission to view it.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
      </div>
    );
  }
  
  // If user is not the buyer, show access denied
  if (!isOrderOwner && user.role !== 'admin') {
    return (
      <div className="container max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to view this order.
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
      </div>
    );
  }
  
  // Format dates
  const orderDate = order.createdAt ? format(parseISO(order.createdAt), 'PPP') : 'Unknown';
  const updatedDate = order.updatedAt ? format(parseISO(order.updatedAt), 'PPP') : 'Unknown';
  const shippedDate = order.shippedAt ? format(parseISO(order.shippedAt), 'PPP') : null;
  const deliveredDate = order.deliveredAt ? format(parseISO(order.deliveredAt), 'PPP') : null;

  // Determine status icon
  let StatusIcon = Clock;
  if (order.status === 'shipped') StatusIcon = Truck;
  if (order.status === 'delivered' || order.status === 'completed') StatusIcon = CheckCircle;
  if (order.status === 'processing') StatusIcon = Package;
  if (order.status === 'cancelled' || order.status === 'rejected') StatusIcon = AlertTriangle;
  
  // Status color
  let statusColor = "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (order.status === 'processing') statusColor = "bg-blue-100 text-blue-800 border-blue-200";
  if (order.status === 'shipped') statusColor = "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (order.status === 'delivered' || order.status === 'completed') statusColor = "bg-green-100 text-green-800 border-green-200";
  if (order.status === 'cancelled' || order.status === 'rejected') statusColor = "bg-red-100 text-red-800 border-red-200";
  
  return (
    <>
      <Helmet>
        <title>{`Order #${order.id} | Urban Culture`}</title>
      </Helmet>
      
      <div className="container max-w-4xl py-8">
        <div className="mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('orders.backToOrders')}
            </Link>
          </Button>
        </div>
        
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('orders.order')} #{order.id}
            </h1>
            <p className="text-muted-foreground">
              {t('orders.placedOn')} {orderDate}
            </p>
          </div>
          
          <Badge className={`mt-2 md:mt-0 ${statusColor} px-3 py-1 text-xs`}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {order.status.toUpperCase()}
          </Badge>
        </div>
        
        {/* Order Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('orders.orderSummary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-sm">{t('orders.orderDate')}</h3>
                <p className="text-sm flex items-center mt-1">
                  <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                  {orderDate}
                </p>
              </div>
              
              {shippedDate && (
                <div>
                  <h3 className="font-medium text-sm">{t('orders.shippedDate')}</h3>
                  <p className="text-sm flex items-center mt-1">
                    <Truck className="mr-2 h-4 w-4 text-muted-foreground" />
                    {shippedDate}
                  </p>
                </div>
              )}
              
              {deliveredDate && (
                <div>
                  <h3 className="font-medium text-sm">{t('orders.deliveredDate')}</h3>
                  <p className="text-sm flex items-center mt-1">
                    <CheckCircle className="mr-2 h-4 w-4 text-muted-foreground" />
                    {deliveredDate}
                  </p>
                </div>
              )}
              
              <div>
                <h3 className="font-medium text-sm">{t('orders.total')}</h3>
                <p className="text-sm flex items-center mt-1">
                  <CreditCard className="mr-2 h-4 w-4 text-muted-foreground" />
                  {formatCurrency(order.totalAmount)}
                </p>
              </div>
              
              {order.paymentIntentId && (
                <div>
                  <h3 className="font-medium text-sm">{t('orders.paymentId')}</h3>
                  <p className="text-sm flex items-center mt-1 text-muted-foreground">
                    <Info className="mr-2 h-4 w-4" />
                    {order.paymentIntentId.substring(0, 14)}...
                  </p>
                </div>
              )}
            </div>
            
            {/* Tracking Information */}
            {order.trackingNumber && (
              <div className="mt-6 p-4 bg-muted rounded-md">
                <h3 className="font-medium mb-2">{t('orders.trackingInfo')}</h3>
                <div className="flex items-center">
                  <Truck className="mr-2 h-4 w-4" />
                  <span className="text-sm mr-2">{t('orders.trackingNumber')}:</span>
                  <span className="text-sm font-medium">{order.trackingNumber}</span>
                  
                  {order.trackingUrl && (
                    <a 
                      href={order.trackingUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-3 text-xs text-blue-600 hover:underline flex items-center"
                    >
                      {t('orders.trackPackage')}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            
            {/* Rejection Reason */}
            {(order.status === 'rejected' || order.status === 'cancelled') && order.rejectionReason && (
              <Alert className="mt-6" variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {order.status === 'rejected' ? t('orders.rejected') : t('orders.cancelled')}
                </AlertTitle>
                <AlertDescription>{order.rejectionReason}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
        
        {/* Order Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('orders.orderItems')}</CardTitle>
            <CardDescription>
              {(order.items?.length || 0) > 1
                ? t('orders.multipleItems', { count: order.items?.length || 0 })
                : t('orders.singleItem')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('orders.product')}</TableHead>
                  <TableHead className="text-right">{t('orders.quantity')}</TableHead>
                  <TableHead className="text-right">{t('orders.price')}</TableHead>
                  <TableHead className="text-right">{t('orders.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        {item.product?.image ? (
                          <img 
                            src={item.product.image} 
                            alt={item.product.name} 
                            className="h-10 w-10 object-cover rounded-md mr-3"
                          />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center mr-3">
                            <PackageOpen className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div>{item.product?.name || `Product #${item.productId}`}</div>
                          {item.product?.isDigital && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Digital
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice || '0')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.totalPrice || (parseFloat(item.unitPrice || '0') * item.quantity))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <Separator className="my-4" />
            
            <div className="space-y-1.5 text-sm mt-4">
              <div className="flex justify-between">
                <span>{t('orders.subtotal')}</span>
                <span>{formatCurrency(order.subtotalAmount || order.totalAmount)}</span>
              </div>
              
              {order.taxAmount && parseFloat(order.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span>{t('orders.tax')}</span>
                  <span>{formatCurrency(order.taxAmount)}</span>
                </div>
              )}
              
              {order.shippingAmount && parseFloat(order.shippingAmount) > 0 && (
                <div className="flex justify-between">
                  <span>{t('orders.shipping')}</span>
                  <span>{formatCurrency(order.shippingAmount)}</span>
                </div>
              )}
              
              <Separator className="my-2" />
              
              <div className="flex justify-between font-bold">
                <span>{t('orders.total')}</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Shipping & Additional Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Shipping Address */}
          {order.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>{t('orders.shippingAddress')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start">
                  <MapPin className="mr-2 h-5 w-5 text-muted-foreground mt-0.5" />
                  <p className="text-sm whitespace-pre-line">{order.shippingAddress}</p>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Billing Address */}
          {order.billingAddress && order.billingAddress !== order.shippingAddress && (
            <Card>
              <CardHeader>
                <CardTitle>{t('orders.billingAddress')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start">
                  <CreditCard className="mr-2 h-5 w-5 text-muted-foreground mt-0.5" />
                  <p className="text-sm whitespace-pre-line">{order.billingAddress}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Additional Information */}
        <Accordion type="single" collapsible className="mb-8">
          {(order.customerNotes || order.sellerNotes) && (
            <AccordionItem value="notes">
              <AccordionTrigger>{t('orders.notes')}</AccordionTrigger>
              <AccordionContent>
                {order.customerNotes && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-1">{t('orders.customerNotes')}</h4>
                    <p className="text-sm text-muted-foreground">{order.customerNotes}</p>
                  </div>
                )}
                
                {order.sellerNotes && (
                  <div>
                    <h4 className="font-medium mb-1">{t('orders.sellerNotes')}</h4>
                    <p className="text-sm text-muted-foreground">{order.sellerNotes}</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
          
          <AccordionItem value="additional-details">
            <AccordionTrigger>{t('orders.additionalDetails')}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('orders.orderId')}</span>
                  <span>{order.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('orders.orderDate')}</span>
                  <span>{orderDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('orders.lastUpdated')}</span>
                  <span>{updatedDate}</span>
                </div>
                {order.paymentIntentId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('orders.paymentId')}</span>
                    <span>{order.paymentIntentId}</span>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        
        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <Button variant="outline" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('orders.backToOrders')}
            </Link>
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/contact">
                {t('orders.help')}
              </Link>
            </Button>
            
            <Button asChild>
              <Link href="/marketplace">
                <ShoppingBag className="mr-2 h-4 w-4" />
                {t('orders.continueShopping')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function OrderDetailsSkeleton() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6 h-9 w-32 bg-gray-200 animate-pulse rounded"></div>
      
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-2"></div>
          <div className="h-5 w-32 bg-gray-200 animate-pulse rounded"></div>
        </div>
        
        <div className="mt-2 md:mt-0 h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
      </div>
      
      <div className="mb-6 bg-gray-200 animate-pulse rounded h-64"></div>
      
      <div className="mb-6 bg-gray-200 animate-pulse rounded h-80"></div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-200 animate-pulse rounded h-40"></div>
        <div className="bg-gray-200 animate-pulse rounded h-40"></div>
      </div>
      
      <div className="mb-8 bg-gray-200 animate-pulse rounded h-32"></div>
      
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="h-10 w-32 bg-gray-200 animate-pulse rounded"></div>
        
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-10 w-40 bg-gray-200 animate-pulse rounded"></div>
        </div>
      </div>
    </div>
  );
}