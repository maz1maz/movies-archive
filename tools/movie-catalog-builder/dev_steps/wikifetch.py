import json, urllib.request, urllib.parse, time, os, re
from concurrent.futures import ThreadPoolExecutor

wd = json.load(open('/home/user/work/wd.json'))
picked = json.load(open('/home/user/work/picked_final.json'))
ids = sorted({v['c']['t'] for v in picked.values() if v and v.get('c')})

OUT = '/home/user/work/syn.json'
done = json.load(open(OUT)) if os.path.exists(OUT) else {}

tasks = []
for i in ids:
    if i in done:
        continue
    w = (wd.get(i) or {}).get('wiki')
    if w:
        tasks.append((i, urllib.parse.unquote(w.rsplit('/', 1)[-1])))
print("tasks", len(tasks), flush=True)


def fetch(t):
    tid, page = t
    url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(page, safe='')
    for a in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'MovieCatalogBot/1.0 (catalog)'})
            d = json.loads(urllib.request.urlopen(req, timeout=45).read())
            return tid, {'extract': d.get('extract'),
                         'thumb': (d.get('originalimage') or d.get('thumbnail') or {}).get('source'),
                         'desc': d.get('description')}
        except Exception as e:
            if getattr(e, 'code', None) == 404:
                return tid, None
            time.sleep(1.5 * (a + 1))
    return tid, None


n = 0
with ThreadPoolExecutor(max_workers=2) as ex:
    for tid, res in ex.map(fetch, tasks):
        done[tid] = res
        n += 1
        if n % 25 == 0:
            json.dump(done, open(OUT, 'w'))
            print("%d/%d" % (n, len(tasks)), flush=True)
json.dump(done, open(OUT, 'w'))
print("DONE", sum(1 for v in done.values() if v), len(done), flush=True)
