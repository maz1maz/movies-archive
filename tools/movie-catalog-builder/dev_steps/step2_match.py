import csv, gzip, json, re, unicodedata
cands=json.load(open('/home/user/work/cands_basics.json'))
allt=set()
for v in cands.values():
    for c in v: allt.add(c['t'])
print("candidate tconsts:", len(allt))

ratings={}
with gzip.open('/home/user/work/imdb/title.ratings.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in allt: ratings[r[0]]=(r[1],r[2])
print("ratings",len(ratings))

crew={}
need_names=set()
with gzip.open('/home/user/work/imdb/title.crew.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in allt:
            d=[x for x in r[1].split(',') if x.startswith('nm')]
            crew[r[0]]=d
            need_names.update(d)
print("crew",len(crew))

# principals: actors for candidates
prin={}
with gzip.open('/home/user/work/imdb/title.principals.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in allt and r[3] in ('actor','actress','self'):
            prin.setdefault(r[0],[]).append((int(r[1]), r[2]))
            need_names.add(r[2])
print("principals",len(prin))
json.dump({'ratings':ratings,'crew':crew,'prin':prin}, open('/home/user/work/step2.json','w'))
json.dump(sorted(need_names), open('/home/user/work/need_names.json','w'))
