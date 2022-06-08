import Table from "../../MapComplete/UI/Base/Table";
import {Command} from "../command";
import {OsmObject} from "../../MapComplete/Logic/Osm/OsmObject";
import {Geocoding} from "../../MapComplete/Logic/Osm/Geocoding";
import {ResponseSender} from "../ResponseSender";
import Translations from "../../MapComplete/UI/i18n/Translations";

export class TagsCommand extends Command<"_"> {

    constructor() {
        const t = Translations.t.matrixbot.commands.tags;
        super("tags", t.docs,
            {
                "_": t.argsearch
            }
        );
    }

    public static async SendInfoAbout(r: ResponseSender, geocoded: {osm_type: string, osm_id: number | string}){
        const osmId = geocoded.osm_type + "/" + geocoded.osm_id
        const obj = await OsmObject.DownloadObjectAsync(osmId)
        const props = obj.asGeoJson().properties;
    
        await r.sendElements(
                new Table(["key","value"],
                    Object.keys(props).map(k => [k, props[k]]))        )
    }
        
    public async Run(r: ResponseSender, args: {  _: string }): Promise<void> {
          const t = Translations.t.matrixbot.commands.tags;
      const id = args._;
        if (id === null || id === undefined || id === "") {
            await r.sendNotice(t.noSearchGiven)
            return
        }
        const matched = id.match(/(https:\/\/|http:\/\/)?(www\.)?(osm.org|openstreetmap.org)\/(node|way|relation)\/([0-9]+)/)
        if (matched !== null) {
            const type = matched[4]
            const n = matched[5]
            await TagsCommand.SendInfoAbout(r, {osm_type: type , osm_id: n});
            return;
        }

        const matchedSimple = id.match(/(node|way|relation)\/([0-9]+)/)
        if (matchedSimple !== null) {
            const type = matchedSimple[1]
            const n = matchedSimple[2]
            await TagsCommand.SendInfoAbout(r, {osm_type: type  , osm_id:  Number(n)});
            return;
        }

        await r.sendElement(t.announceSearch.Subs({id, search: args._}), true)
        const geocodedList = await Geocoding.Search(args._)
        if ((geocodedList?.length ?? 0) === 0) {
            await r.sendElement(t.nothingFound.Subs(args))
            return;
        }

        const geocoded = geocodedList[0]
       await TagsCommand.SendInfoAbout(r, geocoded)
    }

}
