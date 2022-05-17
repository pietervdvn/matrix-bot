import {Command, ResponseSender} from "./command";
import LayerConfig from "../MapComplete/Models/ThemeConfig/LayerConfig";
import {AllKnownLayouts} from "../MapComplete/Customizations/AllKnownLayouts";
import LayoutConfig from "../MapComplete/Models/ThemeConfig/LayoutConfig";
import Combine from "../MapComplete/UI/Base/Combine";
import List from "../MapComplete/UI/Base/List";
import Constants from "../MapComplete/Models/Constants";
import {Utils} from "../MapComplete/Utils";

export class DocumentationCommand extends Command<{ id: string }> {

    constructor() {
        super("docs", "Gets documentation about a mapcomplete layer",
            {
                "id": "The ID of the layer for which documentation is needed"
            }
        );
    }

    private static matchingLayer(documentation): LayerConfig | undefined {
        for (const layer of AllKnownLayouts.AllPublicLayers()) {
            if (layer.id === documentation) {
                return layer;
            }
        }
    }

    public static themesUsingLayer(id: string): LayoutConfig[] {
        return AllKnownLayouts.layoutsList.filter(l => l.id !== "personal" && l.layers.some(layer => layer.id === id))
    }

    public async Run(r: ResponseSender, args: { id: string }): Promise<void> {
        if (args.id === undefined) {
            r.sendElement(
                new Combine([
                        "Give a layer id to get information about a layer. Known layers are:",
                        new List(AllKnownLayouts.AllPublicLayers()
                            .filter(l => Constants.priviliged_layers.indexOf(l.id) < 0 && l.source.geojsonSource === undefined)
                            .map(l =>
                                `<code>${l.id}</code> ${l.description?.txt ?? l.name?.txt ?? ""}`
                            ))
                    ]
                ))
            return;
        }
        const layer = DocumentationCommand.matchingLayer(args.id)
        const th = AllKnownLayouts.allKnownLayouts.get(args.id)
        if(th !== undefined){
            await r.sendElement(AllKnownLayouts.GenerateDocumentationForTheme(th))
            return
        }
        if (layer === undefined) {
            const sorted = Utils.sortedByLevenshteinDistance(args.id, AllKnownLayouts.AllPublicLayers(), l => l.id).slice(0, 5)
            const sortedTheme = Utils.sortedByLevenshteinDistance(args.id, Array.from(AllKnownLayouts.allKnownLayouts.keys()), l => l).slice(0, 5)
            await r.sendElement(new Combine([
                "No layer found with name <code>" + args.id + "</code>. Perhaps you meant one of: ",
                new List(sorted.map(l => `<code>${l.id}</code>`)),
                "No theme found with name <code>" + args.id + "</code>. Perhaps you meant one of: ",
                new List(sortedTheme.map(l => `<code>${l}</code>`))

            ]))
            return
        }
        const d = layer.GenerateDocumentation(DocumentationCommand.themesUsingLayer(args.id).map(l => l.id))

        if (d === undefined) {
            const closest = Utils.sortedByLevenshteinDistance(args.id, AllKnownLayouts.AllPublicLayers(), l => l.id)
                .slice(0, 3)
                .map(l => "<code>" + l.id + "</code>")
            await r.sendHtml("No layer nor theme found with name <code>" + args.id + "</code>. Maybe try " + closest.join(", "))
        }
        await r.sendElement(d)
    }
}
