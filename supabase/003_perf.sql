-- LAMHA migration 003 (additive; run AFTER 002). Not applied to any DB yet.
create index if not exists orders_user_number_idx on orders(user_id, number desc);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_processing_idx on orders(updated_at) where status='processing' and provider_order_ref is not null;
create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists order_history_order_idx on order_status_history(order_id);
create index if not exists payments_user_idx on payments(user_id, created_at desc);
create index if not exists payments_pending_idx on payments(created_at) where status='pending';
create index if not exists provider_orders_order_idx on provider_orders(order_id);
create index if not exists notifications_user_idx on notifications(user_id, id desc);
create index if not exists tickets_user_idx on support_tickets(user_id, id desc);
create index if not exists verification_user_idx on verification_requests(user_id);

create or replace function admin_stats() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
  'customers',(select count(*) from profiles),
  'orders',(select count(*) from orders),
  'pending_payments',(select count(*) from payments where status='pending'),
  'needs_action',(select count(*) from orders where status in ('paid','processing')),
  'revenue_usd',coalesce((select sum(total_usd) from orders where status='completed'),0),
  'expected_profit_usd',coalesce((select sum(total_usd-cost_usd) from orders where status='completed'),0)) $$;
revoke all on function admin_stats from public, anon, authenticated;
grant execute on function admin_stats to service_role;
