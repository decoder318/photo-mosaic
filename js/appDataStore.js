// the cache module, which initializes window.appDataStore global, and exposes the getItem and setItem methods
(function(){
    
    if (!window.appDataStore) {
        window.appDataStore = {
            cache: {},
            
            getItem: function(key) {
                // if(this.cache[key]) {
                    return this.cache[key];
                // } else {                        
                //     return window.localStorage.getItem(key); 
                // }
            },

            setItem: function(key, val) {
                // if(this.length < 1e5) {
                this.cache[key] = val;
                
                // } else {
                //     try {
                //         window.localStorage.setItem(key, val);
                //     } catch(err) {
                //         window.localStorage.clear();
                //         this.length = 0;
                //         window.localStorage.setItem(key, val);
                //     }                        
                // }             
            },

            clear: function() {
                this.cache = {};
                // window.localStorage.clear();
            }
        };

        Object.defineProperty(appDataStore, "length", {
            get: function () {
                return Object.keys(this.cache).length;
            }
        });
    }
})();