#!/usr/bin/env python3
"""
Genera public/data/locations.json: dónde capturar cada Pokémon en los juegos
compatibles con Pokémon HOME, con los nombres de lugares en español.

Fuente: datos de legalidad de PKHeX (https://github.com/kwsch/PKHeX, GPL-3.0),
que contienen las tablas de encuentros extraídas de los juegos.

Uso:
  python3 scripts/build-locations.py --pkhex <ruta a PKHeX.Core> --csv <csv PokéAPI> \
      --pokedex public/data/pokedex.json --out public/data/locations.json
"""
import argparse
import csv
import json
import os
import re
import struct
from collections import OrderedDict, defaultdict

# ---------------------------------------------------------------- utilidades

def binlinker(data, wide=True):
    """BinLinkerAccessor (offsets de 32 bits) o BinLinkerAccessor16 (16 bits)."""
    count = struct.unpack_from('<H', data, 2)[0]
    size = 4 if wide else 2
    fmt = '<I' if wide else '<H'
    out = []
    for i in range(count):
        start = struct.unpack_from(fmt, data, 4 + i * size)[0]
        end = struct.unpack_from(fmt, data, 4 + (i + 1) * size)[0]
        out.append(data[start:end])
    return out


class Locations:
    def __init__(self, folder, prefix):
        self.tables = {}
        for base in (0, 30000, 40000, 60000):
            p = os.path.join(folder, f'{prefix}_{base:05d}_es.txt')
            if os.path.exists(p):
                with open(p, encoding='utf-8') as f:
                    self.tables[base] = f.read().split('\n')

    def __call__(self, loc):
        base = 0
        for b in (60000, 40000, 30000):
            if loc >= b:
                base = b
                break
        t = self.tables.get(base, [])
        i = loc - base
        name = t[i].strip() if 0 <= i < len(t) else ''
        return name or None


# --------------------------------------------------------------- lectores

def read_area8(blob):  # Espada/Escudo
    for area in binlinker(blob):
        loc, count = area[0], area[1]
        ofs, n = 2, 0
        while n < count:
            _, _mn, _mx, c, _t = struct.unpack_from('<HBBBB', area, ofs)
            ofs += 6
            for _ in range(c):
                v = struct.unpack_from('<H', area, ofs)[0]
                ofs += 2
                n += 1
                yield v & 0x3FF, v >> 11, [loc]


def read_area8b(blob):  # DBDP
    for area in binlinker(blob):
        loc = struct.unpack_from('<H', area, 0)[0]
        for o in range(4, len(area), 4):
            v = struct.unpack_from('<H', area, o)[0]
            yield v & 0x3FF, v >> 11, [loc]


def read_area8a(blob):  # Leyendas Arceus
    for area in binlinker(blob):
        n = area[0]
        locs = list(area[1:1 + n])
        align = n + 1
        align += align & 1
        area = area[align:]
        count = area[1]
        for i in range(count):
            sp, form = struct.unpack_from('<HB', area, 2 + i * 8)
            yield sp, form, locs


def read_area9(blob):  # Escarlata/Púrpura
    for area in binlinker(blob):
        loc = area[0]
        for o in range(4, len(area), 8):
            sp, form = struct.unpack_from('<HB', area, o)
            yield sp, form, [loc]


def read_area9a(blob):  # Leyendas Z-A
    for area in binlinker(blob, wide=False):
        loc = struct.unpack_from('<H', area, 0)[0]
        for o in range(4, len(area), 8):
            sp, form = struct.unpack_from('<HB', area, o)
            yield sp, form, [loc]


def read_area7b(blob):  # Let's Go
    for area in binlinker(blob):
        loc = area[0]
        for o in range(4, len(area), 4):
            yield area[o], 0, [loc]


def read_fixed9(blob):
    for o in range(0, len(blob) - 0x13, 0x14):
        sp, form = struct.unpack_from('<HB', blob, o)
        locs = [x for x in blob[o + 0x10:o + 0x14] if x]
        yield sp, form, locs


def read_tera9(blob):
    for o in range(0, len(blob) - 0x17, 0x18):
        sp, form = struct.unpack_from('<HB', blob, o)
        stars = blob[o + 0x12]
        yield sp, form, stars


