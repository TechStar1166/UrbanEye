import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type Answer, type Area, type Areas, type OverlayResponse, type Places, type Storefronts, type TransitResponse } from './services/api';
import { CommunityMap } from './map/CommunityMap';
import { EvidenceList } from './evidence/EvidenceList';
import { formatMetric, MetricValue } from './evidence/MetricValue';
import { colorScale, palettes } from './map/colors';
import { AnswerCard } from './components/AnswerCard';
import { SourcesPage } from './components/SourcesPage';
import { StorefrontSummary } from './components/StorefrontSummary';
import { ALL_GROUPS, GROUPS, groupOf, summarize, type GroupId } from './lib/storefronts';
import { DataCoverage } from './components/DataCoverage';
import { areasToCsv } from './lib/csv';
import { readView, writeView } from './lib/urlState';
import { SegmentationPanel } from './segmentation/SegmentationPanel';
import { Icon } from './components/Icon';

type Tab = 'Overview' | 'Compare areas' | 'Answer history' | 'Evidence';
type MobilePane = 'layers' | 'map' | 'insights';
const prompts = ['How many people live here?', 'How many homes are there?', 'What does the Silver Spring plan say about affordable housing?'];
const FENTON_STUDY: Record<string, string> = {
  '240317025011': 'Fenton study area A',
  '240317025021': 'Fenton study area B',
  '240317024022': 'Fenton Village overlay · west',
  '240317024023': 'Fenton Village overlay · central',
};
const areaName = (area?: Area) => !area ? 'Choose an area' : area.geography_type === 'census_designated_place' ? 'Silver Spring area' : FENTON_STUDY[area.geo_id] ?? area.name;
const planUrl = 'https://montgomeryplanning.org/wp-content/uploads/2022/11/Silver-Spring-DAC-Approved-Adopted-web.pdf#page=104';
const METRIC_OPTIONS = [
  { id: 'population', label: 'Population', note: 'The map shades each neighborhood by how many people live there.' },
  { id: 'housing_units', label: 'Homes', note: 'The map shades each neighborhood by how many homes it has.' },
  { id: 'median_household_income', label: 'Median household income', note: 'ACS 5-year 2020–2024 median household income for whole block groups.' },
  { id: 'age_50_plus_pct', label: 'Residents 50 and older', note: 'ACS 5-year 2020–2024 share of residents age 50 and over.' },
  { id: 'avg_household_size', label: 'Average household size', note: 'ACS 5-year 2020–2024 average household size.' },
  { id: 'renter_occupied_pct', label: 'Renter-occupied homes', note: 'ACS 5-year 2020–2024 share of occupied homes that are renter-occupied.' },
];
const METRIC_LABELS: Record<string, string> = Object.fromEntries(METRIC_OPTIONS.map(item => [item.id, item.label]));

function SectionHeading({ children, detail }: { children: ReactNode; detail?: string }) {
  return <div className="section-heading"><h3>{children}</h3>{detail && <span>{detail}</span>}</div>;
}
function MetricCard({ label, value, detail, note, tone = '' }: { label: string; value: ReactNode; detail: string; note?: string; tone?: string }) {
  return <div className={'metric-card ' + tone}><div className="metric-label">{label}{note && <span>{note}</span>}</div><strong>{value}</strong><small>{detail}</small></div>;
}

