import {Command, ResponseSender} from "./command";
import LayerConfig from "../MapComplete/Models/ThemeConfig/LayerConfig";
import {AllKnownLayouts} from "../MapComplete/Customizations/AllKnownLayouts";
import LayoutConfig from "../MapComplete/Models/ThemeConfig/LayoutConfig";
import Combine from "../MapComplete/UI/Base/Combine";
import List from "../MapComplete/UI/Base/List";
import Constants from "../MapComplete/Models/Constants";
import {Utils} from "../MapComplete/Utils";
import QueryParameterDocumentation from "../MapComplete/UI/QueryParameterDocumentation";
import Title from "../MapComplete/UI/Base/Title";
import BotUtils from "./Utils";
import {QueryParameters} from "../MapComplete/Logic/Web/QueryParameters";

export class DocumentationCommand extends Command<{ id: string }> {

    constructor() {
        super("docs", "Gets documentation about a mapcomplete layer, theme or URL-parameter",
            {
                "id": "The ID of the layer, theme or URL-parameter for which documentation is needed"
            }
        );
    }

    public static themesUsingLayer(id: string): LayoutConfig[] {
        return AllKnownLayouts.layoutsList.filter(l => l.id !== "personal" && l.layers.some(layer => layer.id === id))
    }

    private static matchingLayer(documentation): LayerConfig | undefined {
        for (const layer of AllKnownLayouts.AllPublicLayers()) {
            if (layer.id === documentation) {
                return layer;
            }
        }
    }

    public async Run(r: ResponseSender, args: { id: string }): Promise<void> {
        args.id = args.id?.trim()

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
        const th = AllKnownLayouts.allKnownLayouts.get(args.id)
        if (th !== undefined) {
            await r.sendElement(AllKnownLayouts.GenerateDocumentationForTheme(th))
            return
        }
        const layer = DocumentationCommand.matchingLayer(args.id)
        const d = layer === undefined ? undefined : layer.GenerateDocumentation(DocumentationCommand.themesUsingLayer(args.id).map(l => l.id))
        if (d !== undefined) {
            await r.sendElement(d)
            return;
        }

        const urlParamDocs = QueryParameterDocumentation.UrlParamDocs()
        const urlParamDoc = urlParamDocs[args.id];
        if (urlParamDoc !== undefined) {
            await r.sendElement(
                new Combine([
                    new Title("URL-parameter <code>" + args.id + "</code>"),
                    BotUtils.MdToElement(urlParamDoc)
                ]))
            return
        }

        await this.sendNothingFound(args, r);

    }

    private async sendNothingFound(args: { id: string }, r: ResponseSender) {
        const sorted = Utils.sortedByLevenshteinDistance(args.id, AllKnownLayouts.AllPublicLayers(), l => l.id).slice(0, 5)
        const sortedTheme = Utils.sortedByLevenshteinDistance(args.id, Array.from(AllKnownLayouts.allKnownLayouts.keys()), l => l).slice(0, 5)
        const qps = Object.keys(QueryParameters.documentation).slice(0,5);
        const sortedUrlParams = Utils.sortedByLevenshteinDistance(args.id, qps, qp => qp)
        await r.sendElement(new Combine([
            "No layer found with name <code>" + args.id + "</code>. Perhaps you meant one of: ",
            new List(sorted.map(l => `<code>${l.id}</code>`)),
            "No theme found with name <code>" + args.id + "</code>. Perhaps you meant one of: ",
            new List(sortedTheme.map(l => `<code>${l}</code>`)),
            "No URL-parameter found with name <code>" + args.id + "</>. Perhaps you meant one of: ",
            new List(sortedUrlParams.map(l => `<code>${l}</code>`))

        ]))
        return
    }
}
