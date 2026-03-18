update auth.users
set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb)
  - 'public_snapshot'
  - 'preview_summary'
  - 'day_pillar_key'
  - 'day_pillar_hanja'
  - 'day_pillar_metaphor'
  - 'element_class'
where raw_user_meta_data is not null;

select id, email, jsonb_object_keys(raw_user_meta_data)
from auth.users
where raw_user_meta_data is not null;
