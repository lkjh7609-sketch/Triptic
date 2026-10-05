import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArchivedItem } from './adminService';

const { adminListArchived, adminGetArchived, adminDeleteArchived } = vi.hoisted(() => ({ adminListArchived: vi.fn(), adminGetArchived: vi.fn(), adminDeleteArchived: vi.fn() }));
vi.mock('@/shared/ui/toast', () => ({ showToast: vi.fn() }));
vi.mock('./imageProcessing', () => ({ getPostImageUrl: (path: string) => `https://img.test/${path}` }));
vi.mock('./adminService', async () => ({
  ...(await vi.importActual<typeof import('./adminService')>('./adminService')),
  adminListArchived,
  adminGetArchived,
  adminDeleteArchived,
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
  adminDeleteArchived.mockReset().mockResolvedValue(1);
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

  it('보관된 글의 사진을 위치 순서대로 보여 준다(누르면 원본)', async () => {
    adminListArchived.mockResolvedValue({ rows: [item], hasMore: false });
    adminGetArchived.mockResolvedValue({
      snapshot: { body: '본문' },
      children: { post_images: [{ storage_path: 'u/b.webp', position: 1 }, { storage_path: 'u/a.webp', position: 0 }] },
      reason: 'user_deleted',
      archived_at: item.archived_at,
    });
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: '내용 보기' }));
    const imgs = await screen.findAllByRole('img');
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['https://img.test/u/a.webp', 'https://img.test/u/b.webp']);
    expect(imgs[0].closest('a')).toHaveAttribute('href', 'https://img.test/u/a.webp');
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

  it('선택한 글만 영구 삭제한다(확인 창을 거쳐, 선택한 id만 보낸다)', async () => {
    adminListArchived.mockResolvedValue({ rows: [item, { ...item, id: 8, preview: '다른 글' }], hasMore: false });
    renderTab();
    await screen.findByText('오사카 3박 후기');
    const boxes = screen.getAllByRole('checkbox', { name: '선택' });
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제 (1)' }));
    expect(adminDeleteArchived).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(adminDeleteArchived).toHaveBeenCalledWith([8]));
  });

  it('전체 비우기는 확인 뒤 null(전부)로 지운다', async () => {
    adminListArchived.mockResolvedValue({ rows: [item], hasMore: false });
    renderTab();
    await screen.findByText('오사카 3박 후기');
    fireEvent.click(screen.getByRole('button', { name: '전체 비우기' }));
    expect(screen.getByText(/보관함을 전부 비울까요/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(adminDeleteArchived).toHaveBeenCalledWith(null));
  });

  it('아무것도 고르지 않으면 선택 삭제 버튼은 눌리지 않는다', async () => {
    adminListArchived.mockResolvedValue({ rows: [item], hasMore: false });
    renderTab();
    await screen.findByText('오사카 3박 후기');
    expect(screen.getByRole('button', { name: '선택 삭제 (0)' })).toBeDisabled();
  });
});
