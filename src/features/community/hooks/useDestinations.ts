import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getDestinationBySlug, listDestinations } from '../communityService';

export const destinationsQueryKey = (locale: string) => ['community', 'destinations', locale] as const;

export function useDestinations() {
  const { i18n } = useTranslation();
  return useQuery({ queryKey: destinationsQueryKey(i18n.language), queryFn: () => listDestinations(i18n.language) });
}

export function useDestination(slug: string | undefined) {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: ['community', 'destination', slug ?? '', i18n.language],
    queryFn: () => getDestinationBySlug(slug!, i18n.language),
    enabled: !!slug,
  });
}
