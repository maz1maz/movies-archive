import json, urllib.request, urllib.parse, time, os
from concurrent.futures import ThreadPoolExecutor

picked = json.load(open('/home/user/work/picked_final.json'))
ids = sorted({v['c']['t'] for v in picked.values() if v and v.get('c')})
OUT = '/home/user/work/wd.json'
done = json.load(open(OUT)) if os.path.exists(OUT) else {}
todo = [i for i in ids if i not in done]
print("todo", len(todo), flush=True)

Q = '''SELECT ?imdb ?orig ?countryLabel ?studioLabel ?image ?mpaLabel ?enwiki WHERE {
  VALUES ?imdb { %s }
  ?item wdt:P345 ?imdb .
  OPTIONAL { ?item wdt:P1476 ?orig }
  OPTIONAL { ?item wdt:P495 ?country }
  OPTIONAL { ?item wdt:P272 ?studio }
  OPTIONAL { ?item wdt:P3383 ?image }
  OPTIONAL { ?item wdt:P1657 ?mpa }
  OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}'''


def run(batch):
    vals = ' '.join('"%s"' % b for b in batch)
    url = 'https://query.wikidata.org/sparql?format=json&query=' + urllib.parse.quote(Q % vals)
    req = urllib.request.Request(url, headers={
        'User-Agent': 'MovieCatalogBot/1.0 (personal collection catalog)',
        'Accept': 'application/sparql-results+json'})
    return json.loads(urllib.request.urlopen(req, timeout=120).read())


def work(batch):
    for a in range(3):
        try:
            return batch, run(batch)
        except Exception:
            time.sleep(3 * (a + 1))
    return batch, None


B = 12
batches = [todo[i:i + B] for i in range(0, len(todo), B)]
n = 0
with ThreadPoolExecutor(max_workers=4) as ex:
    for batch, d in ex.map(work, batches):
        n += len(batch)
        if d is None:
            print("fail", batch[0], flush=True)
            continue
        agg = {}
        for b in d['results']['bindings']:
            i = b['imdb']['value']
            a = agg.setdefault(i, {'orig': None, 'country': set(), 'studio': set(),
                                   'image': None, 'mpa': set(), 'wiki': None})
            if 'orig' in b and not a['orig']:
                a['orig'] = b['orig']['value']
            if 'countryLabel' in b:
                a['country'].add(b['countryLabel']['value'])
            if 'studioLabel' in b:
                a['studio'].add(b['studioLabel']['value'])
            if 'image' in b and not a['image']:
                a['image'] = b['image']['value']
            if 'mpaLabel' in b:
                a['mpa'].add(b['mpaLabel']['value'])
            if 'enwiki' in b and not a['wiki']:
                a['wiki'] = b['enwiki']['value']
        for i in batch:
            a = agg.get(i)
            done[i] = None if not a else {
                'orig': a['orig'], 'country': sorted(a['country']),
                'studio': sorted(a['studio']), 'image': a['image'],
                'mpa': sorted(a['mpa']), 'wiki': a['wiki']}
        json.dump(done, open(OUT, 'w'))
        print("%d/%d" % (n, len(todo)), flush=True)
print("DONE", sum(1 for v in done.values() if v), len(done), flush=True)
