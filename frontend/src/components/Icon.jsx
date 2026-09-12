const PATHS = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z',
  upload: 'M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  list: 'M4 6h16M4 12h16M4 18h10',
  check: 'M4.5 12.5 9 17l10.5-10.5',
  alert: 'M12 8v5m0 3.5v.5M10.3 3.9 2.6 17.2a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  flag: 'M5 21V4m0 0h12l-2.5 4L17 12H5',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5.5 10h13a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-8A1.5 1.5 0 0 1 5.5 10Z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  close: 'M6 6l12 12M18 6 6 18',
  search: 'M20 20l-3.5-3.5M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  file: 'M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z',
  copy: 'M9 9V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4M5 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z',
  bank: 'M3 10h18M5 10v8m5-8v8m4-8v8m5-8v8M3 21h18M12 3l9 5H3l9-5Z',
  scales: 'M12 4v16m-7-3h14M6 8l-3 6h6L6 8Zm12 0-3 6h6l-3-6ZM4 7h16',
  refresh: 'M3.5 12a8.5 8.5 0 0 1 14.6-6M20.5 12a8.5 8.5 0 0 1-14.6 6M18 3v4h-4M6 21v-4h4',
  back: 'M15 5l-7 7 7 7',
  sun: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m11.4 0 1.4 1.4M4.9 4.9l1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  download: 'M12 4v11m0 0 4-4m-4 4-4-4M5 19h14',
  caretUp: 'M7 14l5-5 5 5',
  caretDown: 'M7 10l5 5 5-5',
  sort: 'M8 9l4-4 4 4M8 15l4 4 4-4',
  dot: 'M12 12h.01',
  save: 'M5 4h10l4 4v12H5V4Zm3 0v6h7V4M8 20v-6h8v6',
  eye: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M3 13 6 5h12l3 8v6H3v-6Z',
  shield: 'M12 3 4.5 6v6c0 4.4 3.1 8.2 7.5 9 4.4-.8 7.5-4.6 7.5-9V6L12 3Z',
  plus: 'M12 5v14M5 12h14',
}

export default function Icon({ name, size = 16, strokeWidth = 1.8, className, ...rest }) {
  const d = PATHS[name] || PATHS.dot
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={d} />
    </svg>
  )
}
