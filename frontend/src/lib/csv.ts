import type { Areas } from '../services/api';

const HEADER = ['geo_id', 'name', 'geography_type', 'boundary_vintage', 'metric', 'value', 'unit', 'source', 'data_date', 'source_url'];

// Quote when needed, and neutralize spreadsheet formulas in text cells (=, +, -, @, tab, CR).
function cell(value: string | number | null | undefined): string {
  if (value == null) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Long format: one row per area and metric, with the source of that value.
export function areasToCsv(areas: Areas): string {
  const rows = [HEADER.join(',')];
  for (const feature of areas.features) {
    const area = feature.properties;
    for (const [metric, value] of Object.entries(area.metrics)) {
      const source = area.evidence.find(item => item.type === 'structured_data' && item.metric === metric);
      rows.push([area.geo_id, area.name, area.geography_type, area.boundary_vintage, metric, value,
        source?.unit, source?.source, source?.date, source?.url].map(cell).join(','));
    }
  }
  return rows.join('\r\n') + '\r\n';
}
