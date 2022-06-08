import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import {exec} from "child_process"
import Translations from "../../MapComplete/UI/i18n/Translations";
import {Utils} from "../../MapComplete/Utils";
import {VerbHandler} from "./verbHandler";

export class ShutdownCommand extends Command<"mode"> {

    private static readonly inited = new Date()


    private static verbs = new VerbHandler<any, "shutdown">()
        .Add("shutdown", Translations.t.matrixbot.commands.shutdown.verbshutdown, ShutdownCommand.shutdown)
        .Add("update",Translations.t.matrixbot.commands.shutdown.verbupdate, ShutdownCommand.update)

    constructor() {
        const t = Translations.t.matrixbot.commands.shutdown
        super("shutdown", t.docs,
            {
                mode: t.argmode.Subs({verbs: ShutdownCommand.verbs.knownVerbs().map(verb => "<code>" + verb + "</code>").join(", ")})
            },
            {
                adminOnly: true
            }
        );
    }

    private static async update(r: ResponseSender): Promise<"shutdown"> {
        console.log("Received 'update' command, updating...")
        await r.sendNotice("Updating MapComplete...")

        const process = await exec("cd MapComplete && git stash && git pull && npm run generate", ((error, stdout, stderr) => {
            r.sendHtml("StdOut gave: <code>" + stdout + "</code>")

            if (error !== null) {
                console.error(error)
                r.sendHtml("Updating gave an error: <code>" + error + "</code>")
            }
            if (stderr !== "") {
                console.error(stderr)
                r.sendHtml("Updating gave an error (via StdErr): <code>" + stderr + "</code>")
            }
            process.on("exit", () => r.sendHtml("All done"))
        }))
        return await this.shutdown(r)
    }

    private static async shutdown(r: ResponseSender): Promise<"shutdown"> {
        const t = Translations.t.matrixbot.commands.shutdown
        console.log("Received 'shutdown' command, exiting now")
        await r.sendNotice(t.goodbye)
        return "shutdown"
    }

    public async Run(r: ResponseSender, args: {
        mode: "update" | "shutdown" | string,
        _: string
    }): Promise<"shutdown"> {
        const t = Translations.t.matrixbot.commands.shutdown
        const min_uptime = 5;// seconds
        if ((new Date().getTime() - ShutdownCommand.inited.getTime()) < min_uptime * 1000) {
            await r.sendNotice(t.notYetShuttingDown.Subs({
                uptime: Utils.Round((ShutdownCommand.inited.getTime() - new Date().getTime() / 1000)),
                min_uptime
            }))
            return;
        }

        return ShutdownCommand.verbs.Exec(args.mode, r, undefined)
    }


}
