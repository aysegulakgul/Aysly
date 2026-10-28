import type { ReactNode } from 'react';
import { cn } from '../cn';

/** Figma UI/Panel (ör. 4:69590): yüzey zemini, 1 px kenarlık, 10 px köşe, 20 px iç boşluk, 16 px aralık. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-md border border-border bg-surface p-5',
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Figma "Section heading": 17 px yarı kalın başlık. */
export function SectionHeading({
  children,
  as: Tag = 'h2',
}: {
  children: ReactNode;
  as?: 'h1' | 'h2';
}) {
  return <Tag className="text-lg font-semibold text-text">{children}</Tag>;
}
