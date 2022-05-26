import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import Wikipedia from "../../MapComplete/Logic/Web/Wikipedia";
import Combine from "../../MapComplete/UI/Base/Combine";
import Link from "../../MapComplete/UI/Base/Link";
import Title from "../../MapComplete/UI/Base/Title";
import List from "../../MapComplete/UI/Base/List";

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
        await r.sendHtml("Searching wiki.osm.org...", true)
        const wikipedia = new Wikipedia({backend: "wiki.openstreetmap.org"})
        const searchResults = await wikipedia.searchViaIndex(args.search);
        
        if (searchResults.length == 0) {
            await r.sendNotice("I couldn't find anything on wiki.osm.org for " + args.search);
            return;
        }
        const exactMatch = searchResults.find(r => r.title.toLowerCase() === args.search.toLowerCase());
        if (searchResults.length > 1 && !exactMatch) {
            await r.sendElements(`Got ${searchResults.length} results for search query <code>${args.search}</code>:`, new List(
                searchResults.map(r => new Combine([
                    new Link( "<b>" + r.title + "</b>", r.url),
                    "..."+r.snippet+"..."]))
            ))
        }

        const page = exactMatch ?? searchResults[0];
        const paragraph = await wikipedia.GetArticleAsync(page.title, {
            firstParagraphOnly: !r.isDm()
        });
        if (paragraph == undefined) {
            await r.sendNotice("Sorry, no such page found on the wiki")
            return
        }
        await r.sendElement(new Combine([
           new Link( new Title(page.title), page.url, true),
            "<p>" + paragraph + "</p>",
        ]))

    }
}