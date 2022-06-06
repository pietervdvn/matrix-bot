import {Command} from "../command";
import * as dreams from "./dreams.json"
import {ResponseSender} from "../ResponseSender";
import Translations from "../../MapComplete/UI/i18n/Translations";

export default class DreamCommand extends Command<""> {

    constructor() {
        super(
            "dream",
            Translations.t.matrixbot.commands.dream.docs,
            {"":""}
        );
    }

    protected async Run(r: ResponseSender, args: { _: string }): Promise<any> {
        const i = Math.floor(Math.random() * dreams.snippets.length);
        const d = dreams.snippets[i]
        const t=  Translations.t.matrixbot.commands.dream;
        const bot = "<a href='https://www.reddit.com/user/dreamsGPT2Bot' target='_blank'>dreamsGPT2Bot</a>"
        await r.sendElements(
            "<quote>"+d+"</quote>",
            "<p><i> "+t.generatedBy.Subs({bot})+"</i></p>")
    }

}