create table public.facturas (id uuid primary key, owner_id uuid, total int);
create table public.perfiles (id uuid primary key, nombre text);
alter table public.perfiles enable row level security;
