DO $migration$
DECLARE
  v_function regprocedure := 'public.pipeline_publish(text, uuid, text, boolean)'::regprocedure;
  v_definition text;
  v_old_predicate constant text := 'option ->> ''source_kind'' = ''unit''';
  v_new_predicate constant text := 'option ->> ''source_kind'' IN (''unit'', ''available_unit'')';
  v_old_count integer;
  v_new_count integer;
BEGIN
  SELECT pg_get_functiondef(v_function) INTO v_definition;

  v_old_count := (length(v_definition) - length(replace(v_definition, v_old_predicate, ''))) /
    length(v_old_predicate);
  v_new_count := (length(v_definition) - length(replace(v_definition, v_new_predicate, ''))) /
    length(v_new_predicate);

  IF v_old_count = 5 AND v_new_count = 0 THEN
    EXECUTE replace(v_definition, v_old_predicate, v_new_predicate);
  ELSIF v_old_count <> 0 OR v_new_count <> 5 THEN
    RAISE EXCEPTION 'Unexpected pipeline_publish source_kind predicates (old %, new %)',
      v_old_count, v_new_count;
  END IF;

  SELECT pg_get_functiondef(v_function) INTO v_definition;
  v_new_count := (length(v_definition) - length(replace(v_definition, v_new_predicate, ''))) /
    length(v_new_predicate);
  v_old_count := (length(v_definition) - length(replace(v_definition, v_old_predicate, ''))) /
    length(v_old_predicate);

  IF v_new_count <> 5 OR v_old_count <> 0 THEN
    RAISE EXCEPTION 'pipeline_publish source_kind update verification failed (old %, new %)',
      v_old_count, v_new_count;
  END IF;
END;
$migration$;