import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";
import {exec} from "child_process"

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
        mode: "update" | "shutdown" | string,
        _: string
    }): Promise<"shutdown"> {
        if ((new Date().getTime() - QuitCommand.inited.getTime()) < 1000) {
            await r.sendNotice("Not yet shutting down - to soon (" + (QuitCommand.inited.getTime() - new Date().getTime()) + " ms since launch, needs 1000)")
            return;
        }
        if(args.mode === "update"){
            console.log("Received 'update' command, updating...")
            await r.sendNotice("Updating MapComplete...")

            const process = exec("cd MapComplete && git pull", ((error, stdout, stderr) => {
                r.sendHtml("StdOut gave: <code>"+stdout+"</code>")
                
                if (error !== null) {
                    console.error(error)
                    r.sendHtml("Updating gave an error: <code>"+error+"</code>")
                }
                if (stderr !== "") {
                    console.error(stderr)
                    r.sendHtml("Updating gave an error (via StdErr): <code>"+stderr+"</code>")
                }
                
            }))


            process.on("exit", () => r.sendHtml("All done"))
            
            args.mode = "shutdown"

        }
        
        if (args.mode === "shutdown") {
            console.log("Received 'shutdown' command, exiting now")
            await r.sendNotice("Shutting down... See you later!")
            return "shutdown"
        }

        await r.sendNotice("Invalid quit command")
    }


}
