import {MatrixClient} from "matrix-bot-sdk";
import BaseUIElement from "../MapComplete/UI/BaseUIElement";
import Locale from "../MapComplete/UI/i18n/Locale";
import {RoomSettingsTracker} from "./RoomSettings";
import {Translation} from "../MapComplete/UI/i18n/Translation";
import Combine from "../MapComplete/UI/Base/Combine";
import Translations from "../MapComplete/UI/i18n/Translations";
import Link from "../MapComplete/UI/Base/Link";
import LinkToWeblate from "../MapComplete/UI/Base/LinkToWeblate";
import {UIEventSource} from "../MapComplete/Logic/UIEventSource";

export class ResponseSender {
    public client: MatrixClient;
    public roomId: string;
    public sender: string;
    public isAdmin: boolean;
    public readonly startTime: Date = new Date()
    private toBeCleaned: string[] = [];

    private static MAX_LENGTH = 16000;
    
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

        const imgs = Array.from(el.getElementsByTagName('img'))
        for (const img of imgs) {
            // @ts-ignore
            const textmode = img.attributes?.textmode?.value
            if (textmode) {
                const span = document.createElement('span');
                span.innerHTML = textmode
                img.parentElement.replaceChild(span, img)
            }
        }

        if (el.classList.contains("internal-code")) {
            changeTag("code")
        } else if (el.classList.contains("quote")){
            changeTag("quote")
        }else if (el.classList.contains("bold")) {
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
        const interspersed = []
        for (const el of els) {
            interspersed.push(el, " ")
        }
        await this.sendElement(new Combine(interspersed), false)
    }

    public async sendElementsEphemeral(...els: (BaseUIElement | string)[]) {
        await this.sendElement(new Combine(els), true)
    }

    public async sendElement(el: BaseUIElement, ephemeral: boolean = false): Promise<string[]> {
        const previousLanguage = Locale.language.data
        const targetLanguage = this.roomLanguage()
        if (targetLanguage !== undefined) {
            Locale.language.setData(targetLanguage)
           Translation.forcedLanguage = targetLanguage
        }
        const html: HTMLElement = el.ConstructElement()
        Locale.language.setData(previousLanguage)


        ResponseSender.prepHtml(html)

        const htmlQueue: Element[] = [html];
        const allParts: Element[] = []
        do {
            const toSend = htmlQueue.shift();
            if (toSend.outerHTML.length > ResponseSender.MAX_LENGTH) {
                htmlQueue.push(...Array.from(toSend.children))
            } else {
                allParts.push(toSend)
            }
        } while (htmlQueue.length > 0)

        if (allParts.length > 1 && !this.isDm()) {
            this.sendNotice(Translations.t.matrixbot.tooLongForPublic)
            return
        }
        let batch = "";
        const eventIds: string[] = []
        for (const part of allParts) {
            const toSend = part.outerHTML
            if (batch.length + toSend.length > ResponseSender.MAX_LENGTH) {
                const id = await this.sendHtml(batch, false)
                eventIds.push(id)
                batch = "";
                await new Promise(resolve => setTimeout(resolve, 100))
            }
            if (toSend.length > ResponseSender.MAX_LENGTH) {
                await this.sendNotice("Received a really big element here - skipping", false);
                continue
            }

            batch += toSend;
        }

        if (batch.length > 0) {
            eventIds.push(await this.sendHtml(batch, false))
        }
        if (ephemeral) {
            this.toBeCleaned.push(...eventIds)
        }
        return eventIds;
    }

    public roomSettings() : UIEventSource<Map<string, Set<string>>>{
        return RoomSettingsTracker.settingsFor(this.roomId)
    }
    
    public roomLanguage(): string {
        const languages =RoomSettingsTracker.settingsFor(this.roomId)?.data?.get("language")
        if(languages === undefined || languages.size == 0){
            return "en"
        }
        return  Array.from(languages)[0]
    }
    
    public sleep(ms: number): Promise<void>{
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    public async sendHtml(msg: string, ephemeral: boolean = false): Promise<string> {
        if (msg.length > ResponseSender.MAX_LENGTH && !this.client.dms.isDm(this.roomId)) {
            return await this.sendNotice(Translations.t.matrixbot.tooLongForPublic)
        }

        if (msg.length > ResponseSender.MAX_LENGTH) {
            msg = "Sorry, I couldn't generate a response as I wanted to say to much."
        }

        return await this.cleanPrevious(this.client.sendMessage(this.roomId, {
            msgtype: "m.text",
            format: "org.matrix.custom.html",
            body: msg,
            formatted_body: msg
        }), ephemeral)
    }

    public async sendNotice(msg: string | Translation, ephemeral: false | boolean = false): Promise<string> {
        
        return await this.cleanPrevious(
            this.client.sendMessage(this.roomId, {
                msgtype: "m.notice",
                body: this.text(msg),
            }),
            ephemeral
        )

    }

    text(translation: string | Translation): string | undefined {
        if(typeof translation === "string"){
            return translation
        }
        return translation?.textFor(this.roomLanguage());
    }

    isDm() {
        return this.client.dms.isDm(this.roomId)
    }

    private async cleanPrevious(event: Promise<string>, ephemeral: boolean): Promise<string> {
        const id = await event;
        while (this.toBeCleaned.length > 0) {
            this.client.redactEvent(this.roomId, this.toBeCleaned.shift(), "Cleaning up...")
        }
        if (ephemeral) {
            this.toBeCleaned.push(id)
        }
        return id;
    }
    
    public TranslationLink(language = undefined): BaseUIElement {
 return       new Link(Translations.t.matrixbot.commands.language.helpTranslating, LinkToWeblate.hrefToWeblateZen(language ?? this.roomLanguage(), "core", "matrixbot"))
    }
}
