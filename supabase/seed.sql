insert into public.services (name) values
  ('Лечение зубов'), ('Лечение кариеса'), ('Лечение корневых каналов'),
  ('Хирургическая стоматология'), ('Диагностика'), ('Профилактика'), ('Неотложная стоматология');

insert into public.doctors (name, specialty) values
  (null, 'Стоматолог-терапевт'), (null, 'Стоматолог-хирург'), (null, 'Стоматолог общей практики');

-- Availability is intentionally not invented. Add confirmed clinic schedules
-- to public.availability before enabling online booking.
