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
        .AddDefault(Translations.t.matrixbot.commands.role.verbdefault,
            async (r, {user}) => RoleCommand.listRolesOf(r, user)
        )
        .Add("reset", Translations.t.matrixbot.commands.role.verbrevoke,
            async (r, {user}) => {
                const t = Translations.t.matrixbot.commands.role
                if(user === "@pietervdvn:matrix.org"){
                    await r.sendNotice("Nope, not resetting pietervdvn")
                    return
                }
                RoomSettingsTracker.UpdateRoles(user, roles => roles?.clear())
                await r.sendElement(t.allRevoked.Subs({user}))
            }
        )
        .Add("add",Translations.t.matrixbot.commands.role.verbadd ,
            async (r, {user, role}) => {
                RoomSettingsTracker.UpdateRoles(user, roles => roles.add(role))
                await RoleCommand.listRolesOf(r, user)
            })
        .Add("list", Translations.t.matrixbot.commands.role.verblist,
            async (r, {user}) => RoleCommand.listRolesOf(r, user)
        )
        .Add("remove", Translations.t.matrixbot.commands.role.verbremove,
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
            await r.sendElement(t.noRolesYet.Subs({user}))
        } else {
            await r.sendElements(
                t.userHasRoles.Subs({user}),
                roles.join(", ")
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