def read_nest8(blob):  # Incursiones Dinamax (Área Silvestre)
    for o in range(0, len(blob) - 9, 10):
        sp, form = struct.unpack_from('<HB', blob, o)
        yield sp, form


def read_dynadv8(blob):  # Aventuras Dinamax (Nido Dinamax)
    for o in range(0, len(blob) - 13, 14):
        sp, form = struct.unpack_from('<HB', blob, o)
        yield sp, form


def read_go(blob):
    for area in binlinker(blob):
        sp, form = struct.unpack_from('<HB', area, 0)
        yield sp, form


STATIC_LINE = re.compile(r'^\s*new\((?P<args>[^)]*)\)\s*\{(?P<body>[^}]*)\}')


def read_static(path, section_filter=None):
    """Encuentros fijos/regalos definidos en el código C#. Devuelve (versión, especie, forma, [loc])."""
    with open(path, encoding='utf-8') as f:
        text = f.read()
    out = []
    for line in text.split('\n'):
        if 'TradeNames' in line or 'EggLocation' in line and 'Location = Locations' in line:
            continue
        m = STATIC_LINE.match(line)
        if not m:
            continue
        args = [a.strip() for a in m.group('args').split(',')]
        body = m.group('body')
        loc = re.search(r'\bLocation\s*=\s*(\d+)', body)
        if not loc:
            continue
        sp = re.search(r'\bSpecies\s*=\s*(\d+)', body)
        fm = re.search(r'\bForm\s*=\s*(\d+)', body)
        version = ''
        if sp:
            species = int(sp.group(1))
            form = int(fm.group(1)) if fm else 0
            version = args[0] if args and args[0] and not args[0].isdigit() else ''
        elif len(args) >= 2 and args[0].isdigit():
            species, form = int(args[0]), int(args[1])
        else:
            continue
        out.append((version, species, form, [int(loc.group(1))]))
    return out


# ------------------------------------------- evolución y crianza derivadas

REGIONS = ('alola', 'galar', 'hisui', 'paldea')

# Evoluciones que dependen de una forma regional concreta (o de un juego concreto).
# entrada -> (entrada previa, juegos donde aplica; None = todos)
SPECIAL_PARENT = {
    'perrserker': ('meowth-galar', None),
    'sirfetchd': ('farfetchd-galar', None),
    'mr-rime': ('mr-mime-galar', None),
    'cursola': ('corsola-galar', None),
    'obstagoon': ('linoone-galar', None),
    'runerigus': ('yamask-galar', None),
    'overqwil': ('qwilfish-hisui', None),
    'sneasler': ('sneasel-hisui', None),
    'clodsire': ('wooper-paldea', None),
    'weezing-galar': ('koffing', {'swsh'}),
    'mr-mime-galar': ('mime-jr', {'swsh'}),
    'typhlosion-hisui': ('quilava', {'pla'}),
    'samurott-hisui': ('dewott', {'pla'}),
    'decidueye-hisui': ('dartrix', {'pla'}),
    'lilligant-hisui': ('petilil', {'pla'}),
    'braviary-hisui': ('rufflet', {'pla'}),
    'sliggoo-hisui': ('goomy', {'pla'}),
    'avalugg-hisui': ('bergmite', {'pla'}),
}

# Pokédex de cada juego (ids de pokedexes.csv de PokéAPI); None = por rango nacional
GAME_DEXES = {
    'lgpe': {26}, 'swsh': {27, 28, 29}, 'pla': {30}, 'sv': {31, 32, 33}, 'za': {34, 35},
}
BREEDING_GAMES = ('swsh', 'bdsp', 'sv')


