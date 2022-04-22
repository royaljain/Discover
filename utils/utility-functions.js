function recursiveSearch(obj, key) {

    for(prop in obj) {
       if(typeof(obj[prop]) === "object"){
        const search = recursiveSearch(obj[prop], key);
        if(search){
            return search;
        }
     } else {
         if(prop == key) {
             return obj[prop];
       }
     }
   }

   return false;
}

module.exports.recursiveSearch = recursiveSearch