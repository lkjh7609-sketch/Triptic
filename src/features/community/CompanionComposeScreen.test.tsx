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
vi.mock('./hooks/useDestinations', () => ({
  useDestinations: () => ({
    data: [
      { id: 'kyoto', name: '교토', slug: 'kyoto', country_code: 'JP', is_featured: true, sort_order: 1, cover_url: null },
      { id: 'paris', name: '파리', slug: 'paris', country_code: 'FR', is_featured: true, sort_order: 2, cover_url: null },
    ],
  }),
}));
vi.mock('./hooks/useCompanionPosts', () => ({ useCreateCompanionPost: () => ({ mutateAsync, isPending: false }) }));

import { CompanionComposeScreen } from './CompanionComposeScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <CompanionComposeScreen />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 12));
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

function fillText() {
  fireEvent.change(screen.getByPlaceholderText('예: 오사카 3박4일 같이 다니실 분'), { target: { value: '  오사카 같이 가요  ' } });
  fireEvent.change(screen.getByPlaceholderText(/가고 싶은 곳, 하고 싶은 일/), { target: { value: '  먹방 위주  ' } });
}

describe('CompanionComposeScreen — 시안 구성', () => {
  it('모바일: 머리말 → 제목·상세 내용 → 여행 정보 → 선호 조건 → 하단 게시 버튼. 시안에서 뺀 것은 없다', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1, name: '동행 구하기' })).toBeInTheDocument();
    expect(screen.getByText('무엇을 함께 할까요?')).toBeInTheDocument();
    expect(screen.getByText('0/100')).toBeInTheDocument();
    expect(screen.getByText('0/2000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /어디든 상관없어요/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /날짜를 선택하세요/ })).toBeInTheDocument();
    expect(screen.getByText('2명')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '성별 무관' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: '20대 초반' })).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '동행 모집글 게시하기' })).toBeInTheDocument();
    expect(screen.getByText('작성된 모집글은 커뮤니티 가이드라인을 준수해야 해요.')).toBeInTheDocument();
    // 합의한 대로 뺀 것(내 일정 첨부·태그 추가/장소 핀·미리보기·빠른 추천)
    expect(screen.queryByText(/내 일정 첨부|태그 추가|장소 핀|미리보기|빠른 추천/)).not.toBeInTheDocument();
  });

  it('PC: 위쪽 줄에 임시저장·게시하기, 빠른 추천 칩, 맨 아래 게시 버튼', () => {
    desktop.value = true;
    renderScreen();
    expect(screen.getByRole('button', { name: '임시저장' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '게시하기' })).toBeInTheDocument();
    expect(screen.getByText('빠른 추천:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '교토' })).toBeInTheDocument();
    expect(screen.getByText('최소 10자 이상 권장')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '동행 모집글 게시하기' })).toBeInTheDocument();
  });

  it('제목·내용·일정이 비어 있으면 게시하지 않고 안내한다', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '동행 모집글 게시하기' }));
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('제목을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('제목·상세 내용·일정을 모두 입력해 주세요.')).toBeInTheDocument();
  });

  it('인원은 2~20명 안에서 바꾼다', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: '인원 줄이기' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '인원 늘리기' }));
    expect(screen.getByText('3명')).toBeInTheDocument();
  });
});

