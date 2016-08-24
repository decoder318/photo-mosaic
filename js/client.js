// we can call this, the view-model/controller as this binds the view (dom) and the model (Mozaic instance)
(function () {

    "use strict";

    var $canvasElem, $timeInSecs, SCALE_DOWN_MAX_WIDTH = window.innerWidth - 32;

    /**
     * onload
     * The window load handler.
     *
     * @name onload
     * @function
     */
    window.onload = function window_onload () {
        // Handle the image loading
        var $fileInputEl = document.getElementById('fileInput');
        $fileInputEl.addEventListener('change', imageLoader, false);

        var $clearCacheBtn = document.getElementById("clearCacheBtn");
        $clearCacheBtn.addEventListener("click", function() {
            if (window.appDataStore) {
                window.appDataStore.clear();
                console.log("cleared local storage");
            }
        });

        $canvasElem = document.getElementById("imageCanvas");
        // Hide the canvas
        $canvasElem.style.display = "none";
        
        // Let the user select the workers to benchmark test-cases
        var $numWorkersSelect = document.getElementById("numWorkers");

        $numWorkersSelect.addEventListener("change", function () {
            window.WORKER_COUNT = parseInt(this.value, 10);
        });

        if (window.WORKER_COUNT == undefined) {
            window.WORKER_COUNT = 0;
        }

        // Load cache from localStorage to appDataStore. We'd want this to be non-blocking
        setTimeout(function() {
            if (window.localStorage && window.localStorage.length) {
                for(var i=0; i<window.localStorage.length; i++) {
                    var key = window.localStorage.key(i);
                    var val = window.localStorage.getItem(key);
                    window.appDataStore.setItem(key, val);
                }
            }
        }, 0);        

        $timeInSecs = document.getElementById("timeInSecs");
        $timeInSecs.style.display = "none";
    };    
    
    /**
     * onbeforeunload
     * The window before-unload handler.
     *
     * @name onload
     * @function
     */
    window.onbeforeunload = function window_onbeforeunload() {
        if(window.appDataStore && window.appDataStore.cache) {
            if(Object.keys(window.appDataStore.cache).length) {
                
                var storageOverflowException = {};

                try {
                    Object.keys(window.appDataStore.cache).forEach(key => {
                        window.localStorage.setItem(key, window.appDataStore.getItem(key));
                    });
                } catch(err) {
                    // assumed localStorage is full
                    throw storageOverflowException;
                } finally {
                    return;
                }
            }
        }
    };

    /**
     * imageLoader
     * Handles the image loading using HTML5.
     *
     * @name imageLoader
     * @function
     * @param {Event} evt The change event.
     */
    function imageLoader(evt) {

        // On cancel, do nothing
        if (!evt.target.files[0]) {
            evt.preventDefault();
            return;
        }

        // Start reading the image
        var reader = new FileReader();

        var $loadingElem = document.getElementById("loadingBar");
        var $progressElem = document.getElementById("progressBar");
        var context = $canvasElem.context || $canvasElem.getContext('2d');
        

        // Update the UI
        $loadingElem.style.display = "inline-block";
        $progressElem.style.display = "none";
        $timeInSecs.style.display = "none";

        // After the image is loaded...
        reader.onload = function(event) {
            var img = new Image();
            img.onload = function() {
                
                // initialze the canvas dom element
                
                // our mosaic model
                var mosaicMod = new Mosaic(img, SCALE_DOWN_MAX_WIDTH);
                
                $canvasElem.width = mosaicMod.width;
                $canvasElem.height = mosaicMod.height;
                $canvasElem.style.display = "block";

                // initialize progress in the UI
                $loadingElem.style.display = "none";
                $progressElem.style.display = "inline-block";
                $progressElem.value = 0;

                // subscribe to "rowComputedProgress" event of the Mozaic instance
                // once a row is processed, this event is triggered, and the args have data of the processed row, and the overall progress
                mosaicMod.addEventListener("rowComputedProgress", function(rowData, prog) {
                    context.drawImage(rowData.tempCanvas, 0, rowData.y);
                    $progressElem.value = prog;
                });


                // subscribe to the "renderComplete" event of the Mozaic instance
                mosaicMod.addEventListener("renderComplete", function() {
                    $progressElem.value = $progressElem.max;
                    $timeInSecs.innerText = `${((new Date() - startTime) / 1000).toString()} seconds`;
                    $timeInSecs.style.display = "inline";
                });

                // to measure the time to render the mosaic (excludes the selected image load time)
                var startTime = new Date();
                // invoke the processMosaicMethod
                mosaicMod.processMosaicImg();
            };
            // set the img src to the selected file
            img.src = reader.result;
        };

        // Do it in a non-blocking way.
        setTimeout(function() {
            reader.readAsDataURL(evt.target.files[0]);
        }, 0);
    }
})();
