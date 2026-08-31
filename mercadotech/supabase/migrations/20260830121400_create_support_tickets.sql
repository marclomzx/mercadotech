-- SUPPORT_TICKETS: soporte al comprador/vendedor. `channel` distingue si el
-- ticket se originó por chat de texto o por el agente de voz (sesión 8).
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  -- ON DELETE CASCADE (no explicitado): el ticket no tiene valor sin el
  -- usuario que lo abrió, consistente con el patrón "dueño" de la spec.
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  status text not null default 'abierto'
    check (status in ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  channel text not null default 'chat' check (channel in ('chat', 'voz')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create index support_tickets_user_id_idx on public.support_tickets (user_id);
