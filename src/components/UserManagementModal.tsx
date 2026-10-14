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
  AlertCircle,
  X
} from 'lucide-react';
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onOpenChange(false);
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  if (!isOpen || !user) return null;

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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="relative bg-zinc-950 border border-zinc-800/80 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Absolute Close Button */}
        <button 
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-50 p-2 bg-zinc-900 border border-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>

        {/* Header Section */}
        <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0 pr-8">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-mono font-bold text-white tracking-tight uppercase truncate">
                  {displayName}
                </h2>
                <span className="px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider border border-emerald-500/20">
                  {role}
                </span>
                {status === 'suspended' && (
                  <span className="px-2 py-0.5 rounded-sm bg-red-500/10 text-red-400 text-[10px] font-mono font-bold uppercase tracking-wider border border-red-500/20 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Suspended
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 pt-1">
                <div className="flex items-center gap-2 text-zinc-400 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="font-mono text-xs text-zinc-400 truncate">{user.email || 'NO_EMAIL_RECORD'}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400 min-w-0">
                  <Fingerprint className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="font-mono text-xs text-zinc-400 truncate">SYSTEM_ID: {user.id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Role Management */}
          <div className="p-4 rounded-md bg-zinc-900/30 border border-zinc-800/80 space-y-3">
            <div className="flex items-center gap-2 text-zinc-400">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">AUTH LEVEL</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Elevate user privileges or revoke administrative access across the platform.
            </p>
            <Select value={role} onValueChange={handleRoleChange} disabled={isUpdating}>
              <SelectTrigger className="w-full bg-zinc-900/80 border-zinc-800 rounded-md text-zinc-200 font-mono text-xs h-9">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200 font-mono text-xs">
                <SelectItem value="user" className="focus:bg-zinc-900 focus:text-white">User</SelectItem>
                <SelectItem value="moderator" className="focus:bg-zinc-900 focus:text-white">Moderator</SelectItem>
                <SelectItem value="admin" className="focus:bg-zinc-900 focus:text-white">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Account Status */}
          <div className={cn(
            "p-4 rounded-md border space-y-3 transition-colors",
            status === 'suspended'
              ? "bg-red-500/5 border-red-500/30" 
              : "bg-zinc-900/30 border-zinc-800/80"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-400">
                <ShieldAlert className={cn("w-3.5 h-3.5", status === 'suspended' ? "text-red-400" : "text-zinc-400")} />
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">ACCESS CONTROL</span>
              </div>
              <Switch 
                checked={status === 'active'} 
                onCheckedChange={handleStatusToggle} 
                disabled={isUpdating}
                className={cn(status === 'active' ? "data-[state=checked]:bg-emerald-500" : "data-[state=unchecked]:bg-zinc-800")}
              />
            </div>
            <p className={cn(
              "text-xs leading-relaxed font-sans",
              status === 'suspended' ? "text-red-400 font-medium" : "text-zinc-400"
            )}>
              {status === 'active'
                ? "Standard account operation. User has verified platform access."
                : "Account Restricted. User access to all platform modules is revoked."}
            </p>
          </div>

          {/* Ghost Mode Shortcut */}
          <div className="md:col-span-2">
            <Button
              variant="outline"
              className="w-full h-12 rounded-md border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 flex items-center justify-center gap-2.5 transition-colors"
              onClick={() => {
                onGhostMode(user.id);
                onOpenChange(false);
              }}
            >
              <Ghost className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-200">
                Initiate Ghost Protocol
              </span>
              <span className="text-[10px] font-mono text-purple-400/70 uppercase">
                (Secure Impersonation)
              </span>
            </Button>
          </div>

          {/* Danger Zone */}
          <div className="md:col-span-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between p-3.5 rounded-md bg-zinc-900/30 border border-zinc-800/80">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-md bg-red-950/40 border border-red-900/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">DANGER ZONE</h4>
                  <p className="text-[11px] text-zinc-400 truncate">Reset all user trade logs and journal records.</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={isUpdating}
                className="h-8 px-3 rounded-md bg-red-950/30 text-red-400 border border-red-900/50 hover:bg-red-900/40 text-xs font-mono font-bold uppercase tracking-wider shrink-0 transition-colors"
                onClick={handleReset}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Purge Journal
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-6 py-3 bg-zinc-900/40 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="uppercase tracking-wider">SYS_MONITOR: ACTIVE</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-4">
              <span className="uppercase tracking-wider">JOINED: {new Date(user.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <span className="uppercase tracking-wider text-zinc-600">BentoTrade_Admin v5.0_SECURE_LINK</span>
        </div>
      </div>
    </div>
  );
};
