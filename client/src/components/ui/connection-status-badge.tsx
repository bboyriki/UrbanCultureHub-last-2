import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ConnectionStatus } from '@/contexts/WebSocketSingletonContext';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';

type ConnectionStatusBadgeProps = {
  status: ConnectionStatus;
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'pill' | 'square' | 'minimal';
  animated?: boolean;
};

const statusConfig = {
  [ConnectionStatus.DISCONNECTED]: {
    icon: WifiOff,
    label: 'Disconnected',
    className: 'bg-gray-100 text-gray-800 border-gray-300',
    pulseColor: 'bg-gray-300',
  },
  [ConnectionStatus.CONNECTING]: {
    icon: Loader2,
    label: 'Connecting',
    className: 'bg-amber-50 text-amber-800 border-amber-300',
    pulseColor: 'bg-amber-300',
  },
  [ConnectionStatus.CONNECTED]: {
    icon: CheckCircle2,
    label: 'Connected',
    className: 'bg-green-50 text-green-800 border-green-300',
    pulseColor: 'bg-green-300',
  },
  [ConnectionStatus.ERROR]: {
    icon: AlertCircle,
    label: 'Error',
    className: 'bg-red-50 text-red-800 border-red-300',
    pulseColor: 'bg-red-300',
  },
};

export function ConnectionStatusBadge({
  status,
  showLabel = true,
  className,
  size = 'md',
  variant = 'pill',
  animated = true,
}: ConnectionStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig[ConnectionStatus.DISCONNECTED];
  const Icon = config.icon;
  
  const sizes = {
    sm: 'text-xs py-0.5 px-2',
    md: 'text-sm py-1 px-3',
    lg: 'text-base py-1.5 px-4',
  };
  
  const variants = {
    pill: 'rounded-full',
    square: 'rounded-md',
    minimal: 'rounded-md bg-transparent border-none',
  };
  
  // Pulse animation for the connected state
  const pulse = animated && status === ConnectionStatus.CONNECTED;
  
  // Spin animation for connecting state
  const spin = animated && status === ConnectionStatus.CONNECTING;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 border transition-colors shadow-sm',
        config.className,
        sizes[size],
        variants[variant],
        className
      )}
    >
      <div className="relative flex items-center justify-center">
        {pulse && (
          <motion.div
            className={cn(
              'absolute rounded-full opacity-40',
              config.pulseColor
            )}
            style={{ width: '100%', height: '100%' }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 0.2, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'loop',
            }}
          />
        )}
        {spin ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <Icon className={cn(size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5')} />
          </motion.div>
        ) : (
          <Icon className={cn(size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5')} />
        )}
      </div>
      {showLabel && <span className="font-medium">{config.label}</span>}
    </div>
  );
}