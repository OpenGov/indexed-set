indexed-set.js
==============
A utility wrapper for set operations using arrays of objects. Work with sets as if they were simple arrays!

Each set has a chain of ancestry which, at it's root, is a collection. All values are held in the collections, while the sets themselves are simply orderings across subsets of ids

Instantiating
-------------

First, require the module:

    var Indexed = require('indexed-set');
    
Then create a collection:

    var collection = new Indexed.Collection(<array>, [<keyName>]);

where keyName defaults to Mongo's '_id' or

    var collection = new Indexed.Collection(<options>);
    
The available options are:
1. datasource : the mongo adapter
2. name : the name of the collection to load
3. onLoad : executed when the collection load is complete

then to create a set:

    new Indexed.Set(collection);
    
If I want to initialize the set from a mongo collection using the built-in mongo adapter it would look like this:

    var MongoAdapter = require('indexed-set/mongo');
    var collection = new Indexed.Collection({
        name : 'my_awesome_collection',
        datasource : new MongoAdapter(options.database);,
        onLoad: function(){
            var mySet = new Indexed.Set(collection);
            //do stuff here
        }
    });

Internal Data Access
--------------------
1. getByPosition(position) : retrieve the object by the position of the object within the set
2. getById(id) : retrieve the object by it's primary key within the set
3. setByIdFromString(id, idString) : substitue the object with id idString for the position of the passed id
4. setByPositionFromString(position, idString) : substitue the object with id idString for the passed position
5. setByIdFromObject(id, object) : substitue this object at the position of the object with the passed in id
6. setByPositionFromObject(position, object) : substitue this object at the position provided

additionally you are able to call:

    Indexed.enableProxyWrapper();
    
which wraps a proxy around the object so you can use an array-like syntax:

so given a set:

    var collection = new Indexed.Collection([
        {a:'a',b:'b',c:'c'},
        {a:'d',b:'e',c:'f'},
        {a:'r',b:'q',c:'f'}
    ], 'a');
    var mySet = new Indexed.Set(collection);
    
I could say:

    mySet['a']
    
which resolves to:

    {a:'a',b:'b',c:'c'}
    
as does

    mySet[0]
    
and, as another example:
    
    mySet['r']
    
is

    {a:'r',b:'q',c:'f'}
    
Meaning you can either use strings to address by primary key or integers to address by position. Proxies FTW.

Array Syntax
------------
The Set class implements a number of the standard array syntax, for familiarity
1. indexOf(object)
2. forEach(iteratorFunction)
3. push(object)
4. pop()

Set Functions
-------------
This is the meat of the library allowing you to manipulate and analyze datasets while still staying economical with memory and performance.
1. and(set) : the union of all objects in both sets
2. or(set) : all objects in either set
3. xor(set) : all objects contained in one set, but not both
4. not(set) : all objects not present in 'set'
5. filter(filterFunction) : a filter passed across the set to determine if a given element is selected or not
6. with(field, comparison, value) : a convenience method to generate a filter
7. byGroup(field) : segment along a given field and bin objects by the value on that field. returns an object of arrays
8. distinct([field]) : return all potential values for a given field, or if none is provided, provide all options for all fields, broken down by field.
9. clone() : make a copy of the set (this is a relatively cheap operation, in comparison to many clone() functions)
10. resume() : allow filters to execute as they are applied (started by default), also executes queued filters
11. pause() : queue applied filters instead of immediately executing them.
12. filterFunction() : return a function which is a composite of all filter functions on this set(can be passed to mongo as a selector function).

Testing
-------

Run the test harness at the project root with:

    mocha

Enjoy,

-Abbey Hawk Sparrow