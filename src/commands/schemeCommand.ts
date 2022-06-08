import BaseUIElement from "../../MapComplete/UI/BaseUIElement";
import {Command} from "../command";
import {Utils} from "../../MapComplete/Utils";
import Combine from "../../MapComplete/UI/Base/Combine";
import Title from "../../MapComplete/UI/Base/Title";
import List from "../../MapComplete/UI/Base/List";
import BotUtils from "../Utils";
import {ResponseSender} from "../ResponseSender";
import * as scheme from "../../MapComplete/assets/layoutconfigmeta.json"
import Translations from "../../MapComplete/UI/i18n/Translations";
export default class SchemeCommand extends Command<"key"> {
    constructor() {
        const t = Translations.t.matrixbot.commands.scheme;
        super("scheme", t.docs, {
            key: t.argkey
        }, {});
    }

    private static SchemeInfo(requestedKey: string): BaseUIElement[] {
        const t = Translations.t.matrixbot.commands.scheme;
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
                new Title(t.title.Subs({
                    key, path: item.path.join("."),
                    type: item.typeHint ?? item.type ?? t.notype
                }), 3),
                BotUtils.MdToElement(item.description)
            ]).SetClass("flex flex-col"))
        }

      
        if (r.length == 0) {
            const matches = Utils.sortedByLevenshteinDistance(requestedKey, allKeys, key => key).slice(0, 5)
            r.push(new Combine([t.noMatchingLayer, new List(matches)]))
        }

        return r;
    }

    protected async Run(r: ResponseSender, args: {
        category: "theme" | "layer" | "tagrendering",
        key: string
    } & { _: string }): Promise<any> {

        const items = SchemeCommand.SchemeInfo(args.key)
        await r.sendElements(...items)
    }

}