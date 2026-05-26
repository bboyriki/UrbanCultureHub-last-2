import React from 'react';
import PaymentRedirectHandler from '@/components/payments/PaymentRedirectHandler';

// Basic page wrapper for the PaymentRedirectHandler component
function PaymentRedirectPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <PaymentRedirectHandler />
    </div>
  );
}

// Using a default export as expected by the router
export default PaymentRedirectPage;