import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmBooking,
  deleteDocument,
  listDocuments,
  listPendingBookings,
  rejectBooking,
  uploadAndParseDocument,
  type DocumentRow,
} from './documentService';
import type { ParsedBooking } from './parseBooking/schema';
import { useSession } from '@/shared/hooks/useSession';

export function pendingBookingsQueryKey(tripId: string) {
  return ['pendingBookings', tripId] as const;
}

export function documentsQueryKey(tripId: string) {
  return ['documents', tripId] as const;
}

export function useDocumentsList(tripId: string | undefined) {
  return useQuery({
    queryKey: documentsQueryKey(tripId ?? ''),
    queryFn: () => listDocuments(tripId!),
    enabled: !!tripId,
  });
}

export function useDeleteDocument(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (doc: Pick<DocumentRow, 'id' | 'storage_path'>) => deleteDocument(doc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentsQueryKey(tripId) });
    },
  });
}

export function usePendingBookings(tripId: string | undefined) {
  return useQuery({
    queryKey: pendingBookingsQueryKey(tripId ?? ''),
    queryFn: () => listPendingBookings(tripId!),
    enabled: !!tripId,
  });
}

export function useUploadDocument(tripId: string) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      return uploadAndParseDocument(file, tripId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingBookingsQueryKey(tripId) });
      queryClient.invalidateQueries({ queryKey: documentsQueryKey(tripId) });
    },
  });
}

export function useConfirmBooking(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, edited }: { bookingId: string; edited: ParsedBooking }) =>
      confirmBooking(bookingId, edited),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingBookingsQueryKey(tripId) });
      queryClient.invalidateQueries({ queryKey: documentsQueryKey(tripId) });
    },
  });
}

export function useRejectBooking(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => rejectBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingBookingsQueryKey(tripId) });
    },
  });
}
