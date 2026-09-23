#!/usr/bin/env python3
"""
Genera public/data/pokedex.json a partir de los CSV de PokéAPI
(https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv) y del
listado de sprites de https://github.com/PokeAPI/sprites.

Uso:
  python3 scripts/build-data.py --csv <carpeta_csv> --sprites <sprites.txt> --home <home.txt>

sprites.txt / home.txt: salida de `git ls-tree -r --name-only HEAD sprites/pokemon`
filtrada (ver README). Sirven para saber qué sprite existe para cada forma.

Las reglas de qué formas entran en la Living Dex están en EXCLUDE / EXCLUDE_PREFIX.
"""
import argparse
import csv
import json
import os
import re
from collections import defaultdict

ES = '7'
MISSING_ES = []
EN = '9'

# Formas que NO se consideran para una Living Dex de HOME:
# cambiables a voluntad, solo de combate, fusiones, totem, cosplay, etc.
EXCLUDE = {
    'giratina-origin', 'shaymin-sky', 'kyurem-black', 'kyurem-white', 'keldeo-resolute',
    'hoopa-unbound', 'dialga-origin', 'palkia-origin', 'necrozma-dusk', 'necrozma-dawn',
    'calyrex-ice', 'calyrex-shadow', 'eternatus-eternamax',
    'tornadus-therian', 'thundurus-therian', 'landorus-therian', 'enamorus-therian',
    'pichu-spiky-eared', 'pikachu-starter', 'eevee-starter', 'greninja-battle-bond',
    'zygarde-10-power-construct', 'zygarde-50-power-construct', 'rockruff-own-tempo',
    'floette-eternal', 'pikachu-cosplay', 'pikachu-rock-star', 'pikachu-belle',
    'pikachu-pop-star', 'pikachu-phd', 'pikachu-libre',
    'mothim-sandy', 'mothim-trash',
    'minior-red-meteor', 'minior-orange-meteor', 'minior-yellow-meteor', 'minior-green-meteor',
    'minior-blue-meteor', 'minior-indigo-meteor', 'minior-violet-meteor',
}
EXCLUDE_PREFIX = (
    'deoxys-attack', 'deoxys-defense', 'deoxys-speed', 'arceus-', 'genesect-',
    'silvally-', 'furfrou-', 'ogerpon-', 'koraidon-', 'miraidon-',
    'scatterbug-', 'spewpa-',
)
KEEP_DESPITE_PREFIX = {'arceus-normal', 'silvally-normal', 'furfrou-natural',
                       'koraidon-apex-build', 'miraidon-ultimate-mode',
                       'scatterbug-icy-snow', 'spewpa-icy-snow'}
# Formas que son la "base" de la especie aunque tengan identificador
FEMALE_FORMS = {'frillish-female', 'jellicent-female', 'pyroar-female', 'meowstic-female',
                'indeedee-female', 'basculegion-female', 'oinkologne-female'}

REGIONAL = ('alola', 'galar', 'hisui', 'paldea')

# Traducciones que faltan en PokéAPI
MANUAL_FORM_ES = {
    'basculin-white-striped': 'Forma Raya Blanca',
    'gimmighoul-roaming': 'Forma Andante',
    'tauros-paldea-combat-breed': 'Paldea · Combativa',
    'tauros-paldea-blaze-breed': 'Paldea · Ardiente',
    'tauros-paldea-aqua-breed': 'Paldea · Acuática',
    'sinistea-phony': 'Forma Fraudulenta', 'sinistea-antique': 'Forma Genuina',
    'polteageist-phony': 'Forma Fraudulenta', 'polteageist-antique': 'Forma Genuina',
    'basculegion-male': 'Macho', 'basculegion-female': 'Hembra',
    'oinkologne-male': 'Macho', 'oinkologne-female': 'Hembra',
    'maushold-family-of-four': 'Familia de Cuatro', 'maushold-family-of-three': 'Familia de Tres',
    'squawkabilly-green-plumage': 'Plumaje Verde', 'squawkabilly-blue-plumage': 'Plumaje Azul',
    'squawkabilly-yellow-plumage': 'Plumaje Amarillo', 'squawkabilly-white-plumage': 'Plumaje Blanco',
    'tatsugiri-curly': 'Forma Curvada', 'tatsugiri-droopy': 'Forma Lánguida',
    'tatsugiri-stretchy': 'Forma Recta',
    'dudunsparce-two-segment': 'Forma Binodular', 'dudunsparce-three-segment': 'Forma Trinodular',
    'gimmighoul-chest': 'Forma Cofre',
    'minior-red': 'Núcleo Rojo', 'minior-orange': 'Núcleo Naranja',
    'minior-yellow': 'Núcleo Amarillo', 'minior-green': 'Núcleo Verde',
    'minior-blue': 'Núcleo Azul', 'minior-indigo': 'Núcleo Añil',
    'minior-violet': 'Núcleo Violeta',
}
ALC_CREAM = {
    'vanilla-cream': 'Crema de Vainilla', 'ruby-cream': 'Crema Rosa',
    'matcha-cream': 'Crema de Té', 'mint-cream': 'Crema de Menta',
    'lemon-cream': 'Crema de Limón', 'salted-cream': 'Crema Salada',
    'ruby-swirl': 'Mezcla Rosa', 'caramel-swirl': 'Mezcla Caramelo',
    'rainbow-swirl': 'Mezcla Tricolor',
}
ALC_SWEET = {
    'strawberry': 'Confite Fresa', 'berry': 'Confite Fruto', 'love': 'Confite Corazón',
    'star': 'Confite Estrella', 'clover': 'Confite Trébol', 'flower': 'Confite Flor',
    'ribbon': 'Confite Lazo',
}



