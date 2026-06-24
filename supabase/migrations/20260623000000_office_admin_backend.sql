create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id serial primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null default 'employee',
  department text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.desks (
  id serial primary key,
  name text not null,
  floor text not null,
  zone text,
  status text not null default 'available',
  amenities text,
  qr_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_rooms (
  id serial primary key,
  name text not null,
  capacity integer not null,
  floor text not null,
  status text not null default 'available',
  facilities text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.desk_bookings (
  id serial primary key,
  desk_id integer not null references public.desks(id),
  user_id integer not null references public.users(id),
  date date not null,
  status text not null default 'confirmed',
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_room_bookings (
  id serial primary key,
  room_id integer not null references public.meeting_rooms(id),
  user_id integer not null references public.users(id),
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'confirmed',
  attendees text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id serial primary key,
  user_id integer not null references public.users(id),
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_logs (
  id serial primary key,
  desk_id integer not null references public.desks(id),
  action text not null,
  reason text,
  performed_by integer not null references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists desks_status_idx on public.desks(status);
create index if not exists desks_floor_idx on public.desks(floor);
create index if not exists desks_zone_idx on public.desks(zone);
create index if not exists desk_bookings_desk_date_idx on public.desk_bookings(desk_id, date);
create index if not exists desk_bookings_user_date_idx on public.desk_bookings(user_id, date);
create index if not exists desk_bookings_status_date_idx on public.desk_bookings(status, date);
create index if not exists meeting_rooms_status_idx on public.meeting_rooms(status);
create index if not exists meeting_room_bookings_room_time_idx on public.meeting_room_bookings(room_id, start_time, end_time);
create index if not exists meeting_room_bookings_user_time_idx on public.meeting_room_bookings(user_id, start_time desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists maintenance_logs_desk_created_idx on public.maintenance_logs(desk_id, created_at desc);
create index if not exists maintenance_logs_created_idx on public.maintenance_logs(created_at desc);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function private.set_updated_at();

drop trigger if exists desks_set_updated_at on public.desks;
create trigger desks_set_updated_at
before update on public.desks
for each row execute function private.set_updated_at();

drop trigger if exists meeting_rooms_set_updated_at on public.meeting_rooms;
create trigger meeting_rooms_set_updated_at
before update on public.meeting_rooms
for each row execute function private.set_updated_at();

drop trigger if exists desk_bookings_set_updated_at on public.desk_bookings;
create trigger desk_bookings_set_updated_at
before update on public.desk_bookings
for each row execute function private.set_updated_at();

drop trigger if exists meeting_room_bookings_set_updated_at on public.meeting_room_bookings;
create trigger meeting_room_bookings_set_updated_at
before update on public.meeting_room_bookings
for each row execute function private.set_updated_at();

alter table public.users enable row level security;
alter table public.desks enable row level security;
alter table public.meeting_rooms enable row level security;
alter table public.desk_bookings enable row level security;
alter table public.meeting_room_bookings enable row level security;
alter table public.notifications enable row level security;
alter table public.maintenance_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'service role manages users'
  ) then
    create policy "service role manages users"
      on public.users
      for all
      using (false)
      with check (false);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'desks'
      and policyname = 'service role manages desks'
  ) then
    create policy "service role manages desks"
      on public.desks
      for all
      using (false)
      with check (false);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'meeting_rooms'
      and policyname = 'service role manages meeting rooms'
  ) then
    create policy "service role manages meeting rooms"
      on public.meeting_rooms
      for all
      using (false)
      with check (false);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'desk_bookings'
      and policyname = 'service role manages desk bookings'
  ) then
    create policy "service role manages desk bookings"
      on public.desk_bookings
      for all
      using (false)
      with check (false);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'meeting_room_bookings'
      and policyname = 'service role manages meeting room bookings'
  ) then
    create policy "service role manages meeting room bookings"
      on public.meeting_room_bookings
      for all
      using (false)
      with check (false);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'service role manages notifications'
  ) then
    create policy "service role manages notifications"
      on public.notifications
      for all
      using (false)
      with check (false);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'maintenance_logs'
      and policyname = 'service role manages maintenance logs'
  ) then
    create policy "service role manages maintenance logs"
      on public.maintenance_logs
      for all
      using (false)
      with check (false);
  end if;
end;
$$;

