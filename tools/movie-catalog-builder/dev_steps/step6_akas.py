import csv,gzip,json,sys
sys.path.insert(0,'/home/user/work')
from keys import norm
want=json.load(open('/home/user/work/want2.json'))
cands=json.load(open('/home/user/work/cands2.json'))
missing=set(want)-set(cands)
print("missing keys:",len(missing))
hits={}
with gzip.open('/home/user/work/imdb/title.akas.tsv.gz','rt',encoding='utf-8',errors='replace',newline='') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for row in rd:
        if len(row)<4: continue
        n=norm(row[2])
        if n in missing:
            hits.setdefault(n,set()).add(row[0])
print("aka hits keys:",len(hits), "tconsts:",sum(len(v) for v in hits.values()))
json.dump({k:sorted(v)[:60] for k,v in hits.items()}, open('/home/user/work/aka_hits.json','w'))
