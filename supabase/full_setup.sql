-- Barber Booking System - Full Supabase SQL Setup
-- Run in Supabase SQL Editor

create extension if not exists pgcrypto;

-- =========================
-- Core tables
-- =========================
create table if not exists branches (
  id bigserial primary key,
  name text not null unique,
  location text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id bigserial primary key,
  username text unique,
  password text,
  role text not null default 'client' check (role in ('admin', 'barber', 'client')),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  loyalty_points integer not null default 0,
  branch_id bigint references branches(id) on delete set null,
  years_of_experience integer,
  bio text,
  photo_url text,
  instagram_url text,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id bigserial primary key,
  name text not null unique,
  price integer not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id bigserial primary key,
  client_id bigint references users(id) on delete set null,
  guest_first_name text,
  guest_last_name text,
  guest_phone text,
  guest_email text,
  barber_id bigint not null references users(id) on delete restrict,
  service_id bigint not null references services(id) on delete restrict,
  branch_id bigint not null references branches(id) on delete restrict,
  appointment_date timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'postponed', 'completed')),
  status_note text,
  priority_score integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists feedbacks (
  id bigserial primary key,
  appointment_id bigint not null references appointments(id) on delete cascade,
  from_user_id bigint not null references users(id) on delete cascade,
  to_user_id bigint not null references users(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  message text not null,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Optional external delivery log (for SMS/email integration later)
create table if not exists message_delivery_logs (
  id bigserial primary key,
  appointment_id bigint references appointments(id) on delete set null,
  channel text not null check (channel in ('sms', 'email')),
  recipient text not null,
  payload text not null,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

-- Loyalty and discounts
create table if not exists loyalty_events (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  appointment_id bigint references appointments(id) on delete set null,
  points_delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists discount_rules (
  id bigserial primary key,
  name text not null unique,
  points_required integer not null check (points_required > 0),
  discount_percent integer not null check (discount_percent > 0 and discount_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists redemptions (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  discount_rule_id bigint not null references discount_rules(id) on delete restrict,
  points_spent integer not null check (points_spent > 0),
  created_at timestamptz not null default now()
);

-- =========================
-- Indexes
-- =========================
create index if not exists idx_users_role on users(role);
create index if not exists idx_users_branch on users(branch_id);
create index if not exists idx_appointments_barber_date on appointments(barber_id, appointment_date);
create index if not exists idx_appointments_status on appointments(status);
create index if not exists idx_appointments_priority on appointments(priority_score desc, created_at asc);
create index if not exists idx_notifications_user_unread on notifications(user_id, is_read, created_at desc);
create index if not exists idx_feedbacks_to_user on feedbacks(to_user_id, created_at desc);
create index if not exists idx_loyalty_events_user on loyalty_events(user_id, created_at desc);

-- =========================
-- Trigger functions
-- =========================
create or replace function set_priority_score()
returns trigger
language plpgsql
as $$
begin
  -- registered users get priority over guests
  if new.client_id is not null then
    new.priority_score := 100;
  else
    new.priority_score := 10;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_priority_score on appointments;
create trigger trg_set_priority_score
before insert on appointments
for each row
execute function set_priority_score();

create or replace function award_loyalty_on_completion()
returns trigger
language plpgsql
as $$
declare
  points_to_add integer := 10;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.client_id is not null then
    update users
    set loyalty_points = coalesce(loyalty_points, 0) + points_to_add
    where id = new.client_id;

    insert into loyalty_events (user_id, appointment_id, points_delta, reason)
    values (new.client_id, new.id, points_to_add, 'completed_appointment');

    insert into notifications (user_id, message, type, is_read)
    values (new.client_id, format('You earned %s loyalty points from your completed visit.', points_to_add), 'loyalty', false);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_award_loyalty_on_completion on appointments;
create trigger trg_award_loyalty_on_completion
after update on appointments
for each row
execute function award_loyalty_on_completion();

-- =========================
-- Views (reporting)
-- =========================
create or replace view barber_performance_report as
select
  b.id as barber_id,
  b.first_name,
  b.last_name,
  count(a.id) filter (where a.status = 'completed') as completed_jobs,
  count(a.id) filter (where a.status = 'accepted') as accepted_jobs,
  count(a.id) filter (where a.status = 'pending') as pending_jobs,
  coalesce(avg(f.rating), 0)::numeric(10,2) as avg_rating
from users b
left join appointments a on a.barber_id = b.id
left join feedbacks f on f.to_user_id = b.id
where b.role = 'barber'
group by b.id, b.first_name, b.last_name;

-- =========================
-- Seed data
-- =========================
insert into branches (name, location)
values
  ('A', 'Beşiktaş, Istanbul'),
  ('B', 'Kadıköy, Istanbul')
on conflict (name) do nothing;

insert into users (
  username, password, role, first_name, last_name, phone, email, loyalty_points, branch_id, years_of_experience, bio, photo_url
)
values
  (
    'admin',
    'admin',
    'admin',
    'Istanbul',
    'Admin',
    '0000000000',
    'admin@istanbulsalon.com',
    0,
    (select id from branches where name = 'A' limit 1),
    null,
    'Main system administrator',
    null
  ),
  (
    'barber1',
    'password123',
    'barber',
    'Taha',
    'Demir',
    '1111111111',
    'taha@istanbulsalon.com',
    0,
    (select id from branches where name = 'A' limit 1),
    6,
    'Modern fades, textures, and beard shaping.',
    'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&q=80'
  ),
  (
    'barber2',
    'password123',
    'barber',
    'Mehmet',
    'Kaya',
    '2222222222',
    'mehmet@istanbulsalon.com',
    0,
    (select id from branches where name = 'B' limit 1),
    8,
    'Classic cuts and premium straight razor finishes.',
    'https://images.unsplash.com/photo-1593702288056-ccbfb2b1a13b?w=400&q=80'
  )
on conflict (username) do nothing;

insert into services (name, price, duration_minutes)
values
  ('Haircut', 20, 30),
  ('Beard Trim', 15, 20),
  ('Hair + Beard Combo', 30, 50)
on conflict (name) do nothing;

insert into discount_rules (name, points_required, discount_percent, is_active)
values
  ('Starter Reward', 100, 10, true),
  ('Premium Reward', 250, 20, true)
on conflict (name) do nothing;

insert into appointments (
  client_id,
  guest_first_name,
  guest_last_name,
  guest_phone,
  guest_email,
  barber_id,
  service_id,
  branch_id,
  appointment_date,
  status
)
select
  null,
  'Alice',
  'Johnson',
  '3333333333',
  'alice@example.com',
  (select id from users where username = 'barber1' limit 1),
  (select id from services where name = 'Haircut' limit 1),
  (select id from branches where name = 'A' limit 1),
  now() + interval '1 day',
  'pending'
where not exists (select 1 from appointments where guest_email = 'alice@example.com');