# Evoluciones que dependen de una forma regional concreta (la preevolución no es la normal)
SPECIAL_EVO = {
    'perrserker': 'meowth-galar',
    'sirfetchd': 'farfetchd-galar',
    'mr-rime': 'mr-mime-galar',
    'cursola': 'corsola-galar',
    'obstagoon': 'linoone-galar',
    'runerigus': 'yamask-galar',
    'overqwil': 'qwilfish-hisui',
    'sneasler': 'sneasel-hisui',
    'clodsire': 'wooper-paldea',
    'basculegion-male': 'basculin-white-striped',
    'basculegion-female': 'basculin-white-striped',
}

REGIONS = ('alola', 'galar', 'hisui', 'paldea')

# Generación en la que apareció cada forma regional
REGION_GEN = {'alola': 7, 'galar': 8, 'hisui': 8, 'paldea': 9}


def region_of(entry):
    if entry['category'] != 'regional':
        return None
    return next((r for r in REGIONS if f'-{r}' in entry['id']), None)


def display_name(entry):
    """Nombre con la región, como en WikiDex: «Vulpix de Alola»."""
    r = region_of(entry)
    if r:
        return f"{entry['name']} de {r.capitalize()}"
    if entry['category'] == 'forma' and entry.get('form'):
        return f"{entry['name']} ({entry['form']})"
    return entry['name']


def split_unown(entries):
    """La casilla de Unown del orden nacional no lleva letra; las 28 letras van aparte."""
    forms = [e for e in entries if e['species'] == 201]
    if not forms or any(e['id'] == 'unown' for e in entries):
        return
    base = next(e for e in forms if e['category'] == 'base')
    plain = dict(base, id='unown', form=None, category='base', formOrder=-1)
    for e in forms:
        e['category'] = 'forma'
    entries.append(plain)


def fix_regional_gen(entries):
    """Las formas regionales son de la generación en la que salieron, no la de su especie."""
    for e in entries:
        r = region_of(e)
        if r:
            e['gen'] = REGION_GEN[r]


def link_evolutions(entries, species):
    """Rellena evo (nombre) y evoId (id de la casilla) teniendo en cuenta las formas regionales."""
    by_id = {e['id']: e for e in entries}
    by_species = {}
    for e in entries:
        by_species.setdefault(e['species'], []).append(e)

    def parent_of(e):
        special = SPECIAL_EVO.get(e['id'])
        if special:
            return by_id.get(special)
        prev = species[str(e['species'])]['evolves_from_species_id'] if str(e['species']) in species else None
        if not prev:
            return None
        cands = by_species.get(int(prev), [])
        reg = region_of(e)
        if reg:
            same = next((c for c in cands if region_of(c) == reg), None)
            if same:
                return same
        # si no hay forma regional equivalente, la preevolución es la normal
        return next((c for c in cands if c['category'] == 'base'), None)

    for e in entries:
        src = e
        if e['category'] in ('genero', 'forma'):
            # las variantes heredan la preevolución de su forma base
            src = next((b for b in by_species[e['species']] if b['category'] in ('base', 'regional')), e)
        p = parent_of(src)
        e['evo'] = display_name(p) if p else None
        e['evoId'] = p['id'] if p else None

def read(folder, name):
    with open(os.path.join(folder, name + '.csv'), encoding='utf-8') as f:
        return list(csv.DictReader(f))


