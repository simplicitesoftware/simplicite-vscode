'use strict';

import { Prompt } from "./Prompt";

export class AuthenticationController {
    prompt: Prompt;
    constructor(prompt: Prompt) {
        this.prompt = prompt;
    }

    static loginController(app: any) {
        if(!app.authtoken) {
            
        }
    }


}