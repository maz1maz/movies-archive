import csv,gzip,json
cands=json.load(open('/home/user/work/cands3.json'))
allt=set()
for v in cands.values():
    for c in v: allt.add(c['t'])
print("tconsts",len(allt))
ratings={}
with gzip.open('/home/user/work/imdb/title.ratings.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in allt: ratings[r[0]]=(r[1],int(r[2]))
crew={}; need=set()
with gzip.open('/home/user/work/imdb/title.crew.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in allt:
            d=[x for x in r[1].split(',') if x.startswith('nm')]
            crew[r[0]]=d; need.update(d)
prin={}
with gzip.open('/home/user/work/imdb/title.principals.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in allt and r[3] in ('actor','actress','self'):
            prin.setdefault(r[0],[]).append((int(r[1]),r[2])); need.add(r[2])
names={}
with gzip.open('/home/user/work/imdb/name.basics.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in need: names[r[0]]=r[1]
print("ratings",len(ratings),"crew",len(crew),"prin",len(prin),"names",len(names))
json.dump({'ratings':ratings,'crew':crew,'prin':prin,'names':names},open('/home/user/work/meta.json','w'))