def clean(text):
    return re.sub(r'\s+', ' ', text.replace('', ' ')).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', required=True)
    ap.add_argument('--sprites', required=True)
    ap.add_argument('--home', required=True)
    ap.add_argument('--pokesprite', default='src/styles/pokesprite.scss')
    ap.add_argument('--out', default='public/data/pokedex.json')
    a = ap.parse_args()

    sprites = {l.strip().replace('sprites/pokemon/', '') for l in open(a.sprites)}
    home = {l.strip().replace('sprites/pokemon/other/home/', '') for l in open(a.home)}

    species = {r['id']: r for r in read(a.csv, 'pokemon_species')}
    pokemon = {r['id']: r for r in read(a.csv, 'pokemon')}
    forms = read(a.csv, 'pokemon_forms')

    sp_names = {}
    for r in read(a.csv, 'pokemon_species_names'):
        if r['local_language_id'] == ES:
            sp_names[r['pokemon_species_id']] = r['name']
    form_names = defaultdict(dict)
    for r in read(a.csv, 'pokemon_form_names'):
        form_names[r['pokemon_form_id']][r['local_language_id']] = r['form_name']

    type_es = {r['type_id']: r['name'] for r in read(a.csv, 'type_names') if r['local_language_id'] == ES}
    ptypes = defaultdict(list)
    for r in sorted(read(a.csv, 'pokemon_types'), key=lambda r: int(r['slot'])):
        ptypes[r['pokemon_id']].append(type_es[r['type_id']])

    # Última entrada de Pokédex en español disponible
    flavor = {}
    for r in read(a.csv, 'pokemon_species_flavor_text'):
        if r['language_id'] == ES:
            prev = flavor.get(r['species_id'])
            if not prev or int(r['version_id']) > prev[0]:
                flavor[r['species_id']] = (int(r['version_id']), clean(r['flavor_text']))

    def form_es(f):
        ident = f['identifier']
        if ident in MANUAL_FORM_ES:
            return MANUAL_FORM_ES[ident]
        if ident.startswith('alcremie-'):
            m = re.match(r'alcremie-(.+)-(\w+)-sweet$', ident)
            return f'{ALC_CREAM[m.group(1)]} · {ALC_SWEET[m.group(2)]}'
        name = form_names[f['id']].get(ES)
        en = form_names[f['id']].get(EN) or ''
        if not name and en.startswith('Hisuian'):
            return 'Forma de Hisui'
        if not name and en.startswith('Paldean'):
            return 'Forma de Paldea'
        if name:
            return name
        MISSING_ES.append(ident)
        return en or f['form_identifier'] or None

    def sprite_for(base, folder_set, sid, fident, pid, female=False):
        candidates = []
        g = 'female/' if female else ''
        if fident:
            candidates.append(f'{base}{g}{sid}-{fident}.png')
        candidates.append(f'{base}{g}{pid}.png')
        if not fident:
            candidates.append(f'{base}{g}{sid}.png')
        for c in candidates:
            if c in folder_set:
                return c
        return None

    def category(f, sp):
        ident = f['identifier']
        if ident in FEMALE_FORMS:
            return 'genero'
        if any(f'-{r}' in ident for r in REGIONAL) and not ident.endswith('-cap'):
            return 'regional'
        return 'forma'

    entries = []
    by_species = defaultdict(list)
    for f in forms:
        if f['is_battle_only'] == '1' or f['is_mega'] == '1':
            continue
        ident = f['identifier']
        if 'gmax' in ident or 'totem' in ident:
            continue
        if ident in EXCLUDE:
            continue
        if ident.startswith(EXCLUDE_PREFIX) and ident not in KEEP_DESPITE_PREFIX:
            continue
        p = pokemon[f['pokemon_id']]
        sid = p['species_id']
        by_species[sid].append(f)

    for sid, flist in by_species.items():
        sp = species[sid]
        flist.sort(key=lambda f: (int(pokemon[f['pokemon_id']]['is_default']) * -1,
                                  int(f['form_order']), int(f['order'])))
        # la primera es la base: cualquier forma por defecto del pokémon por defecto
        base = None
        for f in flist:
            if pokemon[f['pokemon_id']]['is_default'] == '1' and (f['is_default'] == '1' or base is None):
                if base is None or f['is_default'] == '1':
                    base = f
                    if f['is_default'] == '1':
                        break
        if base is None:
            base = flist[0]
        ordered = [base] + [f for f in flist if f is not base]
        for idx, f in enumerate(ordered):
            pid = f['pokemon_id']
            fident = f['form_identifier']
            is_base = idx == 0
            spr_ident = fident
            # Sprites de formas "por defecto" que realmente son el sprite base
            if is_base and f['identifier'] not in {'minior-red'}:
                spr_ident = ''
            s = sprite_for('', sprites, sid, spr_ident, pid)
            ss = sprite_for('shiny/', sprites, sid, spr_ident, pid)
            h = sprite_for('', home, sid, spr_ident, pid)
            hs = sprite_for('shiny/', home, sid, spr_ident, pid)
            fname = form_es(f) if (not is_base or (fident and len(ordered) > 1)) else None
            entries.append({
                'id': f['identifier'],
                'species': int(sid),
                'slug': sp['identifier'],
                'evo': sp_names.get(sp['evolves_from_species_id']) if sp['evolves_from_species_id'] else None,
                'name': sp_names.get(sid, sp['identifier']),
                'form': fname,
                'category': 'base' if is_base and f['identifier'] not in FEMALE_FORMS else category(f, sp),
                'gen': int(sp['generation_id']),
                'types': ptypes[pid],
                'sprite': s,
                'spriteShiny': ss,
                'home': h,
                'homeShiny': hs,
                'formOrder': idx,
            })
        # Diferencias de género "visuales" (sprite hembra distinto)
        if sp['has_gender_differences'] == '1' and not any(f['identifier'] in FEMALE_FORMS for f in flist):
            pid = base['pokemon_id']
            s = sprite_for('', sprites, sid, '', pid, female=True)
            if s:
                entries.append({
                    'id': f"{base['identifier']}-hembra",
                    'species': int(sid),
                    'slug': sp['identifier'],
                    'evo': sp_names.get(sp['evolves_from_species_id']) if sp['evolves_from_species_id'] else None,
                    'name': sp_names.get(sid, sp['identifier']),
                    'form': 'Hembra',
                    'category': 'genero',
                    'gen': int(sp['generation_id']),
                    'types': ptypes[pid],
                    'sprite': s,
                    'spriteShiny': sprite_for('shiny/', sprites, sid, '', pid, female=True),
                    'home': sprite_for('', home, sid, '', pid, female=True),
                    'homeShiny': sprite_for('shiny/', home, sid, '', pid, female=True),
                    'formOrder': 0.5,  # justo después de la forma base
                })

    split_unown(entries)
    fix_regional_gen(entries)
    link_evolutions(entries, species)

    # Clases del sprite sheet de PokédexTracker (iconos de caja, estilo HOME)
    rules = set()
    if os.path.exists(a.pokesprite):
        with open(a.pokesprite, encoding='utf-8') as f:
            for m in re.finditer(r'^\.pkicon\.([a-z0-9.\-_]+)\s*\{', f.read(), re.M):
                rules.add(frozenset(m.group(1).split('.')))

    def icon_classes(e):
        n = e['species']
        base = [f'pkicon-{n:03d}' if n < 1000 else f'pkicon-{n}']
        for r in REGIONAL:
            if f'-{r}' in e['id']:
                base.append(f'form-{r}')
                break
        else:
            # Unown: cada letra tiene su icono («unown-b» -> form-b)
            if n == 201 and e['id'].startswith('unown-') and e['id'] != 'unown-a':
                base.append(f"form-{e['id'].split('-', 1)[1]}")
            elif e['category'] == 'forma' and e['id'].startswith(e['slug'] + '-'):
                # Otras formas sueltas (Rotom, Vivillon, Alcremie…): el icono suele
                # llevar el sufijo del identificador («rotom-heat» -> form-heat)
                suffix = e['id'][len(e['slug']) + 1:]
                if frozenset(base + [f'form-{suffix}']) in rules:
                    base.append(f'form-{suffix}')
        shiny = base + ['color-shiny']
        ok = frozenset(base) in rules
        return (' '.join(base) if ok else None,
                ' '.join(shiny) if frozenset(shiny) in rules else (' '.join(base) if ok else None))

    for e in entries:
        icon, icon_shiny = icon_classes(e)
        e['icon'] = icon
        e['iconShiny'] = icon_shiny

    entries.sort(key=lambda e: (e['species'], e['formOrder']))
    for e in entries:
        del e['formOrder']
    flav = {int(k): v[1] for k, v in flavor.items() if int(k) in {e['species'] for e in entries}}

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump({'entries': entries, 'flavor': flav}, f, ensure_ascii=False, separators=(',', ':'))

    cats = defaultdict(int)
    for e in entries:
        cats[e['category']] += 1
    print('Total entradas:', len(entries), dict(cats))
    print('Sin icono de caja:', [e['id'] for e in entries if not e['icon'] and e['category'] in ('base', 'regional')])
    print('Sin icono shiny:', [e['id'] for e in entries if e['icon'] and e['icon'] == e['iconShiny'] and e['category'] in ('base', 'regional')])
    print('Sin sprite:', [e['id'] for e in entries if not e['sprite']])
    print('Sin sprite shiny:', [e['id'] for e in entries if not e['spriteShiny']])
    print('Formas sin traducción ES:', sorted(set(MISSING_ES)))
    print('Sin HOME:', [e['id'] for e in entries if not e['home']][:40])


if __name__ == '__main__':
    main()
