import {Command, ResponseSender} from "./command";
import * as scheme from "../MapComplete/Docs/Schemas/LayoutConfigJson.schema.json"
import {Utils} from "../MapComplete/Utils";
import BaseUIElement from "../MapComplete/UI/BaseUIElement";
import Combine from "../MapComplete/UI/Base/Combine";
import Title from "../MapComplete/UI/Base/Title";
import List from "../MapComplete/UI/Base/List";
import {FixedUiElement} from "../MapComplete/UI/Base/FixedUiElement";
import showdown from "showdown";

export default class SchemeCommand extends Command<{
    key: string,
}> {
    constructor() {
        super("scheme", "Gives information about a key in a theme-config-file", {
            key: "The name of the key"
        }, {});
    }

    private static MdToElement(md: string): FixedUiElement {
        const converter = new showdown.Converter();
        return new FixedUiElement(converter.makeHtml(md))
    }

    private static SchemeInfo(requestedKey: string): BaseUIElement[] {
        const r: BaseUIElement[] = []
        const allKeys: string[] = [];
        for (const key in scheme.properties) {
            if (Utils.levenshteinDistance(key, requestedKey) >= 3) {
                allKeys.push(key)
                continue;
            }
            const item = scheme.properties[key]
            r.push(new Combine([
                new Title(key + " (used at top level," + (item.type ?? "no type specificied") + ")", 3),
                SchemeCommand.MdToElement(item.description)
            ]).SetClass("flex flex-col"))
        }

        // Hmmm... Nothing found
        // Let's have a look to the definition

        for (const typeDefinitionKey in scheme.definitions) {
            const typeDefinition = scheme.definitions[typeDefinitionKey]
            const props = typeDefinition["properties"]
            if (props === undefined) {
                continue
            }

            for (const key in props) {
                if (Utils.levenshteinDistance(key, requestedKey) >= 3) {
                    allKeys.push(key)
                    continue;
                }
                const item = props[key]
                r.push(new Combine([
                    new Title(key + " (used in " + typeDefinitionKey + ", " + (item?.type ?? "no type specificied") + ")", 3),
                    SchemeCommand.MdToElement(item.description)
                ]).SetClass("flex flex-col"))
            }
        }
        if (r.length == 0) {
            const matches = Utils.sortedByLevenshteinDistance(requestedKey, allKeys, key => key).slice(0, 5)
            r.push(new Combine(["No matching keys found, maybe you meant one of:", new List(matches)]))
        }

        return r;
    }

    protected async Run(r: ResponseSender, args: {
        category: "theme" | "layer" | "tagrendering",
        key: string
    } & { _: string }): Promise<any> {

        const items = SchemeCommand.SchemeInfo(args.key)
        await r.sendElement(new Combine(items).SetClass("lex flex-col"))
    }

}