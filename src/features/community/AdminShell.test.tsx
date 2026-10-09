import { Suspense } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import { AdminShell } from './AdminShell';
import { ADMIN_GROUPS, parseSection } from './adminSections';

function renderShell(props: Partial<React.ComponentProps<typeof AdminShell>> = {}) {
  const onSelect = vi.fn();
  render(
    <Suspense fallback={null}>
      <AdminShell active="members" onSelect={onSelect} {...props}>
        <p>본문</p>
      </AdminShell>
    </Suspense>,
  );
  return onSelect;
}

describe('AdminShell — 왼쪽 메뉴', () => {
  it('하는 일별로 묶인 메뉴(운영·회원·콘텐츠·데이터)와 개요 항목이 모두 있다', async () => {
    renderShell();
    const nav = await screen.findByRole('navigation');
    for (const name of ['대시보드', '신고 큐', '자동 플래그 큐', '건의함', '회원', '정지 기록', '공지', '보관함', '판매', '분석']) {
      expect(within(nav).getByRole('button', { name })).toBeInTheDocument();
    }
    for (const group of ['운영', '콘텐츠', '데이터']) expect(within(nav).getByText(group)).toBeInTheDocument();
    expect(within(nav).getAllByRole('button')).toHaveLength(ADMIN_GROUPS.flatMap((g) => g.sections).length);
  });

  it('지금 보는 메뉴가 표시된다(aria-current)', async () => {
    renderShell({ active: 'suspensions' });
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getByRole('button', { name: '정지 기록' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: '회원' })).not.toHaveAttribute('aria-current');
  });

  it('처리할 일이 있는 메뉴에는 개수 배지가 보이고, 0이면 안 보인다', async () => {
    renderShell({ badges: { reports: 3, feedback: 120, pending: 0 } });
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getByRole('button', { name: /신고 큐/ })).toHaveTextContent('3');
    expect(within(nav).getByRole('button', { name: /건의함/ })).toHaveTextContent('99+');
    expect(within(nav).getByRole('button', { name: /자동 플래그 큐/ })).not.toHaveTextContent(/\d/);
  });

  it('메뉴를 누르면 그 메뉴로 가고, 작은 화면의 서랍은 닫힌다', async () => {
    const onSelect = renderShell();
    fireEvent.click(await screen.findByRole('button', { name: '메뉴 열기' }));
    expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: '공지' }));
    expect(onSelect).toHaveBeenCalledWith('notices');
    expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('Esc로도 서랍이 닫힌다', async () => {
    renderShell();
    fireEvent.click(await screen.findByRole('button', { name: '메뉴 열기' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('본문이 오른쪽(main)에 들어간다', async () => {
    renderShell();
    expect(await screen.findByRole('main')).toHaveTextContent('본문');
  });
});

describe('parseSection', () => {
  it('?tab= 값을 메뉴로 바꾸고, 없거나 모르는 값은 대시보드', () => {
    expect(parseSection('members')).toBe('members');
    expect(parseSection('suspensions')).toBe('suspensions');
    expect(parseSection(null)).toBe('dashboard');
    expect(parseSection('nope')).toBe('dashboard');
    expect(parseSection('__proto__')).toBe('dashboard');
  });
});
