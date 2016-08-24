// used `exports` to call the global object, to be inline with CommonJS and the ES6 terminology
(function (exports) {
    
    // public API methods exported
    exports.avgColorForTile = avgColorForTile;
    exports.getSvgUrl = getSvgUrl;


    // private variables

    // this asset could be imported by a worker, 
    // this could be loaded into the browser as well (to be consumed by the view-model if the browser doesn't support web workers).
    // isWebWorker would be true if the executing context is a Worker
    var isWebWorker = exports.constructor.name === "DedicatedWorkerGlobalScope";


    // Helper methods

    /**
     * avgColorForTile
     * Gets the RGB average for a given tile.
     *
     * @name avgColorForTile
     * @function
     * @param {Array} tileImgData The tile data.
     * @returns {Object} An object containing the `r`, `g`, `b` properties, each represented in hex-code string with a max possible valur of 2^8-1.
     * 
     * Note:- This is purely functional as it doesn't alter state of any other objects in any scope.
     */
    function avgColorForTile(tileImgData) {
        var rgb = {
            r: 0,
            g: 0,
            b: 0
        };

        var pixelCount = 0;

        for (var i = 0; i < tileImgData.length; i += 4) {
            ++pixelCount;
            rgb.r += tileImgData[i];
            rgb.g += tileImgData[i + 1];
            rgb.b += tileImgData[i + 2];
        }
        
        rgb.r = (`00${(~~(rgb.r / pixelCount)).toString(16)}`).substr(-2);
        rgb.g = (`00${(~~(rgb.g / pixelCount)).toString(16)}`).substr(-2);
        rgb.b = (`00${(~~(rgb.b / pixelCount)).toString(16)}`).substr(-2);

        return rgb;
    }

    /**
     * getSvgUrl
     * Gets the svg url (for avg color tile) for a given tileData
     *
     * @name getSvgUrl
     * @function
     * @param {Array} tileImgData
     * @param {Number} x The X coordinate.
     * @param {Number} y The Y coordinate.
     * @returns {String} The SVG url.
     */
    function getSvgUrl(tileImgData, x, y) {

        // get average color for the tileData
        var rgb = avgColorForTile(tileImgData);

        if (isWebWorker) {
            postMessage({
                svgUrl: `/color/${rgb.r}${rgb.g}${rgb.b}`,
                x: x,
                y: y
            });
        } else {
            return `/color/${rgb.r}${rgb.g}${rgb.b}`;
        }
    }
})(this);   
// `this` when the execution context is a web-worker, would be the worker itself. 
// When it's loaded to the browser, `this` would be window