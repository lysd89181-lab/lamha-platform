-- LAMHA schema (Supabase / PostgreSQL). Run once in SQL Editor, in this order.
create extension if not exists pgcrypto;

-- ===== Users & roles =====
create table profiles(
  id uuid primary key references auth.users on delete cascade,
  full_name text, phone text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected')),
  created_at timestamptz not null default now());
create table user_roles(
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('super_admin','admin')),
  permissions text[] not null default '{}');
create function is_admin() returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from user_roles where user_id=auth.uid()) $$;
create table verification_requests(
  id bigserial primary key, user_id uuid not null references auth.users,
  document_path text not null, status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users, note text, created_at timestamptz not null default now());

-- ===== Catalog / services / pricing =====
create table services(
  key text primary key, name text not null,
  enabled boolean not null default true,
  requires_verification boolean not null default false,
  min_usd numeric(10,2) not null default 0, max_usd numeric(10,2));
insert into services(key,name) values
 ('gift_cards','Gift Cards'),('game_keys','Game Keys'),('top_ups','Game Top-ups'),
 ('steam','Steam'),('telegram','Telegram'),('manual','Manual Services'),('shein','SHEIN');
create table categories(id bigserial primary key, service text not null references services, name text not null);
create table products(
  id bigserial primary key, service text not null references services,
  provider_ref text not null, name text not null, image_url text, active boolean not null default true,
  unique(service,provider_ref));
create table pricing_rules(
  id bigserial primary key,
  scope text not null check (scope in ('global','service','product')),
  scope_key text not null default '',
  percent numeric(6,2) not null default 0 check (percent>=0),
  fixed_usd numeric(10,2) not null default 0 check (fixed_usd>=0),
  unique(scope,scope_key));
insert into pricing_rules(scope,percent) values ('global',10);
create table exchange_rates(
  id bigserial primary key, from_cur text not null, to_cur text not null,
  rate numeric(14,6) not null check (rate>0), created_at timestamptz not null default now(), created_by uuid);
create table app_settings(key text primary key, value jsonb not null);
insert into app_settings values
 ('shein_deposit_pct','50'),('shein_shipping_usd','0'),('shein_extra_fee_usd','0'),
 ('topup_min_usd','1'),('topup_max_usd','500');

-- ===== Wallet ledger (append-only) =====
create table wallets(
  user_id uuid primary key references auth.users on delete cascade,
  balance numeric(14,2) not null default 0 check (balance>=0),
  updated_at timestamptz not null default now());
create table wallet_transactions(
  id bigserial primary key, user_id uuid not null references wallets(user_id),
  kind text not null check (kind in ('deposit','debit','refund')),
  amount numeric(14,2) not null check (amount>0),
  balance_after numeric(14,2) not null,
  idempotency_key text not null unique, ref_type text, ref_id text,
  created_at timestamptz not null default now());
create index on wallet_transactions(user_id,created_at desc);
create function no_mutate() returns trigger language plpgsql as $$ begin raise exception 'append-only'; end $$;
create trigger wt_immutable before update or delete on wallet_transactions for each row execute function no_mutate();

-- ===== Orders / payments =====
create table orders(
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  user_id uuid not null references auth.users,
  service text not null references services,
  status text not null default 'pending_payment' check (status in
   ('pending_payment','paid','processing','completed','failed','refunded','cancelled')),
  total_usd numeric(14,2) not null check (total_usd>=0),
  cost_usd numeric(14,2) not null check (cost_usd>=0),
  paid_usd numeric(14,2) not null default 0,
  provider_order_ref text, idempotency_key text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,idempotency_key));
create table order_items(
  id bigserial primary key, order_id uuid not null references orders on delete cascade,
  product_ref text, name text not null, qty int not null check (qty>0),
  unit_cost numeric(14,2) not null, unit_price numeric(14,2) not null);
create table order_status_history(
  id bigserial primary key, order_id uuid not null references orders on delete cascade,
  status text not null, note text, created_at timestamptz not null default now());
create table provider_orders(
  id bigserial primary key, order_id uuid not null references orders, provider text not null,
  external_ref text, status text, delivered_codes text, raw jsonb,
  created_at timestamptz not null default now(), unique(provider,external_ref));
create table payments(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users, purpose text not null check (purpose in ('wallet_topup','order')),
  order_id uuid references orders, amount_usd numeric(14,2) not null check (amount_usd>0),
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  provider text not null default 'ezone', provider_ref text, link_url text,
  created_at timestamptz not null default now(), paid_at timestamptz);
create table webhook_events(
  id bigserial primary key, provider text not null, event_id text not null,
  payload jsonb not null, processed_at timestamptz, unique(provider,event_id));

-- ===== Support / notifications / audit =====
create table notifications(
  id bigserial primary key, user_id uuid not null references auth.users,
  title text not null, body text, read boolean not null default false, created_at timestamptz not null default now());
create table support_tickets(
  id bigserial primary key, user_id uuid not null references auth.users, order_id uuid references orders,
  subject text not null, body text not null, status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now());
create table admin_audit_logs(
  id bigserial primary key, actor uuid not null, action text not null, target text, detail jsonb,
  created_at timestamptz not null default now());

-- ===== Pricing: product > service > global (never summed) =====
create function sell_price(p_cost numeric,p_service text,p_product text) returns numeric
language sql stable as $$
 select round(p_cost*(1+r.percent/100)+r.fixed_usd,2) from (
  select percent,fixed_usd from pricing_rules
  where (scope='product' and scope_key=p_product) or (scope='service' and scope_key=p_service) or scope='global'
  order by case scope when 'product' then 1 when 'service' then 2 else 3 end limit 1) r $$;

