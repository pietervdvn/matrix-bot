# MapComplete-bot

MapComplete bot is an experimental Matrix-bot which can be used to query and properly render OpenStreetMap.
Furthermore, it'll answer questions about MapComplete.

This bot is built upon the codebase of [MapComplete](https://mapcomplete.osm.be), which contains most of the codebase.
If you want to add a category of POI to Matrixbot, add them to MapComplete instead.

To see the possible commands, send the direct message `help` to [MapComplete-bot](https://matrix.to/#/@pietervdvn-bot:matrix.org).

## Deployment

```
git clone https://github.com/pietervdvn/matrix-bot
git submodule init
git submodule update
cd MapComplete
npm run init # Will install dependencies too
cd ..
ts-node src/index.ts --password <your bot account> <your bot password>
# The access token will be created and stored to disk; for furhter development, you can run
ts-node src/index.ts

```