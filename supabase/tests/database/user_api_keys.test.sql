begin;
select plan(4);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_api_keys'::regclass),
  'API key table has row level security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.user_api_keys', 'select'),
  'anonymous clients cannot read stored API keys'
);

select ok(
  not has_table_privilege('authenticated', 'public.user_api_keys', 'select'),
  'authenticated clients cannot read stored API keys directly'
);

select ok(
  has_table_privilege('service_role', 'public.user_api_keys', 'select'),
  'service role can access encrypted keys for server-side operations'
);

select * from finish();
rollback;
