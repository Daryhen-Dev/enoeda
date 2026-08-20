ALTER TABLE public.students ADD COLUMN phone text;

ALTER TABLE public.students
  ADD CONSTRAINT students_phone_len_ck CHECK (phone IS NULL OR char_length(phone) <= 30);
