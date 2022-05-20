import {
    AutojoinRoomsMixin,
    MatrixAuth,
    MatrixClient,
    RustSdkCryptoStorageProvider,
    SimpleFsStorageProvider
} from "matrix-bot-sdk"
import {Utils} from "../MapComplete/Utils";
import * as https from "https";
import {Command} from "./command";
import * as fakedom from "fake-dom"
import {CountryCoder} from "latlon2country";
import Constants from "../MapComplete/Models/Constants";
import {MatrixMessage, MessageHandler} from "./MessageHandler";
import {SetLanguageCommand} from "./commands/SetLanguageCommand";
import DreamCommand from "./commands/dreamCommand";
import {HelpCommand} from "./commands/helpCommand";
import {InfoCommand} from "./commands/infoCommand";
import {QuitCommand} from "./commands/quitCommand";
import {TagsCommand} from "./commands/tagsCommand";
import SchemeCommand from "./commands/schemeCommand";
import {DocumentationCommand} from "./commands/documentationCommand";


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
    const version = "0.0.3"
    console.log("Starting matrix bot "+version)

    const homeserverUrl = "https://matrix.org";
    if (options.accessToken === undefined) {
        console.log("Logging in using username and password...")
        const auth = new MatrixAuth(homeserverUrl);
        let cl = await auth.passwordLogin(options.username, options.password);
        options.accessToken = await cl.accessToken
        console.log("Login successfull, creating a new login with the access token " + (await cl.accessToken))
    }
    const storage = new SimpleFsStorageProvider("./storage/bot.json");
    const cryptoProvider = new RustSdkCryptoStorageProvider("./storage/encrypted/");
    console.log("This device is", await cryptoProvider.getDeviceId())
    const client = new MatrixClient(homeserverUrl, options.accessToken, storage, cryptoProvider);

    AutojoinRoomsMixin.setupOnClient(client);
    const countrycoder = new CountryCoder(Constants.countryCoderEndpoint, Utils.downloadJson);

    let allCommands: Command<any>[] = [
        new InfoCommand(countrycoder),
        new TagsCommand(),
        new DocumentationCommand(),
        new SetLanguageCommand(),
        new SchemeCommand(),
        new DreamCommand(),
        new QuitCommand()
    ]
    allCommands.push(new HelpCommand(version, allCommands))
    const handler = new MessageHandler(client, allCommands)

    client.on("room.failed_decryption", async (roomId: string, event: MatrixMessage, e: Error) => {
        const oneHourAgo = (new Date().getTime()) - (60 * 1000);
        if(event.origin_server_ts < oneHourAgo) {
            console.log("Skip old unencryptable message...")
            // This message is older then one hour - we ignore it
            return;
        }
        if(event.sender === await client.getUserId()){
            // We shouldn't send messages back to ourselves
            return;
        }
        console.error(`Failed to decrypt ${roomId} ${event['event_id']} ${new Date(event.origin_server_ts ).toISOString()} (which is fresher then ${new Date(oneHourAgo).toISOString()}) because `, e);
        await client.sendMessage(roomId, {
            "msgtype": "m.notice",
            "body": "Sorry, we don't support encryption yet",
        })
    });

    client.on("room.joined", async (roomid, event) => {
        console.log("Joined room", roomid)
        await client.sendMessage(roomid, {
            msgtype: "m.text",
            body: "Hi! I'm MapComplete-bot - a computer program that responds to some commands. To see a list of possible commands, just say 'help'",
        })
    })


    client.on("room.message", async (roomId: string, event: any) => {
        try {
            const result = await handler.handle_message(roomId, event)
            if (result === "shutdown") {
                client.stop()
            }
        } catch (e) {
            console.error("Could not handle a room message: ", e)
        }
    });

    console.log("index", "Starting bot...");
    try {

        await client.start();
        console.log("Started! This bot is called ", await client.getUserId())
    } catch (e) {
        console.error("Starting bot failed...")
    }
}

function mainSync(options) {
    try {
        main(options).catch(e => {
            console.log("CRITICAL ASYNC ERROR", e)
        })
    } catch (e) {
        console.log("CRITICAL ERROR: ", e)
    }
}

if (fakedom === undefined || window === undefined) {
    console.log("FakeDom not initialized")
}


const [command, username, password] = process.argv.slice(2)
if (command === "--password") {
    mainSync({password, username})
} else {
    mainSync({accessToken: command});
}
