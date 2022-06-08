import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import Wikipedia from "../../MapComplete/Logic/Web/Wikipedia";
import Combine from "../../MapComplete/UI/Base/Combine";
import Link from "../../MapComplete/UI/Base/Link";
import Title from "../../MapComplete/UI/Base/Title";
import List from "../../MapComplete/UI/Base/List";
import Translations from "../../MapComplete/UI/i18n/Translations";

export default class Wikicommand extends Command<"_"> {
    private _command: string;
    private _provider: ((language: string) => Wikipedia);
    private _exactMatchCandidates: (search: string, language: string) => string[];
    constructor(command: string, provider: ((language: string) => Wikipedia),
                exactMatchCandidates: ((search: string, language: string) => string[])) {
       
        const t = Translations.t.matrixbot.commands.wiki
        super(command, t.docs.Subs(provider("en")),
            {
                _: t.argsearch
            });
        this._command = command;
        this._provider = provider;
        this._exactMatchCandidates = exactMatchCandidates;


    }

    protected async Run(r: ResponseSender, rawArgs:{ _: string }): Promise<any> {
        const t = Translations.t.matrixbot.commands.wiki
        const args = {search : rawArgs._} // Yeah, this is a bit a cheat
        
        if ((args.search ?? "") == "") {
            await r.sendNotice(t.noWiki)
            return;
        }
        const wikipedia = this._provider(r.roomLanguage())
        await r.sendNotice(t.searching.Subs(wikipedia), true)
        const [searchResults, searchResultLanguage] = await Promise.all([await wikipedia.searchViaIndex(args.search), await wikipedia.searchViaIndex(r.roomLanguage() + ":" + args.search)])

        const seenTitles = new Set<string>(searchResults.map(sr => sr.title));
        searchResults.push(...searchResultLanguage.filter(sr => !seenTitles.has(sr.title)))

        if (searchResults.length == 0) {
            await r.sendNotice(t.nothingFound.Subs({backend: wikipedia.backend, ...args}));
            return;
        }

        const searchCandidates = this._exactMatchCandidates(args.search, r.roomLanguage())
            .map(candidate => candidate.toLowerCase())
        const exactMatches = searchResults.filter(searchResult => searchCandidates.some(candidate => candidate === searchResult.title.toLowerCase()));
        const exactMatchesWithLanguage = exactMatches.find(em => em.title.toLowerCase().startsWith(r.roomLanguage() + ":"))
        if (exactMatches.length > 0) {
            await r.sendNotice(t.foundMatching.Subs((exactMatchesWithLanguage ?? exactMatches[0])), true)
        } else if (searchResults.length > 1) {
            await r.sendElements(t.gotResults.Subs({count: searchResults.length, search: args.search}), new List(
                searchResults.map(r => new Combine([
                    new Link("<b>" + r.title + "</b>", r.url),
                    "..." + r.snippet + "..."]), !r.isDm())
            ))
        }

        const page = exactMatchesWithLanguage ?? exactMatches[0] ?? searchResults[0];
        const pagename = wikipedia.extractPageName(page.url)
        const paragraph = await wikipedia.GetArticleAsync(pagename, {
            firstParagraphOnly: !r.isDm()
        });
        if (paragraph == undefined && !r.isDm()) {
            // If no match found and in a public room: don't send the notice as the list of elements will be removed otherwise
            await r.sendElement(t.loadingFailed.Subs({pagename}))
            return
        }
        await r.sendElement(new Combine([
            new Link(new Title(decodeURIComponent(page.title)), page.url, true),
            "<p>" + paragraph + "</p>",
        ]))

    }
}