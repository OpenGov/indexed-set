var mongo = require('mongojs');

var MongoAdaptor = function(options){
    if(!options) options = {};
    if(typeof options === 'string') options = {database:options};
    if(!options.host) options.host = 'localhost';
    this.collections = {};
    this.options = options;
    this.connection = mongo.connect(this.options.host+"/"+this.options.database);
    //let's add a map reduce convenience method
    this.connection.mapReduce = function(collection, map, reduce, options, callback){
        //requiring actual functions here ensures parseability
        console.log(map, reduce);
        if(typeOf(map) != 'function' && typeOf(reduce) != 'function' ) throw('mapReduce requires functions');
        if(typeOf(options) == 'function' && !callback){
            callback = options;
            options = {};
        }
        var command = {
            mapreduce: collection,
            query: {},
            map: map.toString(),
            reduce: reduce.toString(),
            //sort: {url: 1}, //todo: hook me to sorting filter
            out: collection+'_queries'
        };
        connection.executeDbCommand(command, function(err, result) {
            if(result.documents[0] && result.documents[0].errmsg){
                var text = result.documents[0].errmsg;
                switch(result.documents[0].errmsg.toLowerCase()){
                    case "ns doesn\\'t exist":
                        text = 'Collection(\''+collection+'\') not found!';
                        break;
                }
                err = new Error('MongoDB [MR]:'+result.documents[0].errmsg);
                result.documents = [];
            }
            if(callback) callback(err, (result && result.documents));
        });
    }
};
MongoAdaptor.prototype = {
    get : function(collectionName, callback){
        if(!this.collections[collectionName]) this.collections[collectionName] = this.connection.collection(collectionName);
        this.collections[collectionName].find({}, function(error, data){
            if(!error) callback(data);
        }.bind(this));
    }
};
module.exports = MongoAdaptor;