create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id) values(new.id); insert into wallets(user_id) values(new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ===== Atomic wallet movement (idempotent, never negative) =====
create function wallet_apply(p_user uuid,p_kind text,p_amount numeric,p_key text,p_ref_type text default null,p_ref_id text default null)
returns numeric language plpgsql security definer set search_path=public as $$
declare v_bal numeric; v_new numeric;
begin
 select balance into v_bal from wallets where user_id=p_user for update;
 if not found then raise exception 'wallet_not_found'; end if;
 select balance_after into v_new from wallet_transactions where idempotency_key=p_key;
 if found then return v_new; end if;
 if p_kind='debit' then
   if v_bal<p_amount then raise exception 'insufficient_funds'; end if; v_new:=v_bal-p_amount;
 else v_new:=v_bal+p_amount; end if;
 update wallets set balance=v_new,updated_at=now() where user_id=p_user;
 insert into wallet_transactions(user_id,kind,amount,balance_after,idempotency_key,ref_type,ref_id)
  values(p_user,p_kind,p_amount,v_new,p_key,p_ref_type,p_ref_id);
 return v_new;
end $$;

-- ===== Atomic order + wallet debit. Price is computed HERE from provider cost =====
create function place_wallet_order(p_user uuid,p_service text,p_product text,p_name text,p_qty int,p_unit_cost numeric,p_key text)
returns uuid language plpgsql security definer set search_path=public as $$
declare s services; v_price numeric; v_total numeric; v_id uuid; v_ver text;
begin
 select * into s from services where key=p_service;
 if not found or not s.enabled then raise exception 'service_disabled'; end if;
 select verification_status into v_ver from profiles where id=p_user;
 if s.requires_verification and v_ver<>'verified' then raise exception 'verification_required'; end if;
 select id into v_id from orders where user_id=p_user and idempotency_key=p_key;
 if found then return v_id; end if;
 if p_qty<1 or p_unit_cost<=0 then raise exception 'bad_input'; end if;
 v_price:=sell_price(p_unit_cost,p_service,p_product); v_total:=v_price*p_qty;
 if v_total<s.min_usd or (s.max_usd is not null and v_total>s.max_usd) then raise exception 'out_of_limits'; end if;
 insert into orders(user_id,service,status,total_usd,cost_usd,paid_usd,idempotency_key)
  values(p_user,p_service,'paid',v_total,p_unit_cost*p_qty,v_total,p_key) returning id into v_id;
 insert into order_items(order_id,product_ref,name,qty,unit_cost,unit_price) values(v_id,p_product,p_name,p_qty,p_unit_cost,v_price);
 insert into order_status_history(order_id,status,note) values(v_id,'paid','wallet');
 perform wallet_apply(p_user,'debit',v_total,'order:'||v_id,'order',v_id::text);
 return v_id;
end $$;
revoke all on function wallet_apply,place_wallet_order from public,anon,authenticated;
grant execute on function wallet_apply,place_wallet_order to service_role;

-- ===== RLS =====
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','verification_requests','services','categories','products','pricing_rules','exchange_rates','app_settings','wallets','wallet_transactions','orders','order_items','order_status_history','provider_orders','payments','webhook_events','notifications','support_tickets','admin_audit_logs']
 loop execute format('alter table %I enable row level security',t); end loop; end $$;
create policy s_pub on services for select using (true);
create policy c_pub on categories for select using (true);
create policy pr_pub on products for select using (active);
create policy p_sel on profiles for select using (id=auth.uid() or is_admin());
create policy p_upd on profiles for update using (id=auth.uid()) with check (id=auth.uid());
revoke update on profiles from authenticated; grant update(full_name,phone) on profiles to authenticated;
create policy w_sel on wallets for select using (user_id=auth.uid() or is_admin());
create policy t_sel on wallet_transactions for select using (user_id=auth.uid() or is_admin());
create policy o_sel on orders for select using (user_id=auth.uid() or is_admin());
create policy oi_sel on order_items for select using (exists(select 1 from orders o where o.id=order_id and (o.user_id=auth.uid() or is_admin())));
create policy h_sel on order_status_history for select using (exists(select 1 from orders o where o.id=order_id and (o.user_id=auth.uid() or is_admin())));
create policy pay_sel on payments for select using (user_id=auth.uid() or is_admin());
create policy n_sel on notifications for select using (user_id=auth.uid());
create policy n_upd on notifications for update using (user_id=auth.uid()) with check (user_id=auth.uid());
revoke update on notifications from authenticated; grant update(read) on notifications to authenticated;
create policy st_sel on support_tickets for select using (user_id=auth.uid() or is_admin());
create policy st_ins on support_tickets for insert with check (user_id=auth.uid());
create policy v_sel on verification_requests for select using (user_id=auth.uid() or is_admin());
create policy r_sel on user_roles for select using (user_id=auth.uid() or is_admin());
-- No policy = service role only: pricing_rules, exchange_rates, app_settings, provider_orders (codes), webhook_events, admin_audit_logs.
-- Hide cost from clients (column-level): drop table-level select, grant all columns except cost_usd.
revoke select on orders from authenticated, anon;
grant select(id,number,user_id,service,status,total_usd,paid_usd,provider_order_ref,idempotency_key,created_at,updated_at) on orders to authenticated;
revoke select on order_items from authenticated, anon;
grant select(id,order_id,product_ref,name,qty,unit_price) on order_items to authenticated;
