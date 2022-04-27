import {Command, ResponseSender} from "./command";
import {Utils} from "../MapComplete/Utils";
import Combine from "../MapComplete/UI/Base/Combine";
import Title from "../MapComplete/UI/Base/Title";
import Table from "../MapComplete/UI/Base/Table";
import Constants from "../MapComplete/Models/Constants";

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
        await r.sendHtml("Hi! I'm " + (await r.client.getUserId()) + " (built upon MapComplete "+Constants.vNumber+"). Send " + this._allCommands.map(cmd => "!" + cmd.cmd).join(", ") + " in this room and I'll reply with something special. To see more information about a single command, type !help <commandname>.")
    }

}