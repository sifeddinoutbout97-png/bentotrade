'use client';

/**
 * BentoTrade V6.0 - src/app/import/page.tsx
 */

import React, { useState, useEffect } from 'react';
import { ImportPage } from '@/pages/Import';

export default function Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="flex items-center gap-2.5 text-zinc-500 font-mono text-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Loading Broker Data Sync...</span>
        </div>
      </div>
    );
  }

  return <ImportPage />;
}

export { ImportPage };
