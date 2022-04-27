import {Command, ResponseSender} from "./command";
import {Utils} from "../MapComplete/Utils";
import Combine from "../MapComplete/UI/Base/Combine";
import Title from "../MapComplete/UI/Base/Title";
import Table from "../MapComplete/UI/Base/Table";
import Constants from "../MapComplete/Models/Constants";
import {EncryptionAlgorithm} from "matrix-bot-sdk";

export class DmCommand extends Command<{target?: string}> {

    constructor() {
        super("dm", "Opens a DM room with the invoker",
            {
                target: "Whom to start talking to. Default value: the one who invoked this command. Only admins are allowed to use this option"
            }
        );
    }

    async Run(r: ResponseSender, args) : Promise<string>{
        r.sendNotice("Setting up a room...")
        const target = args.target ?? r.sender
        if(!r.isAdmin && target !== r.sender){
            r.sendNotice("Only admins can specify a sender")
            return
        }
        try {
            const room = await r.client.createRoom({
                invite: [r.sender],
                is_direct: true,
                visibility: "private",
                preset: "trusted_private_chat",
                initial_state: [
                    {type: "m.room.encryption", state_key: "", content: {algorithm: EncryptionAlgorithm.MegolmV1AesSha2}},
                    {type: "m.room.guest_access", state_key: "", content: {guest_access: "can_join"}},
                ],
            })
            await r.sendNotice("I sent you an invitation!")
            
            await r.client.sendMessage(room, {
                msgtype: "m.text",
                body: "Hi " + r.sender + ". Welcome in our encrypted one-on-one conversation. To see a list of possible commands, just say 'help'",
            }) 
            return room
        } catch (e) {
            r.sendHtml("Sorry, I couldn't send you a DM: " + e.message)
            console.error("Couldn't setup a DM with "+r.sender,e)
        }
    }

}
