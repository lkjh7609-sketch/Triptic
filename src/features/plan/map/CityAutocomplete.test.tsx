import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityAutocomplete } from './CityAutocomplete';
import type { SelectedPlace } from './usePlaceAutocomplete';

vi.mock('@/shared/api/googleMapsLoader', () => ({
  loadGoogleMapsPlaces: () => Promise.resolve({}),
}));

const g = vi.hoisted(() => ({ predictions: vi.fn(), getDetails: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  g.predictions.mockReset();
  g.getDetails.mockReset();
  class AutocompleteService {
    getPlacePredictions = g.predictions;
  }
  class PlacesService {
    getDetails = g.getDetails;
  }
  class AutocompleteSessionToken {}
  (globalThis as unknown as { google: unknown }).google = {
    maps: {
      places: {
        AutocompleteService,
        PlacesService,
        AutocompleteSessionToken,
        PlacesServiceStatus: { OK: 'OK' },
      },
    },
  };
});
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as unknown as { google?: unknown }).google;
});

function Harness({ onSelect }: { onSelect: (p: SelectedPlace | null) => void }) {
  const [value, setValue] = useState<SelectedPlace | null>(null);
  return (
    <CityAutocomplete
      value={value}
      placeholder="도시"
      onSelect={(p) => {
        setValue(p);
        onSelect(p);
      }}
    />
  );
}

async function type(text: string) {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: text } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
}

describe('CityAutocomplete', () => {
  it('도시 자동완성(types: (cities))만 요청하고, 목록에는 한 줄에 "도시(나라)"만 보인다', async () => {
    g.predictions.mockImplementation((_req, cb) =>
      cb([
        {
          place_id: 'a',
          description: 'Tokyo, Japan',
          structured_formatting: { main_text: 'Tokyo', secondary_text: 'Japan' },
        },
        {
          place_id: 'b',
          description: 'Tokyo, Ohio, USA',
          structured_formatting: { main_text: 'Tokyo', secondary_text: 'Ohio, USA' },
        },
      ]),
    );
    render(<Harness onSelect={() => {}} />);
    await type('tokyo');
    expect(g.predictions).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'tokyo', types: ['(cities)'] }),
      expect.any(Function),
    );
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Tokyo(Japan)', 'Tokyo(Ohio, USA)']);
  });

  it('고르면 상세를 받아 예전 위젯과 같은 모양으로 알려 주고, 입력칸에는 도시 이름만 남는다', async () => {
    g.predictions.mockImplementation((_req, cb) =>
      cb([
        {
          place_id: 'a',
          description: 'Kyoto, Japan',
          structured_formatting: { main_text: 'Kyoto', secondary_text: 'Japan' },
        },
      ]),
    );
    g.getDetails.mockImplementation((_req, cb) =>
      cb(
        {
          name: 'Kyoto',
          formatted_address: 'Kyoto, Japan',
          geometry: { location: { lat: () => 35.01, lng: () => 135.77 } },
          place_id: 'a',
          types: ['locality'],
          address_components: [{ types: ['country'], short_name: 'JP', long_name: 'Japan' }],
        },
        'OK',
      ),
    );
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await type('kyo');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(onSelect).toHaveBeenCalledWith({
      name: 'Kyoto',
      address: 'Kyoto, Japan',
      lat: 35.01,
      lng: 135.77,
      placeId: 'a',
      types: ['locality'],
      countryCode: 'JP',
    });
    expect(screen.getByRole('combobox')).toHaveValue('Kyoto'); // 도시 이름만(주소 전체는 저장값에만)
  });

  it('고른 뒤 글자를 고치면 선택이 풀린다', async () => {
    g.predictions.mockImplementation((_req, cb) =>
      cb([
        {
          place_id: 'a',
          description: 'Kyoto, Japan',
          structured_formatting: { main_text: 'Kyoto', secondary_text: 'Japan' },
        },
      ]),
    );
    g.getDetails.mockImplementation((_req, cb) =>
      cb(
        {
          name: 'Kyoto',
          formatted_address: 'Kyoto, Japan',
          geometry: { location: { lat: () => 1, lng: () => 2 } },
          place_id: 'a',
          types: [],
          address_components: [],
        },
        'OK',
      ),
    );
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await type('kyo');
    fireEvent.mouseDown(screen.getAllByRole('option')[0]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    onSelect.mockClear();
    await type('Kyot');
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('입력이 빠르게 이어지면 마지막 입력만 요청한다(한 번)', async () => {
    g.predictions.mockImplementation((_req, cb) => cb([]));
    render(<Harness onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'k' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ky' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kyo' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(g.predictions).toHaveBeenCalledTimes(1);
    expect(g.predictions.mock.calls[0][0].input).toBe('kyo');
  });

  it('Enter는 폼을 제출하지 않고 현재 항목을 고른다, 글자를 지우면 목록이 사라진다', async () => {
    g.predictions.mockImplementation((_req, cb) =>
      cb([
        {
          place_id: 'a',
          description: 'Rome, Italy',
          structured_formatting: { main_text: 'Rome', secondary_text: 'Italy' },
        },
      ]),
    );
    g.getDetails.mockImplementation((_req, cb) =>
      cb(
        {
          name: 'Rome',
          formatted_address: 'Rome, Italy',
          geometry: { location: { lat: () => 41.9, lng: () => 12.49 } },
          place_id: 'a',
          types: [],
          address_components: [],
        },
        'OK',
      ),
    );
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await type('ro');
    const stop = fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(stop).toBe(false); // preventDefault 됨
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ placeId: 'a' }));
    await type('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
