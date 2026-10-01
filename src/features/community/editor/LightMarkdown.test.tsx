import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LightMarkdown } from './LightMarkdown';

describe('LightMarkdown', () => {
  it('굵게·기울임·제목·목록·링크를 그린다(링크는 새 탭 + nofollow ugc)', () => {
    const { container } = render(<LightMarkdown text={'# 제목\n\n**굵게** *기울임* [링크](https://example.com)\n\n- 가\n- 나'} />);
    expect(screen.getByRole('heading', { name: '제목' })).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('굵게');
    expect(container.querySelector('em')).toHaveTextContent('기울임');
    const link = screen.getByRole('link', { name: '링크' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('nofollow');
    expect(link.getAttribute('rel')).toContain('ugc');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('스크립트·위험한 링크는 그리지 않고 글자로만 보인다', () => {
    const { container } = render(<LightMarkdown text={'<img src=x onerror=alert(1)> [나쁨](javascript:alert(1)) <script>alert(1)</script>'} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
  });

  it('예전 평문 글의 줄바꿈을 살린다', () => {
    const { container } = render(<LightMarkdown text={'첫 줄\n둘째 줄'} />);
    expect(container.querySelectorAll('br')).toHaveLength(1);
  });
});
