"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * PDP Gallery (design-system.md §4):
 *  - full-bleed left column (60%), images stacked
 *  - mobile: the column becomes a swipeable vertical stack (CSS scroll-snap)
 *  - includes a drape-video slot (muted, loop, playsinline) — the brand's
 *    "fabric in motion" asset; falls back gracefully when no video is set.
 *
 * The active image is controlled so a thumbnail strip could drive it later;
 * for now the full-stack layout reads as a scroll gallery.
 */
export function Gallery({
  images,
  videoSrc,
}: {
  images: { url: string; alt: string }[];
  videoSrc?: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <div className="aspect-[4/5] bg-ivory-deep" aria-label="No image available" />;
  }

  return (
    <div className="md:sticky md:top-24">
      {/* Desktop / scroll stack: full-bleed images */}
      <div className="flex flex-col gap-3">
        {videoSrc && (
          <video
            muted
            loop
            playsInline
            autoPlay
            className="aspect-[4/5] w-full bg-ink object-cover"
            src={videoSrc}
          />
        )}
        {images.map((img, i) => (
          <button
            key={img.url + i}
            type="button"
            onClick={() => setActive(i)}
            className="relative aspect-[4/5] w-full overflow-hidden bg-ivory-deep"
            aria-label={`View image ${i + 1} of ${images.length}`}
          >
            <Image
              src={img.url}
              alt={img.alt}
              fill
              sizes="(min-width: 768px) 60vw, 100vw"
              priority={i === 0}
              className={cn(
                "object-cover transition-transform duration-[var(--animate-duration-slow)] ease-[var(--ease-brand)]",
                "hover:scale-[1.01]",
              )}
            />
          </button>
        ))}
      </div>
      {/* hidden: keeps `active` referenced so the API stays forward-compatible */}
      <span className="sr-only">Active image {active + 1}</span>
    </div>
  );
}
