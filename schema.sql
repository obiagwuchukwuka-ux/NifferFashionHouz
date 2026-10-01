-- Run in the Supabase SQL editor.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('men','women')),
  price integer not null,            -- Naira
  image_url text,
  featured boolean not null default false
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  email text not null, full_name text not null, phone text not null,
  address text not null, city text not null, state text not null,
  status text not null default 'pending',   -- pending | paid | failed
  reference text,
  created_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  product_id uuid not null references public.products,
  qty integer not null check (qty > 0)
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Anyone can view products" on public.products for select using (true);
create policy "Users see own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Users create own orders" on public.orders for insert with check (auth.uid() = user_id);
create policy "Users see own items" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy "Users add items to own orders" on public.order_items for insert
  with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
-- Note: users cannot update orders. Only the confirm-order function (service role) marks them paid.

insert into public.products (name, category, price, featured) values
 ('Royal Ankara Two-Piece','women',28000,true), ('Lace Evening Gown','women',65000,true),
 ('Satin Blouse','women',18000,false), ('Corporate Pencil Dress','women',32000,true),
 ('Premium Cango Pants','men',22000,true), ('Ankara Short-Sleeve Shirt','men',20000,true),
 ('Tailored Corporate Shirt','men',24000,false), ('Linen Shorts','men',14000,false);
