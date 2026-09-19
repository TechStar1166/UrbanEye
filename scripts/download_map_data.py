"""Refresh committed Census/Overpass snapshots; run manually, not at app startup."""
import json, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone
root=Path(__file__).resolve().parents[1]
raw=json.loads((root/'data/raw/silver_spring_census2020.geojson').read_text())
g=raw['features'][0]['geometry']
rings=g['coordinates'] if g['type']=='Polygon' else [r for polygon in g['coordinates'] for r in polygon]
base='https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/8/query'
params={'where':"STATE='24'",'geometry':json.dumps({'rings':rings,'spatialReference':{'wkid':4326}}),'geometryType':'esriGeometryPolygon','inSR':'4326','spatialRel':'esriSpatialRelIntersects','outFields':'*','outSR':'4326','f':'geojson','returnGeometry':'true'}
req=urllib.request.Request(base,data=urllib.parse.urlencode(params).encode())
with urllib.request.urlopen(req,timeout=60) as r: data=json.load(r)
if 'error' in data or data.get('exceededTransferLimit') or not data.get('features'): raise ValueError(data)
(root/'data/raw/silver_spring_blockgroups_census2020.geojson').write_text(json.dumps(data,indent=2)+'\n')
source={'dataset':'U.S. Census Bureau TIGERweb Census 2020','url':base,'data_date':'2020-04-01','boundary_vintage':'Census 2020','downloaded_at':datetime.now(timezone.utc).isoformat(),'selection':'Every Maryland block group intersecting the official Silver Spring CDP polygon, including boundary-touching groups. Whole geometry and whole counts retained.','query':params,'geoids':sorted(f['properties']['GEOID'] for f in data['features'])}
(root/'data/raw/silver_spring_blockgroups_source.json').write_text(json.dumps(source,indent=2)+'\n')
print('Downloaded block groups:',len(data['features']))
query='[out:json][timeout:45];nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|ice_cream|food_court|biergarten)$"](around:600,38.99487,-77.02489);out center tags;'
endpoint='https://overpass-api.de/api/interpreter'
req=urllib.request.Request(endpoint,data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'UrbanEye hackathon map data snapshot'})
with urllib.request.urlopen(req,timeout=60) as r: data=json.load(r)
if data.get('remark'): raise ValueError(data['remark'])
(root/'data/raw/fenton_osm_food.json').write_text(json.dumps(data,indent=2)+'\n')
(root/'data/raw/fenton_osm_source.json').write_text(json.dumps({'source':'OpenStreetMap contributors','url':endpoint,'query':query,'downloaded_at':datetime.now(timezone.utc).isoformat(),'license':'ODbL','scope':'600 m around challenge coordinate 38.99487, -77.02489; a study radius, not an official district boundary.'},indent=2)+'\n')
print('Downloaded OSM objects:',len(data['elements']))
