#!/usr/bin/env python3
"""
Genera public/data/shiny-unavailable.json: Pokémon que nunca se han podido
conseguir variocolor (shiny), sacados de la tabla «Events & Un-obtainable Shiny
Pokémon» de Serebii (https://www.serebii.net/games/shiny.shtml).

Solo se guardan los que existen como casilla en la app (especies y formas
regionales); el resto (Pikachu con gorra, Greninja Ash, formas no regionales,
Gigamax…) se ignora y se lista en la salida para revisarlo.

Uso:
  python3 scripts/build-shiny-unavailable.py [--html fichero.html] \
      [--pokedex public/data/pokedex.json] [--out public/data/shiny-unavailable.json]

Sin --html descarga la página. Si la descarga o el análisis fallan, no toca
el fichero existente (sale con código 0 para no romper la actualización mensual).
"""
import argparse
import datetime
import html
import json
import os
import re
import sys
import urllib.request

URL = 'https://www.serebii.net/games/shiny.shtml'

# sufijo de las imágenes de HOME en Serebii -> región (solo formas regionales)
REGION_SUFFIX = {'a': 'alola', 'g': 'galar', 'h': 'hisui', 'p': 'paldea'}
REGION_WORDS = {'alola': 'alola', 'galar': 'galar', 'hisui': 'hisui', 'paldea': 'paldea'}

CELL = re.compile(
    r'<img[^>]+src="/pokemonhome/pokemon/small/(?P<num>\d+)(?:-(?P<suf>[a-z0-9]+))?\.png"'
    r'.*?<td align="center">(?P<label>.*?)</td>',
    re.S | re.I,
)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (poketracker data update)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


def section(page):
    """Recorta la parte de la página con la tabla de shinies imposibles."""
    start = page.find('Un-obtainable Shiny')
    if start < 0:
        start = page.find('Unavailable Shiny')
    if start < 0:
        raise ValueError('no encuentro la sección «Events & Un-obtainable Shiny Pokémon»')
    end = page.find('Shiny Locks', start)
    return page[start:end if end > 0 else None]


def clean(label):
    text = re.sub(r'<br\s*/?>', ' · ', label, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text)
    return re.sub(r'\s+', ' ', html.unescape(text)).strip(' ·')


def parse(page):
    out = []
    for m in CELL.finditer(section(page)):
        out.append((int(m.group('num')), (m.group('suf') or '').lower(), clean(m.group('label'))))
    if not out:
        raise ValueError('la tabla no tiene ningún Pokémon: ¿ha cambiado el formato de la página?')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--html', help='HTML ya descargado (por defecto se descarga)')
    ap.add_argument('--pokedex', default='public/data/pokedex.json')
    ap.add_argument('--out', default='public/data/shiny-unavailable.json')
    a = ap.parse_args()

    try:
        page = open(a.html, encoding='utf-8').read() if a.html else fetch(URL)
        rows = parse(page)
    except Exception as e:  # noqa: BLE001
        print(f'⚠ No se pudo actualizar la lista de shinies no disponibles: {e}. Se mantiene la actual.')
        return 0

    with open(a.pokedex, encoding='utf-8') as f:
        entries = json.load(f)['entries']
    in_app = [e for e in entries if e['category'] in ('base', 'regional')]

    found, ignored = [], []
    for num, suf, label in rows:
        match = None
        if not suf:
            match = next((e for e in in_app if e['species'] == num and e['category'] == 'base'), None)
        elif suf in REGION_SUFFIX:
            region = REGION_SUFFIX[suf]
            # la etiqueta tiene que mencionar la región (en Serebii «-a» también es «Alola Cap» o «Ash»)
            if REGION_WORDS[region] in label.lower() and 'cap' not in label.lower():
                match = next((e for e in in_app if e['species'] == num and e['category'] == 'regional'
                              and f'-{region}' in e['id']), None)
        if match and all(x['id'] != match['id'] for x in found):
            found.append({'id': match['id'], 'name': match['name']})
        elif not match:
            ignored.append(f'#{num}{"-" + suf if suf else ""} {label}')

    found.sort(key=lambda x: next(e['species'] for e in entries if e['id'] == x['id']))
    doc = {
        'source': URL,
        'updated': datetime.date.today().isoformat(),
        'entries': found,
    }
    old = None
    if os.path.exists(a.out):
        with open(a.out, encoding='utf-8') as f:
            old = json.load(f)
    if old and old.get('entries') == found:
        print(f'Shinies no disponibles: {len(found)} (sin cambios)')
        return 0
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'Shinies no disponibles: {len(found)} →', ', '.join(x['name'] for x in found))
    print(f'Ignorados (no están en la app): {len(ignored)} →', '; '.join(ignored))
    return 0


if __name__ == '__main__':
    sys.exit(main())
