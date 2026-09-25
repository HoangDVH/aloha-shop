"use client";

import { useEffect, useId, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Leaf,
  MessageSquareQuote,
  Quote,
  Star,
} from "lucide-react";

export type CustomerReview = {
  id: string;
  name: string;
  location?: string;
  rating: number;
  content: string;
  image?: string;
  /** Set only when a purchase has been verified by the data source. */
  verifiedPurchase?: boolean;
};

function ReviewImage({
  src,
  name,
  demo,
}: {
  src?: string;
  name: string;
  demo: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className="flex aspect-[7/10] w-[38%] shrink-0 items-center justify-center self-stretch overflow-hidden rounded-2xl bg-[#eef1e6]">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={demo ? "Ảnh minh họa sản phẩm Aloha" : `Ảnh chia sẻ của ${name}`}
          width={240}
          height={300}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Leaf
          size={32}
          strokeWidth={1.4}
          className="text-[#809574]"
          aria-hidden
        />
      )}
    </div>
  );
}

/** Pass published reviews only; the summary describes precisely this collection. */
export function CustomerReviews({
  reviews = [],
  demo = false,
}: {
  reviews?: CustomerReview[];
  demo?: boolean;
}) {
  const titleId = useId();
  const carouselId = useId();
  const [viewport, api] = useEmblaCarousel({
    align: "start",
    loop: false,
    slidesToScroll: "auto",
  });
  const [position, setPosition] = useState({
    index: 0,
    count: 0,
    prev: false,
    next: false,
  });
  const items = reviews.filter(
    (review) =>
      review.name.trim() &&
      review.content.trim() &&
      Number.isInteger(review.rating) &&
      review.rating >= 1 &&
      review.rating <= 5,
  );
  const average = items.length
    ? items.reduce((sum, review) => sum + review.rating, 0) / items.length
    : 0;

  useEffect(() => {
    if (!api) return;
    const update = () =>
      setPosition({
        index: api.selectedScrollSnap(),
        count: api.scrollSnapList().length,
        prev: api.canScrollPrev(),
        next: api.canScrollNext(),
      });
    update();
    api.on("select", update).on("reInit", update);
    return () => {
      api.off("select", update).off("reInit", update);
    };
  }, [api]);

  return (
    <section
      aria-labelledby={titleId}
      className="overflow-hidden bg-[#faf7ef] py-10 sm:py-12"
    >
      <div className="mx-auto max-w-[96rem] px-4 sm:px-6 lg:px-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id={titleId}
            className="text-2xl font-bold leading-snug tracking-normal text-[#173f30] sm:text-3xl"
          >
            Khách hàng nói gì về Aloha?
          </h2>

          {items.length > 0 && !demo && (
            <p className="mt-4 inline-flex flex-wrap items-center justify-center gap-3 rounded-full border border-[#e1e7d5] bg-[#f0f3e7] px-5 py-2 text-sm text-[#35523e]">
              <Star
                size={19}
                className="fill-amber-500 text-amber-500"
                aria-hidden
              />
              <strong>
                {average.toLocaleString("vi-VN", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                /5
              </strong>
              <span>
                · {items.length.toLocaleString("vi-VN")} đánh giá được hiển thị
              </span>
            </p>
          )}
        </div>
        {items.length ? (
          <div
            role="region"
            aria-roledescription="băng chuyền"
            aria-labelledby={titleId}
            className="relative mt-7"
          >
            <div
              ref={viewport}
              id={carouselId}
              className="overflow-hidden rounded-3xl"
            >
              <div className="-ml-4 flex touch-pan-y">
                {items.map((review, index) => (
                  <div
                    key={review.id}
                    role="group"
                    aria-roledescription="đánh giá"
                    aria-label={`${index + 1} / ${items.length}`}
                    className="min-w-0 flex-[0_0_100%] pl-4 md:flex-[0_0_50%] xl:flex-[0_0_33.333333%]"
                  >
                    <article className="flex h-full items-start gap-4 rounded-3xl border border-white bg-white/90 p-4 shadow-[0_8px_24px_-16px_rgba(70,60,35,0.25)]">
                      <ReviewImage
                        src={review.image}
                        name={review.name}
                        demo={demo}
                      />
                      <div className="min-w-0 flex-1">
                        {demo ? (
                          <p></p>
                        ) : (
                          review.verifiedPurchase && (
                            <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-[#edf3e5] px-2 py-1 text-[11px] font-medium text-green-800">
                              <BadgeCheck size={13} aria-hidden />
                              Đã mua hàng
                            </p>
                          )
                        )}
                        <h3 className="min-h-10 text-sm font-semibold leading-5 tracking-normal text-stone-900">
                          {review.name.normalize("NFC")}
                          {review.location && (
                            <span className="font-medium text-stone-600">
                              {" "}
                              · {review.location.normalize("NFC")}
                            </span>
                          )}
                        </h3>
                        <div
                          role="img"
                          aria-label={`${review.rating} trên 5 sao`}
                          className="my-2 flex gap-0.5"
                        >
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              size={17}
                              aria-hidden
                              className={
                                i < review.rating
                                  ? "fill-amber-500 text-amber-500"
                                  : "text-stone-200"
                              }
                            />
                          ))}
                        </div>
                        <Quote
                          size={22}
                          className="mb-1 fill-[#c9d7bd] text-[#c9d7bd]"
                          aria-hidden
                        />
                        <blockquote className="break-words text-left text-sm font-normal leading-6 tracking-normal text-stone-600">
                          {review.content.normalize("NFC")}
                        </blockquote>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </div>
            {position.count > 1 && (
              <div className="mt-5 flex items-center justify-center gap-4">
                <button
                  type="button"
                  aria-label="Nhóm đánh giá trước"
                  aria-controls={carouselId}
                  disabled={!position.prev}
                  onClick={() => api?.scrollPrev()}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-800 lg:absolute lg:-left-12 lg:top-[calc(50%-2rem)] lg:-translate-y-1/2"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex flex-wrap justify-center">
                  {Array.from({ length: position.count }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={`Đến nhóm đánh giá ${index + 1}`}
                      aria-current={
                        index === position.index ? "true" : undefined
                      }
                      aria-controls={carouselId}
                      onClick={() => api?.scrollTo(index)}
                      className="flex h-11 w-8 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-800"
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${index === position.index ? "bg-green-800" : "bg-stone-300"}`}
                      />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Nhóm đánh giá tiếp theo"
                  aria-controls={carouselId}
                  disabled={!position.next}
                  onClick={() => api?.scrollNext()}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-800 lg:absolute lg:-right-12 lg:top-[calc(50%-2rem)] lg:-translate-y-1/2"
                >
                  <ChevronRight size={20} />
                </button>
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                  Nhóm {position.index + 1} trên {position.count}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-[#e9e5d9] bg-white/80 px-6 py-8 text-center">
            <MessageSquareQuote
              size={30}
              strokeWidth={1.5}
              className="mx-auto text-[#6e8a60]"
              aria-hidden
            />
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Chưa có đánh giá được công bố.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
