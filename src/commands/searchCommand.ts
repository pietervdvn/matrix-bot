import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import {AllKnownLayouts} from "../../MapComplete/Customizations/AllKnownLayouts";
import LayerConfig from "../../MapComplete/Models/ThemeConfig/LayerConfig";
import {Utils} from "../../MapComplete/Utils";
import {Overpass} from "../../MapComplete/Logic/Osm/Overpass";
import Constants from "../../MapComplete/Models/Constants";
import {Geocoding} from "../../MapComplete/Logic/Osm/Geocoding";
import {BBox} from "../../MapComplete/Logic/BBox";
import List from "../../MapComplete/UI/Base/List";
import {GeoOperations} from "../../MapComplete/Logic/GeoOperations";
import Combine from "../../MapComplete/UI/Base/Combine";
import Link from "../../MapComplete/UI/Base/Link";
import {FeatureCollection} from "@turf/turf";
import PresetConfig from "../../MapComplete/Models/ThemeConfig/PresetConfig";
import {And} from "../../MapComplete/Logic/Tags/And";

export default class SearchCommand extends Command<{
    layerid: string,
    verb: "in" | "near" | string,
    _: string
}> {

    constructor() {
        super("search", "Searches for POI in or near a location", {
            layerid: "The name of a layer OR a single search term",
            verb: "Either search in a geographical area (e.g. a city) or search near a POI",
            _: "The search term"
        });
    }

    private static findMatchingLayer(requestedId: string, language: string): {config: LayerConfig, preset?: PresetConfig} | undefined {
        const simplifiedRequestedId = requestedId.toLowerCase().replace(/[ _]/g, "")
        // First search for matching layer ids and layer names
        for (const layer of AllKnownLayouts.AllPublicLayers()) {
            const simplifiedLayerId = layer.id.toLowerCase().replace(/[ _]/g, "")
            if (Utils.levenshteinDistance(simplifiedRequestedId, simplifiedLayerId) < 3) {
                return {config: layer};
            } 
            const simplifiedLayerName = layer.name?.textFor(language)?.toLowerCase()?.replace(/[ _]/g, "")

            if(simplifiedLayerName !== undefined && Utils.levenshteinDistance(simplifiedRequestedId,simplifiedLayerName ) < 3){
                return {config: layer}
            }

        }

        // Next: search the presets for a match
        for (const layer of AllKnownLayouts.AllPublicLayers()) {
            for (const preset of layer.presets) {
                const simplifiedPresetTitle = preset.title.textFor(language)?.toLowerCase()?.replace(/[ _]/g, "")
                if (simplifiedPresetTitle !== undefined && simplifiedPresetTitle.indexOf(simplifiedRequestedId) >= 0) {
                    return {config: layer, preset};
                }
            }

        }

        return undefined;
    }

    protected async Run(r: ResponseSender, args: { layerid: string; verb: "in" | "near" | string; _: string } & { _: string }): Promise<any> {

        // This is a bit a special command: we parse the arguments again
        const argsRaw = [args.layerid, args.verb, args._].join(" ")
        let mode: "in" | "near"
        let layerId: string;
        let search: string
        if (argsRaw.indexOf(" near ") > 0) {
            [layerId, search] = argsRaw.split(" near ")
            mode = "near";
        } else if (argsRaw.indexOf(" in ") > 0) {
            [layerId, search] = argsRaw.split(" in ")
            mode = "in"
        } else {
            await r.sendHtml(`<p>Sorry, I didn't understand your command as I didn't find a <code>near</code> or <code>in</code> in your search query.
 Try something as <code>search drinking water in London</code>, <code>search friture in Brussels</code></p>
 <p>Alternatively, try <code>info ${[args.layerid, args.verb, args._].join(" ").trim()}</code> to get info about a single object</p>`)
            return;
        }


        const layer = SearchCommand.findMatchingLayer(layerId, r.roomSettings()?.language?.data ?? "en");
        if (layer === undefined) {
            await r.sendNotice("I didn't find a matching layer")
            return
        }

        const overpass = new Overpass(new And(layer.preset?.tags ?? [layer.config.source.osmTags]), [], Constants.defaultOverpassUrls[1]);

        const layerTitle = r.text(layer.preset?.title ?? layer.config.name)
        await r.sendHtml(`Searching ${layerTitle} ${mode} <code>${search}</code>...`, true)
        const geocodedEntries = await Geocoding.Search(search)
        if (geocodedEntries.length === 0) {
            await r.sendNotice("Sorry, I couldn't find anything for <code>" + search + "</code>, so I can't search for " + layerTitle)
            return
        }
        if (mode === "in") {
            const found = geocodedEntries.find(entry => entry.osm_type !== "node")
            if (found !== undefined) {
                const [geojsons] = await overpass.ExecuteQuery(
                    overpass.buildScriptInArea({
                        osm_type: <any>found.osm_type,
                        osm_id: Number(found.osm_id)
                    })
                )
                await this.SendInfoAbout(r, geojsons, layer.config, found)
            } else {
                // We only found points, switch to 'near'-mode
                mode = "near";
            }

        }

        if (mode === "near") {
            const found = geocodedEntries[0]
            const bbox = new BBox(
                [
                    [found.lon, found.lat]
                ]
            ).expandToTileBounds(17).pad(8);
            const [geojsons] = await overpass.queryGeoJson(bbox)
            await this.SendInfoAbout(r, geojsons, layer.config, found)
        }


        return;
    }

    private async SendInfoAbout(r: ResponseSender, geojsons: FeatureCollection, layer: LayerConfig, centerpoint: { lon: number, lat: number }): Promise<void> {
        const theme = AllKnownLayouts.themesUsingLayer(layer.id)[0]

        const feats = geojsons.features.map(geojson => {
            const distance = GeoOperations.distanceBetween(GeoOperations.centerpointCoordinates(geojson), [centerpoint.lon, centerpoint.lat])
            let humanDistance = Math.round(distance) + "m"
            if (distance > 1000) {
                humanDistance = Utils.Round(distance / 1000) + "km"
            }
            return {
                geojson,
                distance,
                humanDistance
            };
        })

        feats.sort((f0, f1) => f0.distance - f1.distance);

        const items = new List(
            feats.slice(0, 25).map(feat => {
                const props = feat.geojson.properties
                const title = r.text(layer.title.GetRenderValue(props).Subs(props));
                return new Combine([
                    new Link(title, `https://mapcomplete.osm.be/${theme.id}?z=${layer.minzoom}#${feat.geojson.properties.id}`, true),
                    " ",
                    ...layer.titleIcons.map(icon => r.text(icon.GetRenderValue(props)?.Subs(props))),
                    " (" + feat.humanDistance + " away)"
                ]);
            }));
        await r.sendElements(
                    "I found " + feats.length + " matching items.",
                    feats.length > 25 ? `<p><i>I'm only showing the 25 items closest to the <a href='https://mapcomplete.osm.be/${theme.id}?lat=${centerpoint.lat}&lon=${centerpoint.lon}&z=15' target='_blank'>searched location</a>.</i></p>`: undefined,
                    items
            )
    }


}