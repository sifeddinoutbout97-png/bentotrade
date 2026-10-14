/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  LifeBuoy, 
  Send, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  ChevronLeft,
  Plus,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Volume2,
  VolumeX,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { SupportTicket, TicketMessage, TicketCategory, TicketPriority, TicketStatus } from '@/types/support';
import { playSupportSound, isSoundEnabled, setSoundEnabled } from '@/lib/sound';

// Validation schema for creating a ticket
export const newTicketSchema = z.object({
  subject: z.string().min(4, { message: 'Subject must be at least 4 characters' }).max(120),
  category: z.enum(['billing', 'technical', 'general', 'feature'] as const),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
  message: z.string().min(8, { message: 'Please describe your request in at least 8 characters' }).max(3000),
});

export type NewTicketFormValues = z.infer<typeof newTicketSchema>;

const CATEGORY_OPTIONS: { value: TicketCategory; label: string; badge: string }[] = [
  { value: 'technical', label: 'Technical / Bug', badge: 'TECH' },
  { value: 'billing', label: 'Billing / Subscription', badge: 'BILL' },
  { value: 'feature', label: 'Feature Request / AI', badge: 'FEAT' },
  { value: 'general', label: 'General Trading Desk', badge: 'INFO' },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-zinc-500' },
  { value: 'medium', label: 'Medium', color: 'bg-sky-400' },
  { value: 'high', label: 'High', color: 'bg-amber-400' },
  { value: 'urgent', label: 'Urgent', color: 'bg-rose-500' },
];

