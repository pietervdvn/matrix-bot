import {RoomSettingsTracker} from "./RoomSettings";
import {ResponseSender} from "./ResponseSender";

export interface CommandOptions {
    adminOnly?: false | boolean
}

export abstract class Command<T> {
    public readonly cmd: string;
    public readonly documentation: string;
    public readonly args: T;
    public readonly options: CommandOptions;

    constructor(cmd: string, documentation: string, args: T, options?: CommandOptions) {
        this.cmd = cmd;
        this.documentation = documentation;
        this.args = args;
        this.options = options;
        const rgx = /[a-z]+/;
        if(this.cmd.match(rgx) === null){
            throw "Command names must match "+rgx.source
        }
    }

    /**
     * Checks wether or not someone is allowed to run this command
     *
     * import {QuitCommand} from "./commands/quitCommand";
     * 
     * // Random user should not be allowed to shutdown the bot
     * RoomSettingsTracker.roles.get("@someuser:matrix.org")?.clear()
     * const someuser = new ResponseSender(undefined, "someroom", "@someuser:matrix.org")
     * new QuitCommand().mayExecute(someuser) // => false
     * 
     * // user which has permission should be allowed to shutdown the bot
     * RoomSettingsTracker.roles.set("@someuser:matrix.org", new Set(["exit"]))
     * const someuser = new ResponseSender(undefined, "someroom", "@someuser:matrix.org")
     * new QuitCommand().mayExecute(someuser) // => true
     * 
     * // Pieterdvn should always be allowed to shutdown
     * const admin = new ResponseSender(undefined, "someroom", "@pietervdvn:matrix.org")
     * new QuitCommand().mayExecute(admin) // => true
     */
    public mayExecute(r: ResponseSender): boolean{
      return (!this.options?.adminOnly) || r.isAdmin || (RoomSettingsTracker.roles.get(r.sender)?.has(this.cmd) ?? false)
    }

    async RunCommand(r: ResponseSender, argsObj: T & { _: string }): Promise<string | undefined> {
        if (!this.mayExecute(r)) {
            r.sendNotice("This command is only available to administrators or users who have this role")
            return
        }
        return this.Run(r, argsObj)
    }

    protected abstract Run(r: ResponseSender, args: T & { _: string }): Promise<any>;
}
