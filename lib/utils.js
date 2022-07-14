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

import fs from "fs-extra";
import l8 from "@l8js/l8";

/**
 * Utility function for file operations on configuration and package files.
 */

/**
 * Replaces all needles with values in the file found under dest.
 *
 * @param {String} dest
 * @param {String|Array} needle
 * @param {String} value
 */
export async function replaceInFile (dest, needle, value) {
    let txt = await fs.readFile(dest, "UTF-8");
    txt = l8.replace(needle, value, txt);
    await fs.outputFile(dest, txt);
}

/**
 * removes sass and adds build targets to ext-ux
 */
export async function fixExtUxPackageJson (path) {
    await updateJsonFile(path, [{
        "classic": {
            "toolkit": "classic"
        },
        "modern": {
            "toolkit": "modern"
        }

    }, null], ["sencha.builds", "sencha.sass"]);
}


/**
 * Updates the information in the json file found at dest, given obj and objPath.
 * 
 * @example 
 *     // file.json: {conjoon: {application: {}}} 
 *     updateJsonFile("file.json", "some value", "conjoon.application");
 *     // file.json: {conjoon: {application: "some value"}} 
 * 
 * @param {String} dest path to file destination
 * @param {*|Array<*>} obj value of arbitrary type used for the objPath
 * @param {String|Array<String>} objPath Array of object chains used with obj
 * 
 * @return {Promise<void>}
 */
export async function updateJsonFile (dest, obj, objPath) {

    let newPkg = await fs.readJSON(dest);
  
    if (objPath) {

        obj = [].concat(obj);

        [].concat(objPath).forEach((path, index) => {
            newPkg = l8.chain(path, newPkg, obj[index] !== undefined ? obj[index] : obj[0], true);
        });
    } else {
        newPkg = Object.assign(newPkg, obj);
    }

    await fs.outputFile(dest, `${JSON.stringify(newPkg, null, 4)}\n`);
}

/**
 * Returns the information from the json file for the specified
 * field in dot notation.
 * 
 * @example
 *    // file.json {conjoon:{application: "some value"}}
 *    getValueFromJsonFile("file.json", "conjoon.application"); // "some value"
 *    
 * @param dest
 * @param {String} path
 * @returns {Promise<*>}
 */
export async function getValueFromJsonFile (dest, path) {
    let pkg = {};
    try {
        pkg = (await fs.readJSON(dest));
    } catch (e) {
        // intentionally left empty
    }
    return l8.unchain(path, pkg);
}

