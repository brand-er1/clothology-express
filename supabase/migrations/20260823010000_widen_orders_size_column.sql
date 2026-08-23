-- orders.size was a narrow character varying(10) — fine for the short size codes every
-- other request flow sends (S, M, 95, 100...), but the ready-made group wear service
-- sends a full descriptive string ("XS~3XL (사이즈별 수량 개별 지정)") since customers pick
-- a quantity per size rather than a single size. That insert has been failing with
-- "value too long for type character varying(10)" since the feature was introduced —
-- for every submission, not just guests. Widen the column to match the other free-text
-- order fields (detail_description, request_title, etc.), which already have no cap.
alter table public.orders alter column size type text;
