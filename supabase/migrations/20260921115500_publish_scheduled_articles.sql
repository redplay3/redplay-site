-- Promote due editorial content without exposing a public mutation endpoint.
-- The job runs inside Postgres and only touches rows explicitly marked scheduled.
do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'redplay-publish-scheduled-articles';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'redplay-publish-scheduled-articles',
  '* * * * *',
  $cron$
    update public.articles
    set status = 'published',
        updated_at = now()
    where status = 'scheduled'
      and published_at is not null
      and published_at <= now();
  $cron$
);
