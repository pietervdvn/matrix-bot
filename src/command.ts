import {MatrixClient} from "matrix-bot-sdk";
import BaseUIElement from "../MapComplete/UI/BaseUIElement";
import Locale from "../MapComplete/UI/i18n/Locale";
import {RoomSettingsTracker} from "./RoomSettings";


export class ResponseSender {
    public client: MatrixClient;
    public roomId: string;
    private previousEvent : string  = undefined;
    public sender: string;

    public isAdmin: boolean;

    constructor(client: MatrixClient, roomId: string, sender: string) {
        this.client = client;
        this.roomId = roomId;
        this.sender = sender;
        this.isAdmin = sender === "@pietervdvn:matrix.org"
    }

    public async sendElement(el: BaseUIElement) {
        const previousLanguage = Locale.language.data
        const targetLanguage = RoomSettingsTracker.settingsFor(this.roomId).language?.data
        if(targetLanguage !== undefined){
            Locale.language.setData(targetLanguage)
        }
        const html = el.ConstructElement()
        const svgs = Array.from( html.getElementsByTagName('svg'))
        for (const svg of svgs) {
            svg.parentElement.removeChild(svg)
        }
        await this.sendHtml(html.outerHTML)
        
        Locale.language.setData(previousLanguage)
    }

    public async sendHtml(msg): Promise<void>{
    	if(msg.length > 10000){
    		msg = "response too long"
    	}
        this.cleanPrevious()
        this.previousEvent = await this.client.sendMessage(this.roomId, {
            msgtype: "m.text",
            format: "org.matrix.custom.html",
            body: msg,
            formatted_body: msg
        })
    }

    public async sendNotice(msg: string): Promise<void> {
        this.cleanPrevious()
        this.previousEvent = await this.client.sendMessage(this.roomId, {
            msgtype: "m.notice",
            body: msg,
        })
    }

    private cleanPrevious(){
        const previous = this.previousEvent
        if(previous !== undefined){
            this.client.redactEvent(this.roomId, previous, "Cleaning up...")
        }
    }
}

export abstract class Command<T> {
    public cmd: string;
    public documentation: string;
    public args: T;

    constructor(cmd: string, documentation: string, args: T) {
        this.cmd = cmd;
        this.documentation = documentation;
        this.args = args;
    }

    public abstract Run(r: ResponseSender, args: T & {_: string}): Promise<any>;

}
