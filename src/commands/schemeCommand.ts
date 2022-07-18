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
import {Translation} from "../../MapComplete/UI/i18n/Translation";
import {JsonSchema, JsonSchemaType} from "../../MapComplete/scripts/fixSchemas";

export default class SchemeCommand extends Command<"key"> {
    constructor() {
        const t = Translations.t.matrixbot.commands.scheme;
        super("scheme", t.docs, {
            key: t.argkey
        }, {});
    }

    private static typeToString(descr: JsonSchemaType, addParens = false): string {
        if (typeof descr === "string") {
            return descr
        }
        if (descr["$ref"] !== undefined) {
            return descr["$ref"].substring("#/definitions/".length)
        }
        if (descr["type"] !== undefined) {
            return descr["type"]
        }
        const result = (<JsonSchemaType[]>descr).map(d => SchemeCommand.typeToString(d, true)).join(" | ")
        if (addParens) {
            return "(" + result + ")"
        }
        return result
    }

    private static SchemeInfo(requestedKey: string): BaseUIElement[] {
        const t = Translations.t.matrixbot.commands.scheme;
        const allKeys: string[] = [];
        const sch: (JsonSchema & { path: string[], typeHint: string })[] = scheme["default"] ?? scheme

        const descriptionToParts: Map<string, ({ key: string, path: string, type: string | Translation, description: string })[]> = new Map<string, any>()

        let foundMatches = 0;
        for (const item of sch) {
            const key: string = item.path[item.path.length - 1] ?? "";
            if (Utils.levenshteinDistance(key, requestedKey) >= 3) {
                allKeys.push(key)
                continue;
            }
            foundMatches++
            let type = item.typeHint ?? SchemeCommand.typeToString(item.type) ?? t.notype

            const path = item.path.join(".")

            const dictKey = key + "," + type + "," + item.description
            if (descriptionToParts.get(dictKey) === undefined) {
                descriptionToParts.set(dictKey, [])
            }
            descriptionToParts.get(dictKey).push(
                {
                    key, path, type, description: item.description
                }
            )


        }

        const r: BaseUIElement[] = []

        descriptionToParts.forEach((locations) => {
            if (locations.length === 1) {
                const {key, path, type, description} = locations[0]
                r.push(new Combine([
                    new Title(t.title.Subs({
                        key,
                        path,
                        type
                    }), 3),
                    BotUtils.MdToElement(description)
                ]).SetClass("flex flex-col"))
            } else {
                const {key, type, description} = locations[0]
                const allPaths = locations.map(l => "<code>" + l.path + "</code>");
                r.push(new Combine([
                    new Title(t.title.Subs({
                        key,
                        path: "<i>multiple paths</i>",
                        type
                    }), 3),
                    BotUtils.MdToElement(description),
                    locations.length < 20 ?
                        ("This key is used on multiple locations: " ?
                            locations.length > 10 ? allPaths.join(", ") : new List(allPaths)) :
                        "This key is used on " + allPaths.length + " locations"
                ]).SetClass("flex flex-col"))
            }
        })


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