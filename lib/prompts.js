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

import logger from "@docusaurus/logger";
import prompts from "prompts";
import shell from "shelljs";
import fs from "fs-extra";
import path from "path";

/**
 * This file exports the prompts required for gathering installation info
 * for a conjoon-drop.
 */

const userCancelMessage = "User cancelled the setup process.";

/**
 * Will prompt for the version of the pckg to install.
 *
 * @params {Array} versions An array of all published version of pckg
 * so far.
 *
 * @return {String} version
 */
export async function getVersion (versions, pckg, recommended) {

    recommended = recommended || {};

    recommended[pckg] = recommended[pckg] || undefined;

    async function validateVersion (version) {
        if (!version) {
            return "A version is required.";
        }

        if (!versions.includes(version)) {
            return `${version} does not seem to be in the list of published versions`;
        }

        logger.info`Getting info for required version name=${`${pckg}@${version}`}...`;
        const exists = shell.exec(`npm view ${pckg}@${version}`);
        if (exists.code !== 0 || !exists.stdout) {
            return `Could not find version ${version} for ${pckg}!`;
        }
        return true;
    }

    const
        choices = versions.slice(Math.max(0, versions.length - 5)).map(v => ({title: v, value: v})).reverse().concat(
            {title: "<enter manually>", value: "manual"}
        ),
        initialIndex = choices.findIndex(item => item.value === recommended[pckg]);

    const { version } = await prompts([{
        type: "select",
        name: "version",
        message: "Which version should be used for this installation?",
        choices,
        initial: initialIndex > -1 ? initialIndex : 0,
        validate: validateVersion
    }, {
        type: prev => prev === "manual" ? "text" : null,
        name: "version",
        message: "Enter required Version",
        validate: validateVersion
    }], {
        onCancel () {
            logger.error`${userCancelMessage}`;
            process.exit(1);
        }
    });

    return version;
}


/**
 * Provides selection list to the client for selecting the packages that should be installed.
 *
 * @param selected
 * @param pckgs
 * @returns {Promise<void>}
 */
export async function getPackageSelection (selected, pckgs) {

    const { selection } = await prompts({
        type: "multiselect",
        name: "selection",
        message: "Please select the packages that should be downloaded, if required.\n Packages will be made available with your node_modules folder.",
        choices: pckgs.map(pckg => ({
            title: pckg, value: pckg, selected: selected.includes(pckg)
        }))
    }, {
        onCancel () {
            logger.error`${userCancelMessage}`;
            process.exit(1);
        }
    });

    return selection;

}


/**
 * Requests the target dir of the user, if reqDir contains an invalid value.
 *
 * @param {String} defaultTarget The default target if reqDir is not specified.
 *
 * @returns {Promise<void>}
 */
export async function getTargetDir (defaultTarget) {

    async function validateDir (dir) {
        if (!dir) {
            return "A target directory is required.";
        }

        return true;
    }


    const { targetDir } = await prompts({
        type: "text",
        name: "targetDir",
        message: "Please specify the target folder where your tests can be found",
        initial: defaultTarget,
        validate: validateDir
    }, {
        onCancel () {
            logger.error`${userCancelMessage}`;
            process.exit(1);
        }
    });


    const dest = path.resolve(targetDir);
    if (await fs.pathExists(dest)) {
        const { overwrite } = await prompts({
            type: "confirm",
            name: "overwrite",
            message: "The directory already exists. Okay to override existing files?",
            initial: true
        }, {
            onCancel () {
                logger.error`${userCancelMessage}`;
                process.exit(1);
            }
        });

        if (overwrite) {
            return targetDir;
        }

        logger.error("Target directory already existing.");
        process.exit(1);
    }


    return targetDir;

}


/**
 * Prompts if latest version should be used.
 *
 * @returns {Promise<*>}
 */
export async function useRecommendedVersions ()
{
    const { skipVersions } = await prompts({
        type: "confirm",
        name: "skipVersions",
        message: "Skip selection for all packages and use recommended version for each?",
        initial: true
    }, {
        onCancel () {
            logger.error`${userCancelMessage}`;
            process.exit(1);
        }
    });

    return skipVersions;

}


/**
 * Prompts if install should update package-json
 *
 * @returns {Promise<*>}
 */
export async function updateEnvironment ()
{
    const { update } = await prompts({
        type: "confirm",
        name: "update",
        message: "Do you want to update your package.json with the selected packages?",
        initial: true
    }, {
        onCancel () {
            logger.error`${userCancelMessage}`;
            process.exit(1);
        }
    });

    return update;

}


/**
 * Prompts if install should build Ext JS
 *
 * @returns {Promise<*>}
 */
export async function buildExtJs ()
{
    const { update } = await prompts({
        type: "confirm",
        name: "update",
        message: "Should this tool attempt to build Ext JS? SDK sources must be available with node_modules/@sencha!",
        initial: true
    }, {
        onCancel () {
            logger.error`${userCancelMessage}`;
            process.exit(1);
        }
    });

    return update;

}