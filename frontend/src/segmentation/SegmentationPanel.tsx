import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Areas, type Layer, type SegmentResponse } from '../services/api';
import { comparableUnit, highInBoth } from '../map/scale';

const MIN_AREAS = 3;

export function SegmentationPanel({ areas, onHighlight }: { areas: Areas; onHighlight: (ids: string[]) => void }) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [layersFailed, setLayersFailed] = useState(false);
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [result, setResult] = useState<SegmentResponse>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const version = useRef(0);

  useEffect(() => {
    api.layers().then(list => { setLayers(list); setX(list[0]?.id ?? ''); setY(list[1]?.id ?? ''); }).catch(() => setLayersFailed(true));
  }, []);

  const label = (id: string) => layers.find(layer => layer.id === id);
  const unit = useMemo(() => comparableUnit(areas.features, x, y), [areas, x, y]);
  const unitName = (unit.type ?? 'area').replaceAll('_', ' ');
  const blocked = !x || !y || x === y ? 'Choose two different layers.'
    : unit.features.length < MIN_AREAS ? `Correlation needs at least ${MIN_AREAS} areas of the same type (for example block groups) with values for both layers. The largest comparable group has ${unit.features.length}.` : '';

  const high = useMemo(() => highInBoth(areas.features, x, y), [areas, x, y]);
  const active = highlight && !blocked;
  useEffect(() => { onHighlight(active ? high.ids : []); return () => onHighlight([]); }, [active, high, onHighlight]);

  function choose(set: (id: string) => void, id: string) {
    version.current++; set(id); setResult(undefined); setError(''); setBusy(false);
  }

  async function compare(event: React.FormEvent) {
    event.preventDefault(); if (blocked) return;
    const current = ++version.current;
    setBusy(true); setError(''); setResult(undefined);
    try {
      const response = await api.segment(unit.features.map(f => f.properties.geo_id), x, y);
      if (current === version.current) setResult(response);
    } catch { if (current === version.current) setError('The comparison could not be completed. Please try again.'); }
    finally { if (current === version.current) setBusy(false); }
  }

  const format = (id: string, value: number | null) => value == null ? 'No data' : `${value.toLocaleString()} ${label(id)?.unit ?? ''}`.trim();
  const nameOf = (geoId: string) => areas.features.find(f => f.properties.geo_id === geoId)?.properties.name ?? geoId;

  if (layersFailed) return <section aria-label="Segmentation" className="segmentation"><p role="alert">Layer list could not be loaded, so layers cannot be compared.</p></section>;
  if (!layers.length) return <section aria-label="Segmentation" className="segmentation"><p role="status">Loading layers…</p></section>;

  return <section aria-label="Segmentation" className="segmentation">
    <h3>Compare two Census layers</h3>
    <form onSubmit={compare}>
      <label className="field-label" htmlFor="seg-first">First layer</label>
      <select id="seg-first" value={x} onChange={e => choose(setX, e.target.value)}>{layers.map(layer => <option key={layer.id} value={layer.id}>{layer.label}</option>)}</select>
      <label className="field-label" htmlFor="seg-second">Second layer</label>
      <select id="seg-second" value={y} onChange={e => choose(setY, e.target.value)}>{layers.map(layer => <option key={layer.id} value={layer.id}>{layer.label}</option>)}</select>
      <button className="primary full-width" disabled={busy || !!blocked}>{busy ? 'Comparing…' : 'Compare layers'}</button>
    </form>
    {blocked ? <p role="status" className="body-muted">{blocked}</p> : <p className="body-muted">Comparing {unit.features.length} {unitName}s.</p>}
    <label className="check"><input type="checkbox" checked={highlight} disabled={!!blocked} onChange={e => setHighlight(e.target.checked)} />
      Outline areas that are high in both layers on the map</label>
    {active && <p role="status" className="body-muted">{high.ids.length} of {high.compared} {unitName}s are at or above the 60th percentile in both layers
      (orange outline). This ranks the areas shown; it is not a statistical test.</p>}
    {error && <p role="alert">{error}</p>}
    {result && <div aria-live="polite">
      <p className="stat">Correlation: <strong>{result.correlation_coefficient == null ? 'Undefined' : result.correlation_coefficient.toFixed(2)}</strong>
        {' '}· {result.sample_size} areas compared</p>
      <p className="body-muted">{result.explanation}</p>
      <div className="table-scroll"><table><thead><tr><th>Area</th><th>{label(result.x_metric)?.label ?? result.x_metric}</th><th>{label(result.y_metric)?.label ?? result.y_metric}</th></tr></thead>
        <tbody>{result.data_points.map(point => <tr key={point.geo_id}>
          <td>{nameOf(point.geo_id)}</td><td>{format(result.x_metric, point.x_value)}</td><td>{format(result.y_metric, point.y_value)}</td></tr>)}</tbody></table></div>
    </div>}
  </section>;
}
