import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";

export class QuitCommand extends Command<{ mode: "restart" | "shutdown" | string }> {

    private static readonly inited = new Date()

    constructor() {
        super("exit", "Shuts down the bot",
            {
                mode: "Indicates if the service should be restarted, must be `shutdown`"
            },
            {
                adminOnly: true
            }
        );
    }


    public async Run(r: ResponseSender, args: {
        mode: "restart" | "shutdown" | string,
        _: string
    }): Promise<"shutdown"> {
        if ((new Date().getTime() - QuitCommand.inited.getTime()) < 1000) {
            await r.sendNotice("Not yet shutting down - to soon (" + (QuitCommand.inited.getTime() - new Date().getTime()) + " ms since launch, needs 1000)")
            return;
        }
        if (args.mode === "shutdown") {
            console.log("Received 'shutdown' command, exiting now")
            await r.sendNotice("Shutting down... See you later!")
            return "shutdown"
        }
        await r.sendNotice("Invalid quit command")
    }


}
