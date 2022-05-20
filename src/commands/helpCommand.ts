import Table from "../../MapComplete/UI/Base/Table";
import {RoomSettingsTracker} from "../RoomSettings";
import {Command} from "../command";
import {Utils} from "../../MapComplete/Utils";
import Combine from "../../MapComplete/UI/Base/Combine";
import Title from "../../MapComplete/UI/Base/Title";
import List from "../../MapComplete/UI/Base/List";
import {ResponseSender} from "../ResponseSender";


export class HelpCommand extends Command<{ cmd?: string }> {
    private readonly _allCommands: Command<any>[];
    private readonly _version: string;

    constructor(version: string, allCommands: Command<any>[]) {
        super("help", "Prints info about supported commands",
            {
                "cmd": "The command you want more information about"
            }
        );
        this._allCommands = allCommands;
        this._version = version;
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
                    cmd.mayExecute(r) ? "": "<b>You currently don't have sufficient permissions to run this command.</b> Ask "+RoomSettingsTracker.usersWithRole("roles").join(", ")+" to give you sufficient permissions",
                    new Table([],
                        argsDocs)
                ]))

            return;
        }
        
        
        const cmds: Command<any>[] = this._allCommands.filter(c => r.isAdmin || !c.options?.adminOnly)
        await r.sendElement(
            new Combine(["Hi! I'm MapComplete-bot "+this._version+"(built upon MapComplete "+Constants.vNumber+").",
            "Send a command to me and I'll answer with something useful: give me a command via a private message or put <code>!</code> before the command in a public room.",
                "My supported commands are:",
                new List(cmds
                    .filter(cmd => cmd.mayExecute(r))
                    .map(cmd => new Combine([
                    "<b>"+cmd.cmd+"</b>", ": ", cmd.documentation, cmd.options?.adminOnly ? "(<i>Priviliged command</i>)" : ""
                ])))
            ]).SetClass("flex flex-col"))
    }

}