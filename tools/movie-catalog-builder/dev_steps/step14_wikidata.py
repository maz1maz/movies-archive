import json,urllib.request,urllib.parse,time,os,sys

picked=json.load(open('/home/user/work/picked_final.json'))
ids=sorted({v['c']['t'] for v in picked.values() if v and v.get('c')})
print("ids",len(ids))
OUT='/home/user/work/wd.json'
done=json.load(open(OUT)) if os.path.exists(OUT) else {}
todo=[i for i in ids if i not in done]
print("todo",len(todo))

Q='''SELECT ?imdb ?origLabel ?countryLabel ?studioLabel ?image ?mpa ?enwiki WHERE {
  VALUES ?imdb { %s }
  ?item wdt:P345 ?imdb .
  OPTIONAL { ?item wdt:P1476 ?orig }
  OPTIONAL { ?item wdt:P495 ?country }
  OPTIONAL { ?item wdt:P272 ?studio }
  OPTIONAL { ?item wdt:P3383 ?image }
  OPTIONAL { ?item p:P1657 ?st . ?st ps:P1657 ?mpaq . ?mpaq rdfs:label ?mpa FILTER(lang(?mpa)="en") }
  OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}'''

def run(batch):
    vals=' '.join('"%s"'%b for b in batch)
    url='https://query.wikidata.org/sparql?format=json&query='+urllib.parse.quote(Q%vals)
    req=urllib.request.Request(url,headers={'User-Agent':'MovieCatalogBot/1.0','Accept':'application/sparql-results+json'})
    return json.loads(urllib.request.urlopen(req,timeout=180).read())

B=50
for k in range(0,len(todo),B):
    batch=todo[k:k+B]
    for attempt in range(4):
        try:
            d=run(batch); break
        except Exception as e:
            print("retry",attempt,e); time.sleep(5*(attempt+1))
    else:
        print("FAIL batch",k); continue
    agg={}
    for b in d['results']['bindings']:
        i=b['imdb']['value']
        a=agg.setdefault(i,{'orig':None,'country':set(),'studio':set(),'image':None,'mpa':set(),'wiki':None})
        if 'origLabel' in b and not a['orig']: a['orig']=b['origLabel']['value']
        if 'countryLabel' in b: a['country'].add(b['countryLabel']['value'])
        if 'studioLabel' in b: a['studio'].add(b['studioLabel']['value'])
        if 'image' in b and not a['image']: a['image']=b['image']['value']
        if 'mpa' in b: a['mpa'].add(b['mpa']['value'])
        if 'enwiki' in b and not a['wiki']: a['wiki']=b['enwiki']['value']
    for i in batch:
        a=agg.get(i)
        done[i]= None if not a else {'orig':a['orig'],'country':sorted(a['country']),
            'studio':sorted(a['studio']),'image':a['image'],'mpa':sorted(a['mpa']),'wiki':a['wiki']}
    json.dump(done,open(OUT,'w'))
    print(f"{k+len(batch)}/{len(todo)} hits={sum(1 for i in batch if done.get(i))}", flush=True)
    time.sleep(1)
print("done", sum(1 for v in done.values() if v),"/",len(done))
