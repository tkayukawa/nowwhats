import type { SVGProps } from "react";

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const TasksIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.4 2.4 4.6-5" />
  </svg>
);

export const InsightsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M5 19V11M12 19V5M19 19v-6" />
  </svg>
);

export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </svg>
);

export const NoteIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M6 4h9l3 3v13H6zM9 10h6M9 14h6M9 18h4" />
  </svg>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
