const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const portNum = 8089;
const https = require('https');
const fs = require('fs');
const url = require('url');
var dbSetup = require('./dbSetup.js');
var path = require('path');
var app = express();
var cart = [];

var key = fs.readFileSync(__dirname + '/selfsigned.key');
var cert = fs.readFileSync(__dirname + '/selfsigned.crt');
var options = {
  key: key,
  cert: cert
};

app.use(session({secret: 'mySecret',saveUninitialized: true,resave: true}));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static("public"));
app.use(bodyParser.urlencoded());

var server = https.createServer(options, app);

let db = new sqlite3.Database('./db/shopping.db');
// let db = new sqlite3.Database(':memory:');

function queryTable(pTable, pSessionId) {
	return new Promise(resolve => {
		pStatement = "SELECT * FROM " + pTable + " WHERE session_id = ?";
		console.log(pStatement);
		db.all(pStatement, [pSessionId], (err, rows) => {
		if (err) {
			reject ('Error while inserting data into table: ' + err);
		} else {
			resolve(rows);
		}
	  });
	});
  }

  function queryTableByColumns(pTable, pColumns, pOptions) {
	return new Promise(resolve => {
		pStatement = "SELECT * FROM " + pTable + " WHERE " + pColumns;
		console.log(pStatement);
		db.get(pStatement, pOptions, (err, row) => {
		if (err) {
			reject ('Error while inserting data into table: ' + err);
		} else {
			resolve(row);
		}
	  });
	});
  }

  function clearTable(pTable, pSessionId) {
	return new Promise(resolve => {
		pStatement = "DELETE FROM " + pTable + " WHERE session_id = ?";
		console.log(pStatement);
		db.run(pStatement, [pSessionId], (err) => {
		if (err) {
			console.log("Error while clearing shopping_cart: " + err);
			reject ('Error while inserting data into table: ' + err);
		} else {
			resolve('rows removed from table ' + pTable);
		}
	  });
	});
  }

  function removeFromTable(pTable, pColumn, pId, pSessionId) {
	return new Promise(resolve => {
		pStatement = "DELETE FROM " + pTable + " WHERE " + pColumn + " = ? AND session_id = ?";
		console.log(pStatement);
		db.run(pStatement, [pId, pSessionId], (err) => {
		if (err) {
			console.log("Error while clearing shopping_cart: " + err);
			reject ('Error while inserting data into table: ' + err);
		} else {
			resolve('rows removed from table ' + pTable);
		}
	  });
	});
  }

  function insertTable(pDB, pTable, pColumns, pOptions) {
	return new Promise(resolve => {
		pStatement = "INSERT INTO " + pTable + " " + pColumns;
		console.log(pStatement);
		pDB.run(pStatement, pOptions, function (err) {
			if (err) {
				console.log(err);
				reject ('Error while inserting data into table: ' + err);
			} else {
				var myLastID = this.lastID;
				console.log("Last ID: " + myLastID);
				resolve(myLastID);
			}
	  	});
	});
  }

function updateTableById(pTable, pColumns, pOptions, pId) {
	return new Promise(resolve => {
		pStatement = "UPDATE " + pTable + " SET " + pColumns + " WHERE customer_id = " + pId;
		console.log("updateTableById SQL: " + pStatement);
		db.run(pStatement, pOptions, function (err) {
			if (err) {
				console.log(err);
				reject ('Error while inserting data into table: ' + err);
			} else {
				resolve('Success');
			}
	  	});
	});
}

dbSetup.createDbTables(db);

app.get('/', (req, res) => {
	console.log("Current Session ID: " + req.sessionID);
	var sqlStmt = "SELECT * FROM items WHERE lower(item_name) like lower(?)";
	var searchItemString;
	if (req.query.searchItem && req.query.searchItem.length > 0) {
		console.log('Search item: ' + req.query.searchItem);
		searchItemString = '%' + req.query.searchItem + '%';
	} else {
		searchItemString = "%";
	}
	console.log("SQL : " + sqlStmt);
	var itemList = [];
	db.all(sqlStmt, [searchItemString], function(err, itemRows) {
		if (err) {
			console.log('Error while executing statement ' + sqlStmt);
			console.log('Error: ' + err);
			res.send('error.html');
		} else {
			itemRows.forEach(function(item) {
				itemRow = {"itemNr": item.item_id, "itemName": item.item_name, "itemPrice": item.item_price};
				itemList.push(itemRow);
			});
			console.log("loggedIn: " + req.session.loggedin);
			res.render('main', { items:itemList, isLoggedIn:req.session.loggedin});
		}
	});
});

