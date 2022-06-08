import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import BaseUIElement from "../../MapComplete/UI/BaseUIElement";
import Translations from "../../MapComplete/UI/i18n/Translations";

export default class WelcomeCommand extends Command<""> {

    constructor() {
        super("welcome", Translations.t.matrixbot.commands.welcome.docs, {"":""});
    }

    protected async Run(r: ResponseSender, args: { _: string }): Promise<void> {
        var i = 0;
        const t = Translations.t.matrixbot.commands.welcome
        var msg: BaseUIElement[] = []
        while (t["p" + i] !== undefined) {
            msg.push(t["p" + i])
            i++
        }
        await r.sendElements(
            ...msg
        );
    }


}