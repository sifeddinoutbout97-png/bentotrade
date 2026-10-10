import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

interface BTLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BTLogo = ({ className, size = 'md' }: BTLogoProps) => {
  const containerSizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };

  const textSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm"
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        containerSizes[size],
        "bg-white rounded-full p-1 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-zinc-100 flex items-center justify-center transition-all min-w-fit shrink-0 cursor-pointer",
        className
      )}
    >
      <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center overflow-hidden">
        <span className={cn(
          "text-white font-black tracking-tighter",
          textSizes[size]
        )}>
          BT
        </span>
      </div>
    </motion.div>
  );
};