app.get('/showCart', (req, res) => {
	var mySessionId = req.sessionID;
	var cartSQL = "SELECT * FROM shopping_cart WHERE session_id = ?";
	var myCart = [];
	var cartRow;
	db.all(cartSQL, [mySessionId], function(err, rows) {
		if (err) {
			console.log(err);
			res.redirect('/');
		} else {
			rows.forEach(function(item) {
				cartRow = {"itemId": item.item_id, "itemName": item.item_name, "itemPrice": item.item_price, "itemQuantity":item.item_quantity};
				myCart.push(cartRow);
			});
			res.render('showCart', { itemCount: myCart.length, cartItems: myCart, isLoggedIn:req.session.loggedin });
		}
	})
});

app.post('/removeFromCart', async (req, res) => {
	var removeItemId = req.body.prodNr;
	console.log("removeItemId: " + removeItemId);
	removeFromTable("shopping_cart", "item_id", removeItemId, req.sessionID);
	var myCart = await queryTable("shopping_cart", req.sessionID);
	var tmpCart = [];
	myCart.forEach(function(item) {
		cartRow = {"itemId": item.item_id, "itemName": item.item_name, "itemPrice": item.item_price, "itemQuantity":item.item_quantity};
		tmpCart.push(cartRow);	
	});

	cart = tmpCart; 
	res.render('showCart', { itemCount: cart.length, cartItems: cart, isLoggedIn:req.session.loggedin });
});

app.post('/add2cart', async (req, res) => {
	console.log('In add2cart');
	console.log(req.body);
	var bodyDoc = req.body;
	console.log(typeof(bodyDoc));
	var bodyJsonText = JSON.stringify(bodyDoc);
	console.log(typeof(bodyJsonText));
	console.log(bodyJsonText);
	var bodyJson = JSON.parse(bodyJsonText);
	console.log(typeof(bodyJson));
	var cartItemId;
	Object.keys(bodyJson).forEach(function(key) {
		if (key.indexOf("add2cart") >= 0) {
			cartItemId = key.substring(key.indexOf("_")+1, key.length);
			console.log("Cart Item Id from submit: " + cartItemId);
		}
	});
	var pOptions = [cartItemId];
	var itemData = await queryTableByColumns("items", "item_id = ?", pOptions)

	var mySessionId = req.sessionID;
	var cartItemQty = req.body.quantity;
	var cartItemName = itemData.item_name;
	var cartItemPrice = itemData.item_price;

	var insertStmt = "INSERT INTO shopping_cart(session_id, item_id, item_name, item_quantity, item_price) VALUES (?, ?, ?, ?, ?)";
	db.run(insertStmt, [mySessionId, cartItemId, cartItemName, cartItemQty, cartItemPrice], function(err) {
		if (err) {
			console.log(err);
		}
		res.redirect('/');
	});
});

app.get('/error', function(req, res) {
	var errorText = req.query.errorMessage;
	res.render('error', {errorMessage: errorText});
});

app.post('/placeOrder', async (req, res) => {
	console.log('in place order');
	var cFName = req.body.firstName;
	var cLName = req.body.lastName;
	var cStreet = req.body.adrStreet;
	var cZip = req.body.adrZip;
	var cCity = req.body.adrCity;
	var insOptions = [cFName, cLName, cStreet, cZip, cCity]
	// var customerId = await insertTable(db, "customers", "(first_name, last_name, street, zip_code, city) VALUES (?, ?, ?, ?, ?)", insOptions);
	// var customerData = await queryTable("customers", req.sessionID);
	var pOptions = [req.sessionID, cFName, cLName];
	var customerData = await queryTableByColumns("customers", "session_id = ? AND first_name = ? AND last_name = ?", pOptions);
	var customerId = customerData.customer_id;
	console.log("Last ID (Customer): " + customerId);
	if (isNaN(customerId)) {
		res.redirect(url.format({
			pathname:"/error",
			query: {
			   "errorMessage": customerId
			 }
		  }));
	}

	var orderDate = new Date().toISOString();
	insOptions = [customerId, orderDate];
	var orderId = await insertTable(db, "orders", "(customer_id, order_date) VALUES (?, ?)", insOptions);
	console.log("Last ID (order): " + orderId);
	if (isNaN(orderId)) {
		res.redirect(url.format({
			pathname:"/error",
			query: {
			   "errorMessage": orderId
			 }
		  }));
	}

	var myCart = await queryTable("shopping_cart", req.sessionID);
	var cartArr = [];
	myCart.forEach(function(item) {
		cartArr.push(orderId);
		cartArr.push(item.item_id);
		cartArr.push(item.item_quantity);
		cartArr.push(item.item_name);
		cartArr.push(item.item_price);
	});
	var placeHolders = myCart.map(() => "(?,?,?,?,?)").join(',');
	console.log(cartArr);
	insStr = "INSERT INTO order_items(order_id, item_id, item_quantity, item_name, item_price) values " + placeHolders;
	console.log(insStr);
	db.run(insStr, cartArr, function(err) {
		if(err) {
			console.log("Error while inserting order lines: " + err);
		}
	});
	var clearResult = await clearTable("shopping_cart", req.sessionID);
	res.redirect('/');	
});

