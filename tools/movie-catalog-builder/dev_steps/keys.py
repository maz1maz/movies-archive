import re, unicodedata

def strip_acc(s):
    s=unicodedata.normalize('NFKD',s)
    return ''.join(c for c in s if not unicodedata.combining(c))

def norm(s):
    s=strip_acc(s).lower().replace('&',' and ').replace('ß','ss').replace('ø','o').replace('æ','ae').replace('œ','oe').replace('ð','d').replace('þ','th').replace('ł','l')
    s=re.sub(r"[^a-z0-9?]+"," ",s).strip()
    s=re.sub(r"^(the|a|an|le|la|les|el|il|un|une|der|die|das|los|las) ","",s)
    return re.sub(r"\s+"," ",s)

def variants(title):
    t=title.strip()
    out=set()
    base=[t]
    # "Title, The" -> "The Title"
    m=re.match(r"^(.*),\s*(The|A|An|Der|Die|Das|Le|La|Les|Il|El)$", t, re.I)
    if m: base.append(f"{m.group(2)} {m.group(1)}")
    more=[]
    for b in base:
        more.append(b)
        # remove (Copy N), [..]
        c=re.sub(r"\s*\((?:copy|disc|vol\.?|volume|part)\s*\d+\)\s*$","",b,flags=re.I)
        c=re.sub(r"\s*\(\d{4}\)\s*$","",c)
        more.append(c)
        # split "A / B" and "A (B)"
        if '/' in c:
            more += [p.strip() for p in c.split('/')]
        m2=re.match(r"^(.*?)\s*\((.+)\)\s*$", c)
        if m2:
            more += [m2.group(1).strip(), m2.group(2).strip()]
        # trailing digits: "Avengers 1"
        m3=re.match(r"^(.*?)\s+([12])$", c)
        if m3: more.append(m3.group(1).strip())
    for x in more:
        n=norm(x)
        if len(n)>1: out.add(n)
    return out
