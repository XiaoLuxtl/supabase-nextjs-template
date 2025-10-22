-- Eliminar políticas de storage si existen
DROP POLICY IF EXISTS "Give users access to own folder 1m0cqf_0" ON "storage"."objects";
DROP POLICY IF EXISTS "Give users access to own folder 1m0cqf_1" ON "storage"."objects";
DROP POLICY IF EXISTS "Give users access to own folder 1m0cqf_2" ON "storage"."objects";
DROP POLICY IF EXISTS "Give users access to own folder 1m0cqf_3" ON "storage"."objects";
DROP POLICY IF EXISTS "Users can upload own images" ON "storage"."objects";
DROP POLICY IF EXISTS "Users can view own images" ON "storage"."objects";

-- Eliminar buckets si existen
DELETE FROM storage.buckets WHERE id IN ('files', 'input-images');

-- Eliminar columnas (ahora SÍ existen porque ya hicimos pull)
ALTER TABLE public.video_generations DROP COLUMN IF EXISTS input_image_path;
ALTER TABLE public.video_generations DROP COLUMN IF EXISTS input_image_url;

-- Eliminar función y schema
DROP FUNCTION IF EXISTS authenticative.is_user_authenticated();
DROP SCHEMA IF EXISTS authenticative CASCADE;