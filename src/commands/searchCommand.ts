import {Command} from "../command";
import {ResponseSender} from "../ResponseSender";

export default class SearchCommand extends Command<
    {
        layerid: string,
        verb: "in" | "near" | string,
        _: string
    }> {
    
    constructor() {
        super("search", "Searches for POI in or near a location",{
            layerid: "The name of a layer",
            verb: "Either search in a geographical area (e.g. a city) or search near a POI",
            _: "The search term"
        });
    }

    protected Run(r: ResponseSender, args: { layerid: string; verb: "in" | "near" | string; _: string } & { _: string }): Promise<any> {
        return Promise.resolve(undefined);
    }
    
    
    
}