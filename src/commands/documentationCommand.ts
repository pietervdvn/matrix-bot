import {AllKnownLayouts} from "../../MapComplete/Customizations/AllKnownLayouts";
import {ResponseSender} from "../ResponseSender";
import QueryParameterDocumentation from "../../MapComplete/UI/QueryParameterDocumentation";
import {Utils} from "../../MapComplete/Utils";
import BotUtils from "../Utils";
import {Command} from "../command";
import List from "../../MapComplete/UI/Base/List";
import Constants from "../../MapComplete/Models/Constants";
import Translations from "../../MapComplete/UI/i18n/Translations";
import BaseUIElement from "../../MapComplete/UI/BaseUIElement";
import Combine from "../../MapComplete/UI/Base/Combine";
import {Translation} from "../../MapComplete/UI/i18n/Translation";
import {lstatSync, readdirSync, readFileSync} from "fs";
import {FixedUiElement} from "../../MapComplete/UI/Base/FixedUiElement";
import Link from "../../MapComplete/UI/Base/Link";
import ValidatedTextField from "../../MapComplete/UI/Input/ValidatedTextField";
import Title from "../../MapComplete/UI/Base/Title";
import SpecialVisualizations from "../../MapComplete/UI/SpecialVisualizations";

abstract class Listing {

    private static expectedTranslationKeys = ["singular", "plural"] as const
    public readonly translations: Record<(typeof Listing.expectedTranslationKeys)[number], Translation>;
    public readonly key: string;
    public readonly items: Map<string, string | BaseUIElement>

    constructor(key: string, items: Map<string, string | BaseUIElement>) {
        this.key = key;
        this.items = items;
        this.translations = Translations.t.matrixbot.commands.documentation[key];
        if (this.translations === undefined) {
            throw `Translation error: expected a translation for 'matrixbot.commands.documentation.${key} but it doesn't exist`
        }
        for (const expected of Listing.expectedTranslationKeys) {
            if (this.translations[expected] === undefined) {
                throw `Translation error: expected a tranlation for 'matrixbot.commands.documentation.${key}.${expected}'`
            }
        }
    }

    public search(str: string): string | BaseUIElement | undefined {
        return this.items.get(str.toLowerCase())
    }

    /**
     * Returns the 5 most similar keyys
     */
    public nearest(searchterm: string, count: number = 5): string[] {
        return Utils.sortedByLevenshteinDistance(searchterm, Array.from(this.items.keys()), s => s).slice(0, count)
    }

    public keys(): string[] {
        const arr = Array.from(this.items.keys())
        arr.sort()
        return arr
    }

    public renderKeys(): (string | BaseUIElement) [] {
        return this.keys().map(id => "<code>" + id + "</code>")
    }

}


class UrlParameterListing extends Listing {

    constructor() {
        const urlParamDocs = QueryParameterDocumentation.UrlParamDocs()
        const asElements = new Map<string, BaseUIElement>()
        urlParamDocs.forEach((value, key) => {
            asElements.set(key, BotUtils.MdToElement(value))
        })
        super("url_parameter", asElements);
    }

}

class LayerListing extends Listing {
    constructor() {
        const docs = new Map<string, BaseUIElement>()
        for (const layer of AllKnownLayouts.AllPublicLayers()) {
            if (layer.id.startsWith("note_import_")) {
                continue
            }
            const doc = layer.GenerateDocumentation(AllKnownLayouts.themesUsingLayer(layer.id).map(l => l.id))
            docs.set(layer.id, doc)
        }
        super("layer", docs);
    }
}

class ThemeListing extends Listing {


    constructor() {
        const docs = new Map<string, BaseUIElement>()
        const layouts = AllKnownLayouts.allKnownLayouts
        layouts.forEach((theme, key) => {
            docs.set(key, AllKnownLayouts.GenerateDocumentationForTheme(theme))
        })
        super("theme", docs);
    }

}

class DocumentationListing extends Listing {

    private readonly originalFileNames = new Map<string, string>();
    private readonly sectionDepths: Map<string, number>;

    constructor() {
        const docs = new Map<string, BaseUIElement>()
        const path = "./MapComplete/Docs"
        const originalFileNames = new Map<string, string>()
        const sectionDepths = new Map<string, number>()
        for (const entry of readdirSync(path)) {
            if (!entry.endsWith(".md")) {
                continue
            }
            const fullEntry = path + "/" + entry
            const stats = lstatSync(fullEntry)
            if (stats.isDirectory()) {
                continue;
            }
            try {
                DocumentationListing.loadFile(fullEntry, entry, originalFileNames, docs, sectionDepths);
            } catch (e) {
                console.error("Could not parse " + entry + " due to " + e)
            }
        }
        super("file", docs);
        this.originalFileNames = originalFileNames;
        this.sectionDepths = sectionDepths
    }

