"use client";

import { useEffect, useState } from "react";

export function SubNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const secs = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (!secs.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-165px 0px -60% 0px", threshold: 0 }
    );
    secs.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav className="mt-3 flex gap-1 overflow-x-auto">
      {items.map((t) => (
        <a
          key={t.id}
          href={"#" + t.id}
          className={
            "whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition " +
            (active === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-zinc-500 hover:text-zinc-800")
          }
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
