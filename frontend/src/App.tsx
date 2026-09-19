import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type Answer, type Area, type Areas, type Places, type Storefronts } from './services/api';
import { CommunityMap } from './map/CommunityMap';
import { EvidenceList } from './evidence/EvidenceList';
import { MetricValue } from './evidence/MetricValue';
import { colorScale, palettes } from './map/colors';
import { SourcesPage } from './components/SourcesPage';
import { StorefrontSummary } from './components/StorefrontSummary';
import { ALL_GROUPS, GROUPS, groupOf, type GroupId } from './lib/storefronts';
import { DataCoverage } from './components/DataCoverage';
import { areasToCsv } from './lib/csv';
import { readView, writeView } from './lib/urlState';
import { SegmentationPanel } from './segmentation/SegmentationPanel';
import { Icon } from './components/Icon';

type Tab = 'Overview' | 'Who lives here' | 'Answer history' | 'Evidence';
type MobilePane = 'layers' | 'map' | 'insights';
const prompts = ['How many people live here?', 'How many homes are there?', 'What does the plan say about affordable housing?'];
const areaName = (area?: Area) => !area ? 'Choose an area' : area.geography_type === 'census_designated_place' ? 'Silver Spring area' : area.geo_id === '240317025011' ? 'Fenton study area A' : area.geo_id === '240317025021' ? 'Fenton study area B' : area.name;
const planUrl = 'https://montgomeryplanning.org/wp-content/uploads/2022/11/Silver-Spring-DAC-Approved-Adopted-web.pdf#page=104';

function SectionHeading({ children, detail }: { children: ReactNode; detail?: string }) {
  return <div className="section-heading"><h3>{children}</h3>{detail && <span>{detail}</span>}</div>;
}
function Preview() { return <span className="preview-label">Coming next</span>; }
function MetricCard({ label, value, detail, note, tone = '' }: { label: string; value: ReactNode; detail: string; note?: string; tone?: string }) {
  return <div className={'metric-card ' + tone}><div className="metric-label">{label}{note && <span>{note}</span>}</div><strong>{value}</strong><small>{detail}</small></div>;
}

