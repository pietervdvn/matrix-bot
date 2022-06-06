import {RoomSettingsTracker} from "../RoomSettings";
import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import * as used_languages from "../../MapComplete/assets/generated/used_languages.json"
import List from "../../MapComplete/UI/Base/List";
import {Paragraph} from "../../MapComplete/UI/Base/Paragraph";
import Combine from "../../MapComplete/UI/Base/Combine";
import Translations from "../../MapComplete/UI/i18n/Translations";
import * as native_languages from "../../MapComplete/assets/language_native.json"

export class SetLanguageCommand extends Command<"language"> {

    constructor() {
        const t = Translations.t.matrixbot.commands.language
        super("language", t.docs, {
            language: t.arglang
        });
    }


    async Run(r: ResponseSender, args: { language: string } & { _: string }): Promise<void> {
        const t = Translations.t.matrixbot.commands.language

        function native(lang: string) {
            return native_languages[lang] ?? lang
        }

        if (args.language === "" || args.language === undefined) {
            await r.sendElements(t.currentLanguage.Subs({language: native(r.roomLanguage())}), r.TranslationLink())
            return
        }
        const valid = used_languages.languages.some(l => l === args.language)
        if (!valid) {
            await r.sendElements(
                t.notFound.Subs(args),
                new Paragraph(new Combine([
                    t.knownLanguages,
                    new List(
                        used_languages.languages.map(known => new Combine(
                            ["<b>" + known + "</b>", native_languages[known] ? " (" + native_languages[known] + ")" : undefined]))
                    )
                ])));

            return;
        }
        const roomsettings = RoomSettingsTracker.settingsFor(r.roomId)
        roomsettings.data.set("language", new Set([args.language]))
        roomsettings.ping()
        
        await r.sendElements(t.hasBeenSet.Subs({language: native(args.language)}),
            r.TranslationLink()
        )
    }

}