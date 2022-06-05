import LayerConfig from "../../MapComplete/Models/ThemeConfig/LayerConfig";
import {CountryCoder} from "latlon2country";
import LayoutConfig from "../../MapComplete/Models/ThemeConfig/LayoutConfig";
import Combine from "../../MapComplete/UI/Base/Combine";
import {ExtraFuncParams} from "../../MapComplete/Logic/ExtraFunctions";
import {ResponseSender} from "../ResponseSender";
import {UIEventSource} from "../../MapComplete/Logic/UIEventSource";
import {GeoOperations} from "../../MapComplete/Logic/GeoOperations";
import MetaTagging from "../../MapComplete/Logic/MetaTagging";
import WikipediaBox from "../../MapComplete/UI/Wikipedia/WikipediaBox";
import {SubstitutedTranslation} from "../../MapComplete/UI/SubstitutedTranslation";
import {FixedUiElement} from "../../MapComplete/UI/Base/FixedUiElement";
import {OH} from "../../MapComplete/UI/OpeningHours/OpeningHours";
import BaseUIElement from "../../MapComplete/UI/BaseUIElement";
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
import Constants from "../../MapComplete/Models/Constants";
import {TagsCommand} from "./tagsCommand";
import {Utils} from "../../MapComplete/Utils";
import FeaturePipelineState from "../../MapComplete/Logic/State/FeaturePipelineState";
import {DefaultGuiState} from "../../MapComplete/UI/DefaultGuiState";


export class InfoCommand extends Command<"_"> {

    private _countryCoder: CountryCoder;

    constructor(countryCoder: CountryCoder) {
        super("info", "Gets info about an OSM-object. Either give an id OR a search string; the objects are interpreted and known values are shown.",
            {
                "_": "The ID of the OSM-object or a search query"
            }
        );
        this._countryCoder = countryCoder;
    }

    private static fallbackMappings(tags: any, requestRedraw: () => Promise<void>):
        Map<string, BaseUIElement | ((state: FeaturePipelineState, tagSource: UIEventSource<any>, argument: string[], guistate: DefaultGuiState) => BaseUIElement)> {
        const r = new Map<string, BaseUIElement |  ((state: FeaturePipelineState, tagSource: UIEventSource<any>, argument: string[], guistate: DefaultGuiState) => BaseUIElement)>();

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
        r.set("nearby_images", undefined)
        r.set("images", undefined)
        
        { r.set("wikipedia",

            (_, __, args, ___) => {

                const keys = (args[0] ?? "wikidata;wikipedia").split(";").map(k => k.trim())
                const values = keys.map(key => tags[key])[0]
                if(values == undefined || values == ""){
                    r.set("wikipedia",undefined)
                }
                const wikidatas: string[] =
                    Utils.NoEmpty(values?.split(";")?.map(wd => wd.trim()) ?? [])

                return new Table([],
                    [[new WikipediaBox(wikidatas, {
                    addHeader: true,
                    firstParagraphOnly: true,
                    currentState: new UIEventSource<"loading" | "loaded" | "error">("loading").addCallbackAndRun(state => {
                        if(state === "loaded"){
                            requestRedraw().catch(e => console.error(e))
                        }
                    }),
                    noImages: true
                })]]);
            }
            
            
            )
           
        }

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
        let id = args._.trim();
        if (id === null || id === undefined || id === "") {
            await r.sendNotice("Please, provide a search term of id to use this command")
            return
        }
        const matched = id.match(/(https:\/\/|http:\/\/)?(www\.)?(osm.org|openstreetmap.org)\/(node|way|relation)\/([0-9]+)/)
        if (matched !== null) {
            const type = matched[4]
            const n = matched[5]
            id = type+"/"+n;
        }

        const matchedSimple = id.match(/(node|way|relation)\/([0-9]+)/)
        if (matchedSimple !== null) {
            await r.sendNotice(`Fetching data about ${id}...`, true)
            const obj = await OsmObject.DownloadObjectAsync(id);
            if (obj === undefined) {
                await r.sendHtml(`Could not download <code>${id}</code>`);
                return;
            }
            const geojson = obj.asGeoJson();
            await this.SendInfoAbout(r, geojson);
            return;
        }

        await r.sendHtml("<code>" + id + "</code> doesn't seem to be a valid OSM-id - searching worldwide instead for " + args._, true)
        const geocoded = await Geocoding.Search(args._)
        if ((geocoded?.length ?? 0) === 0) {
            await r.sendHtml("Nothing found for " + args._)
            return;
        }


        await r.sendElementsEphemeral(
                `Found ${geocoded.length} results for <code>${args._}</code>, fetching details about them...`,
                new Table([],
                    geocoded.map(r => [new Link(r.osm_type + "/" + r.osm_id, "https://osm.org/" + r.osm_type + "/" + r.osm_id, true), new FixedUiElement(r.display_name)])
                )
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
            await TagsCommand.SendInfoAbout(r, geocoded[0])
            return;
        }

        const el = withLayer[0]
        const geojson = el.obj.asGeoJson();
        this.SendInfoAbout(r, geojson)

    }

    private static render(geojson, layers: LayerConfig[], requestRedraw: () => Promise<void>): BaseUIElement {
        function r(tr: TagRenderingConfig) {
            if (tr === undefined) {
                return undefined;
            }
            return new SubstitutedTranslation(tr.GetRenderValue(geojson.properties), 
                new UIEventSource<any>(geojson.properties), 
                undefined,
                InfoCommand.fallbackMappings(geojson.properties, requestRedraw)
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
                ...layers.map(l => AllKnownLayouts.themesUsingLayer(l.id, true))
            )
        ))

        let editButton: (BaseUIElement | string);
        if (themes.length > 0) {

            const [lon, lat] = GeoOperations.centerpointCoordinates(geojson)
            editButton = new Combine(
                themes.filter(th => !th.hideFromOverview).map(th => 
                    new Link(
                        new Title("Edit this element with "+th.title.txt ,5),
                        `https://mapcomplete.osm.be/${th.id}.html?z=17&lon=${lon}&lat=${lat}#${geojson.properties.id}`, true))
            )
        } else {
            editButton = "No mapcomplete themes support this element"
        }

        const props = geojson.properties
        return new Combine([
            new Title(new Combine([
                new Link(r(baselayer.title), "https://osm.org/" + geojson.properties.id, true),
                " ",
                ...layers[0].titleIcons.map(icon => icon.GetRenderValue(props)?.Subs(props)),

            ])),
            results.length > 0 ? new Combine(results) : "No relevant information yet",
            editButton
        ])
    }

    private async SendInfoAbout(r: ResponseSender, geojson: any): Promise<void> {
        try {
            const layers = InfoCommand.matchingLayers(geojson.properties)


            if (layers.length <= 0) {
                await r.sendElement(new AllTagsPanel(new UIEventSource(geojson.properties)))
                return;
            }
            
            const [lon, lat] = GeoOperations.centerpointCoordinates(geojson)

            const countries = await this._countryCoder.GetCountryCodeAsync(lon, lat)
            geojson.properties["_country"] = countries[0].toLowerCase()
            let element : BaseUIElement = undefined;
            let previousIds: string[] = []
            async function sendElement(): Promise<void> {
                if(element === undefined){
                    return
                }
      
                const newElements = await r.sendElement(element)
                while(previousIds.length > 0){
                    await r.client.redactEvent(r.roomId, previousIds.shift())
                }
                previousIds.push(...newElements)
                await r.sleep(100)
            }
            element = InfoCommand.render(geojson, layers, sendElement)
            sendElement()
            
        } catch (e) {
            console.log(e.toString())
        }
    }
}
