/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TicketCategory = 'billing' | 'technical' | 'general' | 'feature';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface UserProfileSummary {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  role: string | null;
  created_at?: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  user?: UserProfileSummary;
  last_message?: string;
  message_count?: number;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  message: string;
  is_staff: boolean;
  created_at: string;
  is_optimistic?: boolean;
}
