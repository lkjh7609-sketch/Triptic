import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const { desktop, navigate, mutateAsync } = vi.hoisted(() => ({
  desktop: { value: false },
  navigate: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock('react-router', async () => ({ ...(await vi.importActual<typeof import('react-router')>('react-router')), useNavigate: () => navigate }));
vi.mock('@/shared/hooks/useMediaQuery', () => ({ useMediaQuery: () => desktop.value }));
vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: { id: 'u1' }, loading: false }) }));
vi.mock('@/shared/hooks/useCityImage', () => ({ useCityImage: () => '/city.jpg' }));
vi.mock('@/features/plan/hooks/useTrips', () => ({
  useTrips: () => ({
    data: [
      { id: 't1', owner_id: 'u1', title: '가을 교토 산책', city: 'Kyoto, Japan', start_date: '2026-10-12', end_date: '2026-10-15', total_days: 4 },
      { id: 't2', owner_id: 'someone', title: '남의 여행', city: null, start_date: null, end_date: null, total_days: 2 },
    ],
  }),
}));
vi.mock('./hooks/useDestinations', () => ({
  useDestinations: () => ({
    data: [
      { id: 'kyoto', name: '교토', slug: 'kyoto', country_code: 'JP', is_featured: true, sort_order: 1, cover_url: null },
      { id: 'paris', name: '파리', slug: 'paris', country_code: 'FR', is_featured: true, sort_order: 2, cover_url: null },
    ],
  }),
}));
vi.mock('./hooks/usePosts', () => ({ useCreatePost: () => ({ mutateAsync, isPending: false }) }));
vi.mock('./imageProcessing', () => ({
  getPostImageUrl: (p: string) => `https://img.test/${p}`,
  uploadPostImage: vi.fn(),
}));

// 본문 편집기(Lexical)는 contenteditable이라 jsdom에서 다루기 어렵다 — 이 시험은 글쓰기 화면의 흐름(필수 입력·임시저장·게시)을 보는 것이라
// 같은 값·변경 약속(value/onChange/placeholder)을 가진 textarea로 바꿔 끼운다. 편집기 자체는 마크다운 변환 시험과 화면 확인으로 본다.
vi.mock('./editor/RichTextEditor', () => ({
  default: ({ value, onChange, placeholder, maxLength }: { value: string; onChange: (v: string) => void; placeholder: string; maxLength: number }) => (
    <textarea placeholder={placeholder} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { ComposePostScreen } from './ComposePostScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <ComposePostScreen />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  localStorage.clear();
  navigate.mockClear();
  mutateAsync.mockReset();
  desktop.value = false;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
});

async function advance(ms = 800) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('ComposePostScreen — 시안 구성', () => {
  it('모바일: 사진 추가 영역 → 여행지 → 내용 → 일정 첨부 순서와 하단 게시하기 버튼', async () => {
    renderScreen();
    expect(screen.getByRole('heading', { name: '글쓰기' })).toBeInTheDocument();
    expect(screen.getByText('사진 추가')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /여행지를 선택해 주세요/ })).toBeInTheDocument();
    // 편집기는 따로 내려받는 조각이라 잠깐 뒤에 나온다
    await act(async () => {
      await vi.dynamicImportSettled();
    });
    expect(screen.getByPlaceholderText(/여행 이야기를 들려주세요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /내 일정 첨부 \(선택\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '게시하기' })).toBeInTheDocument();
    // 시안에서 뺀 것
    expect(screen.queryByText(/키워드|장소 핀|태그 추가/)).not.toBeInTheDocument();
  });

  it('PC: 위쪽 줄에 임시저장·게시하기, 빠른 추천 칩', () => {
    desktop.value = true;
    renderScreen();
    expect(screen.getByRole('button', { name: '임시저장' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '게시하기' })).toBeInTheDocument();
    expect(screen.getByText('빠른 추천:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '교토' })).toBeInTheDocument();
  });

  it('필수 항목이 비어 있으면 게시하지 않고 안내를 보여 준다', async () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('여행지와 이야기를 모두 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('필수 항목입니다')).toBeInTheDocument();
  });

  it('여행지를 고르고 글을 써서 게시하면 글 화면으로 간다(복사 허용은 일정이 없으면 보내지 않는다)', async () => {
    mutateAsync.mockResolvedValue({ id: 'p1', status: 'published' });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /여행지를 선택해 주세요/ }));
    fireEvent.click(screen.getByText('교토'));
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));
    await advance(300);
    expect(screen.getByRole('button', { name: /교토, 일본/ })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/여행 이야기를 들려주세요/), { target: { value: '  새벽 산책이 좋았어요  ' } });
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    await advance(50);
    expect(mutateAsync).toHaveBeenCalled();
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ destinationId: 'kyoto', body: '새벽 산책이 좋았어요', tripId: null, allowCopy: false, userId: 'u1' });
    expect(navigate).toHaveBeenCalledWith('/community/post/p1');
    expect(localStorage.getItem('triptic-compose-draft:u1')).toBeNull();
  });

  it('일정을 붙이면 복사 허용 스위치가 생기고(기본 꺼짐), 켜면 게시할 때 함께 보낸다. 남의 일정은 목록에 없다', async () => {
    mutateAsync.mockResolvedValue({ id: 'p2', status: 'published' });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /내 일정 첨부 \(선택\)/ }));
    expect(screen.queryByText('남의 여행')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('가을 교토 산책'));
    await advance(300);
    const toggle = screen.getByRole('switch') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: /여행지를 선택해 주세요/ }));
    fireEvent.click(screen.getByText('파리'));
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));
    await advance(300);
    fireEvent.change(screen.getByPlaceholderText(/여행 이야기를 들려주세요/), { target: { value: '글' } });
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    await advance(50);
    expect(mutateAsync).toHaveBeenCalled();
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({ tripId: 't1', allowCopy: true });
  });

  it('제재로 막히면 안내가 뜨고, 내용을 고치기 전까지 게시 버튼이 꺼진다', async () => {
    mutateAsync.mockResolvedValue({ id: 'p3', status: 'removed' });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /여행지를 선택해 주세요/ }));
    fireEvent.click(screen.getByText('교토'));
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));
    await advance(300);
    const box = screen.getByPlaceholderText(/여행 이야기를 들려주세요/);
    fireEvent.change(box, { target: { value: '오픈채팅으로 연락 주세요' } });
    fireEvent.click(screen.getByRole('button', { name: '게시하기' }));
    await advance(50);
    expect(screen.getByText(/부적절한 표현이나 개인 연락처를 수정해 주세요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '게시하기' })).toBeDisabled();
    fireEvent.change(box, { target: { value: '오픈채팅으로 연락 주세요 (수정)' } });
    expect(screen.getByRole('button', { name: '게시하기' })).toBeEnabled();
  });
});

