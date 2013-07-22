Pallets = new Meteor.Collection("pallets");
StockData = new Meteor.Collection("stockdata");
LogBook = new Meteor.Collection("logbook");

var PALLET_MAX_VOLUME = 120*120*160;

var stockLevel = function (id, type) {
  Meteor.call('stockLevel', id, type, function(err, data) {
    if (err) {
      console.log(err);
    }
    
    console.log("Serverside stockLevel returned: " + data);

    Session.set('stockLevel', data);
  });

  returnValue = Session.get('stockLevel');

  return returnValue;
}

if (Meteor.isClient) {
  Session.setDefault("searchTerm", '');
  Session.setDefault("selected_action", 'none');
  Session.setDefault("selected_pallet", 0);
  Session.setDefault("moving", false);
  Session.setDefault("moveFrom", 'none');
  Session.setDefault("moveTo", 'none');
  Session.setDefault("log_hidden", true);
  Session.setDefault("bookout_hidden", true);
  Session.setDefault("current_bookout", 'none');

  Template.warehouse.shelves = function () {
    return [{shelfNum: 1, startShelf: 1, endShelf: 5},
            {shelfNum: 2, startShelf: 6, endShelf: 9},
            {shelfNum: 3, startShelf: 10, endShelf: 13},
            {shelfNum: 4, startShelf: 14, endShelf: 16}];
  }

  Template.shelf.loop = function (start, end) {
    var doc = new Array;
    if (end > start) {
      for (var i = start; i <= end; i++) {
        doc.push({i: i});
      }
    } else {
      for (var i = start; i <= end; i--) {
        doc.push({i: i});
      }
    }
    
    return doc;
  }

  Template.shelf.loopShelf = function () {
    var arr = new Array;
    console.log("Looping through bays "+this.startShelf+" to "+this.endShelf);
    for (var i = this.startShelf; i <= this.endShelf; i++) {
      arr.push({i: i});
    }

    return arr;
  }

  Template.shelf.pallets = function (level) {
    start = this.startShelf - 1;
    end = this.endShelf + 1;
    console.log("Finding: "+start+end+level)
    return Pallets.find({bay: {$gt: start, $lt: end},
                         level: level},
                   {sort: {bay: 1, subbay: 1}});
  }

  Template.shelf.events({
    'click input' : function () {
      console.log("Total db entries: "+Pallets.find({}).count());
      console.log("Search term: "+Session.get("searchTerm"));
      console.log(this);
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined') {
        console.log("You pressed the button");
      }
    }
  });

  Template.searchbar.events({
    'keyup input#searchbar' : function () {
      var searchTerm = $('#searchbar').val().toUpperCase().trim();
      Session.set("searchTerm", searchTerm);
    }
  });

  Template.pallet.stocks = function () {
    /*console.log("Pallet: " + this.bay +" "+ this.subbay +" "+ this.level);*/
    var curPallet = Pallets.findOne({bay: this.bay,
                                     subbay: this.subbay,
                                     level: this.level});
    return curPallet && curPallet.stock;
  }

  Template.pallet.boxes = function () {
    console.log(this.type);
    console.log(StockData.findOne({type: this.type}));
    var perbox = StockData.findOne({type: this.type}).perbox;
    console.log ("boxes: "+this.qty+"\/"+perbox);
    return (this.qty/perbox).toFixed(2);
  }

  Template.pallet.searched = function () {
    var searchTerm = Session.get("searchTerm");
    if (searchTerm !== '') {
      for (var i = 0; i < this.stock.length; i++) {
        var type = this.stock[i].type;
        if (type.indexOf(searchTerm) !== -1) {
          return "searched";
        }
      }
    }
    return '';
  }

  Template.pallet.selected = function () {
    return Session.equals("selected_pallet", this.pID) ? "selected" : '';
  }

  Template.pallet.height = function () {
    var pallet = Pallets.findOne({pID: this.pID});
    var totalVolume = 0;
    if (pallet.stock.length === 0) {
      return 0;
    } else {
      for (var i = 0; i < pallet.stock.length; i++) {
        var type = pallet.stock[i].type;
        var stock = StockData.findOne({type: type});
        var volume = stock.length * stock.width * stock.height;
        console.log("Add volume: "+volume+"*"+pallet.stock[i].qty);
        totalVolume += volume*pallet.stock[i].qty;
      }
      console.log("Volume: "+totalVolume);
      return totalVolume/PALLET_MAX_VOLUME*100;
    }
  }

  Template.pallet.moveFrom = function () {
    if (Session.equals("moving", true)) {
      return Session.equals("moveFrom", this.pID) ? "moveFrom" : '';
    } else {
      return '';
    }
  }
  Template.pallet.moveTo = function () {
    if (Session.equals("moving", true)) {
      return Session.equals("moveTo", this.pID) ? "moveTo" : '';
    } else {
      return '';
    }
  }
  Template.pallet.moving = function () {
    return Session.equals("moving", true) ? "moving" : '';
  }

  Template.pallet.events({
    'click': function () {
      var id = this.pID;
      if (id === undefined) {
        id = this.pallet;
      }
      if (Session.equals("moving", false)) {
        if (Session.equals("selected_pallet", id)) {
          //If it's already selected, select total stock
          Session.set("selected_pallet", 0);
          console.log("Total stock selected");
        } else {
          Session.set("selected_pallet", id);
          console.log("Selected: " + id);
        }
      } else {
        Session.set("moveTo", id);
      }
    },
    'mouseover': function () {
      if (Session.equals("moving", true)) {
        Session.set("moveHover", this.pID);
      }
    }
  });

  Template.menu.curSelected = function () {
    console.log("curSelected: "+Session.get("selected_pallet"));
    return Pallets.findOne({pID: Session.get("selected_pallet")});
  }

  Template.menu.totalStock = function () {
    console.log(Session.equals("selected_pallet", 0));
    return Session.equals("selected_pallet", 0) ? true : false;
  }

  Template.menu.stocks = function () {
    return Pallets.findOne({pID: this.pID}).stock;
  }

  Template.menu.stockTypes = function () {
    return StockData.find({}, {sort: {type: 1}});
  }

  Template.menu.selected = function (action) {
    return Session.equals("selected_action", this.pallet + this.type + action) ? "selected" : '';
  }

  Template.menu.hidden = function (action) {
    var id = this.pallet || this.pID;
    return Session.equals("selected_action", id + this.type + action) ? '' : "hidden";
  }

  Template.menu.moveDest = function () {
    return Session.get("moveTo");
  }

  Template.menu.destSet = function () {
    return Session.equals("moveTo", 'none') ? "disabled" : ''
  }

  Template.menu.events({
    'click .add' : function () {
      console.log(this.pallet + this.type);
      Session.set("moving", false);
      if (Session.equals("selected_action", this.pallet + this.type + "add")) {
        Session.set("selected_action", 'none');
      } else {
        Session.set("selected_action", this.pallet + this.type + "add");
      }
    },
    'click .updateAdd' : function () {
      var searchString = ".add-details input#qty"+this.type;
      var qty = $(searchString).val().trim();
      searchString = ".add-details input#comment"+this.type;
      var comment = $(searchString).val().trim();
      console.log("added"+qty);
      Meteor.call('addStock', this.pallet, this.type, +qty);
      Session.set("selected_action", 'none');

      LogBook.insert({action: 'Added',
                      qty: qty,
                      type: this.type,
                      pallet: this.pallet,
                      comment: comment});
    },

    'click .remove' : function () {
      console.log(this.pallet + this.type);
      Session.set("moving", false);
      if (Session.equals("selected_action", this.pallet + this.type + "remove")) {
        Session.set("selected_action", 'none');
      } else {
        Session.set("selected_action", this.pallet + this.type + "remove");
      }
    },
    'click .updateRemove' : function () {
      var searchString = ".remove-details input#qty"+this.type;
      var qty = $(searchString).val().trim();
      searchString = ".remove-details input#comment"+this.type;
      var comment = $(searchString).val().trim();
      console.log("removed"+qty);
      Meteor.call('removeStock', this.pallet, this.type, +qty);
      Session.set("selected_action", 'none');

      LogBook.insert({action: 'Removed',
                      qty: qty,
                      type: this.type,
                      pallet: this.pallet,
                      comment: comment});
    },

    'click .move' : function () {
      console.log(this.pallet + this.type);
      if (Session.equals("selected_action", this.pallet + this.type + "move")) {
        Session.set("selected_action", 'none');
        Session.set("moving", false);
        Session.set("moveFrom", 'none');
        Session.set("moveTo", 'none');
      } else {
        Session.set("selected_action", this.pallet + this.type + "move");
        Session.set("moving", true);
      }
    },
    'click .updateMove' : function () {
      var searchString = ".move-details input#qty"+this.type;
      var dest = Session.get("moveTo");
      var qty = $(searchString).val().trim();
      searchString = ".move-details input#comment"+this.type;
      var comment = $(searchString).val().trim();
      console.log("Moving "+qty+this.type+" to "+dest);
      Meteor.call('removeStock', this.pallet, this.type, +qty);
      Meteor.call('addStock', dest, this.type, +qty);
      Session.set("selected_action", 'none');
      Session.set("moving", false);
      Session.set("moveFrom", 'none');
      Session.set("moveTo", 'none');

      LogBook.insert({action: 'Moved',
                      qty: qty,
                      type: this.type,
                      palletFrom: this.pallet,
                      palletTo: dest,
                      comment: comment});
    },

    'click .add-new' : function () {
      console.log(this.pID + "add-new");
      Session.set("moving", false);
      if (Session.equals("selected_action", this.pallet + this.type + "add-new")) {
        Session.set("selected_action", 'none');
      } else {
        Session.set("selected_action", this.pallet + this.type + "add-new");
      }
    },
    'click .updateAddNew' : function () {
      var searchString = ".add-new-details input#qty-new";
      var type = $('select.add-new').val();
      var qty = $(searchString).val().trim();
      searchString = ".add-new-details input#comment-new";
      var comment = $(searchString).val().trim();
      //addStock(this.pID, type, +qty);
      Meteor.call('addStock', this.pID, type, +qty);
      Session.set("selected_action", 'none');

      LogBook.insert({action: 'Added',
                      qty: qty,
                      type: type,
                      pallet: this.pID,
                      comment: comment});
    }
  });

  Template.logbook.entries = function () {
    return LogBook.find();
  }

  Template.logbook.hidden = function () {
    return Session.equals("log_hidden", true) ? "hidden" : '';
  }

  Template.logbook.events({
    'click .logbar' : function () {
      if (Session.equals("log_hidden", true)) {
        console.log("Log is no longer hidden");
        Session.set("log_hidden", false);
      } else {
        console.log("Log is now hidden");
        Session.set("log_hidden", true);
      }
    }
  });

  Template.bookout.bookout_name = function () {
    var companyName = Session.get("current_bookout");
    if (companyName === '') {
      return "<empty name>";
    } else {
      return companyName;
    }
  }

  Template.bookout.hidden = function () {
    return Session.equals("bookout_hidden", true) ? "hidden" : '';
  }

  Template.bookout.no_current_bookout = function () {
    return Session.equals("current_bookout", 'none');
  }

  Template.bookout.events({
    'click .bookoutbar' : function () {
      if (Session.equals("bookout_hidden", true)) {
        console.log("Bookout is no longer hidden");
        Session.set("bookout_hidden", false);
      } else {
        console.log("Bookout is now hidden");
        Session.set("bookout_hidden", true);
      }
    },
    'click .newBookout' : function () {
      Session.set("current_bookout", '');
    },
    'keyup #bookoutCompany' : function () {
      var companyName = $('#bookoutCompany').val().trim();
      Session.set("current_bookout", companyName);
    },

    'click .confirmBookout' : function() {

    },
    'click .cancelBookout' : function() {
      $('#bookoutCompany').val('');
      Session.set("current_bookout", 'none');
      Session.set("bookout_hidden", true);
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    Meteor.methods({
      testAdd: function () {
        console.log("add pressed");
        //Pallets.update({pID: 7, 'stock.type': 'EM18LED'}, {$set: {'stock.$.qty': 3}}); 
        //Pallets.update({pID: 7}, {$push: {stock: {type: 'EMR15LED', qty: 13}}})
        //Pallets.update({pID: 7, 'stock.type': 'EM18LED'}, {$set: {'stock.$.pallet': 7}});
        //Pallets.update({pID: 7, 'stock.type': 'EM36LED-B'}, {$set: {'stock.$.pallet': 7}})
        //Pallets.update({pID: 7, 'stock.type': 'EMR15LED'}, {$set: {'stock.$.pallet': 7}})
      },
      changeStock: function (id, type, qty) {
        console.log("changeStock" + id + type + qty);
        Pallets.update({pID: id, 'stock.type': type}, {$inc: {'stock.$.qty': qty}});
      },
      newStock: function (id, type, qty) {
        console.log("newStock" + id + type + qty);
        Pallets.update({pID: id}, {$push: {stock: {pallet: id, type: type, qty: qty}}});
      },
      deleteStock: function (id, type) {
        console.log("removeStock" + id + type);
        Pallets.update({pID: id}, {$pull: {stock: {type: type}}});
      },
      stockLevel: function (id, type) {
        console.log("checking stock level");
        var pallet = Pallets.findOne({pID: id, 'stock.type': type});
        if (pallet != undefined) {
          for (var i = 0; i < pallet.stock.length; i++) {
            if (pallet.stock[i].type === type) {
              console.log(pallet.stock[i].qty);
              return pallet.stock[i].qty;
            }
          }
          console.log("logic or database buggered, nothing found");
        } else {
          console.log(-1);
          return -1;
        }
      },
      addStock: function (id, type, qty) {
        //if an entry for this stock type doesn't exist for this pallet
        console.log("Trying to add " + qty + " of " + type + " to " + id);
        if (Meteor.call('stockLevel', id, type) == -1) {
          console.log("Stock doesn't exist");
          Meteor.call('newStock', id, type, qty);
        } else {
          console.log("Stock exists, changing it");
          Meteor.call('changeStock', id, type, qty);
        }
        //Update total stock
        if (id !== 0) {
          console.log("Adding to total stock");
          Meteor.call('addStock', 0, type, qty);
        }
      },
      removeStock: function (id, type, qty) {
        console.log("Trying to remove " + qty + " of " + type + " to " + id);
        var curQty = Meteor.call('stockLevel',id, type);
        if (curQty > qty) {
          console.log("Enough to detract");
          Meteor.call('changeStock', id, type, -qty);
          //Update total stock
          if (id !== 0) {
            Meteor.call('removeStock', 0, type, qty);
          }
        } else if (curQty == qty) {
          console.log("Remove all");
          Meteor.call('deleteStock', id, type);
          //Update total stock
          if (id !== 0) {
            Meteor.call('removeStock', 0, type, qty);
          }
        } else {
          console.log ("trying to remove more stock than available");
        }
      }
    });
    if (Pallets.find().count() === 0) {
      for (var i = 1; i <= 128; i++) {
        var curBay = Math.floor ((i-1) / 8) + 1;
        var subBay = Math.floor ((i-1) / 4) % 2;
        var level = ((i-1) % 4) + 1;
        Pallets.insert({pID: i, bay: curBay, subbay: subBay, level: level, stock: []});
      }
      Pallets.insert({pID: 0, bay: 0, subbay: 0, level: 0, stock: []});
    }
    if (StockData.find().count() === 0) {
      StockData.insert({type: 'EM36LED-B', perbox: 6, length: 125, width: 16, height: 6});
      StockData.insert({type: 'EMR15LED', perbox: 6, length: 125, width: 16, height: 6});
      StockData.insert({type: 'EM18LED-B', perbox: 6, length: 125, width: 16, height: 6});
      StockData.insert({type: 'EM18LED', perbox: 6, length: 125, width: 16, height: 6});
    }
  });
}

