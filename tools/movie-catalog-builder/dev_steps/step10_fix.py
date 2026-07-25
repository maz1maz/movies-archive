import csv,gzip,json,sys,re,difflib
sys.path.insert(0,'/home/user/work')
from keys import norm, variants, strip_acc

# manual title corrections (typos / alt titles) -> better search title
FIX = {
 '46':'Un coeur en hiver','135':'Acasa, My Home','164':'Adela jeste nevecerela',
 '186':'The Wild Pear Tree','222':'All Summers End','224':'All the Colors of the Dark',
 '310':'Anita','639':'Bill & Ted Face the Music','669':'Black Dahlia','670':'The Black Dahlia',
 '727':'Blood and Black Lace','818':'The Boys Next Door','881':'The Brothers Grimsby',
 '924':'Cars','933':'All About Lily Chou-Chou','934':'Marina Abramovic: The Artist Is Present',
 '139':'Accident','367':'Arthur','148':'Adoption','121':'Buck Privates',
 '61':'Pope Francis: A Man of His Word','578':'My Journey Through French Cinema',
 '459':'Land of Mine','932':'Bluebeard\'s Eighth Wife','304':'Angst',
 '722':'Blood and Flowers','671':'The Sun at Midnight',
}
# rows that are box sets / not single films -> leave unmatched
BOXSET = {'190','759','925','935','367','121'}

rows={r['#']:r for r in csv.DictReader(open('/home/user/work/fixed.csv',encoding='utf-8'))}
low=json.load(open('/home/user/work/low.json'))
targets=[x[0] for x in low]
print("targets",len(targets))

want={}
for i in targets:
    r=rows[i]
    t=FIX.get(i, r['Title'])
    for v in variants(t): want.setdefault(v,set()).add(i)
print("keys",len(want))

found={}
with gzip.open('/home/user/work/imdb/title.basics.tsv.gz','rt',encoding='utf-8',errors='replace',newline='') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for row in rd:
        if len(row)<9: continue
        if row[1] not in ('movie','tvMovie','video','tvSpecial','short','tvSeries','tvMiniSeries'): continue
        for t in {row[2],row[3]}:
            n=norm(t)
            if n in want:
                found.setdefault(n,[]).append({'t':row[0],'type':row[1],'prim':row[2],'orig':row[3],'y':row[5],'ey':row[6],'rt':row[7],'g':row[8]})
                break
print("found keys",len(found))
json.dump(found,open('/home/user/work/fix_cands.json','w'))
json.dump({'FIX':FIX,'BOXSET':sorted(BOXSET),'targets':targets},open('/home/user/work/fix_meta.json','w'))
