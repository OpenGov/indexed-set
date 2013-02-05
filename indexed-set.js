var type = require('prime/util/type');
var array = require('prime/es5/array');
var fn = require('prime/es5/function');
var IndexedSet = {};
var SetForwardingHandler;
IndexedSet.enableProxyWrapper = function(){
    var Proxy = require('node-proxy');
    // Proxies allow us to piggyback on javascript's array syntax
    SetForwardingHandler = function(obj) {
        this.target = obj;
    }
    SetForwardingHandler.prototype = {
        has: function(name){ return name in this.target; },
        get: function(rcvr, name){
            if( ((name || name === 0) && typeof name  == 'number') ){  //isNum?
                return this.target.getByPosition(name);
            }
            if(typeof name === 'string' && name.match(/^[A-Fa-f0-9]*$/)){ //isHex?
                return this.target.getById(name);
            }
            return this.target[name];
        },
        set: function(rcvr, name, val){
            if( ((name || name === 0) && typeof name  == 'number') ){  //isNum?
                if(typeof value  == 'string'){
                    return this.target.setByPositionFromString(name, val);
                }else{
                    return this.target.setByPositionFromObject(name, val);
                }
            }
            if(typeof name === 'string' && name.match(/^[A-Fa-f0-9]*$/)){ //isHex?
                if(typeof value  == 'string'){
                    return this.target.setByIdFromString(name, val);
                }else{
                    return this.target.setByIdFromObject(name, val);
                }
            }
            if(name == 'length') return this.ordering.length;
            this.target[name] = val;
            return true;
        },
        'delete': function(name){ return delete this.target[name]; },
        enumerate: function(){
        var res = [];
        for(var key in this.target.ordering) res.push(key);
            return res;
        },
        iterate: function() {
            var props = this.enumerate(), i = 0;
            return {
                next: function() {
                    if (i === props.length) throw StopIteration;
                    return props[i++];
                }
            };
        },
        keys: function() { return Object.keys(this.target); },
    };
    SetForwardingHandler.wrap = function(obj) {
        return Proxy.create(new SetForwardingHandler(obj), Object.getPrototypeOf(obj));
    };
    IndexedSet.proxied = true;
    return IndexedSet;
};
IndexedSet.Set = function(parent, options){
    if(parent && parent.index) this.index = parent.index;
    else this.index = {};
    if(parent && parent.ordering) this.ordering = parent.ordering.slice(0);
    else this.ordering = [];
    this.parent = parent;
    this.primaryKey = '_id';
    this.filters = [];
    this.buffer = false;
    // 'data' can flush a selection (assuming it's not asynchronously connected)
    Object.defineProperty(this, 'data', {
        get : fn.bind(function(){
            //console.log('ttt', this.index);
            if(!this.buffer){
                this.buffer = [];
                this.ordering.forEach(fn.bind(function(id){
                    //console.log('psh', this.index[id], id, Object.keys(this.index).indexOf(id), Object.keys(this.index));
                    this.buffer.push(this.index[id]);
                }, this));
            }
            return this.buffer;
        }, this),
        set : fn.bind(function(value){
            throw('I pity the fool!')
        }, this)
    });
    Object.defineProperty(this, 'length', {
        get : fn.bind(function(){
            return this.ordering.length;
        }, this),
        set : fn.bind(function(value){
            throw('Cannot set length property of a Set');
        }, this)
    });
    
    if(IndexedSet.proxied) return SetForwardingHandler.wrap(this);
    else return this;
};
IndexedSet.arrayContains = function(array, item){
    for(index in array){
        if(array[index] === item) return true;
    }
    return false;
};
IndexedSet.Set.prototype = {
    push : function(value){
        this.buffer = false;
        if(typeof value === 'string'){
            if(!this.index[value]) throw('object has no '+this.primaryKey+'(\''+value+'\')');
            this.ordering.push(value);
        }else{
            if(!value[this.primaryKey]) throw('object has no '+this.primaryKey);
            else{
                if(!this.index[value[this.primaryKey]]) this.index[value[this.primaryKey]] = value;
                this.ordering.push(value[this.primaryKey]);
            }
        }
    },
    pop : function(){
        this.buffer = false;
        var id = this.ordering.pop();
        if(this.index[id]) return this.index[id];
    },
    shift : function(){
        this.buffer = false;
        var id = this.ordering.shift();
        if(this.index[id]) return this.index[id];
    },
    pause : function(){
        this.paused = true;
    },
    slice : function(start, stop){
        var ob = this.clone();
        ob.ordering = ob.ordering.slice(start, stop);
        return ob;
    },
    resume : function(){
        delete this.paused;
        if(this.blockedFilter){
            this._filterData();
            delete this.blockedFilter;
        }
    },
    _filterData : function(){
        var func = this.filterFunction();
        var results = [];
        try{
            //var before = this.ordering.length;
            //var beforek = Object.keys(this.index).length;
            this.forEach(fn.bind(function(item, id){
                //console.log('PK', this.primaryKey, item[this.primaryKey]);
                
                if((fn.bind(func, item))()) results.push(item[this.primaryKey]);
            }, this));
            this.ordering = results;
        }catch(ex){
            console.log('EEEERRRR', ex, fn.toString());
        }
    },
    forEach : function(func){
        this.ordering.forEach(fn.bind(function(id, index){
            (fn.bind(func, this.index[id]))(this.index[id], index);
        }, this));
    },
    distinct : function(field){ //distinct(field) distinct() [object], or distinct(true) [object, strings only]
        var stringsMode = false;
        if(field === true){
            field = false;
            stringsMode = true;
        }
        var values = {};
        var fields = [];
        this.ordering.forEach(function(id, index){
            if(field){
                if(!values['*']) values['*'] = [];
                if(values['*'].indexOf(this[id][field]) === -1) values['*'].push(this[id][field]);
            }else{
                var keys = Object.keys(this[id]);
                keys.each(function(key){
                    var val = this[id][key];
                    if(fields.indexOf(key) === -1) fields.push(key);
                    if(!values[key]) values[key] = [];
                    if(values[key].indexOf(val) === -1 && ( (!stringsMode) || typeOf(val) == 'string') ) values[key].push(val);
                }.bind(this));
            }
        }.bind(this));
        if(field) return values['*'];
        else return values;
    },
    byGroup : function(fieldName){
        results = {};
        //console.log(this[0], this[0][fieldName]);
        //return;
        var segment;
        this.forEach(function(item){
            segment = item[fieldName];
            if(!results[segment]) results[segment] = new Hades.Set(item.parent);
            results[segment].filters = item.filters;
            results[segment].push(item);
        }.bind(this));
        return results;
    },
    clone : function(){
        var ob = new IndexedSet.Set(this.parent);
        ob.index = this.index;
        if(this.filters) ob.filters = this.filters.slice(0);
        else ob.filters = [];
        ob.ordering = this.ordering.slice(0);
        return ob;
    },
    //todo: both 'filter' and 'with' need some kind of callback or ready queue
    filter : function(fn, doFilter){
        if(!fn && !doFilter){
            this._filterData();
            return;
        }
        this.filters.push(fn);
        if(doFilter !== false && !this.paused) this._filterData(); //todo: apply *only* the current filter
        else if(this.paused) this.blockedFilter = true;
        return this;
    },
    'with' : function(field, comparison, value){
        /*if( (!comparison) && (!value) ){
            return this.filter(new Function('return !!this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'];'));
        } //*/
        if(comparison && !value){
            value = comparison;
            comparison = '==='
        }
        var fn;
        try{
            //var extra = 'console.log(\'COMP\', this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'], \''+comparison+'\', \''+value+'\', \''+field.replace('\'', '\\\'')+'\', \''+field+'\');';
            //todo: fix the ugliness
            var body;
            switch(typeof value){
                case 'string':
                    body = 'return this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'] '+comparison+' \''+value.replace('\\', '\\\\').replace('\'', '\\\'')+'\';'
                    fn = new Function(body);
                    break;
                case 'array':
                    if(value.length == 0) throw('no fields error!');
                    body = 'return this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'] '+comparison+' \''+value.join(' || \'+this.\'+field+\' \'+comparison+\' \\\'')+'\';'; //todo: array_map escaping
                    break;
                case 'undefined':
                    body = 'return !!this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'];';
                    break;
                default : body = 'return this[\''+field.replace('\\', '\\\\').replace('\'', '\\\'')+'\'] '+comparison+' '+value+';';
            }
            fn = new Function(body);
        }catch(ex){
                console.log('ERROR IN GENERATED SELECTOR', body) ;
                throw ex;
        }
        return this.filter(fn);
    },
    indexOf : function(item){
        var itemType = typeof item;
        for( index in this.ordering ){
            if(item.hasOwnProperty(index)) continue;
            switch(itemType){
                case 'string':
                    if(this.ordering[index][this.primaryKey] == item) return index;
                    break;
                default :
                    if(this.ordering[index][this.primaryKey] == item[this.primaryKey]) return index;
                    
            }
        }
        return -1;
    },
    and : function(set){
        var results = [];
        set.forEach(function(item){
            if(this.indexOf(item) !== -1) results.push(item);
        }.bind(this));
        this.ordering = results;
    },
    or : function(set){
        var results = [];
        set.forEach(function(item){
            if(!IndexedSet.arrayContains(results, item)) results.push(item);
        }.bind(this));
        this.ordering = results;
    },
    xor : function(set){
        var results = [];
        set.forEach(function(item){
            if(!this.indexOf(item) !== -1) results.push(item);
        }.bind(this));
        this.forEach(function(item){
            if(!set.indexOf(item) !== -1) results.push(item);
        }.bind(this));
        this.ordering = results;
    },
    not : function(set){
        var results = [];
        set.forEach(function(item){
            if(!this.indexOf(item) !== -1) results.push(item);
        }.bind(this));
        this.ordering = results;
    },
    removeFilter : function(filter, callback){
        this.buffer = false;
        this.filters.erase(filter);
        //this.fireEvent('change');
    },
    filterFunction : function(){
        var filters = [true];
        this.filters.forEach(function(filter){
            filters.push('('+filter.toString()+').apply(this)');
        });
        var fun = new Function('return '+filters.join(' && ')+';');
        return fun;
    },
    getByPosition : function(position){
        if(!this.ordering[position]) return undefined;
        return this.index[this.ordering[position]];
    },
    getById : function(id){
        if(!id in this.ordering) return undefined;
        return this.index[id];
    },
    setByIdFromString : function(id, value){
        if(id !== value) throw('id value mismatch('+id+' != '+value+')');
        if(!this.index[value]) throw('this '+this.primaryKey+'('+value+') not found!');
        if(this.indexOf(value) === -1){
            this.push(value);
        }// else the set already contains this value
    },
    setByPositionFromString : function(position, value){
        if(!this.index[value]) throw('this '+this.primaryKey+'('+value+') not found!');
        this.ordering[position] = value;
    },
    setByIdFromObject : function(id, value){
        if(id !== value[this.primaryKey]) throw('id value mismatch('+id+' != '+value[this.primaryKey]+')');
        if(!this.index[id]) this.index[id] = value;
        if(this.indexOf(value[this.primaryKey]) === -1){
            this.push(value[this.primaryKey]);
        }
        this.ordering[id] = this.index[value[this.primaryKey]];
    },
    setByPositionFromObject : function(position, value){
        if(!this.index[value[this.primaryKey]]) this.index[value[this.primaryKey]] = value;
        this.ordering[position] = value[this.primaryKey];
    },
};
IndexedSet.Collection = function(options, key){
    this.primaryKey = options.primaryKey || key || '_id';
    //this.primaryKey = '_id';
    if(typeof options === 'string') options = {name:options};
    if(type(options) === 'array') options = {index:options};
    this.index = {};
    if(options.index){
        array.forEach(options.index, fn.bind(function(item){
            this.index[item[this.primaryKey]] = item;
        }, this));
    }
    this.events = {};
    this.options = options;
    if(options && options.datasource){
        this.attachDatasource(options.datasource);
        this.load(options.onLoad.bind(this));
    }
    Object.defineProperty(this, 'ordering', {
        get : function(){
            var results = [];
            for(var id in this.index) results.push(id); //todo: honor segment
            return results;
        }.bind(this),
        set : function(value){
            throw('Collections do not support manual alterations of \'ordering\'!')
        }.bind(this)
    });
    //series code is currently naive and inefficient
    this.setSeries = function(fieldname, start, stop){
        //todo: implement
        this.raw = this.index;
        this.series = this.groupBy(fieldname);
    };
    this.autoRange = function(fieldname){
        var options = this.index.distinct(fieldname);
        var min = Number.MAX_VALUE;
        var max = Number.MIN_VALUE;
        options.each(function(value){
            if(min > value) min = value;
            if(max < value) max = value;
        });
        this.setSeriesRange(min, max);
    };
    this.setSeriesRange = function(start, stop){
        var current = new IndexedSet.Set(this); 
        this.series.each(function(set, index){
            if(index > start && index > stop) current = current.and(set);
        });
        this.index = current;
        this.fireEvent('alter');
    };
    this.fireEvent = function(type, options){
        this.events[type].each(function(handler){
            handler(options);
        });
    };
    this.addEvent = function(type, handler){
        if(!this.events[type]) this.events[type] = [];
        this.events[type].push(handler);
    };
};
IndexedSet.Collection.prototype = {
    attachDatasource : function(datasource){
        this.datasource = datasource;
    },
    load : function(callback){
        this.datasource.get(this.options.name, function(data){
            this.index = {};
            data.forEach(function(item){
                this.index[item[this.primaryKey]] = item;
            }.bind(this));
            callback();
        }.bind(this));
    }
};
module.exports = IndexedSet;

