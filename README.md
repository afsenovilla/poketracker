# Poketracker

Seguimiento de tu **Living Dex** y **Shiny Living Dex** de Pokémon HOME, en español.

Está basado en el frontend de [PokédexTracker](https://github.com/pokedextracker/pokedextracker.com) (licencia MIT; ver `LICENSE-pokedextracker.txt`). Conserva su diseño y su sistema de cajas, pero ya no necesita su backend:

| PokédexTracker original | Poketracker |
| --- | --- |
| Backend en Go + PostgreSQL con los datos de los Pokémon (nunca se publicaron) | Datos generados desde PokéAPI en `public/data/pokedex.json` |
| Cuentas de usuario en su servidor | Tu progreso se guarda en un JSON de **tu** repositorio de GitHub |
| Inglés | Nombres, formas, tipos y entradas de Pokédex en español |
| Webpack, React 17 | Vite, React 18 |

## Qué hace

- Varias dex a la vez (normal y shiny): las 1025 especies y, si quieres, las 57 formas regionales.
- Cajas de 30 en el mismo orden en que los guardas en HOME. Las formas regionales pueden ir junto a su especie o en cajas propias al final.
- Cada Pokémon tiene tres estados: **no lo tengo**, **en otro juego** (pendiente de pasar a HOME, con un desplegable para indicar el juego) y **en HOME**.
  - Un clic lo marca como «en HOME», y «Marcar todos» marca la caja entera.
  - Los pendientes se ven en azul, con la abreviatura del juego, y tienen su propio filtro.
  - Al marcar uno como «en HOME» deja de estar pendiente.
- Puedes **excluir** un Pokémon que no esté disponible o que no busques: deja de contar para el total.
- **Dónde capturarlo:** lugares por juego (Let's Go, Espada/Escudo, DBPR, Leyendas Arceus, Escarlata/Púrpura, Leyendas Z-A), en español, más si está en Pokémon GO y de qué Pokémon evoluciona.
- Búsqueda por nombre, forma o número (sin importar las tildes) y filtros por generación, por «solo los que me faltan» y por «pendientes de pasar a HOME».
- Ficha con el render de HOME (normal o shiny), tipos y entrada de la Pokédex, con enlaces a WikiDex.
- **Móvil:** la dex se ve como una rejilla de iconos, 6 por fila como en HOME. Un toque marca el Pokémon y una pulsación larga abre su ficha.
- Modo noche y copia de seguridad (exportar/importar JSON).

Con las formas regionales al final, la dex tiene 1082 casillas en 37 cajas: 35 de especies y 2 de formas.

## Publicarla en GitHub Pages

1. Crea un repositorio (por ejemplo `afsenovilla/poketracker`) y sube este proyecto a la rama `main`.
2. En **Settings → Pages**, elige **Source: GitHub Actions**. El workflow `.github/workflows/deploy.yml` compila y publica la web en cada push.
3. **Dominio propio:** `public/CNAME` ya contiene `pokedex.asuntosimportant.es`.
   - En el DNS de `asuntosimportant.es`, crea un registro **CNAME** `pokedex` → `afsenovilla.github.io`.
   - En **Settings → Pages → Custom domain**, escribe el mismo dominio y activa **Enforce HTTPS** cuando GitHub emita el certificado (puede tardar unos minutos).
   - Si prefieres `https://<usuario>.github.io/<repo>/`, borra `public/CNAME` y activa `BASE_PATH` en el workflow (hay un comentario explicándolo).

El progreso puede guardarse en el mismo repositorio (por defecto en `data/progreso.json`). El workflow ignora los cambios en `data/`, así que guardar progreso no vuelve a publicar la web. Si el repositorio es público, el progreso también lo es.

### Conectar el guardado en GitHub

1. Crea un token *fine-grained* en <https://github.com/settings/personal-access-tokens/new>:
   - **Repository access:** *Only select repositories* → el repositorio de la web (o el que uses para los datos).
   - **Permissions → Repository → Contents:** *Read and write*.
   - Pon una caducidad (por ejemplo, un año).
2. En la web, abre **Mis dex → Ajustes y sincronización** y rellena el usuario, el repositorio, la rama, la ruta (`data/progreso.json`) y el token.
3. Repite el paso 2 en cada dispositivo (PC, móvil…).

Cómo funciona:

- El token solo se guarda en el `localStorage` de ese navegador y solo se envía a `api.github.com`. Si usas un ordenador compartido, desconéctalo al terminar.
- Los cambios se agrupan y se guardan unos 2 segundos después del último clic. Cada guardado es un commit.
- Si otro dispositivo ha guardado antes, la web descarga su versión y vuelve a aplicar tus cambios encima, así que no se pierde nada.
- Sin conexión, los cambios quedan pendientes en el navegador y se suben al volver la conexión.
- El icono de la barra superior muestra el estado: ✓ guardado, ☁ pendiente, ⚠ error.

### Modo lectura

Sin token, la web lee `data/progreso.json` del repositorio público y muestra el progreso **sin permitir cambios**: no se puede marcar, crear dex ni editar, y un clic en un Pokémon solo abre su ficha. El repositorio de lectura se configura en `src/config.ts`.

- **Cómo lee el fichero:** usa primero la API de GitHub sin autenticar, que siempre está al día pero admite 60 peticiones por hora por IP. Si se agota ese límite, pasa a `raw.githubusercontent.com`, que puede ir unos minutos por detrás.
- **Uso solo local:** si pones `PUBLIC_PROGRESS = null`, la web vuelve a funcionar sin GitHub, guardando el progreso en el navegador.

## Datos

`public/data/pokedex.json` se genera con `scripts/build-data.py` a partir de:

- los CSV de [PokéAPI](https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv): nombres en español, formas, tipos y entradas de la Pokédex;
- el listado de [PokeAPI/sprites](https://github.com/PokeAPI/sprites). Los sprites se cargan desde `raw.githubusercontent.com` y no se copian al repositorio.

`public/data/locations.json` («Dónde capturarlo») se genera con `scripts/build-locations.py` a partir de las tablas de encuentros de [PKHeX](https://github.com/kwsch/PKHeX) (GPL-3.0). Incluye:

- encuentros salvajes (visibles y ocultos);
- Grutas del Subsuelo, en DBPR;
- encuentros fijos y regalos;
- Teraincursiones, con sus estrellas;
- disponibilidad en Pokémon GO.

Los nombres de los lugares salen en español, tal como aparecen en los juegos. Limitaciones:

- Las exclusivas de versión solo se indican en Let's Go, Espada/Escudo y DBPR, y en los encuentros fijos de Escarlata/Púrpura. Las tablas salvajes de Escarlata/Púrpura no distinguen la versión.
- No incluye las incursiones Dinamax, los intercambios ni los eventos.
- Tampoco muestra los lugares de Pokémon GO, que dependen de eventos; solo si está disponible.

Para regenerar ambos ficheros (por ejemplo, cuando salgan Pokémon o formas nuevas) no hace falta instalar nada. En la pestaña **Actions** del repositorio, abre **Actualizar datos de Pokémon** y pulsa **Run workflow**. También se ejecuta solo el día 1 de cada mes. Si hay cambios, los guarda y vuelve a publicar la web.

Si prefieres hacerlo en local: `npm run data` (necesita python3, git y curl).

### Qué formas hay en los datos

Las dex solo usan las especies y las **formas regionales**. Los datos también incluyen formas alternativas y diferencias de género, pero la web no las muestra (ver `includeEntry` en `src/lib/data.ts`).


Se incluyen las formas que HOME guarda como distintas y que no se pueden cambiar a voluntad:

- **Regionales:** Alola, Galar, Hisui y Paldea (incluidas las tres razas de Tauros).
- **Alternativas:** Unown, Burmy, Wormadam, Shellos, Gastrodon, Basculin, Deerling, Sawsbuck, Vivillon, Flabébé, Floette, Florges, Pumpkaboo, Gourgeist, Zygarde 10 %, Oricorio, Lycanroc, núcleos de Minior, Magearna Color Vetusto, Toxtricity, Sinistea, Polteageist, las 63 Alcremie, Urshifu, Zarude Papá, Ursaluna Luna Carmesí, Maushold, Squawkabilly, Tatsugiri, Dudunsparce, Gimmighoul, Poltchageist, Sinistcha y las gorras de Pikachu.
- **Género:** todas las especies con sprite de hembra distinto, más Meowstic, Indeedee, Basculegion, Oinkologne, Pyroar, Frillish y Jellicent.

Quedan fuera las megaevoluciones, las formas Gigamax, las formas de combate y las totémicas. También las formas que se pueden cambiar (Rotom, Deoxys, Giratina, Shaymin, la Forma Tótem de Tornadus, Thundurus, Landorus y Enamorus, Arceus, Silvally, Furfrou, Ogerpon, Kyurem y Necrozma fusionados, Hoopa desatado, Calyrex con montura, Dialga y Palkia Origen), además de Pikachu Coqueta y Pikachu/Eevee compañeros, Pichu Picoreja, Floette Eterna y las variantes de Scatterbug y Spewpa, que se ven iguales.

Todo esto se puede cambiar en las listas `EXCLUDE` / `EXCLUDE_PREFIX` de `scripts/build-data.py`. Si solo quieres saltarte algún Pokémon (por ejemplo, uno que no tenga variocolor), usa **Excluir** en su ficha.

> **Aviso:** si cambias el identificador de una forma, las casillas ya marcadas de esa forma dejan de coincidir. Añadir o quitar formas no afecta al resto.

## Desarrollo

```sh
npm install
npm run dev       # http://localhost:5173
npm run build     # comprueba los tipos y compila en dist/
```

Estructura:

```
src/
  lib/
    types.ts      modelos (Entry, DexConfig, ProgressDoc…)
    data.ts       carga de la Pokédex y de las ubicaciones, orden de las cajas y URLs de los sprites
    games.ts      juegos para el desplegable «en otro juego»
    doc.ts        operaciones puras sobre el progreso
    store.tsx     estado global y sincronización con GitHub (con reintento ante conflictos)
    github.ts     API de contenidos de GitHub
  components/     páginas (Inicio, Ajustes, Tracker) y componentes
  styles/         SCSS de PokédexTracker + poketracker.scss
scripts/
  build-data.py       genera pokedex.json (PokéAPI)
  build-locations.py  genera locations.json (PKHeX)
  update-data.sh  descarga las fuentes y lo ejecuta
```

Formato del fichero de progreso:

```json
{
  "version": 1,
  "dexes": [{ "id": "…", "title": "Living Dex", "shiny": false, "regional": true, "forms": true, "gender": true, "layout": "junto" }],
  "captures": { "<id de la dex>": { "pikachu": { "c": 1, "t": 1726570000000 }, "eevee": { "g": "sv", "t": 1726570000000 }, "mew": { "x": 1, "t": 1726570000000 } } }
}
```

`c` = en HOME, `g` = en otro juego (su id), `x` = excluido y `t` = fecha de la última modificación.

## Créditos

- [PokédexTracker](https://github.com/pokedextracker) (MIT) © Robin Joseph y colaboradores.
- Datos y sprites: [PokéAPI](https://pokeapi.co).
- Tablas de encuentros y nombres de lugares: [PKHeX](https://github.com/kwsch/PKHeX) (GPL-3.0).
- Pokémon y los nombres de Pokémon son marcas de Nintendo, Game Freak y The Pokémon Company. Este es un proyecto personal sin ánimo de lucro.
