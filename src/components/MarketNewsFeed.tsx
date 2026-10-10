import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Newspaper, ExternalLink, RefreshCw } from 'lucide-react';
import { fetchMarketNews, MarketNewsItem, FALLBACK_MARKET_NEWS } from '@/lib/market';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MarketNewsFeedProps {
  className?: string;
}

export const MarketNewsFeed: React.FC<MarketNewsFeedProps> = ({ className }) => {
  // Pre-seed with fallback news so Vercel deployment renders instantly without blank state
  const [news, setNews] = useState<MarketNewsItem[]>(FALLBACK_MARKET_NEWS);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadNews = async () => {
    setLoading(true);
    try {
      const items = await fetchMarketNews('general');
      if (items && items.length > 0) {
        setNews(items.slice(0, 8)); // Top 8 news stories
      } else {
        setNews(FALLBACK_MARKET_NEWS);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.warn('Error fetching live market news:', e);
      setNews(FALLBACK_MARKET_NEWS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
    // Refresh interval every 3 minutes
    const interval = setInterval(loadNews, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (unixSec: number) => {
    const diffSec = Math.floor(Date.now() / 1000) - unixSec;
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  return (
    <Card className={cn(
      "rounded-[2.5rem] border-zinc-950/5 dark:border-white/5 bg-white/70 dark:bg-zinc-900/50 shadow-sm dark:shadow-2xl backdrop-blur-[20px] overflow-hidden",
      className
    )}>
      <CardHeader className="border-b border-zinc-950/5 dark:border-white/5 p-6 md:p-8 pb-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm">
            <Newspaper size={18} />
          </div>
          <div>
            <CardTitle className="text-xs md:text-sm font-black flex items-center gap-2 uppercase tracking-[0.2em] text-zinc-950 dark:text-white">
              <span>Market Wire News</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Finnhub Feed
              </span>
            </CardTitle>
            <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
              Catalysts, macroeconomic shifts & equity flows across NQ, QQQ, and SPY
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={loadNews}
          disabled={loading}
          className="h-8 px-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-500 dark:text-zinc-400 font-mono text-[10px] uppercase font-bold flex items-center gap-1.5"
          title="Refresh Live News"
        >
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </CardHeader>

      <CardContent className="p-6 md:p-8 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {news.map((item, idx) => (
            <motion.a
              key={`${item.id}-${idx}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="p-5 rounded-3xl border border-zinc-950/5 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.03] hover:bg-zinc-100/70 dark:hover:bg-white/[0.07] hover:border-emerald-500/30 transition-all flex flex-col justify-between group space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded-md bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold uppercase tracking-wider">
                    {item.source}
                  </span>
                  <span className="text-zinc-400">
                    {formatTimeAgo(item.datetime)}
                  </span>
                </div>

                <h4 className="text-xs sm:text-sm font-black text-zinc-950 dark:text-white leading-snug group-hover:text-emerald-400 transition-colors line-clamp-2">
                  {item.headline}
                </h4>

                {item.summary && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 font-sans">
                    {item.summary}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-950/5 dark:border-white/5 text-[10px] font-mono text-zinc-400 group-hover:text-emerald-400 transition-colors">
                <span className="uppercase tracking-widest text-[9px] font-bold text-zinc-500">
                  {item.related ? item.related.split(',').slice(0, 3).join(' • ') : 'GLOBAL'}
                </span>
                <div className="flex items-center gap-1">
                  <span>Read Article</span>
                  <ExternalLink size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
