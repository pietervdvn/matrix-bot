import {UIEventSource} from "../MapComplete/Logic/UIEventSource";

export interface RoomSettings {
    language: UIEventSource<string>;
}

export class RoomSettingsTracker {
    
    private static readonly _settings = new Map<string, RoomSettings>();
    
    
    public static settingsFor(roomId: string):RoomSettings{
        let v = RoomSettingsTracker._settings.get(roomId)
        if(v === undefined){
            v = {language: new UIEventSource<string>("en")};
            RoomSettingsTracker._settings.set(roomId,v );
        }
        return v 
    }
    
}

