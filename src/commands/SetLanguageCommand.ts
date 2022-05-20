import {RoomSettingsTracker} from "../RoomSettings";
import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import * as used_languages from "../../MapComplete/assets/generated/used_languages.json"
export class SetLanguageCommand extends Command<{ lang: string }> {

    constructor() {
        super("language", "Sets the language of the responses for this room", {
            lang: "The language to be used from now on"
        });
    }

    async Run(r: ResponseSender, args: { lang: string }): Promise<void> {
        const valid = used_languages.languages.some(l => l === args.lang)
        if (!valid) {
            await r.sendHtml(`Not a valid language: ${args.lang}.

<p>Choose one of <li>${used_languages.languages.map(l => "<ul>" + l + "</ul>")}</li></p>`)
            return;
        }
        RoomSettingsTracker.settingsFor(r.roomId).language.setData(args.lang)
        await r.sendHtml("Language is now " + args.lang)
    }

}