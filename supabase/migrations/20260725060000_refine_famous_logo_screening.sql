drop index if exists public.trademark_screenings_cache_idx;

create unique index trademark_screenings_cache_idx
  on public.trademark_screenings(
    user_id,
    image_sha256,
    source,
    analysis_version,
    coalesce(image_url, '')
  );
