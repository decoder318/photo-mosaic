// import the helper methods that img-tools exports
importScripts("img-tools.js");

// message handler, to be used by the worker 
function messageHandler(e) {
    if (e.data && e.data.tileArr) {
        e.data.tileArr.forEach(tileData => {
            getSvgUrl(tileData.tileImgData, tileData.x, tileData.y);
        });         
    }
}

// `this` here would be the worker object that's using this resource
this.onmessage = messageHandler;