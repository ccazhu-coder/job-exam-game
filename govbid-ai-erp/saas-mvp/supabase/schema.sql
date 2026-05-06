create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text default 'user',
  plan text default 'free',
  plan_status text default 'active',
  created_at timestamptz default now()
);

create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  bid_name text not null,
  agency text,
  budget numeric default 0,
  deadline date,
  status text default '評估中',
  decision_score numeric default 0,
  decision_result text,
  win_status text default '未投標',
  created_at timestamptz default now()
);

create table if not exists bid_analysis (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid references bids(id) on delete cascade,
  policy_goal text,
  target_audience text,
  pain_points text,
  kpi text,
  reviewer_focus text,
  risk_points text,
  strategy text,
  innovation text,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid references bids(id) on delete cascade,
  task_type text,
  task_name text not null,
  due_date date,
  owner text,
  status text default '待處理',
  reminder_status text default '未提醒',
  created_at timestamptz default now()
);

create table if not exists finances (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid references bids(id) on delete cascade,
  type text,
  category text,
  amount numeric default 0,
  target text,
  payment_method text,
  due_date date,
  paid_date date,
  tax_note text,
  status text default '未處理',
  created_at timestamptz default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  line text,
  email text,
  plan text,
  status text,
  message text,
  level text,
  deal_amount numeric default 0,
  next_follow_up_date date,
  deal_status text default '新名單',
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table bids enable row level security;
alter table bid_analysis enable row level security;
alter table tasks enable row level security;
alter table finances enable row level security;
alter table leads enable row level security;

create policy "profiles_self" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "bids_owner" on bids for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_owner" on tasks for all using (exists (select 1 from bids where bids.id = tasks.bid_id and bids.user_id = auth.uid())) with check (exists (select 1 from bids where bids.id = tasks.bid_id and bids.user_id = auth.uid()));
create policy "finances_owner" on finances for all using (exists (select 1 from bids where bids.id = finances.bid_id and bids.user_id = auth.uid())) with check (exists (select 1 from bids where bids.id = finances.bid_id and bids.user_id = auth.uid()));
create policy "analysis_owner" on bid_analysis for all using (exists (select 1 from bids where bids.id = bid_analysis.bid_id and bids.user_id = auth.uid())) with check (exists (select 1 from bids where bids.id = bid_analysis.bid_id and bids.user_id = auth.uid()));
