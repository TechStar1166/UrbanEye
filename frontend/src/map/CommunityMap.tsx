import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import type { Areas } from '../services/api';
import 'leaflet/dist/leaflet.css';

export function CommunityMap({ areas, metric, selectedId, onSelect }: {
  areas: Areas; metric: string; selectedId?: string; onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const instance = L.map(container.current!).setView([39.0024, -77.0208], 12);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(instance);
    return () => { instance.remove(); map.current = null; };
  }, []);
  const lastAreas = useRef<Areas | null>(null);
  
  useEffect(() => {
    if (!map.current) return;
    const polygons = L.geoJSON(areas as unknown as GeoJsonObject, {
      style: (feature) => {
        const hasData = metric && feature?.properties?.metrics?.[metric] != null;
        const isSelected = feature?.properties?.geo_id === selectedId;
        const isFiner = feature?.properties?.geography_type === 'block_group';
        return {
          color: isSelected ? '#ffcc00' : (metric === 'housing_units' ? '#8f4bb8' : '#087e8b'),
          weight: isSelected ? 5 : (isFiner ? 2.5 : 3),
          fillOpacity: hasData ? (isFiner ? 0.45 : 0.25) : 0.05,
          dashArray: hasData ? '' : '5, 5',
        };
      },
      onEachFeature: (feature, layer) => {
        const name = document.createElement('span');
        const typeLabel = feature.properties.geography_type
          ? ` (${feature.properties.geography_type.replace(/_/g, ' ')})`
          : '';
        name.textContent = `${feature.properties.name}${typeLabel}`;
        layer.bindTooltip(name);
        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          select.current(feature.properties.geo_id);
        });
      },
    }).addTo(map.current);

    polygons.eachLayer((layer: any) => {
      if (layer.feature?.properties?.geography_type === 'block_group') {
        layer.bringToFront();
      }
      if (layer.feature?.properties?.geo_id === selectedId) {
        layer.bringToFront();
      }
    });

    if (lastAreas.current !== areas) {
      const bounds = polygons.getBounds();
      if (bounds.isValid()) map.current.fitBounds(bounds, { padding: [25, 25] });
      lastAreas.current = areas;
    }

    return () => { polygons.remove(); };
  }, [areas, metric, selectedId]);
  return <div ref={container} className="map" aria-label="Interactive Silver Spring map" />;
}
