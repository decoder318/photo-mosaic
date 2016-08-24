// This exports the constructor for the Mozaic model
// Note:- It's a pure model as it just holds data, with no coupling with the view. 
//        This previously used to be a view-model, as it used to be coupled with the canvas dom element
// This is expected to be loaded in the browser as it has a dependency on the "document" object, to create a temporary canvas
(function() {

    "use strict";

    // Constants shared between client and server.
    var TILE_WIDTH = 16;
    var TILE_HEIGHT = 16;

    var isBrowser = (new Function("try {return this===window;}catch(e){ return false;}"))();

    if (!isBrowser) {
        // Export the resources needed by the server
        exports.TILE_WIDTH = TILE_WIDTH;
        exports.TILE_HEIGHT = TILE_HEIGHT;
        return;
    }
    
    // If exports is not an object (not Node.js), then we the `window`
    // object to export the public variables to the outside world (public api)
    if (typeof exports === "undefined" || !exports) {
        window.exports = window;
    }

    // Export the resources needed by the server
    exports.TILE_WIDTH = TILE_WIDTH;
    exports.TILE_HEIGHT = TILE_HEIGHT;

    // This will be used only on the client
    exports.Mosaic = Mosaic;

    /**
     * The Mosaic constructor. This is the model in the architecture.
     *
     * @constructor
     * @param {Image} img - The image object.
     * @param {Number} maxWidth - maximum width, to be considered while scaling down a large/wide image.
     */
    function Mosaic(img, maxWidth) {

        var $tempCanvas = document.createElement("canvas");
        var maxWidth = maxWidth || window.innerHeight - 32;

        // I now scale down the image, if it's too wide, and preserve the aspect ratio
        var imgWidth = img.width > maxWidth ? maxWidth : img.width;
        var imgHeight = img.height * imgWidth / img.width;

        this.width = $tempCanvas.width = imgWidth;
        this.height = $tempCanvas.height = imgHeight;

        this.tempContext = $tempCanvas.context || $tempCanvas.getContext('2d');
        this.tempContext.drawImage(img, 0, 0, this.width, this.height);

        this.maxX = Math.ceil(this.width / TILE_WIDTH) - 1;
        this.maxY = Math.ceil(this.height / TILE_HEIGHT) - 1;

        // holds tile-row-data, as they are processed
        this.processedData = {
            lastRenderedRow: -1,
            countY: 0
        };

        console.time("Render image");
    }

    // Mosaic should be an event emitter. Refer to the EventEmitter
    Mosaic.prototype = _extends(EventEmitter);


    /**
     * getTileDataAt
     * Gets the tile data at given tile-coordinates. (don't send pixel coordinates)
     *
     * @name getTileDataAt
     * @function
     * @param {Number} x The X coordinate of the tile
     * @param {Number} y The Y coordinate of the tile
     * @returns {Object} The tile data.
     */
    Mosaic.prototype.getTileDataAt = function(x, y) {

        if (x > this.maxX || y > this.maxY) {
            throw "no tile at that position";
        }

        var tileData;
        var tileWidth = (x == this.maxX ? ~~((x + 2) * TILE_WIDTH) - this.width : TILE_WIDTH);
        var tileHeight = (y == this.maxY ? ~~((y + 2) * TILE_HEIGHT) - this.height : TILE_HEIGHT);

        try {
            tileData = this.tempContext.getImageData(x * TILE_WIDTH, y * TILE_HEIGHT, tileWidth, tileHeight);
        } catch (err) {
            tileData = null;
            console.log(x, y, this.maxX, this.maxY, TILE_WIDTH, TILE_HEIGHT);
            console.log(tileWidth, tileHeight);
        } finally {
            return tileData;
        }
    };

    /**
     * paintMosaicImg
     * This starts paining the mosaic (defaults to using web workers, and
     * fallbacks to execute the code in the main window).
     *
     * @name paintMosaicImg
     * @function
     */
    Mosaic.prototype.processMosaicImg = function() {
        if (window.Worker && window.WORKER_COUNT > 0) {
            parallelExecMosaic.call(this);
        } else {
            simpleExecMosaic.call(this);
            // bruteForceMozaic.call(this);
        }
    };

    /**
     * renderNextAvailableRow
     * This triggers the progress for the next row to be rendered.
     * (The sequence in which rows of tiles are computed is not guaranteed to be from top to bottom. 
     *  This method ensures the next row to be rendered, has all rows that are on top of it rendered)
     * 
     * This also recursively calls itself later until all the subsequent processed rows are rendered
     *
     * @name renderNextAvailableRow
     * @function
     */
    Mosaic.prototype.renderNextAvailableRow = function() {
        var self = this;
        var pd = self.processedData;
        var rowToRenderIndex = pd.lastRenderedRow + 1;
        var nextRow = pd[rowToRenderIndex];

        if (nextRow && nextRow.loaded) {            
            self.emit("rowComputedProgress", [nextRow, Math.ceil(((pd.lastRenderedRow + 1) / (self.maxY + 1)) * 100)])
            nextRow.rendered = true;
            ++pd.lastRenderedRow;

            self.renderNextAvailableRow();
        }
    };
    

    /**
     * parallelExecMosaic
     * Expected to be called, with the Mosaic instance as the context (`this` needs to bound to the Mosaic instance).
     * This uses web workers.
     *
     * @name parallelExecMosaic
     * @function
     */
    function parallelExecMosaic() {
        var self = this;
        var rowsDone = 0;
        var WORKER_COUNT = window.WORKER_COUNT

        // divide tile-rows among all worker instances
        for (var i = 0; i < WORKER_COUNT; i++) {
            var worker = initWorker("/js/img-tools-worker.js");
            worker.mosaicInstance = self;

            // num of tile-rows for the current worker
            var rowsInIter = (i !== WORKER_COUNT - 1 ? Math.floor((self.maxY + 1) / WORKER_COUNT) :
                (Math.floor((self.maxY + 1) / WORKER_COUNT) + (self.maxY + 1) % WORKER_COUNT));

            // worker payload
            var tileTaskArr = [];

            // iterate through those tile-rows and construct the payload for the worker
            for (var q = rowsDone; q < rowsDone + rowsInIter; q++) {
                for (var p = 0; p <= self.maxX; p++) {

                    var tileImgData = self.getTileDataAt(p, q);
                    if (tileImgData) {
                        tileImgData = tileImgData.data;
                        tileTaskArr.push({
                            tileImgData: tileImgData,
                            x: p,
                            y: q
                        });
                    }
                }
            }

            // the cpu intensive process of computing avgTileColor will done inside a worker
            worker.postMessage({
                tileArr: tileTaskArr
            });
            // increment the num of rows sent away as payload.
            rowsDone += rowsInIter;
        }
    }


    /**
     * simpleExecMosaic
     * This calls manually the worker message handler, in case the workers are
     * not supported by the browser. This function doesn't use web workers.
     *
     * @name simpleExecMosaic
     * @function
     */
    function simpleExecMosaic() {
        var self = this;
        var rowsDone = 0;

        var handler = function(x, y) {
            var tileImgData = self.getTileDataAt(x, y);
            if (tileImgData) {

                tileImgData = tileImgData.data;
                
                // mocking worker-postMessage..
                messageHandler.call({
                    mosaicInstance: self
                }, {
                    data: {
                        svgUrl: getSvgUrl(tileImgData, x, y),
                        x: x,
                        y: y
                    }
                });
            }
        };

        for (var j = 0; j <= self.maxY; j++) {
            for (var i = 0; i <= self.maxX; i++) {
                handler(i, j);
            }
        }
    }


    /**
     * initWorker
     * This a helper method. It creates and returns a worker
     * Also, attaches handlers to the worker
     *
     * @name initWorker
     * @function
     * @param {String} src The web worker path.
     * @returns {Worker} The web worker object.
     */
    function initWorker(src) {
        var worker = new Worker(src);
        worker.onmessage = messageHandler;
        worker.onerror = errorHandler;
        return worker;
    }

    /**
     * messageHandler
     *
     * @name messageHandler
     * @function
     * @param {Event} evt An object containing the data object:
     *
     *  - `svgUrl` (String): The image url.
     *  - `x` (Number): The X coordinate.
     *  - `y` (Number): The Y coordinate.
     *
     */
    function messageHandler(evt) {

        // `this`: Worker instance
        var self = this.mosaicInstance;
        // current-row-index
        var cRowIndex = evt.data.y.toString();
        // current-row-data
        var cRow = self.processedData[cRowIndex];
        
        if (!cRow) {
            self.processedData[cRowIndex] = cRow = {};
            cRow.count = 0;

            // we store a tempCanvas for each row, to be used to rendered to the original canvas, once the row is processed
            cRow.tempCanvas = document.createElement("canvas");
            cRow.tempCanvas.width = self.width;
            cRow.tempCanvas.height = (evt.data.y == self.maxY ? ~~((evt.data.y + 2) * TILE_HEIGHT) - self.height : TILE_HEIGHT);
        }

        var tileImg = new Image();

        tileImg.onload = function() {
            // if (tileImg.calledOnLoad) {
            //     return;
            // }
            // tileImg.calledOnLoad = true;

            // clearTimeout(tileImg.timeout);

            // We keep drawing tiles as they are processed to the row's tempCanvas
            cRow.tempCanvas.getContext("2d").drawImage(tileImg, ~~(evt.data.x * TILE_WIDTH), 0);
            // increment the num of tiles rendered in the current row.
            cRow.count++;

            // checking if the full row is processed
            if (cRow.count === self.maxX + 1) {
                // we just store the pixel-position of the row w.r.t the original image
                cRow.y = ~~(evt.data.y * TILE_HEIGHT);
                cRow.loaded = true;

                // call the renderNextAvailableRow method, to ensure top-bottom render-sequence
                self.renderNextAvailableRow();

                // checking if all the rows are rendered
                if (++self.processedData.countY === self.maxY + 1) {

                    // emit the renderComplete event 
                    // note:- the events implemented here are synchronous and sequential, and not handled in the Event Loop unlike DOM events.
                    self.emit("renderComplete");
                    
                    console.timeEnd("Render image");
                    console.log("render Complete");
                }
            }
        };


        toDataUrl(evt.data.svgUrl, function(res) {
            tileImg.src = res;

            // In extemely rare (and hard to reproduce) cases, some tiles go missing, even though the row looks to be rendered.
            // In such cases, just forcefully invoke the tileImg.onload method
            // tileImg.timeout = setTimeout(function () {
            //     tileImg.onload();
            // }, 10000);
        });
    }

    /**
     * errorHandler
     * This will show the worker error.
     *
     * @name errorHandler
     * @function
     * @param {Event} evt The error event.
     */
    function errorHandler(evt) {
        console.error(evt);
    }

    /**
     * toDataUrl
     * This function fetches the base64 image form the server/localstorage.
     *
     * This function is heavily based on this: http://stackoverflow.com/a/20285053
     * The caching (on appDataStore) and the queueing the requests were added by me.     * 
     *
     * @name toDataUrl
     * @function
     * @param {String} url The image url to load.
     * @param {Function} done The callback function.
     */
    function toDataUrl(url, done) {

        // requests to convert to base64-data-url will be queued, when the limit is reached
        toDataUrl.queue = toDataUrl.queue || [];

        // This an object which will contain arrays of functions for each url
        toDataUrl.cbBuffer = toDataUrl.cbBuffer || {};

        // Upper limit of 8 images could be requested in parallel
        toDataUrl.limit = toDataUrl.limit || 8;

        // represents the number of parallel requests for svg tiles
        toDataUrl.count = toDataUrl.count || 0;

        // Check if the count reached the upper-limit
        // if the limit is reached push the invocation context to the queue and wait
        if (toDataUrl.count >= toDataUrl.limit) {
            toDataUrl.queue.push([url, done]);
            return;
        }

        // Increment the count (as the request would be processed further)
        ++toDataUrl.count;

        // The callback function is a wrapper around the done function (arg)
        // processes the queue and calls the original callback (done function)
        var callback = function(res) {
            // decrement the count, as the request has been processed
            --toDataUrl.count;

            if (toDataUrl.queue.length) {
                var first = toDataUrl.queue.shift();
                toDataUrl(first[0], first[1]);
            }

            done(res);
        };

        // Get the data from appDataStore
        var fromLocalstorage = appDataStore.getItem(url);

        // If found in appDataStore
        if (fromLocalstorage) {
            // ...send it in the callback
            return setTimeout(function() {
                callback(fromLocalstorage);
            }, 0);
        }

        // xhr are memoized, as we would like to buffer multiple parallel requests for the same resource.
        // if a xhr for a particular resource is in progress, any further xhr for the same resouce would be put in its respective buffer.
        // Create/get the current cb buffer (array), for the current xhr
        var cCbBuffer = toDataUrl.cbBuffer[url] || (toDataUrl.cbBuffer[url] = []);
        

        // If it's already loaded, we know the response
        if (cCbBuffer.loaded) {
            return callback(cCbBuffer.loaded);
        }

        
        /// Cache the current callback, for the xhr
        cCbBuffer.push(callback);
        if (cCbBuffer.length > 1) {
            return;
        }

        //console.info("GET " + url)
        // Make the request for the server resource
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'blob';
        xhr.onload = function() {

            // use this to store to encode the blob response as to base64-DataUrl
            var reader = new FileReader();

            reader.onloadend = function() {
                // set the item in appDataStore
                appDataStore.setItem(url, reader.result);

                // Call each function from the buffer
                cCbBuffer.forEach(function (cb) {
                    // Call the callback fn wrapper
                    cb(reader.result);
                });

                // Set the loaded property and empty the buffer
                toDataUrl.cbBuffer[url].loaded = reader.result;
                toDataUrl.cbBuffer[url].splice(0, toDataUrl.cbBuffer[url].length);
            };

            reader.readAsDataURL(xhr.response);
        };
        xhr.open('GET', url);
        xhr.send();
    }
})();