import {RoomSettingsTracker} from "../RoomSettings";
import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import * as used_languages from "../../MapComplete/assets/generated/used_languages.json"
import List from "../../MapComplete/UI/Base/List";
import {Paragraph} from "../../MapComplete/UI/Base/Paragraph";
import Combine from "../../MapComplete/UI/Base/Combine";
import LinkToWeblate from "../../MapComplete/UI/Base/LinkToWeblate";
import Translations from "../../MapComplete/UI/i18n/Translations";
import Link from "../../MapComplete/UI/Base/Link";

export class SetLanguageCommand extends Command<"lang"> {

    constructor() {
        super("language", "Sets the language of the responses for this room", {
            lang: "The language to be used from now on"
        });
    }

    async Run(r: ResponseSender, args: { lang: string } & { _: string }): Promise<void> {
        const t=  Translations.t.matrixbot.commands.language
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
        const link = LinkToWeblate.hrefToWeblateZen(args.lang, "core", "matrixbot")
        await r.sendElements(t.hasBeenSet.Subs({language: args.lang}),
            new Link(t.helpTranslating, link)
            )
    }

}