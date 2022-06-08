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
import {ShutdownCommand} from "./commands/shutdownCommand";
import {TagsCommand} from "./commands/tagsCommand";
import SchemeCommand from "./commands/schemeCommand";
import {DocumentationCommand} from "./commands/documentationCommand";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "fs";
import SearchCommand from "./commands/searchCommand";
import {ResponseSender} from "./ResponseSender";
import WelcomeCommand from "./commands/WelcomeCommand";
import Wikicommand from "./commands/Wikicommand";
import Translations from "../MapComplete/UI/i18n/Translations";
import Wikipedia from "../MapComplete/Logic/Web/Wikipedia";


/**
 * Injected into 'Utils'
 *
 * const html = await download("https://example.org")
 * html["content"].startsWith("<!doctype html>") // => true
 */
async function download(url, headers?: any) {
    return new Promise<{ content: string } | { redirect: string }>((resolve, reject) => {
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
                    if (res.statusCode === 302) {
                        resolve({redirect: res.headers["location"]})
                        return
                    }
                    resolve({content: parts.join("")})
                });
            })
        } catch (e) {
            reject(e)
        }
    })
}

Utils.externalDownloadFunction = download;


async function main(options: { accessToken?: string, username?: string, password?: string }) {
    const version = "0.4.0"
    console.log("Starting matrix bot " + version)

    const homeserverUrl = "https://matrix.org";
    if (options.accessToken === undefined) {
        console.log("Logging in using username and password...")
        const auth = new MatrixAuth(homeserverUrl);
        let cl = await auth.passwordLogin(options.username, options.password);
        options.accessToken = await cl.accessToken
        console.log("Login successfull, creating a new login with the access token " + (await cl.accessToken))
        if (!existsSync("./storage")) {
            mkdirSync("./storage");
        }
        writeFileSync("./storage/access_token.json", options.accessToken, "utf8")
        console.log("Created access token on disk; please restart without arguments")
        return;
    }
    const storage = new SimpleFsStorageProvider("./storage/bot.json");
    const cryptoProvider = new RustSdkCryptoStorageProvider("./storage/encrypted/");
    console.log("This device is", await cryptoProvider.getDeviceId())
    const client = new MatrixClient(homeserverUrl, options.accessToken, storage, cryptoProvider);

    AutojoinRoomsMixin.setupOnClient(client);
    const countrycoder = new CountryCoder(Constants.countryCoderEndpoint, Utils.downloadJson);

    const wosm = new Wikipedia({backend: "wiki.openstreetmap.org"})
    const allCommands: Command<any>[] = [
        new InfoCommand(countrycoder),
        new SearchCommand(),
        new TagsCommand(),
        new DocumentationCommand(),
        new Wikicommand("wiki", _ => wosm,
            (search, language) => [
                search, "tag:" + search, "key:" + search,
                language + ":" + search,
                language + ":tag:" + search,
                language + ":key:" + search
            ]),
        new Wikicommand("wikipedia", language => new Wikipedia({language}),
            (search) => [search]),
        new SetLanguageCommand(),
        new SchemeCommand(),
        new DreamCommand(),
        new ShutdownCommand()
    ]
    allCommands.push(new HelpCommand(version, allCommands))
    const handler = new MessageHandler(client, allCommands)

    client.on("room.failed_decryption", async (roomId: string, event: MatrixMessage, e: Error) => {
        const oneHourAgo = (new Date().getTime()) - (60 * 1000);
        if (event.origin_server_ts < oneHourAgo) {
            console.log("Skip old unencryptable message...")
            // This message is older then one hour - we ignore it
            return;
        }
        if (event.sender === await client.getUserId()) {
            // We shouldn't send messages back to ourselves
            return;
        }
        console.error(`Failed to decrypt ${roomId} ${event['event_id']} ${new Date(event.origin_server_ts).toISOString()} (which is fresher then ${new Date(oneHourAgo).toISOString()}) because `, e);
        const r = new ResponseSender(client, roomId, event.sender)
        await r.sendNotice(Translations.t.matrixbot.decryptionFailed)

    });

    client.on("room.joined", async (roomid, event) => {
        console.log("Joined room", roomid)
        const responseSender = new ResponseSender(client, roomid, undefined)
        await new WelcomeCommand().RunCommand(responseSender, <any>{_: ""})
    })


    client.on("room.message", async (roomId: string, event: any) => {
        try {
            const result = await handler.handle_message(roomId, event)
            if (result === "shutdown") {
                client.stop()
            }
        } catch (e) {
            console.log("Could not handle a room message: ", e)
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
if (process.argv[1].endsWith("mocha")) {
    console.log("Argv[1] ends with mocha, assuming test environment; not starting the bot")
} else if (existsSync("./storage/access_token.json")) {
    const accessToken: string = readFileSync("./storage/access_token.json", "utf8")
    console.log("Loaded access token from disk")
    main({accessToken})
} else if (command === "--password") {
    mainSync({password, username})
} else {
    mainSync({accessToken: command});
}
