import csv,gzip,json
aka=json.load(open('/home/user/work/aka_hits.json'))
need=set()
for v in aka.values(): need.update(v)
recs={}
with gzip.open('/home/user/work/imdb/title.basics.tsv.gz','rt',encoding='utf-8',errors='replace',newline='') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for row in rd:
        if len(row)>=9 and row[0] in need:
            recs[row[0]]={'t':row[0],'type':row[1],'prim':row[2],'orig':row[3],'y':row[5],'ey':row[6],'rt':row[7],'g':row[8]}
cands=json.load(open('/home/user/work/cands2.json'))
added=0
for k,ts in aka.items():
    lst=cands.setdefault(k,[])
    have={c['t'] for c in lst}
    for t in ts:
        if t in recs and t not in have and recs[t]['type'] in ('movie','tvMovie','video','tvSpecial','short','tvSeries','tvMiniSeries'):
            lst.append(recs[t]); added+=1
print("added",added,"total keys",len(cands))
json.dump(cands,open('/home/user/work/cands3.json','w'))
