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

/**
 * This script was inspired by the great work of the docusaurus-team over at facebook/meta!
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
export default async function init () {

    /**
     * Set to true if reqName and targetDir where not specified to make sure
     * required values are confirmed by the user
     * @type {boolean}
     */
    const targetDir = await client.getTargetDir("./tests");

    const
        isExternal   = true, // will always be used with npx create-siesta for now
        debug        = true,
        pkgManager   = "npm",
        installDest  = path.resolve(targetDir),
        cdpath       = path.relative(".", installDest);

    const
        skipVersions = await client.useRecommendedVersions(),
        noSave       = await client.updateEnvironment() ? "--save-dev" : "--no-save",
        autoBuild    = await client.buildExtJs();

    debug && logger.warn`debug set to name=${"true"}`;


    const recommendedVersions = {"siesta-lite": "5.5.2", "local-web-server": "^4.2.1"};

    let pckgs = await client.getPackageSelection([
        "siesta-lite", "@coon-js/siesta-lib-helper", "local-web-server"
    ], [
        "local-web-server",
        "siesta-lite", "@coon-js/siesta-lib-helper",
        "@sencha/ext", "@sencha/ext-ux", "@sencha/ext-core",
        "@sencha/ext-classic", "@sencha/ext-modern",
        "@sencha/ext-classic-runtime", "@sencha/ext-modern-runtime"

    ]);

    const originDir = fileURLToPath(new URL("../", import.meta.url));

    //if (debug === true) {
    let cwd = "./";
    //}
    const rcwd = path.resolve(cwd);


    // +-------------------------------------------
    // | Select Packages and their versions
    // +-------------------------------------------
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
            `-prop framework.packages.dir=${rcwd}/node_modules/@sencha -prop package.build.dir=${rcwd}/build/extjs-build/extjs/classic then ant js`);
        }

        // MODERN
        if (!fs.existsSync(rcwd + "/node_modules/@sencha/ext-modern")) {
            logger.error`path=${"node_modules/@sencha/ext-modern"} not found, skipping!`;
        } else {
            cmds.push(`cd ${rcwd}/node_modules/@sencha/ext-modern && npx @sencha/cmd config -prop framework.dir=${rcwd}/node_modules/@sencha ` +
                `-prop framework.packages.dir=${rcwd}/node_modules/@sencha -prop package.build.dir=${rcwd}/build/extjs-build/extjs/modern then ant js`);
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
                `-prop framework.packages.dir=${rcwd}/node_modules/@sencha -prop workspace.subpkg.prefix=${rcwd}/build/extjs-build/extjs/packages then package build`);
        }


        if (cmds.length) {
            logger.info`Removing path=${`${rcwd}/build/extjs-build`} ...`;
            fs.removeSync(rcwd + "/build/extjs-build");

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
                    `${rcwd}/build/extjs-build/extjs/packages`
                );
            }
        }
    }


    // +-------------------------------------------
    // | Copy themes
    // +-------------------------------------------
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
        let dest = `${rcwd}/build/extjs-build/extjs/${theme.split("/").pop().split("-")[1]}/themes`;
        fs.copySync(theme, dest);
    });


    // +-------------------------------------------
    // | Copy templates
    // +-------------------------------------------
    if (await fs.pathExists(installDest)) {
        logger.info`path=${installDest} exists, will overwrite configuration files...`;
    } else {
        logger.info`creating path=${installDest} and copying templates...`;
    }
    const tplDir = `${originDir}/lib/templates/tests`;
    fs.copySync(`${tplDir}`, installDest);

    fs.copySync(`${tplDir}/../tests.redirect.html`, `${cwd}/tests.redirect.html`);


    // +-------------------------------------------
    // | Create dist for siesta-lib-helper
    // +-------------------------------------------
    if (fs.existsSync(`${rcwd}/node_modules/@coon-js/siesta-lib-helper`)) {
        logger.info`building name=${"@coon-js/siesta-lib-helper"}...`;
        if (shell.exec(
            "npm explore @coon-js/siesta-lib-helper npm i --save-dev && " +
                "npm explore @coon-js/siesta-lib-helper npm run build", {
                env: {
                    ...process.env,
                    ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
                }
            }).code !== 0) {
            logger.error`Installation failed :(`;
            process.exit(1);
        }
    }

return;

    logger.info`Running code=${`${pkgManager} i --prefix ${cwd} @conjoon/conjoon@${version}`}`;
    if (shell.exec(`${pkgManager} i --prefix ${cwd} @conjoon/conjoon@${version}`, {
        env: {
            ...process.env,
            ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
        }
    }).code !== 0) {
        logger.error`Installing name=${"conjoon"} failed. We suggest you check for the correct version.`;
        logger.info`Removing path=${dest} ...`;
        fs.removeSync(dest);
        process.exit(1);
    }

    let source = `${cwd}/node_modules/@conjoon/conjoon`;

    if (!fs.existsSync(source)) {
        logger.error`Target directory path=${source} does not exists.`;
        logger.info`Removing path=${dest} and exiting...`;
        fs.removeSync(dest);
        process.exit(1);
    }

    version = await util.getValueFromJsonFile(`${source}/package.json`, "version");

    logger.info`Copying release name=${`v${version}`} to path=${dest}...`;

    fs.copySync(source, dest);
    shell.cd(dest);
    fs.moveSync(`${dest}/package.json`, `${dest}/package.json.tmp`);

    logger.info`Installing name=${"webpack"}...`;
    if (debug !== true && shell.exec(`${pkgManager} i --silent --prefix ${dest} webpack-dev-server@~3.8.0 webpack-cli@~3.3.6`, {
        env: {
            ...process.env,
            ...(supportsColor.stdout ? { FORCE_COLOR: "1" } : {})
        }
    }).code !== 0) {
        logger.error`Installing name=${"webpack"} failed, but base installation available at path=${cdpath}`;
        process.exit(0);
    }

    logger.info("Cleaning up...");
    fs.removeSync(`${dest}/package.json`);
    fs.moveSync(`${dest}/package.json.tmp`, `${dest}/package.json`);

    logger.info("Updating package information...");

    await util.updateApplicationConfigs(dest, {siteName, installType, urls});
    await util.updatePackageJson(`${dest}/package.json`, {siteName});

    /* eslint-disable */
    logger.success`
        Created name=${cdpath}.
        Inside that directory, you can run several commands:
    
        code=${`${pkgManager} start`}
        Starts the development server.
    
        code=${`${pkgManager} run build`}
        Bundles your name=${`conjoon`} installation into static files for production.
    
        We recommend that you begin by typing:
    
        code=${`cd ${cdpath}`}
        code=${`${pkgManager} run stage`}
    
        Make sure to read the documentation at url=${`https://conjoon.org`}.
            
        Happy coding!
    `;
    /* eslint-enable */

    process.exit(0);
}