def derive(csv_dir, entries, result):
    """Añade «Evolución de X» y «Crianza con Y» cuando no se puede capturar directamente."""
    def rows(name):
        with open(os.path.join(csv_dir, f'{name}.csv'), encoding='utf-8') as f:
            return list(csv.DictReader(f))

    species = {int(r['id']): r for r in rows('pokemon_species')}
    no_eggs = {int(r['species_id']) for r in rows('pokemon_egg_groups') if r['egg_group_id'] == '15'}
    in_dex = defaultdict(set)
    for r in rows('pokemon_dex_numbers'):
        for g, dexes in GAME_DEXES.items():
            if int(r['pokedex_id']) in dexes:
                in_dex[g].add(int(r['species_id']))
    in_dex['lgpe'].update({808, 809})
    in_dex['bdsp'] = set(range(1, 494))

    by_id = {e['id']: e for e in entries}
    by_species = defaultdict(list)
    for e in entries:
        if e['category'] in ('base', 'regional'):
            by_species[e['species']].append(e)

    def region(e):
        return next((r for r in REGIONS if f'-{r}' in e['id']), None) if e['category'] == 'regional' else None

    def parent(e, game):
        if e['id'] in SPECIAL_PARENT:
            pid, games = SPECIAL_PARENT[e['id']]
            return by_id.get(pid) if games is None or game in games else None
        prev = species[e['species']]['evolves_from_species_id']
        if not prev:
            return None
        reg = region(e)
        # en ese juego la evolución da la forma regional, no la normal
        if reg is None and any(by_id[k]['species'] == e['species'] and gs and game in gs
                               for k, (_, gs) in SPECIAL_PARENT.items() if k in by_id):
            return None
        cands = by_species.get(int(prev), [])
        for c in cands:
            if region(c) == reg:
                return c
        return None

    def direct(e, game):
        places = result.get(e['id'], {}).get(game)
        return bool(places) and not all(p.startswith(('Evolución de ', 'Crianza con ')) for p in places)

    games = ['lgpe', 'swsh', 'bdsp', 'pla', 'sv', 'za']
    added = 0
    for game in games:
        pool = [e for e in entries if e['category'] in ('base', 'regional') and e['species'] in in_dex[game]]
        children = defaultdict(list)
        for e in pool:
            p = parent(e, game)
            if p:
                children[p['id']].append(e)
        caught = {e['id'] for e in pool if direct(e, game)}
        for e in pool:
            if e['id'] in caught:
                continue
            note = None
            # evolución: el antepasado capturable más cercano
            p = parent(e, game)
            while p and not note:
                if p['id'] in caught and p['species'] in in_dex[game]:
                    note = f'Evolución de {p["name"]}'
                p = parent(p, game)
            # crianza: solo para la primera fase, a partir de una evolución capturable
            if not note and game in BREEDING_GAMES and parent(e, game) is None:
                sp = species[e['species']]
                if sp['is_legendary'] == '0' and sp['is_mythical'] == '0':
                    stack = list(children[e['id']])
                    while stack and not note:
                        c = stack.pop(0)
                        if c['id'] in caught and c['species'] not in no_eggs:
                            note = f'Crianza con {c["name"]}'
                        stack.extend(children[c['id']])
            if note:
                result[e['id']].setdefault(game, OrderedDict())[note] = set()
                added += 1
    print(f'Evolución/crianza añadidas: {added}')


# ----------------------------------------------------------------- main

GAMES = OrderedDict([
    ('lgpe', "Let's Go, Pikachu! / Eevee!"),
    ('swsh', 'Espada / Escudo'),
    ('bdsp', 'Diamante Brillante / Perla Reluciente'),
    ('pla', 'Leyendas: Arceus'),
    ('sv', 'Escarlata / Púrpura'),
    ('za', 'Leyendas: Z-A'),
    ('go', 'Pokémon GO'),
])

VERSION_LABEL = {
    'SW': 'Espada', 'SH': 'Escudo', 'BD': 'Diamante Brillante', 'SP': 'Perla Reluciente',
    'SL': 'Escarlata', 'VL': 'Púrpura', 'GP': "Let's Go, Pikachu!", 'GE': "Let's Go, Eevee!",
}
VERSION_PAIR = {'SW': 'SH', 'SH': 'SW', 'BD': 'SP', 'SP': 'BD', 'SL': 'VL', 'VL': 'SL', 'GP': 'GE', 'GE': 'GP'}