export function GlobalSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'list' | 'new' | 'chat'>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [soundOn, setSoundOn] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const auth = useAuth?.() ?? { user: null, profile: null, isStaff: false };
  const { user, profile, isStaff } = auth;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting: isCreatingTicket },
  } = useForm<NewTicketFormValues>({
    resolver: zodResolver(newTicketSchema),
    defaultValues: {
      category: 'technical',
      priority: 'medium',
      subject: '',
      message: '',
    },
  });

  const selectedCategory = watch('category');
  const selectedPriority = watch('priority');

  // Sync sound setting on mount
  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) {
      playSupportSound('message');
      toast.success('Support chime enabled');
    } else {
      toast.info('Support chime muted');
    }
  };

  // Scroll messages to bottom smoothly
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    if (view === 'chat') {
      scrollToBottom('auto');
    }
  }, [messages.length, view]);

  // Fetch tickets for current user
  const fetchUserTickets = async () => {
    if (!user) {
      // Check local storage for guest/offline tickets
      try {
        const stored = localStorage.getItem('bt_guest_tickets');
        if (stored) {
          setTickets(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Storage read note:', e);
      }
      return;
    }

    setIsLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetchUserTickets note:', error.message);
      } else if (data) {
        setTickets(data as SupportTicket[]);
      }
    } catch (err) {
      console.error('Error fetching support tickets:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  // Fetch messages for active ticket with sender profile role
  const fetchMessages = async (ticketId: string) => {
    setIsLoadingMessages(true);
    try {
      // Primary join query with sender profile role
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('id, ticket_id, sender_id, content, created_at, sender:profiles(id, full_name, display_name, role, avatar_url)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Supabase fetchMessages join note:', error.message);
        // Fallback query without join if relationship differs
        const { data: rawData, error: rawError } = await supabase
          .from('ticket_messages')
          .select('id, ticket_id, sender_id, content, created_at')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (!rawError && rawData) {
          const normalized = rawData.map((m: any) => ({
            ...m,
            content: m.content || m.message || '',
            message: m.content || m.message || '',
          }));
          setMessages(normalized as TicketMessage[]);
        }
      } else if (data) {
        const normalized = data.map((m: any) => ({
          ...m,
          content: m.content || m.message || '',
          message: m.content || m.message || '',
        }));
        setMessages(normalized as TicketMessage[]);
      }
    } catch (err) {
      console.error('Error loading ticket messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Open active ticket in chat view
  const openTicketChat = (ticket: SupportTicket) => {
    setActiveTicket(ticket);
    setView('chat');
    fetchMessages(ticket.id);
  };

  // Refresh ticket list on sheet open
  useEffect(() => {
    if (isOpen) {
      fetchUserTickets();
    }
  }, [isOpen, user?.id]);

  // Real-time subscription for active ticket messages & status changes
  useEffect(() => {
    if (!activeTicket?.id || !isOpen || view !== 'chat') return;

    // Real-time messages channel
    const messagesChannel = supabase
      .channel(`ticket-chat-${activeTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${activeTicket.id}`,
        },
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

          setMessages((prev) => {
            // Avoid duplicate if optimistic message matches
            const exists = prev.some(
              (m) => m.id === newMsg.id || (m.is_optimistic && (m.content === newMsg.content || m.message === newMsg.message))
            );
            if (exists) {
              return prev.map((m) =>
                m.is_optimistic && (m.content === newMsg.content || m.message === newMsg.message) ? newMsg : m
              );
            }
            return [...prev, newMsg];
          });

          // If message is from someone else (staff), query sender role, play sound & alert
          if (newMsg.sender_id && newMsg.sender_id !== user?.id) {
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
                console.warn('Profile fetch note:', e);
              }
            })();

            playSupportSound('message');
            const textPreview = newMsg.content || newMsg.message || '';
            toast('Staff Response Received', {
              description: textPreview.slice(0, 75) + (textPreview.length > 75 ? '...' : ''),
              icon: '💬',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
          filter: `id=eq.${activeTicket.id}`,
        },
        (payload) => {
          const updated = payload.new as SupportTicket;
          setActiveTicket((prev) => (prev ? { ...prev, ...updated } : updated));
          setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
          if (updated.status === 'resolved') {
            playSupportSound('resolve');
            toast.success('Ticket marked as Resolved by Staff');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [activeTicket?.id, isOpen, view]);

  // Create new ticket submission
  const onSubmitNewTicket = async (values: NewTicketFormValues) => {
    const userId = user?.id || 'guest-' + Date.now();
    const tempTicketId = crypto.randomUUID();

    const newTicketRecord: SupportTicket = {
      id: tempTicketId,
      user_id: userId,
      subject: values.subject.trim(),
      category: values.category,
      priority: values.priority,
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const initialMessageRecord: TicketMessage = {
      id: crypto.randomUUID(),
      ticket_id: tempTicketId,
      sender_id: user?.id || null,
      content: values.message.trim(),
      message: values.message.trim(),
      created_at: new Date().toISOString(),
    };

    try {
      if (user) {
        // Real Supabase insert
        const { data: ticketData, error: ticketError } = await supabase
          .from('support_tickets')
          .insert({
            id: tempTicketId,
            user_id: user.id,
            subject: values.subject.trim(),
            category: values.category,
            priority: values.priority,
            status: 'open',
          })
          .select()
          .single();

        if (ticketError) {
          throw ticketError;
        }

        const insertedTicket = ticketData as SupportTicket;

        // Insert initial message into ticket_messages using content column
        const { error: initialMsgError } = await supabase
          .from('ticket_messages')
          .insert({
            id: initialMessageRecord.id,
            ticket_id: insertedTicket.id,
            sender_id: user.id,
            content: values.message.trim(),
          });

        if (initialMsgError) {
          console.warn('Supabase initial message insert note:', initialMsgError.message);
        }

        playSupportSound('ticket');
        toast.success('Support ticket created successfully', {
          description: `Ticket ID: #${insertedTicket.id.slice(0, 8)}`,
        });

        reset();
        setTickets((prev) => [insertedTicket, ...prev]);
        setActiveTicket(insertedTicket);
        setMessages([initialMessageRecord]);
        setView('chat');
      } else {
        // Guest mode fallback
        playSupportSound('ticket');
        const updatedList = [newTicketRecord, ...tickets];
        setTickets(updatedList);
        try {
          localStorage.setItem('bt_guest_tickets', JSON.stringify(updatedList));
        } catch (e) {
          console.warn('Storage save error:', e);
        }
        toast.success('Guest Ticket Created', {
          description: 'Ticket created in local guest session.',
        });
        reset();
        setActiveTicket(newTicketRecord);
        setMessages([initialMessageRecord]);
        setView('chat');
      }
    } catch (err: any) {
      console.error('Failed to create support ticket:', err);
      toast.error('Failed to open ticket', {
        description: err?.message || 'Database error occurred. Please try again.',
      });
    }
  };

  // Send message in existing chat
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !activeTicket || isSendingMessage) return;

    const msgContent = chatInput.trim();
    setChatInput('');
    setIsSendingMessage(true);

    const optimisticMsg: TicketMessage = {
      id: 'opt-' + Date.now(),
      ticket_id: activeTicket.id,
      sender_id: user?.id || null,
      content: msgContent,
      message: msgContent,
      created_at: new Date().toISOString(),
      is_optimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      if (user) {
        const { error } = await supabase.from('ticket_messages').insert({
          ticket_id: activeTicket.id,
          sender_id: user.id,
          content: msgContent,
        });

        if (error) {
          throw error;
        }

        // Auto-reopen ticket if previously closed
        if (activeTicket.status === 'resolved' || activeTicket.status === 'closed') {
          setActiveTicket((prev) => prev ? { ...prev, status: 'in_progress' } : null);
          setTickets((prev) =>
            prev.map((t) => (t.id === activeTicket.id ? { ...t, status: 'in_progress' } : t))
          );
        }
      } else {
        // Guest session simulated reply echo for preview testing
        setTimeout(() => {
          const staffEcho: TicketMessage = {
            id: 'staff-' + Date.now(),
            ticket_id: activeTicket.id,
            sender_id: null,
            content: 'Thank you for reaching BentoTrade Support. An institutional desk officer has logged your inquiry and is reviewing telemetry.',
            message: 'Thank you for reaching BentoTrade Support. An institutional desk officer has logged your inquiry and is reviewing telemetry.',
            sender: { role: 'admin', full_name: 'Desk Officer' },
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, staffEcho]);
          playSupportSound('message');
        }, 1200);
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      toast.error('Failed to deliver message', {
        description: err?.message || 'Network error.',
      });
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            In Progress
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <CheckCircle2 size={10} className="text-zinc-400" />
            Resolved
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700">
            Closed
          </span>
        );
    }
  };

  return (
    <>
      {/* 1. FLOATING ACTION BUTTON (Visible Globally) */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="relative h-13 px-4 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-emerald-500/40 group active:scale-95 flex items-center gap-2.5"
          aria-label="Open Live Support Desk"
        >
          {/* Subtle glowing indicator */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>

          <LifeBuoy className="h-5 w-5 text-emerald-400 transition-transform duration-300 group-hover:rotate-45" />

          <span className="text-xs font-semibold tracking-wide text-zinc-200 group-hover:text-white transition-colors">
            Support Desk
          </span>

          {/* Unread / Active ticket count indicator */}
          {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length}
            </span>
          )}
        </Button>
      </div>

      {/* 2. SLIDING SHEET PANEL */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          side="right" 
          className="w-full sm:max-w-[480px] p-0 bg-[#050505] text-zinc-100 border-l border-white/[0.08] shadow-2xl flex flex-col h-full focus:outline-none"
        >
          {/* HEADER */}
          <div className="p-4 sm:p-5 border-b border-white/[0.06] bg-zinc-950/70 backdrop-blur-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {view !== 'list' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setView('list')}
                  className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05] shrink-0"
                  title="Back to Tickets"
                >
                  <ChevronLeft size={18} />
                </Button>
              )}

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight text-white truncate">
                    {view === 'chat' && activeTicket
                      ? activeTicket.subject
                      : view === 'new'
                      ? 'New Support Ticket'
                      : 'Support & Live Chat'}
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shrink-0">
                    Live
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500 truncate">
                  {view === 'chat' && activeTicket
                    ? `Ticket #${activeTicket.id.slice(0, 8)}`
                    : 'Institutional Trading Desk Assistance'}
                </span>
              </div>
            </div>

            {/* Utility Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSound}
                className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05]"
                title={soundOn ? 'Mute notification chimes' : 'Enable notification chimes'}
              >
                {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} className="text-zinc-600" />}
              </Button>

              {isStaff && (
                <Link
                  to="/admin/support"
                  onClick={() => setIsOpen(false)}
                  className="h-8 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                  title="Open Staff Control Workspace"
                >
                  <ShieldCheck size={12} />
                  Staff Desk
                </Link>
              )}
            </div>
          </div>

          {/* VIEW 1: TICKETS LIST */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
              {/* New Ticket CTA Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/20 via-zinc-900/60 to-zinc-950/80 border border-emerald-500/20 flex items-center justify-between gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div>
                  <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                    Need instant support?
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Open a ticket to chat live with our quantitative trade team.
                  </p>
                </div>
                <Button
                  onClick={() => setView('new')}
                  size="sm"
                  className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-500/20"
                >
                  <Plus size={14} />
                  New Ticket
                </Button>
              </div>

              {/* Tickets Section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-zinc-500 px-1">
                  <span>Your Tickets ({tickets.length})</span>
                  {isLoadingTickets && <Loader2 size={12} className="animate-spin text-emerald-400" />}
                </div>

                {isLoadingTickets && tickets.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
                    <Loader2 size={24} className="animate-spin text-emerald-400" />
                    <span className="text-xs text-zinc-500 font-mono">Syncing tickets...</span>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="py-12 px-4 rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">No tickets found</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 max-w-[240px]">
                        You haven't submitted any inquiries yet. Click "New Ticket" to begin.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setView('new')}
                      className="h-8 rounded-lg border-zinc-800 text-xs font-medium hover:bg-white/[0.03]"
                    >
                      Create First Ticket
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {tickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openTicketChat(t)}
                        className="p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/[0.12] transition-all cursor-pointer group flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-zinc-200 group-hover:text-white line-clamp-1">
                            {t.subject}
                          </span>
                          {getStatusBadge(t.status)}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                              {t.category}
                            </span>
                            <span className="capitalize">{t.priority} priority</span>
                          </div>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(t.updated_at || t.created_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: NEW TICKET FORM */}
          {view === 'new' && (
            <form onSubmit={handleSubmit(onSubmitNewTicket)} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
              {/* Category Picker */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-zinc-300">Category</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setValue('category', cat.value, { shouldValidate: true })}
                      className={`p-2.5 rounded-xl text-left border transition-all flex flex-col gap-1 ${
                        selectedCategory === cat.value
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="text-[10px] font-mono font-bold opacity-60">{cat.badge}</span>
                      <span className="text-xs font-medium truncate">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Picker */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-zinc-300">Priority Level</Label>
                <div className="grid grid-cols-4 gap-2">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setValue('priority', p.value, { shouldValidate: true })}
                      className={`py-2 px-2 rounded-xl text-center border transition-all flex items-center justify-center gap-1.5 ${
                        selectedPriority === p.value
                          ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                          : 'bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.color}`} />
                      <span className="text-xs capitalize">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Input */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="subject" className="text-xs font-semibold text-zinc-300">
                  Subject / Summary
                </Label>
                <Input
                  id="subject"
                  placeholder="e.g. Realtime WebSocket sync issue on BTC ticket"
                  {...register('subject')}
                  className="bg-white/[0.02] border-white/[0.08] text-xs h-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 rounded-xl"
                />
                {errors.subject && (
                  <span className="text-[11px] text-rose-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.subject.message}
                  </span>
                )}
              </div>

              {/* Message Input */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="message" className="text-xs font-semibold text-zinc-300">
                  Description & Context
                </Label>
                <Textarea
                  id="message"
                  rows={5}
                  placeholder="Provide any error messages, affected tickers, or execution timestamps..."
                  {...register('message')}
                  className="bg-white/[0.02] border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 rounded-xl resize-none"
                />
                {errors.message && (
                  <span className="text-[11px] text-rose-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.message.message}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-white/[0.06]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setView('list')}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingTicket}
                  className="h-10 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {isCreatingTicket ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Dispatching Ticket...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Launch Support Request
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* VIEW 3: LIVE 2-WAY CHAT */}
          {view === 'chat' && activeTicket && (
            <div className="flex-1 flex flex-col min-h-0 bg-[#050505]">
              {/* Ticket Meta Ribbon */}
              <div className="px-4 py-2.5 bg-zinc-950/80 border-b border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <div className="flex items-center gap-2">
                  {getStatusBadge(activeTicket.status)}
                  <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                    {activeTicket.category}
                  </span>
                </div>
                <span className="text-zinc-500">
                  Created {new Date(activeTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
                {isLoadingMessages ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                    <Loader2 size={22} className="animate-spin text-emerald-400" />
                    <span className="text-xs text-zinc-500 font-mono">Loading conversation...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500 text-xs font-mono">
                    No messages yet. Send a message to start chatting.
                  </div>
                ) : (
                  messages.map((m) => {
                    const senderObj = Array.isArray(m.sender) ? m.sender[0] : m.sender;
                    const senderRole = senderObj?.role;
                    const isStaffMsg =
                      senderRole === 'admin' ||
                      senderRole === 'moderator' ||
                      (m.sender_id ? m.sender_id !== user?.id : false);
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col gap-1 max-w-[85%] ${
                          isStaffMsg ? 'self-start items-start' : 'self-end items-end'
                        }`}
                      >
                        {/* Sender Label */}
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 px-1">
                          {isStaffMsg ? (
                            <>
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <ShieldCheck size={11} /> Support Team
                              </span>
                            </>
                          ) : (
                            <span>You</span>
                          )}
                          <span>•</span>
                          <span>
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Bubble */}
                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed break-words ${
                            isStaffMsg
                              ? 'bg-zinc-900 border border-zinc-800 text-zinc-200 shadow-md'
                              : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
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

              {/* Status Notice if Resolved */}
              {activeTicket.status === 'resolved' && (
                <div className="px-4 py-2 bg-emerald-950/20 border-t border-emerald-500/20 text-[11px] text-emerald-400 flex items-center justify-between">
                  <span>This ticket has been marked resolved. Send a message to reopen.</span>
                </div>
              )}

              {/* Composer */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-white/[0.06] bg-zinc-950/80 flex items-center gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your message... (Enter to send)"
                  disabled={isSendingMessage}
                  className="bg-white/[0.02] border-white/[0.08] text-xs h-10 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40 rounded-xl flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!chatInput.trim() || isSendingMessage}
                  className="h-10 w-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black shrink-0 disabled:opacity-40 shadow-lg shadow-emerald-500/20"
                >
                  {isSendingMessage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
