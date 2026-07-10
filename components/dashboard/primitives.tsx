"use client";

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Animate a number from 0 → value once it scrolls into view. */
export function CountUp({
  value,
  duration = 1100,
  format = (n: number) => Math.round(n).toLocaleString("en-IN"),
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(value * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={`tnum ${className}`}>
      {prefix}
      {format(display)}
      {suffix}
    </span>
  );
}

/** A single animated progress ring (SVG). */
export function Ring({
  pct,
  size = 132,
  stroke = 12,
  color = "var(--accent)",
  track = "var(--surface-3)",
  delay = 0,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  delay?: number;
  children?: React.ReactNode;
}) {
  const [on, setOn] = useState(false);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(1, pct / 100));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setOn(true);
      return;
    }
    const t = setTimeout(() => setOn(true), 150 + delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={on ? c * (1 - target) : c}
          style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

/** Horizontal animated bar (meters, goal progress). */
export function Bar({ pct, color = "var(--accent)", height = 8 }: { pct: number; color?: string; height?: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) return setOn(true);
    const t = setTimeout(() => setOn(true), 200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ background: "var(--surface-3)", borderRadius: 999, height, overflow: "hidden" }}>
      <div
        style={{
          width: on ? `${Math.max(2, Math.min(100, pct))}%` : "0%",
          height: "100%",
          background: color,
          borderRadius: 999,
          transition: "width 1.2s cubic-bezier(.22,1,.36,1)",
        }}
      />
    </div>
  );
}
