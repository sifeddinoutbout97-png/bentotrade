/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Send, 
  CheckCircle2, 
  Clock, 
  User as UserIcon, 
  Mail, 
  Copy, 
  Ghost, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Sparkles, 
  ChevronRight, 
  AlertTriangle, 
  Check, 
  Loader2, 
  ExternalLink,
  MessageSquare,
  ArrowLeft
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, Profile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { SupportTicket, TicketMessage, TicketCategory, TicketPriority, TicketStatus, UserProfileSummary } from '@/types/support';
import { playSupportSound, isSoundEnabled, setSoundEnabled } from '@/lib/sound';

const CANNED_RESPONSES = [
  "👋 Hello! I am looking into your ticket and analyzing your terminal state now.",
  "🔍 Could you share your browser console logs, exact ticker, or screenshot?",
  "⚙️ We have identified the issue and pushed a patch. Please refresh your browser.",
  "✅ This has been resolved. Let us know if you need any additional assistance!",
];

export const AdminSupport: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isStaff, initiateGhostMode } = useAuth();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfileSummary | null>(null);
  const [userTradeCount, setUserTradeCount] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TicketCategory>('all');

  const [composerText, setComposerText] = useState('');
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync sound setting
  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      playSupportSound('message');
      toast.success('Support notifications unmuted');
    } else {
      toast.info('Support notifications muted');
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Load all support tickets
  const fetchTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          id,
          user_id,
          subject,
          category,
          priority,
          status,
          created_at,
          updated_at
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('Error fetching tickets:', error.message);
      } else if (data) {
        const ticketList = data as SupportTicket[];
        setTickets(ticketList);
        if (ticketList.length > 0 && !selectedTicketId) {
          setSelectedTicketId(ticketList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load support tickets:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const activeTicket = useMemo(() => {
    return tickets.find((t) => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  // Load messages & user profile for active ticket
  useEffect(() => {
    if (!activeTicket) {
      setMessages([]);
      setUserProfile(null);
      return;
    }

    const fetchTicketDetails = async () => {
      setIsLoadingMessages(true);
      try {
        // Fetch messages with joined sender profile
        const { data: msgData, error: msgError } = await supabase
          .from('ticket_messages')
          .select('id, ticket_id, sender_id, content, created_at, sender:profiles(id, full_name, display_name, role, avatar_url)')
          .eq('ticket_id', activeTicket.id)
          .order('created_at', { ascending: true });

        if (!msgError && msgData) {
          const normalized = msgData.map((m: any) => ({
            ...m,
            content: m.content || m.message || '',
            message: m.content || m.message || '',
          }));
          setMessages(normalized as TicketMessage[]);
        } else if (msgError) {
          console.warn('Supabase ticket_messages join error:', msgError.message);
          // Fallback query without join
          const { data: fallbackData } = await supabase
            .from('ticket_messages')
            .select('id, ticket_id, sender_id, content, created_at')
            .eq('ticket_id', activeTicket.id)
            .order('created_at', { ascending: true });

          if (fallbackData) {
            setMessages(
              fallbackData.map((m: any) => ({
                ...m,
                content: m.content || m.message || '',
                message: m.content || m.message || '',
              })) as TicketMessage[]
            );
          }
        }

        // Fetch User profile details
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, full_name, display_name, email, role, avatar_url, created_at')
          .eq('id', activeTicket.user_id)
          .single();

        if (profData) {
          setUserProfile(profData as UserProfileSummary);
        } else {
          setUserProfile({
            id: activeTicket.user_id,
            full_name: 'Trader User',
            display_name: 'Trader',
            email: 'Unknown',
            role: 'user',
          });
        }

        // Query user trade count for telemetry context
        const { count } = await supabase
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', activeTicket.user_id);

        setUserTradeCount(count ?? null);
      } catch (err) {
        console.error('Error fetching ticket details:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchTicketDetails();
  }, [activeTicket?.id]);

  // Real-time Global Subscriptions for Staff:
  // 1. New incoming tickets
  // 2. Incoming messages across tickets
  // 3. Ticket status updates
  useEffect(() => {
    const globalTicketChannel = supabase
      .channel('admin-support-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_tickets' },
        (payload) => {
          const newTicket = payload.new as SupportTicket;
          playSupportSound('ticket');
          toast('New Support Ticket', {
            description: `#${newTicket.id.slice(0, 8)} - ${newTicket.subject}`,
            icon: '🎫',
          });
          setTickets((prev) => [newTicket, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_tickets' },
        (payload) => {
          const updated = payload.new as SupportTicket;
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_messages' },
        (payload) => {
          const raw = payload.new as any;
          const newMsg: TicketMessage = {
            id: raw.id,
            ticket_id: raw.ticket_id,
            sender_id: raw.sender_id,
            content: raw.content || raw.message || '',
            message: raw.content || raw.message || '',
            created_at: raw.created_at,
          };

          // If the message belongs to current active ticket
          if (activeTicket && newMsg.ticket_id === activeTicket.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Fetch sender profile to determine role
            if (newMsg.sender_id) {
              (async () => {
                try {
                  const { data: prof } = await supabase
                    .from('profiles')
                    .select('id, full_name, display_name, role, avatar_url')
                    .eq('id', newMsg.sender_id!)
                    .single();
                  if (prof) {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === newMsg.id ? { ...m, sender: prof } : m))
                    );
                  }
                } catch (e) {
                  console.warn('Error fetching message sender profile:', e);
                }
              })();
            }
          }

          // If message is from customer (not the current staff user), alert staff
          if (newMsg.sender_id !== user?.id) {
            playSupportSound('message');
            const preview = newMsg.content || newMsg.message || '';
            toast('User Replied in Support', {
              description: preview.slice(0, 60) + (preview.length > 60 ? '...' : ''),
              icon: '💬',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalTicketChannel);
    };
  }, [activeTicket?.id]);

  // Send Staff Reply
  const handleSendStaffMessage = async (autoResolve = false) => {
    if (!composerText.trim() || !activeTicket || isSendingMessage) return;

    const content = composerText.trim();
    setComposerText('');
    setIsSendingMessage(true);

    const optimistic: TicketMessage = {
      id: 'staff-opt-' + Date.now(),
      ticket_id: activeTicket.id,
      sender_id: user?.id || null,
      content: content,
      message: content,
      sender: {
        role: profile?.role || 'admin',
        full_name: profile?.full_name || 'Desk Officer',
      },
      created_at: new Date().toISOString(),
      is_optimistic: true,
    };

    setMessages((prev) => [...prev, optimistic]);

    try {
      const { error: msgErr } = await supabase.from('ticket_messages').insert({
        ticket_id: activeTicket.id,
        sender_id: user?.id,
        content: content,
      });

      if (msgErr) throw msgErr;

      // Update ticket status
      const nextStatus: TicketStatus = autoResolve ? 'resolved' : 'in_progress';
      await handleUpdateTicketStatus(nextStatus, false);

      toast.success(autoResolve ? 'Replied and resolved ticket' : 'Reply delivered to user');
    } catch (err: any) {
      console.error('Error sending staff response:', err);
      toast.error('Failed to send reply', { description: err?.message });
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Update Ticket Status
  const handleUpdateTicketStatus = async (status: TicketStatus, showToast = true) => {
    if (!activeTicket) return;
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', activeTicket.id);

      if (error) throw error;

      setTickets((prev) =>
        prev.map((t) => (t.id === activeTicket.id ? { ...t, status } : t))
      );

      if (status === 'resolved') {
        playSupportSound('resolve');
      }

      if (showToast) {
        toast.success(`Ticket status updated to ${status.toUpperCase()}`);
      }
    } catch (err: any) {
      console.error('Error updating ticket status:', err);
      toast.error('Failed to update status', { description: err?.message });
    }
  };

  // Update Ticket Priority
  const handleUpdateTicketPriority = async (priority: TicketPriority) => {
    if (!activeTicket) return;
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('id', activeTicket.id);

      if (error) throw error;

      setTickets((prev) =>
        prev.map((t) => (t.id === activeTicket.id ? { ...t, priority } : t))
      );

      toast.success(`Ticket priority calibrated to ${priority.toUpperCase()}`);
    } catch (err: any) {
      console.error('Error updating priority:', err);
      toast.error('Failed to change priority', { description: err?.message });
    }
  };

  // Copy User ID
  const copyUserId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    toast.success('User UUID copied to clipboard');
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Search
      const matchesSearch =
        searchQuery === '' ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.user_id.toLowerCase().includes(searchQuery.toLowerCase());

      // Status
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

      // Priority
      const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

      // Category
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter, categoryFilter]);

  const openTicketsCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;

  return (
    <div className="h-full w-full overflow-hidden overflow-x-hidden flex flex-col bg-black text-zinc-100 font-sans select-none">
      {/* 1. TOP HEADER & METRICS BAR */}
      <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Control Tower</span>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Support Telemetry Desk
            </span>
          </div>
        </div>

        {/* Counter Stats & Sound Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Open: {openTicketsCount}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
              In Progress: {inProgressCount}
            </span>
            <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
              Total: {tickets.length}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTickets}
            className="h-8 px-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] text-xs font-mono gap-1.5"
            title="Refresh queue"
          >
            <RefreshCw size={13} className={isLoadingTickets ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSound}
            className="h-8 px-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] text-xs font-mono gap-1.5"
            title={soundOn ? 'Sound alerts enabled' : 'Sound alerts muted'}
          >
            {soundOn ? <Volume2 size={14} className="text-emerald-400" /> : <VolumeX size={14} className="text-zinc-600" />}
            <span className="hidden sm:inline">{soundOn ? 'Audio ON' : 'Muted'}</span>
          </Button>
        </div>
      </header>

      {/* 2. MAIN 3-PANEL WORKSPACE */}
      <div className="flex-1 flex min-h-0 overflow-hidden overflow-x-hidden divide-x divide-zinc-800/80">
        {/* PANEL 1: TICKET QUEUE & FILTER (280px - 300px) */}
        <aside className="w-[280px] lg:w-[300px] shrink-0 flex flex-col min-h-0 border-r border-zinc-800/80 bg-zinc-950/60">
          {/* Search & Filter Bar */}
          <div className="p-3 border-b border-zinc-800/80 flex flex-col gap-2.5 bg-black/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject, user, UUID..."
                className="pl-8 bg-zinc-900/60 border-zinc-800 text-xs h-8 text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-emerald-500/30 rounded-lg"
              />
            </div>

            {/* Status Tabs Segmented Control */}
            <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800/80 rounded-lg overflow-x-auto no-scrollbar text-xs font-mono">
              {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 rounded capitalize transition-all whitespace-nowrap text-xs font-mono ${
                    statusFilter === st
                      ? 'bg-zinc-800 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Queue List */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-0">
            {isLoadingTickets && tickets.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                <Loader2 size={20} className="animate-spin text-emerald-400" />
                <span className="text-xs text-zinc-500 font-mono">Loading queue...</span>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="py-12 px-4 text-center text-zinc-500 text-xs font-mono">
                No tickets match current filters.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = t.id === selectedTicketId;
                const priorityColor =
                  t.priority === 'urgent'
                    ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                    : t.priority === 'high'
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : t.priority === 'medium'
                    ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                    : 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 min-w-0 ${
                      isSelected
                        ? 'bg-white/[0.05] border-emerald-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'bg-white/[0.01] hover:bg-white/[0.03] border-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs font-semibold text-zinc-200 truncate min-w-0">
                        {t.subject}
                      </span>
                      <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${priorityColor}`}>
                        {t.priority}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 min-w-0">
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        <span className="uppercase text-zinc-400 shrink-0">{t.category}</span>
                        <span>•</span>
                        <span className="capitalize truncate">{t.status.replace('_', ' ')}</span>
                      </div>
                      <span className="shrink-0 text-[10px]">
                        {new Date(t.updated_at || t.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* PANEL 2: LIVE CHAT STREAM & COMPOSER (Center, flexible) */}
        <main className="min-w-0 flex-1 flex flex-col h-full bg-[#050505]">
          {activeTicket ? (
            <>
              {/* Active Ticket Control Header */}
              <div className="p-4 border-b border-zinc-800/80 bg-zinc-950/70 flex items-center justify-between gap-3 shrink-0 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-sm font-bold text-white truncate min-w-0">{activeTicket.subject}</h2>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        #{activeTicket.id.slice(0, 8)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono truncate min-w-0">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] uppercase font-bold text-emerald-400 shrink-0">
                        {activeTicket.category}
                      </span>
                      <span className="truncate">
                        User: {userProfile?.full_name ? `${userProfile.full_name} (${userProfile.email || activeTicket.user_id.slice(0, 8)})` : (userProfile?.email || activeTicket.user_id.slice(0, 8))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status & Priority Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Status Dropdown/Selector */}
                  <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs font-mono">
                    {(['open', 'in_progress', 'resolved', 'closed'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateTicketStatus(st)}
                        className={`px-2 py-1 rounded capitalize transition-all text-xs font-mono ${
                          activeTicket.status === st
                            ? 'bg-zinc-800 text-white font-bold shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  {/* Priority Selector */}
                  <select
                    value={activeTicket.priority}
                    onChange={(e) => handleUpdateTicketPriority(e.target.value as TicketPriority)}
                    className="h-7 px-2 text-xs font-mono uppercase bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-zinc-700"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                {isLoadingMessages ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                    <Loader2 size={24} className="animate-spin text-emerald-400" />
                    <span className="text-xs text-zinc-500 font-mono">Loading conversation logs...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center text-zinc-500 text-xs font-mono">
                    No messages recorded for this ticket.
                  </div>
                ) : (
                  messages.map((m) => {
                    const senderObj = Array.isArray(m.sender) ? m.sender[0] : m.sender;
                    const senderRole = senderObj?.role;
                    const isStaff =
                      senderRole === 'admin' ||
                      senderRole === 'moderator' ||
                      m.sender_id === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col gap-1 max-w-[80%] ${
                          isStaff ? 'self-end items-end' : 'self-start items-start'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 px-1">
                          {isStaff ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <ShieldCheck size={11} /> Desk Officer (Staff)
                            </span>
                          ) : (
                            <span className="text-zinc-300 font-semibold">
                              {userProfile?.full_name || 'Trader'}
                            </span>
                          )}
                          <span>•</span>
                          <span>
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div
                          className={`p-3.5 rounded-2xl text-xs leading-relaxed break-words ${
                            isStaff
                              ? 'bg-zinc-900 border border-zinc-800 text-zinc-200 shadow-md'
                              : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-100'
                          } ${m.is_optimistic ? 'opacity-70 italic' : ''}`}
                        >
                          {m.content || m.message}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Canned Quick Responses Ribbon */}
              <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-mono uppercase text-zinc-500 shrink-0">Quick Canned:</span>
                {CANNED_RESPONSES.map((resp, i) => (
                  <button
                    key={i}
                    onClick={() => setComposerText(resp)}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs whitespace-nowrap truncate max-w-[240px] transition-colors text-left"
                    title={resp}
                  >
                    {resp}
                  </button>
                ))}
              </div>

              {/* Message Composer */}
              <div className="p-3.5 sm:p-4 border-t border-zinc-800/80 bg-zinc-950/80 flex flex-col gap-2.5">
                <Textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendStaffMessage(false);
                    }
                  }}
                  rows={2}
                  placeholder="Type official staff response... (Enter to send, Shift+Enter for new line)"
                  className="bg-zinc-900/60 border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-emerald-500/40 rounded-xl resize-none p-3"
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-zinc-600 hidden sm:inline">
                    Institutional encrypted live duplex
                  </span>

                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!composerText.trim() || isSendingMessage}
                      onClick={() => handleSendStaffMessage(true)}
                      className="h-8 rounded-lg border-zinc-800 text-zinc-300 hover:text-white text-xs font-mono"
                    >
                      Reply & Resolve
                    </Button>
                    <Button
                      size="sm"
                      disabled={!composerText.trim() || isSendingMessage}
                      onClick={() => handleSendStaffMessage(false)}
                      className="h-8 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      {isSendingMessage ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} />
                      )}
                      Send Response
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500 gap-3">
              <MessageSquare size={36} className="text-zinc-700" />
              <div>
                <h3 className="text-sm font-bold text-zinc-300">No Ticket Selected</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Select a support ticket from the queue on the left to start real-time duplex live chat.
                </p>
              </div>
            </div>
          )}
        </main>

        {/* PANEL 3: CUSTOMER INTELLIGENCE & TELEMETRY (300px - 320px) */}
        <aside className="w-[300px] lg:w-[320px] shrink-0 border-l border-zinc-800/80 bg-zinc-950/60 hidden md:flex flex-col min-h-0 p-4 gap-4 overflow-y-auto">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-zinc-400">
              User Intelligence
            </h3>
            <span className="text-[10px] text-zinc-600 font-mono">Live Session Context</span>
          </div>

          {activeTicket ? (
            <div className="flex flex-col gap-4">
              {/* User Profile Card */}
              <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    {userProfile?.full_name?.[0]?.toUpperCase() || userProfile?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-zinc-100 truncate">
                      {userProfile?.full_name || userProfile?.display_name || 'Trader User'}
                    </span>
                    <span className="text-[11px] text-zinc-500 truncate">{userProfile?.email || 'No email registered'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80 text-xs font-mono">
                  <div className="flex flex-col">
                    <span className="text-zinc-500 text-[10px]">ROLE</span>
                    <span className="text-zinc-200 uppercase font-bold">{userProfile?.role || 'User'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-zinc-500 text-[10px]">TRADES LOGGED</span>
                    <span className="text-emerald-400 font-bold">{userTradeCount ?? '0'}</span>
                  </div>
                </div>

                {/* User UUID */}
                <div className="flex flex-col gap-1 pt-2 border-t border-zinc-800/80">
                  <span className="text-[10px] font-mono text-zinc-500">USER UUID</span>
                  <div className="flex items-center justify-between bg-black/60 px-2 py-1.5 rounded-lg border border-zinc-800">
                    <span className="font-mono text-[10px] text-zinc-400 truncate">
                      {activeTicket.user_id}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyUserId(activeTicket.user_id)}
                      className="h-6 w-6 text-zinc-500 hover:text-white"
                      title="Copy User ID"
                    >
                      {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Ghost Mode Launcher */}
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-purple-400 font-mono text-xs font-bold">
                  <Ghost size={14} />
                  <span>Ghost Protocol</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Impersonate this trader's session to audit their terminal state, charts, and execution tickets directly.
                </p>
                <Button
                  onClick={() => {
                    initiateGhostMode(activeTicket.user_id);
                    navigate('/');
                  }}
                  className="mt-1 h-8 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-mono font-bold uppercase tracking-wider rounded-lg"
                >
                  Initiate Ghost Session
                </Button>
              </div>

              {/* Ticket Meta Summary */}
              <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col gap-2 text-xs font-mono">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">TICKET TELEMETRY</span>
                <div className="flex justify-between py-1 border-b border-zinc-800/80">
                  <span className="text-zinc-500">Created:</span>
                  <span className="text-zinc-300">
                    {new Date(activeTicket.created_at).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-800/80">
                  <span className="text-zinc-500">Last Active:</span>
                  <span className="text-zinc-300">
                    {new Date(activeTicket.updated_at || activeTicket.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">Priority:</span>
                  <span className="uppercase text-zinc-300">{activeTicket.priority}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-600 text-xs font-mono">
              Select a ticket to inspect user telemetry.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
