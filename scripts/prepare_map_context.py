"""Build deterministic map places and provenance from committed source snapshots."""
import json
import math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def build():
    read = lambda p: json.loads((ROOT / p).read_text())
    raw = read('data/raw/fenton_osm_food.json')
    source = read('data/raw/fenton_osm_source.json')
    places = {}
    for item in raw['elements']:
        c, tags = item.get('center', item), item.get('tags', {})
        if 'lat' not in c:
            continue
        dy, dx = math.radians(c['lat'] - 38.99487), math.radians(c['lon'] + 77.02489)
        distance = 6371000 * 2 * math.asin(math.sqrt(math.sin(dy/2)**2 + math.cos(math.radians(c['lat'])) * math.cos(math.radians(38.99487)) * math.sin(dx/2)**2))
        if distance > 600:
            continue
        key = f"{item['type']}/{item['id']}"
        places[key] = dict(id=key, name=tags.get('name', 'Unnamed ' + tags['amenity'].replace('_', ' ')), kind=tags['amenity'], lat=c['lat'], lon=c['lon'], url=f'https://www.openstreetmap.org/{key}')
    (ROOT/'data/processed/places.json').write_text(json.dumps(dict(places=list(places.values()), source=source, count=len(places)), indent=2)+'\n')
    cdp, groups = read('data/raw/source.json'), read('data/raw/silver_spring_blockgroups_source.json')
    plan = read('documents/sources.json')[0]
    catalog = [
        dict(name='2020 Census: Silver Spring boundary and counts', url=cdp['url'], pulled=cdp['retrieved_at'], vintage='2020 Census', use='Official POP100 population and HU100 housing counts; whole Silver Spring Census area.', note='The unchanged official Census boundary is not a city limit or a local neighborhood boundary. It can differ from how residents describe Silver Spring.'),
        dict(name='2020 Census: all intersecting block groups', url=groups['url'], pulled=groups['downloaded_at'], vintage='2020 Census', use=f"{len(groups['geoids'])} whole block groups shade the map; selected-area counts come from each group.", note='Selected by polygon intersection with the CDP, including groups touching or crossing its boundary. No clipping or smoothing. Never add these counts to the larger CDP total.'),
        dict(name='OpenStreetMap food and drink places', url=source['url'], pulled=source['downloaded_at'], vintage=raw.get('osm3s',{}).get('timestamp_osm_base','Snapshot'), use=f'{len(places)} mapped objects within 600 m of the challenge coordinate; restaurants, cafes, fast food, bars, pubs, ice cream, food courts and beer gardens.', note='From OpenStreetMap, may not be complete. Object count, not a verified business census; duplicate businesses may exist across different OSM objects. Way/relation locations use centers. ODbL; © OpenStreetMap contributors.', query=source['query']),
        dict(name=plan['title'], url=plan['url'], pulled=plan['retrieved_at'], vintage=plan['date'], use='Three reviewed housing passages support planning answers, with original page citations.', note='Plan recommendations are regional context, not current conditions. Retrieval is limited to reviewed passages and their recorded geographic scope.'),
        dict(name='Fenton Village challenge location', url=None, pulled=None, vintage='Challenge coordinate supplied by the team', use='Pin at 38.99487, −77.02489; dashed 600 m study outline matches the food-and-drink query.', note='The circle is a search radius, not an official district boundary. Census counts always cover the whole selected Census area.'),
        dict(name='Esri Light Gray basemap', url='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer', pulled=None, vintage='Tiles loaded live', use='Muted street context under Census colors and orange food/drink dots.', note='Tiles © Esri, HERE, Garmin, OpenStreetMap contributors and the GIS user community. Places © OpenStreetMap contributors. Tiles require a network connection; committed polygons and places do not.'),
    ]
    (ROOT/'data/processed/sources.json').write_text(json.dumps(catalog, indent=2)+'\n')
if __name__ == '__main__':
    build()
