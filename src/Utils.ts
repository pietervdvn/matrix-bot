export default class BotUtils{
    /**
     * Converts `username` into `@username:matrix.org` if needed
     */
    public  static asUserId(targetName: string): string{
        if(!targetName.startsWith("@")){
            targetName = "@"+targetName
        }
        if(targetName.indexOf(':') < 0){
            targetName = targetName+":matrix.org"
        }
        return targetName
    } 
}