import {
    AutojoinRoomsMixin,
    MatrixAuth,
    MatrixClient,
    RustSdkCryptoStorageProvider,
    SimpleFsStorageProvider
} from "matrix-bot-sdk"
import {Utils} from "../MapComplete/Utils";
import * as https from "https";
import {Command, ResponseSender} from "./command";
import {InfoCommand} from "./infoCommand";
import {HelpCommand} from "./helpCommand";
import * as fakedom from "fake-dom"
import {LayerDocumentationCommand} from "./layerDocumentationCommand";
import {SetLanguageCommand} from "./SetLanguageCommand";
import {CountryCoder} from "latlon2country";
import Constants from "../MapComplete/Models/Constants";
import {DmCommand} from "./dmCommand";

class MessageHandler {

    private readonly _client: MatrixClient;
    private _commands: Command<any>[];

    constructor(client: MatrixClient, commands: Command<any>[]) {
        this._client = client;
        this._commands = commands;
    }

    public async handle_message(roomId, event) {
        if (!event["content"]) return;
        const botId = await this._client.getUserId();
        const sender = event["sender"];

        if (sender === botId) {
            return
        }
        let body = event["content"]["body"];
        const isDm = this._client.dms.isDm(roomId)
        if(!isDm){
            const prefixes = ["!", botId + ": ", botId + ": ", "MapComplete-bot: ", "MapComplete-bot:"]
            const matchingPrefix = prefixes.find(prefix => body.startsWith(prefix))
            if (matchingPrefix === undefined) {
                return;
            }
            body = body.substring(matchingPrefix.length)
        }
        console.log(`${roomId}: ${sender} says '${body}'`);

        for (const command of this._commands) {
            const key = command.cmd.toLowerCase()
            if (body.toLowerCase().startsWith(key)) {
                const msg = body.substring(key.length)
                const args = msg.split(" ").slice(1)
                const argsObj = {}
                let i = 0
                for (const argName in command.args) {
                    argsObj[argName] = args[i]
                    i++
                }
                const r = new ResponseSender(this._client, roomId, sender);
                argsObj["_"] = (args.join(" "));
                try{
                    await command.Run(r, argsObj)
                }catch(e){
                    const msg = "Sorry, something went wrong while executing command "+key
                    if(r.isAdmin){
                        r.sendNotice(msg+"\n\nThe error is: <code>"+e.message+"</code>" )
                    }else{
                        r.sendNotice(msg)
                    }
                    console.error(e)
                }
                return;
            }
        }

        this._client.sendMessage(roomId, {
            "msgtype": "m.notice",
            "body": "I didn't understand your request",
        });

    }

}

Utils.download = (url, headers?: any): Promise<any> => {
    return new Promise((resolve, reject) => {
        try {
            headers = headers ?? {}
            headers.accept = "application/json"
            const method = headers.method ?? "GET"
            delete headers.method
            headers["user-agent"] = "MapComplete Matrix Bot - https://github.com/pietervdvn/mapcomplete - pietervdvn@posteo.net"
            console.log(` > ${method}(${url})`)
            const urlObj = new URL(url)
            https.get({
                host: urlObj.host,
                path: urlObj.pathname + urlObj.search,
                method,
                port: urlObj.port,
                headers: headers
            }, (res) => {
                const parts: string[] = []
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    // @ts-ignore
                    parts.push(chunk)
                });

                res.addListener('end', function () {
                    const result = parts.join("")
                    try {
                        resolve(JSON.parse(result))
                    } catch (e) {
                        console.error("Could not parse the following as JSON:", result)
                        resolve(undefined)
                    }
                });
            })
        } catch (e) {
            reject(e)
        }
    })
}

async function main(options: { accessToken?: string, username?: string, password?: string }) {
    console.log("Starting matrix bot")
   
    const homeserverUrl = "https://matrix.org";
    if (options.accessToken === undefined) {
    	console.log("Logging in using username and password")
        const auth = new MatrixAuth(homeserverUrl);
        let cl = await auth.passwordLogin(options.username, options.password);
        options.accessToken = await cl.accessToken
        console.log("Login successfull, creating a new login with the access token "+(await cl.accessToken))
    }
    const storage = new SimpleFsStorageProvider("./storage/bot.json");
    const cryptoProvider = new RustSdkCryptoStorageProvider("./storage/encrypted/");
    console.log("This device is",await cryptoProvider.getDeviceId())
    const client = new MatrixClient(homeserverUrl, options.accessToken, storage, cryptoProvider);
    
    AutojoinRoomsMixin.setupOnClient(client);
    const countrycoder = new CountryCoder(Constants.countryCoderEndpoint, Utils. downloadJson);

    let allCommands: Command<any>[] = [
        new InfoCommand(countrycoder),
        new LayerDocumentationCommand(),
        new SetLanguageCommand(),
        new DmCommand()
    ]
    allCommands.push(new HelpCommand(allCommands))
    const handler = new MessageHandler(client, allCommands)

    client.on("room.failed_decryption", async (roomId: string, event: any, e: Error) => {
        console.error(`Failed to decrypt ${roomId} ${event['event_id']} because `, e);
        await client.sendMessage(roomId, {
            "msgtype": "m.notice",
            "body": "Sorry, we don't support encryption yet",
        })
    });

    client.on("room.joined", async (roomid, event) => {
        console.log("Joined room", roomid)
    })
    
    
    
    client.on("room.message", async (roomId: string, event: any) => {
        try {
            await handler.handle_message(roomId, event)
        } catch (e) {
            console.error("Could not handle a room message...")
        }
    });
    
    console.log("index", "Starting bot...");
    try{
    
    await client.start();
    console.log("Started! This bot is called ", await client.getUserId())
    }catch(e){
    	console.error("Starting bot failed...")
    }
}


if(fakedom === undefined || window === undefined){
    console.log("FakeDom not initialized")
}


const [command, username, password] = process.argv.slice(2)
if (command === "--password") {
    main({password, username})
} else {
    main({accessToken: command});
}
