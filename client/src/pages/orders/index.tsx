import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Helmet } from 'react-helmet';
import { useTranslation } from '@/contexts/TranslationContext';
import UserOrders from '@/components/profile/UserOrders';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Package, Truck, CheckCircle, XCircle, CreditCard } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';

type Order = {
  id: number;
  totalAmount: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
};

function formatCurrency(amount: string | number) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(numAmount);
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState('all');
  
  if (!user) {
    return (
      <div className="container py-8">
        <Alert className="mb-4">
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

  return (
    <>
      <Helmet>
        <title>{`${t('orders.myOrders')} | Urban Culture`}</title>
      </Helmet>
      
      <div className="container py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('orders.myOrders')}</h1>
            <p className="text-muted-foreground mt-1">
              {t('orders.viewTrackManage')}
            </p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <Link href="/marketplace">
              <Button variant="outline" size="sm" className="mr-2">
                <ShoppingBag className="mr-2 h-4 w-4" />
                {t('orders.continueShopping')}
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Order Status Tabs */}
        <Tabs
          defaultValue="all"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mb-6"
        >
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
            <TabsTrigger value="all">{t('orders.all')}</TabsTrigger>
            <TabsTrigger value="pending">{t('orders.pending')}</TabsTrigger>
            <TabsTrigger value="processing">{t('orders.processing')}</TabsTrigger>
            <TabsTrigger value="shipped">{t('orders.shipped')}</TabsTrigger>
            <TabsTrigger value="delivered">{t('orders.delivered')}</TabsTrigger>
            <TabsTrigger value="cancelled">{t('orders.cancelled')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all">
            <UserOrders userId={user?.id} />
          </TabsContent>
          
          <TabsContent value="pending">
            <UserOrders userId={user?.id} />
          </TabsContent>
          
          <TabsContent value="processing">
            <UserOrders userId={user?.id} />
          </TabsContent>
          
          <TabsContent value="shipped">
            <UserOrders userId={user?.id} />
          </TabsContent>
          
          <TabsContent value="delivered">
            <UserOrders userId={user?.id} />
          </TabsContent>
          
          <TabsContent value="cancelled">
            <UserOrders userId={user?.id} />
          </TabsContent>
        </Tabs>
        
        {/* Order Support Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>{t('orders.needHelp')}</CardTitle>
            <CardDescription>
              {t('orders.contactSupport')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <Button variant="outline" asChild>
                <Link href="/contact">
                  {t('orders.contactUs')}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/faq">
                  {t('orders.faq')}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}