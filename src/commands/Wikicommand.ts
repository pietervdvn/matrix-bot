import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import Wikipedia from "../../MapComplete/Logic/Web/Wikipedia";
import Combine from "../../MapComplete/UI/Base/Combine";
import Link from "../../MapComplete/UI/Base/Link";
import Title from "../../MapComplete/UI/Base/Title";
import List from "../../MapComplete/UI/Base/List";
import {Utils} from "../../MapComplete/Utils";

export default class Wikicommand extends Command<{
    search: string
}> {
    constructor() {
        super("wiki", "Prints (a part of) the specified page from wiki.osm.org. In public rooms, it'll print the first paragraph; in a DM the entire page will be sent.",
            {
                search: "The title of the page or the search term"
            });


    }

    protected async Run(r: ResponseSender, args: { search: string } & { _: string }): Promise<any> {
        if ((args.search ?? "") == "") {
            await r.sendNotice("Please, specify a wiki page to search for")
            return;
        }
        const wikipedia = new Wikipedia({backend: "wiki.openstreetmap.org"})
        await r.sendNotice(`Searching wiki.osm.org...`, true)
        const [searchResults, searchResultLanguage] =  await Promise.all([ await wikipedia.searchViaIndex(args.search),await wikipedia.searchViaIndex(r.roomLanguage()+":"+ args.search)])

        const seenTitles = new Set<string>(searchResults.map(sr => sr.title));
        searchResults.push(...searchResultLanguage.filter(sr => !seenTitles.has(sr.title)))
        
        if (searchResults.length == 0) {
            await r.sendNotice("I couldn't find anything on wiki.osm.org for " + args.search);
            return;
        }

        const searchCandidates = [args.search, "tag:"+args.search, "key:"+args.search,
            r.roomLanguage()+":"+args.search,
            r.roomLanguage()+":tag:"+args.search,
            r.roomLanguage()+":key:"+args.search
        ].map(candidate => candidate.toLowerCase())
        const exactMatches = searchResults.filter(searchResult => searchCandidates.some(candidate => candidate === searchResult.title.toLowerCase()));
        const exactMatchesWithLanguage = exactMatches.find(em => em.title.toLowerCase().startsWith(r.roomLanguage()+":"))
        if (searchResults.length > 1 && exactMatches.length == 0) {
            await r.sendElements(`Got ${searchResults.length} results for search query <code>${args.search}</code>:`, new List(
                searchResults.map(r => new Combine([
                    new Link( "<b>" + r.title + "</b>", r.url),
                    "..."+r.snippet+"..."]), !r.isDm())
            ))
        }

        const page = exactMatchesWithLanguage ?? exactMatches[0] ?? searchResults[0];
        const pagename = wikipedia.extractPageName(page.url)
        const paragraph = await wikipedia.GetArticleAsync(pagename, {
            firstParagraphOnly: !r.isDm()
        });
        if (paragraph == undefined && !r.isDm()) {
            // If no match found and in a public room: don't send the notice as the list of elements will be removed otherwise
            await r.sendHtml("Sorry, the page <code>"+pagename+"</code> could not be loaded")
            return
        }
        await r.sendElement(new Combine([
           new Link( new Title(decodeURIComponent( page.title)), page.url, true),
            "<p>" + paragraph + "</p>",
        ]))

    }
}