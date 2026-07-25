import json, urllib.request, urllib.parse, time, os
from concurrent.futures import ThreadPoolExecutor

EP = 'https://qlever.cs.uni-freiburg.de/api/wikidata/'
picked = json.load(open('/home/user/work/picked_final.json'))
ids = sorted({v['c']['t'] for v in picked.values() if v and v.get('c')})
OUT = '/home/user/work/wd.json'
done = json.load(open(OUT)) if os.path.exists(OUT) else {}
todo = [i for i in ids if i not in done]
print("todo", len(todo), flush=True)

PRE = '''PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
'''

Q = PRE + '''SELECT ?imdb ?orig ?cl ?sl ?image ?ml ?enwiki WHERE {
  VALUES ?imdb { %s }
  ?item wdt:P345 ?imdb .
  OPTIONAL { ?item wdt:P1476 ?orig }
  OPTIONAL { ?item wdt:P495 ?c . ?c rdfs:label ?cl . FILTER(lang(?cl)="en") }
  OPTIONAL { ?item wdt:P272 ?s . ?s rdfs:label ?sl . FILTER(lang(?sl)="en") }
  OPTIONAL { ?item wdt:P3383 ?image }
  OPTIONAL { ?item wdt:P1657 ?m . ?m rdfs:label ?ml . FILTER(lang(?ml)="en") }
  OPTIONAL { ?enwiki schema:about ?item . ?enwiki schema:isPartOf <https://en.wikipedia.org/> }
}'''


def run(batch):
    vals = ' '.join('"%s"' % b for b in batch)
    u = EP + '?' + urllib.parse.urlencode({'query': Q % vals})
    req = urllib.request.Request(u, headers={
        'User-Agent': 'MovieCatalogBot/1.0', 'Accept': 'application/sparql-results+json'})
    return json.loads(urllib.request.urlopen(req, timeout=180).read())


def work(batch):
    for a in range(3):
        try:
            return batch, run(batch)
        except Exception as e:
            if a == 2:
                print('ERR', batch[0], e, flush=True)
            time.sleep(2 * (a + 1))
    return batch, None


def val(b, k):
    return b[k]['value'] if k in b else None


B = 25
batches = [todo[i:i + B] for i in range(0, len(todo), B)]
n = 0
with ThreadPoolExecutor(max_workers=4) as ex:
    for batch, d in ex.map(work, batches):
        n += len(batch)
        if d is None:
            continue
        agg = {}
        for b in d['results']['bindings']:
            i = val(b, 'imdb')
            if not i:
                continue
            a = agg.setdefault(i, {'orig': set(), 'country': set(), 'studio': set(),
                                   'image': None, 'mpa': set(), 'wiki': None})
            if val(b, 'orig'):
                a['orig'].add(val(b, 'orig'))
            if val(b, 'cl'):
                a['country'].add(val(b, 'cl'))
            if val(b, 'sl'):
                a['studio'].add(val(b, 'sl'))
            if val(b, 'image') and not a['image']:
                a['image'] = val(b, 'image')
            if val(b, 'ml'):
                a['mpa'].add(val(b, 'ml'))
            if val(b, 'enwiki') and not a['wiki']:
                a['wiki'] = val(b, 'enwiki')
        for i in batch:
            a = agg.get(i)
            done[i] = None if not a else {
                'orig': sorted(a['orig']), 'country': sorted(a['country']),
                'studio': sorted(a['studio']), 'image': a['image'],
                'mpa': sorted(a['mpa']), 'wiki': a['wiki']}
        json.dump(done, open(OUT, 'w'))
        print("%d/%d" % (n, len(todo)), flush=True)
print("DONE", sum(1 for v in done.values() if v), len(done), flush=True)
