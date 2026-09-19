import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import type { Areas, Places } from '../services/api';
import 'leaflet/dist/leaflet.css';
import { areaColor, colorScale } from './colors';

export function CommunityMap({ areas, metric, selectedId, onSelect, opacity = 0.75, resetKey = 0, answerGeoId, places }: {
  areas: Areas; metric: string; selectedId?: string; onSelect: (id: string) => void;
  opacity?: number; resetKey?: number; answerGeoId?: string; places?: Places;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const instance = L.map(container.current!, { zoomControl: false }).setView([38.99487, -77.02489], 15);
    map.current = instance;
    L.control.zoom({ position: 'topright' }).addTo(instance);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current!);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri, HERE, Garmin, GIS user community &middot; Places &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(instance);
    instance.createPane('places');
    instance.getPane('places')!.style.zIndex = '460';
    instance.createPane('fenton');
    instance.getPane('fenton')!.style.zIndex = '450';
    const outline = L.circle([38.99487, -77.02489], { radius: 600, pane: 'fenton', color: '#25479b', weight: 2, dashArray: '7 6', fill: false, interactive: false }).addTo(instance);
    const pin = L.marker([38.99487, -77.02489], { title: 'Fenton Village', icon: L.divIcon({ className: 'fenton-pin', html: '<span aria-hidden="true">●</span>', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(instance);
    pin.bindTooltip('Fenton Village', { permanent: true, direction: 'top', className: 'fenton-label' });
    pin.bindPopup('Fenton Village · challenge location. Dashed outline: 600 m study area, not an official district boundary.');
    return () => { outline.remove(); pin.remove(); observer.disconnect(); instance.remove(); map.current = null; };
  }, []);
  const lastReset = useRef(resetKey);
  
  useEffect(() => {
    if (!map.current) return;
    const scale = colorScale(areas, metric);
    const polygons = L.geoJSON(areas as unknown as GeoJsonObject, {
      style: (feature) => {
        const hasData = metric && feature?.properties?.metrics?.[metric] != null;
        const isSelected = feature?.properties?.geo_id === selectedId;
        const isFiner = feature?.properties?.geography_type === 'block_group';
        return {
          className: `census-area area-${feature?.properties?.geo_id}`,
          color: feature?.properties?.geo_id === answerGeoId ? '#b43b73' : isSelected ? '#006948' : (metric === 'housing_units' ? '#8f4bb8' : '#087e8b'),
          weight: isSelected ? 3 : (isFiner ? 1.2 : 1),
          fillOpacity: hasData ? opacity * (isFiner ? 0.65 : 0) : 0.05,
          fillColor: isFiner ? areaColor(feature?.properties?.metrics?.[metric], metric, scale) : '#d9dfdc',
          dashArray: !isFiner ? '6 6' : hasData ? '' : '5, 5'
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
    
    if (lastReset.current !== resetKey) {
      map.current.setView([38.99487, -77.02489], 15);
      lastReset.current = resetKey;
    }
    
    return () => { polygons.remove(); };
  }, [areas, metric, selectedId, opacity, resetKey, answerGeoId]);
  useEffect(() => {
    if (!map.current || !places) return;
    const points = L.layerGroup().addTo(map.current);
    for (const place of places.places) {
      const dot = L.circleMarker([place.lat, place.lon], { className: 'food-place', pane: 'places', radius: 5, color: '#713100', weight: 1.5, fillColor: '#ed761c', fillOpacity: 0.95 }).addTo(points);
      dot.bindTooltip(place.name);
      const content = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = place.name; content.append(title);
      const text = document.createElement('p'); text.textContent = place.kind.replaceAll('_', ' ') + ' · From OpenStreetMap, may not be complete'; content.append(text);
      const link = document.createElement('a'); link.href = place.url; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = 'See this place on OpenStreetMap'; content.append(link);
      dot.bindPopup(content);
    }
    return () => { points.remove(); };
  }, [places]);
  return <div ref={container} className="map" aria-label="Interactive Silver Spring map" />;
}
