import { useId } from 'react';
import type { Area } from '../services/api';

export function formatMetric(metric: string, value: number | null | undefined): string {
  if (value == null) return 'No data';
  if (metric.endsWith('_pct')) return `${value.toFixed(1)}%`;
  if (metric.includes('income')) return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  if (metric === 'avg_household_size') return value.toFixed(2);
  return value.toLocaleString();
}

/** Keep each displayed count attached to its own original record. */
export function MetricValue({ area, metric }: { area?: Area; metric: string }) {
  const id = useId();
  const value = area?.metrics[metric];
  const source = area?.evidence.find(item => item.type === 'structured_data' && item.metric === metric);
  const census = !!source?.title.startsWith('2020 Census');
  const citation = source
    ? census
      ? `${source.source} · ${source.date} · ${source.title} · ${area?.name}. Official 2020 count (POP100/HU100). This is a decennial count, not a sample estimate, so a survey sampling margin of error does not apply. Counts can still have coverage and other errors.`
      : `${source.source} · ${source.date} · ${source.title} · ${area?.name}. ACS 5-year estimate for the whole published unit, not a Fenton Village-only count. ${source.excerpt ?? ''}`.trim()
    : 'Source unavailable.';
  return <span className="metric-value">
    {source ? <a href={source.url} target="_blank" rel="noreferrer" aria-describedby={id} title={citation}>{formatMetric(metric, value)}<sup aria-label="Source citation">↗</sup></a> : <span>{formatMetric(metric, value)}</span>}
    <span className="metric-citation" id={id} role="tooltip">{citation}</span>
    <small className="metric-uncertainty">{census ? 'Official 2020 count' : source?.excerpt?.includes('low reliability') ? 'Low reliability (MOE > 30%)' : source ? 'ACS 5-year 2020–2024' : 'See source details'}</small>
  </span>;
}
