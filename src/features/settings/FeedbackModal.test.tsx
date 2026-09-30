import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { submit } = vi.hoisted(() => ({ submit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: { id: 'u1' } }) }));
vi.mock('./feedbackService', () => ({ submitFeedback: submit }));

import { FeedbackModal } from './FeedbackModal';

beforeEach(() => submit.mockClear());

describe('FeedbackModal — 일반 문의 / 제휴문의', () => {
  it('일반 문의는 "문의하기" 제목으로 열리고 일반으로 저장된다', async () => {
    render(<FeedbackModal onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: '문의하기' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '궁금해요' } });
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith('u1', '궁금해요', null, 'general'));
  });

  it('제휴문의는 "제휴문의" 제목으로 열리고 제휴문의로 저장된다', async () => {
    render(<FeedbackModal kind="partnership" onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: '제휴문의' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '협업 제안' } });
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith('u1', '협업 제안', null, 'partnership'));
    expect(await screen.findByText(/제휴문의가 전달됐어요/)).toBeInTheDocument();
  });
});
