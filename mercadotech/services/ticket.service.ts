import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { TicketStatus } from "@/lib/constants/roles";
import type { Ticket } from "@/types/ticket";

type Client = SupabaseClient<Database>;
type TicketRow = Database["public"]["Tables"]["support_tickets"]["Row"];

function mapTicket(row: TicketRow): Ticket {
  return { ...row, status: row.status as TicketStatus };
}

// Decisión 5 de la spec: solo LECTURA. Crear tickets desde la UI llega con
// el agente conversacional de la sesión 8 — acá "Mis tickets" es una lista,
// no un formulario.
export async function listMine(userId: string, supabase: Client = createClient()): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapTicket);
}
