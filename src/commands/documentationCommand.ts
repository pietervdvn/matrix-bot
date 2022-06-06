import LayerConfig from "../../MapComplete/Models/ThemeConfig/LayerConfig";
import {AllKnownLayouts} from "../../MapComplete/Customizations/AllKnownLayouts";
import Title from "../../MapComplete/UI/Base/Title";
import {QueryParameters} from "../../MapComplete/Logic/Web/QueryParameters";
import {ResponseSender} from "../ResponseSender";
import QueryParameterDocumentation from "../../MapComplete/UI/QueryParameterDocumentation";
import {Utils} from "../../MapComplete/Utils";
import BotUtils from "../Utils";
import {Command} from "../command";
import List from "../../MapComplete/UI/Base/List";
import Constants from "../../MapComplete/Models/Constants";
import Translations from "../../MapComplete/UI/i18n/Translations";

export class DocumentationCommand extends Command<"id"> {

    constructor() {
        const t = Translations.t.matrixbot.commands.documentation
        super("docs", t.docs,
            {
                "id": t.argid
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

    public async Run(r: ResponseSender, args: { id: string } & { _: string }): Promise<void> {
        args.id = args.id?.trim()
        const t = Translations.t.matrixbot.commands.documentation

        if (args.id === undefined) {
            r.sendElements(t.noIdIntro,
                new List(AllKnownLayouts.AllPublicLayers()
                    .filter(l => Constants.priviliged_layers.indexOf(l.id) < 0 && l.source.geojsonSource === undefined)
                    .map(l =>
                        `<code>${l.id}</code> ${l.description?.txt ?? l.name?.txt ?? ""}`
                    ))
            )
            return;
        }
        const th = AllKnownLayouts.allKnownLayouts.get(args.id)
        if (th !== undefined) {
            await r.sendElement(AllKnownLayouts.GenerateDocumentationForTheme(th))
            return
        }
        const layer = DocumentationCommand.matchingLayer(args.id)
        const d = layer === undefined ? undefined : layer.GenerateDocumentation(AllKnownLayouts.themesUsingLayer(args.id).map(l => l.id))
        if (d !== undefined) {
            await r.sendElement(d)
            return;
        }

        const urlParamDocs = QueryParameterDocumentation.UrlParamDocs()
        const urlParamDoc = urlParamDocs[args.id];
        if (urlParamDoc !== undefined) {
            await r.sendElements(
                new Title(t.urlParam.Subs(args)),
                BotUtils.MdToElement(urlParamDoc))
            return
        }

        await DocumentationCommand.sendNothingFound(args, r);

    }

    private static async sendNothingFound(args: { id: string }, r: ResponseSender) {
        const t = Translations.t.matrixbot.commands.documentation
        const sorted = Utils.sortedByLevenshteinDistance(args.id, AllKnownLayouts.AllPublicLayers(), l => l.id).slice(0, 5)
        const sortedTheme = Utils.sortedByLevenshteinDistance(args.id, Array.from(AllKnownLayouts.allKnownLayouts.keys()), l => l).slice(0, 5)
        const qps = Object.keys(QueryParameters.documentation).slice(0, 5);
        const sortedUrlParams = Utils.sortedByLevenshteinDistance(args.id, qps, qp => qp)
        await r.sendElements(
            t.noLayerFound.Subs(args),
            new List(sorted.map(l => `<code>${l.id}</code>`)),
            t.noThemeFound.Subs(args),

            new List(sortedTheme.map(l => `<code>${l}</code>`)),
            t.noUrlParameterFound.Subs(args),
            new List(sortedUrlParams.map(l => `<code>${l}</code>`))
        )
        return
    }
}
