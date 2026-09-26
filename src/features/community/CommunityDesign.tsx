
import './CommunityDesign.css';

import type { Destination } from './types';
import { DestinationSelector } from './DestinationSelector';

type Props = {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearch: () => void;
  destinations?: Destination[];
};

export function CommunityDesignBody({ searchQuery, setSearchQuery, handleSearch, destinations }: Props) {
  return (
    <div className="community-root bg-surface text-on-surface antialiased font-body-md text-body-md"><main className="flex-1 max-w-[1440px] w-full mx-auto px-12 pt-10 pb-20">

<section className="mb-10">
<div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-surface-container-highest">
<div>
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm mb-3">
<span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            Wanderers Bulletin
          </span>
<h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">
            Traveler Lounge &amp; Community
          </h1>
<p className="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-2xl">
            Share field notes, ask for local secrets, and connect with fellow wanderers along untrodden routes.
          </p>
</div>

<button className="inline-flex items-center justify-center gap-2 bg-secondary hover:bg-secondary-container text-on-secondary px-5 py-3 rounded-full font-label-md text-label-md shadow-sm active:scale-95 transition-all duration-200 self-start md:self-auto shrink-0">
<span className="material-symbols-outlined text-[18px]" data-icon="edit_square">edit_square</span>
<span>+ New Story / Ask Question</span>
</button>
</div>

<div className="mt-8 w-full"><DestinationSelector destinations={destinations || []} searchElement={<div className="relative w-full lg:max-w-md shrink-0">
<div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
<span className="material-symbols-outlined text-[20px]" data-icon="search">search</span>
</div>
<input className="w-full pl-10 pr-4 py-2.5 rounded-full bg-surface-container-lowest border border-outline-variant/40 focus:border-primary focus:ring-0 font-body-md text-body-md placeholder:text-outline text-primary transition-all shadow-[0_2px_8px_rgba(15,41,66,0.03)]" placeholder="Search discussions, destinations, local tips..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
</div>} /></div>

<div className="mt-6 pt-4 flex items-center justify-between border-t border-surface-container-high text-body-md">

<div className="flex items-center gap-6">
<button className="flex items-center gap-2 font-title-md text-title-md text-primary border-b-2 border-primary pb-2.5">
<span>All Posts</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">1.2k</span>
</button>
<button className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant hover:text-primary pb-2.5 transition-colors">
<span>Following</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">84</span>
</button>
</div>

<div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
<span className="text-outline">Sort by:</span>
<div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant/30">
<button className="px-3 py-1 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm shadow-xs font-semibold">Latest</button>
<button className="px-3 py-1 rounded-full text-on-surface-variant hover:text-primary font-label-sm text-label-sm transition-colors">Most Helpful</button>
<button className="px-3 py-1 rounded-full text-on-surface-variant hover:text-primary font-label-sm text-label-sm transition-colors">Trending</button>
</div>
</div>
</div>
</section>

<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

<div className="lg:col-span-8 flex flex-col gap-6">

<article className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden shadow-[0_4px_20px_-2px_rgba(15,41,66,0.04)] hover:shadow-[0_12px_32px_-4px_rgba(15,41,66,0.08)] transition-all duration-300 flex flex-col">

<div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-container">
<img alt="Artisan traditional matcha tea ceremony preparation at an ancient Kyoto teahouse" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" src="https://lh3.googleusercontent.com/aida/AEtjO1UiwgW2We3ytQdAX6eX-S0G0iDc2ds0qd5FwVg3T7EBYofCJtT76iEO9OxgR_9FP94Py0pseqhQdr0Ao2M_nkmeT29I6yH3y84kOaueTnvwRfqpbDqgzzK2zzLIXHpunJIguDl1GAULDNtNn4eHlDMnUIcA54_7g8_0F0A8fOK3Dmvz_EDDXgB6CEyCGdnuUrgTGXIY6gq3syz416xKk-L6W4OjSjyGtKB0KTmtIbhUbLJrerACoyfk"/>
<div className="absolute top-3.5 left-3.5 flex items-center gap-2">
<span className="px-2.5 py-1 rounded-full bg-primary-container/85 backdrop-blur-md text-on-primary font-label-sm text-label-sm tracking-wide uppercase">
                Field Note
              </span>
<span className="px-2.5 py-1 rounded-full bg-surface-bright/90 backdrop-blur-md text-primary font-label-sm text-label-sm border border-white/40">
                Kyoto, Japan
              </span>
</div>
</div>

<div className="p-6 flex flex-col flex-1">
<h2 className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors cursor-pointer leading-snug">
              Quiet tea houses in Uji away from the main promenade crowds
            </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-2 line-clamp-2">
              Cross the river past the stone torii gate into the residential alleyways. Three generations have served hand-whisked roasted hojicha with seasonal persimmon wagashi here in total quiet.
            </p>

<div className="mt-6 pt-4 border-t border-surface-container flex flex-wrap items-center justify-between gap-3">
<div className="flex items-center gap-3">
<img className="w-8 h-8 rounded-full object-cover border border-outline-variant/40" data-alt="Close-up lifestyle portrait of a thoughtful Japanese woman traveler with round tortoiseshell glasses, warm afternoon sun lighting her smile gently against a quiet courtyard garden background. Minimalist editorial aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVmw7PXqNnBPecT3ZrsVyMXrAZgGtasQRNiDFoYT8uHa1u1CYix-kGGZs-DOKbuEmMO9kJXAKbzfmKNrh-oKYgX7n1WEgF6xbF7MzyMtyfxqYt9JlrXOG5n6w-NgskEFOZ-SLULh_49WzlumpjZCGcjkVILqQEraCGdRQOpWPi3fXdvXwcCxjvux_WVoeusPwJzoygBwIRwRVvNcqwoPwuFZuIM_H_Bm6BXgsiPYyGxp99AI1eaCNfQqN9a5DGmYKKH8XkKEwt"/>
<div>
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary text-sm">Aoi Takahashi</span>
<span className="material-symbols-outlined text-[14px] text-secondary" data-icon="verified" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span>
</div>
<span className="font-body-sm text-body-sm text-outline">Kyoto Resident · 3h ago</span>
</div>
</div>

<div className="flex items-center gap-4 text-on-surface-variant text-label-md font-label-md">
<button className="flex items-center gap-1 hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[18px]" data-icon="favorite">favorite</span>
<span>142</span>
</button>
<button className="flex items-center gap-1 hover:text-primary transition-colors">
<span className="material-symbols-outlined text-[18px]" data-icon="chat_bubble">chat_bubble</span>
<span>28</span>
</button>
<button className="hover:text-primary transition-colors text-outline" title="Bookmark">
<span className="material-symbols-outlined text-[18px]" data-icon="bookmark">bookmark</span>
</button>
<span className="text-outline-variant">|</span>
<span className="font-label-sm text-label-sm text-outline">4 min read</span>
</div>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden shadow-[0_4px_20px_-2px_rgba(15,41,66,0.04)] hover:shadow-[0_12px_32px_-4px_rgba(15,41,66,0.08)] transition-all duration-300 flex flex-col">

<div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-container">
<img alt="Editorial photograph of Kyoto Japan Arashiyama bamboo grove path at dawn" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" src="https://lh3.googleusercontent.com/aida/AEtjO1VNEZM3qe5yzLbdPCc0Kw8nQdKCQgCN8rlxalztLtIyV03akxaBba17l7eHJ0KR-y9ZjRLWSAT-jRrBCJ9zQ9BwtnZWh4uZ2RAorOW3i82clpwFaaT6H9XleEfsbl8g9rvThiZaVuxoyahB-606Spiw0yvXz8XTAZeOZnPFCcX7Kxj4dW5MPy_thXSjq8vJvTFMcYZ5dY5b1YQ6pwR7-RFHvnHatSMfDcXlfPoqtNfi2kCUtiQUNgI"/>
<div className="absolute top-3.5 left-3.5 flex items-center gap-2">
<span className="px-2.5 py-1 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm tracking-wide uppercase">
                Q&amp;A &amp; Advice
              </span>
<span className="px-2.5 py-1 rounded-full bg-surface-bright/90 backdrop-blur-md text-primary font-label-sm text-label-sm border border-white/40">
                Arashiyama
              </span>
</div>
</div>

<div className="p-6 flex flex-col flex-1">
<h2 className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors cursor-pointer leading-snug">
              Best sunrise vantage points in Arashiyama: Is 5:30 AM truly necessary?
            </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-2 line-clamp-2">
              Documenting my dawn walk through the grove. If you arrive past 6:15 AM, commercial tour vans begin arriving. Here is the quiet hillside detour that stays serene until midday.
            </p>

<div className="mt-6 pt-4 border-t border-surface-container flex flex-wrap items-center justify-between gap-3">
<div className="flex items-center gap-3">
<img className="w-8 h-8 rounded-full object-cover border border-outline-variant/40" data-alt="Editorial portrait of an athletic male backpacker in a wool knit beanie and waterproof jacket, smiling naturally against a misty forest background in soft daylight." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIunNqhiBTaFPQYvpwbV2XczRIbXOoQZTFAnfKr_wdmoBeAS83Wf4AkkO_I7AFrJL7jXYd2IM5z6uKKMVU1kFuBT4lk8FNvAN13z5kyhOz-648K9lvreEGa6quEE7fmb-BCXfyVg-a0zVEosHbqNGqA0o8PXcvunJUsqWjV89OiZJoyimfYmIve8aRV6OxIPNR8UbsTD90YQQWasV7CEyDkfKPDHwSwG7Cm5oBpsKhwynzMMeDweLVzYI2zDNJNW__1jhygVz6"/>
<div>
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary text-sm">Marcus Vance</span>
<span className="px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-[10px]">Curator</span>
</div>
<span className="font-body-sm text-body-sm text-outline">Independent Hiker · 6h ago</span>
</div>
</div>

<div className="flex items-center gap-4 text-on-surface-variant text-label-md font-label-md">
<button className="flex items-center gap-1 hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[18px]" data-icon="favorite">favorite</span>
<span>95</span>
</button>
<button className="flex items-center gap-1 hover:text-primary transition-colors">
<span className="material-symbols-outlined text-[18px]" data-icon="chat_bubble">chat_bubble</span>
<span>41</span>
</button>
<button className="hover:text-primary transition-colors text-outline" title="Bookmark">
<span className="material-symbols-outlined text-[18px]" data-icon="bookmark">bookmark</span>
</button>
<span className="text-outline-variant">|</span>
<span className="font-label-sm text-label-sm text-secondary font-semibold">12 new replies</span>
</div>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden shadow-[0_4px_20px_-2px_rgba(15,41,66,0.04)] hover:shadow-[0_12px_32px_-4px_rgba(15,41,66,0.08)] transition-all duration-300 flex flex-col">

<div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-container">
<img className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" data-alt="Sweeping panoramic photograph of the Tre Cime di Lavaredo peaks in the Italian Dolomites at golden hour, showing jagged limestone towers glowing with amber light above an empty alpine trail. Warm editorial travel monograph style." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDO6WEMjO0ux4eE_a1lyZ7W69msxDDfkD4hmbyh0IJHr_THibxFzV_Z20mMY2ZjFvhaHrcTNDuq9Y4RMJRYxBzoSArhlWcN0YEyv6JUjvzN6U9Gmb0Ffi_wdZy2YuZfekIgbhQiV0k8LK4Spw5fd5cv-kgAynDe4JWHnmasQt_DQt8xmXg3AcKgvwjZ07q80ZZVOEUtbnR5U4TbLn9HomZGSjD-r-RL6Xcnw_qAM1g8FaVjiub8SNB7B7R8fLM5_3Z73AJI2Zn_"/>
<div className="absolute top-3.5 left-3.5 flex items-center gap-2">
<span className="px-2.5 py-1 rounded-full bg-primary-container/85 backdrop-blur-md text-on-primary font-label-sm text-label-sm tracking-wide uppercase">
                Itinerary Review
              </span>
<span className="px-2.5 py-1 rounded-full bg-surface-bright/90 backdrop-blur-md text-primary font-label-sm text-label-sm border border-white/40">
                Dolomites, Italy
              </span>
</div>
</div>

<div className="p-6 flex flex-col flex-1">
<h2 className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors cursor-pointer leading-snug">
              3-day solo hiking essentials for the Dolomites: Refugio booking reality
            </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-2 line-clamp-2">
              If you did not reserve high-altitude huts six months prior, do not cancel your plans. Here is how I sequenced valley stays with early morning mountain lifts and backcountry traverses.
            </p>

<div className="mt-6 pt-4 border-t border-surface-container flex flex-wrap items-center justify-between gap-3">
<div className="flex items-center gap-3">
<img className="w-8 h-8 rounded-full object-cover border border-outline-variant/40" data-alt="Warm natural portrait of a European female writer with tied back hair smiling softly while journaling on a rustic pine table in an alpine hut. High-key natural window lighting." src="https://lh3.googleusercontent.com/aida-public/AB6AXuD7kcrNgkFty64Gi2lwXM-KuBtVWd6oZoZMV99D4qTQPihwqTetdb_3dx5nfOpRWl1uOTYpRzF1GoyL4-FBx0LFziqViy4MwXorl5sa8eOkGKqKVI8hBTOdSqaVTWptNqaXBm55V5_LeKbFcvBN65ihMIY3-IJp5800BJuGRJPpVxYN7xN2PnwGJbqKeP9gknlTLSm6Nss28sRo4UlzfY5222DpZWrBf_3m056sZ7hFTvosYTEsvVnqo6mcuRg66dvSKp10d2_J"/>
<div>
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary text-sm">Elena Rostova</span>
<span className="material-symbols-outlined text-[14px] text-secondary" data-icon="verified" style={{"fontVariationSettings":"'FILL' 1"}}>verified</span>
</div>
<span className="font-body-sm text-body-sm text-outline">Alpine Guide · 1d ago</span>
</div>
</div>

<div className="flex items-center gap-4 text-on-surface-variant text-label-md font-label-md">
<button className="flex items-center gap-1 hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[18px]" data-icon="favorite">favorite</span>
<span>210</span>
</button>
<button className="flex items-center gap-1 hover:text-primary transition-colors">
<span className="material-symbols-outlined text-[18px]" data-icon="chat_bubble">chat_bubble</span>
<span>53</span>
</button>
<button className="hover:text-primary transition-colors text-outline" title="Bookmark">
<span className="material-symbols-outlined text-[18px]" data-icon="bookmark">bookmark</span>
</button>
<span className="text-outline-variant">|</span>
<span className="font-label-sm text-label-sm text-outline">6 min read</span>
</div>
</div>
</div>
</article>

<article className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-hidden shadow-[0_4px_20px_-2px_rgba(15,41,66,0.04)] hover:shadow-[0_12px_32px_-4px_rgba(15,41,66,0.08)] transition-all duration-300 flex flex-col">

<div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-container">
<img className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" data-alt="Earthy artisanal pottery studio in Japan displaying rustic clay vases, textured bowls, and wooden carving tools on a weathered cedar shelf bathed in warm sunlight. Editorial craftsmanship photography." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCMhP2eLFcazF6hRFRhhroaH7yQZU7JUC4jeE-gCi0frILTZCfRa09QRznf3WjEvg0pINyh2uT7J27xN5_AfYiZGJH6iensUOBOIv00CW_x0kw_mGkWcSQn-z4tGEaxAf1IL7KcuWSQvhO3DKoQUnbgLwoExm4_-eCMA5jOOGwSfkQRkQm_rOEwF8LrpMONq_lwERZ40m77B5ShxFpG4HOQjScPvj44Tia1yRFQdmMUc2mdOc-oCdmJvBOsWSVb2audzHF2vcxl"/>
<div className="absolute top-3.5 left-3.5 flex items-center gap-2">
<span className="px-2.5 py-1 rounded-full bg-primary-container/85 backdrop-blur-md text-on-primary font-label-sm text-label-sm tracking-wide uppercase">
                Hidden Gem
              </span>
<span className="px-2.5 py-1 rounded-full bg-surface-bright/90 backdrop-blur-md text-primary font-label-sm text-label-sm border border-white/40">
                Gojo-zaka
              </span>
</div>
</div>

<div className="p-6 flex flex-col flex-1">
<h2 className="font-headline-sm text-headline-sm text-primary hover:text-secondary transition-colors cursor-pointer leading-snug">
              Where to find authentic multi-generational ceramic studios in Kyoto
            </h2>
<p className="font-body-md text-body-md text-on-surface-variant mt-2 line-clamp-2">
              A curated map of four family-run kilns near Kiyomizu-dera that welcome travelers for private studio visits and small-batch tea cup purchases without pretense.
            </p>

<div className="mt-6 pt-4 border-t border-surface-container flex flex-wrap items-center justify-between gap-3">
<div className="flex items-center gap-3">
<img className="w-8 h-8 rounded-full object-cover border border-outline-variant/40" data-alt="Candid portrait of an older artisan Japanese craftsman with warm laugh lines wearing indigo workwear in his bright studio workshop. Clean warm lighting." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGI947AZeNwdMFNX_w2cqCqQinGXWGWmJvigahhiRYJUwG54E9N6Q2fG75GQw27IMOi1Ylbpzuy_Gzg00kjM7nYeyX_vxeo50lgUIy4PZKBjAb56CpLRIq9nZFQObxL2nimIQClXPX-TwutjmGERc1PmfQV_hYmu7OldxTSe-fqbdhACo6TO74_cdAor7ZFfGxFaA9JA99BtQF46yH4eFMXBuxpMpd90N542ERGes6NGEu2o2TOWj3st_Zw-aNPwuqxZmML0TH"/>
<div>
<div className="flex items-center gap-1.5">
<span className="font-title-md text-title-md text-primary text-sm">Kenji Morita</span>
</div>
<span className="font-body-sm text-body-sm text-outline">Ceramist &amp; Curator · 2d ago</span>
</div>
</div>

<div className="flex items-center gap-4 text-on-surface-variant text-label-md font-label-md">
<button className="flex items-center gap-1 hover:text-secondary transition-colors">
<span className="material-symbols-outlined text-[18px]" data-icon="favorite">favorite</span>
<span>184</span>
</button>
<button className="flex items-center gap-1 hover:text-primary transition-colors">
<span className="material-symbols-outlined text-[18px]" data-icon="chat_bubble">chat_bubble</span>
<span>19</span>
</button>
<button className="hover:text-primary transition-colors text-outline" title="Bookmark">
<span className="material-symbols-outlined text-[18px]" data-icon="bookmark">bookmark</span>
</button>
<span className="text-outline-variant">|</span>
<span className="font-label-sm text-label-sm text-outline">3 min read</span>
</div>
</div>
</div>
</article>

<div className="pt-6 pb-2 flex justify-center">
<button className="px-8 py-3 rounded-full bg-surface-container-lowest border border-outline-variant/40 hover:border-primary text-primary font-label-md text-label-md transition-all duration-200 shadow-sm hover:shadow active:scale-95 flex items-center gap-2">
<span>Load more stories from the community</span>
<span className="material-symbols-outlined text-[18px]" data-icon="expand_more">expand_more</span>
</button>
</div>
</div>

<aside className="lg:col-span-4 flex flex-col gap-6 sticky top-24">

<div className="bg-surface-container-low rounded-xl border border-outline-variant/40 p-6 relative overflow-hidden">
<div className="flex items-center justify-between gap-2 mb-3">
<span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold flex items-center gap-1.5">
<span className="material-symbols-outlined text-[16px]" data-icon="lightbulb" style={{"fontVariationSettings":"'FILL' 1"}}>lightbulb</span>
              Weekly Prompt
            </span>
<span className="text-outline font-label-sm text-label-sm">Ends Sunday</span>
</div>
<h3 className="font-headline-sm text-headline-sm text-primary mb-2">
            "What is your favorite quiet spot in your hometown?"
          </h3>
<p className="font-body-md text-body-md text-on-surface-variant mb-4">
            Whether it's an unmapped riverbench, a basement bookstore, or an early morning bakery line—tell the community where you go to breathe.
          </p>
<a className="inline-flex items-center gap-2 font-label-md text-label-md text-secondary hover:text-primary transition-colors" href="#">
<span>Share your spot (42 responses)</span>
<span className="material-symbols-outlined text-[16px]" data-icon="arrow_forward">arrow_forward</span>
</a>
</div>

<div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6 shadow-[0_4px_20px_-2px_rgba(15,41,66,0.03)]">
<div className="flex items-center justify-between mb-4">
<h3 className="font-title-md text-title-md text-primary">Active Storytellers</h3>
<a className="font-label-sm text-label-sm text-outline hover:text-primary transition-colors" href="#">View All</a>
</div>
<div className="flex flex-col gap-4">

<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-3">
<img className="w-10 h-10 rounded-full object-cover border border-outline-variant/30" data-alt="Warm natural portrait of an Asian woman smiling in a wool sweater with soft morning sunlight behind her in a cozy minimalist café setting." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDdWP18qP0AZcSXUzbkJr1xEzeS-gp-uskCtcwGWQ3M0EH8RgFelsVvK_FCyTwKZ9GrAw8SwZd3AuyPlLpsK4HK9lK3bjepNXC9Z7toS5PYk16wz5gkbXyluH0i1WQtjo16BwdBydmg4ybddA_GHhxfFzbex1RdGgXxFRGI4F8PODmhVySr5NKiM3wqik-cUm0yhJ7TMCXVktzS3Wg7TKM9TyscwGbBzPmOOoqMPCJ6uYcmZ4vwB88k5HWFtis_jgAFp0wbeBnp"/>
<div>
<h4 className="font-title-md text-title-md text-primary text-sm leading-tight">Claire Lin</h4>
<p className="font-body-sm text-body-sm text-outline">Taipei &amp; Tokyo Notes</p>
</div>
</div>
<button className="px-3 py-1 rounded-full border border-outline-variant/60 hover:border-primary text-primary font-label-sm text-label-sm transition-all hover:bg-surface-container">
                Follow
              </button>
</div>

<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-3">
<img className="w-10 h-10 rounded-full object-cover border border-outline-variant/30" data-alt="Close up photograph of a European male photographer holding a vintage mechanical rangefinder camera, relaxed and friendly demeanor, warm natural lighting." src="https://lh3.googleusercontent.com/aida-public/AB6AXuA_X65GQ2Q0ncAkmGztTLnysMVxNObPrQGrvMDTmjzcrWSsCVFTG4-AEjRoGo-xrxTTLxpNIkPRPmWqqepFAfad1fkkq47bQHXrq82lXhGN4AJXODxc4w4gkU5_bTS0F6X0jPd6hUz0ko_DlxktrOAOu0IqJBBMJMILfEO8X0_AdI1a4rsnb3EqCL6U-YkJCSJRhjgU7p-k9QF9jbq1yRwyvkffagYGPAl3HK3Bqo5jRoHostPN6qMr_n4E4C8pvEXe2MewZM_U"/>
<div>
<h4 className="font-title-md text-title-md text-primary text-sm leading-tight">Julian Berg</h4>
<p className="font-body-sm text-body-sm text-outline">Nordic Fjords &amp; Huts</p>
</div>
</div>
<button className="px-3 py-1 rounded-full border border-outline-variant/60 hover:border-primary text-primary font-label-sm text-label-sm transition-all hover:bg-surface-container">
                Follow
              </button>
</div>

<div className="flex items-center justify-between gap-3">
<div className="flex items-center gap-3">
<img className="w-10 h-10 rounded-full object-cover border border-outline-variant/30" data-alt="Portrait of an Italian travel writer sitting beside an espresso cup on an outdoor Mediterranean terrace with sun-drenched stone walls behind her." src="https://lh3.googleusercontent.com/aida-public/AB6AXuC5Kid7HDL2a3c3U2lI_0b93CXEvAbHy6WoiHWwOR8Z4qt5qzrw9Q6lWTDpKWOhNL5QD4AWTOGEO5ruFAMqymIpk7z5_kw-69D619Ng8ZRzriCbaoI_z5Zv-oK38xIhig8VgVC0ixuTxpLxzJ_Di_1ypjXz6_ZJ2fVp72FN_7QY_fvxNcGrZFF9F7xXWcvAr_Hm7BGxIR5tkUiRbKemJ_VTPphRBF5j6CaznpmGwqsGCJVX7aA-KwHwMSyzm8yx3PfOuzaWS2we"/>
<div>
<h4 className="font-title-md text-title-md text-primary text-sm leading-tight">Lucia Moretti</h4>
<p className="font-body-sm text-body-sm text-outline">Sicily &amp; Liguria Trails</p>
</div>
</div>
<button className="px-3 py-1 rounded-full border border-outline-variant/60 hover:border-primary text-primary font-label-sm text-label-sm transition-all hover:bg-surface-container">
                Follow
              </button>
</div>
</div>
</div>

<div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6 shadow-[0_4px_20px_-2px_rgba(15,41,66,0.03)]">
<h3 className="font-title-md text-title-md text-primary mb-3">Popular Discussions</h3>
<div className="flex flex-wrap gap-2">
<a className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors" href="#">
              #KyotoCafes <span className="text-outline ml-1">324</span>
</a>
<a className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors" href="#">
              #SoloTraveler <span className="text-outline ml-1">890</span>
</a>
<a className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors" href="#">
              #RailPassTips <span className="text-outline ml-1">156</span>
</a>
<a className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors" href="#">
              #SlowTravel <span className="text-outline ml-1">642</span>
</a>
<a className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors" href="#">
              #PackingLight <span className="text-outline ml-1">210</span>
</a>
<a className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors" href="#">
              #NightPhotography <span className="text-outline ml-1">98</span>
</a>
</div>
</div>

<div className="p-5 rounded-xl border border-dashed border-outline-variant/50 bg-transparent flex flex-col gap-2">
<div className="flex items-center gap-2 text-primary font-title-md text-sm">
<span className="material-symbols-outlined text-[18px] text-secondary" data-icon="auto_stories">auto_stories</span>
<span>The Triptic Ethos</span>
</div>
<p className="font-body-sm text-body-sm text-on-surface-variant">
            We value calm guidance, respect for fragile local cultures, and honest field reflections over hurried tourist bucket lists.
          </p>
<a className="font-label-sm text-label-sm text-outline hover:text-primary transition-colors underline underline-offset-2 mt-1" href="#">
            Read Community Guidelines
          </a>
</div>
</aside>
</div>
</main></div>
  );
}