create or replace view public.admin_dashboard_overview
with (security_invoker = true)
as
with base as (
  select
    (select count(*)::int from public.users where is_active) as total_employees,
    (select count(*)::int from public.desks) as total_desks,
    (select count(*)::int from public.desks where status = 'maintenance') as desks_under_maintenance,
    (select count(*)::int from public.desk_bookings where date = current_date and status in ('confirmed', 'checked_in')) as active_bookings_today,
    (select count(distinct desk_id)::int from public.desk_bookings where date = current_date and status in ('confirmed', 'checked_in')) as booked_desks_today,
    (select count(*)::int from public.desk_bookings where date = current_date and status = 'checked_in') as occupied_desks_today,
    (select count(distinct user_id)::int from public.desk_bookings where date = current_date and status = 'checked_in') as employees_checked_in_today,
    (select count(distinct room_id)::int from public.meeting_room_bookings where status = 'confirmed' and now() between start_time and end_time) as meeting_rooms_occupied
)
select
  total_employees,
  total_desks,
  active_bookings_today,
  booked_desks_today,
  greatest(total_desks - desks_under_maintenance - booked_desks_today, 0) as available_desks,
  occupied_desks_today as occupied_desks,
  desks_under_maintenance,
  employees_checked_in_today,
  meeting_rooms_occupied,
  round((occupied_desks_today::numeric / nullif(total_desks, 0)) * 100, 2) as occupancy_rate
from base;

create or replace view public.office_status_panel
with (security_invoker = true)
as
select
  total_desks,
  booked_desks_today as booked_desks,
  available_desks,
  desks_under_maintenance as maintenance_desks,
  occupancy_rate
from public.admin_dashboard_overview;

create or replace view public.desk_utilization_trend_30d
with (security_invoker = true)
as
with days as (
  select generate_series(current_date - 29, current_date, interval '1 day')::date as day
),
total_desks as (
  select count(*)::numeric as total_desks from public.desks where status <> 'maintenance'
)
select
  days.day as date,
  count(distinct case when desk_bookings.status in ('confirmed', 'checked_in') then desk_bookings.desk_id end)::int as occupied_desks,
  count(distinct case when desk_bookings.status = 'checked_in' then desk_bookings.desk_id end)::int as checked_in_desks,
  round(
    count(distinct case when desk_bookings.status in ('confirmed', 'checked_in') then desk_bookings.desk_id end)::numeric
    / nullif((select total_desks from total_desks), 0) * 100,
    2
  ) as occupancy_rate
from days
left join public.desk_bookings on public.desk_bookings.date = days.day
group by days.day
order by days.day;

create or replace view public.department_attendance_today
with (security_invoker = true)
as
with department_totals as (
  select coalesce(nullif(trim(department), ''), 'Unassigned') as department, count(*)::int as total_employees
  from public.users
  where is_active
  group by 1
),
department_present as (
  select coalesce(nullif(trim(u.department), ''), 'Unassigned') as department, count(distinct db.user_id)::int as present_employees
  from public.desk_bookings db
  join public.users u on u.id = db.user_id
  where db.date = current_date
    and db.status = 'checked_in'
  group by 1
)
select
  t.department,
  t.total_employees,
  coalesce(p.present_employees, 0) as present_employees,
  round((coalesce(p.present_employees, 0)::numeric / nullif(t.total_employees, 0)) * 100, 2) as attendance_rate
from department_totals t
left join department_present p using (department)
order by present_employees desc, department asc;

create or replace view public.meeting_room_utilization_30d
with (security_invoker = true)
as
select
  mr.id as room_id,
  mr.name as room_name,
  mr.capacity,
  mr.floor,
  count(mrb.id)::int as booking_count,
  coalesce(round(sum(extract(epoch from (mrb.end_time - mrb.start_time)) / 3600.0)::numeric, 2), 0) as booked_hours,
  round(
    coalesce(sum(extract(epoch from (mrb.end_time - mrb.start_time)) / 3600.0), 0)::numeric
    / nullif(30 * 8, 0) * 100,
    2
  ) as utilization_rate
from public.meeting_rooms mr
left join public.meeting_room_bookings mrb
  on mrb.room_id = mr.id
 and mrb.status = 'confirmed'
 and mrb.start_time::date between current_date - 29 and current_date
group by mr.id, mr.name, mr.capacity, mr.floor
order by booking_count desc, mr.name asc;

create or replace view public.weekly_booking_trend_7d
with (security_invoker = true)
as
with days as (
  select generate_series(current_date - 6, current_date, interval '1 day')::date as day
)
select
  days.day as date,
  count(distinct case when db.status in ('confirmed', 'checked_in') then db.id end)::int as desk_bookings,
  count(distinct case when mrb.status = 'confirmed' then mrb.id end)::int as meeting_room_bookings,
  count(distinct case when db.status = 'checked_in' then db.id end)::int as check_ins,
  count(distinct case when db.status = 'cancelled' then db.id end)::int as cancellations
