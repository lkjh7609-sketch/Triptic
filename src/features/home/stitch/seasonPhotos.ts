import kyotoPc from '@/assets/home/season-kyoto.webp';
import parisPc from '@/assets/home/season-paris.webp';
import newyorkPc from '@/assets/home/season-newyork.webp';
import londonPc from '@/assets/home/season-london.webp';
import romePc from '@/assets/home/season-rome.webp';
import tokyoPc from '@/assets/home/season-tokyo.webp';
import kyotoM from '@/assets/home/m-season-kyoto.webp';
import parisM from '@/assets/home/m-season-paris.webp';
import bangkokM from '@/assets/home/m-season-bangkok.webp';
import newyorkM from '@/assets/home/m-season-newyork.webp';
import londonM from '@/assets/home/m-season-london.webp';

/** 시안에 따로 있는 사진 — PC/모바일 사진이 따로 있는 도시만(도시 slug 기준). 없으면 도시 대표 사진(cover_url)을 쓴다 */
const PHOTOS: Record<string, { pc?: string; mobile?: string }> = {
  kyoto: { pc: kyotoPc, mobile: kyotoM },
  tokyo: { pc: tokyoPc },
  bangkok: { mobile: bangkokM },
  paris: { pc: parisPc, mobile: parisM },
  london: { pc: londonPc, mobile: londonM },
  rome: { pc: romePc },
  newyork: { pc: newyorkPc, mobile: newyorkM },
};

export function designPhotoFor(slug: string, desktop: boolean): string | null {
  const photo = PHOTOS[slug];
  return (desktop ? (photo?.pc ?? photo?.mobile) : (photo?.mobile ?? photo?.pc)) ?? null;
}
