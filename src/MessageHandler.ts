import {MatrixClient} from "matrix-bot-sdk";
import {Command} from "./command";
import {Utils} from "../MapComplete/Utils";
import Combine from "../MapComplete/UI/Base/Combine";
import SendMessageCommand from "./commands/sendMessageCommand";
import {RoleCommand} from "./commands/RoleCommand";
import {ResponseSender} from "./ResponseSender";
import List from "../MapComplete/UI/Base/List";

export interface MatrixMessage {
    "content": {
        "body": string,
        "format": "org.matrix.custom.html",
        "formatted_body": string,
        "msgtype": "m.text"
    },
    /**
     * Linux timestamp in milliseconds
     */
    "origin_server_ts": number,
    "sender": string,
    "type": "m.room.message",
    "unsigned": { "age": number, "transaction_id": string },
    "event_id": string
}

export class MessageHandler {

    private readonly _client: MatrixClient;
    private _commands: Command<any>[];
    private _commandsMap = new Map<string, Command<any>>();
    private _botId: string;

    constructor(client: MatrixClient, commands: Command<any>[]) {
        this._client = client;
        this._commands = commands;
        const self = this;
        this._client.getUserId().then(id => {
            self._botId = id
        });

        this._commands.push(
            new SendMessageCommand(this), new RoleCommand(this),
        )

        for (const command of this._commands) {
            if (this._commandsMap.has(command.cmd)) {
                throw "Command with name" + command.cmd + " has been defined multiple times"
            }
            this._commandsMap.set(command.cmd, command)
        }
    }

    public hasCommand(request: string) {
        return this._commandsMap.has(request.toLowerCase());
    }

    public removePrefix(body: string, isDm: boolean): string | undefined {
        if (body === undefined) {
            return
        }
        body = body.trim()
        const prefixes = ["!", this._botId + ": ", this._botId + ": ", "MapComplete-bot: ", "MapComplete-bot:"]
        if (isDm) {
            prefixes.push("")
        }
        const matchingPrefix = prefixes.find(prefix => body.startsWith(prefix))
        if (matchingPrefix === undefined) {
            return;
        }
        return body.substring(matchingPrefix.length)
    }

    public async handle_message(roomId, event: MatrixMessage): Promise<string | undefined> {
        if (!event["content"]) return;
        const oneHourAgo = (new Date().getTime()) - (60 * 60 * 1000);
        if (event.origin_server_ts < oneHourAgo) {
            console.log("Skip old message...")
            // This message is older then one hour - we ignore it
            return;
        }
        const sender = event["sender"];

        if (sender === this._botId) {
            return
        }
        let body = event.content.body;
        const isDm = this._client.dms.isDm(roomId)
        body = this.removePrefix(body, isDm)
        if(body === undefined){
            return
        }
        console.log(`${roomId}: ${sender} says '${body}'`);
        const r = new ResponseSender(this._client, roomId, sender);
        return await this.executeCommand(body, r);
    }

    public async executeCommand(body: string, r: ResponseSender): Promise<string | undefined> {
        const request = (body.trim().split(" ")[0] ?? "").toLowerCase()
        const command = this._commandsMap.get(request)
        if (command === undefined) {
            const sorted = Utils.sortedByLevenshteinDistance(request, this._commands, c => c.cmd)
            await r.sendElement(new Combine([
                `I didn't understand your request. Did you perhaps mean to type ${sorted.slice(0, 2).map(cmd => cmd.cmd).join(", ")} or ${sorted[3].cmd}?`,
                "<p>Type <code>help</code> to see an overview of all commands</p>"
            ]).SetClass("flex flex-col"))
            return;
        }
        const args = body.split(" ").slice(1)
        const argsObj = {}
        let i = 0
        for (const argName in command.args) {
            if (argName == "_") {
                continue
            }
            argsObj[argName] = args[i]
            i++
        }
        argsObj["_"] = (args.slice(i).join(" "));
        try {
            return await command.RunCommand(r, argsObj)
        } catch (e) {
            const msg = "Sorry, something went wrong while executing command " + command.cmd
            if (r.isAdmin) {
                await r.sendElement(
                    new Combine([
                        msg,
                        "<p>The error is <code>"+e.message+"</code></p>",
                      new List(  JSON.stringify(e.stack).split("\n"))
                    ]))
            } else {
                await r.sendNotice(msg)
            }
            console.error(e)
        }
        for (const command of this._commands) {
            const key = command.cmd.toLowerCase()
            if (request === key) {

                return;
            }
        }


    }

}
