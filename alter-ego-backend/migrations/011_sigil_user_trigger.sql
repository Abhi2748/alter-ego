-- Auto-create sigil_state when a user row is inserted; back-fill existing users.

CREATE OR REPLACE FUNCTION public.create_sigil_state_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sigil_state (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_add_sigil_state ON public.users;

CREATE TRIGGER on_user_created_add_sigil_state
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_sigil_state_for_user();

INSERT INTO public.sigil_state (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;