from days
left join public.desk_bookings db on db.date = days.day
left join public.meeting_room_bookings mrb on mrb.start_time::date = days.day
group by days.day
order by days.day;

create or replace view public.recent_activity_feed
with (security_invoker = true)
as
select *
from (
  select
    'desk_booking'::text as activity_type,
    case db.status
      when 'checked_in' then 'User checked in'
      when 'cancelled' then 'Booking cancelled'
      when 'expired' then 'Booking expired'
      else 'Desk booked'
    end as title,
    concat(u.name, ' ', case db.status when 'checked_in' then 'checked in at ' when 'cancelled' then 'cancelled desk ' else 'booked desk ' end, d.name) as summary,
    concat(u.name, ' • ', coalesce(u.department, 'Unassigned')) as actor_details,
    u.name as actor_name,
    u.email as actor_email,
    d.name as subject_name,
    d.floor as floor,
    d.zone as zone,
    db.status as status,
    coalesce(db.checked_in_at, db.cancelled_at, db.updated_at, db.created_at) as activity_at
  from public.desk_bookings db
  join public.users u on u.id = db.user_id
  join public.desks d on d.id = db.desk_id

  union all

  select
    'meeting_room'::text as activity_type,
    case mrb.status
      when 'cancelled' then 'Meeting cancelled'
      else 'Meeting room reserved'
    end as title,
    concat(u.name, ' reserved ', mr.name, ' for ', mrb.title) as summary,
    concat(u.name, ' • ', coalesce(u.department, 'Unassigned')) as actor_details,
    u.name as actor_name,
    u.email as actor_email,
    mr.name as subject_name,
    mr.floor as floor,
    null::text as zone,
    mrb.status as status,
    coalesce(mrb.updated_at, mrb.created_at) as activity_at
  from public.meeting_room_bookings mrb
  join public.users u on u.id = mrb.user_id
  join public.meeting_rooms mr on mr.id = mrb.room_id

  union all

  select
    'maintenance'::text as activity_type,
    case ml.action
      when 'restored' then 'Desk restored'
      else 'Desk marked under maintenance'
    end as title,
    concat(u.name, ' updated ', d.name, ' maintenance status') as summary,
    concat(u.name, ' • ', coalesce(u.department, 'Unassigned')) as actor_details,
    u.name as actor_name,
    u.email as actor_email,
    d.name as subject_name,
    d.floor as floor,
    d.zone as zone,
    ml.action as status,
    ml.created_at as activity_at
  from public.maintenance_logs ml
  join public.users u on u.id = ml.performed_by
  join public.desks d on d.id = ml.desk_id
) activity
order by activity_at desc;

create or replace view public.maintenance_dashboard
with (security_invoker = true)
as
select
  (select count(*)::int from public.maintenance_logs) as total_maintenance_requests,
  (select count(*)::int from public.desks where status = 'maintenance') as open_requests,
  (select count(*)::int from public.maintenance_logs where action = 'restored') as completed_requests,
  (select count(*)::int from public.desks where status = 'maintenance') as desks_currently_unavailable;

create or replace view public.user_analytics
with (security_invoker = true)
as
with weekly_activity as (
  select distinct user_id
  from public.desk_bookings
  where date between current_date - 6 and current_date
    and status in ('confirmed', 'checked_in')

  union

  select distinct user_id
  from public.meeting_room_bookings
  where start_time::date between current_date - 6 and current_date
    and status = 'confirmed'
),
check_ins_today as (
  select count(distinct user_id)::int as checked_in_today
  from public.desk_bookings
  where date = current_date
    and status = 'checked_in'
)
select
  (select count(*)::int from public.users where is_active) as total_employees,
  (select count(*)::int from weekly_activity) as active_users_this_week,
  (select checked_in_today from check_ins_today) as employees_checked_in_today,
  (select count(distinct coalesce(nullif(trim(department), ''), 'Unassigned'))::int from public.users where is_active) as department_count;

create or replace view public.top_office_visitors
with (security_invoker = true)
as
with activity as (
  select user_id, count(*)::int as visits
  from public.desk_bookings
  where date between current_date - 29 and current_date
    and status in ('confirmed', 'checked_in')
  group by user_id

  union all

  select user_id, count(*)::int as visits
  from public.meeting_room_bookings
  where start_time::date between current_date - 29 and current_date
    and status = 'confirmed'
  group by user_id
)
select
  u.id as user_id,
  u.name,
  u.email,
  coalesce(u.department, 'Unassigned') as department,
  sum(activity.visits)::int as visits
from activity
join public.users u on u.id = activity.user_id
group by u.id, u.name, u.email, coalesce(u.department, 'Unassigned')
order by visits desc, u.name asc
limit 5;

