import {UIEventSource} from "../MapComplete/Logic/UIEventSource";

export interface RoomSettings {
    language: UIEventSource<string>;
}

export class RoomSettingsTracker {

    private static readonly _settings = new Map<string, RoomSettings>();
    public static readonly roles = RoomSettingsTracker.defaultRoles();

    private static defaultRoles(): Map<string, Set<string>> {
        const roles = new Map<string, Set<string>>();
        roles.set("@pietervdvn:matrix.org", new Set(["Admin"]));
        return roles;
    }

    public static settingsFor(roomId: string): RoomSettings {
        let v = RoomSettingsTracker._settings.get(roomId)
        if (v === undefined) {
            v = {language: new UIEventSource<string>("en")};
            RoomSettingsTracker._settings.set(roomId, v);
        }
        return v
    }

    static usersWithRole(role: string): string[] {
        const users: string[] = []
        RoomSettingsTracker.roles.forEach((roles, user) => {
            if (roles.has("Amdin") || roles.has(role)) {
                users.push(user)
            }
        })
        return users;
    }
}

