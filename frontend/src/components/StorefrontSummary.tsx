import type { Area, Storefronts } from '../services/api';
import { summarize } from '../lib/storefronts';

export function StorefrontSummary({ area, data, failed, shown, onShow }: {
  area: Area; data?: Storefronts; failed: boolean; shown: boolean; onShow: () => void;
}) {
  const head = <div className="section-heading"><h3>Storefronts in this area</h3><span>OpenStreetMap</span></div>;
  if (failed) return <section className="insight-section" aria-label="Storefronts">{head}<p className="body-muted">Storefront data could not be loaded.</p></section>;
  if (!data) return <section className="insight-section" aria-label="Storefronts">{head}<p className="body-muted" role="status">Loading storefronts…</p></section>;
  if (area.geography_type !== 'block_group') {
    return <section className="insight-section" aria-label="Storefronts">{head}
      <p className="body-muted">Storefront data covers the Fenton Village block groups. Select one to see its businesses.</p></section>;
  }
  if (!['240317025011', '240317025021'].includes(area.geo_id)) {
    return <section className="insight-section" aria-label="Storefronts">{head}<p className="body-muted">This block group is outside the storefront snapshot’s coverage. Counts are available for Fenton study areas A and B only.</p></section>;
  }
  const { total, groups, top } = summarize(data.storefronts, area.geo_id);
  const max = Math.max(1, ...groups.map(group => group.count));
  return <section className="insight-section storefront-summary" aria-label="Storefronts">{head}
    <p className="storefront-total"><strong>{total}</strong> mapped businesses in this block group</p>
    <div className="store-bars">{groups.map(group => <div key={group.id}><span>{group.label}</span>
      <div className="bar-track"><i style={{ width: (group.count / max * 100) + '%', background: group.color }} /></div><b>{group.count}</b></div>)}</div>
    {top.length > 0 && <p className="body-muted">Most common: {top.map(([name, count]) => `${name} (${count})`).join(', ')}</p>}
    <button className="secondary full-width" disabled={shown} onClick={onShow}>{shown ? 'Shown on map' : 'Show on map'}</button>
    <p className="micro-note">OpenStreetMap-mapped features, not all businesses: volunteer-mapped, so incomplete and possibly out of date.
      © OpenStreetMap contributors (ODbL). Snapshot: {data.retrieved_at.slice(0, 10)}.</p>
  </section>;
}
