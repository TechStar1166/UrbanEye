import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { api, type Answer, type Area, type Areas, type Businesses, type History,
  type HistoryPoint, type Overlays, type Transit } from './services/api';
import { CommunityMap } from './map/CommunityMap';
import { EvidenceList } from './evidence/EvidenceList';
import { Icon } from './components/Icon';

type Tab = 'Overview' | 'Segmentation' | 'Ask CivicLens' | 'Evidence';
type MobilePane = 'layers' | 'map' | 'insights';
const defaultLayers = { population: true, age: true, household: false, income: true, gini: false, housing: true, zoning: false, storefronts: false, transit: false };
type LayerKey = keyof typeof defaultLayers;
const prompts = ['What is the population?', 'How many housing units are there?', 'How does the plan preserve affordable housing?', 'What do planning documents say about housing in this area?'];
const planUrl = 'https://montgomeryplanning.org/wp-content/uploads/2022/11/Silver-Spring-DAC-Approved-Adopted-web.pdf#page=104';

const PROFILE_METRICS = ['median_household_income', 'gini_index', 'age_50_plus_pct',
  'avg_household_size', 'renter_occupied_pct'] as const;
type ProfileMetric = typeof PROFILE_METRICS[number];
type Profile = Partial<Record<ProfileMetric, History>>;

const latest = (series?: History): HistoryPoint | undefined => series?.series.at(-1);
const money = (value?: number | null) => value == null ? '—' : '$' + Math.round(value).toLocaleString();
const percent = (value?: number | null, digits = 1) => value == null ? '—' : value.toFixed(digits) + '%';
/** Margins of error are shown wherever an estimate is, so uncertainty is never hidden. */
const plusMinus = (point?: HistoryPoint, format: (v?: number | null) => string = money) =>
  point?.moe == null ? '' : ' ±' + format(point.moe).replace('$', '$');

function SectionHeading({ children, detail }: { children: ReactNode; detail?: string }) {
  return <div className="section-heading"><h3>{children}</h3>{detail && <span>{detail}</span>}</div>;
}
function Preview() { return <span className="preview-label">Preview</span>; }
function MetricCard({ label, value, detail, note, tone = '' }: { label: string; value: string; detail: string; note?: string; tone?: string }) {
  return <div className={'metric-card ' + tone}><div className="metric-label">{label}{note && <span>{note}</span>}</div><strong>{value}</strong><small>{detail}</small></div>;
}

