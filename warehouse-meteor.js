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
  Session.setDefault("displaySize", 'small');
  Session.setDefault("backupDataPallet", '');
  Session.setDefault("backupDataStock", '');

  Handlebars.registerHelper('hSmall', function () {
    return Session.equals("displaySize", 'small') ? "small" : ''
  });

  Template.warehouse.shelves = function () {
    return [{shelfNum: 1, startShelf: 1, endShelf: 5, posFloat: 'left'},
            {shelfNum: 2, startShelf: 6, endShelf: 9, posFloat: 'right'},
            {shelfNum: 3, startShelf: 10, endShelf: 13, posFloat: 'left'},
            {shelfNum: 4, startShelf: 14, endShelf: 16, posFloat: 'right'}];
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
    for (var i = this.startShelf; i <= this.endShelf; i++) {
      arr.push({i: i});
    }

    return arr;
  }

  Template.shelf.pallets = function (level) {
    start = this.startShelf - 1;
    end = this.endShelf + 1;
    return Pallets.find({bay: {$gt: start, $lt: end},
                         level: level},
                   {sort: {bay: 1, subbay: 1}});
  }

  Template.shelf.events({
    'click input' : function () {
      console.log("Total db entries: "+Pallets.find({}).count());
      console.log("Search term: "+Session.get("searchTerm"));
      console.log(this);
      if (Session.equals("displaySize", 'large')) {
        Session.set("displaySize", 'small');
        console.log("Display is now small");
      }
      else {
        Session.set("displaySize", 'large');
        console.log("Displa is now large");
      }
      
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
    //console.log(this.type);
    //console.log(StockData.findOne({type: this.type}));
    var perbox = StockData.findOne({type: this.type}).perbox;
    //console.log ("boxes: "+this.qty+"\/"+perbox);
    return (this.qty/perbox).toFixed(2);
  }

  Template.pallet.size = function () {
    var width = $(window).width();

    if (Session.equals("displaySize", 'large')) {
      return width*8/120+'px';
    } else {
      return width*8/240+'px';
    }
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
        var volume = stock.uLength * stock.uWidth * stock.uHeight;
        //console.log("Add volume: "+volume+"*"+pallet.stock[i].qty);
        totalVolume += volume*pallet.stock[i].qty;
      }
      //console.log("Volume: "+totalVolume);
      return Math.min(100, totalVolume/PALLET_MAX_VOLUME*100);
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

  Template.menu.backupLinkStock = function () {
    var backupData = Session.get("backupDataStock");
    if (backupData === '' || Session.equals("timerCountStock", 0)) {
      return;
    }

    var url = "data:application/octet-stream," + encodeURIComponent(backupData);

    return "<a href=\""+url+"\">Download Backup File</a>   "+Session.get("timerCountStock")+"<br>(Right click and save link as a name of your choice)";
  }

  Template.menu.backupLinkPallet = function () {
    var backupData = Session.get("backupDataPallet");
    if (backupData === '' || Session.equals("timerCountPallet", 0)) {
      return;
    }

    var url = "data:application/octet-stream," + encodeURIComponent(backupData);

    return "<a href=\""+url+"\">Download Backup File</a>   "+Session.get("timerCountPallet")+"<br>(Right click and save link as a name of your choice)";
  }

  Template.menu.curSelected = function () {
    console.log("curSelected: "+Session.get("selected_pallet"));
    return Pallets.findOne({pID: Session.get("selected_pallet")});
  }

  Template.menu.totalStock = function () {
    //console.log(Session.equals("selected_pallet", 0));
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
      Meteor.call('addStock', this.pallet, this.type, +qty, true, comment);
      Session.set("selected_action", 'none');
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
      Meteor.call('removeStock', this.pallet, this.type, +qty, true, comment, function (err, data) {
        if (data === -1) {
          alert("Cannot remove more than exists");
        }
      });
      Session.set("selected_action", 'none');
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
      Meteor.call('moveStock', this.pallet, dest, this.type, +qty, comment, function (err, data) {
        if (data === -1) {
          alert ("Cannot move more stock than available");
        }
      });
      Session.set("selected_action", 'none');
      Session.set("moving", false);
      Session.set("moveFrom", 'none');
      Session.set("moveTo", 'none');
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
      Meteor.call('addStock', this.pID, type, +qty, true, comment);
      Session.set("selected_action", 'none');
    },

    'click #backup_restore_stock' : function () {
      var file = $('#backup_upload_stock').get(0).files[0];
      var reader = new FileReader();
      reader.readAsText(file);
      reader.onload = function () {
        var lines = this.result.split('\n');
        //check if correct document
        if (lines[0] === '**WBS Warehouse Stock Data Backup**') {
          //continue to parse
          Meteor.call('resetStockData');
          console.log("Lines found: "+lines.length);
          for (var i = 1; i < lines.length; i++) {
            console.log("curLine: "+lines[i]);
            curLine = lines[i].split(' ');
            var type = curLine[0];
            var perbox = curLine[1]
            var price = curLine[2];
            var uLength = curLine[3];
            var uWidth = curLine[4];
            var uHeight = curLine[5];
            if (type !== '') {
              Meteor.call('newStockData', type, perbox, price, uLength, uWidth, uHeight);
            }
          }
        } else {
          alert("Wrong file!");
        }
      }
    },
    'click #backup_generate_stock' : function () {
      var backupData = "**WBS Warehouse Stock Data Backup**\n";
      var allStockData = StockData.find();
      allStockData.forEach (function (stock) {
        var curStockData = stock.type + ' ';
        curStockData += stock.perbox + ' ';
        curStockData += stock.price + ' ';
        curStockData += stock.uLength + ' ';
        curStockData += stock.uWidth + ' ';
        curStockData += stock.uHeight;

        backupData += curStockData + "\n";
      });
      Session.set("backupDataStock", backupData);

      Session.set("timerCountStock", 11);
      function timerCountdownStock() {
        curTimer = Session.get("timerCountStock");
        if (curTimer > 0) {
          Session.set("timerCountStock", curTimer - 1);
          setTimeout(timerCountdownStock, 1000);
        } else {
          Session.set("backupDataStock", '');
        }
      }
      timerCountdownStock();
    },

    'click #backup_restore_pallet' : function () {
      var file = $('#backup_upload_pallet').get(0).files[0];
      var reader = new FileReader();
      reader.readAsText(file);
      reader.onload = function () {
        var lines = this.result.split('\n');
        //check if correct document
        if (lines[0] === '**WBS Warehouse Pallet Data Backup**') {
          //continue to parse
          Meteor.call('resetPallets');
          console.log("Lines found: "+lines.length);
          for (var i = 1; i < lines.length; i++) {
            console.log("curLine: "+lines[i]);
            curLine = lines[i].split(' ');
            var pID = curLine[0];
            var numStockTypes = curLine[1];
            var stock = [];
            for (var j = 0; j < numStockTypes; j++) {
              var type = curLine[2+(2*j)];
              var qty = +curLine[3+(2*j)];
              console.log("Adding " + qty+type + " to " + pID);
              Meteor.call('newStock', +pID, type, qty);
            }
          }
        } else {
          alert("Wrong file!");
        }
      }
    },
    'click #backup_generate_pallet' : function () {
      var backupData = "**WBS Warehouse Pallet Data Backup**\n";
      var allPallets = Pallets.find();
      allPallets.forEach (function (pallet) {
        if (pallet.stock.length > 0) {
          var curPalletData = pallet.pID + ' ';
          curPalletData += pallet.stock.length + ' ';
          for (var i = 0; i < pallet.stock.length; i++) {
            curPalletData += pallet.stock[i].type + ' ';
            curPalletData += pallet.stock[i].qty + ' ';
          }
          backupData += curPalletData + "\n";
        }
      });
      Session.set("backupDataPallet", backupData);

      Session.set("timerCountPallet", 11);
      function timerCountdownPallet() {
        curTimer = Session.get("timerCountPallet");
        if (curTimer > 0) {
          Session.set("timerCountPallet", curTimer - 1);
          setTimeout(timerCountdownPallet, 1000);
        } else {
          Session.set("backupDataPallet", '');
        }
      }
      timerCountdownPallet();
    }
  });

  Template.logbook.entries = function () {
    return LogBook.find();
  }

  Template.logbook.actionEquals = function (action) {
    return (this.action === action);
  }

  Template.logbook.hidden = function () {
    return Session.equals("log_hidden", true) ? "hidden" : '';
  }

  Template.logbook.parsedDate = function () {
    var date = new Date(this.date);
    return date.getDate() + "/" + date.getMonth() + "/" + date.getFullYear() +
           " " + date.getHours() + ":" + date.getMinutes();
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
    },

    'mouseover .logtype' : function (event) {
      Session.set("searchTerm", event.currentTarget.innerText);
    },
    'mouseout .logtype' : function () {
      Session.set("searchTerm", $('#searchbar').val().trim().toUpperCase());
    },
    'click .logtype' : function (event) {
      $('#searchbar').val(event.currentTarget.innerText);
    },

    'mouseover .logpallet' : function (event) {
      var content = event.currentTarget.innerText.split(" ");
      Session.set("moving", true);
      Session.set("moveTo", +content[1]);
    },
    'mouseout .logpallet' : function () {
      Session.set("moving", false);
      Session.set("moveTo", 'none');
    },

    'mouseover .logmove' : function (event) {
      var content = event.currentTarget.innerText.split(" ");
      Session.set("moving", true);
      console.log("MOVING "+content[1]+content[4]);
      Session.set("moveFrom", +content[1]);
      Session.set("moveTo", +content[4]);
    },
    'mouseout .logmove' : function () {
      Session.set("moving", false);
      Session.set("moveFrom", 'none');
      Session.set("moveTo", 'none');
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
      addStock: function (id, type, qty, log, comment) {
        if (qty === 0) {
          return;
        }
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
          Meteor.call('addStock', 0, type, qty, false, '');
        }

        if (log === true) {
          Meteor.call('log', 'Added', qty, type, id, '', comment);
        }
      },
      removeStock: function (id, type, qty, log, comment) {
        if (qty === 0) {
          return -2;
        }
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
            Meteor.call('removeStock', 0, type, qty, false);
          }
        } else {
          log = false;
          console.log ("trying to remove more stock than available");
          return -1;
        }
        if (log === true) {
          Meteor.call('log', 'Removed', qty, type, id, '', comment);
        }
      },
      moveStock: function (palletFrom, palletTo, type, qty, comment) {
        var code = Meteor.call('removeStock', palletFrom, type, qty, false, '');
        if (code == -1) {
          //removed more than available
          return -1
        } else if (code === -2) {
          //removed 0
          return -2;
        } else {
          Meteor.call('addStock', palletTo, type, qty, false, '');
          Meteor.call('log', 'Moved', qty, type, palletFrom, palletTo, comment);
          return 0;
        }
      },
      log: function (action, qty, type, palletFrom, palletTo, comment) {
        console.log(action + qty + type + palletFrom + palletTo + comment);
        if (action === 'Moved') {
          LogBook.insert({action: action,
                          qty: qty,
                          type: type,
                          palletFrom: palletFrom,
                          palletTo: palletTo,
                          comment: comment,
                          date: new Date().getTime()});
        } else {
          LogBook.insert({action: action,
                          qty: qty,
                          type: type,
                          pallet: palletFrom,
                          comment: comment,
                          date: new Date().getTime()});
        }
      },
      'resetPallets': function () {
        Pallets.update({}, {$set: {stock: []}}, {multi: true});
      },
      'resetStockData': function () {
        StockData.remove({});
      },
      'newStockData': function (type, perbox, price, uLength, uWidth, uHeight) {
        StockData.insert({type: type, perbox: perbox, price: price, uLength: uLength, uWidth: uWidth, uHeight: uHeight});
      }
    });
    if (StockData.find().count() === 0) {
      StockData.insert({type: 'EM36LED-B', perbox: 6, uLength: 125, uWidth: 16, uHeight: 6});
      StockData.insert({type: 'EMR15LED', perbox: 6, uLength: 125, uWidth: 16, uHeight: 6});
      StockData.insert({type: 'EM18LED-B', perbox: 6, uLength: 125, uWidth: 16, uHeight: 6});
      StockData.insert({type: 'EM18LED', perbox: 6, uLength: 125, uWidth: 16, uHeight: 6});
    }
    if (Pallets.find().count() === 0) {
      for (var i = 1; i <= 128; i++) {
        var curBay = Math.floor ((i-1) / 8) + 1;
        var subBay = Math.floor ((i-1) / 4) % 2;
        var level = ((i-1) % 4) + 1;
        Pallets.insert({pID: i, bay: curBay, subbay: subBay, level: level, stock: []});
      }
      Pallets.insert({pID: 0, bay: 0, subbay: 0, level: 0, stock: []});
    }
  });
}

