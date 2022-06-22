import {UIEventSource} from "../MapComplete/Logic/UIEventSource";
import * as fs from "fs";


export class FileBackedEventSource {
    
    private static _cache = new Map<string, UIEventSource<string>>()
    private _rootDirecotry: string;
    
    constructor(rootDirecotry: string) {
        this._rootDirecotry = rootDirecotry;
        if(!fs.existsSync(rootDirecotry)){
            console.log("Creating directory to save settings", rootDirecotry)
            fs.mkdirSync(rootDirecotry, {recursive: true})
        }
    }
    
    public ParsedEventSourceForFile(key: string): UIEventSource<Map<string, Set<string>>> {
        return this.EventSourceForFile(key).sync(
            str => {
                const dict = new Map<string, Set<string>>()
                if(str === undefined || str === ""){
                    return dict;
                }
                const parsed = JSON.parse(str) /* { user : [role, role, role] }*/
                for (const key in parsed) {
                    dict.set(key, new Set(parsed[key]))
                }
                return dict
            }, [],
            dict => {
                const obj = {}
                dict.forEach((value, key) => {
                    obj[key] = Array.from(value)
                })
                return JSON.stringify(obj, null, "  ")
            }
        )
    }
    
    public EventSourceForFile(key: string, defaultValue: string = ""){
        key = this._rootDirecotry + "/" + key;
        if(FileBackedEventSource._cache.has(key)){
            return FileBackedEventSource._cache.get(key)
        }
        
        const src = new UIEventSource(defaultValue)
        if(fs.existsSync(key)){
            src.setData(fs.readFileSync(key,"utf-8"))
        }
        src.addCallback(contents => {
            fs.writeFileSync(key, contents, "utf-8");
        })
        
        return src;
        
    }
}

export class RoomSettingsTracker {

    private static readonly _fileStorage = new FileBackedEventSource("./settings-storage");
    private static readonly _roles = RoomSettingsTracker.InitRoles();
    

    public static settingsFor(roomId: string): UIEventSource<Map<string, Set<string>>> {
        return RoomSettingsTracker._fileStorage.ParsedEventSourceForFile("room_"+roomId)
    }

    private static InitRoles(): UIEventSource<Map<string, Set<string>>>{
        const roles = this._fileStorage.ParsedEventSourceForFile("userroles.json")
        const nm = "@pietervdvn:matrix.org"
        const pietervdvn = roles.data.get(nm) ?? new Set<string>()
        pietervdvn.add("Admin")
        roles.data.set(nm, pietervdvn)
        return roles;
    }

    /**
     * Gives all user which have the requested role at this moment
     */
    static usersWithRole(role: string): string[] {
        const users: string[] = []
        RoomSettingsTracker._roles.data.forEach((roles, user) => {
            if (roles.has("Amdin") || roles.has(role)) {
                users.push(user)
            }
        })
        return users;
    }
    
    static allRoles(): ReadonlyMap<string, ReadonlySet<string>> {
        return this._roles.data
    }
    
    static rolesOfUser(user: string): string[]{
        return Array.from(RoomSettingsTracker._roles.data.get(user) ?? [])
    }
    static ModifyRoles(user: string,
                       modify: ((roles: Set<string>) => Set<string>)) {
        let roles = RoomSettingsTracker._roles.data.get(user) ?? new Set()
        let modified = modify(roles)
        RoomSettingsTracker._roles.data.set(user, modified)
        RoomSettingsTracker._roles.ping();
    }

    static UpdateRoles(user: string,
                       modify: ((roles: Set<string>) => void)) {
        let roles = RoomSettingsTracker._roles.data?.get(user) ?? new Set()
        modify(roles)
        RoomSettingsTracker._roles.data.set(user, roles)
        RoomSettingsTracker._roles.ping();
    }
    
}

