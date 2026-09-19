import type { Answer, Area, Evidence } from '../services/api';
import { EvidenceList } from '../evidence/EvidenceList';

function originalRecord(item: Evidence) {
  const url = new URL(item.url);
  if (item.type === 'structured_data' && url.hostname === 'tigerweb.geo.census.gov' && url.pathname.endsWith('/query') && /^\d+$/.test(item.geo_id)) {
    url.searchParams.set('where', `GEOID='${item.geo_id}'`);
    url.searchParams.set('outFields', 'GEOID,NAME,POP100,HU100');
    url.searchParams.set('returnGeometry', 'false');
    url.searchParams.set('f', 'pjson');
  }
  return url.href;
}

export function AnswerCard({ answer, area, regional }: { answer: Answer; area: Area; regional: boolean }) {
  const fact = answer.mode === 'facts' ? answer.evidence.find(item => item.type === 'structured_data' && item.value != null) : undefined;
  const homes = fact?.metric === 'housing_units';
  const scope = area.geography_type === 'census_designated_place'
    ? 'This is the whole Silver Spring Census area, not Fenton Village alone.'
    : area.geography_type === 'block_group'
      ? ['240317024022', '240317024023', '240317025021'].includes(area.geo_id)
        ? 'This is one Census block group near Fenton Village, not the whole district.'
        : 'This is one Census block group in the Silver Spring study area, not the whole Fenton Village district.'
      : 'This is one Census tract, not the whole Fenton Village district.';
  return <section className="research-response" aria-label="Answer" aria-live="polite">
    <h3>{fact ? 'Official Census count' : answer.mode === 'llm' ? 'AI explanation' : answer.mode === 'retrieval' ? 'From the Silver Spring plan' : 'Available evidence'}</h3>
    {regional && <p className="answer-scope">Silver Spring planning-area context. These passages are not a finding about the selected block group; the plan has its own boundary.</p>}
    {fact ? <>
      <strong className="answer-number">{fact.value!.toLocaleString()}</strong>
      <p className="answer-sentence">{homes ? `There were ${fact.value!.toLocaleString()} homes in this area in ${fact.date.slice(0, 4)}, including occupied and vacant homes.` : `About ${fact.value!.toLocaleString()} people lived in this area in ${fact.date.slice(0, 4)}.`}</p>
      <p className="answer-scope">{scope}</p>
      <p className="micro-note count-outline-note">The outline shows the area this count covers.</p>
    </> : answer.mode === 'llm' && answer.claims?.length ? answer.claims.map((claim, i) => <div key={i}><p>{claim.text}</p><small>Sources: {claim.evidence_ids.map((id, j) => {
      const item = answer.evidence.find(item => item.evidence_id === id);
      return <span key={id}>{j > 0 && ', '}<a href={item?.url} target="_blank" rel="noreferrer">{answer.evidence_ids.indexOf(id) + 1}</a></span>;
    })}</small></div>) : <p className="answer">{answer.summary}</p>}
    <div className="source-chips">{answer.evidence.map(item => <div className="answer-source" key={item.evidence_id}>
      <a className="source-chip" href={originalRecord(item)} target="_blank" rel="noreferrer" title={item.title}>{item.source.includes('Census') ? 'U.S. Census' : item.source} · {item.date.slice(0, 4)}{item.page ? ` · p. ${item.page_label ?? item.page}` : ''} ↗</a>
      <p className="source-record">{item.type === 'structured_data' ? <>
        TIGERweb Census 2020 · {area.geography_type === 'block_group' ? 'Census Block Groups' : area.geography_type === 'census_tract' ? 'Census Tracts' : 'Census Places'} · {item.metric === 'population' ? 'POP100 (population)' : 'HU100 (housing units)'}<br />
        Geographic ID {item.geo_id}
      </> : item.title}{item.retrieved_at && <> · Pulled <time dateTime={item.retrieved_at}>{new Date(item.retrieved_at).toISOString().slice(0, 10)}</time></>}</p>
    </div>)}</div>
    {answer.mode === 'retrieval' && answer.evidence.filter(item => item.excerpt).map(item => <blockquote key={item.evidence_id}>{item.excerpt}</blockquote>)}
    {answer.evidence.length > 0 && <details className="answer-details"><summary>All evidence details</summary><EvidenceList items={answer.evidence} />
      {answer.limitations.length > 0 && <ul className="limitations">{answer.limitations.map(item => <li key={item}>{item}</li>)}</ul>}
    </details>}
  </section>;
}
