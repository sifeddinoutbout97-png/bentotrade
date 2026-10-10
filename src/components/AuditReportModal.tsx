import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Database, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink,
  Lock,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export interface AuditIssue {
  id: string;
  ticker: string;
  trade_date: string;
  issue: string;
  user_id: string;
  severity: 'low' | 'medium' | 'high';
  type: 'ghost' | 'risk' | 'calc';
}

export interface AuditReport {
  status: 'Verified' | 'Issues Found';
  tablesChecked: string[];
  integrityScore: number;
  timestamp: string;
  issues: AuditIssue[];
}

interface AuditReportModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  report: AuditReport | null;
  onFixIssue?: (issue: AuditIssue) => void;
  onResolveAll?: () => void;
}

export const AuditReportModal: React.FC<AuditReportModalProps> = ({ 
  isOpen, 
  onOpenChange, 
  report,
  onFixIssue,
  onResolveAll
}) => {
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsScanning(true);
      const timer = setTimeout(() => {
        setIsScanning(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-rose-500 bg-rose-500/10 border-rose-500/10';
      case 'medium': return 'text-amber-500 bg-amber-500/10 border-amber-500/10';
      default: return 'text-blue-500 bg-blue-500/10 border-blue-500/10';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl !max-w-5xl bg-zinc-950/95 border-white/10 rounded-[1.5rem] p-0 shadow-2xl backdrop-blur-3xl overflow-hidden ring-0 outline-none border">
        <div className="grid grid-cols-1 lg:grid-cols-12 h-[600px]">
          
          {/* Left Pane: System Health (5 cols) */}
          <div className="lg:col-span-5 p-8 flex flex-col h-full bg-zinc-900/30 border-r border-white/5">
            <header className="mb-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                  <Database size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Audit Engine v2.5</h3>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">Integrity_Check v4.1</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-4 block">Global_Integrity</span>
                  <div className="flex items-end gap-3">
                    <span className={cn(
                      "text-5xl font-black font-mono tracking-tighter",
                      report?.integrityScore === 100 ? "text-emerald-500" : "text-amber-400"
                    )}>
                      {isScanning ? "--" : report?.integrityScore}%
                    </span>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase mb-2">Confidence_Rating</span>
                  </div>
                  {/* Progress bar background */}
                  <div className="mt-6 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: isScanning ? '40%' : `${report?.integrityScore}%` }}
                      transition={{ duration: 1 }}
                      className={cn(
                        "h-full",
                        report?.integrityScore === 100 ? "bg-emerald-500" : "bg-amber-500"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5">
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-2">Nodes_Checked</span>
                    <span className="text-xl font-black text-white font-mono">{report?.tablesChecked.length || 0}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5">
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-2">Anomalies</span>
                    <span className={cn(
                      "text-xl font-black font-mono",
                      report?.issues.length === 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {report?.issues.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-3">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] block mb-2">Tables_Verified</span>
              {report?.tablesChecked.map(table => (
                <div key={table} className="flex items-center justify-between text-[10px] font-mono p-2 rounded-lg bg-white/[0.02] border border-white/[0.03]">
                  <span className="text-zinc-500">{table}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-emerald-500/40">Verified</span>
                    <CheckCircle2 size={10} className="text-emerald-500/60" />
                  </div>
                </div>
              ))}
            </div>

            <footer className="mt-auto pt-6 border-t border-white/5">
              <p className="text-[8px] font-mono text-zinc-700 leading-relaxed uppercase tracking-widest">
                Last_Scan: {report?.timestamp}<br/>
                Uplink: Secure_Node_4
              </p>
            </footer>
          </div>

          {/* Right Pane: Flagged Ledger (7 cols) */}
          <div className="lg:col-span-7 bg-black/40 flex flex-col h-full overflow-hidden">
            <header className="p-8 border-b border-white/5 flex items-center justify-between shadow-sm">
              <div>
                <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.4em] flex items-center gap-3">
                  <AlertTriangle size={14} className="text-amber-500" />
                  Flagged_Ledger
                </h4>
              </div>
              {report?.issues.length && report.issues.length > 0 ? (
                <div className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold">
                  {report.issues.length} Issues
                </div>
              ) : null}
            </header>

            <div className="flex-1 overflow-y-auto p-8 relative">
              <AnimatePresence mode="wait">
                {isScanning ? (
                  <motion.div 
                    key="scanning"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center space-y-10"
                  >
                    <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin" />
                    <div className="space-y-2 text-center">
                      <p className="text-[12px] font-black uppercase tracking-[0.6em] text-blue-400 animate-pulse">Running_Deep_Scan</p>
                      <p className="text-[9px] font-mono text-zinc-600 font-bold">Heuristic Analysis Of Trade Blocks...</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="findings"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    {report?.issues.length === 0 ? (
                      <div className="h-full py-20 flex flex-col items-center justify-center opacity-10 space-y-6">
                        <ShieldCheck size={100} />
                        <p className="text-xs font-black uppercase tracking-[0.8em]">Zero_Anomalies</p>
                      </div>
                    ) : (
                      report?.issues.map((issue, idx) => (
                        <div 
                          key={`${issue.id}-${issue.type}-${idx}`} 
                          className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all group relative overflow-hidden"
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  "text-[8px] font-black px-2 py-0.5 rounded-md border uppercase tracking-tighter",
                                  getSeverityColor(issue.severity)
                                )}>
                                  {issue.severity}
                                </span>
                                <span className="text-sm font-black text-white tracking-widest">{issue.ticker}</span>
                              </div>
                              <p className="text-xs text-zinc-400 font-medium italic">"{issue.issue}"</p>
                              <div className="flex items-center gap-4 text-[9px] font-mono text-zinc-600 font-bold">
                                <span>REF::{issue.id.substring(0, 8)}</span>
                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                <span>TYPE::{issue.type.toUpperCase()}</span>
                              </div>
                            </div>
                            <Button 
                              onClick={() => onFixIssue?.(issue)}
                              className="bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/20 transition-all font-black uppercase tracking-widest text-[9px] h-9 px-4 rounded-xl group"
                            >
                              FIX
                              <ArrowRight size={12} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <footer className="p-8 bg-black/60 border-t border-white/5 flex items-center justify-between">
               <Button 
                 variant="ghost" 
                 onClick={() => onOpenChange(false)}
                 className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[9px] hover:bg-white/5 h-10 px-6 rounded-xl"
               >
                 CLOSE_STREAM
               </Button>
               <div className="flex items-center gap-3">
                 <Button 
                   className="bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase tracking-[0.3em] text-[10px] h-10 px-6 rounded-xl"
                   onClick={() => {
                     setIsScanning(true);
                     setTimeout(() => setIsScanning(false), 1200);
                   }}
                 >
                   RE_SCAN
                 </Button>
                 {report && report.issues.length > 0 && (
                   <Button 
                     onClick={onResolveAll}
                     className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.3em] text-[9px] h-10 px-8 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.2)] transition-all"
                   >
                     RESOLVE_ALL
                   </Button>
                 )}
               </div>
            </footer>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};
