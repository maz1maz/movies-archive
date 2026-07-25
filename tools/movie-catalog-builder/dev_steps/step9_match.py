import csv,json,re,sys,unicodedata
sys.path.insert(0,'/home/user/work')
from keys import norm, variants, strip_acc

cands=json.load(open('/home/user/work/cands3.json'))
M=json.load(open('/home/user/work/meta.json'))
ratings,crew,prin,names=M['ratings'],M['crew'],M['prin'],M['names']
rows=list(csv.DictReader(open('/home/user/work/fixed.csv',encoding='utf-8')))

def nname(s):
    s=strip_acc(s).lower()
    return re.sub(r"[^a-z ]+"," ",s).strip()

def dirset(s):
    s=(s or '').replace(' and ',',')
    out=set()
    for x in re.split(r'[,/&]', s):
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
picked={}; low=[]
for r in rows:
    vs=variants(r['Title'])
    pool={}
    for v in vs:
        for c in cands.get(v,[]): pool[c['t']]=c
    if not pool:
        picked[r['#']]=None; low.append((r['#'],r['Title'],'NO-CAND',0)); continue
    try: cy=int(r['Year'])
    except: cy=None
    cd=dirset(r['Director'])
    exact = norm(r['Title'])
    best=None;bs=-99
    for c in pool.values():
        s=TYPEW.get(c['type'],0)
        if norm(c['prim'])==exact or norm(c['orig'])==exact: s+=3
        try: y=int(c['y'])
        except: y=None
        if cy and y:
            d=abs(cy-y)
            s += 9 if d==0 else (5 if d==1 else (2 if d<=2 else -7))
        elif cy and not y: s-=2
        ds={nname(names[n]) for n in crew.get(c['t'],[]) if n in names}
        if cd and ds:
            s += 12 if any(dmatch(a,b) for a in cd for b in ds) else -6
        elif cd and not ds: s-=1
        if c['t'] in ratings:
            v=ratings[c['t']][1]
            s += 2 + min(4, v**0.5/120)
        else: s-=1
        if s>bs: bs=s; best=c
    picked[r['#']]={'c':best,'score':round(bs,2)}
    if bs<8: low.append((r['#'],r['Title'],best['prim'] if best else '',round(bs,2)))
print("total",len(picked),"weak/none",len(low))
json.dump(picked,open('/home/user/work/picked2.json','w'))
json.dump(low,open('/home/user/work/low.json','w'))
for x in low[:60]: print(x)
