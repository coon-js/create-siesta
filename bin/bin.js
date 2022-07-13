#!/usr/bin/env node

/**
 * coon.js
 * create-siesta
 * Copyright (C) 2022 Thorsten Suckow-Homberg https://github.com/coon-js/create-siesta
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


import {program} from "commander";
import fs from "fs-extra";
import l8 from "@l8js/l8";
import { fileURLToPath } from 'url';
import logger from "@docusaurus/logger";
import initializer from "../lib/init.js";
import boxen from "boxen";
import semver from "semver";
import {createRequire} from "module";

const
    cwd             = fileURLToPath(new URL('../', import.meta.url)),
    pkg             = await fs.readJSON(`${cwd}/package.json`),
    v               = l8.unchain("version", pkg),
    name            = l8.unchain("name", pkg),
    isExternal      = true,
    packageJson     = createRequire(import.meta.url)('../package.json'),
    requiredVersion = packageJson.engines.node;

if (!semver.satisfies(process.version, requiredVersion)) {
    logger.error(":( Minimum Node.js version not met");
    logger.info`You are using Node.js number=${process.version}. Requirement: Node.js number=${requiredVersion}.`;
    logger.info`Tip: You can use name=${`nvm`} to maintain multiple versions of name=${`Node.js`} on your computer`;
    process.exit(1);
}

// start
console.log(boxen(logger.interpolate`
                                             ___                 
              ,--,                         ,--.'|_               
            ,--.'|                         |  | :,'              
  .--.--.   |  |,                .--.--.   :  : ' :              
 /  /    '  \`--'_       ,---.   /  /    '.;__,'  /    ,--.--.    
|  :  /\`./  ,' ,'|     /     \\ |  :  /\`./|  |   |    /       \\   
|  :  ;_    '  | |    /    /  ||  :  ;_  :__,'| :   .--.  .-. |  
 \\  \\    \`. |  | :   .    ' / | \\  \\    \`. '  : |__  \\__\\/: . .  
  \`----.   \\'  : |__ '   ;   /|  \`----.   \\|  | '.'| ," .--.; |  
 /  /\`--'  /|  | '.'|'   |  / | /  /\`--'  /;  :    ;/  /  ,.  |  
'--'.     / ;  :    ;|   :    |'--'.     / |  ,   /;  :   .'   \\ 
  \`--'---'  |  ,   /  \\   \\  /   \`--'---'   ---\`-' |  ,     .-./ 
             ---\`-'    \`----'                       \`--\`---'     

         name=${`siesta`} scaffolding for name=${`Ext JS`}             name=${`create-siesta@${v}`}                      
                           url=${`https://conjoon.org`}
                  siesta (c) url=${`https://bryntum.com`} 
`, {
    padding: 1,
    margin: 1,
    align: 'center',
    borderColor: 'yellow',
    borderStyle: 'round'
}));

program
    .name("create-siesta")
    .action(function() {
        initializer()
    });

program.parse(process.argv);

if (!process.argv.slice(1).length) {
    program.outputHelp();
    process.exit(0);
}

process.on("unhandledRejection", (err) => {
    console.error(err);
    process.exit(1);
});