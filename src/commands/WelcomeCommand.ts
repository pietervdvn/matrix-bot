import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";

export default class WelcomeCommand extends Command<{}> {

    constructor() {
        super("welcome", "Gives a friendly welcome message", {});
    }

    protected async Run(r: ResponseSender, args: { _: string }): Promise<void> {
        await r.sendElements(
            "<p>Hi! I'm MapComplete-bot. I'm a computer program which searches OpenStreetMap and which can give some information about <a href='https://mapcomplete.osm.be'>MapComplete</a>, which is a website and app that shows thematic maps. If information is missing, you can add it easily over there.</p>",
                "<p>Send me <code>info [searchterm]</code> and I'll search OpenStreetMap for you. I'll show you the information on what I found.</p>",
            "<p>Alternatively, use <code>search [ojecttype] near [placename]</code> or <code>search [objecttype] in [placename]</code> to search for more places. Supported object types are those that can be found in MapComplete. More categories will be added in the future - and if you are up to the challenge, <a href='https://github.com/pietervdvn/MapComplete/blob/develop/Docs/Making_Your_Own_Theme.md'>you can create your thematic map and thus category too</a></p>",
            "<p>There are a few more commands, send <code>help</code> to see all of them.</p>"
            );
    }


}