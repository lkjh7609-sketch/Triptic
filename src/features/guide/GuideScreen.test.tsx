import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';
import GuideScreen from './GuideScreen';

async function renderGuide() {
  await i18n.changeLanguage('ko');
  await i18n.loadNamespaces('guide');
  return render(
    <MemoryRouter>
      <GuideScreen />
    </MemoryRouter>,
  );
}

describe('GuideScreen', () => {
  it('여덟 단계가 순서대로 있고, PDF가 하이라이트(자랑 배지)로 들어 있다', async () => {
    await renderGuide();
    expect(screen.getByRole('heading', { level: 1, name: '트립틱, 이렇게 쓰면 돼요' })).toBeInTheDocument();
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles.slice(0, 8)).toEqual([
      '시작하기',
      '예약 서류 올리기',
      '장소 추가하고 동선 짜기',
      '링크로 친구와 실시간 함께 편집',
      '같이 갈 동행 찾기',
      '커뮤니티에서 이야기 나누기',
      'PDF로 내보내기',
      '여행 전과 여행 중에',
    ]);
    expect(screen.getByText('트립틱의 자랑')).toBeInTheDocument();
  });

  it('샘플 PDF를 열고 내려받는 링크가 있고, 쪽 미리보기를 누르면 크게 보인다', async () => {
    await renderGuide();
    expect(screen.getByRole('link', { name: /PDF 열어 보기/ })).toHaveAttribute('href', '/samples/triptic-sample-tokyo-ko.pdf');
    expect(screen.getByRole('link', { name: /PDF 내려받기/ })).toHaveAttribute('download');
    fireEvent.click(screen.getByRole('button', { name: '샘플 일정표 2쪽' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
