import csv,gzip,json
OVR={
 '182':'tt1780967',   # Seberg (aka Against All Enemies)
 '207':'tt0103644',   # Alien 3
 '224':'tt0069390',   # Tutti i colori del buio
 '648':'tt7713068',   # Birds of Prey (Harley Quinn)
 '779':'tt0080464',   # The Boogey Man 1980
 '828':'tt10410506',  # Brainwashed: Sex-Camera-Power
 '157':'tt7711170',   # Alone (2020, John Hyams)
}
need=set(OVR.values())
recs={}
with gzip.open('/home/user/work/imdb/title.basics.tsv.gz','rt',encoding='utf-8',errors='replace',newline='') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in need:
            recs[r[0]]={'t':r[0],'type':r[1],'prim':r[2],'orig':r[3],'y':r[5],'ey':r[6],'rt':r[7],'g':r[8]}
p=json.load(open('/home/user/work/picked_final.json'))
for k,v in OVR.items(): p[k]={'c':recs[v],'score':99}
json.dump(p,open('/home/user/work/picked_final.json','w'))
print("overrides applied", len(recs))

# pull meta for these
M=json.load(open('/home/user/work/meta.json'))
newneed=set()
with gzip.open('/home/user/work/imdb/title.ratings.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in need: M['ratings'][r[0]]=(r[1],int(r[2]))
with gzip.open('/home/user/work/imdb/title.crew.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in need:
            d=[x for x in r[1].split(',') if x.startswith('nm')]
            M['crew'][r[0]]=d; newneed.update(d)
with gzip.open('/home/user/work/imdb/title.principals.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in need and r[3] in ('actor','actress','self'):
            M['prin'].setdefault(r[0],[]).append((int(r[1]),r[2])); newneed.add(r[2])
newneed-=set(M['names'])
if newneed:
    with gzip.open('/home/user/work/imdb/name.basics.tsv.gz','rt',encoding='utf-8') as f:
        rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
        for r in rd:
            if r[0] in newneed: M['names'][r[0]]=r[1]
json.dump(M,open('/home/user/work/meta.json','w'))
print("meta updated")