export default function App() {
  const [areas, setAreas] = useState<Areas>();
  const [selected, setSelected] = useState<Area>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layers, setLayers] = useState(defaultLayers);
  const [metric, setMetric] = useState('population');
  const [opacity, setOpacity] = useState(75);
  const [income, setIncome] = useState(75);
  const [cohort, setCohort] = useState('25');
  const [tab, setTab] = useState<Tab>('Overview');
  const [pane, setPane] = useState<MobilePane>('map');
  const [view, setView] = useState<'map' | 'data'>('map');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [answer, setAnswer] = useState<Answer>();
  const [busy, setBusy] = useState(false);
  const [queryError, setQueryError] = useState('');
  const queryVersion = useRef(0);
  const [methodology, setMethodology] = useState(false);
  const [business, setBusiness] = useState(false);
  const [site, setSite] = useState('Bonifant Street');
  const [siteType, setSiteType] = useState('Café & bakery');
  const [siteSaved, setSiteSaved] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [profile, setProfile] = useState<Profile>({});
  const [overlays, setOverlays] = useState<Overlays>();
  const [transit, setTransit] = useState<Transit>();
  const [pois, setPois] = useState<Businesses>();
  const [areaBusinesses, setAreaBusinesses] = useState<Businesses>();
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLInputElement>(null);
  const dialogTrigger = useRef<HTMLElement | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await api.areas();
      setAreas(data);
      setSelected(current => data.features.find(f => f.id === current?.geo_id)?.properties ?? data.features[0]?.properties);
    } catch { setError('Unable to load the map. Check the backend connection and try again.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  // The extended profile comes from the community database rather than /areas, because
  // those series are per-year and have their own spans and margins of error.
  useEffect(() => {
    if (!selected) { setProfile({}); setAreaBusinesses(undefined); return; }
    let current = true;
    const geoId = selected.geo_id;
    void Promise.all(PROFILE_METRICS.map(async metric => {
      try { return [metric, await api.history(geoId, metric)] as const; }
      catch { return [metric, undefined] as const; }
    })).then(entries => {
      if (!current) return;
      setProfile(Object.fromEntries(entries.filter(([, value]) => value)) as Profile);
    });
    api.businesses(geoId).then(data => { if (current) setAreaBusinesses(data); }).catch(() => {});
    return () => { current = false; };
  }, [selected?.geo_id]);

  // Map overlays are fetched once the matching layer is switched on.
  useEffect(() => {
    if (layers.zoning && !overlays) api.overlays().then(setOverlays).catch(() => {});
    if (layers.transit && !transit) api.transit().then(setTransit).catch(() => {});
    if (layers.storefronts && !pois) api.pois().then(setPois).catch(() => {});
  }, [layers.zoning, layers.transit, layers.storefronts, overlays, transit, pois]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setMethodology(false); setBusiness(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!methodology && !business) return;
    dialogTrigger.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    return () => dialogTrigger.current?.focus();
  }, [methodology, business]);

  const toggleLayer = (key: LayerKey) => {
    setLayers(previous => ({ ...previous, [key]: !previous[key] }));
    if (key === 'population') setMetric(layers.population ? '' : 'population');
    if (key === 'housing') setMetric(layers.housing ? (layers.population ? 'population' : '') : 'housing_units');
  };
  const select = (id: string) => {
    queryVersion.current++;
    setAnswer(undefined); setBusy(false); setQueryError('');
    setSelected(areas?.features.find(f => f.id === id)?.properties);
    setSearch(''); setSearchOpen(false); setSubmitted(''); setTab('Overview');
  };
  const openTab = (next: Tab) => { setTab(next); setPane('insights'); };
  const reset = () => { setLayers(defaultLayers); setMetric('population'); setOpacity(75); setIncome(75); setCohort('25'); setResetKey(k => k + 1); };
  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim() || !selected || busy) return;
    const version = ++queryVersion.current;
    setSubmitted(question.trim()); openTab('Ask CivicLens');
    setBusy(true); setAnswer(undefined); setQueryError('');
    try {
      const result = await api.ask(selected.geo_id, question.trim());
      if (version === queryVersion.current) setAnswer(result);
    } catch {
      if (version === queryVersion.current) setQueryError('Unable to answer this question. Please try again.');
    } finally {
      if (version === queryVersion.current) setBusy(false);
    }
  };
  const number = (key: string) => selected?.metrics[key] == null ? '—' : selected.metrics[key]!.toLocaleString();
  const activeCount = Object.values(layers).filter(Boolean).length;
  const incomeSeries = profile.median_household_income;
  const incomePoint = latest(incomeSeries);
  const giniPoint = latest(profile.gini_index);
  const agePoint = latest(profile.age_50_plus_pct);
  const householdPoint = latest(profile.avg_household_size);
  const renterPoint = latest(profile.renter_occupied_pct);
  const renterPct = renterPoint?.estimate ?? null;
  const spanLabel = (series?: History) =>
    series ? `ACS ${series.span}-year · ${latest(series)?.period ?? ''}` : 'ACS';
  const searchResults = areas?.features.filter(f => (f.properties.name + ' ' + f.id).toLowerCase().includes(search.toLowerCase())) ?? [];
  const exportData = () => {
    if (!selected) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'civiclens-' + selected.geo_id + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const layerRow = (key: LayerKey, label: string, detail?: string, tone = '', preview = false) =>
    <label className={'layer-row ' + tone}><input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} /><span>{label}</span>{preview ? <Preview /> : detail && <small>{detail}</small>}</label>;

  return <div className="civic-app">
    <header className="app-header">
      <a className="brand" href="/" aria-label="CivicLens home"><svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="9" fill="#006948" /><path d="M24 36a12 12 0 1 1 12-12M32 32l7 7" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" /><circle cx="24" cy="24" r="5" fill="#85f8c4" /><path d="M16 24h4m4-8v4" stroke="white" strokeWidth="2" /></svg><span>CivicLens</span></a>
      <div className="pilot"><i className="status-dot" /><span>Silver Spring Pilot</span><b>Fenton Village Focus</b></div>
      <div className="global-search"><Icon name="search" /><input ref={searchRef} aria-label="Search addresses or areas" placeholder="Search areas, geographic IDs…" value={search} onChange={e => { setSearch(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={e => { if (e.key === 'Enter' && searchResults[0]) select(searchResults[0].id); }} onBlur={() => setTimeout(() => setSearchOpen(false), 150)} /><kbd>⌘ K</kbd>
        {searchOpen && <div className="search-results"><span className="eyebrow">Available geographies</span>{searchResults.length ? searchResults.map(f => <button key={f.id} onClick={() => select(f.id)}><Icon name="pin" /><span>{f.properties.name}<small>{f.id} · {f.properties.geography_type.replaceAll('_', ' ')}</small></span><Icon name="arrow" /></button>) : <p>No matching area in the current dataset.</p>}</div>}
      </div>
      <div className="view-switch" aria-label="Workspace view"><button aria-pressed={view === 'map'} onClick={() => setView('map')}><Icon name="map" />Map View</button><button aria-pressed={view === 'data'} onClick={() => setView('data')}><Icon name="table" />Data</button></div>
      <button className="methodology-button" aria-label="Data Sources & Methodology" onClick={() => setMethodology(true)}><Icon name="shield" /><span>Data Sources & Methodology</span></button>
      <button className="avatar" aria-label="Workspace information" onClick={() => setMethodology(true)}>SS</button>
    </header>

    <main className={'workspace pane-' + pane}>
      <aside className="layers-panel" aria-label="Geographic layers">
        <div className="panel-heading"><h2><Icon name="layers" />Geographic Layers</h2><button className="text-button" onClick={reset}>Reset</button><span className="active-count">{activeCount} Active</span></div>
        <div className="panel-scroll">
          <section className="control-section">
            <SectionHeading detail="Census 2020">Demographic Layers</SectionHeading>
            <div className="layer-box tinted">{layerRow('population', 'Total Population', 'Choropleth')}<div className="range-line"><label htmlFor="opacity">Opacity</label><input id="opacity" type="range" min="0" max="100" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /><output>{opacity}%</output></div></div>
            <div className="layer-box">{layerRow('age', 'Age 50+ Population Cohort', percent(agePoint?.estimate))}<div className="age-gradient" /><div className="gradient-labels"><span>&lt;15%</span><span>20%</span><span>25%</span><span>&gt;35%</span></div></div>
            {layerRow('household', 'Average Household Size', householdPoint?.estimate == null ? '—' : householdPoint.estimate.toFixed(2))}
          </section>
          <section className="control-section">
            <SectionHeading detail={spanLabel(incomeSeries)}>Economic Indicators</SectionHeading>
            <div className="layer-box tinted">{layerRow('income', 'Median Household Income', money(incomePoint?.estimate))}<div className="income-labels"><span>$45,000</span><output>Below ${income}k</output><span>$160,000+</span></div><input aria-label="Income threshold" className="full-range" type="range" min="45" max="160" step="5" value={income} onChange={e => setIncome(Number(e.target.value))} /></div>
            {layerRow('gini', 'Income Disparity Gini Index', giniPoint?.estimate == null ? 'Place level only' : giniPoint.estimate.toFixed(4))}
          </section>
          <section className="control-section">
            <SectionHeading detail="Layer catalog">Housing & Commercial</SectionHeading>
            {layerRow('housing', 'Housing Units', 'Census 2020', 'blue')}
            {layerRow('zoning', 'Fenton Overlay Zoning', 'Zoning boundary', 'amber')}
            {layerRow('storefronts', 'Storefront Locations', pois ? pois.total + ' OSM points' : 'OpenStreetMap')}
            {layerRow('transit', 'Purple Line Alignment', 'Under construction', 'blue')}
            <p className="micro-note">The zoning boundary and rail alignment carry no statistics. Storefronts are © OpenStreetMap contributors (ODbL) and record mapped businesses, not a complete census.</p>
          </section>
          <section className="control-section overlap-section">
            <SectionHeading detail="2-Var Tool"><span className="inline-icon"><Icon name="overlap" />Community Overlap</span></SectionHeading>
            <label className="field-label" htmlFor="cohort">Variable A (Cohort)</label><select id="cohort" value={cohort} onChange={e => setCohort(e.target.value)}><option value="25">Age 50+ Cohort &gt; 25%</option><option value="30">Age 50+ Cohort &gt; 30%</option><option value="35">Age 50+ Cohort &gt; 35%</option></select>
            <label className="field-label" htmlFor="economic">Variable B (Economic)</label><select id="economic" value={income} onChange={e => setIncome(Number(e.target.value))}>{Array.from({ length: 24 }, (_, i) => 45 + i * 5).map(v => <option value={v} key={v}>Median HH Income &lt; ${v},000</option>)}</select>
            <div className="overlap-result"><div><strong>Explore overlapping communities</strong><Preview /></div><p>Compare age and income across the selected geography.</p><small>Association does not establish causation.</small></div>
            <button className="primary full-width" onClick={() => openTab('Segmentation')}><Icon name="focus" />Explore Co-occurrence<Icon name="arrow" /></button>
          </section>
        </div>
        <div className="sidebar-footer"><i className="status-dot" /><span>{areas ? areas.features.length + ' geographic area' + (areas.features.length === 1 ? '' : 's') + ' loaded' : 'Connecting to map data'}</span><Icon name="database" /></div>
      </aside>

      <section className="map-workspace" aria-label="Map and layers">
        {view === 'map' ? <>
          {areas && <CommunityMap areas={areas} metric={metric} selectedId={selected?.geo_id} onSelect={select} opacity={opacity / 100} resetKey={resetKey}
            overlays={layers.zoning ? overlays : undefined} transit={layers.transit ? transit : undefined} pois={layers.storefronts ? pois : undefined} />}
          {loading && <div className="map-state" role="status"><span className="loading-ring" />Loading community map…</div>}
          {error && <div className="map-state" role="alert"><Icon name="map" /><p>{error}</p><button className="primary" onClick={() => void load()}>Retry</button></div>}
          <div className="map-topbar"><div className="map-location"><Icon name="pin" /><span><small>GEOGRAPHIC FOCUS</small><strong>{selected?.name ?? 'Select an area'}</strong></span></div><button className="icon-button center-map" aria-label="Recenter map" onClick={() => setResetKey(k => k + 1)}><Icon name="focus" /></button></div>
          {selected && <div className="map-selection-card"><div className="selection-title"><i className="status-dot" /><strong>{selected.name}</strong><span className="tag">Selected</span></div><div className="selection-metrics"><div><span>POPULATION</span><strong>{number('population')}</strong></div><div><span>HOUSING UNITS</span><strong>{number('housing_units')}</strong></div></div><div className="selection-footer"><span>2020 Census · {selected.geo_id}</span><button onClick={() => openTab('Evidence')}>View sources <Icon name="arrow" /></button></div></div>}
          <div className="map-legend"><span className="eyebrow">Map Legend</span><div><i className={'legend-swatch ' + (metric === 'housing_units' ? 'purple' : '')} /><span>{metric === 'population' ? 'Population' : metric === 'housing_units' ? 'Housing units' : 'Geographic boundaries'}</span></div><div><i className="legend-swatch selected" /><span>Selected geography</span></div><p>Color identifies the layer; not a comparative scale.</p></div>
        </> : <div className="data-view"><div className="data-view-heading"><span className="eyebrow">Census 2020 · Source data</span><h2>Community data</h2><p>The same geographic areas and sourced values shown on your map.</p></div><div className="table-scroll"><table><thead><tr><th>Geography</th><th>Population</th><th>Housing units</th></tr></thead><tbody>{areas?.features.map(f => <tr key={f.id} className={selected?.geo_id === f.id ? 'selected-row' : ''}><td><button onClick={() => select(f.id)}>{f.properties.name}<small>{f.id}</small></button></td><td>{f.properties.metrics.population?.toLocaleString() ?? 'No data'}</td><td>{f.properties.metrics.housing_units?.toLocaleString() ?? 'No data'}</td></tr>)}</tbody></table></div><button className="secondary" disabled={!selected} onClick={exportData}><Icon name="download" />Export selected area</button></div>}
        <div className="query-dock"><form onSubmit={ask}><span className="query-symbol"><Icon name="sparkles" /></span><input ref={questionRef} aria-label="Ask about this area" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about planning, housing, or community data…" maxLength={1000} /><button className="primary" disabled={!question.trim() || !selected || busy} type="submit">{busy ? 'Answering…' : 'Query Records'}<Icon name="arrow" /></button></form><div className="suggestions"><span>Suggested:</span>{prompts.map(prompt => <button key={prompt} onClick={() => { setQuestion(prompt); questionRef.current?.focus(); }}>{prompt}</button>)}</div><span className="query-preview">Evidence-backed research · selected geographic area</span></div>
      </section>

      <aside className="insights-panel" aria-label="Area facts and evidence">
        <div className="insight-heading"><div><Icon name="pin" /><h2>{selected?.name ?? 'Community Overview'}</h2><span className="tag">Selected Unit</span></div><p>{selected ? selected.geography_type.replaceAll('_', ' ') + ' · ' + selected.geo_id : 'Select an area from the map'} · Maryland</p></div>
        <div className="insight-tabs" role="tablist" aria-label="Community insights">{(['Overview', 'Segmentation', 'Ask CivicLens', 'Evidence'] as Tab[]).map(item => <button role="tab" aria-selected={tab === item} aria-controls="insight-content" id={'tab-' + item.replaceAll(' ', '-')} key={item} onClick={() => setTab(item)}>{item}{item === 'Evidence' && <span className="count-badge">{(selected?.evidence.length ?? 0) + 1}</span>}</button>)}</div>
        <div className="panel-scroll insight-content" id="insight-content" role="tabpanel" aria-labelledby={'tab-' + tab.replaceAll(' ', '-')}>
          {tab === 'Overview' && <>
            <section className="insight-section"><SectionHeading detail="Census 2020">Ground-Truth Core Metrics</SectionHeading><div className="metrics-grid"><MetricCard label="POPULATION" value={number('population')} detail="Whole selected geography" note="Census" /><MetricCard label="HOUSING UNITS" value={number('housing_units')} detail="Sourced Census count" tone="blue" /></div>
              <div className="sample-heading"><span>Extended community profile</span><span className="source-date">{spanLabel(incomeSeries)}</span></div>
              <div className="metrics-grid">
                <MetricCard label="MEDIAN HH INCOME" value={money(incomePoint?.estimate)} detail={incomePoint?.moe == null ? 'American Community Survey' : `±${money(incomePoint.moe)} at 90% confidence`} tone="green" note={incomePoint?.low_reliability ? 'Low precision' : undefined} />
                <MetricCard label="AGE 50+ SHARE" value={percent(agePoint?.estimate)} detail={agePoint?.moe == null ? 'American Community Survey' : `±${percent(agePoint.moe)} at 90% confidence`} tone="amber" note={agePoint?.low_reliability ? 'Low precision' : undefined} />
              </div>
              <div className="metrics-grid">
                <MetricCard label="AVG HOUSEHOLD SIZE" value={householdPoint?.estimate == null ? '—' : householdPoint.estimate.toFixed(2)} detail="People per occupied unit" />
                <MetricCard label="GINI INDEX" value={giniPoint?.estimate == null ? 'Not published' : giniPoint.estimate.toFixed(4)} detail={giniPoint?.estimate == null ? 'Not available below place level' : 'Income inequality, 0 to 1'} tone="blue" />
              </div></section>
            {renterPct != null && <section className="insight-section"><SectionHeading detail={spanLabel(profile.renter_occupied_pct)}>Housing Tenure Structure</SectionHeading><div className="tenure-bar" aria-label={`Housing tenure: ${renterPct.toFixed(1)} percent renter, ${(100 - renterPct).toFixed(1)} percent owner`}><span style={{ flex: renterPct }} /><span style={{ flex: 100 - renterPct }} /></div><div className="chart-legend"><span><i className="blue-dot" />Renter Occupied: <b>{percent(renterPct)}</b></span><span><i className="green-dot" />Owner: <b>{percent(100 - renterPct)}</b></span></div>{renterPoint?.moe != null && <p className="micro-note">±{percent(renterPoint.moe)} at 90% confidence.</p>}</section>}
            {incomeSeries && incomeSeries.series.length > 1 && (() => {
              const points = incomeSeries.series;
              const peak = Math.max(...points.map(p => p.estimate_2024_usd ?? p.estimate ?? 0));
              return <section className="insight-section"><SectionHeading detail={`ACS ${incomeSeries.span}-year`}>Median Household Income Trend</SectionHeading>
                <div className="age-chart">{points.map(point => {
                  const value = point.estimate_2024_usd ?? point.estimate;
                  return <div key={point.year} className={point.low_reliability ? 'amber' : ''}><span>{point.year}</span><div className="bar-track"><i style={{ width: (peak ? (value ?? 0) / peak * 100 : 0) + '%' }} /></div><b>{money(value)}</b></div>;
                })}</div>
                <p className="micro-note">Shown in 2024 dollars so years are comparable. {incomeSeries.limitations[0]}</p>
              </section>;
            })()}
            {areaBusinesses && areaBusinesses.total > 0 && <section className="insight-section"><SectionHeading detail="OpenStreetMap">Mapped Storefronts</SectionHeading><div className="chart-legend">{Object.entries(areaBusinesses.by_category).map(([category, count]) => <span key={category}>{category}: <b>{count}</b></span>)}</div><p className="micro-note">{areaBusinesses.total} mapped businesses in this whole block group. {areaBusinesses.attribution} ({areaBusinesses.license}). Crowd-sourced, not a complete business census.</p></section>}
            <section className="insight-section"><SectionHeading><span className="inline-icon blue"><Icon name="book" />Planning Context</span></SectionHeading><blockquote className="planning-excerpt">“This Plan aims to balance the preservation of existing naturally occurring affordable housing with the production of new housing…”<cite>— Silver Spring Downtown & Adjacent Communities Plan, 2022 · printed p. 92</cite><button className="text-button" onClick={() => openTab('Evidence')}>Inspect source <Icon name="arrow" /></button></blockquote><p className="micro-note">Planning-area context; the plan boundary is not the Silver Spring CDP boundary.</p></section>
            <section className="insight-section"><SectionHeading detail="Source-linked">Data Provenance</SectionHeading><button className="source-card" onClick={() => openTab('Evidence')}><span><strong>U.S. Census Bureau</strong><small>Population and housing units for the selected geography.</small></span><span className="source-date">2020</span></button><button className="source-card" onClick={() => openTab('Evidence')}><span><strong>Montgomery Planning</strong><small>Silver Spring Downtown & Adjacent Communities Plan.</small></span><span className="source-date blue">2022 PDF</span></button></section>
          </>}
          {tab === 'Evidence' && <section className="insight-section evidence-tab"><SectionHeading detail="Original records">Evidence & Sources</SectionHeading><p className="body-muted">Inspect the source behind each map metric.</p>{selected && <EvidenceList items={selected.evidence} />}<article className="document-source"><Icon name="book" /><h3>Silver Spring Downtown & Adjacent Communities Plan</h3><span className="source-date">Approved & adopted · June 2022</span><p>Housing preservation · printed page 92 · PDF page 104.</p><p>The planning document has its own boundary. This is regional context, not a claim that it applies to every selected location. Recommendations do not establish current conditions.</p><a className="source-link" href={planUrl} target="_blank" rel="noreferrer">Open original document <Icon name="external" /></a></article><button className="secondary full-width" disabled={!selected} onClick={exportData}><Icon name="download" />Download area evidence</button></section>}
          {tab === 'Segmentation' && <section className="insight-section"><SectionHeading detail="Preview">Community Overlap</SectionHeading><div className="tab-hero"><Icon name="overlap" /><h3>Find the common ground.</h3><p>Explore how demographic and economic characteristics overlap across communities.</p></div><div className="criteria-card"><span>COHORT</span><strong>Age 50+ share above {cohort}%</strong><span>ECONOMIC</span><strong>Household income below ${income},000</strong></div><p className="body-muted">Your comparison is ready. Matched areas and correlation results will appear here when these datasets are connected.</p><div className="info-note"><Icon name="info" /><span>Whole Census areas are the unit of comparison. Association does not establish causation.</span></div></section>}
          {tab === 'Ask CivicLens' && <section className="insight-section"><SectionHeading detail="Source-linked">Community Research</SectionHeading><div className="tab-hero"><Icon name="sparkles" /><h3>Ask your community.</h3><p>Planning documents and public data, in one conversation.</p></div>
            {submitted && <div className="user-question">{submitted}</div>}
            {busy && <p role="status">Retrieving grounded evidence…</p>}
            {queryError && <p role="alert">{queryError}</p>}
            {answer && <section className="research-response" aria-label="Answer" aria-live="polite">
              <h3>{answer.mode === 'llm' ? 'AI explanation' : answer.mode === 'facts' ? 'Cited data answer' : answer.mode === 'retrieval' ? 'Retrieved passages' : 'Available evidence'}</h3>
              {answer.mode === 'llm' && answer.claims?.length ? answer.claims.map((claim, i) => <div key={i}><p>{claim.text}</p><small>Sources: {claim.evidence_ids.map((id, j) => <span key={id}>{j > 0 && ', '}<a href={`#evidence-${id}`}>{answer.evidence_ids.indexOf(id) + 1}</a></span>)}</small></div>) : <p className="answer">{answer.summary}</p>}
              <EvidenceList items={answer.evidence} />
              {answer.limitations?.length > 0 && <ul className="limitations">{answer.limitations.map(item => <li key={item}>{item}</li>)}</ul>}
            </section>}
            {!submitted && <p className="body-muted">Choose a starting point, then submit your question below the map.</p>}
            {prompts.map(prompt => <button className="prompt-card" key={prompt} onClick={() => { setQuestion(prompt); questionRef.current?.focus(); }}>{prompt}<Icon name="arrow" /></button>)}
          </section>}
        </div>
        <footer className="application-footer"><div className="application-card"><div className="application-label"><span><Icon name="store" />Extensible Application</span><Preview /></div><h3>Launch Business Planning Module</h3><p>Explore commercial site viability with community context and neighborhood evidence.</p><button className="primary full-width" onClick={() => { setBusiness(true); setSiteSaved(false); }}>Evaluate Site Viability<Icon name="arrow" /></button></div></footer>
      </aside>
    </main>
    <nav className="mobile-nav" aria-label="Workspace panels">{([['layers','layers','Layers'],['map','map','Map'],['insights','chart','Insights']] as const).map(([key,icon,label]) => <button key={key} aria-pressed={pane === key} onClick={() => setPane(key)}><Icon name={icon} />{label}</button>)}</nav>
    {(methodology || business) && <div className="modal-backdrop" onClick={() => { setMethodology(false); setBusiness(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const nodes = e.currentTarget.querySelectorAll<HTMLElement>('button, input, select, a[href]');
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }}><button ref={closeRef} className="icon-button modal-close" aria-label="Close dialog" onClick={() => { setMethodology(false); setBusiness(false); }}><Icon name="close" /></button><span className="eyebrow">CivicLens · Silver Spring Pilot</span><h2 id="modal-title">{methodology ? 'Sources you can inspect.' : 'Explore your next location.'}</h2>{methodology ? <><p>The map uses the existing geographic dataset and interactive Leaflet engine. Population and housing counts come from the 2020 Census; evidence is available for every selected area.</p><div className="info-note"><Icon name="info" /><span>Income, age, household size and tenure are American Community Survey estimates shown with their 90% margins of error. Dollar trends are expressed in 2024 dollars. The Gini index and poverty rate are published for places and larger only, never for block groups. Storefronts and the Purple Line alignment come from OpenStreetMap (ODbL); the alignment is under construction and is not operating service. Site analysis is not yet connected.</span></div><p>Silver Spring CDP totals do not describe Fenton Village alone. Planning documents also have their own geographic boundaries and dates.</p><button className="primary" onClick={() => { setMethodology(false); openTab('Evidence'); }}>Inspect evidence<Icon name="arrow" /></button></> : <><p>Build a site brief using the community you’re exploring.</p><label className="field-label" htmlFor="site">Street or location</label><input id="site" value={site} onChange={e => { setSite(e.target.value); setSiteSaved(false); }} /><label className="field-label" htmlFor="site-type">Business type</label><select id="site-type" value={siteType} onChange={e => { setSiteType(e.target.value); setSiteSaved(false); }}><option>Café & bakery</option><option>Neighborhood retail</option><option>Professional services</option></select><button className="primary full-width" disabled={!site.trim()} onClick={() => setSiteSaved(true)}>Prepare site brief<Icon name="arrow" /></button>{siteSaved && <div className="info-note" role="status"><Icon name="check" /><span>Brief prepared for {siteType.toLowerCase()} on {site}. This preview stays in your current session; viability analysis will be available after data integration.</span></div>}</>}</section></div>}
  </div>;
}
