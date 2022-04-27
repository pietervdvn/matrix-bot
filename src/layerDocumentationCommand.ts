import {Command, ResponseSender} from "./command";
import {AllKnownLayouts} from "../MapComplete/Customizations/AllKnownLayouts";
import LayerConfig from "../MapComplete/Models/ThemeConfig/LayerConfig";
import {Utils} from "../MapComplete/Utils";
import LayoutConfig from "../MapComplete/Models/ThemeConfig/LayoutConfig";
import Combine from "../MapComplete/UI/Base/Combine";
import List from "../MapComplete/UI/Base/List";
import Constants from "../MapComplete/Models/Constants";

// import {AllTagsPanel} from "../MapComplete/UI/AllTagsPanel";


export class LayerDocumentationCommand extends Command<{ id: string }> {

    constructor() {
        super("docs", "Gets documentation about a mapcomplete layer",
            {
                "id": "The ID of the layer for which documentation is needed"
            }
        );
    }

    private static matchingLayer(documentation): LayerConfig | undefined {
        for (const layer of AllKnownLayouts.AllPublicLayers()) {
            if (layer.id === documentation) {
                return layer;
            }
        }
    }
    
    public static themesUsingLayer(id: string): LayoutConfig[] {
        return AllKnownLayouts.layoutsList.filter(l => l.id !== "personal" && l.layers.some(layer => layer.id === id))
    }
    
    public async Run(r: ResponseSender, args: { id: string }): Promise<void> {
    	if(args.id === undefined){
    		r.sendElement(
    			new Combine([
    				"Give a layer id to get information about a layer. Known layers are:",
                    new List(AllKnownLayouts.AllPublicLayers()
                        .filter(l => Constants.priviliged_layers.indexOf(l.id) < 0 && l.source.geojsonSource === undefined)
                        .map(l => 
                        `<code>${l.id}</code> ${l.description?.txt ?? l.name?.txt ?? ""}`
                    ))
    			]
    		))
            return;
    	}
        const layer = LayerDocumentationCommand.matchingLayer(args.id)
        if(layer === undefined){
            const sorted = Utils.sortedByLevenshteinDistance(args.id, AllKnownLayouts.AllPublicLayers(), l => l.id).slice(0,5)
            await r.sendElement(new Combine([
                "No layer found with name <code>"+args.id+"</code>. Perhaps you meant one of: ",
                new List(sorted.map(l => `<code>${l.id}</code>`))
                
            ]))
            return
        }
        const d = layer.GenerateDocumentation(LayerDocumentationCommand.themesUsingLayer(args.id).map(l => l.id))
        if(d === undefined){
            const closest = Utils.sortedByLevenshteinDistance(args.id, AllKnownLayouts.AllPublicLayers(), l => l.id)
                .slice(0, 3)
                .map(l => "<code>"+l.id+"</code>")
            await r.sendHtml("No layer with name <code>"+args.id+"</code> found. Maybe try "+closest.join(", "))
        }
        await r.sendHtml(d.ConstructElement().innerHTML)
    }
}
