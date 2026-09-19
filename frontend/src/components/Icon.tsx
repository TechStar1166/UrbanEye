type Name = 'search' | 'map' | 'table' | 'shield' | 'layers' | 'pin' | 'arrow' | 'overlap' | 'focus' | 'database' | 'download' | 'sparkles' | 'book' | 'external' | 'info' | 'store' | 'chart' | 'close' | 'check';
const paths: Record<Name, string> = {
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  map: 'm3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5M9 2v17M15 5v17',
  table: 'M3 3h18v18H3zM3 9h18M9 9v12M3 15h18',
  shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4m-5 10 3 3 7-7',
  layers: 'm12 2 10 6-10 6L2 8l10-6M2 12l10 6 10-6M2 16l10 6 10-6',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  overlap: 'M15 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0m8 0a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  focus: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  database: 'M21 5c0 2-4 3-9 3S3 7 3 5s4-3 9-3 9 1 9 3m0 0v14c0 2-4 3-9 3s-9-1-9-3V5m0 7c0 2 4 3 9 3s9-1 9-3',
  download: 'M12 3v12m-5-5 5 5 5-5M3 16v5h18v-5',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3M3 2v4M1 4h4m15 15v4m-2-2h4',
  book: 'M12 5c-3-3-7-3-10-2v16c4-1 7-1 10 2 3-3 6-3 10-2V3c-3-1-7-1-10 2v16',
  external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  info: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 11v6m0-10v.1',
  store: 'M3 10v11h18V10M2 10l2-7h16l2 7M2 10c0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 5 4 5 0M9 21v-7h6v7',
  chart: 'M3 3v18h18M7 16v-4m5 4V6m5 10V9',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm4 12 5 5L20 6',
};
export function Icon({ name }: { name: Name }) {
  return <svg className="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
