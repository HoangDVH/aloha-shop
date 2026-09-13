import type { ReactNode } from "react";
import { Leaf } from "lucide-react";

/** Tiêu đề section kiểu lá + gạch ngang (vd. THÔNG TIN HỮU ÍCH). */
export function SectionTitle({
  children,
  as: Tag = "h2",
  className = "",
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-1.5 px-1 sm:gap-3 sm:px-2 ${className}`}>
      <span className="section-title-ornament" aria-hidden>
        <span className="section-title-line" />
        <Leaf className="section-title-leaf" strokeWidth={2.25} />
        <span className="section-title-line" />
      </span>
      <Tag className="section-title-text text-center">
        {children}
      </Tag>
      <span className="section-title-ornament" aria-hidden>
        <span className="section-title-line" />
        <Leaf className="section-title-leaf" strokeWidth={2.25} />
        <span className="section-title-line" />
      </span>
    </div>
  );
}
