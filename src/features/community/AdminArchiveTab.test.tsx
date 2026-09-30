import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArchivedItem } from './adminService';

const { adminListArchived, adminGetArchived } = vi.hoisted(() => ({ adminListArchived: vi.fn(), adminGetArchived: vi.fn() }));
vi.mock('./adminService', async () => ({
  ...(await vi.importActual<typeof import('./adminService')>('./adminService')),
  adminListArchived,
  adminGetArchived,
}));

import { AdminArchiveTab } from './AdminArchiveTab';

const item: ArchivedItem = {
  id: 7, source_table: 'posts', source_id: 'p1', author_id: 'a1', author_name: '김철수님', author_handle: 'abc12',
  reason: 'user_deleted', archived_at: '2026-09-30T03:00:00Z', original_created_at: '2026-09-29T00:00:00Z', preview: '오사카 3박 후기', comment_count: 2,
};

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminArchiveTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  adminListArchived.mockReset();
  adminGetArchived.mockReset();
});

describe('AdminArchiveTab', () => {
  it('보관된 글을 종류·작성자·사유·미리보기와 함께 보여 주고, 누르면 본문과 댓글을 불러온다', async () => {
    adminListArchived.mockResolvedValue({ rows: [item], hasMore: false });
    adminGetArchived.mockResolvedValue({
      snapshot: { body: '오사카 3박 후기 전체 본문' },
      children: { comments: [{ author_id: 'b', body: '좋은 글이네요' }] },
      reason: 'user_deleted',
      archived_at: item.archived_at,
    });
    renderTab();
    expect(await screen.findByText(/작성자가 삭제/)).toBeInTheDocument();
    expect(screen.getByText('오사카 3박 후기')).toBeInTheDocument();
    expect(screen.getByText(/댓글 2개 함께 보관/)).toBeInTheDocument();
    expect(adminGetArchived).not.toHaveBeenCalled(); // 누르기 전에는 본문을 불러오지 않는다
    fireEvent.click(screen.getByRole('button', { name: '내용 보기' }));
    expect(await screen.findByText('오사카 3박 후기 전체 본문')).toBeInTheDocument();
    expect(screen.getByText(/좋은 글이네요/)).toBeInTheDocument();
    expect(adminGetArchived).toHaveBeenCalledWith(7);
  });

  it('보관된 게 없으면 안내', async () => {
    adminListArchived.mockResolvedValue({ rows: [], hasMore: false });
    renderTab();
    expect(await screen.findByText('보관된 글이 없어요')).toBeInTheDocument();
  });

  it('불러오지 못하면 다시 시도 화면', async () => {
    adminListArchived.mockRejectedValue(new Error('forbidden'));
    renderTab();
    expect(await screen.findByText('보관함을 불러오지 못했어요')).toBeInTheDocument();
  });
});
