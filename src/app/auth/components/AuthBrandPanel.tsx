'use client';

import { CheckCircle2, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { ReactNode } from 'react';

type AuthBrandPanelProps = {
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  icon?: ReactNode;
};

export function AuthBrandPanel({ title, subtitle, description, bullets, icon }: AuthBrandPanelProps) {
  return (
    <section className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-slate-950 px-10 py-12 text-white">
      <div className="pointer-events-none absolute left-14 top-12 grid size-12 place-items-center rounded-full bg-white/15 motion-safe:animate-[floatUpDown_4s_ease-in-out_infinite]">
        <ShieldCheck size={24} />
      </div>
      <div className="pointer-events-none absolute bottom-16 right-20 grid size-14 place-items-center rounded-full bg-white/15 motion-safe:animate-[floatUpDown_5.2s_ease-in-out_infinite]">
        <CheckCircle2 size={26} />
      </div>
      <div className="relative z-10 max-w-md">
        <div className="mb-5 grid size-[68px] place-items-center rounded-full bg-white/15 motion-safe:animate-[softPulse_2.8s_ease-in-out_infinite]">
          {icon ?? <LayoutDashboard size={34} />}
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">Padler</p>
        <h1 className="m-0 text-4xl font-semibold tracking-tight motion-safe:animate-[slideFadeIn_0.7s_ease-out]">
          {title}
        </h1>
        <p className="mt-2 text-lg text-blue-100">{subtitle}</p>
        <p className="mt-7 leading-relaxed text-blue-50/90 motion-safe:animate-[slideFadeIn_0.95s_ease-out]">
          {description}
        </p>
        <ul className="mt-6 space-y-3">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-blue-50">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-teal-300" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
