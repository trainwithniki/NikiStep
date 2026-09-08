-- Administrator audit history and owner-only recycle bin for NikiStep.
-- Run once in Supabase SQL Editor. Existing app_admins are preserved.

alter table public.app_admins add column if not exists display_name text;
alter table public.app_admins add column if not exists email text;
alter table public.app_admins add column if not exists is_owner boolean not null default false;
alter table public.app_admins add column if not exists active boolean not null default true;
alter table public.app_admins add column if not exists can_view_history boolean not null default false;
alter table public.app_admins add column if not exists audit_color text;

alter table public.app_admins drop constraint if exists app_admins_audit_color_check;
alter table public.app_admins add constraint app_admins_audit_color_check
  check (audit_color is null or audit_color ~ '^#[0-9A-Fa-f]{6}$');

update public.app_admins a
set email = lower(u.email)
from auth.users u
where u.id = a.user_id and (a.email is null or a.email = '');

do $$
declare first_admin uuid;
begin
  if not exists (select 1 from public.app_admins where is_owner) then
    select a.user_id into first_admin
    from public.app_admins a join auth.users u on u.id = a.user_id
    order by u.created_at, a.user_id limit 1;
    if first_admin is not null then
      update public.app_admins set is_owner = true, active = true, can_view_history = true
      where user_id = first_admin;
    end if;
  end if;
end $$;

create unique index if not exists app_admins_single_owner_idx
  on public.app_admins ((is_owner)) where is_owner;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.app_admins
    where user_id = auth.uid() and active
  );
$$;
revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

create or replace function public.is_app_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(
    select 1 from public.app_admins
    where user_id = auth.uid() and active and is_owner
  );
$$;
revoke all on function public.is_app_owner() from public, anon;
grant execute on function public.is_app_owner() to authenticated;

create or replace function public.can_view_history()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists(
    select 1 from public.app_admins
    where user_id = auth.uid() and active and (is_owner or can_view_history)
  );
$$;
revoke all on function public.can_view_history() from public, anon;
grant execute on function public.can_view_history() to authenticated;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.app_admins(user_id) on delete set null,
  actor_email text not null,
  actor_name text,
  actor_color text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

create table if not exists public.deleted_records (
  entity_type text not null,
  entity_id text not null,
  parent_id text,
  row_data jsonb not null,
  deleted_at timestamptz not null default transaction_timestamp(),
  deleted_by uuid references public.app_admins(user_id) on delete set null,
  primary key (entity_type, entity_id)
);
create index if not exists deleted_records_parent_idx
  on public.deleted_records (parent_id, deleted_at desc);

alter table public.audit_logs enable row level security;
alter table public.deleted_records enable row level security;
revoke all on table public.audit_logs from public, anon, authenticated;
revoke all on table public.deleted_records from public, anon, authenticated;
grant select on table public.audit_logs to authenticated;
grant select on table public.deleted_records to authenticated;
revoke all on sequence public.audit_logs_id_seq from public, anon, authenticated;

drop policy if exists "audit history permitted read" on public.audit_logs;
create policy "audit history permitted read" on public.audit_logs
  for select to authenticated using (public.can_view_history());
drop policy if exists "deleted records owner read" on public.deleted_records;
create policy "deleted records owner read" on public.deleted_records
  for select to authenticated using (public.is_app_owner());

