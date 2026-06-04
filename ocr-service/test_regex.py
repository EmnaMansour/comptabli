import re
regex = re.compile(
    r'^(?P<desc>[A-Za-z\u00c0-\u017f][A-Za-z\u00c0-\u017f0-9\s\-\./,&\\'']{2,80}?)'
    r'\s+(?P<qty>\d+(?:[,\.]\d+)?)'
    r'(?:\s+[a-zA-Z]{1,10})?'
    r'\s+(?:(?:TND|EUR|\u20ac|DT|USD|\$|MAD|GBP|\u00a3)\s*)?'
    r'(?P<rate>[\d][\d\s,\.]{1,15})'
    r'(?:[\s\d,\.%€TNDUSD]+)?'
    r'\s+(?:(?:TND|EUR|\u20ac|DT|USD|\$|MAD|GBP|\u00a3)\s*)?'
    r'(?P<amount>[\d][\d\s,\.]{1,15})'
    r'(?:\s*(?:TND|EUR|\u20ac|DT|USD|\$|MAD|GBP|\u00a3))?\s*$',
    re.IGNORECASE,
)
for ligne in [
    'Main-d\'œuvre   5    h     60,00 €     20 %     60,00 €    360,00 €',
    'Produit         10   pcs   105,00 €    20 %     210,00 €   1 260,00 €'
]:
    m = regex.match(ligne)
    if m: print(m.groupdict())
    else: print('No match for', ligne)

