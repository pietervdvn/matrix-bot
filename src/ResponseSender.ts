import {MatrixClient} from "matrix-bot-sdk";
import BaseUIElement from "../MapComplete/UI/BaseUIElement";
import Locale from "../MapComplete/UI/i18n/Locale";
import {RoomSettings, RoomSettingsTracker} from "./RoomSettings";
import {Translation} from "../MapComplete/UI/i18n/Translation";
import Combine from "../MapComplete/UI/Base/Combine";

export class ResponseSender {
    public client: MatrixClient;
    public roomId: string;
    public sender: string;
    public isAdmin: boolean;
    private toBeCleaned: string[] = [];
    public readonly startTime: Date = new Date()

    constructor(client: MatrixClient, roomId: string, sender: string) {
        this.client = client;
        this.roomId = roomId;
        this.sender = sender;
        this.isAdmin = sender === "@pietervdvn:matrix.org"
    }


    public static prepHtml(el: Element): Element | undefined {

        function changeTag(newTag: string) {
            const newEl = document.createElement(newTag)
            for (let i = 0; i < el.children.length; i++) {
                newEl.appendChild(el.children[i])
            }
            el.parentElement.insertBefore(newEl, el)
            el.parentElement.removeChild(el)
            el = newEl
        }

        if (el.tagName === "svg") {
            el.parentElement.removeChild(el)
            return undefined;
        }
        const svgs = Array.from(el.getElementsByTagName('svg'))
        for (const svg of svgs) {
            svg.parentElement.removeChild(svg)
        }

        if (el.classList.contains("internal-code")) {
            changeTag("code")
        } else if (el.classList.contains("bold")) {
            changeTag("bold")
        } else if (el.classList.contains("italic")) {
            changeTag("italic")
        }

        Array.from(el.children).forEach(child => {
            ResponseSender.prepHtml(child)
        });

        if (el.childNodes.length == 0) {
            if (el.innerHTML === undefined || el.innerHTML === null || el.innerHTML.trim() === "") {
                el.parentElement?.removeChild(el)
                return undefined
            }
        }
        return el;
    }

    public async sendElements(...els: (BaseUIElement | string)[]) {
        await this.sendElement(new Combine(els), false)
    }
    public async sendElement(el: BaseUIElement, ephemeral: boolean = false) {
        const previousLanguage = Locale.language.data
        const targetLanguage = RoomSettingsTracker.settingsFor(this.roomId).language?.data
        if (targetLanguage !== undefined) {
            Locale.language.setData(targetLanguage)
        }
        const html: HTMLElement = el.ConstructElement()
        Locale.language.setData(previousLanguage)


        ResponseSender.prepHtml(html)

        const htmlQueue: Element[] = [html];
        const allParts: Element[] = []
        do {
            const toSend = htmlQueue.shift();
            if (toSend.outerHTML.length > 16384) {
                htmlQueue.push(...Array.from(toSend.children))
            } else {
                allParts.push(toSend)
            }
        } while (htmlQueue.length > 0)

        if (allParts.length > 1 && !this.isDm()) {
            this.sendNotice("Sorry, this message is too long for a public room - send me a direct message instead", false)
            return
        }
        let batch = "";
        const eventIds : string[] = []
        for (const part of allParts) {
            const toSend = part.outerHTML
            if(batch.length + toSend.length > 16000){
                const id = await this.sendHtml(batch,false)
                eventIds.push(id)
                batch = "";
                await new Promise(resolve => setTimeout(resolve, 100))
            }
            if(toSend.length > 16000){
                await this.sendNotice("Received a really big element here - skipping", false);
                continue
            }
            
            batch += toSend;
        }
        
        if(batch.length > 0){
           eventIds.push( await this.sendHtml(batch, false))
        }
        if(ephemeral){
            this.toBeCleaned.push(...eventIds)
        }
    }

    public roomSettings(): RoomSettings | undefined {
        return RoomSettingsTracker.settingsFor(this.roomId)
    }

    public async sendHtml(msg, ephemeral: boolean = false): Promise<string> {
        if (msg.length > 8000 && !this.client.dms.isDm(this.roomId)) {
            return await this.sendNotice("Sorry, this message is too long for a public room - send me a direct message instead", false)
        }

        if (msg.length > 16384) {
            msg = "Sorry, I couldn't generate a response as I wanted to say to much."
        }

       return await this.cleanPrevious(this.client.sendMessage(this.roomId, {
            msgtype: "m.text",
            format: "org.matrix.custom.html",
            body: msg,
            formatted_body: msg
        }), ephemeral)
    }

    public async sendNotice(msg: string, ephemeral: false | boolean = false): Promise<string> {
       
       return await this.cleanPrevious(
            this.client.sendMessage(this.roomId, {
                msgtype: "m.notice",
                body: msg,
            }),
            ephemeral
        )
       
    }

    private async cleanPrevious(event: Promise<string>, ephemeral: boolean): Promise<string> {
        const id = await event;
        while(this.toBeCleaned.length > 0){
            this.client.redactEvent(this.roomId, this.toBeCleaned.shift(), "Cleaning up...")
        }
        if(ephemeral){
            this.toBeCleaned.push(id)
        }
        return id;
    }

    text(translation: Translation) {
        return translation.textFor(this.roomSettings().language.data);
    }

    isDm() {
        return this.client.dms.isDm(this.roomId)
    }
}