create or replace function public.record_admin_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  actor public.app_admins%rowtype;
  actor_auth_email text;
  old_data jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  new_data jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  allowed_fields text[];
  field_name text;
  changes jsonb := '{}'::jsonb;
  object_data jsonb;
  object_id text;
  object_label text;
  object_date text;
  object_time text;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  select * into actor from public.app_admins
  where user_id = auth.uid() and active;
  if not found then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  select email into actor_auth_email from auth.users where id = auth.uid();

  allowed_fields := case tg_table_name
    when 'sessions' then array['date','time','title','trainer','location','duration','capacity','booking_closed','force_open','booking_days','booking_close_hours','announcement','description']
    when 'registrations' then array['session_id','name','has_multisport','booked_by','pending','cancelled_at']
    when 'site_settings' then array['key','value']
    when 'payment_adjustments' then array['session_id','extra_individual','extra_multisport','extra_card8','extra_card12']
    when 'payment_config' then array['id','multisport_rate','individual_rate']
    when 'registration_payment_overrides' then array['registration_id','payment_type']
    when 'manual_payment_sessions' then array['date','time','title','location','template_id','multisport_count','individual_count','card8_count','card12_count','multisport_rate','individual_rate','card8_rate','card12_rate']
    when 'manual_payment_templates' then array['name','title','location','time','multisport_rate','individual_rate','card8_rate','card12_rate','sort_order']
    when 'training_templates' then array['name','title','trainer','location','time','duration','capacity','booking_days','booking_close_hours','description','sort_order']
    when 'app_admins' then array['display_name','email','is_owner','active','can_view_history','audit_color']
    else null
  end;
  if allowed_fields is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  foreach field_name in array allowed_fields loop
    if tg_op = 'INSERT' and new_data ? field_name then
      changes := changes || jsonb_build_object(field_name, jsonb_build_object('from', null, 'to', new_data -> field_name));
    elsif tg_op = 'DELETE' and old_data ? field_name then
      changes := changes || jsonb_build_object(field_name, jsonb_build_object('from', old_data -> field_name, 'to', null));
    elsif tg_op = 'UPDATE' and (old_data -> field_name) is distinct from (new_data -> field_name) then
      changes := changes || jsonb_build_object(field_name, jsonb_build_object('from', old_data -> field_name, 'to', new_data -> field_name));
    end if;
  end loop;
  if tg_op = 'UPDATE' and changes = '{}'::jsonb then return new; end if;

  object_data := case when tg_op = 'DELETE' then old_data else new_data end;
  object_id := coalesce(object_data->>'id', object_data->>'user_id', object_data->>'session_id', object_data->>'registration_id', object_data->>'key');
  object_date := object_data->>'date';
  object_time := object_data->>'time';
  object_label := case tg_table_name
    when 'sessions' then coalesce(object_data->>'title','Тренировка') || coalesce(' · ' || object_date,'')
    when 'registrations' then coalesce(object_data->>'name','Записване')
    when 'site_settings' then coalesce(object_data->>'key','Настройка на сайта')
    when 'payment_adjustments' then 'Корекция за тренировка ' || coalesce(object_data->>'session_id','')
    when 'payment_config' then 'Основни такси'
    when 'registration_payment_overrides' then 'Тарифа на записан участник'
    when 'manual_payment_sessions' then coalesce(object_data->>'title','Външна тренировка') || coalesce(' · ' || object_date,'')
    when 'manual_payment_templates' then coalesce(object_data->>'name','Шаблон за плащане')
    when 'training_templates' then coalesce(object_data->>'name','Шаблон за тренировка')
    when 'app_admins' then coalesce(object_data->>'display_name',object_data->>'email','Административен профил')
    else tg_table_name
  end;

  insert into public.audit_logs(actor_id,actor_email,actor_name,actor_color,action,entity_type,entity_id,details)
  values (
    actor.user_id,
    coalesce(nullif(actor.email,''),actor_auth_email,'unknown'),
    nullif(actor.display_name,''), actor.audit_color,
    tg_op, tg_table_name, object_id,
    jsonb_build_object('label',object_label,'date',object_date,'time',object_time,'changes',changes)
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function public.record_admin_audit() from public, anon, authenticated;

create or replace function public.archive_deleted_admin_record()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  row_json jsonb := to_jsonb(old);
  record_id text;
  record_parent text;
begin
  if not public.is_app_admin() then return old; end if;
  record_id := coalesce(row_json->>'id',row_json->>'session_id',row_json->>'registration_id',row_json->>'key');
  if record_id is null then return old; end if;
  record_parent := case tg_table_name
    when 'registrations' then row_json->>'session_id'
    when 'payment_adjustments' then row_json->>'session_id'
    when 'registration_payment_overrides' then row_json->>'registration_id'
    else null
  end;
  insert into public.deleted_records(entity_type,entity_id,parent_id,row_data,deleted_by)
  values(tg_table_name,record_id,record_parent,row_json,auth.uid())
  on conflict(entity_type,entity_id) do update
  set parent_id=excluded.parent_id,row_data=excluded.row_data,deleted_at=transaction_timestamp(),deleted_by=excluded.deleted_by;
  return old;
end;
$$;
revoke all on function public.archive_deleted_admin_record() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['sessions','registrations','site_settings','payment_adjustments','payment_config','registration_payment_overrides','manual_payment_sessions','manual_payment_templates','training_templates','app_admins'] loop
    execute format('drop trigger if exists admin_audit_%I on public.%I',table_name,table_name);
    execute format('create trigger admin_audit_%I after insert or update or delete on public.%I for each row execute function public.record_admin_audit()',table_name,table_name);
  end loop;
  foreach table_name in array array['sessions','registrations','site_settings','payment_adjustments','payment_config','registration_payment_overrides','manual_payment_sessions','manual_payment_templates','training_templates'] loop
    execute format('drop trigger if exists archive_deleted_%I on public.%I',table_name,table_name);
    execute format('create trigger archive_deleted_%I before delete on public.%I for each row execute function public.archive_deleted_admin_record()',table_name,table_name);
  end loop;
end $$;

create or replace function public.admin_history_context()
returns table(user_id uuid,email text,display_name text,is_owner boolean,can_view_history boolean,audit_color text)
language sql stable security definer set search_path = ''
as $$
  select a.user_id,coalesce(nullif(a.email,''),u.email),a.display_name,a.is_owner,
         (a.is_owner or a.can_view_history),a.audit_color
  from public.app_admins a join auth.users u on u.id=a.user_id
  where a.user_id=auth.uid() and a.active;
$$;
revoke all on function public.admin_history_context() from public, anon;
grant execute on function public.admin_history_context() to authenticated;

create or replace function public.owner_list_admin_profiles()
returns table(user_id uuid,email text,display_name text,is_owner boolean,active boolean,can_view_history boolean,audit_color text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_app_owner() then raise exception 'Owner access required'; end if;
  return query select a.user_id,coalesce(nullif(a.email,''),u.email),a.display_name,a.is_owner,a.active,a.can_view_history,a.audit_color
  from public.app_admins a join auth.users u on u.id=a.user_id order by a.is_owner desc,coalesce(a.display_name,u.email);
end;
$$;
revoke all on function public.owner_list_admin_profiles() from public, anon;
grant execute on function public.owner_list_admin_profiles() to authenticated;

create or replace function public.owner_add_admin_profile(target_email text,next_display_name text default null,next_can_view_history boolean default false,next_audit_color text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare target_id uuid;
begin
  if not public.is_app_owner() then raise exception 'Owner access required'; end if;
  if next_audit_color is not null and next_audit_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid HEX color'; end if;
  select id into target_id from auth.users where lower(email)=lower(trim(target_email)) limit 1;
  if target_id is null then raise exception 'Authentication user not found'; end if;
  insert into public.app_admins(user_id,email,display_name,active,can_view_history,audit_color)
  values(target_id,lower(trim(target_email)),nullif(trim(next_display_name),''),true,next_can_view_history,upper(next_audit_color))
  on conflict(user_id) do update set email=excluded.email,display_name=excluded.display_name,active=true,
    can_view_history=excluded.can_view_history,audit_color=excluded.audit_color;
  return target_id;
end;
$$;
revoke all on function public.owner_add_admin_profile(text,text,boolean,text) from public, anon;
grant execute on function public.owner_add_admin_profile(text,text,boolean,text) to authenticated;

create or replace function public.owner_update_admin_profile(target_user_id uuid,next_display_name text,next_active boolean,next_can_view_history boolean,next_audit_color text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_app_owner() then raise exception 'Owner access required'; end if;
  if next_audit_color is not null and next_audit_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid HEX color'; end if;
  if target_user_id=auth.uid() and not next_active then raise exception 'Owner cannot deactivate own profile'; end if;
  update public.app_admins set display_name=nullif(trim(next_display_name),''),active=next_active,
    can_view_history=case when is_owner then true else next_can_view_history end,
    audit_color=case when next_audit_color is null then null else upper(next_audit_color) end
  where user_id=target_user_id;
  if not found then return false; end if;
  update public.audit_logs
  set actor_color=case when next_audit_color is null then null else upper(next_audit_color) end
  where actor_id=target_user_id;
  return true;
end;
$$;
revoke all on function public.owner_update_admin_profile(uuid,text,boolean,boolean,text) from public, anon;
grant execute on function public.owner_update_admin_profile(uuid,text,boolean,boolean,text) to authenticated;

create or replace function public.owner_set_audit_color(target_user_id uuid,next_audit_color text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_app_owner() then raise exception 'Owner access required'; end if;
  if next_audit_color is not null and next_audit_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid HEX color'; end if;
  update public.app_admins set audit_color=case when next_audit_color is null then null else upper(next_audit_color) end where user_id=target_user_id;
  if not found then return false; end if;
  update public.audit_logs set actor_color=case when next_audit_color is null then null else upper(next_audit_color) end where actor_id=target_user_id;
  return true;
end;
$$;
revoke all on function public.owner_set_audit_color(uuid,text) from public, anon;
grant execute on function public.owner_set_audit_color(uuid,text) to authenticated;

create or replace function public.owner_restore_deleted_item(p_entity_type text,p_entity_id text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare archived public.deleted_records%rowtype; child record; restored_count integer := 0; child_result jsonb;
begin
  if not public.is_app_owner() then raise exception 'Owner access required'; end if;
  select * into archived from public.deleted_records where entity_type=p_entity_type and entity_id=p_entity_id;
  if not found then raise exception 'Deleted record not found'; end if;

  case p_entity_type
    when 'sessions' then insert into public.sessions select (jsonb_populate_record(null::public.sessions,archived.row_data)).*;
    when 'registrations' then
      if not exists(select 1 from public.sessions where id=archived.parent_id) then raise exception 'Parent session is missing'; end if;
      insert into public.registrations select (jsonb_populate_record(null::public.registrations,archived.row_data)).*;
    when 'site_settings' then insert into public.site_settings select (jsonb_populate_record(null::public.site_settings,archived.row_data)).*;
    when 'payment_adjustments' then
      if not exists(select 1 from public.sessions where id=archived.parent_id) then raise exception 'Parent session is missing'; end if;
      insert into public.payment_adjustments select (jsonb_populate_record(null::public.payment_adjustments,archived.row_data)).*;
    when 'payment_config' then insert into public.payment_config select (jsonb_populate_record(null::public.payment_config,archived.row_data)).*;
    when 'registration_payment_overrides' then
      if not exists(select 1 from public.registrations where id=archived.parent_id) then raise exception 'Parent registration is missing'; end if;
      insert into public.registration_payment_overrides select (jsonb_populate_record(null::public.registration_payment_overrides,archived.row_data)).*;
    when 'manual_payment_sessions' then insert into public.manual_payment_sessions select (jsonb_populate_record(null::public.manual_payment_sessions,archived.row_data)).*;
    when 'manual_payment_templates' then insert into public.manual_payment_templates select (jsonb_populate_record(null::public.manual_payment_templates,archived.row_data)).*;
    when 'training_templates' then insert into public.training_templates select (jsonb_populate_record(null::public.training_templates,archived.row_data)).*;
    else raise exception 'Unsupported entity type';
  end case;
  restored_count := 1;
  delete from public.deleted_records where entity_type=p_entity_type and entity_id=p_entity_id;

  if p_entity_type in ('sessions','registrations') then
    for child in select entity_type,entity_id from public.deleted_records where parent_id=p_entity_id order by deleted_at loop
      child_result := public.owner_restore_deleted_item(child.entity_type,child.entity_id);
      restored_count := restored_count + coalesce((child_result->>'restored_count')::integer,0);
    end loop;
  end if;
  return jsonb_build_object('entity_type',p_entity_type,'restored_count',restored_count);
exception when unique_violation then
  raise exception 'Record already exists and cannot be restored';
end;
$$;
revoke all on function public.owner_restore_deleted_item(text,text) from public, anon;
grant execute on function public.owner_restore_deleted_item(text,text) to authenticated;

revoke all on table public.app_admins from public, anon, authenticated;
notify pgrst, 'reload schema';