app.get('/orderCart', async (req, res) => {
	console.log("req in orderCart, loggedin: " + req.session.loggedin + ", username: " + req.session.username);
	if (req.session.loggedin) {
		// console.log(req.session);
		var orderCart = await queryTable("shopping_cart", req.sessionID);
		console.log('# of items in orderCart: ' + orderCart.length);
		console.log(orderCart);
		var myCart = [];
		userRow = { userName: req.session.userName, firstName: req.session.firstName, lastName: req.session.lastName, street: req.session.street, zipCode: req.session.zipCode, city: req.session.city }
		console.log('userrow: ' + userRow.userName + ", " + userRow.lastName);
		orderCart.forEach(function(item) {
			var cartItem = { "itemId": item.item_id, "itemQuantity": item.item_quanitity, "itemName": item.item_name, "itemPrice": item.item_price}
			myCart.push(cartItem);
		});
		
		// res.render('orderCart', {cartItems: cart});
		res.render('orderCart', {cartItems: myCart, userData: userRow, isLoggedIn:req.session.loggedin});
	} else {
		res.render('login');
	}
});

app.post("/createNewCustomer", async function(req, res) {
	var newAccountName = req.body.accountName;
	var newFirstName = req.body.firstName;
	var newLastName = req.body.lastName;
	var newStreet = req.body.adrStreet;
	var newZipCode = req.body.adrZip;
	var newCity = req.body.adrCity;
	var newPassword = req.body.adrPassword;
	var currentSession = req.sessionID;
	pOptions = [newAccountName, newFirstName, newLastName, newStreet, newZipCode, newCity, newPassword];
	var result = await insertTable(db, "customers", "(customer_name, first_name, last_name, street, zip_code, city, currentSession) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", pOptions);
	if (!isNaN(result)) {
		req.session.loggedin = true;
		req.session.username = newAccountName;
		req.session.firstName = newFirstName;
		req.session.lastName = newLastName;
		req.session.street = newStreet;
		req.session.zipCode = newZipCode;
		req.session.city = newCity;		
		res.redirect('/');
	} else {
		res.render('error', {errorMessage: result});
	}
});

app.post('/auth', async function(req, res){
	var userName = req.body.username;
    var passwd = req.body.password;
	var loggedIn;
	console.log("Origin: " + req.get('origin'));
	console.log(req.originalUrl);
	console.log('Login attempt with user ' + userName + ', password: ' + passwd);

	var row = await queryTableByColumns("customers", "customer_name = ? AND password = ?", [userName, passwd]);
	if (row != undefined) {
		console.log(row);
		console.log('Found ID ' + row.customer_id);
		loggedIn = true;
		req.session.loggedin = true;
		req.session.username = row.customer_name;
		req.session.firstName = row.first_name;
		req.session.lastName = row.last_name;
		req.session.street = row.street;
		req.session.zipCode = row.zip_code;
		req.session.city = row.city;
		pOptions = [req.sessionID];
		var result = await updateTableById("customers", "session_id = ?", pOptions, row.customer_id);
		console.log("Result from update customers: " + result);
		console.log("req before redirect, loggedin: " + req.session.loggedin + ", username: " + req.session.username);
		var orderCart = await queryTable("shopping_cart", req.sessionID);
		if (orderCart.length > 0) {
			res.redirect('/orderCart');
		} else {
			res.redirect('/');
		}
	} else {
		loggedIn = false;
		res.redirect('/error');                
	}
});

app.get('/register', function(req, res) {
	res.render('createCustomer', {isLoggedIn:req.session.loggedin});
});

app.get('/login', function(req, res) {
	if (req.session.loggedin === true) {
		var customerData = { cUser: req.session.username, cFirst: req.session.firstName, cLast: req.session.lastName, cStreet: req.session.street, cZip: req.session.zipCode, cCity: req.session.city};
		res.render('editCustomer', {data: customerData});
	} else {
		res.render('login', {isLoggedIn:req.session.loggedin});
	}
});

/*
app.listen(portNum, () => {
	console.log('App running on port ' + portNum);
});
*/

server.listen(portNum, () => {
	console.log('App running on port ' + portNum);
});