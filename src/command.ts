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
    


    public static prepHtml(el: Element): Element | undefined{

        function changeTag(newTag: string){
            const newEl = document.createElement(newTag)
            for (let i = 0; i < el.children.length; i++) {
                newEl.appendChild(el.children[i])
            }
            el.parentElement.insertBefore(newEl, el)
            el.parentElement.removeChild(el)
            el = newEl
        }
        
        if(el.tagName === "svg"){
            el.parentElement.removeChild(el)
            return undefined;
        }
        const svgs = Array.from( el.getElementsByTagName('svg'))
        for (const svg of svgs) {
            svg.parentElement.removeChild(svg)
        }

        if(el.classList.contains("internal-code")){
           changeTag("code")
        }else if(el.classList.contains("bold")){
            changeTag("bold")
        }else if(el.classList.contains("italic")){
            changeTag("italic")
        }
        
        Array.from(el.children).forEach(child => {
            ResponseSender.prepHtml(child)
        });
        
        if(el.childNodes.length == 0){
            if(el.innerHTML === undefined || el.innerHTML === null || el.innerHTML.trim() === ""){
                el.parentElement?.removeChild(el)   
                return undefined
            }
        }
        return el;
    }
    
    public async sendElement(el: BaseUIElement) {
        const previousLanguage = Locale.language.data
        const targetLanguage = RoomSettingsTracker.settingsFor(this.roomId).language?.data
        if(targetLanguage !== undefined){
            Locale.language.setData(targetLanguage)
        }
        const html = el.ConstructElement()
        ResponseSender.prepHtml(html)
        await this.sendHtml(html.outerHTML)
        
        Locale.language.setData(previousLanguage)
    }

    public async sendHtml(msg): Promise<void>{
    	if(msg.length > 16384){
    		msg = "response too long"
    	}
        this.cleanPrevious(this.client.sendMessage(this.roomId, {
            msgtype: "m.text",
            format: "org.matrix.custom.html",
            body: msg,
            formatted_body: msg
        }))
    }

    public async sendNotice(msg: string): Promise<void> {
       await this.cleanPrevious(this.client.sendMessage(this.roomId, {
            msgtype: "m.notice",
            body: msg,
        }))
    }
    private async cleanPrevious(newEvent: Promise<string>): Promise<void>{
        const previous = this.previousEvent
        const newId = await newEvent;
        if(previous !== undefined){
            await this.client.redactEvent(this.roomId, previous, "Cleaning up...")
        }
        this.previousEvent = newId;
    }
}

export interface CommandOptions {
    adminOnly?: false | boolean
}

export abstract class Command<T> {
    public cmd: string;
    public documentation: string;
    public args: T;
    private _options: CommandOptions;

    constructor(cmd: string, documentation: string, args: T, options?: CommandOptions) {
        this.cmd = cmd;
        this.documentation = documentation;
        this.args = args;
        this._options = options;
    }

    protected abstract Run(r: ResponseSender, args: T & {_: string}): Promise<any>;

    async RunCommand(r: ResponseSender, argsObj: T & {_: string}):Promise<string | undefined> {
        if(this._options?.adminOnly && !r.isAdmin){
            r.sendNotice("This command is only available to administrators")
            return
        }
        return this.Run(r, argsObj)
    }
}
