import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import type { Areas } from '../services/api';
import 'leaflet/dist/leaflet.css';

export function CommunityMap({ areas, metric, selectedId, onSelect, opacity = 0.75, resetKey = 0 }: {
  areas: Areas; metric: string; selectedId?: string; onSelect: (id: string) => void;
  opacity?: number; resetKey?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const instance = L.map(container.current!, { zoomControl: false }).setView([39.0024, -77.0208], 12);
    map.current = instance;
    L.control.zoom({ position: 'topright' }).addTo(instance);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current!);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(instance);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);
  const lastAreas = useRef<Areas | null>(null);
  const lastReset = useRef(resetKey);
  
  useEffect(() => {
    if (!map.current) return;
    const polygons = L.geoJSON(areas as unknown as GeoJsonObject, {
      style: (feature) => {
        const hasData = metric && feature?.properties?.metrics?.[metric] != null;
        const isSelected = feature?.properties?.geo_id === selectedId;
        const isFiner = feature?.properties?.geography_type === 'block_group';
        return {
          color: isSelected ? '#006948' : (metric === 'housing_units' ? '#8f4bb8' : '#087e8b'),
          weight: isSelected ? 5 : (isFiner ? 2.5 : 3),
          fillOpacity: hasData ? opacity * (isFiner ? 0.45 : 0.25) : 0.05,
          fillColor: metric === 'housing_units' ? '#8f4bb8' : '#087e8b',
          dashArray: hasData ? '' : '5, 5'
        };
      },
      onEachFeature: (feature, layer) => {
        const name = document.createElement('span');
        name.textContent = `${feature.properties.name} (${feature.properties.geography_type.replaceAll('_', ' ')})`;
        layer.bindTooltip(name);
        layer.on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          select.current(feature.properties.geo_id);
        });
      },
    }).addTo(map.current);

    // Keep smaller areas clickable even when the encompassing CDP is selected.
    polygons.eachLayer(layer => {
      if (layer instanceof L.Path && 'feature' in layer) {
        const feature = (layer as L.Polygon & { feature: { properties: { geography_type: string } } }).feature;
        if (feature.properties.geography_type === 'block_group') layer.bringToFront();
      }
    });
    
    if (lastAreas.current !== areas || lastReset.current !== resetKey) {
      const bounds = polygons.getBounds();
      if (bounds.isValid()) map.current.fitBounds(bounds, { padding: [25, 25] });
      lastAreas.current = areas;
      lastReset.current = resetKey;
    }
    
    return () => { polygons.remove(); };
  }, [areas, metric, selectedId, opacity, resetKey]);
  return <div ref={container} className="map" aria-label="Interactive Silver Spring map" />;
}
