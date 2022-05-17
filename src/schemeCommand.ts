import {Command, ResponseSender} from "./command";
import * as scheme from "../MapComplete/assets/layoutconfigmeta.json"
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
        const sch :{path: string[], type?: string,typeHint?: string, description?: string}[] = scheme["default"] ?? scheme
        for (const item of sch) {
            const key = item.path[item.path.length - 1] ?? "";
            if (Utils.levenshteinDistance(key, requestedKey) >= 3) {
                allKeys.push(key)
                continue;
            }
            r.push(new Combine([
                new Title(`${key} (Used at <code>${item.path.join(".")}</code>, ${item.typeHint ?? item.type ?? "no type specificied"})`, 3),
                SchemeCommand.MdToElement(item.description)
            ]).SetClass("flex flex-col"))
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