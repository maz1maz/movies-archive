// تبدیل برچسب «دوره‌ی زمانی» Wikidata (P2408) به بازه‌ی سال، برای چیدن روی
// خط زمان. برچسب‌ها ناهمگونن: قرن («19th century»)، دهه («1940s»)، سال
// («1944»)، تاریخ («October 1988»)، و دوره‌های اسم‌دار («Victorian era»).
// اسم‌دارها از جدول دستی پایین میان؛ هرچی شناخته نشه null برمی‌گرده و
// تو بخش «Other» نشون داده می‌شه.

const NAMED = {
  prehistory: [-100000, -3000],
  'stone age': [-100000, -3000],
  'lower paleolithic': [-3000000, -300000],
  paleocene: [-66000000, -56000000],
  'bronze age': [-3300, -1200],
  'iron age': [-1200, -500],
  'classical antiquity': [-800, 500],
  'ancient history': [-3000, 500],
  'roman republic': [-509, -27],
  'ancient rome': [-753, 476],
  'warring states period': [-475, -221],
  'han–xiongnu wars': [-133, 89],
  'the exodus': [-1300, -1200],
  'tang dynasty': [618, 907],
  'heian period': [794, 1185],
  'viking age': [793, 1066],
  'middle ages': [500, 1500],
  'early middle ages': [500, 1000],
  'high middle ages': [1000, 1300],
  'late middle ages': [1300, 1500],
  'england in the high middle ages': [1066, 1272],
  'england in the late middle ages': [1272, 1485],
  'first war of scottish independence': [1296, 1328],
  "hundred years' war": [1337, 1453],
  'muromachi period': [1336, 1573],
  'sengoku period': [1467, 1615],
  renaissance: [1400, 1600],
  'protestant reformation': [1517, 1648],
  'tudor period': [1485, 1603],
  'elizabethan era': [1558, 1603],
  'french wars of religion': [1562, 1598],
  "st. bartholomew's day massacre": [1572, 1572],
  'edo period': [1603, 1868],
  'grand siècle': [1610, 1715],
  'franco-spanish war': [1635, 1659],
  'war of the spanish succession': [1701, 1714],
  'georgian era': [1714, 1837],
  "seven years' war": [1756, 1763],
  'american revolution': [1765, 1791],
  'french revolution': [1789, 1799],
  'napoleonic wars': [1803, 1815],
  'regency era': [1811, 1820],
  'july monarchy': [1830, 1848],
  'paris uprising of 1832': [1832, 1832],
  'victorian era': [1837, 1901],
  'texas–indian wars': [1820, 1875],
  'american civil war': [1861, 1865],
  'reconstruction era': [1865, 1877],
  'american frontier': [1865, 1895],
  'wild west': [1865, 1895],
  'meiji era': [1868, 1912],
  'gilded age': [1870, 1900],
  'belle époque': [1871, 1914],
  'war of currents': [1886, 1893],
  "world's columbian exposition": [1893, 1893],
  wilhelminism: [1890, 1918],
  'edwardian era': [1901, 1910],
  'world war i': [1914, 1918],
  'gallipoli campaign': [1915, 1916],
  'russian civil war': [1917, 1923],
  'interwar period': [1918, 1939],
  'irish war of independence': [1919, 1921],
  'weimar republic': [1918, 1933],
  'irish civil war': [1922, 1923],
  'roaring twenties': [1920, 1929],
  'jazz age': [1920, 1929],
  prohibition: [1920, 1933],
  'korea under japanese rule': [1910, 1945],
  'great depression': [1929, 1939],
  'great depression in the united states': [1929, 1939],
  'shōwa era': [1926, 1989],
  'spanish civil war': [1936, 1939],
  'second sino-japanese war': [1937, 1945],
  kristallnacht: [1938, 1938],
  'world war ii': [1939, 1945],
  'the holocaust': [1941, 1945],
  'continuation war': [1941, 1944],
  'guadalcanal campaign': [1942, 1943],
  'german military administration in occupied france during world war ii': [1940, 1944],
  'defense of the polish post office in danzig': [1939, 1939],
  'sobibór uprising': [1943, 1943],
  'liberation of auschwitz concentration camp': [1945, 1945],
  'aftermath of world war ii': [1945, 1950],
  'flight and expulsion of germans': [1944, 1950],
  'reconstruction of germany': [1945, 1955],
  'reconstruction in france': [1945, 1955],
  'postwar japan': [1945, 1952],
  'greek civil war': [1946, 1949],
  'first indochina war': [1946, 1954],
  'cold war': [1947, 1991],
  'korean war': [1950, 1953],
  'great chinese famine': [1959, 1961],
  'civil rights movement': [1954, 1968],
  'vietnam war': [1955, 1975],
  'cuban missile crisis': [1962, 1962],
  'assassination of john f. kennedy': [1963, 1963],
  'selma to montgomery marches': [1965, 1965],
  'cultural revolution': [1966, 1976],
  'swinging sixties': [1960, 1969],
  'may 68': [1968, 1968],
  'protests of 1968': [1968, 1968],
  'prague spring': [1968, 1968],
  'warsaw pact invasion of czechoslovakia': [1968, 1968],
  'assassination of martin luther king jr.': [1968, 1968],
  'the troubles': [1968, 1998],
  'mishima incident': [1970, 1970],
  'munich massacre': [1972, 1972],
  'iranian revolution': [1978, 1979],
  'soviet-afghan war': [1979, 1989],
  perestroika: [1985, 1991],
  'june struggle': [1987, 1987],
  'disinvestment from south africa': [1977, 1994],
  'war in bosnia and herzegovina': [1992, 1995],
  'srebrenica massacre': [1995, 1995],
  'september 11 attacks': [2001, 2001],
  'great recession': [2007, 2009],
  'syrian civil war': [2011, 2024],
  'covid-19 pandemic': [2019, 2023],
  'present day': [2020, 2026],
  future: [2030, 2100],
  'world war iii': [2030, 2100],
  'far future': [3000, 10000],
}

