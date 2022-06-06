import Table from "../../MapComplete/UI/Base/Table";
import {MessageHandler} from "../MessageHandler";
import {RoomSettingsTracker} from "../RoomSettings";
import {Command} from "../command";
import List from "../../MapComplete/UI/Base/List";
import BotUtils from "../Utils";
import {ResponseSender} from "../ResponseSender";
import Translations from "../../MapComplete/UI/i18n/Translations";
import {VerbHandler} from "./verbHandler";

export class RoleCommand extends Command<"verb" | "user" | "role"> {

    private _handler: MessageHandler;

    private static verbs = new VerbHandler<{ user: string, role?: string }, void>()
        .AddDefault("List the roles of the user",
            async (r, {user}) => RoleCommand.listRolesOf(r, user)
        )
        .Add("reset", "Revokes all rights of a user",
            async (r, {user}) => {
                const t = Translations.t.matrixbot.commands.role
                if(user === "@pietervdvn:matrix.org"){
                    await r.sendNotice("Nope, not resetting pietervdvn")
                    return
                }
                RoomSettingsTracker.UpdateRoles(user, roles => roles?.clear())
                await r.sendHtml(t.allRevoked.Subs({user}))
            }
        )
        .Add("add", "Adds a role to the specified user",
            async (r, {user, role}) => {
                RoomSettingsTracker.UpdateRoles(user, roles => roles.add(role))
                await RoleCommand.listRolesOf(r, user)
            })
        .Add("list", "List all the user roles of the specified user",
            async (r, {user}) => RoleCommand.listRolesOf(r, user)
        )
        .Add("remove", "Removes a role from the specified uer",
            async (r, {user, role}) => {
                const t = Translations.t.matrixbot.commands.role
                let roles = RoomSettingsTracker.rolesOfUser(user)
                if (roles.length === 0) {
                    await r.sendNotice(t.noPreviousRoles.Subs({user}))
                    return
                }
                RoomSettingsTracker.UpdateRoles(user,roles => roles.delete(role))
                await RoleCommand.listRolesOf(r, user)
            }
        )

    private static async listRolesOf(r: ResponseSender, user?: string) {
        const t = Translations.t.matrixbot.commands.role
        user = user ?? r.sender
        const roles = RoomSettingsTracker.rolesOfUser(user)
        if (roles.length === 0) {
            await r.sendHtml(t.noRolesYet.Subs({user}))
        } else {
            await r.sendElements(
                t.userHasRoles.Subs({user}),
                new List(roles)
            )
        }
    }

    constructor(handler: MessageHandler) {
        const t = Translations.t.matrixbot.commands.role
        super("roles", t.docs,
            {
                verb: t.argverb,
                user: t.arguser,
                role: t.argrole
            },
            {adminOnly: true}
        );
        this._handler = handler;
    }


    protected async Run(r: ResponseSender, args: { verb: string; user: string | undefined; role: string | undefined } & { _: string }): Promise<any> {
        const t = Translations.t.matrixbot.commands.role
        if (!(args.user?.trim().length > 0)) {
            await r.sendElements(
                t.allRolesIntro,
                new Table(["User", "Roles"],
                    Array.from(RoomSettingsTracker.allRoles().entries()).map(
                        ([key, value]) => [key, new List(Array.from(value))])
                )
            )
            return
        }

        const user = BotUtils.asUserId(args.user)
        const role = args.role?.trim()?.toLowerCase()
        if (role !== undefined && !this._handler.hasCommand(role)) {
            await r.sendNotice(t.noSuchRole.Subs({role, user}))
            return;
        }

        if (!this._handler.getCommand(role).options.adminOnly) {
            await r.sendNotice(t.noRightsNeeded.Subs({role}))
            return;
        }
        

        RoleCommand.verbs.Exec(args.verb, r, {user, role})


    }

}
