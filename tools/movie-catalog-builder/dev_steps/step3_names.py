import csv,gzip,json
need=set(json.load(open('/home/user/work/need_names.json')))
names={}
with gzip.open('/home/user/work/imdb/name.basics.tsv.gz','rt',encoding='utf-8') as f:
    rd=csv.reader(f,delimiter='\t',quoting=csv.QUOTE_NONE); next(rd)
    for r in rd:
        if r[0] in need: names[r[0]]=r[1]
print(len(names),"/",len(need))
json.dump(names,open('/home/user/work/names.json','w'))
