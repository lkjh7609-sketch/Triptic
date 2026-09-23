ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_locale_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_locale_check CHECK (locale IN ('ko', 'en', 'zh-CN', 'ja'));

ALTER TABLE public.destination_translations DROP CONSTRAINT IF EXISTS destination_translations_locale_check;
ALTER TABLE public.destination_translations ADD CONSTRAINT destination_translations_locale_check CHECK (locale IN ('ko', 'en', 'zh-CN', 'ja'));
