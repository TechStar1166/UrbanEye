import type { Area, OverlayResponse, Storefronts } from '../services/api';
import { STOREFRONT_STUDY_AREAS, summarize } from '../lib/storefronts';
import { inGeometry } from '../lib/geo';

export function StorefrontSummary({ area, data, overlays, failed, shown, onShow }: {
  area: Area; data?: Storefronts; overlays?: OverlayResponse; failed: boolean; shown: boolean; onShow: () => void;
}) {
  const head = <div className="section-heading"><h3>Mapped storefronts</h3><span>OpenStreetMap</span></div>;
  if (failed) return <section className="insight-section" aria-label="Storefronts">{head}<p className="body-muted">Storefront data could not be loaded.</p></section>;
  if (!data) return <section className="insight-section" aria-label="Storefronts">{head}<p className="body-muted" role="status">Loading storefronts…</p></section>;
  const covered = STOREFRONT_STUDY_AREAS.includes(area.geo_id);
  const { total, groups, top } = summarize(data.storefronts, area.geo_id);
  const inOverlay = overlays?.features.length ? data.storefronts.filter(item => overlays.features.some(feature => inGeometry(item.lon, item.lat, feature.geometry))).length : undefined;
  const max = Math.max(1, ...groups.map(group => group.count));
  return <section className="insight-section storefront-summary" aria-label="Storefronts">{head}
    <p className="storefront-total"><strong>{data.storefronts.length}</strong> named businesses in the Fenton study query box</p>
    {inOverlay != null && <p className="body-muted">{inOverlay} of these mapped businesses fall inside the Fenton Village zoning overlay.</p>}
    {covered ? <>
      <p className="body-muted">{total} mapped businesses in this block group · {data.storefronts.length} in the full query box.</p>
      <div className="store-bars">{groups.map(group => <div key={group.id}><span>{group.label}</span>
        <div className="bar-track"><i style={{ width: (group.count / max * 100) + '%', background: group.color }} /></div><b>{group.count}</b></div>)}</div>
      {top.length > 0 && <p className="body-muted">Most common in this block group: {top.map(([name, count]) => `${name} (${count})`).join(', ')}.</p>}
    </> : <p className="body-muted">{area.geography_type === 'block_group' ? 'This block group is outside the storefront snapshot’s full coverage; no block-group count is shown.' : 'The query box does not cover the whole Silver Spring Census area; no area-wide business total is shown.'}</p>}
    <button className="secondary full-width" disabled={shown} onClick={onShow}>{shown ? 'Shown on map' : 'Show on map'}</button>
    <p className="micro-note">Snapshot: {data.retrieved_at.slice(0, 10)}. The query box covers study block groups A and B plus about 200 m, not the zoning overlay alone. Counts come from named objects returned by the query, not the challenge brief.</p>
    <p className="micro-note">OpenStreetMap-mapped features, not all businesses: incomplete and possibly out of date. © OpenStreetMap contributors (ODbL).</p>
  </section>;
}