export default function App() {
  const [sourcesPage, setSourcesPage] = useState(location.hash === '#sources');
  const [places, setPlaces] = useState<Places>();
  const [placesError, setPlacesError] = useState(false);
  const [history, setHistory] = useState<{ area: Area; question: string; answer: Answer; regional: boolean }[]>([]);
  const [areas, setAreas] = useState<Areas>();
  const [selected, setSelected] = useState<Area>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('population');
  const [opacity, setOpacity] = useState(75);
  const [income, setIncome] = useState(75);
  const [cohort, setCohort] = useState('25');
  const [tab, setTab] = useState<Tab>(() => readView().tab ?? 'Overview');
  const [pane, setPane] = useState<MobilePane>('map');
  const [view, setView] = useState<'map' | 'data'>('map');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [answer, setAnswer] = useState<Answer>();
  const [answerRegional, setAnswerRegional] = useState(false);
  const [busy, setBusy] = useState(false);
  const [queryError, setQueryError] = useState('');
  const queryVersion = useRef(0);
  const [resetKey, setResetKey] = useState(0);
  const [storefronts, setStorefronts] = useState<Storefronts>();
  const [storefrontsFailed, setStorefrontsFailed] = useState(false);
  const [showStorefronts, setShowStorefronts] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showTransit, setShowTransit] = useState(false);
  const [overlays, setOverlays] = useState<OverlayResponse>();
  const [transit, setTransit] = useState<TransitResponse>();
  const [groups, setGroups] = useState<GroupId[]>(ALL_GROUPS);
  const [copied, setCopied] = useState('');
  const [segmentHighlights, setSegmentHighlights] = useState<string[]>([]);
  const [overlapOn, setOverlapOn] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const insightRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const data = await api.areas();
      setAreas(data);
      setSelected(current => data.features.find(f => f.id === (current?.geo_id ?? readView().area))?.properties ?? data.features[0]?.properties);
    } catch { setError('Unable to load the map. Check the backend connection and try again.'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    void load();
    api.storefronts().then(setStorefronts).catch(() => setStorefrontsFailed(true));
    api.places().then(setPlaces).catch(() => setPlacesError(true));
    api.overlays().then(setOverlays).catch(() => undefined);
    api.transit().then(setTransit).catch(() => undefined);
  }, []);
  useEffect(() => { const update = () => setSourcesPage(location.hash === '#sources'); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);


  useEffect(() => { if (selected && !sourcesPage && location.hash !== '#sources') writeView({ area: selected.geo_id, tab }); }, [selected?.geo_id, tab, sourcesPage]);

  const select = (id: string) => {
    queryVersion.current++;
    setAnswer(undefined); setBusy(false); setQueryError(''); setAnswerRegional(false); setQuestion('');
    setSelected(areas?.features.find(f => f.id === id)?.properties);
    setSearch(''); setSearchOpen(false); setSubmitted(''); setTab('Overview');
  };
  const openTab = (next: Tab) => { setTab(next); setPane('insights'); };
  const reset = () => { setShowStorefronts(false); setShowOverlay(false); setShowTransit(false); setGroups(ALL_GROUPS); setMetric('population'); setOpacity(75); setIncome(75); setCohort('25'); setOverlapOn(false); setBusinessOpen(false); setResetKey(k => k + 1); };
  const ask = async (text = question, regional = false) => {
    if (!text.trim() || !selected || busy) return;
    const version = ++queryVersion.current;
    setSubmitted(text.trim()); setQuestion(''); setAnswerRegional(regional); setPane('insights'); setView('map'); setTab('Overview');
    if (insightRef.current) insightRef.current.scrollTop = 0;
    setBusy(true); setAnswer(undefined); setQueryError('');
    try {
      const result = await api.ask(regional ? '2472450' : selected.geo_id, text.trim());
      if (version === queryVersion.current) { setAnswer(result); setQuestion(''); setHistory(previous => [{ area: selected, question: text.trim(), answer: result, regional }, ...previous].slice(0, 20)); }
    } catch {
      if (version === queryVersion.current) setQueryError('Unable to answer this question. Please try again.');
    } finally {
      if (version === queryVersion.current) setBusy(false);
    }
  };
  const evidence = useMemo(() => [...new Map([
    ...(selected?.evidence ?? []),
    ...history.filter(entry => entry.area.geo_id === selected?.geo_id).flatMap(entry => entry.answer.evidence),
    ...(answer?.evidence ?? []),
  ].map(item => [item.evidence_id, item])).values()], [selected, history, answer]);
  const evidenceCount = evidence.length + (evidence.some(item => item.type === 'document') ? 0 : 1);
  const suggestions = <div className="suggestions" aria-label="Suggested questions">{prompts.map((prompt, i) => <button key={prompt} disabled={!selected || busy || (i === 2 && !areas?.features.some(f => f.id === '2472450'))} onClick={() => void ask(prompt, i === 2)}>{prompt}<Icon name="arrow" /></button>)}</div>;
  const visibleStorefronts = useMemo(() => showStorefronts && storefronts ? storefronts.storefronts.filter(item => groups.includes(groupOf(item))) : [], [showStorefronts, storefronts, groups]);
  const toggleGroup = (id: GroupId) => setGroups(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const number = (key: string) => <MetricValue area={selected} metric={key} />;
  const scale = areas ? colorScale(areas, metric) : { min: 0, max: 0, n: 0 };
  const overlapIds = useMemo(() => {
    if (!areas) return [];
    const ageCut = Number(cohort);
    const incomeCut = income * 1000;
    return areas.features.filter(f => f.properties.geography_type === 'block_group'
      && (f.properties.metrics.age_50_plus_pct ?? -1) > ageCut
      && (f.properties.metrics.median_household_income ?? Number.POSITIVE_INFINITY) < incomeCut).map(f => f.id);
  }, [areas, cohort, income]);
  const highlightIds = overlapOn ? overlapIds : segmentHighlights;
  const searchResults = areas?.features.filter(f => (areaName(f.properties) + ' ' + f.properties.name + ' ' + f.id).toLowerCase().includes(search.toLowerCase())) ?? [];
  const metricKeys = areas?.features[0] ? Object.keys(areas.features[0].properties.metrics) : ['population', 'housing_units'];
  const legendNote = METRIC_OPTIONS.find(item => item.id === metric)?.note ?? 'The map shows area boundaries.';
  const exportData = () => {
    if (!selected) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'civiclens-' + selected.geo_id + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportCsv = () => {
    if (!areas) return;
    const url = URL.createObjectURL(new Blob([areasToCsv(areas)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'civiclens-areas.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied('Link copied'); }
    catch { setCopied('Copy failed; use the address bar'); }
    setTimeout(() => setCopied(''), 2500);
  };
  const openBusiness = () => {
    setBusinessOpen(true); setShowStorefronts(true); setTab('Overview'); setPane('insights');
    if (insightRef.current) insightRef.current.scrollTop = 0;
  };
  if (sourcesPage) return <SourcesPage />;
  const nearby = selected && storefronts ? summarize(storefronts.storefronts, selected.geo_id) : undefined;
  return <div className="civic-app">
    <header className="app-header">
      <a className="brand" href="/" aria-label="UrbanEye home"><svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="9" fill="#006948" /><path d="M24 36a12 12 0 1 1 12-12M32 32l7 7" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" /><circle cx="24" cy="24" r="5" fill="#85f8c4" /><path d="M16 24h4m4-8v4" stroke="white" strokeWidth="2" /></svg><span>UrbanEye</span></a>
      <div className="pilot"><i className="status-dot" /><span>Bay Hacks 2026</span></div>
      <div className="global-search"><Icon name="search" /><input ref={searchRef} aria-label="Search for a place" placeholder="Search for a place…" value={search} onChange={e => { setSearch(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onKeyDown={e => { if (e.key === 'Enter' && searchResults[0]) select(searchResults[0].id); }} onBlur={() => setTimeout(() => setSearchOpen(false), 150)} />
        {searchOpen && <div className="search-results"><span className="eyebrow">Places on this map</span>{searchResults.length ? searchResults.map(f => <button key={f.id} onClick={() => select(f.id)}><Icon name="pin" /><span>{areaName(f.properties)}</span><Icon name="arrow" /></button>) : <p>No matching place. Address search is coming next.</p>}</div>}
      </div>
      <div className="view-switch" aria-label="Workspace view"><button aria-pressed={view === 'map'} onClick={() => setView('map')}><Icon name="map" />Map View</button><button aria-pressed={view === 'data'} onClick={() => setView('data')}><Icon name="table" />Data</button></div>
      <button className="methodology-button" aria-label="Data Sources & Methodology" onClick={() => { location.hash = 'sources'; }}><Icon name="shield" /><span>Data Sources & Methodology</span></button>

    </header>

    <main className={'workspace pane-' + pane}>
      <aside className="layers-panel" aria-label="What’s on the map">
        <div className="panel-heading"><h2><Icon name="layers" />What's on the map</h2><button className="text-button" onClick={reset}>Reset</button></div>
        <div className="panel-scroll">
          <section className="control-section">
            <SectionHeading detail={metric.startsWith('median') || metric.endsWith('_pct') || metric === 'avg_household_size' ? 'ACS 2020–2024' : 'Census 2020'}>Map appearance</SectionHeading>
            <label className="field-label" htmlFor="color-by">Show on map</label>
            <select id="color-by" value={metric} onChange={e => setMetric(e.target.value)}>
              {METRIC_OPTIONS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              <option value="">Boundaries only</option>
            </select>
            <div className="range-line"><label htmlFor="opacity">Transparency</label><input id="opacity" type="range" min="0" max="100" value={100 - opacity} onChange={e => setOpacity(100 - Number(e.target.value))} /><output>{100 - opacity}%</output></div>
            <button className="secondary full-width" onClick={() => { setResetKey(k => k + 1); setPane('map'); setView('map'); }}>Zoom to Fenton Village</button>
            <p className="micro-note">{legendNote}</p>
          </section>
          <section className="control-section">
            <SectionHeading detail="OpenStreetMap">Local businesses</SectionHeading>
            <label className="layer-row"><input type="checkbox" checked={showStorefronts} onChange={e => setShowStorefronts(e.target.checked)} /><span>Storefront Locations</span><small>{storefronts?.storefronts.length ?? '…'} · OSM</small></label>
            {showStorefronts && storefronts && <div className="group-chips" role="group" aria-label="Storefront categories">{GROUPS.map(group =>
              <label key={group.id} className="group-chip"><input type="checkbox" checked={groups.includes(group.id)} onChange={() => toggleGroup(group.id)} />
                <i style={{ background: group.color }} />{group.label}<small>{storefronts.storefronts.filter(item => groupOf(item) === group.id).length}</small></label>)}</div>}
            <p className="micro-note">Named businesses near the Fenton study areas. This snapshot has a different date and boundary from the orange food &amp; drink dots.</p>
          </section>
          <section className="control-section">
            <SectionHeading detail="Boundaries">Zoning and transit</SectionHeading>
            <label className="layer-row"><input type="checkbox" checked={showOverlay} onChange={e => setShowOverlay(e.target.checked)} /><span>Fenton Village overlay</span><small>Zoning</small></label>
            <label className="layer-row"><input type="checkbox" checked={showTransit} onChange={e => setShowTransit(e.target.checked)} /><span>Purple Line alignment</span><small>OSM</small></label>
            <p className="micro-note">The overlay is a zoning boundary and carries no counts. The Purple Line is tagged under construction, not operating service.</p>
          </section>
          <section className="control-section overlap-section">
            <SectionHeading detail="ACS 2020–2024"><span className="inline-icon"><Icon name="overlap" />Compare two things</span></SectionHeading>
            <label className="field-label" htmlFor="cohort">Residents 50 and older</label><select id="cohort" value={cohort} onChange={e => { setCohort(e.target.value); setOverlapOn(false); }}><option value="25">Residents 50+ above 25%</option><option value="30">Residents 50+ above 30%</option><option value="35">Residents 50+ above 35%</option></select>
            <label className="field-label" htmlFor="economic">Household income</label><select id="economic" value={income} onChange={e => { setIncome(Number(e.target.value)); setOverlapOn(false); }}>{Array.from({ length: 24 }, (_, i) => 45 + i * 5).map(v => <option value={v} key={v}>Household income below ${v},000</option>)}</select>
            <div className="overlap-result"><div><strong>Compare neighborhoods</strong></div><p>{overlapIds.length} block groups have residents 50+ above {cohort}% and median household income below ${income},000. Values are ACS 5-year 2020–2024 for whole block groups, not the overlay.</p><small>This shows where two things appear together, not that one causes the other.</small></div>
            <button className="primary full-width" disabled={!overlapIds.length} onClick={() => { setOverlapOn(on => !on); setPane('map'); setView('map'); }}><Icon name="focus" />{overlapOn ? 'Hide overlap' : 'Show where these overlap'}<Icon name="arrow" /></button>
          </section>
        </div>
        <div className="place-summary"><i className="fb-dot" />{places ? `${places.count} food & drink places` : placesError ? 'Places could not load' : 'Loading places…'}<p>From OpenStreetMap, may not be complete.</p><p>Dashed blue outline: 600 m study area, not an official district boundary.</p><p>Census boundaries may differ from local neighborhood names.</p></div>
        <div className="sidebar-footer"><i className="status-dot" /><span>{areas ? 'Map ready' : 'Loading the map…'}</span><Icon name="database" /></div>
      </aside>

      <section className="map-workspace" aria-label="Map and layers">
        {view === 'map' ? <div className="map-viewport">
          {areas && <CommunityMap areas={areas} metric={metric} selectedId={selected?.geo_id} onSelect={select} opacity={opacity / 100} resetKey={resetKey} places={places} storefronts={visibleStorefronts} highlightIds={highlightIds} answerGeoId={answer?.mode === 'facts' && answer.evidence.length ? selected?.geo_id : undefined} overlays={overlays} transit={transit} showOverlay={showOverlay} showTransit={showTransit} />}
          {loading && <div className="map-state" role="status"><span className="loading-ring" />Loading community map…</div>}
          {error && <div className="map-state" role="alert"><Icon name="map" /><p>{error}</p><button className="primary" onClick={() => void load()}>Retry</button></div>}
          <div className="map-topbar"><div className="map-location"><Icon name="pin" /><span><small>Area you’re viewing</small><strong>{areaName(selected)}</strong></span></div><div className="map-actions"><button className="icon-button" aria-label="Copy link to this view" onClick={() => void copyLink()}><Icon name="external" /></button>{copied && <span role="status" className="micro-note">{copied}</span>}<button className="icon-button center-map" aria-label="Recenter map" onClick={() => setResetKey(k => k + 1)}><Icon name="focus" /></button></div></div>
          <div className="map-legend"><span className="eyebrow">{metric ? (METRIC_LABELS[metric] ?? metric) : 'Boundaries only'}</span>
            {metric && palettes[metric] && <><div className="choropleth-ramp">{palettes[metric].map(color => <i key={color} style={{ background: color }} />)}</div><div className="gradient-labels"><span>{formatMetric(metric, scale.min)}</span><span>{formatMetric(metric, scale.max)}</span></div><p>{scale.n >= 2 && scale.max > scale.min ? 'Darker = higher values within block groups. The larger Census place stays neutral.' : 'Color identifies the layer; not a comparative scale.'}</p></>}
            <div><i className="legend-swatch selected" /><span>Selected area</span></div>
            <div><i className="fb-dot" /><span>{places ? places.count : '…'} food &amp; drink places</span></div><p>From OpenStreetMap, may not be complete. Within the dashed 600 m study area.</p>
            {showOverlay && <div><i className="legend-swatch overlay" /><span>Fenton Village overlay</span></div>}
            {showTransit && <div><i className="legend-line" /><span>Purple Line (construction)</span></div>}
            {highlightIds.length > 0 && <div><i className="legend-swatch highlight" /><span>{overlapOn ? 'Age and income overlap' : 'High in both compared layers'}</span></div>}
            {visibleStorefronts.length > 0 && <><p>OpenStreetMap-mapped storefronts</p>{GROUPS.filter(group => groups.includes(group.id)).map(group => <div key={group.id}><i className="legend-dot" style={{ background: group.color }} /><span>{group.label}</span></div>)}</>}
            {answer?.mode === 'facts' && answer.evidence.length ? <div><i className="answer-swatch" /><span>Area in this answer</span></div> : null}
          </div>
        </div> : <div className="data-view"><div className="data-view-heading"><span className="eyebrow">Census 2020 and ACS 5-year · Source data</span><h2>Community data</h2><p>The same geographic areas and sourced values shown on your map.</p></div><div className="table-scroll"><table><thead><tr><th>Geography</th>{metricKeys.map(key => <th key={key}>{METRIC_LABELS[key] ?? key.replaceAll('_', ' ')}</th>)}</tr></thead><tbody>{areas?.features.map(f => <tr key={f.id} className={selected?.geo_id === f.id ? 'selected-row' : ''}><td><button onClick={() => select(f.id)}>{areaName(f.properties)}</button></td>{metricKeys.map(key => <td key={key}><MetricValue area={f.properties} metric={key} /></td>)}</tr>)}</tbody></table></div><button className="secondary" disabled={!selected} onClick={exportData}><Icon name="download" />Export selected area</button><button className="secondary" disabled={!areas} onClick={exportCsv}><Icon name="download" />Export all areas (CSV)</button></div>}
        {view === 'map' && <div className="query-dock">
          {!submitted && <><label className="query-heading" htmlFor="community-question">Ask about this community</label>{suggestions}</>}
          {submitted && <button className="text-button" onClick={() => openTab('Overview')}>{busy ? 'Finding your answer…' : 'View answer & sources'}<Icon name="arrow" /></button>}
          <form onSubmit={event => { event.preventDefault(); void ask(); }}><span className="query-symbol"><Icon name="sparkles" /></span><input id="community-question" ref={questionRef} aria-label="Ask about this area" disabled={busy} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask another question…" maxLength={1000} /><button className="primary" disabled={!question.trim() || !selected || busy} type="submit">{busy ? 'Answering…' : 'Ask'}<Icon name="arrow" /></button></form>
        </div>}

      </section>

      <aside className="insights-panel" aria-label="Area facts and evidence">
        <div className="insight-heading"><div><Icon name="pin" /><h2>{areaName(selected)}</h2><span className="tag">Selected</span></div><p>{selected?.geography_type === 'census_designated_place' ? 'Whole Silver Spring Census area · not Fenton Village alone' : 'Whole Census block group · not the Fenton district total'} · <button className="text-button" onClick={() => openTab('Evidence')}>See details</button></p></div>
        <div className="insight-tabs" role="tablist" aria-label="Community insights">{(['Overview', 'Compare areas', 'Answer history', 'Evidence'] as Tab[]).map(item => <button role="tab" aria-selected={tab === item} aria-controls="insight-content" id={'tab-' + item.replaceAll(' ', '-')} key={item} onClick={() => setTab(item)}>{item}{item === 'Answer history' && history.length > 0 && <span className="count-badge">{history.length}</span>}{item === 'Evidence' && <span className="count-badge">{evidenceCount}</span>}</button>)}</div>
        <div ref={insightRef} className="panel-scroll insight-content" id="insight-content" role="tabpanel" aria-labelledby={'tab-' + tab.replaceAll(' ', '-')}>
          {tab === 'Overview' && <>
            {submitted && <section className="insight-section answer-panel" aria-label="Current answer">
              <p className="user-question">{submitted}</p>
              {busy && <p role="status">Finding an answer…</p>}
              {queryError && <p role="alert">{queryError}<button className="secondary" onClick={() => void ask(submitted, answerRegional)}>Try again</button></p>}
              {answer && selected && <AnswerCard answer={answer} area={selected} regional={answerRegional} />}
              {!busy && <><h3 className="followup-heading">Keep exploring</h3>{suggestions}</>}
              {answer && <button className="secondary full-width answer-map-button" onClick={() => setPane('map')}>Back to the map<Icon name="map" /></button>}
            </section>}
            {businessOpen && selected && <section className="insight-section" aria-label="Business planning">
              <SectionHeading detail="Mapped businesses + ACS">Business site brief</SectionHeading>
              <p className="body-muted">This is community context for {areaName(selected)}, not a recommendation. Mapped storefronts are incomplete; rents, leases and foot traffic are not in this dataset.</p>
              <div className="metrics-grid">
                <MetricCard label="People" value={number('population')} detail="Census 2020 count" />
                <MetricCard label="Median income" value={number('median_household_income')} detail="ACS 5-year 2020–2024" tone="blue" />
                <MetricCard label="Renters" value={number('renter_occupied_pct')} detail="Of occupied homes" />
                <MetricCard label="Mapped storefronts" value={nearby?.total ?? 0} detail="OpenStreetMap-mapped in this area" tone="blue" />
              </div>
              {nearby && nearby.top.length > 0 && <p className="micro-note">Most common mapped categories: {nearby.top.map(([name, count]) => `${name} (${count})`).join(', ')}.</p>}
              <p className="micro-note">Whole published Census unit. Overlay proximity is not a count. Purple Line alignment is under construction.</p>
            </section>}
            <section className="insight-section"><SectionHeading detail="Census 2020">Census counts</SectionHeading><div className="metrics-grid"><MetricCard label="Population" value={number('population')} detail="Everyone in this area" note="Census" /><MetricCard label="Homes" value={number('housing_units')} detail="Occupied and vacant homes" tone="blue" /></div></section>
            <section className="insight-section"><SectionHeading detail="ACS 5-year 2020–2024">Community profile</SectionHeading>
              <div className="metrics-grid">
                <MetricCard label="Median household income" value={number('median_household_income')} detail="Whole published unit" note="ACS" />
                <MetricCard label="Age 50+" value={number('age_50_plus_pct')} detail="Share of residents" tone="blue" />
                <MetricCard label="Household size" value={number('avg_household_size')} detail="People per household" />
                <MetricCard label="Renter-occupied" value={number('renter_occupied_pct')} detail="Of occupied homes" tone="blue" />
              </div>
              <p className="micro-note">ACS 5-year estimates include a 90% margin of error. Consecutive 5-year vintages overlap and are not year-to-year change. These values describe the whole Census area, not the Fenton Village overlay.</p>
            </section>
            <section className="insight-section"><SectionHeading><span className="inline-icon blue"><Icon name="book" />Planning Context</span></SectionHeading><blockquote className="planning-excerpt">“This Plan aims to balance the preservation of existing naturally occurring affordable housing with the production of new housing…”<cite>— Silver Spring Downtown & Adjacent Communities Plan, 2022 · printed p. 92</cite><button className="text-button" onClick={() => openTab('Evidence')}>See the original <Icon name="arrow" /></button></blockquote><p className="micro-note">The plan covers a different area than the Census count.</p></section>
            <section className="insight-section"><SectionHeading>Where this comes from</SectionHeading><button className="source-card" onClick={() => openTab('Evidence')}><span><strong>U.S. Census Bureau</strong><small>People, homes and ACS estimates in this area.</small></span><span className="source-date">2020 / 2024</span></button><button className="source-card" onClick={() => openTab('Evidence')}><span><strong>Montgomery Planning</strong><small>Silver Spring Downtown & Adjacent Communities Plan.</small></span><span className="source-date blue">2022 PDF</span></button></section>
            {selected && <><StorefrontSummary area={selected} data={storefronts} failed={storefrontsFailed} shown={showStorefronts} onShow={() => setShowStorefronts(true)} /><DataCoverage area={selected} /></>}
          </>}
          {tab === 'Evidence' && <section className="insight-section evidence-tab"><SectionHeading detail="Original records">Evidence & Sources</SectionHeading><p className="body-muted">Sources for this area and its answers. Repeated citations are counted once.</p>{selected && <><details><summary>See details</summary><p>{selected.name} · {selected.geography_type.replaceAll('_', ' ')} · Geographic ID {selected.geo_id}</p><p>2020 Census TIGERweb: POP100 (people) and HU100 (housing units, occupied and vacant). These are decennial counts, not ACS sample estimates; a survey sampling margin of error does not apply. Counts can still have coverage and other errors. ACS 5-year 2020–2024 estimates include their published margins of error in each record.</p><p>Map colors compare block groups using equal intervals; the larger CDP is neutral. Counts are not densities. Loaded areas: {areas?.features.length}.</p></details><EvidenceList items={evidence} /></>}<article className="document-source"><Icon name="book" /><h3>Silver Spring Downtown & Adjacent Communities Plan</h3><span className="source-date">Approved & adopted · June 2022</span><p>Housing preservation · printed page 92 · PDF page 104.</p><p>The planning document has its own boundary. This is regional context, not a claim that it applies to every selected location. Recommendations do not establish current conditions.</p><a className="source-link" href={planUrl} target="_blank" rel="noreferrer">Open original document <Icon name="external" /></a></article><button className="secondary full-width" disabled={!selected} onClick={exportData}><Icon name="download" />Download area evidence</button></section>}
          {tab === 'Compare areas' && <section className="insight-section"><SectionHeading detail="Census 2020 and ACS">Compare two things</SectionHeading><p className="body-muted">Compare two sourced layers across whole Census areas of the same type. Association is not causation.</p><div className="info-note"><Icon name="info" /><span>This shows where two things appear together, not that one causes the other.</span></div>{areas && <SegmentationPanel areas={areas} onHighlight={setSegmentHighlights} />}</section>}
          {tab === 'Answer history' && <section className="insight-section"><SectionHeading>Answer history</SectionHeading><p className="body-muted">This session only · {history.length} answers</p>{!history.length && <p>Ask a question on the map to start your history.</p>}{history.map((entry, i) => <article className="history-entry" key={i}><h3>{entry.question}</h3><p>{areaName(entry.area)}</p><p>{entry.answer.summary}</p><button className="secondary" onClick={() => { queryVersion.current++; setBusy(false); setSelected(entry.area); setAnswer(entry.answer); setSubmitted(entry.question); setQuestion(''); setQueryError(''); setAnswerRegional(entry.regional); setTab('Overview'); setPane('insights'); if (insightRef.current) insightRef.current.scrollTop = 0; setView('map'); }}>Reopen answer &amp; sources</button></article>)}</section>}

          <footer className="application-footer"><div className="application-card"><div className="application-label"><span><Icon name="store" />Business planning tool</span></div><h3>Plan a local business</h3><p>See mapped storefronts next to income, tenure and population for the selected Census area.</p><button className="primary full-width" disabled={!selected} onClick={openBusiness}>Is this a good spot for a business?<Icon name="arrow" /></button></div></footer>
        </div>
      </aside>
    </main>
    <nav className="mobile-nav" aria-label="Workspace panels">{([['layers', 'layers', 'Layers'], ['map', 'map', 'Map'], ['insights', 'chart', 'Insights']] as const).map(([key, icon, label]) => <button key={key} aria-pressed={pane === key} onClick={() => setPane(key)}><Icon name={icon} />{label}</button>)}</nav>

  </div>;
}
