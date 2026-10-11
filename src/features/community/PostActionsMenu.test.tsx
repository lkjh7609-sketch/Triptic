import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { PostActionsMenu } from './PostActionsMenu';

const state = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: state.user }) }));
vi.mock('./hooks/useCommunitySafety', () => ({ useBlockUser: () => ({ mutate: vi.fn() }) }));
vi.mock('./ReportModal', () => ({ ReportModal: () => <div>신고창</div> }));

beforeEach(() => {
  state.user = { id: 'me' };
});

function open() {
  fireEvent.click(screen.getByRole('button', { name: '더보기' }));
}

describe('PostActionsMenu', () => {
  it('본인 글: 수정·삭제가 있고 신고·차단은 없다', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<PostActionsMenu targetType="post" targetId="p" authorId="me" onEdit={onEdit} onDelete={onDelete} />);
    open();
    expect(screen.queryByRole('menuitem', { name: '신고' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '수정' }));
    expect(onEdit).toHaveBeenCalled();
    open();
    fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('남의 글: 신고·차단, 관리자는 고정 항목이 더 있다', () => {
    const onTogglePin = vi.fn();
    render(<PostActionsMenu targetType="post" targetId="p" authorId="other" onTogglePin={onTogglePin} />);
    open();
    expect(screen.getByRole('menuitem', { name: '신고' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '사용자 차단' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '수정' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '도시 공식 가이드로 고정' }));
    expect(onTogglePin).toHaveBeenCalled();
  });

  it('남의 글이어도 삭제를 넘기면(관리자) 삭제 항목이 신고·차단과 함께 보인다', () => {
    const onDelete = vi.fn();
    render(<PostActionsMenu targetType="post" targetId="p" authorId="other" onDelete={onDelete} />);
    open();
    expect(screen.getByRole('menuitem', { name: '신고' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '수정' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '삭제' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('고정된 글이면 고정 해제로 보이고, 고정 항목은 넘기지 않으면 없다', () => {
    const { unmount } = render(<PostActionsMenu targetType="post" targetId="p" authorId="other" onTogglePin={vi.fn()} pinned />);
    open();
    expect(screen.getByRole('menuitem', { name: '고정 해제' })).toBeInTheDocument();
    unmount();
    render(<PostActionsMenu targetType="post" targetId="p" authorId="other" />);
    open();
    expect(screen.queryByRole('menuitem', { name: /고정/ })).not.toBeInTheDocument();
  });

  it('메뉴 밖을 누르면 닫힌다', () => {
    render(<PostActionsMenu targetType="post" targetId="p" authorId="other" />);
    open();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
