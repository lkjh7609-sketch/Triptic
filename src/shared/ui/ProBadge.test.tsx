import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProBadge } from './ProBadge';

describe('ProBadge', () => {
  it('프로 회원 표시 글자를 보여 준다', () => {
    render(<ProBadge />);
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });
});
