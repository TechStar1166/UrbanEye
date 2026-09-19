import { useEffect, useRef, useState } from 'react';
import { api, type Answer, type Area, type Areas, type Layer } from './services/api';
import { CommunityMap } from './map/CommunityMap';
import { EvidenceList } from './evidence/EvidenceList';

export default function App() {
  const [areas, setAreas] = useState<Areas>();
  const [layers, setLayers] = useState<Layer[]>([]);
  const [metric, setMetric] = useState('population');
  const [selected, setSelected] = useState<Area>();
  const [question, setQuestion] = useState('What is the population?');
  const [answer, setAnswer] = useState<Answer>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const selectionVersion = useRef(0);

  async function load() {
    setLoading(true); setError('');
    try { const [data, catalog] = await Promise.all([api.areas(), api.layers()]); setAreas(data); setLayers(catalog); }
    catch { setError('Unable to load community data. Check that the backend is running, then retry.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function select(id: string) {
    const version = ++selectionVersion.current;
    setSelected(undefined); setAnswer(undefined); setError(''); setBusy(false);
    if (!id) return;
    try { const area = await api.area(id); if (version === selectionVersion.current) setSelected(area); }
    catch { if (version === selectionVersion.current) setError('Unable to load the selected area. Select it again to retry.'); }
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault(); if (!selected || !question.trim()) return;
    const version = selectionVersion.current;
    setBusy(true); setError(''); setAnswer(undefined);
    try { const result = await api.ask(selected.geo_id, question.trim()); if (version === selectionVersion.current) setAnswer(result); }
    catch { if (version === selectionVersion.current) setError('The question could not be answered. Please try again.'); }
    finally { if (version === selectionVersion.current) setBusy(false); }
  }

  return <>
    <header><h1>UrbanEye</h1><p>Silver Spring community intelligence · shared starter</p></header>
    <p className="notice">Real 2020 Census data for the Silver Spring CDP and Fenton Village study block groups.</p>
    {error && <div role="alert" className="notice">{error} {!areas && <button onClick={() => void load()}>Retry</button>}</div>}
    {loading && <p role="status">Loading community data…</p>}
    {areas && <main>
      <section aria-label="Map and layers">
        <div className="controls"><label>Map layer <select value={metric} onChange={e => setMetric(e.target.value)}>
          <option value="">Boundaries only</option>{layers.map(layer => <option key={layer.id} value={layer.id}>{layer.label}</option>)}
        </select></label>
        <label>Select area <select value={selected?.geo_id ?? ''} onChange={e => void select(e.target.value)}>
          <option value="">Choose an area or click the map</option>
          {areas.features.map(f => <option key={f.id} value={f.id}>{f.properties.name}</option>)}
        </select></label></div>
        <CommunityMap areas={areas} metric={metric} selectedId={selected?.geo_id} onSelect={id => void select(id)} />
        <p className="legend">{layers.find(layer => layer.id === metric)?.description ?? 'Geographic boundaries; no metric fill.'}
          {' '}{areas.features.length === 1 ? 'One area is available;' : `${areas.features.length} areas across ${new Set(areas.features.map(f => f.properties.geography_type)).size} geographic levels;`} fill color identifies the layer, not a comparative scale.</p>
      </section>
      <aside aria-label="Area facts and evidence">
        {!selected ? <p>Select an area to inspect its values and sources.</p> : <>
          <h2>{selected.name}</h2><p>{selected.geography_type.replaceAll('_', ' ')} · {selected.geo_id}</p>
          <dl>{layers.map(layer => <div key={layer.id}><dt>{layer.label}</dt>
            <dd>{selected.metrics[layer.id] == null ? 'No data' : selected.metrics[layer.id]!.toLocaleString()} {layer.unit}</dd></div>)}</dl>
          <h3>Data sources</h3><EvidenceList items={selected.evidence} />
          <form onSubmit={ask}><label htmlFor="question">Ask about this area</label>
            <div className="quick-prompts" aria-label="Sample questions">
              <button type="button" className="quick-prompt-btn" onClick={() => setQuestion('What is the population?')}>Population</button>
              <button type="button" className="quick-prompt-btn" onClick={() => setQuestion('How many housing units are there?')}>Housing units</button>
              <button type="button" className="quick-prompt-btn" onClick={() => setQuestion('How does the plan preserve affordable housing?')}>Affordable housing</button>
              <button type="button" className="quick-prompt-btn" onClick={() => setQuestion('What do planning documents say about housing in this area?')}>Housing in area</button>
            </div>
            <textarea id="question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={1000} required />
            <button disabled={busy || !question.trim()}>{busy ? 'Answering…' : 'Ask'}</button>
          </form>
          {busy && <p role="status">Retrieving grounded evidence…</p>}
          {answer && <section aria-label="Answer" aria-live="polite"><h3>{answer.mode === 'llm' ? 'AI explanation' : answer.mode === 'facts' ? 'Cited data answer' : answer.mode === 'retrieval' ? 'Retrieved passages' : 'Available evidence'}</h3>
            {answer.mode === 'llm' && answer.claims?.length ? answer.claims.map((claim, i) => <div key={i}>
              <p>{claim.text}</p><small>Sources: {claim.evidence_ids.map((id, j) => <span key={id}>
                {j > 0 && ', '}<a href={`#evidence-${id}`}>{answer.evidence_ids.indexOf(id) + 1}</a>
              </span>)}</small>
            </div>) : <p className="answer">{answer.summary}</p>}
            <EvidenceList items={answer.evidence} />
            {answer.limitations?.length > 0 && <ul className="limitations">{answer.limitations.map(item => <li key={item}>{item}</li>)}</ul>}
          </section>}
        </>}
      </aside>
    </main>}
  </>;
}