describe('ComposePostScreen — 임시저장', () => {
  it('쓰면 자동으로 이 기기에 저장된다', async () => {
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText(/여행 이야기를 들려주세요/), { target: { value: '쓰는 중' } });
    await advance(800);
    expect(JSON.parse(localStorage.getItem('triptic-compose-draft:u1') ?? '{}').body).toBe('쓰는 중');
  });

  it('저장된 글이 있으면 묻고, 이어 쓰기를 누르면 복구한다. 묻는 동안엔 저장된 글을 덮어쓰지 않는다', async () => {
    localStorage.setItem('triptic-compose-draft:u1', JSON.stringify({ destinationId: 'kyoto', body: '지난번에 쓰던 글', tripId: '', allowCopy: false, images: [], savedAt: 1 }));
    renderScreen();
    expect(screen.getByText('이어 쓰던 글이 있어요')).toBeInTheDocument();
    await advance(1500);
    expect(JSON.parse(localStorage.getItem('triptic-compose-draft:u1') ?? '{}').body).toBe('지난번에 쓰던 글');
    fireEvent.click(screen.getByRole('button', { name: '이어 쓰기' }));
    expect((screen.getByPlaceholderText(/여행 이야기를 들려주세요/) as HTMLTextAreaElement).value).toBe('지난번에 쓰던 글');
    expect(screen.getByRole('button', { name: /교토, 일본/ })).toBeInTheDocument();
  });

  it('새로 쓰기를 누르면 저장된 글이 지워진다', async () => {
    localStorage.setItem('triptic-compose-draft:u1', JSON.stringify({ destinationId: '', body: '지울 글', tripId: '', allowCopy: false, images: [], savedAt: 1 }));
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '새로 쓰기' }));
    expect(localStorage.getItem('triptic-compose-draft:u1')).toBeNull();
    expect((screen.getByPlaceholderText(/여행 이야기를 들려주세요/) as HTMLTextAreaElement).value).toBe('');
  });

  it('취소: 내용이 없으면 바로 나가고, 있으면 확인 후 나가며 임시저장이 남는다', async () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(navigate).toHaveBeenCalledWith(-1);
    navigate.mockClear();
    fireEvent.change(screen.getByPlaceholderText(/여행 이야기를 들려주세요/), { target: { value: '쓰던 글' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText('글쓰기를 나갈까요?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '나가기' }));
    expect(navigate).toHaveBeenCalledWith(-1);
    expect(JSON.parse(localStorage.getItem('triptic-compose-draft:u1') ?? '{}').body).toBe('쓰던 글');
  });
});