export default function App() {
  const [sourcesPage, setSourcesPage] = useState(location.hash === '#sources');
  const [places, setPlaces] = useState<Places>();
  const [placesError, setPlacesError] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [history, setHistory] = useState<{ area: Area; question: string; answer: Answer }[]>([]);
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
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [busy, setBusy] = useState(false);
  const [queryError, setQueryError] = useState('');
  const queryVersion = useRef(0);
  const [resetKey, setResetKey] = useState(0);
  const [storefronts, setStorefronts] = useState<Storefronts>();
  const [storefrontsFailed, setStorefrontsFailed] = useState(false);
  const [showStorefronts, setShowStorefronts] = useState(false);
  const [groups, setGroups] = useState<GroupId[]>(ALL_GROUPS);
  const [copied, setCopied] = useState('');
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
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
  useEffect(() => { void load(); api.storefronts().then(setStorefronts).catch(() => setStorefrontsFailed(true)); api.places().then(setPlaces).catch(() => setPlacesError(true)); }, []);
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
    setAnswer(undefined); setBusy(false); setQueryError(''); setShowSuggestions(true); setCollapsed(false);
    setSelected(areas?.features.find(f => f.id === id)?.properties);
    setSearch(''); setSearchOpen(false); setSubmitted(''); setTab('Overview');
  };
  const openTab = (next: Tab) => { setTab(next); setPane('insights'); };
  const reset = () => { setShowStorefronts(false); setGroups(ALL_GROUPS); setMetric('population'); setOpacity(75); setIncome(75); setCohort('25'); setResetKey(k => k + 1); };
  const ask = async (text = question) => {
    if (!text.trim() || !selected || busy) return;
    const version = ++queryVersion.current;
    setCollapsed(false); setQuestion(text); setSubmitted(text.trim()); setShowSuggestions(false); setPane('map'); setView('map');
    setBusy(true); setAnswer(undefined); setQueryError('');
    try {
      const result = await api.ask(selected.geo_id, text.trim());
      if (version === queryVersion.current) { setAnswer(result); setHistory(previous => [{ area: selected, question: text.trim(), answer: result }, ...previous].slice(0, 20)); }
    } catch {
      if (version === queryVersion.current) setQueryError('Unable to answer this question. Please try again.');
    } finally {
      if (version === queryVersion.current) setBusy(false);
    }
  };
  const visibleStorefronts = useMemo(() => showStorefronts && storefronts ? storefronts.storefronts.filter(item => groups.includes(groupOf(item))) : [], [showStorefronts, storefronts, groups]);
  const toggleGroup = (id: GroupId) => setGroups(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const number = (key: string) => <MetricValue area={selected} metric={key} />;
  const scale = areas ? colorScale(areas, metric) : { min: 0, max: 0, n: 0 };
  const searchResults = areas?.features.filter(f => (areaName(f.properties) + ' ' + f.properties.name + ' ' + f.id).toLowerCase().includes(search.toLowerCase())) ?? [];
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
  if (sourcesPage) return <SourcesPage />;
  return <div className="civic-app">
    <header className="app-header">
      <a className="brand" href="/" aria-label="CivicLens home"><svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="9" fill="#006948" /><path d="M24 36a12 12 0 1 1 12-12M32 32l7 7" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" /><circle cx="24" cy="24" r="5" fill="#85f8c4" /><path d="M16 24h4m4-8v4" stroke="white" strokeWidth="2" /></svg><span>CivicLens</span></a>
      <div className="pilot"><i className="status-dot" /><span>Silver Spring Pilot</span><b>Fenton Village Focus</b></div>
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
            <SectionHeading detail="Census 2020">Map appearance</SectionHeading>
            <label className="field-label" htmlFor="color-by">Show on map</label>
            <select id="color-by" value={metric} onChange={e => setMetric(e.target.value)}>
              <option value="population">Population</option><option value="housing_units">Homes</option><option value="">Boundaries only</option>
            </select>
            <div className="range-line"><label htmlFor="opacity">Transparency</label><input id="opacity" type="range" min="0" max="100" value={100 - opacity} onChange={e => setOpacity(100 - Number(e.target.value))} /><output>{100 - opacity}%</output></div>
            <button className="secondary full-width" onClick={() => { setResetKey(k => k + 1); setPane('map'); setView('map'); }}>Zoom to Fenton Village</button>
            <p className="micro-note">{metric === 'population' ? 'The map shades each neighborhood by how many people live there.' : metric === 'housing_units' ? 'The map shades each neighborhood by how many homes it has.' : 'The map shows area boundaries.'}</p>
          </section>
          <section className="control-section">
            <SectionHeading detail="OpenStreetMap">Local businesses</SectionHeading>
            <label className="layer-row"><input type="checkbox" checked={showStorefronts} onChange={e => setShowStorefronts(e.target.checked)} /><span>Storefront Locations</span><small>{storefronts?.storefronts.length ?? '…'} · OSM</small></label>
            {showStorefronts && storefronts && <div className="group-chips" role="group" aria-label="Storefront categories">{GROUPS.map(group =>
              <label key={group.id} className="group-chip"><input type="checkbox" checked={groups.includes(group.id)} onChange={() => toggleGroup(group.id)} />
                <i style={{ background: group.color }} />{group.label}<small>{storefronts.storefronts.filter(item => groupOf(item) === group.id).length}</small></label>)}</div>}
            <p className="micro-note">Named businesses near the two Fenton study areas. This snapshot has a different date and boundary from the orange food &amp; drink dots.</p>
          </section>
          <details className="control-section upcoming-catalog"><summary>More map data · Coming next</summary>

            <p>Age, income, household size and housing tenure</p><p>Zoning and Purple Line alignment</p>
            <p className="micro-note">More indicators will appear when sourced datasets are connected.</p>
          </details>
          <section className="control-section overlap-section">
            <SectionHeading detail="Coming next"><span className="inline-icon"><Icon name="overlap" />Compare two things</span></SectionHeading>
            <label className="field-label" htmlFor="cohort">Residents 50 and older</label><select id="cohort" value={cohort} onChange={e => setCohort(e.target.value)}><option value="25">Residents 50+ above 25%</option><option value="30">Residents 50+ above 30%</option><option value="35">Residents 50+ above 35%</option></select>
            <label className="field-label" htmlFor="economic">Household income</label><select id="economic" value={income} onChange={e => setIncome(Number(e.target.value))}>{Array.from({ length: 24 }, (_, i) => 45 + i * 5).map(v => <option value={v} key={v}>Household income below ${v},000</option>)}</select>
            <div className="overlap-result"><div><strong>Compare neighborhoods</strong><Preview /></div><p>Not enough data yet. Age and income data are coming next.</p><small>This shows where two things appear together, not that one causes the other.</small></div>
            <button className="primary full-width" disabled><Icon name="focus" />Show where these overlap<Icon name="arrow" /></button>
          </section>
        </div>
        <div className="place-summary"><i className="fb-dot" />{places ? `${places.count} food & drink places` : placesError ? 'Places could not load' : 'Loading places…'}<p>From OpenStreetMap, may not be complete.</p><p>Dashed blue outline: 600 m study area, not an official district boundary.</p><p>Census boundaries may differ from local neighborhood names.</p></div>
        <div className="sidebar-footer"><i className="status-dot" /><span>{areas ? 'Map ready' : 'Loading the map…'}</span><Icon name="database" /></div>
      </aside>

      <section className="map-workspace" aria-label="Map and layers">
        {view === 'map' ? <div className="map-viewport">
          {areas && <CommunityMap areas={areas} metric={metric} selectedId={selected?.geo_id} onSelect={select} opacity={opacity / 100} resetKey={resetKey} places={places} storefronts={visibleStorefronts} highlightIds={highlightIds} answerGeoId={answer?.evidence.length ? selected?.geo_id : undefined} />}
          {loading && <div className="map-state" role="status"><span className="loading-ring" />Loading community map…</div>}
          {error && <div className="map-state" role="alert"><Icon name="map" /><p>{error}</p><button className="primary" onClick={() => void load()}>Retry</button></div>}
          <div className="map-topbar"><div className="map-location"><Icon name="pin" /><span><small>Area you’re viewing</small><strong>{areaName(selected)}</strong></span></div><div className="map-actions"><button className="icon-button" aria-label="Copy link to this view" onClick={() => void copyLink()}><Icon name="external" /></button>{copied && <span role="status" className="micro-note">{copied}</span>}<button className="icon-button center-map" aria-label="Recenter map" onClick={() => setResetKey(k => k + 1)}><Icon name="focus" /></button></div></div>
          <div className="map-legend"><span className="eyebrow">{metric ? (metric === 'population' ? 'Population' : 'Homes') : 'Boundaries only'}</span>
            {metric && <><div className="choropleth-ramp">{palettes[metric].map(color => <i key={color} style={{ background: color }} />)}</div><div className="gradient-labels"><span>{scale.min.toLocaleString()}</span><span>{scale.max.toLocaleString()}</span></div><p>{scale.n >= 2 && scale.max > scale.min ? `Darker = more ${metric === 'population' ? 'people' : 'homes'} within block groups.` : 'Color identifies the layer; not a comparative scale.'}</p></>}
            <div><i className="legend-swatch selected" /><span>Selected area</span></div>
            <div><i className="fb-dot" /><span>{places ? places.count : '…'} food &amp; drink places</span></div><p>From OpenStreetMap, may not be complete. Within the dashed 600 m study area.</p>
            {highlightIds.length > 0 && <div><i className="legend-swatch highlight" /><span>High in both compared layers</span></div>}
            {visibleStorefronts.length > 0 && <><p>OpenStreetMap-mapped storefronts</p>{GROUPS.filter(group => groups.includes(group.id)).map(group => <div key={group.id}><i className="legend-dot" style={{ background: group.color }} /><span>{group.label}</span></div>)}</>}
            {answer?.evidence.length ? <div><i className="answer-swatch" /><span>Area in this answer</span></div> : null}
          </div>
        </div> : <div className="data-view"><div className="data-view-heading"><span className="eyebrow">Census 2020 · Source data</span><h2>Community data</h2><p>The same geographic areas and sourced values shown on your map.</p></div><div className="table-scroll"><table><thead><tr><th>Geography</th><th>Population</th><th>Homes</th></tr></thead><tbody>{areas?.features.map(f => <tr key={f.id} className={selected?.geo_id === f.id ? 'selected-row' : ''}><td><button onClick={() => select(f.id)}>{areaName(f.properties)}</button></td><td><MetricValue area={f.properties} metric="population" /></td><td><MetricValue area={f.properties} metric="housing_units" /></td></tr>)}</tbody></table></div><button className="secondary" disabled={!selected} onClick={exportData}><Icon name="download" />Export selected area</button><button className="secondary" disabled={!areas} onClick={exportCsv}><Icon name="download" />Export all areas (CSV)</button></div>}
        {view === 'map' && <div className={'query-dock' + (collapsed ? ' collapsed' : '')}><div className="query-toolbar">{answer && <button className="text-button" onClick={() => setCollapsed(value => !value)}>{collapsed ? 'Show answer' : 'Collapse answer'}</button>}</div><label className="query-heading" hidden={collapsed} htmlFor="community-question">Ask about this community</label>
          <div className="query-results" hidden={collapsed} aria-live="polite">
            {busy && <p role="status">Finding an answer…</p>}
            {queryError && <p role="alert">{queryError}</p>}
            {!showSuggestions && submitted && <div className="user-question">{submitted}</div>}
            {answer && <section className="research-response" aria-label="Answer" aria-live="polite">
              <h3>{answer.mode === 'llm' ? 'AI explanation' : answer.mode === 'facts' ? 'Official count' : answer.mode === 'retrieval' ? 'From the plan' : 'Available evidence'}</h3>
              {answer.mode === 'llm' && answer.claims?.length ? answer.claims.map((claim, i) => <div key={i}><p>{claim.text}</p><small>Sources: {claim.evidence_ids.map((id, j) => <span key={id}>{j > 0 && ', '}<a className="source-chip" href={answer.evidence.find(item => item.evidence_id === id)?.url} target="_blank" rel="noreferrer" title={answer.evidence.find(item => item.evidence_id === id)?.title}>{answer.evidence_ids.indexOf(id) + 1}</a></span>)}</small></div>) : <p className="answer">{answer.mode === 'facts' && answer.evidence[0]?.value != null ? `${areaName(selected)}: ${answer.evidence[0].value.toLocaleString()} ${answer.evidence[0].metric === 'housing_units' ? 'homes (occupied and vacant)' : 'people'}. Official 2020 count.` : answer.summary}</p>}
              <div className="source-chips">{answer.evidence.map(item => <a className="source-chip" key={item.evidence_id} href={item.url} target="_blank" rel="noreferrer" title={item.title}>{item.source.includes('Census') ? 'U.S. Census' : item.source} · {item.date.slice(0, 4)}{item.page ? ` · p. ${item.page_label ?? item.page}` : ''}</a>)}</div>
              {answer.evidence.length > 0 && <button className="secondary full-width" onClick={() => { setView('map'); setPane('map'); setResetKey(k => k + 1); }}>Show answer area on map</button>}
              <p className="micro-note">The outline shows the area you asked about. The plan may cover a wider area.</p>
              {answer.mode === 'retrieval' && answer.evidence.filter(item => item.excerpt).map(item => <blockquote key={item.evidence_id}>{item.excerpt}</blockquote>)}<details className="answer-details"><summary>See details</summary><EvidenceList items={answer.evidence} />
              {answer.limitations?.length > 0 && <ul className="limitations">{answer.limitations.map(item => <li key={item}>{item}</li>)}</ul>}
              </details>
            </section>}
            {showSuggestions ? <div className="suggestions" aria-label="Suggested questions">{prompts.filter(prompt => !prompt.includes('plan') || selected?.geo_id === '2472450').map(prompt => <button key={prompt} disabled={!selected || busy} onClick={() => void ask(prompt)}>{prompt}<Icon name="arrow" /></button>)}</div> : null}
          </div>
          {!collapsed && !showSuggestions && !busy && <button className="text-button try-another" onClick={() => { setShowSuggestions(true); setAnswer(undefined); setSubmitted(''); setQueryError(''); setQuestion(''); }}>Try another question</button>}
          <form hidden={collapsed} onSubmit={event => { event.preventDefault(); void ask(); }}><span className="query-symbol"><Icon name="sparkles" /></span><input id="community-question" ref={questionRef} aria-label="Ask about this area" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Or type your own question…" maxLength={1000} /><button className="primary" disabled={!question.trim() || !selected || busy} type="submit">{busy ? 'Answering…' : 'Ask'}<Icon name="arrow" /></button></form><span className="query-preview" hidden={collapsed}>Answers come with their sources.</span>
        </div>}
      </section>

      <aside className="insights-panel" aria-label="Area facts and evidence">
        <div className="insight-heading"><div><Icon name="pin" /><h2>{areaName(selected)}</h2><span className="tag">Selected</span></div><p>{selected?.geography_type === 'census_designated_place' ? 'Whole Silver Spring Census area · not Fenton Village alone' : 'Whole Census block group · not the Fenton district total'} · <button className="text-button" onClick={() => openTab('Evidence')}>See details</button></p></div>
        <div className="insight-tabs" role="tablist" aria-label="Community insights">{(['Overview', 'Who lives here', 'Answer history', 'Evidence'] as Tab[]).map(item => <button role="tab" aria-selected={tab === item} aria-controls="insight-content" id={'tab-' + item.replaceAll(' ', '-')} key={item} onClick={() => setTab(item)}>{item}{item === 'Evidence' && <span className="count-badge">{(selected?.evidence.length ?? 0) + 1}</span>}</button>)}</div>
        <div className="panel-scroll insight-content" id="insight-content" role="tabpanel" aria-labelledby={'tab-' + tab.replaceAll(' ', '-')}>
          {tab === 'Overview' && <>
            <section className="insight-section"><SectionHeading detail="Census 2020">Census counts</SectionHeading><div className="metrics-grid"><MetricCard label="Population" value={number('population')} detail="Everyone in this area" note="Census" /><MetricCard label="Homes" value={number('housing_units')} detail="Occupied and vacant homes" tone="blue" /></div></section>
            <section className="insight-section"><SectionHeading detail="Coming next">Extended community profile</SectionHeading><p className="body-muted">Income, age distribution and housing tenure will appear when sourced datasets are connected.</p></section>
            <section className="insight-section"><SectionHeading><span className="inline-icon blue"><Icon name="book" />Planning Context</span></SectionHeading><blockquote className="planning-excerpt">“This Plan aims to balance the preservation of existing naturally occurring affordable housing with the production of new housing…”<cite>— Silver Spring Downtown & Adjacent Communities Plan, 2022 · printed p. 92</cite><button className="text-button" onClick={() => openTab('Evidence')}>See the original <Icon name="arrow" /></button></blockquote><p className="micro-note">The plan covers a different area than the Census count.</p></section>
            <section className="insight-section"><SectionHeading>Where this comes from</SectionHeading><button className="source-card" onClick={() => openTab('Evidence')}><span><strong>U.S. Census Bureau</strong><small>People and homes in this area.</small></span><span className="source-date">2020</span></button><button className="source-card" onClick={() => openTab('Evidence')}><span><strong>Montgomery Planning</strong><small>Silver Spring Downtown & Adjacent Communities Plan.</small></span><span className="source-date blue">2022 PDF</span></button></section>
            {selected && <><StorefrontSummary area={selected} data={storefronts} failed={storefrontsFailed} shown={showStorefronts} onShow={() => setShowStorefronts(true)} /><DataCoverage area={selected} /></>}
          </>}
          {tab === 'Evidence' && <section className="insight-section evidence-tab"><SectionHeading detail="Original records">Evidence & Sources</SectionHeading><p className="body-muted">Inspect the source behind each map metric.</p>{selected && <><details><summary>See details</summary><p>{selected.name} · {selected.geography_type.replaceAll('_', ' ')} · Geographic ID {selected.geo_id}</p><p>2020 Census TIGERweb: POP100 (people) and HU100 (housing units, occupied and vacant). These are decennial counts, not ACS sample estimates; a survey sampling margin of error does not apply. Counts can still have coverage and other errors. ACS estimates will show their published margins of error when added.</p><p>Map colors compare block groups using equal intervals; the larger CDP is neutral. Counts are not densities. Loaded areas: {areas?.features.length}. Age/income correlation: n = 0 paired areas; at least 3 comparable areas are required.</p></details><EvidenceList items={selected.evidence} /></>}<article className="document-source"><Icon name="book" /><h3>Silver Spring Downtown & Adjacent Communities Plan</h3><span className="source-date">Approved & adopted · June 2022</span><p>Housing preservation · printed page 92 · PDF page 104.</p><p>The planning document has its own boundary. This is regional context, not a claim that it applies to every selected location. Recommendations do not establish current conditions.</p><a className="source-link" href={planUrl} target="_blank" rel="noreferrer">Open original document <Icon name="external" /></a></article><button className="secondary full-width" disabled={!selected} onClick={exportData}><Icon name="download" />Download area evidence</button></section>}
          {tab === 'Who lives here' && <section className="insight-section"><SectionHeading detail="Census 2020">Compare two things</SectionHeading><p className="body-muted">Compare people and homes across whole Census areas. Age and income data are coming next.</p><div className="info-note"><Icon name="info" /><span>This shows where two things appear together, not that one causes the other.</span></div>{areas && <SegmentationPanel areas={areas} onHighlight={setHighlightIds} />}</section>}
          {tab === 'Answer history' && <section className="insight-section"><SectionHeading>Answer history</SectionHeading><p className="body-muted">This session only · {history.length} answers</p>{!history.length && <p>Ask a question on the map to start your history.</p>}{history.map((entry, i) => <article className="history-entry" key={i}><h3>{entry.question}</h3><p>{areaName(entry.area)}</p><p>{entry.answer.summary}</p><button className="secondary" onClick={() => { queryVersion.current++; setBusy(false); setSelected(entry.area); setAnswer(entry.answer); setSubmitted(entry.question); setQuestion(entry.question); setShowSuggestions(false); setCollapsed(false); setPane('map'); setView('map'); }}>Reopen answer &amp; sources</button></article>)}</section>}

        </div>
        <footer className="application-footer"><div className="application-card"><div className="application-label"><span><Icon name="store" />Business planning tool</span><Preview /></div><h3>Plan a local business</h3><p>Explore commercial site viability with community context and neighborhood evidence.</p><button className="primary full-width" disabled>Is this a good spot for a business?<Icon name="arrow" /></button></div></footer>
      </aside>
    </main>
    <nav className="mobile-nav" aria-label="Workspace panels">{([['layers','layers','Layers'],['map','map','Map'],['insights','chart','Insights']] as const).map(([key,icon,label]) => <button key={key} aria-pressed={pane === key} onClick={() => setPane(key)}><Icon name={icon} />{label}</button>)}</nav>

  </div>;
}
