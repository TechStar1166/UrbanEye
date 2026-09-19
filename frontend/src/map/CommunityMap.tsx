import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import type { Areas, Places, Storefront } from '../services/api';
import { groupColor, groupOf, nearbySame, prettyCategory } from '../lib/storefronts';
import { areaColor, colorScale } from './colors';
import 'leaflet/dist/leaflet.css';

type StyleFeature = { properties?: { geo_id?: string; geography_type?: string; metrics?: Record<string, number | null> } } | undefined;

function popupFor(item: Storefront, all: Storefront[]): HTMLElement {
  // Built only when a marker is opened (lazy), and only from text nodes.
  const root = document.createElement('div');
  const title = document.createElement('strong'); title.textContent = item.name;
  const kind = document.createElement('div'); kind.textContent = prettyCategory(item.category);
  root.append(title, kind);
  if (item.address) { const line = document.createElement('div'); line.textContent = item.address; root.append(line); }
  const near = document.createElement('div');
  const n = nearbySame(all, item);
  near.textContent = `${n} other ${prettyCategory(item.category)} within 300 m (OpenStreetMap-mapped)`;
  root.append(near);
  return root;
}

export function CommunityMap({ areas, metric, selectedId, onSelect, opacity = 0.75, resetKey = 0, storefronts = [], highlightIds = [], answerGeoId, places }: {
  areas: Areas; metric: string; selectedId?: string; onSelect: (id: string) => void;
  opacity?: number; resetKey?: number; storefronts?: Storefront[]; highlightIds?: string[]; answerGeoId?: string; places?: Places;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const polygons = useRef<L.GeoJSON | null>(null);
  const markers = useRef<L.FeatureGroup | null>(null);
  const hadMarkers = useRef(false);
  const select = useRef(onSelect);
  select.current = onSelect;

  const scale = useMemo(() => colorScale(areas, metric), [areas, metric]);

  // The style depends on props but is applied in place; shapes are never rebuilt for it.
  const styleFor = (feature: StyleFeature): L.PathOptions => {
    const value = metric ? feature?.properties?.metrics?.[metric] : null;
    const hasData = value != null;
    const isHighlighted = highlightIds.includes(feature?.properties?.geo_id ?? '');
    const isSelected = feature?.properties?.geo_id === selectedId;
    const isFiner = feature?.properties?.geography_type === 'block_group';
    return {
      className: `census-area area-${feature?.properties?.geo_id}`,
      color: feature?.properties?.geo_id === answerGeoId ? '#b43b73' : isSelected ? '#006948' : isHighlighted ? '#c2410c' : (metric === 'housing_units' ? '#8f4bb8' : '#087e8b'),
      weight: isSelected ? 3 : isHighlighted ? 4 : (isFiner ? 1.2 : 1),
      fillOpacity: hasData ? opacity * (isFiner ? 0.65 : 0) : 0.05,
      fillColor: isFiner ? areaColor(value, metric, scale) : '#d9dfdc',
      dashArray: !isFiner ? '6 6' : hasData ? '' : '5, 5',
    };
  };
  const style = useRef(styleFor);
  style.current = styleFor;

  useEffect(() => {
    const instance = L.map(container.current!, { zoomControl: false }).setView([38.99487, -77.02489], 15);
    map.current = instance;
    L.control.zoom({ position: 'topright' }).addTo(instance);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(instance);
    instance.createPane('storefronts').style.zIndex = '470'; // above area shapes and the food/drink dots
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
    return () => { outline.remove(); pin.remove(); observer.disconnect(); instance.remove(); map.current = null; polygons.current = null; markers.current = null; };
  }, []);

  // Build the area shapes once per dataset.
  useEffect(() => {
    if (!map.current) return;
    const layer = L.geoJSON(areas as unknown as GeoJsonObject, {
      style: feature => style.current(feature as StyleFeature),
      onEachFeature: (feature, shape) => {
        const name = document.createElement('span');
        name.textContent = `${feature.properties.name} (${feature.properties.geography_type.replaceAll('_', ' ')})`;
        shape.bindTooltip(name);
        shape.on('click', event => {
          L.DomEvent.stopPropagation(event);
          select.current(feature.properties.geo_id);
        });
      },
    }).addTo(map.current);
    // Keep smaller areas clickable even when the encompassing CDP is selected.
    layer.eachLayer(shape => {
      const feature = (shape as L.Polygon & { feature?: { properties: { geography_type: string } } }).feature;
      if (shape instanceof L.Path && feature?.properties.geography_type === 'block_group') shape.bringToFront();
    });
    polygons.current = layer;
    return () => { layer.remove(); polygons.current = null; };
  }, [areas]);

  // Selection, metric and opacity only restyle the existing shapes.
  useEffect(() => { polygons.current?.setStyle(feature => style.current(feature as StyleFeature)); }, [metric, selectedId, opacity, areas, highlightIds, answerGeoId]);

  // Recenter on request (not on first render).
  const lastReset = useRef(resetKey);
  useEffect(() => {
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    map.current?.setView([38.99487, -77.02489], 15);
  }, [resetKey]);

  // Storefront markers: rebuilt only when the visible set changes, never for selection or opacity.
  useEffect(() => {
    if (!map.current) return;
    if (storefronts.length === 0) { hadMarkers.current = false; return; }
    const group = L.featureGroup();
    for (const item of storefronts) {
      const color = groupColor(groupOf(item));
      const dot = L.circleMarker([item.lat, item.lon], { pane: 'storefronts', radius: 5, weight: 1.5, color: '#ffffff', fillColor: color, fillOpacity: 0.95 });
      const label = document.createElement('span'); label.textContent = `${item.name} · ${prettyCategory(item.category)}`;
      dot.bindTooltip(label);
      dot.bindPopup(() => popupFor(item, storefronts));
      group.addLayer(dot);
    }
    group.addTo(map.current);
    markers.current = group;
    // At the default zoom the markers would be a tiny clump; zoom in when the layer first appears.
    // Not animated: Leaflet silently drops an animated fitBounds while another zoom animation is running.
    if (!hadMarkers.current) {
      const bounds = group.getBounds();
      map.current.invalidateSize();
      if (bounds.isValid()) map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17, animate: false });
    }
    hadMarkers.current = true;
    return () => { group.remove(); markers.current = null; };
  }, [storefronts]);

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
