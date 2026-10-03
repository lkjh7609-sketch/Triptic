import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';
import i18n from '@/shared/i18n';
import { AirportPicker, type SelectedAirport } from './AirportPicker';
import type { Airport } from './airportData';

const airports: Airport[] = [
  {
    iata: 'NRT',
    country_code: 'JP',
    name: { ko: '나리타 국제공항', en: 'Narita International Airport' },
    city: { ko: '도쿄', en: 'Tokyo' },
    lat: 35.77,
    lng: 140.39,
    timezone: 'Asia/Tokyo',
  },
  {
    iata: 'HND',
    country_code: 'JP',
    name: { ko: '하네다 공항', en: 'Tokyo Haneda Airport' },
    city: { ko: '도쿄', en: 'Tokyo' },
    lat: 35.55,
    lng: 139.78,
    timezone: 'Asia/Tokyo',
  },
];

function Harness({
  onSelect,
  onRequest,
  initial = null,
}: {
  onSelect: (a: SelectedAirport | null) => void;
  onRequest?: (q: string) => void;
  initial?: SelectedAirport | null;
}) {
  const [value, setValue] = useState<SelectedAirport | null>(initial);
  return (
    <AirportPicker
      airports={airports}
      value={value}
      placeholder="공항 검색"
      onRequest={onRequest ?? (() => {})}
      onSelect={(a) => {
        setValue(a);
        onSelect(a);
      }}
    />
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('AirportPicker', () => {
  it('도시를 입력하면 도시(국가) 아래에 코드·공항 이름이 보인다', () => {
    render(<Harness onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '도쿄' } });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('도쿄(일본)');
    expect(options.map((o) => o.textContent).join(' ')).toMatch(/NRT · 나리타 국제공항/);
    expect(options.map((o) => o.textContent).join(' ')).toMatch(/HND · 하네다 공항/);
  });

  it('고르면 코드와 좌표를 담아 알려 주고, 입력칸에는 이름과 코드가 들어간다', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: 'nrt' } });
    fireEvent.mouseDown(screen.getAllByRole('option')[0]);
    expect(onSelect).toHaveBeenCalledWith({
      iata: 'NRT',
      name: '도쿄(일본) NRT',
      lat: 35.77,
      lng: 140.39,
    });
    expect(box).toHaveValue('도쿄(일본) NRT');
  });

  it('고른 뒤 글자를 고치면 선택이 풀린다(목록에서 다시 골라야 함)', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: 'nrt' } });
    fireEvent.mouseDown(screen.getAllByRole('option')[0]);
    onSelect.mockClear();
    fireEvent.change(box, { target: { value: '도쿄(일본) NR' } });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('키보드: 아래 화살표로 옮겨 Enter로 고른다, Esc로 닫는다', () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const box = screen.getByRole('combobox');
    fireEvent.change(box, { target: { value: '도쿄' } });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].iata).toBe('NRT'); // 같은 점수는 코드 순(HND, NRT) — 한 칸 아래 = NRT
    fireEvent.change(box, { target: { value: '도' } });
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('목록에 없으면 안내와 "추가 요청하기" 버튼, 누르면 검색어를 넘긴다', () => {
    const onRequest = vi.fn();
    render(<Harness onSelect={() => {}} onRequest={onRequest} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '없는공항' } });
    expect(screen.getByText('목록에 없는 공항이에요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '추가 요청하기' }));
    expect(onRequest).toHaveBeenCalledWith('없는공항');
  });

  it('예전에 Google로 입력해 둔 공항(코드 없음)은 이름이 그대로 보인다', () => {
    render(
      <Harness
        onSelect={() => {}}
        initial={{ iata: '', name: '간사이 국제공항', lat: 34.4, lng: 135.2 }}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveValue('간사이 국제공항');
  });

  it('영어 UI에서는 영어 이름', async () => {
    await i18n.changeLanguage('en');
    render(<Harness onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tokyo' } });
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Tokyo(Japan)');
  });
});
