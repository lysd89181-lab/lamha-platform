-- LAMHA migration 002 (additive; run AFTER schema.sql). Not applied to any DB yet.
-- Fixes: top-up crediting was not atomic with marking the payment paid (a crash in between lost the deposit).

-- cost keeps provider precision (ReSellCodes returns 4 decimals); sell prices stay 2 decimals
alter table order_items alter column unit_cost type numeric(14,4);
alter table orders alter column cost_usd type numeric(14,4);

-- Atomic, idempotent top-up settlement (payment -> paid and wallet credit in ONE transaction)
create function settle_topup(p_payment uuid) returns text language plpgsql security definer set search_path=public as $$
declare pay payments;
begin
 select * into pay from payments where id=p_payment for update;
 if not found then return 'not_found'; end if;
 if pay.status='paid' then return 'already'; end if;
 if pay.status<>'pending' or pay.purpose<>'wallet_topup' then return 'blocked'; end if;
 update payments set status='paid',paid_at=now() where id=pay.id;
 perform wallet_apply(pay.user_id,'deposit',pay.amount_usd,'topup:'||pay.id,'payment',pay.id::text);
 insert into notifications(user_id,title,body) values(pay.user_id,'تم شحن المحفظة',pay.amount_usd||' USD');
 return 'credited';
end $$;

-- Idempotent refund of what the customer paid for an order into the LAMHA wallet
create function refund_order(p_order uuid,p_reason text) returns text language plpgsql security definer set search_path=public as $$
declare o orders;
begin
 select * into o from orders where id=p_order for update;
 if not found then return 'not_found'; end if;
 if o.status in ('refunded','cancelled') then return 'already'; end if;
 if o.status='completed' then raise exception 'completed_not_refundable'; end if;
 if o.paid_usd>0 then perform wallet_apply(o.user_id,'refund',o.paid_usd,'refund:'||o.id,'order',o.id::text); end if;
 update orders set status='refunded',updated_at=now() where id=o.id;
 insert into order_status_history(order_id,status,note) values(o.id,'refunded',left(coalesce(p_reason,''),200));
 insert into notifications(user_id,title,body) values(o.user_id,'تم استرداد المبلغ إلى محفظتك','طلب #'||o.number||' — '||o.paid_usd||' USD');
 return 'refunded';
end $$;

-- Only one caller can move paid -> processing (guards against double provider execution)
create function claim_order(p_order uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 update orders set status='processing',updated_at=now() where id=p_order and status='paid';
 if not found then return false; end if;
 insert into order_status_history(order_id,status,note) values(p_order,'processing','claimed');
 return true;
end $$;

-- SHEIN totals. All arithmetic in numeric (exact). Pricing priority product > service > global via sell_price.
-- p_items: [{ref,name,qty,cost}] where cost is USD unit cost from the SHEIN fetch done server-side.
create function shein_totals(p_items jsonb) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare it jsonb; sell numeric:=0; cst numeric:=0; u numeric; ship numeric; extra numeric; pct numeric; total numeric; dep numeric; lines jsonb:='[]'::jsonb;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 then raise exception 'bad_input'; end if;
 for it in select value from jsonb_array_elements(p_items) loop
  if (it->>'qty')::int not between 1 and 100 or (it->>'cost')::numeric<=0 then raise exception 'bad_input'; end if;
  u:=sell_price((it->>'cost')::numeric,'shein',it->>'ref');
  sell:=sell+u*(it->>'qty')::int; cst:=cst+(it->>'cost')::numeric*(it->>'qty')::int;
  lines:=lines||jsonb_build_object('ref',it->>'ref','name',it->>'name','qty',(it->>'qty')::int,'cost',(it->>'cost')::numeric,'price',u);
 end loop;
 select (value#>>'{}')::numeric into ship from app_settings where key='shein_shipping_usd';
 select (value#>>'{}')::numeric into extra from app_settings where key='shein_extra_fee_usd';
 select (value#>>'{}')::numeric into pct from app_settings where key='shein_deposit_pct';
 total:=sell+coalesce(ship,0)+coalesce(extra,0); dep:=round(total*coalesce(pct,50)/100,2);
 return jsonb_build_object('items',lines,'items_total',sell,'shipping',coalesce(ship,0),'fees',coalesce(extra,0),'total',total,'deposit',dep,'remaining',total-dep,'cost',cst);
end $$;

create function place_shein_order(p_user uuid,p_items jsonb,p_key text,p_meta jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare s services; t jsonb; v_id uuid; v_ver text; l jsonb; v_num bigint;
begin
 select * into s from services where key='shein';
 if not found or not s.enabled then raise exception 'service_disabled'; end if;
 select verification_status into v_ver from profiles where id=p_user;
 if s.requires_verification and v_ver<>'verified' then raise exception 'verification_required'; end if;
 select id into v_id from orders where user_id=p_user and idempotency_key=p_key;
 if found then select jsonb_build_object('order_id',id,'number',number,'total',total_usd,'deposit',paid_usd,'remaining',total_usd-paid_usd,'duplicate',true) into t from orders where id=v_id; return t; end if;
 t:=shein_totals(p_items);
 if (t->>'total')::numeric<s.min_usd or (s.max_usd is not null and (t->>'total')::numeric>s.max_usd) then raise exception 'out_of_limits'; end if;
 insert into orders(user_id,service,status,total_usd,cost_usd,paid_usd,idempotency_key)
  values(p_user,'shein','paid',(t->>'total')::numeric,(t->>'cost')::numeric,(t->>'deposit')::numeric,p_key) returning id,number into v_id,v_num;
 for l in select value from jsonb_array_elements(t->'items') loop
  insert into order_items(order_id,product_ref,name,qty,unit_cost,unit_price) values(v_id,l->>'ref',left(l->>'name',200),(l->>'qty')::int,(l->>'cost')::numeric,(l->>'price')::numeric);
 end loop;
 insert into order_status_history(order_id,status,note) values(v_id,'paid','deposit');
 insert into provider_orders(order_id,provider,external_ref,status,raw) values(v_id,'shein',v_id::text,'awaiting_purchase',p_meta);
 perform wallet_apply(p_user,'debit',(t->>'deposit')::numeric,'order:'||v_id,'order',v_id::text);
 insert into notifications(user_id,title,body) values(p_user,'تم استلام العربون','طلب SHEIN #'||v_num);
 return jsonb_build_object('order_id',v_id,'number',v_num,'total',t->'total','deposit',t->'deposit','remaining',t->'remaining','duplicate',false);
end $$;

-- private bucket for verification documents (accessed only by the worker with the service key)
insert into storage.buckets(id,name,public) values('verification','verification',false) on conflict do nothing;

revoke all on function settle_topup,refund_order,claim_order,shein_totals,place_shein_order from public,anon,authenticated;
grant execute on function settle_topup,refund_order,claim_order,shein_totals,place_shein_order to service_role;
