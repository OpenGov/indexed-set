//make some fake data
var Faker = require('faker2');
var data = [];
for(var lcv=0; lcv < 400; lcv++){
    var item = {};
    item['_id'] = '27g7fgv8'+Math.floor(Math.random()*100000)+'abc645';
    item['name'] = Faker.Name.findName();
    item['email'] = Faker.Internet.email();
    item['city'] = Faker.Address.city();
    item['state'] = Faker.Address.usState();
    data.push(item);
}

//stuff this array into a collection/set
var Indexed = require('./indexed-set').enableProxyWrapper();
var collection = new Indexed.Collection(data);
var theSet = new Indexed.Set(collection);

//let's find all members who's state is the same as the first member
theSet.with('state', '==', theSet[0].state);
console.log('ACK', theSet);