-- Event dates become calendar days ("2026-11-12"). Rows were stored as UTC midnight
-- of the day they show ("2026-11-12T00:00:00.000Z"), so the first ten characters are
-- that day.
UPDATE `events` SET `event_date` = substr(`event_date`, 1, 10) WHERE length(`event_date`) > 10;
