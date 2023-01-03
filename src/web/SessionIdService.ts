// "use strict";

// import { env, Uri, workspace } from "vscode";
// import { SessionIdSave } from "./interfaces";
// import { logger } from "./Log";

// // SessionIdService is a service replacing the vscode memento object (see deactivate function in extension.js)
// // Handles a json that contains a sessionId and it's corresponding api modules
// // This object is only used on a desktop context because there can be multiple instances of VS Code sharing the same memento object
// // Otherwise, one api module will be initialized on every VS Code instance if the workspace is undefined (which is the case when opening a VS Code instance).
// const enc = new TextEncoder();
// const dec = new TextDecoder();

// export class SessionIdService {
//   static async createJson() {
//     if(this.isDesktop()) {
//       try {
//         const content = await this.readJson();
//         console.log(SESSION_ID_JSON.path + ' exists and contains ' + content.length + ' session id(s)');
//       } catch(e) {
//         console.error('Could not read file ' + SESSION_ID_JSON.path);
//         await workspace.fs.writeFile(SESSION_ID_JSON, enc.encode(JSON.stringify([])));
//       }
//     }
//   }

//   static async saveSessionIdApiModule(moduleName: string, instanceUrl: string) {
//     try {
//       const content = await this.readJson();
//       let arrayId = content.findIndex(elem => elem.sessionId === env.sessionId);
//       const urlName = {name: moduleName, instanceUrl: instanceUrl};
//       if(arrayId === -1) {
//         content.push({
//           sessionId: env.sessionId,
//           apiModules: [urlName]
//         });
//       } else {
//         content[arrayId].apiModules.push(urlName);
//       }
//       await this.writeJson(content);
//     } catch(e: any) {
//       console.error('Error while saving sessionId in json ' + e.message);
//     }
//   }

//   static async readJson(): Promise<Array<SessionIdSave>> {
//     const fileContent = await workspace.fs.readFile(SESSION_ID_JSON);
//     const contentString = dec.decode(fileContent);
//     return JSON.parse(contentString);
//   }

//   static async writeJson(content: SessionIdSave[]) {
//     await workspace.fs.writeFile(SESSION_ID_JSON, enc.encode(JSON.stringify(content)));
//   }

//   static isDesktop(): boolean {
//     return env.appHost === 'desktop' ? true : false; 
//   }
// }