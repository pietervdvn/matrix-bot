import LayerConfig from "../../MapComplete/Models/ThemeConfig/LayerConfig";
import {CountryCoder} from "latlon2country";
import LayoutConfig from "../../MapComplete/Models/ThemeConfig/LayoutConfig";
import Combine from "../../MapComplete/UI/Base/Combine";
import {ExtraFuncParams} from "../../MapComplete/Logic/ExtraFunctions";
import {ResponseSender} from "../ResponseSender";
import {DocumentationCommand} from "./documentationCommand";
import {UIEventSource} from "../../MapComplete/Logic/UIEventSource";
import {GeoOperations} from "../../MapComplete/Logic/GeoOperations";
import MetaTagging from "../../MapComplete/Logic/MetaTagging";
import WikipediaBox from "../../MapComplete/UI/Wikipedia/WikipediaBox";
import {SubstitutedTranslation} from "../../MapComplete/UI/SubstitutedTranslation";
import {FixedUiElement} from "../../MapComplete/UI/Base/FixedUiElement";
import {OH} from "../../MapComplete/UI/OpeningHours/OpeningHours";
import BaseUIElement from "../../MapComplete/UI/BaseUIElement";
import Img from "../../MapComplete/UI/Base/Img";
import Table from "../../MapComplete/UI/Base/Table";
import {AllKnownLayouts} from "../../MapComplete/Customizations/AllKnownLayouts";
import {AllTagsPanel} from "../../MapComplete/UI/AllTagsPanel";
import Title from "../../MapComplete/UI/Base/Title";
import {Paragraph} from "../../MapComplete/UI/Base/Paragraph";
import {Command} from "../command";
import TagRenderingConfig from "../../MapComplete/Models/ThemeConfig/TagRenderingConfig";
import {OsmObject} from "../../MapComplete/Logic/Osm/OsmObject";
import {Geocoding} from "../../MapComplete/Logic/Osm/Geocoding";
import Translations from "../../MapComplete/UI/i18n/Translations";
import Link from "../../MapComplete/UI/Base/Link";


export class InfoCommand extends Command<{ _: string }> {

    private _countryCoder: CountryCoder;
    private static config = (() => {
        WikipediaBox.configuration.onlyFirstParagaph = true
        WikipediaBox.configuration.addHeader = true

        return 42
    })();

    constructor(countryCoder: CountryCoder) {
        super("info", "Gets info about an OSM-object. Either give an id OR a search string; the objects are interpreted and known values are shown.",
            {
                "_": "The ID of the OSM-object or a search query"
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
                                        return `<div><code>${OH.hhmm(strt.getHours(), strt.getMinutes())}</code> till <code>${OH.hhmm(end.getHours(), end.getMinutes())}</code></div> `
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


    public async Run(r: ResponseSender, args: {  _: string }): Promise<void> {
        const id = args._;
        if (id === null || id === undefined || id === "") {
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


        const seenIds = new Set<string>()
        const results: BaseUIElement [] = []
        for (const layer of layers) {
            for (const tagRendering of layer.tagRenderings) {
                if (seenIds.has(tagRendering.id)) {
                    continue
                }
                seenIds.add(tagRendering.id)
                const innerHtmlExample: string = ResponseSender.prepHtml(r(tagRendering).ConstructElement())?.innerHTML ?? ""
                if (innerHtmlExample === "") {
                    continue
                }
                if (innerHtmlExample.length > 8000) {
                    continue
                }
                results.push(new Paragraph(r(tagRendering)))
            }
        }

        const baselayer = layers.find(l => l.title !== undefined)

        const themes: LayoutConfig[] =Array.from( new Set(
            [].concat(
                ...layers.map(l => DocumentationCommand.themesUsingLayer(l.id))
            )
        ))

        let editButton: (BaseUIElement | string);
        if (themes.length > 0) {

            const [lon, lat] = GeoOperations.centerpointCoordinates(geojson)
            editButton = new Combine(
                themes.filter(th => !th.hideFromOverview).map(th => 
                    new Link(
                        new Combine([
                            new Img("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"no\"?>\n" +
                                "<svg\n" +
                                "   width=\"100\"\n" +
                                "   height=\"100\"\n" +
                                "   viewBox=\"0 0 100 100\"\n" +
                                "   version=\"1.1\"\n" +
                                "   id=\"svg5\"\n" +
                                "   xmlns=\"http://www.w3.org/2000/svg\"\n" +
                                "   xmlns:svg=\"http://www.w3.org/2000/svg\">\n" +
                                "  <defs\n" +
                                "     id=\"defs9\" />\n" +
                                "  <g\n" +
                                "     id=\"surface1\"\n" +
                                "     transform=\"matrix(0.30010319,0,0,0.30010319,1.0841831,-6.6113148)\">\n" +
                                "    <path\n" +
                                "       style=\"fill:#000000;fill-opacity:1;fill-rule:nonzero;stroke:none\"\n" +
                                "       d=\"M 257.71484,23.375 210.85547,70.125 281.14453,140.25 328,93.5 Z M 0,280.5 0.25,350.83203 70.285156,350.625 257.71484,163.625 187.42969,93.5 Z m 70.285156,46.75 H 23.429688 V 280.5 h 23.425781 v 23.375 h 23.429687 z m 0,0\"\n" +
                                "       id=\"path2\" />\n" +
                                "  </g>\n" +
                                "</svg>\n", true),
                        new Title("Edit this element with "+th.title.txt ,5), 
                        ]),
                        `https://mapcomplete.osm.be/${th.id}.html?z=17&lon=${lon}&lat=${lat}#${geojson.properties.id}`, true))
            )
        } else {
            editButton = "No mapcomplete themes support this element"
        }

        return new Combine([
            new Link(new Title(r(baselayer.title)), "https://osm.org/" + geojson.properties.id, true),
            results.length > 0 ? new Combine(results) : "No relevant information yet",
            editButton
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
                geojson.properties["_country"] = countries[0].toLowerCase()
                rendered = InfoCommand.render(obj, layers)
            }

            
            
            await r.sendHtml(rendered.ConstructElement().outerHTML)
        } catch (e) {
            console.error(e)
        }
    }
}
