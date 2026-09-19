import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import type { Areas, Storefront } from '../services/api';
import { groupColor, groupOf, nearbySame, prettyCategory } from '../lib/storefronts';
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

export function CommunityMap({ areas, metric, selectedId, onSelect, opacity = 0.75, resetKey = 0, storefronts = [] }: {
  areas: Areas; metric: string; selectedId?: string; onSelect: (id: string) => void;
  opacity?: number; resetKey?: number; storefronts?: Storefront[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const polygons = useRef<L.GeoJSON | null>(null);
  const markers = useRef<L.FeatureGroup | null>(null);
  const hadMarkers = useRef(false);
  const select = useRef(onSelect);
  select.current = onSelect;

  // The style depends on props but is applied in place; shapes are never rebuilt for it.
  const styleFor = (feature: StyleFeature): L.PathOptions => {
    const hasData = !!metric && feature?.properties?.metrics?.[metric] != null;
    const isSelected = feature?.properties?.geo_id === selectedId;
    const isFiner = feature?.properties?.geography_type === 'block_group';
    return {
      color: isSelected ? '#006948' : (metric === 'housing_units' ? '#8f4bb8' : '#087e8b'),
      weight: isSelected ? 5 : (isFiner ? 2.5 : 3),
      fillOpacity: hasData ? opacity * (isFiner ? 0.45 : 0.25) : 0.05,
      fillColor: metric === 'housing_units' ? '#8f4bb8' : '#087e8b',
      dashArray: hasData ? '' : '5, 5',
    };
  };
  const style = useRef(styleFor);
  style.current = styleFor;

  useEffect(() => {
    const instance = L.map(container.current!, { zoomControl: false }).setView([39.0024, -77.0208], 12);
    map.current = instance;
    L.control.zoom({ position: 'topright' }).addTo(instance);
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(instance);
    instance.createPane('storefronts').style.zIndex = '450'; // above the area shapes
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current!);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(instance);
    return () => { observer.disconnect(); instance.remove(); map.current = null; polygons.current = null; markers.current = null; };
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
    const bounds = layer.getBounds();
    // Not animated: an in-flight zoom animation re-applies its own target view when it ends, which would
    // overwrite a later fitBounds (for example when the storefront layer is turned on right after load).
    if (bounds.isValid()) map.current.fitBounds(bounds, { padding: [25, 25], animate: false });
    return () => { layer.remove(); polygons.current = null; };
  }, [areas]);

  // Selection, metric and opacity only restyle the existing shapes.
  useEffect(() => { polygons.current?.setStyle(feature => style.current(feature as StyleFeature)); }, [metric, selectedId, opacity, areas]);

  // Recenter on request (not on first render).
  const lastReset = useRef(resetKey);
  useEffect(() => {
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    const bounds = polygons.current?.getBounds();
    if (bounds?.isValid()) map.current?.fitBounds(bounds, { padding: [25, 25] });
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

  return <div ref={container} className="map" aria-label="Interactive Silver Spring map" />;
}
