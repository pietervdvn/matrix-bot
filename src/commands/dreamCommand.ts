import {Command} from "../command";
import * as dreams from "./dreams.json"
import {ResponseSender} from "../ResponseSender";
import Combine from "../../MapComplete/UI/Base/Combine";

export default class DreamCommand extends Command<{}> {

    constructor() {
        super(
            "dream",
            "Sends a computer-generated text",
            {}
        );
    }

    protected async Run(r: ResponseSender, args: { _: string }): Promise<any> {
        const i = Math.floor(Math.random() * dreams.snippets.length);
        const d = dreams.snippets[i]
        await r.sendElement(new Combine([
            "<quote>"+d+"</quote>",
            "<p><i>This text was generated by <a href='https://www.reddit.com/user/dreamsGPT2Bot' target='_blank'>dreamsGPT2Bot</a>, which is a Machine-learning based bot active on Reddit.</i></p>"
        ]))
    }

}