SKIP_PLACES = {'Lugar misterioso', 'lugar misterioso', '－', 'Intercambio en conexión'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pkhex', required=True, help='carpeta PKHeX.Core')
    ap.add_argument('--csv', required=True)
    ap.add_argument('--pokedex', default='public/data/pokedex.json')
    ap.add_argument('--out', default='public/data/locations.json')
    a = ap.parse_args()

    core = a.pkhex
    wild = os.path.join(core, 'Resources', 'legality', 'wild')
    texts = os.path.join(core, 'Resources', 'text', 'locations')
    data_cs = os.path.join(core, 'Legality', 'Encounters', 'Data')

    def pkl(*parts):
        with open(os.path.join(wild, *parts), 'rb') as f:
            return f.read()

    names = {
        'lgpe': Locations(os.path.join(texts, 'gen7'), 'text_gg'),
        'swsh': Locations(os.path.join(texts, 'gen8'), 'text_swsh'),
        'bdsp': Locations(os.path.join(texts, 'gen8b'), 'text_bdsp'),
        'pla': Locations(os.path.join(texts, 'gen8a'), 'text_la'),
        'sv': Locations(os.path.join(texts, 'gen9'), 'text_sv'),
        'za': Locations(os.path.join(texts, 'gen9a'), 'text_za'),
    }

    # (game, species, form) -> {place: set(versions)}
    found = defaultdict(lambda: OrderedDict())

    def add(game, version, sp, form, places):
        d = found[(game, sp, form)]
        for p in places:
            if not p or p in SKIP_PLACES:
                continue
            d.setdefault(p, set()).add(version)

    def add_locs(game, version, rows):
        for sp, form, locs in rows:
            add(game, version, sp, form, [names[game](l) for l in locs])

    # Salvajes
    add_locs('lgpe', 'GP', read_area7b(pkl('Gen7', 'encounter_gp.pkl')))
    add_locs('lgpe', 'GE', read_area7b(pkl('Gen7', 'encounter_ge.pkl')))
    for v, f in (('SW', 'sw'), ('SH', 'sh')):
        add_locs('swsh', v, read_area8(pkl('Gen8', f'encounter_{f}_symbol.pkl')))
        add_locs('swsh', v, read_area8(pkl('Gen8', f'encounter_{f}_hidden.pkl')))
    for v, f in (('BD', 'bd'), ('SP', 'sp')):
        add_locs('bdsp', v, read_area8b(pkl('Gen8', f'encounter_{f}.pkl')))
        add_locs('bdsp', v, read_area8b(pkl('Gen8', f'encounter_{f}_underground.pkl')))
    add_locs('pla', '', read_area8a(pkl('Gen8', 'encounter_la.pkl')))
    add_locs('sv', '', read_area9(pkl('Gen9', 'encounter_wild_paldea.pkl')))
    add_locs('sv', '', read_fixed9(pkl('Gen9', 'encounter_fixed_paldea.pkl')))
    add_locs('za', '', read_area9a(pkl('Gen9', 'encounter_za.pkl')))
    add_locs('za', '', ((s, f, l) for s, f, l in read_area9a(pkl('Gen9', 'encounter_hyperspace_za.pkl'))))

    # Incursiones y Aventuras Dinamax
    for v, f in (('SW', 'sw'), ('SH', 'sh')):
        for sp, form in read_nest8(pkl('Gen8', f'encounter_{f}_nest.pkl')):
            add('swsh', v, sp, form, ['Incursiones Dinamax (Área Silvestre)'])
    for sp, form in read_dynadv8(pkl('Gen8', 'encounter_swsh_underground.pkl')):
        add('swsh', '', sp, form, ['Aventuras Dinamax (Nido Dinamax)'])

    # Teraincursiones
    tera = defaultdict(set)
    for file, region in (('gem_paldea', 'Paldea'), ('gem_kitakami', 'Noroteo'), ('gem_blueberry', 'Instituto Arándano')):
        for sp, form, stars in read_tera9(pkl('Gen9', f'encounter_{file}.pkl')):
            if 1 <= stars <= 7:
                tera[(sp, form, region)].add(stars)
    for (sp, form, region), stars in tera.items():
        s = sorted(stars)
        rng = f'{s[0]}★' if len(s) == 1 else f'{s[0]}-{s[-1]}★'
        add('sv', '', sp, form, [f'Teraincursión {rng} ({region})'])

    # Encuentros fijos y regalos
    statics = [
        ('lgpe', os.path.join(data_cs, 'Gen7', 'Encounters7GG.cs')),
        ('swsh', os.path.join(data_cs, 'Gen8', 'Encounters8.cs')),
        ('bdsp', os.path.join(data_cs, 'Gen8', 'Encounters8b.cs')),
        ('pla', os.path.join(data_cs, 'Gen8', 'Encounters8a.cs')),
        ('sv', os.path.join(data_cs, 'Gen9', 'Encounters9.cs')),
        ('za', os.path.join(data_cs, 'Gen9', 'Encounters9a.cs')),
    ]
    for game, path in statics:
        for version, sp, form, locs in read_static(path):
            version = version if version in VERSION_LABEL else ''
            add(game, version, sp, form, [names[game](l) for l in locs])

    # Pokémon GO (solo disponibilidad)
    go = set()
    for sp, form in read_go(pkl('encounter_go_home.pkl')):
        go.add((sp, form))

    # ------------------------------------------------ mapeo a entradas de la dex
    with open(a.pokedex, encoding='utf-8') as f:
        entries = json.load(f)['entries']
    ids = {e['id'] for e in entries}
    by_species = defaultdict(list)
    for e in entries:
        by_species[e['species']].append(e)

    pk_forms = {}
    with open(os.path.join(a.csv, 'pokemon_forms.csv'), encoding='utf-8') as f:
        forms_csv = list(csv.DictReader(f))
    with open(os.path.join(a.csv, 'pokemon.csv'), encoding='utf-8') as f:
        pokemon_species = {r['id']: int(r['species_id']) for r in csv.DictReader(f)}
    for r in forms_csv:
        if r['is_mega'] == '1' or 'gmax' in r['identifier']:
            continue
        sp = pokemon_species[r['pokemon_id']]
        key = (sp, int(r['form_order']) - 1)
        # preferimos la forma que está en la dex
        if key not in pk_forms or r['identifier'] in ids:
            pk_forms[key] = r['identifier']

    def entry_for(sp, form):
        if sp == 774 and form < 7:  # Minior meteoro -> núcleo del mismo color
            form += 7
        ident = pk_forms.get((sp, form))
        if ident in ids:
            return ident
        base = [e for e in by_species.get(sp, []) if e['category'] == 'base']
        return base[0]['id'] if base else None

    result = defaultdict(lambda: OrderedDict())
    for (game, sp, form), places in found.items():
        eid = entry_for(sp, form)
        if not eid:
            continue
        dest = result[eid].setdefault(game, OrderedDict())
        for p, versions in places.items():
            dest.setdefault(p, set()).update(versions)
    for sp, form in go:
        eid = entry_for(sp, form)
        if eid:
            result[eid].setdefault('go', OrderedDict())

    derive(a.csv, entries, result)

    # Las diferencias de género comparten lugares con su forma base
    for e in entries:
        if e['category'] == 'genero' and e['id'] not in result:
            base = next((b for b in by_species[e['species']] if b['category'] == 'base'), None)
            if base and base['id'] in result:
                result[e['id']] = result[base['id']]

    def label(place, versions):
        versions = {v for v in versions if v}
        if len(versions) == 1:
            v = next(iter(versions))
            # exclusivo solo si la otra versión no lo tiene en ese sitio
            return f'{place} (solo {VERSION_LABEL[v]})'
        return place

    out = {}
    for e in entries:
        games = result.get(e['id'])
        if not games:
            continue
        item = []
        for g in GAMES:
            if g not in games:
                continue
            places = [label(p, v) for p, v in games[g].items()]
            item.append([g, places])
        out[e['id']] = item

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump({'games': GAMES, 'locations': out}, f, ensure_ascii=False, separators=(',', ':'))

    missing = [e['id'] for e in entries if e['id'] not in out]
    print(f'Con ubicación: {len(out)} / {len(entries)}')
    print(f'Sin datos ({len(missing)}):', ' '.join(missing[:80]), '…' if len(missing) > 80 else '')


if __name__ == '__main__':
    main()
