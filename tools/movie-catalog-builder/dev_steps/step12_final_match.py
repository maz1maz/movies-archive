import csv,json,re,sys
sys.path.insert(0,'/home/user/work')
from keys import norm, variants, strip_acc

cands=json.load(open('/home/user/work/cands3.json'))
fc=json.load(open('/home/user/work/fix_cands.json'))
for k,v in fc.items(): cands.setdefault(k,[]).extend(v)
M=json.load(open('/home/user/work/meta.json'))
ratings,crew,prin,names=M['ratings'],M['crew'],M['prin'],M['names']
FM=json.load(open('/home/user/work/fix_meta.json'))
FIX=FM['FIX']; BOX=set(FM['BOXSET'])
rows=list(csv.DictReader(open('/home/user/work/fixed.csv',encoding='utf-8')))

def nname(s):
    return re.sub(r"[^a-z ]+"," ",strip_acc(s).lower()).strip()
def dirset(s):
    out=set()
    for x in re.split(r'[,/&]', (s or '').replace(' and ',',')):
        x=nname(x)
        if x and x not in ('various directors','criterion','various'): out.add(x)
    return out
def dmatch(a,b):
    if a==b: return True
    pa,pb=a.split(),b.split()
    if not pa or not pb: return False
    if pa[-1]==pb[-1] and pa[0][:1]==pb[0][:1]: return True
    if pa[-1]==pb[-1] and (len(pa)==1 or len(pb)==1): return True
    return False
TYPEW={'movie':4,'tvMovie':2,'tvMiniSeries':2,'tvSeries':1,'video':0,'tvSpecial':0,'short':-3}

picked={}; weak=[]
for r in rows:
    i=r['#']
    titles={r['Title']}
    if i in FIX: titles.add(FIX[i])
    vs=set()
    for t in titles: vs|=variants(t)
    pool={}
    for v in vs:
        for c in cands.get(v,[]): pool[c['t']]=c
    if i in BOX or not pool:
        picked[i]=None
        if i not in BOX: weak.append((i,r['Title'],'NONE',0))
        continue
    try: cy=int(r['Year'])
    except: cy=None
    cd=dirset(r['Director'])
    exact={norm(t) for t in titles}
    best=None;bs=-99
    for c in pool.values():
        s=TYPEW.get(c['type'],0)
        if norm(c['prim']) in exact or norm(c['orig']) in exact: s+=3
        try: y=int(c['y'])
        except: y=None
        if cy and y:
            d=abs(cy-y); s += 9 if d==0 else (5 if d==1 else (2 if d<=2 else -7))
        elif cy and not y: s-=2
        ds={nname(names[n]) for n in crew.get(c['t'],[]) if n in names}
        if cd and ds: s += 12 if any(dmatch(a,b) for a in cd for b in ds) else -6
        elif cd and not ds: s-=1
        if c['t'] in ratings: s += 2 + min(4, ratings[c['t']][1]**0.5/120)
        else: s-=1
        if s>bs: bs=s; best=c
    picked[i]={'c':best,'score':round(bs,2)}
    if bs<8: weak.append((i,r['Title'],best['prim'],round(bs,2)))
n_ok=sum(1 for v in picked.values() if v)
print("matched",n_ok,"/",len(rows),"| weak",len(weak),"| boxsets skipped",len(BOX))
json.dump(picked,open('/home/user/work/picked_final.json','w'))
for w in weak: print(w)