create or replace view public.smart_insights
with (security_invoker = true)
as
with desk_usage as (
  select d.id, d.name, d.zone, count(*)::int as bookings
  from public.desk_bookings db
  join public.desks d on d.id = db.desk_id
  where db.date between current_date - 29 and current_date
    and db.status in ('confirmed', 'checked_in')
  group by d.id, d.name, d.zone
),
attendance_days as (
  select db.date, count(distinct db.user_id)::int as attendees
  from public.desk_bookings db
  where db.date between current_date - 29 and current_date
    and db.status = 'checked_in'
  group by db.date
),
zone_usage as (
  select coalesce(zone, 'Unassigned') as zone, count(*)::int as bookings
  from public.desk_bookings db
  join public.desks d on d.id = db.desk_id
  where db.date between current_date - 29 and current_date
    and db.status in ('confirmed', 'checked_in')
  group by 1
),
room_usage as (
  select mr.name, count(*)::int as bookings
  from public.meeting_room_bookings mrb
  join public.meeting_rooms mr on mr.id = mrb.room_id
  where mrb.start_time::date between current_date - 29 and current_date
    and mrb.status = 'confirmed'
  group by mr.name
),
trend as (
  select
    round(
      (
        select count(*)::numeric
        from public.desk_bookings
        where date between current_date - 6 and current_date
          and status in ('confirmed', 'checked_in')
      )
      / nullif(
        (
          select count(*)::numeric
          from public.desk_bookings
          where date between current_date - 13 and current_date - 7
            and status in ('confirmed', 'checked_in')
        ),
        0
      ) * 100 - 100,
      1
    ) as occupancy_change_pct
)
select
  'most_used_desk'::text as insight_key,
  'Most used desk'::text as title,
  concat(
    (select name from desk_usage order by bookings desc, name asc limit 1),
    ' leads desk demand in the last 30 days.'
  ) as detail
union all
select
  'peak_attendance_day',
  'Peak attendance day',
  concat(
    to_char((select date from attendance_days order by attendees desc, date asc limit 1), 'Dy, Mon DD'),
    ' had the highest in-office attendance.'
  )
union all
select
  'least_utilized_area',
  'Least utilized area',
  concat(
    (select zone from zone_usage order by bookings asc, zone asc limit 1),
    ' is the quietest area and is a good candidate for repurposing.'
  )
union all
select
  'meeting_room_demand',
  'Meeting room demand',
  concat(
    (select name from room_usage order by bookings desc, name asc limit 1),
    ' has the strongest meeting room demand.'
  )
union all
select
  'occupancy_trend',
  'Occupancy trend',
  concat(
    case
      when (select occupancy_change_pct from trend) > 0 then 'Occupancy is up '
      else 'Occupancy is down '
    end,
    abs((select occupancy_change_pct from trend))::text,
    '% week over week.'
  );

create or replace view public.report_desk_utilization
with (security_invoker = true)
as
select
  db.date,
  d.name as desk_name,
  d.floor,
  d.zone,
  db.status,
  u.name as employee_name,
  u.department,
  db.created_at,
  db.checked_in_at,
  db.cancelled_at
from public.desk_bookings db
join public.desks d on d.id = db.desk_id
join public.users u on u.id = db.user_id;

create or replace view public.report_attendance
with (security_invoker = true)
as
select
  db.date,
  coalesce(nullif(trim(u.department), ''), 'Unassigned') as department,
  count(distinct db.user_id)::int as present_employees
from public.desk_bookings db
join public.users u on u.id = db.user_id
where db.status = 'checked_in'
group by db.date, coalesce(nullif(trim(u.department), ''), 'Unassigned');

create or replace view public.report_meeting_room_usage
with (security_invoker = true)
as
select
  mrb.start_time::date as date,
  mr.name as room_name,
  mr.floor,
  mr.capacity,
  mrb.title,
  mrb.status,
  u.name as booked_by,
  u.department,
  mrb.start_time,
  mrb.end_time,
  round(extract(epoch from (mrb.end_time - mrb.start_time)) / 3600.0, 2) as duration_hours,
  mrb.created_at
from public.meeting_room_bookings mrb
join public.meeting_rooms mr on mr.id = mrb.room_id
join public.users u on u.id = mrb.user_id;

create or replace view public.report_maintenance
with (security_invoker = true)
as
select
  ml.created_at,
  d.name as desk_name,
  d.floor,
  d.zone,
  ml.action,
  ml.reason,
  u.name as performed_by,
  u.department
from public.maintenance_logs ml
join public.desks d on d.id = ml.desk_id
join public.users u on u.id = ml.performed_by;