describe('CompanionComposeScreen — 게시', () => {
  it('날짜 미정으로 게시하면 날짜 없이 보낸다(여행지는 비워도 된다)', async () => {
    mutateAsync.mockResolvedValue({ id: 'c1', status: 'published' });
    renderScreen();
    fillText();
    fireEvent.click(screen.getByRole('button', { name: /날짜를 선택하세요/ }));
    fireEvent.click(screen.getByRole('button', { name: '날짜 미정 / 협의 가능' }));
    fireEvent.click(screen.getByRole('button', { name: '날짜 미정으로 선택 완료' }));
    await advance(300);
    expect(screen.getByRole('button', { name: /날짜 미정 · 협의 가능/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '동행 모집글 게시하기' }));
    await advance(50);
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      destinationId: null,
      title: '오사카 같이 가요',
      body: '먹방 위주',
      startDate: null,
      endDate: null,
      groupSize: 2,
      userId: 'u1',
      prefs: { gender: 'any', ages: [], tags: [] },
    });
    expect(navigate).toHaveBeenCalledWith('/community/companion/c1');
    expect(localStorage.getItem('triptic-companion-draft:u1')).toBeNull();
  });

  it('여행지·날짜·선호 조건을 골라 게시한다', async () => {
    mutateAsync.mockResolvedValue({ id: 'c2', status: 'published' });
    renderScreen();
    fillText();
    fireEvent.click(screen.getByRole('button', { name: /어디든 상관없어요/ }));
    fireEvent.click(screen.getByText('교토'));
    fireEvent.click(screen.getByRole('button', { name: '선택 완료' }));
    await advance(300);
    expect(screen.getByRole('button', { name: /교토, 일본/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /날짜를 선택하세요/ }));
    fireEvent.click(screen.getByRole('button', { name: /2026년 10월 20일/ }));
    fireEvent.click(screen.getByRole('button', { name: /2026년 10월 24일/ }));
    fireEvent.click(screen.getByRole('button', { name: /선택 완료 \(4박 5일\)/ }));
    await advance(300);
    expect(screen.getByRole('button', { name: /10\.20\(화\) ~ 10\.24\(토\) · 4박 5일/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '인원 늘리기' }));
    fireEvent.click(screen.getByRole('radio', { name: '여성' }));
    fireEvent.click(screen.getByRole('button', { name: '30대 후반' }));
    fireEvent.click(screen.getByRole('button', { name: '#사진촬영' }));
    fireEvent.click(screen.getByRole('button', { name: '동행 모집글 게시하기' }));
    await advance(50);
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      destinationId: 'kyoto',
      startDate: '2026-10-20',
      endDate: '2026-10-24',
      groupSize: 3,
      prefs: { gender: 'female', ages: ['30s_late'], tags: ['photo'] },
    });
  });

  it('여행지 창의 "어디든 상관없어요"는 고른 여행지를 비운다', async () => {
    desktop.value = true;
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '교토' }));
    expect(screen.getByRole('button', { name: /교토, 일본/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /교토, 일본/ }));
    fireEvent.click(screen.getByText('어디든 상관없어요', { selector: 'button' }));
    await advance(300);
    expect(screen.queryByRole('button', { name: /교토, 일본/ })).not.toBeInTheDocument();
  });

  it('제재로 막히면 안내가 뜨고, 같은 내용으로는 다시 게시할 수 없다', async () => {
    mutateAsync.mockResolvedValue({ id: 'x', status: 'removed' });
    renderScreen();
    fillText();
    fireEvent.click(screen.getByRole('button', { name: /날짜를 선택하세요/ }));
    fireEvent.click(screen.getByRole('button', { name: '날짜 미정 / 협의 가능' }));
    fireEvent.click(screen.getByRole('button', { name: '날짜 미정으로 선택 완료' }));
    await advance(300);
    fireEvent.click(screen.getByRole('button', { name: '동행 모집글 게시하기' }));
    await advance(50);
    expect(screen.getByRole('alert')).toHaveTextContent('커뮤니티 가이드라인');
    expect(screen.getByRole('button', { name: '동행 모집글 게시하기' })).toBeDisabled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('CompanionComposeScreen — 임시저장·취소', () => {
  it('쓰는 대로 이 기기에 저장되고, 다시 열면 이어 쓸지 묻는다', async () => {
    const first = renderScreen();
    fillText();
    fireEvent.click(screen.getByRole('radio', { name: '남성' }));
    await advance(800);
    expect(JSON.parse(localStorage.getItem('triptic-companion-draft:u1')!)).toMatchObject({ title: '  오사카 같이 가요  ', prefs: { gender: 'male' } });
    first.unmount();

    renderScreen();
    expect(screen.getByText('이어 쓰던 글이 있어요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이어 쓰기' }));
    expect(screen.getByPlaceholderText('예: 오사카 3박4일 같이 다니실 분')).toHaveValue('  오사카 같이 가요  ');
    expect(screen.getByRole('radio', { name: '남성' })).toHaveAttribute('aria-checked', 'true');
  });

  it('새로 쓰기를 고르면 저장된 글이 지워진다', () => {
    localStorage.setItem('triptic-companion-draft:u1', JSON.stringify({ title: '옛 글' }));
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '새로 쓰기' }));
    expect(localStorage.getItem('triptic-companion-draft:u1')).toBeNull();
  });

  it('취소: 내용이 없으면 바로 나가고, 있으면 확인 후 나간다(임시저장은 남는다)', () => {
    const first = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(navigate).toHaveBeenCalledWith(-1);
    first.unmount();
    navigate.mockClear();

    renderScreen();
    fillText();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '나가기' }));
    expect(navigate).toHaveBeenCalledWith(-1);
    expect(localStorage.getItem('triptic-companion-draft:u1')).not.toBeNull();
  });
});
