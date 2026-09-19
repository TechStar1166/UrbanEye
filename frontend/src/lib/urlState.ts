export const TABS = ['Overview', 'Compare areas', 'Answer history', 'Evidence'] as const;
export type UrlTab = typeof TABS[number];

// The view is shared as #area=<geo_id>&tab=<Tab>. Anything unrecognized is ignored by the caller.
export function readView(): { area?: string; tab?: UrlTab } {
  try {
    const params = new URLSearchParams(location.hash.slice(1));
    const requested = params.get('tab') === 'Who lives here' ? 'Compare areas' : params.get('tab');
    const tab = TABS.find(item => item === requested);
    return { area: params.get('area') || undefined, tab };
  } catch { return {}; }
}

export function writeView(view: { area?: string; tab: UrlTab }) {
  try {
    const params = new URLSearchParams();
    if (view.area) params.set('area', view.area);
    params.set('tab', view.tab);
    history.replaceState(null, '', '#' + params.toString());
  } catch { /* the address bar simply is not updated */ }
}
