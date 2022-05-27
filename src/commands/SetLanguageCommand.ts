import {RoomSettingsTracker} from "../RoomSettings";
import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import * as used_languages from "../../MapComplete/assets/generated/used_languages.json"
import List from "../../MapComplete/UI/Base/List";
import {Paragraph} from "../../MapComplete/UI/Base/Paragraph";
import Combine from "../../MapComplete/UI/Base/Combine";
export class SetLanguageCommand extends Command<{ lang: string }> {

    constructor() {
        super("language", "Sets the language of the responses for this room", {
            lang: "The language to be used from now on"
        });
    }

    async Run(r: ResponseSender, args: { lang: string }): Promise<void> {
        if(args.lang === "" || args.lang === undefined){
            await r.sendElements("The current room language is "+r.roomLanguage())
            return 
        }
        const valid = used_languages.languages.some(l => l === args.lang)
        if (!valid) {
            await r.sendElements(
                `Not a valid language: ${args.lang}.`,
                new Paragraph(new Combine([
                    'Choose one of:',
                    new List(
                        used_languages.languages
                    )
                ])));

            return;
        }
        RoomSettingsTracker.settingsFor(r.roomId).language.setData(args.lang)
        await r.sendHtml("Language is now " + args.lang)
    }

}