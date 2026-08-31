-- QUESTIONS: preguntas y respuestas públicas estilo Mercado Libre.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- ON DELETE CASCADE (no explicitado): consistente con el patrón "dueño"
  -- de la spec — la pregunta no tiene valor sin quien la hizo.
  user_id uuid not null references public.profiles (id) on delete cascade,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

create index questions_product_id_idx on public.questions (product_id);
