import { useId } from 'react';
import type { Area } from '../services/api';

/** Keep each displayed count attached to its own original record. */
export function MetricValue({ area, metric }: { area?: Area; metric: string }) {
  const id = useId();
  const value = area?.metrics[metric];
  const source = area?.evidence.find(item => item.type === 'structured_data' && item.metric === metric);
  const citation = source ? `${source.source} · ${source.date} · ${source.title} · ${area?.name}. Official 2020 count (POP100/HU100). This is a decennial count, not a sample estimate, so a survey sampling margin of error does not apply. Counts can still have coverage and other errors.` : 'Source unavailable.';
  return <span className="metric-value">
    {source ? <a href={source.url} target="_blank" rel="noreferrer" aria-describedby={id} title={citation}>{value == null ? 'No data' : value.toLocaleString()}<sup aria-label="Source citation">↗</sup></a> : <span>{value == null ? 'No data' : value.toLocaleString()}</span>}
    <span className="metric-citation" id={id} role="tooltip">{citation}</span>
    <small className="metric-uncertainty">{source?.title.startsWith('2020 Census ') ? 'Official 2020 count' : 'See source details'}</small>
  </span>;
}
