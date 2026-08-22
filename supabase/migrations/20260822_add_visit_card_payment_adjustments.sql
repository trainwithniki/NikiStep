-- Admin-only counters for 8-visit and 12-visit cards on platform trainings.
alter table public.payment_adjustments
  add column if not exists extra_card8 integer not null default 0 check (extra_card8 between 0 and 1000),
  add column if not exists extra_card12 integer not null default 0 check (extra_card12 between 0 and 1000);
