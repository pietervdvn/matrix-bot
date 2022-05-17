import {Command, ResponseSender} from "./command";
import {Utils} from "../MapComplete/Utils";
import Combine from "../MapComplete/UI/Base/Combine";
import Title from "../MapComplete/UI/Base/Title";
import Table from "../MapComplete/UI/Base/Table";
import Constants from "../MapComplete/Models/Constants";
import List from "../MapComplete/UI/Base/List";

export class HelpCommand extends Command<{ cmd?: string }> {
    private _allCommands: Command<any>[];

    constructor(allCommands: Command<any>[]) {
        super("help", "Prints info about supported commands",
            {
                "cmd": "The command you want more information about"
            }
        );
        this._allCommands = allCommands;
    }

    async Run(r: ResponseSender, args) {
        if (args.cmd !== undefined) {
            const cmd: Command<any> = this._allCommands.filter(c => c.cmd === args.cmd)[0]
            if (cmd === undefined) {
                const closest = Utils.sortedByLevenshteinDistance(args.cmd, this._allCommands, c => c.cmd).slice(0, 3)
                await r.sendHtml("I didn't find <code>" + args.cmd + "</code>. Perhaps you meant one of " + closest.map(c => "`" + c.cmd + "`").join(", ") + "?")
                return
            }
            
            const argsDocs : string[][] = []
            for (const key in cmd.args) {
                argsDocs.push([key, cmd.args[key]])
            }
            await r.sendElement(
                new Combine([
                    new Title(cmd.cmd,4),
                    cmd.documentation,
                    new Table([],
                        argsDocs)
                ]))

            return;
        }
        
        
        const cmds: Command<any>[] = this._allCommands.filter(c => r.isAdmin || !c.options?.adminOnly)
        await r.sendElement(
            new Combine(["Hi! I'm MapComplete-bot (built upon MapComplete "+Constants.vNumber+").",
            "Send a command to me and I'll answer with something useful: give me a command via a private message or put <code>!</code> before the command in a public room.",
                "My supported commands are:",
                new List(cmds.map(cmd => new Combine([
                    cmd.cmd, ": ", cmd.documentation
                ])))
            ]).SetClass("flex flex-col"))
    }

}