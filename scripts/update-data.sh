#!/usr/bin/env bash
# Descarga los CSV de PokéAPI y el listado de sprites, y regenera public/data/pokedex.json
# Úsalo cuando salgan Pokémon o formas nuevas (tras actualizarse PokéAPI).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .data/csv
FILES="pokemon_species pokemon_species_names pokemon pokemon_forms pokemon_form_names pokemon_types type_names pokemon_species_flavor_text"
for f in $FILES; do
  echo "↓ $f.csv"
  curl -sfL -o ".data/csv/$f.csv" "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/$f.csv"
done

echo "↓ listado de sprites"
rm -rf .data/sprites-repo
git clone -q --depth 1 --filter=blob:none --no-checkout https://github.com/PokeAPI/sprites.git .data/sprites-repo
git -C .data/sprites-repo ls-tree -r --name-only HEAD sprites/pokemon \
  | grep -E '^sprites/pokemon/(shiny/)?(female/)?[^/]+\.png$' > .data/sprites.txt
git -C .data/sprites-repo ls-tree -r --name-only HEAD sprites/pokemon/other/home \
  | grep -E 'other/home/(shiny/)?(female/)?[^/]+\.png$' > .data/home.txt
rm -rf .data/sprites-repo

python3 scripts/build-data.py --csv .data/csv --sprites .data/sprites.txt --home .data/home.txt

echo "↓ tablas de encuentros de PKHeX"
rm -rf .data/pkhex
git clone -q --depth 1 --filter=blob:none --sparse https://github.com/kwsch/PKHeX.git .data/pkhex
git -C .data/pkhex sparse-checkout set \
  PKHeX.Core/Resources/legality/wild \
  PKHeX.Core/Resources/text/locations/gen7 PKHeX.Core/Resources/text/locations/gen8 \
  PKHeX.Core/Resources/text/locations/gen8a PKHeX.Core/Resources/text/locations/gen8b \
  PKHeX.Core/Resources/text/locations/gen9 PKHeX.Core/Resources/text/locations/gen9a \
  PKHeX.Core/Legality/Encounters/Data/Gen7 PKHeX.Core/Legality/Encounters/Data/Gen8 \
  PKHeX.Core/Legality/Encounters/Data/Gen9

python3 scripts/build-locations.py --pkhex .data/pkhex/PKHeX.Core --csv .data/csv \
  --pokedex public/data/pokedex.json --out public/data/locations.json
