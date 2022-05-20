import Table from "../../MapComplete/UI/Base/Table";
import {Command} from "../command";
import Combine from "../../MapComplete/UI/Base/Combine";
import {OsmObject} from "../../MapComplete/Logic/Osm/OsmObject";
import {Geocoding} from "../../MapComplete/Logic/Osm/Geocoding";
import {ResponseSender} from "../ResponseSender";

export class TagsCommand extends Command<{ _: string }> {

    constructor() {
        super("tags", "Show the tags of an OSM-object. Either give an id OR a search string; the objects are interpreted and known values are shown.",
            {
                "_": "The ID of the OSM-object or a search query"
            }
        );
    }

private async SendInfoAbout(r: ResponseSender, osmId: string){
    const obj = await OsmObject.DownloadObjectAsync(osmId)
    const props = obj.asGeoJson().properties;

    await r.sendElement(
        new Combine([
            new Table(["key","value"],
                Object.keys(props).map(k => [k, props[k]]))])
    )
}
    
    public async Run(r: ResponseSender, args: {  _: string }): Promise<void> {
        const id = args._;
        if (id === null || id === undefined || id === "") {
            await r.sendNotice("Please, provide a search term of id to use this command")
            return
        }
        const matched = id.match(/(https:\/\/|http:\/\/)?(www\.)?(osm.org|openstreetmap.org)\/(node|way|relation)\/([0-9]+)/)
        if (matched !== null) {
            const type = matched[4]
            const n = matched[5]
            await this.SendInfoAbout(r, type + "/" + n);
            return;
        }

        const matchedSimple = id.match(/(node|way|relation)\/([0-9]+)/)
        if (matchedSimple !== null) {
            const type = matchedSimple[1]
            const n = matchedSimple[2]
            await this.SendInfoAbout(r, type + "/" + n);
            return;
        }

        await r.sendHtml("<code>" + id + "</code> doesn't seem to be a valid OSM-id - searching worldwide instead for " + args._)
        const geocodedList = await Geocoding.Search(args._)
        if ((geocodedList?.length ?? 0) === 0) {
            await r.sendHtml("Nothing found for " + args._)
            return;
        }

        const geocoded = geocodedList[0]
        const osmId = geocoded.osm_type + "/" + geocoded.osm_id
        await this.SendInfoAbout(r, osmId)
    }

}
