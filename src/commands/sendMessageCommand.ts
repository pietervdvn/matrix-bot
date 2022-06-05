import {MessageHandler} from "../MessageHandler";
import {Command} from "../command";
import BotUtils from "../Utils";
import {ResponseSender} from "../ResponseSender";
import List from "../../MapComplete/UI/Base/List";

export default class SendMessageCommand extends Command<    "to"|"_"> {
    private _executor: MessageHandler;

    constructor(executor: MessageHandler) {
        super("dm", "Executes a command and send the output to someone else",
            {
                to: "The ID of whom to send the output to",
                _: "The actual command body of the command"
            }, {
                adminOnly: true
            });
        this._executor = executor;
    }

    protected async Run(r: ResponseSender, args: { to: string; _: string } & { _: string }): Promise<string | undefined> {

        if (args.to === undefined || args.to.trim() === "") {
            await r.sendNotice("Specify a valid target user");
            return;
        }

        if ((args._ ?? "")?.trim() === "") {
            await r.sendNotice("Specify a valid command");
            return
        }

        const key = this._executor.removePrefix(args._, true).split(" ")[0]
        if (!this._executor.hasCommand(key)) {
            await r.sendNotice("Command " + key + " not found - see <code>help</code> for all commands");
            return
        }

        await r.sendHtml(`Executing <code>${args._}</code> and sending the result to <b>${args.to}</b>...`, true)
        try {
            let targetName = BotUtils.asUserId(args.to)

            const dm = await r.client.dms.getOrCreateDm(targetName)
            const targetSender = new ResponseSender(r.client, dm, r.sender)

            if (dm === undefined) {
                await r.sendNotice("I couldn't create a room with " + args.to);
                return
            }

            const result = await this._executor.executeCommand(args._, targetSender);
            await targetSender.sendHtml(`I sent you this message because <b>${r.sender}</b> requested me to send this with <code>${args._}</code>`)
            await r.sendNotice("I delivered the message to " + targetName)
            return result
        } catch (e) {
            await r.sendElements(
                "I couldn't execute <code>" + args._ + "</code> due to " + e.message,
                new List(e.stack.split("\n")))
        }
    }

}