    private static loadFile(fullEntry: string, entry: string, originalFileNames: Map<string, string>, docs: Map<string, BaseUIElement>, sectionDepths: Map<string, number>) {
        const element = BotUtils.MdToElement(readFileSync(fullEntry, "utf8"))
        const key = entry.substring(0, entry.length - 3).toLowerCase()
        originalFileNames.set(key, entry)
        const currentQueue: Record<number, BaseUIElement[]> = {}
        const currentId: Record<number, string> = {}
        const maxDepth = 4
        console.log("Generating the entries for " + key + "." + entry)
        for (const child of Array.from(element.ConstructElement().children)) {
            const tag = child.tagName.match("H([0-9]+)")
            if (tag) {
                const depth = Number(tag[1])
                // Flush all elements of deeper or equal depth
                for (let i = depth; i < maxDepth; i++) {
                    const els = currentQueue[i]
                    if (els === undefined) {
                        continue
                    }
                    docs.set(key + "#" + currentId[i], new Combine(els))
                    sectionDepths.set(key + "#" + currentId[i], i)
                    currentQueue[i] = undefined
                }
                if (depth < maxDepth) {
                    currentQueue[depth] = [new FixedUiElement(child.outerHTML)]
                    currentId[depth] = child.innerHTML.trim().replace(/[ ]/g, '-').replace(/[?.+]/g, '').toLowerCase()
                }
                continue
            }

            for (let i = 1; i < maxDepth; i++) {
                currentQueue[i]?.push(new FixedUiElement(child.outerHTML))
            }

        }

        for (let i = 1; i < maxDepth; i++) {
            const els = currentQueue[i]
            if (els === undefined) {
                continue
            }
            docs.set(key + "#" + currentId[i], new Combine(els))
            sectionDepths.set(key + "#" + currentId[i], i)
        }

        docs.set(key, element)
    }

    renderKeys(): BaseUIElement[] {
        const keys = Array.from(this.items.keys())
        const subkeys = new Map<string, string[]>()
        for (const key of keys) {
            const [file, section] = key.split("#")
            if (!subkeys.has(file)) {
                subkeys.set(file, [])
            }
            if (section !== undefined) {
                subkeys.get(file).push(section)
            }
        }
        const self = this;
        return Array.from(subkeys.keys()).map(key => {
            const filename = self.originalFileNames.get(key)
            const url = "https://github.com/pietervdvn/MapComplete/tree/master/Docs/" + filename
            const sections = subkeys.get(key)
                .filter(section => !(this.sectionDepths.get(section) > 2))
                .map(section => new Link("<code>" + section + "</code>", url + "#" + section, true))
            return new Combine([
                new Link("<code>" + key + "</code>", url, true),
                "containing sections ",
                ...sections
            ])
        })
    }

}

export class SpecialRenderings extends Listing {
    constructor() {
        const docs = new Map<string, BaseUIElement>()
        SpecialVisualizations.specialVisualizations.forEach((viz) => {
            docs.set(viz.funcName, SpecialVisualizations.DocumentationFor(viz))
        })
        super("visualisation", docs);
    }
}

export class SpecialInputs extends Listing {
    constructor() {
        const docs = new Map<string, BaseUIElement>()
        ValidatedTextField.allTypes.forEach((value, key) => {
            docs.set(key, new Combine([
                new Title(value.name, 3),
                value.explanation
            ]))
        })

        super("inputElement", docs);
    }
}

export class DocumentationCommand extends Command<"id"> {

    private static readonly listings = [
        new ThemeListing(), new LayerListing(), new UrlParameterListing(),
        new SpecialRenderings(), new SpecialInputs(),
        new DocumentationListing()
    ]

    constructor() {
        const t = Translations.t.matrixbot.commands.documentation
        super("docs", t.docs,
            {
                "id": t.argid
            }
        );
    }

    public async Run(r: ResponseSender, args: { id: string } & { _: string }): Promise<void> {
        args.id = args.id?.trim()
        const t = Translations.t.matrixbot.commands.documentation

        if (args.id === undefined) {
            r.sendElements(t.noIdIntro.Subs({list: DocumentationCommand.listings.map(l => l.translations.singular).join(", ")}))
            return;
        }

        for (const listing of DocumentationCommand.listings) {
            if (listing.key === args.id || args.id.toLowerCase() === listing.translations.singular.textFor(r.roomLanguage()) || args.id.toLowerCase() === listing.translations.plural.textFor(r.roomLanguage())) {
                await r.sendElements(
                    t.overview.Subs(listing.translations),
                    new List(listing.renderKeys())
                )
                return
            }
            const found = listing.search(args.id)
            if (found === undefined) {
                continue
            }
            await r.sendElements(found)
            return
        }

        await DocumentationCommand.sendNothingFound(args, r);

    }

    private static async sendNothingFound(args: { id: string }, r: ResponseSender) {
        const t = Translations.t.matrixbot.commands.documentation
        await r.sendElements(
            ...DocumentationCommand.listings.map(l => new Combine([
                t.notFound.Subs({singular: l.translations.singular, id: args.id}),
                t.didYouMean,
                new List(l.nearest(args.id).map(id => "<code>" + id + "</code> "))
            ]))
        )
        return
    }
}
