// ==================================
// KYC Part 1 - incoming messages, look for type
// ==================================
var ibc = {};
var chaincode = {};
var async = require('async');

module.exports.setup = function(sdk, cc){
	ibc = sdk;
	chaincode = cc;
};

module.exports.process_msg = function(ws, data){
	console.log('kyc part1 - process_msg');
	if(data.v === 1){																						//only look at messages for part 1
		if(data.type == 'create'){
			console.log('kyc - its a create!');
			if(data.name && data.telno && data.age && data.occupation){
				chaincode.invoke.newcustomer([data.name, data.telno, data.age, data.occupation], cb_invoked);	//create a new customer
			}
		}																					//only look at messages for part 1
		else if(data.type == 'createcustomer'){
			console.log('its a createcustomer!');
			if(data.name && data.telno && data.age && data.occupation){
				console.log('kyc - c cus invoke');
				chaincode.invoke.newcustomer([data.name, data.telno, data.age, data.occupation, data.cardid, data.creator], cb_invoked);	//create a new customer
			}
		}
        else if (data.type == 'createbroker'){
			console.log('its a createbroker!');
			if (data.name && data.brokeno){
				chaincode.invoke.newbroke([data.name, data.brokeno]);
			}
		}
		else if(data.type == 'get'){
			console.log('get customers msg');
			chaincode.query.read(['_customerindex'], cb_got_index);
		}
		else if(data.type == 'getbroker'){
			console.log('get broker msg');
			chaincode.query.read(['_brokerindex'], cb_got_broker_index);
		}
		else if(data.type == 'getcus'){
			console.log('get cus msg');
			chaincode.query.read([data.cusid], cb_got_cus);
		}
		else if(data.type == 'getcustomerofbroke'){
			console.log('get customer of broker msg');
			chaincode.query.readbroker([data.brokeno], cb_got_broker);
		}
        /*
		else if(data.type == 'transfer'){
			console.log('transfering msg');
			if(data.name && data.user){
				chaincode.invoke.set_user([data.name, data.user]);
			}
		}
		else if(data.type == 'remove'){
			console.log('removing msg');
			if(data.name){
				chaincode.invoke.delete([data.name]);
			}
		}
        */
		else if(data.type == 'chainstats'){
			console.log('chainstats msg');
			ibc.chain_stats(cb_chainstats);
		}
	}

	//got the customer index, lets get each customer
	function cb_got_index(e, index){
		console.log('index', index);
		if(e != null) console.log('[ws error] did not get customer index:', e);
		else{
			try{
				var json = JSON.parse(index);
				var keys = Object.keys(json);
				var concurrency = 1;

				//serialized version
				async.eachLimit(keys, concurrency, function(key, cb) {
					console.log('!', json[key]);
					chaincode.query.readcustomer([json[key]], function(e, customer) {
						if(e != null) console.log('[ws error] did not get customer:', e);
						else {
							console.log('read !!!! ', JSON.parse(customer));
							if(customer) sendMsg({msg: 'customer', e: e, customer: JSON.parse(customer)});
							cb(null);
						}
					});
				}, function() {
					sendMsg({msg: 'action', e: e, status: 'finished'});
				});
			}
			catch(e){
				console.log('[ws error] could not parse response', e);
			}
		}
	}

	function cb_got_broker(e, brokeinfo){
		if(e!=null) console.log('[ws error] did not get broke', e);
		else{
			try{
				console.log('cb got broker', brokeinfo);
				var broker = JSON.parse(brokeinfo);
				if (broker.allowcustomer){
					var keys = Object.keys(broker.allowcustomer);
					var concurrency = 1;

					async.eachLimit(keys, concurrency, function(key, cb) {
						console.log('!', broker.allowcustomer[key]);
						chaincode.query.readcustomergid([broker.allowcustomer[key]], function(e, customer) {
							if(e != null) console.log('[ws error] did not get customer:', e);
							else {
								console.log('read !!!! ', JSON.parse(customer));
								if (customer) sendMsg({msg: 'customerofbroke', e:e, customerofbroke: JSON.parse(customer)});
								cb(null);
							}
						});
					}, function() {
						sendMsg({msg: 'action', e:e, status: 'finished'});
					});
				}
			}
			catch(e){
				console.log('[ws error] could not parse response', e);
			}
		}
	}
	function cb_got_cus(e, customer){
		if(e!=null)console.log('[ws error] did not get customer:', e);
		else{
			try {
				console.log('customer', customer);
				var json = JSON.parse(customer);
				if (json.name){
					console.log('json.name', json.name);
					sendMsg({msg: 'cusname', e: e, cusname: json.name});
				}
				sendMsg({msg: 'action', e:e, status: 'finished'});
			}catch(e){
				console.log('[ws error] could not parse response', e);
			}
		}
	}

	function cb_got_broker_index(e, index){
		console.log('index', index);
		if(e != null) console.log('[ws error] did not get broker index:', e);
		else{
			try{
				var json = JSON.parse(index);
				var keys = Object.keys(json);
				var concurrency = 1;

				//serialized version
				async.eachLimit(keys, concurrency, function(key, cb) {
					console.log('!', json[key]);
					chaincode.query.readbroker([json[key]], function(e, broker) {
						if(e != null) console.log('[ws error] did not get customer:', e);
						else {
							console.log('read !!!! ', JSON.parse(broker));
							if(broker) sendMsg({msg: 'broker', e: e, broker: JSON.parse(broker)});
							cb(null);
						}
					});
				}, function() {
					sendMsg({msg: 'action', e: e, status: 'finished'});
				});
			}
			catch(e){
				console.log('[ws error] could not parse response', e);
			}
		}
	}
	
	function cb_invoked(e, a){
		console.log('response: ', e, a);
	}
	
	//call back for getting the blockchain stats, lets get the block stats now
	function cb_chainstats(e, chain_stats){
		if(chain_stats && chain_stats.height){
			chain_stats.height = chain_stats.height - 1;								//its 1 higher than actual height
			var list = [];
			for(var i = chain_stats.height; i >= 1; i--){								//create a list of heights we need
				list.push(i);
				if(list.length >= 8) break;
			}
			list.reverse();																//flip it so order is correct in UI
			async.eachLimit(list, 1, function(block_height, cb) {						//iter through each one, and send it
				ibc.block_stats(block_height, function(e, stats){
					if(e == null){
						stats.height = block_height;
						sendMsg({msg: 'chainstats', e: e, chainstats: chain_stats, blockstats: stats});
					}
					cb(null);
				});
			}, function() {
			});
		}
	}
	
	//send a message, socket might be closed...
	function sendMsg(json){
		if(ws){
			try{
				ws.send(JSON.stringify(json));
			}
			catch(e){
				console.log('[ws error] could not send msg', e);
			}
		}
	}
};