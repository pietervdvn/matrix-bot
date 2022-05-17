import {Command, ResponseSender} from "./command";
import {MessageHandler} from "./MessageHandler";
import BotUtils from "./Utils";

export default class SendMessageCommand extends Command<{
    to: string,
    _: string
}> {
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

        try {
            let targetName = BotUtils.asUserId(args.to)

            const dm = await r.client.dms.getOrCreateDm(targetName)
            const targetSender = new ResponseSender(r.client, dm, r.sender)

            if (dm === undefined) {
                await r.sendNotice("I couldn't create a room with " + args.to);
                return
            }

            const result = await this._executor.executeCommand(args._, targetSender);
            await targetSender.sendNotice("I sent you this message because " + r.sender + " requested me to send this", false)
            await r.sendNotice("I delivered the message to "+targetName)
            return result
        } catch (e) {
            await r.sendNotice("I couldn't execute <code>" + args._ + "</code> due to " + JSON.stringify(e))
        }
    }


}