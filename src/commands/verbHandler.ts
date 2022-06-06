import {ResponseSender} from "../ResponseSender";
import Translations from "../../MapComplete/UI/i18n/Translations";

export class VerbHandler<T, R> {

    private readonly verbs: [string, string, (responseHandler: ResponseSender, t: T) => Promise<R>][] = []
    private _onNotFound: (verb: string, r: ResponseSender, t: T) => Promise<R>;
    private _onNoVerb: (r: ResponseSender, t: T) => Promise<R>;
    private _onNoVerbDoc: string;

    constructor(onNotFound: (verb: string, r: ResponseSender, t: T) => Promise<R> = undefined) {
        this._onNotFound = onNotFound ??
            (async (verb, r, _) => {
                const known_verbs = this.verbs.map(v => "<code>" + v[0] + "</code>").join(", ")
                await r.sendHtml(Translations.t.matrixbot.subcommanNotFound.Subs({
                    verb,
                    known_verbs
                }))
                return undefined
            })
        ;
        this._onNoVerb = (async (r, _ ) => {
            const known_verbs = this.verbs.map(v => "<code>" + v[0] + "</code>").join(", ")
            await r.sendNotice(Translations.t.matrixbot.subcommandNotGiven.Subs({
                known_verbs
            }))
            return undefined
        })
    }

    public Add(name: string, doc: string, action: (responseSender: ResponseSender, t: T) => Promise<R>): VerbHandler<T, R> {
        this.verbs.push([<any>name, doc, action])
        return this;
    }

    public async Exec(verb: string | undefined, r: ResponseSender, t: T): Promise<R> {
        if(!verb){
            return await this._onNoVerb(r, t)
        }
        const match = this.verbs.find(v => v[0] === verb)
        if (match === undefined) {
            return await this._onNotFound(verb, r, t);
        }
        const action = match[2]
        return await action(r, t)
    }

    public knownVerbs(): string[] {
        return this.verbs.map(v => v[0])
    }

    /**
     * THe passed method will be called if _no_ verb is given, thus if the verb is undefined;
     * This serves as a fallback
     * @constructor
     */
    public AddDefault(doc: string, action: (responseSender: ResponseSender, t: T) => Promise<R>) {
        this._onNoVerbDoc = doc;
        this._onNoVerb = action
        return this
    }
}