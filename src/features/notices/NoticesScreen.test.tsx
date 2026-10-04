import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({
  rows: [
    { id: 'a1', kind: 'update', title: '3.1.0 업데이트', body: '자유게시판이 생겼어요', version: '3.1.0', pinned: false, published: true, published_at: '2026-10-05T00:00:00Z', updated_at: '' },
    { id: 'a2', kind: 'notice', title: '서비스 점검 안내', body: '점검이 있어요', version: null, pinned: true, published: true, published_at: '2026-10-04T00:00:00Z', updated_at: '' },
  ] as unknown[],
}));
vi.mock('./useAnnouncements', () => ({ useAnnouncements: () => ({ data: state.rows, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/features/community/editor/LightMarkdown', () => ({ LightMarkdown: ({ text }: { text: string }) => <div>{text}</div> }));

import NoticesScreen from './NoticesScreen';

function renderScreen(entry = '/notices') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <NoticesScreen />
    </MemoryRouter>,
  );
}

describe('NoticesScreen', () => {
  it('공지·업데이트를 보여 주고, 눌러야 내용이 펼쳐진다', () => {
    renderScreen();
    expect(screen.getByText('서비스 점검 안내')).toBeInTheDocument();
    expect(screen.getByText('v3.1.0')).toBeInTheDocument();
    expect(screen.queryByText('자유게시판이 생겼어요')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /3\.1\.0 업데이트/ }));
    expect(screen.getByText('자유게시판이 생겼어요')).toBeInTheDocument();
  });

  it('분류 탭으로 걸러 본다', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '업데이트' }));
    expect(screen.getByText('3.1.0 업데이트')).toBeInTheDocument();
    expect(screen.queryByText('서비스 점검 안내')).not.toBeInTheDocument();
  });

  it('?open=ID로 들어오면 그 공지가 펼쳐져 있다', () => {
    Element.prototype.scrollIntoView = vi.fn();
    renderScreen('/notices?open=a2');
    expect(screen.getByText('점검이 있어요')).toBeInTheDocument();
  });
});
