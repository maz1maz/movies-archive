import csv,gzip,json,sys
sys.path.insert(0,'/home/user/work')
from keys import norm, variants

rows=list(csv.DictReader(open('/home/user/work/fixed.csv',encoding='utf-8')))
print("rows",len(rows))
want={}
for r in rows:
    for v in variants(r['Title']): want.setdefault(v,set()).add(r['#'])
print("want keys",len(want))

cands={}
def add(k,rec):
    cands.setdefault(k,{})[rec['t']]=rec

with gzip.open('/home/user/work/imdb/title.basics.tsv.gz','rt',encoding='utf-8',errors='replace',newline='') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for row in rd:
        if len(row)<9: continue
        tconst,ttype,prim,orig,adult,sy,ey,rt,gen=row[:9]
        if ttype not in ('movie','tvMovie','video','tvSpecial','short','tvSeries','tvMiniSeries'): continue
        rec=None
        for t in {prim,orig}:
            n=norm(t)
            if n in want:
                rec={'t':tconst,'type':ttype,'prim':prim,'orig':orig,'y':sy,'ey':ey,'rt':rt,'g':gen}
                add(n,rec)
print("after basics:",len(cands))
json.dump({k:list(v.values()) for k,v in cands.items()}, open('/home/user/work/cands2.json','w'))
json.dump({k:sorted(v) for k,v in want.items()}, open('/home/user/work/want2.json','w'))
