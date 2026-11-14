-- Weeks now run Sunday through Saturday. Existing weeks started on a Monday, so each moves back one day to the
-- Sunday before. This is safe because none of them had a meal on the Sunday that closed the old week (checked
-- before running); every meal still falls inside its week.
update public.weeks set week_start = week_start - 1 where extract(dow from week_start) = 1;

-- Run after the app that expects Sunday weeks is deployed (see 20261114000200_weeks_start_check.sql).
