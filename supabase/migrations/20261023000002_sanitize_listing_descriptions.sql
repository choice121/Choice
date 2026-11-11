CREATE OR REPLACE FUNCTION public.sanitize_listing_description(p_description text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cleaned text := p_description;
  pattern text;
BEGIN
  IF cleaned IS NULL OR cleaned = '' THEN
    RETURN cleaned;
  END IF;

  FOREACH pattern IN ARRAY ARRAY[
    '(^|[.!?\n])[^.!?\n]*\msecurity[[:space:]-]+deposit\M[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*\mdeposit[[:space:]]+(is|of|equal|amount|required|due)\M[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*(\mlease[[:space:]]+(term|duration|length)\M|\m[0-9]+[[:space:]-]*(month|year)[[:space:]]+lease\M|\mminimum[[:space:]]+lease\M)[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*(\mavailable[[:space:]]+(now|immediately|today|on|from|starting|date)\M|\mmove[- ]in[[:space:]]+(ready|date)\M|\mready[[:space:]]+for[[:space:]]+move[- ]in\M)[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*\m(smoking|smoke-free|non-smoking)\M[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*(\mpet-friendly\M|\mpets?[[:space:]]+(are[[:space:]]+)?(welcome|allowed|not allowed)\M|\m(cats|dogs)[[:space:]]+(are[[:space:]]+)?(ok|allowed)\M)[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*((\mschedule|\mbook|\mrequest|\marrange)[[:space:]]+(a[[:space:]]+)?(tour|showing|viewing)\M|\mopen house\M|\mcontact[[:space:]]+(the[[:space:]]+)?(agent|owner|landlord|manager)\M)[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*(https?://|\mapply[[:space:]]+(through|via|on|at)[[:space:]]+(zillow|realtor|turbotenant|apartments\.com|rentcafe|rentspree|appfolio)\M)[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*(\mMLS[[:space:]]*#?[[:space:]]*[0-9]+\M|\mlisted by\M|\mcourtesy of\M)[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*(\mfor sale\M|\mmortgage\M|\mdown payment\M|\mclosing costs?\M|\mmake an offer\M)[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*\m(no|zero|free|waived|complimentary)[[:space:]]+(application[[:space:]]+)?fee\M[^.!?\n]*[.!?]?',
    '(^|[.!?\n])[^.!?\n]*(\m(application|app)[[:space:]]+fee\M[^.!?\n]*\$[[:space:]]*(0|[1-4]?[0-9]|5[1-9]|[6-9][0-9]|[0-9]{3,})|\$[[:space:]]*(0|[1-4]?[0-9]|5[1-9]|[6-9][0-9]|[0-9]{3,})[^.!?\n]*\m(application|app)[[:space:]]+fee\M)[^.!?\n]*[.!?]?'
  ] LOOP
    cleaned := regexp_replace(cleaned, pattern, '\1', 'gi');
  END LOOP;

  cleaned := regexp_replace(cleaned, '(^|[.!?\n])[^.!?\n]*([0-9]{1,3} dollars?)[^.!?\n]*(application|app)[[:space:]]+fee[^.!?\n]*[.!?]?', '\1', 'gi');
  cleaned := regexp_replace(cleaned, '(^|[.!?\n])[^.!?\n]*(\m[0-9]{3}[[:space:]]+[0-9]{3}[[:space:]]+[0-9]{4}\M|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[A-Za-z]{2,})[^.!?\n]*[.!?]?', '\1', 'gi');
  cleaned := regexp_replace(cleaned, '[[:space:]]{2,}', ' ', 'g');
  RETURN btrim(cleaned);
END;
$$;

CREATE OR REPLACE FUNCTION public.sanitize_property_description_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.description := public.sanitize_listing_description(NEW.description);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_property_description_before_write ON public.properties;
CREATE TRIGGER sanitize_property_description_before_write
BEFORE INSERT OR UPDATE OF description ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_property_description_before_write();

UPDATE public.properties
SET description = public.sanitize_listing_description(description)
WHERE description IS DISTINCT FROM public.sanitize_listing_description(description);