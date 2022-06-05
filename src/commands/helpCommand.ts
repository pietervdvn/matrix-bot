import Table from "../../MapComplete/UI/Base/Table";
import {RoomSettingsTracker} from "../RoomSettings";
import {Command} from "../command";
import {Utils} from "../../MapComplete/Utils";
import Combine from "../../MapComplete/UI/Base/Combine";
import Title from "../../MapComplete/UI/Base/Title";
import List from "../../MapComplete/UI/Base/List";
import {ResponseSender} from "../ResponseSender";
import Translations from "../../MapComplete/UI/i18n/Translations";
import Constants from "../../MapComplete/Models/Constants";
import {Translation} from "../../MapComplete/UI/i18n/Translation";


export class HelpCommand extends Command<"cmd"> {
    private readonly _allCommands: Command<any>[];
    private readonly _version: string;

    constructor(version: string, allCommands: Command<any>[]) {
        const t = Translations.t.matrixbot.commands.help
        super("help", t.docs,
            {
                "cmd": t.argcmd
            }
        );
        this._allCommands = allCommands;
        this._version = version;
    }

    async Run(r: ResponseSender, args) {
        const t = Translations.t.matrixbot.commands.help
        if (args.cmd !== undefined) {
            const cmd: Command<any> = this._allCommands.filter(c => c.cmd === args.cmd)[0]
            if (cmd === undefined) {
                const closest = Utils.sortedByLevenshteinDistance(args.cmd, this._allCommands, c => c.cmd).slice(0, 3)
                await r.sendHtml("I didn't find <code>" + args.cmd + "</code>. Perhaps you meant one of " + closest.map(c => "`" + c.cmd + "`").join(", ") + "?")
                return
            }

            const argsDocs: [string, string | Translation][] = []
            for (const key in cmd.args) {
                argsDocs.push([key, cmd.args[key]])
            }
            await r.sendElements(
                new Title(cmd.cmd, 4),
                cmd.documentation,
                cmd.mayExecute(r) ? "" :
                    "<b>" + t.insufficientRights + "</b> " + t.askRights.Subs({admins: RoomSettingsTracker.usersWithRole("roles").join(", ")}),
                new Table([], argsDocs)
            )
            return;
        }


        const cmds: Command<any>[] = this._allCommands.filter(c => r.isAdmin || !c.options?.adminOnly)
        await r.sendElements(
            "<p>" + t.p0.Subs({bot_version: this._version, mc_version: Constants.vNumber}) + "</p>",
            "<p>" + t.p1 + "</p>",
            t.supported,
            new List(cmds
                .filter(cmd => cmd.mayExecute(r))
                .map(cmd => new Combine([
                    "<b>" + cmd.cmd + "</b>", ": ", cmd.documentation, cmd.options?.adminOnly ? " (<i>" + t.priviligedComand + "</i>)" : ""
                ]))),
            r.TranslationLink())
    }

}