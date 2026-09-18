import type { Evidence } from '../services/api';

export function EvidenceList({ items }: { items: Evidence[] }) {
  return <ul className="evidence">{items.map(item => <li key={item.evidence_id}>
    <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
    <p>{item.source} · {item.date} · Geographic ID {item.geo_id}</p>
    {item.type === 'structured_data' && <p>{item.metric}: {item.value == null ? 'No data' : item.value.toLocaleString()} {item.unit}</p>}
    {item.excerpt && <blockquote>{item.excerpt}</blockquote>}
    {item.page && <p>Page {item.page}</p>}{item.section && <p>{item.section}</p>}
    <small>{item.evidence_id}</small>
  </li>)}</ul>;
}
