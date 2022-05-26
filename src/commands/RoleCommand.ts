import Table from "../../MapComplete/UI/Base/Table";
import {MessageHandler} from "../MessageHandler";
import {RoomSettingsTracker} from "../RoomSettings";
import {Command} from "../command";
import List from "../../MapComplete/UI/Base/List";
import BotUtils from "../Utils";
import {ResponseSender} from "../ResponseSender";

export class RoleCommand extends Command<{ verb: "list" | "add" | "remove" | "reset" | string, user: string, role: string | undefined }> {

    private _handler: MessageHandler;

    constructor(handler: MessageHandler) {
        super("roles", "Change what a user can or cannot do",
            {
                verb: "Wether to <code>add</code> or <code>remove</code> a role from a user. Use <code>list</code> to see all roles a user has",
                user: "Whom to change roles for",
                role: "Which role to add; must be a command name"
            },
            {adminOnly: true}
        );
        this._handler = handler;
    }


    protected async Run(r: ResponseSender, args: { verb: "list" | "add" | "remove" | "reset" | string; user?: string; role: string | undefined } & { _: string }): Promise<any> {
        if (!(args.user?.trim().length > 0)) {
            await r.sendElements(
                    "This command can be used to change user roles. Current user roles are:",
                    new Table(["User", "Roles"],
                        Array.from(RoomSettingsTracker.roles.entries()).map(
                            ([key, value]) => [key, new List(Array.from(value))])
                    )
            )
            return
        }
        const user = BotUtils.asUserId(args.user)
        let roles = RoomSettingsTracker.roles.get(user)

        if (args.verb === "reset") {
            roles?.clear()
            await r.sendNotice("All rights of " + user + " have been revoked")
            return
        }
        if (!(args.role?.trim().length > 0)) {
            await r.sendNotice("Please, specify a role")
            return
        }

        const role = args.role?.trim()?.toLowerCase()
        if(args.verb === "remove" || args.verb === "add"){
            if (!this._handler.hasCommand(role)) {
                await r.sendNotice("No such role: " + role + "; this must be a command name")
                return;
            }
        }

        if (args.verb === "remove") {
            if (roles === undefined) {
                await r.sendNotice("This user didn't have any previous roles")
                return
            }
            roles.delete(args.role)
        }

        if (args.verb === "add") {
            if (roles === undefined) {
                roles = new Set<string>();
                RoomSettingsTracker.roles.set(user, roles)
            }
            roles.add(args.role)
        }

        if (roles === undefined || roles.size === 0) {
            await r.sendHtml("User " + user + " has no roles yet")
        } else {
            await r.sendElements(
                "User " + user + " has the following roles",
                new List(Array.from(roles))
            )
        }
    }

}
