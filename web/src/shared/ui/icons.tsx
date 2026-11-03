type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export const CartIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H6.4" />
    <circle cx="9.5" cy="19" r="1.4" />
    <circle cx="17" cy="19" r="1.4" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const BagIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
);

export const EyeIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);

export const CartPlusIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H6.4" />
    <circle cx="9.5" cy="19" r="1.4" />
    <circle cx="17" cy="19" r="1.4" />
    <path d="M13 8.5v4M11 10.5h4" />
  </svg>
);

export const ArrowUpIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);

export const MenuIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M4 8h16M4 16h16" />
  </svg>
);

export const ChevronDownIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M7 10l5 5 5-5" />
  </svg>
);

export const ChevronLeftIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M14 6l-6 6 6 6" />
  </svg>
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M10 6l6 6-6 6" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const GridIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

export const ArrowRightIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const TruckIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M3 6.5h11v9H3zM14 9.5h3.8l3.2 3.4v2.6h-7" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </svg>
);

export const StoreIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M4 9.5V20h16V9.5M3 9.5l2-5h14l2 5c0 1.4-1.2 2.5-2.6 2.5S16 10.9 16 9.5c0 1.4-1.6 2.5-4 2.5s-4-1.1-4-2.5c0 1.4-1 2.5-2.4 2.5S3 10.9 3 9.5zM10 20v-5h4v5" />
  </svg>
);

export const WalletIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18M7 15h3" />
  </svg>
);

export const ShieldIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M12 3.5l7 2.5v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const PhoneIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />
  </svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const PinIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);

export const ClipboardIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <rect x="5" y="4.5" width="14" height="16" rx="1.5" />
    <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3" />
  </svg>
);

export const TagIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M3.5 12.5V4h8.5l8.5 8.5-8 8z" />
    <circle cx="8" cy="8.5" r="1.4" />
  </svg>
);

export const FileTextIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />
  </svg>
);

export const PlugIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M9 3v5M15 3v5M6.5 8h11v3a5.5 5.5 0 0 1-11 0zM12 16.5V21" />
  </svg>
);

export const UsersIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5M16 5.5a3 3 0 0 1 0 6M18 14.8c1.7.6 2.7 2.2 3 4.7" />
  </svg>
);

export const ListIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </svg>
);

export const ExternalIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
  </svg>
);

export const LogoutIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />
  </svg>
);

export const BellIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 0 0 4 0" />
  </svg>
);

export const DownloadIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
  </svg>
);

export const PrintIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M7 9V4h10v5M7 17H4v-7h16v7h-3M7 14h10v6H7z" />
  </svg>
);

export const TrendUpIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M4 17l6-6 4 4 6-7M15 8h5v5" />
  </svg>
);

export const UserIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </svg>
);

export const AlertIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M12 4l9 16H3l9-16zM12 10v4M12 17.2v.1" />
  </svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...base} aria-hidden="true" className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
