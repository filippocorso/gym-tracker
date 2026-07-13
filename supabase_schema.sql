-- Schema per Gym Tracker
-- Incolla questo intero file nell'SQL Editor di Supabase (Database > SQL Editor > New query) ed esegui "Run".

create extension if not exists "uuid-ossp";

create table if not exists schede (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  created_at timestamptz default now()
);

create table if not exists esercizi (
  id uuid primary key default uuid_generate_v4(),
  scheda_id uuid references schede(id) on delete cascade,
  nome text not null,
  recupero int default 90,
  ordine int default 0,
  created_at timestamptz default now()
);

create table if not exists serie (
  id uuid primary key default uuid_generate_v4(),
  esercizio_id uuid references esercizi(id) on delete cascade,
  peso numeric,
  reps int,
  fatta boolean default false,
  ordine int default 0
);

create table if not exists libreria_esercizi (
  id uuid primary key default uuid_generate_v4(),
  nome text unique not null
);

create table if not exists log_carichi (
  id uuid primary key default uuid_generate_v4(),
  esercizio_nome text not null,
  data date default current_date,
  peso numeric,
  reps int,
  created_at timestamptz default now()
);

-- Row Level Security: abilitata ma con accesso aperto tramite la chiave anon,
-- va bene per un'app personale non condivisa pubblicamente. Non condividere
-- l'URL del progetto Supabase con altri.
alter table schede enable row level security;
alter table esercizi enable row level security;
alter table serie enable row level security;
alter table libreria_esercizi enable row level security;
alter table log_carichi enable row level security;

drop policy if exists "accesso aperto" on schede;
create policy "accesso aperto" on schede for all using (true) with check (true);

drop policy if exists "accesso aperto" on esercizi;
create policy "accesso aperto" on esercizi for all using (true) with check (true);

drop policy if exists "accesso aperto" on serie;
create policy "accesso aperto" on serie for all using (true) with check (true);

drop policy if exists "accesso aperto" on libreria_esercizi;
create policy "accesso aperto" on libreria_esercizi for all using (true) with check (true);

drop policy if exists "accesso aperto" on log_carichi;
create policy "accesso aperto" on log_carichi for all using (true) with check (true);
