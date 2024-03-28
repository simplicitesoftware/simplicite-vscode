// import { ShellExecution, Task, TaskDefinition, TaskProvider, TaskScope, workspace, WorkspaceFolder } from "vscode";
// import { SimpliciteInstanceController } from "./SimpliciteInstanceController";

// export class UnitTestTaskProvider implements TaskProvider {
//     static taskType = 'simplicite';
//     private unitTestTask: Task[] | undefined = undefined;

//     constructor(private sic: SimpliciteInstanceController) {}

//     public provideTasks(): Task[] | undefined {
//         if(!this.unitTestTask) {
//             this.unitTestTask = this.getTaskTest();
//         }
//         return this.unitTestTask;
//     }

//     public resolveTask(_task: Task): Task | undefined {
//         // const instancesConfig: string = _task.definition.instancesConfig;
//         // if(instancesConfig) {
//         //     const definition: UnitTestTaskDefinition = <any>_task.definition;
//         //     const coolTask = getTaskTest(definition);
//         //     return coolTask;
//         //     // const definition: UnitTestTaskDefinition = <any>_task.definition;
//         //     // const task = getTask(instancesConfig, _task.definition.runAll, definition);
//         //     // return task[0];
//         // }
//         // const instancesConfig: InstanceConfig[] = _task.definition.instancesConfig;
//         // if(instancesConfig) {
//         //     const definition: UnitTestTaskDefinition = <any>_task.definition;
//         //     const coolTask = getTaskTest(definition);
//         //     return coolTask;
//         //     // const definition: UnitTestTaskDefinition = <any>_task.definition;
//         //     // const task = getTask(instancesConfig, _task.definition.runAll, definition);
//         //     // return task[0];
//         // }
//         return new Task(_task.definition, TaskScope.Global, 'testest resolve', 'simplicite', new ShellExecution('curl http://localhost:8080'));
//     }

//     private getTaskTest(): Task[] {
//         const tasks: Task[] = [];
//         const definition: UnitTestTaskDefinition = {
//             type: UnitTestTaskProvider.taskType,
//             instancesConfig: "test"
//             // instancesConfig: [
//             //     {
//             //         instanceUrl: "http://localhost:8080",
//             //         modulesConfig: [
//             //             {
//             //                 moduleName: "Training",
//             //                 runTest: ["*"]
//             //             }
//             //         ]
//             //     }
//             // ],
//         };
//         tasks.push(new Task(definition, TaskScope.Global, 'Simplicite test', 'simplicite', new ShellExecution('curl http://localhost:8080')));
//         return tasks;
//     }
// }



// // function getTask(instancesConfig: InstanceConfig[], runAll: boolean, definition?: UnitTestTaskDefinition): Task[] {
// //     if (definition === undefined) {
// //         definition = {
// //             type: UnitTestTaskProvider.taskType,
// //             instancesConfig,
// //             runAll
// //         };
// //     }
// //     return [new Task(definition, TaskScope.Workspace, 'simplicite', 'simplicite', new ShellExecution('curl http://localhost:8080'))];
// // }

// interface UnitTestTaskDefinition extends TaskDefinition {
//     instancesConfig: string
//     // instancesConfig: InstanceConfig[],
//     // runAll?: boolean
// }

// interface InstanceConfig {
//     instanceUrl: string,
//     modulesConfig: [
//         {
//             moduleName: string,
//             runTest: string[]
//         }
//     ]
// }