import { useEffect, useState } from 'react';
import { api, type Source } from '../services/api';

export function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState(false);
  const load = () => { setError(false); api.sources().then(setSources).catch(() => setError(true)); };
  useEffect(load, []);
  return <main className="sources-page"><a href="#">← Back to the map</a><h1>Data sources &amp; methodology</h1>
    <p>Every dataset has a different date and boundary. Here is what we use and what it can tell you.</p>
    {error ? <p role="alert">Sources could not load. <button onClick={load}>Retry</button></p> : !sources.length && <p role="status">Loading sources…</p>}
    {sources.map(source => <article key={source.name}><h2>{source.name}</h2>
      <p><strong>Data date:</strong> {source.vintage}</p><p><strong>Downloaded:</strong> {source.pulled ? new Date(source.pulled).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'Not a downloaded dataset'}</p>
      <p><strong>Used for:</strong> {source.use}</p><p>{source.note}</p>
      {source.url && <a href={source.url} target="_blank" rel="noreferrer">Open original source ↗</a>}
      {source.query && <details><summary>See the Overpass query</summary><pre>{source.query}</pre></details>}
    </article>)}
    <article><h2>How to read the map and answers</h2><p>Darker colors show larger whole-area counts, not population density. The scale compares Census block groups, while the larger Silver Spring boundary is only context. Census boundaries do not necessarily match local neighborhood names.</p><p>2020 Census counts are full counts rather than ACS sample estimates. A survey margin of error does not apply, but coverage and other errors remain possible. Income, age and tenure use Census survey estimates for 2020–2024; the published margins of error accompany each figure.</p><p>Answers use selected-area counts or reviewed planning passages. AI explanations carry citations; when there is insufficient evidence the app says so. Storefront dots are mapped OSM objects, not evidence of revenue, demand or business viability.</p></article>
  </main>;
}
