-- New accounts only. Existing usernames and journal data are not updated.
-- The private counter spreads signups across the prefix pool instead of
-- repeatedly choosing from a small set. CREATE IF NOT EXISTS preserves its
-- position when this migration is rerun.
create sequence if not exists public.moodgrid_username_counter as bigint;
revoke all on sequence public.moodgrid_username_counter from public, anon, authenticated;

create or replace function public.sync_moodgrid_profile(p_id uuid, p_email text, p_created timestamptz, p_login timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  prefixes text[] := array[
    'amber','brave','misty','stellar','breezy','vivid','silver','golden',
    'maple','azure','crystal','roaming','peppy','mossy','daring','blissful',
    'indigo','nimble','saffron','radiant','meadow','playful','cobalt','serene',
    'sparkly','rustic','coral','wandering','lavender','sprightly','plucky','jade',
    'glowing','witty','merry','ocean','sunlit','frosty','dapper','ruby',
    'blooming','copper','jolly','zesty','twilight','gentle','spruce','lively',
    'orchid','fearless','opal','dancing','sandy','curious','emerald','tranquil',
    'cheery','marble','dewy','vibrant','sapphire','bouncy','quiet','tangerine',
    'fern','upbeat','moonlit','mellow','scarlet','whimsical','bold','willow',
    'dreamy','honey','swift','pastel','spirited','clover','fabled','perky',
    'velvet','kindred','peachy','epic','rainy','bright','sage','electric',
    'charmed','wild','lilac','fizzy','dusky','sunny','lofty','glittery',
    'minty','keen','tropical','woolly','velvety','sunkissed','leafy','snappy',
    'fluffy','sincere','snowy','jaunty','lucid','friendly','smoky','tender',
    'aqua','zippy','earthy','soulful','festive','crimson','blithe','cuddly',
    'cozy','feisty','flowing','lucky','pine','peaceful','shiny','verdant'
  ];
  animals text[] := array[
    'otter','panda','fox','koala','owl','tiger','finch','gecko',
    'orca','lynx','badger','falcon','marten','moth','ibis','kiwi',
    'robin','sparrow','toucan','heron','puffin','swallow','wren','raven',
    'dolphin','seal','whale','narwhal','turtle','manta','corvid','shrimp',
    'alpaca','llama','deer','moose','bison','yak','zebra','gazelle',
    'rabbit','hare','hedgehog','squirrel','beaver','ferret','stoat','weasel',
    'meerkat','lemur','sloth','wombat','quokka','wallaby','possum','numbat',
    'leopard','jaguar','panther','cheetah','cougar','lion','wolf','coyote',
    'bear','raccoon','redtail','osprey','eagle','condor','kite','kestrel',
    'penguin','pelican','flamingo','parrot','macaw','cockatoo','lark','crane',
    'swan','goose','duck','quail','peacock','pheasant','grouse','dove',
    'frog','newt','axolotl','iguana','anole','skink','chameleon','salamander',
    'bee','beetle','cricket','firefly','ladybug','mantis','dragonfly','katydid',
    'seahorse','starfish','octopus','squid','coral','goby','marlin','sailfish',
    'pangolin','armadillo','tapir','okapi','gibbon','macaque','bonobo','tamarin',
    'chinchilla','hamster','gerbil','dormouse','marmot','pika','dugong','manatee'
  ];
  prefix text;
  candidate text;
begin
  -- Login/email changes never regenerate a username or consume a prefix.
  update public.profiles set email = p_email, last_sign_in_at = p_login,
    updated_at = now() where id = p_id;
  if found then return; end if;

  prefix := prefixes[1 + ((nextval('public.moodgrid_username_counter'::regclass) - 1) % cardinality(prefixes))::int];
  loop
    candidate := prefix || '_' || animals[1 + floor(random() * cardinality(animals))::int]
      || '_' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8);
    begin
      insert into public.profiles(id, email, username, created_at, last_sign_in_at)
      values (p_id, p_email, candidate, coalesce(p_created, now()), p_login)
      on conflict (id) do update set email = excluded.email,
        last_sign_in_at = excluded.last_sign_in_at, updated_at = now();
      return;
    exception when unique_violation then
      -- The UNIQUE constraint and retry also handle user-chosen name collisions.
    end;
  end loop;
end;
$$;
revoke all on function public.sync_moodgrid_profile(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
comment on function public.sync_moodgrid_profile(uuid, text, timestamptz, timestamptz)
  is 'MoodGrid username generator v2: rotating prefixes for new profiles only';