const ORD = /^(\d+)(?:st|nd|rd|th) (century|millennium)( bc| bce)?$/

export function periodRange(label) {
  const l = (label || '').trim().toLowerCase()
  if (!l || l.startsWith('http')) return null
  if (NAMED[l]) return NAMED[l]
  const ord = ORD.exec(l)
  if (ord) {
    const n = Number(ord[1])
    const size = ord[2] === 'century' ? 100 : 1000
    const bc = Boolean(ord[3])
    return bc ? [-n * size, -(n - 1) * size - 1] : [(n - 1) * size + 1, n * size]
  }
  let m = /^(\d{3,4})s$/.exec(l)
  if (m) {
    const y = Number(m[1])
    // «1900s» در Wikidata معمولاً دهه است، نه قرن
    return [y, y + 9]
  }
  m = /^(\d{3,4})$/.exec(l)
  if (m) return [Number(m[1]), Number(m[1])]
  // تاریخ‌هایی مثل «October 1988» یا «September 5, 1972»
  m = /\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/.exec(l)
  if (m) return [Number(m[1]), Number(m[1])]
  return null
}

// «1939–1945»، «1940s»، «19th c.»، «500 BC–…»
export function formatRange([a, b]) {
  const y = (n) => (n < 0 ? `${Math.abs(n).toLocaleString('en')} BC` : String(n))
  return a === b ? y(a) : `${y(a)}–${y(b)}`
}

// سرفصل قرنِ یه سال شروع، برای گروه‌بندی خط زمان و مایند مپ
export function centuryBucket(start) {
  if (start > 2026) return { key: 99999, label: 'Future' }
  if (start < 1500) return { key: -99999, label: 'Before 1500' }
  const c = Math.floor((start - 1) / 100)
  const n = c + 1
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'
  return { key: c, label: `${n}${suffix} century` }
}
