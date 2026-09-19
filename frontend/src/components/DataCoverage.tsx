import type { Area } from '../services/api';

// Things no source in this project provides, so they are stated once rather than implied.
const NOT_IN_DATASET = ['Complete, verified competitor coverage', 'Rent and lease prices', 'Foot traffic', 'Business revenue'];

export function DataCoverage({ area }: { area: Area }) {
  const metrics = Object.entries(area.metrics);
  return <section className="insight-section data-coverage" aria-label="Data coverage">
    <div className="section-heading"><h3>What this data can’t tell you</h3><span>Coverage</span></div>
    <p className="body-muted">Values this dataset has for {area.name}:</p>
    <ul>{metrics.map(([key, value]) => <li key={key}>{key.replaceAll('_', ' ')}: {value == null ? 'No data' : value.toLocaleString()}</li>)}</ul>
    <p className="body-muted">Not in this dataset:</p>
    <ul>{NOT_IN_DATASET.map(item => <li key={item}>{item}</li>)}</ul>
    <p className="micro-note">Storefront locations come from OpenStreetMap and may be incomplete; they are not a verified business registry.</p>
    <p className="micro-note">Planning-document context is limited to the indexed passages and has its own geographic boundary.</p>
  </section>;
}
