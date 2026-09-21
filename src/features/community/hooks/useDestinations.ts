import { useQuery } from '@tanstack/react-query';
import { getDestinationBySlug, listDestinations } from '../communityService';

export const destinationsQueryKey = ['community', 'destinations'] as const;

export function useDestinations() {
  return useQuery({ queryKey: destinationsQueryKey, queryFn: () => listDestinations() });
}

export function useDestination(slug: string | undefined) {
  return useQuery({
    queryKey: ['community', 'destination', slug ?? ''],
    queryFn: () => getDestinationBySlug(slug!),
    enabled: !!slug,
  });
}
