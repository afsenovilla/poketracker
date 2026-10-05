#!/usr/bin/env python3
"""
Genera public/data/locations-frlg.json: dónde conseguir cada Pokémon de la
Pokédex nacional (hasta el 386) en Rojo Fuego y Verde Hoja, y, si no se puede,
en qué otros juegos de la 3.ª generación sale.

Fuente: datos de legalidad de PKHeX (https://github.com/kwsch/PKHeX, GPL-3.0):
tablas de encuentros salvajes (Resources/legality/wild/Gen3), encuentros fijos,
regalos e intercambios (Legality/Encounters/Data/Gen3) y nombres de lugares en
español (Resources/text/locations/gen3). Las evoluciones salen de PokéAPI.

Uso:
  python3 scripts/build-locations-frlg.py --pkhex <ruta a PKHeX.Core> --csv <csv PokéAPI> \
      --pokedex public/data/pokedex.json --out public/data/locations-frlg.json
"""
import argparse
import csv
import json
import os
import re
import struct
from collections import OrderedDict, defaultdict

MAX_SPECIES = 386

VERSIONS = OrderedDict([('fr', 'Rojo Fuego'), ('lg', 'Verde Hoja')])

# Otros juegos de la 3.ª generación (para lo que no está en RF/VH)
OTHER = OrderedDict([
    ('r', 'Rubí'), ('s', 'Zafiro'), ('e', 'Esmeralda'),
    ('colo', 'Colosseum'), ('xd', 'XD: Tempestad Oscura'), ('event', 'Evento'),
])

METHOD = {0: None, 1: 'surfeando', 2: 'Caña Vieja', 3: 'Caña Buena', 4: 'Supercaña', 5: 'Golpe Roca',
          6: 'enjambre', 7: 'enjambre (pesca)'}

# Objetos de evolución (ids de PokéAPI) y su nombre en español
ITEMS = {
    80: 'Piedra Solar', 81: 'Piedra Lunar', 82: 'Piedra Fuego', 83: 'Piedra Trueno',
    84: 'Piedra Agua', 85: 'Piedra Hoja', 198: 'Roca del Rey', 210: 'Revestimiento Metálico',
    212: 'Escama Dragón', 229: 'Mejora', 203: 'Diente Marino', 204: 'Escama Marina',
}
# En RF/VH no se consiguen el Diente Marino ni la Escama Marina, no hay reloj
# (Espeon, Umbreon) ni Pokécubos (Milotic) ni se puede mudar (Shedinja).
FRLG_MISSING_ITEMS = {203, 204}

# Intercambios dentro del juego: especie que recibes -> especie que das, por versión
TRADES = {
    'fr': {122: 63, 124: 61, 83: 21, 101: 26, 114: 48, 86: 77, 29: 32, 30: 33, 108: 55},
    'lg': {122: 63, 124: 61, 83: 21, 101: 26, 114: 48, 86: 77, 32: 29, 33: 30, 108: 80},
}

# Las tres bestias legendarias de Johto vagan por Kanto: cuál depende del inicial
ROAMER_STARTER = {243: 'Squirtle', 244: 'Bulbasaur', 245: 'Charmander'}


def binlinker(data):
    count = struct.unpack_from('<H', data, 2)[0]
    out = []
    for i in range(count):
        start = struct.unpack_from('<I', data, 4 + i * 4)[0]
        end = struct.unpack_from('<I', data, 4 + (i + 1) * 4)[0]
        out.append(data[start:end])
    return out


def read_area3(blob, swarm=False):
    """EncounterArea3: lugar, tipo de encuentro y especies."""
    size = 14 if swarm else 10
    for area in binlinker(blob):
        loc, kind = area[0], (6 if swarm else area[2])
        for o in range(4, len(area) - size + 1, size):
            sp = struct.unpack_from('<H', area, o)[0]
            yield loc, kind, sp


