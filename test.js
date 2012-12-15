var should = require("should");
var request = require("request");
var Indexed = require('./indexed-set').enableProxyWrapper();

describe('Indexed.Set', function(){
    var application;
    var running = false;
    var collection;
    var theSet;
    before(function(){
        var Faker = require('faker2');
        var data = [];
        for(var lcv=0; lcv < 4; lcv++){
            var item = {};
            item['_id'] = '27g7fgv8'+Math.floor(Math.random()*100000)+'abc645';
            item['name'] = Faker.Name.findName();
            item['email'] = Faker.Internet.email();
            item['city'] = Faker.Address.city();
            item['state'] = Faker.Address.usState();
            data.push(item);
        }
        collection = new Indexed.Collection(data);
        theSet = new Indexed.Set(collection);
    });
    
    it('generates test data', function(){
        theSet.length.should.not.equal(0);
    });
    
    it('reduces a set and all members are correct', function(){
        var subset = theSet.clone().with('state', '==', theSet[0].state);
        subset.length.should.not.equal(theSet.length);
        var found = false;
        subset.forEach(function(item){
            found = found || theSet[0].state != item.state;
        });
        found.should.equal(false);
    });
});