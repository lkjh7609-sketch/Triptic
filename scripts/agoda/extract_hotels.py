"""아고다 호텔 데이터(제휴 포털에서 받은 *_KO.zip, 안에 CSV 하나 약 2GB) → 호텔명 검색 색인용 NDJSON.

후기 MIN_REVIEWS개 이상인 숙소만, 색인에 필요한 칸만 뽑는다(0106 agoda_hotels 표와 같은 이름).
한국어 이름(hotel_translated_name)은 영어 이름과 다를 때만 넣는다.

    python3 -I scripts/agoda/extract_hotels.py <받은 zip> <출력.ndjson> [최소 후기 수, 기본 10]
그다음 scripts/agoda/load_hotels.mjs 로 DB에 넣는다.
"""
import csv
import io
import json
import sys
import zipfile

csv.field_size_limit(10**9)


def num(value, cast):
    try:
        return cast(value) if value not in (None, '') else None
    except ValueError:
        return None


def main():
    src, dst = sys.argv[1], sys.argv[2]
    min_reviews = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    zf = zipfile.ZipFile(src)
    kept = 0
    with zf.open(zf.namelist()[0]) as f, open(dst, 'w', encoding='utf-8') as out:
        for row in csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig', newline='')):
            reviews = num(row.get('number_of_reviews'), int) or 0
            hotel_id = num(row.get('hotel_id'), int)
            city_id = num(row.get('city_id'), int)
            name = (row.get('hotel_name') or '').strip()
            if reviews < min_reviews or hotel_id is None or city_id is None or not name:
                continue
            name_ko = (row.get('hotel_translated_name') or '').strip()
            out.write(json.dumps({
                'hotel_id': hotel_id,
                'name': name,
                'name_ko': name_ko if name_ko and name_ko != name else None,
                'city_id': city_id,
                'city': (row.get('city') or '').strip() or None,
                'country': (row.get('countryisocode') or '').strip() or None,
                'lat': num(row.get('latitude'), float),
                'lng': num(row.get('longitude'), float),
                'stars': num(row.get('star_rating'), float),
                'reviews': reviews,
                'rating': num(row.get('rating_average'), float),
            }, ensure_ascii=False) + '\n')
            kept += 1
    print(f'{kept} hotels -> {dst}')


if __name__ == '__main__':
    main()