def place_name(names, loc):
    name = names[loc].strip() if 0 <= loc < len(names) else ''
    # «Roca Ombligo (RFVH)», «Zona Safari (RZE)»: la etiqueta del juego sobra aquí
    return re.sub(r'\s*\((?:RFVH|RZE|RZ|E)\)$', '', name) or None


STATIC = re.compile(r'new\((\d+),\s*(\d+),\s*(?:\w+,\s*)?(FRLG|FR|LG|RSE|RS|R|S|E)\)\s*\{(?P<body>[^}]*)\}')


def read_statics(path):
    with open(path, encoding='utf-8') as f:
        text = f.read()
    out = []
    for m in STATIC.finditer(text):
        body = m.group('body')
        loc = re.search(r'\bLocation\s*=\s*(\d+)', body)
        out.append({
            'species': int(m.group(1)),
            'version': m.group(3),
            'loc': int(loc.group(1)) if loc else None,
            'roaming': 'IsRoaming = true' in body,
            'event': 'FatefulEncounter = true' in body,
            'egg': 'IsEgg = true' in body,
            'gift': 'FixedBall' in body,
        })
    return out


def species_in(path, pattern=r'Species\s*=\s*(\d+)|new\((\d{3}),'):
    """Especies que aparecen en un fichero de encuentros de C# (Colosseum, XD, eventos)."""
    with open(path, encoding='utf-8') as f:
        text = f.read()
    out = set()
    for m in re.finditer(pattern, text):
        n = int(next(g for g in m.groups() if g))
        if 1 <= n <= MAX_SPECIES:
            out.add(n)
    return out


