import type { Evidence } from '../services/api';

export function EvidenceList({ items }: { items: Evidence[] }) {
  return (
    <ul className="evidence">
      {items.map(item => (
        <li key={item.evidence_id} id={`evidence-${item.evidence_id}`}>
          <a href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
          <p className="evidence-meta">
            <span>{item.source}</span> · <time dateTime={item.date}>{item.date}</time> · <span>{item.document_scope?.name ?? `Geographic ID ${item.geo_id}`}</span>
          </p>
          {item.document_scope && <p className="evidence-note">{item.document_scope.note}</p>}
          {item.type === 'structured_data' && (
            <p className="evidence-metric">
              <strong>{item.metric ? item.metric.replace(/_/g, ' ') : 'Metric'}:</strong>{' '}
              {item.value == null ? 'No data' : `${item.value.toLocaleString()} ${item.unit ?? ''}`}
            </p>
          )}
          {item.excerpt && <blockquote>{item.excerpt}</blockquote>}
          {item.page && (
            <p className="evidence-page">
              {item.page_label ? `Printed page ${item.page_label} · PDF page ${item.page}` : `Page ${item.page}`}
            </p>
          )}
          {item.section && <p className="evidence-section">{item.section}</p>}
          <small>{item.evidence_id}</small>
        </li>
      ))}
    </ul>
  );
}

