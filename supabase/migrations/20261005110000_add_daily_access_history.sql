alter table public.access_logs
  drop constraint if exists access_logs_action_check;

alter table public.access_logs
  add constraint access_logs_action_check
  check (action in ('login', 'logout', 'support_login', 'session_resume'));

create index if not exists access_logs_daily_resume_idx
  on public.access_logs (user_id, created_at desc)
  where action = 'session_resume';