def version_set(v):
    return {'FRLG': {'fr', 'lg'}, 'FR': {'fr'}, 'LG': {'lg'}, 'RSE': {'r', 's', 'e'}, 'RS': {'r', 's'},
            'R': {'r'}, 'S': {'s'}, 'E': {'e'}}[v]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pkhex', required=True, help='carpeta PKHeX.Core')
    ap.add_argument('--csv', required=True)
    ap.add_argument('--pokedex', default='public/data/pokedex.json')
    ap.add_argument('--out', default='public/data/locations-frlg.json')
    a = ap.parse_args()

    core = a.pkhex
    wild = os.path.join(core, 'Resources', 'legality', 'wild', 'Gen3')
    data_cs = os.path.join(core, 'Legality', 'Encounters', 'Data', 'Gen3')
    with open(os.path.join(core, 'Resources', 'text', 'locations', 'gen3', 'text_rsefrlg_00000_es.txt'), encoding='utf-8') as f:
        names = f.read().split('\n')

    with open(a.pokedex, encoding='utf-8') as f:
        entries = json.load(f)['entries']
    base = {e['species']: e for e in entries if e['category'] == 'base' and e['species'] <= MAX_SPECIES}
    name = {sp: e['name'] for sp, e in base.items()}

    def rows(n):
        with open(os.path.join(a.csv, f'{n}.csv'), encoding='utf-8') as f:
            return list(csv.DictReader(f))

    species_csv = {int(r['id']): r for r in rows('pokemon_species') if int(r['id']) <= MAX_SPECIES}
    no_eggs = {int(r['species_id']) for r in rows('pokemon_egg_groups') if r['egg_group_id'] == '15'}
    # Evoluciones de la 3.ª generación (grupos de versiones hasta Rojo Fuego/Verde Hoja)
    evolutions = defaultdict(list)  # especie -> [(preevolución, fila)]
    for r in rows('pokemon_evolution'):
        sp = int(r['evolved_species_id'])
        if sp > MAX_SPECIES or int(r['version_group_id'] or 0) > 7:
            continue
        prev = species_csv[sp]['evolves_from_species_id']
        if prev:
            evolutions[sp].append((int(prev), r))

    # game -> especie -> {lugar: set(métodos)}
    found = {g: defaultdict(OrderedDict) for g in list(VERSIONS) + ['r', 's', 'e']}

    def add(game, sp, place, method=None):
        if sp < 1 or sp > MAX_SPECIES or not place:
            return
        found[game][sp].setdefault(place, set())
        if method:
            found[game][sp][place].add(method)

    # --------------------------------------------------------- salvajes
    for game in ('fr', 'lg', 'r', 's', 'e'):
        with open(os.path.join(wild, f'encounter_{game}.pkl'), 'rb') as f:
            blob = f.read()
        for loc, kind, sp in read_area3(blob):
            add(game, sp, place_name(names, loc), METHOD.get(kind))
    with open(os.path.join(wild, 'encounter_rse_swarm.pkl'), 'rb') as f:
        blob = f.read()
    for loc, kind, sp in read_area3(blob, swarm=True):
        for game in ('r', 's', 'e'):
            add(game, sp, place_name(names, loc), 'enjambre')

    # -------------------------------------------- fijos, regalos y eventos
    events = defaultdict(set)  # juego -> especies de evento
    for st in read_statics(os.path.join(data_cs, 'Encounters3FRLG.cs')) + read_statics(os.path.join(data_cs, 'Encounters3RSE.cs')):
        sp = st['species']
        loc = st['loc']
        if loc is None or loc >= 254:
            continue  # regalos de discos de bonificación y similares
        place = place_name(names, loc)
        for game in version_set(st['version']):
            if st['event']:
                add(game, sp, f'{place} (evento)')
                events[game].add(sp)
            elif st['roaming'] and game in VERSIONS:
                add(game, sp, f'Errante por Kanto (si empezaste con {ROAMER_STARTER[sp]})')
            elif st['roaming']:
                add(game, sp, 'Errante por Hoenn')
            elif st['egg']:
                add(game, sp, 'Huevo de regalo (Aquarinto)' if game in VERSIONS else 'Huevo de regalo (Pueblo Lavacalda)')
            elif game in VERSIONS and loc == 94 and sp != 133:
                add(game, sp, f'{place} (Casino)')
            elif game in VERSIONS and loc == 96:
                add(game, sp, f'{place} (fósil)')
            elif game in VERSIONS and loc == 88:
                add(game, sp, f'{place} (Pokémon inicial)')
            elif st['gift']:
                add(game, sp, f'{place} (regalo)')
            else:
                add(game, sp, f'{place} (encuentro fijo)')

    for game, trades in TRADES.items():
        for got, given in trades.items():
            add(game, got, f'Intercambio en el juego (das un {name[given]})')

    # ------------------------------------------- evolución y crianza
    children = defaultdict(list)
    for sp, evos in evolutions.items():
        for prev, _ in evos:
            children[prev].append(sp)

    def method_note(r, game):
        """Texto de cómo evoluciona, o None si no se puede en ese juego."""
        trigger = r['evolution_trigger_id']
        item = int(r['trigger_item_id'] or r['held_item_id'] or 0)
        if game in VERSIONS:
            if r['time_of_day'] or r['minimum_beauty'] or trigger == '4' or item in FRLG_MISSING_ITEMS:
                return None
        if trigger == '2':
            return f'por intercambio con {ITEMS[item]}' if item else 'por intercambio'
        if trigger == '3':
            return f'con {ITEMS.get(item, "un objeto")}'
        if r['minimum_happiness']:
            when = {'day': ', de día', 'night': ', de noche'}.get(r['time_of_day'], '')
            return f'por amistad{when}'
        if r['minimum_beauty']:
            return 'con belleza alta, usando Pokécubos'
        return ''

    def derive(game, obtainable):
        """Añade «Evolución de X» y «Crianza con Y». `obtainable` se amplía en el sitio."""
        notes = defaultdict(list)
        changed = True
        while changed:
            changed = False
            for sp in range(1, MAX_SPECIES + 1):
                if sp in obtainable:
                    continue
                for prev, r in evolutions.get(sp, []):
                    if prev not in obtainable:
                        continue
                    how = method_note(r, game)
                    if how is None:
                        continue
                    notes[sp].append(f'Evolución de {name[prev]}' + (f' ({how})' if how else ''))
                    obtainable.add(sp)
                    changed = True
                    break
            # crianza: la primera fase, a partir de una evolución que se tenga
            for sp in range(1, MAX_SPECIES + 1):
                if sp in obtainable or evolutions.get(sp):
                    continue
                s = species_csv[sp]
                if s['is_legendary'] == '1' or s['is_mythical'] == '1':
                    continue
                stack = list(children[sp])
                while stack:
                    c = stack.pop(0)
                    if c in obtainable and c not in no_eggs:
                        notes[sp].append(f'Crianza con {name[c]}')
                        obtainable.add(sp)
                        changed = True
                        break
                    stack.extend(children[c])
        return notes

    order = list(METHOD.values())

    def with_methods(place, methods):
        # «Ruta 4 (Caña Vieja, Caña Buena)»: en el orden de las cañas, no alfabético
        return f'{place} ({", ".join(sorted(methods, key=order.index))})' if methods else place

    result = {}
    obtainable_frlg = set()
    per_version = {}
    for game in VERSIONS:
        have = set(found[game])
        notes = derive(game, have)
        per_version[game] = (have, notes)
        obtainable_frlg |= have

    # Otros juegos: lo que se captura allí y, como se pueden llevar Pokémon de
    # RF/VH, lo que evoluciona o se cría allí a partir de ellos (Espeon, Umbreon…)
    colo = species_in(os.path.join(data_cs, 'Encounters3Colo.cs'))
    xd = species_in(os.path.join(data_cs, 'Encounters3XD.cs')) | {27, 207, 328, 187, 231, 283, 41, 304, 194}
    wc3 = species_in(os.path.join(data_cs, 'EncountersWC3.cs'), r'new\((\d{3}),')
    other_places = {}
    for game in ('r', 's', 'e'):
        have = set(found[game])
        derived = derive(game, have | obtainable_frlg)
        other_places[game] = (have, derived)

    for sp in range(1, MAX_SPECIES + 1):
        if sp not in base:
            continue
        item = OrderedDict()
        for game in VERSIONS:
            have, notes = per_version[game]
            places = []
            for place, methods in found[game].get(sp, {}).items():
                places.append(with_methods(place, methods))
            places += notes.get(sp, [])
            if places:
                item[game] = places
        other = []
        if sp not in obtainable_frlg:
            for game in ('r', 's', 'e'):
                have, derived = other_places[game]
                places = []
                for place, methods in found[game].get(sp, {}).items():
                    places.append(with_methods(place, methods))
                places += derived.get(sp, [])
                if places:
                    other.append([game, places])
            if sp in colo:
                other.append(['colo', []])
            if sp in xd:
                other.append(['xd', []])
            if sp in wc3 and not other:
                other.append(['event', []])
        if other:
            item['other'] = other
        result[base[sp]['id']] = item

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump({'versions': VERSIONS, 'other': OTHER, 'locations': result}, f, ensure_ascii=False, separators=(',', ':'))

    fr = {s for s in per_version['fr'][0]}
    lg = {s for s in per_version['lg'][0]}
    nowhere = [name[s] for s in range(1, MAX_SPECIES + 1) if s not in obtainable_frlg and not result[base[s]['id']].get('other')]
    print(f'Rojo Fuego: {len(fr)} · Verde Hoja: {len(lg)} · en alguno: {len(fr | lg)} de {MAX_SPECIES}')
    print('Solo Rojo Fuego:', ', '.join(name[s] for s in sorted(fr - lg)))
    print('Solo Verde Hoja:', ', '.join(name[s] for s in sorted(lg - fr)))
    print(f'Sin datos ({len(nowhere)}):', ', '.join(nowhere))


if __name__ == '__main__':
    main()
