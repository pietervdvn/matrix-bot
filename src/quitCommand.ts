import {Command, ResponseSender} from "./command";
import {OsmObject} from "../MapComplete/Logic/Osm/OsmObject";
import {AllKnownLayouts} from "../MapComplete/Customizations/AllKnownLayouts";
import LayerConfig from "../MapComplete/Models/ThemeConfig/LayerConfig";
import {UIEventSource} from "../MapComplete/Logic/UIEventSource";
import {AllTagsPanel} from "../MapComplete/UI/AllTagsPanel";
import Combine from "../MapComplete/UI/Base/Combine";
import Title from "../MapComplete/UI/Base/Title";
import TagRenderingConfig from "../MapComplete/Models/ThemeConfig/TagRenderingConfig";
import {SubstitutedTranslation} from "../MapComplete/UI/SubstitutedTranslation";
import BaseUIElement from "../MapComplete/UI/BaseUIElement";
import Table from "../MapComplete/UI/Base/Table";
import {FixedUiElement} from "../MapComplete/UI/Base/FixedUiElement";
import MetaTagging from "../MapComplete/Logic/MetaTagging";
import {ExtraFuncParams} from "../MapComplete/Logic/ExtraFunctions";
import Link from "../MapComplete/UI/Base/Link";
import {DocumentationCommand} from "./documentationCommand";
import {GeoOperations} from "../MapComplete/Logic/GeoOperations";
import {Geocoding} from "../MapComplete/Logic/Osm/Geocoding";
import {CountryCoder} from "latlon2country";
import {OH} from "../MapComplete/UI/OpeningHours/OpeningHours";
import Translations from "../MapComplete/UI/i18n/Translations";
import Constants from "../MapComplete/Models/Constants";
import WikipediaBox from "../MapComplete/UI/Wikipedia/WikipediaBox";
import LayoutConfig from "../MapComplete/Models/ThemeConfig/LayoutConfig";
import {Paragraph} from "../MapComplete/UI/Base/Paragraph";
import Img from "../MapComplete/UI/Base/Img";

export class QuitCommand extends Command<{ }> {


    constructor() {
        super("quit", "Shuts down the bot",
            {
            }
        );
    }




    public async Run(r: ResponseSender, args: { }): Promise<"shutdown"> {
       console.log("Received 'quit' command, exiting now")
        await r.sendNotice("Shutting down... See you later!")
        return "shutdown"
    }


}
