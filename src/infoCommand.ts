import {Command, ResponseSender} from "./command";
import {OsmObject} from "../MapComplete/Logic/Osm/OsmObject";
import {AllKnownLayouts} from "../MapComplete/Customizations/AllKnownLayouts";
import LayerConfig from "../MapComplete/Models/ThemeConfig/LayerConfig";
import {UIEventSource} from "../MapComplete/Logic/UIEventSource";
import {AllTagsPanel} from "../MapComplete/UI/AllTagsPanel";
import Combine from "../MapComplete/UI/Base/Combine";
import Title from "../MapComplete/UI/Base/Title";
import TagRenderingConfig from "../MapComplete/Models/ThemeConfig/TagRenderingConfig";
import {SubstitutedTranslation} from "../MapComplete/UI/SubstitutedTranslation";
import BaseUIElement from "../MapComplete/UI/BaseUIElement";
import Table from "../MapComplete/UI/Base/Table";
import {Utils} from "../MapComplete/Utils";
import {FixedUiElement} from "../MapComplete/UI/Base/FixedUiElement";
import MetaTagging from "../MapComplete/Logic/MetaTagging";
import {ExtraFuncParams} from "../MapComplete/Logic/ExtraFunctions";
import Link from "../MapComplete/UI/Base/Link";
import {LayerDocumentationCommand} from "./layerDocumentationCommand";
import {GeoOperations} from "../MapComplete/Logic/GeoOperations";
import {Geocoding} from "../MapComplete/Logic/Osm/Geocoding";
import {CountryCoder} from "latlon2country";
import {OH} from "../MapComplete/UI/OpeningHours/OpeningHours";
import Translations from "../MapComplete/UI/i18n/Translations";
import Constants from "../MapComplete/Models/Constants";


export class InfoCommand extends Command<{ id: string }> {

    private _countryCoder: CountryCoder;

    constructor(countryCoder: CountryCoder) {
        super("info", "Gets info about an OSM-object. Either give an id OR a search string; the objects are interpreted and known values are shown.",
            {
                "id": "The ID of the OSM-object or a search query"
            }
        );
        this._countryCoder = countryCoder;
    }

    private static fallbackMappings(tags: any): Map<string, BaseUIElement> {
        const r = new Map<string, BaseUIElement>();

        {
            let ohViz: BaseUIElement = new FixedUiElement("No opening hours are known.")
            let ohSpec = tags["opening_hours"]
            if (ohSpec !== undefined) {

                try {

                    const oh = OH.CreateOhObject(
                        <any>tags, ohSpec
                    );

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const monday = OH.getMondayBefore(today)
                    const sunday = new Date(monday)
                    sunday.setTime(monday.getTime() + 7 * 24 * 60 * 60 * 1000)
                    const ranges = OH.GetRanges(oh, monday, sunday)
                    if (ranges.length === 0) {
                        ohViz = new FixedUiElement("Closed today and tomorrow")
                    } else {
                        const weekdaysTr = Translations.t.general.weekdays
                        const weekdays = {
                            0: weekdaysTr.monday,
                            1: weekdaysTr.tuesday,
                            2: weekdaysTr.wednesday,
                            3: weekdaysTr.thursday,
                            4: weekdaysTr.friday,
                            5: weekdaysTr.saturday,
                            6: weekdaysTr.sunday
                        }

                        ohViz = new Table([],
                            ranges.map((r, weekday) => {
                                return [weekdays[weekday],
                                    new Combine(r.map(r => {
                                        if (r.isSpecial) {
                                            return "<bold>" + r.comment + "</bold>"
                                        }
                                        if (!r.isOpen) {
                                            return "<bold>closed</bold>"
                                        }
                                        const strt = r.startDate;
                                        const end = r.endDate
                                        return `<code>${OH.hhmm(strt.getHours(), strt.getMinutes())}</code> till <code>${OH.hhmm(end.getHours(), end.getMinutes())}</code> `
                                    }))
                                ]
                            }))
                    }
                } catch (e) {
                    ohViz = Translations.t.general.opening_hours.error_loading
                }
            }
            r.set("opening_hours_table", ohViz)
        }

        r.set("multi_apply", undefined)
        r.set("reviews", undefined)
        r.set("image_carousel", undefined)

        return r
    }

    private static matchingLayers(properties): LayerConfig[] {
        const l = AllKnownLayouts.AllPublicLayers().filter(layer => {
                if (layer.source.geojsonSource !== undefined) {
                    return false
                }
                if (Constants.priviliged_layers.indexOf(layer.id) > 0) {
                    return false
                }
                if (layer.passAllFeatures || layer.forceLoad) {
                    return false
                }
                if (!layer.source.osmTags.matchesProperties(properties)) {
                    return false
                }
                return true;
            }
        )
        l.sort((a, b) => (a.minzoom ?? 999) - (b.minzoom ?? 999))
        console.log("Matching layers: ", l.map(l => l.id + ":" + l.minzoom).join(", "))
        return l;
    }


