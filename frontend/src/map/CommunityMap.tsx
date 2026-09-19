import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import type { Areas, Businesses, Overlays, Transit } from '../services/api';
import 'leaflet/dist/leaflet.css';

const CATEGORY_COLORS: Record<string, string> = {
  food: '#d1495b', retail: '#0b7285', service: '#8f4bb8', office: '#5c6b73', other: '#8a8f98',
};

export function CommunityMap({ areas, metric, selectedId, onSelect, opacity = 0.75, resetKey = 0,
  overlays, transit, pois }: {
  areas: Areas; metric: string; selectedId?: string; onSelect: (id: string) => void;
  opacity?: number; resetKey?: number;
  overlays?: Overlays; transit?: Transit; pois?: Businesses;
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

  // The zoning boundary is a selection device, so it is drawn as an outline only and
  // is deliberately not clickable: it carries no statistics of its own.
  useEffect(() => {
    if (!map.current || !overlays) return;
    const layer = L.geoJSON(overlays as unknown as GeoJsonObject, {
      interactive: false,
      style: { color: '#c77700', weight: 3, dashArray: '6, 4', fill: false },
    }).addTo(map.current);
    return () => { layer.remove(); };
  }, [overlays]);

  useEffect(() => {
    if (!map.current || !transit) return;
    const layer = L.geoJSON(transit as unknown as GeoJsonObject, {
      style: { color: '#6d28d9', weight: 4, opacity: 0.85, dashArray: '10, 6' },
      onEachFeature: (feature, target) => {
        const properties = feature.properties as { name?: string; opening_date?: string };
        target.bindTooltip(`${properties.name ?? 'Purple Line'} — under construction`
          + (properties.opening_date ? ` (opening ${properties.opening_date})` : ''));
      },
    }).addTo(map.current);
    return () => { layer.remove(); };
  }, [transit]);

  useEffect(() => {
    if (!map.current || !pois) return;
    const group = L.layerGroup().addTo(map.current);
    for (const poi of pois.features) {
      L.circleMarker([poi.lat, poi.lon], {
        radius: 5, weight: 1, color: '#ffffff',
        fillColor: CATEGORY_COLORS[poi.category] ?? CATEGORY_COLORS.other, fillOpacity: 0.9,
      }).bindTooltip(`${poi.name ?? 'Unnamed'} — ${poi.subcategory ?? poi.category}`).addTo(group);
    }
    return () => { group.remove(); };
  }, [pois]);

  return <div ref={container} className="map" aria-label="Interactive Silver Spring map" />;
}
