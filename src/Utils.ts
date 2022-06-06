import {FixedUiElement} from "../MapComplete/UI/Base/FixedUiElement";
import showdown from "showdown";

export default class BotUtils{
    /**
     * Converts `username` into `@username:matrix.org` if needed
     */
    public  static asUserId(targetName: string | undefined): string | undefined{
        if(targetName === undefined){
            return undefined
        }
        if(!targetName.startsWith("@")){
            targetName = "@"+targetName
        }
        if(targetName.indexOf(':') < 0){
            targetName = targetName+":matrix.org"
        }
        return targetName
    }

    public static MdToElement(md: string): FixedUiElement {
        const converter = new showdown.Converter();
        return new FixedUiElement(converter.makeHtml(md))
    }
}