    public async Run(r: ResponseSender, args: { id: string, _: string }): Promise<void> {
        const id = args.id;
        if(id === null || id === undefined || id === ""){
             await r.sendNotice("Please, provide a search term of id to use this command")
             return
        }
        const matched = id.match(/(https:\/\/|http:\/\/)?(www\.)?(osm.org|openstreetmap.org)\/(node|way|relation)\/([0-9]+)/)
        if (matched !== null) {
            const type = matched[4]
            const n = matched[5]
            await this.SendInfoAbout(r, type + "/" + n);
            return;
        }

        const matchedSimple = id.match(/(node|way|relation)\/([0-9]+)/)
        if (matchedSimple !== null) {
            const type = matchedSimple[1]
            const n = matchedSimple[2]
            await this.SendInfoAbout(r, type + "/" + n);
            return;
        }

        await r.sendHtml("<code>" + id + "</code> doesn't seem to be a valid OSM-id - searching worldwide instead for " + args._)
        const geocoded = await Geocoding.Search(args._)
        if ((geocoded?.length ?? 0) === 0) {
            await r.sendHtml("Nothing found for " + args._)
            return;
        }


        await r.sendElement(
            new Combine([
                `Found ${geocoded.length} results for <code>${args._}</code>, fetching details about them...`,
                new Table([],
                    geocoded.map(r => {
                        return [new Link(r.osm_type + "/" + r.osm_id, "https://osm.org/" + r.osm_type + "/" + r.osm_id, true), new FixedUiElement(r.display_name)];
                    })
                )
            ])
        )


        const results = await Promise.all(geocoded.map(async geocoded => {
            const id = geocoded.osm_type + "/" + geocoded.osm_id
            const obj = await OsmObject.DownloadObjectAsync(id)
            if (obj === undefined) {
                return undefined
            }
            const layers = InfoCommand.matchingLayers(obj.tags)
            return ({obj, layers})
        }))

        const withLayer = results.filter(r => r?.layers.length > 0)
        if (withLayer.length === 0) {
            await r.sendHtml(
                `None of ${geocoded.length} results for <code>${args._}</code> match a mapcomplete layer...`,
            )
            return;
        }

        const el = withLayer[0]
        const geojson = el.obj.asGeoJson();
        const [lon, lat] = GeoOperations.centerpointCoordinates(geojson)
        const countries = await this._countryCoder.GetCountryCodeAsync(lon, lat)
        geojson.properties["_country"] = countries[0]
        await r.sendElement(new Combine([
            InfoCommand.render(geojson, el.layers),
        ]))
    }

    private static render(geojson, layers: LayerConfig[]): BaseUIElement {
        function r(tr: TagRenderingConfig) {
            if (tr === undefined) {
                return undefined;
            }
            return new SubstitutedTranslation(tr.GetRenderValue(geojson.properties), new UIEventSource<any>(geojson.properties), undefined,
                InfoCommand.fallbackMappings(geojson.properties)
            )
        }

        const params: ExtraFuncParams = {
            getFeatureById(id: string): any {
                if (id === geojson.properties.id) {
                    return geojson
                }
                return undefined;
            },
            getFeaturesWithin(): any[][] {
                return [];
            },
            memberships: undefined

        };
        MetaTagging.addMetatags([{feature: geojson, freshness: new Date()}],
            params,
            layers[0],
            undefined, {}
        )

        const [lon, lat] = GeoOperations.centerpointCoordinates(geojson)
        const baselayer = layers.find(l => l.title !== undefined)
        const theme = LayerDocumentationCommand.themesUsingLayer(baselayer.id)[0]

        const allTagRenderings: TagRenderingConfig[] = []
        const seenIds = new Set<string>()
        for (const layer of layers) {
            for (const tagRendering of layer.tagRenderings) {
                if (seenIds.has(tagRendering.id)) {
                    continue
                }
                seenIds.add(tagRendering.id)
                allTagRenderings.push(tagRendering)
            }
        }

        const values = Utils.NoNull(allTagRenderings.map(tr => {
            if ((r(tr).ConstructElement()?.innerHTML ?? "") === "") {
                return undefined
            }
            return [r(tr)];
        }))

        return new Combine([
            new Title(r(baselayer.title)),
            values.length > 0 ? new Table([], values) : "No relevant information yet",
            theme === undefined ? undefined :
                new Link("Edit this object on MapComplete",
                    `https://mapcomplete.osm.be/${theme?.id}.html?z=17&lon=${lon}&lat=${lat}#${geojson.properties.id}`, true
                )
        ])
    }

    private async SendInfoAbout(r: ResponseSender, id: string): Promise<void> {

        await r.sendNotice(`Fetching data about ${id}...`)
        const obj = await OsmObject.DownloadObjectAsync(id);
        if (obj === undefined) {
            await r.sendHtml(`Could not download <code>${id}</code>`);
            return;
        }
        const geojson = obj.asGeoJson();
        try {
            const layers = InfoCommand.matchingLayers(geojson.properties)

            let rendered: BaseUIElement = new AllTagsPanel(new UIEventSource(geojson.properties))

            if (layers.length > 0) {
                const [lon, lat] = GeoOperations.centerpointCoordinates(geojson)

                const countries = await this._countryCoder.GetCountryCodeAsync(lon, lat)
                geojson.properties["_country"] = countries[0]
                rendered = InfoCommand.render(obj, layers)
            }

            await r.sendElement(rendered)
        } catch (e) {
            console.error(e)
        }
    }
}
