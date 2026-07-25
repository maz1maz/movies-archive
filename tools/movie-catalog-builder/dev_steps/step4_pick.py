import csv,json,re,unicodedata
def norm(s):
    s=unicodedata.normalize('NFKD',s); s=''.join(c for c in s if not unicodedata.combining(c))
    s=s.lower().replace('&',' and '); s=re.sub(r"[^a-z0-9]+"," ",s).strip()
    s=re.sub(r"^(the|a|an|le|la|les|el|il|un|une|der|die|das) ","",s)
    return re.sub(r"\s+"," ",s)
def nname(s):
    s=unicodedata.normalize('NFKD',s); s=''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z ]+","",s.lower()).strip()

cands=json.load(open('/home/user/work/cands_basics.json'))
st=json.load(open('/home/user/work/step2.json'))
names=json.load(open('/home/user/work/names.json'))
ratings,crew,prin=st['ratings'],st['crew'],st['prin']
rows=list(csv.DictReader(open('/home/user/uploads/Archive-Full-Completed.csv',encoding='utf-8',errors='replace')))

TYPEW={'movie':3,'tvMovie':1,'video':0,'tvSpecial':0,'short':-2}
picked={}; unmatched=[]
for r in rows:
    key=norm(r['Title']); 
    cl=cands.get(key,[])
    if not cl:
        unmatched.append(r['#']); continue
    try: cy=int(r['Year'])
    except: cy=None
    cdir=set(nname(x) for x in re.split(r',',r['Director'] or '') if nname(x))
    best=None;bs=-99
    for c in cl:
        s=TYPEW.get(c['type'],0)
        try: y=int(c['y'])
        except: y=None
        if cy and y:
            d=abs(cy-y)
            s += 8 if d==0 else (4 if d==1 else (1 if d<=2 else -6))
        dirs=set(nname(names.get(n,'')) for n in crew.get(c['t'],[]) if names.get(n))
        if cdir and dirs:
            # match on last name at least
            hit=False
            for a in cdir:
                for b in dirs:
                    if a==b or (a.split()[-1]==b.split()[-1] and a.split()[0][:1]==b.split()[0][:1]): hit=True
            s += 10 if hit else -4
        if c['t'] in ratings:
            s += 2 + min(3, int(ratings[c['t']][1])/20000)
        if s>bs: bs=s; best=c
    if bs < 5:
        unmatched.append(r['#'])
    picked[r['#']]={'c':best,'score':bs}

print("matched:",len(picked),"unmatched:",len(unmatched))
json.dump({'picked':picked,'unmatched':unmatched},open('/home/user/work/picked.json','w'))
print(unmatched[:40])
