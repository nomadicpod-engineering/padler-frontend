'use client';

export function AuthAnimations() {
  return (
    <style jsx global>{`
      @media (max-width: 900px) {
        .padler-auth-main {
          display: block !important;
        }
        .padler-auth-brand {
          display: none !important;
        }
      }

      @keyframes floatUpDown {
        0%,
        100% {
          transform: translateY(0px);
        }
        50% {
          transform: translateY(-12px);
        }
      }

      @keyframes softPulse {
        0%,
        100% {
          transform: scale(1);
          box-shadow: 0 0 0 rgba(255, 255, 255, 0.18);
        }
        50% {
          transform: scale(1.06);
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.28);
        }
      }

      @keyframes slideFadeIn {
        from {
          opacity: 0;
          transform: translateX(-12px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `}</style>
  );
}
