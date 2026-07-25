import csv,gzip,json
fc=json.load(open('/home/user/work/fix_cands.json'))
allt={c['t'] for v in fc.values() for c in v}
print(len(allt))
M=json.load(open('/home/user/work/meta.json'))
new={'ratings':{},'crew':{},'prin':{},'names':{}}
need=set()
with gzip.open('/home/user/work/imdb/title.ratings.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in allt: new['ratings'][r[0]]=(r[1],int(r[2]))
with gzip.open('/home/user/work/imdb/title.crew.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in allt:
            d=[x for x in r[1].split(',') if x.startswith('nm')]
            new['crew'][r[0]]=d; need.update(d)
with gzip.open('/home/user/work/imdb/title.principals.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in allt and r[3] in ('actor','actress','self'):
            new['prin'].setdefault(r[0],[]).append((int(r[1]),r[2])); need.add(r[2])
need-=set(M['names'])
with gzip.open('/home/user/work/imdb/name.basics.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in need: new['names'][r[0]]=r[1]
for k in new: M[k].update(new[k])
json.dump(M,open('/home/user/work/meta.json','w'))
print({k:len(v) for k,v in M.items()})
