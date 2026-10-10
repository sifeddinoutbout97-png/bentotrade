import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  User, 
  ShieldAlert, 
  Ghost, 
  Trash2, 
  AlertTriangle,
  Mail,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export interface ManagedUser {
  id: string;
  email?: string;
  role: string | null;
  full_name?: string | null;
  display_name?: string | null;
  created_at: string;
  status?: string | null;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: ManagedUser | null;
  onResetJournal: (userId: string) => Promise<void>;
  onGhostMode: (userId: string) => void;
  onUserUpdated?: (userId: string, updates: Partial<ManagedUser>) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onOpenChange,
  user,
  onResetJournal,
  onGhostMode,
  onUserUpdated,
}) => {
  const navigate = useNavigate();
  const { initiateGhostMode } = useAuth();
  const [role, setRole] = useState<string>('user');
  const [status, setStatus] = useState<string>('active');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(user.role || 'user');
      setStatus(user.status || 'active');
    }
  }, [user]);

  if (!user) return null;

  const handleRoleChange = async (newRole: string) => {
    const toastId = toast.loading("SYNCHRONIZING_PERMISSIONS...");
    try {
      setIsUpdating(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id);

      if (error) throw error;
      
      setRole(newRole);
      onUserUpdated?.(user.id, { role: newRole });
      toast.success("AUTH_LEVEL_OVERRIDDEN", { id: toastId });
    } catch (error: any) {
      console.error('Failed to update role:', error);
      toast.error(`FIELD_UPDATE_FAULT: ${error.message || 'Access Denied'}`, { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusToggle = async (active: boolean) => {
    const newStatus = active ? 'active' : 'suspended';
    const toastId = toast.loading(active ? "RESTORING_ACCESS..." : "ISOLATING_USER...");
    
    try {
      setIsUpdating(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      setStatus(newStatus);
      onUserUpdated?.(user.id, { status: newStatus });
      
      if (newStatus === 'active') {
        toast.success("USER_RESTORED_SUCCESS", { id: toastId });
      } else {
        toast.warning("ACCOUNT_RESTRICTED", { 
          id: toastId,
          description: "User access to all platform modules is revoked." 
        });
      }
    } catch (error: any) {
      console.error('Failed to update status:', error);
      toast.error(`FIELD_UPDATE_FAULT: ${error.message || 'Access Denied'}`, { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReset = async () => {
    const confirmation = window.confirm(
      "CONFIRM_DATA_PURGE: Are you absolutely sure you want to WIPEOUT ALL journal entries for this user? This action is IRREVERSIBLE."
    );
    if (!confirmation) return;

    try {
      setIsUpdating(true);
      await onResetJournal(user.id);
      toast.success('Journal entries purged successfully');
    } catch (error) {
      console.error('Failed to reset journal:', error);
      toast.error('Journal reset sequence failed');
    } finally {
      setIsUpdating(false);
    }
  };

  const displayName = user.full_name || user.display_name || 'Anonymous Trader';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white dark:bg-zinc-950 border-zinc-950/5 dark:border-zinc-800 p-0 overflow-hidden shadow-sm dark:shadow-2xl backdrop-blur-[20px]">
        {/* Header Section */}
        <div className="relative p-8 border-b border-zinc-950/5 dark:border-white/5 bg-gradient-to-br from-zinc-500/5 to-transparent">
          <div className="flex items-start justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-950/5 dark:border-white/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-zinc-950 dark:text-white tracking-tight uppercase">
                    {displayName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                      {role}
                    </span>
                    {status === 'suspended' && (
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-700 dark:text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/20 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Suspended
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono tracking-tight">{user.email || 'NO_EMAIL_RECORD'}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500">
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span className="text-xs font-mono tracking-wider opacity-60">SYSTEM_ID: {user.id}</span>
                </div>
              </div>
            </div>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)}
              className="text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Action Grid */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-transparent">
          
          {/* Role Management */}
          <div className="p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-950/5 dark:border-white/5 space-y-4 hover:border-zinc-200 dark:hover:border-white/10 transition-colors shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
              <Shield className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Auth Level</span>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Elevate user privileges or revoke administrative access across the platform.
              </p>
              <Select value={role} onValueChange={handleRoleChange} disabled={isUpdating}>
                <SelectTrigger className="w-full bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-950 dark:text-zinc-300 font-bold capitalize">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-950 dark:text-zinc-300">
                  <SelectItem value="user" className="focus:bg-zinc-50 dark:focus:bg-zinc-900 text-zinc-900 dark:text-white">User</SelectItem>
                  <SelectItem value="moderator" className="focus:bg-zinc-50 dark:focus:bg-zinc-900 text-zinc-900 dark:text-white">Moderator</SelectItem>
                  <SelectItem value="admin" className="focus:bg-zinc-50 dark:focus:bg-zinc-900 text-zinc-900 dark:text-white">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Account Status */}
          <div className={cn(
            "p-6 rounded-3xl border transition-all duration-300 space-y-4 shadow-sm dark:shadow-none",
            status === 'suspended'
              ? "bg-red-500/5 border-red-500/20" 
              : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-950/5 dark:border-white/5 hover:border-zinc-200 dark:hover:border-white/10"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <ShieldAlert className={cn("w-4 h-4", status === 'suspended' && "text-red-700 dark:text-red-500")} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Access Control</span>
              </div>
              <Switch 
                checked={status === 'active'} 
                onCheckedChange={handleStatusToggle} 
                disabled={isUpdating}
                className={cn(status === 'active' ? "data-[state=checked]:bg-emerald-500" : "data-[state=unchecked]:bg-zinc-300 dark:data-[state=unchecked]:bg-zinc-800")}
              />
            </div>
            <div className="space-y-2">
              <p className={cn(
                "text-xs leading-relaxed",
                status === 'suspended' ? "text-red-700 dark:text-red-400/80 font-bold" : "text-zinc-500"
              )}>
                {status === 'active'
                  ? "Standard account operation. User has verified platform access."
                  : "Account Restricted. User access to all platform modules is revoked."}
              </p>
            </div>
          </div>

          {/* Ghost Mode Shortcut */}
          <div className="md:col-span-2 relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Button
              variant="outline"
              className="w-full h-20 rounded-[28px] border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/60 hover:bg-purple-500/10 hover:border-purple-500/30 flex flex-col items-center justify-center gap-1 group/btn transition-all duration-500 shadow-sm dark:shadow-none"
              onClick={() => {
                console.log("MODAL_GHOST_TRIGGERED_FOR:", user.id);
                onGhostMode(user.id);
                onOpenChange(false);
              }}
            >
              <Ghost className="w-6 h-6 text-purple-600 dark:text-purple-500 group-hover/btn:scale-110 transition-transform" />
              <div className="flex flex-col items-center">
                <span className="text-zinc-950 dark:text-white font-black uppercase tracking-[0.3em] text-[11px]">
                  Initiate Ghost Protocol
                </span>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                  Secure Impersonation Mode
                </span>
              </div>
            </Button>
          </div>

          {/* Maintenance Section */}
          <div className="md:col-span-2 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-red-500 uppercase tracking-tight">Danger Zone</h4>
                  <p className="text-[10px] text-red-400/60 font-medium">Reset all user metrics and journal history.</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={isUpdating}
                className="h-9 px-4 rounded-xl text-xs font-black text-red-500 hover:bg-red-500/10 hover:text-red-500 border border-red-500/20"
                onClick={handleReset}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Purge Journal
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-8 py-4 bg-zinc-50 dark:bg-zinc-900/30 border-t border-zinc-950/5 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">SYS_MONITOR: ACTIVE</span>
            </div>
            <div className="flex items-center gap-2 border-l border-zinc-950/5 dark:border-white/10 pl-4">
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">JOINED: {new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-600 uppercase tracking-tighter">BentoTrade_Admin v3.5_SECURE_LINK</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
