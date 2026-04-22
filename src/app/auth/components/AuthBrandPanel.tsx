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
    <section
      style={{
        flex: 1,
        display: 'flex',
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #0f172a 100%)',
        color: 'white',
        padding: 48,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 60,
          width: 52,
          height: 52,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.14)',
          display: 'grid',
          placeItems: 'center',
          animation: 'floatUpDown 4s ease-in-out infinite'
        }}
      >
        <ShieldCheck size={24} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 70,
          right: 90,
          width: 56,
          height: 56,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.14)',
          display: 'grid',
          placeItems: 'center',
          animation: 'floatUpDown 5.2s ease-in-out infinite'
        }}
      >
        <CheckCircle2 size={26} />
      </div>
      <div style={{ maxWidth: 460 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            marginBottom: 20,
            background: 'rgba(255,255,255,0.16)',
            animation: 'softPulse 2.8s ease-in-out infinite'
          }}
        >
          {icon ?? <LayoutDashboard size={34} />}
        </div>
        <h1 style={{ fontSize: 42, margin: '0 0 10px 0', animation: 'slideFadeIn 0.7s ease-out' }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 18, color: '#bfdbfe' }}>{subtitle}</p>
        <p style={{ marginTop: 28, marginBottom: 0, color: '#dbeafe', lineHeight: 1.55, animation: 'slideFadeIn 0.95s ease-out' }}>
          {description}
        </p>

        <div style={{ marginTop: 30, display: 'grid', gap: 16 }}>
          {bullets.map((bullet, index) => (
            <div key={bullet} style={{ display: 'flex', gap: 10, alignItems: 'center', animation: `slideFadeIn ${1.15 + index * 0.2}s ease-out` }}>
              {index % 2 === 0 ? <ShieldCheck size={18} /> : <CheckCircle2 size={18} />}
              <span style={{ color: '#e2e8f0' }}>{bullet}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
