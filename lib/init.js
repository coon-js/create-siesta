/**
 * conjoon
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


import fs from "fs-extra";
import path from "path";
import shell from "shelljs";
import supportsColor from "supports-color";
import l8 from "@l8js/l8";
import { fileURLToPath } from "url";
import logger from "@docusaurus/logger";
import * as client from "./prompts.js";
import * as util from "./utils.js";

/**
 *
 */
export default async function init (options) {

    options = options || {};
    /**
     * Set to true if reqName and targetDir where not specified to make sure
     * required values are confirmed by the user
     * @type {boolean}
     */
    const targetDir = await client.getTargetDir("tests");

    const
        debug        = false,
        pkgManager   = "npm",
        installDest  = targetDir ? path.resolve(`${targetDir}`) : null;

    const autoBuild = await client.buildExtJs();

    debug && logger.warn`debug set to name=${"true"}`;

    const originDir = fileURLToPath(new URL("../", import.meta.url));
    const cwd = "./", rcwd = path.resolve(cwd);

    const recommendedVersions = {
        "siesta-lite": "5.5.2",
        "local-web-server": "^4.2.1",
        "@coon-js/siesta-lib-helper": "latest"
    };
    const requiredPckgs = [
        "local-web-server",
        "siesta-lite", "@coon-js/siesta-lib-helper",
        "@sencha/cmd", "@sencha/ext", "@sencha/ext-ux", "@sencha/ext-core",
        "@sencha/ext-classic", "@sencha/ext-modern",
        "@sencha/ext-classic-runtime", "@sencha/ext-modern-runtime"
    ];
    const disabled = [];
    const preSelection = requiredPckgs.filter(pckg => {
        if (!fs.pathExistsSync(`${rcwd}/node_modules/${pckg}`)) {
            return true;
        }
    });

    let pckgs = [], noSave, updatePackageJson = false, userPckgs = [];
    updatePackageJson = await client.updateEnvironment();
    if (preSelection.length !== 0 || options.force  === true) {
        userPckgs = await client.getPackageSelection(preSelection, requiredPckgs, disabled);
        pckgs     = userPckgs;
        noSave    = updatePackageJson ? "--save-dev" : "--no-save";
    }

    // +-------------------------------------------
    // | Select Packages and their versions
    // +-------------------------------------------
    let skipVersions = true;
    if (pckgs.length !== 0) {
        skipVersions = await client.useRecommendedVersions();
    }
    pckgs = pckgs.map((pckg, index) => {
        return async function () {
            logger.info`Fetching available versions of name=${pckg} ...`;
            let versions = shell.exec(`npm view ${pckg} versions`, {silent: true}), latest;
            versions = versions.split("',").map(v => l8.replace(["\n", "[", "'", "]"], "", v).trim());
            latest = versions[versions.length - 1];
            logger.info`Latest release of name=${pckg} is name=${latest}`;
            if (recommendedVersions[pckg]) {
                logger.info`Recommended version is name=${recommendedVersions[pckg]}`;
                latest = recommendedVersions[pckg];
            }

            if (skipVersions !== true) {
                latest = await client.getVersion(versions, pckg, recommendedVersions);
            }

            return [pckg, latest];
        };
    });

    const selection = [];
    for (const item of pckgs) {
        selection.push(await item());
    }


    // +-------------------------------------------
    // | Install all selected packages
    // +-------------------------------------------
    let groups = {_noscope: []};
    selection.forEach(([pckg, version]) => {
        let parts = pckg.split("/");
        if (parts.length > 1) {
            if (!groups[parts[0]]) {
                groups[parts[0]] = [];
            }
            groups[parts[0]].push(`${pckg}@${version}`);
        } else {
            groups._noscope.push(`${pckg}@${version}`);
        }
    });

    let moduleInstalls = Object.entries(groups).map(([group, pckgs]) => {
        return async function () {
            let modules = pckgs.join(" ");
            if (!modules) {
                return;
            }
            logger.info`Running code=${`${pkgManager} i ${noSave} ${modules}`}`;
            if (shell.exec(`${pkgManager} i ${noSave} ${modules}`, {
                env: {
                    ...process.env,
                    ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
                }
            }).code !== 0) {
                logger.error`Installation failed :(`;
                process.exit(1);
            }
        };
    });
    for (const installModule of moduleInstalls) {
        await installModule();
    }


    // +-------------------------------------------
    // | Build ExtJS
    // +-------------------------------------------
    if (autoBuild) {

        const cmds = [];

        // CLASSIC
        if (!fs.existsSync(rcwd + "/node_modules/@sencha/ext-classic")) {
            logger.error`path=${"node_modules/@sencha/ext-classic"} not found, skipping!`;
        } else {
            cmds.push(`cd ${rcwd}/node_modules/@sencha/ext-classic && npx @sencha/cmd config -prop framework.dir=${rcwd}/node_modules/@sencha ` +
            `-prop framework.packages.dir=${rcwd}/node_modules/@sencha -prop package.build.dir=${rcwd}/${autoBuild}/classic then ant js`);
        }

        // MODERN
        if (!fs.existsSync(rcwd + "/node_modules/@sencha/ext-modern")) {
            logger.error`path=${"node_modules/@sencha/ext-modern"} not found, skipping!`;
        } else {
            cmds.push(`cd ${rcwd}/node_modules/@sencha/ext-modern && npx @sencha/cmd config -prop framework.dir=${rcwd}/node_modules/@sencha ` +
                `-prop framework.packages.dir=${rcwd}/node_modules/@sencha -prop package.build.dir=${rcwd}/${autoBuild}/modern then ant js`);
        }

        // UX
        let hasExtUx = false;
        if (!fs.existsSync(rcwd + "/node_modules/@sencha/ext-ux")) {
            logger.error`path=${"node_modules/@sencha/ext-ux"} not found, skipping!`;
        } else {
            hasExtUx = true;
            fs.copySync(
                `${rcwd}/node_modules/@sencha/ext-ux/package.json`,
                `${rcwd}/node_modules/@sencha/ext-ux/package.json.org`
            );
            await util.fixExtUxPackageJson(`${rcwd}/node_modules/@sencha/ext-ux/package.json`);

            cmds.push(`cd ${rcwd}/node_modules/@sencha/ext-ux && npx @sencha/cmd config -prop framework.dir=${rcwd}/node_modules/@sencha ` +
                `-prop framework.packages.dir=${rcwd}/node_modules/@sencha -prop workspace.subpkg.prefix=${rcwd}/${autoBuild}/packages then package build`);
        }


        if (cmds.length) {
            if (fs.pathExistsSync(`${rcwd}/${autoBuild}`)) {
                logger.info`Removing path=${`${rcwd}/${autoBuild}`} ...`;
                fs.removeSync(`${rcwd}/${autoBuild}`);
            }

            cmds.forEach(cmd => {
                logger.info`Running code=${`${cmd}`}`;

                if (shell.exec(cmd, {
                    env: {
                        ...process.env,
                        ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
                    }
                }).code !== 0) {
                    logger.error`Installation failed :(`;
                    process.exit(1);
                }
            });

            if (hasExtUx) {
                fs.removeSync(`${rcwd}/node_modules/@sencha/ext-ux/package.json`);

                fs.moveSync(
                    `${rcwd}/node_modules/@sencha/ext-ux/package.json.org`,
                    `${rcwd}/node_modules/@sencha/ext-ux/package.json`
                );

                logger.info`Copying ext-ux...`;
                fs.copySync(
                    `${rcwd}/node_modules/@sencha/build/packages`,
                    `${rcwd}/${autoBuild}/packages`
                );
            }
        }
    }

    // +-------------------------------------------
    // | Copy themes
    // +-------------------------------------------
    if (autoBuild) {
        const
            sources = ["ext-classic-runtime", "ext-modern-runtime"],
            themes = [];

        logger.info`Copying themes...`;

        sources.forEach(source => {
            let themeSource = `${rcwd}/node_modules/@sencha/${source}`;
            if (!fs.existsSync(themeSource)) {
                logger.error`path=${`node_modules/@sencha/${source}`} not found, skipping!`;
            } else {
                themes.push(`${rcwd}/node_modules/@sencha/${source}`);
            }
        });

        themes.forEach(theme => {
            let dest = `${rcwd}/${autoBuild}/${theme.split("/").pop().split("-")[1]}/themes`;
            fs.copySync(theme, dest);
        });
    }


    // +-------------------------------------------
    // | Copy templates
    // +-------------------------------------------
    if (installDest) {
        if (await fs.pathExists(installDest)) {
            logger.info`path=${installDest} exists, removing...`;
            fs.removeSync(`${installDest}`);
        }

        logger.info`creating path=${installDest} and copying templates...`;

        const tplDir = `${originDir}/lib/templates/tests`;
        fs.copySync(`${tplDir}`, installDest);

        fs.copySync(`${tplDir}/../tests.redirect.html`, `${cwd}/tests.redirect.html`);

        await util.replaceInFile(
            `${installDest}/.extjs-build.conf.json`,
            "${autoBuild}",
            autoBuild ? autoBuild : ".extjs-build"
        );


    } else {
        logger.info`skipping default test-environment...`;
    }


    // +-------------------------------------------
    // | update .gitignore/.npmignore
    // +-------------------------------------------
    if (autoBuild) {
        const ignoreEntry = `${autoBuild}`;
        [`${rcwd}/.gitignore`, `${rcwd}/.npmignore`].forEach(ignoreFile => {
            if (!fs.existsSync(ignoreFile)) {
                fs.createFileSync(ignoreFile);
            }
            let contents = fs.readFileSync(ignoreFile, "UTF-8");
            contents = contents.split("\n").map(line => line.trim());
            if (!contents.includes(ignoreEntry)) {
                contents.push(ignoreEntry);
                contents = contents.join("\n");
                fs.outputFileSync(ignoreFile, contents);
            }
        });
    }

    // +-------------------------------------------
    // | add siesta test script to package.json
    // +-------------------------------------------
    const siestaCmd = "npm run test:siesta";
    const wsCmd     = "npx ws --port 8069 --static.index tests.redirect.html --open";

    if (updatePackageJson) {
        let scripts;

        if (fs.existsSync(`${rcwd}/package.json`)) {
            scripts = await util.getValueFromJsonFile(`${rcwd}/package.json`, "scripts");
        } else {
            fs.createFileSync(`${rcwd}/package.json`);
        }

        if (!scripts) {
            scripts = {};
        }

        if (!scripts["test:siesta"]) {
            scripts["test:siesta"] = wsCmd;
        }

        await util.updateJsonFile(`${rcwd}/package.json`, scripts, "scripts");
    }

    // +----------------------------------------
    // | Finish
    // +----------------------------------------
    /* eslint-disable */
    logger.success`
        ${targetDir ? `Created name=${`siesta`} environment in path=${targetDir}` : "Done"}.
        
        The following packages have been added to path=${"node_modules"}:
        ${userPckgs.length ? userPckgs.join(", "): " -none-"}
        
        Run
        code=${updatePackageJson ? siestaCmd : wsCmd}
        to start the testing environment in you webbrowser.
        
        Make sure to read the documentation at url=${`https://conjoon.org`}.
            
        Happy coding!
    `;
    /* eslint-enable */

    process.exit(0);
}
