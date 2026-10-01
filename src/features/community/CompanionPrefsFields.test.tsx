import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CompanionPrefsFields } from './CompanionPrefsFields';
import { EMPTY_PREFS, type CompanionPrefs } from './companionPrefs';

function Harness({ onValue }: { onValue: (v: CompanionPrefs) => void }) {
  const [value, setValue] = useState<CompanionPrefs>(EMPTY_PREFS);
  return (
    <CompanionPrefsFields
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

describe('CompanionPrefsFields', () => {
  it('나이대는 여러 개, 성별은 하나, 태그는 3개까지만 고른다', () => {
    let last: CompanionPrefs = EMPTY_PREFS;
    render(<Harness onValue={(v) => (last = v)} />);
    fireEvent.click(screen.getByRole('button', { name: '20대 초반' }));
    fireEvent.click(screen.getByRole('button', { name: '30대 초반' }));
    fireEvent.click(screen.getByRole('radio', { name: '여성' }));
    for (const name of ['#사진촬영', '#카페투어', '#야경투어']) fireEvent.click(screen.getByRole('button', { name }));
    expect(last).toEqual({ ages: ['20s_early', '30s_early'], gender: 'female', tags: ['photo', 'cafe', 'night'] });
    // 4번째 태그는 눌리지 않는다
    expect(screen.getByRole('button', { name: '#맥주한잔' })).toBeDisabled();
    // 켠 태그는 다시 눌러 끌 수 있다
    fireEvent.click(screen.getByRole('button', { name: '#카페투어' }));
    expect(last.tags).toEqual(['photo', 'night']);
    expect(screen.getByRole('button', { name: '#맥주한잔' })).toBeEnabled();
  });
});
