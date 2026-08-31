-- pgcrypto: provee gen_random_uuid(), usado como default de todos los PK uuid.
create extension if not exists pgcrypto with schema extensions;
