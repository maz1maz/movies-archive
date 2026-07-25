import csv, gzip, re, json, unicodedata

def norm(s):
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = s.replace('&',' and ')
    s = re.sub(r"[^a-z0-9]+"," ",s).strip()
    # drop leading articles
    s = re.sub(r"^(the|a|an|le|la|les|el|il|un|une|der|die|das) ", "", s)
    return re.sub(r"\s+"," ",s)

rows=list(csv.DictReader(open('/home/user/uploads/Archive-Full-Completed.csv',encoding='utf-8',errors='replace')))
want={}
for r in rows:
    n=norm(r['Title'])
    want.setdefault(n,[]).append(r)
print("unique norm titles:", len(want))
json.dump(sorted(want), open('/home/user/work/want.json','w'))

cands={}
with gzip.open('/home/user/work/imdb/title.basics.tsv.gz','rt',encoding='utf-8',errors='replace',newline='') as f:
    rd=csv.reader(f, delimiter='\t', quoting=csv.QUOTE_NONE)
    hdr=next(rd)
    for i,row in enumerate(rd):
        if len(row)<9: continue
        tconst,ttype,prim,orig,adult,sy,ey,rt,gen = row[:9]
        if ttype not in ('movie','tvMovie','video','tvSpecial','short'): continue
        for t in {prim,orig}:
            n=norm(t)
            if n in want:
                cands.setdefault(n,[]).append({'t':tconst,'type':ttype,'prim':prim,'orig':orig,
                    'y':sy,'rt':rt,'g':gen})
                break
print("titles with candidates:", len(cands))
json.dump(cands, open('/home/user/work/cands_basics.json','w'))
