import {MessageHandler} from "../MessageHandler";
import {Command} from "../command";
import BotUtils from "../Utils";
import {ResponseSender} from "../ResponseSender";
import List from "../../MapComplete/UI/Base/List";
import Translations from "../../MapComplete/UI/i18n/Translations";

export default class SendMessageCommand extends Command<"to" | "_"> {
    private _executor: MessageHandler;

    constructor(executor: MessageHandler) {
        const t = Translations.t.matrixbot.commands.dm
        super("dm", t.docs,
            {
                to: t.argto,
                _: t.argbody
            }, {
                adminOnly: true
            });
        this._executor = executor;
    }

    protected async Run(r: ResponseSender, args: { to: string; _: string } & { _: string }): Promise<string | undefined> {
        const t = Translations.t.matrixbot.commands.dm

        if (args.to === undefined || args.to.trim() === "") {
            await r.sendNotice(t.selectValidUser);
            return;
        }

        if ((args._ ?? "")?.trim() === "") {
            await r.sendNotice(t.selectValidCommand);
            return
        }

        const key = this._executor.removePrefix(args._, true).split(" ")[0]
        if (!this._executor.hasCommand(key)) {
            await r.sendNotice(t.commandNotFound.Subs({key}));
            return
        }

        await r.sendElement(t.executing.Subs(args), true)
        try {
            let targetName = BotUtils.asUserId(args.to)

            const dm = await r.client.dms.getOrCreateDm(targetName)
            const targetSender = new ResponseSender(r.client, dm, r.sender)

            if (dm === undefined) {
                await r.sendNotice(t.noDm.Subs(args));
                return
            }

            const result = await this._executor.executeCommand(args._, targetSender);
            await targetSender.sendElement(t.sendReason.Subs({sender: r.sender, cmd: args._}))
            await r.sendNotice( t.receipt.Subs(args))
            return result
        } catch (e) {
            await r.sendElements(
                t.failed.Subs({cmd: args._,message: e.message}),
                new List(e.stack.split("\n")))
        }
    }

}